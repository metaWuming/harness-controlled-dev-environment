// @vitest-environment node
//
// `scripts/check-no-source-terms.ts` 的守門測試——去識別化 denylist 加上下文
// 感知例外(context-aware)。
//
// 🔴 為什麼一定要有端到端幾條:context-aware 判定是「兩層檢查合流」——
//    grep 掃出 hit → 純函式判 self-PR 引用。純函式測完只能證半條路;整條路
//    要靠拋棄式 repo:建 commit(讓 allowedPrs 有東西)、建 working tree 檔案
//    (讓掃描找得到 hit),跑真腳本看 exit code。
//
// 🔴 為什麼把 checker 搬進拋棄式 repo:checker 內用 `git rev-parse --show-toplevel`
//    找 repo root,又讀 `scripts/deny-terms.txt` 與 `git log --all` 取 allowedPrs。
//    對真 repo 跑,輸入就是它自己,測試會互相污染;拋棄式 repo 讓「allowedPrs
//    有指定號碼 / working tree 引用指定號碼」都由測試自己決定。
//
// 🔴 為什麼 fixture 字面用 concat 拆碎(round 1 Codex P1-2 fix):
//    non-CA denylist term(如來源專案名)若直接以完整字面出現在本測試檔 source,
//    (a) checker 掃 working tree / 全史 blob 會 self-block,(b) 就算加 FULL_EXCLUDES
//    豁免,那些識別詞仍會永久留在 repo history 內——違反「去識別化」設計本意。
//    拆成 `"acti" + "va"` 的兩個字面後,repo blob 只含拆碎字串、grep -E 不會
//    match 到完整詞。同樣理由拆 `"PR " + "#999"` 這種 CA 反例引用。
//    FULL_EXCLUDES 也把本檔加入(見 checker constants)作雙重防護。

import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  stripCommentsAndBlanks,
  parseAllowedPrs,
  extractPrRefsFromLine,
  isSelfPrReferenceLine,
  partitionPatterns,
  parseGrepZLine,
  displayGrepHit,
  findDriftedCaPatterns,
  extractAddedLinesFromPatch,
  // PR A1.1 F1
  FULL_EXCLUDES,
  SYNTAX_EXEMPT_FILES,
  stripExcludeMagic,
  decodeGitCQuote,
  parsePatchDstPath,
  extractAddedLinesByPath,
  bucketAddedLines,
  splitPatchStream,
  scanBaselineToHeadDiffs,
  processScan,
  // Codex round 1 P1
  DIFF_HIT_MARK,
  hitContent,
  // Codex round 2 P2-1
  canDropLongPatchLine,
  newPatchLineState,
  type DiffStreamStats,
} from "../scripts/check-no-source-terms";

const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
}).trim();
const SCRIPT = join(REPO_ROOT, "scripts/check-no-source-terms.ts");
// 🔴 直接 tsx binary path 繞開 `npx` 冷啟(跟 mutate.test.ts 同理),
//    避免 e2e 撞 60s test timeout。
const TSX_BIN = join(REPO_ROOT, "node_modules/.bin/tsx");

// 拆碎字面:避免 source 內出現完整識別詞或完整 CA hit(見檔頭第 3 段說明)
const FRAG_ACTI = "acti" + "va";
const FRAG_WUM = "wu" + "ming";
const FRAG_OPX = "OPEN" + "TIX";
const PREF_PR = "PR " + "#";
const PREF_PULL = "pull" + "/";

const created: string[] = [];
afterEach(() => {
  while (created.length) rmSync(created.pop()!, { recursive: true, force: true });
});

// ───────────────────────────────────────── 純函式(單元測試)

describe("stripCommentsAndBlanks — pattern 檔行過濾", () => {
  it("去掉井號註解與空行,保留其他 pattern", () => {
    const text = "# comment\n\npattern1\npattern2\n# another\npattern3\n";
    expect(stripCommentsAndBlanks(text)).toEqual([
      "pattern1",
      "pattern2",
      "pattern3",
    ]);
  });

  it("🔴 round 2 P2-4 fix:pattern 內容原樣保留,不 trim 前後空白", () => {
    // shell 版與 commit-msg hook 都用 `grep -vE '^[[:space:]]*(#|$)'` 過濾,
    // pattern 值原樣保留(例:某條 denylist pattern 含尾空白時,grep -E 要
    // 求該空白;trim 掉就變成無空白版本 → CI 與 hook 對齊會漂)
    const text = "  padded_pattern  \n";
    expect(stripCommentsAndBlanks(text)).toEqual(["  padded_pattern  "]);
  });

  it("全註解 / 全空 → 空陣列", () => {
    expect(stripCommentsAndBlanks("# a\n#b\n\n")).toEqual([]);
    expect(stripCommentsAndBlanks("")).toEqual([]);
  });
});

describe("parseAllowedPrs — 從 git log subject 抽 self-PR 號集合", () => {
  it("squash 尾綴被抽到", () => {
    const subjects = "功能: 加了東西 (#30)\n修復: fix (#31)\n";
    const set = parseAllowedPrs(subjects);
    expect(set.has(30)).toBe(true);
    expect(set.has(31)).toBe(true);
    expect(set.size).toBe(2);
  });

  it("Merge pull request 訊息開頭被抽到", () => {
    const subjects = "Merge pull request #42 from user/branch\n";
    const set = parseAllowedPrs(subjects);
    expect(set.has(42)).toBe(true);
  });

  it("🔴 round 1 P2-3 fix:subject 中間的 (井號+N) 不被算入(不是 squash 尾綴)", () => {
    // canonical squash marker 只出現在 subject 尾;subject 中間寫「(井號+7)」
    // 通常是引用另一個 PR、不代表本 commit 就是 PR 7 的 merge
    const subjects = "投資 (#7) 的工作 continued\nfix note about (#8) earlier\n";
    const set = parseAllowedPrs(subjects);
    expect(set.size).toBe(0);
  });

  it("🔴 body(如果誤傳)不被算入:parseAllowedPrs 只掃 subject 每一行", () => {
    // 呼叫端(loadAllowedPrs)用 --format=%s 只給 subject。這個測試守著契約:
    // 就算 subjectsOnly 內有多行,每行都只當一個 subject 判定(尾綴或開頭)
    const looseInput = "some subject text\nnested (#777) mention\n";
    expect(parseAllowedPrs(looseInput).size).toBe(0);
  });

  it("空 subject 序列 → 空 set", () => {
    expect(parseAllowedPrs("").size).toBe(0);
  });

  it("混合 squash 與 merge subject,去重", () => {
    const subjects =
      "feat (#5)\nfix (#5)\nMerge pull request #5 from x\nother (#7)\n";
    const set = parseAllowedPrs(subjects);
    expect(Array.from(set).sort((a, b) => a - b)).toEqual([5, 7]);
  });

  it("極大數字(超過 1e9)被拒", () => {
    expect(parseAllowedPrs("feat (#9999999999)\n").size).toBe(0);
  });
});

describe("extractPrRefsFromLine — hit line 抽 PR 引用", () => {
  it("正常 PR 引用被抽", () => {
    expect(extractPrRefsFromLine("see " + PREF_PR + "30 for detail")).toEqual([30]);
  });

  it("pull/N 被抽", () => {
    expect(
      extractPrRefsFromLine("github.com/foo/bar/" + PREF_PULL + "42/files")
    ).toEqual([42]);
  });

  it("同行多個引用都被抽", () => {
    expect(
      extractPrRefsFromLine(
        "compare " + PREF_PR + "10 with " + PREF_PR + "20 and " + PREF_PULL + "30"
      )
    ).toEqual([10, 20, 30]);
  });

  it("純字面 pattern 值(左方括號 + 0-9 + 右方括號)→ 不 match,回空", () => {
    // 這是 checker 本身的 CONTEXT_AWARE_PATTERNS 常數字面——「[」不是數字
    expect(extractPrRefsFromLine('const p = "' + PREF_PR + '[0-9]"')).toEqual([]);
  });

  it("🔴 round 2 P1-2 fix:數字後直接接字母(30day)→ 抽出前綴數字 30", () => {
    // 舊版有右 `\b` 邊界會回空,但 CA grep pattern `PR 井號+[0-9]` 只要求首個
    // 數字、對 `30day` 仍會命中;extractor 若抽不出來,會讓合法+未知混合行被
    // 誤放行(見下方 round 2 P1-2 反例)。修法:extractor 抽首個數字序列。
    expect(extractPrRefsFromLine(PREF_PR + "30day is a typo")).toEqual([30]);
  });

  it("🔴 round 2 P1-2 反例:合法 + 未知混合(999day + 7)→ 抽 [999, 7]", () => {
    // 若 extractor 只抽 7,而 7 ∈ allowedPrs → 誤放行整行(999 洩露漏抓)。
    // 修法後兩個都被抽,判 self-PR 時 999 ∉ allowedPrs → 擋
    expect(
      extractPrRefsFromLine(PREF_PR + "999day plus " + PREF_PR + "7")
    ).toEqual([999, 7]);
  });

  it("🔴 round 4 P2-2 反例:左邊界前綴(xPR #999 plus PR #7)→ 抽 [999, 7]", () => {
    // 舊版有左 `\b`,「xPR #999」不 match(因為 `x` 前綴)→ 只抽 7 → 未知 999
    // 漏抓。extractor 精確對齊 CA grep pattern(無左右邊界)後兩個都抽
    expect(
      extractPrRefsFromLine("x" + PREF_PR + "999 plus " + PREF_PR + "7")
    ).toEqual([999, 7]);
  });

  it("🔴 round 4 P2-2 對齊:tab 分隔不 match(grep pattern 用字面空格)", () => {
    // CA grep pattern deny-terms.txt 用字面空格,tab / 多空白不 match;
    // extractor 用 `\s+` 會抽 grep 沒命中的 → 過度抽取。修法後用字面空格對齊
    expect(extractPrRefsFromLine("PR\t#7 with tab")).toEqual([]);
  });

  it("小寫 pr 井號 N 也 match(case-insensitive)", () => {
    expect(extractPrRefsFromLine("see pr " + "#15 too")).toEqual([15]);
  });
});

describe("isSelfPrReferenceLine — CA-scan hit 的 self-PR 判定", () => {
  const allowed = new Set<number>([30, 31]);

  it("引用已 merge 的 self-PR → 放行", () => {
    expect(isSelfPrReferenceLine("see " + PREF_PR + "30", allowed)).toBe(true);
    expect(
      isSelfPrReferenceLine("compare " + PREF_PULL + "31 with others", allowed)
    ).toBe(true);
  });

  it("引用未知 PR 號 → 擋", () => {
    expect(isSelfPrReferenceLine(PREF_PR + "999999", allowed)).toBe(false);
  });

  it("行內混合 self + unknown PR → 擋(全數必須 ∈ allowedPrs)", () => {
    expect(
      isSelfPrReferenceLine(PREF_PR + "30 and " + PREF_PR + "999", allowed)
    ).toBe(false);
  });

  it("🔴 round 2 P1-2 反例整合:同行未知號 typo + 合法 self-PR 號 → 擋", () => {
    // extractor 修法後兩個號都抽出 → refs=[999, 30] → 999 ∉ allowed → 擋
    // 修法前 extractor `\b` 會漏 999 → refs=[30] → every ∈ {30, 31} → 假放行
    expect(
      isSelfPrReferenceLine(
        PREF_PR + "999day plus " + PREF_PR + "30",
        allowed
      )
    ).toBe(false);
  });

  it("抽不到 PR 號(fail-safe)→ 擋", () => {
    // CA-scan 的 hit 理論上一定有數字;若構造一個沒 digit 的邊界輸入,
    // isSelfPrReferenceLine 依 fail-safe 契約回 false
    expect(isSelfPrReferenceLine(PREF_PR + "X", allowed)).toBe(false);
  });
});

describe("parseGrepZLine — 解 git grep -z NUL 分隔輸出(round 6 P2-3;R1 延伸修正)", () => {
  // 🔴 **格式更正**:實測 git 2.50.1 的 `git grep -z -n` 輸出是**兩個 NUL**——
  //    `path<NUL>行號<NUL>內容`(history 掃是 `rev:path<NUL>行號<NUL>內容`)。
  //    原本這幾條 fixture 寫成 `path<NUL>行號:內容`、parser 也用**第一個冒號**切,
  //    那個假設在真實輸出下會把「內容裡第一個冒號之前的部分」整段丟掉 → 未知 PR
  //    引用消失 → 假放行。fixture 一起改成真實格式(見下方 R1P1-e 的可達負對照)。
  const NUL1 = String.fromCharCode(0);

  it("working tree 掃:path NUL 行號 NUL 內容 → 拆對", () => {
    const raw = "docs/note.md" + NUL1 + "5" + NUL1 + "see " + PREF_PR + "7";
    expect(parseGrepZLine(raw)).toEqual({
      path: "docs/note.md",
      line: "5",
      content: "see " + PREF_PR + "7",
    });
  });

  it("history 掃:rev:path NUL 行號 NUL 內容 → 拆對", () => {
    const raw = "abc1234:docs/note.md" + NUL1 + "5" + NUL1 + "some content";
    expect(parseGrepZLine(raw)).toEqual({
      path: "abc1234:docs/note.md",
      line: "5",
      content: "some content",
    });
  });

  it("🔴 round 6 P2-3 反例:filename 含 `:數字:` sub-path → 正確拆到 NUL", () => {
    const raw =
      "docs/meta:12:" + PREF_PR + "999 notes.md" + NUL1 + "5" + NUL1 +
      "see " + PREF_PR + "7 legit";
    const parsed = parseGrepZLine(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.path).toBe("docs/meta:12:" + PREF_PR + "999 notes.md");
    expect(parsed!.content).toBe("see " + PREF_PR + "7 legit");
    expect(extractPrRefsFromLine(parsed!.content)).toEqual([7]);
  });

  it("🔴 R1 延伸:內容含冒號時,冒號前的未知引用不得被丟掉", () => {
    const raw =
      "docs/note.md" + NUL1 + "5" + NUL1 +
      PREF_PR + "999 ref: also " + PREF_PR + "40";
    const parsed = parseGrepZLine(raw);
    expect(parsed).not.toBeNull();
    expect(
      extractPrRefsFromLine(parsed!.content),
      "用第一個冒號切會只剩 40,未知的 999 消失 → 假放行"
    ).toEqual([999, 40]);
    expect(isSelfPrReferenceLine(parsed!.content, new Set([40]))).toBe(false);
  });

  it("🔴 R1 延伸:只有一個 NUL(格式與預期不符)→ 保守保留整段內容,不猜行號邊界", () => {
    const raw = "docs/note.md" + NUL1 + "5:" + PREF_PR + "999 and " + PREF_PR + "40";
    const parsed = parseGrepZLine(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.content).toContain("999");
    expect(isSelfPrReferenceLine(parsed!.content, new Set([40]))).toBe(false);
  });

  it("格式異常(無 NUL)→ 回 null", () => {
    expect(parseGrepZLine("no null here")).toBeNull();
  });

  it("displayGrepHit:parseable 轉 human-readable path:line:content", () => {
    const raw = "docs/note.md" + NUL1 + "5" + NUL1 + "see " + PREF_PR + "7";
    expect(displayGrepHit(raw)).toBe("docs/note.md:5:see " + PREF_PR + "7");
  });

  it("displayGrepHit:格式異常 → 回原文", () => {
    expect(displayGrepHit("no null here")).toBe("no null here");
  });
});

describe("findDriftedCaPatterns — CA 常數 vs denylist 漂移守門(Step 5 F1)", () => {
  it("CA 常數全在 denylist → 空(對齊)", () => {
    const all = ["forbid_a", "PR " + "#[0-9]", PREF_PULL + "[0-9]", "forbid_b"];
    const ca = ["PR " + "#[0-9]", PREF_PULL + "[0-9]"];
    expect(findDriftedCaPatterns(all, ca)).toEqual([]);
  });

  it("🔴 CA 條目被改字面(尾空白)→ 挑出漂移項", () => {
    const all = ["PR " + "#[0-9] "]; // 尾空白版
    const ca = ["PR " + "#[0-9]"]; // 原版硬碼
    expect(findDriftedCaPatterns(all, ca)).toEqual(["PR " + "#[0-9]"]);
  });

  it("🔴 CA 條目被刪掉 → 全部挑出", () => {
    const all = ["forbid_a"];
    const ca = ["PR " + "#[0-9]", PREF_PULL + "[0-9]"];
    expect(findDriftedCaPatterns(all, ca).length).toBe(2);
  });
});

