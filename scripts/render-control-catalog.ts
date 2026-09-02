// scripts/render-control-catalog.ts
//
// 把 `scripts/control-catalog.json`(唯一正本)渲染成 `docs/CONTROL-CATALOG.md`(PR A3)。
//
// - 純函式 `renderCatalog(catalog)` 決定性輸出(同輸入 → 逐位元組相同),讓
//   `scripts/check-control-catalog.ts` 用「渲染結果 === 檔案內容」當漂移守門,
//   不解析 markdown。
// - CLI:`--write` 寫檔;`--check` 只比對(exit 0 一致 / 2 不一致或無法判定)。
//   人不該手改 md;改 JSON 再 `npm run catalog:render`。
//
// 刻意不做:不從 md 反推 JSON、不做自然語言比對、不讀 ci.yml(那是 checker 的事)。

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  CONTROL_CLASSES,
  LEGACY_GATES,
  loadControlCatalog,
  type Control,
  type ControlCatalog,
  type ControlClass,
} from './lib/control-catalog';

export const CATALOG_DOC_PATH = 'docs/CONTROL-CATALOG.md';

/** 五個強度分級的定義(渲染進文件;這裡是唯一敘述處)。 */
export const CLASS_DESCRIPTIONS: Record<ControlClass, string> = {
  'hard-automated': 'CI 上自動執行、紅了就擋 merge(前提:GitHub branch protection 要求 CI pass,見 CTRL-GOV-005)。bypass 只有 admin override。',
  'soft-automated': '機器執行但在本機、可被繞過(`--no-verify`、未安裝、不 import)。是縱深,不是邊界。',
  'manual-mandatory': 'SOP 明文要求、由人(agent / Owner)執行;機器只驗其產物或不驗。',
  advisory: '刻意不擋;產出待處置清單或建議,命中不代表錯。',
  'periodic-governance': '週 / 季 / 依需求執行的治理節奏;沒有 per-change 強制力。',
};

