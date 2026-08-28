#!/usr/bin/env node
/**
 * scripts/check-no-source-terms.ts — 去識別化 denylist checker(升上下文感知)
 *
 * 承接舊 `check-no-source-terms.sh` 三段掃描邏輯,加入「上下文感知」例外:
 * 兩條 pattern(`PR #[0-9]` 與 `pull/[0-9]`)會抽出被引用的 PR 號,若該號
 * ∈「本 repo 已 merge 的 PR 號集合」(allowedPrs)則放行——其餘一律嚴格擋。
 *
 * 為什麼要機器化(而不是每次撞牆換 workaround):
 *   批 6(PR 井號+31)一輪 sprint 內三度撞同類「self-PR 井號+數字 引用被誤觸」:
 *     井號+1 tests fixture 需要範例引用格式 → 改「已交付」占位
 *     井號+2 TODOS 補完工引用 → 改用「(井號+N)」括號格式
 *     井號+3 workflow env 缺 MARKER_SELF_PR → 加 delivery-branch 白名單
 *   每次都用不同 workaround 繞開;LESSONS L90 記載「第 4 次同類就該機器化」。
 *   本 checker 即該機器化實作。
 *
 * 三段掃描(exit 1 於任何未放行的命中或掃描器錯誤,exit 0 於全數通過):
 *   1) working tree(git 追蹤檔)
 *   2) git 全史 blob(含已刪檔案的歷史內容)
 *   3) git 全史 commit 訊息 + 作者列(保持嚴格擋,對齊 commit-msg hook)
 *
 * denylist:scripts/deny-terms.txt(每行一條 extended regex;井號註解與空行忽略)。
 *
 * 兩路 grep 架構(round 1 Codex review P2-4 修法):
 *   舊版把 grep hits 用 JS regex 重驗 non-CA pattern 是否命中 —— 但 deny-terms
 *   是 POSIX ERE、JS regex 語法有差(例:ERE 的 `[[:digit:]]` JS 不認),ERE
 *   pattern 命中的 hit line JS regex 可能不 match、於是「只剩 CA 命中」被誤判
 *   → self-PR 判定放行 → 假放行。
 *   新版直接讓 grep 分兩路各自跑:
 *     - Non-CA grep:任何 hit → strict 擋
 *     - CA grep    :hit 逐行走 self-PR 判定
 *   全程用 POSIX ERE(grep -E),不再用 JS regex 反查 deny-terms。
 *
 * 兩層豁免(shell 版沿用):
 *   FULL_EXCLUDES 完全跳過:deny-terms.txt 自身、package-lock.json、
 *     check-todos-markers.{ts,test.ts}(該工具本職含 PR 引用語法)、
 *     tests/check-no-source-terms.test.ts(round 1 Codex review P1-2 加:
 *     本 checker 的測試檔 fixture 逐字節重現 canonical denylist 情境,若列入
 *     scan 範圍會 self-block;runtime concat fixture 已在測試檔內做,但 e2e
 *     disposable-repo 內的 setup 呼叫需要傳完整字面到 subprocess,無法拆解)。
 *   SYNTAX_EXEMPT_FILES 只掃 non-CA:check-todos-markers.{ts,test.ts}
 *     ——其餘識別詞在這兩檔仍會被抓;CA pattern(PR/pull)字面可自由出現。
 *
 * 呼叫點分層:
 *   package.json check:no-source-terms(CI)→ 本檔,套 context-aware
 *   scripts/git-hooks/commit-msg(本地 hook)→ 保持嚴格擋、共用 denylist 但不
 *     跑本檔(commit 訊息應寫 squash 格式的「(井號+N)」,不裸寫「PR 井號+N」)。
 *   本檔第 3 段(commit 訊息掃描)也保持嚴格(mode="strict"),與 hook 對齊。
 *
 * Exit code:
 *   0 = 全數通過(或 denylist 空)
 *   1 = 有未放行的命中、或掃描器/內部錯誤
 *
 * 用法:
 *   npx tsx scripts/check-no-source-terms.ts
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
// 批 10 P2-1:MARKER_SELF_PR 驗證抽到 shared lib、兩 script 共用單一入口(擋跨檔漂移)
import { acknowledgeSelfPr } from "./lib/marker-self-pr";

// ───────────────────────────────────────── constants

const DENY_SRC = "scripts/deny-terms.txt";
const FULL_EXCLUDES = [
  ":!scripts/deny-terms.txt",
  ":!package-lock.json",
  ":!scripts/check-todos-markers.ts",
  ":!tests/check-todos-markers.test.ts",
  // round 3 P2-1 fix:配對 SYNTAX_EXEMPT_FILES,讓全域 CA/non-CA scan 跳過本檔,
  // 只由下方 SYNTAX_EXEMPT scan 用縮減 pattern(non-CA)掃它。這樣 test fixture
  // 若真要寫 CA 字面(如 canonical PR/pull 引用範例)不會被 CA scan 誤攔。
  // round 2 fix P2-3 只加 SYNTAX_EXEMPT 沒加 FULL_EXCLUDES → 該檔被雙掃、CA 沒跳。
  ":!tests/check-no-source-terms.test.ts",
];
/**
 * 這幾檔用「縮減 pattern 集」掃(只掃 non-CA,容許 CA 字面):
 *   scripts/check-todos-markers.{ts,test.ts}:本職含 PR 引用語法
 *   tests/check-no-source-terms.test.ts:round 2 P2-3 修法——原先全排除留下
 *     non-CA 永久盲區(未來若測試檔誤含來源專案名不會被抓);改用縮減 pattern 集
 *     仍能守住 non-CA,CA 字面 fixture 由 runtime concat + 本清單雙重保險。
 */