describe("extractAddedLinesFromPatch — round 2 P1b hunk 解析(strip 一個 + 標記)", () => {
  it("hunk 內 `+foo` → 新增內容 `foo`(strip 一個 `+`)", () => {
    const patch = [
      "diff --git a/x b/x",
      "index 111..222 100644",
      "--- a/x",
      "+++ b/x",
      "@@ -1 +1 @@",
      "+foo",
    ].join("\n");
    expect(extractAddedLinesFromPatch(patch)).toBe("foo");
  });

  it("🔴 P1b:內容真的以 `++` 開頭(patch 行為 `+++foo`)不被誤當檔頭丟", () => {
    const patch = [
      "diff --git a/x b/x",
      "@@ -1 +1 @@",
      "+++foo", // 內容是 `++foo`,strip 一個 `+` → `++foo`
    ].join("\n");
    expect(extractAddedLinesFromPatch(patch)).toBe("++foo");
  });

  it("🔴 P1b:檔頭 `+++ b/path` 出現在 `@@` 之前 → 不採", () => {
    const patch = [
      "diff --git a/x b/x",
      "index 111..222 100644",
      "--- a/x",
      "+++ b/x", // 檔頭,不採
      "@@ -1 +1 @@",
      "+real content",
    ].join("\n");
    expect(extractAddedLinesFromPatch(patch)).toBe("real content");
  });

  it("🔴 P1b:hunk 間切換(第二 hunk 的 `+++ b/y` 檔頭仍不採)", () => {
    const patch = [
      "diff --git a/x b/x",
      "@@ -1 +1 @@",
      "+first",
      "diff --git a/y b/y",
      "--- a/y",
      "+++ b/y",
      "@@ -1 +1 @@",
      "+second",
    ].join("\n");
    expect(extractAddedLinesFromPatch(patch)).toBe("first\nsecond");
  });

  it("🔴 P1b:hunk 內 `-line`(刪除)+ context 行不採,只採 `+`", () => {
    const patch = [
      "diff --git a/x b/x",
      "@@ -1,3 +1,2 @@",
      " context",
      "-deleted",
      "+added",
    ].join("\n");
    expect(extractAddedLinesFromPatch(patch)).toBe("added");
  });

  it("🔴 P1b:pattern `^foo` 對 strip 後內容命中(對照 grep POSIX ERE 錨點語意)", () => {
    // 修法前:patch 行為 `+foo`,pattern `^foo` 因為 `^` 錨點對 `+foo` 不 match
    // → false negative。修法後 strip 一個 `+` → 內容 `foo` → `^foo` 命中
    const patch = [
      "diff --git a/x b/x",
      "@@ -1 +1 @@",
      "+foo",
    ].join("\n");
    const added = extractAddedLinesFromPatch(patch);
    expect(new RegExp("^foo", "m").test(added)).toBe(true);
  });
});

describe("partitionPatterns — 把 denylist 切成 CA / non-CA", () => {
  it("兩條 CA 條目挑出,其餘進 non-CA", () => {
    const patterns = [FRAG_ACTI, FRAG_WUM, "PR " + "#[0-9]", PREF_PULL + "[0-9]", FRAG_OPX];
    const { nonCa, ca } = partitionPatterns(patterns);
    expect(ca).toEqual(["PR " + "#[0-9]", PREF_PULL + "[0-9]"]);
    expect(nonCa).toEqual([FRAG_ACTI, FRAG_WUM, FRAG_OPX]);
  });

  it("全 non-CA:CA 為空,nonCa 全收", () => {
    const patterns = [FRAG_ACTI, FRAG_OPX];
    const { nonCa, ca } = partitionPatterns(patterns);
    expect(ca).toEqual([]);
    expect(nonCa).toEqual(patterns);
  });
});

// ───────────────────────────────────────── 端到端(拋棄式 git repo)

/**
 * 建拋棄式 repo,含最小 `scripts/deny-terms.txt` 與若干 commits。
 * 回傳 repo root(絕對路徑)。
 */
function makeRepo(opts: {
  deny: string[];
  commits: Array<{
    message: string;
    files?: Record<string, string>;
    /** round 5 P2-2:刪除既有檔案再 commit(給 history-only 污染案用) */
    deletions?: string[];
  }>;
  workingTree?: Record<string, string>;
  /** round 2 P2-5 新加:寫進工作樹但不 commit(給 tracked-but-modified 情境用) */
  workingTreeUnstaged?: Record<string, string>;
  /** Step 5 F1:刻意不注入 CA entries,測 startup fail-hard 漂移守門 */
  omitCaAutoInject?: boolean;
  /**
   * 批 8 Phase A:注入 origin remote,讓 buildDeliveryRefs 三條非 last-resort
   * fallback 路徑(①origin/HEAD、②DELIVERY_REFS env、③origin/develop)有可測
   * 目標。每條 push 分支帶「獨立 commit」——local main 不含該 commit,這樣通過與
   * 否能證明「該路徑真的被走過」;路徑失效時 fallback 到 ④local main 查不到 PR#
   * → exit 1(路徑破損直接被抓)
   */
  originRefs?: {
    /** 建 bare origin、每條 push 上去(獨立 commit)*/
    branches: Array<{ name: string; commitSubject: string }>;
    /** 若給,pushes 後 `git remote set-head origin <name>` 讓 ①路徑抓得到 */
    setHeadTo?: string;
  };
  /**
   * PR A1.1:對 disposable repo 注入 git config。
   * 用途:E6 用「敵意 config」(`diff.noprefix=true` / `core.quotePath=true`)證明
   * patch producer 的 command-local flag 壓得過使用者設定。
   */
  gitConfig?: Record<string, string>;
}): string {
  const wrap = mkdtempSync(join(tmpdir(), "cnst-e2e-"));
  created.push(wrap);
  const dir = join(wrap, "repo");
  mkdirSync(join(dir, "scripts"), { recursive: true });
  const git = (...a: string[]) =>
    execFileSync("git", a, { cwd: dir, stdio: "ignore" });
  // round 2 P1-1 相關:確保 default branch = main,讓 buildDeliveryRefs 的
  // last-resort fallback(本地 main / develop)找得到 ref。避免因 host git
  // config init.defaultBranch = master 導致 allowedPrs 空 → 假紅
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  for (const [k, v] of Object.entries(opts.gitConfig ?? {})) git("config", k, v);

  // Step 5 F1:預設自動注入 CA entries(避免 CI startup assert fail-hard);
  // omitCaAutoInject 專用於 F1 e2e 反例(測 assert 本身)
  const finalDeny = opts.omitCaAutoInject
    ? opts.deny
    : Array.from(
        new Set([...opts.deny, "PR " + "#[0-9]", PREF_PULL + "[0-9]"])
      );
  writeFileSync(
    join(dir, "scripts/deny-terms.txt"),
    finalDeny.join("\n") + "\n",
    "utf-8"
  );
  git("add", "-A");
  git("commit", "-qm", "init: deny-terms.txt");

  for (const c of opts.commits) {
    if (c.files) {
      for (const [rel, body] of Object.entries(c.files)) {
        const abs = join(dir, rel);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, body, "utf-8");
      }
      git("add", "-A");
      git("commit", "-qm", c.message);
    } else if (c.deletions) {
      for (const rel of c.deletions) {
        rmSync(join(dir, rel), { force: true });
      }
      git("add", "-A");
      git("commit", "-qm", c.message);
    } else {
      git("commit", "--allow-empty", "-qm", c.message);
    }
  }
  if (opts.workingTree) {
    for (const [rel, body] of Object.entries(opts.workingTree)) {
      const abs = join(dir, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, body, "utf-8");
    }
    git("add", "-A");
    git("commit", "-qm", "add working tree fixtures");
  }
  // round 2 P2-5 + round 3 P2-3 修法:tracked-but-modified 狀態——先 commit
  // 一份 harmless base(進 history + index),再覆寫 working tree 版本但**不 add**。
  // 這樣 index / history 都是 harmless、只有 working tree 含 forbidden 內容;
  // 若 checker 弱化成 `git grep --cached` 掃 index,測試會轉紅(強化守門)。
  if (opts.workingTreeUnstaged) {
    for (const rel of Object.keys(opts.workingTreeUnstaged)) {
      const abs = join(dir, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, "harmless base\n", "utf-8");
    }
    git("add", "-A");
    git("commit", "-qm", "add harmless base for tracked-but-modified fixture");
    // 覆寫 working tree 版本,不 add → tracked-but-modified 效果
    for (const [rel, body] of Object.entries(opts.workingTreeUnstaged)) {
      const abs = join(dir, rel);
      writeFileSync(abs, body, "utf-8");
    }
  }
  // 批 8 Phase A:注入 origin remote 與分支(見 opts.originRefs docstring)。
  // 順序:main 上的所有 commits 都建完才建 origin——這樣「temp branch → push
  // → 刪 temp」不會污染 main 的既定 test fixture
  if (opts.originRefs) {
    const originDir = join(wrap, "origin.git");
    execFileSync("git", ["init", "--bare", "-q", originDir], { stdio: "ignore" });
    git("remote", "add", "origin", originDir);
    for (const b of opts.originRefs.branches) {
      // 一次性 temp branch 從 main tip 分岔 → 加獨立 commit(commitSubject 含
      // 該 case 想測的 PR #)→ push 上 origin 作 `refs/heads/${b.name}` →
      // 回 main → 刪 temp。刪 temp 後,那個獨立 commit 只留在 origin/${b.name}
      // 上、local main 不含 → 若對應 fallback 路徑失效,ε local main 查不到 PR#
      git("checkout", "-q", "-b", `_push_${b.name}`);
      git("commit", "--allow-empty", "-qm", b.commitSubject);
      git("push", "-q", "origin", `_push_${b.name}:refs/heads/${b.name}`);
      git("checkout", "-q", "main");
      git("branch", "-D", `_push_${b.name}`);
    }
    // fetch 把 push 過去的分支拉回 local 作 remote-tracking ref(origin/xxx)
    git("fetch", "-q", "origin");
    if (opts.originRefs.setHeadTo) {
      // 顯式設 origin/HEAD → 讓 buildDeliveryRefs 的 ①路徑
      // (symbolic-ref refs/remotes/origin/HEAD)抓得到
      git("remote", "set-head", "origin", opts.originRefs.setHeadTo);
    }
  }
  return dir;
}

