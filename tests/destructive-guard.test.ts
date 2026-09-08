// tests/destructive-guard.test.ts
//
// 守 scripts/lib/destructive-guard.ts 四層防護 + dry-run default 的契約。
// 測試用 mock 的 exitFn / logFn / errorFn 注入點,不真 process.exit。
//
// ⚠️ 若你導入時改了 destructive-guard.ts 檔頂的 FLAG_ENV / CONFIRM_TOKEN 常數,
//   下面兩個常數要同步改(fixture 直接引用字面值,鎖「常數改了測試必紅」的契約)。

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, test, expect, it, vi } from 'vitest';
import {
  requireDestructiveConfirmation,
  requireDestructiveConfirmationWithConfig,
} from '../scripts/lib/destructive-guard';
import type { ExpectedTargetIdentity } from '../scripts/destructive-guard.config';

// Sprint 20 C2:declared allowlist(happy-path 用、避 layer 5 null gate 干擾 4-layer regression)
const DECLARED_CONFIG: ExpectedTargetIdentity = { allowedHosts: ['localhost'] };

const FLAG_ENV = 'PROJECT_DESTRUCTIVE_OK';
const CONFIRM = '--confirm=PROJECT-PROD';

type ExitError = { code: number };
function makeExitFn() {
  return vi.fn((code: number) => {
    throw { code } as ExitError;
  });
}
function makeNoExit() {
  return vi.fn() as unknown as (code: number) => never;
}

// Cast 因為部分框架把 process.env.NODE_ENV 收窄成 literal union;test fixture 不必受限
function devEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: 'development', DATABASE_URL: 'postgresql://localhost/dev', ...extra } as NodeJS.ProcessEnv;
}

