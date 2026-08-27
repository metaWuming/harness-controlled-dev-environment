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

// ───────────────────────────────────────── constants

const DENY_SRC = "scripts/deny-terms.txt";
const FULL_EXCLUDES = [
  ":!scripts/deny-terms.txt",
  ":!package-lock.json",
  ":!scripts/check-todos-markers.ts",
  ":!tests/check-todos-markers.test.ts",
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
 * ⚠️ 沒有右 `\b` 邊界(round 2 P1-2 修法):
 *    CA grep 用寬鬆 pattern(deny-terms.txt 的兩條 CA 條目只要求「PR 井號 一位
 *    數字」開頭)。若 extractor 加右 `\b` 邊界,「未知 PR 號 typo(如尾綴接
 *    字母)+ 合法 self-PR 號」同行時,extractor 只抽合法號 → 若該號 ∈ allowedPrs
 *    整行被誤放行、typo 洩露漏抓。修法:extractor 抽首個數字序列(不管尾綴),
 *    讓「grep 命中」與「extractor 抽出」對齊。
 *
 * 邊界:
 *   PR 井號 + 30 後接字母 → 抽出 30(判 self-PR:若 30 ∈ allowedPrs 則放行)
 *   同行未知號 typo + 合法 self-PR 號(如 allowed={7})→ 兩個號都抽出,
 *     未知號 ∉ allowed → 擋
 *   純字面「PR 井號 中括號 0-9 中括號」(deny-terms.txt pattern 表達式本身)
 *     → 不 match,回空
 */
export function extractPrRefsFromLine(line: string): number[] {
  const refs: number[] = [];
  const patterns = [/\bPR\s+#(\d+)/gi, /\bpull\/(\d+)/gi];
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

function loadAllowedPrs(root: string): Set<number> {
  const refs = buildDeliveryRefs(root);
  if (refs.length === 0) return new Set();
  const out = execFileSync(
    "git",
    ["-C", root, "log", ...refs, "--format=%s"],
    { encoding: "utf-8", maxBuffer: 512 * 1024 * 1024 }
  );
  return parseAllowedPrs(out);
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
  const r = spawnSync("git", ["-C", root, "grep", ...args], {
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
    for (const h of scan.hits) console.error(`  ${h}`);
    return false;
  }
  // mode === "self-pr":逐行走 self-PR 判定
  const real: string[] = [];
  const allowed: string[] = [];
  for (const line of scan.hits) {
    if (isSelfPrReferenceLine(line, allowedPrs)) allowed.push(line);
    else real.push(line);
  }
  if (allowed.length > 0) {
    console.log(`  ↳ ${scan.label}:${allowed.length} 行 self-PR 引用放行`);
  }
  if (real.length > 0) {
    console.error(`❌ ${scan.label}:含未知 PR/pull 引用(非本 repo 已 merge)`);
    for (const h of real) console.error(`  ${h}`);
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

  const allowedPrs = loadAllowedPrs(root);
  console.log(
    `── allowedPrs: ${allowedPrs.size} 個本 repo 已 merge PR 號被納入放行清單 ──`
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
