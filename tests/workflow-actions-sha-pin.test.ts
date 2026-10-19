// tests/workflow-actions-sha-pin.test.ts — 每個 workflow 的 `uses:` 都要固定到 40 字元 commit SHA
//
// 緣起:README 關卡 ⑪ 宣稱 actions SHA-pin,但只有 branch-protection.yml 有測試守著;
// 把 ci.yml 的 setup-node 改回 `@v7`,整套測試仍全綠(mutation 探針存活,2026-10-19)。
// 本地 action(`./`)與 docker image(`docker://`)不適用 SHA-pin,略過。
// key 與值都允許 YAML 單 / 雙引號;flow mapping(`{ uses: ... }`)不支援,本 repo 未使用。

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const WORKFLOW_DIR = path.resolve(__dirname, "../.github/workflows");
const USES_RE = /^\s*(?:-\s*)?(['"]?)uses\1\s*:\s*(['"]?)([^'"\s#]+)\2/;
const SHA_RE = /^[0-9a-f]{40}$/;

/** 回傳沒有固定到 40 字元 SHA 的 `uses:` 目標(行號從 1 起算) */
export function findUnpinned(content: string): { line: number; target: string }[] {
  const out: { line: number; target: string }[] = [];
  content.split("\n").forEach((text, i) => {
    const m = text.match(USES_RE);
    if (!m) return;
    const target = m[3];
    if (target.startsWith("./") || target.startsWith("docker://")) return;
    const ref = target.split("@")[1] ?? "";
    if (!SHA_RE.test(ref)) out.push({ line: i + 1, target });
  });
  return out;
}

describe("findUnpinned", () => {
  it("可變 tag 與缺 ref 都抓到,SHA 與本地 action 放行", () => {
    const sample = [
      "      - uses: actions/checkout@v7",
      "        uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0",
      "        uses: some/action",
      "      - uses: ./local-action",
      "      - 'uses': actions/setup-node@v7",
      "        uses: 'actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1'",
      "        \"uses\": \"actions/checkout@main\"",
    ].join("\n");
    expect(findUnpinned(sample)).toEqual([
      { line: 1, target: "actions/checkout@v7" },
      { line: 3, target: "some/action" },
      { line: 5, target: "actions/setup-node@v7" },
      { line: 7, target: "actions/checkout@main" },
    ]);
  });
});

describe(".github/workflows 全部 actions 固定 SHA", () => {
  const files = fs.readdirSync(WORKFLOW_DIR).filter((f) => /\.ya?ml$/.test(f));

  it("至少有 1 個 workflow、且至少有 1 行 uses:(避免空集合假綠)", () => {
    expect(files.length).toBeGreaterThan(0);
    const total = files.reduce((n, f) => n + fs.readFileSync(path.join(WORKFLOW_DIR, f), "utf8").split("\n").filter((l) => USES_RE.test(l)).length, 0);
    expect(total).toBeGreaterThan(0);
  });

  it.each(files)("%s 的每個 uses: 都是 40 字元 SHA", (file) => {
    expect(findUnpinned(fs.readFileSync(path.join(WORKFLOW_DIR, file), "utf8"))).toEqual([]);
  });
});