describe('requireDestructiveConfirmation — 四層防護', () => {
  test('Layer 1:NODE_ENV=production → exit 1', () => {
    const exitFn = makeExitFn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', CONFIRM, '--apply'],
        env: { NODE_ENV: 'production', DATABASE_URL: 'postgresql://localhost/dev', [FLAG_ENV]: '1' } as NodeJS.ProcessEnv,
        exitFn,
        logFn: vi.fn(),
        errorFn: vi.fn(),
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
  });

  test('Layer 2:DATABASE_URL 含 prod → exit 1', () => {
    const exitFn = makeExitFn();
    const errorFn = vi.fn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', CONFIRM, '--apply'],
        env: devEnv({ DATABASE_URL: 'postgresql://prod-db.example.com/main', [FLAG_ENV]: '1' }),
        exitFn,
        logFn: vi.fn(),
        errorFn,
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
    // 錯誤訊息中的 DB URL 應 masked(no plaintext password)
    const allErrors = errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(allErrors).toContain('prod');
  });

  test('Layer 2:DATABASE_URL 含 production(全字) → exit 1', () => {
    const exitFn = makeExitFn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', CONFIRM, '--apply'],
        env: devEnv({ DATABASE_URL: 'postgresql://my-production.db/main', [FLAG_ENV]: '1' }),
        exitFn,
        logFn: vi.fn(),
        errorFn: vi.fn(),
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
  });

  test('Layer 2:DB URL 密碼會被 mask 在錯誤訊息中', () => {
    const exitFn = makeExitFn();
    const errorFn = vi.fn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: [],
        env: devEnv({ DATABASE_URL: 'postgresql://user:secret123@prod-db.example.com/main', [FLAG_ENV]: '1' }),
        exitFn,
        logFn: vi.fn(),
        errorFn,
      })
    ).toThrow();
    const allErrors = errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(allErrors).not.toContain('secret123');
    expect(allErrors).toContain(':***@');
  });

  test('Layer 2:DB URL 密碼含 colon 也要全 mask', () => {
    const exitFn = makeExitFn();
    const errorFn = vi.fn();
    // password "pa:ss:word" 含兩個 colon — 若 regex 只 mask 最後 `:word@`,
    // `pa` 會留在 log 中 leak。正確行為:「//user:」起頭到「@」前全部 mask
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: [],
        env: devEnv({ DATABASE_URL: 'postgresql://user:pa:ss:word@prod-db.example.com/main', [FLAG_ENV]: '1' }),
        exitFn,
        logFn: vi.fn(),
        errorFn,
      })
    ).toThrow();
    const allErrors = errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(allErrors).not.toContain('pa:ss:word');
    expect(allErrors).not.toContain('pa');
    expect(allErrors).not.toContain('word');
    expect(allErrors).toContain('user:***@');
  });

  test(`Layer 3:無 ${FLAG_ENV} env → exit 1`, () => {
    const exitFn = makeExitFn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', CONFIRM, '--apply'],
        env: devEnv(),
        exitFn,
        logFn: vi.fn(),
        errorFn: vi.fn(),
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
  });

  test(`Layer 3:${FLAG_ENV}=0 → exit 1(只接受 "1")`, () => {
    const exitFn = makeExitFn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', CONFIRM, '--apply'],
        env: devEnv({ [FLAG_ENV]: '0' }),
        exitFn,
        logFn: vi.fn(),
        errorFn: vi.fn(),
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
  });

  test(`Layer 3:${FLAG_ENV}=true → exit 1(只接受字串 "1")`, () => {
    const exitFn = makeExitFn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', CONFIRM, '--apply'],
        env: devEnv({ [FLAG_ENV]: 'true' }),
        exitFn,
        logFn: vi.fn(),
        errorFn: vi.fn(),
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
  });

  test('Layer 4:無 --confirm token → exit 1', () => {
    const exitFn = makeExitFn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', '--apply'],
        env: devEnv({ [FLAG_ENV]: '1' }),
        exitFn,
        logFn: vi.fn(),
        errorFn: vi.fn(),
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
  });

  test('Layer 4:--confirm=WRONG-TOKEN → exit 1', () => {
    const exitFn = makeExitFn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', '--confirm=WRONG-TOKEN', '--apply'],
        env: devEnv({ [FLAG_ENV]: '1' }),
        exitFn,
        logFn: vi.fn(),
        errorFn: vi.fn(),
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
  });

  test('全過 + 無 --apply → isApply=false(dry-run default)', () => {
    // Sprint 20 C2:injectable helper + declared config、避免 layer 5 null gate 影響 4-layer regression
    const exitFn = makeNoExit();
    const logFn = vi.fn();
    const result = requireDestructiveConfirmationWithConfig('test-script', DECLARED_CONFIG, {
      argv: ['node', 'script.ts', CONFIRM],
      env: devEnv({ [FLAG_ENV]: '1' }),
      exitFn,
      logFn,
      errorFn: vi.fn(),
    });
    expect(exitFn).not.toHaveBeenCalled();
    expect(result.isApply).toBe(false);
    const allLogs = logFn.mock.calls.map((c) => c[0]).join('\n');
    expect(allLogs).toContain('DRY-RUN');
  });

  test('全過 + 帶 --apply → isApply=true', () => {
    const exitFn = makeNoExit();
    const logFn = vi.fn();
    const result = requireDestructiveConfirmationWithConfig('test-script', DECLARED_CONFIG, {
      argv: ['node', 'script.ts', CONFIRM, '--apply'],
      env: devEnv({ [FLAG_ENV]: '1' }),
      exitFn,
      logFn,
      errorFn: vi.fn(),
    });
    expect(exitFn).not.toHaveBeenCalled();
    expect(result.isApply).toBe(true);
    const allLogs = logFn.mock.calls.map((c) => c[0]).join('\n');
    expect(allLogs).toContain('APPLY');
  });

  test('Layer 防護順序:NODE_ENV=production 優先(即使有 token + env var)', () => {
    const exitFn = makeExitFn();
    const errorFn = vi.fn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', CONFIRM, '--apply'],
        env: { NODE_ENV: 'production', DATABASE_URL: 'postgresql://localhost/dev', [FLAG_ENV]: '1' } as NodeJS.ProcessEnv,
        exitFn,
        logFn: vi.fn(),
        errorFn,
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
    const allErrors = errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(allErrors).toContain('NODE_ENV=production');
  });

  test('Layer 防護順序:NODE_ENV=development + DATABASE_URL prod → 第二層擋',  () => {
    const exitFn = makeExitFn();
    const errorFn = vi.fn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', CONFIRM, '--apply'],
        env: { NODE_ENV: 'development', DATABASE_URL: 'postgresql://prod-cluster/main', [FLAG_ENV]: '1' } as NodeJS.ProcessEnv,
        exitFn,
        logFn: vi.fn(),
        errorFn,
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
    const allErrors = errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(allErrors).toContain('prod');
  });

  // NODE_ENV 大小寫 / 空白容忍
  test.each([
    ['PRODUCTION', '大寫'],
    ['Production', '首字大寫'],
    ['production ', '末尾空白'],
    [' production', '開頭空白'],
    ['\tproduction\n', 'tab + 換行'],
  ])('Layer 1:NODE_ENV=%j (%s) 應被 normalize 後擋住', (nodeEnvValue) => {
    const exitFn = makeExitFn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', CONFIRM, '--apply'],
        env: { NODE_ENV: nodeEnvValue, DATABASE_URL: 'postgresql://localhost/dev', [FLAG_ENV]: '1' } as NodeJS.ProcessEnv,
        exitFn,
        logFn: vi.fn(),
        errorFn: vi.fn(),
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
  });

  // --apply=value 變體應 reject
  test.each([
    ['--apply=true'],
    ['--apply=force'],
    ['--apply=yes'],
    ['--apply=1'],
  ])('--apply=<value> reject:%s 防誤導 dry-run', (applyVariant) => {
    const exitFn = makeExitFn();
    const errorFn = vi.fn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', CONFIRM, applyVariant],
        env: devEnv({ [FLAG_ENV]: '1' }),
        exitFn,
        logFn: vi.fn(),
        errorFn,
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
    const allErrors = errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(allErrors).toContain('--apply 不接 value');
  });

  test('--apply-bar (不同 flag 開頭) 不該被誤判,當作 dry-run 通過', () => {
    // Sprint 20 C2:injectable helper + declared config
    const exitFn = makeNoExit();
    const result = requireDestructiveConfirmationWithConfig('test-script', DECLARED_CONFIG, {
      argv: ['node', 'script.ts', CONFIRM, '--apply-bar'],
      env: devEnv({ [FLAG_ENV]: '1' }),
      exitFn,
      logFn: vi.fn(),
      errorFn: vi.fn(),
    });
    expect(exitFn).not.toHaveBeenCalled();
    expect(result.isApply).toBe(false); // dry-run mode
  });

  // DATABASE_URL 未設應擋住,不該 silent 過關
  test('Layer 2:DATABASE_URL 未設(empty)→ abort', () => {
    const exitFn = makeExitFn();
    const errorFn = vi.fn();
    expect(() =>
      requireDestructiveConfirmation('test-script', {
        argv: ['node', 'script.ts', CONFIRM, '--apply'],
        env: { NODE_ENV: 'development', [FLAG_ENV]: '1' } as NodeJS.ProcessEnv,
        exitFn,
        logFn: vi.fn(),
        errorFn,
      })
    ).toThrow();
    expect(exitFn).toHaveBeenCalledWith(1);
    const allErrors = errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(allErrors).toContain('DATABASE_URL 未設');
  });

  // 狀態訊息走 stderr 不走 stdout
  test('狀態訊息(DRY-RUN / APPLY)預設走 stderr', () => {
    // logFn 沒注入時應走 console.error,而非 console.log
    // 用 spy 驗證
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    requireDestructiveConfirmationWithConfig('test-script', DECLARED_CONFIG, {
      argv: ['node', 'script.ts', CONFIRM, '--apply'],
      env: devEnv({ [FLAG_ENV]: '1' }),
      exitFn: makeNoExit(),
      // 不注入 logFn / errorFn,讓 default 走 console
    });

    expect(consoleLogSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    const errCalls = consoleErrorSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(errCalls).toContain('APPLY');

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

// ─────────────────────────────────────── Sprint 20 C2:layer 5-6 declaration allowlist mismatch alarm
// 承 plan r6 accepted:accident-interlock 加碼、非 production security boundary。20 unique cases、對應 14 mutation samples。

describe('Sprint 20 C2 — layer 5-6 declaration allowlist mismatch alarm', () => {
  function baseOk(overrides: {
    argv?: string[];
    env?: Record<string, string>;
  } = {}) {
    return {
      argv: ['node', 'script.ts', CONFIRM, '--apply', ...(overrides.argv ?? [])],
      env: devEnv({ [FLAG_ENV]: '1', ...(overrides.env ?? {}) }),
      exitFn: makeExitFn(),
      logFn: vi.fn(),
      errorFn: vi.fn(),
    };
  }

  it('case 1:layer 5 config = null → fail-closed exit 1、diagnostic 引導填 config', () => {
    const opts = baseOk();
    expect(() => requireDestructiveConfirmationWithConfig('test', null, opts)).toThrow();
    expect(opts.exitFn).toHaveBeenCalledWith(1);
    const err = opts.errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/EXPECTED_TARGET_IDENTITY 未導入/);
    expect(err).toMatch(/adopter 需/);
  });

  it('case 2:happy path — host match + --max-rows valid → pass with maxRows', () => {
    const opts = baseOk({ argv: ['--max-rows=100'] });
    opts.exitFn = makeNoExit() as ReturnType<typeof makeExitFn>;
    const r = requireDestructiveConfirmationWithConfig('test', { allowedHosts: ['localhost'] }, opts, 1000);
    expect(r.isApply).toBe(true);
    expect(r.maxRows).toBe(100);
  });

  it('case 3a:hostname mismatch → fail-closed diagnostic', () => {
    const opts = baseOk();
    expect(() => requireDestructiveConfirmationWithConfig('test', { allowedHosts: ['other-host'] }, opts)).toThrow();
    const err = opts.errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/layer 5 mismatch/);
    expect(err).toMatch(/localhost/);
  });

  it('case 3b:reverse fixture — URL lowercase + allowlist uppercase → guard normalize → match ok(kills P4)', () => {
    const opts = baseOk();
    opts.exitFn = makeNoExit() as ReturnType<typeof makeExitFn>;
    // URL API 自動 lowercase hostname(target='example.com')、allowlist 給 'EXAMPLE.COM'、guard 需 lowercase-normalize allowlist 才 match
    const r = requireDestructiveConfirmationWithConfig(
      'test',
      { allowedHosts: ['EXAMPLE.COM'] },
      { ...opts, env: devEnv({ [FLAG_ENV]: '1', DATABASE_URL: 'postgresql://example.com/dev' }) },
    );
    expect(r.isApply).toBe(true);
  });

  it('case 3c:IPv6 hostname parsed correctly(URL API)', () => {
    const opts = baseOk();
    opts.exitFn = makeNoExit() as ReturnType<typeof makeExitFn>;
    // IPv6 URL:hostname 含 brackets(URL API normalize as `[::1]`)
    const r = requireDestructiveConfirmationWithConfig(
      'test',
      { allowedHosts: ['[::1]'] },
      { ...opts, env: devEnv({ [FLAG_ENV]: '1', DATABASE_URL: 'postgresql://[::1]/dev' }) },
    );
    expect(r.isApply).toBe(true);
  });

  it('case 3d:port 差異不影響 compare(hostname 為主 identity)', () => {
    const opts = baseOk();
    opts.exitFn = makeNoExit() as ReturnType<typeof makeExitFn>;
    const r = requireDestructiveConfirmationWithConfig(
      'test',
      { allowedHosts: ['localhost'] },
      { ...opts, env: devEnv({ [FLAG_ENV]: '1', DATABASE_URL: 'postgresql://localhost:5433/dev' }) },
    );
    expect(r.isApply).toBe(true);
  });

  it('case 3e:invalid URL → fail-closed diagnostic 明列 error msg', () => {
    const opts = baseOk();
    expect(() =>
      requireDestructiveConfirmationWithConfig(
        'test',
        { allowedHosts: ['localhost'] },
        { ...opts, env: devEnv({ [FLAG_ENV]: '1', DATABASE_URL: 'not-a-valid-url' }) },
      ),
    ).toThrow();
    const err = opts.errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/invalid URL/);
  });

  it('case 3e-mask:invalid URL diagnostic 不 leak password(F4 defense-in-depth)', () => {
    // 目的:即使 Node 未來版本把 raw URL embed 進 URL constructor 錯誤訊息,mask 也要遮住 password。
    // 現行 Node 版本 e.message 只有 "Invalid URL"(不含 input),仍加此 test 鎖 defense-in-depth 不回退。
    const opts = baseOk();
    expect(() =>
      requireDestructiveConfirmationWithConfig(
        'test',
        { allowedHosts: ['localhost'] },
        { ...opts, env: devEnv({ [FLAG_ENV]: '1', DATABASE_URL: 'postgres://user:secret@[malformed-ipv6' }) },
      ),
    ).toThrow();
    const err = opts.errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/invalid URL/);
    expect(err).not.toMatch(/secret/);
  });

  it('case 3f:percent-encoded dbname decode ok', () => {
    const opts = baseOk();
    opts.exitFn = makeNoExit() as ReturnType<typeof makeExitFn>;
    // URL `/my%2Ddb` → dbname `my-db`
    const r = requireDestructiveConfirmationWithConfig(
      'test',
      { allowedHosts: ['localhost'], allowedDbNames: ['my-db'] },
      { ...opts, env: devEnv({ [FLAG_ENV]: '1', DATABASE_URL: 'postgresql://localhost/my%2Ddb' }) },
    );
    expect(r.isApply).toBe(true);
  });

  it('case 4:dbname undeclared(only allowedHosts)→ 任何 dbname pass', () => {
    const opts = baseOk();
    opts.exitFn = makeNoExit() as ReturnType<typeof makeExitFn>;
    const r = requireDestructiveConfirmationWithConfig(
      'test',
      { allowedHosts: ['localhost'] }, // no allowedDbNames
      opts,
    );
    expect(r.isApply).toBe(true);
  });

  it('case 5:dbname declared + mismatch → fail-closed', () => {
    const opts = baseOk();
    expect(() =>
      requireDestructiveConfirmationWithConfig('test', { allowedHosts: ['localhost'], allowedDbNames: ['staging'] }, opts),
    ).toThrow();
    const err = opts.errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/dbname.*不在 allowedDbNames/);
  });

  it('case 6:layer 6 未帶 --max-rows on --apply(bound given)→ fail', () => {
    const opts = baseOk(); // no --max-rows
    expect(() => requireDestructiveConfirmationWithConfig('test', DECLARED_CONFIG, opts, 1000)).toThrow();
    const err = opts.errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/未帶 --max-rows/);
  });

  it('case 7:layer 6 --max-rows > bound → fail;== bound → pass', () => {
    const optsOver = baseOk({ argv: ['--max-rows=1001'] });
    expect(() => requireDestructiveConfirmationWithConfig('test', DECLARED_CONFIG, optsOver, 1000)).toThrow();
    const optsEq = baseOk({ argv: ['--max-rows=1000'] });
    optsEq.exitFn = makeNoExit() as ReturnType<typeof makeExitFn>;
    const r = requireDestructiveConfirmationWithConfig('test', DECLARED_CONFIG, optsEq, 1000);
    expect(r.maxRows).toBe(1000);
  });

  it('case 8:layer 6 --max-rows 非正整數(0 / -1 / "abc")→ fail', () => {
    for (const val of ['0', '-1', 'abc']) {
      const opts = baseOk({ argv: [`--max-rows=${val}`] });
      expect(() => requireDestructiveConfirmationWithConfig('test', DECLARED_CONFIG, opts, 1000), `value=${val}`).toThrow();
    }
  });

  it('case 9a:layer 1 NODE_ENV=production regression(declared config、layer 1 preempt)→ still block', () => {
    const opts = baseOk({ env: { NODE_ENV: 'production' } });
    expect(() => requireDestructiveConfirmationWithConfig('test', DECLARED_CONFIG, opts)).toThrow();
    const err = opts.errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/NODE_ENV=production/);
  });

  it('case 9b:layer 2 URL prod string regression → still block', () => {
    const opts = baseOk({ env: { DATABASE_URL: 'postgresql://prod-cluster/main' } });
    expect(() => requireDestructiveConfirmationWithConfig('test', DECLARED_CONFIG, opts)).toThrow();
    const err = opts.errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toContain('prod');
  });

  it('case 9c:layer 3 FLAG_ENV missing regression → still block', () => {
    const opts = { ...baseOk(), env: devEnv() }; // no FLAG_ENV
    expect(() => requireDestructiveConfirmationWithConfig('test', DECLARED_CONFIG, opts)).toThrow();
    const err = opts.errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/PROJECT_DESTRUCTIVE_OK=1/);
  });

  it('case 9d:layer 4 --confirm token missing regression → still block', () => {
    const opts = baseOk();
    opts.argv = opts.argv.filter((a) => a !== CONFIRM);
    expect(() => requireDestructiveConfirmationWithConfig('test', DECLARED_CONFIG, opts)).toThrow();
    const err = opts.errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toMatch(/--confirm=/);
  });

  it('case 10:layer 6 pass 時 stderr 明列 caller responsibility wording(不驗實際 DELETE 數)', () => {
    const opts = baseOk({ argv: ['--max-rows=50'] });
    opts.exitFn = makeNoExit() as ReturnType<typeof makeExitFn>;
    const r = requireDestructiveConfirmationWithConfig('test', DECLARED_CONFIG, opts, 1000);
    expect(r.maxRows).toBe(50);
    const logs = opts.logFn.mock.calls.map((c) => c[0]).join('\n');
    expect(logs).toMatch(/本 guard 不驗實際 DELETE|caller 責任 enforce/);
  });

  it('case 13:password mask preservation(layer 2 fire、mutation P13 kill)', () => {
    // Fixture:URL 含 'prod-host'(layer 2 fire)+ password 'secret';mutation revert mask 讓 stderr 含 'secret'
    const opts = baseOk({ env: { DATABASE_URL: 'postgresql://user:secret@prod-host/db' } });
    expect(() => requireDestructiveConfirmationWithConfig('test', DECLARED_CONFIG, opts)).toThrow();
    expect(opts.exitFn).toHaveBeenCalledWith(1);
    const err = opts.errorFn.mock.calls.map((c) => c[0]).join('\n');
    expect(err).toContain('prod'); // layer 2 fired
    expect(err).not.toContain('secret'); // password masked
  });
});

// ─────────────────────────────────────── Sprint 20 C2:case 11 real-module wrapper e2e
// 承 plan r5-r6 pinned:test-only wrapper 內容 + call/env/expected pinned、shipped config=null → layer 5 真走
describe('Sprint 20 C2 — case 11 real-module wrapper e2e(shipped config=null → layer 5 fail-closed)', () => {
  it('case 11:real module wrapper — shipped config=null → layer 5 fail-closed、reach-end sentinel 未印', () => {
    const wrapper = path.resolve(__dirname, 'fixtures/destructive-guard-real-wrapper.mts');
    const r = spawnSync('npx', ['tsx', wrapper, '--confirm=PROJECT-PROD', '--apply'], {
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PROJECT_DESTRUCTIVE_OK: '1',
        DATABASE_URL: 'postgresql://safe.local/testdb',
      },
      encoding: 'utf-8',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/EXPECTED_TARGET_IDENTITY 未導入/);
    expect(r.stdout).not.toContain('WRAPPER_REACHED_END');
  });
});
