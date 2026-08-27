import { describe, it, expect } from "vitest";
import { classifyBookkeepingFiles, isBookkeepingPath } from "../scripts/check-bookkeeping-commit";

describe("isBookkeepingPath — 純函式", () => {
  it("progress.md → true", () => {
    expect(isBookkeepingPath(".claude/memory/progress.md")).toBe(true);
  });

  it("TODOS.md → true", () => {
    expect(isBookkeepingPath(".claude/memory/TODOS.md")).toBe(true);
  });

  it("BACKLOG.md → true", () => {
    expect(isBookkeepingPath(".claude/memory/BACKLOG.md")).toBe(true);
  });

  it("progress-archive/*.md → true(子目錄下的 .md 也算)", () => {
    expect(isBookkeepingPath(".claude/memory/progress-archive/2026-Q2.md")).toBe(true);
  });

  it("LESSONS.md → false(治理內容,不算 bookkeeping)", () => {
    expect(isBookkeepingPath(".claude/memory/LESSONS.md")).toBe(false);
  });

  it("LESSONS-archive/xxx.md → true(archive 下算 bookkeeping,current 才擋)", () => {
    expect(isBookkeepingPath(".claude/memory/LESSONS-archive/2026-Q1.md")).toBe(true);
  });

  it("SOP 檔 → false", () => {
    expect(isBookkeepingPath(".claude/sop/plan-mode-checklist.md")).toBe(false);
  });

  it("CLAUDE.md → false", () => {
    expect(isBookkeepingPath("CLAUDE.md")).toBe(false);
  });

  it("scripts/xxx.ts → false", () => {
    expect(isBookkeepingPath("scripts/mutate.ts")).toBe(false);
  });

  it("README.md → false", () => {
    expect(isBookkeepingPath("README.md")).toBe(false);
  });

  it(".claude/memory/xxx.txt(非 .md)→ false", () => {
    expect(isBookkeepingPath(".claude/memory/README.txt")).toBe(false);
  });

  it("路徑不以 .claude/memory/ 開頭 → false(擋相對路徑 escape)", () => {
    expect(isBookkeepingPath("claude/memory/progress.md")).toBe(false);
  });

  it("空字串 → false", () => {
    expect(isBookkeepingPath("")).toBe(false);
  });

  it(".claude/memory/(目錄本身,無 basename)→ false", () => {
    expect(isBookkeepingPath(".claude/memory/")).toBe(false);
  });
});

describe("classifyBookkeepingFiles — 檔案清單分類", () => {
  it("純 progress.md → 0 violations", () => {
    const { bookkeeping, violations } = classifyBookkeepingFiles([".claude/memory/progress.md"]);
    expect(bookkeeping).toEqual([".claude/memory/progress.md"]);
    expect(violations).toEqual([]);
  });

  it("progress + TODOS 兩檔 → 都是 bookkeeping", () => {
    const files = [".claude/memory/progress.md", ".claude/memory/TODOS.md"];
    const { bookkeeping, violations } = classifyBookkeepingFiles(files);
    expect(bookkeeping).toEqual(files);
    expect(violations).toEqual([]);
  });

  it("progress + scripts/mutate.ts 混雜 → violation", () => {
    const { bookkeeping, violations } = classifyBookkeepingFiles([
      ".claude/memory/progress.md",
      "scripts/mutate.ts",
    ]);
    expect(bookkeeping).toEqual([".claude/memory/progress.md"]);
    expect(violations).toEqual(["scripts/mutate.ts"]);
  });

  it("progress + LESSONS.md → LESSONS 是 violation(治理內容)", () => {
    const { bookkeeping, violations } = classifyBookkeepingFiles([
      ".claude/memory/progress.md",
      ".claude/memory/LESSONS.md",
    ]);
    expect(bookkeeping).toEqual([".claude/memory/progress.md"]);
    expect(violations).toEqual([".claude/memory/LESSONS.md"]);
  });

  it("progress + SOP 混雜 → SOP 是 violation", () => {
    const { bookkeeping, violations } = classifyBookkeepingFiles([
      ".claude/memory/progress.md",
      ".claude/sop/plan-mode-checklist.md",
    ]);
    expect(bookkeeping).toEqual([".claude/memory/progress.md"]);
    expect(violations).toEqual([".claude/sop/plan-mode-checklist.md"]);
  });

  it("空清單 → 兩者都空(空 diff 由 main 另外處理成 exit 2)", () => {
    const { bookkeeping, violations } = classifyBookkeepingFiles([]);
    expect(bookkeeping).toEqual([]);
    expect(violations).toEqual([]);
  });

  it("保留輸入順序(輸出時對得上 diff 檔清單原順序)", () => {
    const { bookkeeping, violations } = classifyBookkeepingFiles([
      "scripts/a.ts",
      ".claude/memory/progress.md",
      "README.md",
      ".claude/memory/TODOS.md",
    ]);
    expect(bookkeeping).toEqual([".claude/memory/progress.md", ".claude/memory/TODOS.md"]);
    expect(violations).toEqual(["scripts/a.ts", "README.md"]);
  });
});
