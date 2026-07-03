// tests/destructive-guard.test.ts
//
// 守 scripts/lib/destructive-guard.ts 四層防護 + dry-run default 的契約。
// 測試用 mock 的 exitFn / logFn / errorFn 注入點,不真 process.exit。
//
// ⚠️ 若你導入時改了 destructive-guard.ts 檔頂的 FLAG_ENV / CONFIRM_TOKEN 常數,
//   下面兩個常數要同步改(fixture 直接引用字面值,鎖「常數改了測試必紅」的契約)。

import { describe, test, expect, vi } from 'vitest';
import { requireDestructiveConfirmation } from '../scripts/lib/destructive-guard';

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
    const exitFn = makeNoExit();
    const logFn = vi.fn();
    const result = requireDestructiveConfirmation('test-script', {
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
    const result = requireDestructiveConfirmation('test-script', {
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
  ])('Layer 5:%s (--apply 接 value) 應 reject 防誤導 dry-run', (applyVariant) => {
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

  test('Layer 5:`--apply-bar` (不同 flag 開頭) 不該被誤判,當作 dry-run 通過', () => {
    const exitFn = makeNoExit();
    const result = requireDestructiveConfirmation('test-script', {
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

    requireDestructiveConfirmation('test-script', {
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
