// scripts/check-adoption-readiness.ts
//
// Adoption Readiness Gate(PR A2)。消除「測試全綠但其實還沒導入完成」的假安全感。
//
// mode 來自 `scripts/harness.config.json` 的**顯式靜態宣告**(見 scripts/lib/harness-config.ts
// 檔頭:無偵測、無 fallback、無 env override)。本檔依宣告的 mode 跑兩張不同的檢查表:
//
//   template mode(本模板 repo 自身):T1–T9。允許出廠 placeholder 存在,但**必須逐條印成
//     `template exception`**,不能假裝完成;首行固定 `TEMPLATE_MODE — adoption checks NOT
//     applied`,**不印 READY**。T8 / T9 是模板作者自己的簿記檢查(從 vitest 搬來,adopted
//     repo 不跑)。
//   adopted mode(已導入的下游專案):A1–A8,對每個 placeholder / 空表 / 骨架 / 缺檔
//     fail-closed。全過才印 `ADOPTED_MODE — READY`。
//
// Exit codes:**0 = READY**(template 含 exception 也算)/ **2 = NOT_READY 或無法判定**
//   (config 缺 / malformed / mode 未知 / argv 未知 / 讀檔失敗)。刻意沒有 exit 1,理由同
//   check-cso-trigger.ts:「無法判定」若回 1,比對 `=== 2` 的呼叫端會讀成「不需要」= fail-open。
//
// Usage:
//   npx tsx scripts/check-adoption-readiness.ts              # 對 repo root
//   npx tsx scripts/check-adoption-readiness.ts --root=<dir>  # 對指定 root(e2e fixture 用)
//
// 每條檢查 = 一個 export 的純函式(注入 I/O),dispatch 表 TEMPLATE_CHECKS / ADOPTED_CHECKS
// 也是 export 的純資料 —— 讓 e2e 與 mutation 探針有明確攻擊點。
//
// 刻意不做的事(縮小攻擊面):不解析 shell / YAML 結構(只在已知行抽 token)、不改任何
// hook、不讀 `check-cso-trigger.ts`(它的空表 exit 2 契約不變)、不重跑 source-term gate
// (CI 既有 step 承接)。

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { detectInvocation, reportIfNotMain } from './lib/invoked-as-main';
import {
  HARNESS_CONFIG_PATH,
  KNOWN_ADAPTERS,
  TEMPLATE_PROJECT_ID,
  literalBranchNameViolation,
  loadHarnessConfig,
  type AdapterName,
  type HarnessConfig,
} from './lib/harness-config';
import { checkAdrRefPlacement, checkNoPersonalPaths } from './lib/template-governance';
import type { CsoDomain } from './cso-trigger.config';

// ───────────────────────────────────────── 型別

export interface Finding {
  id: string;
  kind: 'fail' | 'exception' | 'info';
  msg: string;
}

export interface CheckerIo {
  /** 讀 repo-relative 文字檔;不存在 / 讀不到回 null。 */
  readText(rel: string): string | null;
  exists(rel: string): boolean;
  isDir(rel: string): boolean;
  /** `git ls-files` 結果(repo-relative)。 */
  trackedFiles(): string[];
  csoPatterns: { domain: CsoDomain; pattern: RegExp }[];
  csoNotApplicable: { domain: CsoDomain; reason: string }[];
  /** `package.json` 解析結果;讀不到 / 壞掉回 null。 */
  packageJson: { name?: unknown; scripts?: unknown } | null;
}

export type Check = (cfg: HarnessConfig, io: CheckerIo) => Finding[];

const CSO_DOMAINS: readonly CsoDomain[] = ['金流', 'PII', '權限/IDOR/資產轉移', 'audit-trail', '橫切保守項'];
const DESTRUCTIVE_GUARD = 'scripts/lib/destructive-guard.ts';
const DESTRUCTIVE_PLACEHOLDERS = ['PROJECT_DESTRUCTIVE_OK', 'PROJECT-PROD'] as const;
const CI_YML = '.github/workflows/ci.yml';
const CI_ADOPTION_LINE = 'run: npm run check:adoption';
const PROGRESS = '.claude/memory/progress.md';
const PRE_COMMIT = 'scripts/git-hooks/pre-commit';
const PRE_PUSH = 'scripts/git-hooks/pre-push';
/** ci.yml push 分支清單裡唯一允許的 glob(出廠值)。其他任何 glob 一律 fail。 */
export const CI_PUSH_GLOB_ALLOWLIST: readonly string[] = ['feature/**'];

