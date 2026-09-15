#!/usr/bin/env node
/**
 * scripts/check-progress-codex-review.ts — 阻止「跳過 Step 4 跨模型 review」
 *
 * 觸發:當前 branch(base..HEAD)有動 `.claude/memory/progress.md` → 檢查最上方
 * (最新)的 sprint entry 是否引用 Step 4 完成憑證(Codex 或 SOP 允許的 Claude 降級)。
 *
 * 為什麼:M4.5-A / M4.5-B 兩棒連續跳過 Step 4 跨模型 review(LESSONS 2026-09-14 /
 * 2026-09-15 已升級為重複錯誤)。人工提醒失效 → 需要機器化守門。
 *
 * 判準(fail-closed;Step 4 Codex R1 收 4 P1 修版):
 *   1. base..HEAD 沒動 progress.md → exit 0(no-op,本 PR 不是 sprint 收尾)
 *   2. 動了 progress.md:讀 HEAD 版最上方 entry 與 base 版最上方 entry 的 heading
 *      (即 `📅 YYYY-MM-DD ⓝ — 標題`)。若兩者相同 → **exit 2**(P1-2 修:本 sprint
 *      借用主線繼承的 entry、沒寫自己的憑證)
 *   3. 對本 sprint entry body 判斷:含以下**任一**組合 → exit 0
 *      (a) `^[>\-*\s]*docs-only\s+sprint\b`(行首 marker;P1-3 修:不再用 includes,
 *          避免「不是 docs-only sprint」誤命中)—— docs-only 例外
 *      (b) `^[>\-*\s]*無\s*code\s*改動\b`(同上 anchor)—— docs-only 同義例外
 *      (c) `Codex\s+round\s+\d+` **AND** 收斂 marker(P1-4 修:避免 timeout/失敗
 *          記錄誤過關)
 *      (d) `Claude\s+(?:\/)?code-review\s+round\s+\d+` **AND** 降級 marker
 *          (`無 Codex` / `降級 Claude` 之類)**AND** 收斂 marker(P1-1 修:SOP
 *          明講可降級 Claude /code-review,但需 entry 明講降級 + 收斂憑證)
 *   4. 都不含 → exit 2
 *
 *   收斂 marker(擇一):`no actionable findings` / `zero findings` /
 *     `0 findings` / `\b0\s*P1\b` / `收斂` / `final round.*0`
 *   降級 marker(擇一):`無\s*Codex` / `沒\s*Codex` / `降級.*Claude` /
 *     `Codex\s+(?:CLI\s+)?(?:未安裝|不可用|not\s+available)`
 *
 * v1 邊界(誠實揭露):
 *   - 純字串比對抓不到「entry 假裝有 Codex round + 假造收斂 marker」情境——
 *     human 惡意情境超出工具範圍。
 *   - 收斂 marker 用相對寬的措辭匹配,自然句 unlikely 誤中(hard to write "not 0 P1"
 *     naturally),但仍可能被主動繞過。
 *
 * Usage:
 *   npx tsx scripts/check-progress-codex-review.ts                  # base 預設 origin/main → main
 *   npx tsx scripts/check-progress-codex-review.ts --base=origin/develop
 *   npx tsx scripts/check-progress-codex-review.ts --root=<dir>     # 對指定 repo root(e2e fixture 用)
 *
 * Exit codes:
 *   0 = 過(diff 沒動 progress.md;或有 Step 4 憑證;或標 docs-only)
 *   2 = 判定不能 or 缺憑證(base 讀不到 / progress.md 讀不到 / 找不到 entry /
 *       entry heading 繼承 base / entry 缺 Codex round 且未標 docs-only 且沒合法
 *       Claude 降級路徑)
 *   刻意沒有 exit 1:對稱 check-cso-trigger.ts / check-adoption-readiness.ts,任何
 *   「無法判定」都當 fail-closed(2)。
 */

import { spawnSync } from "node:child_process";
import { detectInvocation, reportIfNotMain } from "./lib/invoked-as-main";

/**
 * 安全跑 git 子命令(R3 P2-2 shell injection 修)。
 * 純 argv 陣列,不透過 shell。回 { stdout, ok }。
 */
function gitRun(cwd: string, args: string[]): { stdout: string; ok: boolean } {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
  return { stdout: r.stdout ?? "", ok: r.status === 0 };
}

