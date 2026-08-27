// @vitest-environment node
//
// `scripts/check-doc-size.ts` 的守門測試。
//
// 🔴 為什麼一定要有這支:**exit-code 型的守門腳本必須有「健康時真的 exit 0」的
//    正對照測試**。缺正對照的守門會靜靜失效很久,沒有任何徵兆——這是「守門機制要
//    定期實證它還活著」這條紀律,在測試層的直接落地。新增閘門卻不附正對照,
//    等於當場重演同一個錯。

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  BUDGETS,
  checkDocSizes,
  formatReport,
  type DocBudget,
} from "../scripts/check-doc-size";

const created: string[] = [];
afterEach(() => {
  while (created.length) rmSync(created.pop()!, { recursive: true, force: true });
});

/** 建一個拋棄式 repo 骨架,每個 doc 填指定 bytes。 */
function makeRepo(files: Record<string, number>): string {
  const dir = mkdtempSync(join(tmpdir(), "doc-size-"));
  created.push(dir);
  for (const [rel, bytes] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, "x".repeat(bytes));
  }
  return dir;
}

const BUDGET: DocBudget[] = [{ doc: "a/one.md", maxBytes: 1000, remedy: "搬到封存目錄" }];

describe("check-doc-size — 記錄檔肥大守門", () => {
  it("🔴 正對照:都在額度內 → ok(缺正對照的守門會靜靜失效很久)", () => {
    const r = checkDocSizes(makeRepo({ "a/one.md": 999 }), BUDGET);
    expect(r[0].over).toBe(false);
    expect(formatReport(r).ok).toBe(true);
  });

  it("超標 → 不 ok,且訊息要**帶著怎麼修**(只說「太大了」等於沒說)", () => {
    const r = checkDocSizes(makeRepo({ "a/one.md": 1001 }), BUDGET);
    expect(r[0].over).toBe(true);
    const { text, ok } = formatReport(r);
    expect(ok).toBe(false);
    expect(text).toContain("搬到封存目錄");
    expect(text).toContain("1.0 KB");
  });

  it("邊界:剛好等於上限 → 放行(嚴格大於才算超標)", () => {
    expect(checkDocSizes(makeRepo({ "a/one.md": 1000 }), BUDGET)[0].over).toBe(false);
  });

  it("🔴 檔案不存在 → fail-closed(改名／刪檔不該讓這道閘靜靜變成 0 個檢查)", () => {
    const r = checkDocSizes(makeRepo({}), BUDGET);
    expect(r[0].missing).toBe(true);
    expect(r[0].over).toBe(true);
    expect(formatReport(r).ok).toBe(false);
  });

  // 🔴 Codex R1 P2:「檔案存在但不是 regular file」的每一種形狀都要 fail-closed——
  //    directory / symlink / device 都會讓舊版 `existsSync + statSync` 拿到一個
  //    無意義的 size(可能低於額度),閘門報綠、實際要治理的記錄檔已不存在。
  it("🔴 是 directory 而不是檔案 → fail-closed(missing)", () => {
    const dir = mkdtempSync(join(tmpdir(), "doc-size-dir-"));
    created.push(dir);
    // 造一個叫 a/one.md 的**目錄**——舊版 statSync 會回它,size 通常很小
    mkdirSync(join(dir, "a", "one.md"), { recursive: true });
    const r = checkDocSizes(dir, BUDGET);
    expect(r[0].missing).toBe(true);
    expect(r[0].over).toBe(true);
  });

  it("🔴 是 symlink(可能指到 repo 外)→ fail-closed(missing,不跟隨)", () => {
    const dir = mkdtempSync(join(tmpdir(), "doc-size-link-"));
    created.push(dir);
    mkdirSync(join(dir, "a"), { recursive: true });
    // 造一個 symlink 指到 /tmp/some-small-file,舊版跟隨後可能拿到低於額度的 size
    const tinyTarget = mkdtempSync(join(tmpdir(), "doc-size-tiny-"));
    created.push(tinyTarget);
    writeFileSync(join(tinyTarget, "tiny.md"), "x"); // 1 byte
    symlinkSync(join(tinyTarget, "tiny.md"), join(dir, "a", "one.md"));
    const r = checkDocSizes(dir, BUDGET);
    expect(r[0].missing).toBe(true);
    expect(r[0].over).toBe(true);
  });

  it("額度表本身不得為空——空表會讓這道閘永遠綠", () => {
    expect(BUDGETS.length).toBeGreaterThan(0);
    for (const b of BUDGETS) {
      expect(b.maxBytes).toBeGreaterThan(0);
      expect(b.remedy.length).toBeGreaterThan(10); // 每條都要有可執行的修法
    }
  });

  it("🔴 額度數字要**釘住**——不然「無聲調高就是把閘門關掉」那條規則沒有人在守", () => {
    // 🔴 為什麼要釘:原本這支只驗 `maxBytes > 0`,於是任何人都能把額度改大而
    //    **沒有任何東西轉紅**——`check-doc-size.ts` 檔頭明寫「調整必須寫下理由,
    //    無聲調高就是把閘門關掉」,但那條規則在此之前**完全沒有機器在守**
    //    (denylist 型守衛是空門,同一形狀)。釘住之後,改額度就必須連這裡一起改
    //    → 變成一個**看得見、要解釋**的動作。
    // ⚠️ 誠實界線:這守的是「不得無聲改動」,**不是**「這個數字是對的」——
    //    數字對不對要看檔頭寫的理由,那是人的判斷。
    const budgets = Object.fromEntries(BUDGETS.map((b) => [b.doc, b.maxBytes]));
    expect(budgets).toEqual({
      ".claude/memory/progress.md": 20_000,
      ".claude/memory/LESSONS.md": 60_000,
    });
  });

  it("額度表涵蓋「每次開工必讀」的模板附帶記錄檔", () => {
    const docs = BUDGETS.map((b) => b.doc);
    expect(docs).toContain(".claude/memory/progress.md");
    expect(docs).toContain(".claude/memory/LESSONS.md");
  });

  it("🔴 端到端:真的跑腳本,對真 repo 現況 exit 0", () => {
    const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf-8",
    }).trim();
    const out = execFileSync("npx", ["tsx", "scripts/check-doc-size.ts"], {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    expect(out).toContain("✅");
  });
});
