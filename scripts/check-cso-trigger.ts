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
//   - **fail-closed**:任何「無法判定」都必須回 REQUIRED——git 變更面取不到、
//     非法 base、base 不是 HEAD 的**真**祖先(proper ancestor)、路徑表為空(尚
//     未導入)、用法錯誤,一律 exit 2。
//
// Usage:
//   npx tsx scripts/check-cso-trigger.ts            # diff base 預設 develop → origin/develop → main → origin/main
//   npx tsx scripts/check-cso-trigger.ts --base=origin/develop
//
// Exit codes:0 = CSO_NOT_REQUIRED / **2 = CSO_REQUIRED,含所有 fail-closed 情況**。
//   刻意**沒有** exit 1:契約若讓「用法錯誤」回 1,比對 `=== 2` 的呼叫端會把它
//   讀成「不需要跑安全審」= fail-open。任何「無法判定」都必須回 2。

import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
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
  // 🔴 `--no-renames`(codex [P1]):git 預設對 rename 只回報**目的路徑** → 把
  //    `src/lib/auth/xxx.ts` 搬到路徑表沒涵蓋的目錄,就能拿到 CSO_NOT_REQUIRED。
  //    關掉後 rename 拆成 delete + add、來源與目的兩端都會被比對。
  const outputs = [
    run(`git diff ${base}...HEAD --name-only --no-renames`), // committed
    run('git diff --cached --name-only --no-renames'), // staged
    run('git diff --name-only --no-renames'), // unstaged
    run('git ls-files --others --exclude-standard'), // untracked(無 rename 語意)
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

/**
 * 預設 diff base:develop 優先(feature→develop 工作流),不存在時退 main。
 * 也試 `origin/*`:fresh clone 只會有預設分支的本機 branch,沒有 `develop` →
 * 舊版會退到 `main`,把「develop 全部的 delta」算進本 sprint(幾乎永遠 REQUIRED,
 * 方向安全但工具失去訊號量)。
 */
function resolveDefaultBase(): string {
  for (const ref of ['develop', 'origin/develop', 'main', 'origin/main']) {
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
  // 🔴 路徑表為空 → 無從比對(= 尚未導入)。**fail-closed**:舊版這裡 exit 0,與檔頭
  //    宣稱 fail-closed 矛盾,而且「用戶會自己記得填」不是理由——把正確性寄託在紀律
  //    上等於這支自己沒有守門。改 exit 2 讓「未導入」跟「無法判定」同樣硬擋。
  if (CSO_TRIGGER_PATTERNS.length === 0) {
    console.log(
      'CSO_REQUIRED(fail-closed:路徑表為空 = 尚未導入,無判定依據)。' +
        '請照 scripts/cso-trigger.config.ts 檔頭說明填表。'
    );
    process.exit(2);
  }

  const baseArg = process.argv.find((a) => a.startsWith('--base='));
  const base = baseArg ? baseArg.slice('--base='.length) : resolveDefaultBase();
  // 🔴 形狀檢查:不含空白 / 分號 / 管線 / `$` / 反引號 / 引號 / glob,且**必須以英數
  //    起頭**(擋掉 `--flag` 形狀的 option smuggling;舊版允許開頭 `--`,只是因為後
  //    面接 `...HEAD` 才碰巧被 git 拒絕 = 安全靠巧合、不是靠設計)。
  if (!/^[A-Za-z0-9_][\w./-]*$/.test(base)) {
    // 🔴 exit 2 而非 1:契約是「2 = 要跑安全審」,用法錯誤若回 1,比對 `=== 2` 的呼叫
    //    端會把它讀成「不需要跑」= fail-open。
    console.error(`❌ 非法 base ref:${base}(fail-closed,視同 CSO_REQUIRED)`);
    process.exit(2);
  }

  // 🔴 base 必須是 HEAD 的**真**祖先(proper ancestor):
  //    ① 不是祖先 → `base...HEAD` 的 merge-base 不是使用者以為的那個點,committed
  //       diff 失真
  //    ② 就是 HEAD 本身 → committed diff **由構造上必為空**,已 commit 的安全改動全
  //       部隱形(第一版只做 ①,而 `git merge-base --is-ancestor HEAD HEAD` 為真,所以
  //       `--base=HEAD` 這條路照樣過)
  //    兩者都 fail-closed。合法「還沒有任何 commit、全部在工作樹」的情境會落到 ②,
  //    那時多跑一輪安全審是可接受的代價(Step 4.5 本來就排在有 commit 之後)。
  try {
    execSync(`git merge-base --is-ancestor ${base} HEAD`, { stdio: 'pipe' });
  } catch {
    console.log(
      `CSO_REQUIRED(fail-closed:base=${base} 不是 HEAD 的祖先,committed diff 會失真)`
    );
    process.exit(2);
  }
  try {
    const baseSha = execSync(`git rev-parse ${base}^{commit}`, { encoding: 'utf-8' }).trim();
    const headSha = execSync('git rev-parse HEAD^{commit}', { encoding: 'utf-8' }).trim();
    if (baseSha === headSha) {
      console.log(
        `CSO_REQUIRED(fail-closed:base=${base} 就是 HEAD,committed diff 必為空 → 無法判定已 commit 的改動)`
      );
      process.exit(2);
    }
  } catch {
    console.log(`CSO_REQUIRED(fail-closed:無法解析 base=${base} 或 HEAD)`);
    process.exit(2);
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

// 只在直接 invoke 時跑 main(unit test import 時跳過)。ESM 下沒有 `require.main`,
// 用 `pathToFileURL(process.argv[1]).href === import.meta.url` 才能可靠判斷。
const invokedPath = process.argv[1];
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  main();
}
