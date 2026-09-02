/**
 * scripts/lib/delivery-refs.ts — 「交付 ref」共用政策契約(fail-closed)
 *
 * 可控開發環境 Layer 3。為什麼需要這支:
 *   `check-todos-markers.ts` 與 `check-no-source-terms.ts` 都要一份「有 merge 證據的 PR 號」,
 *   來源是交付分支的 commit subject。兩支 script 原本各自複製一段「origin/HEAD +
 *   env `DELIVERY_REFS` + fallback」邏輯,而 env 候選只過文法白名單與 `rev-parse --verify`:
 *   `HEAD`、本地 feature、`origin/feature/x` 都解得開 → **未合併 commit 的 `(#N)` 進 allowedPrs**,
 *   A1.1 round 2 P1-1 的修法可被整條還原(TODOS P2#2)。
 *
 * 契約(supervisor plan rev 4,2026-09-02):
 *   1. **權威 base 是受驗政策輸入,不是特例**:`refs/remotes/origin/HEAD` 的目標 T 必須恰為
 *      `refs/remotes/origin/<name>`、`<name>` 過字面分支名文法、解得出 commit、`origin/<name>`
 *      正規解析恰等於 T(擋本地同名遮蔽)、且 `<name>` ∈ `harness.config.json` 的
 *      `deliveryBranches`(靜態宣告)。任一不成立 → `base.*` 原因碼,**不建 allowedPrs**。
 *   2. **env 候選**走同一支 `validateRef`,外加「必須是權威 base 的祖先」(相等也算)。
 *      文法 / 形狀 / 正規 / 存在 / 祖先 / 宣告任一不成立 → `ref.*` 原因碼。
 *   3. **REJECT 不靜默**:所有原因碼收集後一次回報;呼叫方 exit 2(無法判定)。
 *   4. **沒有 fallback**:不猜 `origin/develop`、不用本地 `main` / `develop`;沒有受驗 base
 *      就沒有任何 ref。
 *   祖先與宣告是**兩道獨立假設**:祖先擋「未合併」,宣告擋「不是交付線」。
 *
 * 純函式 + 可注入 git runner;兩支 script 只接線,不各自複製邏輯。
 */

import { execFileSync } from 'node:child_process';
import { HARNESS_CONFIG_PATH, literalBranchNameViolation, loadHarnessConfig } from './harness-config';

/** 沿用兩支 script 既有白名單:擋 shell metachar / option injection */
export const SAFE_REF_RE = /^[A-Za-z0-9_./-]+$/;
export const DELIVERY_ENV = 'DELIVERY_REFS';
const REMOTE_PREFIX = 'refs/remotes/origin/';

export type ReasonCode =
  | 'config.invalid'
  | 'base.missing'
  | 'base.shape'
  | 'base.unresolvable'
  | 'base.noncanonical'
  | 'base.undeclared'
  | 'ref.syntax'
  | 'ref.shape'
  | 'ref.unresolvable'
  | 'ref.noncanonical'
  | 'ref.nonancestor'
  | 'ref.undeclared';

export interface Rejection {
  code: ReasonCode;
  /** 被拒的輸入原樣(base 為 symbolic-ref 目標;env 候選為字串) */
  input: string;
  detail: string;
}

export interface DeliveryRefsResult {
  ok: boolean;
  /** ok 時:可餵給 `git log` 的完整 ref 名(`refs/remotes/origin/<name>`),base 在首位 */
  refs: string[];
  rejections: Rejection[];
}

/** git runner:回 stdout(trim 後)或 null(非 0 / spawn 失敗)。可注入給單測。 */
export type GitRunner = (args: string[]) => string | null;

export function execGit(root: string): GitRunner {
  return (args) => {
    try {
      return execFileSync('git', ['-C', root, ...args], { encoding: 'utf-8', stdio: 'pipe' }).trim();
    } catch {
      return null;
    }
  };
}

/** `refs/remotes/origin/<name>` → `<name>`;形狀不合回 null */
export function remoteBranchName(fullRef: string): string | null {
  if (!fullRef.startsWith(REMOTE_PREFIX)) return null;
  const name = fullRef.slice(REMOTE_PREFIX.length);
  if (literalBranchNameViolation(name) !== null) return null;
  return name;
}

interface ValidateOpts {
  /** 原因碼前綴:base 或 ref */
  kind: 'base' | 'ref';
  /** 已宣告的交付分支(靜態) */
  declared: readonly string[];
  /** 有給 → 要求是它的祖先(相等也算) */
  mustBeAncestorOf?: string;
  /** 診斷用的輸入原樣(env 候選傳使用者寫的短形);未給用 fullRef */
  input?: string;
}

/**
 * base 與 env 候選共用的驗證。輸入是**完整 ref**(`refs/remotes/origin/<name>`)。
 * 順序固定:形狀 → 存在 → 正規 → 祖先 → 宣告。第一個失敗即回該原因碼(呼叫方對每條候選各呼叫一次,
 * 所以多條候選的原因碼會全部列出、不短路)。
 */
