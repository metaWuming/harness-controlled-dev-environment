/**
 * scripts/safe-migrate.ts — Production / Dev Prisma migration wrapper
 *
 * 給人類 + AI 跑的安全包裝,**不取代** scripts/ci-migrate.sh(CI 用)。
 *
 * 自動化兩條實戰教訓:
 *   教訓 1:操作 prod migration 前必先 `ls -la .env*` 盤點既有 env 檔,
 *           不要重建臨時 env 檔(容易漏 key / 打錯值)
 *   教訓 2:Prod DATABASE_URL 必須是 pooler hostname
 *           (`*.pooler.supabase.com`),不能用 direct
 *           `db.XXX.supabase.co`(IPv6-only,本機常不通)
 *
 * Usage(建議在主 repo package.json 掛對應 npm scripts):
 *   npm run migrate:status [dev|prod]   # 只看 status,不執行
 *   npm run migrate:dev                  # 跑 prisma migrate dev(用 DIRECT_URL)
 *   npm run migrate:prod                 # 跑 prisma migrate deploy(用 pooler DATABASE_URL)
 *
 * Flags:
 *   --yes        跳過 prod 二次確認(CI 環境必需)
 *   --dry-run    跑 prisma migrate diff 印 SQL,不執行 deploy
 *   --verbose    印 masked URL debug
 *
 * 若 wrapper 自己出問題,fallback 走你專案 runbook 的手動步驟。
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

// ============================================================================
// 純函式(對應 tests/safe-migrate.test.ts)
// ============================================================================

/**
 * 極簡 .env parser(模板刻意不依賴 dotenv,少一個安裝需求)。
 * 支援:KEY=value、單/雙引號包值、# 註解行、空行。
 * **不**碰 process.env;呼叫者透過 spawn 的 env option 顯式傳值,
 * 避免污染後續 script。
 */
export function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/**
 * 從 postgresql:// URL 拿 hostname。malformed → throw。
 */
export function extractHostname(postgresUrl: string): string {
  if (!postgresUrl) {
    throw new Error('extractHostname: 空字串');
  }
  // URL 物件能正確 parse `postgresql://` + URL-encoded password
  const parsed = new URL(postgresUrl);
  if (!parsed.hostname) {
    throw new Error(`extractHostname: 無法解析 hostname from "${postgresUrl}"`);
  }
  return parsed.hostname;
}

/**
 * 守教訓 2:Prod URL 必須是 pooler。
 * - pooler hostname(`*.pooler.supabase.com`)→ ok
 * - direct hostname(`db.XXX.supabase.co`)→ 拒絕(IPv6-only,本機不通)
 * - localhost / 其他 → 拒絕(不可能是 production)
 */