const SYNTAX_EXEMPT_FILES = [
  "scripts/check-todos-markers.ts",
  "tests/check-todos-markers.test.ts",
  "tests/check-no-source-terms.test.ts",
];
/** delivery ref 解析用的字元白名單(shell metacharacter / option injection 防護)。 */
const SAFE_REF_RE = /^[A-Za-z0-9_./-]+$/;
/**
 * 兩條 pattern 走「context-aware 例外」:命中後,若 hit line 內的 PR 號全部
 * ∈ allowedPrs(本 repo 已 merge 的 PR 號集合)則放行;否則擋。
 * 兩條 pattern 值用「[0-9]」形式(不是十進位 escape),與 deny-terms.txt 條目
 * 逐字元一致——分路 grep 時要能把這兩條從全 pattern set 挑出來。
 */
const CONTEXT_AWARE_PATTERNS = ["PR #[0-9]", "pull/[0-9]"];

// ───────────────────────────────────────── pure functions(給測試直接呼叫)

/**
 * 過濾註解與空行,保留 pattern 內容原樣(round 2 P2-4 修法)。
 *
 * ⚠️ 不 trim 內容:對齊 shell 版 `grep -vE '^[[:space:]]*(#|$)'` 語義,commit-msg
 *    hook 也是這個過濾邏輯。denylist 條目可能含尾空白(shell 版原樣保留),
 *    trim 會擴大匹配到無空白版本 → CI 與 hook 語義漂移。
 */