export function validateRef(git: GitRunner, fullRef: string, opts: ValidateOpts): Rejection | null {
  const k = opts.kind;
  const code = (suffix: 'shape' | 'unresolvable' | 'noncanonical' | 'nonancestor' | 'undeclared'): ReasonCode =>
    `${k}.${suffix}` as ReasonCode;
  const input = opts.input ?? fullRef;
  const name = remoteBranchName(fullRef);
  if (name === null) {
    return { code: code('shape'), input, detail: `必須恰為 refs/remotes/origin/<字面分支名>` };
  }
  if (git(['rev-parse', '--verify', '--quiet', `${fullRef}^{commit}`]) === null) {
    return { code: code('unresolvable'), input, detail: `${fullRef} 解不出 commit(未 fetch?)` };
  }
  const canon = git(['rev-parse', '--symbolic-full-name', `origin/${name}`]);
  if (canon !== fullRef) {
    return {
      code: code('noncanonical'),
      input,
      detail: `origin/${name} 正規解析為 ${canon || '(無 / 歧義)'},不是 ${fullRef}(本地同名 branch 或 tag 遮蔽?)`,
    };
  }
  if (opts.mustBeAncestorOf !== undefined) {
    if (git(['merge-base', '--is-ancestor', fullRef, opts.mustBeAncestorOf]) === null) {
      return { code: code('nonancestor'), input, detail: `${fullRef} 不是 ${opts.mustBeAncestorOf} 的祖先(未合併分支不是交付證據)` };
    }
  }
  if (!opts.declared.includes(name)) {
    return { code: code('undeclared'), input, detail: `分支「${name}」未宣告在 ${HARNESS_CONFIG_PATH} 的 deliveryBranches` };
  }
  return null;
}

/**
 * 主入口。`envValue` = `process.env.DELIVERY_REFS`(呼叫方傳入,方便測試);`declared` 未給時從
 * `root` 讀 harness.config.json(缺 / 壞 → `config.invalid`,不猜)。
 */
export function resolveDeliveryRefs(
  git: GitRunner,
  envValue: string | undefined,
  declared: readonly string[],
): DeliveryRefsResult {
  const rejections: Rejection[] = [];
  const refs: string[] = [];

  // 1. 權威 base:origin/HEAD 的目標,走同一支驗證(不做祖先檢查——它就是參考點)
  const target = git(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  if (target === null || target === '') {
    rejections.push({
      code: 'base.missing',
      input: 'refs/remotes/origin/HEAD',
      detail: 'origin/HEAD 未設或無 origin remote(`git remote set-head origin -a`)——沒有權威交付 base,不接受任何 ref',
    });
  } else {
    const r = validateRef(git, target, { kind: 'base', declared });
    if (r) rejections.push(r);
    else refs.push(target);
  }
  const base = refs[0];

  // 2. env 候選:必須寫成 origin/<name>;每條各自驗,原因碼全部列出
  const extras = (envValue ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const seen = new Set<string>(refs);
  for (const cand of extras) {
    if (!SAFE_REF_RE.test(cand)) {
      rejections.push({ code: 'ref.syntax', input: cand, detail: '含白名單以外字元' });
      continue;
    }
    if (!cand.startsWith('origin/')) {
      rejections.push({ code: 'ref.shape', input: cand, detail: '必須寫成 origin/<分支名>(HEAD / 本地分支 / 其他 remote 一律不收)' });
      continue;
    }
    const full = REMOTE_PREFIX + cand.slice('origin/'.length);
    if (base === undefined) {
      // 沒有受驗 base 就無法做祖先檢查:不放行、也不用別的原因碼掩蓋(base.* 已列出)
      rejections.push({ code: 'ref.nonancestor', input: cand, detail: '沒有受驗的權威 base,無法證明是交付線祖先' });
      continue;
    }
    const r = validateRef(git, full, { kind: 'ref', declared, mustBeAncestorOf: base, input: cand });
    if (r) {
      rejections.push(r);
      continue;
    }
    if (!seen.has(full)) {
      seen.add(full);
      refs.push(full);
    }
  }

  return { ok: rejections.length === 0, refs: rejections.length === 0 ? refs : [], rejections };
}

/** 讀 config 的宣告集合;缺 / 壞 → 回 Rejection(不 throw,讓呼叫方統一報) */
export function loadDeclaredDeliveryBranches(root: string): { declared: readonly string[] } | { rejection: Rejection } {
  try {
    return { declared: loadHarnessConfig(root).deliveryBranches };
  } catch (e) {
    return {
      rejection: { code: 'config.invalid', input: HARNESS_CONFIG_PATH, detail: (e as Error).message },
    };
  }
}

/** 給兩支 script 直接用的便利入口:root + process.env → 結果 */
export function resolveDeliveryRefsFromRepo(root: string, env: NodeJS.ProcessEnv = process.env): DeliveryRefsResult {
  const cfg = loadDeclaredDeliveryBranches(root);
  if ('rejection' in cfg) return { ok: false, refs: [], rejections: [cfg.rejection] };
  return resolveDeliveryRefs(execGit(root), env[DELIVERY_ENV], cfg.declared);
}

/** 統一的人看得懂的診斷(呼叫方印到 stderr 後 exit 2) */
export function formatRejections(rejections: readonly Rejection[]): string {
  const lines = rejections.map((r) => `  [${r.code}] ${r.input} — ${r.detail}`);
  return [
    `✗ 交付 ref 無法判定(${rejections.length} 條):只接受 origin/HEAD 與 env ${DELIVERY_ENV} 裡「origin/<已宣告交付分支>、且為 origin/HEAD 祖先」的 ref;沒有 fallback。`,
    ...lines,
  ].join('\n');
}
