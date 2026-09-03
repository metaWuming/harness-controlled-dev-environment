// tests/ci-step-conditions.test.ts — CI step 條件 structural lock(A3 defer ⑩ CTRL-CI-014 P1-B)
//
// 對 .github/workflows/ci.yml 內指定 step,YAML-parse-style 驗**直接子層** if / run
// 的值。不用 grep(可能命中註解或別的 step 假綠)。
//
// DP-M3 mutant 的 killer:若 CI step `if:` 被改為 branch filter(如
// `github.base_ref == 'main'`)、或 run: 用可移動 branch ref 而非 immutable base SHA,
// 此 test 立刻紅。

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "..");
const CI_YML = path.join(REPO, ".github/workflows/ci.yml");

interface StepBlock {
  startLine: number;    // 1-indexed;`- name:` 行號
  keyIndent: number;    // item 內直屬子層縮排(name / if / run 等)
  itemIndent: number;   // `-` 的縮排
  endLine: number;      // exclusive
  lines: string[];      // 原始行
}

/**
 * 找一支 step by name;回傳它的行範圍 + 直屬子層縮排。
 * 只讀 `steps:` 區塊內、`- name:` 開頭的 item;name 匹配後掃到下一個同 itemIndent 的 `-` 或區塊結束。
 */
function findStepByName(yml: string, stepName: string): StepBlock | null {
  const lines = yml.split("\n");
  let stepsIndent = -1;
  let itemIndent = -1;
  let inTarget: { start: number; keyIndent: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (/^\s*(#|$)/.test(raw)) continue;
    const indent = /^\s*/.exec(raw)![0].length;
    const t = raw.trim();

    // 找 steps: 開始
    if (stepsIndent < 0) {
      if (/^steps:/.test(t)) stepsIndent = indent;
      continue;
    }
    // 離開 steps: 區塊
    if (indent <= stepsIndent && !(t === "-" || t.startsWith("- "))) {
      if (inTarget) return endBlock(inTarget, i, itemIndent, lines);
      stepsIndent = -1;
      itemIndent = -1;
      continue;
    }
    // list item 開始
    if (t === "-" || t.startsWith("- ")) {
      if (itemIndent < 0) itemIndent = indent;
      if (indent === itemIndent) {
        if (inTarget) return endBlock(inTarget, i, itemIndent, lines);
        // 檢查 item 的 name(可能 `- name: X` 或 `-\n  name: X`)
        const rest = t.replace(/^-\s*/, "");
        const keyIndent = t === "-" ? -1 : indent + (t.length - rest.length);
        if (/^name:\s*/.test(rest)) {
          const nameVal = rest.slice("name:".length).trim().replace(/^["']|["']$/g, "");
          if (nameVal === stepName) inTarget = { start: i, keyIndent };
        }
        continue;
      }
    }
    // item 內、若這條 item 是 target 且 keyIndent 未定 → 從第一個 child 判定
    if (inTarget && inTarget.keyIndent < 0 && indent > itemIndent) {
      inTarget.keyIndent = indent;
      // 這行本身可能是 name:(target 已鎖定就不再重找)
    }
  }
  if (inTarget) return endBlock(inTarget, lines.length, itemIndent, lines);
  return null;
}

function endBlock(target: { start: number; keyIndent: number }, end: number, itemIndent: number, lines: string[]): StepBlock {
  return {
    startLine: target.start + 1,
    keyIndent: target.keyIndent,
    itemIndent,
    endLine: end,
    lines: lines.slice(target.start, end),
  };
}

/**
 * 從 step block 讀直接子層某 key 的值(單行 scalar);找不到回 null。
 * 不支援 block scalar(`|` / `>`)或多行 sequence;那些 key 用 findChildRawBlock。
 */
function readChildScalar(block: StepBlock, key: string): string | null {
  for (const raw of block.lines.slice(1)) {
    if (/^\s*(#|$)/.test(raw)) continue;
    const indent = /^\s*/.exec(raw)![0].length;
    const t = raw.trim();
    if (indent !== block.keyIndent) continue;
    const prefix = key + ":";
    if (t.startsWith(prefix)) {
      const rest = t.slice(prefix.length).trim();
      if (rest.startsWith("|") || rest.startsWith(">")) return null; // block scalar
      // 只有整個值頭尾都是同款引號才剝(避免剝掉內含引號的值,如 `X == 'pull_request'`)
      if ((rest.startsWith('"') && rest.endsWith('"')) || (rest.startsWith("'") && rest.endsWith("'"))) {
        return rest.slice(1, -1);
      }
      return rest;
    }
  }
  return null;
}

/** 讀直接子層 key 的原始值(含 block scalar);回原始行陣列去掉 key 那一行的前置。 */
function readChildRawBlock(block: StepBlock, key: string): string | null {
  const lines = block.lines;
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]!;
    if (/^\s*(#|$)/.test(raw)) continue;
    const indent = /^\s*/.exec(raw)![0].length;
    const t = raw.trim();
    if (indent !== block.keyIndent) continue;
    const prefix = key + ":";
    if (!t.startsWith(prefix)) continue;
    const rest = t.slice(prefix.length).trim();
    // 若同行有值(如 `run: something` 或 `run: | something`)
    if (rest && rest !== "|" && rest !== ">") return rest;
    // block scalar:抓所有比 keyIndent 深的行
    const out: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      const r2 = lines[j]!;
      if (/^\s*(#|$)/.test(r2)) {
        out.push(r2);
        continue;
      }
      const in2 = /^\s*/.exec(r2)![0].length;
      if (in2 <= block.keyIndent) break;
      out.push(r2);
    }
    return out.join("\n");
  }
  return null;
}

describe("CI step 條件 structural lock(A3 defer ⑩ CTRL-CI-014 P1-B)", () => {
  const yml = readFileSync(CI_YML, "utf-8");
  const STEP_NAME = "Protected Branches Drift Check";
  const block = findStepByName(yml, STEP_NAME);

  it("step 「Protected Branches Drift Check」存在於 .github/workflows/ci.yml", () => {
    expect(block).not.toBeNull();
    expect(block!.startLine).toBeGreaterThan(0);
  });

  it("其直接子層 `if:` 值**逐字等於** `github.event_name == 'pull_request'`(DP-M3 killer)", () => {
    expect(block).not.toBeNull();
    const ifVal = readChildScalar(block!, "if");
    expect(ifVal).not.toBeNull();
    expect(ifVal).toBe("github.event_name == 'pull_request'");
  });

  it("其直接子層 `run:` 含逐字 `${{ github.event.pull_request.base.sha }}`(rev5 P1-A trust-boundary)", () => {
    expect(block).not.toBeNull();
    const runRaw = readChildRawBlock(block!, "run");
    expect(runRaw).not.toBeNull();
    expect(runRaw).toContain("${{ github.event.pull_request.base.sha }}");
  });

  it("其直接子層 `run:` 不含 branch-ref 形式的 --base=(對抗 trust-boundary regression)", () => {
    expect(block).not.toBeNull();
    const runRaw = readChildRawBlock(block!, "run");
    expect(runRaw).not.toBeNull();
    // 允許 --base=${{ ... base.sha }} 但不允許 --base=origin/... 或 --base=$BASE_REF 這類可移動 ref
    expect(runRaw).not.toMatch(/--base=(origin\/|\$BASE_REF|\$\{BASE_REF\}|\$\{\{ github\.base_ref \}\})/);
  });
});
