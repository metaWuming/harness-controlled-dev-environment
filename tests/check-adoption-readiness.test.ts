// tests/check-adoption-readiness.test.ts — PR A2 adoption readiness 純函式
//
// 每條規則一正一負(以上),全部用注入 I/O 的 fixture;e2e(真 git repo、subprocess)在
// tests/check-adoption-readiness.e2e.test.ts。

import { describe, expect, it } from 'vitest';
import type { HarnessConfig } from '../scripts/lib/harness-config';
import {
  ADOPTED_CHECKS,
  TEMPLATE_CHECKS,
  checkAdapters,
  checkAdoptedProjectId,
  checkBranchConformance,
  checkCsoDomainDisposition,
  checkGithubGovernance,
  checkNoDestructivePlaceholders,
  checkPart4Content,
  checkTemplateAdrRefs,
  checkTemplateCsoEmpty,
  checkTemplateDestructivePlaceholders,
  checkTemplateNoPersonalPaths,
  checkTemplatePackageName,
  checkTemplatePart4Skeleton,
  checkTemplateProjectId,
  expectedCiIfLine,
  extractCiBranches,
  extractPreCommitBranches,
  extractPrePushBranches,
  parsePart4,
  runAdoptionChecks,
  type CheckerIo,
  type Finding,
} from '../scripts/check-adoption-readiness';
import type { CsoDomain } from '../scripts/cso-trigger.config';
import { ADR_PATH, EXPECTED_ADR_REFS } from '../scripts/lib/template-governance';

// ───────────────────────────── fixtures

const TEMPLATE_CFG: HarnessConfig = {
  schemaVersion: 2,
  mergeStrategy: 'squash',
  mode: 'template',
  projectId: '__TEMPLATE__',
  templatePackageName: 'harness-controlled-dev-environment',
  protectedBranches: ['develop', 'main'],
  deliveryBranches: ['main'],
  requiredAgentAdapters: ['claude'],
  githubGovernanceRequired: false,
};
const ADOPTED_CFG: HarnessConfig = {
  ...TEMPLATE_CFG,
  mode: 'adopted',
  projectId: 'my-shop',
  requiredAgentAdapters: ['claude', 'codex'],
  githubGovernanceRequired: true,
};

const PART4_SKELETON = `
## Part 4:本專案技術上下文(導入時填寫)

### 4.1 技術堆疊

<!-- 填:框架 -->

### 4.2 Design System(UI 任務必讀)

<!-- 填:token -->

### 4.3 Health Stack

<!-- 填:你的品質閘門。模板預設:
- \`npm run typecheck\`
-->

### 4.4 部署資訊

<!-- 填:staging -->

### 4.5 禁區清單(動前必問 Owner)

<!-- 填:哪些檔案
- schema
-->

### 4.6 Git 規範

- 每完成一個功能模組必須 commit
- 絕對不 commit \`.env\`

<!-- 填:你的分支策略 -->

---

## Part 5
`;

const PART4_FILLED = `
## Part 4:本專案技術上下文

### 4.1 技術堆疊

- 語言：TypeScript
- 框架：Next.js 16
- 資料庫：PostgreSQL(Prisma)
- 部署：Vercel

### 4.2 Design System(UI 任務必讀)

- token:\`src/styles/tokens.css\`

### 4.3 Health Stack

- \`npm run typecheck\`
- \`npm run lint\`
- \`npm run test\`
- \`npm run check:doc-refs\`

### 4.4 部署資訊

- staging:https://example.test

### 4.5 禁區清單(動前必問 Owner)

- \`prisma/schema.prisma\` — migration 動前必問
- \`scripts/lib/destructive-guard.ts\` — 破壞性守衛
- \`.env.local\` / \`.claude/settings.local.json\` — 不能 commit

### 4.6 Git 規範

- \`main\` = 正式;\`develop\` = 開發主線;feature/xxx
- feature → develop \`squash\`;develop → main merge commit

---

## Part 5
`;

const PRE_COMMIT_OK = `#!/usr/bin/env bash
branch="$(git branch --show-current)"
case "$branch" in
  develop|main) ;;
  *) exit 0 ;;
esac
echo done
`;
const PRE_PUSH_OK = `#!/usr/bin/env bash
  case "$remote_ref" in
    refs/heads/develop | refs/heads/main) _is_protected=1 ;;
  esac
`;
const CI_OK = `name: CI
on:
  push:
    branches: [main, develop, 'feature/**']
  pull_request:
    branches: [main, develop]
env:
  X: 1
jobs:
  ci:
    steps:
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
const DESTRUCTIVE_TEMPLATE = `const FLAG_ENV = 'PROJECT_DESTRUCTIVE_OK';\nconst CONFIRM_TOKEN = 'PROJECT-PROD';\n`;
const DESTRUCTIVE_ADOPTED = `const FLAG_ENV = 'MYSHOP_DESTRUCTIVE_OK';\nconst CONFIRM_TOKEN = 'MYSHOP-PROD';\n`;
const CLAUDE_ADOPTED = `# CLAUDE.md\n完整 checklist 見 .claude/sop/plan-mode-checklist.md\n${PART4_FILLED}`;
const CLAUDE_TEMPLATE = `# CLAUDE.md\n完整 checklist 見 .claude/sop/plan-mode-checklist.md\n${PART4_SKELETON}`;

