// tests/check-adoption-readiness.e2e.test.ts — PR A2 checker CLI 端到端(真 git fixture、subprocess)
//
// 行為級證據(plan 2.7):T8 / T9 只在 template mode 執行,adopted 分支不跑;dispatch 改壞
// (M12 / M13 / M14)由這裡的執行結果轉紅,不是原始碼字串計數。

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ADR_PATH, EXPECTED_ADR_REFS } from '../scripts/lib/template-governance';

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

/** 建一個真 git repo,寫入 files 並 commit(全部 tracked)。 */
function makeRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'a2-e2e-'));
  made.push(dir);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf-8', stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 'e2e@example.test');
  git('config', 'user.name', 'e2e');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
  return dir;
}

const ADR_REF = `見 ${ADR_PATH} 的「決策」`;
const CI_TEMPLATE = `name: CI
on:
  push:
    branches: [main, master, trunk, develop, 'feature/**']
  pull_request:
    branches: [main, master, trunk, develop]
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
const CI_ADOPTED = CI_TEMPLATE.replace("[main, master, trunk, develop, 'feature/**']", "[main, develop, 'feature/**']").replace('[main, master, trunk, develop]', '[main, develop]');

const CLAUDE_SKELETON = `# CLAUDE.md
完整 checklist 見 .claude/sop/plan-mode-checklist.md

## Part 4

### 4.1 技術堆疊

<!-- 填:框架 -->

### 4.2 Design System

<!-- 填:token -->

### 4.3 Health Stack

<!-- 填:閘門 -->

### 4.4 部署資訊

<!-- 填:staging -->

### 4.5 禁區清單

<!-- 填:禁區 -->

### 4.6 Git 規範

- 每完成一個功能模組必須 commit

<!-- 填:你的分支策略 -->

---
`;
const CLAUDE_FILLED = `# CLAUDE.md
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

- \`main\` 正式、\`develop\` 開發;feature → develop squash

---
`;

function templateFiles(): Record<string, string> {
  const f: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'harness-controlled-dev-environment', scripts: { typecheck: 'x', lint: 'x', test: 'x' } }),
    'scripts/harness.config.json': JSON.stringify({
      schemaVersion: 1,
      mode: 'template',
      projectId: '__TEMPLATE__',
      templatePackageName: 'harness-controlled-dev-environment',
      protectedBranches: ['develop', 'main'],
      deliveryBranches: ['main'],
      requiredAgentAdapters: ['claude'],
      githubGovernanceRequired: false,
    }),
    'scripts/cso-trigger.config.ts': 'export const CSO_TRIGGER_PATTERNS: { domain: string; pattern: RegExp }[] = [];\nexport const CSO_NOT_APPLICABLE: { domain: string; reason: string }[] = [];\n',
    'scripts/lib/destructive-guard.ts': "const FLAG_ENV = 'PROJECT_DESTRUCTIVE_OK';\nconst CONFIRM_TOKEN = 'PROJECT-PROD';\nexport { FLAG_ENV, CONFIRM_TOKEN };\n",
    'CLAUDE.md': CLAUDE_SKELETON,
    '.github/workflows/ci.yml': CI_TEMPLATE,
    [ADR_PATH]: '# ADR\n\n## 決策\n\n## 已知限制\n',
    // PR A3 P0 起 progress.md 不在 EXPECTED_ADR_REFS 內,T8 仍要讀得到它
    '.claude/memory/progress.md': 'entry\n',
  };
  for (const [rel, n] of EXPECTED_ADR_REFS) {
    if (rel === '.github/workflows/ci.yml') continue; // 已在 CI_TEMPLATE 內放 2 個
    f[rel] = Array.from({ length: n }, () => ADR_REF).join('\n') + '\n';
  }
  return f;
}

