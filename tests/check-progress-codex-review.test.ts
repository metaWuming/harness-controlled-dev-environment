// Tests for scripts/check-progress-codex-review.ts(Step 4 Codex 憑證守門)
//
// 覆蓋:
//   - extractLatestEntryBody:跳過 code fence 內的 template,抓真 entry
//   - judgeEntry:Codex round 命中 / docs-only 例外 / 缺 Codex round(fail)
//   - parseArgs:合法 / 未知參數 fail-closed
//   - CLI e2e:在 mkdtemp fixture repo 內跑,驗 exit code

import { describe, expect, it } from "vitest";
import { spawnSync, execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  allCommitsHaveTrivialMarker,
  extractAllEntryBodies,
  extractLatestEntryBody,
  extractLatestEntryHeading,
  getCommitMessagesResult,
  hasTrivialMarker,
  DEPENDABOT_LOGIN,
  isDependabotManifestOnlyPr,
  isDocsFile,
  isDocsOnlyDiff,
  isSafeGitRef,
  isTrivialForbidden,
  judgeEntry,
  parseArgs,
} from "../scripts/check-progress-codex-review";

const SCRIPT = path.resolve(__dirname, "../scripts/check-progress-codex-review.ts");

// ─────────────────────────────────────────────────────────────────
// extractLatestEntryBody:code fence 分辨

