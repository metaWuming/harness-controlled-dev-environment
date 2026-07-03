// scripts/check-cso-trigger.ts
//
// /cso 觸發判定引擎(可控開發環境 v5 Phase 1-1c)
//
// 把 SOP Step 4.5「僅當本 sprint 碰金流 / PII / 權限或資產轉移 / audit trail 時觸發
// 安全審(/cso)」的判定從 AI 判斷力機器化:對本 sprint 的完整變更面(committed +
// staged + unstaged + untracked)跑 path 比對,命中安全敏感面即輸出 CSO_REQUIRED。
//
// 路徑表在 `scripts/cso-trigger.config.ts`(導入時填入你的安全敏感路徑,見該檔檔頭)。
//
// ⚠️ 定位(讀我再用):
//   - 這**不是 CI gate**(CI 跑不了 /cso skill)——是 SOP Step 4.5 的本機判定工具。
//   - **機器判定是下限不是上限**(單向 ratchet):腳本說 REQUIRED 就必須觸發;
//     腳本說 NOT_REQUIRED 但 AI 覺得可疑 → 仍可(該)觸發。「拿不準時,觸發比略過安全」
//     原則不變,只是明確案例不再耗判斷力。
//   - **fail-closed**:路徑表非空而 git diff 取不到(不在 repo / base 不存在)→ 視同 REQUIRED。
//   - 路徑表為空(模板出廠狀態)→ 輸出 CSO_NOT_REQUIRED + 導入提醒(空表無從比對,
//     不套 fail-closed;此狀態代表「尚未導入」,填表後判定力才生效)。
//
// Usage:
//   npx tsx scripts/check-cso-trigger.ts            # diff base 預設 develop(不存在時退 main)
//   npx tsx scripts/check-cso-trigger.ts --base=origin/develop
//
// Exit codes:0 = CSO_NOT_REQUIRED / 2 = CSO_REQUIRED(含 fail-closed)/ 1 = 用法錯誤

import { execSync } from 'node:child_process';
import { CSO_TRIGGER_PATTERNS, type CsoDomain } from './cso-trigger.config';

export type { CsoDomain };
export { CSO_TRIGGER_PATTERNS };

export interface CsoTriggerResult {
  required: boolean;
  matches: { domain: CsoDomain; file: string }[];
}

/**
 * 收集「本 sprint 的完整變更面」(只看 committed diff 會漏掉 staged / unstaged /
 * untracked —— SOP 流程中腳本可能在 commit 前被跑,編輯中的安全敏感檔不能因為
 * 還沒 commit 就判 NOT_REQUIRED):
 *   committed(base...HEAD)+ staged + unstaged + untracked,聯集去重。
 * run 可注入(測試用),預設 execSync。
 */
export function collectChangedFiles(
  base: string,
  run: (cmd: string) => string = (cmd) => execSync(cmd, { encoding: 'utf-8' })
): string[] {
  const outputs = [
    run(`git diff ${base}...HEAD --name-only`), // committed
    run('git diff --cached --name-only'), // staged
    run('git diff --name-only'), // unstaged
    run('git ls-files --others --exclude-standard'), // untracked
  ];
  return [...new Set(outputs.flatMap((o) => o.split('\n')).filter(Boolean))];
}

/** 純函式:變更檔清單 → 觸發判定。patterns 可注入(測試用),預設讀 config。 */
export function evaluateCsoTrigger(
  changedFiles: string[],
  patterns: { domain: CsoDomain; pattern: RegExp }[] = CSO_TRIGGER_PATTERNS
): CsoTriggerResult {
  const matches: CsoTriggerResult['matches'] = [];
  for (const file of changedFiles) {
    for (const { domain, pattern } of patterns) {
      if (pattern.test(file)) matches.push({ domain, file });
    }
  }
  return { required: matches.length > 0, matches };
}

/** 預設 diff base:develop 優先(feature→develop 工作流),不存在時退 main。 */
function resolveDefaultBase(): string {
  for (const ref of ['develop', 'main']) {
    try {
      execSync(`git rev-parse --verify --quiet ${ref}`, { stdio: 'pipe' });
      return ref;
    } catch {
      /* try next */
    }
  }
  return 'develop'; // 都 resolve 不到 → 交給 fail-closed 處理
}

function main(): void {
  // 出廠空表 → 無從比對。明確提示這是「尚未導入」狀態,不是安全背書。
  if (CSO_TRIGGER_PATTERNS.length === 0) {
    console.log(
      'CSO_NOT_REQUIRED — ⚠️ 路徑表為空(模板出廠狀態,尚未導入)。' +
        '此結果不代表 diff 安全,只代表尚無判定依據;' +
        '請照 scripts/cso-trigger.config.ts 檔頭說明填入你的安全敏感路徑表。'
    );
    process.exit(0);
  }

  const baseArg = process.argv.find((a) => a.startsWith('--base='));
  const base = baseArg ? baseArg.slice('--base='.length) : resolveDefaultBase();
  if (!/^[\w./-]+$/.test(base)) {
    console.error(`❌ 非法 base ref:${base}`);
    process.exit(1);
  }

  let files: string[];
  try {
    files = collectChangedFiles(base);
  } catch {
    // fail-closed:變更面取不到就當作要觸發(寧多跑一輪安全審,不靜默放行)
    console.log(`CSO_REQUIRED(fail-closed:git 變更面取不到〔base=${base}〕,無法判定)`);
    process.exit(2);
  }

  const result = evaluateCsoTrigger(files);
  if (result.required) {
    console.log('CSO_REQUIRED — 本 diff 命中安全敏感面,SOP Step 4.5 必須跑 /cso:');
    const byDomain = new Map<string, string[]>();
    for (const m of result.matches) {
      byDomain.set(m.domain, [...(byDomain.get(m.domain) ?? []), m.file]);
    }
    for (const [domain, list] of byDomain) {
      console.log(`  [${domain}]`);
      for (const f of [...new Set(list)]) console.log(`    - ${f}`);
    }
    process.exit(2);
  }

  console.log(
    `CSO_NOT_REQUIRED — ${files.length} 個變更檔皆未命中路徑表。` +
      `(提醒:機器判定是下限不是上限,若 diff 含腳本未涵蓋的安全敏感邏輯,仍應觸發 /cso)`
  );
  process.exit(0);
}

if (typeof require !== 'undefined' && require.main === module) {
  main();
}
