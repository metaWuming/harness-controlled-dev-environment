import { afterEach, describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { classifyBookkeepingFiles, isBookkeepingPath } from "../scripts/check-bookkeeping-commit";

// 用 git 拿 REPO_ROOT(對齊 mutate.test.ts;避免 URL pathname 對含中文 repo 路徑的 URI-encoded 問題)
const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim();
const TSX_BIN = join(REPO_ROOT, "node_modules/.bin/tsx");
const SCRIPT = join(REPO_ROOT, "scripts/check-bookkeeping-commit.ts");

const created: string[] = [];
afterEach(() => {
  while (created.length) {
    try {
      rmSync(created.pop()!, { recursive: true, force: true });
    } catch {
      /* 清理失敗不擋測試 */
    }
  }
});

/** 建拋棄式 git repo,回傳 repo dir。initFiles 預設含一份 governance LESSONS.md。 */
function makeRepo(initFiles: Record<string, string> = { ".claude/memory/LESSONS.md": "governance\n" }): string {
  const dir = mkdtempSync(join(tmpdir(), "bookkeeping-e2e-"));
  created.push(dir);
  const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
  for (const [rel, body] of Object.entries(initFiles)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  git("add", "-A");
  git("commit", "-qm", "init");
  return dir;
}

/** 跑 script,回傳 {code, out}。 */
function runScript(cwd: string, args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync(TSX_BIN, [SCRIPT, ...args], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

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

  it("🔴 round 3 P2:LESSONS-archive/2026-Q1.md → false(archived lessons 屬 governance,同 LESSONS.md)", () => {
    expect(isBookkeepingPath(".claude/memory/LESSONS-archive/2026-Q1.md")).toBe(false);
  });

  it("🔴 round 3 P2:LESSONS-archive/ 底下所有 .md 一律 false", () => {
    expect(isBookkeepingPath(".claude/memory/LESSONS-archive/any-snapshot.md")).toBe(false);
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

// ───────────────────────────────────────── 端到端(拋棄式 git repo)

describe("check-bookkeeping-commit — 端到端 CLI", () => {
  it("🔴 Codex round 4 P2:rename LESSONS.md → progress-archive/xxx.md → 拒收(--no-renames 展開)", () => {
    // 沒 --no-renames 的話,`diff-tree --name-only` 對這種 rename 只印目的地
    // (`.claude/memory/progress-archive/xxx.md`,屬 allowlist)→ exit 0、繞過。
    // 加 --no-renames 之後,展開成「刪 LESSONS.md + 加 archive/xxx.md」——
    // LESSONS.md 屬 governance → exit 1。本測試守 getChangedFiles 的 flag 接線,
    // 純函式 classifyBookkeepingFiles 抓不到。
    const dir = makeRepo({ ".claude/memory/LESSONS.md": "governance content\n" });
    const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
    // rename 進 allowlist 路徑
    mkdirSync(join(dir, ".claude/memory/progress-archive"), { recursive: true });
    git("mv", ".claude/memory/LESSONS.md", ".claude/memory/progress-archive/lessons-snapshot.md");
    git("commit", "-qm", "rename to archive");
    const { code, out } = runScript(dir, ["HEAD"]);
    expect(code).toBe(1);
    expect(out).toContain(".claude/memory/LESSONS.md"); // 展開的舊路徑要被列出當 violation
  });

  it("🔴 空白路徑不會被 trim 誤判(Codex round 1 P2 的 CLI 端護)", () => {
    // 檔名以空白開頭:git 對這種路徑會 quote,`-z` + 不 trim 保留原樣。
    // (實際 git 不允許 leading space commit,但這裡驗 CLI 分隔邏輯——
    //  用 rename 到 allowlist 路徑仍應拒收,證明分隔不吃空白)
    const dir = makeRepo({ ".claude/memory/LESSONS.md": "governance\n" });
    const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
    // 建一個 scripts/ code 檔 + commit(scripts/ 屬 denylist,應被列出)
    mkdirSync(join(dir, "scripts"), { recursive: true });
    writeFileSync(join(dir, "scripts/hello.ts"), "console.log('x');\n");
    git("add", "-A");
    git("commit", "-qm", "add code file");
    const { code, out } = runScript(dir, ["HEAD"]);
    expect(code).toBe(1);
    expect(out).toContain("scripts/hello.ts"); // 精確路徑要留完整
  });

  it("多餘參數 → exit 2(Codex round 1 P2 的 CLI 端護)", () => {
    const dir = makeRepo();
    const { code, out } = runScript(dir, ["HEAD", "HEAD~1"]);
    expect(code).toBe(2);
    expect(out).toContain("多餘參數");
  });

  it("純 bookkeeping commit(改 TODOS.md at root)→ exit 0", () => {
    // fixture 刻意避開「PR #<num>」pattern(check:no-source-terms denylist 擋
    // 來源專案 PR 引用洩漏,連 fixture 字面都會被抓)。allowlist 只看路徑、
    // 內容不影響判定,fixture 語意用「已交付」佔位即可。
    const dir = makeRepo({ "TODOS.md": "old\n" });
    const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
    writeFileSync(join(dir, "TODOS.md"), "old\n- ✅ 新項目(已交付)\n");
    git("add", "-A");
    git("commit", "-qm", "bookkeeping: TODOS 已交付標記");
    const { code, out } = runScript(dir, ["HEAD"]);
    expect(code).toBe(0);
    expect(out).toContain("全部檔案都在 bookkeeping allowlist 內");
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
