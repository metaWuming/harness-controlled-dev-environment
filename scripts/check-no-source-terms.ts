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
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { StringDecoder } from "node:string_decoder";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
// 批 10 P2-1:MARKER_SELF_PR 驗證抽到 shared lib、兩 script 共用單一入口(擋跨檔漂移)
import { acknowledgeSelfPr } from "./lib/marker-self-pr";
import { formatRejections, resolveDeliveryRefsFromRepo } from "./lib/delivery-refs";

// ───────────────────────────────────────── constants

const DENY_SRC = "scripts/deny-terms.txt";
/**
 * PR A1:history baseline config 路徑。
 * config 檔內容:{ "schemaVersion": 1, "sourceTermHistoryBaseline": "<40-hex>" | null }
 * 用途:讓 history blob 掃描只掃 `baseline..HEAD`(grandfather baseline 及更早的
 * 去識別化 debt),不重寫公開 git 歷史仍能讓 gate 綠。
 * 完整契約:見 `loadBaselineConfig` docstring。
 * ⚠️ 只影響 source-term(去識別化)掃描;**gitleaks 秘密掃描仍是全史政策**、
 *    兩者不相干(見 `.github/workflows/ci.yml` 檔頭註解)。
 */
const BASELINE_CONFIG_PATH = "scripts/source-term-baseline.json";
const BASELINE_SCHEMA_VERSION = 1;
const BASELINE_SHA_RE = /^[0-9a-f]{40}$/i;
export const FULL_EXCLUDES = [
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
export const SYNTAX_EXEMPT_FILES = [
  "scripts/check-todos-markers.ts",
  "tests/check-todos-markers.test.ts",
  "tests/check-no-source-terms.test.ts",
];
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
 *    改用 `git grep -z / --null`,讓 NUL 取代分隔用的 `:`。
 *
 * 🔴 **Codex R1 延伸修法**:實測(git 2.50.1)輸出是**兩個 NUL**——
 *      working tree:`filename\0line\0content`
 *      history 掃 :`rev:filename\0line\0content`
 *    舊版註解寫成 `filename\0line:content`、並用**第一個冒號**切內容。那個假設
 *    在真實輸出下會把「內容裡第一個冒號之前的部分」整段丟掉,於是
 *    `PR-井號-999 ref: also PR-井號-40` 這種行只剩後半 → self-PR 判定看不到未知號
 *    → **假放行**(A1 起就存在的可達缺陷,非 A1.1 引入)。
 *    現在改用第二個 NUL 切;沒有第二個 NUL 時**保守保留整段**當內容。
 */
export function parseGrepZLine(
  raw: string
): { path: string; line: string; content: string } | null {
  const nul = raw.indexOf("\0");
  if (nul === -1) return null;
  const path = raw.slice(0, nul);
  const rest = raw.slice(nul + 1);
  const nul2 = rest.indexOf("\0");
  if (nul2 !== -1) {
    return {
      path,
      line: rest.slice(0, nul2),
      content: rest.slice(nul2 + 1),
    };
  }
  // 沒有第二個 NUL(格式與預期不符)→ **保守保留整段**當內容,不猜行號邊界。
  // 方向刻意選「多保留」:內容留太多最多造成誤擋(可查證),切太少會讓
  // 未知引用消失 → 假放行(查不出來)。
  return { path, line: "", content: rest };
}

/** 把 raw hit(含 NUL)轉成 human-readable「path:line:content」顯示。 */
export function displayGrepHit(raw: string): string {
  const parsed = parseGrepZLine(raw);
  if (!parsed) return raw;
  return `${parsed.path}:${parsed.line}:${parsed.content}`;
}

/**
 * hit 的框架(framing)—— **不可從內容推斷,必須由產生者宣告**。
 *
 * 🔴 R1 P1 修法。舊版 `processScan` 對所有 self-PR 模式的 hit 無條件呼叫
 *    `parseGrepZLine`,那個 parser 假設「第一個 NUL 是 grep -Z 的檔名分隔符」。
 *    aggregate diff hit 的形狀是 `<rev8> [+diff] <內容>`,內容裡的 NUL **是資料**。
 *    可達的假放行序列:
 *      baseline 之後 commit A 加一行 `PR-井號-999<NUL>x:PR-井號-40`(999 未知、40 合法),
 *      commit B 再刪掉 → current tree 與 commit 訊息都乾淨。
 *      parseGrepZLine 會把 NUL 前的未知號當成「檔名」丟掉,只把冒號後的
 *      `PR-井號-40` 交給 self-PR 判定 → 放行 → A→B 洗白假綠。
 *
 *    修法:framing 由產生 Scan 的那一端宣告,消費端依 framing 選 parser,
 *    不再從內容猜。真正 NUL-framed 的 hit(git grep -z)維持原本正確解析。
 */
export type HitFraming =
  /**
   * `git grep -z -n` 產出:`path\0line\0content` —— **兩個 NUL**(git 2.50.1 實測)。
   * history tree 掃描時第一段是 `rev:path`,NUL 框架不變。
   * 缺第二個 NUL 時 `parseGrepZLine` 保守把剩餘整段當內容(不用冒號猜行號邊界)。
   */
  | "grep-z"
  /** aggregate diff 掃描產出:`<rev8> [+diff] <content>`;content 可含任意位元組(含 NUL)。 */
  | "diff-prefixed"
  /** 無結構前綴,整行即內容(commit 訊息掃描)。 */
  | "plain";

/** aggregate diff hit 的固定分隔標記(由本檔產生,不來自被掃內容)。 */
export const DIFF_HIT_MARK = " [+diff] ";

/**
 * 從 `<rev8> [+diff] <content>` 取出 content。
 *
 * 標記由本檔在**內容前面**加上,所以第一個出現的位置一定是我們加的那個;
 * content 自己若也含這個字串,不會影響切點。找不到標記 → 回原文(fail-safe:
 * 寧可把整行交給判定,也不要丟掉可能含未知引用的前半段)。
 */
export function extractDiffHitContent(raw: string): string {
  const i = raw.indexOf(DIFF_HIT_MARK);
  return i === -1 ? raw : raw.slice(i + DIFF_HIT_MARK.length);
}

/**
 * 依 framing 取出「要交給 self-PR 判定的內容」。
 *
 * ⚠️ 這是 R1 P1 的核心防線:**未知引用不得被丟掉**。
 *    - grep-z:第一個 NUL 才是檔名分隔符(真的來自 grep 的框架)
 *    - diff-prefixed:只剝掉我們自己加的前綴,content 原樣保留(NUL 是資料)
 *    - plain:整行即內容
 */
export function hitContent(raw: string, framing: HitFraming): string {
  if (framing === "grep-z") return parseGrepZLine(raw)?.content ?? raw;
  if (framing === "diff-prefixed") return extractDiffHitContent(raw);
  return raw;
}

/** 依 framing 產生 human-readable 顯示字串。 */
export function displayHit(raw: string, framing: HitFraming): string {
  if (framing === "grep-z") return displayGrepHit(raw);
  return raw;
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
 * PR A1:讀 baseline config,fail-closed 解析。
 *
 * 回傳 `{ baseline: string | null }`:
 *   - baseline = null → 無 baseline(舊行為,history 全史掃)
 *   - baseline = 字串 → history scan 只掃 `baseline..HEAD`(呼叫端還要 validate)
 *
 * fail-closed 情境(throw Error,呼叫端 catch → exit 1):
 *   - config 檔存在但 JSON malformed
 *   - `schemaVersion` 缺 / 非數字 / ≠ 支援版本(BASELINE_SCHEMA_VERSION)
 *
 * 舊行為 fallback(D3/D4,回 `{ baseline: null }`):
 *   - config 檔不存在(D4:向下相容,downstream fork 未建 config 檔)
 *   - `sourceTermHistoryBaseline` 缺 / null / 空字串(D3:讓「未設 baseline」的
 *     downstream 專案沿用嚴格全史掃、不因為 config 檔存在就變寬鬆)
 *
 * ⚠️ 純資料 loader:baseline 值本身的合法性(40-hex / rev-parse / ancestor)
 *    由 `validateBaseline` 另行檢查——三者任一失敗一律 fail-closed。
 */
export function parseBaselineConfig(text: string): { baseline: string | null } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `${BASELINE_CONFIG_PATH}:JSON 解析失敗 — ${(e as Error).message}`
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${BASELINE_CONFIG_PATH}:root 必須是 JSON object`);
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.schemaVersion !== BASELINE_SCHEMA_VERSION) {
    throw new Error(
      `${BASELINE_CONFIG_PATH}:schemaVersion 未知(收到 ${JSON.stringify(
        obj.schemaVersion
      )},本 checker 只支援 ${BASELINE_SCHEMA_VERSION})`
    );
  }
  const raw = obj.sourceTermHistoryBaseline;
  if (raw === undefined || raw === null || raw === "") {
    return { baseline: null };
  }
  if (typeof raw !== "string") {
    throw new Error(
      `${BASELINE_CONFIG_PATH}:sourceTermHistoryBaseline 必須是字串或 null(收到 ${typeof raw})`
    );
  }
  return { baseline: raw };
}

function loadBaselineConfig(root: string): { baseline: string | null } {
  const p = path.join(root, BASELINE_CONFIG_PATH);
  if (!existsSync(p)) return { baseline: null };
  return parseBaselineConfig(readFileSync(p, "utf-8"));
}

/**
 * PR A1:驗證 baseline 值合法性(fail-closed 前提)。
 *
 * baseline 字串支援兩種前綴語法(round 1 P1 修法 → round 2 P1a 收):
 *   ① 純 hex SHA(嚴格模式):40-hex + rev-parse + ancestor 三檢查,任一失敗
 *      → { kind: "fail" }(下游 fork 用這種、主線值也必須成立)
 *   ② `template:<40-hex>` prefix(template 遺產模式):給 template repo 自身用
 *      的 baseline。若 rev-parse 失敗(下游 fork 走 GitHub Template workflow、
 *      new history 不含此 SHA)→ 回 { kind: "template-fallback" }
 *      → main() 印 warning + **降級為全史掃描**(baseline=null,走既有 tree
 *      scan;round 2 P1a 修法:舊 skip 語意讓洗白 A→B 同 PR 通過,改全史掃擋)。
 *      40-hex 語法錯 / ancestor 失敗仍 fail(這兩條在 template repo 自己也不能允許)。
 *
 * 三條檢查逐條可獨立 kill;移除任一條 → 對應測試轉綠(P1e/P1f/P1i)。
 * 通過 → { kind: "ok", sha }。呼叫端 main 依 kind 分派:
 *   ok               → 走 baseline..HEAD diff scan
 *   template-fallback → 印 warning、**降級為全史掃描**(baseline=null;current tree
 *                       與 commit 訊息掃描仍照常執行)
 *   fail             → exit 1(baseline 是治理決策,壞掉不能靜默降級)
 */
export type BaselineDecision =
  | { kind: "ok"; sha: string }
  | { kind: "template-fallback"; templateSha: string; reason: string }
  | { kind: "fail"; reason: string };

/**
 * PR A1 round 1 P1 修法:template repo 遺產 baseline 前綴。
 * 值範例:「template:641065227924184b058b3f64c1c9f9971a3a17b4」。
 */
const TEMPLATE_BASELINE_PREFIX = "template:";

export function validateBaseline(
  root: string,
  rawBaseline: string
): BaselineDecision {
  const isTemplate = rawBaseline.startsWith(TEMPLATE_BASELINE_PREFIX);
  const sha = isTemplate
    ? rawBaseline.slice(TEMPLATE_BASELINE_PREFIX.length)
    : rawBaseline;
  if (!BASELINE_SHA_RE.test(sha)) {
    return {
      kind: "fail",
      reason: `baseline SHA 必須是 40 字元 hex(收到「${sha}」${isTemplate ? "(去掉 template: prefix 後)" : ""})`,
    };
  }
  const rp = spawnSync(
    "git",
    ["-C", root, "rev-parse", "--verify", "--quiet", `${sha}^{commit}`],
    { encoding: "utf-8", stdio: "pipe" }
  );
  if (rp.status !== 0) {
    if (isTemplate) {
      // Template baseline 在下游 fork 的新 history 內找不到 → 降級,不 fail-closed
      // Round 4 P2:先擋 shallow clone——rev-parse 失敗可能是 shallow 邊界之外
      // 的合法 SHA、不是「不在 history」;誤降級成 template-fallback 只掃 shallow
      // suffix → 洗白 blob 在 shallow 邊界之前的漏抓、false green。
      const shallow = spawnSync(
        "git",
        ["-C", root, "rev-parse", "--is-shallow-repository"],
        { encoding: "utf-8", stdio: "pipe" }
      );
      if (shallow.status === 0 && shallow.stdout.trim() === "true") {
        return {
          kind: "fail",
          reason: `template baseline「${sha.slice(0, 8)}」rev-parse 失敗且當前是 shallow clone — 無法區分「downstream new history」與「合法 SHA 在 shallow 邊界之外」,拒絕降級全史掃(全史掃在 shallow 只覆蓋 shallow suffix、有洗白漏抓風險)。修法:用 fetch-depth: 0 拉全史,或改成本 repo 的 initial commit SHA(去掉 template: prefix)`,
        };
      }
      return {
        kind: "template-fallback",
        templateSha: sha,
        reason: `template baseline「${sha.slice(0, 8)}」在當前 repo history 找不到 — 判定為 downstream fork(GitHub Template workflow 建的 new history 不含 template repo 的 SHA)`,
      };
    }
    return {
      kind: "fail",
      reason: `baseline SHA rev-parse 失敗 — 找不到 commit「${sha}」(是否 shallow clone / SHA 打錯?)`,
    };
  }
  const mb = spawnSync(
    "git",
    ["-C", root, "merge-base", "--is-ancestor", sha, "HEAD"],
    { encoding: "utf-8", stdio: "pipe" }
  );
  if (mb.status !== 0) {
    return {
      kind: "fail",
      reason: `baseline 不是 HEAD 的 ancestor(baseline ${sha.slice(0, 8)} 與 HEAD 無祖先關係 → baseline..HEAD 語意不成立)`,
    };
  }
  return { kind: "ok", sha };
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
 *   1) delivery refs(scripts/lib/delivery-refs.ts 共用契約:唯一來源是受驗 origin/HEAD;不讀 env;無 fallback)的 git log subject 抽出
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
  // 交付 ref 的來源與驗證在 shared lib(scripts/lib/delivery-refs.ts),與 check-todos-markers
  // 共用單一契約(唯一來源 = 受驗 origin/HEAD base;不讀任何 env;無 fallback)。
  // 任何拒絕都不靜默:印原因碼、exit 2。**只動 allowedPrs 來源這道縫,掃描語意不變。**
  const resolved = resolveDeliveryRefsFromRepo(root);
  if (!resolved.ok) {
    console.error(formatRejections(resolved.rejections));
    process.exit(2);
  }
  const refs = resolved.refs;
  const prs =
    refs.length === 0
      ? new Set<number>()
      : parseAllowedPrs(
          // 同 Step 5 r3 CRITICAL:重編碼會讓 subject 抽不出 `(井號+N)` →
          // allowedPrs 變空 → 合法 self-PR 引用全被擋(方向是 false-red)。
          execFileSync(
            "git",
            ["-C", root, "-c", "i18n.logOutputEncoding=UTF-8", "log", ...refs, "--format=%s"],
            { encoding: "utf-8", maxBuffer: 512 * 1024 * 1024 }
          )
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
  //
  // 🔴 Step 5 r2 CRITICAL。`-c color.ui=false` 是**必要**的,不是保險:
  //    使用者或 repo 設 `color.ui=always` / `color.grep=always` 時,git grep 會把
  //    **命中的那一小段**包進 ANSI 序列:一行「ref 井號+999」會變成
  //    「ref <ESC>[1;31m井號+9<ESC>[m99」——CA 正則只抽得到命中片段內的個位數,
  //    尾巴兩位被 ANSI 切斷。抽出的號碼通常已在 allowedPrs(任何 merge 過 10 個
  //    以上的 repo 都是)→ self-PR 判定放行 → **未知引用假放行**。
  //    實測:乾淨 config exit 1;`color.ui=always` exit 0。
  //    這條**不受 baseline 影響**(工作樹與全史 tree 掃描都中),下游採用者一樣中。
  //    patch producer 早就釘了 `--no-color`,同一個不變量不能在這條路徑放空。
  //
  //    ⚠️ 用**命令列** `--color=never`,不要用 `-c color.ui=false`:`color.grep` 比
  //    `color.ui` 更具體,設了 `color.grep=always` 時 `color.ui=false` 蓋不掉它。
  //    命令列旗標勝過 config,所以不必去窮舉可能的 config 鍵名。
  //    (這個不完整的第一版修法是被 S5R2-C1 自己抓出來的。)
  const r = spawnSync("git", ["-C", root, "grep", "--color=never", "-z", ...args], {
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const hits = (r.stdout || "").split("\n").filter((l) => l.length > 0);
  return { hits, rc: r.status ?? 2 };
}

// ───────────────────────────────────────── 三段掃描

export type Mode = "strict" | "self-pr";

export interface Scan {
  label: string;
  mode: Mode;
  hits: string[];
  rc: number;
  /**
   * hit 的框架。**必填**——讓每個產生點都被編譯器逼著宣告,
   * 消費端不再從內容猜(R1 P1:猜錯會把未知 PR 引用當檔名丟掉)。
   */
  framing: HitFraming;
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
      framing: "grep-z" as const,
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
      framing: "grep-z" as const,
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
      framing: "grep-z" as const,
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

/**
 * 從 `git show -p` patch 文字取出新增行的**內容**(strip 一個 `+` 標記)。
 * PR A1 round 1 P2 修法 → round 2 P1b 加固。
 *
 * ⚠️ 兩個坑(round 2 P1b 抓到):
 *   ① 舊版保留 `+` 前綴給 grep → pattern `^forbidden` 對新增內容 `forbidden`
 *      不命中(POSIX ERE 錨點 `^` 對「+forbidden」不 match `forbidden`)。
 *      現在 strip 一個 `+`。
 *   ② 舊版用 `l.startsWith("+++")` 過濾檔頭 → hunk 內容以 `++foo` 開頭時
 *      patch 行為 `+++foo`,會被誤當檔頭丟。現在用 hunk state:只在 hunk 內
 *      (`@@` 之後、下一個 `diff --git` 之前)採 `+` 開頭行,strip 一個 `+`。
 *      檔頭 `+++ b/path` 因為出現在 `@@` 之前 → inHunk=false → 不採。
 *
 * 純函式,供測試直接呼叫(見 tests/check-no-source-terms.test.ts P1b-parser)。
 *
 * ⚠️ **PR A1.1 起本函式不再位於 production 掃描路徑**——production 走
 *    `extractAddedLinesByPath`(多帶檔案路徑歸屬)。本函式保留為
 *    **differential oracle**:6 輪 review 加固過的 hunk 分界語意留在這裡,
 *    測試用它與新解析器逐份 patch 對照(見 tests 的 U-equiv),擋兩套狀態機漂移。
 */
export function extractAddedLinesFromPatch(patch: string): string {
  const out: string[] = [];
  let inHunk = false;
  for (const line of patch.split("\n")) {
    if (line.startsWith("diff --git ")) {
      inHunk = false;
      continue;
    }
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith("+")) {
      out.push(line.slice(1));
    }
  }
  return out.join("\n");
}

// ─────────────────── PR A1.1 F1:單次 patch 提取 + 分桶批次 grep ───────────────────
//
// 取代 A1 的「每個 rev 各跑三次 `git show`(non-CA / CA / SYNTAX)」。
// 舊版對 main pathspec 產兩次相同 patch(non-CA 與 CA 各一次)→ 同一份 patch 被
// 提取兩次,且 subprocess 隨 baseline..HEAD 的 commit 數單調成長(3 次 git show +
// 3 次 grep 每 commit),baseline 是治理決策不能為效能推進 → 會撞 CI 十分鐘上限。
//
// **掃描語意與判定結果不變**(per-commit diff 新增行、first-parent、豁免兩層),
// 只改「怎麼取到那份 patch」。唯一的對外差異是診斷輸出:hit 的 label 從
// per-rev 一段改成彙總一段,rev 改由每行 hit 的前綴帶(顯示格式不變)。
//   1. `git rev-list baseline..HEAD` 取 rev(metadata,不輸出 patch bytes)
//   2. rev 分批,每批**一次** patch producer 呼叫、**不帶 pathspec**
//   3. 每個 rev 的 patch **只解析一次** → `Map<path, 新增行[]>`
//   4. 同一份 Map 分兩桶(main / syntax),供三組 policy 共用
//   5. 每桶每 rev 寫暫存檔,三次 `grep -r` 批掃整個目錄
//
// ⚠️ pathspec 過濾從 git 移到 JS,因此**必須自己解析 patch 檔頭路徑**。
//    這是本次改動新增的攻擊面,對應防線見 `parsePatchDstPath` / `decodeGitCQuote`
//    的 docstring 與 tests 的 E1-E7 / U1-U12。任何解析不明確一律 fail-closed。

/**
 * 一次 patch producer 呼叫最多處理幾個 rev。
 * 目的是限制單一串流的 stdout 尺寸(maxBuffer),不是限制 subprocess 數量。
 * 批次之間**互斥且完全覆蓋** rev-list(契約 C2b)。
 *
 * ⚠️ 為什麼不設更大:pathspec 過濾已移到 JS,所以**串流會包含 FULL_EXCLUDES 的
 *    路徑**(例如 lockfile 的大量 churn)——舊版由 git pathspec 在來源端就排除掉。
 *    單批太大時 stdout 會撞 maxBuffer;那是 fail-closed(不會靜默漏掃),但對
 *    採用者是沒必要的紅燈。50 讓單批體積約為 200 的四分之一。
 */
const PATCH_BATCH_SIZE = 50;
/**
 * patch producer 的 prefix / quoting 釘法。
 *
 * ⚠️ 使用者的 git config 會改變 `+++` 檔頭形狀(實測):
 *   `diff.noprefix=true`      → `+++ sp ace.txt`(**沒有 `b/`**)
 *   `diff.mnemonicPrefix=true`→ 前綴變 `i/` `w/` `c/` `o/`
 *   `core.quotePath=true`     → 非 ASCII 檔名被 C-quote
 * command-local 的 `--src-prefix` / `--dst-prefix` / `-c core.quotePath=false`
 * 壓得過 repo 與 user config(契約 E6 / E6b / C5p 守這件事)。
 *
 * ⚠️ **tab / newline 檔名在任何設定下都仍是 C-quoted** → `decodeGitCQuote` 不可省。
 */
const PINNED_SRC_PREFIX = "a/";
const PINNED_DST_PREFIX = "b/";
/** batch separator 的固定前綴,後面接每次執行隨機產生的 32-hex。 */
const PATCH_MARKER_PREFIX = "A1SEP-";

/**
 * 每次執行產生一個新的 separator marker。
 * ⚠️ 隨機只是**降噪**,不是安全論據——碰撞防護由 `splitPatchStream` 的
 *    fail-closed 檢查承擔(未知 rev / 重複 rev / 未歸屬 bytes / 缺 rev 一律報錯)。
 */
export function buildPatchMarker(): string {
  return `${PATCH_MARKER_PREFIX}${randomBytes(16).toString("hex")}`;
}

/**
 * 把 `FULL_EXCLUDES` 的 pathspec magic 轉成裸路徑,**只給 JS 端集合比對用**。
 *
 * 支援 `:!X` 與 `:(exclude)X`。其他 magic(`:(glob)` / `:(icase)` / `:/` …)
 * **一律 throw**:本 checker 的排除語意假設「精確路徑」,把未知 magic 當字面
 * 路徑會讓豁免失效(排不掉 → 誤報)或過度排除(漏抓),兩個方向都不能猜。
 */
export function stripExcludeMagic(spec: string): string {
  if (spec.startsWith(":(exclude)")) return spec.slice(":(exclude)".length);
  if (spec.startsWith(":!")) return spec.slice(2);
  if (spec.startsWith(":")) {
    throw new Error(
      `不支援的 pathspec magic:「${spec}」(本 checker 只認 :! 與 :(exclude))`
    );
  }
  return spec;
}

/**
 * 解 git 的 C-quoted path(`"b/tab\tname.txt"` 這種形式)。
 *
 * git 對含 tab / newline / 雙引號 / 反斜線 / 非 ASCII 的檔名會加雙引號並做
 * C-style escape。**`core.quotePath=false` 只讓非 ASCII 不 quote,tab / newline
 * 仍然 quote**(實測),所以 decoder 不可省。
 *
 * 支援:`\\` `\"` `\a` `\b` `\f` `\n` `\r` `\t` `\v` 與 `\<3 位八進位>`。
 * 八進位先組 byte,最後整批以 UTF-8 解 —— 非 ASCII 檔名是多個 `\ooo` 組成的
 * UTF-8 序列,逐 byte 轉字元會壞掉。
 *
 * **未知 escape / 引號未閉合 → throw**(fail-closed,不猜)。
 */
export function decodeGitCQuote(quoted: string): string {
  if (quoted.length < 2 || !quoted.startsWith('"') || !quoted.endsWith('"')) {
    throw new Error(`C-quoted path 格式錯誤(引號未閉合):${quoted}`);
  }
  const body = quoted.slice(1, -1);
  const simple: Record<string, number> = {
    "\\": 0x5c,
    '"': 0x22,
    a: 0x07,
    b: 0x08,
    f: 0x0c,
    n: 0x0a,
    r: 0x0d,
    t: 0x09,
    v: 0x0b,
  };
  const bytes: number[] = [];
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    if (c !== "\\") {
      for (const b of Buffer.from(c, "utf-8")) bytes.push(b);
      continue;
    }
    const n = body[i + 1];
    if (n === undefined) throw new Error(`C-quoted path escape 未完成:${quoted}`);
    if (n >= "0" && n <= "7") {
      const oct = body.slice(i + 1, i + 4);
      if (!/^[0-7]{3}$/.test(oct)) {
        throw new Error(`C-quoted path 八進位 escape 不完整:\\${oct}`);
      }
      bytes.push(parseInt(oct, 8));
      i += 3;
      continue;
    }
    const mapped = simple[n];
    if (mapped === undefined) {
      throw new Error(`C-quoted path 未知 escape:\\${n}(${quoted})`);
    }
    bytes.push(mapped);
    i += 1;
  }
  return Buffer.from(bytes).toString("utf-8");
}

export type PatchDst = { kind: "deleted" } | { kind: "path"; path: string };

/**
 * 解 patch 的 `+++` 目的端檔頭,回傳 repo-relative 路徑。
 *
 * 釘住 flags 之後只會出現四種形狀(實測):
 *   `+++ /dev/null`                → 刪除(該 section 不會有新增行)
 *   `+++ b/plain.txt`              → 一般
 *   `+++ b/sp ace.txt<TAB>`        → **檔名含空白時 git 會追加一個 TAB 分隔符**
 *   `+++ "b/tab\tname.txt"`        → C-quoted(tab / newline / 引號 / 反斜線)
 *
 * ⚠️ **尾端 TAB 與 quoting 是兩個獨立的軸**(Step 5 r2 CRITICAL 修正)。git 只要
 *    路徑**含空白**就追加 TAB 分隔符,**不論有沒有 quote**;而 tab / newline /
 *    引號 / 反斜線 / 非 ASCII 才觸發 quoting。所以四種組合都存在:
 *      `+++ b/sp ace.txt<TAB>`            unquoted + TAB
 *      `+++ "b/tab\tname.txt"`            quoted   無 TAB
 *      `+++ "b/both sp\ttab.txt"<TAB>`    **quoted + TAB**(舊版沒處理 → 引號未
 *                                          閉合 → throw → 乾淨 repo 整段掃描 rc=2)
 *      `+++ b/plain.txt`                  兩者皆無
 *    因此**先剝尾端 TAB、再判斷 quoting**。unquoted 名稱剝完若仍含 TAB → 形狀
 *    異常 → throw(fail-closed,不是誤判)。
 * ⚠️ 少了 `b/` 前綴代表 prefix 釘法失效(例如未來有人拿掉 `--dst-prefix`)
 *    → **throw,不得把該 section 當空**——當空 = 該檔的新增行整段漏掃 = false green。
 */
export function parsePatchDstPath(line: string): PatchDst {
  const HEAD = "+++ ";
  if (!line.startsWith(HEAD)) {
    throw new Error(`不是 +++ 檔頭:${line.slice(0, 120)}`);
  }
  const raw = line.slice(HEAD.length);
  if (raw === "/dev/null") return { kind: "deleted" };
  // 先剝至多一個尾端 TAB(路徑含空白時 git 一律追加,與 quoting 無關)。
  const rest = raw.endsWith("\t") ? raw.slice(0, -1) : raw;
  let decoded: string;
  if (rest.startsWith('"')) {
    decoded = decodeGitCQuote(rest);
  } else {
    decoded = rest;
    if (decoded.includes("\t")) {
      throw new Error(`+++ 檔頭形狀異常(unquoted 名稱含非尾端 TAB):${line.slice(0, 120)}`);
    }
  }
  if (!decoded.startsWith(PINNED_DST_PREFIX)) {
    throw new Error(
      `+++ 檔頭缺 dst-prefix「${PINNED_DST_PREFIX}」(收到「${decoded.slice(0, 120)}」)` +
        " — patch producer 的 --dst-prefix 釘法可能失效,拒絕靜默略過"
    );
  }
  return { kind: "path", path: decoded.slice(PINNED_DST_PREFIX.length) };
}

/**
 * patch 行狀態機的**單一實作**(SSOT)。
 *
 * `extractAddedLinesByPath`(純函式、給單元測試)與 production 的串流消費者
 * 都走這一支,兩邊不會漂移。
 *
 * 狀態轉移:
 *   `diff --git ` → 離開 hunk、清空當前路徑
 *   非 hunk 的 `+++ ` → parsePatchDstPath
 *   `@@` → 進入 hunk
 *   hunk 內 `+` 開頭 → 新增內容(strip 一個 `+`),歸給當前路徑
 *
 * ⚠️ hunk 內出現新增行但當前路徑不明(null 或 deleted)→ **throw**。
 *    patch 結構異常代表檔頭解析失敗或串流被截斷;吞掉它 = 漏掃。
 * ⚠️ hunk 內容行長得像檔頭(`+++ b/x` / `diff --git ...` / `@@ ...`)不被當成檔頭:
 *    它們在 patch 內帶了額外的 `+` 前綴,不符合各分支的字面條件(U10 守這條)。
 */
export interface PatchLineState {
  inHunk: boolean;
  current: PatchDst | null;
}

export function newPatchLineState(): PatchLineState {
  return { inHunk: false, current: null };
}

/** 回傳這一行貢獻的新增內容(附所屬路徑);非內容行回 null。 */
export function stepPatchLine(
  state: PatchLineState,
  line: string
): { path: string; added: string } | null {
  if (line.startsWith("diff --git ")) {
    state.inHunk = false;
    state.current = null;
    return null;
  }
  if (!state.inHunk && line.startsWith("+++ ")) {
    state.current = parsePatchDstPath(line);
    return null;
  }
  if (line.startsWith("@@")) {
    state.inHunk = true;
    return null;
  }
  if (!state.inHunk) return null;
  if (!line.startsWith("+")) return null;
  if (state.current === null || state.current.kind === "deleted") {
    throw new Error(
      `patch hunk 的新增行無法歸屬到檔案路徑(patch 結構異常):${line.slice(0, 120)}`
    );
  }
  return { path: state.current.path, added: line.slice(1) };
}

/**
 * 從一份 rev 的 patch 取出「每個檔的新增行內容」。
 * 純函式包裝 `stepPatchLine`,供單元測試與差分對照用。
 */
export function extractAddedLinesByPath(patch: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const state = newPatchLineState();
  for (const line of patch.split("\n")) {
    const hit = stepPatchLine(state, line);
    if (!hit) continue;
    const arr = out.get(hit.path);
    if (arr) arr.push(hit.added);
    else out.set(hit.path, [hit.added]);
  }
  return out;
}

export type BucketName = "main" | "syntax";

/**
 * 一個路徑屬於哪些桶(**單一實作**,純函式包裝與串流路由共用)。
 * 語意逐條對齊舊版兩種 pathspec:
 *   main   = `. :!<FULL_EXCLUDES>`  → 路徑 ∉ 正規化後的 FULL_EXCLUDES
 *   syntax = `<SYNTAX_EXEMPT_FILES>` → 路徑 ∈ SYNTAX_EXEMPT_FILES
 * `SYNTAX_EXEMPT_FILES` 全部也在 `FULL_EXCLUDES` 內,所以兩桶互斥(S-2 守這條)。
 */
export function bucketsOfPath(
  path: string,
  normalizedExcludes: Set<string>,
  syntaxFiles: Set<string>
): BucketName[] {
  const out: BucketName[] = [];
  if (!normalizedExcludes.has(path)) out.push("main");
  if (syntaxFiles.has(path)) out.push("syntax");
  return out;
}

/** 把**同一份** extraction 分成兩桶,供三組 policy 共用(INV-3)。 */
export function bucketAddedLines(
  byPath: Map<string, string[]>,
  normalizedExcludes: string[],
  syntaxFiles: string[]
): { main: string[]; syntax: string[] } {
  const ex = new Set(normalizedExcludes);
  const syn = new Set(syntaxFiles);
  const main: string[] = [];
  const syntax: string[] = [];
  for (const [p, lines] of byPath) {
    for (const b of bucketsOfPath(p, ex, syn)) {
      if (b === "main") main.push(...lines);
      else syntax.push(...lines);
    }
  }
  return { main, syntax };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * batch separator 規則的**單一實作**(SSOT):把串流的每一行歸給某個 rev,
 * 五條規則逐項 fail-closed。`splitPatchStream`(純函式)與 production 串流
 * 消費者都走這一支。
 *
 * separator 行格式 `^<marker> <40-hex>$`。任一條不成立 → throw:
 *   1. 第一個 separator 之前不得有非空內容(未歸屬的 patch bytes)
 *   2. separator 的 rev 必須 ∈ expectedRevs(未知 rev)
 *   3. 每個 rev 的 separator 至多一次(重複)
 *   4. marker 開頭但格式損壞(SHA 非 40-hex / 有尾隨內容)
 *   5. 結束時 producedRevs 必須**恰等於** expectedRevs
 *      (producer 不帶 pathspec,git 對空 commit 也會印 format 行 → 可用等號)
 *
 * ⚠️ 碰撞時直接 fail-closed,不試圖繼續掃完——寧可紅,不可靜默切錯段。
 */
export interface SeparatorConsumer {
  pushLine(line: string): void;
  finish(): void;
}

export function makeSeparatorConsumer(opts: {
  expectedRevs: string[];
  marker: string;
  onRevStart(rev: string): void;
  onLine(rev: string, line: string): void;
  onRevEnd(rev: string): void;
}): SeparatorConsumer {
  const expected = new Set(opts.expectedRevs);
  if (expected.size !== opts.expectedRevs.length) {
    throw new Error("expectedRevs 含重複 rev");
  }
  const sepRe = new RegExp(`^${escapeRegExp(opts.marker)} ([0-9a-f]{40})$`);
  const seen = new Set<string>();
  let cur: string | null = null;
  return {
    pushLine(line: string): void {
      if (line.startsWith(opts.marker)) {
        const m = sepRe.exec(line);
        if (!m) {
          throw new Error(`patch 串流 separator 格式損壞:「${line.slice(0, 120)}」`);
        }
        const rev = m[1]!;
        if (!expected.has(rev)) {
          throw new Error(`patch 串流含未預期的 rev separator:${rev}`);
        }
        if (seen.has(rev)) {
          throw new Error(`patch 串流的 rev separator 重複:${rev}`);
        }
        seen.add(rev);
        if (cur !== null) opts.onRevEnd(cur);
        cur = rev;
        opts.onRevStart(rev);
        return;
      }
      if (cur === null) {
        if (line.trim() !== "") {
          throw new Error(
            `patch 串流在第一個 separator 之前含未歸屬內容:「${line.slice(0, 120)}」`
          );
        }
        return;
      }
      opts.onLine(cur, line);
    },
    finish(): void {
      if (cur !== null) opts.onRevEnd(cur);
      cur = null;
      if (seen.size !== expected.size) {
        const missing = opts.expectedRevs.filter((r) => !seen.has(r));
        throw new Error(
          `patch 串流缺少 ${missing.length} 個 rev 的 separator(如 ${missing
            .slice(0, 3)
            .map((r) => r.slice(0, 8))
            .join(", ")})`
        );
      }
    },
  };
}

/** 純函式包裝:把整段串流切成 `rev → patch`(給單元測試與差分對照用)。 */
export function splitPatchStream(
  stream: string,
  expectedRevs: string[],
  marker: string
): Map<string, string> {
  const out = new Map<string, string>();
  const buf = new Map<string, string[]>();
  const c = makeSeparatorConsumer({
    expectedRevs,
    marker,
    onRevStart: (rev) => buf.set(rev, []),
    onLine: (rev, line) => buf.get(rev)!.push(line),
    onRevEnd: (rev) => out.set(rev, buf.get(rev)!.join("\n")),
  });
  for (const line of stream.split("\n")) c.pushLine(line);
  c.finish();
  return out;
}

/**
 * diff scan 的可注入參數。**production 一律走預設值**——但守法分兩層,別誤以為
 * 單一契約全包(Step 5 INFORMATIONAL):
 *   - `srcPrefix` / `dstPrefix` 與 `core.quotePath` 釘法會出現在 argv → 由 **C5p**
 *     以 shim 斷言 CLI 實際傳的就是釘死的值。
 *   - `batchSize` / `marker` / `longLineProbeBytes` **不出現在 argv**,shim 看不到。
 *     `longLineProbeBytes` 的預設值由 **S5D2** 夾住:同一個 3 MiB fixture 斷言
 *     `droppedLongLines === 1` 且 `peakPendingLineBytes > 1 MiB` —— 門檻調大變 0 條、
 *     調小變 2 條且峰值掉到 1 MiB 以下,兩個方向都轉紅。
 */
export interface DiffScanOptions {
  /** 一次 patch producer 呼叫最多幾個 rev(測試用小值打批次邊界)。 */
  batchSize?: number;
  /** batch separator marker(測試用可預測值構造碰撞負對照)。 */
  marker?: string;
  /** patch 前綴釘法(測試用空值構造 fail-closed 負對照)。 */
  srcPrefix?: string;
  dstPrefix?: string;
  /** 長行增量丟棄的探測門檻(測試用小值,讓「超長行」在合理體積下可構造)。 */
  longLineProbeBytes?: number;
  /** 串流統計觀測器(測試用;**純觀測,不改任何行為**,production 不傳)。 */
  onStreamStats?: (stats: DiffStreamStats) => void;
}

/** 串流消費的可觀測統計(測試用;production 不讀)。 */
export interface DiffStreamStats {
  /** 單一邏輯行在記憶體中累積過的最大字元數。 */
  peakPendingLineBytes: number;
  /** 因「一定不貢獻桶內容、也不改狀態」而被增量丟棄的長行數。 */
  droppedLongLines: number;
}

function chunkRevs(revs: string[], size: number): string[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`batchSize 必須是 ≥ 1 的整數(收到 ${String(size)})`);
  }
  const out: string[][] = [];
  for (let i = 0; i < revs.length; i += size) out.push(revs.slice(i, i + size));
  return out;
}