function fail(id: string, msg: string): Finding {
  return { id, kind: 'fail', msg };
}
function exception(id: string, msg: string): Finding {
  return { id, kind: 'exception', msg };
}
function info(id: string, msg: string): Finding {
  return { id, kind: 'info', msg };
}
function isTracked(io: CheckerIo, rel: string): boolean {
  return io.trackedFiles().includes(rel);
}

// ───────────────────────────────────────── CLAUDE.md Part 4 parser(2.5)

export type Part4Id = '4.1' | '4.2' | '4.3' | '4.4' | '4.5' | '4.6';
export const PART4_IDS: readonly Part4Id[] = ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6'];
/** adopted mode 必要段(D7:4.2 明文可刪、4.4 上線前常無值)。 */
export const PART4_REQUIRED: readonly Part4Id[] = ['4.1', '4.3', '4.5', '4.6'];

export interface Part4Section {
  id: Part4Id;
  /** 原文(含註解)。 */
  raw: string;
  /** 去掉 `<!-- … -->` 後的內容(trim)。 */
  body: string;
  hasFillMarker: boolean;
  state: 'skeleton' | 'content';
}

export const FILL_MARKER = '<!-- 填';
export const PLACEHOLDER_RE = /^(TBD|TODO|待填|待補|待定|N\/?A|xxx+|\.{3}|…|<[^>]*>)$/i;

/** 切出 `### 4.x` 六段;段 = 標題到下一個 `### ` / `## ` / `---`。缺的段不會出現在 Map。 */
export function parsePart4(md: string): Map<Part4Id, Part4Section> {
  const out = new Map<Part4Id, Part4Section>();
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = /^### (4\.[1-6])\b/.exec(lines[i]!);
    if (!m) continue;
    const id = m[1] as Part4Id;
    let j = i + 1;
    while (j < lines.length && !/^(### |## |---\s*$)/.test(lines[j]!)) j++;
    const raw = lines.slice(i + 1, j).join('\n');
    const body = raw.replace(/<!--[\s\S]*?-->/g, '').trim();
    const hasFillMarker = raw.includes(FILL_MARKER);
    out.set(id, {
      id,
      raw,
      body,
      hasFillMarker,
      state: body === '' && hasFillMarker ? 'skeleton' : 'content',
    });
    i = j - 1;
  }
  return out;
}

function backtickTokens(line: string): string[] {
  const out: string[] = [];
  const re = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) out.push(m[1]!);
  return out;
}

