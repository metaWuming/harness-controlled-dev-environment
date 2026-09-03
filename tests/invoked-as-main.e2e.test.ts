// tests/invoked-as-main.e2e.test.ts — 三 consumer 真 CLI 行為 e2e(12 案)
//
// 4 場景 × 3 consumer:
//   #1 direct         — tsx scripts/<name>.ts       → main branch 執行、無 [invoked-as-main] stderr
//   #2 symlink dir    — tsx <link>/scripts/<name>.ts → 完全等同 #1(兩端 realpath 一致)、無 indeterminate
//   #3 import 情境    — tsx wrapper.mjs(不設 IAM_DANGLING)→ target 頂層歸 import-or-not-main、完全靜默、無 main output
//   #4 indeterminate — tsx wrapper.mjs IAM_DANGLING=1 → target 頂層歸 indeterminate、stderr 有 sanitized 診斷、caller exit 2
//
// wrapper 檔在 tests/fixtures/invoked-as-main-wrapper/;共用邏輯以 env 差別控制。
// symlink fixture 自建、不依賴 OS /tmp 是不是 symlink 的巧合(對抗 CI Linux 差異)。

import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "..");
const TSX = path.join(REPO, "node_modules/.bin/tsx");
const WRAPPER_DIR = path.join(REPO, "tests/fixtures/invoked-as-main-wrapper");

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function mkSymlinkToRepo(): { linkDir: string; linkedRepo: string } {
  // 建一個 tmp 目錄,底下放一個 symlink 指到 REPO;不依賴 /tmp 本身是不是 symlink
  const parent = mkdtempSync(path.join(tmpdir(), "iam-e2e-link-"));
  tmpDirs.push(parent);
  const linkedRepo = path.join(parent, "repo-link");
  symlinkSync(REPO, linkedRepo);
  return { linkDir: parent, linkedRepo };
}

type RunResult = { status: number | null; stdout: string; stderr: string };