/**
 * 跑一批 rev 的 patch producer,**stdout 直接寫進檔案**。
 *
 * 🔴 R1 P2 修法。舊版用 `spawnSync` 的 pipe + `maxBuffer: 256 MiB` 把整批 patch
 *    收進記憶體。pathspec 過濾已移到 JS,所以**被排除的路徑也會流進那個 buffer**:
 *    一個只動 `package-lock.json`(FULL_EXCLUDES 路徑)、patch 超過上限的 commit,
 *    在 A1.1 之前由 git pathspec 在來源端就被擋掉、判定為乾淨;在 buffer 版本
 *    卻會讓 gate exit 非 0 —— 政策豁免的改動被判紅,是新引入的 false-red。
 *
 *    修法:stdout 接到檔案 fd,**完全不經過有上限的記憶體 buffer**;下游改成
 *    逐行串流消費(見 `consumeProducerFile`),記憶體不隨 patch 的**位元組總量**成長
 *    (上界是單一邏輯行,界線見 `canDropLongPatchLine` 與 ADR〈已知限制〉第 7 條)。
 *    contract:X3 由 shim 觀測 producer 的 fd 1 必須是檔案而非 pipe。
 */
function runPatchProducerToFile(
  root: string,
  revs: string[],
  marker: string,
  srcPrefix: string,
  dstPrefix: string,
  outPath: string
): void {
  const fd = openSync(outPath, "w");
  try {
    const res = spawnSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "core.quotePath=false",
        "-c",
        "diff.noprefix=false",
        "-c",
        "diff.mnemonicPrefix=false",
        // 🔴 Step 5 CRITICAL。`-m` 的語意是「用**預設** merge-diff 格式」,而預設值
        //    由 `log.diffMerges` 決定(git ≥ 2.32)。repo 或使用者 config 設成
        //    `dense-combined` / `combined` / `remerge`,merge commit 就變 `diff --cc`:
        //    新增行是 `++forbidden`,`stepPatchLine` strip 一個 `+` 後剩 `+forbidden`,
        //    帶錨的 deny pattern 不 match → **merge commit 引入的 forbidden 整段變綠**。
        //    實測 `log.diffMerges=dense-combined` 會讓 P1zz4 的場景從 exit 1 變 exit 0。
        //    釘成 `separate` = 每個 parent 一份普通 diff,配 `--first-parent` 即傳統 `-m` 行為。
        "-c",
        "log.diffMerges=separate",
        // 與另外兩個 git log 呼叫點一致(Step 5 r3):輸出編碼一律釘死,
        // 契約不開例外,C5r 才能無條件掃所有 git log 呼叫。
        "-c",
        "i18n.logOutputEncoding=UTF-8",
        "log",
        "--no-walk=unsorted",
        "--stdin",
        // 以下旗標與 A1 的 per-rev `git show` 逐字對齊(輸出實測逐字節相同):
        // -m/--first-parent(merge 只看 first parent)、--no-renames(rename dance)、
        // --text/--no-textconv(.gitattributes -diff)、--unified=0、--no-color
        "-m",
        "--first-parent",
        "--no-renames",
        "--text",
        "--no-textconv",
        "--unified=0",
        "--no-color",
        `--src-prefix=${srcPrefix}`,
        `--dst-prefix=${dstPrefix}`,
        `--format=${marker} %H`,
      ],
      {
        input: revs.join("\n") + "\n",
        // stdout → 檔案 fd(不是 pipe):不設 maxBuffer,不受記憶體上限。
        stdio: ["pipe", fd, "pipe"],
        encoding: "utf-8",
      }
    );
    if (res.error) {
      throw new Error(`patch producer 無法完成(${res.error.message})`);
    }
    if (res.status !== 0) {
      throw new Error(
        `patch producer 失敗(exit ${res.status}):${(res.stderr || "").slice(0, 300)}`
      );
    }
  } finally {
    closeSync(fd);
  }
}