/**
 * 驗證 git ref 形狀(R3 P2-2):字母數字 + . _ / - + @ + {}(對 revision 語法)。
 * 拒絕 shell metacharacter($ ; ` | & > < * ? ! 空白等)。
 */
export function isSafeGitRef(ref: string): boolean {
  if (ref.length === 0 || ref.length > 256) return false;
  return /^[A-Za-z0-9._@/{}\-]+$/.test(ref);
}

// ───────────────────────────────────────── 純函式(給測試直接呼叫)

const CODEX_ROUND_RE = /Codex\s+round\s+\d+/i;
const CLAUDE_REVIEW_RE = /Claude\s+(?:\/)?code[\s-]?review\s+round\s+\d+/i;
// Step 5 CRITICAL 修:SOP L423 cost field template 是「跨模型 review N rounds」,
// entry 照模板寫時無「Codex round N」字樣、但確實有跑跨模型 review。加此 alt
// pattern 對齊 SSOT。仍需搭配收斂 marker 才能通過 judgeEntry。
const CROSSMODEL_ROUNDS_RE = /跨模型\s*review\s+\d+\s*rounds?/i;
// 降級 marker:entry 明講「無 Codex」/ 「降級 Claude」/ 「Codex CLI 未安裝」
const DEGRADATION_MARKER_RE = /(?:無|沒)\s*Codex|降級[^\n]*Claude|Codex(?:\s+CLI)?\s*(?:未安裝|不可用|not\s+available)/i;
// 收斂 marker:擇一即可
// R2 P2-1 修:「收斂」前若有否定詞則不算命中。
// R3 P1-2 修:數字前綴 lookbehind——避免 `10 findings` 被 `0 findings` 誤中、
//   `20 P1` 被 `0 P1` 誤中。
// R4 P1-3 修:更多否定詞(「無法」),`final round` 加 `\b0\b` 邊界、拒絕
//   「10 findings remain」在 final round 段落誤中。
const CONVERGENCE_RE = /no\s+actionable\s+findings?|zero\s+findings?|(?<!\d)0\s+(?:actionable\s+)?findings?|(?<!\d)0\s*P1(?!\d)|(?<!(?:未|尚未|未達|不|無法|no|not|yet\s+not)\s*)收斂|final\s+round[^\n]*(?<!\d)0(?!\d)/i;
// docs-only marker:行首 anchor(允許 markdown quote / list prefix)
// 註:不用 `\b`,因為 marker 尾為中文字時 JS regex `\b` 無邊界語意;行首 anchor
// 加明確 prefix 已足以避免自然句誤中(P1-3 修:「本 sprint 為 docs-only sprint」
// 前有「本 sprint 為」故不命中)。
const DOCS_ONLY_MARKER_RE = /^[>\-*\s]*docs-only\s+sprint/im;
const NO_CODE_MARKER_RE = /^[>\-*\s]*無\s*code\s*改動/im;
const PROGRESS_PATH = ".claude/memory/progress.md";

export type CheckResult =
  | { kind: "ok"; reason: "no-progress-change" | "docs-only" | "has-codex-round" | "has-claude-review-degradation"; matched?: string }
  | { kind: "fail"; reason: "no-entry" | "missing-codex-round" | "missing-convergence-marker" | "claude-review-without-degradation-marker" | "entry-inherited-from-base" | "read-failed" | "diff-failed"; detail?: string };

/**
 * 從 progress.md 內容抓「最上方一條真 sprint entry」的 body。
 *
 * 規則:
 *   - 只認第一個「不在 code fence 內」且以 `📅` 開頭的行
 *   - body 收到:下一個 `📅` 開頭行(不在 code fence 內) / `---` 分隔線 / EOF
 *   - Code fence 用 ``` 開頭切換狀態(對稱 GFM 慣例)
 *
 * 為什麼要處理 code fence:progress.md 上方 `## Entry 格式範本` 章節內有一個
 * ```markdown 區塊示範 entry 範本(含 `📅 YYYY-MM-DD ⓝ` placeholder)——不能
 * 被誤當成真 entry。
 */
