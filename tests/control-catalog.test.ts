// tests/control-catalog.test.ts — PR A3 control catalog loader(純資料層)
//
// 契約:fail-closed、無 fallback、無正規化;root 只准三鍵;ciSetupSteps 為權威豁免清單。
// committed fixture 的意圖集合在這裡釘住:改 JSON 沒改測試就紅。

import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATALOG_PATH,
  CONTROL_CLASSES,
  loadControlCatalog,
  parseControlCatalog,
  repoFilePathViolation,
  type Control,
} from '../scripts/lib/control-catalog';

const REPO = path.resolve(__dirname, '..');

const BASE: Control = {
  id: 'CTRL-CI-001',
  name: 'x',
  legacyGate: '④',
  class: 'hard-automated',
  triggers: ['push', 'pull_request'],
  implementation: ['.github/workflows/ci.yml'],
  locator: null,
  ciStep: 'Typecheck',
  owner: 'github',
  failureBehavior: 'block',
  bypass: 'admin override',
  evidence: 'ci',
  degradation: 'none',
  tested: ['manual-drill'],
  testRefs: [],
  notes: null,
};
const SOFT: Control = {
  ...BASE,
  id: 'CTRL-HOOK-001',
  class: 'soft-automated',
  triggers: ['commit'],
  implementation: ['scripts/git-hooks/pre-commit'],
  ciStep: null,
  bypass: '--no-verify',
  tested: ['unit'],
  testRefs: ['tests/check-hooks.test.ts'],
};
function doc(patch: Partial<{ schemaVersion: unknown; ciSetupSteps: unknown; controls: unknown }> = {}, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ schemaVersion: 1, ciSetupSteps: ['Checkout'], controls: [BASE, SOFT], ...patch, ...extra });
}
function withControl(patch: Partial<Record<keyof Control, unknown>>, base: Control = BASE): string {
  const c = { ...base, ...patch } as Record<string, unknown>;
  return doc({ controls: [c, base === BASE ? SOFT : BASE] });
}

describe('committed catalog(scripts/control-catalog.json)', () => {
  const cat = loadControlCatalog(REPO);
  it('可載入;ciSetupSteps 意圖集合釘住(改 JSON 要同步改這裡)', () => {
    expect(cat.ciSetupSteps).toEqual(['Checkout', 'Setup Node 22', 'Install dependencies', 'Fetch delivery refs (for TODOS Markers Check)']);
  });
  it('每個 class 至少一條;ID 全部唯一;hard-automated 全部有 ciStep', () => {
    for (const c of CONTROL_CLASSES) expect(cat.controls.some((x) => x.class === c), c).toBe(true);
    expect(new Set(cat.controls.map((c) => c.id)).size).toBe(cat.controls.length);
    for (const c of cat.controls.filter((x) => x.class === 'hard-automated')) expect(c.ciStep, c.id).not.toBeNull();
  });
  it('I6:destructive guard 標為 soft-automated 且 notes 寫明 accident interlock', () => {
    const g = cat.controls.find((c) => c.id === 'CTRL-GUARD-001')!;
    expect(g.class).toBe('soft-automated');
    expect(g.notes).toMatch(/accident interlock/);
  });
});

