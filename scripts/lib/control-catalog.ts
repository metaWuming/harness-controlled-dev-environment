// scripts/lib/control-catalog.ts
//
// Control Catalog(`scripts/control-catalog.json`)的 loader —— PR A3。
//
// 定位:把「13 道 gates」改成可稽核的控制措施清單。JSON 是**唯一正本**;
// `docs/CONTROL-CATALOG.md` 由 `scripts/render-control-catalog.ts` 渲染、
// `scripts/check-control-catalog.ts` 驗渲染一致與 ci.yml 雙向鎖。
//
// 🔴 契約(與 harness-config.ts 同一套姿態):
//   - fail-closed、無 fallback、無正規化:未知欄位 / 缺欄位 / 枚舉外值 / ID 重複 /
//     路徑形狀不對 / 陣列空或重複 一律 throw。呼叫端 catch → exit 2。
//   - 本檔**只驗資料形狀與內部一致性**,不碰 git、不讀 ci.yml、不硬編任何 step 名。
//     「路徑是否 tracked」「ciStep 是否存在於 ci.yml」由 checker 驗。
//   - `ciSetupSteps` 是 root 欄位、雙向鎖的**權威豁免清單**:非空、不重複的 step 名;
//     它宣告哪些 ci.yml step 是 setup(不需登錄為 control)。checker 會驗每個名稱在
//     ci.yml 恰出現 1 次,且不得與任何 control 的 ciStep 重疊(把真 gate 列成 setup
//     = 從反向鎖偷走覆蓋,必須紅)。
//   - `implementation` 只准**精確 tracked 檔案路徑**(無目錄、glob、章節、外部名);
//     章節 / anchor / step / 外部工具說明放 `locator`(純人讀,不當路徑驗)。

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const CATALOG_PATH = 'scripts/control-catalog.json';
export const CATALOG_SCHEMA_VERSION = 1;

export const CONTROL_CLASSES = [
  'hard-automated',
  'soft-automated',
  'manual-mandatory',
  'advisory',
  'periodic-governance',
] as const;
export type ControlClass = (typeof CONTROL_CLASSES)[number];

export const TRIGGERS = ['commit', 'push', 'pull_request', 'sop-step', 'schedule', 'manual'] as const;
export type Trigger = (typeof TRIGGERS)[number];
/** 這些 trigger 表示「在 CI 上跑」→ hard-automated 必須綁 ciStep。 */
export const CI_TRIGGERS: readonly Trigger[] = ['push', 'pull_request'];

export const OWNERS = ['agent', 'developer', 'owner', 'github'] as const;
export type Owner = (typeof OWNERS)[number];

export const FAILURE_BEHAVIORS = ['block', 'warn', 'record-only'] as const;
export type FailureBehavior = (typeof FAILURE_BEHAVIORS)[number];

export const TESTED_KINDS = ['unit', 'e2e', 'mutation', 'manual-drill', 'untested'] as const;
export type TestedKind = (typeof TESTED_KINDS)[number];

export const LEGACY_GATES = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬'] as const;
export type LegacyGate = (typeof LEGACY_GATES)[number];

export const CONTROL_ID_RE = /^CTRL-(CI|HOOK|SOP|MEM|GOV|GUARD)-\d{3}$/;

export interface Control {
  id: string;
  name: string;
  legacyGate: LegacyGate | null;
  class: ControlClass;
  triggers: Trigger[];
  implementation: string[];
  locator: string | null;
  ciStep: string | null;
  owner: Owner;
  failureBehavior: FailureBehavior;
  bypass: string;
  evidence: string;
  degradation: string;
  tested: TestedKind[];
  testRefs: string[];
  notes: string | null;
}

export interface ControlCatalog {
  schemaVersion: 1;
  ciSetupSteps: string[];
  controls: Control[];
}

const ROOT_REQUIRED = ['schemaVersion', 'ciSetupSteps', 'controls'] as const;
const ROOT_ALLOWED = new Set<string>([...ROOT_REQUIRED, '_comment']);

const CONTROL_KEYS = [
  'id',
  'name',
  'legacyGate',
  'class',
  'triggers',
  'implementation',
  'locator',
  'ciStep',
  'owner',
  'failureBehavior',
  'bypass',
  'evidence',
  'degradation',
  'tested',
  'testRefs',
  'notes',
] as const;
const CONTROL_KEY_SET = new Set<string>(CONTROL_KEYS);

function fail(msg: string): never {
  throw new Error(`${CATALOG_PATH}:${msg}`);
}

/**
 * 精確 tracked 檔案路徑的**形狀**(是否真的 tracked 由 checker 用 git ls-files 驗)。
 * 拒:空、絕對路徑、`..` 段、glob 元字元、尾 `/`(目錄)、`./` 前綴、反斜線、空白。
 */