export function extractLatestEntryBody(content: string): string | null {
  const lines = content.split("\n");
  let inFence = false;
  let entryStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line.startsWith("📅")) {
      entryStart = i;
      break;
    }
  }
  if (entryStart === -1) return null;

  const bodyLines: string[] = [lines[entryStart]];
  let inFenceBody = false;
  for (let i = entryStart + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      inFenceBody = !inFenceBody;
      bodyLines.push(line);
      continue;
    }
    if (!inFenceBody) {
      if (line.startsWith("📅")) break; // 下一條 entry
      if (line === "---") break; // 分隔線
    }
    bodyLines.push(line);
  }
  return bodyLines.join("\n");
}

/**
 * 抽取 entry 的 heading(第一行,如 `📅 2026-09-15 ⑮ — **標題**`)。
 * P1-2 修:用於比對 base vs HEAD 是否同一個 entry(避免借用主線繼承的 entry)。
 */
export function extractLatestEntryHeading(content: string): string | null {
  const lines = content.split("\n");
  let inFence = false;
  for (const line of lines) {
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line.startsWith("📅")) return line.trim();
  }
  return null;
}

/**
 * 抽取 content 內所有 entry body(R4 P1-2 修:對比 base 版**每個** entry、不只
 * top entry,擋「歸檔 base top、HEAD top 變成 base 第二條」的規避)。
 * 回傳一個 body string 陣列(按出現順序);同 extractLatestEntryBody 邏輯、逐次抽。
 */
export function extractAllEntryBodies(content: string): string[] {
  const lines = content.split("\n");
  const bodies: string[] = [];
  let inFence = false;
  let currentStart = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (line.startsWith("📅")) {
      // flush previous
      if (currentStart >= 0) {
        bodies.push(collectBody(lines, currentStart, i));
      }
      currentStart = i;
    } else if (currentStart >= 0 && line === "---") {
      bodies.push(collectBody(lines, currentStart, i));
      currentStart = -1;
    }
  }
  if (currentStart >= 0) {
    bodies.push(collectBody(lines, currentStart, lines.length));
  }
  return bodies;
}

function collectBody(lines: string[], start: number, end: number): string {
  const body: string[] = [];
  let inFence = false;
  for (let i = start; i < end; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      inFence = !inFence;
      body.push(line);
      continue;
    }
    if (!inFence && i > start && line.startsWith("📅")) break;
    if (!inFence && line === "---") break;
    body.push(line);
  }
  return body.join("\n");
}

/**
 * 判定 entry body 是否過關(Step 4 Codex R1 4 P1 修版)。
 * 純函式,不 touch fs / git。
 *
 * 判準順序:
 *   1. docs-only marker(行首 anchor)→ ok(P1-3 修)
 *   2. 無 code 改動 marker(行首 anchor)→ ok
 *   3. Codex round + 收斂 marker → ok(P1-4 修:光有 round 不夠)
 *   4. Claude review round + 降級 marker + 收斂 marker → ok(P1-1 修:接受 SOP
 *      允許的降級路徑,但需雙重宣告)
 *   5. 其他 → fail
 */
export function judgeEntry(body: string): CheckResult {
  // 1-2. docs-only 例外(行首 anchor,不再是 substring)
  if (DOCS_ONLY_MARKER_RE.test(body)) {
    return { kind: "ok", reason: "docs-only", matched: "docs-only sprint(行首 marker)" };
  }
  if (NO_CODE_MARKER_RE.test(body)) {
    return { kind: "ok", reason: "docs-only", matched: "無 code 改動(行首 marker)" };
  }

  const hasConvergence = CONVERGENCE_RE.test(body);
  const codexMatch = body.match(CODEX_ROUND_RE);

  // 3. Codex round + 收斂 marker
  if (codexMatch) {
    if (!hasConvergence) {
      return { kind: "fail", reason: "missing-convergence-marker", detail: `見 Codex round(${codexMatch[0]})但缺收斂 marker(no actionable findings / zero findings / 0 P1 / 收斂 之類)` };
    }
    return { kind: "ok", reason: "has-codex-round", matched: codexMatch[0] };
  }

  // 4. Claude review 降級路徑
  const claudeMatch = body.match(CLAUDE_REVIEW_RE);
  if (claudeMatch) {
    if (!DEGRADATION_MARKER_RE.test(body)) {
      return { kind: "fail", reason: "claude-review-without-degradation-marker", detail: `見 Claude review(${claudeMatch[0]})但缺降級 marker(entry 需明講「無 Codex」/「降級 Claude」/「Codex CLI 未安裝」之類)` };
    }
    if (!hasConvergence) {
      return { kind: "fail", reason: "missing-convergence-marker", detail: `見 Claude review 降級(${claudeMatch[0]})但缺收斂 marker` };
    }
    return { kind: "ok", reason: "has-claude-review-degradation", matched: claudeMatch[0] };
  }

  // 5. Step 5 CRITICAL 修:「跨模型 review N rounds」對齊 SOP L423 cost field
  // template。這是 SSOT 用詞——照模板寫的合法 entry 應該過關。
  const crossmodelMatch = body.match(CROSSMODEL_ROUNDS_RE);
  if (crossmodelMatch) {
    if (!hasConvergence) {
      return { kind: "fail", reason: "missing-convergence-marker", detail: `見「${crossmodelMatch[0]}」但缺收斂 marker` };
    }
    return { kind: "ok", reason: "has-codex-round", matched: crossmodelMatch[0] };
  }

  return { kind: "fail", reason: "missing-codex-round" };
}

