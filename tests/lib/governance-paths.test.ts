// tests/lib/governance-paths.test.ts — SOP-tune v2 (d) 共用元件測試
//
// 目的:
//   1. 驗基礎組件 shape 正確
//   2. 驗兩 sibling checker 組合出的集合 pairwise diff 精確標定(anchor:重構前後行為不變)

import { describe, it, expect } from "vitest";
import {
  HANDOFFS_PREFIX,
  PROGRESS_ARCHIVE_PREFIX,
  PROGRESS_FILE,
  README_FILE,
  TODOS_BOOKKEEPING_FILES,
  TRIVIAL_FORBIDDEN_PATTERNS,
} from "../../scripts/lib/governance-paths";
import { isDocsFile } from "../../scripts/check-progress-codex-review";
import { isBookkeepingPath } from "../../scripts/check-bookkeeping-commit";

describe("governance-paths 基礎組件", () => {
  it("PROGRESS_FILE / README_FILE 為明確字串常量", () => {
    expect(PROGRESS_FILE).toBe(".claude/memory/progress.md");
    expect(README_FILE).toBe("README.md");
  });

  it("TODOS_BOOKKEEPING_FILES 含六條(root + `.claude/memory/` × TODOS/BACKLOG/TODOS-done)", () => {
    expect(TODOS_BOOKKEEPING_FILES).toEqual([
      "TODOS.md",
      ".claude/memory/TODOS.md",
      "BACKLOG.md",
      ".claude/memory/BACKLOG.md",
      "TODOS-done.md",
      ".claude/memory/TODOS-done.md",
    ]);
  });

  it("PROGRESS_ARCHIVE_PREFIX / HANDOFFS_PREFIX 尾綴均為斜線", () => {
    expect(PROGRESS_ARCHIVE_PREFIX.endsWith("/")).toBe(true);
    expect(HANDOFFS_PREFIX.endsWith("/")).toBe(true);
  });

  it("TRIVIAL_FORBIDDEN_PATTERNS 含 CLAUDE.md §4.5 各邊界", () => {
    const patterns = TRIVIAL_FORBIDDEN_PATTERNS;
    // 抽樣驗每類邊界都在
    expect(patterns.some((p) => p.test("scripts/git-hooks/pre-push"))).toBe(true);
    expect(patterns.some((p) => p.test("scripts/cso-trigger.config.ts"))).toBe(true);
    expect(patterns.some((p) => p.test("scripts/control-catalog.json"))).toBe(true);
    expect(patterns.some((p) => p.test("docs/CONTROL-CATALOG.md"))).toBe(true);
    expect(patterns.some((p) => p.test("scripts/harness.config.json"))).toBe(true);
    expect(patterns.some((p) => p.test(".env"))).toBe(true);
    expect(patterns.some((p) => p.test(".claude/settings.json"))).toBe(true);
    // 一般 src 檔不應命中(除非 auth/security)
    expect(patterns.some((p) => p.test("src/index.ts"))).toBe(false);
  });
});

describe("兩 sibling checker 的 pairwise diff(anchor 重構前後行為)", () => {
  const cases: Array<{
    path: string;
    docs: boolean;
    bookkeeping: boolean;
    note?: string;
  }> = [
    // README:docs ✓ / bookkeeping ✗
    { path: "README.md", docs: true, bookkeeping: false, note: "純散文" },
    // progress.md:兩個都 ✓
    { path: ".claude/memory/progress.md", docs: true, bookkeeping: true },
    // LESSONS.md:兩個都 ✗(governance)
    { path: ".claude/memory/LESSONS.md", docs: false, bookkeeping: false, note: "governance" },
    // root TODOS / BACKLOG / TODOS-done:兩個都 ✓
    { path: "TODOS.md", docs: true, bookkeeping: true },
    { path: "BACKLOG.md", docs: true, bookkeeping: true },
    { path: "TODOS-done.md", docs: true, bookkeeping: true },
    // .claude/memory/ 版:兩個都 ✓
    { path: ".claude/memory/TODOS.md", docs: true, bookkeeping: true },
    { path: ".claude/memory/BACKLOG.md", docs: true, bookkeeping: true },
    { path: ".claude/memory/TODOS-done.md", docs: true, bookkeeping: true },
    // progress-archive/*.md:兩個都 ✓
    { path: ".claude/memory/progress-archive/progress-2026-09.md", docs: true, bookkeeping: true },
    // progress-archive/README.md:兩個都 ✗(歸檔慣例文件)
    { path: ".claude/memory/progress-archive/README.md", docs: false, bookkeeping: false },
    // _handoffs/*.md:docs ✓ / bookkeeping ✗
    { path: "_handoffs/HANDOFF.md", docs: true, bookkeeping: false, note: "交接檔應併 sprint PR" },
    // 一般 code:兩個都 ✗
    { path: "src/index.ts", docs: false, bookkeeping: false },
    { path: "scripts/check-progress-codex-review.ts", docs: false, bookkeeping: false },
    // CLAUDE.md:兩個都 ✗(governance)
    { path: "CLAUDE.md", docs: false, bookkeeping: false },
    // .claude/sop/**:兩個都 ✗
    { path: ".claude/sop/plan-mode-checklist.md", docs: false, bookkeeping: false },
  ];

  for (const c of cases) {
    it(`${c.path} → docs=${c.docs}, bookkeeping=${c.bookkeeping}${c.note ? ` (${c.note})` : ""}`, () => {
      expect(isDocsFile(c.path)).toBe(c.docs);
      expect(isBookkeepingPath(c.path)).toBe(c.bookkeeping);
    });
  }

  it("progress-archive 子目錄不放行", () => {
    expect(isDocsFile(".claude/memory/progress-archive/subdir/foo.md")).toBe(false);
    expect(isBookkeepingPath(".claude/memory/progress-archive/subdir/foo.md")).toBe(false);
  });

  it("_handoffs 非 .md 不放行(docs)", () => {
    expect(isDocsFile("_handoffs/HANDOFF.txt")).toBe(false);
  });
});
