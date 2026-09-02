// scripts/check-baseline-governance.ts
//
// Baseline 治理旁路的機器守門(PR A3;ADR〈已知限制〉第 2 條的處置)—— `npm run check:baseline-governance`,
// CI step「Baseline Governance Check」(只在 pull_request event 跑)。
//
// 守的不變量(INV-4):`scripts/source-term-baseline.json` 的 `sourceTermHistoryBaseline` 只能在
// 「只動 config + ADR + bookkeeping allowlist」的 PR 內、往前推到 merge-base 的祖先(或 merge-base 本身)。
// 攻擊情境:同一 PR (a) 把 baseline 推到 PR tip、(b) 中間 commit 加 forbidden、(c) 後續刪 → `baseline..HEAD`
// 幾近空、current tree 乾淨 → source-term gate 假綠。
//
// 規則(全部 fail-closed;無法判定 exit 2):
//   0. 唯一輸入 `--base=<ref>`(必填、單一);**不讀任何 env**;CI 顯式傳 origin/<default_branch>。
//   1. mb = merge-base(base, HEAD);取不到 / mb == HEAD → 2。
//   2. 兩端 config 的 baseline 值相同 → 0(BASELINE_UNCHANGED)。
//   3. 值改變 → `git diff --name-only mb HEAD` 每個路徑必須 ∈ {config, ADR} ∪ bookkeeping allowlist
//      (`isBookkeepingPath` import 自 check-bookkeeping-commit.ts,SSOT 不複製)。
//   4. 新值(去 `template:` 前綴)必須:40-hex、解得開、是 mb 的祖先或等於 mb(不得指向本 PR 內任何 commit)、
//      且是舊值的後裔(只准往前推;舊值為 null 時略過此條)。
//
// Exit:0 = 通過 / 2 = NOT_OK 或無法判定。刻意無 exit 1。
// 刻意不做:不改 check-no-source-terms.ts 掃描語意;不解析 PR metadata;不讀 DELIVERY_REFS。

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isBookkeepingPath } from './check-bookkeeping-commit';
import { parseBaselineConfig } from './check-no-source-terms';

export const BASELINE_CONFIG = 'scripts/source-term-baseline.json';
export const BASELINE_ADR = 'docs/architecture/' + 'source-term-history-baseline.md';
export const BASE_REF_RE = /^[A-Za-z0-9_][\w./-]*$/;

export interface GovernanceFinding {
  code: string;
  msg: string;
}

export interface GitIo {
  /** 回 stdout(trim);失敗回 null。 */
  git(args: string[]): string | null;
}

export function stripTemplatePrefix(v: string): string {
  return v.startsWith('template:') ? v.slice('template:'.length) : v;
}

/** 允許的變更路徑(值改變時)。 */
export function isAllowedBaselineChangePath(p: string): boolean {
  return p === BASELINE_CONFIG || p === BASELINE_ADR || isBookkeepingPath(p);
}

export interface GovernanceResult {
  status: 'UNCHANGED' | 'OK' | 'FAIL' | 'UNDETERMINED';
  findings: GovernanceFinding[];
  lines: string[];
}

