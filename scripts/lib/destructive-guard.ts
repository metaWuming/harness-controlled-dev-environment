// scripts/lib/destructive-guard.ts
//
// Shared safety guard for destructive scripts (wipe-* / cleanup-*).
// 防誤觸 prod 炸資料的 6 層 + dry-run default:
//
//   1. NODE_ENV=production → abort
//   2. DATABASE_URL 含 'prod' / 'production' → abort(後備防線,managed DB URL 可能不含此字串)
//   3. 必須設 <FLAG_ENV>=1 環境變數
//   4. 必須帶 --confirm=<CONFIRM_TOKEN> CLI token
//   5. (Sprint 20 C2)declared target identity allowlist mismatch alarm:parse DATABASE_URL
//      hostname/optional dbname、對照 destructive-guard.config.ts adopter-declared allowlist、
//      mismatch → abort。**未導入(config = null)→ fail-closed abort**、diagnostic 引導 adopter 填 config。
//   6. (Sprint 20 C2)declared impact-scope bound alarm:若 caller 傳 `expectedMaxRowsBound`,
//      script 呼叫端必需帶 `--max-rows=<N>` CLI flag、N 為正整數、N ≤ bound。**guard 只驗 CLI flag、
//      不驗實際 DELETE affected count**(caller responsibility);未帶 / 超 bound / 非正整數 → abort。
//
// ⚠️ **誠實定位(承 CTRL-GUARD-001 notes 不變量 I6)**:
//   layer 1-6 是**accident interlock 加碼 + declared allowlist mismatch alarm**、
//   **非 production security boundary**。**Catches**:config-declaration mismatch、hostname/dbname
//   allowlist mismatch、CLI flag 未帶 / 超 bound。**Does NOT catch**:DNS/CNAME rewrite(URL 顯示
//   whitelist、實際連 prod)、managed DB proxy identity spoof、adopter caller runtime SQL bug、
//   caller 未 enforce actual affected count ≤ maxRows。真 runtime enforcement 需未來 sprint 加
//   DB driver + SQL 攔截 + affected count 實查、屬 out-of-scope。
//
// dry-run default(--apply 才真執行):
//   - 不帶 --apply:回傳 isApply=false,script 應只印計畫不執行 destructive ops
//   - 帶 --apply:回傳 isApply=true,script 真執行刪除
//
// 用法(既有 4-layer):
//   import { requireDestructiveConfirmation } from './lib/destructive-guard';
//   const { isApply } = requireDestructiveConfirmation('cleanup-test-data');
//
// 用法(Sprint 20 C2 加 layer 6 impact-scope):
//   const { isApply, maxRows } = requireDestructiveConfirmation('cleanup-test-data', undefined, 10000);
//   // maxRows 是 CLI --max-rows=<N> parsed value(N ≤ bound)、caller 需自 enforce actual DELETE ≤ N
//
// 完整呼叫(以預設常數 + max-rows 為例):
//   PROJECT_DESTRUCTIVE_OK=1 npx tsx scripts/cleanup-test-data.ts --confirm=PROJECT-PROD --apply --max-rows=1000

import { EXPECTED_TARGET_IDENTITY, type ExpectedTargetIdentity } from '../destructive-guard.config';

// ⚠️ 導入時改成你的專案名(獨一無二的 flag/token,防止跨專案 shell env 殘留誤放行):
//   例:MYSHOP_DESTRUCTIVE_OK / --confirm=MYSHOP-PROD
const FLAG_ENV = 'PROJECT_DESTRUCTIVE_OK';
const CONFIRM_TOKEN = 'PROJECT-PROD';

/**
 * FIX-2:將 DATABASE_URL 內的密碼安全遮罩,供 diagnostic stderr echo。
 *
 * **緣起**:原本用單一 regex `(\/\/[^:/@]+:)[^@]+@/` 對 password mask,對合法 URL
 * (percent-encoded / colon-in-password)都能處理,但輸入含 raw `@` 時
 * (e.g. `postgresql://user:secret@tail@prod-host/db`)regex `[^@]+` 只 match 到第一個
 * `@`,`tail@prod-host` 的 `tail`(密碼真實尾段)仍會 leak 到 diagnostic。
 *
 * **修法**:改用 WHATWG URL parser。parser 對 raw `@` 的 spec 行為是把中間 `@`
 * percent-encode 成 `%40` 併入 password field,遮 password 後 password 完全消失。
 * URL parse 失敗時完全不 echo 原輸入(可能含 credential),回固定 fallback string。
 *
 * **語意**:保留 username 不遮(對齊既有 diagnostic 「user:***@host」慣例)。
 */
function maskDbUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '<unparseable URL — 完整內容已遮蔽,防 credential leak>';
  }
}

export type DestructiveConfirmationResult = {
  isApply: boolean;
  /** Sprint 20 C2:layer 6 driven — 若 caller 傳 expectedMaxRowsBound、此為 CLI 帶入 --max-rows 值;
   *  layer 6 未觸發時 null。**caller responsibility**:actual DELETE affected count ≤ maxRows(guard 不驗)。 */
  maxRows: number | null;
};