const D = (d: CsoDomain, p: string) => ({ domain: d, pattern: new RegExp(p) });
const FULL_PATTERNS = [
  D('金流', '^src/lib/payment/'),
  D('PII', '^src/lib/auth\\.ts$'),
  D('權限/IDOR/資產轉移', '^src/middleware\\.ts$'),
  D('audit-trail', '^src/lib/audit-log\\.ts$'),
  D('橫切保守項', '^prisma/schema\\.prisma$'),
];

interface FixtureOpts {
  files?: Record<string, string>;
  tracked?: string[];
  dirs?: string[];
  csoPatterns?: CheckerIo['csoPatterns'];
  csoNotApplicable?: CheckerIo['csoNotApplicable'];
  packageJson?: CheckerIo['packageJson'];
}

function adoptedFiles(): Record<string, string> {
  return {
    'CLAUDE.md': CLAUDE_ADOPTED,
    'AGENTS.md': '# Codex\n@CLAUDE.md\n',
    '.claude/settings.json': '{ "effortLevel": "high" }',
    '.claude/sop/plan-mode-checklist.md': '# sop',
    'scripts/lib/destructive-guard.ts': DESTRUCTIVE_ADOPTED,
    'scripts/git-hooks/pre-commit': PRE_COMMIT_OK,
    'scripts/git-hooks/pre-push': PRE_PUSH_OK,
    '.github/workflows/ci.yml': CI_OK,
    '.github/CODEOWNERS': '* @owner',
    'prisma/schema.prisma': '',
    '.claude/memory/progress.md': 'ok',
  };
}

function makeIo(o: FixtureOpts = {}): CheckerIo {
  const files = o.files ?? {};
  const tracked = o.tracked ?? Object.keys(files);
  const dirs = new Set(o.dirs ?? []);
  return {
    readText: (rel) => (rel in files ? files[rel]! : null),
    exists: (rel) => rel in files || dirs.has(rel),
    isDir: (rel) => dirs.has(rel),
    trackedFiles: () => tracked,
    csoPatterns: o.csoPatterns ?? [],
    csoNotApplicable: o.csoNotApplicable ?? [],
    packageJson:
      o.packageJson === undefined
        ? { name: 'harness-controlled-dev-environment', scripts: { typecheck: 'x', lint: 'x', test: 'x', 'check:doc-refs': 'x' } }
        : o.packageJson,
  };
}
function adoptedIo(patch: FixtureOpts = {}): CheckerIo {
  return makeIo({
    files: { ...adoptedFiles(), ...(patch.files ?? {}) },
    tracked: patch.tracked,
    dirs: patch.dirs ?? ['scripts/lib'],
    csoPatterns: patch.csoPatterns ?? FULL_PATTERNS,
    csoNotApplicable: patch.csoNotApplicable ?? [],
    packageJson: patch.packageJson === undefined ? { name: 'my-shop', scripts: { typecheck: 'x', lint: 'x', test: 'x', 'check:doc-refs': 'x' } } : patch.packageJson,
  });
}
const fails = (f: Finding[]) => f.filter((x) => x.kind === 'fail');
const ids = (f: Finding[]) => fails(f).map((x) => x.id);

// ───────────────────────────── parsePart4

describe('parsePart4', () => {
  it('骨架:body 空 + 有填標記 → skeleton;4.6 出廠有內容 → content 但 hasFillMarker', () => {
    const m = parsePart4(PART4_SKELETON);
    expect([...m.keys()]).toEqual(['4.1', '4.2', '4.3', '4.4', '4.5', '4.6']);
    for (const id of ['4.1', '4.2', '4.3', '4.4', '4.5'] as const) expect(m.get(id)!.state).toBe('skeleton');
    expect(m.get('4.6')!.state).toBe('content');
    expect(m.get('4.6')!.hasFillMarker).toBe(true);
  });
  it('填好:全部 content、無填標記;缺段不出現', () => {
    const m = parsePart4(PART4_FILLED);
    for (const s of m.values()) {
      expect(s.state).toBe('content');
      expect(s.hasFillMarker).toBe(false);
    }
    expect(parsePart4('### 4.1 x\n- 語言：a\n').has('4.3')).toBe(false);
  });
});

// ───────────────────────────── Template mode

/** T9 正對照:ADR + EXPECTED_ADR_REFS 每處恰好 n 個帶「標題」的引用。 */
function adrOkFiles(): Record<string, string> {
  const files: Record<string, string> = { [ADR_PATH]: '# ADR\n\n## 決策\n\n## 已知限制\n' };
  for (const [rel, n] of EXPECTED_ADR_REFS) {
    files[rel] = Array.from({ length: n }, () => `見 ${ADR_PATH} 的「決策」`).join('\n');
  }
  return files;
}