function runChecker(cwd: string, envOverride?: Record<string, string>): { code: number; out: string } {
  // 從 parent env 移除可能影響 buildDeliveryRefs / MARKER_SELF_PR 判定的變數,
  // 讓每個 e2e case 從乾淨基線起跑;需要時透過 envOverride 顯式加回。避免
  // 宿主 shell / 外層 CI 洩漏這兩個 env 進 checker、跨 case 污染測試結果
  const baseEnv: NodeJS.ProcessEnv = { ...process.env };
  delete baseEnv.DELIVERY_REFS;
  delete baseEnv.MARKER_SELF_PR;
  try {
    const out = execFileSync(TSX_BIN, [SCRIPT], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...baseEnv, ...(envOverride ?? {}) },
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("check-no-source-terms — 端到端(真的跑 checker)", () => {
  it("🔴 正對照:working tree 引用已 merge self-PR → exit 0 且印「放行」", () => {
    const dir = makeRepo({
      deny: ["PR " + "#[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "feat: 加了東西 (#7)", files: { "src/foo.md": "hello\n" } },
      ],
      workingTree: {
        "docs/note.md": "see " + PREF_PR + "7 for context\n",
      },
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("self-PR 引用放行");
    expect(out).toContain("✅ 去識別化掃描全數通過");
    expect(code).toBe(0);
  });

  it("🔴 反對照:引用未知 PR 號 → exit 1", () => {
    const dir = makeRepo({
      deny: ["PR " + "#[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "feat: 加了東西 (#7)", files: { "src/foo.md": "hello\n" } },
      ],
      workingTree: {
        "docs/note.md": "see " + PREF_PR + "999 which is not merged\n",
      },
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("含未知 PR/pull 引用");
    expect(code).toBe(1);
  });

  it("🔴 non-CA denylist term(來源專案識別詞)一律嚴格擋 → exit 1", () => {
    const dir = makeRepo({
      deny: ["forbidden_term", "PR " + "#[0-9]"],
      commits: [
        { message: "feat: init (#1)", files: { "src/foo.md": "hello\n" } },
      ],
      workingTree: {
        "docs/note.md": "this file has forbidden_term inside\n",
      },
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 round 1 P2-3 fix e2e:body 內 (井號+N) 引用不會被算入 allowedPrs", () => {
    // 建一個 commit 訊息 subject 沒 canonical squash marker、但 body 內寫
    // 括號尾綴 PR 號放在 commit body 而不是 subject;working tree 引用同一 PR
    // 號。若 loadAllowedPrs 誤收 body,該號會被放行 → gate 假綠。修法後只收
    // subject,body 內的號不 ∈ allowedPrs → 擋
    const dir = makeRepo({
      deny: ["PR " + "#[0-9]"],
      commits: [
        {
          message:
            "feat: some work\n\ninvestigated issue (#777) in body\nnot a squash marker",
          files: { "src/foo.md": "hello\n" },
        },
      ],
      workingTree: {
        "docs/note.md": "see " + PREF_PR + "777 which is only in body\n",
      },
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("含未知 PR/pull 引用");
    expect(code).toBe(1);
  });

  it("🔴 Step 5 F1 fix e2e:CONTEXT_AWARE_PATTERNS 與 denylist 漂移 → startup fail-hard exit 1", () => {
    // denylist 完全不含 CA entry(尾空白版),但 checker 內硬碼常數還在
    // → main() startup assert 應 fail-hard、印明漂移訊息
    const dir = makeRepo({
      deny: ["forbid_only"], // 沒 CA entry
      omitCaAutoInject: true, // 刻意讓 denylist 缺 CA,測 assert
      commits: [
        { message: "feat: init", files: { "src/foo.md": "hello\n" } },
      ],
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("CONTEXT_AWARE_PATTERNS");
    expect(out).toContain("漂移");
    expect(code).toBe(1);
  });

  it("🔴 Step 5 F3 fix e2e:SYNTAX_EXEMPT 目標檔含 non-CA hit → 縮減 pattern scan 抓", () => {
    // 拋棄式 repo 內建 scripts/check-todos-markers.ts(SYNTAX_EXEMPT 目標之一),
    // 內含 non-CA denylist term。CA 字面(PR/pull)在 SYNTAX_EXEMPT scan 內被
    // 跳過、但 non-CA term 應被抓 → exit 1。若這條 scan branch 被拆(例:
    // syntaxNonCaFile = null),此 test 會轉綠
    const dir = makeRepo({
      deny: ["forbid_marker_term", "PR " + "#[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        {
          message: "feat: init",
          files: {
            "src/foo.md": "hello\n",
            "scripts/check-todos-markers.ts":
              "// tool with forbid_marker_term inline + CA fixture " +
              PREF_PR +
              "999\n",
          },
        },
      ],
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 round 5 P2-2 fix:history 曾有 non-CA hit、HEAD 已刪乾淨 → history scan 抓", () => {
    // 先 commit 一份含 forbidden 內容的檔、再 commit 刪除它 → HEAD tree 乾淨,
    // 但 git 全史 blob 仍能看到那個 blob → 只有 scanGitHistoryBlobs 能揭發。
    // 若把該 scan 整段砍掉,working-tree 與 commit-msg scan 都不會抓到
    const dir = makeRepo({
      deny: ["forbidden_hist_term"],
      commits: [
        {
          message: "add polluted",
          files: { "src/polluted.md": "this contains forbidden_hist_term inline\n" },
        },
        {
          message: "remove polluted",
          deletions: ["src/polluted.md"],
        },
      ],
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("git 歷史 blob 含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 round 6 P2-4 fix:commit 訊息 CA hit(合法 self-PR 引用格式)→ 仍嚴格擋", () => {
    // 檔案乾淨、squash marker 尾綴讓 7 進 allowedPrs;然後另一 commit subject
    // 用「PR 井號 7」引用它(CA 字面)。commit-msg scan 是 mode="strict" 不
    // 套 self-PR 放行 → exit 1。若未來把 commit-msg scan 錯改成 self-PR,
    // 這條會轉紅(現有 round 5 non-CA case 抓不到)
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "feat: setup (#7)", files: { "src/foo.md": "hello\n" } },
        { message: "docs: mention " + PREF_PR + "7 in commit subject" },
      ],
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("commit 訊息");
    expect(code).toBe(1);
  });

  it("🔴 round 5 P2-2 fix:檔案全乾淨、commit 訊息含 non-CA term → commit-msg scan 抓", () => {
    // 檔案內容全乾淨、只有 commit subject 含 forbidden term。若把 scanCommitMessages
    // 改成永遠 clean,現有 e2e 都不會轉紅 → 這個 case 專責釘住第 3 段掃描
    const dir = makeRepo({
      deny: ["forbidden_msg_term"],
      commits: [
        {
          message: "feat: forbidden_msg_term in commit subject",
          files: { "src/clean.md": "no forbidden here\n" },
        },
      ],
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("commit 訊息");
    expect(code).toBe(1);
  });

  it("🔴 round 2 P2-5 fix:working tree 未 commit 的內容(non-CA hit)→ working-tree scan 抓", () => {
    // workingTreeUnstaged 內容只出現在工作樹、history 沒有這條 hit;
    // 若 working-tree scan 失效,history scan 不會看到這行 → 只有 working-tree
    // scan 能揭發。用 non-CA denylist term 驗證(context-aware 無關)
    const dir = makeRepo({
      deny: ["forbidden_wip_term"],
      commits: [
        { message: "feat: init (#1)", files: { "src/foo.md": "hello\n" } },
      ],
      workingTreeUnstaged: {
        "docs/wip.md": "this contains forbidden_wip_term inline\n",
      },
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("含來源專案識別詞");
    expect(code).toBe(1);
  });

  // ─────────────────── 批 8 Phase A:buildDeliveryRefs 前三條 fallback 路徑 e2e ───────────────────
  //
  // 動機:批 7 (#32) Step 5 F2(defer 進 TODOS.md P3)——buildDeliveryRefs 四條
  // fallback ①origin/HEAD ②DELIVERY_REFS env ③origin/develop ④last-resort 本地 main
  // 只有 ④ 有 e2e 覆蓋(其他既有 case 全走 ④,因 makeRepo 沒建 origin remote)。
  // 前三條路徑破損只在特定 CI 場景才顯現——本 sprint 補齊 e2e 覆蓋。
  //
  // 每條 case 的設計:目標 PR # 只放在對應 fallback 路徑的分支上、local main 不含。
  // 若對應路徑失效,fallback 掉到 ④local main → 查不到 PR# → allowedPrs 空 → CA
  // hit 未知 PR 引用 → exit 1(路徑破損直接被抓)

  it("🔴 批 8 Phase A A-e1:①origin/HEAD 路徑抓 self-PR → 放行", () => {
    // origin/HEAD 指向 origin/cg-default-sentinel(該分支含 `feat (井號+7)`);
    // local main 無 #7。用 sentinel branch name(非 master / main / trunk 等
    // GitHub 慣例)確保若把 symbolic-ref 動態解析改成硬碼「origin/master」,
    // 此 case 會轉紅——真正守到「跟隨 origin/HEAD」契約(round 1 P2 修法)。
    // 若 buildDeliveryRefs 路徑 ① 破損(例:symbolic-ref 讀失敗、resolves 誤判),
    // fallback 到 ④local main 查不到 #7 → 轉紅
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "init: no PR # on local main", files: { "src/foo.md": "hello\n" } },
      ],
      originRefs: {
        branches: [{ name: "cg-default-sentinel", commitSubject: "feat (#7)" }],
        setHeadTo: "cg-default-sentinel",
      },
      workingTree: {
        "docs/note.md": "see " + PREF_PR + "7 via origin/HEAD path\n",
      },
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("self-PR 引用放行");
    expect(out).toContain("✅ 去識別化掃描全數通過");
    expect(code).toBe(0);
  });

  it("🔴 批 8 Phase A A-e2:②DELIVERY_REFS env 逗號分隔多 ref 各自抓 self-PR → 放行", () => {
    // 不設 origin/HEAD(①路徑失敗);envOverride DELIVERY_REFS 傳逗號分隔兩 ref:
    // origin/release-line-a(含 `feat (井號+8)`)+ origin/release-line-b(含
    // `feat (井號+18)`);工作樹同時引用 #8 + #18。若 `.split(",")` 弱化成
    // 「整串當單一 ref」,整串 `origin/release-line-a,origin/release-line-b`
    // 不 resolve → fallback 到 ③④、都查不到 #8/#18 → 轉紅(round 1 P2 修法:
    // 原本只傳單一 ref 守不到 split + trim + multi-ref union 語意)。
    // 若 buildDeliveryRefs 路徑 ② 破損(例:漏 process.env 讀取、split 邏輯錯),
    // fallback 掉到 ③origin/develop 不存在 → ④local main 查不到 #8/#18 → 轉紅
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "init: no PR # on local main", files: { "src/foo.md": "hello\n" } },
      ],
      originRefs: {
        branches: [
          { name: "release-line-a", commitSubject: "feat (#8)" },
          { name: "release-line-b", commitSubject: "feat (#18)" },
        ],
        // setHeadTo 不設 → ①路徑失敗
      },
      workingTree: {
        "docs/note.md":
          "see " + PREF_PR + "8 in ref a and " + PREF_PR + "18 in ref b\n",
      },
    });
    // 逗號分隔:一項含尾隨空白、另一項含前導空白 → 驗 .trim() 語意兩側都守
    // (round 2 P2 修法:原本只中間有空白 → 只守到 trimStart / trimEnd 之一)
    const { code, out } = runChecker(dir, {
      DELIVERY_REFS: "origin/release-line-a ,  origin/release-line-b",
    });
    expect(out).toContain("self-PR 引用放行");
    expect(out).toContain("✅ 去識別化掃描全數通過");
    expect(code).toBe(0);
  });

  it("🔴 批 8 Phase A A-e3:③origin/develop fallback 路徑抓 self-PR → 放行", () => {
    // 不設 origin/HEAD、無 envOverride;origin/develop 含 `feat (井號+9)`;
    // local main 無 #9。若 buildDeliveryRefs 路徑 ③ 破損(例:硬碼字串打錯、
    // fallback 順序變),掉到 ④local main 查不到 #9 → 轉紅
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "init: no PR # on local main", files: { "src/foo.md": "hello\n" } },
      ],
      originRefs: {
        branches: [{ name: "develop", commitSubject: "feat (#9)" }],
        // setHeadTo 不設 → ①路徑失敗
      },
      workingTree: {
        "docs/note.md": "see " + PREF_PR + "9 via origin/develop path\n",
      },
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("self-PR 引用放行");
    expect(out).toContain("✅ 去識別化掃描全數通過");
    expect(code).toBe(0);
  });

  it("🔴 批 8 Phase A A-e4:所有 delivery ref log 內無 PR # → allowedPrs 空 → CA hit 全擋", () => {
    // 無 origin、無 envOverride、local main log 內無 PR#(僅 init commit)。
    // 四條 fallback ①②③失敗、④拿到 local main 但 log 內無 PR # → allowedPrs
    // 空 set → 工作樹的 CA hit 一律未知 → exit 1。若未來把 allowedPrs 空的處理
    // 錯改成放行(例:「空 set 視為信任所有」),此 case 會轉綠 → 該 bug 被抓
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "init: no PR # anywhere", files: { "src/foo.md": "hello\n" } },
      ],
      // 無 originRefs
      workingTree: {
        "docs/note.md": "see " + PREF_PR + "7 which no delivery ref knows\n",
      },
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("含未知 PR/pull 引用");
    expect(code).toBe(1);
  });

  // ─────────────────── 批 8 Phase B:MARKER_SELF_PR env 通道 e2e ───────────────────
  //
  // 完整契約與範圍(哪段 scan 適用、安全性 assertion)見
  // scripts/check-no-source-terms.ts 的 loadAllowedPrs docstring(SSOT)。
  // 本組 e2e 只覆蓋 CA scan 走的兩段(第 1 段工作樹 + 第 2 段 git 歷史 blob);
  // 第 3 段 commit 訊息 scan 走 strict、不受本 env 影響(既有 R6 P2-4 case
  // tests/check-no-source-terms.test.ts:560-575 已守)。

  it("🔴 批 8 Phase B B-e1:MARKER_SELF_PR 傳入自己的未 merge PR# → 放行", () => {
    // 工作樹引用 (井號+42),delivery ref log 內完全沒有 #42(sprint 內 self-ref
    // 情境);envOverride MARKER_SELF_PR=42 讓 checker 把 42 加入 allowedPrs。
    // 若 checker 忽略 MARKER_SELF_PR env(mutation 破壞),#42 未知 → exit 1
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "init: only merged #7", files: { "src/foo.md": "hello\n" } },
        { message: "feat: past work (#7)" },
      ],
      workingTree: {
        "docs/note.md": "see " + PREF_PR + "42 (this sprint's own PR)\n",
      },
    });
    const { code, out } = runChecker(dir, { MARKER_SELF_PR: "42" });
    expect(out).toContain("self-PR 引用放行");
    expect(out).toContain("✅ 去識別化掃描全數通過");
    expect(code).toBe(0);
  });

  it("🔴 批 8 Phase B B-e2:MARKER_SELF_PR 空字串(non-PR event 場景)→ 仍嚴格擋 + allowedPrs 保持 0", () => {
    // GitHub Actions non-PR event(push / schedule)`github.event.pull_request.number`
    // 展開為空字串 → env 值 "" → Number("") = 0 → `> 0` 檢查擋住。
    // round 1 P2 修法:加斷言「allowedPrs: 0 個」——若把 `Number.isInteger && > 0`
    // 檢查刪掉、無條件 `prs.add(selfPr)`,`""` → 0 會加入 set → allowedPrs
    // size = 1 → 斷言失敗。原本只斷 exit 1 / 「含未知 PR/pull 引用」守不到
    // 非法值進 allowlist(#999 無論如何都是未知)。
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "init: no PR # merged", files: { "src/foo.md": "hello\n" } },
      ],
      workingTree: {
        "docs/note.md": "see " + PREF_PR + "999 unknown\n",
      },
    });
    const { code, out } = runChecker(dir, { MARKER_SELF_PR: "" });
    expect(out).toContain("含未知 PR/pull 引用");
    // round 1 P2:非法值不進 allowlist(round 2 P2 更新診斷輸出格式)
    expect(out).toContain("allowedPrs: 0 個 PR 號");
    expect(out).toContain("self-PR 0");
    expect(code).toBe(1);
  });

  it("🔴 批 8 Phase B B-e4:MARKER_SELF_PR 對 history-blob CA scan(第 2 段)有效 → 放行", () => {
    // round 3 P2 修法:B-e1 只覆蓋第 1 段(工作樹),loadAllowedPrs docstring
    // 宣稱「覆蓋第 1、2 段」但 e2e 沒實測第 2 段。若把 scanGitHistoryBlobs
    // 的 CA mode 從 "self-pr" 改成 "strict",B-e1 全綠但 history-blob 段不
    // 放行 self-PR、實際行為漂移。
    //
    // fixture:先 commit 含 `PR #42` 的檔、再 commit 刪除它 → HEAD tree 乾淨、
    // working tree 乾淨,只有 git 歷史 blob 仍能看到 #42 引用。若第 2 段 CA
    // scan 走 self-pr 判定 → #42 因 MARKER_SELF_PR=42 in allowedPrs → 放行。
    // 若 mode 改 strict → 擋 → exit 1、case 轉紅。
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "init: clean", files: { "src/foo.md": "hello\n" } },
        {
          message: "add self-ref doc",
          files: { "docs/note.md": "see " + PREF_PR + "42 via history-blob path\n" },
        },
        { message: "remove self-ref doc", deletions: ["docs/note.md"] },
      ],
    });
    const { code, out } = runChecker(dir, { MARKER_SELF_PR: "42" });
    expect(out).toContain("self-PR 引用放行");
    expect(out).toContain("✅ 去識別化掃描全數通過");
    expect(code).toBe(0);
  });

  it("🔴 批 9 F1:MARKER_SELF_PR ≥ 1e9(超上限)→ 仍嚴格擋 + allowedPrs 保持 0", () => {
    // 批 8 Step 5 F1(confidence 4)修法:與 parseAllowedPrs L132/L138 + extractPrRefsFromLine
    // L172 的 `< 1e9` 契約對齊。若 mutation 拿掉 `< 1e9`,`Number.isInteger(9999999999)
    // === true && > 0 === true` → 進 set → allowedPrs: 1 個 → 斷言失敗
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "init: no PR # merged", files: { "src/foo.md": "hello\n" } },
      ],
      workingTree: {
        "docs/note.md": "see " + PREF_PR + "999 unknown\n",
      },
    });
    const { code, out } = runChecker(dir, { MARKER_SELF_PR: "9999999999" });
    expect(out).toContain("含未知 PR/pull 引用");
    expect(out).toContain("allowedPrs: 0 個 PR 號");
    expect(out).toContain("self-PR 0");
    expect(code).toBe(1);
  });

  it("🔴 批 9 F1 boundary(round 2 P2):MARKER_SELF_PR = 1e9 精確邊界 → 仍嚴格擋", () => {
    // round 2 P2 修法:原 F1 case 用 "9999999999"、mutation `< 1e9` → `<= 1e9`
    // 仍會通過(9999999999 兩者都 false)。加 "1000000000"(= 1e9)守精確邊界:
    // `< 1e9` = false(擋)、`<= 1e9` = true(誤放行 → case 轉紅)
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "init: no PR # merged", files: { "src/foo.md": "hello\n" } },
      ],
      workingTree: {
        "docs/note.md": "see " + PREF_PR + "999 unknown\n",
      },
    });
    const { code, out } = runChecker(dir, { MARKER_SELF_PR: "1000000000" });
    expect(out).toContain("含未知 PR/pull 引用");
    expect(out).toContain("allowedPrs: 0 個 PR 號");
    expect(out).toContain("self-PR 0");
    expect(code).toBe(1);
  });

  it("🔴 批 9 F2:MARKER_SELF_PR 已 ∈ delivery(collision)→ self-PR 計數仍為 1", () => {
    // 批 8 Step 5 F2(confidence 3)修法:selfPrCount 語意改「本次 env 通道有效」計數,
    // 不再受 delivery collision 影響。舊行為(!prs.has 條件包 selfPrCount = 1):
    // env 明明傳 42 且 42 也在 delivery → 印「self-PR 0」誤導。新行為:env 值合法 selfPrCount = 1、
    // set 只在未包含時加(dedup)。若 mutation 恢復舊條件,此 case 應轉紅。
    //
    // fixture:local main 上 squash `feat (井號+42)` → parseAllowedPrs 抽出 42;
    // envOverride MARKER_SELF_PR=42 → collision;工作樹引用 42 應放行(不驗行為、
    // 驗診斷字面)
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "feat: past work (#42)", files: { "src/foo.md": "hello\n" } },
      ],
      workingTree: {
        "docs/note.md": "see " + PREF_PR + "42 both delivered and self-PR\n",
      },
    });
    const { code, out } = runChecker(dir, { MARKER_SELF_PR: "42" });
    expect(out).toContain("self-PR 引用放行");
    expect(out).toContain("✅ 去識別化掃描全數通過");
    // 關鍵斷言:allowedPrs 集合仍只 1 個(collision 時 self ∈ delivery,dedup);
    // 但 selfPrCount 語意是「env 通道 acknowledge」、應為 1
    expect(out).toContain("allowedPrs: 1 個 PR 號");
    expect(out).toContain("self-PR 1");
    expect(code).toBe(0);
  });

  it("🔴 批 8 Phase B B-e3:MARKER_SELF_PR 非數字 / 負值 / 浮點 → 仍嚴格擋 + allowedPrs 保持 0", () => {
    // 惡意或錯設場景:env 值為 "abc"(→ NaN)、"-1"(< 0)、"0"(= 0)、"1.5"(浮點)。
    // 四種都應被 `Number.isInteger(selfPr) && selfPr > 0` 檢查擋住,不進
    // allowedPrs → 工作樹引用 #999 仍未知 → exit 1。
    // round 2 P2 修法:加 "1.5" case——若把 `Number.isInteger` 單獨拿掉、
    // 留 `> 0`,原本 abc/-1/0 三個 case 仍綠(全被 `> 0` 擋),但 "1.5" 會
    // 進 allowlist、違反「正整數」契約
    for (const badVal of ["abc", "-1", "0", "1.5"]) {
      const dir = makeRepo({
        deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
        commits: [
          { message: "init: no PR # merged", files: { "src/foo.md": "hello\n" } },
        ],
        workingTree: {
          "docs/note.md": "see " + PREF_PR + "999 unknown\n",
        },
      });
      const { code, out } = runChecker(dir, { MARKER_SELF_PR: badVal });
      expect(out, `MARKER_SELF_PR=${badVal} 應被擋`).toContain("含未知 PR/pull 引用");
      // round 2 P2:改用新格式「allowedPrs: N 個 PR 號」+ 分開報 self-PR 數
      expect(out, `MARKER_SELF_PR=${badVal} 不進 allowlist`).toContain("allowedPrs: 0 個 PR 號");
      expect(out, `MARKER_SELF_PR=${badVal} self-PR 分項應 0`).toContain("self-PR 0");
      expect(code, `MARKER_SELF_PR=${badVal} 應 exit 1`).toBe(1);
    }
  });
});

// ────────────────── PR A1:history baseline cutover 契約 ──────────────────
//
// 動機(設計正本:docs/architecture/source-term-history-baseline.md「決策」)——
// main history 舊 blob 含
// 來源專案識別詞(不能 rewrite 主線歷史),但要讓 gate 綠。做法:machine-readable
// `scripts/source-term-baseline.json` 記錄 baseline SHA,checker history scan 只掃
// `baseline..HEAD`;baseline 本身損壞一律 fail-closed。
//
// 契約(逐條對應 plan file Phase 1 P1a-P1i):
//   - Current tree 永遠嚴格,baseline 只影響 history scan
//   - baseline..HEAD 內的 blob:嚴格擋
//   - baseline 及更早的 blob:grandfather 通過
//   - baseline malformed / 非祖先 / rev-parse 失敗 / schemaVersion 未知 / JSON malformed
//     → fail-closed exit 1(不降級到全史掃)
//   - config 檔不存在 / baseline null → 舊行為(全史掃)——向下相容
// Mutation probe:拿掉 validateBaseline 的 ancestor 檢查 → P1e 立刻轉綠 → 手動探針
// 在 Step 4.5 執行(乾淨工作樹 + 明確步驟見 plan file)。

function shaAt(dir: string, ref: string): string {
  return execFileSync("git", ["-C", dir, "rev-parse", ref], {
    encoding: "utf-8",
  }).trim();
}

function writeBaselineConfig(dir: string, body: unknown | string): void {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  writeFileSync(join(dir, "scripts/source-term-baseline.json"), text, "utf-8");
}

