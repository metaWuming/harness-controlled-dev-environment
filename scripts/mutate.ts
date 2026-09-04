#!/usr/bin/env node
/**
 * scripts/mutate.ts — mutation testing 跑者(把紀律換成機器)
 *
 * 可控開發環境 Layer 3。為什麼需要這支:
 *   mutation testing 的**操作紀律**靠人守很脆:
 *
 *   ① **破壞性驗證前沒 commit** → 收尾 `git checkout -- <file>` 把**還沒提交的
 *      編輯**一起抹掉。踩多次之後,唯一穩定的解法就是「乾淨工作樹 = 唯一可跑條件」。
 *   ② **樣本字串沒對上時 replace 靜靜 no-op** → 套件當然全綠,於是你以為
 *      「驗過了、測試有效」,其實**根本沒改到東西**。
 *   ③ **沒有對照** → 套件如果本來就紅(環境問題、上一刀沒收乾淨),mutation 轉紅
 *      證明不了任何事;反過來說,還原後如果沒回綠,前面每一條判定都作廢。
 *
 * 所以本工具的三道閘就是這三條,**全部 fail-closed**:
 *   閘① 開跑前 `git status --porcelain` 非空 → **拒跑**(乾淨工作樹＝git 本身就是還原保險)
 *   閘② 樣本不存在／出現多次而未 `--all`／find === replace → **無法判定**,不是「跳過」
 *   閘③ 收尾還原(用記憶體裡的原文 **Buffer**,不用 `git checkout --`)並**重跑對照**;
 *        對照是紅的 → 本次全部判定作廢
 *
 * 外加一條常見的假綠形狀:**turbo 快取**。從 monorepo root 跑 `turbo run test` 命中
 * FULL TURBO 就會拿到快取結果(對你的工作樹什麼都沒證明);偵測到就判無法判定。
 * 非 turbo 專案永遠不會命中、這段邏輯是無害的。
 *
 * 🔴 **閘① 只保護 git 工作樹之內的檔案**,所以「目標必須在 repo 內、且被 git 追蹤」
 *    本身就是安全契約的一部分(見 `checkTarget`)。`../outside.txt`、指向 repo 外的
 *    symlink、`.git/index` 都會讓「repo 全乾淨」這個保險完全失效。
 *
 * ⚠️ **已知極限**:`O_NOFOLLOW` 只保護路徑的**最後一段**。祖先目錄被搬走、再用 symlink
 *    指向 repo 外含同一個 inode 的目錄時,`dev/ino/nlink` 檢查會全數通過而真的寫到
 *    repo 外。要完整封住得逐層用 directory fd／`openat` 語意解析,而 **Node 沒有暴露
 *    `openat`**——真正的解法是改在拋棄式 worktree 裡跑。
 *
 * 🔴 **驗證指令一律當成可能壞掉的外部程序**:非 0 的 exit code 才算「測試轉紅」;
 *    spawn 失敗、被訊號砍掉、輸出爆量都是**基礎設施錯誤**,一律無法判定。
 *    把兩者混為一談,這支「偵測假綠的工具」自己就會報假綠。
 *
 * 每條 mutation **強制要有 label**(在驗哪一條不變量)。理由是「跑過 mutation 本身
 * 會變成新的假安全感」——覆蓋率宣稱要能逐條對得上:收尾摘要就是那張可以直接貼進 PR 的
 * 對照表。
 *
 * Usage:
 *   # 單條
 *   npx tsx scripts/mutate.ts --file src/example.ts \
 *     --find 'if (!isAdmin) throw' --replace 'if (false) throw' \
 *     --label '刪掉 admin 檢查應該讓授權測試轉紅'
 *
 *   # 一批(可重現、可貼進 PR)
 *   npx tsx scripts/mutate.ts --spec scripts/mutations/example-fail-closed-guard.json
 *
 * Options:
 *   --spec <file>     JSON 陣列,每項 {file, find, replace, label, all?}
 *   --file/--find/--replace/--label   單條 mutation(與 --spec 二選一)
 *   --all             允許樣本出現多次時全部替換(預設:多於一處就拒跑,避免誤傷)
 *   --cmd <shell>     驗證指令,預設 `npx vitest run`。**這是明示的 shell 介面**——
 *                     它就是你自己打的命令;spec 的任何欄位都不會被插值進來。
 *   --cwd <dir>       指令的工作目錄(repo 相對),預設 `.`。monorepo + turbo 專案
 *                     請指到跑 test 的子專案目錄以繞開 turbo 快取(見上方說明)。
 *
 * Exit:  0 = 全部 mutant 被抓到 ／ 1 = 有 mutant 存活(覆蓋缺口)
 *        2 = 無法判定(拒跑／樣本沒對上／對照紅／turbo 快取／基礎設施錯誤／還原失敗／未預期例外)
 *        —— 2 的語意刻意對齊 `check:cso`:**任何無法判定都當成沒過**。
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { detectInvocation, reportIfNotMain } from "./lib/invoked-as-main";

// ───────────────────────────────────────── 型別

export interface MutationSpec {
  /** repo 相對路徑 */
  file: string;
  /** 要被改掉的樣本字串(原文,非 regex——regex 容易誤傷且不好逐條對照) */
  find: string;
  /** 改成什麼 */
  replace: string;
  /** 這條在驗哪一條不變量。**必填**,收尾摘要直接貼進 PR 用 */
  label: string;
  /** 樣本出現多處時是否全換。預設 false＝多於一處就拒跑 */
  all?: boolean;
}

export type Verdict =
  /** 測試抓到了(mutation 讓套件轉紅)——這是我們要的 */
  | "killed"
  /** mutant 存活:改壞了但套件還是綠 → 覆蓋缺口 */
  | "survived"
  /** 無法判定:閘門擋下、基礎設施錯誤,或對照本身是紅的 */
  | "inconclusive";

export interface MutationResult {
  spec: MutationSpec;
  verdict: Verdict;
  /** 無法判定時的原因(人看得懂的一句話) */
  reason?: string;
  occurrences: number;
}

// ───────────────────────────────────────── 閘① 乾淨工作樹

export interface TreeState {
  clean: boolean;
  entries: string[];
}

/**
 * `git status --porcelain` 的輸出判乾淨。
 *
 * **非空一律拒跑,沒有 escape hatch flag**——這支工具存在的唯一理由就是紀律擋不住,
 * 留個 `--allow-dirty` 等於把它變回紀律。要跑就先 commit 或 stash。
 * (gitignore 掉的檔本來就不會出現在 porcelain,所以這條不會被 build 產物誤觸。)
 */
export function parseTreeState(porcelain: string): TreeState {
  const entries = porcelain
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  return { clean: entries.length === 0, entries };
}

// ───────────────────────────────────────── 目標路徑的安全契約