/** 每累積這麼多**完成的行**就 flush 到桶檔,讓它們不在記憶體堆積(未完成行的長度另計)。 */
const BUCKET_FLUSH_LINES = 2048;

/** 長行探測門檻:累積超過這麼多字元仍未見換行,才評估能否增量丟棄。 */
const LONG_LINE_PROBE_BYTES = 1 << 20;

/**
 * 這個「已超過探測門檻的長行」能否在**還沒讀完整行**時就丟棄後續位元組?
 *
 * 🔴 R2 P2-1 修法。R1 拿掉了 producer 的 256 MiB maxBuffer,但消費端仍把
 *    **整個邏輯行**累積進 `pendingText` 才交給狀態機 —— false-red 只是從
 *    producer 位移到消費端,沒有消失。可達序列:baseline 之後某 commit
 *    **只動** FULL_EXCLUDES 路徑(例 `package-lock.json`)、且該檔被編碼成
 *    **單一超長邏輯行**;pendingText 會長到超過 Node 的 MAX_STRING_LENGTH
 *    (v24 = 536870888)而 throw → rc=2 → **政策明文豁免的改動被判紅**。
 *    A1.1 之前 git pathspec 在來源端就不會產出那些位元組。
 *
 *    修法:對「處理它一定不產生任何桶內容、也一定不改變狀態機狀態」的長行,
 *    讀到門檻就丟棄其餘位元組。判定只用 `startsWith`,所以用門檻長度的**前綴**
 *    判定與用整行判定等價。**不靠提高上限、也不靠文件說明繞過。**
 *
 * ⚠️ 以下情況一律回 false(保留累積),缺一就是漏掃或誤判:
 *   - **未達門檻的行完全不走這裡**:production 的 separator 行長度上界是
 *     marker(固定前綴 + 32-hex)加 1 加 40 字元,patch 檔頭則受 PATH_MAX 約束,
 *     兩者都遠短於門檻,因此不會走到丟棄分支(N8a 的注入 marker `+MARK` 正是
 *     `+` 開頭,少了門檻保護就會被誤丟)。⚠️ 誠實邊界:若有人注入長度接近門檻的
 *     marker,被丟掉的 separator 會讓該 rev 缺席 → 觸發 §6.1 規則 5 → throw →
 *     **fail-closed 轉紅**,不是假放行。
 *   - `diff --git ` / `@@` / 非 hunk 內的行:會改變狀態機狀態。
 *   - hunk 內新增行但當前路徑不明:`stepPatchLine` 要 throw(fail-closed),不可吞。
 *   - 當前路徑**至少屬於一個桶**:那是要被掃的內容,丟了就是漏掃。
 */
