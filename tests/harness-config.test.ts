// tests/harness-config.test.ts — PR A2 harness.config loader
//
// 契約:顯式靜態宣告、fail-closed、無 fallback、無正規化。每條負對照對應
// scripts/lib/harness-config.ts 檔頭列的一條規則;改壞 loader 任何一條都要有人紅。

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HARNESS_CONFIG_PATH,
  KNOWN_ADAPTERS,
  TEMPLATE_PROJECT_ID,
  literalBranchNameViolation,
  loadHarnessConfig,
  parseHarnessConfig,
} from '../scripts/lib/harness-config';

const REPO = path.resolve(__dirname, '..');

const VALID_TEMPLATE = {
  schemaVersion: 2,
  mergeStrategy: 'squash',
  mode: 'template',
  projectId: TEMPLATE_PROJECT_ID,
  templatePackageName: 'harness-controlled-dev-environment',
  protectedBranches: ['develop', 'main'],
  deliveryBranches: ['main'],
  requiredAgentAdapters: ['claude'],
  githubGovernanceRequired: false,
};

const VALID_ADOPTED = {
  ...VALID_TEMPLATE,
  mode: 'adopted',
  projectId: 'my-shop',
  requiredAgentAdapters: ['claude', 'codex'],
  githubGovernanceRequired: true,
};

function withField(base: object, patch: Record<string, unknown>): string {
  return JSON.stringify({ ...base, ...patch });
}
function without(base: object, key: string): string {
  const o = { ...(base as Record<string, unknown>) };
  delete o[key];
  return JSON.stringify(o);
}

describe('parseHarnessConfig — 正對照', () => {
  it('出廠 template config 可解析', () => {
    const c = parseHarnessConfig(JSON.stringify(VALID_TEMPLATE));
    expect(c.mode).toBe('template');
    expect(c.projectId).toBe(TEMPLATE_PROJECT_ID);
    expect(c.protectedBranches).toEqual(['develop', 'main']);
  });
  it('完整 adopted config 可解析', () => {
    const c = parseHarnessConfig(JSON.stringify(VALID_ADOPTED));
    expect(c.mode).toBe('adopted');
    expect(c.requiredAgentAdapters).toEqual(['claude', 'codex']);
    expect(c.githubGovernanceRequired).toBe(true);
  });
  it('_comment 欄位允許且被丟棄', () => {
    const c = parseHarnessConfig(withField(VALID_TEMPLATE, { _comment: 'x' }));
    expect((c as unknown as Record<string, unknown>)._comment).toBeUndefined();
  });
  it('本 repo 出廠的 scripts/harness.config.json 可載入且是 template', () => {
    const c = loadHarnessConfig(REPO);
    expect(c.mode).toBe('template');
    expect(c.projectId).toBe(TEMPLATE_PROJECT_ID);
  });
});