/** 純函式:解析後的路徑是否真的被 repo root 包住(`..` 逃逸在這裡被擋下)。 */
export function isInsideRepo(repoRootReal: string, targetReal: string): boolean {
  const rel = path.relative(repoRootReal, targetReal);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/** 純函式:是否落在 `.git/` 內部(改那裡等於改 git 自己的狀態,閘① 保不住)。 */
export function isGitInternal(repoRootReal: string, targetReal: string): boolean {
  const rel = path.relative(repoRootReal, targetReal);
  return rel === ".git" || rel.startsWith(`.git${path.sep}`);
}

/**
 * 純函式:這份 bytes 是不是「可以安全地用字串改再寫回去」的文字檔。
 *
 * 二進位檔用 UTF-8 字串來回一趟會**默默改掉 bytes**,還原就不再是還原了。
 * 判準:UTF-8 來回等價,且不含 NUL(合法 UTF-8 但幾乎必定是二進位)。
 */
export function isUtf8Text(buf: Buffer): boolean {
  if (buf.includes(0)) return false;
  return Buffer.from(buf.toString("utf-8"), "utf-8").equals(buf);
}

export interface TargetCheck {
  ok: boolean;
  reason?: string;
  /** ok 時:解析後的絕對路徑 */
  abs?: string;
  /** ok 時:原始 bytes(還原用;**不是** string) */
  original?: Buffer;
  /** ok 時:**權威身分**,取自讀內容的那同一個 fd(不是事後再 lstat 一次) */
  dev?: number;
  ino?: number;
  /** ok 時:原始權限位元。git 不追蹤一般 permission bits,所以要自己記、自己還原 */
  mode?: number;
}

/**
 * 純讀 caller 專用的目標檔安全檢查結果(P2#3 defer ⑥)。
 *
 * 🔴 **僅供純讀 caller、絕不可供破壞性寫回**——寫回請用 `checkTarget`。
 *
 * 型別刻意設計為 discriminated union(非 interface + optional)、且**刻意不含**
 * `dev` / `ino` / `mode` / `abs`:
 *   - `dev` / `ino` / `mode` 是 `writeCheckedSync` 的**寫入身分能力**——只有需要
 *     覆寫檔案的 caller 才需要,由型別編譯期阻斷純讀 API 誤接寫回(TypeScript
 *     narrowing 讓 `if (result.ok)` 分支只暴露 `original`,傳給
 *     `writeCheckedSync` 會 compile error)。
 *   - `abs` 目前純讀 caller 不用,刪以進一步收窄能力;若日後有寫回需求,必須改用
 *     `checkTarget`、不得從此型別擴增。
 *
 * `if (result.ok)` 由 TS type narrowing 證明 `original` 是 `Buffer`(非
 * optional)——這是 union 相對 `interface + optional` 的關鍵差別。
 */
export type ReadTargetCheck =
  | { ok: true; original: Buffer }
  | { ok: false; reason: string };

/**
 * 私有共用 helper(P2#3 defer ⑥;Codex Step 4 P2-1 修:diagnostic precedence
 * 與 base checkTarget 完全一致)。把六道 fail-closed 邊界 + `O_NOFOLLOW` +
 * 同 fd fstat 集中在此,供 `checkTarget`(破壞性 mutate 用)與
 * `readCheckedTarget`(純讀用)共用。
 *
 * caller 傳 `gateAfterFstat` 決定「fstat 後、read 前」的額外拒判:
 *   - `checkTarget` 傳 `nlink !== 1` 拒判 → 保住 base observable behavior
 *     (hardlink 拒判優先於 UTF-8 拒判 / read 錯誤)
 *   - `readCheckedTarget` 傳 `null`(不 gate)→ 純讀跳 nlink 檢查
 *
 * 順序 = 六道邊界 → open → fstat → gateAfterFstat(caller 拒判時機)
 *      → read → UTF-8 檢 → close。UTF-8 / read 錯誤絕不搶在 gateAfterFstat 之前。
 */
function openAndReadTracked(
  repoRootReal: string,
  rel: string,
  gateAfterFstat: (fst: fs.Stats) => string | null,
): { ok: true; abs: string; fst: fs.Stats; original: Buffer } | { ok: false; reason: string } {
  if (path.isAbsolute(rel)) return { ok: false, reason: "要用 repo 相對路徑,不收絕對路徑" };

  const abs = path.resolve(repoRootReal, rel);
  // symlink 本身要能被看見,所以只 realpath 到「父目錄」,不 realpath 目標。
  let parentReal: string;
  try {
    parentReal = fs.realpathSync(path.dirname(abs));
  } catch {
    return { ok: false, reason: `上層目錄不存在:${path.dirname(rel)}` };
  }
  const targetReal = path.join(parentReal, path.basename(abs));

  if (!isInsideRepo(repoRootReal, targetReal)) {
    return { ok: false, reason: "目標在 repo 之外——閘①(乾淨工作樹)保不住它,拒跑" };
  }
  if (isGitInternal(repoRootReal, targetReal)) {
    return { ok: false, reason: "目標在 .git/ 內部——那是 git 自己的狀態,拒跑" };
  }

  let st: fs.Stats;
  try {
    st = fs.lstatSync(targetReal);
  } catch {
    return { ok: false, reason: `檔案不存在:${rel}` };
  }
  if (st.isSymbolicLink()) {
    return { ok: false, reason: "目標是 symlink——可能指到 repo 之外,拒跑" };
  }
  if (!st.isFile()) {
    return { ok: false, reason: "目標不是一般檔案(目錄／裝置／FIFO)" };
  }

  // 必須被 git 追蹤:沒被追蹤的檔案不會出現在 `git status` 的比對基準裡,
  // 還原失敗時也沒有 `git checkout --` 這條救命路。
  const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", targetReal], {
    cwd: repoRootReal,
    stdio: "ignore",
  });
  if (tracked.status !== 0) {
    return { ok: false, reason: "檔案沒有被 git 追蹤——還原失敗時沒有救命路,拒跑" };
  }

  // 開一次 fd,identity 與內容都從它來(中間沒有可被掉包的視窗)
  let fd: number;
  try {
    fd = fs.openSync(targetReal, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ELOOP" || err.code === "EMLINK") {
      return { ok: false, reason: "目標是 symlink——可能指到 repo 之外,拒跑" };
    }
    return { ok: false, reason: `開不了檔案:${err.message}` };
  }
  try {
    const fst = fs.fstatSync(fd);
    if (!fst.isFile()) return { ok: false, reason: "目標不是一般檔案(目錄／裝置／FIFO)" };
    // 🔴 gateAfterFstat 拒判優先於 read + UTF-8——保住 base checkTarget 的
    //    「hardlink 拒判先於 read/UTF-8 錯誤」diagnostic precedence(Codex Step 4 P2-1)。
    const gateReason = gateAfterFstat(fst);
    if (gateReason !== null) return { ok: false, reason: gateReason };
    const original = fs.readFileSync(fd);
    if (!isUtf8Text(original)) {
      return { ok: false, reason: "不是 UTF-8 文字檔——用字串改再寫回去會破壞原 bytes,拒跑" };
    }
    return { ok: true, abs: targetReal, fst, original };
  } catch (e) {
    return { ok: false, reason: `讀不到檔案:${(e as Error).message}` };
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * 目標檔的完整安全檢查。**閘① 的保險只覆蓋 git 工作樹**,所以這裡要把
 * 「不在工作樹裡」的每一種形狀擋掉,否則 repo 看起來全乾淨、卻已經改壞了別的東西。
 * (Codex review round 1 P1,已用 `../outside.txt` 實際重現。)
 *
 * 🔴 Codex review round 4 P2:舊版在這裡讀內容、**稍後才另外 lstat 一次**記下 inode。
 * 兩者之間目標被換掉的話,工具會把新 inode 當成合法目標,最後卻拿舊 inode 的 bytes
 * 去還原——覆蓋並吃掉競態期間寫進去的新內容。
 * 現在:**開一次 fd**,`fstat` 與讀內容都來自同一個 fd,identity 一路帶下去。
 *
 * 🔴 Codex review round 4 P2:也擋 hardlink(`nlink > 1`)——原地覆寫會同時改動
 * 所有 alias,其中可能有 repo 外的檔案,而 `treeDirt` 看不見 repo 外的副作用。
 *
 * 🔴 P2#3 defer ⑥:純讀 caller 請改用 `readCheckedTarget`。本函式回傳的
 * `dev` / `ino` / `mode` 是 `writeCheckedSync` 的**寫入身分能力**;
 * `readCheckedTarget` 型別不含這些欄位、**絕不可供寫回**。
 */
export function checkTarget(repoRootReal: string, rel: string): TargetCheck {
  // 🔴 gateAfterFstat 傳 nlink 拒判,保住 base observable behavior:
  //    hardlink 拒判優先於 read + UTF-8 錯誤(Codex Step 4 P2-1)。
  const inner = openAndReadTracked(repoRootReal, rel, (fst) =>
    fst.nlink !== 1
      ? `目標有 ${fst.nlink} 個 hardlink——原地覆寫會一併改到其他 alias(可能在 repo 外),拒跑`
      : null,
  );
  if (!inner.ok) return { ok: false, reason: inner.reason };
  const { abs, fst, original } = inner;
  return { ok: true, abs, original, dev: fst.dev, ino: fst.ino, mode: fst.mode & 0o7777 };
}

/**
 * 純讀 caller 專用的目標檔檢查(P2#3 defer ⑥)。
 *
 * 🔴 **僅供純讀 caller、絕不可供破壞性寫回**——寫回請用 `checkTarget`。
 *
 * 與 `checkTarget` 共用六道 fail-closed 邊界(absolute path / parent realpath /
 * repo 邊界 / .git 內 / lstat/symlink/非一般檔 / git untracked)+ `O_NOFOLLOW` +
 * 同 fd fstat/read;**唯一差別**:`readCheckedTarget` 跳過 `nlink=1` 檢查。
 * 理由:純讀不寫回,hardlink alias 不會被誤改;破壞性 mutate 路徑仍走
 * `checkTarget`(nlink 第一道)+ `writeCheckedSync` 內部 nlink=1 檢查(第二道防線)。
 *
 * 回傳 `ReadTargetCheck` discriminated union,**刻意不含** `dev` / `ino` /
 * `mode` / `abs`——由 TypeScript 編譯期阻斷純讀 API 誤接破壞性寫回。
 */
export function readCheckedTarget(repoRootReal: string, rel: string): ReadTargetCheck {
  // 純讀不 gate nlink;UTF-8 檢查仍在 helper 內對 read 後的 bytes 執行(既有邊界一致)
  const inner = openAndReadTracked(repoRootReal, rel, () => null);
  if (!inner.ok) return { ok: false, reason: inner.reason };
  return { ok: true, original: inner.original };
}

// ───────────────────────────────────────── 閘② 樣本真的套用

export interface ApplyOutcome {
  ok: boolean;
  /** 失敗原因;ok 時不存在 */
  reason?: string;
  /** 替換後的內容;ok 時必有 */
  output?: string;
  occurrences: number;
}

/**
 * 純函式:算出替換結果,並在「其實什麼都沒改到」的每一種形狀上 fail-closed。
 *
 * 三種靜默 no-op(全都會讓你以為驗過了):
 *   - 樣本不存在 → replace 回傳原字串,套件全綠
 *   - find === replace → 同上
 *   - 樣本出現多處但你只想改一處 → 改了 N 處,紅的原因可能不是你以為的那處
 */
export function applyMutation(source: string, spec: MutationSpec): ApplyOutcome {
  if (spec.find.length === 0) {
    return { ok: false, reason: "find 是空字串——空樣本會匹配到任何地方", occurrences: 0 };
  }
  if (spec.find === spec.replace) {
    return { ok: false, reason: "find 與 replace 相同——這條 mutation 什麼都沒改", occurrences: 0 };
  }

  const occurrences = source.split(spec.find).length - 1;
  if (occurrences === 0) {
    return {
      ok: false,
      reason: "樣本字串在檔案裡找不到(改過名?縮排不同?)——這正是「以為驗過其實沒改到」的形狀",
      occurrences: 0,
    };
  }
  if (occurrences > 1 && !spec.all) {
    return {
      ok: false,
      reason: `樣本出現 ${occurrences} 處,未指定 --all——改多處會讓「為什麼紅」對不上,請把樣本寫長一點`,
      occurrences,
    };
  }

  const output = spec.all ? source.split(spec.find).join(spec.replace) : source.replace(spec.find, spec.replace);
  if (output === source) {
    // 理論上到不了(前面都擋掉了),留著當最後一道 assert
    return { ok: false, reason: "替換後內容與原文相同", occurrences };
  }
  return { ok: true, output, occurrences };
}

// ───────────────────────────────────────── 假綠:turbo 快取

/**
 * monorepo + turbo 專案的常見假綠:從 root 跑 `turbo run test` 會命中 turbo 快取,
 * 25ms 就「綠」了,**對當下工作樹什麼都沒證明**。偵測到就判無法判定。
 * 非 turbo 專案永遠不會命中、這段邏輯是無害的。
 *
 * 🔴 **偵測必須行錨定在 turbo 的收尾摘要上,不能只 grep 字串**——測試名稱裡剛好有
 * `FULL TURBO` 四個字時,舊版寬鬆的 `/FULL TURBO/i` 會把它當成快取命中,好好的一條
 * killed 被降級成「無法判定」。這是假綠圖鑑第 ⑦ 種(環境被 mutation 污染)的近親:
 * **偵測器的輸入被被測物污染。**
 *
 * turbo 2.10.8 的實際格式(已實測):
 *   ` Tasks:    2 successful, 2 total`
 *   `Cached:    2 cached, 2 total`
 *   `  Time:    9ms >>> FULL TURBO`
 * 部分快取(`Cached: 1 cached, 2 total`)同樣算——被快取的那幾個 task 根本沒跑。
 */
export function turboLineIsCacheHit(line: string): boolean {
  if (/^\s*Time:.*>>> FULL TURBO/.test(line)) return true;
  const cached = line.match(/^\s*Cached:\s+(\d+) cached/);
  return cached ? Number(cached[1]) > 0 : false;
}

/** 對整段輸出判定(純函式,給測試與非串流情境用)。 */
export function looksLikeTurboCache(output: string): boolean {
  return output.split("\n").some(turboLineIsCacheHit);
}

/** carry 的硬上限。兩個判準都錨在**行首**,所以留行首那段就夠。 */
export const CARRY_CAP = 64 * 1024;

export interface LineScanner {
  /** 餵一段(可能不含換行的)文字;回傳「到目前為止有沒有命中過」 */
  push(text: string): boolean;
  /** 串流結束:把最後沒有換行的殘段也判一次 */
  finish(): boolean;
  /** 目前緩衝了多少字元——**這就是「記憶體有界」這條不變量的觀測點** */
  readonly carryLength: number;
}

/**
 * 串流逐行掃 turbo 快取摘要。
 *
 * 🔴 Codex review round 2 P2:不能只掃「最後保留的那段輸出」——摘要行後面再噴 5 MB
 * 就會把它沖掉,於是快取漏判、mutant 被錯報成 survived。所以命中過就永久記住。
 *
 * 🔴 Codex review round 4 P1:carry 不能無上限成長——一段**完全沒有換行**的巨量輸出
 * 會把記憶體撐爆。抽成這個工廠函式的原因就是要讓 `carryLength` 變成可以直接斷言的狀態:
 * 「記憶體有界」是資源不變量,光看工具的 exit code **永遠觀測不到**,
 * 只能把它降到一個能單測的單元上。
 */
export function createLineScanner(cap: number = CARRY_CAP): LineScanner {
  let carry = "";
  let hit = false;
  return {
    push(text: string): boolean {
      if (hit) return true;
      let rest = text;
      for (;;) {
        const nl = rest.indexOf("\n");
        if (nl < 0) {
          const room = cap - carry.length;
          if (room > 0) carry += rest.slice(0, room);
          return hit;
        }
        const head = (carry + rest.slice(0, Math.min(nl, cap))).slice(0, cap);
        if (turboLineIsCacheHit(head)) hit = true;
        carry = "";
        rest = rest.slice(nl + 1);
        if (hit) return true;
      }
    },
    finish(): boolean {
      if (!hit && carry.length > 0 && turboLineIsCacheHit(carry)) hit = true;
      return hit;
    },
    get carryLength() {
      return carry.length;
    },
  };
}

// ───────────────────────────────────────── 驗證指令的結果分類

export type RunOutcome =
  /** 指令 exit 0 */
  | "green"
  /** 指令回了**數字**且非 0 ＝ 測試真的轉紅 */
  | "red"
  /** 基礎設施錯誤:spawn 失敗、被訊號砍掉、沒有 exit code。**不是**「測試轉紅」 */
  | "infra";

/**
 * 純函式:把子程序的收場分成三類。
 *
 * 🔴 這是 Codex review 抓到的 P1:舊版用 `execFileSync` + try/catch,把
 * **所有**例外都當成「測試轉紅」。用一條「mutant 輸出 2 MB、對照正常」的指令重現後,
 * 工具 exit 0 宣稱「全部被抓到」,實際上驗證程序只是撞到預設 maxBuffer——
 * **偵測假綠的工具自己報了假綠。** 改成 async spawn 之後 maxBuffer 由我們自己控,
 * 但 spawn 失敗與訊號中止仍要跟「非 0 exit」分開。
 */
export function classifyRun(
  status: number | null,
  signal: NodeJS.Signals | string | null,
  error?: { code?: string; message?: string },
): { outcome: RunOutcome; detail?: string } {
  if (error) {
    return {
      outcome: "infra",
      detail: `驗證指令無法執行(${error.code ?? "spawn 失敗"}:${error.message ?? ""})——不是「測試轉紅」`,
    };
  }
  if (signal) {
    return { outcome: "infra", detail: `驗證指令被訊號 ${signal} 中止——不是「測試轉紅」` };
  }
  if (typeof status !== "number") {
    return { outcome: "infra", detail: "驗證指令沒有回傳 exit code——不是「測試轉紅」" };
  }
  // 🔴 Codex review round 1 P1:我們監看的是 `bash -c`,真正的 test 程序在它裡面跑。
  //    若 test 程序被 SIGKILL / OOM 殺掉,bash 通常**正常退出**並回傳 `128 + signum`
  //    (shell 慣例):SIGKILL → 137、SIGTERM → 143。這條路徑上 `signal` 永遠是 null
  //    (bash 自己沒被砍),於是舊版把 137/143 當成「測試轉紅」,mutant 被錯報 killed。
  //
  // 🔴 Codex review round 2 P2(縮 R1 fix 範圍):`128–255` 不是全域可視為 signal 的
  //    區間——`bash -c 'exit 200'`、`exit 128`、`exit 255` 都是合法且可直接產生的
  //    exit code,使用者可能用它們當自訂 test 失敗訊號。原本「一律歸 infra」把
  //    `grep -q FOO src/x || exit 200` 這種合法用法誤判 inconclusive。
  //
  // 🔴 Codex review round 3 P1(擴回 R2 縮太多):只認 137/143 又漏了 SIGSEGV(139)、
  //    SIGABRT(134)、SIGINT(130)、SIGPIPE(141)、SIGXCPU(152) 這些同樣是「程序
  //    崩潰或被砍」情境。折衷:認**已知常見 fatal signal 對應的 128+signum**,
  //    其他 128-255 恢復當 red。
  //    ⚠️ 誠實界線:單靠 exit code 分不出「使用者明確 exit 137」與「子程序被 SIGKILL
  //    後 bash 回 137」——這是接受的損失。**test runner 罕用這些碼當自訂 fail 碼**,
  //    但**若真的碰到、請把 test 命令包一層 map 回 1-127** 常規失敗碼。
  const SIGNAL_EXITS: Record<number, string> = {
    130: "SIGINT",
    134: "SIGABRT",
    137: "SIGKILL / OOM",
    139: "SIGSEGV",
    141: "SIGPIPE",
    143: "SIGTERM",
    152: "SIGXCPU",
  };
  const signalName = SIGNAL_EXITS[status];
  if (signalName) {
    return {
      outcome: "infra",
      detail: `驗證指令 exit ${status}(${signalName}——bash 子程序被砍時的常見退出碼)——不是「測試轉紅」`,
    };
  }
  return status === 0 ? { outcome: "green" } : { outcome: "red" };
}

// ───────────────────────────────────────── 判定

export interface ClassifyInput {
  /** 對照(還原後重跑)是否綠 */
  controlOk: boolean;
  /** 帶著 mutation 跑時是否綠 */
  mutantOk: boolean;
}

/**
 * 判定表。**對照優先**:對照紅 → 不管 mutant 是什麼顏色都作廢。
 * 這條就是閘③ 存在的理由——沒有它,「套件本來就紅」會被誤讀成「測試抓到了」。
 */
export function classify({ controlOk, mutantOk }: ClassifyInput): { verdict: Verdict; reason?: string } {
  if (!controlOk) {
    return {
      verdict: "inconclusive",
      reason: "對照(還原後)是紅的——本次所有判定作廢,先讓套件在乾淨狀態下轉綠",
    };
  }
  return mutantOk
    ? { verdict: "survived", reason: "改壞了但套件仍全綠＝這條不變量沒有測試守著" }
    : { verdict: "killed" };
}

// ───────────────────────────────────────── spec 驗證

export function parseSpecs(raw: unknown): MutationSpec[] {
  const arr = Array.isArray(raw) ? raw : [raw];
  if (arr.length === 0) throw new Error("spec 是空陣列——沒有東西可以驗(空表 = 這道驗證形同虛設)");
  return arr.map((item, i) => {
    const at = `spec[${i}]`;
    if (typeof item !== "object" || item === null) throw new Error(`${at} 不是物件`);
    const o = item as Record<string, unknown>;
    for (const k of ["file", "find", "replace", "label"] as const) {
      if (typeof o[k] !== "string" || (o[k] as string).length === 0) {
        throw new Error(
          k === "label"
            ? `${at}.label 必填——每條 mutation 都要寫「在驗哪一條不變量」,` +
              `否則收尾摘要對不回 PR 的覆蓋率宣稱(跑過 mutation 本身會變成新的假安全感)`
            : `${at}.${k} 必須是非空字串`,
        );
      }
    }
    if (path.isAbsolute(o.file as string)) throw new Error(`${at}.file 要用 repo 相對路徑`);
    return {
      file: o.file as string,
      find: o.find as string,
      replace: o.replace as string,
      label: o.label as string,
      all: o.all === true,
    };
  });
}

// ───────────────────────────────────────── 摘要

/**
 * 純函式:給起手 HEAD 與收尾 HEAD,判定 SHA 綁定是否成立。
 *
 * 🔴 Codex review round 1 P1 的**關鍵不變量**(壓輪數紀律 ⑵:引入新機制 → 補
 *   單測涵蓋)——三條 case 必守:
 *     ① 收尾讀不到 HEAD → fail-closed(drifted=true)
 *     ② startHead !== endHead → fail-closed(drifted=true;期間 HEAD 動了)
 *     ③ 兩者相等 → drifted=false,回 headSha 供摘要印
 */
export function decideHeadBinding(
  startHead: string,
  endHead: string,
): { drifted: boolean; headSha?: string; message?: string } {
  if (!endHead) {
    return { drifted: true, message: "收尾讀不到 HEAD" };
  }
  if (endHead !== startHead) {
    return {
      drifted: true,
      message: `HEAD 在 mutation 期間變動:${startHead} → ${endHead}(可能有外部 clean commit)`,
    };
  }
  return { drifted: false, headSha: startHead };
}

export function formatSummary(
  results: MutationResult[],
  controlOk: boolean,
  /**
   * 跑完當下的 HEAD SHA(選填)。有給就印在收尾分隔線之後、判定訊息之前。
   * 用途:高風險車道要記「exit 0 綁定的最後非 bookkeeping SHA」——這裡直接印出來,
   * Owner／review 直接抄,不用另外跑 `git rev-parse HEAD`(手抄易錯:短 SHA 不夠、跑
   * 完後 HEAD 又前進就更難對)。純函式保持純:不在這裡呼叫 git,由 `main()` 傳進來。
   */
  headSha?: string,
): { text: string; exitCode: number } {
  const lines: string[] = [];
  const killed = results.filter((r) => r.verdict === "killed");
  const survived = results.filter((r) => r.verdict === "survived");
  const inconclusive = results.filter((r) => r.verdict === "inconclusive");

  lines.push("");
  lines.push("─".repeat(72));
  lines.push(`mutation 摘要 — 共 ${results.length} 條｜對照(還原後):${controlOk ? "綠 ✅" : "紅 ✗"}`);
  lines.push("─".repeat(72));
  for (const r of results) {
    const mark = r.verdict === "killed" ? "✅ 抓到" : r.verdict === "survived" ? "🔴 存活" : "⚠️  無法判定";
    lines.push(`${mark}  ${r.spec.label}`);
    lines.push(`         ${r.spec.file}`);
    if (r.reason) lines.push(`         → ${r.reason}`);
  }
  lines.push("─".repeat(72));
  if (headSha) lines.push(`HEAD(綁定 SHA):${headSha}`);

  let exitCode = 0;
  if (!controlOk) {
    exitCode = 2;
    lines.push("⚠️  對照是紅的——本次全部判定作廢,不能宣稱「跑過 mutation」。");
  } else if (inconclusive.length > 0) {
    exitCode = 2;
    lines.push(`⚠️  無法判定 ${inconclusive.length} 條——這幾條等於沒驗,不能算進覆蓋率宣稱。`);
  } else if (survived.length > 0) {
    exitCode = 1;
    lines.push(`🔴 ${survived.length} 條 mutant 存活＝覆蓋缺口。每一條都要補測試或說明為什麼不補。`);
  } else {
    lines.push(`✅ ${killed.length} 條全部被抓到。上面這張表可以直接貼進 PR 當覆蓋率佐證。`);
  }
  return { text: lines.join("\n"), exitCode };
}

// ───────────────────────────────────────── CLI 參數

interface Args {
  spec?: string;
  file?: string;
  find?: string;
  replace?: string;
  label?: string;
  all: boolean;
  cmd: string;
  cwd: string;
}

export function parseArgs(argv: string[]): Args {
  // 預設:非 monorepo 直跑 vitest。turbo 專案應顯式指定 --cwd 到子專案目錄。
  const out: Args = { all: false, cmd: "npx vitest run", cwd: "." };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const take = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`${a} 後面缺參數`);
      return v;
    };
    switch (a) {
      case "--spec": out.spec = take(); break;
      case "--file": out.file = take(); break;
      case "--find": out.find = take(); break;
      case "--replace": out.replace = take(); break;
      case "--label": out.label = take(); break;
      case "--cmd": out.cmd = take(); break;
      case "--cwd": out.cwd = take(); break;
      case "--all": out.all = true; break;
      default: throw new Error(`不認識的參數:${a}`);
    }
  }
  return out;
}