/** A2 的四段規則(全部交叉比對 repo / config / package.json;散文不算數)。 */
export function checkPart4Content(cfg: HarnessConfig, io: CheckerIo): Finding[] {
  const md = io.readText('CLAUDE.md');
  if (md === null) return [fail('A2', 'CLAUDE.md 讀不到')];
  const secs = parsePart4(md);
  const out: Finding[] = [];
  for (const id of PART4_REQUIRED) {
    const s = secs.get(id);
    if (!s) {
      out.push(fail(`A2.${id}`, `CLAUDE.md 缺 ### ${id} 段`));
      continue;
    }
    if (s.hasFillMarker) out.push(fail(`A2.${id}`, `### ${id} 仍含出廠標記 \`${FILL_MARKER}\`(填完要刪掉註解)`));
    if (s.body === '') {
      out.push(fail(`A2.${id}`, `### ${id} 去掉註解後沒有內容`));
      continue;
    }
    const bodyLines = s.body.split('\n');
    switch (id) {
      case '4.1': {
        for (const key of ['語言', '框架', '資料庫', '部署']) {
          const hits = bodyLines.filter((l) => new RegExp(`^- ${key}[:：]`).test(l));
          if (hits.length !== 1) {
            out.push(fail('A2.4.1', `### 4.1 需要恰 1 行 \`- ${key}：<值>\`(找到 ${hits.length} 行)`));
            continue;
          }
          const val = hits[0]!.replace(new RegExp(`^- ${key}[:：]\\s*`), '').trim();
          if (val === '' || PLACEHOLDER_RE.test(val)) {
            out.push(fail('A2.4.1', `### 4.1 \`${key}\` 的值是空或 placeholder(${JSON.stringify(val)})`));
          }
        }
        break;
      }
      case '4.3': {
        const scripts = new Set<string>();
        for (const l of bodyLines) {
          for (const t of backtickTokens(l)) {
            const m = /^npm run ([A-Za-z0-9:_-]+)$/.exec(t);
            if (m) scripts.add(m[1]!);
          }
        }
        if (scripts.size < 3) {
          out.push(fail('A2.4.3', `### 4.3 需要 ≥3 個不同的 \`npm run <script>\` 引用(找到 ${scripts.size})`));
        }
        const pkgScripts = io.packageJson?.scripts;
        const have =
          pkgScripts && typeof pkgScripts === 'object' && !Array.isArray(pkgScripts)
            ? new Set(Object.keys(pkgScripts as Record<string, unknown>))
            : null;
        if (have === null) {
          out.push(fail('A2.4.3', 'package.json 的 scripts 讀不到,無法交叉比對 ### 4.3'));
        } else {
          for (const s of scripts) {
            if (!have.has(s)) out.push(fail('A2.4.3', `### 4.3 引用 \`npm run ${s}\`,但 package.json.scripts 沒有 ${s}`));
          }
        }
        for (const must of ['typecheck', 'lint', 'test']) {
          if (!scripts.has(must)) out.push(fail('A2.4.3', `### 4.3 必須引用 \`npm run ${must}\``));
        }
        break;
      }
      case '4.5': {
        const bullets = bodyLines.filter((l) => /^- /.test(l));
        if (bullets.length < 2) out.push(fail('A2.4.5', `### 4.5 需要 ≥2 個 bullet(找到 ${bullets.length})`));
        const tracked = new Set(io.trackedFiles());
        for (const b of bullets) {
          const toks = backtickTokens(b);
          if (toks.length === 0) {
            out.push(fail('A2.4.5', `### 4.5 bullet 沒有反引號路徑:${b}`));
            continue;
          }
          for (const t of toks) {
            const bare = t.replace(/\/$/, '');
            const ok =
              tracked.has(bare) ||
              io.isDir(bare) ||
              /^\.env/.test(t) ||
              t === '.claude/settings.local.json';
            if (!ok) out.push(fail('A2.4.5', `### 4.5 的 \`${t}\` 不是 tracked 檔、存在的目錄、.env* 或 settings.local.json`));
          }
        }
        break;
      }
      case '4.6': {
        for (const b of [...cfg.protectedBranches, ...cfg.deliveryBranches]) {
          if (!s.body.includes(`\`${b}\``)) {
            out.push(fail('A2.4.6', `### 4.6 必須以反引號提到 config 宣告的分支 \`${b}\``));
          }
        }
        // PR A3 P5:合併策略改宣告式——harness.config.mergeStrategy 是正本,4.6 只驗有沒有以反引號提到它
        // (A2 Step 5 三輪證明關鍵字 regex 是固有邊界:否定句 / URL / 時態變體都是邊角,不再打補丁)。
        if (!s.body.includes(`\`${cfg.mergeStrategy}\``)) {
          out.push(fail('A2.4.6', `### 4.6 必須以反引號提到 harness.config 宣告的合併策略 \`${cfg.mergeStrategy}\``));
        }
        break;
      }
    }
  }
  return out;
}

// ───────────────────────────────────────── 共用純檢查

/** A3(與 tests/check-cso-trigger.test.ts 的 always-on 鎖共用):五域各恰一種處置。 */
export function checkCsoDomainDisposition(
  patterns: { domain: CsoDomain; pattern: RegExp }[],
  notApplicable: { domain: CsoDomain; reason: string }[]
): Finding[] {
  const out: Finding[] = [];
  if (patterns.length === 0) {
    out.push(fail('A3', '路徑表整體為空 → check:cso 會永遠 fail-closed(exit 2);至少要有一條 pattern'));
  }
  const seenNa = new Set<string>();
  for (const na of notApplicable) {
    if (!CSO_DOMAINS.includes(na.domain)) out.push(fail('A3', `CSO_NOT_APPLICABLE 含未知域 ${JSON.stringify(na.domain)}`));
    if (seenNa.has(na.domain)) out.push(fail('A3', `CSO_NOT_APPLICABLE 重複宣告域「${na.domain}」`));
    seenNa.add(na.domain);
    if (typeof na.reason !== 'string' || na.reason.replace(/\s/g, '').length < 10) {
      out.push(fail('A3', `域「${na.domain}」的 notApplicable reason 太短(去空白需 ≥10 字)`));
    }
  }
  for (const d of CSO_DOMAINS) {
    const hasPattern = patterns.some((p) => p.domain === d);
    const hasNa = seenNa.has(d);
    if (hasPattern && hasNa) out.push(fail('A3', `域「${d}」同時有 pattern 又宣告 notApplicable(矛盾)`));
    if (!hasPattern && !hasNa) out.push(fail('A3', `域「${d}」未處置:填 pattern 或在 CSO_NOT_APPLICABLE 宣告 + 理由`));
  }
  return out;
}

function checkCiRunsAdoption(id: string): Check {
  return (_cfg, io) => {
    const yml = io.readText(CI_YML);
    if (yml === null) return [fail(id, `${CI_YML} 讀不到`)];
    const n = yml.split('\n').filter((l) => l.trim() === CI_ADOPTION_LINE).length;
    return n === 1 ? [] : [fail(id, `${CI_YML} 需要恰 1 行 \`${CI_ADOPTION_LINE}\`(找到 ${n})`)];
  };
}