export function repoFilePathViolation(p: unknown): string | null {
  if (typeof p !== 'string') return `必須是字串(收到 ${typeof p})`;
  if (p === '') return '空字串';
  if (/\s/.test(p)) return '不得含空白';
  if (p.startsWith('/') || p.startsWith('./') || p.includes('\\')) return '必須是 repo 相對路徑(不以 / 或 ./ 開頭、無反斜線)';
  if (p.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) return '不得含空段、`.` 或 `..` 段';
  if (/[*?[\]{}]/.test(p)) return '不得含 glob 元字元(只准精確檔案路徑)';
  if (p.endsWith('/')) return '不得以 / 結尾(目錄不算實作路徑)';
  return null;
}

function nonEmptyString(v: unknown, where: string): string {
  if (typeof v !== 'string' || v.trim() === '') fail(`${where} 必須是非空字串(收到 ${JSON.stringify(v)})`);
  return v;
}

function stringOrNull(v: unknown, where: string): string | null {
  if (v === null) return null;
  if (typeof v !== 'string' || v.trim() === '') fail(`${where} 必須是非空字串或 null(收到 ${JSON.stringify(v)})`);
  return v;
}

function uniqueStringArray(v: unknown, where: string, allowEmpty: boolean): string[] {
  if (!Array.isArray(v)) fail(`${where} 必須是陣列(收到 ${v === null ? 'null' : typeof v})`);
  if (!allowEmpty && v.length === 0) fail(`${where} 不得為空陣列`);
  const seen = new Set<string>();
  v.forEach((x, i) => {
    if (typeof x !== 'string' || x === '') fail(`${where}[${i}] 必須是非空字串(收到 ${JSON.stringify(x)})`);
    if (seen.has(x)) fail(`${where}[${i}] = ${JSON.stringify(x)} 重複`);
    seen.add(x);
  });
  return v as string[];
}

function enumValue<T extends readonly string[]>(v: unknown, allowed: T, where: string): T[number] {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) {
    fail(`${where} 必須是 ${allowed.map((a) => `"${a}"`).join(' | ')}(收到 ${JSON.stringify(v)})`);
  }
  return v as T[number];
}

function parseControl(raw: unknown, idx: number): Control {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) fail(`controls[${idx}] 必須是 object`);
  const o = raw as Record<string, unknown>;
  const where = `controls[${idx}]`;
  const unknown = Object.keys(o).filter((k) => !CONTROL_KEY_SET.has(k));
  if (unknown.length > 0) fail(`${where} 未知欄位:${unknown.join(', ')}`);
  for (const k of CONTROL_KEYS) if (!(k in o)) fail(`${where} 缺欄位 ${k}(null 也要明寫)`);

  const id = nonEmptyString(o.id, `${where}.id`);
  if (!CONTROL_ID_RE.test(id)) fail(`${where}.id = ${JSON.stringify(id)} 不符 CTRL-<CI|HOOK|SOP|MEM|GOV|GUARD>-NNN`);
  const w = (k: string) => `${id}.${k}`;

  const legacyGate = o.legacyGate === null ? null : enumValue(o.legacyGate, LEGACY_GATES, w('legacyGate'));
  const cls = enumValue(o.class, CONTROL_CLASSES, w('class'));
  const triggers = uniqueStringArray(o.triggers, w('triggers'), false).map((t, i) =>
    enumValue(t, TRIGGERS, `${w('triggers')}[${i}]`)
  );
  const implementation = uniqueStringArray(o.implementation, w('implementation'), false);
  implementation.forEach((p, i) => {
    const v = repoFilePathViolation(p);
    if (v !== null) fail(`${w('implementation')}[${i}] = ${JSON.stringify(p)} — ${v}`);
  });
  const locator = stringOrNull(o.locator, w('locator'));
  const ciStep = stringOrNull(o.ciStep, w('ciStep'));
  const owner = enumValue(o.owner, OWNERS, w('owner'));
  const failureBehavior = enumValue(o.failureBehavior, FAILURE_BEHAVIORS, w('failureBehavior'));
  const bypass = nonEmptyString(o.bypass, w('bypass'));
  const evidence = nonEmptyString(o.evidence, w('evidence'));
  const degradation = nonEmptyString(o.degradation, w('degradation'));
  const tested = uniqueStringArray(o.tested, w('tested'), false).map((t, i) =>
    enumValue(t, TESTED_KINDS, `${w('tested')}[${i}]`)
  );
  const testRefs = uniqueStringArray(o.testRefs, w('testRefs'), true);
  testRefs.forEach((p, i) => {
    const v = repoFilePathViolation(p);
    if (v !== null) fail(`${w('testRefs')}[${i}] = ${JSON.stringify(p)} — ${v}`);
  });
  const notes = stringOrNull(o.notes, w('notes'));

  // ── 內部一致性(純資料層;不需要 git / ci.yml 就能判)
  const onCi = triggers.some((t) => CI_TRIGGERS.includes(t));
  if (cls === 'hard-automated' && onCi) {
    if (ciStep === null) fail(`${id}:hard-automated 且 triggers 含 push / pull_request → ciStep 必填`);
  } else if (ciStep !== null) {
    fail(`${id}:只有 hard-automated 且在 CI 觸發的 control 才可有 ciStep(收到 ${JSON.stringify(ciStep)})`);
  }
  if (cls === 'hard-automated' && bypass === '--no-verify') fail(`${id}:hard-automated 不可能被 --no-verify 繞過(類別寫錯)`);
  if (cls === 'soft-automated' && bypass === 'none') fail(`${id}:soft-automated 的 bypass 不得是 none(本機機制必有繞過路徑)`);
  if (tested.includes('untested') && tested.length > 1) fail(`${id}:tested 含 untested 時不得同時含其他值`);
  if ((tested.includes('unit') || tested.includes('e2e')) && !testRefs.some((r) => r.startsWith('tests/'))) {
    fail(`${id}:tested 含 unit / e2e → testRefs 至少一個 tests/** 路徑`);
  }
  if (tested.includes('mutation') && !testRefs.some((r) => r.startsWith('scripts/mutations/') && r.endsWith('.json'))) {
    fail(`${id}:tested 含 mutation → testRefs 至少一個 scripts/mutations/*.json`);
  }
  if (tested.includes('untested') && testRefs.length > 0) fail(`${id}:untested 不得帶 testRefs`);

  return {
    id,
    name: nonEmptyString(o.name, w('name')),
    legacyGate,
    class: cls,
    triggers,
    implementation,
    locator,
    ciStep,
    owner,
    failureBehavior,
    bypass,
    evidence,
    degradation,
    tested,
    testRefs,
    notes,
  };
}