// ───────────────────────────────────────── 還原(模組層狀態,例外路徑也要拿得到)

interface PendingRestore {
  /** 原始 bytes(byte-exact,不經 string 來回) */
  original: Buffer;
  /** 我們動手當下的 inode 身分——還原前要確認「還是同一個檔」 */
  dev: number;
  ino: number;
  /** 原始權限位元。**git 不追蹤一般 permission bits**,所以 treeDirt 看不見 chmod,
   *  必須自己記下來、自己還原(Codex review round 5 P1)。 */
  mode: number;
  /** 我們寫進去的 mutant bytes——還原前拿它比對,就知道驗證指令有沒有動過目標 */
  mutant?: Buffer;
}

/** 還沒還原的檔案:絕對路徑 → 還原所需資訊。**還原失敗的項目留在這裡,不清掉。** */
const pending = new Map<string, PendingRestore>();

export interface RestoreFailure {
  file: string;
  error: string;
}

/**
 * 把所有待還原的檔案寫回去,並**逐 byte 驗證**。
 *
 * 🔴 Codex review round 1 P1:舊版 catch 住錯誤只印一行、然後照樣 `pending.clear()`。
 * 用 `chmod 444 src/a.txt; false` 當驗證指令重現後:工具 exit 1、`git status` 顯示 `M`、
 * 內容還是壞的——**工具最核心的安全契約(跑完工作樹回到原狀)被靜靜違反。**
 * 現在:失敗的項目留在 pending、回傳失敗清單,呼叫端一律 exit 2 並大聲講。
 *
 * 🔴 Codex review round 2 P1(TOCTOU):`checkTarget` 只在**動手之前**檢查,
 * 驗證指令完全可以在跑的期間把目標**換成 symlink**,還原就跟著寫到 repo 外了。
 * 重現:runner exit 0 宣稱「全部被抓到」,但 `src/a.txt` 已變成 symlink、
 * repo 外的檔案被覆寫,git 顯示 `T src/a.txt`。
 * 現在:還原前重新 `lstat` 比對 dev/ino 與檔案型別,並用 `O_NOFOLLOW` 開檔——
 * **被掉包過的目標一律拒寫**,交給 git 去救。
 */
