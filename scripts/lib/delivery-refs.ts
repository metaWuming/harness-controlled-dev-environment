/**
 * scripts/lib/delivery-refs.ts — 「交付 ref」共用政策契約(fail-closed)
 *
 * 可控開發環境 Layer 3。為什麼需要這支:
 *   `check-todos-markers.ts` 與 `check-no-source-terms.ts` 都要一份「有 merge 證據的 PR 號」,
 *   來源是交付分支的 commit subject。原本兩支各自複製一段「origin/HEAD + env + fallback」邏輯,
 *   env 候選只過白名單與 `rev-parse`,`HEAD` / 本地 feature / `origin/feature/x` 都解得開
 *   → 未合併 commit 的 `(#N)` 進 allowedPrs(TODOS P2#2,(#48) 收掉)。
 *
 * 契約(supervisor 2026-09-03,本版):**唯一來源是受驗的權威 base;不讀任何 env。**
 *   1. `refs/remotes/origin/HEAD` 的目標 T 必須恰為 `refs/remotes/origin/<name>`、`<name>` 過字面分支名
 *      文法、解得出 commit、
 *      且 `<name>` ∈ `harness.config.json` 的 `deliveryBranches`(靜態宣告)。任一不成立 → `base.*`
 *      原因碼,**不建 allowedPrs**;呼叫方 exit 2(無法判定)。
 *   2. **沒有 fallback**:不猜 `origin/develop`、不用本地 `main` / `develop`。
 *   3. **沒有 env 通道**。上一版(#48)曾保留 env `DELIVERY_REFS`(候選須為 base 祖先);在那個契約下
 *      任一通過驗證的候選 X 滿足 anc(X) ⊆ anc(base),`git log base X` 走訪的集合 = anc(base),
 *      allowedPrs 完全不變——通道只剩「驗證會不會拒絕」與可被 tag / 遮蔽觸發的 fail-closed DoS 面,
 *      所以整個移除(刻意的行為 / API 移除;回滾 = 單一 revert)。
 *
 * 純函式 + 可注入 git runner;兩支 script 只接線,不各自複製邏輯。
 */

import { execFileSync } from 'node:child_process';
import { HARNESS_CONFIG_PATH, literalBranchNameViolation, loadHarnessConfig } from './harness-config';

const REMOTE_PREFIX = 'refs/remotes/origin/';

export type ReasonCode =
  | 'config.invalid'
  | 'base.missing'
  | 'base.shape'
  | 'base.unresolvable'
  | 'base.undeclared';

export interface Rejection {
  code: ReasonCode;
  /** 被拒的輸入原樣(symbolic-ref 目標,或 config 路徑) */
  input: string;
  detail: string;
}

export interface DeliveryRefsResult {
  ok: boolean;
  /** ok 時:恰一個元素——受驗的權威 base(`refs/remotes/origin/<name>`) */
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

/**
 * 權威 base 的驗證。輸入是**完整 ref**(`refs/remotes/origin/<name>`)。
 * 順序固定:形狀 → 存在 → 宣告。第一個失敗即回該原因碼。
 */
export function validateRef(git: GitRunner, fullRef: string, declared: readonly string[]): Rejection | null {
  const name = remoteBranchName(fullRef);
  if (name === null) {
    return { code: 'base.shape', input: fullRef, detail: `必須恰為 refs/remotes/origin/<字面分支名>` };
  }
  if (git(['rev-parse', '--verify', '--quiet', `${fullRef}^{commit}`]) === null) {
    return { code: 'base.unresolvable', input: fullRef, detail: `${fullRef} 解不出 commit(未 fetch?)` };
  }
  if (!declared.includes(name)) {
    return { code: 'base.undeclared', input: fullRef, detail: `分支「${name}」未宣告在 ${HARNESS_CONFIG_PATH} 的 deliveryBranches` };
  }
  return null;
}

/**
 * 主入口:只解析並驗證權威 base。`declared` 由呼叫方從 harness.config.json 讀(缺 / 壞 → `config.invalid`,不猜)。
 * **不讀 `process.env`。**
 */
export function resolveDeliveryRefs(git: GitRunner, declared: readonly string[]): DeliveryRefsResult {
  const target = git(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
  if (target === null || target === '') {
    const rejection: Rejection = {
      code: 'base.missing',
      input: 'refs/remotes/origin/HEAD',
      detail: 'origin/HEAD 未設或無 origin remote(`git remote set-head origin -a`)——沒有權威交付 base,不接受任何 ref',
    };
    return { ok: false, refs: [], rejections: [rejection] };
  }
  const r = validateRef(git, target, declared);
  if (r) return { ok: false, refs: [], rejections: [r] };
  return { ok: true, refs: [target], rejections: [] };
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

/** 給兩支 script 直接用的便利入口:root → 結果(不讀任何 env) */
export function resolveDeliveryRefsFromRepo(root: string): DeliveryRefsResult {
  const cfg = loadDeclaredDeliveryBranches(root);
  if ('rejection' in cfg) return { ok: false, refs: [], rejections: [cfg.rejection] };
  return resolveDeliveryRefs(execGit(root), cfg.declared);
}

/** 統一的人看得懂的診斷(呼叫方印到 stderr 後 exit 2) */
export function formatRejections(rejections: readonly Rejection[]): string {
  const lines = rejections.map((r) => `  [${r.code}] ${r.input} — ${r.detail}`);
  return [
    `✗ 交付 ref 無法判定(${rejections.length} 條):唯一來源是受驗的 origin/HEAD(目標須為 origin/<已宣告交付分支>、可解);沒有 fallback、不讀任何 env。`,
    ...lines,
  ].join('\n');
}