// ───────────────────────────────────────── Template mode T1–T9

export const checkTemplateProjectId: Check = (cfg) =>
  cfg.projectId === TEMPLATE_PROJECT_ID
    ? []
    : [fail('T1', `template mode 的 projectId 必須是 ${TEMPLATE_PROJECT_ID}(收到 ${JSON.stringify(cfg.projectId)})`)];

export const checkTemplatePackageName: Check = (cfg, io) => {
  const name = io.packageJson?.name;
  if (name === cfg.templatePackageName) return [];
  return [
    fail(
      'T2',
      `package.json.name ${JSON.stringify(name)} ≠ config.templatePackageName ${JSON.stringify(cfg.templatePackageName)}。` +
        `你已經改了專案名卻仍宣告 mode=template —— 請把 mode 改成 adopted(docs/ADOPTION.md §0)`
    ),
  ];
};

export const checkTemplateCsoEmpty: Check = (_cfg, io) => {
  if (io.csoPatterns.length > 0 || io.csoNotApplicable.length > 0) {
    return [fail('T3', 'template mode 的 CSO 路徑表與 CSO_NOT_APPLICABLE 必須都為空(模板不該帶專案路徑)')];
  }
  return [exception('T3', 'CSO path table empty(尚未導入;check:cso 對本 repo fail-closed exit 2 是設計)')];
};

export const checkTemplateDestructivePlaceholders: Check = (_cfg, io) => {
  const src = io.readText(DESTRUCTIVE_GUARD);
  if (src === null) return [fail('T4', `${DESTRUCTIVE_GUARD} 讀不到`)];
  const missing = DESTRUCTIVE_PLACEHOLDERS.filter((p) => !src.includes(p));
  if (missing.length > 0) return [fail('T4', `template mode 的 ${DESTRUCTIVE_GUARD} 應保留出廠 placeholder,缺 ${missing.join(', ')}`)];
  return [exception('T4', 'destructive guard placeholders (template-only)')];
};

export const checkTemplatePart4Skeleton: Check = (_cfg, io) => {
  const md = io.readText('CLAUDE.md');
  if (md === null) return [fail('T5', 'CLAUDE.md 讀不到')];
  const secs = parsePart4(md);
  const out: Finding[] = [];
  for (const id of PART4_IDS) {
    const s = secs.get(id);
    if (!s) {
      out.push(fail('T5', `CLAUDE.md 缺 ### ${id} 段`));
      continue;
    }
    if (id === '4.6') {
      if (!s.hasFillMarker) out.push(fail('T5', `template mode 的 ### 4.6 應保留 \`${FILL_MARKER}\` 標記`));
    } else if (s.state !== 'skeleton') {
      out.push(fail('T5', `template mode 的 ### ${id} 應是骨架(只有註解),現在有內容`));
    }
  }
  return out.length > 0 ? out : [exception('T5', 'CLAUDE.md Part 4 skeleton')];
};

export const checkTemplateSourceTermInfo: Check = () => [
  info('T7', 'source-term gate 由 CI 既有 Source-term scan step 驗證(本 checker 不重跑)'),
];

export const checkTemplateNoPersonalPaths: Check = (_cfg, io) => {
  const text = io.readText(PROGRESS);
  if (text === null) return [fail('T8', `${PROGRESS} 讀不到`)];
  return checkNoPersonalPaths(text).map((m) => fail('T8', `${PROGRESS} ${m}`));
};

export const checkTemplateAdrRefs: Check = (_cfg, io) =>
  checkAdrRefPlacement({ trackedFiles: () => io.trackedFiles(), readText: (r) => io.readText(r) }).map((m) =>
    fail('T9', m)
  );

export const TEMPLATE_CHECKS: readonly Check[] = [
  checkTemplateProjectId,
  checkTemplatePackageName,
  checkTemplateCsoEmpty,
  checkTemplateDestructivePlaceholders,
  checkTemplatePart4Skeleton,
  checkCiRunsAdoption('T6'),
  checkTemplateSourceTermInfo,
  checkTemplateNoPersonalPaths,
  checkTemplateAdrRefs,
];

// ───────────────────────────────────────── Adopted mode A1–A8