export type DestructiveGuardOptions = {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  exitFn?: (code: number) => never;
  logFn?: (msg: string) => void;
  errorFn?: (msg: string) => void;
};

/**
 * Sprint 20 C2 injectable pure helper:接 config 為參數、tests 用來注入不同 variants。
 * CLI entry 用下方 `requireDestructiveConfirmation` static-import shipped config。
 */
export function requireDestructiveConfirmationWithConfig(
  scriptName: string,
  config: ExpectedTargetIdentity,
  opts: DestructiveGuardOptions = {},
  expectedMaxRowsBound?: number,
): DestructiveConfirmationResult {
  return _guardImpl(scriptName, config, opts, expectedMaxRowsBound);
}

/**
 * 守 destructive script 的 6 層防護(承 layer 1-4 accident interlock + Sprint 20 C2 layer 5-6
 * declaration allowlist mismatch alarm)+ dry-run default。
 *
 * Script 引用後,任何一道防線未過直接 process.exit(1)(預設行為,可注入 exitFn 給 test)。
 * 回傳 `isApply` 標示是否真執行(false = dry-run mode)+ `maxRows`(layer 6 觸發時的 CLI --max-rows 值)。
 *
 * @param scriptName 用於錯誤訊息辨識(e.g. 'cleanup-test-data')
 * @param opts 注入點(test 用):argv / env / exitFn / logFn / errorFn 預設讀 process / console
 * @param expectedMaxRowsBound (Sprint 20 C2)若 script 想觸發 layer 6,傳入 adopter-declared bound;
 *                              undefined 表示不觸發 layer 6(向下相容 4-layer 用法)。
 */
export function requireDestructiveConfirmation(
  scriptName: string,
  opts: DestructiveGuardOptions = {},
  expectedMaxRowsBound?: number,
): DestructiveConfirmationResult {
  return _guardImpl(scriptName, EXPECTED_TARGET_IDENTITY, opts, expectedMaxRowsBound);
}