export function canDropLongPatchLine(
  state: PatchLineState,
  prefix: string,
  ex: Set<string>,
  syn: Set<string>
): boolean {
  if (prefix.startsWith("diff --git ")) return false;
  if (prefix.startsWith("@@")) return false;
  if (!state.inHunk) return false;
  // hunk 內非 `+` 開頭:`stepPatchLine` 直接忽略且不改狀態 → 丟棄與處理等價。
  if (!prefix.startsWith("+")) return true;
  if (state.current === null || state.current.kind === "deleted") return false;
  return bucketsOfPath(state.current.path, ex, syn).length === 0;
}

/**
 * 逐行消費 producer 產出的檔案,把新增行直接路由進「每 rev 每桶」的暫存檔。
 *
 * 記憶體上界 = 單一邏輯行 + 一個小 flush buffer;不隨 patch / batch 的**位元組總量**成長。
 * ⚠️ **界線**:被掃路徑的超長單行仍會整行進記憶體(ADR〈已知限制〉第 7 條;非本次重構
 * 造成的迴歸——重構前的 `git show` maxBuffer 是更低的 256 MiB)。排除路徑的長行由
 * `canDropLongPatchLine` 增量丟棄。
 * separator 規則與 patch 狀態機都走 SSOT(`makeSeparatorConsumer` / `stepPatchLine`)。
 */