export function stripCommentsAndBlanks(text: string): string[] {
  return text.split(/\r?\n/).filter((l) => !/^\s*(#|$)/.test(l));
}

/**
 * 從 git log subject 序列解析「本 repo 已 merge 的 PR 號」集合。
 *
 * ⚠️ 輸入必須是 subject-only(每行一則 commit subject,不含 body)。
 *    round 1 Codex review P2-3 修法:舊版收 `%s%n%b` 全 body,任何 commit body
 *    寫「issue (#777)」都會把 777 加入 allowedPrs → 假 allowlist。
 *    新版收 `git log --all --format=%s`,並在解析時要求 subject 邊界:
 *      squash 尾綴:結尾 `(井號+N)` (canonical GitHub squash merge 格式)
 *      merge commit:開頭 `Merge pull request #N`
 *    subject 中間出現「issue (井號+N)」不會被算入。
 */
export function parseAllowedPrs(subjectsOnly: string): Set<number> {
  const set = new Set<number>();
  for (const raw of subjectsOnly.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s) continue;
    const squash = /\(#(\d+)\)\s*$/.exec(s);
    if (squash) {
      const n = Number(squash[1]);
      if (Number.isFinite(n) && n > 0 && n < 1e9) set.add(n);
      continue;
    }
    const merge = /^Merge pull request #(\d+)\b/.exec(s);
    if (merge) {
      const n = Number(merge[1]);
      if (Number.isFinite(n) && n > 0 && n < 1e9) set.add(n);
    }
  }
  return set;
}

/**
 * 從一行 hit 內容抽出所有引用的 PR 號(限 context-aware pattern 對應的兩種)。
 *
 * ⚠️ extractor pattern 精確對齊 CA grep pattern(round 2 P1-2 + round 4 P2-2 修法):
 *    - 沒有右 `\b` 邊界(round 2):CA grep 只要求 `PR #<單一數字>` 開頭,若
 *      extractor 加右 `\b`,「未知 PR 號 typo(如尾綴接字母)+ 合法 self-PR 號」
 *      同行時只抽合法號 → 誤放行、typo 洩露漏抓
 *    - 沒有左 `\b` 邊界(round 4):同理,grep pattern 沒左邊界,若 extractor 加
 *      `\bPR`,同行含「任意前綴 + 未知 PR 號 + 合法 self-PR 號」時,前綴讓左
 *      邊界不成立、extractor 只抽合法號 → 未知號洩露漏抓
 *    - 用 literal space 不用 `\s+`(round 4):grep pattern 用字面空格,若 extractor
 *      用 `\s+` 會抽出 grep 根本沒命中的 tab / 多空白形式(過度抽取)
 *    修法:extractor pattern 逐字元對齊 CA denylist ERE。
 *
 * 邊界:
 *   PR 井號 + 30 後接字母 → 抽出 30(判 self-PR:若 30 ∈ allowedPrs 則放行)
 *   任意前綴 + PR 井號 + 未知 + 合法混合 → 兩個都抽出,未知 ∉ allowed → 擋
 *   tab / 多空白 分隔 → 不 match(對齊 grep)
 *   純字面「PR 井號 中括號 0-9 中括號」(deny-terms.txt pattern 表達式本身)
 *     → 不 match,回空
 */
export function extractPrRefsFromLine(line: string): number[] {
  const refs: number[] = [];
  const patterns = [/PR #(\d+)/gi, /pull\/(\d+)/gi];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n < 1e9) refs.push(n);
    }
  }
  return refs;
}

/**
 * 判定一行 CA-scan grep hit 是否為合法 self-PR 引用。
 *
 * 這函式只給「CA-scan 產出的 hit」用(非 CA 命中的行不走這條路,而是被
 * strict-mode 直接擋)。因此:
 *   - 抽不到 PR 號 → 保守擋(fail-safe;grep 說命中但抽不出可能是 regex/文本
 *     邊界異常,寧擋不放)
 *   - 所有 PR 號 ∈ allowedPrs → 放行
 *   - 任一 PR 號 ∉ allowedPrs → 擋
 */
export function isSelfPrReferenceLine(
  line: string,
  allowedPrs: Set<number>
): boolean {
  const refs = extractPrRefsFromLine(line);
  if (refs.length === 0) return false;
  return refs.every((n) => allowedPrs.has(n));
}

/**
 * 把 denylist pattern 集切成兩組:CA(走 self-PR 判定)與 non-CA(嚴格擋)。
 */
/**
 * 找出 CONTEXT_AWARE_PATTERNS 內、但不在 denylist 內的 entry(Step 5 F1 修法)。
 *
 * ⚠️ 兩處敘述同一不變量:CONTEXT_AWARE_PATTERNS(硬碼常數)與 deny-terms.txt
 *    的對應 entry。若 denylist entry 被改字(尾空白、regex 變體)或刪除,
 *    partitionPatterns 的 `.includes()` 精確比對會靜默失敗 → 該 pattern 被歸
 *    non-CA → context-aware 徹底失效、CI 誤擋回 pre-Sprint-7 狀態。
 *
 *    無守門 = SOP L215-217「敘述只准一份 SSOT / 呼叫點另守」違反。本函式抽出
 *    純函式邏輯,main() 開頭 startup assert 用它 fail-hard。
 */
export function findDriftedCaPatterns(
  allPatterns: string[],
  caPatterns: string[]
): string[] {
  return caPatterns.filter((p) => !allPatterns.includes(p));
}

export function partitionPatterns(patterns: string[]): {
  nonCa: string[];
  ca: string[];
} {
  const ca: string[] = [];
  const nonCa: string[] = [];
  for (const p of patterns) {
    if (CONTEXT_AWARE_PATTERNS.includes(p)) ca.push(p);
    else nonCa.push(p);
  }
  return { nonCa, ca };
}

/**
 * 解析 `git grep -z` 的單行輸出,拆出 path / line / content。
 *
 * ⚠️ round 6 P2-3 修法:舊版用 regex `/:數字:/` 找 line number 邊界,若真實
 *    filename 含 `:數字:` sub-path(如 `docs/meta:12:PR-井號-999-notes.md`),
 *    regex 從 filename 中的 `:12:` 切割 → content 錯,把 filename 的其餘部分
 *    當成 content → extractor 從錯 content 抽未知號 → 合法引用誤擋。
 *
 *    改用 `git grep -z / --null` 讓 grep 用 NUL 字元 (`\0`) 分隔 filename 與
 *    line number(replaces the `:` between them),結構化明確不需猜邊界。
 *    格式:
 *      working tree:`filename\0line:content`
 *      history 掃 :`rev:filename\0line:content`
 *
 *    解析失敗 → 回 null,呼叫端 fail-safe 用原 raw 判定。
 */
export function parseGrepZLine(
  raw: string
): { path: string; line: string; content: string } | null {
  const nul = raw.indexOf("\0");
  if (nul === -1) return null;
  const path = raw.slice(0, nul);
  const rest = raw.slice(nul + 1);
  const colon = rest.indexOf(":");
  if (colon === -1) return null;
  return {
    path,
    line: rest.slice(0, colon),
    content: rest.slice(colon + 1),
  };
}

/** 把 raw hit(含 NUL)轉成 human-readable「path:line:content」顯示。 */
export function displayGrepHit(raw: string): string {
  const parsed = parseGrepZLine(raw);
  if (!parsed) return raw;
  return `${parsed.path}:${parsed.line}:${parsed.content}`;
}

// ───────────────────────────────────────── I/O helpers

function repoRoot(): string {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf-8",
  }).trim();
}