export interface WriteOutcome {
  /** 失敗原因;成功時為 null */
  error: string | null;
  /** **有沒有真的動到檔案**。false ＝ 前置條件擋下來、磁碟原封不動 */
  wrote: boolean;
}

/**
 * 純函式:寫入失敗之後,**該不該還原**?
 *
 * 🔴 Codex review round 6 P1:這條規則看起來只有一行,但它決定的是
 * 「工具會不會反過來毀掉資料」——前置條件擋下時磁碟原封不動,此時還原就是拿舊的
 * `original` 蓋掉別人剛寫進去的東西。抽成獨立函式的理由跟 `createLineScanner`
 * 一樣:那個競態**沒辦法從測試端觸發**(要另一個程序卡在我們兩次系統呼叫之間),
 * 但規則本身可以直接單測。
 */
export function shouldRestoreAfterWriteFailure(w: WriteOutcome): boolean {
  return w.wrote;
}

/**
 * 讀回磁碟內容,逐 byte 比對預期;相同回 `null`,不同回一句話。
 *
 * 🔴 Codex review round 4 P2:短寫／截斷會讓套件因為**壞掉的檔**轉紅,被誤報成
 * 「測試抓到了」。抽成獨立單元的原因跟 `createLineScanner` 一樣——要強迫短寫得做
 * fault injection,但比對邏輯本身可以直接單測。
 */