describe('parseControlCatalog — root', () => {
  it('正:最小合法 doc', () => {
    const c = parseControlCatalog(doc());
    expect(c.controls.map((x) => x.id)).toEqual(['CTRL-CI-001', 'CTRL-HOOK-001']);
  });
  it('JSON malformed / root 非 object', () => {
    expect(() => parseControlCatalog('{')).toThrow(/JSON 解析失敗/);
    expect(() => parseControlCatalog('[]')).toThrow(/root/);
  });
  it('root 未知鍵(含拼錯 ciSetupStep)/ 缺鍵 / schemaVersion 未知', () => {
    expect(() => parseControlCatalog(doc({}, { ciSetupStep: ['x'] }))).toThrow(/root 未知欄位:ciSetupStep/);
    for (const k of ['schemaVersion', 'ciSetupSteps', 'controls']) {
      const o = JSON.parse(doc());
      delete o[k];
      expect(() => parseControlCatalog(JSON.stringify(o))).toThrow(new RegExp(`缺必要欄位 ${k}`));
    }
    expect(() => parseControlCatalog(doc({ schemaVersion: 2 }))).toThrow(/schemaVersion/);
    expect(() => parseControlCatalog(doc({ schemaVersion: '1' }))).toThrow(/schemaVersion/);
  });
  it('ciSetupSteps:非陣列 / 空 / 元素空 / 重複(精確比對、不正規化)', () => {
    expect(() => parseControlCatalog(doc({ ciSetupSteps: 'Checkout' }))).toThrow(/ciSetupSteps 必須是陣列/);
    expect(() => parseControlCatalog(doc({ ciSetupSteps: [] }))).toThrow(/ciSetupSteps 不得為空/);
    expect(() => parseControlCatalog(doc({ ciSetupSteps: [''] }))).toThrow(/ciSetupSteps\[0\]/);
    expect(() => parseControlCatalog(doc({ ciSetupSteps: ['Checkout', 'Checkout'] }))).toThrow(/重複/);
    expect(parseControlCatalog(doc({ ciSetupSteps: ['Checkout', 'checkout'] })).ciSetupSteps).toHaveLength(2);
  });
  it('controls 非陣列 / 空;id 重複;ciStep 被兩條引用;ciStep 同時列在 ciSetupSteps(shadows gate)', () => {
    expect(() => parseControlCatalog(doc({ controls: {} }))).toThrow(/controls 必須是陣列/);
    expect(() => parseControlCatalog(doc({ controls: [] }))).toThrow(/controls 不得為空/);
    expect(() => parseControlCatalog(doc({ controls: [BASE, BASE] }))).toThrow(/CTRL-CI-001 重複/);
    expect(() => parseControlCatalog(doc({ controls: [BASE, { ...BASE, id: 'CTRL-CI-002' }] }))).toThrow(/被多條 control 引用/);
    expect(() => parseControlCatalog(doc({ ciSetupSteps: ['Checkout', 'Typecheck'] }))).toThrow(/同時列在 ciSetupSteps/);
  });
});