export const checkAdoptedProjectId: Check = (cfg) => {
  const id = cfg.projectId;
  if (id === TEMPLATE_PROJECT_ID) return [fail('A1', `projectId 仍是 sentinel ${TEMPLATE_PROJECT_ID}`)];
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(id)) {
    return [fail('A1', `projectId ${JSON.stringify(id)} 需符合 /^[a-z0-9][a-z0-9-]{1,63}$/`)];
  }
  for (const w of ['template', 'placeholder', 'project']) {
    if (id.includes(w)) return [fail('A1', `projectId ${JSON.stringify(id)} 不得含 "${w}"(像 placeholder)`)];
  }
  return [];
};

export const checkAdoptedCso: Check = (_cfg, io) => checkCsoDomainDisposition(io.csoPatterns, io.csoNotApplicable);

export const checkNoDestructivePlaceholders: Check = (_cfg, io) => {
  const src = io.readText(DESTRUCTIVE_GUARD);
  if (src === null) return [fail('A4', `${DESTRUCTIVE_GUARD} 讀不到`)];
  return DESTRUCTIVE_PLACEHOLDERS.filter((p) => src.includes(p)).map((p) =>
    fail('A4', `${DESTRUCTIVE_GUARD} 仍含出廠 placeholder ${p}(改成你的專案名,docs/ADOPTION.md §5)`)
  );
};

// ── A5:分支政策集合精確相等(2.6)。只在已知行抽 token;來源 token 也過字面文法。

type SourceSet = { ok: true; names: string[] } | { ok: false; findings: Finding[] };

function validateSourceTokens(id: string, tokens: string[]): SourceSet {
  const findings: Finding[] = [];
  for (const t of tokens) {
    const v = literalBranchNameViolation(t);
    if (v !== null) findings.push(fail(`${id}.grammar`, `來源 token ${JSON.stringify(t)} 不是合法字面分支名 — ${v}`));
  }
  const seen = new Set<string>();
  for (const t of tokens) {
    if (seen.has(t)) findings.push(fail(`${id}.grammar`, `來源重複 ${JSON.stringify(t)}`));
    seen.add(t);
  }
  return findings.length > 0 ? { ok: false, findings } : { ok: true, names: tokens };
}

function compareSets(id: string, label: string, got: string[], expected: string[]): Finding[] {
  const g = new Set(got);
  const e = new Set(expected);
  const extras = [...g].filter((x) => !e.has(x)).sort();
  const missing = [...e].filter((x) => !g.has(x)).sort();
  if (extras.length === 0 && missing.length === 0) return [];
  return [
    fail(
      id,
      `${label} 的分支集合 ${JSON.stringify([...g].sort())} ≠ config.protectedBranches ${JSON.stringify([...e].sort())}` +
        (extras.length ? `;多出 ${JSON.stringify(extras)}` : '') +
        (missing.length ? `;缺 ${JSON.stringify(missing)}` : '')
    ),
  ];
}

export function extractPreCommitBranches(src: string): SourceSet {
  const lines = src.split('\n');
  const start = lines.findIndex((l) => /^case "\$branch" in\s*$/.test(l));
  const end = start === -1 ? -1 : lines.findIndex((l, i) => i > start && /^esac\s*$/.test(l));
  if (start === -1 || end === -1) return { ok: false, findings: [fail('A5.pre-commit', `${PRE_COMMIT} 找不到 case "$branch" in … esac 區塊`)] };
  const hits = lines.slice(start + 1, end).map((l) => /^\s+([^)]+)\) ;;$/.exec(l)).filter((m): m is RegExpExecArray => !!m);
  if (hits.length !== 1) return { ok: false, findings: [fail('A5.pre-commit', `${PRE_COMMIT} case 區塊需恰 1 行 \`<branches>) ;;\`(找到 ${hits.length})`)] };
  return validateSourceTokens('A5.pre-commit', hits[0]![1]!.split('|'));
}

export function extractPrePushBranches(src: string): SourceSet {
  const hits = src
    .split('\n')
    .map((l) => /^\s+(.+?)\) _is_protected=1 ;;$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m);
  if (hits.length !== 1) return { ok: false, findings: [fail('A5.pre-push', `${PRE_PUSH} 需恰 1 行 \`<refs>) _is_protected=1 ;;\`(找到 ${hits.length})`)] };
  const raw = hits[0]![1]!.split('|').map((t) => t.trim());
  const findings: Finding[] = [];
  const names: string[] = [];
  for (const t of raw) {
    if (!t.startsWith('refs/heads/')) {
      findings.push(fail('A5.pre-push.grammar', `來源 token ${JSON.stringify(t)} 不是 refs/heads/<name> 形式`));
      continue;
    }
    names.push(t.slice('refs/heads/'.length));
  }
  if (findings.length > 0) return { ok: false, findings };
  return validateSourceTokens('A5.pre-push', names);
}

