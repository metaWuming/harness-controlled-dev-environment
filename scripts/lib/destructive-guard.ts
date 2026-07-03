// scripts/lib/destructive-guard.ts
//
// Shared safety guard for destructive scripts (wipe-* / cleanup-*).
// 防誤觸 prod 炸資料的三層 + dry-run default 共四層防護:
//
//   1. NODE_ENV=production → abort
//   2. DATABASE_URL 含 'prod' / 'production' → abort(後備防線,managed DB URL 可能不含此字串)
//   3. 必須設 <FLAG_ENV>=1 環境變數
//   4. 必須帶 --confirm=<CONFIRM_TOKEN> CLI token
//
// dry-run default(--apply 才真執行):
//   - 不帶 --apply:回傳 isApply=false,script 應只印計畫不執行 destructive ops
//   - 帶 --apply:回傳 isApply=true,script 真執行刪除
//
// 用法:
//   import { requireDestructiveConfirmation } from './lib/destructive-guard';
//   const { isApply } = requireDestructiveConfirmation('cleanup-test-data');
//   if (!isApply) {
//     console.log('🔍 將刪除...(dry-run,實際執行加 --apply)');
//     return;
//   }
//   // 真執行
//
// 完整呼叫(以預設常數為例):
//   PROJECT_DESTRUCTIVE_OK=1 npx tsx scripts/cleanup-test-data.ts --confirm=PROJECT-PROD --apply

// ⚠️ 導入時改成你的專案名(獨一無二的 flag/token,防止跨專案 shell env 殘留誤放行):
//   例:MYSHOP_DESTRUCTIVE_OK / --confirm=MYSHOP-PROD
const FLAG_ENV = 'PROJECT_DESTRUCTIVE_OK';
const CONFIRM_TOKEN = 'PROJECT-PROD';

export type DestructiveConfirmationResult = {
  isApply: boolean;
};

export type DestructiveGuardOptions = {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  exitFn?: (code: number) => never;
  logFn?: (msg: string) => void;
  errorFn?: (msg: string) => void;
};

/**
 * 守 destructive script 的四層防護(production env / DB URL / env var / CLI token)+ dry-run default。
 *
 * Script 引用後,任何一道防線未過直接 process.exit(1)(預設行為,可注入 exitFn 給 test)。
 * 回傳 `isApply` 標示是否真執行(false = dry-run mode)。
 *
 * @param scriptName 用於錯誤訊息辨識(e.g. 'cleanup-test-data')
 * @param opts 注入點(test 用):argv / env / exitFn / logFn / errorFn 預設讀 process / console
 */
export function requireDestructiveConfirmation(
  scriptName: string,
  opts: DestructiveGuardOptions = {}
): DestructiveConfirmationResult {
  const argv = opts.argv ?? process.argv;
  const env = opts.env ?? process.env;
  const exitFn = opts.exitFn ?? ((code: number) => process.exit(code));
  // 狀態訊息(DRY-RUN / APPLY)走 stderr,避免被 stdout pipe 吃掉
  // (sender 預期 stdout = data;status/diagnostic 走 stderr)
  const error = opts.errorFn ?? ((msg: string) => console.error(msg));
  const log = opts.logFn ?? ((msg: string) => console.error(msg));

  // 1. Production NODE_ENV block
  // 大小寫 / 前後空白容忍 — `Production` / `PRODUCTION` / `production ` 都該擋
  const nodeEnv = env.NODE_ENV?.toLowerCase().trim();
  if (nodeEnv === 'production') {
    error(`❌ NODE_ENV=${env.NODE_ENV} (normalized=production),${scriptName} 拒絕執行(destructive ops 不可跑 prod)`);
    exitFn(1);
    // unreachable in real run; test exitFn 可能不會 throw
    return { isApply: false };
  }

  // 2. DATABASE_URL prod hostname check(後備防線)
  // DATABASE_URL 未設 → abort(不該 silent 過關;防 DB client 連線失敗被誤判為「安全 dry-run」)
  const dbUrl = env.DATABASE_URL ?? '';
  if (!dbUrl) {
    error(`❌ ${scriptName}:DATABASE_URL 未設,abort(防 DB 連線失敗被誤判為「安全 dry-run」)`);
    exitFn(1);
    return { isApply: false };
  }
  if (/prod(uction)?/i.test(dbUrl)) {
    error(`❌ ${scriptName}:偵測到 DATABASE_URL 含 prod / production,abort`);
    // mask password 段(cover password 含 colon 的 case,
    // e.g. `postgresql://user:pa:ss@host/db` 若只用 `/:[^:@]+@/` 只 mask 最後 `:ss@`,
    // 保留 `pa` 在 log 中 leak。改用「//user:」起頭到「@」前全部 mask)
    const masked = dbUrl.replace(/(\/\/[^:/@]+:)[^@]+@/, '$1***@');
    error(`   DB URL:${masked}`);
    exitFn(1);
    return { isApply: false };
  }

  // 3. FLAG_ENV env var gate
  if (env[FLAG_ENV] !== '1') {
    error(`❌ ${scriptName}:需設 ${FLAG_ENV}=1 環境變數才能跑`);
    error(`   範例:${FLAG_ENV}=1 npx tsx scripts/${scriptName}.ts --confirm=${CONFIRM_TOKEN} --apply`);
    exitFn(1);
    return { isApply: false };
  }

  // 4. --confirm=<CONFIRM_TOKEN> CLI token
  if (!argv.includes(`--confirm=${CONFIRM_TOKEN}`)) {
    error(`❌ ${scriptName}:需帶 --confirm=${CONFIRM_TOKEN} token 明確確認`);
    error(`   範例:${FLAG_ENV}=1 npx tsx scripts/${scriptName}.ts --confirm=${CONFIRM_TOKEN} --apply`);
    exitFn(1);
    return { isApply: false };
  }

  // 5. --apply flag(dry-run default)
  // detect `--apply=value` 變體 → reject(防使用者誤打 --apply=true
  // 然後以為要設值,結果 silently 當 dry-run。下次同條 cmd 用對的 --apply → 「咦剛剛
  // 怎麼這次就真刪了」誤導場景)
  const applyWithValue = argv.find((a) => a !== '--apply' && a.startsWith('--apply='));
  if (applyWithValue) {
    error(`❌ ${scriptName}:--apply 不接 value(你寫了「${applyWithValue}」),寫 --apply 就好`);
    exitFn(1);
    return { isApply: false };
  }
  const isApply = argv.includes('--apply');
  if (!isApply) {
    log(`🔍 ${scriptName}:DRY-RUN 模式(無 --apply flag,只印計畫不實際執行)`);
  } else {
    log(`⚠️  ${scriptName}:APPLY 模式,即將實際執行 destructive ops`);
  }

  return { isApply };
}