describe('parseHarnessConfig — fail-closed 負對照', () => {
  it('JSON malformed', () => {
    expect(() => parseHarnessConfig('{ nope')).toThrow(/JSON 解析失敗/);
  });
  it('root 非 object(陣列 / null / 字串)', () => {
    expect(() => parseHarnessConfig('[]')).toThrow(/root/);
    expect(() => parseHarnessConfig('null')).toThrow(/root/);
    expect(() => parseHarnessConfig('"x"')).toThrow(/root/);
  });
  it.each([0, 1, 3, '2', null])('schemaVersion 未知:%j', (v) => {
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { schemaVersion: v }))).toThrow(/schemaVersion/);
  });
  it('schemaVersion 1 一律拒收(無 fallback)、訊息指向 MIGRATION', () => {
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { schemaVersion: 1 }))).toThrow(/docs\/MIGRATION\.md/);
  });
  it.each(['Squash', 'merge_commit', 'ff', '', null, 1])('mergeStrategy 枚舉外:%j', (m) => {
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { mergeStrategy: m }))).toThrow(/mergeStrategy/);
  });
  it.each(['squash', 'merge-commit', 'rebase', 'fast-forward'])('mergeStrategy 合法 %s', (m) => {
    expect(parseHarnessConfig(withField(VALID_TEMPLATE, { mergeStrategy: m })).mergeStrategy).toBe(m);
  });
  it.each(['Template', 'adopte', '', 'TEMPLATE', null, 1])('mode 不合法:%j', (m) => {
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { mode: m }))).toThrow(/mode/);
  });
  it('未知欄位(拼錯 mdoe)fail-closed', () => {
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { mdoe: 'adopted' }))).toThrow(/未知欄位:mdoe/);
  });
  it.each([
    'schemaVersion',
    'mode',
    'projectId',
    'templatePackageName',
    'protectedBranches',
    'deliveryBranches',
    'requiredAgentAdapters',
    'githubGovernanceRequired',
    'mergeStrategy',
  ])('缺必要欄位 %s', (k) => {
    expect(() => parseHarnessConfig(without(VALID_TEMPLATE, k))).toThrow(new RegExp(k));
  });
  it('projectId / templatePackageName 空字串或非字串', () => {
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { projectId: '' }))).toThrow(/projectId/);
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { projectId: 3 }))).toThrow(/projectId/);
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { templatePackageName: '' }))).toThrow(
      /templatePackageName/
    );
  });
  it('githubGovernanceRequired 非 boolean', () => {
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { githubGovernanceRequired: 'no' }))).toThrow(
      /githubGovernanceRequired/
    );
  });
  it('deliveryBranches ⊄ protectedBranches', () => {
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { deliveryBranches: ['release'] }))).toThrow(
      /deliveryBranches 含 "release"/
    );
  });
  it.each(['protectedBranches', 'deliveryBranches', 'requiredAgentAdapters'])('%s 空陣列', (k) => {
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { [k]: [] }))).toThrow(/不得為空陣列/);
  });
  it.each(['protectedBranches', 'deliveryBranches', 'requiredAgentAdapters'])('%s 非陣列', (k) => {
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { [k]: 'main' }))).toThrow(/必須是陣列/);
  });
  it('陣列元素非字串 / 空字串', () => {
    expect(() =>
      parseHarnessConfig(withField(VALID_TEMPLATE, { protectedBranches: ['main', 1], deliveryBranches: ['main'] }))
    ).toThrow(/protectedBranches\[1\]/);
    expect(() =>
      parseHarnessConfig(withField(VALID_TEMPLATE, { protectedBranches: ['main', ''], deliveryBranches: ['main'] }))
    ).toThrow(/protectedBranches\[1\]/);
  });
  it('requiredAgentAdapters 重複 / 未知', () => {
    expect(() =>
      parseHarnessConfig(withField(VALID_TEMPLATE, { requiredAgentAdapters: ['claude', 'claude'] }))
    ).toThrow(/重複/);
    expect(() => parseHarnessConfig(withField(VALID_TEMPLATE, { requiredAgentAdapters: ['gemini'] }))).toThrow(
      /未知 adapter "gemini"/
    );
    expect(KNOWN_ADAPTERS).toEqual(['claude', 'codex']);
  });
});

