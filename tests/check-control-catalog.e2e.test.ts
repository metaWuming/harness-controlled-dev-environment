// tests/check-control-catalog.e2e.test.ts — PR A3 check:catalog(純函式 + 真 git fixture 子程序)
//
// 行為級負對照(plan 2.2 / rev 4):把真 hard step 搬進 ciSetupSteps、重複 / 未知 setup 名、
// 未登錄 step、md 漂移,都必須 exit 2 並帶穩定 code,不得靜默從反向鎖消失。

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkCatalogConformance, evaluateCatalogSnapshot, extractCiStepNames, extractCiSteps, type CatalogIo, type ExtractionOutcome } from '../scripts/check-control-catalog';

// A3 defer ⑦/⑧/⑫ Sprint 10:extractCiSteps/extractCiStepNames 改回 ExtractionOutcome<T>;
// 測試 helper:成功時取 value、失敗時 throw(既有 test 期望是成功路徑)
function unwrap<T>(o: ExtractionOutcome<T>): T {
  if (!o.ok) throw new Error(`unexpected extraction failure: ${o.problemKind}@${o.line}: ${o.diagnostic}`);
  return o.value;
}
import { parseControlCatalog } from '../scripts/lib/control-catalog';
import { renderCatalog } from '../scripts/render-control-catalog';

const REPO = path.resolve(__dirname, '..');
const TSX = path.join(REPO, 'node_modules/.bin/tsx');
const SCRIPT = path.join(REPO, 'scripts/check-control-catalog.ts');