function consumeProducerFile(
  filePath: string,
  expectedRevs: string[],
  marker: string,
  ex: Set<string>,
  syn: Set<string>,
  dirs: Record<BucketName, string>,
  touched: Record<BucketName, Set<string>>,
  stream: { probeBytes: number; stats: DiffStreamStats }
): void {
  let state = newPatchLineState();
  const pending: Record<BucketName, string[]> = { main: [], syntax: [] };
  let curRev: string | null = null;

  const flush = (bucket: BucketName): void => {
    const lines = pending[bucket];
    if (lines.length === 0 || curRev === null) return;
    appendFileSync(path.join(dirs[bucket], curRev), lines.join("\n") + "\n", "utf-8");
    touched[bucket].add(curRev);
    lines.length = 0;
  };

  const consumer = makeSeparatorConsumer({
    expectedRevs,
    marker,
    onRevStart: (rev) => {
      curRev = rev;
      state = newPatchLineState();
    },
    onLine: (_rev, line) => {
      const hit = stepPatchLine(state, line);
      if (!hit) return;
      for (const b of bucketsOfPath(hit.path, ex, syn)) {
        pending[b].push(hit.added);
        if (pending[b].length >= BUCKET_FLUSH_LINES) flush(b);
      }
    },
    onRevEnd: () => {
      flush("main");
      flush("syntax");
      curRev = null;
    },
  });

  const fd = openSync(filePath, "r");
  try {
    const decoder = new StringDecoder("utf8");
    const buf = Buffer.allocUnsafe(1 << 20);
    let pendingText = "";
    let dropping = false;
    const observe = (len: number): void => {
      if (len > stream.stats.peakPendingLineBytes) {
        stream.stats.peakPendingLineBytes = len;
      }
    };
    /** 消費一塊已解碼文字:切行送 consumer;長行確定無貢獻時改為丟棄其餘位元組。 */
    const feed = (text: string): void => {
      let rest = text;
      for (;;) {
        const nl = rest.indexOf("\n");
        if (dropping) {
          if (nl === -1) return;
          dropping = false;
          rest = rest.slice(nl + 1);
          continue;
        }
        if (nl === -1) {
          pendingText += rest;
          observe(pendingText.length);
          if (
            pendingText.length > stream.probeBytes &&
            canDropLongPatchLine(state, pendingText, ex, syn)
          ) {
            pendingText = "";
            dropping = true;
            stream.stats.droppedLongLines += 1;
          }
          return;
        }
        const line = pendingText + rest.slice(0, nl);
        observe(line.length);
        pendingText = "";
        consumer.pushLine(line);
        rest = rest.slice(nl + 1);
      }
    };
    for (;;) {
      const n = readSync(fd, buf, 0, buf.length, null);
      if (n === 0) break;
      feed(decoder.write(buf.subarray(0, n)));
    }
    feed(decoder.end());
    // 丟棄中的尾段沒有換行結尾 → 它就是那條被丟的行,不補送。
    if (!dropping && pendingText.length > 0) consumer.pushLine(pendingText);
  } finally {
    closeSync(fd);
  }
  consumer.finish();
}