/** 從 ci.yml 的 `on:` 底下抽 push / pull_request 各自的 `branches: [...]` 行(各恰 1 行)。 */
export function extractCiBranches(src: string): { push: SourceSet; pullRequest: SourceSet; pushGlobInfo: string[] } {
  const lines = src.split('\n');
  let current: 'push' | 'pull_request' | null = null;
  const found: Record<'push' | 'pull_request', string[]> = { push: [], pull_request: [] };
  for (const l of lines) {
    const ev = /^\s{2}(push|pull_request):\s*$/.exec(l);
    if (ev) {
      current = ev[1] as 'push' | 'pull_request';
      continue;
    }
    if (/^\S/.test(l) || /^\s{2}\S/.test(l)) {
      // 回到 on: 的其他子鍵或頂層 → 離開目前 event 區塊
      if (!ev) current = null;
    }
    const b = /^\s+branches:\s*\[(.*)\]\s*$/.exec(l);
    if (b && current) found[current].push(b[1]!);
  }
  const pushGlobInfo: string[] = [];
  const parse = (id: string, rows: string[], allowGlob: boolean): SourceSet => {
    if (rows.length !== 1) return { ok: false, findings: [fail(id, `${CI_YML} 對應 event 需恰 1 行 \`branches: [...]\`(找到 ${rows.length})`)] };
    const items = rows[0]!.split(',').map((s) => s.trim()).filter((s) => s !== '');
    const findings: Finding[] = [];
    const names: string[] = [];
    for (const item of items) {
      let v = item;
      if ((v.startsWith("'") && v.endsWith("'")) || (v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1);
      if (allowGlob && CI_PUSH_GLOB_ALLOWLIST.includes(v)) {
        pushGlobInfo.push(v);
        continue;
      }
      const viol = literalBranchNameViolation(v);
      if (viol !== null) {
        findings.push(fail(`${id}.grammar`, `來源 token ${JSON.stringify(item)} 不是合法字面分支名 — ${viol}`));
        continue;
      }
      names.push(v);
    }
    if (findings.length > 0) return { ok: false, findings };
    return validateSourceTokens(id, names);
  };
  return { push: parse('A5.ci.push', found.push, true), pullRequest: parse('A5.ci.pull_request', found.pull_request, false), pushGlobInfo };
}

/** A5.ci.if(PR A3 P4):三處 delivery-branch `if:` 行必須逐字等於由 deliveryBranches 導出的期望行。 */
export const CI_IF_PREFIX = "if: github.event_name != 'push' || github.ref == format('refs/heads/{0}', github.event.repository.default_branch)";
export const CI_IF_EXPECTED_COUNT = 3;
export function expectedCiIfLine(deliveryBranches: string[]): string {
  return CI_IF_PREFIX + deliveryBranches.map((b) => ` || github.ref == 'refs/heads/${b}'`).join('');
}
export function extractCiIfLines(yml: string): string[] {
  return yml
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith("if: github.event_name != 'push'"));
}
export function checkCiIfConformance(cfg: HarnessConfig, yml: string): Finding[] {
  const out: Finding[] = [];
  const lines = extractCiIfLines(yml);
  if (lines.length !== CI_IF_EXPECTED_COUNT) {
    out.push(fail('A5.ci.if', `${CI_YML} 以 \`if: github.event_name != 'push'\` 開頭的行需恰 ${CI_IF_EXPECTED_COUNT} 行(找到 ${lines.length})`));
  }
  const expected = expectedCiIfLine(cfg.deliveryBranches);
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/== 'refs\/heads\/([^']*)'/g)) {
      const v = literalBranchNameViolation(m[1]);
      if (v !== null) out.push(fail('A5.ci.if.grammar', `if 行 #${i + 1} 的 ${JSON.stringify(m[1])} 不是合法字面分支名 — ${v}`));
    }
    if (l !== expected) out.push(fail('A5.ci.if', `if 行 #${i + 1} 與 deliveryBranches 導出的期望行不同\n    期望:${expected}\n    實際:${l}`));
  });
  return out;
}

export const checkBranchConformance: Check = (cfg, io) => {
  const out: Finding[] = [];
  const expected = cfg.protectedBranches;
  const consume = (id: string, label: string, s: SourceSet) => {
    if (!s.ok) out.push(...s.findings);
    else out.push(...compareSets(id, label, s.names, expected));
  };
  const pc = io.readText(PRE_COMMIT);
  if (pc === null) out.push(fail('A5.pre-commit', `${PRE_COMMIT} 讀不到`));
  else consume('A5.pre-commit', PRE_COMMIT, extractPreCommitBranches(pc));
  const pp = io.readText(PRE_PUSH);
  if (pp === null) out.push(fail('A5.pre-push', `${PRE_PUSH} 讀不到`));
  else consume('A5.pre-push', PRE_PUSH, extractPrePushBranches(pp));
  const ci = io.readText(CI_YML);
  if (ci === null) out.push(fail('A5.ci', `${CI_YML} 讀不到`));
  else {
    const r = extractCiBranches(ci);
    consume('A5.ci.push', `${CI_YML} push.branches`, r.push);
    consume('A5.ci.pull_request', `${CI_YML} pull_request.branches`, r.pullRequest);
    for (const g of r.pushGlobInfo) out.push(info('A5.ci.push', `push.branches 含白名單 glob ${JSON.stringify(g)}(不參與集合比對)`));
    out.push(...checkCiIfConformance(cfg, ci));
  }
  return out;
};