function _guardImpl(
  scriptName: string,
  config: ExpectedTargetIdentity,
  opts: DestructiveGuardOptions,
  expectedMaxRowsBound: number | undefined,
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
    return { isApply: false, maxRows: null };
  }

  // 2. DATABASE_URL prod hostname check(後備防線)
  // DATABASE_URL 未設 → abort(不該 silent 過關;防 DB client 連線失敗被誤判為「安全 dry-run」)
  const dbUrl = env.DATABASE_URL ?? '';
  if (!dbUrl) {
    error(`❌ ${scriptName}:DATABASE_URL 未設,abort(防 DB 連線失敗被誤判為「安全 dry-run」)`);
    exitFn(1);
    return { isApply: false, maxRows: null };
  }
  if (/prod(uction)?/i.test(dbUrl)) {
    error(`❌ ${scriptName}:偵測到 DATABASE_URL 含 prod / production,abort`);
    // FIX-2:用 WHATWG URL parser 遮 password(regex 對 raw `@` in password 會 leak
    // 尾段,e.g. `secret@tail@prod-host` 只 mask 到第一個 `@`)
    error(`   DB URL:${maskDbUrl(dbUrl)}`);
    exitFn(1);
    return { isApply: false, maxRows: null };
  }

  // 3. FLAG_ENV env var gate
  if (env[FLAG_ENV] !== '1') {
    error(`❌ ${scriptName}:需設 ${FLAG_ENV}=1 環境變數才能跑`);
    error(`   範例:${FLAG_ENV}=1 npx tsx scripts/${scriptName}.ts --confirm=${CONFIRM_TOKEN} --apply`);
    exitFn(1);
    return { isApply: false, maxRows: null };
  }

  // 4. --confirm=<CONFIRM_TOKEN> CLI token
  if (!argv.includes(`--confirm=${CONFIRM_TOKEN}`)) {
    error(`❌ ${scriptName}:需帶 --confirm=${CONFIRM_TOKEN} token 明確確認`);
    error(`   範例:${FLAG_ENV}=1 npx tsx scripts/${scriptName}.ts --confirm=${CONFIRM_TOKEN} --apply`);
    exitFn(1);
    return { isApply: false, maxRows: null };
  }

  // 5. --apply flag(dry-run default)
  // detect `--apply=value` 變體 → reject(防使用者誤打 --apply=true
  // 然後以為要設值,結果 silently 當 dry-run。下次同條 cmd 用對的 --apply → 「咦剛剛
  // 怎麼這次就真刪了」誤導場景)
  const applyWithValue = argv.find((a) => a !== '--apply' && a.startsWith('--apply='));
  if (applyWithValue) {
    error(`❌ ${scriptName}:--apply 不接 value(你寫了「${applyWithValue}」),寫 --apply 就好`);
    exitFn(1);
    return { isApply: false, maxRows: null };
  }
  const isApply = argv.includes('--apply');

  // Sprint 20 C2 layer 5:declared target identity allowlist mismatch alarm
  // (accident interlock 加碼、非 production security boundary;參 檔頭 threat model 明列)
  if (config === null) {
    error(`❌ ${scriptName}:destructive-guard.config.ts EXPECTED_TARGET_IDENTITY 未導入(null)`);
    error(`   adopter 需在 scripts/destructive-guard.config.ts 明列 { allowedHosts: [...], allowedDbNames?: [...] }`);
    error(`   詳見 docs/ADOPTION.md §5.1 runbook`);
    exitFn(1);
    return { isApply: false, maxRows: null };
  }
  // Parse DATABASE_URL(URL API normalize hostname to lowercase、handle IPv6/port/percent-encoding)
  let target: { host: string; dbname: string };
  try {
    const parsed = new URL(dbUrl);
    const rawDb = parsed.pathname.startsWith('/') ? parsed.pathname.slice(1) : parsed.pathname;
    let dbname: string;
    try {
      dbname = decodeURIComponent(rawDb);
    } catch {
      error(`❌ ${scriptName}:DATABASE_URL dbname 含 invalid percent-encoding`);
      exitFn(1);
      return { isApply: false, maxRows: null };
    }
    target = { host: parsed.hostname, dbname };
  } catch {
    // FIX-2 defense-in-depth:URL parse 失敗表示原輸入 malformed,e.message 及原輸入都
    // 可能含 credential(現行 Node "Invalid URL" 不含 input,但未來版本可能改)。
    // 不 echo 原輸入或 error message,直接印固定字串,pin case 3d/3e 的
    // `toMatch(/invalid URL/)` 與 `not.toMatch(/secret/)` 合約。
    error(`❌ ${scriptName}:DATABASE_URL invalid URL(內容已遮蔽,防 credential leak)`);
    exitFn(1);
    return { isApply: false, maxRows: null };
  }
  // Compare hostname(lowercase-normalize allowlist、target 已 URL-normalized)
  const allowedHosts = config.allowedHosts.map((h) => h.toLowerCase());
  if (allowedHosts.length === 0) {
    error(`❌ ${scriptName}:destructive-guard.config.ts allowedHosts 空陣列(adopter 需明列)`);
    exitFn(1);
    return { isApply: false, maxRows: null };
  }
  if (!allowedHosts.includes(target.host)) {
    error(`❌ ${scriptName}:layer 5 mismatch — DATABASE_URL host ${JSON.stringify(target.host)} 不在 allowedHosts ${JSON.stringify(allowedHosts)}`);
    exitFn(1);
    return { isApply: false, maxRows: null };
  }
  // Compare dbname(optional)
  if (config.allowedDbNames && config.allowedDbNames.length > 0) {
    if (!config.allowedDbNames.includes(target.dbname)) {
      error(`❌ ${scriptName}:layer 5 mismatch — DATABASE_URL dbname ${JSON.stringify(target.dbname)} 不在 allowedDbNames ${JSON.stringify(config.allowedDbNames)}`);
      exitFn(1);
      return { isApply: false, maxRows: null };
    }
  }

  // Sprint 20 C2 layer 6:declared impact-scope bound alarm
  // (declared CLI flag check 而已、caller responsibility enforce actual DELETE count)
  let maxRows: number | null = null;
  if (expectedMaxRowsBound !== undefined && isApply) {
    const maxRowsArg = argv.find((a) => a.startsWith('--max-rows='));
    if (!maxRowsArg) {
      error(`❌ ${scriptName}:layer 6 未帶 --max-rows=<N> CLI flag(--apply 時 adopter-declared bound=${expectedMaxRowsBound})`);
      exitFn(1);
      return { isApply: false, maxRows: null };
    }
    const raw = maxRowsArg.slice('--max-rows='.length);
    // 非正整數 → fail:必須全 digit + parseInt > 0
    if (!/^[1-9]\d*$/.test(raw)) {
      error(`❌ ${scriptName}:layer 6 --max-rows 值 ${JSON.stringify(raw)} 非正整數`);
      exitFn(1);
      return { isApply: false, maxRows: null };
    }
    const n = parseInt(raw, 10);
    if (n > expectedMaxRowsBound) {
      error(`❌ ${scriptName}:layer 6 --max-rows=${n} 超 adopter-declared bound=${expectedMaxRowsBound}`);
      exitFn(1);
      return { isApply: false, maxRows: null };
    }
    maxRows = n;
    log(`ℹ️  ${scriptName}:本 guard 不驗實際 DELETE 數、caller 責任 enforce actual affected count ≤ ${maxRows}`);
  }

  if (!isApply) {
    log(`🔍 ${scriptName}:DRY-RUN 模式(無 --apply flag,只印計畫不實際執行)`);
  } else {
    log(`⚠️  ${scriptName}:APPLY 模式,即將實際執行 destructive ops`);
  }

  return { isApply, maxRows };
}