export function verifyContent(abs: string, expected: Buffer): string | null {
  const actual = fs.readFileSync(abs);
  if (!actual.equals(expected)) {
    return `磁碟內容不等於預期(預期 ${expected.length} bytes,實際 ${actual.length} bytes)`;
  }
  return null;
}

/**
 * 對「確定是原本那個 inode」的檔案寫入 bytes,回傳錯誤訊息或 `null`(成功)。
 *
 * 🔴 Codex review round 3 P2:先 `lstat` 再帶 `O_TRUNC` 開檔,中間仍有一個視窗——
 * 目標被換成**另一個一般檔**時,錯的 inode 會在我們檢查得到之前就先被截斷。
 * `O_NOFOLLOW` 只擋「最後一段是 symlink」,不驗 inode。
 * 正確順序:**先開(不帶 O_TRUNC)→ `fstat(fd)` 核對 dev/ino → 確認後才 ftruncate + write**。
 * mutation 的第一次寫入也走同一條路。
 */
export function writeCheckedSync(
  abs: string,
  data: Buffer,
  expect: { dev: number; ino: number; mode?: number },
  /** 動手前,磁碟上**必須**還是這份 bytes。給第一次寫入用(同 inode 的原地改動也要擋) */
  expectCurrent?: Buffer,
): WriteOutcome {
  // 🔴 Codex review round 6 P1:呼叫端必須分得出「還沒動到檔案的前置條件失敗」
  //    與「寫到一半失敗」。前者若照樣 restore,會拿舊的 original 蓋掉**別人剛寫進去的東西**
  //    ——工具反而變成資料損毀的來源。
  let wrote = false;
  let fd: number;
  try {
    // O_RDWR 而非 O_WRONLY:truncate 之前要能先讀回來比對
    fd = fs.openSync(abs, fs.constants.O_RDWR | fs.constants.O_NOFOLLOW);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ELOOP" || err.code === "EMLINK") {
      return { error: "目標已被換成 symlink——拒絕跟著寫出去", wrote };
    }
    return { error: err.message, wrote };
  }
  try {
    const st = fs.fstatSync(fd);
    if (!st.isFile()) return { error: "目標已不是一般檔案", wrote };
    if (st.dev !== expect.dev || st.ino !== expect.ino) {
      return { error: "目標已被掉包(inode 不同)——拒絕覆寫別的檔", wrote };
    }
    if (st.nlink !== 1) return { error: `目標已多出 hardlink(nlink=${st.nlink})——拒絕連帶改到別的 alias`, wrote };
    // 🔴 Codex review round 5 P2:inode 沒變不代表內容沒變——別的程序可以**原地**改它。
    //    先從同一個 fd 讀回來比對,不符就不要 truncate(否則會吃掉人家剛寫進去的東西)。
    if (expectCurrent) {
      const now = Buffer.alloc(st.size);
      const n = fs.readSync(fd, now, 0, st.size, 0);
      if (n !== st.size || !now.equals(expectCurrent)) {
        return { error: "動手前磁碟內容已經跟讀到的不一樣(有別的程序在改它)——拒絕覆蓋", wrote };
      }
    }
    wrote = true; // 從這裡開始,檔案已經被我們動過了
    fs.ftruncateSync(fd, 0);
    // 🔴 Codex review round 4 P2:`writeSync` 可能短寫。忽略回傳的 byte 數,
    //    截斷過的檔案就會被當成「成功套用」,測試轉紅後誤報 mutant killed。
    let written = 0;
    while (written < data.length) {
      const n = fs.writeSync(fd, data, written, data.length - written, written);
      if (n <= 0) return { error: `寫入中斷(只寫了 ${written}/${data.length} bytes)`, wrote };
      written += n;
    }
    // git 不追蹤一般 permission bits → chmod 過的檔案 treeDirt 看不見,要自己還原
    if (expect.mode !== undefined) {
      fs.fchmodSync(fd, expect.mode);
      if ((fs.fstatSync(fd).mode & 0o7777) !== expect.mode) return { error: "權限位元還原後對不上", wrote };
    }
  } catch (e) {
    return { error: (e as Error).message, wrote };
  } finally {
    fs.closeSync(fd);
  }
  return { error: null, wrote };
}

/**
 * 純函式:從 `git ls-files -v` 的輸出挑出被 index flag 藏起來的檔。
 *
 * 🔴 Codex review round 4 P1:`--untracked-files=all` 只解決「未追蹤檔看不見」。
 * 被標成 **assume-unchanged(小寫 tag)或 skip-worktree(`S`)** 的 tracked 檔,
 * 它的修改**不會出現在 `git status`**——於是閘① 可能接受一棵其實已經髒了的工作樹,
 * `treeDirt` 也可能漏看驗證指令造成的改動而誤報成功。
 */
export function parseIndexFlags(lsFilesV: string): string[] {
  return lsFilesV
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => /^[a-z] |^S /.test(l));
}

export interface RestoreOutcome {
  failures: RestoreFailure[];
  /**
   * 還原時發現「驗證指令原地改過我們寫進去的 mutant」的檔案。
   * 🔴 Codex review round 6 P2:這個以前是**跨 mutation 的全域集合**,
   * 有些錯誤分支還原後沒有消耗它 → 洩漏到下一條,讓下一條被錯判無法判定。
   * 改成隨每次呼叫回傳,狀態不再跨 spec。
   */
  touched: string[];
}

export function restoreAll(): RestoreOutcome {
  const failures: RestoreFailure[] = [];
  const touched: string[] = [];
  for (const [abs, info] of [...pending]) {
    try {
      const st = fs.lstatSync(abs);
      if (st.isSymbolicLink()) {
        failures.push({ file: abs, error: "還原前發現目標已被換成 symlink——拒絕跟著寫出去" });
        continue;
      }
      if (!st.isFile()) {
        failures.push({ file: abs, error: "還原前發現目標已不是一般檔案" });
        continue;
      }
      // 驗證指令有沒有原地改過我們的目標?(不阻擋還原——把樹弄回原狀永遠優先)
      // 內容比對是比 inode 更強的守衛:**Linux 會重用剛釋放的 inode**,
      // 刪掉重建常常拿到同一個 inode number,這時只有內容看得出來被動過。
      if (info.mutant && !fs.readFileSync(abs).equals(info.mutant)) {
        touched.push(abs);
      }
      const { error } = writeCheckedSync(abs, info.original, info);
      if (error) {
        failures.push({ file: abs, error: `還原前發現${error}` });
        continue;
      }
      const mismatch = verifyContent(abs, info.original);
      if (mismatch) {
        failures.push({ file: abs, error: `寫回後 ${mismatch}` });
        continue;
      }
      pending.delete(abs);
    } catch (e) {
      failures.push({ file: abs, error: (e as Error).message });
    }
  }
  return { failures, touched };
}

/**
 * 還原之後,**整棵工作樹**必須跟開跑前一樣乾淨。
 *
 * 🔴 Codex review round 2 P1 的另一半:驗證指令改到的不只我們那個檔——它可以動別的
 * tracked file、改檔案型別(`T`)、改 mode。只驗「我們那個檔還原了」擋不住這些。
 */