describe('字面分支名文法(rev 3)— config 側各自 throw', () => {
  const cases: [string, string][] = [
    ['glob *', 'feature/*'],
    ['glob **', 'release/**'],
    ['glob ?', 'main?'],
    ['glob [', 'main[1]'],
    ['ref-prefix refs/heads', 'refs/heads/main'],
    ['ref-prefix origin/', 'origin/main'],
    ['ref-prefix heads/', 'heads/main'],
    ['ref-prefix remotes/', 'remotes/origin/main'],
    ['leading space', ' main'],
    ['trailing space', 'main '],
    ['inner space', 'ma in'],
    ['tab', 'main\tdev'],
    ['single quote', "'main'"],
    ['double quote', '"main"'],
    ['backtick', '`main`'],
    ['vertical bar', 'main|develop'],
    ['newline control', 'main\n'],
    ['NUL control', 'main\u0000'],
    ['DEL control', 'main\u007f'],
    ['ESC control', 'main\u001b'],
    ['leading dash', '-main'],
    ['.lock suffix', 'main.lock'],
    ['double dot', 'a..b'],
    ['double slash', 'a//b'],
    ['trailing slash', 'main/'],
    ['HEAD', 'HEAD'],
    ['@{', 'a@{1}'],
    ['backslash', 'a\\b'],
    ['tilde', 'a~1'],
    ['caret', 'a^'],
    ['colon', 'a:b'],
    ['non-ASCII', '主線'],
  ];
  it.each(cases)('%s → protectedBranches 拒絕', (_label, bad) => {
    expect(literalBranchNameViolation(bad)).not.toBeNull();
    expect(() =>
      parseHarnessConfig(withField(VALID_TEMPLATE, { protectedBranches: ['main', bad], deliveryBranches: ['main'] }))
    ).toThrow(/protectedBranches\[1\]/);
  });
  it.each(cases)('%s → deliveryBranches 拒絕', (_label, bad) => {
    expect(() =>
      parseHarnessConfig(withField(VALID_TEMPLATE, { protectedBranches: ['main', 'develop'], deliveryBranches: [bad] }))
    ).toThrow(/deliveryBranches\[0\]/);
  });
  it('空字串元素被陣列元素檢查擋下(訊息指出索引)', () => {
    expect(() =>
      parseHarnessConfig(withField(VALID_TEMPLATE, { protectedBranches: [''], deliveryBranches: [''] }))
    ).toThrow(/protectedBranches\[0\]/);
    expect(literalBranchNameViolation('')).toBe('空字串');
  });
  it('精確重複 → throw', () => {
    expect(() =>
      parseHarnessConfig(withField(VALID_TEMPLATE, { protectedBranches: ['main', 'main'], deliveryBranches: ['main'] }))
    ).toThrow(/protectedBranches\[1\] = "main" 重複/);
  });
  it('case-fold 重複(Main vs main)→ throw、不做正規化', () => {
    expect(() =>
      parseHarnessConfig(withField(VALID_TEMPLATE, { protectedBranches: ['Main', 'main'], deliveryBranches: ['main'] }))
    ).toThrow(/case-fold 重複/);
  });
  it.each(['main', 'develop', 'release/1.2', 'feature_x', 'v1.0-rc', 'a.b.c', 'Main'])(
    '合法字面名 %s 通過',
    (ok) => {
      expect(literalBranchNameViolation(ok)).toBeNull();
    }
  );
  it('非字串 → 違反', () => {
    expect(literalBranchNameViolation(1)).toMatch(/必須是字串/);
  });
});

describe('loadHarnessConfig — 檔案層', () => {
  function tmpRoot(): string {
    return mkdtempSync(path.join(tmpdir(), 'harness-config-'));
  }
  it('缺檔 → throw(不預設 template、不猜)', () => {
    const root = tmpRoot();
    try {
      expect(() => loadHarnessConfig(root)).toThrow(/檔案不存在.*明確選擇 mode/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('存在且合法 → 回 config;存在但壞 → throw 帶檔名', () => {
    const root = tmpRoot();
    try {
      mkdirSync(path.join(root, 'scripts'));
      writeFileSync(path.join(root, HARNESS_CONFIG_PATH), JSON.stringify(VALID_ADOPTED));
      expect(loadHarnessConfig(root).mode).toBe('adopted');
      writeFileSync(path.join(root, HARNESS_CONFIG_PATH), '{');
      expect(() => loadHarnessConfig(root)).toThrow(new RegExp(HARNESS_CONFIG_PATH.replace('.', '\\.')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