// ───────────────────────────────────────── git 讀 diff(判定是否動 progress.md)

/**
 * base..HEAD 的 committed diff 是否含 progress.md。
 * run 可注入(測試用),預設 execSync。
 *
 * ⚠️ 不看 staged / unstaged / untracked——SOP Step 5 寫 entry 一定 commit 進
 * feature branch,progress.md 尚未 commit 的變更不在本 checker 判定範圍。
 * (對稱 check-cso-trigger.ts:那條要抓「編輯中的敏感檔」所以看完整變更面;
 * 本條要抓「commit 進來的 sprint 收尾 entry」所以只看 committed diff。)
 */
export function committedDiffTouchesProgress(base: string, cwd: string): boolean {
  const files = getChangedFiles(base, cwd);
  return files !== null && files.includes(PROGRESS_PATH);
}

/**
 * base..HEAD 的完整 committed 檔案清單。R3 P2-2:走 argv 陣列、非字串拼接。
 * R4 P2-1:git 失敗回 null(不再靜默轉空陣列),caller 判 null → fail-closed。
 */
export function getChangedFiles(base: string, cwd: string): string[] | null {
  const r = gitRun(cwd, ["diff", `${base}...HEAD`, "--name-only", "--no-renames"]);
  if (!r.ok) return null;
  return r.stdout.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

/**
 * base..HEAD 每個 commit 的訊息(subject + body)。用於 [trivial] marker 偵測。
 * R3 P1-3:trivial 例外通道——若任一 commit 訊息含 `[trivial]` marker,
 * 允許非 docs diff 沒動 progress.md 過關。
 * R5 P2-1:加 `--no-merges` 排除 GitHub `pull_request` 產生的合成 merge commit
 * (checkout 預設是 refs/pull/N/merge,無 [trivial] 的合成 commit 會讓 every()
 * 固定為 false、誤擋合法 trivial PR)。
 */
export function getCommitMessages(base: string, cwd: string): string[] {
  const r = gitRun(cwd, ["log", `${base}..HEAD`, "--no-merges", "--format=%B%x00"]);
  if (!r.ok) return [];
  return r.stdout.split("\0").map((m) => m.trim()).filter((m) => m.length > 0);
}

/**
 * 是否**每個** commit 訊息含 `[trivial]` marker(R4 P1-1 修:改 every,擋掉「先
 * 一個 [trivial] typo 再 commit 敏感碼」的漏洞)。
 * 空 messages 陣列 → false(無 commit 沒 override)。
 */
export function allCommitsHaveTrivialMarker(messages: string[]): boolean {
  if (messages.length === 0) return false;
  return messages.every((m) => /\[trivial\]/i.test(m));
}

/** 舊 API 保留(向後相容 tests),但實務用 allCommitsHaveTrivialMarker。 */
export function hasTrivialMarker(messages: string[]): boolean {
  return allCommitsHaveTrivialMarker(messages);
}

/**
 * Trivial marker override 的 super-sensitive path 拒絕清單(R4 P1-1 修、
 * R5 P1-1 補完 CLAUDE.md §4.5 明文禁區)。
 *
 * SOP 明講「碰 auth/CI/守門的單行修不算 trivial 例外」;CLAUDE.md §4.5「禁區清單」
 * 明列 `src/git/**`、`src/approval/**`、`scripts/check-cso-trigger.ts`、
 * `scripts/cso-trigger.config.ts`、`scripts/lib/destructive-guard.ts`、
 * `scripts/git-hooks/**`、`src/state.ts` 為動前必問的邊界。以此為機器化下限。
 */
const TRIVIAL_FORBIDDEN_PATTERNS: RegExp[] = [
  // SOP / auth / CI / 守門(既有)
  /^scripts\/git-hooks\//,
  /^scripts\/mutate\.ts$/,
  /^scripts\/lib\/destructive-guard/,
  /^\.github\/workflows\//,
  /^src\/.*\/auth/i,
  /^src\/.*security/i,
  /^prisma\/schema\.prisma$/,
  /(?:^|\/)\.env(?:\..*)?$/,
  /^\.claude\/settings/,
  /^CLAUDE\.md$/,
  /^\.claude\/sop\//,
  // R5 P1-1:CLAUDE.md §4.5 禁區清單明文
  /^src\/git\//,
  /^src\/approval\//,
  /^src\/state\.ts$/,
  /^scripts\/check-cso-trigger\.ts$/,
  /^scripts\/cso-trigger\.config\.ts$/,
  // Step 5 INF (k) 修:governance SSOT 檔案(對稱 check-baseline-governance 對
  // harness.config.json 的定位)
  /^scripts\/control-catalog\.json$/,
  /^docs\/CONTROL-CATALOG\.md$/,
  /^scripts\/harness\.config\.json$/,
];

export function isTrivialForbidden(files: string[]): boolean {
  return files.some((f) => TRIVIAL_FORBIDDEN_PATTERNS.some((p) => p.test(f)));
}

/**
 * 驗 base 是 HEAD 真祖先(R3 P2-1 修)。
 * 條件:base !== HEAD 對應 SHA;git merge-base --is-ancestor base HEAD 成功。
 */
export function isProperAncestor(base: string, cwd: string): boolean {
  // 拒 base === HEAD(空 diff)
  const baseSha = gitRun(cwd, ["rev-parse", "--verify", `${base}^{commit}`]);
  if (!baseSha.ok) return false;
  const headSha = gitRun(cwd, ["rev-parse", "--verify", "HEAD^{commit}"]);
  if (!headSha.ok) return false;
  if (baseSha.stdout.trim() === headSha.stdout.trim()) return false;
  const ancestorCheck = gitRun(cwd, ["merge-base", "--is-ancestor", base, "HEAD"]);
  return ancestorCheck.ok;
}

/**
 * 純 docs-only 檔的 **allowlist**(R3 P1-1 修:改 fail-closed allowlist)。
 * 只有 exact match(或 archive glob)的檔才算 docs-only;任何未列出的檔都當非 docs。
 * 對齊 SOP「判不準 = 當非文件」原則。
 *
 * 白名單(exact):
 *   - `README.md`(project readme,純散文)
 *   - `.claude/memory/progress.md`
 *   - `TODOS.md` / `BACKLOG.md` / `TODOS-done.md`(root)
 *   - `.claude/memory/TODOS.md` / `.claude/memory/BACKLOG.md` / `.claude/memory/TODOS-done.md`
 *
 * 白名單(prefix):
 *   - `.claude/memory/progress-archive/` 下的 `.md`(不進子目錄、basename 非 README.md)
 *   - `_handoffs/` 下的任何 `.md`(交接檔目錄,純散文)
 *
 * 誠實邊界:此 allowlist 是**下限**——每個 repo 可能有其他純散文檔(design docs、
 * ADRs、blog posts 等),此 checker 不涵蓋。SOP 對「意圖判斷」是上限。
 */
const DOCS_ALLOW_EXACT: ReadonlySet<string> = new Set([
  "README.md",
  ".claude/memory/progress.md",
  "TODOS.md",
  ".claude/memory/TODOS.md",
  "BACKLOG.md",
  ".claude/memory/BACKLOG.md",
  "TODOS-done.md",
  ".claude/memory/TODOS-done.md",
]);

const DOCS_ALLOW_PREFIXES: readonly string[] = [
  ".claude/memory/progress-archive/",
  "_handoffs/",
];

export function isDocsFile(file: string): boolean {
  if (DOCS_ALLOW_EXACT.has(file)) return true;
  for (const prefix of DOCS_ALLOW_PREFIXES) {
    if (!file.startsWith(prefix)) continue;
    const rest = file.slice(prefix.length);
    if (rest.length === 0) return false;
    // progress-archive 不進子目錄
    if (prefix === ".claude/memory/progress-archive/" && rest.includes("/")) return false;
    if (!rest.endsWith(".md")) return false;
    // 歸檔慣例文件 README.md 屬 governance,不算 docs
    if (rest.endsWith("README.md")) return false;
    return true;
  }
  return false;
}

/**
 * 判定 diff 是否 docs-only(所有檔都在 DOCS 白名單內)。
 * 空 diff → true。
 * R3 P1-1 修:改 fail-closed allowlist(原 blacklist 讓未知路徑意外過關)。
 */
export function isDocsOnlyDiff(files: string[]): boolean {
  return files.every((f) => isDocsFile(f));
}

/**
 * 讀 base 版 progress.md(用於 P1-2 entry-identity 比對)。
 * base 沒有 progress.md → 回 null(fresh repo / 檔案新加,不擋)。
 * R3 P2-2:改 argv 陣列、非字串拼接。
 */
export function readBaseProgressContent(base: string, cwd: string): string | null {
  const r = gitRun(cwd, ["show", `${base}:${PROGRESS_PATH}`]);
  return r.ok ? r.stdout : null;
}

/**
 * 解析 --base=<ref> / --base <ref> / --root=<dir> / --root <dir> argv。
 * R2 P1-1 修:CI wiring 用空白分隔形式(`--base "origin/main"`),parseArgs 必須支援。
 * 未知參數 fail-closed。
 */
export function parseArgs(argv: string[]): { base: string | null; root: string | null; ok: boolean; error?: string } {
  let base: string | null = null;
  let root: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--base=")) {
      base = a.slice("--base=".length);
    } else if (a === "--base") {
      const next = argv[i + 1];
      if (next === undefined) return { base, root, ok: false, error: "--base 缺 value" };
      base = next;
      i++;
    } else if (a.startsWith("--root=")) {
      root = a.slice("--root=".length);
    } else if (a === "--root") {
      const next = argv[i + 1];
      if (next === undefined) return { base, root, ok: false, error: "--root 缺 value" };
      root = next;
      i++;
    } else {
      return { base, root, ok: false, error: `未知參數:${a}` };
    }
  }
  return { base, root, ok: true };
}