function run(scriptPath: string, args: string[] = [], env: Record<string, string> = {}): RunResult {
  const r = spawnSync(TSX, [scriptPath, ...args], {
    cwd: REPO,
    encoding: "utf-8",
    env: { ...process.env, ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function assertExpectedExit(actual: number | null, expected: number | readonly number[]): void {
  if (Array.isArray(expected)) {
    expect(expected).toContain(actual);
  } else {
    expect(actual).toBe(expected);
  }
}

interface ConsumerSpec {
  label: string;
  scriptName: string;
  wrapperName: string;
  // number 或 number[]:某些 consumer(如 check-bookkeeping-commit)的正常 exit code
  // 依 HEAD 內容變化(bookkeeping commit → exit 0、含 code → exit 1)——用 array
  // 表示「兩者都是合法 direct 狀態」;matcher 需自行區分共同 stdout 特徵
  expectedMainExit: number | readonly number[];
  expectedMainMatcher: (r: RunResult) => void;
}

const CONSUMERS: ConsumerSpec[] = [
  {
    label: "mutate",
    scriptName: "mutate.ts",
    wrapperName: "mutate-wrapper.mjs",
    expectedMainExit: 2,
    expectedMainMatcher: (r) => {
      // mutate.ts 無 args 時 fail-closed exit 2、stderr 印「拒跑」
      expect(r.stderr).toMatch(/拒跑|工作樹不乾淨|✗/);
    },
  },
  {
    label: "check-control-catalog",
    scriptName: "check-control-catalog.ts",
    wrapperName: "check-control-catalog-wrapper.mjs",
    expectedMainExit: 0,
    expectedMainMatcher: (r) => {
      expect(r.stdout).toContain("CATALOG_OK");
    },
  },
  {
    label: "check-mutation-specs",
    scriptName: "check-mutation-specs.ts",
    wrapperName: "check-mutation-specs-wrapper.mjs",
    expectedMainExit: 0,
    expectedMainMatcher: (r) => {
      expect(r.stdout).toContain("mutation spec 樣本都對得上");
    },
  },
  {
    label: "check-doc-size",
    scriptName: "check-doc-size.ts",
    wrapperName: "check-doc-size-wrapper.mjs",
    expectedMainExit: 0,
    expectedMainMatcher: (r) => {
      expect(r.stdout).toContain("記錄檔都在額度內");
    },
  },
  {
    label: "check-bookkeeping-commit",
    scriptName: "check-bookkeeping-commit.ts",
    wrapperName: "check-bookkeeping-commit-wrapper.mjs",
    // direct exit 依 HEAD 內容變:code commit → exit 1(印 violations)、
    // bookkeeping commit → exit 0(印「全部檔案都在 bookkeeping allowlist 內」)。
    // 兩者都是 direct 正常執行的合法狀態,共同特徵是「目標 commit:」前綴。
    // (Step 5 高風險 worktree 審 CRITICAL:sprint 中段跑時 HEAD 是 code commit
    //  → exit 1、綠;round 1 P2 散文 fix 只碰 TODOS 屬 bookkeeping → HEAD 變
    //  bookkeeping commit → exit 0、舊硬綁 1 斷言紅。修:接受 [0, 1]。)
    expectedMainExit: [0, 1],
    expectedMainMatcher: (r) => {
      expect(r.stdout).toContain("目標 commit:");
    },
  },
  {
    label: "check-no-source-terms",
    scriptName: "check-no-source-terms.ts",
    wrapperName: "check-no-source-terms-wrapper.mjs",
    expectedMainExit: 0,
    expectedMainMatcher: (r) => {
      expect(r.stdout).toContain("allowedPrs");
    },
  },
  {
    label: "check-cso-trigger",
    scriptName: "check-cso-trigger.ts",
    wrapperName: "check-cso-trigger-wrapper.mjs",
    // 模板 repo cso 路徑表為空 → fail-closed exit 2(正常狀態、非 error)
    expectedMainExit: 2,
    expectedMainMatcher: (r) => {
      expect(r.stdout).toContain("CSO_REQUIRED");
    },
  },
  {
    label: "check-adoption-readiness",
    scriptName: "check-adoption-readiness.ts",
    wrapperName: "check-adoption-readiness-wrapper.mjs",
    expectedMainExit: 0,
    expectedMainMatcher: (r) => {
      expect(r.stdout).toContain("TEMPLATE_MODE");
    },
  },
  {
    label: "check-doc-refs",
    scriptName: "check-doc-refs.ts",
    wrapperName: "check-doc-refs-wrapper.mjs",
    expectedMainExit: 0,
    expectedMainMatcher: (r) => {
      expect(r.stdout).toContain("失效引用");
    },
  },
  {
    label: "check-baseline-governance",
    scriptName: "check-baseline-governance.ts",
    wrapperName: "check-baseline-governance-wrapper.mjs",
    // direct 無 --base args → fail-closed exit 2 + stderr「--base=<ref> 必填」
    expectedMainExit: 2,
    expectedMainMatcher: (r) => {
      expect(r.stderr).toContain("--base=<ref>");
    },
  },
  {
    label: "render-control-catalog",
    scriptName: "render-control-catalog.ts",
    wrapperName: "render-control-catalog-wrapper.mjs",
    // direct 無 args → fail-closed exit 2 + stderr「用法:tsx scripts/render-control-catalog.ts」
    expectedMainExit: 2,
    expectedMainMatcher: (r) => {
      expect(r.stderr).toContain("用法:tsx scripts/render-control-catalog.ts");
    },
  },
];

for (const spec of CONSUMERS) {
  describe(`consumer:${spec.label}`, () => {
    it(`#1 direct 呼叫 → main 執行、exit ${spec.expectedMainExit}、無 [invoked-as-main] stderr`, () => {
      const scriptPath = path.join(REPO, "scripts", spec.scriptName);
      const r = run(scriptPath);
      assertExpectedExit(r.status, spec.expectedMainExit);
      spec.expectedMainMatcher(r);
      expect(r.stderr).not.toContain("[invoked-as-main]");
      expect(r.stderr).not.toContain("indeterminate");
    });

    it(`#2 symlink dir 呼叫 → 完全等同 #1(兩端 realpath 一致)、無 indeterminate 診斷`, () => {
      const { linkedRepo } = mkSymlinkToRepo();
      const linkedScript = path.join(linkedRepo, "scripts", spec.scriptName);
      const r = run(linkedScript);
      assertExpectedExit(r.status, spec.expectedMainExit);
      spec.expectedMainMatcher(r);
      expect(r.stderr).not.toContain("[invoked-as-main]");
      expect(r.stderr).not.toContain("indeterminate");
    });

    it(`#3 import 情境 → target import-or-not-main、完全靜默、無 main 特徵輸出`, () => {
      const wrapperPath = path.join(WRAPPER_DIR, spec.wrapperName);
      const r = run(wrapperPath); // 不設 IAM_DANGLING
      // wrapper 自然結束(target main 不執行);exit 應為 0(node 預設)
      expect(r.status).toBe(0);
      // 關鍵:reporter 對 import-or-not-main 完全靜默——**stderr 必須完全為空**
      // (Step 5 worktree F1 修:先前只擋特定字面,IAM-M3 mutant 印 `fake\n` 因無擋
      // 這條字面而通過 e2e case #3;補這條全空斷言後 mutant 由 e2e 也能 kill,
      // 不再只靠 unit #10 兜底)
      expect(r.stderr).toBe("");
      // stdout 也應完全靜默(target main 不執行)
      expect(r.stdout).toBe("");
    });

    it(`#4 indeterminate wrapper → 精確驗到 ${spec.label} 自己的 caller exit(2) branch`, () => {
      // Codex Step 4 round 1 P1 修:label 必須精確對到 spec.label(不再接受任意三個 label),
      // check-mutation-specs wrapper 已用 2 步 dynamic import 化解 static chain 問題
      // (詳見 tests/fixtures/invoked-as-main-wrapper/check-mutation-specs-wrapper.mjs 檔頭)。
      // 這樣 caller-wiring mutant(刪本 script 自己的 else-if indeterminate exit branch)
      // 才會被 case #4 精確殺到、gate 不會 fail-open。
      const wrapperPath = path.join(WRAPPER_DIR, spec.wrapperName);
      const r = run(wrapperPath, [], { IAM_DANGLING: "1" });
      expect(r.status).toBe(2);
      expect(r.stderr).toContain("[invoked-as-main]");
      expect(r.stderr).toContain("reason=realpath-failed:argv1");
      // 精確 label 斷言:診斷行必須指出**本 script**、不能是 chain 上先觸發的別的 script
      const diagLine = r.stderr.split("\n").find((l) => l.includes("[invoked-as-main]"));
      expect(diagLine).toBeTruthy();
      expect(diagLine).toContain(`] ${spec.label} 判定 indeterminate`);
      // main 特徵輸出不該出現(caller exit 2 前 main 未執行)
      if (spec.label === "check-control-catalog") {
        expect(r.stdout).not.toContain("CATALOG_OK");
      }
      if (spec.label === "check-mutation-specs") {
        expect(r.stdout).not.toContain("mutation spec 樣本都對得上");
      }
    });
  });
}