/** 純資料 parser:文字 → ControlCatalog,任何不明確一律 throw。 */
export function parseControlCatalog(text: string): ControlCatalog {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    fail(`JSON 解析失敗 — ${(e as Error).message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) fail('root 必須是 JSON object');
  const root = parsed as Record<string, unknown>;
  const unknown = Object.keys(root).filter((k) => !ROOT_ALLOWED.has(k));
  if (unknown.length > 0) fail(`root 未知欄位:${unknown.join(', ')}(只准 schemaVersion / ciSetupSteps / controls,外加純說明的 _comment)`);
  for (const k of ROOT_REQUIRED) if (!(k in root)) fail(`root 缺必要欄位 ${k}`);
  if (root.schemaVersion !== CATALOG_SCHEMA_VERSION) {
    fail(`schemaVersion 未知(收到 ${JSON.stringify(root.schemaVersion)},本 loader 只支援 ${CATALOG_SCHEMA_VERSION})`);
  }
  const ciSetupSteps = uniqueStringArray(root.ciSetupSteps, 'ciSetupSteps', false);
  if (!Array.isArray(root.controls)) fail('controls 必須是陣列');
  if (root.controls.length === 0) fail('controls 不得為空');
  const controls = root.controls.map((c, i) => parseControl(c, i));
  const ids = new Set<string>();
  for (const c of controls) {
    if (ids.has(c.id)) fail(`control id ${c.id} 重複`);
    ids.add(c.id);
  }
  const steps = new Set<string>();
  for (const c of controls) {
    if (c.ciStep === null) continue;
    if (steps.has(c.ciStep)) fail(`ciStep ${JSON.stringify(c.ciStep)} 被多條 control 引用(一 step 一 control)`);
    steps.add(c.ciStep);
    if (ciSetupSteps.includes(c.ciStep)) fail(`${c.id}.ciStep ${JSON.stringify(c.ciStep)} 同時列在 ciSetupSteps(把 gate 當 setup = 從反向鎖偷走覆蓋)`);
  }
  return { schemaVersion: CATALOG_SCHEMA_VERSION, ciSetupSteps, controls };
}

/** 從 repo root 讀 catalog;缺檔 → throw(無預設)。 */
export function loadControlCatalog(root: string): ControlCatalog {
  const p = path.join(root, CATALOG_PATH);
  if (!existsSync(p)) fail('檔案不存在(control catalog 是 CI gate 的正本,缺檔 = 無法判定)');
  return parseControlCatalog(readFileSync(p, 'utf-8'));
}
