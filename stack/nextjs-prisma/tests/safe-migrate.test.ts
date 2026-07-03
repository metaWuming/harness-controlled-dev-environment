// tests/safe-migrate.test.ts
//
// 鎖定 scripts/safe-migrate.ts 三個純函式的行為。
//
// 這個 wrapper 自動化兩條實戰教訓:
//   - 教訓 1 — `ls -la .env*` 守門,不重建臨時 env 檔
//   - 教訓 2 — Production DATABASE_URL 必須是 pooler hostname,
//              不能用 direct(`db.XXX.supabase.co`,IPv6-only)
//
// 純函式測試守住:輸入錯誤的 prod URL → wrapper 必須拒絕。
// 整合行為(spawn、readline prompt)走 manual smoke test,不在這層測。

import { describe, expect, it } from 'vitest';

import {
  extractHostname,
  interpretMigrateStatus,
  parseArgs,
  parseEnvFile,
  validateProdDatabaseUrl,
} from '../scripts/safe-migrate';

describe('parseEnvFile', () => {
  it('parses simple KEY=value lines', () => {
    const result = parseEnvFile('FOO=bar\nBAZ=qux');
    expect(result).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('handles double-quoted values', () => {
    const result = parseEnvFile('FOO="hello world"');
    expect(result).toEqual({ FOO: 'hello world' });
  });

  it('handles single-quoted values', () => {
    const result = parseEnvFile("FOO='hello world'");
    expect(result).toEqual({ FOO: 'hello world' });
  });

  it('skips comment lines starting with #', () => {
    const result = parseEnvFile('# comment\nFOO=bar\n# another comment');
    expect(result).toEqual({ FOO: 'bar' });
  });

  it('skips blank lines', () => {
    const result = parseEnvFile('\n\nFOO=bar\n\n');
    expect(result).toEqual({ FOO: 'bar' });
  });

  it('returns empty object for empty input', () => {
    expect(parseEnvFile('')).toEqual({});
  });

  it('parses real-world postgresql URLs without crashing on special chars', () => {
    const content =
      'DATABASE_URL="postgresql://postgres.user:s3cr3t%21@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true"\n' +
      'DIRECT_URL="postgresql://postgres.user:s3cr3t%21@db.foo.supabase.co:5432/postgres"';
    const result = parseEnvFile(content);
    expect(result.DATABASE_URL).toContain('pooler.supabase.com');
    expect(result.DIRECT_URL).toContain('db.foo.supabase.co');
  });
});

describe('extractHostname', () => {
  it('pulls hostname from a pooler URL', () => {
    expect(
      extractHostname(
        'postgresql://user:pass@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
      ),
    ).toBe('aws-1-ap-northeast-1.pooler.supabase.com');
  });

  it('pulls hostname from a direct supabase URL', () => {
    expect(
      extractHostname(
        'postgresql://user:pass@db.abcdefgh.supabase.co:5432/postgres',
      ),
    ).toBe('db.abcdefgh.supabase.co');
  });

  it('handles URLs with query string', () => {
    expect(
      extractHostname(
        'postgresql://user:pass@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true&schema=public',
      ),
    ).toBe('aws-1-ap-northeast-1.pooler.supabase.com');
  });

  it('handles URLs with URL-encoded password', () => {
    expect(
      extractHostname(
        'postgresql://postgres:p%40ssw0rd%21@db.foo.supabase.co:5432/postgres',
      ),
    ).toBe('db.foo.supabase.co');
  });

  it('handles localhost', () => {
    expect(extractHostname('postgresql://user:pass@localhost:5432/db')).toBe(
      'localhost',
    );
  });

  it('throws on malformed URL', () => {
    expect(() => extractHostname('not-a-url')).toThrow();
  });

  it('throws on empty input', () => {
    expect(() => extractHostname('')).toThrow();
  });
});

describe('validateProdDatabaseUrl', () => {
  it('accepts pooler hostname', () => {
    const result = validateProdDatabaseUrl(
      'postgresql://user:pass@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
    );
    expect(result.ok).toBe(true);
  });

  it('accepts any *.pooler.supabase.com region', () => {
    const result = validateProdDatabaseUrl(
      'postgresql://user:pass@aws-2-us-east-1.pooler.supabase.com:5432/postgres',
    );
    expect(result.ok).toBe(true);
  });

  it('rejects direct db.*.supabase.co hostname (IPv6 trap)', () => {
    const result = validateProdDatabaseUrl(
      'postgresql://user:pass@db.abcdefgh.supabase.co:5432/postgres',
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/IPv6|pooler|direct/i);
  });

  it('rejects localhost (cannot be production)', () => {
    const result = validateProdDatabaseUrl(
      'postgresql://user:pass@localhost:5432/db',
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/localhost|production/i);
  });

  it('rejects empty string', () => {
    const result = validateProdDatabaseUrl('');
    expect(result.ok).toBe(false);
  });

  it('rejects malformed URL', () => {
    const result = validateProdDatabaseUrl('not-a-url');
    expect(result.ok).toBe(false);
  });

  it('rejects transaction pooler (port 6543) — no advisory locks for prisma migrate', () => {
    const result = validateProdDatabaseUrl(
      'postgresql://user:pass@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres',
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/6543|transaction|advisory/i);
  });

  it('accepts session pooler (port 5432) explicit', () => {
    const result = validateProdDatabaseUrl(
      'postgresql://user:pass@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
    );
    expect(result.ok).toBe(true);
  });

  it('rejects pooler with non-5432 / non-6543 port', () => {
    const result = validateProdDatabaseUrl(
      'postgresql://user:pass@aws-1-ap-northeast-1.pooler.supabase.com:9999/postgres',
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/port|9999/i);
  });

  it('rejects pooler URL without explicit port (/review adversarial P2)', () => {
    const result = validateProdDatabaseUrl(
      'postgresql://user:pass@aws-1-ap-northeast-1.pooler.supabase.com/postgres',
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/port|未明寫/i);
  });
});

describe('parseArgs', () => {
  it('parses status dev', () => {
    const opts = parseArgs(['status', 'dev']);
    expect(opts.command).toBe('status');
    expect(opts.mode).toBe('dev');
    expect(opts.yes).toBe(false);
    expect(opts.dryRun).toBe(false);
  });

  it('parses status prod', () => {
    const opts = parseArgs(['status', 'prod']);
    expect(opts.command).toBe('status');
    expect(opts.mode).toBe('prod');
  });

  it('parses dev migrate command', () => {
    const opts = parseArgs(['dev']);
    expect(opts.command).toBe('migrate');
    expect(opts.mode).toBe('dev');
  });

  it('parses prod migrate with --yes --dry-run', () => {
    const opts = parseArgs(['prod', '--yes', '--dry-run']);
    expect(opts.command).toBe('migrate');
    expect(opts.mode).toBe('prod');
    expect(opts.yes).toBe(true);
    expect(opts.dryRun).toBe(true);
  });

  it('throws on unknown flag (Codex P1: fail closed on --dryrun typo)', () => {
    expect(() => parseArgs(['prod', '--dryrun', '--yes'])).toThrow(/未知 flag|--dryrun/);
  });

  it('throws on unknown flag --force', () => {
    expect(() => parseArgs(['dev', '--force'])).toThrow(/未知 flag/);
  });

  it('throws on missing mode after status', () => {
    expect(() => parseArgs(['status'])).toThrow(/status \[dev\|prod\]/);
  });

  it('throws on unknown command', () => {
    expect(() => parseArgs(['rollback'])).toThrow(/未知命令/);
  });
});

describe('interpretMigrateStatus(Codex round 2 P2)', () => {
  it('healthy when exit code 0(DB up to date)', () => {
    const r = interpretMigrateStatus('Database schema is up to date!', 0);
    expect(r.healthy).toBe(true);
  });

  it('healthy when non-zero but output shows pending migrations(normal wrapper use case)', () => {
    const stdout =
      '31 migrations found in prisma/migrations\n' +
      'Following migrations have not yet been applied:\n' +
      '20260523_add_member_table\n';
    const r = interpretMigrateStatus(stdout, 1);
    expect(r.healthy).toBe(true);
  });

  it('unhealthy when drift detected', () => {
    const stdout =
      'Drift detected: Your database schema is not in sync with your migration history.';
    const r = interpretMigrateStatus(stdout, 1);
    expect(r.healthy).toBe(false);
    expect(r.reason).toMatch(/drift|sync/i);
  });

  it('unhealthy when failed migration exists', () => {
    const stdout =
      'Following migration is in a failed state:\n' +
      '20260523_broken_migration started 2026-05-23 ...';
    const r = interpretMigrateStatus(stdout, 1);
    expect(r.healthy).toBe(false);
    expect(r.reason).toMatch(/failed/i);
  });

  it('unhealthy when non-zero exit with unrecognized output(conservative abort)', () => {
    const r = interpretMigrateStatus('???', 1);
    expect(r.healthy).toBe(false);
    expect(r.reason).toMatch(/exit code|abort|drift/i);
  });

  it('healthy when both pending + non-zero(real Prisma 7 output)', () => {
    const stdout =
      'Status\n3 migrations found in prisma/migrations\nFollowing migrations have not yet been applied:\n  20260523_xxx\n';
    const r = interpretMigrateStatus(stdout, 1);
    expect(r.healthy).toBe(true);
  });
});
