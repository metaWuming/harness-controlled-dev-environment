// scripts/check-control-catalog.ts
//
// Control Catalog conformance checker(PR A3)—— `npm run check:catalog`,CI step「Control Catalog Check」。
//
// 驗的是**對應關係**(loader 只驗資料形狀):
//   1. 每個 implementation / testRefs 路徑都在 `git ls-files` 內(tracked)。
//   2. ci.yml 雙向鎖(位置＋數量,不解析 YAML 結構;只掃 `steps:` 區塊、每個 list item 一條):
//      0. 每個 step 都必須有單行字面 `name:`(`ci.step.unnamed:<line>` / `ci.step.name-unsupported:<line>`;
//         Step 5 r1 C4:無名或 `name: |` 的 step 不能從反向鎖消失);引號會剝掉、未加引號的尾端 `# 註解` 會剝掉
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

export interface CiStepItem {
  line: number;
  /** item 自己的 key 欄位縮排(`- ` 後第一個字元的欄位);只有這一層的 `name:` 算 step 名(Step 5 r2 C-1)。 */
  keyIndent: number;
  name: string | null;
  /** `name: |` / `name: >` / 空值 這類本 checker 不支援的形狀(fail-closed)。 */
  unsupported: string | null;
}

/** 去引號、去尾端 `# 註解`(只對未加引號的值)。回 null = 不支援的形狀。 */
function normalizeStepName(raw: string): { name: string | null; unsupported: string | null } {
  const v = raw.trim();
  if (v === '' || v === '|' || v === '>' || v.startsWith('|') || v.startsWith('>')) return { name: null, unsupported: raw };
  const q = /^"(.*)"\s*(#.*)?$|^'(.*)'\s*(#.*)?$/.exec(v);
  if (q) return { name: (q[1] ?? q[3])!, unsupported: null };
  return { name: v.replace(/\s+#.*$/, ''), unsupported: null };
}

/**
 * 只掃 `steps:` 區塊(縮排判定,不解析 YAML 結構):每個 list item 一條;有 `name:` 就抽名稱、
 * 沒有就登記為 unnamed(Step 5 r1 C4:無名 step 不能從反向鎖消失)。`strategy.matrix` 之類
 * 區塊外的 `- name:` 不算 step(I1)。註解行與空行略過。
 */
export function extractCiSteps(yml: string): CiStepItem[] {
  const lines = yml.split('\n');
  const items: CiStepItem[] = [];
  let stepsIndent = -1;
  let itemIndent = -1;
  let cur: CiStepItem | null = null;
  const flush = () => {
    if (cur) items.push(cur);
    cur = null;
  };
  const setName = (raw: string) => {
    if (!cur) return;
    const n = normalizeStepName(raw);
    cur.name = n.name;
    cur.unsupported = n.unsupported;
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    if (/^\s*(#|$)/.test(raw)) continue;
    const indent = /^\s*/.exec(raw)![0].length;
    const t = raw.trim();
    if (stepsIndent >= 0 && indent <= stepsIndent) {
      flush();
      stepsIndent = -1;
      itemIndent = -1;
    }
    if (stepsIndent < 0) {
      // I-7:`steps:` 後可接註解;`steps: []`(空)也算區塊(0 個 step)
      if (/^steps:(\s*#.*|\s*\[\s*\])?$/.test(t)) stepsIndent = indent;
      continue;
    }
    if (t === '-' || t.startsWith('- ')) {
      if (itemIndent < 0) itemIndent = indent;
      if (indent === itemIndent) {
        flush();
        const rest = t.replace(/^-\s*/, '');
        // key 欄位 = `- ` 與其後空白之後的欄位;`-` 單獨一行時為下一行的縮排(交給後續行判定)
        const keyIndent = t === '-' ? -1 : indent + (t.length - rest.length);
        cur = { line: i + 1, keyIndent, name: null, unsupported: null };
        if (/^name:/.test(rest)) setName(rest.slice('name:'.length));
        continue;
      }
    }
    if (cur && indent > itemIndent) {
      if (cur.keyIndent < 0) cur.keyIndent = indent; // `-` 單獨一行:第一個子行決定 key 欄位
      // 🔴 C-1:只有 item 直屬那一層的 `name:` 才是 step 名;`env:` / `with:` / `run: |` 底下更深的 `name:` 一律不算
      if (indent === cur.keyIndent && /^name:/.test(t)) setName(t.slice('name:'.length));
    }
  }
  flush();
  return items;
}

/** 相容舊介面:只回有名稱的 step(保留重複以便 2a 判定)。 */
export function extractCiStepNames(yml: string): string[] {
  return extractCiSteps(yml).flatMap((s) => (s.name === null ? [] : [s.name]));
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
  const steps = extractCiSteps(yml);
  for (const st of steps) {
    if (st.unsupported !== null) f.push({ code: `ci.step.name-unsupported:${st.line}`, msg: `${CI_YML}:${st.line} 的 name 是本 checker 不支援的形狀(${JSON.stringify(st.unsupported.trim())};請用單行字面)` });
    else if (st.name === null) f.push({ code: `ci.step.unnamed:${st.line}`, msg: `${CI_YML}:${st.line} 的 step 沒有 name:(無名 step 無法登錄 catalog,反向鎖不接受)` });
  }
  const names = steps.flatMap((st) => (st.name === null ? [] : [st.name]));
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