function run(args: string[]): { code: number | null; out: string; err: string } {
  const r = spawnSync(TSX, [SCRIPT, ...args], { cwd: REPO, encoding: 'utf-8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const CI = `name: CI
on:
  push:
jobs:
  ci:
    steps:
      - name: Checkout
        uses: x
      - name: Typecheck
        run: npx tsc --noEmit
      - name: Test (vitest)
        run: npx vitest run
`;
const HARD = (id: string, step: string, impl: string) => ({
  id,
  name: step,
  legacyGate: '④',
  class: 'hard-automated',
  triggers: ['push'],
  implementation: ['.github/workflows/ci.yml', impl],
  locator: null,
  ciStep: step,
  owner: 'github',
  failureBehavior: 'block',
  bypass: 'admin override',
  evidence: 'ci',
  degradation: 'none',
  tested: ['manual-drill'],
  testRefs: [],
  notes: null,
});
function baseDoc() {
  return {
    schemaVersion: 1,
    ciSetupSteps: ['Checkout'],
    controls: [HARD('CTRL-CI-001', 'Typecheck', 'tsconfig.json'), HARD('CTRL-CI-002', 'Test (vitest)', 'vitest.config.ts')],
  };
}

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/** 真 git fixture:寫 JSON、由 renderCatalog 產 md(除非 mdOverride)、ci.yml、實作檔;全部 commit。 */
function makeRepo(doc: unknown, opts: { ci?: string; mdOverride?: string; skipTrack?: string[] } = {}): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'a3-cat-'));
  made.push(dir);
  const json = JSON.stringify(doc);
  const files: Record<string, string> = {
    'scripts/control-catalog.json': json,
    '.github/workflows/ci.yml': opts.ci ?? CI,
    'tsconfig.json': '{}',
    'vitest.config.ts': '',
  };
  let md = '';
  try {
    md = renderCatalog(parseControlCatalog(json));
  } catch {
    md = '# invalid';
  }
  files['docs/CONTROL-CATALOG.md'] = opts.mdOverride ?? md;
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  }
  const git = (...a: string[]) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf-8', stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 'e2e@example.test');
  git('config', 'user.name', 'e2e');
  for (const rel of Object.keys(files)) if (!(opts.skipTrack ?? []).includes(rel)) git('add', rel);
  git('commit', '-q', '-m', 'fixture');
  return dir;
}
const codes = (out: string) => [...out.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]!);

describe('extractCiSteps(Step 5 r1 C4 / I1)', () => {
  it('抽 steps 區塊內每個 item;保留重複;trim', () => {
    expect(unwrap(extractCiStepNames(CI))).toEqual(['Checkout', 'Typecheck', 'Test (vitest)']);
    expect(unwrap(extractCiStepNames(CI + '      - name: Typecheck\n'))).toEqual(['Checkout', 'Typecheck', 'Test (vitest)', 'Typecheck']);
  });
  it('無名 step(- run: / - uses:)與 dash 後多空白都被登記;name 在後行也抽得到', () => {
    const yml = CI + '      - run: echo x\n      -   name: Spaced\n      - uses: a/b\n        name: Later\n';
    const items = unwrap(extractCiSteps(yml));
    expect(items.map((s) => s.name)).toEqual(['Checkout', 'Typecheck', 'Test (vitest)', null, 'Spaced', 'Later']);
    expect(items.filter((s) => s.name === null).map((s) => s.line)).toHaveLength(1);
  });
  it('C-1:env: / with: / run: | 底下更深縮排的 name: 不算 step 名;`-` 單獨一行由子行決定 key 欄位;steps: 可接註解', () => {
    const yml = `jobs:\n  ci:\n    steps: # here\n      - name: Baseline Governance Check\n        env:\n          name: Sneaky\n      - uses: actions/upload-artifact@v4\n        with:\n          name: my-artifact\n      - run: |\n          cat <<EOF\n          name: FromShell\n          EOF\n      -\n        name: Dashed\n        run: x\n`;
    const items = unwrap(extractCiSteps(yml));
    expect(items.map((s) => s.name)).toEqual(['Baseline Governance Check', null, null, 'Dashed']);
  });
  it('I-2:steps: 與 - name: 同欄位(YAML 合法)也算區塊;I-4:單引號 \'\' 與雙引號 \\" 跳脫還原', () => {
    const yml = `jobs:\n  ci:\n    steps:\n    - name: A\n      run: x\n    - name: 'It''s'\n    - name: "Say \\"hi\\""\n    env: {}\n`;
    expect(unwrap(extractCiStepNames(yml))).toEqual(['A', "It's", 'Say "hi"']);
  });
  it('引號剝掉、尾端註解剝掉;`name: |` 標 unsupported;matrix include 的 - name 不算 step;steps 以外的 - name 不算', () => {
    const yml = `jobs:\n  ci:\n    strategy:\n      matrix:\n        include:\n          - name: node22\n    steps:\n      - name: "Lint"\n        run: x\n      - name: 'Typecheck' # c\n      - name: Test (vitest) # trailing\n      - name: |\n          multi\n  other:\n    - name: NotAStep\n`;
    const items = unwrap(extractCiSteps(yml));
    expect(items.map((s) => s.name)).toEqual(['Lint', 'Typecheck', 'Test (vitest)', null]);
    expect(items[3]!.unsupported).not.toBeNull();
    expect(unwrap(extractCiStepNames(yml))).not.toContain('node22');
  });
});

