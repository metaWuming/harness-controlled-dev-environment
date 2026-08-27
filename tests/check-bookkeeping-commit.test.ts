import { describe, it, expect } from "vitest";
import { classifyBookkeepingFiles, isBookkeepingPath } from "../scripts/check-bookkeeping-commit";

describe("isBookkeepingPath — 純函式(精確 allowlist)", () => {
  // ── EXACT_ALLOW:精確清單

  it("progress.md → true", () => {
    expect(isBookkeepingPath(".claude/memory/progress.md")).toBe(true);
  });

  it("TODOS.md (repo root) → true(repo 現況 canonical)", () => {
    expect(isBookkeepingPath("TODOS.md")).toBe(true);
  });

  it(".claude/memory/TODOS.md → true(SOP L399 也用這條路徑,兩處都算)", () => {
    expect(isBookkeepingPath(".claude/memory/TODOS.md")).toBe(true);
  });

  it("BACKLOG.md (repo root) → true", () => {
    expect(isBookkeepingPath("BACKLOG.md")).toBe(true);
  });

  it(".claude/memory/BACKLOG.md → true", () => {
    expect(isBookkeepingPath(".claude/memory/BACKLOG.md")).toBe(true);
  });

  it("TODOS-done.md (repo root) → true", () => {
    expect(isBookkeepingPath("TODOS-done.md")).toBe(true);
  });

  it(".claude/memory/TODOS-done.md → true", () => {
    expect(isBookkeepingPath(".claude/memory/TODOS-done.md")).toBe(true);
  });

  // ── ARCHIVE snapshot:直接檔 + basename 不是 README

  it("progress-archive/2026-Q2.md → true(季度 snapshot)", () => {
    expect(isBookkeepingPath(".claude/memory/progress-archive/2026-Q2.md")).toBe(true);
  });

  it("LESSONS-archive/2026-Q1.md → true(季度 snapshot)", () => {
    expect(isBookkeepingPath(".claude/memory/LESSONS-archive/2026-Q1.md")).toBe(true);
  });

  // ── 🔴 Codex round 2 P1:archive README.md 是歸檔慣例、屬 governance

  it("progress-archive/README.md → false(歸檔慣例,屬 governance)", () => {
    expect(isBookkeepingPath(".claude/memory/progress-archive/README.md")).toBe(false);
  });

  it("LESSONS-archive/README.md → false(歸檔慣例含 SOP 指示,屬 governance)", () => {
    expect(isBookkeepingPath(".claude/memory/LESSONS-archive/README.md")).toBe(false);
  });

  it("archive 子目錄下的 .md → false(不進子目錄)", () => {
    expect(isBookkeepingPath(".claude/memory/progress-archive/2026/Q2.md")).toBe(false);
  });

  it("archive 目錄下非 .md → false", () => {
    expect(isBookkeepingPath(".claude/memory/progress-archive/README.txt")).toBe(false);
  });

  it("archive 目錄本身(無 basename)→ false", () => {
    expect(isBookkeepingPath(".claude/memory/progress-archive/")).toBe(false);
  });

  // ── LESSONS.md 與所有其他 governance / code 一律 false

  it("LESSONS.md → false(治理內容)", () => {
    expect(isBookkeepingPath(".claude/memory/LESSONS.md")).toBe(false);
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

  it("README.md (repo root) → false", () => {
    expect(isBookkeepingPath("README.md")).toBe(false);
  });

  it(".claude/memory/ 下不在 EXACT_ALLOW 也不在 archive 目錄 → false(收窄:不再放行任意 memory .md)", () => {
    expect(isBookkeepingPath(".claude/memory/randomfile.md")).toBe(false);
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