/**
 * `git status` 的固定參數。
 *
 * 🔴 Codex review round 3 P2:光寫 `--porcelain` 會受 repo 的
 * `status.showUntrackedFiles=no` 影響——實測有未追蹤檔時它回空字串,
 * **閘① 與還原後的乾淨檢查都會謊報乾淨**。一律指定 `--untracked-files=all`。
 * (gitignore 掉的產物仍然不列,所以不會誤報。)
 */
const GIT_STATUS_ARGS = ["status", "--porcelain=v1", "--untracked-files=all"] as const;

/**
 * 全 repo tracked 檔的權限快照。
 *
 * 🔴 Codex review round 6 P1:`git` **不追蹤一般 permission bits**,所以 `treeDirt`
 * 對 `chmod` 完全瞎。只還原「我們 mutate 的那個檔」不夠——驗證指令可以 chmod 任何
 * tracked 檔,而且**對照那一輪還會再做一次**,於是工具 exit 0、工作樹卻沒回到原狀。
 * 這裡把整棵樹的 mode 拍下來,每輪跑完比對、還原、並把該次判定作廢。
 */
function snapshotModes(repoRoot: string): Map<string, number> | null {
  const r = spawnSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return null;
  const out = new Map<string, number>();
  for (const rel of (r.stdout ?? "").split("\0")) {
    if (!rel) continue;
    try {
      const st = fs.lstatSync(path.join(repoRoot, rel));
      if (st.isFile()) out.set(rel, st.mode & 0o7777);
    } catch {
      /* 檔案不在(例如剛被刪)——內容層的 treeDirt 會抓到,這裡不重複報 */
    }
  }
  return out;
}

/** 比對權限快照,順手把漂掉的還原回去。回傳被改過的相對路徑。 */
function restoreModeDrift(repoRoot: string, snap: Map<string, number>): string[] {
  const drifted: string[] = [];
  for (const [rel, mode] of snap) {
    const abs = path.join(repoRoot, rel);
    try {
      const st = fs.lstatSync(abs);
      if (!st.isFile() || (st.mode & 0o7777) === mode) continue;
      drifted.push(`${rel}(${(st.mode & 0o7777).toString(8)} → 還原成 ${mode.toString(8)})`);
      fs.chmodSync(abs, mode);
    } catch {
      /* 同上 */
    }
  }
  return drifted;
}

function treeDirt(repoRoot: string): { clean: boolean; entries: string[]; readable: boolean } {
  const r = spawnSync("git", [...GIT_STATUS_ARGS], { cwd: repoRoot, encoding: "utf-8" });
  if (r.status !== 0) return { clean: false, entries: [], readable: false };
  // 🔴 Codex review round 5 P1:index flag 不是只有開跑前要驗——**驗證指令自己就能設**。
  //    `git update-index --assume-unchanged src/b.txt` 之後再改它,`git status` 從此
  //    對那個檔閉嘴,還原後與對照後都會謊報乾淨,工具甚至可能 exit 0。
  const lsv = spawnSync("git", ["ls-files", "-v"], { cwd: repoRoot, encoding: "utf-8" });
  if (lsv.status !== 0) return { clean: false, entries: [], readable: false };
  const flagged = parseIndexFlags(lsv.stdout ?? "").map((l) => `(index flag)${l}`);
  const t = parseTreeState(r.stdout ?? "");
  const entries = [...t.entries, ...flagged];
  return { clean: entries.length === 0, entries, readable: true };
}

function reportRestoreFailures(failures: RestoreFailure[]): void {
  if (failures.length === 0) return;
  console.error("\n✗ 還原失敗——工作樹被留在改壞的狀態,先手動救回再繼續:");
  for (const f of failures) {
    console.error(`    ${f.file}\n      ${f.error}`);
    console.error(`      → git checkout -- "${f.file}"`);
  }
}

// ───────────────────────────────────────── 跑驗證指令(async,訊號才進得來)

let activeChild: ChildProcess | null = null;

/** 輸出保留上限。turbo／vitest 的收尾摘要都在**尾端**,所以爆量時砍頭留尾。 */
const MAX_CAPTURE_BYTES = 4 * 1024 * 1024;

export interface RunResult {
  outcome: RunOutcome;
  output: string;
  detail?: string;
  /** 串流過程中**任何一行**命中過 turbo 快取摘要(不是只看最後保留的那段) */
  sawTurboCache: boolean;
}

/**
 * 用 async spawn 跑驗證指令。
 *
 * 🔴 Codex review P1:舊版用 `execFileSync`,它**阻塞事件迴圈**,所以子命令還在跑的時候
 * SIGINT handler 根本進不來。實測:對 runner 送 SIGINT、子 shell 忽略訊號 → 700ms 後
 * runner 還活著、檔案仍是 mutated;CI 接著升級成 SIGKILL 就永久留下 mutation。
 * 改成 async spawn ＋ `detached` 自成 process group,訊號來時整組砍掉再還原。
 *
 * `bash -c` 是**明示的 shell 介面**(`--cmd` 就是使用者自己打的命令);
 * spec 的任何欄位都不會被插值進命令字串。
 */
function runCommand(cmd: string, cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn("bash", ["-c", cmd], { cwd, stdio: ["ignore", "pipe", "pipe"], detached: true });
    } catch (e) {
      resolve({ outcome: "infra", output: "", detail: `spawn 失敗:${(e as Error).message}`, sawTurboCache: false });
      return;
    }
    activeChild = child;

    const chunks: Buffer[] = [];
    let total = 0;
    // 🔴 Codex review round 2 P2:turbo 偵測不能只掃「最後保留的那段」。
    //    砍頭留尾之後,摘要行後面再噴 5 MB 就會把它沖掉——重現到工具沒偵測到快取、
    //    把 mutant 錯判成 survived。改成**串流逐行判定**,命中過就永久記住。
    let sawTurboCache = false;
    // 🔴 Codex review round 3 P2:stdout 與 stderr 是**兩條獨立的串流**,
    //    共用一個 carry 會把它們黏成同一行。重現:stderr 先吐一段沒有換行的雜訊、
    //    stdout 再吐 `Cached: 1 cached...` → 黏起來就不再是行首,快取漏判、錯報 survived。
    // stdout 與 stderr 各一個掃描器——共用會把兩條獨立的流黏成同一行(round 2 P2)
    const scanners = { out: createLineScanner(), err: createLineScanner() };
    const collect = (stream: "out" | "err") => (b: Buffer) => {
      if (!sawTurboCache && scanners[stream].push(b.toString("utf-8"))) sawTurboCache = true;
      chunks.push(b);
      total += b.length;
      while (total > MAX_CAPTURE_BYTES && chunks.length > 1) total -= chunks.shift()!.length;
    };
    child.stdout?.on("data", collect("out"));
    child.stderr?.on("data", collect("err"));

    let settled = false;
    const finish = (r: Omit<RunResult, "sawTurboCache">) => {
      if (settled) return;
      settled = true;
      activeChild = null;
      for (const sc of [scanners.out, scanners.err]) {
        if (!sawTurboCache && sc.finish()) sawTurboCache = true;
      }
      resolve({ ...r, sawTurboCache });
    };

    child.on("error", (err) => {
      const c = classifyRun(null, null, err as NodeJS.ErrnoException);
      finish({ outcome: c.outcome, output: Buffer.concat(chunks).toString("utf-8"), detail: c.detail });
    });
    child.on("close", (code, signal) => {
      const pgid = child.pid;
      const done = (r: Omit<RunResult, "sawTurboCache">) => finish(r);
      // 🔴 Codex review round 3 P1:**leader 結束不等於驗證結束。**
      //    指令可以留下 redirect 掉 stdio 的背景程序;我們照樣還原、對照綠、exit 0,
      //    然後那個背景程序才把檔案改壞(重現:exit 0 後 2.4 秒檔案變 BAD)。
      //    所以 leader close 之後要確認整個 process group 真的空了;沒空就砍掉並判無法判定。
      //    (會 `setsid()` 主動脫離 group 的程序擋不住——那需要改在拋棄式 worktree 裡跑。)
      if (pgid === undefined) {
        const c = classifyRun(code, signal);
        done({ outcome: c.outcome, output: Buffer.concat(chunks).toString("utf-8"), detail: c.detail });
        return;
      }
      void (async () => {
        if (await waitGroupGone(pgid, 300)) {
          const c = classifyRun(code, signal);
          done({ outcome: c.outcome, output: Buffer.concat(chunks).toString("utf-8"), detail: c.detail });
          return;
        }
        await killGroup(pgid, child);
        done({
          outcome: "infra",
          output: Buffer.concat(chunks).toString("utf-8"),
          detail:
            "驗證指令留下了背景程序(主程序已結束但 process group 沒空)——" +
            "它可能在還原之後才動到檔案,本次判定無效。已砍掉整組。",
        });
      })();
    });
  });
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** process group 裡還有東西活著嗎?ESRCH＝空了;EPERM＝有但不是我們的,當成活著。 */
function groupAlive(pgid: number): boolean {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * 砍掉整個子 process group(`detached` 讓 `-pid` 指向整組),**確認整組真的沒了**才回來。
 *
 * 🔴 Codex review round 2 P1:舊版「leader 一 `close` 就 `clearTimeout` 取消 SIGKILL」。
 * 但 leader 死掉不等於整組死掉——一個忽略 SIGTERM、又把 stdio 關掉的孫程序會活下來。
 * 重現:runner 收到 SIGINT 後約 5ms exit 2、檔案當下確實還原了,
 * **兩秒後殘留的孫程序又把檔案寫成 BAD**。
 * 現在:升級不看 leader 的臉色——SIGTERM 後等 grace 期,整組還在就 SIGKILL,
 * 再等到 `kill(-pgid, 0)` 回 ESRCH 為止。
 */
async function waitGroupGone(pgid: number, ms: number): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (!groupAlive(pgid)) return true;
    await sleep(25);
  }
  return !groupAlive(pgid);
}