describe("extractLatestEntryBody — code fence 分辨", () => {
  it("跳過 code fence 內的 template placeholder,抓 fence 外的真 entry", () => {
    const content = [
      "# progress",
      "",
      "## Entry 格式範本",
      "```markdown",
      "📅 YYYY-MM-DD ⓝ — **範本標題**",
      "",
      "> **改動**:...",
      "```",
      "",
      "---",
      "",
      "📅 2026-09-15 ⑮ — **真 entry 標題**",
      "",
      "> **改動**:X 檔",
      "> 📊 成本:Codex round 1: 4 P1 / 4 P2",
    ].join("\n");
    const body = extractLatestEntryBody(content);
    expect(body).not.toBeNull();
    expect(body).toContain("真 entry 標題");
    expect(body).not.toContain("範本標題");
    expect(body).toContain("Codex round 1");
  });

  it("body 收到下一條 📅 entry 之前", () => {
    const content = [
      "📅 2026-09-15 ⑮ — **新 entry**",
      "> line-a",
      "> line-b",
      "",
      "📅 2026-09-10 ⑭ — **舊 entry**",
      "> line-c",
    ].join("\n");
    const body = extractLatestEntryBody(content)!;
    expect(body).toContain("新 entry");
    expect(body).toContain("line-a");
    expect(body).toContain("line-b");
    expect(body).not.toContain("舊 entry");
    expect(body).not.toContain("line-c");
  });

  it("body 收到 --- 分隔線之前", () => {
    const content = ["📅 2026-09-15 ⑮ — **entry**", "> line-a", "", "---", "後面段落"].join("\n");
    const body = extractLatestEntryBody(content)!;
    expect(body).toContain("line-a");
    expect(body).not.toContain("後面段落");
  });

  it("整份沒有 📅 → 回 null", () => {
    const content = "# 只有標題\n\n沒有 entry\n";
    expect(extractLatestEntryBody(content)).toBeNull();
  });

  it("只有 code fence 內的 📅(全是 template)→ 回 null", () => {
    const content = ["## Entry 格式範本", "```markdown", "📅 YYYY-MM-DD ⓝ — 範本", "```"].join("\n");
    expect(extractLatestEntryBody(content)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────
// extractLatestEntryHeading(P1-2 entry-identity)

describe("extractLatestEntryHeading", () => {
  it("抓第一個 📅 行(fence 外)", () => {
    const content = ["📅 2026-09-15 ⑮ — **標題 A**", "> body", "", "📅 2026-09-10 ⑭ — **舊**"].join("\n");
    expect(extractLatestEntryHeading(content)).toBe("📅 2026-09-15 ⑮ — **標題 A**");
  });

  it("跳過 fence 內的 📅 template", () => {
    const content = ["```markdown", "📅 YYYY-MM-DD ⓝ — **範本**", "```", "📅 2026-09-15 ⑮ — **真**"].join("\n");
    expect(extractLatestEntryHeading(content)).toBe("📅 2026-09-15 ⑮ — **真**");
  });

  it("整份沒 📅 → null", () => {
    expect(extractLatestEntryHeading("# 標題\n\n沒有 entry\n")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────
// judgeEntry:Step 4 R1 4 P1 修版

describe("judgeEntry — Codex round 分支(P1-4 收斂 marker)", () => {
  it("Codex round + 收斂 marker(no actionable findings)→ ok", () => {
    const r = judgeEntry("Codex round 3 sanity + Codex round 4:no actionable findings");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.reason).toBe("has-codex-round");
      expect(r.matched).toMatch(/Codex\s+round\s+\d+/i);
    }
  });

  it("Codex round + 0 P1 → ok(0 P1 算收斂)", () => {
    const r = judgeEntry("Codex round 2:0 P1 / 3 P2 全修");
    expect(r.kind).toBe("ok");
  });

  it("Codex round + 收斂 中文字 → ok", () => {
    const r = judgeEntry("Codex round 1:4 P1,round 2 收斂");
    expect(r.kind).toBe("ok");
  });

  it("Codex round + zero findings → ok", () => {
    const r = judgeEntry("Codex round 1: zero findings");
    expect(r.kind).toBe("ok");
  });

  it("codex round(小寫)+ 收斂 → 也命中(case-insensitive)", () => {
    const r = judgeEntry("codex round 1 zero findings");
    expect(r.kind).toBe("ok");
  });

  it("🔴 P1-4:Codex round 但無收斂 marker → fail(不能光有 round)", () => {
    const r = judgeEntry("Codex round 1 抓 4 P1、round 2 抓 5 P1");
    expect(r.kind).toBe("fail");
    if (r.kind === "fail") expect(r.reason).toBe("missing-convergence-marker");
  });

  it("🔴 P1-4:Codex round 1 exit 124 timeout → fail(不算過關)", () => {
    const r = judgeEntry("Codex round 1 撞 exit 124 timeout,fallback 未跑");
    expect(r.kind).toBe("fail");
    if (r.kind === "fail") expect(r.reason).toBe("missing-convergence-marker");
  });

  it("🔴 R3 P1-2:「10 findings」不能誤中「0 findings」(數字前綴 lookbehind)", () => {
    const r = judgeEntry("Codex round 1: 10 findings — 都要修");
    expect(r.kind).toBe("fail");
    if (r.kind === "fail") expect(r.reason).toBe("missing-convergence-marker");
  });

  it("🔴 R3 P1-2:「20 P1」不能誤中「0 P1」", () => {
    const r = judgeEntry("Codex round 1: 20 P1、7 P2 — 都在修");
    expect(r.kind).toBe("fail");
    if (r.kind === "fail") expect(r.reason).toBe("missing-convergence-marker");
  });

  it("R3 P1-2:實際 0 P1 仍命中", () => {
    const r = judgeEntry("Codex round 3: 0 P1 / 0 P2 全綠");
    expect(r.kind).toBe("ok");
  });

  it("🔴 R4 P1-3:「Codex round 1 後無法收斂」→ fail(「無法」lookbehind)", () => {
    const r = judgeEntry("Codex round 1 抓 5 P1 後仍無法收斂");
    expect(r.kind).toBe("fail");
  });

  it("🔴 R4 P1-3:「final round 2: 10 findings remain」→ fail(final round 內 10 不算 0)", () => {
    const r = judgeEntry("Codex round 1; final round 2: 10 findings remain");
    expect(r.kind).toBe("fail");
    if (r.kind === "fail") expect(r.reason).toBe("missing-convergence-marker");
  });

  it("R4 P1-3:「final round 3: 0 findings」→ ok(final round 內 0 邊界正確)", () => {
    const r = judgeEntry("Codex round 1; final round 3: 0 findings");
    expect(r.kind).toBe("ok");
  });

  it("🔴 Step 5 CRITICAL:SOP template 用「跨模型 review N rounds」+ 收斂 → ok", () => {
    // 對齊 SOP L423 cost field template
    const r = judgeEntry("📊 成本:CC ~5h / 跨模型 review 3 rounds / P1 2 個 / P2 3 個;round 3 收斂");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.reason).toBe("has-codex-round");
  });

  it("Step 5 CRITICAL:「跨模型 review N rounds」但無收斂 → fail", () => {
    const r = judgeEntry("跨模型 review 2 rounds — 抓 5 P1 fallback 仍調查中");
    expect(r.kind).toBe("fail");
    if (r.kind === "fail") expect(r.reason).toBe("missing-convergence-marker");
  });
});

describe("judgeEntry — Claude 降級路徑(P1-1)", () => {
  it("Claude /code-review round + 降級 marker + 收斂 → ok", () => {
    const r = judgeEntry("無 Codex 環境:Claude /code-review round 1: no actionable findings");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.reason).toBe("has-claude-review-degradation");
  });

  it("Claude code-review(無斜線)+ 降級 marker + 0 P1 → ok", () => {
    const r = judgeEntry("Codex CLI 未安裝,降級 Claude code-review round 2:0 P1 / 3 P2");
    expect(r.kind).toBe("ok");
  });

  it("🔴 P1-1:Claude review 沒降級 marker → fail(要明講為何降級)", () => {
    const r = judgeEntry("Claude /code-review round 1: no actionable findings");
    expect(r.kind).toBe("fail");
    if (r.kind === "fail") expect(r.reason).toBe("claude-review-without-degradation-marker");
  });

  it("Claude review + 降級 marker 但無收斂 → fail", () => {
    // 避免 fixture 措辭含「收斂」(regex 會誤命中);改成中性描述「仍調查中」
    const r = judgeEntry("無 Codex 環境,Claude /code-review round 1 抓 3 P1(fallback 仍調查中)");
    expect(r.kind).toBe("fail");
    if (r.kind === "fail") expect(r.reason).toBe("missing-convergence-marker");
  });

  it("Claude adversarial-reviewer(不是 /code-review) → fail(不是 SOP 允許的降級路徑)", () => {
    const r = judgeEntry("Claude adversarial-reviewer round 1: 0 P1");
    expect(r.kind).toBe("fail");
    if (r.kind === "fail") expect(r.reason).toBe("missing-codex-round");
  });

  // SOP-tune v2 (h):DEGRADATION_MARKER_RE 加行首 anchor + CJK 標點 + 破折號家族
  it("SOP-tune v2 (h):否定敘述「本輪並非無 Codex 環境」不觸發降級通道", () => {
    const r = judgeEntry("本輪並非無 Codex 環境;Claude /code-review round 1: no actionable findings");
    expect(r.kind).toBe("fail");
    if (r.kind === "fail") {
      expect(["missing-codex-round", "claude-review-without-degradation-marker"]).toContain(r.reason);
    }
  });

  it("SOP-tune v2 (h):行首 markdown quote prefix 允許", () => {
    const r = judgeEntry("> 無 Codex 環境\n> Claude /code-review round 1: no actionable findings");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.reason).toBe("has-claude-review-degradation");
  });

  it("SOP-tune v2 (h) CJK 冒號:「降級：Claude」→ ok", () => {
    const r = judgeEntry("降級：Claude /code-review round 1: no actionable findings");
    expect(r.kind).toBe("ok");
  });

  it("SOP-tune v2 (h) CJK 全形逗號:「降級，Claude」→ ok", () => {
    const r = judgeEntry("降級，Claude /code-review round 1: no actionable findings");
    expect(r.kind).toBe("ok");
  });

  it("SOP-tune v2 (h) Em dash:「降級—Claude」→ ok", () => {
    const r = judgeEntry("降級—Claude /code-review round 1: no actionable findings");
    expect(r.kind).toBe("ok");
  });

  it("SOP-tune v2 (h) ASCII 連字號:「降級-Claude」→ ok", () => {
    const r = judgeEntry("降級-Claude /code-review round 1: no actionable findings");
    expect(r.kind).toBe("ok");
  });

  it("SOP-tune v2 (h):句中「不涉及降級」+ 稍後「Claude」不誤命中", () => {
    const r = judgeEntry("本次不涉及降級, 而是 Claude /code-review round 1: no actionable findings");
    expect(r.kind).toBe("fail");
    if (r.kind === "fail") expect(r.reason).toBe("claude-review-without-degradation-marker");
  });
});

describe("judgeEntry — docs-only marker(P1-3 行首 anchor)", () => {
  it("行首 `docs-only sprint` → ok", () => {
    const r = judgeEntry("> docs-only sprint(理由:只改 SOP)");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") expect(r.reason).toBe("docs-only");
  });

  it("行首 `- docs-only sprint` → ok", () => {
    const r = judgeEntry("- docs-only sprint\n- 只改 CLAUDE.md");
    expect(r.kind).toBe("ok");
  });

  it("純行 `docs-only sprint` → ok", () => {
    const r = judgeEntry("Foo\n\ndocs-only sprint\n\nbar");
    expect(r.kind).toBe("ok");
  });

  it("🔴 P1-3:「本 sprint 為 docs-only sprint」→ fail(有『本 sprint 為』前綴、非行首 marker)", () => {
    const r = judgeEntry("本 sprint 為 docs-only sprint,只改 SOP");
    expect(r.kind).toBe("fail");
  });

  it("🔴 P1-3:「這不是 docs-only sprint」→ fail(否定句誤中防護)", () => {
    const r = judgeEntry("這不是 docs-only sprint,是完整 sprint 收尾");
    expect(r.kind).toBe("fail");
  });

  it("🔴 P1-3:引用白名單詞當說明 → fail(entry 內講 checker 語意也不誤中)", () => {
    const r = judgeEntry("這條 checker 允許 `docs-only sprint` 白名單 marker(SOP 內文)");
    expect(r.kind).toBe("fail");
  });

  it("行首 `無 code 改動` → ok", () => {
    const r = judgeEntry("無 code 改動\n只更新 SOP");
    expect(r.kind).toBe("ok");
  });

  it("🔴 P1-3:「本 sprint 無 code 改動」→ fail(非行首)", () => {
    const r = judgeEntry("本 sprint 無 code 改動,只更新 SOP");
    expect(r.kind).toBe("fail");
  });
});

describe("judgeEntry — 其他 fail 情境", () => {
  it("空 body → fail", () => {
    const r = judgeEntry("");
    expect(r.kind).toBe("fail");
  });

  it("寫 Codex 但沒接 round \\d+ → fail", () => {
    const r = judgeEntry("Codex 有跑過");
    expect(r.kind).toBe("fail");
  });

  it("跨模型 review 但沒點名 Codex/Claude → fail", () => {
    const r = judgeEntry("跨模型 review 4 rounds / P1 4 個 / P2 4 個");
    expect(r.kind).toBe("fail");
  });
});

// ─────────────────────────────────────────────────────────────────
// parseArgs

describe("parseArgs", () => {
  it("空 argv → ok, base=null, root=null", () => {
    const r = parseArgs([]);
    expect(r.ok).toBe(true);
    expect(r.base).toBeNull();
    expect(r.root).toBeNull();
  });

  it("--base=main(等號)→ base=main", () => {
    const r = parseArgs(["--base=main"]);
    expect(r.ok).toBe(true);
    expect(r.base).toBe("main");
  });

  it("🔴 R2 P1-1:--base main(空白分隔)→ base=main(CI wiring form)", () => {
    const r = parseArgs(["--base", "origin/main"]);
    expect(r.ok).toBe(true);
    expect(r.base).toBe("origin/main");
  });

  it("--base 缺 value → fail", () => {
    const r = parseArgs(["--base"]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("缺 value");
  });

  it("--root=/tmp/foo(等號)→ root=/tmp/foo", () => {
    const r = parseArgs(["--root=/tmp/foo"]);
    expect(r.ok).toBe(true);
    expect(r.root).toBe("/tmp/foo");
  });

  it("--root /tmp/foo(空白分隔)→ root=/tmp/foo", () => {
    const r = parseArgs(["--root", "/tmp/foo"]);
    expect(r.ok).toBe(true);
    expect(r.root).toBe("/tmp/foo");
  });

  it("混合形式 --base=main --root /tmp → 都認", () => {
    const r = parseArgs(["--base=main", "--root", "/tmp/foo"]);
    expect(r.ok).toBe(true);
    expect(r.base).toBe("main");
    expect(r.root).toBe("/tmp/foo");
  });

  it("未知參數 → fail-closed", () => {
    const r = parseArgs(["--unknown"]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("未知參數");
  });

  // SOP-tune v2 (c):空字串 fail-closed(--base / --root × = form / space form)
  it("SOP-tune v2 (c): --base= 空字串 → fail-closed", () => {
    const r = parseArgs(["--base="]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("--base 空 value");
  });

  it("SOP-tune v2 (c): --root= 空字串 → fail-closed", () => {
    const r = parseArgs(["--root="]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("--root 空 value");
  });

  it("SOP-tune v2 (c): --base 空白後空字串 → fail-closed", () => {
    const r = parseArgs(["--base", ""]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("--base 空 value");
  });

  it("SOP-tune v2 (c): --root 空白後空字串 → fail-closed", () => {
    const r = parseArgs(["--root", ""]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("--root 空 value");
  });
});

// ─────────────────────────────────────────────────────────────────
// isDocsOnlyDiff / isDocsFile(R3 P1-1:改 fail-closed allowlist)

describe("isDocsOnlyDiff (fail-closed allowlist)", () => {
  it("空 diff → true", () => {
    expect(isDocsOnlyDiff([])).toBe(true);
  });

  it("只有 progress.md → true", () => {
    expect(isDocsOnlyDiff([".claude/memory/progress.md"])).toBe(true);
  });

  it("含 src/**/*.ts → false", () => {
    expect(isDocsOnlyDiff(["src/engine.ts"])).toBe(false);
  });

  it("含 scripts/*.ts → false", () => {
    expect(isDocsOnlyDiff(["scripts/check-foo.ts"])).toBe(false);
  });

  it("含 CLAUDE.md → false(專案治理)", () => {
    expect(isDocsOnlyDiff(["CLAUDE.md"])).toBe(false);
  });

  it("mixed(progress + src)→ false", () => {
    expect(isDocsOnlyDiff([".claude/memory/progress.md", "src/foo.ts"])).toBe(false);
  });

  it("progress + TODOS.md → true(都是 bookkeeping)", () => {
    expect(isDocsOnlyDiff([".claude/memory/progress.md", "TODOS.md"])).toBe(true);
  });

  it("🔴 R3 P1-1 fail-closed:未列白名單的 .claude/agents/*.md → false(即使檔名看起來像 doc)", () => {
    expect(isDocsOnlyDiff([".claude/agents/reviewer-a.md"])).toBe(false);
  });

  it("🔴 R3 P1-1 fail-closed:未列白名單的 config/runtime.json → false", () => {
    expect(isDocsOnlyDiff(["config/runtime.json"])).toBe(false);
  });

  it("🔴 R3 P1-1 fail-closed:某個未預期的 .md 檔 → false(判不準當 non-docs)", () => {
    expect(isDocsOnlyDiff(["src/some-note.md"])).toBe(false);
  });

  it("progress-archive/*.md → true(archived sprint entries)", () => {
    expect(isDocsFile(".claude/memory/progress-archive/2026-09.md")).toBe(true);
  });

  it("progress-archive/README.md → false(governance 慣例文)", () => {
    expect(isDocsFile(".claude/memory/progress-archive/README.md")).toBe(false);
  });

  it("progress-archive 子目錄 → false(不進子目錄)", () => {
    expect(isDocsFile(".claude/memory/progress-archive/2026/09.md")).toBe(false);
  });

  it("_handoffs/HANDOFF.md → true", () => {
    expect(isDocsFile("_handoffs/HANDOFF.md")).toBe(true);
  });

  it("README.md → true", () => {
    expect(isDocsFile("README.md")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────
// isSafeGitRef(R3 P2-2 shell injection)

describe("isSafeGitRef", () => {
  it("main / origin/main / feature/foo-bar → 合法", () => {
    expect(isSafeGitRef("main")).toBe(true);
    expect(isSafeGitRef("origin/main")).toBe(true);
    expect(isSafeGitRef("feature/foo-bar")).toBe(true);
    expect(isSafeGitRef("v1.2.3")).toBe(true);
    expect(isSafeGitRef("HEAD~2")).toBe(false); // ~ 不在白名單
    expect(isSafeGitRef("HEAD@{1}")).toBe(true);
  });

  it("🔴 R3 P2-2:含 shell metacharacter 拒絕", () => {
    expect(isSafeGitRef("main; rm -rf /")).toBe(false);
    expect(isSafeGitRef("main$(whoami)")).toBe(false);
    expect(isSafeGitRef("main`id`")).toBe(false);
    expect(isSafeGitRef("main|cat")).toBe(false);
    expect(isSafeGitRef("main && whoami")).toBe(false);
    expect(isSafeGitRef("main\nid")).toBe(false);
  });

  it("空字串 / 超長 → 拒絕", () => {
    expect(isSafeGitRef("")).toBe(false);
    expect(isSafeGitRef("a".repeat(300))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// hasTrivialMarker(R3 P1-3 例外通道)

describe("allCommitsHaveTrivialMarker (R4 P1-1:改 every)", () => {
  it("每個 commit 都含 [trivial] → true", () => {
    expect(allCommitsHaveTrivialMarker(["fix a [trivial]", "fix b [trivial]"])).toBe(true);
  });

  it("大小寫無關", () => {
    expect(allCommitsHaveTrivialMarker(["fix: [TRIVIAL] rename"])).toBe(true);
  });

  it("🔴 R4 P1-1:只有一個 commit 含 [trivial] → false(擋『先 typo 後敏感碼』漏洞)", () => {
    expect(allCommitsHaveTrivialMarker(["fix typo [trivial]", "add src/auth logic"])).toBe(false);
  });

  it("空 → false(無 commit 不算 override)", () => {
    expect(allCommitsHaveTrivialMarker([])).toBe(false);
  });

  it("都不含 → false", () => {
    expect(allCommitsHaveTrivialMarker(["修復 bug", "加測試"])).toBe(false);
  });

  it("『trivial』無方括號 → false", () => {
    expect(allCommitsHaveTrivialMarker(["這是 trivial 修改 [trivial]", "另一個 trivial 但沒括號"])).toBe(false);
  });
});

describe("isTrivialForbidden (R4 P1-1 super-sensitive paths)", () => {
  it("scripts/git-hooks/* → forbidden", () => {
    expect(isTrivialForbidden(["scripts/git-hooks/pre-commit"])).toBe(true);
  });

  it(".github/workflows/*.yml → forbidden", () => {
    expect(isTrivialForbidden([".github/workflows/ci.yml"])).toBe(true);
  });

  it("src/**/auth/** → forbidden", () => {
    expect(isTrivialForbidden(["src/lib/auth/session.ts"])).toBe(true);
  });

  it("CLAUDE.md → forbidden(治理)", () => {
    expect(isTrivialForbidden(["CLAUDE.md"])).toBe(true);
  });

  it(".claude/sop/*.md → forbidden", () => {
    expect(isTrivialForbidden([".claude/sop/plan-mode-checklist.md"])).toBe(true);
  });

  it("scripts/mutate.ts → forbidden", () => {
    expect(isTrivialForbidden(["scripts/mutate.ts"])).toBe(true);
  });

  it("普通 src/foo.ts → 不 forbidden(可搭配 [trivial] 用)", () => {
    expect(isTrivialForbidden(["src/foo.ts"])).toBe(false);
  });

  it("README.md → 不 forbidden", () => {
    expect(isTrivialForbidden(["README.md"])).toBe(false);
  });

  it("🔴 Step 5 INF (k):scripts/control-catalog.json → forbidden(governance SSOT)", () => {
    expect(isTrivialForbidden(["scripts/control-catalog.json"])).toBe(true);
  });

  it("🔴 Step 5 INF (k):docs/CONTROL-CATALOG.md → forbidden", () => {
    expect(isTrivialForbidden(["docs/CONTROL-CATALOG.md"])).toBe(true);
  });

  it("🔴 Step 5 INF (k):scripts/harness.config.json → forbidden", () => {
    expect(isTrivialForbidden(["scripts/harness.config.json"])).toBe(true);
  });
});

// hasTrivialMarker(向後相容,現指向 allCommitsHaveTrivialMarker)
describe("hasTrivialMarker(向後相容)", () => {
  it("與 allCommitsHaveTrivialMarker 一致", () => {
    expect(hasTrivialMarker(["fix [trivial]"])).toBe(true);
    expect(hasTrivialMarker(["fix"])).toBe(false);
  });
});

// SOP-tune v2 (f):getCommitMessagesResult 三態
describe("getCommitMessagesResult (SOP-tune v2 (f) 三態)", () => {
  it("cwd 非 git repo(無 .git)→ error 帶 detail", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getcommitmsgs-noreport-"));
    try {
      const r = getCommitMessagesResult("HEAD~1", tmpDir);
      expect(r.kind).toBe("error");
      if (r.kind === "error") expect(r.detail).toContain("failed");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("有 commit 且非 merge → ok 帶 messages", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getcommitmsgs-ok-"));
    try {
      execFileSync("git", ["init", "-q", "-b", "main", tmpDir], { stdio: "ignore" });
      execFileSync("git", ["-C", tmpDir, "config", "user.email", "t@t.com"], { stdio: "ignore" });
      execFileSync("git", ["-C", tmpDir, "config", "user.name", "t"], { stdio: "ignore" });
      execFileSync("git", ["-C", tmpDir, "config", "commit.gpgsign", "false"], { stdio: "ignore" });
      fs.writeFileSync(path.join(tmpDir, "a.txt"), "1");
      execFileSync("git", ["-C", tmpDir, "add", "a.txt"], { stdio: "ignore" });
      execFileSync("git", ["-C", tmpDir, "commit", "-m", "init"], { stdio: "ignore" });
      const baseSha = execFileSync("git", ["-C", tmpDir, "rev-parse", "HEAD"], { encoding: "utf-8" }).trim();
      fs.writeFileSync(path.join(tmpDir, "b.txt"), "2");
      execFileSync("git", ["-C", tmpDir, "add", "b.txt"], { stdio: "ignore" });
      execFileSync("git", ["-C", tmpDir, "commit", "-m", "second"], { stdio: "ignore" });
      const r = getCommitMessagesResult(baseSha, tmpDir);
      expect(r.kind).toBe("ok");
      if (r.kind === "ok") {
        expect(r.messages).toHaveLength(1);
        expect(r.messages[0]).toContain("second");
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("base === HEAD(無 commit 差)→ no-non-merge", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "getcommitmsgs-empty-"));
    try {
      execFileSync("git", ["init", "-q", "-b", "main", tmpDir], { stdio: "ignore" });
      execFileSync("git", ["-C", tmpDir, "config", "user.email", "t@t.com"], { stdio: "ignore" });
      execFileSync("git", ["-C", tmpDir, "config", "user.name", "t"], { stdio: "ignore" });
      execFileSync("git", ["-C", tmpDir, "config", "commit.gpgsign", "false"], { stdio: "ignore" });
      fs.writeFileSync(path.join(tmpDir, "a.txt"), "1");
      execFileSync("git", ["-C", tmpDir, "add", "a.txt"], { stdio: "ignore" });
      execFileSync("git", ["-C", tmpDir, "commit", "-m", "init"], { stdio: "ignore" });
      const r = getCommitMessagesResult("HEAD", tmpDir);
      expect(r.kind).toBe("no-non-merge");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

// R4 P1-2:extractAllEntryBodies
describe("extractAllEntryBodies (R4 P1-2)", () => {
  it("抽出所有 entry body(倒序,最新在前)", () => {
    const content = [
      "# progress",
      "",
      "📅 2026-09-15 ⑮ — **新**",
      "> body A",
      "",
      "📅 2026-09-14 ⑭ — **舊**",
      "> body B",
      "",
      "📅 2026-09-13 ⑬ — **更舊**",
      "> body C",
    ].join("\n");
    const bodies = extractAllEntryBodies(content);
    expect(bodies.length).toBe(3);
    expect(bodies[0]).toContain("body A");
    expect(bodies[1]).toContain("body B");
    expect(bodies[2]).toContain("body C");
  });

  it("空 / 無 entry → 空陣列", () => {
    expect(extractAllEntryBodies("# progress\n\n沒有 entry")).toEqual([]);
  });

  it("跳過 fence 內 template", () => {
    const content = ["```markdown", "📅 YYYY-MM-DD — 範本", "```", "", "📅 2026-09-15 ⑮ — 真", "> body"].join("\n");
    const bodies = extractAllEntryBodies(content);
    expect(bodies.length).toBe(1);
    expect(bodies[0]).toContain("body");
    expect(bodies[0]).not.toContain("範本");
  });
});

// ─────────────────────────────────────────────────────────────────
// isDependabotManifestOnlyPr:dependabot npm PR 豁免

describe("isDependabotManifestOnlyPr", () => {
  it("dependabot + 只動 package.json / package-lock.json → true", () => {
    expect(isDependabotManifestOnlyPr(DEPENDABOT_LOGIN, ["package.json", "package-lock.json"])).toBe(true);
    expect(isDependabotManifestOnlyPr(DEPENDABOT_LOGIN, ["package-lock.json"])).toBe(true);
  });
  it("作者不是 dependabot / 未設 → false", () => {
    expect(isDependabotManifestOnlyPr("metaWuming", ["package.json"])).toBe(false);
    expect(isDependabotManifestOnlyPr("dependabot", ["package.json"])).toBe(false);
    expect(isDependabotManifestOnlyPr(undefined, ["package.json"])).toBe(false);
    expect(isDependabotManifestOnlyPr("", ["package.json"])).toBe(false);
  });
  it("dependabot 但 diff 含其他檔 → false", () => {
    expect(isDependabotManifestOnlyPr(DEPENDABOT_LOGIN, ["package.json", "src/foo.ts"])).toBe(false);
    expect(isDependabotManifestOnlyPr(DEPENDABOT_LOGIN, [".github/workflows/ci.yml"])).toBe(false);
    expect(isDependabotManifestOnlyPr(DEPENDABOT_LOGIN, ["sub/package.json"])).toBe(false);
  });
  it("空 diff → false", () => {
    expect(isDependabotManifestOnlyPr(DEPENDABOT_LOGIN, [])).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// CLI e2e:fixture repo

function runCli(
  args: string[],
  cwd: string,
  prAuthor?: string,
): { code: number | null; stderr: string; stdout: string } {
  // 預設清掉 PR_AUTHOR_LOGIN,避免外部環境值影響判定
  const env = { ...process.env };
  delete env.PR_AUTHOR_LOGIN;
  if (prAuthor !== undefined) env.PR_AUTHOR_LOGIN = prAuthor;
  const r = spawnSync("npx", ["tsx", SCRIPT, ...args], { encoding: "utf-8", cwd, env });
  return { code: r.status, stderr: r.stderr, stdout: r.stdout };
}

/**
 * 建一個 fixture repo:main 分支 + feature 分支 + 可控的 progress.md 內容。
 * 可選 baseProgressContent:main 初始 commit 的 progress.md(給 P1-2 inheritance 測試用)。
 */
function mkFixture(progressContent: string, baseProgressContent?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-progress-codex-"));
  const git = (args: string[]) => execFileSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test"]);
  // main 初始 commit
  fs.mkdirSync(path.join(dir, ".claude", "memory"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".claude", "memory", "progress.md"), baseProgressContent ?? "# progress\n");
  git(["add", ".claude/memory/progress.md"]);
  git(["commit", "-q", "-m", "init"]);
  // feature 分支
  git(["checkout", "-q", "-b", "feature/test"]);
  fs.writeFileSync(path.join(dir, ".claude", "memory", "progress.md"), progressContent);
  git(["add", ".claude/memory/progress.md"]);
  git(["commit", "-q", "-m", "sprint entry"]);
  return dir;
}

describe("CLI e2e", () => {
  it("diff 全 docs-only 檔且沒動 progress.md → exit 0(non-sprint PR)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-progress-codex-noop-"));
    const git = (args: string[]) => execFileSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    fs.writeFileSync(path.join(dir, "README.md"), "hi\n");
    git(["add", "README.md"]);
    git(["commit", "-q", "-m", "init"]);
    git(["checkout", "-q", "-b", "feature/test"]);
    fs.writeFileSync(path.join(dir, "README.md"), "hi\nbye\n");
    git(["add", "README.md"]);
    git(["commit", "-q", "-m", "unrelated change"]);

    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("非 sprint");
  });

  it("🔴 R2 P1-2:diff 含非 docs 檔但沒動 progress.md → exit 2", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-progress-codex-no-progress-"));
    const git = (args: string[]) => execFileSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    fs.writeFileSync(path.join(dir, "README.md"), "hi\n");
    git(["add", "README.md"]);
    git(["commit", "-q", "-m", "init"]);
    git(["checkout", "-q", "-b", "feature/test"]);
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "foo.ts"), "export const x = 1;\n");
    git(["add", "src/foo.ts"]);
    git(["commit", "-q", "-m", "add src"]);

    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("動了非 docs 檔");
  });

  it("🔴 R4 P1-1:一個 commit [trivial] + 一個沒 → exit 2(擋『先 typo 再敏感碼』)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-progress-codex-partial-trivial-"));
    const git = (args: string[]) => execFileSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    fs.writeFileSync(path.join(dir, "README.md"), "hi\n");
    git(["add", "README.md"]);
    git(["commit", "-q", "-m", "init"]);
    git(["checkout", "-q", "-b", "feature/test"]);
    // commit 1:含 [trivial]
    fs.writeFileSync(path.join(dir, "README.md"), "hi\nbye\n");
    git(["add", "README.md"]);
    git(["commit", "-q", "-m", "fix typo [trivial]"]);
    // commit 2:沒 [trivial](sensitive code 塞進來)
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "auth.ts"), "export const secret = '';\n");
    git(["add", "src/auth.ts"]);
    git(["commit", "-q", "-m", "add auth"]);

    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("每個 commit 都要含");
  });

  it("🔴 R4 P1-1:所有 commit [trivial] 但含 super-sensitive 檔 → exit 2", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-progress-codex-forbidden-trivial-"));
    const git = (args: string[]) => execFileSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    fs.writeFileSync(path.join(dir, "README.md"), "hi\n");
    git(["add", "README.md"]);
    git(["commit", "-q", "-m", "init"]);
    git(["checkout", "-q", "-b", "feature/test"]);
    // 全 commit 都 [trivial],但改到 super-sensitive 檔
    fs.mkdirSync(path.join(dir, ".github", "workflows"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".github", "workflows", "ci.yml"), "name: CI\n");
    git(["add", ".github/workflows/ci.yml"]);
    git(["commit", "-q", "-m", "add ci [trivial]"]);

    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("super-sensitive");
  });

  it("🔴 R3 P1-3:[trivial] commit marker → 允許 non-docs 沒動 progress 過關", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-progress-codex-trivial-"));
    const git = (args: string[]) => execFileSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    fs.writeFileSync(path.join(dir, "README.md"), "hi\n");
    git(["add", "README.md"]);
    git(["commit", "-q", "-m", "init"]);
    git(["checkout", "-q", "-b", "feature/test"]);
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "foo.ts"), "export const x = 1;\n");
    git(["add", "src/foo.ts"]);
    git(["commit", "-q", "-m", "修復: typo in export [trivial]"]);

    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("trivial");
  });

  it("🔴 R3 P2-1:--base=HEAD(base === HEAD)→ exit 2(拒非祖先)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-progress-codex-nonancestor-"));
    const git = (args: string[]) => execFileSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    fs.writeFileSync(path.join(dir, "README.md"), "hi\n");
    git(["add", "README.md"]);
    git(["commit", "-q", "-m", "init"]);

    const r = runCli(["--base=HEAD", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("真祖先");
  });

  it("🔴 R3 P2-2:--base 含 shell metacharacter → exit 2", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-progress-codex-injection-"));
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    const r = runCli(["--base=main;whoami", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("不合法字元");
  });

  it("🔴 R2 P1-3:entry 標 docs-only 但 diff 含 src → exit 2(mixed PR)", () => {
    // fixture:HEAD 動 progress.md(標 docs-only)+ src/foo.ts
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-progress-codex-mixed-"));
    const git = (args: string[]) => execFileSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    fs.mkdirSync(path.join(dir, ".claude", "memory"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".claude", "memory", "progress.md"), "# progress\n");
    git(["add", ".claude/memory/progress.md"]);
    git(["commit", "-q", "-m", "init"]);
    git(["checkout", "-q", "-b", "feature/test"]);
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "foo.ts"), "export const x = 1;\n");
    fs.writeFileSync(
      path.join(dir, ".claude", "memory", "progress.md"),
      [
        "# progress",
        "",
        "📅 2026-09-15 ⑯ — **騙人的 docs-only**",
        "",
        "> docs-only sprint(理由:企圖跳過 Step 4)",
      ].join("\n"),
    );
    git(["add", "src/foo.ts", ".claude/memory/progress.md"]);
    git(["commit", "-q", "-m", "mixed"]);

    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("mixed");
  });

  it("progress.md 有 Codex round + 收斂 marker → exit 0", () => {
    const dir = mkFixture(
      [
        "# progress",
        "",
        "📅 2026-09-15 ⑮ — **M4.5-B**",
        "",
        "> Codex round 1 首跑 4 P1 + 4 P2;round 2 收斂",
      ].join("\n"),
    );
    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Codex round");
  });

  it("🔴 P1-4:progress.md 有 Codex round 但無收斂 marker → exit 2", () => {
    const dir = mkFixture(
      [
        "# progress",
        "",
        // 避免 heading / body 含「收斂」字樣(否則會被 CONVERGENCE_RE 誤命中)
        "📅 2026-09-15 ⑰ — **timeout sprint**",
        "",
        "> Codex round 1 撞 exit 124 timeout,fallback 仍調查中",
      ].join("\n"),
    );
    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("missing-convergence-marker");
  });

  it("progress.md 走 Claude 降級路徑(降級 marker + 收斂)→ exit 0", () => {
    const dir = mkFixture(
      [
        "# progress",
        "",
        "📅 2026-09-15 ⑯ — **降級 sprint**",
        "",
        "> 無 Codex 環境;Claude /code-review round 1: no actionable findings",
      ].join("\n"),
    );
    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Claude 降級路徑");
  });

  it("progress.md 標 docs-only(行首 marker)→ exit 0", () => {
    const dir = mkFixture(
      [
        "# progress",
        "",
        "📅 2026-09-15 ⑯ — **doc 更新**",
        "",
        "> docs-only sprint(理由:只改 SOP)",
      ].join("\n"),
    );
    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("docs-only");
  });

  it("🔴 P1-3:「本 sprint 為 docs-only sprint」(非行首)→ exit 2", () => {
    const dir = mkFixture(
      [
        "# progress",
        "",
        "📅 2026-09-15 ⑯ — **doc 更新**",
        "",
        "> 本 sprint 為 docs-only sprint,只改 SOP",
      ].join("\n"),
    );
    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
  });

  it("🔴 P1-2:top entry heading = base(繼承主線 entry)→ exit 2", () => {
    // base 與 HEAD 的 progress.md 都含相同 heading。HEAD 只在檔頭加一行說明,不算 sprint entry
    const inheritedEntry = [
      "# progress",
      "",
      "📅 2026-09-14 ⑭ — **上一 sprint**",
      "",
      "> Codex round 1: no actionable findings(這是上一 sprint 的憑證)",
    ].join("\n");
    const headWithoutOwnEntry = [
      "# progress(新增檔頭說明)",
      "",
      "📅 2026-09-14 ⑭ — **上一 sprint**",
      "",
      "> Codex round 1: no actionable findings(這是上一 sprint 的憑證)",
    ].join("\n");
    const dir = mkFixture(headWithoutOwnEntry, inheritedEntry);
    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("繼承自主線");
  });

  it("P1-2:base 與 HEAD 的 heading 不同 → 用 HEAD entry 判斷(正常)", () => {
    const baseEntry = [
      "# progress",
      "",
      "📅 2026-09-14 ⑭ — **舊 sprint**",
      "",
      "> Codex round 1: no actionable findings",
    ].join("\n");
    const newEntry = [
      "# progress",
      "",
      "📅 2026-09-15 ⑮ — **新 sprint**",
      "",
      "> Codex round 2: zero findings",
      "",
      "📅 2026-09-14 ⑭ — **舊 sprint**",
      "",
      "> Codex round 1: no actionable findings",
    ].join("\n");
    const dir = mkFixture(newEntry, baseEntry);
    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(0);
  });

  it("progress.md 只提 Claude adversarial-reviewer(非 /code-review 降級路徑)→ exit 2", () => {
    const dir = mkFixture(
      [
        "# progress",
        "",
        "📅 2026-09-15 ⑰ — **broken sprint**",
        "",
        "> Claude adversarial-reviewer round 1: 0 P1(沒跑 Codex、也非 SOP /code-review 降級)",
      ].join("\n"),
    );
    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("Step 4 完成憑證");
  });

  it("progress.md 無 entry(只有 template)→ exit 2", () => {
    const dir = mkFixture(
      [
        "# progress",
        "",
        "## 範本",
        "```markdown",
        "📅 YYYY-MM-DD ⓝ — 標題",
        "```",
      ].join("\n"),
    );
    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("找不到任何 📅");
  });

  it("未知參數 → exit 2", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-progress-codex-argerr-"));
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    const r = runCli(["--wtf"], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("未知參數");
  });

  it("base 找不到 → exit 2", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-progress-codex-nobase-"));
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    // 沒有 commit → main ref 不存在
    const r = runCli(["--base=nonexistent", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("找不到 base");
  });
});

describe("CLI e2e — dependabot npm PR 豁免", () => {
  function mkManifestFixture(extraFile?: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-progress-codex-dependabot-"));
    const git = (args: string[]) => execFileSync("git", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
    git(["init", "-q", "-b", "main"]);
    git(["config", "user.email", "test@example.com"]);
    git(["config", "user.name", "Test"]);
    fs.writeFileSync(path.join(dir, "package.json"), "{}\n");
    fs.writeFileSync(path.join(dir, "package-lock.json"), "{}\n");
    git(["add", "package.json", "package-lock.json"]);
    git(["commit", "-q", "-m", "init"]);
    git(["checkout", "-q", "-b", "dependabot/npm_and_yarn/foo-2.0.0"]);
    fs.writeFileSync(path.join(dir, "package.json"), '{"devDependencies":{"foo":"^2.0.0"}}\n');
    fs.writeFileSync(path.join(dir, "package-lock.json"), '{"lockfileVersion":3}\n');
    const toAdd = ["package.json", "package-lock.json"];
    if (extraFile !== undefined) {
      fs.mkdirSync(path.dirname(path.join(dir, extraFile)), { recursive: true });
      fs.writeFileSync(path.join(dir, extraFile), "export const x = 1;\n");
      toAdd.push(extraFile);
    }
    git(["add", ...toAdd]);
    git(["commit", "-q", "-m", "依賴 bump foo from 1.0.0 to 2.0.0"]);
    return dir;
  }

  it("作者 dependabot[bot] + 只動 manifest → exit 0", () => {
    const dir = mkManifestFixture();
    const r = runCli(["--base=main", `--root=${dir}`], dir, DEPENDABOT_LOGIN);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("dependabot 依賴更新豁免");
  });

  it("🔴 同樣 diff 但作者不是 dependabot → exit 2", () => {
    const dir = mkManifestFixture();
    const r = runCli(["--base=main", `--root=${dir}`], dir, "someone");
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("動了非 docs 檔");
  });

  it("🔴 同樣 diff 但沒傳 PR_AUTHOR_LOGIN → exit 2", () => {
    const dir = mkManifestFixture();
    const r = runCli(["--base=main", `--root=${dir}`], dir);
    expect(r.code).toBe(2);
  });

  it("🔴 作者 dependabot[bot] 但 diff 多動 src 檔 → exit 2", () => {
    const dir = mkManifestFixture("src/foo.ts");
    const r = runCli(["--base=main", `--root=${dir}`], dir, DEPENDABOT_LOGIN);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("src/foo.ts");
  });
});