describe('parseControlCatalog — control 欄位', () => {
  it('未知欄位 / 缺欄位(null 也要明寫)', () => {
    expect(() => parseControlCatalog(withControl({ extra: 1 } as never))).toThrow(/未知欄位:extra/);
    const o = JSON.parse(doc());
    delete o.controls[0].notes;
    expect(() => parseControlCatalog(JSON.stringify(o))).toThrow(/缺欄位 notes/);
  });
  it.each(['CTRL-X-001', 'CTRL-CI-1', 'ctrl-ci-001', 'CTRL-CI-0001', ''])('id 不合文法 %s', (id) => {
    expect(() => parseControlCatalog(withControl({ id }))).toThrow(/id/);
  });
  it('枚舉:class / owner / failureBehavior / legacyGate / triggers / tested', () => {
    expect(() => parseControlCatalog(withControl({ class: 'hard' }))).toThrow(/class 必須是/);
    expect(() => parseControlCatalog(withControl({ owner: 'me' }))).toThrow(/owner 必須是/);
    expect(() => parseControlCatalog(withControl({ failureBehavior: 'fail' }))).toThrow(/failureBehavior 必須是/);
    expect(() => parseControlCatalog(withControl({ legacyGate: '14' }))).toThrow(/legacyGate/);
    expect(() => parseControlCatalog(withControl({ triggers: ['push', 'cron'] }))).toThrow(/triggers\[1\]/);
    expect(() => parseControlCatalog(withControl({ tested: ['fuzz'] }))).toThrow(/tested\[0\]/);
  });
  it('triggers:非陣列 / 空 / 重複', () => {
    expect(() => parseControlCatalog(withControl({ triggers: 'push' }))).toThrow(/triggers 必須是陣列/);
    expect(() => parseControlCatalog(withControl({ triggers: [] }))).toThrow(/triggers 不得為空/);
    expect(() => parseControlCatalog(withControl({ triggers: ['push', 'push'] }))).toThrow(/重複/);
  });
  it.each([
    ['目錄尾斜線', 'docs/'],
    ['glob *', 'scripts/*.ts'],
    ['glob **', '.claude/memory/**'],
    ['..', '../x.md'],
    ['絕對路徑', '/etc/x'],
    ['./ 前綴', './CLAUDE.md'],
    ['空白', 'CLAUDE.md Part 1'],
    ['反斜線', 'docs\\x.md'],
    ['空', ''],
  ])('implementation 形狀拒絕:%s', (_l, p) => {
    expect(repoFilePathViolation(p)).not.toBeNull();
    expect(() => parseControlCatalog(withControl({ implementation: [p] }))).toThrow(/implementation\[0\]/);
  });
  it('implementation 空 / 重複;testRefs 形狀同規則但可空', () => {
    expect(() => parseControlCatalog(withControl({ implementation: [] }))).toThrow(/implementation 不得為空/);
    expect(() => parseControlCatalog(withControl({ implementation: ['CLAUDE.md', 'CLAUDE.md'] }))).toThrow(/重複/);
    expect(() => parseControlCatalog(withControl({ tested: ['unit'], testRefs: ['tests/*.ts'] }))).toThrow(/testRefs\[0\]/);
  });
  it('ciStep 一致性:hard + CI trigger 必填;其他必須 null', () => {
    expect(() => parseControlCatalog(withControl({ ciStep: null }))).toThrow(/ciStep 必填/);
    expect(() => parseControlCatalog(withControl({ triggers: ['manual'], ciStep: 'Typecheck' }))).toThrow(/才可有 ciStep/);
    expect(() => parseControlCatalog(withControl({ ciStep: 'Typecheck' }, SOFT))).toThrow(/才可有 ciStep/);
    expect(parseControlCatalog(withControl({ triggers: ['manual'], ciStep: null })).controls[0]!.ciStep).toBeNull();
  });
  it('bypass 一致性:hard 不得 --no-verify;soft 不得 none', () => {
    expect(() => parseControlCatalog(withControl({ bypass: '--no-verify' }))).toThrow(/不可能被 --no-verify/);
    expect(() => parseControlCatalog(withControl({ bypass: 'none' }, SOFT))).toThrow(/不得是 none/);
  });
  it('tested / testRefs 一致性:untested 排他且無 refs;unit/e2e 要 tests/**;mutation 要 mutations/*.json', () => {
    expect(() => parseControlCatalog(withControl({ tested: ['untested', 'unit'] }))).toThrow(/untested 時不得/);
    expect(() => parseControlCatalog(withControl({ tested: ['untested'], testRefs: ['tests/x.test.ts'] }))).toThrow(/untested 不得帶 testRefs/);
    expect(() => parseControlCatalog(withControl({ tested: ['unit'], testRefs: [] }))).toThrow(/至少一個 tests/);
    expect(() => parseControlCatalog(withControl({ tested: ['mutation'], testRefs: ['tests/x.test.ts'] }))).toThrow(/mutations/);
    expect(parseControlCatalog(withControl({ tested: ['mutation'], testRefs: ['scripts/mutations/x.json'] })).controls[0]!.tested).toEqual(['mutation']);
  });
  it('非空字串欄位:name / bypass / evidence / degradation;locator / notes 可 null 但不可空字串', () => {
    for (const k of ['name', 'bypass', 'evidence', 'degradation'] as const) {
      expect(() => parseControlCatalog(withControl({ [k]: '  ' }))).toThrow(new RegExp(k));
    }
    expect(() => parseControlCatalog(withControl({ locator: '' }))).toThrow(/locator/);
    expect(() => parseControlCatalog(withControl({ notes: 3 }))).toThrow(/notes/);
  });
});

describe('loadControlCatalog', () => {
  it('缺檔 → throw 帶檔名', () => {
    expect(() => loadControlCatalog('/nonexistent-root')).toThrow(new RegExp(CATALOG_PATH.replace('.', '\\.')));
  });
});