/** SIGTERM → 等 grace → 整組還在就 SIGKILL → 等到消失。**不看 leader 的臉色。** */
async function killGroup(pgid: number, child?: ChildProcess): Promise<void> {
  const groupKill = (sig: NodeJS.Signals) => {
    try {
      process.kill(-pgid, sig);
    } catch {
      try {
        child?.kill(sig);
      } catch {
        /* 已經死了 */
      }
    }
  };
  groupKill("SIGTERM");
  if (await waitGroupGone(pgid, 1500)) return;
  groupKill("SIGKILL");
  if (await waitGroupGone(pgid, 3000)) return;
  console.error(`✗ 子 process group ${pgid} 在 SIGKILL 後仍未消失——它可能還會再動到檔案。`);
}

async function killActiveChild(): Promise<void> {
  const child = activeChild;
  if (!child || child.pid === undefined) return;
  await killGroup(child.pid, child);
}

// ───────────────────────────────────────── main

async function main(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`✗ ${(e as Error).message}`);
    return 2;
  }

  const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" });
  if (top.status !== 0 || !top.stdout?.trim()) {
    console.error("✗ 這裡不是 git repo——閘①(乾淨工作樹)沒有立足點,拒跑。");
    return 2;
  }
  const repoRoot = fs.realpathSync(top.stdout.trim());

  // ── 閘① 乾淨工作樹(fail-closed,無 escape hatch)
  const porcelain = spawnSync("git", [...GIT_STATUS_ARGS], { cwd: repoRoot, encoding: "utf-8" });
  if (porcelain.status !== 0) {
    console.error("✗ 讀不到 `git status`——無法判定工作樹是否乾淨,拒跑。");
    return 2;
  }
  const tree = parseTreeState(porcelain.stdout ?? "");
  if (!tree.clean) {
    console.error("✗ 拒跑:工作樹不乾淨。");
    console.error("  破壞性驗證會改檔再還原;未提交的編輯有被抹掉的風險。");
    console.error("  先 `git commit` 或 `git stash`,讓 git 本身當還原保險,再跑一次。\n");
    for (const e of tree.entries.slice(0, 20)) console.error(`    ${e}`);
    if (tree.entries.length > 20) console.error(`    …還有 ${tree.entries.length - 20} 筆`);
    return 2;
  }

  // ── 閘① 的另一半:index flag 會讓 `git status` **看不見** tracked 檔的修改
  const lsv = spawnSync("git", ["ls-files", "-v"], { cwd: repoRoot, encoding: "utf-8" });
  if (lsv.status !== 0) {
    console.error("✗ 讀不到 `git ls-files -v`——無法判定 index 有沒有被設旗標,拒跑。");
    return 2;
  }
  const flagged = parseIndexFlags(lsv.stdout ?? "");
  if (flagged.length > 0) {
    console.error("✗ 拒跑:有檔案被 index flag 藏起來(assume-unchanged／skip-worktree)。");
    console.error("  這些檔的修改**不會出現在 `git status`**,閘① 與收尾的乾淨檢查都會謊報乾淨。\n");
    for (const f of flagged.slice(0, 20)) console.error(`    ${f}`);
    if (flagged.length > 20) console.error(`    …還有 ${flagged.length - 20} 筆`);
    console.error("\n  → `git update-index --no-assume-unchanged <path>` 或 `--no-skip-worktree <path>`");
    return 2;
  }

  // ── 讀 spec
  let specs: MutationSpec[];
  try {
    if (args.spec) {
      const specPath = path.resolve(repoRoot, args.spec);
      specs = parseSpecs(JSON.parse(fs.readFileSync(specPath, "utf-8")));
    } else {
      specs = parseSpecs([{ file: args.file, find: args.find, replace: args.replace, label: args.label, all: args.all }]);
    }
  } catch (e) {
    console.error(`✗ spec 無效:${(e as Error).message}`);
    return 2;
  }

  const cmdCwd = path.resolve(repoRoot, args.cwd);
  if (!fs.existsSync(cmdCwd)) {
    console.error(`✗ --cwd 不存在:${args.cwd}`);
    return 2;
  }

  const modeSnapshot = snapshotModes(repoRoot);
  if (!modeSnapshot) {
    console.error("✗ 拍不到 tracked 檔的權限快照(`git ls-files` 失敗)——無法保證還原,拒跑。");
    return 2;
  }

  // 🔴 Codex review round 1 P1(HEAD 綁定):**開跑前**就把 HEAD 記下來,
  //   收尾時再抓一次比對。若期間 HEAD 動過(外部 shell / IDE / 其他 agent 建 clean
  //   commit)——工作樹仍乾淨、閘① 看不見,但**所有 mutation 判定的 SHA 綁定作廢**
  //   (Step 4.5 高風險車道拿 exit 0 綁 SHA,若印的是新 HEAD、探針其實跑在舊 checkout,
  //   等於偽造綁定、suppress 掉本該重跑的 sprint)。fail-closed:HEAD 變動 → 判定作廢。
  const startHeadR = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf-8" });
  if (startHeadR.status !== 0 || !startHeadR.stdout?.trim()) {
    console.error("✗ 讀不到起手 HEAD(`git rev-parse HEAD` 失敗)——無法綁定判定 SHA,拒跑。");
    return 2;
  }
  const startHead = startHeadR.stdout.trim();

  const results: MutationResult[] = [];
  let controlOk = false;

  for (const [i, spec] of specs.entries()) {
    console.log(`\n[${i + 1}/${specs.length}] ${spec.label}`);
    console.log(`         ${spec.file}`);

    // ── 目標路徑的安全契約(repo 內、被追蹤、非 symlink、UTF-8 文字)
    const target = checkTarget(repoRoot, spec.file);
    if (!target.ok) {
      results.push({ spec, verdict: "inconclusive", reason: target.reason, occurrences: 0 });
      console.log(`         ⚠️  ${target.reason}`);
      continue;
    }
    const abs = target.abs!;
    const originalBytes = target.original!;
    const original = originalBytes.toString("utf-8");

    // ── 閘② 樣本真的套用
    const applied = applyMutation(original, spec);
    if (!applied.ok) {
      results.push({ spec, verdict: "inconclusive", reason: applied.reason, occurrences: applied.occurrences });
      console.log(`         ⚠️  ${applied.reason}`);
      continue;
    }

    // identity 用 checkTarget 那個 fd 拿到的權威值,不再另外 lstat 一次(那中間會有掉包視窗)
    const ident = { dev: target.dev!, ino: target.ino!, mode: target.mode! };
    const mutantBytes = Buffer.from(applied.output!, "utf-8");
    pending.set(abs, { original: originalBytes, ...ident, mutant: mutantBytes });
    // 第一次寫入走跟還原同一條路(開檔 → fstat 核對 inode → 比對現值 → ftruncate + 寫到完)
    const w = writeCheckedSync(abs, mutantBytes, ident, originalBytes);
    if (w.error) {
      // 🔴 前置條件擋下來時磁碟原封不動——**絕對不能 restore**,
      //    那會拿舊的 original 蓋掉別人剛寫進去的東西(Codex round 6 P1)。
      if (shouldRestoreAfterWriteFailure(w)) reportRestoreFailures(restoreAll().failures);
      else pending.delete(abs);
      results.push({ spec, verdict: "inconclusive", reason: `寫入 mutation 失敗:${w.error}`, occurrences: applied.occurrences });
      console.log(`         ⚠️  ${w.error}`);
      continue;
    }
    // 讀回來**逐 byte 比對預期的 mutant**——只排除「仍等於原文」擋不住短寫／截斷,
    // 那會讓套件因為壞掉的檔轉紅,被誤報成「測試抓到了」(Codex round 4 P2)
    if (verifyContent(abs, mutantBytes)) {
      reportRestoreFailures(restoreAll().failures);
      results.push({
        spec,
        verdict: "inconclusive",
        reason: "寫入後磁碟內容不等於預期的 mutant(短寫／被別人動過?)",
        occurrences: applied.occurrences,
      });
      console.log("         ⚠️  寫入後磁碟內容不等於預期的 mutant");
      continue;
    }

    const run = await runCommand(args.cmd, cmdCwd);
    if (shuttingDown) return 2; // 收到訊號了:不要再開下一條

    // ── 還原(立刻,不等全部跑完——縮短「檔案是壞的」的視窗)
    const { failures, touched } = restoreAll();
    if (failures.length > 0) {
      reportRestoreFailures(failures);
      return 2; // 安全契約破了就停手,不要繼續改更多檔
    }

    if (touched.length > 0) {
      results.push({
        spec,
        verdict: "inconclusive",
        reason: "驗證指令在跑的期間**原地改過我們 mutate 的那個檔**——它跑的已經不是這條 mutation 了",
        occurrences: applied.occurrences,
      });
      console.log("         ⚠️  驗證指令動過我們 mutate 的檔");
      continue;
    }

    const drifted = restoreModeDrift(repoRoot, modeSnapshot);
    if (drifted.length > 0) {
      console.error("\n✗ 驗證指令改了 tracked 檔的權限(git 看不見這種改動),已還原並判本次無效:");
      for (const d of drifted.slice(0, 20)) console.error(`    ${d}`);
      return 2;
    }

    // ── 還原完,整棵工作樹必須跟開跑前一樣乾淨。
    //    只驗「我們那個檔還原了」擋不住驗證指令去動別的 tracked file、改型別或 mode。
    const dirt = treeDirt(repoRoot);
    if (!dirt.clean) {
      console.error(
        dirt.readable
          ? "\n✗ 還原後工作樹仍不乾淨——驗證指令動到了我們沒授權的東西,停手:"
          : "\n✗ 還原後讀不到 `git status`——無法確認工作樹狀態,停手。",
      );
      for (const e of dirt.entries.slice(0, 20)) console.error(`    ${e}`);
      console.error("  → 先 `git status` 看清楚、`git checkout --` 救回,再檢查 --cmd 為什麼會改到這些檔。");
      return 2;
    }

    if (run.outcome === "infra") {
      results.push({ spec, verdict: "inconclusive", reason: run.detail, occurrences: applied.occurrences });
      console.log(`         ⚠️  ${run.detail}`);
      continue;
    }
    if (run.sawTurboCache) {
      results.push({
        spec,
        verdict: "inconclusive",
        reason: "指令命中 turbo 快取(FULL TURBO)——那個綠對你的工作樹什麼都沒證明,改用 `--cwd <sub-project>` 指到跑 test 的子專案目錄,或加 `--force`",
        occurrences: applied.occurrences,
      });
      console.log("         ⚠️  FULL TURBO");
      continue;
    }

    const mutantOk = run.outcome === "green";
    results.push({
      spec,
      verdict: mutantOk ? "survived" : "killed",
      reason: mutantOk ? "改壞了但套件仍全綠＝這條不變量沒有測試守著" : undefined,
      occurrences: applied.occurrences,
    });
    console.log(`         ${mutantOk ? "🔴 存活(套件仍綠)" : "✅ 抓到(套件轉紅)"}`);
  }

  // ── 閘③ 收尾重跑對照
  console.log("\n[對照] 還原後重跑,確認回綠…");
  const control = await runCommand(args.cmd, cmdCwd);
  if (shuttingDown) return 2;
  if (control.outcome === "infra") {
    console.error(`✗ 對照跑不起來(${control.detail})——本次判定全部作廢。`);
    controlOk = false;
  } else if (control.sawTurboCache) {
    console.error("✗ 對照命中 turbo 快取——本次判定全部作廢。");
    controlOk = false;
  } else {
    controlOk = control.outcome === "green";
  }

  const finalDrift = restoreModeDrift(repoRoot, modeSnapshot);
  if (finalDrift.length > 0) {
    console.error("\n✗ 對照跑完後 tracked 檔的權限被改過(git 看不見),已還原並判本次無效:");
    for (const d of finalDrift.slice(0, 20)) console.error(`    ${d}`);
    return 2;
  }

  // 對照也會跑驗證指令,同樣可能弄髒工作樹——收尾前再確認一次。
  const finalDirt = treeDirt(repoRoot);
  if (!finalDirt.clean) {
    console.error("\n✗ 對照跑完後工作樹不乾淨——驗證指令有副作用,本次判定全部作廢:");
    for (const e of finalDirt.entries.slice(0, 20)) console.error(`    ${e}`);
    return 2;
  }
  if (!controlOk) {
    // 對照紅 → 把所有已判定的結果降級(判定表的「對照優先」)
    for (const r of results) {
      if (r.verdict !== "inconclusive") {
        const c = classify({ controlOk: false, mutantOk: r.verdict === "survived" });
        r.verdict = c.verdict;
        r.reason = c.reason;
      }
    }
  }

  // HEAD SHA 綁定:給 Step 4.5 高風險車道抄「exit 0 綁定的最後非 bookkeeping SHA」用。
  // 🔴 Codex review round 1 P1:endHead 必須與 startHead(main 開頭抓的)相同——
  //   期間有人 clean commit → HEAD 前進 → 印新 SHA 等於偽造綁定。fail-closed:
  //   兩者不等 → 不印 SHA、將 exitCode 升到 2、判定全部作廢。判定邏輯在
  //   `decideHeadBinding()` 純函式內、有單測直接覆蓋三條 case。
  const endHeadR = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf-8" });
  const endHead = endHeadR.status === 0 ? (endHeadR.stdout ?? "").trim() : "";
  const binding = decideHeadBinding(startHead, endHead);
  if (binding.drifted && binding.message) console.error(`✗ ${binding.message}——所有判定 SHA 綁定作廢,不印 SHA。`);

  const { text, exitCode: rawExit } = formatSummary(results, controlOk, binding.headSha);
  const exitCode = binding.drifted ? Math.max(rawExit, 2) : rawExit;
  console[exitCode === 0 ? "log" : "error"](text);
  return exitCode;
}