describe("check-no-source-terms — history baseline(PR A1)", () => {
  it("🔴 P1a:current tree 含 non-CA term(即使 baseline 已 grandfather 歷史)→ 嚴格擋", () => {
    const dir = makeRepo({
      deny: ["forbidden_cur_term"],
      commits: [
        { message: "init clean", files: { "src/init.md": "hello\n" } },
      ],
      workingTree: {
        "docs/note.md": "contains forbidden_cur_term inline\n",
      },
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD"),
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 P1b:baseline 前 historical blob hit、current tree 乾淨 → grandfather 通過", () => {
    const dir = makeRepo({
      deny: ["forbidden_hist_term"],
      commits: [
        {
          message: "add polluted",
          files: { "src/polluted.md": "contains forbidden_hist_term\n" },
        },
        { message: "remove polluted", deletions: ["src/polluted.md"] },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD"),
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("history scan range: baseline..HEAD");
    expect(out).toContain("✅ 去識別化掃描全數通過");
    expect(code).toBe(0);
  });

  it("🔴 P1c:baseline 之後新引入的 historical blob hit → 嚴格擋", () => {
    const dir = makeRepo({
      deny: ["forbidden_new_hist"],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        {
          message: "add polluted after baseline",
          files: { "src/polluted.md": "contains forbidden_new_hist\n" },
        },
        { message: "remove polluted", deletions: ["src/polluted.md"] },
      ],
    });
    // baseline = clean init(HEAD~2);後續兩個 commit 進入 baseline..HEAD 範圍
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~2"),
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("git 歷史 blob 含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 P1d:config 檔不存在 → 舊行為(全史掃),baseline 前歷史 hit 也擋", () => {
    // 向下相容釘子:未來 refactor 若把 default 改成 grandfather-all,此條轉紅
    const dir = makeRepo({
      deny: ["forbidden_default_term"],
      commits: [
        {
          message: "add polluted",
          files: { "src/polluted.md": "contains forbidden_default_term\n" },
        },
        { message: "remove polluted", deletions: ["src/polluted.md"] },
      ],
    });
    // 刻意不寫 scripts/source-term-baseline.json
    const { code, out } = runChecker(dir);
    expect(out).toContain("history scan range: --all");
    expect(out).toContain("git 歷史 blob 含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 P1e:baseline 非 HEAD 祖先 → fail-closed exit 1(mutation kill 錨點)", () => {
    // 建孤立 branch 拿一個非祖先 SHA。若拿掉 validateBaseline 的 ancestor 檢查,
    // 此 case 從紅轉綠 → mutation 未 kill → 探針失效
    const dir = makeRepo({
      deny: ["forbidden_term_e"],
      commits: [{ message: "main1", files: { "src/a.md": "clean\n" } }],
    });
    execFileSync("git", ["-C", dir, "checkout", "--orphan", "orphan"], {
      stdio: "ignore",
    });
    execFileSync(
      "git",
      ["-C", dir, "commit", "--allow-empty", "-qm", "orphan commit"],
      { stdio: "ignore" }
    );
    const orphanSha = shaAt(dir, "HEAD");
    execFileSync("git", ["-C", dir, "checkout", "-q", "main"], {
      stdio: "ignore",
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: orphanSha,
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("baseline");
    expect(out).toContain("ancestor");
    expect(code).toBe(1);
  });

  it("🔴 P1f:baseline 是短 SHA(< 40 hex)→ fail-closed exit 1", () => {
    const dir = makeRepo({
      deny: ["forbidden_term_f"],
      commits: [{ message: "init", files: { "src/a.md": "clean\n" } }],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: "abc1234",
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("baseline");
    expect(out).toContain("40");
    expect(code).toBe(1);
  });

  it("🔴 P1g:baseline 為 null → 舊行為(全史)", () => {
    const dir = makeRepo({
      deny: ["forbidden_term_g"],
      commits: [
        {
          message: "add polluted",
          files: { "src/polluted.md": "contains forbidden_term_g\n" },
        },
        { message: "remove polluted", deletions: ["src/polluted.md"] },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: null,
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("history scan range: --all");
    expect(out).toContain("git 歷史 blob 含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 P1h:config JSON malformed → fail-closed exit 1", () => {
    const dir = makeRepo({
      deny: ["forbidden_term_h"],
      commits: [{ message: "init", files: { "src/a.md": "clean\n" } }],
    });
    writeBaselineConfig(dir, "{ this is not json");
    const { code, out } = runChecker(dir);
    expect(out).toContain("source-term-baseline.json");
    expect(code).toBe(1);
  });

  it("🔴 P1i:baseline 是合法 40-hex 但 rev-parse 找不到 → fail-closed exit 1", () => {
    const dir = makeRepo({
      deny: ["forbidden_term_i"],
      commits: [{ message: "init", files: { "src/a.md": "clean\n" } }],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: "0".repeat(40),
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("baseline");
    // rev-parse 失敗 or 非祖先都收在同一 error 訊息內
    expect(code).toBe(1);
  });

  it("🔴 P1y(round 1 P2 修法):baseline 之後 commit 未動 forbidden 檔(繼承 baseline 遺留 blob)→ diff scan 不誤觸發", () => {
    // 場景:baseline 已含 forbidden(去識別化 debt);feature 從 baseline 分岔、
    // 加一個無關檔的 commit。舊 tree-scan:feature commit 的 tree 仍含 baseline
    // 遺留 forbidden → 誤紅;新 diff-scan:feature commit 的 diff 沒動 forbidden
    // 檔 → 通過。此測試把 tree-scan → diff-scan 語意轉換釘住。
    const dir = makeRepo({
      deny: ["forbidden_legacy_term"],
      commits: [
        // baseline commit:含 forbidden(去識別化 debt)
        {
          message: "baseline: legacy debt",
          files: { "src/legacy.md": "contains forbidden_legacy_term inline\n" },
        },
        // baseline 後 commit:動另一無關檔、不動 legacy.md
        {
          message: "feat: unrelated change",
          files: { "src/unrelated.md": "totally clean\n" },
        },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~1"),
    });
    const { code, out } = runChecker(dir);
    // ⚠️ current tree 仍含 legacy.md 的 forbidden → 會被 working tree scan 抓
    //    (預期行為:baseline 只影響 history scan)。此測試專注 history scan
    //    語意,先把 legacy.md 從工作樹刪除、但保留 commit 內容
    // (以 fs delete 而非 git rm——後者會再新增一個 commit)
    // → 但這樣 working tree 仍未 stage delete → tracked-but-deleted 狀態
    //   working tree scan 走 `git grep -- .`,對 tracked-but-deleted 不掃(內容不存在)
    // 實際上更乾淨:讓 baseline commit 之後再加一個「刪除 legacy.md」的 commit,
    // 讓 current tree 完全乾淨,但 baseline..HEAD 內的兩個 commit 仍會走 diff scan
    // → 刪除 commit 的 diff 是 `-` 行(不觸發 grep `+` filter)→ 通過
    // → 這條測試的 setup 已達成:HEAD~1 有 legacy(baseline)、HEAD 加無關檔
    //   diff scan 只看 HEAD commit(unrelated.md)的 `+` 行 → 無 forbidden
    // 但 current tree 仍含 legacy → working tree scan 會抓
    // 為避免這個干擾,我們宣稱這個測試「檢查 history scan 語意」——
    // 用 expect 分別檢查 working tree 段和 history 段,不看整體 exit code
    expect(out).toContain("history scan range: baseline..HEAD");
    // history scan 段落內不應含「git 歷史 blob 含來源專案識別詞」
    // (若 tree scan 語意仍在,legacy.md blob 會被抓;diff scan 語意下不會)
    const hasHistBlobHit = out.includes("git 歷史 blob 含來源專案識別詞");
    expect(hasHistBlobHit).toBe(false);
    // current tree 仍含 forbidden → 整體 exit 1(預期行為,不是本測試的重點)
    expect(code).toBe(1);
    expect(out).toContain("working tree(non-CA,全域):含來源專案識別詞");
  });

  it("🔴 P1x:schemaVersion 未知 → fail-closed exit 1(擋 future schema 誤讀)", () => {
    const dir = makeRepo({
      deny: ["forbidden_term_x"],
      commits: [{ message: "init", files: { "src/a.md": "clean\n" } }],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 999,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD"),
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("schemaVersion");
    expect(code).toBe(1);
  });

  it("🔴 P1z(round 1 P1 → round 2 P1a 收):template: prefix + rev-parse 失敗(downstream fork)→ 降級**全史掃**(不 skip)+ warning", () => {
    // Round 2 P1a 改法:template-fallback 不 skip、改走全史掃(既有 tree scan)
    // 洗白場景(下條 P1z2)才有機會被抓
    const dir = makeRepo({
      deny: ["forbidden_dl_term"],
      commits: [{ message: "init clean", files: { "src/a.md": "clean\n" } }],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: "template:" + "0".repeat(40),
    });
    const { code, out } = runChecker(dir);
    // ⚠️ template-fallback 的 warning 走 console.warn → stderr;成功 case(exit 0)
    //    的 runChecker 只回 stdout,故 warning 字面在此不驗;驗 stdout 就好
    expect(out).toContain("history scan range: --all(template-fallback");
    expect(out).toContain("✅ 去識別化掃描全數通過");
    expect(code).toBe(0);
  });

  it("🔴 P1z2(round 2 P1a 修法):template-fallback 下,洗白場景(A 加 forbidden 後 B 刪)→ 全史掃抓到 → exit 1", () => {
    // 舊 skip 語意會通過(current tree/msg 乾淨、history 跳過);新全史掃語意
    // 抓 downstream history 內 blob → 擋。此測試釘住「fallback 不能只 skip」。
    const dir = makeRepo({
      deny: ["forbidden_launder_term"],
      commits: [
        {
          message: "add forbidden",
          files: { "src/tmp.md": "contains forbidden_launder_term\n" },
        },
        { message: "remove forbidden", deletions: ["src/tmp.md"] },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: "template:" + "0".repeat(40),
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("template baseline");
    // 全史掃抓到中間 blob → 擋
    expect(out).toContain("git 歷史 blob 含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 P1zz3(round 2 P1b 修法 → round 3 P2 test-isolation 加固):POSIX ERE `^pattern` 對 baseline..HEAD 內新增行**歷史 blob** 命中", () => {
    // Round 3 P2 抓到:舊版把 x.md 留在 HEAD → current tree scan 也會抓 → 即使
    // history 掃漏,working tree scan 也讓 test 通過(false green)。修法:
    // 加一個刪除 commit,current tree 乾淨,只有 history 內含 forbidden →
    // 若 diff scan 漏 anchored pattern,working tree/msg 都乾淨、gate 通過 → test 轉綠
    const dir = makeRepo({
      deny: ["^forbidden_start_term"], // POSIX ERE ^ 錨點
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        {
          message: "add polluted",
          files: {
            "src/x.md": "forbidden_start_term at line start\n",
          },
        },
        // Round 3 P2 加:remove polluted → current tree clean、只有 history 有
        { message: "remove polluted", deletions: ["src/x.md"] },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~2"),
    });
    const { code, out } = runChecker(dir);
    // 專釘 history blob 段(此段紅才代表 diff scan 有抓到 anchored ^pattern)
    expect(out).toContain("git 歷史 blob 含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 P1zz8(round 6 P1 修法):post-baseline commit 含 NUL byte + forbidden text → grep 仍抓(不因 binary detection 短路)", () => {
    // 舊 grep -I → 對含 NUL 的 stdin 判 binary、整份不掃 → 洗白通過。
    // 新 grep -a → 強制當 text、繼續掃 text 行、抓 forbidden
    const dir = makeRepo({
      deny: ["forbidden_nul_term"],
      commits: [{ message: "baseline", files: { "src/init.md": "hello\n" } }],
    });
    const baselineSha = shaAt(dir, "HEAD");
    // Commit A:同一 commit 加「含 NUL 的檔」與「含 forbidden text 的檔」
    writeFileSync(join(dir, "src/binaryish.bin"), "prefix\x00suffix\n", "utf-8");
    writeFileSync(join(dir, "src/textfile.md"), "contains forbidden_nul_term inline\n", "utf-8");
    execFileSync("git", ["-C", dir, "add", "-A"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "add binary + forbidden"], { stdio: "ignore" });
    // Commit B:刪除 forbidden(current tree 剩 binary、乾淨)
    execFileSync("git", ["-C", dir, "rm", "-q", "src/textfile.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "remove forbidden"], { stdio: "ignore" });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: baselineSha,
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("git 歷史 blob 含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 P1zz9(round 6 P2 修法):merge commit 保留 grandfathered 內容(baseline 已有)→ --first-parent 不誤觸發", () => {
    // baseline commit 已含 forbidden(grandfathered);main branch 保留、side branch
    // 刪除;merge side into main → merge commit 對 first parent(main)diff 空
    // → 不誤觸發。舊 -m 對 side parent 的 diff 把 forbidden 標為 add → 誤紅
    const dir = makeRepo({
      deny: ["forbidden_gf_term"],
      commits: [
        {
          message: "baseline with grandfathered",
          files: { "src/legacy.md": "contains forbidden_gf_term inline\n" },
        },
      ],
    });
    const baselineSha = shaAt(dir, "HEAD");
    // 分 side branch 刪除 legacy
    execFileSync("git", ["-C", dir, "checkout", "-q", "-b", "side"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "rm", "-q", "src/legacy.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "side: delete legacy"], { stdio: "ignore" });
    // 回 main 加無關檔
    execFileSync("git", ["-C", dir, "checkout", "-q", "main"], { stdio: "ignore" });
    writeFileSync(join(dir, "src/other.md"), "unrelated\n", "utf-8");
    execFileSync("git", ["-C", dir, "add", "src/other.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "main: unrelated"], { stdio: "ignore" });
    // Merge side into main;side 刪除但 main 保留 → merge 結果:legacy.md 仍在
    // (conflict? no,一邊刪一邊留 = ours 保留;但 git merge 預設會刪
    //  除非 recursive resolve;用 -s ours 明確保留 main 版本)
    execFileSync("git", ["-C", dir, "merge", "--no-ff", "-s", "ours", "-q", "-m", "merge side (keep main)", "side"], { stdio: "ignore" });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: baselineSha,
    });
    const { code, out } = runChecker(dir);
    // baseline..HEAD 內三個 commit(side delete、main unrelated、merge)
    // - side delete commit 若被歸為 baseline..HEAD 內(orphan side branch 不會被 rev-list 到)
    //   → 側 branch 未 merge 進主線前 rev-list 掃不到
    //   → merge 之後,side commit 進入 rev-list baseline..HEAD
    //   → side commit 對其 parent(baseline)diff:`-forbidden_gf_term`(刪除,不是 add)
    //   → 不觸發
    // - main unrelated commit 對 parent diff:`+unrelated`,不含 forbidden
    // - merge commit 對 first parent(main)diff:legacy.md 未變(both 有)→ 空
    // 三個 commit 都不出 forbidden add hit → 通過
    expect(out).toContain("history scan range: baseline..HEAD");
    // history 段乾淨(此段紅代表 --first-parent 沒生效、誤觸發)
    const hasHistBlobHit = out.includes("git 歷史 blob 含來源專案識別詞");
    expect(hasHistBlobHit).toBe(false);
    // current tree 仍含 legacy(main keep)→ working tree scan 抓 → exit 1
    // 這是預期,不是本測試的重點
    expect(code).toBe(1);
    expect(out).toContain("working tree(non-CA,全域):含來源專案識別詞");
  });

  it("🔴 P1zz6(round 5 P1 rename 修法):rename dance(rename excluded → scanned + 加內容 + rename 回)→ history scan 抓到", () => {
    // git show 預設開 rename detection → 舊版兩份 patch 只印 rename metadata、
    // 無 + hunk → 洗白通過。新版 `--no-renames` → destination 印成完整新增內容
    const dir = makeRepo({
      deny: ["forbidden_rename_term"],
      commits: [
        // baseline:clean init
        { message: "clean init", files: { "src/init.md": "hello\n" } },
      ],
    });
    // Baseline 之後 3 個 commit 做 rename dance
    const baselineSha = shaAt(dir, "HEAD");
    // c1: 新增檔案(路徑 A)含 forbidden
    writeFileSync(join(dir, "src/laundered.md"), "contains forbidden_rename_term inline\n", "utf-8");
    execFileSync("git", ["-C", dir, "add", "-A"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "add laundered"], { stdio: "ignore" });
    // c2: rename 到路徑 B(內容不變)
    execFileSync("git", ["-C", dir, "mv", "src/laundered.md", "src/renamed.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "rename dance"], { stdio: "ignore" });
    // c3: 刪除,current tree 乾淨
    execFileSync("git", ["-C", dir, "rm", "-q", "src/renamed.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "delete final"], { stdio: "ignore" });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: baselineSha,
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("git 歷史 blob 含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 P1zz7(round 5 P1 -diff 修法):.gitattributes 標 -diff 讓 git show 印 Binary → history scan 仍抓", () => {
    // .gitattributes 標 `path -diff` 讓 git show 對純文字檔輸出「Binary files differ」→
    // 無 hunk → 洗白通過。新版 `--text` 強制 text 輸出、`--no-textconv` 關 filter
    const dir = makeRepo({
      deny: ["forbidden_binary_term"],
      commits: [{ message: "baseline", files: { "src/base.md": "hello\n" } }],
    });
    const baselineSha = shaAt(dir, "HEAD");
    // 加 .gitattributes 標記 src/*.md 為 -diff
    writeFileSync(join(dir, ".gitattributes"), "src/*.md -diff\n", "utf-8");
    execFileSync("git", ["-C", dir, "add", ".gitattributes"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "add -diff attr"], { stdio: "ignore" });
    // 加 forbidden 內容
    writeFileSync(join(dir, "src/base.md"), "hello\ncontains forbidden_binary_term\n", "utf-8");
    execFileSync("git", ["-C", dir, "add", "src/base.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "add forbidden"], { stdio: "ignore" });
    // 刪除、current tree 乾淨
    execFileSync("git", ["-C", dir, "rm", "-q", "src/base.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "delete"], { stdio: "ignore" });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: baselineSha,
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("git 歷史 blob 含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 P1zz5(round 4 P2 修法):shallow clone + template: prefix + rev-parse 失敗 → fail-closed(不誤降級)", () => {
    // Round 4 P2:template-fallback 在 shallow clone 誤降級 → 全史掃只覆蓋 shallow
    // suffix、洗白 blob 在 shallow 邊界之前的漏抓、false green。修法:template-
    // fallback 前先檢查 shallow,shallow + 找不到 SHA 一律 fail-closed
    const dir = makeRepo({
      deny: ["forbidden_shallow_term"],
      commits: [{ message: "init", files: { "src/a.md": "clean\n" } }],
    });
    // Touch `.git/shallow`:git 認為此 repo 是 shallow clone
    writeFileSync(join(dir, ".git/shallow"), shaAt(dir, "HEAD") + "\n", "utf-8");
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: "template:" + "0".repeat(40),
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("shallow clone");
    expect(out).toContain("拒絕降級");
    expect(code).toBe(1);
  });

  it("🔴 P1zz4(round 3 P2 修法):baseline..HEAD 內 merge commit 引入 forbidden(conflict resolution 加的 `+forbidden`)→ combined-diff 也要抓", () => {
    // Round 3 P2:git show 對 merge commit 預設輸出 combined diff(`++forbidden`
    // 前綴),strip 一個 marker 後仍有 `+`、anchored pattern `^forbidden` 不 match。
    // 修法:git show 加 `-m` → merge commit 拆成每 parent 一份普通 diff、抓得到。
    const dir = makeRepo({
      deny: ["^forbidden_merge_term"],
      commits: [
        { message: "baseline", files: { "src/base.md": "hello\n" } },
      ],
    });
    // 手動建 side branch → main 有另一 commit → merge with conflict resolution 加 forbidden
    execFileSync("git", ["-C", dir, "checkout", "-q", "-b", "side"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "--allow-empty", "-qm", "side commit"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "checkout", "-q", "main"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "--allow-empty", "-qm", "main commit"], { stdio: "ignore" });
    // merge with -s ours strategy 產生 merge commit,然後手動 amend 加 forbidden 到 tree
    execFileSync("git", ["-C", dir, "merge", "--no-ff", "-q", "-m", "merge side", "side"], { stdio: "ignore" });
    // 在 merge commit 上直接 amend 加 forbidden(模擬 conflict resolution 加的內容)
    writeFileSync(join(dir, "src/base.md"), "hello\nforbidden_merge_term added in merge\n", "utf-8");
    execFileSync("git", ["-C", dir, "add", "src/base.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "--amend", "--no-edit", "-q"], { stdio: "ignore" });
    // 再加一個刪除 commit 讓 current tree 乾淨
    execFileSync("git", ["-C", dir, "rm", "-q", "src/base.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "remove base"], { stdio: "ignore" });
    // baseline 設在 pre-merge:baseline..HEAD 含 merge commit + remove
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~3"),
    });
    const { code, out } = runChecker(dir);
    // history blob scan 要抓到 merge commit conflict resolution 加的 forbidden
    expect(out).toContain("git 歷史 blob 含來源專案識別詞");
    expect(code).toBe(1);
  });

  it("🔴 P1zz(round 1 P1 修法):template: prefix + 40-hex 語法錯 → fail-closed(語法錯不因 prefix 降級)", () => {
    // Template prefix 只在 rev-parse 失敗時降級;若 SHA 本身語法錯(< 40 hex /
    // 非 hex),仍 fail-closed——語法錯是打錯字、不是 fork 情境,不該降級
    const dir = makeRepo({
      deny: ["forbidden_zz_term"],
      commits: [{ message: "init", files: { "src/a.md": "clean\n" } }],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: "template:not-a-real-sha",
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("baseline SHA 必須是 40 字元 hex");
    expect(out).toContain("template: prefix");
    expect(code).toBe(1);
  });

  it("🔴 P1yy(round 1 P1 修法):template: prefix + rev-parse OK(template repo 自己)→ 走 baseline..HEAD diff scan", () => {
    // Template repo 自己跑 checker:template: prefix 值的 SHA 在自己的 history
    // 內 rev-parse 得到 → 不降級、走 baseline..HEAD 正規 diff scan。此測試釘住
    // 「template prefix 不代表永遠降級」——rev-parse 通過就正規走
    const dir = makeRepo({
      deny: ["forbidden_yy_term"],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        {
          message: "add polluted after baseline",
          files: { "src/polluted.md": "contains forbidden_yy_term\n" },
        },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: "template:" + shaAt(dir, "HEAD~1"),
    });
    const { code, out } = runChecker(dir);
    // 不降級 → 走 baseline..HEAD、抓到 baseline 之後的新增 forbidden
    expect(out).toContain("history scan range: baseline..HEAD");
    expect(out).not.toContain("history scan range: skipped");
    expect(out).toContain("含來源專案識別詞");
    expect(code).toBe(1);
  });
});

// ══════════════════ PR A1.1 F1:diff-scan 效能重構的守門契約 ══════════════════
//
// 設計正本:repo 內 ADR「去識別化掃描的 history baseline cutover」的
// 〈效能與 scale 契約〉一節(canonical path 引用集中在 4 個 consumer,見
// tests/check-doc-refs.test.ts 的 G2 位置+數量契約)。
//
// 政策不變量(**與實作無關**,四條):
//   INV-1 baseline..HEAD 的每個 rev,其 patch 全域最多被提取一次(不分 view / policy)
//   INV-2 每個 rev 恰好被交給 patch producer 一次(無漏、無重、無額外)
//   INV-3 三組 policy(main×non-CA / main×CA / syntax×non-CA)全部由同一份
//         per-rev extraction 分桶,不得為任何一組另產 patch
//   INV-4 subprocess 不得回退成每 rev 多倍乘法
//
// ⚠️ 「patch-producing invocation」= 會輸出 patch bytes 的 git 呼叫
//    (`show` / `diff` / `diff-tree` / 帶 diff 選項的 `log`)。
//    **不輸出 patch bytes 的 metadata command(`rev-list` / `rev-parse` /
//    `merge-base` / `symbolic-ref` / `cat-file -e`)不受這些預算限制。**

/** shim log 的 argv 分隔字元(ASCII UNIT SEPARATOR = 0x1f)。 */
const ARGV_SEP = String.fromCharCode(31);

interface ShimCall {
  bin: string;
  exit: number;
  stdinFile: string;
  stdoutFile: string;
  /** 呼叫當下 `-f <file>` 指到的 pattern 檔快照(無則 "-")。 */
  patternFile: string;
  /** 呼叫當下 Node 給的 fd 1 型別:`file`(串流到檔案)或 `pipe`(記憶體捕捉)。 */
  fd1: string;
  argv: string[];
}

interface Shim {
  binDir: string;
  logFile: string;
  env: Record<string, string>;
}

/**
 * 建 PATH shim:`git` 與 `grep` 各一個 wrapper,記 argv / stdin / stdout / exit,
 * 再原樣 exec 真 binary。**必須對結果透明**(T1 自測逐字節比對)。
 */
function makeShim(): Shim {
  const base = mkdtempSync(join(tmpdir(), "cnst-shim-"));
  created.push(base);
  const binDir = join(base, "bin");
  const dataDir = join(base, "data");
  mkdirSync(binDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  const logFile = join(base, "calls.log");
  writeFileSync(logFile, "", "utf-8");
  for (const name of ["git", "grep"]) {
    const real = execFileSync("sh", ["-c", `command -v ${name}`], {
      encoding: "utf-8",
    }).trim();
    const script = [
      "#!/bin/sh",
      // R1 P2 契約:先記下 Node 給的 fd 1 型別(檔案 vs pipe),再做任何重導。
      // 有上限的記憶體 buffer 實作會給 pipe;串流到檔案的實作會給檔案。
      'if [ -f /dev/fd/1 ]; then _fd1=file; else _fd1=pipe; fi',
      `_in=$(mktemp "${dataDir}/stdin.XXXXXX")`,
      `_out=$(mktemp "${dataDir}/stdout.XXXXXX")`,
      // 呼叫當下快照 `-f <file>`:checker 結束時會清掉 pattern 暫存目錄,
      // 事後再讀就 ENOENT(C5 需要逐字節比對 pattern 檔內容)。
      '_pat="-"',
      '_prev=""',
      'for _a in "$@"; do',
      '  if [ "$_prev" = "-f" ] && [ -f "$_a" ]; then',
      `    _pat=$(mktemp "${dataDir}/pat.XXXXXX"); cp "$_a" "$_pat"`,
      "  fi",
      '  _prev="$_a"',
      "done",
      'cat > "$_in"',
      `"${real}" "$@" < "$_in" > "$_out"`,
      "_rc=$?",
      "{",
      `  printf '%s\\t%s\\t%s\\t%s\\t%s\\t%s\\t' '${name}' "$_rc" "$_in" "$_out" "$_pat" "$_fd1"`,
      '  for _a in "$@"; do printf \'%s\\037\' "$_a"; done',
      "  printf '\\n'",
      `} >> "${logFile}"`,
      'cat "$_out"',
      "exit $_rc",
    ].join("\n");
    const p = join(binDir, name);
    writeFileSync(p, script + "\n", "utf-8");
    chmodSync(p, 0o755);
  }
  return {
    binDir,
    logFile,
    env: { PATH: `${binDir}:${process.env.PATH ?? ""}` },
  };
}

function readShimCalls(shim: Shim): ShimCall[] {
  const raw = readFileSync(shim.logFile, "utf-8");
  const calls: ShimCall[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 7) continue;
    const [bin, rc, stdinFile, stdoutFile, patternFile, fd1, ...argvRest] = parts;
    const argv = argvRest
      .join("\t")
      .split(ARGV_SEP)
      .filter((a) => a.length > 0);
    calls.push({
      bin: bin!,
      exit: Number(rc),
      stdinFile: stdinFile!,
      stdoutFile: stdoutFile!,
      patternFile: patternFile!,
      fd1: fd1!,
      argv,
    });
  }
  return calls;
}

/** 跳過 `-C <path>` / `-c <cfg>` 之後的第一個非 option 引數 = git 子指令。 */
function gitSubcommand(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "-C" || a === "-c") {
      i++;
      continue;
    }
    if (a.startsWith("-")) continue;
    return a;
  }
  return null;
}

function isPatchProducing(c: ShimCall): boolean {
  if (c.bin !== "git") return false;
  const sub = gitSubcommand(c.argv);
  if (sub === "show" || sub === "diff" || sub === "diff-tree") return true;
  if (sub === "log") {
    return c.argv.some(
      (a) => a === "-p" || a === "--patch" || a.startsWith("--unified")
    );
  }
  return false;
}

const SHA40 = /^[0-9a-f]{40}$/;

/** 一次 patch-producing 呼叫實際處理到的 rev(argv 內的裸 SHA + stdin 內的 SHA 行)。 */
function revsOfCall(c: ShimCall): string[] {
  const out: string[] = [];
  for (const a of c.argv) if (SHA40.test(a)) out.push(a);
  let stdin = "";
  try {
    stdin = readFileSync(c.stdinFile, "utf-8");
  } catch {
    /* 檔可能已被清掉 */
  }
  for (const l of stdin.split("\n")) {
    const t = l.trim();
    if (SHA40.test(t)) out.push(t);
  }
  return out;
}

interface SubprocessProfile {
  calls: ShimCall[];
  patchProducing: ShimCall[];
  greps: ShimCall[];
  otherGit: ShimCall[];
}

function profile(shim: Shim): SubprocessProfile {
  const calls = readShimCalls(shim);
  return {
    calls,
    patchProducing: calls.filter(isPatchProducing),
    greps: calls.filter((c) => c.bin === "grep"),
    otherGit: calls.filter((c) => c.bin === "git" && !isPatchProducing(c)),
  };
}

/**
 * 建一個「baseline 之後有 n 個乾淨 commit」的 repo,baseline 指到 `clean init`。
 * 內容乾淨 → checker 應 exit 0,計數不被 early-exit 干擾。
 */
function makeScaleRepo(n: number): { dir: string; revs: string[] } {
  const commits: Array<{ message: string; files?: Record<string, string> }> = [
    { message: "clean init", files: { "src/init.md": "hello\n" } },
  ];
  for (let i = 0; i < n; i++) {
    commits.push({
      message: `clean commit ${i}`,
      files: { [`src/f${i}.md`]: `content ${i}\n` },
    });
  }
  const dir = makeRepo({ deny: ["forbidden_scale_term"], commits });
  const baseline = shaAt(dir, `HEAD~${n}`);
  writeBaselineConfig(dir, {
    schemaVersion: 1,
    sourceTermHistoryBaseline: baseline,
  });
  const revs = execFileSync("git", ["-C", dir, "rev-list", `${baseline}..HEAD`], {
    encoding: "utf-8",
  })
    .split("\n")
    .filter(Boolean);
  return { dir, revs };
}

describe("PR A1.1 — subprocess 觀測 shim 自測(擋契約假綠)", () => {
  it("🔴 T1:掛 shim 與不掛 shim,exit / 輸出逐字節相同(instrumentation 透明)", () => {
    const { dir } = makeScaleRepo(3);
    const plain = runChecker(dir);
    const shim = makeShim();
    const shimmed = runChecker(dir, shim.env);
    expect(shimmed.code).toBe(plain.code);
    expect(shimmed.out).toBe(plain.out);
  });

  it("🔴 T2:shim 真的被走到(log 非空、含 git 與 patch-producing 呼叫)", () => {
    const { dir } = makeScaleRepo(3);
    const shim = makeShim();
    runChecker(dir, shim.env);
    const p = profile(shim);
    expect(p.calls.length).toBeGreaterThan(0);
    expect(p.calls.some((c) => c.bin === "git")).toBe(true);
    expect(p.patchProducing.length).toBeGreaterThan(0);
  });

  it("🔴 T3:子行程 exit code 透傳(baseline 非祖先 → checker exit 1)", () => {
    const dir = makeRepo({
      deny: ["forbidden_t3_term"],
      commits: [{ message: "init clean", files: { "src/a.md": "x\n" } }],
    });
    execFileSync("git", ["-C", dir, "checkout", "-q", "--orphan", "sidebranch"], {
      stdio: "ignore",
    });
    writeFileSync(join(dir, "other.md"), "y\n", "utf-8");
    execFileSync("git", ["-C", dir, "add", "-A"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "orphan"], { stdio: "ignore" });
    const orphan = shaAt(dir, "HEAD");
    execFileSync("git", ["-C", dir, "checkout", "-q", "main"], { stdio: "ignore" });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: orphan,
    });
    const shim = makeShim();
    const { code, out } = runChecker(dir, shim.env);
    expect(code).toBe(1);
    expect(out).toContain("baseline 驗證失敗");
  });
});

describe("PR A1.1 — scale contract(implementation-neutral)", () => {
  it("🔴 C1:patch-producing 呼叫數 ≤ N(每 rev 最多一次 extraction)", () => {
    const { dir, revs } = makeScaleRepo(15);
    const shim = makeShim();
    const { code } = runChecker(dir, shim.env);
    expect(code).toBe(0);
    const p = profile(shim);
    expect(revs.length).toBe(15);
    expect(
      p.patchProducing.length,
      `patch-producing=${p.patchProducing.length} 應 ≤ N=${revs.length};` +
        "每 rev 三次 git show 的舊實作會得到 3N=45"
    ).toBeLessThanOrEqual(revs.length);
    expect(p.patchProducing.length).toBeGreaterThanOrEqual(1);
  });

  it("🔴 C2a:每個 rev 在所有 patch-producing 呼叫中恰出現 1 次(封死 per-view 重複提取)", () => {
    const { dir, revs } = makeScaleRepo(15);
    const shim = makeShim();
    expect(runChecker(dir, shim.env).code).toBe(0);
    const p = profile(shim);
    const count = new Map<string, number>();
    for (const c of p.patchProducing) {
      for (const r of revsOfCall(c)) count.set(r, (count.get(r) ?? 0) + 1);
    }
    for (const r of revs) {
      expect(count.get(r) ?? 0, `rev ${r.slice(0, 8)} 出現次數`).toBe(1);
    }
    expect([...count.keys()].sort()).toEqual([...revs].sort());
  });

  it("🔴 C2b:各批次 rev 集合兩兩互斥,聯集恰等於 rev-list", () => {
    const { dir, revs } = makeScaleRepo(15);
    const shim = makeShim();
    expect(runChecker(dir, shim.env).code).toBe(0);
    const p = profile(shim);
    const batches = p.patchProducing.map((c) => new Set(revsOfCall(c)));
    for (let i = 0; i < batches.length; i++) {
      for (let j = i + 1; j < batches.length; j++) {
        const inter = [...batches[i]!].filter((r) => batches[j]!.has(r));
        expect(inter, `批次 ${i} 與 ${j} 不得重疊`).toEqual([]);
      }
    }
    const union = new Set<string>();
    for (const b of batches) for (const r of b) union.add(r);
    expect([...union].sort()).toEqual([...revs].sort());
  });

  it("🔴 C2d:patch-producing 呼叫不得帶 pathspec,封死「每個 view 各產一份 patch」", () => {
    const { dir } = makeScaleRepo(6);
    const shim = makeShim();
    expect(runChecker(dir, shim.env).code).toBe(0);
    const p = profile(shim);
    for (const c of p.patchProducing) {
      expect(
        c.argv.includes("--"),
        `patch producer 不得帶 pathspec:${c.argv.join(" ")}`
      ).toBe(false);
    }
  });

  it("🔴 C3:grep 呼叫總數 ≤ 5 且與 N 無關", () => {
    const small = makeScaleRepo(3);
    const shimS = makeShim();
    expect(runChecker(small.dir, shimS.env).code).toBe(0);
    const big = makeScaleRepo(15);
    const shimB = makeShim();
    expect(runChecker(big.dir, shimB.env).code).toBe(0);
    expect(profile(shimS).greps.length).toBeLessThanOrEqual(5);
    expect(profile(shimB).greps.length).toBeLessThanOrEqual(5);
  });

  it("🔴 C4:三類 subprocess 各自的斜率 ≤ 1(N=3 → N=15)", () => {
    const small = makeScaleRepo(3);
    const shimS = makeShim();
    expect(runChecker(small.dir, shimS.env).code).toBe(0);
    const big = makeScaleRepo(15);
    const shimB = makeShim();
    expect(runChecker(big.dir, shimB.env).code).toBe(0);
    const a = profile(shimS);
    const b = profile(shimB);
    expect(
      b.patchProducing.length - a.patchProducing.length,
      "patchProducing 斜率"
    ).toBeLessThanOrEqual(1);
    expect(b.greps.length - a.greps.length, "grep 斜率").toBeLessThanOrEqual(1);
    expect(
      b.otherGit.length - a.otherGit.length,
      "otherGit 斜率"
    ).toBeLessThanOrEqual(1);
  });

  it("🔴 C5:grep 仍走 POSIX ERE,pattern 檔內容與 denylist 逐字節相同", () => {
    const { dir } = makeScaleRepo(3);
    const shim = makeShim();
    expect(runChecker(dir, shim.env).code).toBe(0);
    const p = profile(shim);
    expect(p.greps.length).toBeGreaterThan(0);
    const denyLines = readFileSync(join(dir, "scripts/deny-terms.txt"), "utf-8")
      .split("\n")
      .filter((l) => !/^\s*(#|$)/.test(l));
    for (const g of p.greps) {
      const shortFlags = g.argv.filter(
        (a) => a.startsWith("-") && !a.startsWith("--")
      );
      expect(
        shortFlags.some((f) => f.includes("E")),
        `grep 必須用 POSIX ERE:${g.argv.join(" ")}`
      ).toBe(true);
      expect(g.argv.indexOf("-f")).toBeGreaterThanOrEqual(0);
      expect(g.patternFile, "shim 應快照到 pattern 檔").not.toBe("-");
      const pats = readFileSync(g.patternFile, "utf-8")
        .split("\n")
        .filter(Boolean);
      expect(pats.length).toBeGreaterThan(0);
      for (const pat of pats) expect(denyLines).toContain(pat);
    }
  });

  it("🔴 C5p:patch producer argv 釘住 src/dst prefix 與 core.quotePath", () => {
    const { dir } = makeScaleRepo(3);
    const shim = makeShim();
    expect(runChecker(dir, shim.env).code).toBe(0);
    const p = profile(shim);
    expect(p.patchProducing.length).toBeGreaterThan(0);
    for (const c of p.patchProducing) {
      expect(c.argv).toContain("--src-prefix=a/");
      expect(c.argv).toContain("--dst-prefix=b/");
      expect(c.argv).toContain("core.quotePath=false");
    }
  });

  it("🟡 C6(implementation test,**非政策**):當前實作不使用 git show", () => {
    // ⚠️ 這條綁當前實作、不是政策正本。未來若安全地改回「每 rev 一次 git show
    //    再重用於三組 policy」,**不算違規**——以 C1 / C2a / C2b / C2d 為準。
    const { dir } = makeScaleRepo(6);
    const shim = makeShim();
    expect(runChecker(dir, shim.env).code).toBe(0);
    const p = profile(shim);
    expect(p.calls.filter((c) => gitSubcommand(c.argv) === "show").length).toBe(0);
  });
});

describe("PR A1.1 — patch 解析與分桶的 e2e 契約(disposable repo)", () => {
  const FORBIDDEN = "forbidden" + "_e2e_term";

  it("🔴 E1:特殊檔名(空白 / 非 ASCII / tab / newline)內的 forbidden → 全部抓到", () => {
    const names = [
      "src/sp ace.md",
      "src/非ASCII.md",
      "src/tab\tname.md",
      "src/nl\nname.md",
    ];
    for (const name of names) {
      // 🔴 加了再刪:工作樹乾淨 → 命中只能來自 history diff scan。
      //    留在工作樹的話 working-tree 掃描會先抓到,這條就證明不了 patch 路徑解析。
      const dir = makeRepo({
        deny: [FORBIDDEN],
        commits: [
          { message: "clean init", files: { "src/init.md": "hello\n" } },
          { message: "add polluted", files: { [name]: `${FORBIDDEN}\n` } },
          { message: "remove polluted", deletions: [name] },
        ],
      });
      writeBaselineConfig(dir, {
        schemaVersion: 1,
        sourceTermHistoryBaseline: shaAt(dir, "HEAD~2"),
      });
      const { code, out } = runChecker(dir);
      // 同 R1P2-c:斷言實際命中內容,不用會被 scanner error 誤中的那句
      expect(
        out,
        `檔名 ${JSON.stringify(name)}:必須印出實際命中的那一行`
      ).toContain(FORBIDDEN);
      expect(
        out,
        `檔名 ${JSON.stringify(name)}:解析失敗會變成掃描器錯誤,不算抓到`
      ).not.toContain("掃描器錯誤");
      expect(code, `檔名 ${JSON.stringify(name)} 內的 forbidden 應被抓到`).toBe(1);
    }
  });

  it("🔴 E2:forbidden 只出現在 FULL_EXCLUDES 路徑 → 仍放行(豁免未被誤刪)", () => {
    const dir = makeRepo({
      deny: [FORBIDDEN],
      commits: [{ message: "clean init", files: { "src/init.md": "hello\n" } }],
    });
    const baseline = shaAt(dir, "HEAD");
    writeFileSync(
      join(dir, "package-lock.json"),
      `{"x":"${FORBIDDEN}"}\n`,
      "utf-8"
    );
    execFileSync("git", ["-C", dir, "add", "-A"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "add lock"], {
      stdio: "ignore",
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: baseline,
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("history scan range: baseline..HEAD");
    expect(code).toBe(0);
  });

  it("🔴 E3:SYNTAX_EXEMPT 檔只走縮減 pattern 集(non-CA 抓、CA 字面放行)", () => {
    const SYN = "scripts/check-todos-markers.ts";
    const a = makeRepo({
      deny: [FORBIDDEN],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        { message: "pollute syntax file", files: { [SYN]: `// ${FORBIDDEN}\n` } },
      ],
    });
    writeBaselineConfig(a, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(a, "HEAD~1"),
    });
    expect(runChecker(a).code, "SYNTAX 檔內 non-CA term 必須被抓").toBe(1);

    const b = makeRepo({
      deny: [FORBIDDEN],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        {
          message: "syntax file with CA literal",
          files: { [SYN]: `// see ${PREF_PR}98765\n` },
        },
      ],
    });
    writeBaselineConfig(b, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(b, "HEAD~1"),
    });
    const rb = runChecker(b);
    expect(rb.out).not.toContain("含未知 PR/pull 引用");
    expect(rb.code, "SYNTAX 檔內 CA 字面應被縮減 pattern 集放行").toBe(0);
  });

  it("🔴 E4:刪除檔案的 commit(dst 為 /dev/null)不誤吞也不誤報", () => {
    const dir = makeRepo({
      deny: [FORBIDDEN],
      commits: [
        {
          message: "clean init",
          files: { "src/init.md": "hello\n", "src/gone.md": "bye\n" },
        },
        { message: "delete a file", deletions: ["src/gone.md"] },
        { message: "add polluted", files: { "src/p.md": `${FORBIDDEN}\n` } },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~2"),
    });
    const { code, out } = runChecker(dir);
    expect(code).toBe(1);
    expect(out).toContain("含來源專案識別詞");

    const clean = makeRepo({
      deny: [FORBIDDEN],
      commits: [
        {
          message: "clean init",
          files: { "src/init.md": "hello\n", "src/gone.md": "bye\n" },
        },
        { message: "delete a file", deletions: ["src/gone.md"] },
      ],
    });
    writeBaselineConfig(clean, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(clean, "HEAD~1"),
    });
    expect(runChecker(clean).code, "純刪除 commit 不得誤報").toBe(0);
  });

  it("🔴 E6:敵意 git config 不得覆蓋 command-local flags(乾淨 repo 必須 exit 0)", () => {
    const dir = makeRepo({
      deny: [FORBIDDEN],
      gitConfig: {
        "diff.noprefix": "true",
        "core.quotePath": "true",
        "diff.mnemonicPrefix": "true",
      },
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        {
          message: "clean special names",
          files: {
            "src/sp ace.md": "clean\n",
            "src/非ASCII.md": "clean\n",
            "src/tab\tname.md": "clean\n",
          },
        },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~1"),
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("history scan range: baseline..HEAD");
    expect(code, "釘死的 flags 應壓過使用者 config").toBe(0);
  });

  it("🔴 E6b:敵意 git config + forbidden → 仍抓得到(不因 quoting 漏掃)", () => {
    const dir = makeRepo({
      deny: [FORBIDDEN],
      gitConfig: {
        "diff.noprefix": "true",
        "core.quotePath": "true",
        "diff.mnemonicPrefix": "true",
      },
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        {
          message: "polluted special names",
          files: { "src/tab\tname.md": `${FORBIDDEN}\n` },
        },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~1"),
    });
    expect(runChecker(dir).code).toBe(1);
  });

  it("🔴 E7:含 NUL byte 的檔 + forbidden 文字行 → 仍抓(binary detection 不得短路)", () => {
    const dir = makeRepo({
      deny: [FORBIDDEN],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        {
          message: "add nul + forbidden",
          files: {
            "src/nul.bin": `head${String.fromCharCode(0)}binary\n${FORBIDDEN}\n`,
          },
        },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~1"),
    });
    expect(runChecker(dir).code).toBe(1);
  });

  it("🔴 E7b:NUL byte 檔的命中必須印出**實際內容**(釘住 grep -a)", () => {
    // ⚠️ 這條補 M7 的覆蓋缺口。只斷言 exit 1 不夠:拿掉 `-a` 之後 grep 仍會
    //    回報命中(印「Binary file ... matches」、exit 0),所以 exit code 不變、
    //    mutation 存活。真正退化的是**診斷能力**——操作者看不到命中的是什麼。
    //    因此改斷言輸出含命中內容本身。
    const dir = makeRepo({
      deny: [FORBIDDEN],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        {
          message: "add nul + forbidden",
          files: {
            "src/nul.bin": `head${String.fromCharCode(0)}binary\n${FORBIDDEN}\n`,
          },
        },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~1"),
    });
    const { code, out } = runChecker(dir);
    expect(code).toBe(1);
    expect(out).toContain("含來源專案識別詞");
    expect(
      out,
      "拿掉 grep -a 會退化成「Binary file ... matches」、印不出命中內容"
    ).toContain(FORBIDDEN);
  });

  it("🔴 N1:同 PR 洗白(A 加 forbidden、B 刪)→ per-commit diff scan 仍抓 commit A", () => {
    const dir = makeRepo({
      deny: [FORBIDDEN],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        { message: "A adds forbidden", files: { "src/w.md": `${FORBIDDEN}\n` } },
        { message: "B removes it", files: { "src/w.md": "clean now\n" } },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~2"),
    });
    const { code, out } = runChecker(dir);
    expect(code).toBe(1);
    expect(out).toContain("含來源專案識別詞");
  });

  it("🔴 N4:post-baseline 新增未知 PR 引用 → CA 桶擋;合法 self-PR → 放行", () => {
    const bad = makeRepo({
      deny: [FORBIDDEN],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        { message: "cite unknown", files: { "src/c.md": `${PREF_PR}98765 ref\n` } },
      ],
    });
    writeBaselineConfig(bad, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(bad, "HEAD~1"),
    });
    const rb = runChecker(bad);
    expect(rb.code).toBe(1);
    expect(rb.out).toContain("含未知 PR/pull 引用");

    const ok = makeRepo({
      deny: [FORBIDDEN],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        { message: "merged work (#4242)", files: { "src/d.md": "hi\n" } },
        { message: "cite self", files: { "src/c.md": `${PREF_PR}4242 ref\n` } },
      ],
    });
    writeBaselineConfig(ok, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(ok, "HEAD~2"),
    });
    const ro = runChecker(ok);
    expect(ro.out).toContain("self-PR 引用放行");
    expect(ro.code).toBe(0);
  });

  it("🔴 N6:ERE-only 構造在 diff scan 仍命中 → 沒被換成 JS regex", () => {
    const dir = makeRepo({
      deny: ["ere[[:digit:]]only"],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        { message: "add ere hit", files: { "src/e.md": "ere7only\n" } },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~1"),
    });
    expect(runChecker(dir).code).toBe(1);
  });

  it("🔴 C2c-a:baseline..HEAD 內有空 commit → 掃描不因缺 patch 而失敗", () => {
    const dir = makeRepo({
      deny: [FORBIDDEN],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        { message: "empty commit" },
        { message: "another clean", files: { "src/z.md": "z\n" } },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~2"),
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("history scan range: baseline..HEAD");
    expect(code, "空 commit 必須有 separator、不得被判成串流缺 rev").toBe(0);
  });
});

// ═══════════ PR A1.1 F1:patch parser / separator / 分桶的純函式與注入式契約 ═══════════

const TAB = String.fromCharCode(9);
const NUL = String.fromCharCode(0);

describe("PR A1.1 — stripExcludeMagic(pathspec magic 正規化,S-1)", () => {
  it("U12a:`:!X` 與 `:(exclude)X` → 裸路徑;裸路徑原樣", () => {
    expect(stripExcludeMagic(":!package-lock.json")).toBe("package-lock.json");
    expect(stripExcludeMagic(":(exclude)scripts/a.ts")).toBe("scripts/a.ts");
    expect(stripExcludeMagic("scripts/a.ts")).toBe("scripts/a.ts");
  });

  it("🔴 U12b:未知 pathspec magic → throw(不得靜默當字面路徑)", () => {
    expect(() => stripExcludeMagic(":(glob)docs/**")).toThrow(/不支援的 pathspec magic/);
    expect(() => stripExcludeMagic(":/anything")).toThrow(/不支援的 pathspec magic/);
  });

  it("🔴 S-2 漂移守門:SYNTAX_EXEMPT_FILES ⊆ 正規化後的 FULL_EXCLUDES(兩桶互斥)", () => {
    const ex = new Set(FULL_EXCLUDES.map(stripExcludeMagic));
    for (const f of SYNTAX_EXEMPT_FILES) {
      expect(
        ex.has(f),
        `${f} 必須同時在 FULL_EXCLUDES 內,否則 main 桶與 syntax 桶會雙掃該檔`
      ).toBe(true);
    }
  });
});

describe("PR A1.1 — decodeGitCQuote / parsePatchDstPath(U1-U9)", () => {
  it("U1:一般路徑 `+++ b/plain.txt`", () => {
    expect(parsePatchDstPath("+++ b/plain.txt")).toEqual({
      kind: "path",
      path: "plain.txt",
    });
  });

  it("🔴 U2:含空白的檔名帶尾端 TAB(git 追加的分隔符)→ 只 strip 一個 TAB", () => {
    expect(parsePatchDstPath(`+++ b/sp ace.txt${TAB}`)).toEqual({
      kind: "path",
      path: "sp ace.txt",
    });
  });

  it("🔴 U3:C-quoted tab 檔名 → 解回真實檔名", () => {
    expect(parsePatchDstPath('+++ "b/tab\\tname.txt"')).toEqual({
      kind: "path",
      path: `tab${TAB}name.txt`,
    });
  });

  it("🔴 U4:C-quoted newline 檔名 → 解回真實檔名", () => {
    expect(parsePatchDstPath('+++ "b/nl\\nname.txt"')).toEqual({
      kind: "path",
      path: "nl\nname.txt",
    });
  });

  it("🔴 U5:C-quoted 非 ASCII(八進位序列)→ 以 UTF-8 整批解,不逐 byte 轉字元", () => {
    // "非" = E9 9D 9E,"A" = 41
    expect(decodeGitCQuote('"b/\\351\\235\\236A.txt"')).toBe("b/非A.txt");
    expect(parsePatchDstPath('+++ "b/\\351\\235\\236A.txt"')).toEqual({
      kind: "path",
      path: "非A.txt",
    });
  });

  it("U6:`+++ /dev/null` → deleted", () => {
    expect(parsePatchDstPath("+++ /dev/null")).toEqual({ kind: "deleted" });
  });

  it("🔴 U7:缺 dst-prefix(diff.noprefix 釘法失效)→ throw,不得當空 section", () => {
    expect(() => parsePatchDstPath("+++ sp ace.txt")).toThrow(/缺 dst-prefix/);
    expect(() => parsePatchDstPath("+++ zz/other.txt")).toThrow(/缺 dst-prefix/);
  });

  it("🔴 U8:C-quote 引號未閉合 → throw", () => {
    expect(() => parsePatchDstPath('+++ "b/unterminated.txt')).toThrow(
      /引號未閉合|缺 dst-prefix/
    );
    expect(() => decodeGitCQuote('"b/x')).toThrow(/引號未閉合/);
  });

  it("🔴 U9:未知 escape / 八進位不完整 → throw", () => {
    expect(() => decodeGitCQuote('"b/x\\q.txt"')).toThrow(/未知 escape/);
    expect(() => decodeGitCQuote('"b/x\\12"')).toThrow(/八進位 escape 不完整/);
  });

  it("U9b:支援的簡單 escape 全解得開", () => {
    expect(decodeGitCQuote('"b/a\\\\b\\"c.txt"')).toBe('b/a\\b"c.txt');
  });
});

describe("PR A1.1 — extractAddedLinesByPath(U10 / U11 / U-equiv)", () => {
  const realistic = (path: string, lines: string[]): string =>
    [
      `diff --git a/${path} b/${path}`,
      "index 0000000..1111111 100644",
      `--- a/${path}`,
      `+++ b/${path}`,
      "@@ -0,0 +1 @@",
      ...lines.map((l) => `+${l}`),
    ].join("\n");

  it("按檔案分組,strip 一個 `+`", () => {
    const patch = [realistic("x.md", ["foo"]), realistic("y.md", ["bar", "baz"])].join(
      "\n"
    );
    const m = extractAddedLinesByPath(patch);
    expect(m.get("x.md")).toEqual(["foo"]);
    expect(m.get("y.md")).toEqual(["bar", "baz"]);
  });

  it("🔴 U10:hunk 內容行長得像檔頭(diff --git / +++ b/x / @@)→ 當內容不誤判", () => {
    const patch = [
      "diff --git a/x.md b/x.md",
      "--- a/x.md",
      "+++ b/x.md",
      "@@ -0,0 +3 @@",
      "++++ b/fake.md",
      "+diff --git a/fake b/fake",
      "+@@ fake hunk @@",
    ].join("\n");
    const m = extractAddedLinesByPath(patch);
    expect(m.get("x.md")).toEqual([
      "+++ b/fake.md",
      "diff --git a/fake b/fake",
      "@@ fake hunk @@",
    ]);
    expect(m.has("fake.md")).toBe(false);
  });

  it("🔴 U11:hunk 新增行歸屬不明(缺 +++ 檔頭 / dst 是 /dev/null)→ throw", () => {
    const noHeader = ["diff --git a/x b/x", "@@ -1 +1 @@", "+orphan"].join("\n");
    expect(() => extractAddedLinesByPath(noHeader)).toThrow(/無法歸屬/);
    const deleted = [
      "diff --git a/x b/x",
      "--- a/x",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "+impossible",
    ].join("\n");
    expect(() => extractAddedLinesByPath(deleted)).toThrow(/無法歸屬/);
  });

  it("刪除 section(+++ /dev/null)只有 `-` 行 → 不產生任何桶內容", () => {
    const patch = [
      "diff --git a/gone.md b/gone.md",
      "--- a/gone.md",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-bye",
    ].join("\n");
    expect(extractAddedLinesByPath(patch).size).toBe(0);
  });

  it("🔴 U-equiv:與 differential oracle extractAddedLinesFromPatch 產出同一組新增行", () => {
    // 兩套狀態機(舊 oracle 無路徑歸屬 / 新解析器有)必須對同一份 patch 得到同樣的
    // 新增行集合,否則就是漂移。用 realistic patch(帶 +++ 檔頭)比對。
    const patches = [
      realistic("x.md", ["foo"]),
      [realistic("x.md", ["a", "b"]), realistic("y.md", ["c"])].join("\n"),
      [
        "diff --git a/x.md b/x.md",
        "--- a/x.md",
        "+++ b/x.md",
        "@@ -1,3 +1,2 @@",
        " context",
        "-deleted",
        "+added",
      ].join("\n"),
      [
        "diff --git a/x.md b/x.md",
        "--- a/x.md",
        "+++ b/x.md",
        "@@ -1 +1 @@",
        "++foo",
      ].join("\n"),
    ];
    for (const p of patches) {
      const viaOracle = extractAddedLinesFromPatch(p)
        .split("\n")
        .filter((l) => l.length > 0)
        .sort();
      const viaNew = [...extractAddedLinesByPath(p).values()]
        .flat()
        .filter((l) => l.length > 0)
        .sort();
      expect(viaNew).toEqual(viaOracle);
    }
  });
});

describe("PR A1.1 — bucketAddedLines(C7:一份 extraction 同時產出兩桶)", () => {
  it("🔴 C7:單次輸入 → main 桶與 syntax 桶,三組 policy 共用同一份 extraction", () => {
    const excludes = FULL_EXCLUDES.map(stripExcludeMagic);
    const byPath = new Map<string, string[]>([
      ["src/normal.md", ["normal line"]],
      ["package-lock.json", ["excluded line"]],
      ["scripts/check-todos-markers.ts", ["syntax line"]],
    ]);
    const { main, syntax } = bucketAddedLines(byPath, excludes, SYNTAX_EXEMPT_FILES);
    expect(main).toEqual(["normal line"]);
    expect(syntax).toEqual(["syntax line"]);
    // 豁免路徑不進任何桶;syntax 檔不進 main 桶(兩桶互斥)
    expect(main).not.toContain("excluded line");
    expect(main).not.toContain("syntax line");
  });
});

describe("PR A1.1 — splitPatchStream fail-closed(N8c 純函式矩陣)", () => {
  const M = "MARK";
  const R1 = "a".repeat(40);
  const R2 = "b".repeat(40);

  it("正常:兩個 rev 各自切段", () => {
    const stream = [`${M} ${R1}`, "patch one", `${M} ${R2}`, "patch two"].join("\n");
    const m = splitPatchStream(stream, [R1, R2], M);
    expect(m.get(R1)).toBe("patch one");
    expect(m.get(R2)).toBe("patch two");
  });

  it("🔴 規則 1:第一個 separator 之前有未歸屬內容 → throw", () => {
    const stream = ["stray bytes", `${M} ${R1}`, "patch"].join("\n");
    expect(() => splitPatchStream(stream, [R1], M)).toThrow(/未歸屬內容/);
  });

  it("🔴 規則 2:未預期的 rev separator → throw", () => {
    const stream = [`${M} ${R1}`, "patch", `${M} ${R2}`, "other"].join("\n");
    expect(() => splitPatchStream(stream, [R1], M)).toThrow(/未預期的 rev separator/);
  });

  it("🔴 規則 3:同一 rev 的 separator 重複 → throw", () => {
    const stream = [`${M} ${R1}`, "patch", `${M} ${R1}`, "again"].join("\n");
    expect(() => splitPatchStream(stream, [R1], M)).toThrow(/separator 重複/);
  });

  it("🔴 規則 4:marker 開頭但格式損壞(SHA 非 40-hex / 有尾隨內容)→ throw", () => {
    expect(() => splitPatchStream(`${M} notasha`, [R1], M)).toThrow(/格式損壞/);
    expect(() => splitPatchStream(`${M} ${R1} trailing`, [R1], M)).toThrow(
      /格式損壞/
    );
  });

  it("🔴 規則 5:缺少某個 expected rev 的 separator → throw", () => {
    const stream = [`${M} ${R1}`, "patch"].join("\n");
    expect(() => splitPatchStream(stream, [R1, R2], M)).toThrow(/缺少 1 個 rev/);
  });

  it("空 patch(空 commit)仍算有 separator、不判成缺 rev", () => {
    const stream = [`${M} ${R1}`, "", `${M} ${R2}`, ""].join("\n");
    const m = splitPatchStream(stream, [R1, R2], M);
    expect(m.size).toBe(2);
  });
});

// ─────────── 注入式契約:E5 / N2 / N8a / N8b(真 repo、真 git,走匯出函式) ───────────

function writePatterns(patterns: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "cnst-pat-"));
  created.push(dir);
  const f = join(dir, "patterns");
  writeFileSync(f, patterns.join("\n") + "\n", "utf-8");
  return f;
}

/** 直接跑 diff scan(可注入 batchSize / marker / prefix),回傳全部 Scan。 */
function runDiffScan(
  dir: string,
  patterns: string[],
  baseline: string,
  opts: Parameters<typeof scanBaselineToHeadDiffs>[5]
) {
  const f = writePatterns(patterns);
  return scanBaselineToHeadDiffs(dir, f, null, null, baseline, opts);
}

describe("PR A1.1 — 注入式 fail-closed 與批次邊界(真 repo)", () => {
  const FORB = "forbidden" + "_inj_term";

  it("🔴 E5:dst-prefix 釘法失效 → patch 路徑解析 fail-closed(rc=2),不得靜默當乾淨", () => {
    const dir = makeRepo({
      deny: [FORB],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        { message: "add polluted", files: { "src/p.md": `${FORB}\n` } },
      ],
    });
    const baseline = shaAt(dir, "HEAD~1");

    // 對照組:預設(釘住 b/)→ 抓得到
    const ok = runDiffScan(dir, [FORB], baseline, {});
    expect(ok.some((s) => s.rc === 0 && s.hits.length > 0), "預設應抓到").toBe(true);

    // 注入:dst-prefix 變成 zz/ → 解析器認不得 → **必須 rc=2**(不是 rc=1 乾淨)
    const bad = runDiffScan(dir, [FORB], baseline, { dstPrefix: "zz/" });
    expect(bad.length).toBeGreaterThan(0);
    expect(
      bad.every((s) => s.rc === 2),
      `路徑解析失敗必須 fail-closed;實得 ${JSON.stringify(bad.map((s) => s.rc))}`
    ).toBe(true);
    // 呼叫點守門:rc=2 → processScan 判失敗
    for (const s of bad) expect(processScan(s, new Set())).toBe(false);
  });

  it("🔴 N2:批次邊界(batchSize=3)——forbidden 落在某批最後 / 下批第一 / 最末批都抓得到", () => {
    for (const k of [2, 3, 6]) {
      const commits: Array<{ message: string; files?: Record<string, string> }> = [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
      ];
      for (let i = 6; i >= 0; i--) {
        commits.push({
          message: `commit ${i}`,
          files: {
            [`src/c${i}.md`]: i === k ? `${FORB}\n` : `clean ${i}\n`,
          },
        });
      }
      const dir = makeRepo({ deny: [FORB], commits });
      const baseline = shaAt(dir, "HEAD~7");
      const scans = runDiffScan(dir, [FORB], baseline, { batchSize: 3 });
      expect(
        scans.some((s) => s.rc === 0 && s.hits.length > 0),
        `HEAD~${k} 的 forbidden 應被抓到(batchSize=3)`
      ).toBe(true);
      // 沒有任何 scanner error
      expect(scans.every((s) => s.rc !== 2)).toBe(true);
    }
  });

  it("🔴 N8a:blob 新增行模仿 separator(未知 rev)→ fail-closed", () => {
    const fake = "c".repeat(40);
    const dir = makeRepo({
      deny: [FORB],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        { message: "mimic separator", files: { "src/m.md": `MARK ${fake}\n` } },
      ],
    });
    const baseline = shaAt(dir, "HEAD~1");
    const scans = runDiffScan(dir, [FORB], baseline, { marker: "+MARK" });
    expect(scans.length).toBeGreaterThan(0);
    expect(
      scans.every((s) => s.rc === 2),
      "模仿 separator 必須 fail-closed,不得 silent split / skip"
    ).toBe(true);
  });

  it("🔴 N8b:blob 新增行模仿成真 rev 的 separator(重複)→ fail-closed", () => {
    const dir = makeRepo({
      deny: [FORB],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        { message: "target", files: { "src/t.md": "target\n" } },
      ],
    });
    const baseline = shaAt(dir, "HEAD~1");
    const realRev = shaAt(dir, "HEAD");
    writeFileSync(join(dir, "src/m.md"), `MARK ${realRev}\n`, "utf-8");
    execFileSync("git", ["-C", dir, "add", "-A"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "mimic real rev"], {
      stdio: "ignore",
    });
    const scans = runDiffScan(dir, [FORB], baseline, { marker: "+MARK" });
    expect(scans.length).toBeGreaterThan(0);
    expect(scans.every((s) => s.rc === 2), "重複 separator 必須 fail-closed").toBe(
      true
    );
  });

  it("🔴 N8d:呼叫點守門——scanner error(rc=2)一律判失敗;rc=1 才是乾淨", () => {
    const base = { label: "x", mode: "strict" as const, hits: [], framing: "diff-prefixed" as const };
    expect(processScan({ ...base, rc: 2 }, new Set())).toBe(false);
    expect(processScan({ ...base, rc: 1 }, new Set())).toBe(true);
  });

  it("🔴 含 NUL byte 的新增行仍走 grep -a(不因 binary detection 短路)", () => {
    const dir = makeRepo({
      deny: [FORB],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        {
          message: "nul + forbidden",
          files: { "src/n.bin": `a${NUL}b\n${FORB}\n` },
        },
      ],
    });
    const scans = runDiffScan(dir, [FORB], shaAt(dir, "HEAD~1"), {});
    expect(scans.some((s) => s.rc === 0 && s.hits.length > 0)).toBe(true);
  });
});

// ══════════ Codex round 1 findings — 回歸契約 ══════════

describe("R1 P1 — aggregate diff hit 的 framing(未知 PR 引用不得被丟掉)", () => {
  const NUL0 = String.fromCharCode(0);
  // Codex 復現用的那一行:NUL 前是未知號、冒號後是合法 self-PR 號
  const EVIL_CONTENT = `${PREF_PR}999${NUL0}x:${PREF_PR}40`;

  it("🔴 R1P1-a:diff-prefixed framing 只剝我們自己加的前綴,content 內的 NUL 是資料", () => {
    const raw = `deadbeef${DIFF_HIT_MARK}${EVIL_CONTENT}`;
    expect(hitContent(raw, "diff-prefixed")).toBe(EVIL_CONTENT);
    // 未知號必須留在 content 內,否則 self-PR 判定看不到它
    expect(hitContent(raw, "diff-prefixed")).toContain("999");
  });

  it("🔴 R1P1-b:consumer 契約——未知引用不得被丟掉(processScan 必須判失敗)", () => {
    const raw = `deadbeef${DIFF_HIT_MARK}${EVIL_CONTENT}`;
    expect(
      processScan(
        { label: "史", mode: "self-pr", hits: [raw], rc: 0, framing: "diff-prefixed" },
        new Set([40])
      ),
      "NUL 前的未知 PR 號被當成 grep -Z 檔名丟掉 → 假放行"
    ).toBe(false);
  });

  it("🔴 R1P1-c:真正 NUL-framed 的 hit(grep -z)仍照舊正確解析", () => {
    // 真實格式:`path<NUL>行號<NUL>內容`(兩個 NUL)——前兩段是 grep 的框架,不是資料
    const raw = `docs/a.md${NUL0}12${NUL0}${PREF_PR}40 ref`;
    expect(hitContent(raw, "grep-z")).toBe(`${PREF_PR}40 ref`);
    expect(
      processScan(
        { label: "工作樹", mode: "self-pr", hits: [raw], rc: 0, framing: "grep-z" },
        new Set([40])
      )
    ).toBe(true);
  });

  it("🔴 R1P1-d:e2e 洗白負對照——A 加「未知號 + NUL + 合法號」、B 刪除 → 必須擋且揭露未知號", () => {
    const dir = makeRepo({
      deny: ["forbidden_r1p1_term"],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        // 讓 allowedPrs 含 40(canonical squash 尾綴)
        { message: "merged work (#40)", files: { "src/m.md": "merged\n" } },
        {
          message: "A adds mixed reference",
          files: { "src/w.md": `${EVIL_CONTENT}\n` },
        },
        { message: "B removes it", files: { "src/w.md": "clean now\n" } },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~2"),
    });
    const { code, out } = runChecker(dir);
    // current tree 乾淨、commit 訊息乾淨 —— 只有 history diff scan 抓得到
    expect(out).toContain("history scan range: baseline..HEAD");
    expect(out, "未知 PR 引用必須被揭露").toContain("999");
    expect(out).toContain("含未知 PR/pull 引用");
    expect(code, "A→B 洗白必須擋下").toBe(1);
  });
});

describe("R1 延伸 — working-tree / history-tree CA 掃描的冒號截斷假放行", () => {
  it("🔴 R1P1-e:工作樹一行「未知號 + 冒號 + 合法號」→ 必須擋(可達的 e2e 負對照)", () => {
    const dir = makeRepo({
      deny: ["forbidden_r1e_term"],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        { message: "merged work (#40)", files: { "src/m.md": "merged\n" } },
      ],
      workingTree: {
        // 內容的第一個冒號在未知號之後:用冒號切內容會只剩「also PR 井號 40」
        "src/note.md": `${PREF_PR}999 ref: also ${PREF_PR}40\n`,
      },
    });
    const { code, out } = runChecker(dir);
    expect(out, "未知 PR 引用必須被揭露").toContain("999");
    expect(out).toContain("含未知 PR/pull 引用");
    expect(code).toBe(1);
  });

  it("🔴 R1P1-f:同一行在 history blob(HEAD 已清乾淨)也要擋", () => {
    const dir = makeRepo({
      deny: ["forbidden_r1f_term"],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        { message: "merged work (#40)", files: { "src/m.md": "merged\n" } },
        {
          message: "A adds",
          files: { "src/w.md": `${PREF_PR}999 ref: also ${PREF_PR}40\n` },
        },
        { message: "B cleans", files: { "src/w.md": "clean\n" } },
      ],
    });
    // 不設 baseline → 走全史 tree scan(git grep -z 路徑)
    const { code, out } = runChecker(dir);
    expect(out).toContain("999");
    expect(out).toContain("含未知 PR/pull 引用");
    expect(code).toBe(1);
  });
});

describe("R1 P2 — producer 不得走有上限的記憶體 buffer(排除路徑不得變成 false-red)", () => {
  it("🔴 R1P2-a:只動 FULL_EXCLUDES 路徑的大 patch → 仍判乾淨(政策豁免不得被判紅)", () => {
    // ⚠️ 本條是 CI-practical 的回歸 fixture(3 MiB,秒級)。它證明「豁免路徑的大
    //    改動判乾淨」,但**不足以單獨證明沒有記憶體上限**——那由 R1P2-b 的
    //    fd 型別契約守(有上限的實作會把 stdout 收進 pipe)。兩條合起來才完整。
    const big = "x".repeat(3 * 1024 * 1024);
    const dir = makeRepo({
      deny: ["forbidden_r1p2_term"],
      commits: [{ message: "clean init", files: { "src/init.md": "hello\n" } }],
    });
    const baseline = shaAt(dir, "HEAD");
    writeFileSync(join(dir, "package-lock.json"), `{"x":"${big}"}\n`, "utf-8");
    execFileSync("git", ["-C", dir, "add", "-A"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "huge excluded churn"], {
      stdio: "ignore",
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: baseline,
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("history scan range: baseline..HEAD");
    expect(code, "只動豁免路徑的 commit 不得讓 gate 轉紅").toBe(0);
  });

  it("🔴 R1P2-b:patch producer 的 stdout 必須接檔案 fd,不得是 pipe(無上限記憶體 buffer)", () => {
    const { dir } = makeScaleRepo(3);
    const shim = makeShim();
    expect(runChecker(dir, shim.env).code).toBe(0);
    const p = profile(shim);
    expect(p.patchProducing.length).toBeGreaterThan(0);
    for (const c of p.patchProducing) {
      expect(
        c.fd1,
        `patch producer 的 stdout 型別=${c.fd1};pipe 代表回到有上限的記憶體 buffer`
      ).toBe("file");
    }
  });

  it("🔴 R1P2-c:新增行跨越 flush 門檻與讀取 chunk 邊界時,末尾內容仍被掃到", () => {
    const FORB = "forbidden" + "_r1p2c_term";
    // 三個邊界一起打:
    //   ① BUCKET_FLUSH_LINES = 2048 → 40000 行跨多次 flush
    //   ② 讀取 chunk = 1 MiB → ~2.6 MiB 的 patch 跨多個 chunk(只讀第一塊會截斷)
    //   ③ 非 ASCII 內容 → chunk 邊界大機率切在多位元組序列中間(StringDecoder 要接住)
    // forbidden 放最後一行:任何截斷或邊界解碼錯誤都會讓它漏掃。
    const body = Array.from(
      { length: 40000 },
      (_, i) => `第 ${i} 行 padding 中文內容 abcdefghijklmnop`
    ).join("\n");
    // 🔴 加了再刪:current tree 與 commit 訊息都乾淨,**只有 history diff scan**
    //    看得到那一行。若把檔案留在工作樹,working-tree 掃描會先抓到、exit 1,
    //    這條測試就對「diff scan 有沒有讀完串流」完全不敏感(M14 因此存活過一輪)。
    const dir = makeRepo({
      deny: [FORB],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        { message: "huge scanned add", files: { "src/big.md": `${body}\n${FORB}\n` } },
        { message: "remove it", deletions: ["src/big.md"] },
      ],
    });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~2"),
    });
    const { code, out } = runChecker(dir);
    expect(out).toContain("history scan range: baseline..HEAD");
    // ⚠️ 不能斷言「git 歷史 blob 含來源專案識別詞」——那是 main() 那句
    //    「…或掃描錯誤」的子字串,scanner error 路徑也會命中、無法分辨。
    //    要斷言**實際命中的內容**,並排除掃描器錯誤。
    expect(out, "必須印出實際命中的那一行,而不是掃描器錯誤").toContain(FORB);
    expect(out, "串流被截斷會變成 separator 缺 rev 的掃描器錯誤").not.toContain(
      "掃描器錯誤"
    );
    expect(code, "跨 flush 門檻與 chunk 邊界的最後一行必須仍被掃到").toBe(1);
  });
});

// ─────────── R2 P2-1:單一超長邏輯行不得整行進記憶體 ───────────
//
// 🔴 R1 只把 producer 的 256 MiB maxBuffer 拿掉,消費端仍是「累積完整邏輯行才處理」。
//    只動 FULL_EXCLUDES 路徑、且該檔被編碼成單一超長行的 commit,會把 pendingText
//    推過 Node 的 MAX_STRING_LENGTH → throw → rc=2 → 政策豁免的改動被判紅。
//    false-red 只是從 producer 位移到消費端。
//
// ⚠️ 回歸測試用**注入的小門檻**(64 KiB)+ 數 MiB 的行構造這個形狀:真的造一條
//    536 MB 的行才能觸發原生上限,那在 CI 不實際。可觀測量是「單行峰值位元組數」,
//    整行累積的實作必然讓峰值逼近整行長度 → M16 被抓。

describe("R2 P2-1 — 排除路徑的單一超長行(false-red 位移)", () => {
  const PROBE = 64 * 1024;

  it("🔴 R2P2-a:只動排除路徑的超長單行 → 判乾淨,且單行峰值有界", () => {
    const LINE_BYTES = 8 * 1024 * 1024;
    const FORB = "forbidden" + "_r2p21a_term";
    const dir = makeRepo({
      deny: [FORB],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        {
          message: "lockfile v1",
          files: { "package-lock.json": `{"pad":"${"a".repeat(LINE_BYTES)}"}\n` },
        },
      ],
    });
    const baseline = shaAt(dir, "HEAD");
    // post-baseline 只改同一個排除路徑 → patch 內同時有超長的 `-` 與 `+` 兩行。
    writeFileSync(
      join(dir, "package-lock.json"),
      `{"pad":"${"b".repeat(LINE_BYTES)}"}\n`,
      "utf-8"
    );
    execFileSync("git", ["-C", dir, "add", "-A"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "lockfile v2"], {
      stdio: "ignore",
    });

    const seen: DiffStreamStats[] = [];
    const scans = runDiffScan(dir, [FORB], baseline, {
      longLineProbeBytes: PROBE,
      onStreamStats: (st) => seen.push(st),
    });

    expect(
      scans.every((sc) => sc.hits.length === 0),
      "政策明文豁免的路徑不得產生命中"
    ).toBe(true);
    expect(seen.length, "串流統計觀測器必須被呼叫").toBe(1);
    expect(
      seen[0].droppedLongLines,
      "排除路徑的超長 `-` 與 `+` 兩行都必須被增量丟棄"
    ).toBeGreaterThanOrEqual(2);
    expect(
      seen[0].peakPendingLineBytes,
      `單行峰值 ${seen[0].peakPendingLineBytes} B;整行累積會逼近 ${LINE_BYTES} B`
    ).toBeLessThan(2 * 1024 * 1024);
  });

  it("🔴 R2P2-b:被掃路徑的超長行**不得**被丟(丟了就是漏掃)", () => {
    const LINE_BYTES = 4 * 1024 * 1024;
    const FORB = "forbidden" + "_r2p21b_term";
    // forbidden 放在超長行的**最尾端**:任何提前丟棄都會讓它消失。
    const dir = makeRepo({
      deny: [FORB],
      commits: [
        { message: "clean init", files: { "src/init.md": "hello\n" } },
        {
          message: "long scanned line",
          files: { "src/long.md": `${"a".repeat(LINE_BYTES)}${FORB}\n` },
        },
      ],
    });
    const baseline = shaAt(dir, "HEAD~1");

    const seen: DiffStreamStats[] = [];
    const scans = runDiffScan(dir, [FORB], baseline, {
      longLineProbeBytes: PROBE,
      onStreamStats: (st) => seen.push(st),
    });

    expect(seen[0].droppedLongLines, "被掃路徑的內容行一行都不得丟").toBe(0);
    expect(
      scans.some((sc) => sc.rc === 0 && sc.hits.join("\n").includes(FORB)),
      "超長行尾端的 forbidden 必須仍被抓到"
    ).toBe(true);
  });
});

describe("R2 P2-1 U13 — canDropLongPatchLine 判定矩陣", () => {
  const ex = new Set(FULL_EXCLUDES.map(stripExcludeMagic));
  const syn = new Set(SYNTAX_EXEMPT_FILES);
  const EXCLUDED = "package-lock.json";
  const SYNTAX = SYNTAX_EXEMPT_FILES[0];

  const st = (
    current: { kind: "path"; path: string } | { kind: "deleted" } | null,
    inHunk = true
  ) => {
    const s = newPatchLineState();
    s.inHunk = inHunk;
    s.current = current;
    return s;
  };
  const atPath = (p: string) => ({ kind: "path" as const, path: p });

  it("非 hunk 內的行一律保留(檔頭與 separator 都在這裡)", () => {
    expect(canDropLongPatchLine(st(atPath(EXCLUDED), false), "+x", ex, syn)).toBe(false);
    expect(canDropLongPatchLine(st(null, false), "+++ b/x", ex, syn)).toBe(false);
  });

  it("會改變狀態機狀態的前綴一律保留", () => {
    expect(canDropLongPatchLine(st(atPath(EXCLUDED)), "diff --git a/x b/x", ex, syn)).toBe(false);
    expect(canDropLongPatchLine(st(atPath(EXCLUDED)), "@@ -0,0 +1 @@", ex, syn)).toBe(false);
  });

  it("hunk 內非 `+` 開頭(刪除行)可丟:stepPatchLine 直接忽略且不改狀態", () => {
    expect(canDropLongPatchLine(st(atPath(EXCLUDED)), "-old", ex, syn)).toBe(true);
    expect(canDropLongPatchLine(st(atPath("src/a.md")), "-old", ex, syn)).toBe(true);
  });

  it("hunk 內新增行:排除路徑可丟,被掃路徑不可丟", () => {
    expect(canDropLongPatchLine(st(atPath(EXCLUDED)), "+x", ex, syn)).toBe(true);
    expect(canDropLongPatchLine(st(atPath("src/a.md")), "+x", ex, syn)).toBe(false);
  });

  it("syntax 例外檔仍屬 syntax 桶 → 不可丟", () => {
    expect(bucketsOfPathIsSyntaxOnly(SYNTAX, ex, syn)).toBe(true);
    expect(canDropLongPatchLine(st(atPath(SYNTAX)), "+x", ex, syn)).toBe(false);
  });

  it("路徑不明(null / deleted)一律保留:stepPatchLine 要 fail-closed throw", () => {
    expect(canDropLongPatchLine(st(null), "+x", ex, syn)).toBe(false);
    expect(canDropLongPatchLine(st({ kind: "deleted" }), "+x", ex, syn)).toBe(false);
  });
});

/** SYNTAX 例外檔的前提:它在 FULL_EXCLUDES 內、只屬 syntax 桶(S-2 的局部複述)。 */
function bucketsOfPathIsSyntaxOnly(
  p: string,
  ex: Set<string>,
  syn: Set<string>
): boolean {
  return ex.has(p) && syn.has(p);
}

// ─────────── Step 5 CRITICAL:merge-diff 格式不得被 git config 反轉 ───────────
//
// 🔴 `-m` 只是「用預設 merge-diff 格式」。預設值由 `log.diffMerges` 決定(git ≥ 2.32),
//    所以 repo / 使用者 config 就能把 round 3 P2 的修法整條反轉:merge commit 變
//    `diff --cc`、新增行帶兩個 `+`,strip 一個之後帶錨的 pattern 不 match → 假放行。
//    E6/E6b 守的是 `diff.noprefix` / `core.quotePath` 兩條,漏了這一條。

describe("Step 5 CRITICAL — 敵意 log.diffMerges 不得讓 merge commit 假放行", () => {
  /** 建一個「merge commit 引入 forbidden、後續刪除」的 repo(語意同 P1zz4)。 */
  const makeMergeRepo = (deny: string, gitConfig?: Record<string, string>) => {
    const dir = makeRepo({
      deny: [deny],
      commits: [{ message: "baseline", files: { "src/base.md": "hello\n" } }],
      gitConfig,
    });
    execFileSync("git", ["-C", dir, "checkout", "-q", "-b", "side"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "--allow-empty", "-qm", "side commit"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "checkout", "-q", "main"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "--allow-empty", "-qm", "main commit"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "merge", "--no-ff", "-q", "-m", "merge side", "side"], { stdio: "ignore" });
    writeFileSync(join(dir, "src/base.md"), `hello\n${deny.replace("^", "")} added in merge\n`, "utf-8");
    execFileSync("git", ["-C", dir, "add", "src/base.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "--amend", "--no-edit", "-q"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "rm", "-q", "src/base.md"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "remove base"], { stdio: "ignore" });
    writeBaselineConfig(dir, {
      schemaVersion: 1,
      sourceTermHistoryBaseline: shaAt(dir, "HEAD~3"),
    });
    return dir;
  };

  it("🔴 S5C2:repo config log.diffMerges=dense-combined 仍要抓到 merge 引入的 forbidden", () => {
    const DENY = "^forbidden" + "_s5merge_term";
    const dir = makeMergeRepo(DENY, { "log.diffMerges": "dense-combined" });
    const { code, out } = runChecker(dir);
    expect(out, "命中內容要印出來,不能只是掃描器錯誤").toContain("added in merge");
    expect(out, "串流/解析錯誤會變掃描器錯誤,不算這條測到的東西").not.toContain("掃描器錯誤");
    expect(code, "敵意 log.diffMerges 不得讓 merge commit 的新增行變綠").toBe(1);
  });

  it("🔴 S5C2b:combined 與 remerge 兩種值也一樣擋", () => {
    for (const v of ["combined", "remerge"]) {
      const DENY = "^forbidden" + "_s5merge_term";
      const dir = makeMergeRepo(DENY, { "log.diffMerges": v });
      expect(runChecker(dir).code, `log.diffMerges=${v} 不得假放行`).toBe(1);
    }
  });
});

// ─────────── Step 5 INFORMATIONAL:釘住 production 的長行門檻預設值 ───────────
//
// 🔴 docstring 宣稱「production 一律走預設值(契約 C5p 守這件事)」,但 C5p 只斷言
//    argv 內的三個 prefix / quotePath 釘法。`longLineProbeBytes` 不出現在 argv,
//    而 R2P2-a / R2P2-b 都**自己注入** 64 KiB 探測值 —— 把
//    `LONG_LINE_PROBE_BYTES` 改成 Number.MAX_SAFE_INTEGER 等於靜默撤銷 R2 修法,
//    兩條回歸都不會轉紅。以下兩條**不注入門檻**,用可觀測的 droppedLongLines
//    把預設值夾在 (512 KiB, 3 MiB) 之間。

describe("Step 5 — production 長行門檻預設值(不注入,夾住)", () => {
  /** 造一個「post-baseline 只動排除路徑、內容是單一長行」的 repo。 */
  const makeExcludedLongLineRepo = (lineBytes: number, forb: string) => {
    const dir = makeRepo({
      deny: [forb],
      commits: [{ message: "clean init", files: { "src/init.md": "hello\n" } }],
    });
    const baseline = shaAt(dir, "HEAD");
    writeFileSync(
      join(dir, "package-lock.json"),
      `{"pad":"${"a".repeat(lineBytes)}"}\n`,
      "utf-8"
    );
    execFileSync("git", ["-C", dir, "add", "-A"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "commit", "-qm", "lockfile churn"], { stdio: "ignore" });
    return { dir, baseline };
  };

  it("🔴 S5D1:512 KiB 的排除路徑長行**不**該被丟(門檻不得被調得太小)", () => {
    const FORB = "forbidden" + "_s5d1_term";
    const { dir, baseline } = makeExcludedLongLineRepo(512 * 1024, FORB);
    const seen: DiffStreamStats[] = [];
    runDiffScan(dir, [FORB], baseline, { onStreamStats: (st) => seen.push(st) });
    expect(seen.length, "觀測器必須被呼叫").toBe(1);
    expect(
      seen[0].droppedLongLines,
      "512 KiB 低於 production 門檻(1 MiB),不該進丟棄分支"
    ).toBe(0);
  });

  it("🔴 S5D2:3 MiB 的排除路徑長行**必須**被丟(門檻不得被撤銷)", () => {
    const FORB = "forbidden" + "_s5d2_term";
    const { dir, baseline } = makeExcludedLongLineRepo(3 * 1024 * 1024, FORB);
    const seen: DiffStreamStats[] = [];
    const scans = runDiffScan(dir, [FORB], baseline, {
      onStreamStats: (st) => seen.push(st),
    });
    expect(seen.length, "觀測器必須被呼叫").toBe(1);
    expect(
      seen[0].droppedLongLines,
      "3 MiB 高於 production 門檻(1 MiB),必須增量丟棄;把門檻調成極大值等於撤銷 R2 修法"
    ).toBeGreaterThanOrEqual(1);
    expect(
      seen[0].peakPendingLineBytes,
      `單行峰值 ${seen[0].peakPendingLineBytes} B 必須遠小於整行 ${3 * 1024 * 1024} B`
    ).toBeLessThan(2 * 1024 * 1024);
    expect(scans.every((sc) => sc.hits.length === 0), "排除路徑不得產生命中").toBe(true);
  });
});