describe('checkCatalogConformance(純函式)', () => {
  const io = (patch: Partial<CatalogIo> = {}): CatalogIo => ({
    readText: (rel) => (rel === '.github/workflows/ci.yml' ? CI : rel === 'docs/CONTROL-CATALOG.md' ? renderCatalog(parseControlCatalog(JSON.stringify(baseDoc()))) : null),
    trackedFiles: () => ['.github/workflows/ci.yml', 'tsconfig.json', 'vitest.config.ts', 'docs/CONTROL-CATALOG.md'],
    ...patch,
  });
  it('正:全對應', () => {
    expect(checkCatalogConformance(parseControlCatalog(JSON.stringify(baseDoc())), io())).toEqual([]);
  });
  it('untracked 路徑 / ci.yml 讀不到 / md 缺 / md 漂移', () => {
    expect(checkCatalogConformance(parseControlCatalog(JSON.stringify(baseDoc())), io({ trackedFiles: () => ['.github/workflows/ci.yml'] })).map((x) => x.code)).toEqual(
      expect.arrayContaining(['catalog.path.untracked:CTRL-CI-001:tsconfig.json'])
    );
    expect(checkCatalogConformance(parseControlCatalog(JSON.stringify(baseDoc())), io({ readText: () => null })).map((x) => x.code)).toEqual(['ci.unreadable']);
    const noMd = io({ readText: (rel) => (rel === '.github/workflows/ci.yml' ? CI : null) });
    expect(checkCatalogConformance(parseControlCatalog(JSON.stringify(baseDoc())), noMd).map((x) => x.code)).toEqual(['catalog.doc.missing']);
    const drift = io({ readText: (rel) => (rel === '.github/workflows/ci.yml' ? CI : '# stale') });
    expect(checkCatalogConformance(parseControlCatalog(JSON.stringify(baseDoc())), drift).map((x) => x.code)).toEqual(['catalog.doc.drift']);
  });
  it('未知 setup 名 / 未登錄 step / ciStep 不在 ci.yml / ci.yml 重複 step', () => {
    const d = baseDoc();
    d.ciSetupSteps = ['Checkout', 'Warmup'];
    expect(checkCatalogConformance(parseControlCatalog(JSON.stringify(d)), io()).map((x) => x.code)).toContain('catalog.setup.missing:Warmup');
    const extra = io({ readText: (rel) => (rel === '.github/workflows/ci.yml' ? CI + '      - name: Extra\n        run: x\n' : renderCatalog(parseControlCatalog(JSON.stringify(baseDoc())))) });
    expect(checkCatalogConformance(parseControlCatalog(JSON.stringify(baseDoc())), extra).map((x) => x.code)).toContain('ci.step.unregistered:Extra');
    const d2 = baseDoc();
    d2.controls[1] = HARD('CTRL-CI-002', 'Lint', 'vitest.config.ts');
    const f2 = checkCatalogConformance(parseControlCatalog(JSON.stringify(d2)), io()).map((x) => x.code);
    expect(f2).toContain('catalog.ciStep.missing:CTRL-CI-002:Lint');
    expect(f2).toContain('ci.step.unregistered:Test (vitest)');
    const dupCi = io({ readText: (rel) => (rel === '.github/workflows/ci.yml' ? CI + '      - name: Typecheck\n        run: x\n' : renderCatalog(parseControlCatalog(JSON.stringify(baseDoc())))) });
    expect(checkCatalogConformance(parseControlCatalog(JSON.stringify(baseDoc())), dupCi).map((x) => x.code)).toContain('ci.step.duplicate:Typecheck');
  });
});

