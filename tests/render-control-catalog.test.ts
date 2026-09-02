// tests/render-control-catalog.test.ts — PR A3 渲染器(決定性 + golden)
//
// 守的不變量:同 JSON → 逐位元組相同輸出;committed docs/CONTROL-CATALOG.md 就是 committed JSON 的渲染結果;
// 表格逃逸 `|`;每條 control 與 setup step 都出現在輸出。

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { CATALOG_DOC_PATH, CLASS_DESCRIPTIONS, renderCatalog } from '../scripts/render-control-catalog';
import { CONTROL_CLASSES, loadControlCatalog, parseControlCatalog } from '../scripts/lib/control-catalog';

const REPO = path.resolve(__dirname, '..');

describe('renderCatalog', () => {
  const cat = loadControlCatalog(REPO);
  it('golden:committed md === render(committed JSON)(逐位元組)', () => {
    expect(readFileSync(path.join(REPO, CATALOG_DOC_PATH), 'utf-8')).toBe(renderCatalog(cat));
  });
  it('決定性:同輸入兩次輸出相同;每個 class 都有 H2;每條 ID 與 setup step 都出現', () => {
    const a = renderCatalog(cat);
    expect(renderCatalog(cat)).toBe(a);
    for (const cls of CONTROL_CLASSES) {
      expect(a).toContain(`\n## ${cls}\n`);
      expect(a).toContain(CLASS_DESCRIPTIONS[cls].replace(/\|/g, '\\|'));
    }
    for (const c of cat.controls) expect(a).toContain(`| ${c.id} | `);
    for (const s of cat.ciSetupSteps) expect(a).toContain(`- \`${s}\``);
    expect(a.startsWith('<!-- GENERATED FILE')).toBe(true);
  });
  it('表格逃逸:欄位內的 | 變成 \\|,不會撐破表格', () => {
    const doc = JSON.parse(readFileSync(path.join(REPO, 'scripts/control-catalog.json'), 'utf-8'));
    doc.controls[0].notes = 'a | b';
    const md = renderCatalog(parseControlCatalog(JSON.stringify(doc)));
    expect(md).toContain('a \\| b');
    const line = md.split('\n').find((l) => l.startsWith(`| ${doc.controls[0].id} |`))!;
    expect(line.split(' | ').length).toBe(15);
  });
});

describe('render CLI', () => {
  const TSX = path.join(REPO, 'node_modules/.bin/tsx');
  const SCRIPT = path.join(REPO, 'scripts/render-control-catalog.ts');
  it('--check 對本 repo exit 0;無參數 / 未知參數 exit 2', () => {
    expect(spawnSync(TSX, [SCRIPT, '--check'], { cwd: REPO, encoding: 'utf-8' }).status).toBe(0);
    expect(spawnSync(TSX, [SCRIPT], { cwd: REPO, encoding: 'utf-8' }).status).toBe(2);
    expect(spawnSync(TSX, [SCRIPT, '--wirte'], { cwd: REPO, encoding: 'utf-8' }).status).toBe(2);
    expect(spawnSync(TSX, [SCRIPT, '--check', '--write'], { cwd: REPO, encoding: 'utf-8' }).status).toBe(2);
  });
});