function adoptedFiles(): Record<string, string> {
  return {
    'package.json': JSON.stringify({ name: 'my-shop', scripts: { typecheck: 'x', lint: 'x', test: 'x' } }),
    'scripts/harness.config.json': JSON.stringify({
      schemaVersion: 1,
      mode: 'adopted',
      projectId: 'my-shop',
      templatePackageName: 'harness-controlled-dev-environment',
      protectedBranches: ['develop', 'main'],
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
    'scripts/git-hooks/pre-commit': 'case "$branch" in\n  develop|main) ;;\n  *) exit 0 ;;\nesac\n',
    'scripts/git-hooks/pre-push': '    refs/heads/develop | refs/heads/main) _is_protected=1 ;;\n',
    'CLAUDE.md': CLAUDE_FILLED,
    'AGENTS.md': '# Codex\n@CLAUDE.md\n',
    '.claude/settings.json': '{ "effortLevel": "high" }',
    '.claude/sop/plan-mode-checklist.md': '# sop',
    '.github/workflows/ci.yml': CI_ADOPTED,
    '.github/CODEOWNERS': '* @owner\n',
    'prisma/schema.prisma': '',
    '.claude/memory/progress.md': 'entry\n',
  };
}

describe('check:adoption e2e', () => {
  it('E-self:本 repo(template)exit 0、首行 TEMPLATE_MODE、不含 READY、列 T3/T4/T5 exception', () => {
    const r = run([]);
    expect(r.code, r.err).toBe(0);
    expect(r.out.split('\n')[0]).toMatch(/^TEMPLATE_MODE — adoption checks NOT applied; 3 template exceptions:/);
    expect(r.out).not.toContain('READY');
    for (const id of ['T3', 'T4', 'T5']) expect(r.out).toContain(`[exception] ${id}:`);
    expect(r.out).toContain('[info] T7:');
  });
  it('template fixture exit 0', () => {
    const dir = makeRepo(templateFiles());
    const r = run([`--root=${dir}`]);
    expect(r.code, r.out + r.err).toBe(0);
    expect(r.out).toMatch(/^TEMPLATE_MODE/);
  });
  it('adopted 完整 fixture → exit 0、首行 ADOPTED_MODE — READY', () => {
    const dir = makeRepo(adoptedFiles());
    const r = run([`--root=${dir}`]);
    expect(r.code, r.out + r.err).toBe(0);
    expect(r.out.split('\n')[0]).toBe('ADOPTED_MODE — READY');
  });
  it('缺 config → exit 2、訊息要求明確選 mode、不預設', () => {
    const f = templateFiles();
    delete f['scripts/harness.config.json'];
    const r = run([`--root=${makeRepo(f)}`]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/檔案不存在.*明確選擇 mode/);
    expect(r.out).not.toMatch(/TEMPLATE_MODE|READY/);
  });
  it('config malformed / mode 拼錯 / schema 未知 → exit 2 帶檔名', () => {
    for (const bad of ['{', JSON.stringify({ ...JSON.parse(templateFiles()['scripts/harness.config.json']!), mode: 'adopte' }), JSON.stringify({ ...JSON.parse(templateFiles()['scripts/harness.config.json']!), schemaVersion: 2 })]) {
      const f = templateFiles();
      f['scripts/harness.config.json'] = bad;
      const r = run([`--root=${makeRepo(f)}`]);
      expect(r.code, bad).toBe(2);
      expect(r.err).toContain('scripts/harness.config.json');
    }
  });
  it('argv:未知 flag / 空 --root= / 重複 --root → exit 2', () => {
    expect(run(['--rot=x']).code).toBe(2);
    expect(run(['--root=']).code).toBe(2);
    expect(run([`--root=${REPO}`, `--root=${REPO}`]).code).toBe(2);
  });
  it('E-T8:template + progress 含 /Users/ → exit 2 且點名 T8', () => {
    const f = templateFiles();
    f['.claude/memory/progress.md'] = `${ADR_REF}\n見 /Users/someone/x\n`;
    const r = run([`--root=${makeRepo(f)}`]);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[fail] T8:');
  });
  it('E-A-T8:adopted + progress 含 /Users/ → exit 0、輸出不含 T8(adopted 不跑模板簿記)', () => {
    const f = adoptedFiles();
    f['.claude/memory/progress.md'] = '見 /Users/someone/x\n';
    const r = run([`--root=${makeRepo(f)}`]);
    expect(r.code, r.out + r.err).toBe(0);
    expect(r.out).not.toContain('T8');
  });
  it('E-T9:template + ADR 引用多一處 → exit 2 且點名 T9', () => {
    const f = templateFiles();
    f['README.md'] = `${ADR_REF}\n`;
    const r = run([`--root=${makeRepo(f)}`]);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[fail] T9:');
  });
  it('E-A-T9:adopted + 同樣多一處 → exit 0', () => {
    const f = adoptedFiles();
    f['README.md'] = `${ADR_REF}\n`;
    const r = run([`--root=${makeRepo(f)}`]);
    expect(r.code, r.out + r.err).toBe(0);
    expect(r.out).not.toContain('T9');
  });
  it('adopted 負對照:destructive placeholder 殘留 → exit 2 點名 A4;projectId sentinel → A1', () => {
    const f = adoptedFiles();
    f['scripts/lib/destructive-guard.ts'] = templateFiles()['scripts/lib/destructive-guard.ts']!;
    let r = run([`--root=${makeRepo(f)}`]);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[fail] A4:');
    expect(r.out.split('\n')[0]).toMatch(/^ADOPTED_MODE — NOT_READY \(\d+ failures\):/);
    const g = adoptedFiles();
    g['scripts/harness.config.json'] = JSON.stringify({ ...JSON.parse(g['scripts/harness.config.json']!), projectId: '__TEMPLATE__' });
    r = run([`--root=${makeRepo(g)}`]);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[fail] A1:');
  });
  it('adopted 負對照:ci.yml 缺 check:adoption step → exit 2 點名 A7(M10 探針補)', () => {
    const f = adoptedFiles();
    f['.github/workflows/ci.yml'] = CI_ADOPTED.replace('        run: npm run check:adoption\n', '');
    const r = run([`--root=${makeRepo(f)}`]);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[fail] A7:');
  });
  it('template 負對照:改了 package name 沒切 mode → exit 2 點名 T2', () => {
    const f = templateFiles();
    f['package.json'] = JSON.stringify({ name: 'my-shop', scripts: {} });
    const r = run([`--root=${makeRepo(f)}`]);
    expect(r.code).toBe(2);
    expect(r.out).toContain('[fail] T2:');
  });
  it('cso config 形狀壞掉 → exit 2(無法建立 I/O)', () => {
    const f = templateFiles();
    f['scripts/cso-trigger.config.ts'] = 'export const CSO_TRIGGER_PATTERNS = "nope";\nexport const CSO_NOT_APPLICABLE = [];\n';
    const r = run([`--root=${makeRepo(f)}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain('CSO_TRIGGER_PATTERNS');
  });
});