function cell(v: string | null): string {
  if (v === null) return '—';
  return v.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
function codeList(items: string[]): string {
  return items.length === 0 ? '—' : items.map((i) => `\`${i}\``).join(', ');
}

function renderClassSection(cls: ControlClass, controls: Control[]): string[] {
  const rows = controls.filter((c) => c.class === cls);
  const out: string[] = [];
  out.push(`## ${cls}`, '', `> ${CLASS_DESCRIPTIONS[cls]}`, '');
  if (rows.length === 0) {
    out.push('_(無)_', '');
    return out;
  }
  out.push(
    '| ID | 名稱 | 舊編號 | Triggers | 實作(tracked 路徑) | Locator | CI step | Owner | 失敗行為 | Bypass | Evidence | Degradation | Tested | Test refs | Notes |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|'
  );
  for (const c of rows) {
    out.push(
      [
        c.id,
        cell(c.name),
        c.legacyGate ?? '—',
        c.triggers.map((t) => `\`${t}\``).join(' '),
        codeList(c.implementation),
        cell(c.locator),
        c.ciStep === null ? '—' : `\`${cell(c.ciStep)}\``,
        c.owner,
        c.failureBehavior,
        cell(c.bypass),
        cell(c.evidence),
        cell(c.degradation),
        c.tested.join(' '),
        codeList(c.testRefs),
        cell(c.notes),
      ].join(' | ')
        .replace(/^/, '| ')
        .replace(/$/, ' |')
    );
  }
  out.push('');
  return out;
}

export function renderCatalog(catalog: ControlCatalog): string {
  const out: string[] = [];
  out.push(
    '<!-- GENERATED FILE — 由 scripts/render-control-catalog.ts 從 scripts/control-catalog.json 渲染。',
    '     不要手改本檔:改 JSON 後跑 `npm run catalog:render`;`npm run check:catalog` 會驗兩者逐位元組一致。 -->',
    '---',
    'title: CONTROL-CATALOG — 控制措施目錄(由 JSON 渲染)',
    'type: reference',
    '---',
    '',
    '# Control Catalog',
    '',
    '> **正本是 `scripts/control-catalog.json`**;本檔是渲染產物(不變量 I4:規則正本只有一份)。',
    '> 每條 control 標明強度分級(不變量 I3),讓讀者一眼分辨:哪些是 CI 硬擋、哪些可 `--no-verify`、',
    '> 哪些是人守的 SOP、哪些只是 advisory 或週期治理。',
    '>',
    '> **機器驗的**(`npm run check:catalog`):ID 唯一、每個實作 / 測試路徑 tracked、hard-automated 的 CI step',
    '> 與 `.github/workflows/ci.yml` 雙向一一對應(setup step 由 `ciSetupSteps` 明文豁免)、宣稱 mutation-tested 的',
    '> 指到存在的 spec、本檔與 JSON 逐位元組一致。',
    '> **機器不驗的**(誠實邊界):`Locator` / `Evidence` / `Degradation` / `Bypass` / `Notes` 的文字內容——',
    '> 那是人讀的描述,可能過時;發現不符請改 JSON。',
    '',
    '## 強度分級定義',
    '',
    '| Class | 定義 |',
    '|---|---|'
  );
  for (const cls of CONTROL_CLASSES) out.push(`| \`${cls}\` | ${cell(CLASS_DESCRIPTIONS[cls])} |`);
  out.push('', '## 依強度分級', '');
  for (const cls of CONTROL_CLASSES) out.push(...renderClassSection(cls, catalog.controls));
  out.push('## CI setup steps(不登錄為 control)', '', '> `ciSetupSteps`:這些 `ci.yml` step 是環境準備,不是控制措施;checker 驗每個名稱在 ci.yml 恰出現 1 次、且不與任何 control 的 CI step 重疊。', '');
  for (const s of catalog.ciSetupSteps) out.push(`- \`${cell(s)}\``);
  out.push('', '## 舊編號索引(README / OVERVIEW 的 ①–⑬)', '', '| 舊編號 | Controls |', '|---|---|');
  for (const g of LEGACY_GATES) {
    const ids = catalog.controls.filter((c) => c.legacyGate === g).map((c) => c.id);
    out.push(`| ${g} | ${ids.length === 0 ? '—' : ids.join(', ')} |`);
  }
  out.push('');
  return out.join('\n');
}

function main(): number {
  const argv = process.argv.slice(2);
  const mode = argv[0];
  if (argv.length !== 1 || (mode !== '--write' && mode !== '--check')) {
    console.error('用法:tsx scripts/render-control-catalog.ts --write | --check(fail-closed exit 2)');
    return 2;
  }
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
  let rendered: string;
  try {
    rendered = renderCatalog(loadControlCatalog(root));
  } catch (e) {
    console.error(`❌ ${(e as Error).message}`);
    return 2;
  }
  const target = path.join(root, CATALOG_DOC_PATH);
  if (mode === '--write') {
    writeFileSync(target, rendered);
    console.log(`✅ 已寫入 ${CATALOG_DOC_PATH}(${Buffer.byteLength(rendered)} bytes)`);
    return 0;
  }
  let current: string;
  try {
    current = readFileSync(target, 'utf-8');
  } catch {
    console.error(`❌ ${CATALOG_DOC_PATH} 讀不到(請跑 npm run catalog:render)`);
    return 2;
  }
  if (current !== rendered) {
    console.error(`❌ ${CATALOG_DOC_PATH} 與 JSON 渲染結果不一致(請改 JSON 後跑 npm run catalog:render;不要手改 md)`);
    return 2;
  }
  console.log(`✅ ${CATALOG_DOC_PATH} 與 JSON 一致`);
  return 0;
}

const invokedPath = process.argv[1];
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  process.exit(main());
}