describe('template mode T1–T9', () => {
  const tIo = () =>
    makeIo({
      files: {
        ...adrOkFiles(),
        'CLAUDE.md': CLAUDE_TEMPLATE,
        'scripts/lib/destructive-guard.ts': DESTRUCTIVE_TEMPLATE,
        '.github/workflows/ci.yml': CI_OK + `# 見 ${ADR_PATH} 的「決策」\n# 見 ${ADR_PATH} 的「決策」\n`,
        // PR A3 P0 起 progress.md 不在 EXPECTED_ADR_REFS 內 → 這裡不得含 ADR 引用
        '.claude/memory/progress.md': 'entry 沒有個人路徑',
      },
    });
  it('T1 sentinel 正 / 負', () => {
    expect(checkTemplateProjectId(TEMPLATE_CFG, tIo())).toEqual([]);
    expect(ids(checkTemplateProjectId({ ...TEMPLATE_CFG, projectId: 'my-shop' }, tIo()))).toEqual(['T1']);
  });
  it('T2 package name 一致 正 / 負(改了名沒切 mode)', () => {
    expect(checkTemplatePackageName(TEMPLATE_CFG, tIo())).toEqual([]);
    const io = makeIo({ packageJson: { name: 'my-shop', scripts: {} } });
    const f = checkTemplatePackageName(TEMPLATE_CFG, io);
    expect(ids(f)).toEqual(['T2']);
    expect(f[0]!.msg).toMatch(/mode 改成 adopted/);
    expect(ids(checkTemplatePackageName(TEMPLATE_CFG, makeIo({ packageJson: null })))).toEqual(['T2']);
  });
  it('T3 表空 → exception;非空 → fail', () => {
    expect(checkTemplateCsoEmpty(TEMPLATE_CFG, tIo()).map((f) => f.kind)).toEqual(['exception']);
    expect(ids(checkTemplateCsoEmpty(TEMPLATE_CFG, makeIo({ csoPatterns: FULL_PATTERNS })))).toEqual(['T3']);
    expect(ids(checkTemplateCsoEmpty(TEMPLATE_CFG, makeIo({ csoNotApplicable: [{ domain: '金流', reason: '沒有金流沒有金流' }] })))).toEqual(['T3']);
  });
  it('T4 placeholder 在 → exception;缺一個 → fail;檔案缺 → fail', () => {
    expect(checkTemplateDestructivePlaceholders(TEMPLATE_CFG, tIo()).map((f) => f.kind)).toEqual(['exception']);
    const io = makeIo({ files: { 'scripts/lib/destructive-guard.ts': DESTRUCTIVE_ADOPTED } });
    expect(ids(checkTemplateDestructivePlaceholders(TEMPLATE_CFG, io))).toEqual(['T4']);
    expect(ids(checkTemplateDestructivePlaceholders(TEMPLATE_CFG, makeIo()))).toEqual(['T4']);
  });
  it('T5 全骨架 → exception;4.1 被填 → fail;4.6 填標記被拿掉 → fail;缺段 → fail', () => {
    expect(checkTemplatePart4Skeleton(TEMPLATE_CFG, tIo()).map((f) => f.kind)).toEqual(['exception']);
    const filled = makeIo({ files: { 'CLAUDE.md': PART4_SKELETON.replace('<!-- 填:框架 -->', '- 語言：TS') } });
    expect(ids(checkTemplatePart4Skeleton(TEMPLATE_CFG, filled))).toEqual(['T5']);
    const no46 = makeIo({ files: { 'CLAUDE.md': PART4_SKELETON.replace('<!-- 填:你的分支策略 -->', '') } });
    expect(ids(checkTemplatePart4Skeleton(TEMPLATE_CFG, no46))).toEqual(['T5']);
    const missing = makeIo({ files: { 'CLAUDE.md': PART4_SKELETON.replace('### 4.4 部署資訊', '### 4.4x') } });
    expect(fails(checkTemplatePart4Skeleton(TEMPLATE_CFG, missing)).some((f) => f.msg.includes('缺 ### 4.4'))).toBe(true);
  });
  it('T6 ci.yml 恰 1 行 check:adoption', () => {
    const t6 = TEMPLATE_CHECKS[5]!;
    expect(t6(TEMPLATE_CFG, tIo())).toEqual([]);
    expect(ids(t6(TEMPLATE_CFG, makeIo({ files: { '.github/workflows/ci.yml': CI_OK.replace('run: npm run check:adoption', 'run: npm test') } })))).toEqual(['T6']);
    expect(ids(t6(TEMPLATE_CFG, makeIo({ files: { '.github/workflows/ci.yml': CI_OK + '        run: npm run check:adoption\n' } })))).toEqual(['T6']);
    expect(ids(t6(TEMPLATE_CFG, makeIo()))).toEqual(['T6']);
  });
  it('T7 只印 info', () => {
    expect(TEMPLATE_CHECKS[6]!(TEMPLATE_CFG, tIo()).map((f) => f.kind)).toEqual(['info']);
  });
  it('T8 個人路徑 正 / 負(兩種片段各自抓)', () => {
    expect(checkTemplateNoPersonalPaths(TEMPLATE_CFG, tIo())).toEqual([]);
    expect(ids(checkTemplateNoPersonalPaths(TEMPLATE_CFG, makeIo({ files: { '.claude/memory/progress.md': 'see /Users/x/y' } })))).toEqual(['T8']);
    expect(ids(checkTemplateNoPersonalPaths(TEMPLATE_CFG, makeIo({ files: { '.claude/memory/progress.md': 'see ~/Documents/z' } })))).toEqual(['T8']);
    expect(ids(checkTemplateNoPersonalPaths(TEMPLATE_CFG, makeIo()))).toEqual(['T8']);
  });
  it('T9 ADR 引用位置＋數量 正 / 負(多一處 / 少一處 / 裸引用無「標題」)', () => {
    const okFiles = adrOkFiles();
    expect(checkTemplateAdrRefs(TEMPLATE_CFG, makeIo({ files: okFiles }))).toEqual([]);
    const extra = { ...okFiles, 'README.md': `見 ${ADR_PATH} 的「決策」` };
    expect(ids(checkTemplateAdrRefs(TEMPLATE_CFG, makeIo({ files: extra })))).toContain('T9');
    const fewer = { ...okFiles, 'scripts/source-term-baseline.json': 'nothing' };
    expect(ids(checkTemplateAdrRefs(TEMPLATE_CFG, makeIo({ files: fewer })))).toContain('T9');
    const bare = { ...okFiles, 'scripts/source-term-baseline.json': `見 ${ADR_PATH}` };
    expect(fails(checkTemplateAdrRefs(TEMPLATE_CFG, makeIo({ files: bare }))).some((f) => f.msg.includes('未以「<穩定標題>」'))).toBe(true);
  });
  it('runAdoptionChecks(template):首行 TEMPLATE_MODE、不含 READY、有 fail 時 ready=false', () => {
    const r = runAdoptionChecks(TEMPLATE_CFG, tIo());
    expect(r.lines[0]).toMatch(/^TEMPLATE_MODE — adoption checks NOT applied; 3 template exceptions:/);
    expect(r.lines.join('\n')).not.toContain('READY');
    expect(r.ready).toBe(true);
    const bad = runAdoptionChecks({ ...TEMPLATE_CFG, projectId: 'x' }, tIo());
    expect(bad.ready).toBe(false);
    expect(bad.lines.at(-1)).toMatch(/1 failures/);
  });
});