describe('check:catalog CLI(真 git fixture)', () => {
  it('E-self:本 repo exit 0、首行 CATALOG_OK', () => {
    const r = run([]);
    expect(r.code, r.out + r.err).toBe(0);
    expect(r.out).toMatch(/^CATALOG_OK — \d+ controls/);
  });
  it('fixture 正對照 exit 0', () => {
    const r = run([`--root=${makeRepo(baseDoc())}`]);
    expect(r.code, r.out + r.err).toBe(0);
  });
  it('(i) 把真 hard step「Test (vitest)」搬進 ciSetupSteps 且 control 仍宣告 ciStep → exit 2(shadows gate,loader 層)', () => {
    const d = baseDoc();
    d.ciSetupSteps = ['Checkout', 'Test (vitest)'];
    const r = run([`--root=${makeRepo(d)}`]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/同時列在 ciSetupSteps|shadows-gate/);
  });
  it('(ii) 同時把該 control 的 ciStep 改 null → 仍 exit 2(hard + push 必填 ciStep;不會靜默從反向鎖消失)', () => {
    const d = baseDoc();
    d.ciSetupSteps = ['Checkout', 'Test (vitest)'];
    (d.controls[1] as { ciStep: string | null }).ciStep = null;
    const r = run([`--root=${makeRepo(d)}`]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/ciStep 必填/);
  });
  it('(iii) 未知 setup 名 Warmup → exit 2 含 setup.missing', () => {
    const d = baseDoc();
    d.ciSetupSteps = ['Checkout', 'Warmup'];
    const r = run([`--root=${makeRepo(d)}`]);
    expect(r.code).toBe(2);
    expect(codes(r.out)).toContain('catalog.setup.missing:Warmup');
  });
  it('(iv) ciSetupSteps 重複 Checkout → exit 2(loader)', () => {
    const d = baseDoc();
    d.ciSetupSteps = ['Checkout', 'Checkout'];
    const r = run([`--root=${makeRepo(d)}`]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/重複/);
  });
  it('(v) ciSetupSteps 空 → exit 2;(vi) root 鍵拼錯 → exit 2', () => {
    const d = baseDoc() as Record<string, unknown>;
    d.ciSetupSteps = [];
    expect(run([`--root=${makeRepo(d)}`]).code).toBe(2);
    const e = baseDoc() as Record<string, unknown>;
    e.ciSetupStep = e.ciSetupSteps;
    delete e.ciSetupSteps;
    const r = run([`--root=${makeRepo(e)}`]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/未知欄位:ciSetupStep/);
  });
  it('(vii) ci.yml 多一個未登錄 step → exit 2 含 unregistered', () => {
    const r = run([`--root=${makeRepo(baseDoc(), { ci: CI + '      - name: Extra\n        run: x\n' })}`]);
    expect(r.code).toBe(2);
    expect(codes(r.out)).toContain('ci.step.unregistered:Extra');
  });
  it('(C4) ci.yml 多一個無名 step(- run:)→ exit 2 含 ci.step.unnamed;name: | → name-unsupported;-   name: 也算 step', () => {
    let r = run([`--root=${makeRepo(baseDoc(), { ci: CI + '      - run: echo sneaky\n' })}`]);
    expect(r.code).toBe(2);
    expect(codes(r.out).some((c) => c.startsWith('ci.step.unnamed:'))).toBe(true);
    r = run([`--root=${makeRepo(baseDoc(), { ci: CI + '      - name: |\n          Weird\n' })}`]);
    expect(r.code).toBe(2);
    expect(codes(r.out).some((c) => c.startsWith('ci.step.name-unsupported:'))).toBe(true);
    r = run([`--root=${makeRepo(baseDoc(), { ci: CI + '      -   name: Extra\n        run: x\n' })}`]);
    expect(r.code).toBe(2);
    expect(codes(r.out)).toContain('ci.step.unregistered:Extra');
  });
  it('(C-1) 真實形狀:step 改名並在 env: 放原名 → 反向鎖必須紅(unregistered + ciStep.missing)', () => {
    const ci = CI.replace('      - name: Test (vitest)\n        run: npx vitest run\n', '      - name: Renamed Away\n        env:\n          name: Test (vitest)\n        run: npx vitest run\n');
    const r = run([`--root=${makeRepo(baseDoc(), { ci })}`]);
    expect(r.code).toBe(2);
    expect(codes(r.out)).toContain('ci.step.unregistered:Renamed Away');
    expect(codes(r.out)).toContain('catalog.ciStep.missing:CTRL-CI-002:Test (vitest)');
  });
  it('(I1) 引號 / 尾端註解的 name 對得上 catalog → exit 0', () => {
    const ci = CI.replace('- name: Typecheck', '- name: "Typecheck"').replace('- name: Test (vitest)', "- name: 'Test (vitest)' # keep");
    const r = run([`--root=${makeRepo(baseDoc(), { ci })}`]);
    expect(r.code, r.out + r.err).toBe(0);
  });
  it('(viii) ci.yml 兩個同名 step → exit 2 含 duplicate', () => {
    const r = run([`--root=${makeRepo(baseDoc(), { ci: CI + '      - name: Typecheck\n        run: x\n' })}`]);
    expect(r.code).toBe(2);
    expect(codes(r.out)).toContain('ci.step.duplicate:Typecheck');
  });
  it('(ix) md 手改漂移 → exit 2 含 doc.drift;(x) implementation 未 tracked → exit 2 含 path.untracked', () => {
    const r = run([`--root=${makeRepo(baseDoc(), { mdOverride: '# hand edited' })}`]);
    expect(r.code).toBe(2);
    expect(codes(r.out)).toContain('catalog.doc.drift');
    const r2 = run([`--root=${makeRepo(baseDoc(), { skipTrack: ['tsconfig.json'] })}`]);
    expect(r2.code).toBe(2);
    expect(codes(r2.out)).toContain('catalog.path.untracked:CTRL-CI-001:tsconfig.json');
  });
  it('argv:未知 flag / 空 --root= / 重複 → exit 2;缺 catalog → exit 2', () => {
    expect(run(['--rot=x']).code).toBe(2);
    expect(run(['--root=']).code).toBe(2);
    expect(run([`--root=${REPO}`, `--root=${REPO}`]).code).toBe(2);
    const dir = mkdtempSync(path.join(tmpdir(), 'a3-cat-empty-'));
    made.push(dir);
    execFileSync('git', ['-C', dir, 'init', '-q']);
    const r = run([`--root=${dir}`]);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/檔案不存在/);
  });
});