export function evaluateBaselineGovernance(baseRef: string, io: GitIo): GovernanceResult {
  const f: GovernanceFinding[] = [];
  const und = (code: string, msg: string): GovernanceResult => ({ status: 'UNDETERMINED', findings: [{ code, msg }], lines: [`BASELINE_GOVERNANCE_UNDETERMINED — [${code}] ${msg}`] });

  if (!BASE_REF_RE.test(baseRef)) return und('base.shape', `base ref ${JSON.stringify(baseRef)} 形狀不合法`);
  const baseSha = io.git(['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]);
  if (!baseSha) return und('base.unresolvable', `base ref ${baseRef} 解不開(未 fetch?)`);
  const head = io.git(['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']);
  if (!head) return und('head.unresolvable', 'HEAD 解不開');
  const mb = io.git(['merge-base', baseSha, head]);
  if (!mb) return und('merge-base.unavailable', `merge-base(${baseRef}, HEAD) 取不到(shallow clone / 無共同祖先)`);
  if (mb === head) return und('merge-base.equals-head', 'merge-base == HEAD(PR 無 commit,或 base 就是 HEAD)→ 無法判定');

  const readCfg = (rev: string): { baseline: string | null } | 'absent' | { error: string } => {
    const text = io.git(['show', `${rev}:${BASELINE_CONFIG}`]);
    if (text === null) return 'absent';
    try {
      return parseBaselineConfig(text);
    } catch (e) {
      return { error: (e as Error).message };
    }
  };
  const oldCfg = readCfg(mb);
  const newCfg = readCfg(head);
  if (typeof newCfg === 'object' && 'error' in newCfg) return und('config.head.invalid', newCfg.error);
  if (typeof oldCfg === 'object' && 'error' in oldCfg) return und('config.base.invalid', oldCfg.error);
  const oldVal = oldCfg === 'absent' ? null : (oldCfg as { baseline: string | null }).baseline;
  const newVal = newCfg === 'absent' ? null : (newCfg as { baseline: string | null }).baseline;

  if (oldVal === newVal) {
    return { status: 'UNCHANGED', findings: [], lines: [`BASELINE_UNCHANGED — ${BASELINE_CONFIG} 的 baseline 在 merge-base ${mb.slice(0, 12)} 與 HEAD 相同(${newVal ?? 'null'})`] };
  }

  // 3. 變更面
  const diff = io.git(['diff', '--name-only', mb, head]);
  if (diff === null) return und('diff.unavailable', 'git diff --name-only 取不到');
  const changed = diff.split('\n').filter(Boolean);
  const disallowed = changed.filter((p) => !isAllowedBaselineChangePath(p));
  if (changed.length === 0) f.push({ code: 'diff.empty', msg: 'baseline 值變了但 diff 為空(無法判定)' });
  for (const p of disallowed) f.push({ code: `path.disallowed:${p}`, msg: `baseline 變更 PR 只准動 config / ADR / bookkeeping allowlist,但動了 ${p}` });

  // 4. 新值
  if (newVal === null) {
    f.push({ code: 'value.removed', msg: 'baseline 從有值改成 null / 缺(退回全史掃描是治理決策,需另開 PR 說明,本 gate 不放行)' });
  } else {
    const nv = stripTemplatePrefix(newVal);
    if (!/^[0-9a-f]{40}$/.test(nv)) f.push({ code: 'value.shape', msg: `新 baseline ${JSON.stringify(newVal)} 不是 40-hex` });
    else {
      const nvSha = io.git(['rev-parse', '--verify', '--quiet', `${nv}^{commit}`]);
      if (!nvSha) f.push({ code: 'value.unresolvable', msg: `新 baseline ${nv} 不在 history 內` });
      else {
        const isAnc = io.git(['merge-base', '--is-ancestor', nvSha, mb]);
        if (isAnc === null) f.push({ code: 'value.not-ancestor-of-merge-base', msg: `新 baseline ${nv.slice(0, 12)} 不是 merge-base ${mb.slice(0, 12)} 的祖先(指向本 PR 內的 commit = 洗白)` });
        if (oldVal !== null) {
          const ov = stripTemplatePrefix(oldVal);
          const ovSha = /^[0-9a-f]{40}$/.test(ov) ? io.git(['rev-parse', '--verify', '--quiet', `${ov}^{commit}`]) : null;
          if (!ovSha) f.push({ code: 'value.old-unresolvable', msg: `舊 baseline ${JSON.stringify(oldVal)} 解不開,無法判定方向` });
          else {
            const forward = io.git(['merge-base', '--is-ancestor', ovSha, nvSha]);
            if (forward === null || ovSha === nvSha) f.push({ code: 'value.not-forward', msg: `新 baseline ${nv.slice(0, 12)} 不是舊值 ${ov.slice(0, 12)} 的真後裔(只准往前推)` });
          }
        }
      }
    }
  }

  if (f.length === 0) {
    return { status: 'OK', findings: [], lines: [`BASELINE_GOVERNANCE_OK — baseline ${oldVal ?? 'null'} → ${newVal};變更面 ${changed.length} 檔皆在允許集合;新值為 merge-base 祖先且為舊值後裔`] };
  }
  return { status: 'FAIL', findings: f, lines: [`BASELINE_GOVERNANCE_FAIL (${f.length}):`, ...f.map((x) => `  [${x.code}] ${x.msg}`)] };
}

export function buildGitIo(root: string): GitIo {
  return {
    git: (args) => {
      try {
        return execFileSync('git', ['-C', root, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      } catch {
        return null;
      }
    },
  };
}

function main(): number {
  const argv = process.argv.slice(2);
  const baseArgs = argv.filter((a) => a.startsWith('--base='));
  const rootArgs = argv.filter((a) => a.startsWith('--root='));
  const unknown = argv.filter((a) => !a.startsWith('--base=') && !a.startsWith('--root='));
  if (unknown.length > 0) {
    console.error(`❌ 未知參數:${unknown.join(', ')}(只接受 --base=<ref> 與選用的 --root=<dir>;fail-closed exit 2)`);
    return 2;
  }
  if (baseArgs.length !== 1 || baseArgs[0] === '--base=') {
    console.error(`❌ --base=<ref> 必填且只能一個、不得為空(收到 ${baseArgs.length} 個;本工具不讀任何 env)`);
    return 2;
  }
  if (rootArgs.length > 1 || (rootArgs.length === 1 && rootArgs[0] === '--root=')) {
    console.error('❌ --root=<dir> 最多一個且不得為空');
    return 2;
  }
  const base = baseArgs[0]!.slice('--base='.length);
  const root = rootArgs[0] ? path.resolve(rootArgs[0].slice('--root='.length)) : execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
  const r = evaluateBaselineGovernance(base, buildGitIo(root));
  for (const l of r.lines) console.log(l);
  return r.status === 'UNCHANGED' || r.status === 'OK' ? 0 : 2;
}

const invokedPath = process.argv[1];
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  process.exit(main());
}