// ───────────────────────────── Adopted mode

describe('adopted mode A1 projectId', () => {
  it('正', () => expect(checkAdoptedProjectId(ADOPTED_CFG, adoptedIo())).toEqual([]));
  it.each(['__TEMPLATE__', 'My-Shop', '-shop', 'a', 'my_shop', 'my-template', 'placeholder-1', 'project-x', 'a'.repeat(65)])(
    '負 %s',
    (id) => expect(ids(checkAdoptedProjectId({ ...ADOPTED_CFG, projectId: id }, adoptedIo()))).toEqual(['A1'])
  );
});

describe('adopted mode A2 Part 4 精確內容', () => {
  it('正:完整填好', () => expect(checkPart4Content(ADOPTED_CFG, adoptedIo())).toEqual([]));
  const withPart4 = (md: string, extra: FixtureOpts = {}) => adoptedIo({ ...extra, files: { ...(extra.files ?? {}), 'CLAUDE.md': `# x\n.claude/sop/plan-mode-checklist.md\n${md}` } });
  it('負:只有註解(骨架)→ 四段各 fail', () => {
    const f = checkPart4Content(ADOPTED_CFG, withPart4(PART4_SKELETON));
    for (const id of ['A2.4.1', 'A2.4.3', 'A2.4.5', 'A2.4.6']) expect(ids(f)).toContain(id);
  });
  it('負:保留 <!-- 填 標記', () => {
    const md = PART4_FILLED.replace('### 4.1 技術堆疊\n', '### 4.1 技術堆疊\n<!-- 填:x -->\n');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(md)))).toContain('A2.4.1');
  });
  it('負:缺段', () => {
    const md = PART4_FILLED.replace('### 4.5 禁區清單(動前必問 Owner)', '### 4.5x');
    expect(fails(checkPart4Content(ADOPTED_CFG, withPart4(md))).some((f) => f.msg.includes('缺 ### 4.5'))).toBe(true);
  });
  it('4.1 負:placeholder 值 / 缺鍵 / 純散文 / 重複鍵', () => {
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('- 語言：TypeScript', '- 語言：TBD'))))).toContain('A2.4.1');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('- 語言：TypeScript', '- 語言：<填>'))))).toContain('A2.4.1');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('- 部署：Vercel\n', ''))))).toContain('A2.4.1');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace(/- 語言：TypeScript\n- 框架：Next.js 16\n- 資料庫：PostgreSQL\(Prisma\)\n- 部署：Vercel/, '我們用現代技術堆疊,細節問 Owner。'))))).toContain('A2.4.1');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('- 語言：TypeScript', '- 語言：TS\n- 語言：JS'))))).toContain('A2.4.1');
  });
  it('4.3 負:引用不存在的 script / 只列 2 個 / 缺 test / 純散文 / package.json 讀不到', () => {
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('`npm run check:doc-refs`', '`npm run build`'))))).toContain('A2.4.3');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('- `npm run test`\n- `npm run check:doc-refs`\n', ''))))).toContain('A2.4.3');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('- `npm run test`\n', '- `npm run typecheck`\n'))))).toContain('A2.4.3');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace(/- `npm run [^`]+`\n/g, '').replace('### 4.3 Health Stack\n', '### 4.3 Health Stack\n跑所有檢查再 commit。\n'))))).toContain('A2.4.3');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED, { packageJson: null })))).toContain('A2.4.3');
  });
  it('4.5 負:token 指到不存在路徑 / bullet 無反引號 / 只有 1 個 bullet;正:目錄 token 與 .env*', () => {
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('`prisma/schema.prisma`', '`src/nope/`'))))).toContain('A2.4.5');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('- `prisma/schema.prisma` — migration 動前必問', '- schema 檔動前必問'))))).toContain('A2.4.5');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('- `prisma/schema.prisma` — migration 動前必問\n- `scripts/lib/destructive-guard.ts` — 破壞性守衛\n', ''))))).toContain('A2.4.5');
    const dirTok = PART4_FILLED.replace('`prisma/schema.prisma`', '`scripts/lib/`');
    expect(checkPart4Content(ADOPTED_CFG, withPart4(dirTok))).toEqual([]);
  });
  it('4.6 負:缺 config 分支名 / 未以反引號提到宣告的 mergeStrategy / 宣告 merge-commit 但只寫 `squash` / 只有出廠 bullet + 註解;正:反引號提到即過', () => {
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('`develop` = 開發主線', 'develop = 開發主線'))))).toContain('A2.4.6');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('- feature → develop `squash`;develop → main merge commit\n', ''))))).toContain('A2.4.6');
    // 沒反引號的散文提及不算(否定句 / URL / 時態變體都不再是本規則要判的事)
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(PART4_FILLED.replace('`squash`', 'squash'))))).toContain('A2.4.6');
    expect(ids(checkPart4Content({ ...ADOPTED_CFG, mergeStrategy: 'merge-commit' }, withPart4(PART4_FILLED)))).toContain('A2.4.6');
    expect(checkPart4Content({ ...ADOPTED_CFG, mergeStrategy: 'merge-commit' }, withPart4(PART4_FILLED.replace('`squash`', '`merge-commit`')))).toEqual([]);
    const stock = PART4_FILLED.replace(/### 4\.6 Git 規範[\s\S]*?---/, '### 4.6 Git 規範\n\n- 每完成一個功能模組必須 commit\n\n<!-- 填:你的分支策略 -->\n\n---');
    expect(ids(checkPart4Content(ADOPTED_CFG, withPart4(stock)))).toContain('A2.4.6');
  });
});

describe('adopted mode A3 CSO 五域處置', () => {
  it('正:五域全 pattern;正:四 pattern + 一 N/A', () => {
    expect(checkCsoDomainDisposition(FULL_PATTERNS, [])).toEqual([]);
    expect(checkCsoDomainDisposition(FULL_PATTERNS.slice(0, 4), [{ domain: '橫切保守項', reason: '無 DB、無 migration、無 cron' }])).toEqual([]);
  });
  it('負:皆無(未處置)', () => expect(ids(checkCsoDomainDisposition(FULL_PATTERNS.slice(0, 4), []))).toEqual(['A3']));
  it('負:矛盾(pattern + N/A)', () => {
    expect(fails(checkCsoDomainDisposition(FULL_PATTERNS, [{ domain: '金流', reason: '沒有金流沒有金流沒有' }])).some((f) => f.msg.includes('矛盾'))).toBe(true);
  });
  it('負:reason 太短', () => {
    expect(fails(checkCsoDomainDisposition(FULL_PATTERNS.slice(0, 4), [{ domain: '橫切保守項', reason: '無 DB' }])).some((f) => f.msg.includes('太短'))).toBe(true);
  });
  it('負:未知域 / 重複 N/A', () => {
    expect(fails(checkCsoDomainDisposition(FULL_PATTERNS, [{ domain: '不存在' as CsoDomain, reason: '一二三四五六七八九十' }])).some((f) => f.msg.includes('未知域'))).toBe(true);
    const dup = [{ domain: '橫切保守項' as CsoDomain, reason: '一二三四五六七八九十' }, { domain: '橫切保守項' as CsoDomain, reason: '一二三四五六七八九十' }];
    expect(fails(checkCsoDomainDisposition(FULL_PATTERNS.slice(0, 4), dup)).some((f) => f.msg.includes('重複宣告'))).toBe(true);
  });
  it('負:整體 pattern 為 0(五域全 N/A 也擋)', () => {
    const allNa = (['金流', 'PII', '權限/IDOR/資產轉移', 'audit-trail', '橫切保守項'] as CsoDomain[]).map((d) => ({ domain: d, reason: '一二三四五六七八九十' }));
    expect(fails(checkCsoDomainDisposition([], allNa)).some((f) => f.msg.includes('整體為空'))).toBe(true);
  });
});

describe('adopted mode A4 destructive placeholder', () => {
  it('正 / 負(各 placeholder 獨立)', () => {
    expect(checkNoDestructivePlaceholders(ADOPTED_CFG, adoptedIo())).toEqual([]);
    const f = checkNoDestructivePlaceholders(ADOPTED_CFG, adoptedIo({ files: { 'scripts/lib/destructive-guard.ts': DESTRUCTIVE_TEMPLATE } }));
    expect(ids(f)).toEqual(['A4', 'A4']);
    const only1 = checkNoDestructivePlaceholders(ADOPTED_CFG, adoptedIo({ files: { 'scripts/lib/destructive-guard.ts': "const FLAG_ENV = 'PROJECT_DESTRUCTIVE_OK';\nconst CONFIRM_TOKEN = 'MYSHOP-PROD';" } }));
    expect(only1.map((x) => x.msg)).toEqual([expect.stringContaining('PROJECT_DESTRUCTIVE_OK')]);
  });
});

describe('adopted mode A5 分支政策集合精確相等', () => {
  it('正:四處都等於 {develop, main};feature/** 只印 info', () => {
    const f = checkBranchConformance(ADOPTED_CFG, adoptedIo());
    expect(fails(f)).toEqual([]);
    expect(f.filter((x) => x.kind === 'info').map((x) => x.msg)).toEqual([expect.stringContaining('feature/**')]);
  });
  const pc = (line: string) => adoptedIo({ files: { 'scripts/git-hooks/pre-commit': PRE_COMMIT_OK.replace('  develop|main) ;;', line) } });
  it('pre-commit 負:extra / missing / mismatch / 重複行 / 區塊缺', () => {
    expect(fails(checkBranchConformance(ADOPTED_CFG, pc('  develop|main|release) ;;'))).map((x) => x.msg)).toEqual([expect.stringContaining('多出 ["release"]')]);
    expect(fails(checkBranchConformance(ADOPTED_CFG, pc('  main) ;;'))).map((x) => x.msg)).toEqual([expect.stringContaining('缺 ["develop"]')]);
    expect(fails(checkBranchConformance(ADOPTED_CFG, pc('  master|main) ;;'))).map((x) => x.msg)).toEqual([expect.stringMatching(/多出 \["master"\];缺 \["develop"\]/)]);
    expect(ids(checkBranchConformance(ADOPTED_CFG, pc('  develop|main) ;;\n  main) ;;')))).toEqual(['A5.pre-commit']);
    expect(ids(checkBranchConformance(ADOPTED_CFG, adoptedIo({ files: { 'scripts/git-hooks/pre-commit': 'echo no case' } })))).toEqual(['A5.pre-commit']);
  });
  it('pre-commit 文法負:glob / 引號 / 空白 / 重複 → A5.pre-commit.grammar,不降級', () => {
    for (const bad of ['  develop|main|release/*) ;;', "  develop|'main') ;;", '  develop|ma in) ;;', '  develop|main|main) ;;']) {
      const f = fails(checkBranchConformance(ADOPTED_CFG, pc(bad)));
      expect(f.map((x) => x.id), bad).toContain('A5.pre-commit.grammar');
      expect(f.some((x) => x.id === 'A5.pre-commit' && !x.id.endsWith('grammar')), bad).toBe(false);
    }
  });
  const pp = (line: string) => adoptedIo({ files: { 'scripts/git-hooks/pre-push': PRE_PUSH_OK.replace('    refs/heads/develop | refs/heads/main) _is_protected=1 ;;', line) } });
  it('pre-push 負:extra / missing / mismatch / 重複行 / 非 refs/heads 形式 / 引號', () => {
    expect(fails(checkBranchConformance(ADOPTED_CFG, pp('    refs/heads/develop | refs/heads/main | refs/heads/release) _is_protected=1 ;;'))).map((x) => x.msg)).toEqual([expect.stringContaining('多出 ["release"]')]);
    expect(fails(checkBranchConformance(ADOPTED_CFG, pp('    refs/heads/main) _is_protected=1 ;;'))).map((x) => x.msg)).toEqual([expect.stringContaining('缺 ["develop"]')]);
    expect(fails(checkBranchConformance(ADOPTED_CFG, pp('    refs/heads/master | refs/heads/main) _is_protected=1 ;;'))).map((x) => x.msg)).toEqual([expect.stringMatching(/多出 \["master"\];缺 \["develop"\]/)]);
    expect(ids(checkBranchConformance(ADOPTED_CFG, pp('    refs/heads/main) _is_protected=1 ;;\n    refs/heads/develop) _is_protected=1 ;;')))).toEqual(['A5.pre-push']);
    expect(ids(checkBranchConformance(ADOPTED_CFG, pp('    develop | refs/heads/main) _is_protected=1 ;;')))).toEqual(['A5.pre-push.grammar']);
    expect(ids(checkBranchConformance(ADOPTED_CFG, pp("    refs/heads/'main' | refs/heads/develop) _is_protected=1 ;;")))).toEqual(['A5.pre-push.grammar']);
  });
  const ci = (push: string, pr: string) => adoptedIo({ files: { '.github/workflows/ci.yml': CI_OK.replace("branches: [main, develop, 'feature/**']", push).replace('branches: [main, develop]', pr) } });
  it('ci push 負:extra / missing / 只剩 glob / 非白名單 glob / 引號內空白;pull_request 負:extra / missing / 行數 0 / 重複', () => {
    expect(fails(checkBranchConformance(ADOPTED_CFG, ci('branches: [main, develop, release]', 'branches: [main, develop]'))).map((x) => x.id)).toEqual(['A5.ci.push']);
    expect(fails(checkBranchConformance(ADOPTED_CFG, ci('branches: [main]', 'branches: [main, develop]'))).map((x) => x.id)).toEqual(['A5.ci.push']);
    expect(fails(checkBranchConformance(ADOPTED_CFG, ci("branches: ['feature/**']", 'branches: [main, develop]'))).map((x) => x.id)).toEqual(['A5.ci.push']);
    expect(fails(checkBranchConformance(ADOPTED_CFG, ci("branches: [main, develop, 'release/*']", 'branches: [main, develop]'))).map((x) => x.id)).toEqual(['A5.ci.push.grammar']);
    expect(fails(checkBranchConformance(ADOPTED_CFG, ci('branches: [main, "develop "]', 'branches: [main, develop]'))).map((x) => x.id)).toEqual(['A5.ci.push.grammar']);
    expect(fails(checkBranchConformance(ADOPTED_CFG, ci("branches: [main, develop, 'feature/**']", 'branches: [main, develop, trunk]'))).map((x) => x.id)).toEqual(['A5.ci.pull_request']);
    expect(fails(checkBranchConformance(ADOPTED_CFG, ci("branches: [main, develop, 'feature/**']", 'branches: [main]'))).map((x) => x.id)).toEqual(['A5.ci.pull_request']);
    expect(fails(checkBranchConformance(ADOPTED_CFG, ci("branches: [main, develop, 'feature/**']", 'types: [opened]'))).map((x) => x.id)).toEqual(['A5.ci.pull_request']);
    expect(fails(checkBranchConformance(ADOPTED_CFG, ci("branches: [main, develop, 'feature/**']", 'branches: [main, main, develop]'))).map((x) => x.id)).toEqual(['A5.ci.pull_request.grammar']);
  });
  it('A5.ci.if(P4):行數 2 / 4、多一分支、少一分支、順序、default_branch 表達式被改、文法 → 各自 fail', () => {
    const IF = "        if: github.event_name != 'push' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch) || github.ref == 'refs/heads/main'\n";
    const withIf = (repl: (yml: string) => string) => adoptedIo({ files: { '.github/workflows/ci.yml': repl(CI_OK) } });
    expect(fails(checkBranchConformance(ADOPTED_CFG, adoptedIo()))).toEqual([]);
    expect(ids(checkBranchConformance(ADOPTED_CFG, withIf((y) => y.replace(IF, ''))))).toContain('A5.ci.if');
    expect(ids(checkBranchConformance(ADOPTED_CFG, withIf((y) => y + IF)))).toContain('A5.ci.if');
    expect(ids(checkBranchConformance(ADOPTED_CFG, withIf((y) => y.replace(IF, IF.replace("'refs/heads/main'", "'refs/heads/main' || github.ref == 'refs/heads/develop'")))))).toContain('A5.ci.if');
    expect(ids(checkBranchConformance({ ...ADOPTED_CFG, deliveryBranches: ['main', 'develop'] }, adoptedIo()))).toContain('A5.ci.if');
    expect(ids(checkBranchConformance({ ...ADOPTED_CFG, protectedBranches: ['develop', 'main'], deliveryBranches: ['develop', 'main'] }, withIf((y) => y.replaceAll(IF, IF.replace("'refs/heads/main'", "'refs/heads/main' || github.ref == 'refs/heads/develop'")))))).toContain('A5.ci.if');
    expect(ids(checkBranchConformance(ADOPTED_CFG, withIf((y) => y.replaceAll(IF, IF.replace('github.event.repository.default_branch', "'main'")))))).toContain('A5.ci.if');
    expect(ids(checkBranchConformance(ADOPTED_CFG, withIf((y) => y.replaceAll(IF, IF.replace("'refs/heads/main'", "'refs/heads/ma in'")))))).toContain('A5.ci.if.grammar');
    expect(expectedCiIfLine(['main', 'develop'])).toBe("if: github.event_name != 'push' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch) || github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'");
  });
  it('extract 純函式:直接可測', () => {
    expect(extractPreCommitBranches(PRE_COMMIT_OK)).toEqual({ ok: true, names: ['develop', 'main'] });
    expect(extractPrePushBranches(PRE_PUSH_OK)).toEqual({ ok: true, names: ['develop', 'main'] });
    const r = extractCiBranches(CI_OK);
    expect(r.push).toEqual({ ok: true, names: ['main', 'develop'] });
    expect(r.pullRequest).toEqual({ ok: true, names: ['main', 'develop'] });
    expect(r.pushGlobInfo).toEqual(['feature/**']);
  });
  it('出廠 ci.yml [main, master, trunk, develop] 對 template config 會 mismatch(A5 只在 adopted 跑,刻意)', () => {
    const f = fails(checkBranchConformance(ADOPTED_CFG, ci("branches: [main, master, trunk, develop, 'feature/**']", 'branches: [main, master, trunk, develop]')));
    expect(f.map((x) => x.id).sort()).toEqual(['A5.ci.pull_request', 'A5.ci.push']);
  });
});

describe('adopted mode A6 adapter 逐條斷言', () => {
  it('正:claude + codex 全過', () => expect(checkAdapters(ADOPTED_CFG, adoptedIo())).toEqual([]));
  it('claude 負:檔缺 / 未 tracked / 無 checklist 字面 / settings 缺 effortLevel', () => {
    const base = adoptedFiles();
    const noClaude = { ...base };
    delete noClaude['CLAUDE.md'];
    expect(ids(checkAdapters(ADOPTED_CFG, makeIo({ files: noClaude, csoPatterns: FULL_PATTERNS })))).toContain('A6.claude.file');
    const untracked = adoptedIo({ tracked: Object.keys(base).filter((k) => k !== 'CLAUDE.md') });
    expect(ids(checkAdapters(ADOPTED_CFG, untracked))).toContain('A6.claude.file');
    expect(ids(checkAdapters(ADOPTED_CFG, adoptedIo({ files: { 'CLAUDE.md': `# x\n${PART4_FILLED}` } })))).toEqual(['A6.claude.link']);
    // Step 5 r1 I2:路徑只出現在 HTML 註解裡 → 不算直接引用
    expect(ids(checkAdapters(ADOPTED_CFG, adoptedIo({ files: { 'CLAUDE.md': `# x\n<!-- 不要讀 .claude/sop/plan-mode-checklist.md -->\n${PART4_FILLED}` } })))).toEqual(['A6.claude.link']);
    expect(ids(checkAdapters(ADOPTED_CFG, adoptedIo({ files: { '.claude/settings.json': '{}' } })))).toEqual(['A6.claude.settings']);
    const noSop = adoptedIo({ tracked: Object.keys(base).filter((k) => k !== '.claude/sop/plan-mode-checklist.md') });
    expect(ids(checkAdapters(ADOPTED_CFG, noSop))).toEqual(['A6.claude.sop']);
  });
  it('codex 負:AGENTS.md 缺 / 只有散文提及', () => {
    const base = adoptedFiles();
    const noAgents = { ...base };
    delete noAgents['AGENTS.md'];
    expect(ids(checkAdapters(ADOPTED_CFG, makeIo({ files: noAgents, csoPatterns: FULL_PATTERNS })))).toEqual(['A6.codex.file']);
    expect(ids(checkAdapters(ADOPTED_CFG, adoptedIo({ files: { 'AGENTS.md': 'see CLAUDE.md for rules' } })))).toEqual(['A6.codex.link']);
    expect(ids(checkAdapters(ADOPTED_CFG, adoptedIo({ files: { 'AGENTS.md': 'prefix @CLAUDE.md' } })))).toEqual(['A6.codex.link']);
  });
  it('只宣告 claude 時不檢查 codex', () => {
    expect(checkAdapters({ ...ADOPTED_CFG, requiredAgentAdapters: ['claude'] }, adoptedIo({ files: { 'AGENTS.md': 'nope' } }))).toEqual([]);
  });
});

