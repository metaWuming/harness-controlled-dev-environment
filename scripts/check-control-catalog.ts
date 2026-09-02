// scripts/check-control-catalog.ts
//
// Control Catalog conformance checker(PR A3)—— `npm run check:catalog`,CI step「Control Catalog Check」。
//
// 驗的是**對應關係**(loader 只驗資料形狀):
//   1. 每個 implementation / testRefs 路徑都在 `git ls-files` 內(tracked)。
//   2. ci.yml 雙向鎖(位置＋數量,不解析 YAML 結構,只抽 `- name:` 行):
//      a. ci.yml 每個 step 名恰出現 1 次(`ci.step.duplicate:<name>`)
//      b. ciSetupSteps 每個名稱必須存在於 ci.yml(`catalog.setup.missing:<name>`)
//      c. ciSetupSteps 與所有 control 的 ciStep 交集為空(`catalog.setup.shadows-gate:<name>`;loader 已擋,此處再驗一次)
//      d. hard-automated 且在 CI 觸發的 control,其 ciStep 必須存在於 ci.yml(`catalog.ciStep.missing:<id>:<step>`)
//      e. ci.yml 的 step 名 − ciSetupSteps − 所有 ciStep 必須為空(`ci.step.unregistered:<name>`)
//      f. checker 內**沒有任何硬編 step 名**;豁免只來自 JSON 的 ciSetupSteps
//   3. `docs/CONTROL-CATALOG.md` 與 renderCatalog(json) 逐位元組相同(`catalog.doc.drift`)
//
// Exit:0 = 全過;**2 = 任一 fail 或無法判定**(catalog 缺 / 壞、ci.yml 讀不到、argv 錯、git 取不到)。
// 刻意無 exit 1(同 check-adoption-readiness / check-cso-trigger 契約)。
//
// Usage:
//   npx tsx scripts/check-control-catalog.ts              # repo root
//   npx tsx scripts/check-control-catalog.ts --root=<dir>  # e2e fixture

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { CI_TRIGGERS, loadControlCatalog, type ControlCatalog } from './lib/control-catalog';
import { CATALOG_DOC_PATH, renderCatalog } from './render-control-catalog';

export const CI_YML = '.github/workflows/ci.yml';

export interface CatalogIo {
  readText(rel: string): string | null;
  trackedFiles(): string[];
}

export interface CatalogFinding {
  code: string;
  msg: string;
}

/** 從 ci.yml 抽全部 `- name:` 行(trim 後名稱;保留重複以便 2a 判定)。 */
export function extractCiStepNames(yml: string): string[] {
  const out: string[] = [];
  for (const line of yml.split('\n')) {
    const m = /^\s*- name:\s*(.+?)\s*$/.exec(line);
    if (m) out.push(m[1]!);
  }
  return out;
}