// ── A6:逐 adapter 直接斷言(2.4)

export const ADAPTER_ASSERTIONS: Record<AdapterName, Check> = {
  claude: (_cfg, io) => {
    const out: Finding[] = [];
    if (!isTracked(io, 'CLAUDE.md')) out.push(fail('A6.claude.file', 'CLAUDE.md 不存在或未被 git 追蹤'));
    const md = io.readText('CLAUDE.md');
    // Step 5 r1 I2:先剝 HTML 註解再找,否則 `<!-- 不要讀 …checklist.md -->` 也會過(仍是子字串比對,比 codex 側「整行 @CLAUDE.md」寬)
    if (md !== null && !md.replace(/<!--[\s\S]*?-->/g, '').includes('.claude/sop/plan-mode-checklist.md')) {
      out.push(fail('A6.claude.link', 'CLAUDE.md 必須直接引用 canonical SOP 路徑 .claude/sop/plan-mode-checklist.md'));
    }
    if (!isTracked(io, '.claude/sop/plan-mode-checklist.md')) out.push(fail('A6.claude.sop', '.claude/sop/plan-mode-checklist.md 未被 git 追蹤'));
    const settings = io.readText('.claude/settings.json');
    if (!isTracked(io, '.claude/settings.json') || settings === null || !settings.includes('"effortLevel"')) {
      out.push(fail('A6.claude.settings', '.claude/settings.json 必須被 git 追蹤且含 "effortLevel"'));
    }
    return out;
  },
  codex: (_cfg, io) => {
    const out: Finding[] = [];
    if (!isTracked(io, 'AGENTS.md')) out.push(fail('A6.codex.file', 'AGENTS.md 不存在或未被 git 追蹤'));
    const md = io.readText('AGENTS.md');
    if (md !== null && !md.split('\n').some((l) => l.trim() === '@CLAUDE.md')) {
      out.push(fail('A6.codex.link', 'AGENTS.md 必須含整行 `@CLAUDE.md`(import 語法,直接連到 canonical policy;散文提及不算)'));
    }
    return out;
  },
};

export const checkAdapters: Check = (cfg, io) => {
  const out: Finding[] = [];
  for (const a of cfg.requiredAgentAdapters) {
    const assert = ADAPTER_ASSERTIONS[a];
    if (!assert) {
      out.push(fail('A6', `未知 adapter ${JSON.stringify(a)}(v1 只認 ${KNOWN_ADAPTERS.join(' / ')})`));
      continue;
    }
    out.push(...assert(cfg, io));
  }
  return out;
};

export const checkGithubGovernance: Check = (cfg, io) => {
  if (!cfg.githubGovernanceRequired) return [];
  return isTracked(io, '.github/CODEOWNERS') ? [] : [fail('A8', 'githubGovernanceRequired=true 但 .github/CODEOWNERS 未被 git 追蹤')];
};

export const ADOPTED_CHECKS: readonly Check[] = [
  checkAdoptedProjectId,
  checkPart4Content,
  checkAdoptedCso,
  checkNoDestructivePlaceholders,
  checkBranchConformance,
  checkAdapters,
  checkCiRunsAdoption('A7'),
  checkGithubGovernance,
];

// ───────────────────────────────────────── 執行 + 輸出

export interface RunResult {
  mode: HarnessConfig['mode'];
  findings: Finding[];
  ready: boolean;
  lines: string[];
}

export function runAdoptionChecks(cfg: HarnessConfig, io: CheckerIo): RunResult {
  const table = cfg.mode === 'template' ? TEMPLATE_CHECKS : ADOPTED_CHECKS;
  const findings = table.flatMap((c) => c(cfg, io));
  const fails = findings.filter((f) => f.kind === 'fail');
  const exceptions = findings.filter((f) => f.kind === 'exception');
  const lines: string[] = [];
  if (cfg.mode === 'template') {
    lines.push(`TEMPLATE_MODE — adoption checks NOT applied; ${exceptions.length} template exceptions:`);
  } else if (fails.length === 0) {
    lines.push('ADOPTED_MODE — READY');
  } else {
    lines.push(`ADOPTED_MODE — NOT_READY (${fails.length} failures):`);
  }
  for (const f of findings) lines.push(`  [${f.kind}] ${f.id}: ${f.msg}`);
  if (cfg.mode === 'template' && fails.length > 0) lines.push(`TEMPLATE_MODE — ${fails.length} failures(模板自身被改壞)`);
  return { mode: cfg.mode, findings, ready: fails.length === 0, lines };
}