/**
 * 決定要用哪個 base ref。優先 --base;否則試 origin/main → main。
 * 找不到 → null(caller fail-closed)。
 * R3 P2-2:走 argv 陣列 + isSafeGitRef 拒不合法 ref(shell 安全)。
 * R3 P2-1(部分):resolveBase 只驗 ref 可解析;是否為真祖先由 isProperAncestor 另驗。
 */
export function resolveBase(argBase: string | null, cwd: string): string | null {
  const candidates = argBase ? [argBase] : ["origin/main", "main"];
  for (const c of candidates) {
    if (!isSafeGitRef(c)) continue;
    const r = gitRun(cwd, ["rev-parse", "--verify", `${c}^{commit}`]);
    if (r.ok) return c;
  }
  return null;
}

// ───────────────────────────────────────── main

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    console.error(`✗ ${parsed.error}`);
    console.error("  用法:npx tsx scripts/check-progress-codex-review.ts [--base=<ref>] [--root=<dir>]");
    return 2;
  }

  const cwd = parsed.root ?? (() => {
    const r = gitRun(process.cwd(), ["rev-parse", "--show-toplevel"]);
    return r.ok ? r.stdout.trim() : process.cwd();
  })();

  // 1. 決定 base + 驗 shell 安全
  if (parsed.base !== null && !isSafeGitRef(parsed.base)) {
    console.error(`✗ --base 值包含不合法字元(shell 安全):${parsed.base}`);
    console.error("  → 允許字元:字母 / 數字 / . _ / - @ { }");
    return 2;
  }
  const base = resolveBase(parsed.base, cwd);
  if (base === null) {
    console.error(`✗ 找不到 base ref(試過:${parsed.base ?? "origin/main, main"})`);
    console.error("  → 傳 --base=<ref> 明講,或先 git fetch origin");
    return 2;
  }

  // R3 P2-1:驗 base 是 HEAD 真祖先(拒 --base=HEAD、拒 base 對應 SHA === HEAD SHA)
  if (!isProperAncestor(base, cwd)) {
    console.error(`✗ base(${base})不是 HEAD 的真祖先(可能 base === HEAD 或分岔)`);
    console.error("  → base 需為 HEAD 的祖先(通常是主線 tip);--base=HEAD 或已合併 branch 不算");
    return 2;
  }

  // 2. 取 diff 檔清單 + 判 docs-only + hasProgress + trivial marker
  // R4 P2-1:getChangedFiles 失敗回 null → fail-closed
  const files = getChangedFiles(base, cwd);
  if (files === null) {
    console.error(`✗ 讀 git diff 失敗(base=${base})→ fail-closed`);
    return 2;
  }
  const hasProgress = files.includes(PROGRESS_PATH);
  const diffIsDocs = isDocsOnlyDiff(files);
  const commitMessages = getCommitMessages(base, cwd);
  // R4 P1-1:trivial override 收窄:每個 commit 都要含 [trivial],且 diff 不含
  // super-sensitive 檔
  const allTrivial = allCommitsHaveTrivialMarker(commitMessages);
  const trivialForbidden = isTrivialForbidden(files);
  const trivialOverride = allTrivial && !trivialForbidden;

  // 3. R2 P1-2:diff 沒動 progress.md
  if (!hasProgress) {
    if (diffIsDocs) {
      console.log(`✅ diff(${files.length} 檔)全為 docs-only 檔且沒動 ${PROGRESS_PATH} → no-op(非 sprint 收尾 PR)`);
      return 0;
    }
    // R3 P1-3 / R4 P1-1:trivial 例外通道(收窄)
    if (trivialOverride) {
      console.log(`✅ diff 含非 docs 檔且沒動 ${PROGRESS_PATH},但每個 commit 訊息都含 [trivial] marker 且無 super-sensitive 檔 → SOP trivial 例外通道`);
      console.log("  ⚠️ [trivial] 例外通道使用宣告責任在 Owner / Reviewer:核實此 PR 是否真符合 SOP trivial 判準");
      return 0;
    }
    console.error(`\n🔴 diff 動了非 docs 檔但沒動 ${PROGRESS_PATH}(SOP Step 5 明講 sprint 收尾要寫 entry)`);
    console.error(`  不在 DOCS 白名單的檔:`);
    for (const f of files) {
      if (!isDocsFile(f)) console.error(`    ${f}`);
    }
    if (allTrivial && trivialForbidden) {
      console.error(`  ⚠️ 所有 commit 都含 [trivial] 但 diff 含 super-sensitive 檔(auth / CI / 守門 / SOP / settings 等)——SOP 明講此類單行修不算 trivial 例外`);
    } else if (commitMessages.some((m) => /\[trivial\]/i.test(m)) && !allTrivial) {
      console.error(`  ⚠️ 有 commit 含 [trivial] 但非全部;R4 P1-1 修:每個 commit 都要含 [trivial] 才能 override`);
    }
    console.error("  → 若本 sprint 屬完整 SOP,回頭寫 progress entry 進 feature branch 最後 commit");
    console.error("  → 若真是 typo / 單行修 / 純格式(SOP 例外),每個 commit 訊息都加 `[trivial]` marker,且 diff 不能含 super-sensitive 檔");
    return 2;
  }

  // 4. progress.md 有動:R4 P2-2 修 —— 讀 HEAD blob(committed 版)而非 workspace,
  // 避免本地未 commit 的 marker 被誤讀成憑證。
  const headBlob = gitRun(cwd, ["show", `HEAD:${PROGRESS_PATH}`]);
  if (!headBlob.ok) {
    console.error(`✗ 讀不到 HEAD 版 ${PROGRESS_PATH}(git show HEAD:${PROGRESS_PATH} 失敗)`);
    return 2;
  }
  const content = headBlob.stdout;

  const body = extractLatestEntryBody(content);
  if (body === null) {
    console.error(`✗ ${PROGRESS_PATH} 內找不到任何 📅 開頭的 sprint entry`);
    console.error("  → SOP Step 5 明講 progress entry 要寫進 feature branch 最後一個 commit");
    return 2;
  }

  // 5. R2 P2-2 / R4 P1-2:base 版**所有** entry bodies vs HEAD 版 top entry body
  // R4 P1-2 修:不只比對 top,擋「歸檔 base top、HEAD top 變成 base 第二條」的情境
  // 誠實邊界:body 只改 typo 仍過關(改 typo 讓 body != base 任一)——human
  //   惡意情境超出工具範圍。
  const baseContent = readBaseProgressContent(base, cwd);
  if (baseContent !== null) {
    const baseBodies = extractAllEntryBodies(baseContent);
    const inheritedIdx = baseBodies.findIndex((b) => b === body);
    if (inheritedIdx >= 0) {
      const headHeading = extractLatestEntryHeading(content) ?? "(無 heading)";
      console.error(`\n🔴 top entry body 與 base(${base})版第 ${inheritedIdx + 1} 條 entry 完全相同 → 繼承自主線、本 sprint 沒寫自己的 entry`);
      console.error(`  heading:${headHeading}`);
      console.error("  → SOP Step 5 明講:每 sprint 收尾都要把自己的 entry 寫進 feature branch 最後 commit");
      return 2;
    }
  }

  // 6. 判斷 entry
  const verdict = judgeEntry(body);
  const bodyPreview = body.split("\n").slice(0, 3).join("\n");

  // R2 P1-3:entry 標 docs-only,但 diff 含非 docs 檔 → mixed PR 不允許
  if (verdict.kind === "ok" && verdict.reason === "docs-only" && !diffIsDocs) {
    console.error(`\n🔴 entry 標 docs-only marker,但 diff 含非 docs 檔:`);
    for (const f of files) {
      if (!isDocsFile(f)) console.error(`    ${f}`);
    }
    console.error("  → SOP 明講:mixed PR(含 code / scripts / CI / 治理檔)一律跑完整 SOP,不算 docs-only");
    return 2;
  }

  if (verdict.kind === "ok") {
    if (verdict.reason === "docs-only") {
      console.log(`✅ entry 標 docs-only(matched:「${verdict.matched}」)→ 免驗 Step 4 憑證`);
    } else if (verdict.reason === "has-codex-round") {
      console.log(`✅ entry 含 Codex round + 收斂 marker(matched:「${verdict.matched}」)`);
    } else if (verdict.reason === "has-claude-review-degradation") {
      console.log(`✅ entry 走 SOP 允許的 Claude 降級路徑(matched:「${verdict.matched}」),含降級 marker + 收斂 marker`);
    }
    console.log(`\n最新 entry 前 3 行:\n${bodyPreview}`);
    return 0;
  }

  console.error(`\n🔴 最新 progress entry 缺 Step 4 完成憑證 — reason: ${verdict.reason}`);
  if (verdict.detail) console.error(`  detail:${verdict.detail}`);
  console.error(`\nentry 前 3 行:\n${bodyPreview}\n`);
  console.error("  接受的憑證組合(擇一):");
  console.error("    (a) 行首 `docs-only sprint` marker(整行以此開頭,允許 `>` `-` `*` prefix)");
  console.error("    (b) 行首 `無 code 改動` marker(同上 anchor)");
  console.error("    (c) `Codex round N` + 收斂 marker(`no actionable findings` / `zero findings` / `0 P1` / `收斂` / 等)");
  console.error("    (d) `Claude /code-review round N` + 降級 marker(`無 Codex` / `降級 Claude` / 等)+ 收斂 marker");
  console.error("  → SOP Step 4 明講:跨模型 review 是完成憑證(預設 Codex、無 Codex 環境可降級 Claude /code-review)");
  console.error("  → 參考 LESSONS 2026-09-14 / 2026-09-15「跳過 Step 4 跨模型 review」的重複錯誤");
  return 2;
}

const outcome = detectInvocation(import.meta.url, process.argv[1]);
const isMain = reportIfNotMain(outcome, "check-progress-codex-review");
if (isMain) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`✗ 未預期例外:${(e as Error)?.stack ?? String(e)}`);
      process.exit(2);
    });
} else if (outcome.kind === "indeterminate") {
  process.exit(2);
}