export function checkCatalogConformance(catalog: ControlCatalog, io: CatalogIo): CatalogFinding[] {
  const f: CatalogFinding[] = [];
  const tracked = new Set(io.trackedFiles());

  // 1. 路徑 tracked
  for (const c of catalog.controls) {
    for (const p of c.implementation) {
      if (!tracked.has(p)) f.push({ code: `catalog.path.untracked:${c.id}:${p}`, msg: `${c.id} 的 implementation ${p} 不在 git ls-files 內` });
    }
    for (const p of c.testRefs) {
      if (!tracked.has(p)) f.push({ code: `catalog.path.untracked:${c.id}:${p}`, msg: `${c.id} 的 testRefs ${p} 不在 git ls-files 內` });
    }
  }

  // 2. ci.yml 雙向鎖
  const yml = io.readText(CI_YML);
  if (yml === null) {
    f.push({ code: 'ci.unreadable', msg: `${CI_YML} 讀不到` });
    return f;
  }
  const names = extractCiStepNames(yml);
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const n of names) {
    if (seen.has(n)) dup.add(n);
    seen.add(n);
  }
  for (const n of dup) f.push({ code: `ci.step.duplicate:${n}`, msg: `${CI_YML} 的 step 名 ${JSON.stringify(n)} 出現多次` });
  const ciSteps = new Map<string, string>(); // step -> control id
  for (const c of catalog.controls) if (c.ciStep !== null) ciSteps.set(c.ciStep, c.id);
  for (const s of catalog.ciSetupSteps) {
    if (!seen.has(s)) f.push({ code: `catalog.setup.missing:${s}`, msg: `ciSetupSteps 的 ${JSON.stringify(s)} 不存在於 ${CI_YML}` });
    if (ciSteps.has(s)) f.push({ code: `catalog.setup.shadows-gate:${s}`, msg: `ciSetupSteps 的 ${JSON.stringify(s)} 同時是 ${ciSteps.get(s)} 的 ciStep(把 gate 當 setup)` });
  }
  for (const c of catalog.controls) {
    const onCi = c.triggers.some((t) => CI_TRIGGERS.includes(t));
    if (c.class === 'hard-automated' && onCi) {
      if (c.ciStep === null || !seen.has(c.ciStep)) {
        f.push({ code: `catalog.ciStep.missing:${c.id}:${c.ciStep ?? 'null'}`, msg: `${c.id} 宣告 hard-automated 但 ciStep ${JSON.stringify(c.ciStep)} 不存在於 ${CI_YML}` });
      }
    }
  }
  const setup = new Set(catalog.ciSetupSteps);
  for (const n of seen) {
    if (!setup.has(n) && !ciSteps.has(n)) f.push({ code: `ci.step.unregistered:${n}`, msg: `${CI_YML} 的 step ${JSON.stringify(n)} 既不是 ciSetupSteps 也沒有任何 control 登錄它` });
  }

  // 3. 渲染一致
  const doc = io.readText(CATALOG_DOC_PATH);
  if (doc === null) f.push({ code: 'catalog.doc.missing', msg: `${CATALOG_DOC_PATH} 讀不到(跑 npm run catalog:render)` });
  else if (doc !== renderCatalog(catalog)) f.push({ code: 'catalog.doc.drift', msg: `${CATALOG_DOC_PATH} 與 JSON 渲染結果不一致(改 JSON 後跑 npm run catalog:render;不要手改 md)` });

  return f;
}

export function buildRealIo(root: string): CatalogIo {
  let tracked: string[] | null = null;
  return {
    readText: (rel) => {
      try {
        return readFileSync(path.join(root, rel), 'utf-8');
      } catch {
        return null;
      }
    },
    trackedFiles: () => {
      if (tracked === null) tracked = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf-8' }).split('\0').filter(Boolean);
      return tracked;
    },
  };
}

function main(): number {
  const argv = process.argv.slice(2);
  const rootArgs = argv.filter((a) => a.startsWith('--root='));
  const unknown = argv.filter((a) => !a.startsWith('--root='));
  if (unknown.length > 0 || rootArgs.length > 1 || (rootArgs.length === 1 && rootArgs[0] === '--root=')) {
    console.error(`❌ 參數錯誤:${argv.join(' ')}(只接受單一 --root=<dir>;fail-closed exit 2)`);
    return 2;
  }
  const root = rootArgs[0] ? path.resolve(rootArgs[0].slice('--root='.length)) : execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
  let catalog: ControlCatalog;
  try {
    catalog = loadControlCatalog(root);
  } catch (e) {
    console.error(`❌ ${(e as Error).message}`);
    console.error('CATALOG_FAIL — catalog 無法載入(exit 2)');
    return 2;
  }
  let findings: CatalogFinding[];
  try {
    findings = checkCatalogConformance(catalog, buildRealIo(root));
  } catch (e) {
    console.error(`❌ ${(e as Error).message}`);
    console.error('CATALOG_FAIL — 無法判定(exit 2)');
    return 2;
  }
  const stepCount = extractCiStepNames(buildRealIo(root).readText(CI_YML) ?? '').length;
  if (findings.length === 0) {
    console.log(`CATALOG_OK — ${catalog.controls.length} controls;${CI_YML} ${stepCount} steps(setup ${catalog.ciSetupSteps.length})雙向對應;${CATALOG_DOC_PATH} 與 JSON 一致`);
    return 0;
  }
  console.log(`CATALOG_FAIL (${findings.length}):`);
  for (const x of findings) console.log(`  [${x.code}] ${x.msg}`);
  return 2;
}

const invokedPath = process.argv[1];
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  process.exit(main());
}