/** 真 I/O(對指定 root)。cso config 用 dynamic import(root 可能是 e2e fixture)。 */
export async function buildRealIo(root: string): Promise<CheckerIo> {
  const readText = (rel: string): string | null => {
    try {
      return readFileSync(path.join(root, rel), 'utf-8');
    } catch {
      return null;
    }
  };
  const csoMod = (await import(pathToFileURL(path.join(root, 'scripts/cso-trigger.config.ts')).href)) as {
    CSO_TRIGGER_PATTERNS?: unknown;
    CSO_NOT_APPLICABLE?: unknown;
  };
  const patterns = csoMod.CSO_TRIGGER_PATTERNS;
  const na = csoMod.CSO_NOT_APPLICABLE;
  if (!Array.isArray(patterns) || !patterns.every((p) => p && typeof p.domain === 'string' && p.pattern instanceof RegExp)) {
    throw new Error('scripts/cso-trigger.config.ts 的 CSO_TRIGGER_PATTERNS 形狀不對(需 {domain, pattern: RegExp}[])');
  }
  if (!Array.isArray(na) || !na.every((p) => p && typeof p.domain === 'string' && typeof p.reason === 'string')) {
    throw new Error('scripts/cso-trigger.config.ts 的 CSO_NOT_APPLICABLE 形狀不對(需 {domain, reason}[])');
  }
  let packageJson: CheckerIo['packageJson'] = null;
  const pkgText = readText('package.json');
  if (pkgText !== null) {
    try {
      const p = JSON.parse(pkgText);
      if (p && typeof p === 'object' && !Array.isArray(p)) packageJson = p as CheckerIo['packageJson'];
    } catch {
      packageJson = null;
    }
  }
  let tracked: string[] | null = null;
  return {
    readText,
    exists: (rel) => existsSync(path.join(root, rel)),
    isDir: (rel) => {
      try {
        return statSync(path.join(root, rel)).isDirectory();
      } catch {
        return false;
      }
    },
    trackedFiles: () => {
      if (tracked === null) {
        tracked = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf-8' }).split('\0').filter(Boolean);
      }
      return tracked;
    },
    csoPatterns: patterns as CheckerIo['csoPatterns'],
    csoNotApplicable: na as CheckerIo['csoNotApplicable'],
    packageJson,
  };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const rootArgs = argv.filter((a) => a.startsWith('--root='));
  const unknown = argv.filter((a) => !a.startsWith('--root='));
  if (unknown.length > 0 || rootArgs.length > 1 || (rootArgs.length === 1 && rootArgs[0] === '--root=')) {
    console.error(`❌ 參數錯誤:${argv.join(' ')}(只接受單一 --root=<dir>;fail-closed exit 2)`);
    return 2;
  }
  const root = rootArgs[0] ? path.resolve(rootArgs[0].slice('--root='.length)) : execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();

  let cfg: HarnessConfig;
  try {
    cfg = loadHarnessConfig(root);
  } catch (e) {
    console.error(`❌ ${(e as Error).message}`);
    console.error(`NOT_READY — ${HARNESS_CONFIG_PATH} 無法載入(exit 2)`);
    return 2;
  }
  let io: CheckerIo;
  try {
    io = await buildRealIo(root);
  } catch (e) {
    console.error(`❌ ${(e as Error).message}`);
    console.error('NOT_READY — 無法建立檢查所需 I/O(exit 2)');
    return 2;
  }
  const r = runAdoptionChecks(cfg, io);
  for (const l of r.lines) console.log(l);
  return r.ready ? 0 : 2;
}

// ESM main 判定改用 scripts/lib/invoked-as-main.ts 共用 lib(P2#3 defer ①② 後續遷移):
// 兩端 realpath、indeterminate 由 caller 顯式 exit(2)、被當 import 用時完全靜默。
const outcome = detectInvocation(import.meta.url, process.argv[1]);
const isMain = reportIfNotMain(outcome, 'check-adoption-readiness');
if (isMain) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`❌ ${(e as Error).message}`);
      process.exit(2);
    }
  );
} else if (outcome.kind === 'indeterminate') {
  process.exit(2);
}
