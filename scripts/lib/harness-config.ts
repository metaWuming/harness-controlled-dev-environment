// scripts/lib/harness-config.ts
//
// Harness canonical config(`scripts/harness.config.json`)的 loader —— PR A2。
//
// 🔴 設計原則(supervisor 拍板、A1.1 r3 教訓):
//   - mode 是**顯式靜態宣告**。這支只讀那個 JSON 檔;不看 git、不看 env、不看
//     package.json、不看任何「像不像模板」的線索。runtime 判別式在 A1.1 證明會判反、
//     同時是斷路器、還 fail-open,已整組移除,不得再引入。
//   - **fail-closed、無 fallback**:檔案不存在、JSON 壞掉、schemaVersion 未知、mode
//     拼錯、欄位型別錯、未知欄位、陣列空 / 重複、分支名不合文法 —— 一律 throw。
//     呼叫端 catch → exit 2(「無法判定」與「未就緒」同等對待)。
//   - **不做正規化**:不 trim、不 lower-case、不去前綴。原值不合法就是不合法。
//
// 分支名字面文法(`assertLiteralBranchName`):config 裡的 protectedBranches /
// deliveryBranches **只接受字面分支名**,不接受 glob、ref、pattern。規則:
//   1. 整串匹配 LITERAL_BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/
//      (首字元英數;其餘只允許英數、`.`、`_`、`/`、`-`)。這條自動拒絕:空字串、
//      空白、tab、控制字元、glob 元字元(* ? [ ] { })、管線 |、引號 ' " `、反斜線、
//      ~ ^ : @、非 ASCII、leading `-`。
//   2. 另外顯式拒絕:含 `..`、含 `//`、以 `/` 結尾、以 `.lock` 結尾、含 `@{`、等於
//      `HEAD`、以 `refs/` / `heads/` / `remotes/` / `origin/` 開頭(ref-prefix 形式;
//      config 要的是分支名不是 ref)。
//   3. 同欄位內精確重複、或 case-fold 後重複(`Main` vs `main`)→ throw
//      (macOS 案例不敏感 FS 上兩者會撞同一個 ref 檔)。
//
// 消費者:scripts/check-adoption-readiness.ts、tests/check-cso-trigger.test.ts。

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const HARNESS_CONFIG_PATH = 'scripts/harness.config.json';
export const HARNESS_SCHEMA_VERSION = 2;

/** 合併策略枚舉(PR A3 P5,schemaVersion 2 必要欄位);CLAUDE.md §4.6 必須以反引號提到宣告值。 */
export const MERGE_STRATEGIES = ['squash', 'merge-commit', 'rebase', 'fast-forward'] as const;
export type MergeStrategy = (typeof MERGE_STRATEGIES)[number];
export const TEMPLATE_PROJECT_ID = '__TEMPLATE__';

export type HarnessMode = 'template' | 'adopted';
export const HARNESS_MODES: readonly HarnessMode[] = ['template', 'adopted'];

/** v1 認得的 agent adapter 名稱。未知名稱 loader 層即 throw。 */
export const KNOWN_ADAPTERS = ['claude', 'codex'] as const;
export type AdapterName = (typeof KNOWN_ADAPTERS)[number];

export interface HarnessConfig {
  schemaVersion: 2;
  mode: HarnessMode;
  projectId: string;
  templatePackageName: string;
  protectedBranches: string[];
  deliveryBranches: string[];
  requiredAgentAdapters: AdapterName[];
  githubGovernanceRequired: boolean;
  mergeStrategy: MergeStrategy;
}

/** 允許出現的 key(`_comment` 是純說明,讀了就丟)。其他 key 一律 fail-closed。 */
const ALLOWED_KEYS = new Set([
  'schemaVersion',
  'mode',
  'projectId',
  'templatePackageName',
  'protectedBranches',
  'deliveryBranches',
  'requiredAgentAdapters',
  'githubGovernanceRequired',
  'mergeStrategy',
  '_comment',
]);

const REQUIRED_KEYS = [
  'schemaVersion',
  'mode',
  'projectId',
  'templatePackageName',
  'protectedBranches',
  'deliveryBranches',
  'requiredAgentAdapters',
  'githubGovernanceRequired',
  'mergeStrategy',
] as const;

export const LITERAL_BRANCH_RE = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/**
 * 字面分支名文法(見檔頭)。回傳 null = 合法;字串 = 違反的規則描述。
 * 純函式,給 loader 與 check-adoption-readiness 的 A5 共用。
 */
export function literalBranchNameViolation(name: unknown): string | null {
  if (typeof name !== 'string') return `必須是字串(收到 ${typeof name})`;
  if (name === '') return '空字串';
  if (!LITERAL_BRANCH_RE.test(name)) {
    return '只允許英數起頭、其餘英數 . _ / -(不接受空白 / 控制字元 / glob / 管線 / 引號 / 非 ASCII)';
  }
  if (name.includes('..')) return '不得含 `..`';
  if (name.includes('//')) return '不得含 `//`';
  if (name.endsWith('/')) return '不得以 `/` 結尾';
  if (name.endsWith('.lock')) return '不得以 `.lock` 結尾';
  if (name.includes('@{')) return '不得含 `@{`';
  if (name === 'HEAD') return '不得是 `HEAD`';
  for (const pfx of ['refs/', 'heads/', 'remotes/', 'origin/']) {
    if (name.startsWith(pfx)) return `不得以 ref 前綴 \`${pfx}\` 開頭(要的是分支名,不是 ref)`;
  }
  return null;
}