// ───────────────────────────────────────── 入口(每一條路都走同一個收場流程)

/**
 * 唯一的收場路徑。**訊號與例外共用同一個 coordinator**:
 * 停止接新工作 → 砍完整個子 process group 並確認它沒了 → 還原 → 固定退出。
 *
 * 🔴 Codex review round 1 P2:舊版入口只有 `.then()`、沒有 `.catch()`,任何未預期例外
 * (目錄、權限、git 掛掉)會走成 unhandled rejection、通常 exit 1
 * ——**把「無法判定」錯報成「mutant 存活」**。
 * 🔴 Codex review round 2 P2:舊版 `fatal` 直接還原就 `process.exit`,**沒先砍子程序**。
 * 子程序是 detached 的,於是它可以在 runner 退出後繼續跑、甚至再把檔案改壞。
 */
/** 收到訊號／例外後就不再開下一條 mutation(main 迴圈每輪 await 後會看這個旗標)。 */
let shuttingDown = false;
/** 最終 exit code。**只升不降**——訊號的 2 一定壓得過正常結束的 0/1。 */
let finalCode = 0;

/**
 * **唯一**的收場入口(single-flight)。正常結束也走這裡。
 *
 * 🔴 Codex review round 3 P2:舊版正常完成時直接 `shutdown(code)`、沒先設 `shuttingDown`,
 * 於是訊號若剛好落在正常收場的 await 視窗,`beginShutdown` 會再開**第二個** coordinator,
 * 兩邊搶 `restoreAll()` 與 `process.exit()`——正常的 exit code 可能先贏過訊號的 2。
 * 現在:第一個呼叫負責跑完整個 teardown,後到的只把 `finalCode` 升級。
 */
function beginShutdown(code: number, why?: string): void {
  if (why) console.error(why);
  finalCode = shuttingDown ? Math.max(finalCode, code) : code;
  if (shuttingDown) return;
  shuttingDown = true;
  void (async () => {
    await killActiveChild();
    const { failures } = restoreAll();
    reportRestoreFailures(failures);
    process.exit(failures.length > 0 ? 2 : finalCode);
  })().catch(() => process.exit(2));
}

// ESM main invocation 檢查(P2#3 defer ①):共用 lib、兩端 realpath、
// indeterminate 由 caller 顯式 exit(2)、import 用時完全靜默。
const outcome = detectInvocation(import.meta.url, process.argv[1]);
const isMain = reportIfNotMain(outcome, 'mutate');

if (isMain) {
  process.on("SIGINT", (sig) => beginShutdown(2, `\n收到 ${sig},終止子程序並還原…`));
  process.on("SIGTERM", (sig) => beginShutdown(2, `\n收到 ${sig},終止子程序並還原…`));
  const onFatal = (e: unknown) => beginShutdown(2, `✗ 未預期例外:${(e as Error)?.stack ?? String(e)}`);
  process.on("uncaughtException", onFatal);
  process.on("unhandledRejection", onFatal);

  main().then(beginShutdown).catch(onFatal);
} else if (outcome.kind === "indeterminate") {
  process.exit(2);
}