export function validateProdDatabaseUrl(url: string): {
  ok: boolean;
  reason?: string;
} {
  if (!url) {
    return { ok: false, reason: 'DATABASE_URL 是空的' };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (err) {
    return {
      ok: false,
      reason: `URL 格式錯誤: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const host = parsed.hostname;
  // Supabase pooler 預設 port:session pooler 5432 / transaction pooler 6543
  // postgres 預設 port = 5432;parsed.port 空字串時要當 5432
  const port = parsed.port === '' ? '5432' : parsed.port;

  if (host.endsWith('.pooler.supabase.com')) {
    // /review adversarial P2:pooler URL 沒明寫 port 是可疑信號
    // (Supabase 文件給的 pooler URL 都明寫 :5432 或 :6543)。空 port 拒絕。
    if (parsed.port === '') {
      return {
        ok: false,
        reason: `pooler hostname "${host}" 未明寫 port — Supabase 給的 pooler URL 都含 :5432 (session) 或 :6543 (transaction)。請補上明確 port`,
      };
    }
    // Codex review P2:transaction pooler(:6543)不適合 prisma migrate(沒 advisory locks)
    if (port === '6543') {
      return {
        ok: false,
        reason: `hostname "${host}:${port}" 是 transaction pooler(port 6543),不支援 advisory locks → prisma migrate 會 deadlock 或失敗。Production migrate 必須走 session pooler(port 5432)`,
      };
    }
    if (port !== '5432') {
      return {
        ok: false,
        reason: `pooler 非預期 port "${port}",production migrate 預期 session pooler port 5432`,
      };
    }
    return { ok: true };
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return {
      ok: false,
      reason: `hostname "${host}" 不可能是 production`,
    };
  }
  // 典型 direct: db.XXXX.supabase.co
  if (host.endsWith('.supabase.co')) {
    return {
      ok: false,
      reason: `hostname "${host}" 是 direct(IPv6-only,本機 IPv6 不通會 P1001)。production migrate 必須走 pooler hostname(*.pooler.supabase.com)`,
    };
  }
  return {
    ok: false,
    reason: `未知 hostname "${host}",不是 pooler。production migrate 必須走 *.pooler.supabase.com`,
  };
}

// ============================================================================
// CLI 主邏輯
// ============================================================================

type Mode = 'dev' | 'prod';
type Command = 'status' | 'migrate';

interface CliOptions {
  command: Command;
  mode: Mode;
  yes: boolean;
  dryRun: boolean;
  verbose: boolean;
}

function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    if (u.username) u.username = '***';
    return u.toString();
  } catch {
    return '<unparseable>';
  }
}

const KNOWN_FLAGS = ['--yes', '--dry-run', '--verbose'] as const;

export function parseArgs(argv: string[]): CliOptions {
  // argv[0] 是 'status' / 'dev' / 'prod'(由 npm script 帶入)
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flags = argv.filter((a) => a.startsWith('--'));

  // Codex review P1:fail closed on unknown flags(避免 `--dryrun` typo 被
  // silently ignore 後 wrapper 還是跑 migrate deploy)
  const unknown = flags.filter(
    (f) => !KNOWN_FLAGS.includes(f as (typeof KNOWN_FLAGS)[number]),
  );
  if (unknown.length > 0) {
    throw new Error(
      `未知 flag: ${unknown.join(', ')}\n` +
        `支援的 flag: ${KNOWN_FLAGS.join(', ')}`,
    );
  }

  let command: Command;
  let mode: Mode;
  const first = positional[0];

  if (first === 'status') {
    command = 'status';
    const second = positional[1];
    if (second !== 'dev' && second !== 'prod') {
      throw new Error('用法: status [dev|prod]');
    }
    mode = second;
  } else if (first === 'dev' || first === 'prod') {
    command = 'migrate';
    mode = first;
  } else {
    throw new Error(
      `未知命令 "${first ?? '(空)'}"。用法:\n` +
        '  npm run migrate:status [dev|prod]\n' +
        '  npm run migrate:dev\n' +
        '  npm run migrate:prod [-- --yes] [-- --dry-run]',
    );
  }

  return {
    command,
    mode,
    yes: flags.includes('--yes'),
    dryRun: flags.includes('--dry-run'),
    verbose: flags.includes('--verbose'),
  };
}

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    throw new Error(
      `找不到 env 檔: ${path}\n` +
        `原則:不要重建臨時 env 檔。\n` +
        `預期既有檔案: dev → .env.local / prod → .env.production`,
    );
  }
  const content = readFileSync(path, 'utf-8');
  return parseEnvFile(content);
}

function listEnvFiles(): void {
  console.log('\n=== ls -la .env*(先盤點既有 env 檔)===');
  const ls = spawnSync('ls', ['-la'], { encoding: 'utf-8' });
  if (ls.stdout) {
    const envLines = ls.stdout
      .split('\n')
      .filter((line) => / \.env/.test(line) || /^total /.test(line));
    console.log(envLines.join('\n'));
  }
  console.log('');
}

async function confirmProd(yes: boolean): Promise<boolean> {
  if (yes) {
    console.log('⚠️  --yes 已指定,跳過二次確認');
    return true;
  }
  if (!input.isTTY) {
    console.error(
      '✗ 非 interactive 環境(stdin 不是 TTY)。CI 或 pipe 必須加 --yes flag,例:\n' +
        '  npm run migrate:prod -- --yes',
    );
    return false;
  }
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(
      '\n⚠️  即將在 PRODUCTION 跑 migration。\n   確定請輸入 yes(不接受 y/Y):',
    );
    return answer.trim() === 'yes';
  } catch (err) {
    // /review adversarial P2:Ctrl-C 時 readline 拋 AbortError;吞掉、報「已取消」
    // 而非 fall through 到外層 main 的 printFailureHint(那段是給 prisma 失敗用的)
    if (err instanceof Error && (err.name === 'AbortError' || err.name === 'ERR_USE_AFTER_CLOSE')) {
      console.log('\n已取消(收到中斷)。');
      return false;
    }
    throw err;
  } finally {
    rl.close();
  }
}

function runPrisma(
  args: string[],
  databaseUrl: string,
  verbose: boolean,
): number {
  if (verbose) {
    console.log(`\n→ npx prisma ${args.join(' ')}`);
    console.log(`  DATABASE_URL: ${maskUrl(databaseUrl)}`);
  }
  const result = spawnSync('npx', ['prisma', ...args], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  return result.status ?? 1;
}

function runPrismaCaptured(
  args: string[],
  databaseUrl: string,
): { code: number; stdout: string; stderr: string; signal?: NodeJS.Signals } {
  const result = spawnSync('npx', ['prisma', ...args], {
    encoding: 'utf-8',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    signal: result.signal ?? undefined,
  };
}

/**
 * Codex review round 2 P2 守門:`prisma migrate status` 在以下情況都會 exit 非 0:
 *   - 有 pending migration(正常情況,wrapper 主要 use case)
 *   - DB drift(production schema 跟 migration history 對不上)
 *   - 有 failed migration(上一次 deploy 半途死掉)
 *
 * 第 1 種應該繼續 deploy(那就是 wrapper 要做的事);第 2、3 種應該 abort。
 * 純 exit code 區分不了,必須 parse output。
 *
 * 純函式給 vitest 測。
 */
export function interpretMigrateStatus(
  stdout: string,
  exitCode: number,
): { healthy: boolean; reason?: string } {
  if (exitCode === 0) {
    return { healthy: true };
  }
  // Drift / failed migration 的訊號(prisma migrate status output 慣用詞)
  if (/[Dd]rift detected/.test(stdout)) {
    return {
      healthy: false,
      reason: 'Drift detected — production schema 跟 migration history 對不上,先解 drift 再 deploy',
    };
  }
  if (/failed migration|in a failed state|migration is in failed state/i.test(stdout)) {
    return {
      healthy: false,
      reason: '有 failed migration — 上次 deploy 中途失敗,先用 `prisma migrate resolve` 處理才能繼續',
    };
  }
  // exit 非 0 但 output 看起來是 pending migrations → 正常的 wrapper use case
  if (/have not yet been applied|not yet been applied|Following migrations/i.test(stdout)) {
    return { healthy: true };
  }
  // 其他不認得的 non-zero exit → 保守 abort
  return {
    healthy: false,
    reason: `prisma migrate status exit code ${exitCode},輸出無法辨識 healthy / drift。為安全 abort,請手動跑 \`prisma migrate status\` 看細節`,
  };
}

function printFailureHint(mode: Mode): void {
  console.error('\n=== 失敗 ===');
  console.error('下一步建議:');
  console.error(
    `  1. 手動跑 prisma migrate status 看 DB 當前狀態:`,
  );
  if (mode === 'prod') {
    console.error('     set -a; source .env.production; set +a');
    console.error('     npx prisma migrate status');
  } else {
    console.error('     set -a; source .env.local; set +a');
    console.error(
      '     DATABASE_URL=$DIRECT_URL npx prisma migrate status',
    );
  }
  console.error('  2. 查 Supabase dashboard log');
  console.error(
    '  3. 讀你專案的 runbook 與教訓紀錄',
  );
}

async function runDev(opts: CliOptions): Promise<number> {
  const env = loadEnvFile('.env.local');
  const directUrl = env.DIRECT_URL;
  if (!directUrl) {
    console.error('✗ .env.local 內缺少 DIRECT_URL key');
    return 1;
  }

  // Dev migrate 走 DIRECT_URL(dev 走 pooler 會卡 stdin)
  if (opts.verbose) {
    console.log(`Dev mode → DATABASE_URL = $DIRECT_URL(${maskUrl(directUrl)})`);
  }

  if (opts.command === 'status') {
    return runPrisma(['migrate', 'status'], directUrl, opts.verbose);
  }
  if (opts.dryRun) {
    return runPrisma(
      [
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
      ],
      directUrl,
      opts.verbose,
    );
  }
  return runPrisma(['migrate', 'dev'], directUrl, opts.verbose);
}

async function runProd(opts: CliOptions): Promise<number> {
  // Step 1: ls -la .env*(先盤點既有 env 檔)
  listEnvFiles();

  // Step 2: load .env.production
  const env = loadEnvFile('.env.production');
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) {
    console.error('✗ .env.production 內缺少 DATABASE_URL key');
    return 1;
  }

  // Step 3-5: 驗證 hostname 是 pooler(教訓 2)
  const validation = validateProdDatabaseUrl(dbUrl);
  if (!validation.ok) {
    console.error(`✗ DATABASE_URL 驗證失敗: ${validation.reason}`);
    return 1;
  }
  console.log(`✓ DATABASE_URL hostname 驗證通過(${extractHostname(dbUrl)})`);

  // Step 6: 預跑 status
  // - command === 'status':直接 stream(user 看完就 done)
  // - command === 'migrate':capture 後 parse,守 Codex round 2 P2(drift /
  //   failed migration 不該繼續 deploy)
  console.log('\n=== 預跑 migrate status ===');
  if (opts.command === 'status') {
    return runPrisma(['migrate', 'status'], dbUrl, opts.verbose);
  }

  const status = runPrismaCaptured(['migrate', 'status'], dbUrl);
  // 把 prisma 原始輸出印出來,user 仍看得到 pending list
  if (status.stdout) process.stdout.write(status.stdout);
  if (status.stderr) process.stderr.write(status.stderr);

  // /review adversarial P2:signal-killed(eg. Ctrl-C 預跑 status)→ status.code
  // null 預設成 1,partial stdout 可能誤判 healthy。直接 abort。
  if (status.signal) {
    console.error(`\n✗ Preflight 被信號 ${status.signal} 中斷,abort production migration`);
    return 1;
  }

  // /review adversarial P2:concat stdout + stderr,因為 Prisma 7 部分 status
  // 訊息(尤其 stderr)可能去 stderr 不是 stdout
  const combined = status.stdout + '\n' + status.stderr;
  const verdict = interpretMigrateStatus(combined, status.code);
  if (!verdict.healthy) {
    console.error(`\n✗ Preflight 失敗:${verdict.reason}`);
    return 1;
  }

  // Step 7-8: 二次確認(prod migrate 才需要,status 不要)
  if (opts.dryRun) {
    console.log('\n=== --dry-run: 印 migrate diff(不執行 deploy)===');
    return runPrisma(
      [
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
      ],
      dbUrl,
      opts.verbose,
    );
  }

  const confirmed = await confirmProd(opts.yes);
  if (!confirmed) {
    console.log('已取消 production migration。');
    return 1;
  }

  // Step 9: 跑 migrate deploy
  console.log('\n=== 跑 prisma migrate deploy ===');
  return runPrisma(['migrate', 'deploy'], dbUrl, opts.verbose);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.verbose) {
    console.log(`safe-migrate: command=${opts.command} mode=${opts.mode}`);
  }

  let exitCode: number;
  try {
    exitCode = opts.mode === 'dev' ? await runDev(opts) : await runProd(opts);
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    printFailureHint(opts.mode);
    process.exit(1);
  }

  if (exitCode !== 0) {
    printFailureHint(opts.mode);
  }
  process.exit(exitCode);
}

// 只在直接執行時跑 main(被測試 import 時不跑)
// 用 import.meta.url 判斷(ESM 慣例);若 tsx 在某些 setup 下不傳 main flag,
// 退一步用 argv[1] 是否包含本檔名作為 fallback。
const isDirectRun =
  (import.meta as any).main === true ||
  process.argv[1]?.endsWith('safe-migrate.ts') ||
  process.argv[1]?.endsWith('safe-migrate.js');

if (isDirectRun) {
  void main();
}