describe('adopted mode A8 github governance', () => {
  it('false → 不檢查;true → CODEOWNERS 必須 tracked', () => {
    expect(checkGithubGovernance({ ...ADOPTED_CFG, githubGovernanceRequired: false }, makeIo())).toEqual([]);
    expect(checkGithubGovernance(ADOPTED_CFG, adoptedIo())).toEqual([]);
    const base = adoptedFiles();
    expect(ids(checkGithubGovernance(ADOPTED_CFG, adoptedIo({ tracked: Object.keys(base).filter((k) => k !== '.github/CODEOWNERS') })))).toEqual(['A8']);
  });
});

describe('runAdoptionChecks(adopted)與 dispatch 表', () => {
  it('完整 fixture → READY;任一 fail → NOT_READY (k failures)', () => {
    const ok = runAdoptionChecks(ADOPTED_CFG, adoptedIo());
    expect(ok.lines[0]).toBe('ADOPTED_MODE — READY');
    expect(ok.ready).toBe(true);
    const bad = runAdoptionChecks({ ...ADOPTED_CFG, projectId: '__TEMPLATE__' }, adoptedIo());
    expect(bad.lines[0]).toBe('ADOPTED_MODE — NOT_READY (1 failures):');
    expect(bad.ready).toBe(false);
  });
  it('A7 在 adopted dispatch 內:ci.yml 缺 check:adoption 行 → NOT_READY 點名 A7(M10 探針補)', () => {
    const io = adoptedIo({ files: { '.github/workflows/ci.yml': CI_OK.replace('        run: npm run check:adoption\n', '') } });
    const r = runAdoptionChecks(ADOPTED_CFG, io);
    expect(r.ready).toBe(false);
    expect(ids(r.findings)).toEqual(['A7']);
  });
  it('adopted 分支不跑 T8/T9(髒 progress 仍 READY);template 分支跑', () => {
    const dirty = adoptedIo({ files: { '.claude/memory/progress.md': '/Users/someone/x' } });
    expect(runAdoptionChecks(ADOPTED_CFG, dirty).ready).toBe(true);
    expect(ADOPTED_CHECKS).not.toContain(checkTemplateNoPersonalPaths);
    expect(TEMPLATE_CHECKS).toContain(checkTemplateNoPersonalPaths);
  });
});
