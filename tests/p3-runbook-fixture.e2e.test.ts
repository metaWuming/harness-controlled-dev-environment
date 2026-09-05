// tests/p3-runbook-fixture.e2e.test.ts — P3 delivery-refs 移除集合 defer ① runbook 步驟 5 acceptance evidence
//
// 對應:docs/MIGRATION.md [Unreleased] 附錄 A.1「換交付線 runbook(minimum viable、非推薦操作)」步驟 5
// 「驗證 gates」的 machine-verifiable acceptance。sprint scope literal:supervisor P3 defer ①+② plan r1 APPROVE、
// D5 Option A;沿用既有 tests/check-adoption-readiness.e2e.test.ts 的 makeRepo + CI_TEMPLATE / CI_ADOPTED
// fixture infrastructure(不新建 抽象)。
//
// 這個 e2e 覆蓋 runbook 完成後最 minimum 的 canonical state:default-branch-only 交付線
// (deliveryBranches: ['main']、無 develop 交付線、三處 if 行只含 main 支援);跑 check:adoption 驗 A5.ci.if
// 全綠 = 步驟 5「A5 集合精確等」的 machine-verifiable acceptance。
//
// 不宣稱(對齊 D9 anti-overclaim):
//   - 覆蓋所有 runbook 邊角情境(MARKER_SELF_PR push 無豁免 / Source-term allowedPrs 字面判定等由個案審)
//   - permanent 保證(runbook 是 minimum viable、實際換交付線仍需個案審)
//   - 涵蓋所有 check:X gate(step 5 提到六 gate;本 e2e 專注 A5 acceptance 為 canonical proxy)

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ADR_PATH } from '../scripts/lib/template-governance';

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'scripts/check-adoption-readiness.ts');
const TSX = path.join(REPO, 'node_modules/.bin/tsx');

function run(args: string[], cwd = REPO): { code: number | null; out: string; err: string } {
  const r = spawnSync(TSX, [SCRIPT, ...args], { cwd, encoding: 'utf-8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

function makeRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'p3-runbook-'));
  made.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf-8', stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 'p3@example.test');
  git('config', 'user.name', 'p3');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
  return dir;
}

const ADR_REF = `見 ${ADR_PATH} 的「決策」`;

// canonical state:runbook 完成後 default-branch-only 交付線
// (deliveryBranches: ['main']、無 develop 出現在三處 if 行)
const CI_MAIN_ONLY = `name: CI
on:
  push:
    branches: [main, 'feature/**']
  pull_request:
    branches: [main]
jobs:
  ci:
    steps:
      # ${ADR_REF}
      # ${ADR_REF}
      - name: Fetch delivery refs
        if: github.event_name != 'push' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch) || github.ref == 'refs/heads/main'
        run: git fetch
      - name: TODOS Markers Check
        if: github.event_name != 'push' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch) || github.ref == 'refs/heads/main'
        run: npm run check:todos
      - name: Source-term scan
        if: github.event_name != 'push' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch) || github.ref == 'refs/heads/main'
        run: npm run check:no-source-terms
      - name: Adoption Readiness Check
        run: npm run check:adoption
`;

const CLAUDE_FILLED_MAIN_ONLY = `# CLAUDE.md
完整 checklist 見 .claude/sop/plan-mode-checklist.md

## Part 4

### 4.1 技術堆疊

- 語言：TypeScript
- 框架：Next.js
- 資料庫：PostgreSQL
- 部署：Vercel

### 4.3 Health Stack

- \`npm run typecheck\` / \`npm run lint\` / \`npm run test\`

### 4.5 禁區清單

- \`prisma/schema.prisma\`
- \`.env.local\`

### 4.6 Git 規範

- \`main\` 正式;feature → main \`squash\`

---
`;

// runbook 步驟 5「驗證 gates」步驟結束後、default-only 交付線的 adopted repo canonical state
function runbookCompletedFiles(): Record<string, string> {
  return {
    'package.json': JSON.stringify({ name: 'my-shop', scripts: { typecheck: 'x', lint: 'x', test: 'x' } }),
    'scripts/harness.config.json': JSON.stringify({
      schemaVersion: 2,
      mergeStrategy: 'squash',
      mode: 'adopted',
      projectId: 'my-shop',
      templatePackageName: 'harness-controlled-dev-environment',
      // runbook 步驟 2:deliveryBranches 只含 default branch(main)、無 develop 交付線
      protectedBranches: ['main'],
      deliveryBranches: ['main'],
      requiredAgentAdapters: ['claude', 'codex'],
      githubGovernanceRequired: true,
    }),
    'scripts/cso-trigger.config.ts': `export const CSO_TRIGGER_PATTERNS = [
  { domain: '金流', pattern: /^src\\/lib\\/payment\\// },
  { domain: 'PII', pattern: /^src\\/lib\\/auth\\.ts$/ },
  { domain: '權限/IDOR/資產轉移', pattern: /^src\\/middleware\\.ts$/ },
  { domain: 'audit-trail', pattern: /^src\\/lib\\/audit-log\\.ts$/ },
];
export const CSO_NOT_APPLICABLE = [{ domain: '橫切保守項', reason: '本專案無 DB migration 與 unattended cron' }];
`,
    'scripts/lib/destructive-guard.ts': "const FLAG_ENV = 'MYSHOP_DESTRUCTIVE_OK';\nconst CONFIRM_TOKEN = 'MYSHOP-PROD';\nexport { FLAG_ENV, CONFIRM_TOKEN };\n",
    // runbook 步驟 4:hooks 對齊 protectedBranches = ['main']
    'scripts/git-hooks/pre-commit': 'case "$branch" in\n  main) ;;\n  *) exit 0 ;;\nesac\n',
    'scripts/git-hooks/pre-push': '    refs/heads/main) _is_protected=1 ;;\n',
    'CLAUDE.md': CLAUDE_FILLED_MAIN_ONLY,
    'AGENTS.md': '# Codex\n@CLAUDE.md\n',
    '.claude/settings.json': '{ "effortLevel": "high" }',
    '.claude/sop/plan-mode-checklist.md': '# sop',
    // runbook 步驟 3:ci.yml 三處 if 行不含 develop
    '.github/workflows/ci.yml': CI_MAIN_ONLY,
    '.github/CODEOWNERS': '* @owner\n',
    'prisma/schema.prisma': '',
    '.claude/memory/progress.md': 'entry\n',
  };
}

describe('P3 delivery-refs defer ① runbook 步驟 5 acceptance', () => {
  it('runbook 完成後 default-branch-only 交付線 fixture:check:adoption exit 0 + ADOPTED_MODE — READY(A5.ci.if 三處逐字等)', () => {
    const dir = makeRepo(runbookCompletedFiles());
    const r = run([`--root=${dir}`]);
    // acceptance:runbook 步驟 5「check:adoption」全綠 = A5 集合精確等、三處 if 逐字等於 expectedCiIfLine(['main'])
    expect(r.code, r.out + r.err).toBe(0);
    expect(r.out.split('\n')[0]).toBe('ADOPTED_MODE — READY');
    // 對 D9 anti-overclaim:此 e2e 不宣稱覆蓋 MARKER_SELF_PR / allowedPrs / 其他邊角、只驗 A5.ci.if canonical acceptance
    expect(r.out).not.toContain('[fail]');
  });
});