function loadDenyTerms(root: string): string[] {
  const p = path.join(root, DENY_SRC);
  return stripCommentsAndBlanks(readFileSync(p, "utf-8"));
}

/**
 * 解 delivery refs 清單(round 2 P1-1 修法)。
 *
 * 舊版用 `git log --all` 掃所有 refs → 未合併 feature branch 的 subject 也被算入
 * allowedPrs(例:draft PR branch subject `feat (井號+31)`,PR 尚未 merge、但 31
 * 被算入 → 引用 `PR 井號+31` 誤放行)。
 *
 * 新版對齊 `scripts/check-todos-markers.ts` 的 `buildMergedPrSet` 邏輯:
 *   ①origin/HEAD 偵測到的當前 default branch(涵蓋 main / master / trunk rename)
 *   ②env `DELIVERY_REFS`(逗號分隔;固定 ref 名、不支援 glob)
 *   ③fallback:①②都空 → `origin/develop`(GitFlow 慣例)
 *   ④last-resort:①②③都空 → 本地 `main` / `develop`(離線開發環境)
 *
 * 每條 ref 都經 SAFE_REF_RE 白名單 + `git rev-parse --verify --quiet` 存在檢查,
 * 擋 shell metacharacter / option injection(`--all` / `;pwd`)。
 */