/** 對一個目錄批掃(每檔一個 rev);hit 由 basename 還原 rev。 */
function grepRevDir(
  dir: string,
  fileCount: number,
  patternFile: string,
  label: string,
  mode: Mode
): Scan {
  if (fileCount === 0) {
    return { label, mode, hits: [], rc: 1, framing: "diff-prefixed" }; // clean
  }
  // `-a` 覆蓋 binary detection(round 6 P1:NUL byte 洗白);`-H` 明確要求印檔名
  // (不倚賴 `-r` 的隱含行為);`-E` POSIX ERE;`-i` 對齊既有大小寫語意。
  const r = spawnSync("grep", ["-aiEH", "-r", "-f", patternFile, dir], {
    encoding: "utf-8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const prefix = `${dir}/`;
  const hits = (r.stdout || "")
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => {
      const rest = l.startsWith(prefix) ? l.slice(prefix.length) : l;
      const c = rest.indexOf(":");
      if (c === -1) return `????????${DIFF_HIT_MARK}${rest}`;
      return `${rest.slice(0, c).slice(0, 8)}${DIFF_HIT_MARK}${rest.slice(c + 1)}`;
    });
  return { label, mode, hits, rc: r.status ?? 2, framing: "diff-prefixed" };
}

/**
 * PR A1 round 1 P2 語意 + PR A1.1 F1 實作:baseline..HEAD 的 per-commit diff scan。
 *
 * 語意(**與 A1 相同,本次未改**):
 *   只掃「每個 commit 相對 first parent 的 diff 新增行」,不掃整棵 tree ——
 *   未動的舊 blob(baseline 之前的去識別化 debt)不算新引入 → 不誤報;
 *   baseline 之後新加的 forbidden 即使後來又刪掉,per-commit 仍抓得到(洗白防線)。
 *
 * ⚠️ file:line attribution:hit 只帶 rev 前 8 碼 + 內容片段,沒有檔名與行號。
 *    這是 diff-scan 語意的已知限制(A1 就有,A1.1 未改),追蹤見 repo 內 ADR
 *    「去識別化掃描的 history baseline cutover」的〈已知限制〉一節。
 */
export function scanBaselineToHeadDiffs(
  root: string,
  nonCaFile: string | null,
  caFile: string | null,
  syntaxNonCaFile: string | null,
  baseline: string,
  opts: DiffScanOptions = {}
): Scan[] {
  const batchSize = opts.batchSize ?? PATCH_BATCH_SIZE;
  const marker = opts.marker ?? buildPatchMarker();
  const srcPrefix = opts.srcPrefix ?? PINNED_SRC_PREFIX;
  const dstPrefix = opts.dstPrefix ?? PINNED_DST_PREFIX;
  const probeBytes = opts.longLineProbeBytes ?? LONG_LINE_PROBE_BYTES;
  if (!Number.isInteger(probeBytes) || probeBytes < 1) {
    throw new Error(`longLineProbeBytes 必須是 ≥ 1 的整數(收到 ${String(probeBytes)})`);
  }
  const streamStats: DiffStreamStats = {
    peakPendingLineBytes: 0,
    droppedLongLines: 0,
  };

  const revs = execFileSync(
    "git",
    ["-C", root, "rev-list", `${baseline}..HEAD`],
    { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 }
  )
    .split("\n")
    .filter(Boolean);
  if (revs.length === 0) return [];

  const workDir = mkdtempSync(path.join(tmpdir(), "cnst-diff-"));
  const dirs: Record<BucketName, string> = {
    main: path.join(workDir, "main"),
    syntax: path.join(workDir, "syntax"),
  };
  mkdirSync(dirs.main, { recursive: true });
  mkdirSync(dirs.syntax, { recursive: true });
  const touched: Record<BucketName, Set<string>> = {
    main: new Set(),
    syntax: new Set(),
  };
  try {
    const ex = new Set(FULL_EXCLUDES.map(stripExcludeMagic));
    const syn = new Set(SYNTAX_EXEMPT_FILES);
    const streamPath = path.join(workDir, "stream");
    for (const batch of chunkRevs(revs, batchSize)) {
      runPatchProducerToFile(root, batch, marker, srcPrefix, dstPrefix, streamPath);
      consumeProducerFile(streamPath, batch, marker, ex, syn, dirs, touched, {
        probeBytes,
        stats: streamStats,
      });
      rmSync(streamPath, { force: true });
    }
    opts.onStreamStats?.(streamStats);
    const scans: Scan[] = [];
    if (nonCaFile) {
      scans.push(
        grepRevDir(
          dirs.main,
          touched.main.size,
          nonCaFile,
          "史 baseline..HEAD(non-CA diff)",
          "strict"
        )
      );
    }
    if (caFile) {
      scans.push(
        grepRevDir(
          dirs.main,
          touched.main.size,
          caFile,
          "史 baseline..HEAD(CA diff,self-PR 判定)",
          "self-pr"
        )
      );
    }
    if (syntaxNonCaFile) {
      scans.push(
        grepRevDir(
          dirs.syntax,
          touched.syntax.size,
          syntaxNonCaFile,
          "史 baseline..HEAD(SYNTAX 例外檔 non-CA diff)",
          "strict"
        )
      );
    }
    return scans;
  } catch (e) {
    // fail-closed:patch 提取 / 切段 / 路徑解析出錯一律回 scanner error(rc=2),
    // 由 processScan 印訊息並讓 main() exit 1。**不得**回空 scan 當乾淨。
    console.error(
      `❌ 史 baseline..HEAD:patch 提取失敗 — ${(e as Error).message}`
    );
    return [
      {
        label: "史 baseline..HEAD(patch 提取)",
        mode: "strict",
        hits: [],
        rc: 2,
        framing: "diff-prefixed",
      },
    ];
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function scanGitHistoryBlobs(
  root: string,
  nonCaFile: string | null,
  caFile: string | null,
  syntaxNonCaFile: string | null,
  baseline: string | null
): Scan[] {
  // PR A1 round 1 P2:baseline 給 → per-commit diff scan(scanRevDiff);
  // baseline null → tree scan(舊行為,見下方)
  if (baseline) {
    return scanBaselineToHeadDiffs(root, nonCaFile, caFile, syntaxNonCaFile, baseline);
  }
  const revListArgs = ["-C", root, "rev-list", "--all"];
  const revs = execFileSync("git", revListArgs, {
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
        framing: "grep-z" as const,
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
        framing: "grep-z" as const,
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
          framing: "grep-z" as const,
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
  // 🔴 Step 5 r3 CRITICAL。`git log` 的輸出編碼由 `i18n.logOutputEncoding` 決定,
  //    而這段掃描直接把輸出餵給 UTF-8 的 denylist pattern。設成 BIG5 / GBK 會讓
  //    denylist 的非 ASCII 條目全部對不上;設成 UTF-16 / UTF-32 連純 ASCII 條目
  //    也對不上 —— **整段 commit 訊息掃描歸零、exit 0**。`.git/config` 不受任何
  //    gate 掃描,也不需要改寫歷史。與 producer 的顏色 / textconv 釘法同一類。
  const log = execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "i18n.logOutputEncoding=UTF-8",
      "log",
      "--all",
      "--format=%H %an <%ae> %s %b",
    ],
    { encoding: "utf-8", maxBuffer: 512 * 1024 * 1024 }
  );
  // Step 5 adversarial finding 4 修法:對齊 scanRevDiff 用 `-a`,defense-in-depth
  //   一致(即使 git log --format=%s%b 實務上不會產出 NUL、可觸發性極低,兩處
  //   sink 都是 stdin-based grep、風險模型同樣)
  const r = spawnSync("grep", ["-naiE", "-f", allPatternFile], {
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
    // `grep -n` 產出 `<行號>:<內容>`,不是 NUL-framed;strict 模式不解析內容,
    // 顯示也維持原樣(R1 P1:framing 一律由產生端宣告,不從內容猜)。
    framing: "plain",
  };
}

// ───────────────────────────────────────── 處理單段掃描結果

/** 回傳 true = 該段通過(乾淨或全部放行);false = 有真實命中或掃描器錯誤。 */
export function processScan(scan: Scan, allowedPrs: Set<number>): boolean {
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
    for (const h of scan.hits) console.error(`  ${displayHit(h, scan.framing)}`);
    return false;
  }
  // mode === "self-pr":逐行走 self-PR 判定
  // 🔴 round 5 P2-1 + round 6 P2-3:用 parseGrepZLine 從 NUL-delimited 輸出
  // 拆出 content 部分,再交給判定——避免 filename 含 CA 字面時 extractor 從
  // filename 抽出未知號、讓合法 self-PR 引用被誤擋
  const real: string[] = [];
  const allowed: string[] = [];
  for (const raw of scan.hits) {
    // 🔴 R1 P1:content 依 **framing** 取,不從內容猜。diff hit 的 NUL 是資料,
    //    當成 grep -Z 檔名分隔符會把 NUL 前的未知 PR 引用整段丟掉 → 假放行。
    const content = hitContent(raw, scan.framing);
    if (isSelfPrReferenceLine(content, allowedPrs)) allowed.push(raw);
    else real.push(raw);
  }
  if (allowed.length > 0) {
    console.log(`  ↳ ${scan.label}:${allowed.length} 行 self-PR 引用放行`);
  }
  if (real.length > 0) {
    console.error(`❌ ${scan.label}:含未知 PR/pull 引用(非本 repo 已 merge)`);
    for (const h of real) console.error(`  ${displayHit(h, scan.framing)}`);
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

  // PR A1:載入 baseline config、決定 history scan 範圍(fail-closed on error)
  // Round 1 P1 + Round 2 P1a:baseline 決策三態(ok / template-fallback / fail)
  // template-fallback → 降級為「全史掃」(baseline=null)、不 skip history scan。
  // 洗白場景(A 加 forbidden + B 刪 forbidden 同一 PR)current tree/msg 都乾淨,
  // 只有全史掃才抓得到中間 blob。skip 語意違反此契約(round 2 P1a 抓到)。
  let baseline: string | null = null;
  let templateFallback = false;
  try {
    const rawBaseline = loadBaselineConfig(root).baseline;
    if (rawBaseline !== null) {
      const decision = validateBaseline(root, rawBaseline);
      if (decision.kind === "fail") {
        console.error(`❌ baseline 驗證失敗:${decision.reason}`);
        for (const c of cleanups) c();
        return 1;
      }
      if (decision.kind === "template-fallback") {
        console.warn(`⚠️  ${decision.reason}`);
        console.warn(
          `    → 降級為全史掃描(掃 downstream repo 全部 history,擋洗白場景)`
        );
        console.warn(
          `    → 建議:把 ${BASELINE_CONFIG_PATH} 的 sourceTermHistoryBaseline 改成本 repo 的 initial commit SHA(去掉 template: prefix,走嚴格 baseline..HEAD 語意)`
        );
        // baseline 保留 null → 走既有全史 tree scan(舊行為)
        templateFallback = true;
      } else {
        baseline = decision.sha;
      }
    }
  } catch (e) {
    console.error(`❌ baseline config 載入失敗:${(e as Error).message}`);
    for (const c of cleanups) c();
    return 1;
  }
  // Startup 印掃描範圍(plan §5「啟動時輸出掃描範圍」)
  if (templateFallback) {
    console.log(
      `── history scan range: --all(template-fallback,downstream fork 未建 baseline;downstream 建議改成 initial commit SHA)──`
    );
  } else if (baseline) {
    console.log(
      `── history scan range: baseline..HEAD(grandfather ≤ ${baseline.slice(0, 8)},見 ${BASELINE_CONFIG_PATH})──`
    );
  } else {
    console.log(
      `── history scan range: --all(no baseline configured,${BASELINE_CONFIG_PATH} 不存在或 baseline 為 null)──`
    );
  }

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

    console.log(
      baseline
        ? "── [2/3] git 歷史 blob 掃描(baseline..HEAD diff)──"
        : templateFallback
        ? "── [2/3] git 全史 blob 掃描(template-fallback)──"
        : "── [2/3] git 全史 blob 掃描 ──"
    );
    let histFail = false;
    for (const scan of scanGitHistoryBlobs(
      root,
      nonCaFile?.file ?? null,
      caFile?.file ?? null,
      syntaxNonCaFile?.file ?? null,
      baseline
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