export function assertLiteralBranchName(name: unknown, where: string): asserts name is string {
  const v = literalBranchNameViolation(name);
  if (v !== null) {
    throw new Error(`${HARNESS_CONFIG_PATH}:${where} = ${JSON.stringify(name)} 不是合法字面分支名 — ${v}`);
  }
}

function fail(msg: string): never {
  throw new Error(`${HARNESS_CONFIG_PATH}:${msg}`);
}

function assertStringArray(obj: Record<string, unknown>, key: string): string[] {
  const raw = obj[key];
  if (!Array.isArray(raw)) fail(`${key} 必須是陣列(收到 ${raw === null ? 'null' : typeof raw})`);
  if (raw.length === 0) fail(`${key} 不得為空陣列`);
  raw.forEach((v, i) => {
    if (typeof v !== 'string' || v === '') fail(`${key}[${i}] 必須是非空字串(收到 ${JSON.stringify(v)})`);
  });
  const arr = raw as string[];
  const seen = new Set<string>();
  const seenFolded = new Set<string>();
  arr.forEach((v, i) => {
    if (seen.has(v)) fail(`${key}[${i}] = ${JSON.stringify(v)} 重複`);
    const folded = v.toLowerCase();
    if (seenFolded.has(folded)) fail(`${key}[${i}] = ${JSON.stringify(v)} 與另一項只差大小寫(case-fold 重複)`);
    seen.add(v);
    seenFolded.add(folded);
  });
  return arr;
}

/**
 * 純資料 parser:文字 → HarnessConfig,任何不明確一律 throw(契約見檔頭)。
 */
export function parseHarnessConfig(text: string): HarnessConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    fail(`JSON 解析失敗 — ${(e as Error).message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('root 必須是 JSON object');
  }
  const obj = parsed as Record<string, unknown>;

  const unknown = Object.keys(obj).filter((k) => !ALLOWED_KEYS.has(k));
  if (unknown.length > 0) fail(`未知欄位:${unknown.join(', ')}(拼錯或不支援,fail-closed)`);
  for (const k of REQUIRED_KEYS) {
    if (!(k in obj)) fail(`缺必要欄位 ${k}`);
  }

  if (obj.schemaVersion !== HARNESS_SCHEMA_VERSION) {
    const hint = obj.schemaVersion === 1 ? ';schemaVersion 1 → 2 的升級步驟見 docs/MIGRATION.md(加 mergeStrategy 欄位)' : '';
    fail(`schemaVersion 未知(收到 ${JSON.stringify(obj.schemaVersion)},本 loader 只支援 ${HARNESS_SCHEMA_VERSION}${hint})`);
  }
  const mode = obj.mode;
  if (typeof mode !== 'string' || !(HARNESS_MODES as readonly string[]).includes(mode)) {
    fail(`mode 必須是 ${HARNESS_MODES.map((m) => `"${m}"`).join(' | ')}(收到 ${JSON.stringify(mode)})`);
  }
  if (typeof obj.projectId !== 'string' || obj.projectId === '') fail('projectId 必須是非空字串');
  if (typeof obj.templatePackageName !== 'string' || obj.templatePackageName === '') {
    fail('templatePackageName 必須是非空字串');
  }
  if (typeof obj.githubGovernanceRequired !== 'boolean') fail('githubGovernanceRequired 必須是 boolean');
  const mergeStrategy = obj.mergeStrategy;
  if (typeof mergeStrategy !== 'string' || !(MERGE_STRATEGIES as readonly string[]).includes(mergeStrategy)) {
    fail(`mergeStrategy 必須是 ${MERGE_STRATEGIES.map((m) => `"${m}"`).join(' | ')}(收到 ${JSON.stringify(mergeStrategy)})`);
  }

  const protectedBranches = assertStringArray(obj, 'protectedBranches');
  protectedBranches.forEach((b, i) => assertLiteralBranchName(b, `protectedBranches[${i}]`));
  const deliveryBranches = assertStringArray(obj, 'deliveryBranches');
  deliveryBranches.forEach((b, i) => assertLiteralBranchName(b, `deliveryBranches[${i}]`));
  for (const d of deliveryBranches) {
    if (!protectedBranches.includes(d)) {
      fail(`deliveryBranches 含 ${JSON.stringify(d)},但它不在 protectedBranches 內(交付分支必須受保護)`);
    }
  }

  const adapters = assertStringArray(obj, 'requiredAgentAdapters');
  for (const a of adapters) {
    if (!(KNOWN_ADAPTERS as readonly string[]).includes(a)) {
      fail(`requiredAgentAdapters 含未知 adapter ${JSON.stringify(a)}(v1 只認 ${KNOWN_ADAPTERS.join(' / ')})`);
    }
  }

  return {
    schemaVersion: HARNESS_SCHEMA_VERSION,
    mode: mode as HarnessMode,
    projectId: obj.projectId,
    templatePackageName: obj.templatePackageName,
    protectedBranches,
    deliveryBranches,
    requiredAgentAdapters: adapters as AdapterName[],
    githubGovernanceRequired: obj.githubGovernanceRequired,
    mergeStrategy: mergeStrategy as MergeStrategy,
  };
}

/**
 * 從 repo root 讀 config。**檔案不存在 → throw**(不預設 template、不猜 mode)。
 */
export function loadHarnessConfig(root: string): HarnessConfig {
  const p = path.join(root, HARNESS_CONFIG_PATH);
  if (!existsSync(p)) {
    fail('檔案不存在。請建立它並明確選擇 mode("template" 或 "adopted"),見 docs/ADOPTION.md §0');
  }
  return parseHarnessConfig(readFileSync(p, 'utf-8'));
}