function buildDeliveryRefs(root: string): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();
  const resolves = (r: string): boolean => {
    if (!SAFE_REF_RE.test(r)) return false;
    try {
      execFileSync(
        "git",
        ["-C", root, "rev-parse", "--verify", "--quiet", r],
        { stdio: "pipe" }
      );
      return true;
    } catch {
      return false;
    }
  };
  const push = (r: string) => {
    if (!r || seen.has(r)) return;
    if (!resolves(r)) return;
    seen.add(r);
    refs.push(r);
  };

  try {
    const def = execFileSync(
      "git",
      ["-C", root, "symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"],
      { encoding: "utf-8", stdio: "pipe" }
    )
      .trim()
      .replace("refs/remotes/", "");
    if (def) push(def);
  } catch {
    /* origin/HEAD 未設 → 走 fallback */
  }

  const extras = (process.env["DELIVERY_REFS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const r of extras) push(r);

  if (refs.length === 0) push("origin/develop");
  if (refs.length === 0) {
    push("main");
    push("develop");
  }
  return refs;
}

/**
 * 建立 allowedPrs set,並回報 delivery merged 唯一數與 self-PR env acknowledge 狀態
 *(僅供診斷輸出用、不做決策——見下方契約段)。
 *
 * ⚠️ 契約:`mergedCount` / `selfPrCount` **僅供 diagnostic 輸出**,不做決策用。
 *    批 9 F2 修法後 `selfPrCount` 語意是「env 通道 acknowledge」(env 值合法即 = 1),
 *    不是「新增到 set 的貢獻計數」——collision 時(env 值也在 delivery)`selfPrCount = 1`
 *    但實際上沒新增(dedup)。想做「self-PR 有無新增進 set」的決策要另計算差值,
 *    不能用 `selfPrCount === 0` 判斷「沒 env 貢獻」。恆等式從 == 改成
 *    `allowedPrs.size ≤ mergedCount + selfPrCount`(collision 時 <、其餘 =)。
 *
 * 兩來源:
 *   1) delivery refs(buildDeliveryRefs 四條 fallback)的 git log subject 抽出
 *      canonical squash 尾綴 / merge subject 開頭的 PR 號——「本 repo 已 merge」
 *   2) env `MARKER_SELF_PR`(sprint 內 self-reference 死鎖解法,批 8 Phase B):
 *      本 PR 尚未 squash merge 前,**diff 內(工作樹追蹤檔)/ 文件 blob(git
 *      全史)** 引用「本 PR 號」的行找不到 delivery ref 內的證據 → 會被 CA scan
 *      當「未知 PR 引用」擋。CI 於 pull_request event 把當前 PR# 經 env 傳入,
 *      視為合法引用來源(它正是即將產生證據的 PR)。
 *
 * ⚠️ 範圍精確:MARKER_SELF_PR 只影響 CA 判定(mode="self-pr")的兩段掃描——
 *    第 1 段工作樹 + 第 2 段 git 歷史 blob。**第 3 段 commit 訊息掃描固定
 *    mode="strict"、不看 allowedPrs**——這是批 7 round 6 P2-4 明確測試
 *    (commit 訊息 CA hit 一律嚴格擋、對齊 commit-msg hook)、既定政策。
 *    實務上 sprint 內 self-PR commit 訊息用 canonical squash 格式「(井號+N)」,
 *    CA pattern `PR #[0-9]` 不 match 括號形式,不會被抓;裸寫「PR #N」屬
 *    anti-pattern、本來就該擋。
 *
 * MARKER_SELF_PR 安全性:
 *   - 僅 CI pull_request event 有 `github.event.pull_request.number`;
 *     其他 event(push / schedule)展開為空字串 → Number("") = 0 →
 *     被 `> 0` 檢查擋住,不會誤放行
 *   - `Number.isInteger` 檢查同時擋掉 NaN(如 "abc")與浮點值(如 "1.5")
 *   - 命名對齊 scripts/check-todos-markers.ts:423-424(批 6 加的既有機制)
 *   - 只放行「這一個」PR#,其他未 merge PR 仍嚴格擋
 */
function loadAllowedPrs(root: string): {
  prs: Set<number>;
  mergedCount: number;
  selfPrCount: number;
} {
  const refs = buildDeliveryRefs(root);
  const prs =
    refs.length === 0
      ? new Set<number>()
      : parseAllowedPrs(
          execFileSync("git", ["-C", root, "log", ...refs, "--format=%s"], {
            encoding: "utf-8",
            maxBuffer: 512 * 1024 * 1024,
          })
        );
  const mergedCount = prs.size;
  let selfPrCount = 0;
  // 批 10 P2-1:MARKER_SELF_PR 驗證邏輯抽到 shared lib、兩 script 共用(擋跨檔漂移)。
  // 見 scripts/lib/marker-self-pr.ts 契約(isInteger + > 0 + < 1e9)。
  // 批 9 F2:selfPrCount 語意「本次 env 通道有效」——env 值合法即 = 1(env 通道 acknowledge)、
  // set 只在未包含時加(dedup)。恆等式 allowedPrs.size ≤ mergedCount + selfPrCount
  // (collision 時 <、其餘 =);診斷輸出「(delivery 已 merge M + self-PR K;collision 時 self ∈ delivery)」
  // (分隔符與實碼對齊、SSOT 是實碼;批 9 Step 5 F3)
  const selfPr = acknowledgeSelfPr(process.env.MARKER_SELF_PR);
  if (selfPr !== null) {
    selfPrCount = 1;
    if (!prs.has(selfPr)) prs.add(selfPr);
  }
  return { prs, mergedCount, selfPrCount };
}

/** 把 pattern 陣列寫進臨時檔,回傳檔路徑與 cleanup callback。 */
function writePatternFile(patterns: string[]): {
  file: string;
  cleanup: () => void;
} {
  const dir = mkdtempSync(path.join(tmpdir(), "cnst-"));
  const file = path.join(dir, "patterns");
  writeFileSync(file, patterns.join("\n") + "\n", "utf-8");
  return { file, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

interface GrepResult {
  hits: string[];
  rc: number;
}

function gitGrep(root: string, args: string[]): GrepResult {
  // 🔴 round 6 P2-3:加 -z / --null → filename 與 line number 之間用 NUL 而
  // 非 `:`,結構化解析 filename 含 `:` 的情形(見 parseGrepZLine docstring)
  const r = spawnSync("git", ["-C", root, "grep", "-z", ...args], {
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const hits = (r.stdout || "").split("\n").filter((l) => l.length > 0);
  return { hits, rc: r.status ?? 2 };
}

// ───────────────────────────────────────── 三段掃描

type Mode = "strict" | "self-pr";

interface Scan {
  label: string;
  mode: Mode;
  hits: string[];
  rc: number;
}

function scanWorkingTree(
  root: string,
  nonCaFile: string | null,
  caFile: string | null,
  syntaxNonCaFile: string | null
): Scan[] {
  const scans: Scan[] = [];
  if (nonCaFile) {
    scans.push({
      label: "working tree(non-CA,全域)",
      mode: "strict",
      ...gitGrep(root, [
        "-nIiE",
        "-f",
        nonCaFile,
        "--",
        ".",
        ...FULL_EXCLUDES,
      ]),
    });
  }
  if (caFile) {
    scans.push({
      label: "working tree(CA,全域,走 self-PR 判定)",
      mode: "self-pr",
      ...gitGrep(root, [
        "-nIiE",
        "-f",
        caFile,
        "--",
        ".",
        ...FULL_EXCLUDES,
      ]),
    });
  }
  if (syntaxNonCaFile) {
    scans.push({
      label: "working tree(SYNTAX 例外檔,只掃 non-CA)",
      mode: "strict",
      ...gitGrep(root, [
        "-nIiE",
        "-f",
        syntaxNonCaFile,
        "--",
        ...SYNTAX_EXEMPT_FILES,
      ]),
    });
  }
  return scans;
}

function scanGitHistoryBlobs(
  root: string,
  nonCaFile: string | null,
  caFile: string | null,
  syntaxNonCaFile: string | null
): Scan[] {
  const revs = execFileSync("git", ["-C", root, "rev-list", "--all"], {
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  })
    .split("\n")
    .filter(Boolean);
  const scans: Scan[] = [];
  for (const rev of revs) {
    if (nonCaFile) {
      scans.push({
        label: `史 ${rev.slice(0, 8)}(non-CA)`,
        mode: "strict",
        ...gitGrep(root, [
          "-nIiE",
          "-f",
          nonCaFile,
          rev,
          "--",
          ".",
          ...FULL_EXCLUDES,
        ]),
      });
    }
    if (caFile) {
      scans.push({
        label: `史 ${rev.slice(0, 8)}(CA,self-PR 判定)`,
        mode: "self-pr",
        ...gitGrep(root, [
          "-nIiE",
          "-f",
          caFile,
          rev,
          "--",
          ".",
          ...FULL_EXCLUDES,
        ]),
      });
    }
    if (syntaxNonCaFile) {
      // 早期 commit 尚無工具檔;先 cat-file -e 過濾,避免 git grep 對不存在
      // pathspec 當錯誤退出
      const existing: string[] = [];
      for (const f of SYNTAX_EXEMPT_FILES) {
        const r = spawnSync(
          "git",
          ["-C", root, "cat-file", "-e", `${rev}:${f}`],
          { encoding: "utf-8" }
        );
        if (r.status === 0) existing.push(f);
      }
      if (existing.length > 0) {
        scans.push({
          label: `史 ${rev.slice(0, 8)}(SYNTAX 例外檔 non-CA)`,
          mode: "strict",
          ...gitGrep(root, [
            "-nIiE",
            "-f",
            syntaxNonCaFile,
            rev,
            "--",
            ...existing,
          ]),
        });
      }
    }
  }
  return scans;
}

/**
 * 第 3 段:commit 訊息 + 作者。與 commit-msg hook 對齊,一律嚴格擋
 * (mode="strict"),CA/non-CA 一起用全 pattern 掃。
 */
function scanCommitMessages(root: string, allPatternFile: string): Scan {
  const log = execFileSync(
    "git",
    ["-C", root, "log", "--all", "--format=%H %an <%ae> %s %b"],
    { encoding: "utf-8", maxBuffer: 512 * 1024 * 1024 }
  );
  const r = spawnSync("grep", ["-niIE", "-f", allPatternFile], {
    input: log,
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const hits = (r.stdout || "").split("\n").filter((l) => l.length > 0);
  return {
    label: "commit 訊息 + 作者",
    mode: "strict",
    hits,
    rc: r.status ?? 2,
  };
}

// ───────────────────────────────────────── 處理單段掃描結果

/** 回傳 true = 該段通過(乾淨或全部放行);false = 有真實命中或掃描器錯誤。 */
function processScan(scan: Scan, allowedPrs: Set<number>): boolean {
  if (scan.rc === 1) return true; // clean
  if (scan.rc !== 0) {
    console.error(
      `❌ ${scan.label}:掃描器錯誤(exit ${scan.rc},檢查 deny-terms.txt regex)`
    );
    return false;
  }
  // rc === 0:有命中
  if (scan.mode === "strict") {
    console.error(`❌ ${scan.label}:含來源專案識別詞`);
    for (const h of scan.hits) console.error(`  ${displayGrepHit(h)}`);
    return false;
  }
  // mode === "self-pr":逐行走 self-PR 判定
  // 🔴 round 5 P2-1 + round 6 P2-3:用 parseGrepZLine 從 NUL-delimited 輸出
  // 拆出 content 部分,再交給判定——避免 filename 含 CA 字面時 extractor 從
  // filename 抽出未知號、讓合法 self-PR 引用被誤擋
  const real: string[] = [];
  const allowed: string[] = [];
  for (const raw of scan.hits) {
    const parsed = parseGrepZLine(raw);
    const content = parsed?.content ?? raw;
    if (isSelfPrReferenceLine(content, allowedPrs)) allowed.push(raw);
    else real.push(raw);
  }
  if (allowed.length > 0) {
    console.log(`  ↳ ${scan.label}:${allowed.length} 行 self-PR 引用放行`);
  }
  if (real.length > 0) {
    console.error(`❌ ${scan.label}:含未知 PR/pull 引用(非本 repo 已 merge)`);
    for (const h of real) console.error(`  ${displayGrepHit(h)}`);
    return false;
  }
  return true;
}

// ───────────────────────────────────────── main

function main(): number {
  const root = repoRoot();
  const allPatterns = loadDenyTerms(root);
  if (allPatterns.length === 0) {
    console.log("⚠️ denylist 為空,無事可掃(如不需要本 gate,連同 CI step 一併移除)");
    return 0;
  }

  // Step 5 F1:CONTEXT_AWARE_PATTERNS ↔ deny-terms.txt 漂移守門(fail-hard)
  const drifted = findDriftedCaPatterns(allPatterns, CONTEXT_AWARE_PATTERNS);
  if (drifted.length > 0) {
    console.error(
      `❌ CONTEXT_AWARE_PATTERNS 與 ${DENY_SRC} 漂移 — 這些 CA 常數在 denylist 內找不到對應 entry:`
    );
    for (const p of drifted) console.error(`  ${p}`);
    console.error(
      "  → 對齊 deny-terms.txt 的字面 entry,或更新 CONTEXT_AWARE_PATTERNS(scripts/check-no-source-terms.ts CONTEXT_AWARE_PATTERNS 常數)"
    );
    return 1;
  }

  const { nonCa, ca } = partitionPatterns(allPatterns);
  const cleanups: Array<() => void> = [];
  const allFile = writePatternFile(allPatterns);
  cleanups.push(allFile.cleanup);
  const nonCaFile = nonCa.length > 0 ? writePatternFile(nonCa) : null;
  if (nonCaFile) cleanups.push(nonCaFile.cleanup);
  const caFile = ca.length > 0 ? writePatternFile(ca) : null;
  if (caFile) cleanups.push(caFile.cleanup);
  // SYNTAX 例外檔只掃 non-CA(等同舊「縮減 pattern 集」)
  const syntaxNonCaFile = nonCaFile;

  const { prs: allowedPrs, mergedCount, selfPrCount } = loadAllowedPrs(root);
  // 批 9 F2:size ≤ mergedCount + selfPrCount(collision 時 <);印 `size` + 兩來源計數
  console.log(
    `── allowedPrs: ${allowedPrs.size} 個 PR 號被納入放行清單(delivery 已 merge ${mergedCount} + self-PR ${selfPrCount};collision 時 self ∈ delivery)──`
  );

  let fail = false;
  try {
    console.log("── [1/3] working tree 掃描 ──");
    let wtFail = false;
    for (const scan of scanWorkingTree(
      root,
      nonCaFile?.file ?? null,
      caFile?.file ?? null,
      syntaxNonCaFile?.file ?? null
    )) {
      if (!processScan(scan, allowedPrs)) wtFail = true;
    }
    if (!wtFail) console.log("✅ working tree 乾淨");
    else fail = true;

    console.log("── [2/3] git 全史 blob 掃描 ──");
    let histFail = false;
    for (const scan of scanGitHistoryBlobs(
      root,
      nonCaFile?.file ?? null,
      caFile?.file ?? null,
      syntaxNonCaFile?.file ?? null
    )) {
      if (!processScan(scan, allowedPrs)) histFail = true;
    }
    if (histFail) {
      console.error(
        "❌ git 歷史 blob 含來源專案識別詞或掃描錯誤(需 rebase / filter-repo 清除)"
      );
      fail = true;
    } else {
      console.log("✅ git 歷史 blob 乾淨");
    }

    console.log("── [3/3] commit 訊息 + 作者掃描 ──");
    if (!processScan(scanCommitMessages(root, allFile.file), allowedPrs)) {
      fail = true;
    } else {
      console.log("✅ commit 訊息乾淨");
    }
  } finally {
    for (const c of cleanups) c();
  }

  if (fail) return 1;
  console.log("✅ 去識別化掃描全數通過");
  return 0;
}

// ───────────────────────────────────────── entry

const isDirect =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirect) {
  try {
    process.exit(main());
  } catch (e) {
    console.error("❌ 內部錯誤:", (e as Error).message || e);
    process.exit(1);
  }
}