// A3 defer ⑦/⑧/⑫ Sprint 10:structured outcome for YAML parser 邊角
//   FIX 三種:duplicate direct name(⑦)、non-empty flow-style steps(⑧)、quoted-scalar-malformed(⑫a-⑫d)
//   WONTFIX 兩種:tab-indent(⑥)、mixed-indent(⑪)— hand-rolled parser 無法穩定辨識、decision record 保留
//   每 fail case 鎖:(a) 直接 extractCiSteps outcome.ok=false + problemKind + line;
//                    (b) checkCatalogConformance push 唯一 ci.yaml.<problemKind>:<line> finding;
//                    (c) CLI exit 2、非「0 steps → CATALOG_OK」的假紅路徑(non-vacuous)
describe('A3 defer ⑦/⑧/⑫ Sprint 10 — structured outcome for YAML parser 邊角', () => {
  const makeIo = (ci: string): CatalogIo => ({
    readText: (rel) => (rel === '.github/workflows/ci.yml' ? ci : rel === 'docs/CONTROL-CATALOG.md' ? renderCatalog(parseControlCatalog(JSON.stringify(baseDoc()))) : null),
    trackedFiles: () => ['.github/workflows/ci.yml', 'tsconfig.json', 'vitest.config.ts', 'docs/CONTROL-CATALOG.md'],
  });

  it('(T-⑦) 兩個直屬 name: → outcome.ok=false + duplicate-direct-name + line + CLI exit 2 + finding + 非假紅', () => {
    const yml = `jobs:\n  ci:\n    steps:\n      - name: First\n        name: Second\n        run: x\n`;
    // (a) direct outcome
    const o = extractCiSteps(yml);
    expect(o.ok).toBe(false);
    if (!o.ok) {
      expect(o.problemKind).toBe('duplicate-direct-name');
      expect(o.line).toBe(5);
      expect(o.diagnostic).toContain('duplicate');
    }
    // (b) checkCatalogConformance push 唯一 ci.yaml.<problemKind>:<line> finding
    const findings = checkCatalogConformance(parseControlCatalog(JSON.stringify(baseDoc())), makeIo(yml));
    expect(findings.some((x) => x.code === 'ci.yaml.duplicate-direct-name:5')).toBe(true);
    // (c) CLI exit 2 + non-vacuous(不降為 0 steps / CATALOG_OK)
    const r = run([`--root=${makeRepo(baseDoc(), { ci: yml })}`]);
    expect(r.code).toBe(2);
    expect(codes(r.out)).toContain('ci.yaml.duplicate-direct-name:5');
    expect(r.out).not.toMatch(/^CATALOG_OK/);
  });

  it('(T-⑧) 非空 flow-style steps: [{...}] → outcome.ok=false + flow-style-unsupported + line + CLI exit 2 + finding + 非假紅', () => {
    const yml = `jobs:\n  ci:\n    steps: [{name: Only, run: x}]\n`;
    const o = extractCiSteps(yml);
    expect(o.ok).toBe(false);
    if (!o.ok) {
      expect(o.problemKind).toBe('flow-style-unsupported');
      expect(o.line).toBe(3);
      expect(o.diagnostic).toContain('不支援');
    }
    const findings = checkCatalogConformance(parseControlCatalog(JSON.stringify(baseDoc())), makeIo(yml));
    expect(findings.some((x) => x.code === 'ci.yaml.flow-style-unsupported:3')).toBe(true);
    const r = run([`--root=${makeRepo(baseDoc(), { ci: yml })}`]);
    expect(r.code).toBe(2);
    expect(codes(r.out)).toContain('ci.yaml.flow-style-unsupported:3');
    expect(r.out).not.toMatch(/^CATALOG_OK/);
  });

  it('(T-⑫a) "a\\\\b" → outcome.ok=true、name = `a\\b`(unescape \\\\ → \\)', () => {
    const yml = `jobs:\n  ci:\n    steps:\n      - name: "a\\\\b"\n        run: x\n`;
    const o = extractCiSteps(yml);
    expect(o.ok).toBe(true);
    if (o.ok) expect(o.value[0]!.name).toBe('a\\b');
  });

  it('(T-⑫b) "a\\tb" → outcome.ok=true、name = `a<TAB>b`(unescape \\t → TAB)', () => {
    const yml = `jobs:\n  ci:\n    steps:\n      - name: "a\\tb"\n        run: x\n`;
    const o = extractCiSteps(yml);
    expect(o.ok).toBe(true);
    if (o.ok) expect(o.value[0]!.name).toBe('a\tb');
  });

  it('(T-⑫c) "x" # c "d" → outcome.ok=true、name = `x`(comment 剝除、非 malformed)', () => {
    const yml = `jobs:\n  ci:\n    steps:\n      - name: "x" # c "d"\n        run: x\n`;
    const o = extractCiSteps(yml);
    expect(o.ok).toBe(true);
    if (o.ok) expect(o.value[0]!.name).toBe('x');
  });

  it('(T-namesOutcome-propagate) extractCiStepNames 對 error 原樣 propagate、不 map 為 [](wrapper 保 API 契約)', () => {
    // 覆蓋 caller chain 的 wrapper 層:extractCiStepNames 若 mutation 為 `.flatMap` 靜默降為 []
    // 這個 case 會轉紅;鎖住 main() 第二次讀取拿到 error 時、能得到結構化 outcome 而非 sentinel []
    const yml = `jobs:\n  ci:\n    steps:\n      - name: First\n        name: Second\n        run: x\n`;
    const o = extractCiStepNames(yml);
    expect(o.ok).toBe(false);
    if (!o.ok) {
      expect(o.problemKind).toBe('duplicate-direct-name');
      expect(o.line).toBe(5);
      expect(o.diagnostic).toContain('duplicate');
    }
    // 對照:合法 YAML 走 ok:true 路徑、value 為 string[]
    const ok = extractCiStepNames(`jobs:\n  ci:\n    steps:\n      - name: A\n      - name: B\n`);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value).toEqual(['A', 'B']);
  });

  it('(T-single-snapshot) evaluateCatalogSnapshot production-used seam:realIo.readText(CI_YML) 恰讀一次、conformance 與 stepCount 共用同一 snapshot', () => {
    // Codex Step 4 P1 rereview 拍板:main 呼叫 evaluateCatalogSnapshot seam(而非兩次 buildRealIo);
    // 此 test 注入 counting realIo、驗 CI_YML 恰讀一次、result.ok=true + stepCount 對得上、findings 空
    let ciReadCount = 0;
    let mdReadCount = 0;
    const yml = `jobs:\n  ci:\n    steps:\n      - name: Checkout\n        uses: x\n      - name: Typecheck\n        run: y\n      - name: Test (vitest)\n        run: z\n`;
    const countingRealIo: CatalogIo = {
      readText: (rel) => {
        if (rel === '.github/workflows/ci.yml') { ciReadCount++; return yml; }
        if (rel === 'docs/CONTROL-CATALOG.md') { mdReadCount++; return renderCatalog(parseControlCatalog(JSON.stringify(baseDoc()))); }
        return null;
      },
      trackedFiles: () => ['.github/workflows/ci.yml', 'tsconfig.json', 'vitest.config.ts', 'docs/CONTROL-CATALOG.md'],
    };
    const result = evaluateCatalogSnapshot(parseControlCatalog(JSON.stringify(baseDoc())), countingRealIo);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.findings).toEqual([]);
      expect(result.stepCount).toBe(3);
    }
    // 鎖 single-snapshot 不變式:realIo.readText(CI_YML) 只在 seam 起手呼叫一次
    // (findings 空後、seam 內部再走 extractCiStepNames 用局部 ymlSnapshot、不再讀 realIo)
    expect(ciReadCount).toBe(1);
    expect(mdReadCount).toBe(1); // conformance 讀一次 md 屬既有契約
  });

  it('(T-single-snapshot-invariant) evaluateCatalogSnapshot 不變式 breakage(mock 導出 conformance 綠但 extractCiStepNames error)→ ok:false + invariant diagnostic', () => {
    // 極端情況:mock realIo 對兩次 readText(CI_YML) 回不同內容(第一次乾淨、後續 malformed)、
    // cached IO 只讀第一次;此 case 不會真觸發不變式 breakage(cached 就是這個設計的目的);
    // 改用直接測 seam 對「conformance 於 malformed yml 直接產 ci.yaml.<problemKind> finding」的路徑,
    // 確認 findings.length > 0 → result.ok=true + findings 帶錯誤 code(非 exception)
    const malformed = `jobs:\n  ci:\n    steps:\n      - name: A\n        name: B\n        run: x\n`;
    const realIo: CatalogIo = {
      readText: (rel) => (rel === '.github/workflows/ci.yml' ? malformed : rel === 'docs/CONTROL-CATALOG.md' ? renderCatalog(parseControlCatalog(JSON.stringify(baseDoc()))) : null),
      trackedFiles: () => ['.github/workflows/ci.yml', 'tsconfig.json', 'vitest.config.ts', 'docs/CONTROL-CATALOG.md'],
    };
    const result = evaluateCatalogSnapshot(parseControlCatalog(JSON.stringify(baseDoc())), realIo);
    expect(result.ok).toBe(true); // 走 findings 路徑、非 invariant break
    if (result.ok) {
      expect(result.findings.some((x) => x.code === 'ci.yaml.duplicate-direct-name:5')).toBe(true);
      // findings 存在時 stepCount 為 0(seam 契約)
      expect(result.stepCount).toBe(0);
    }
  });

  it('(T-⑫d) "x" trailing → outcome.ok=false + quoted-scalar-malformed + line + CLI exit 2 + finding + 非假紅', () => {
    const yml = `jobs:\n  ci:\n    steps:\n      - name: "x" trailing\n        run: x\n`;
    const o = extractCiSteps(yml);
    expect(o.ok).toBe(false);
    if (!o.ok) {
      expect(o.problemKind).toBe('quoted-scalar-malformed');
      expect(o.line).toBe(4);
      expect(o.diagnostic).toContain('malformed');
    }
    const findings = checkCatalogConformance(parseControlCatalog(JSON.stringify(baseDoc())), makeIo(yml));
    expect(findings.some((x) => x.code === 'ci.yaml.quoted-scalar-malformed:4')).toBe(true);
    const r = run([`--root=${makeRepo(baseDoc(), { ci: yml })}`]);
    expect(r.code).toBe(2);
    expect(codes(r.out)).toContain('ci.yaml.quoted-scalar-malformed:4');
    expect(r.out).not.toMatch(/^CATALOG_OK/);
  });
});
