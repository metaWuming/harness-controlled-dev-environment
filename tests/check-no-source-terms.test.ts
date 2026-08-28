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
  mkdtempSync,
  mkdirSync,
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

describe("parseGrepZLine — 解 git grep -z NUL 分隔輸出(round 6 P2-3)", () => {
  it("working tree 掃:path NUL line:content → 拆對", () => {
    const raw = "docs/note.md\x005:see " + PREF_PR + "7";
    expect(parseGrepZLine(raw)).toEqual({
      path: "docs/note.md",
      line: "5",
      content: "see " + PREF_PR + "7",
    });
  });

  it("history 掃:rev:path NUL line:content → 拆對", () => {
    // git grep -z 對 rev 掃時,rev 用 `:` 與 path 分隔,path 與 line 用 NUL
    const raw = "abc1234:docs/note.md\x005:some content";
    expect(parseGrepZLine(raw)).toEqual({
      path: "abc1234:docs/note.md",
      line: "5",
      content: "some content",
    });
  });

  it("🔴 round 6 P2-3 反例:filename 含 `:數字:` sub-path → 正確拆到 NUL", () => {
    // 舊 stripGitGrepPrefix 用 regex `/:數字:/` 找 line number 邊界,若真實
    // filename 含「:12:」sub-path 會被誤切 → content 錯抽 filename 部分。
    // 用 NUL 分隔就沒這問題
    const raw =
      "docs/meta:12:" + PREF_PR + "999 notes.md\x005:see " + PREF_PR + "7 legit";
    const parsed = parseGrepZLine(raw);
    expect(parsed).not.toBeNull();
    expect(parsed!.path).toBe("docs/meta:12:" + PREF_PR + "999 notes.md");
    expect(parsed!.content).toBe("see " + PREF_PR + "7 legit");
    expect(extractPrRefsFromLine(parsed!.content)).toEqual([7]);
  });

  it("格式異常(無 NUL)→ 回 null", () => {
    expect(parseGrepZLine("no null here")).toBeNull();
  });

  it("displayGrepHit:parseable 轉 human-readable path:line:content", () => {
    const raw = "docs/note.md\x005:see " + PREF_PR + "7";
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
    // origin/HEAD 指向 origin/master(該分支含 `feat (井號+7)`);local main 無 #7。
    // 若 buildDeliveryRefs 路徑 ① 破損(例:symbolic-ref 讀失敗、resolves 誤判),
    // fallback 到 ④local main 查不到 #7 → 轉紅
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "init: no PR # on local main", files: { "src/foo.md": "hello\n" } },
      ],
      originRefs: {
        branches: [{ name: "master", commitSubject: "feat (#7)" }],
        setHeadTo: "master",
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

  it("🔴 批 8 Phase A A-e2:②DELIVERY_REFS env 顯式路徑抓 self-PR → 放行", () => {
    // 不設 origin/HEAD(①路徑失敗);envOverride DELIVERY_REFS=origin/release-line
    // 讓 ②路徑抓到 origin/release-line(含 `feat (井號+8)`);local main 無 #8。
    // 若 buildDeliveryRefs 路徑 ② 破損(例:漏 process.env 讀取、split 邏輯錯),
    // fallback 掉到 ③origin/develop 不存在 → ④local main 查不到 #8 → 轉紅
    const dir = makeRepo({
      deny: [PREF_PR + "[0-9]", PREF_PULL + "[0-9]"],
      commits: [
        { message: "init: no PR # on local main", files: { "src/foo.md": "hello\n" } },
      ],
      originRefs: {
        branches: [{ name: "release-line", commitSubject: "feat (#8)" }],
        // setHeadTo 不設 → ①路徑失敗
      },
      workingTree: {
        "docs/note.md": "see " + PREF_PR + "8 via DELIVERY_REFS env path\n",
      },
    });
    const { code, out } = runChecker(dir, { DELIVERY_REFS: "origin/release-line" });
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
  // 動機:批 7 (#32) Codex round 6 P2-2(defer 進 TODOS.md P3)——checker 已建
  // 上下文感知 CA 判定,但 sprint 內 self-reference(commit 訊息 / diff 引用「本
  // PR 號」)在 squash merge 前 delivery ref 找不到證據 → 被誤擋。以往 workaround
  // 是改用「(井號+N)」括號格式繞。修法對齊 scripts/check-todos-markers.ts:423-424
  // 已有機制:CI pull_request event 把 `github.event.pull_request.number` 經
  // env MARKER_SELF_PR 傳入 checker,加入 allowedPrs。
  //
  // 安全性 assertion:僅放行「這一個」PR#,其他未 merge PR 仍嚴格擋;
  // env 為空字串 / 非數字 / 負值 → 一律擋(Number.isInteger + `> 0` 檢查)

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

  it("🔴 批 8 Phase B B-e2:MARKER_SELF_PR 空字串(non-PR event 場景)→ 仍嚴格擋", () => {
    // GitHub Actions non-PR event(push / schedule)`github.event.pull_request.number`
    // 展開為空字串 → env 值 "" → Number("") = 0 → `> 0` 檢查擋住。
    // 若把檢查錯改成 `Number.isInteger(selfPr)` 少了 `> 0`,0 會被加入 → #999
    // 用某種方式湊到 0 就能繞。實務上不太可能但守門仍要在。這條驗證 env=""
    // 不改變行為(等價於未設)
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
    expect(code).toBe(1);
  });

  it("🔴 批 8 Phase B B-e3:MARKER_SELF_PR 非數字 / 負值 → 仍嚴格擋", () => {
    // 惡意或錯設場景:env 值為 "abc"(→ NaN)、"-1"(< 0)、"0"(= 0)。
    // 三種都應被 `Number.isInteger(selfPr) && selfPr > 0` 檢查擋住,不進
    // allowedPrs → 工作樹引用 #999 仍未知 → exit 1
    for (const badVal of ["abc", "-1", "0"]) {
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
      expect(code, `MARKER_SELF_PR=${badVal} 應 exit 1`).toBe(1);
    }
  });
});
