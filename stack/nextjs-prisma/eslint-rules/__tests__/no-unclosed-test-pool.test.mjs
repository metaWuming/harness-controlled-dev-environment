// eslint-rules/__tests__/no-unclosed-test-pool.test.mjs
//
// 守 no-unclosed-test-pool custom rule 的契約:
// tests/ 測試檔建立的 pg.Pool 必須有對應 pool.end(),否則報錯。
// 背景見 rule 檔頭(連線洩漏根治)。

import { RuleTester } from 'eslint';
import { describe, test } from 'vitest';
import rule from '../no-unclosed-test-pool.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

describe('no-unclosed-test-pool', () => {
  test('valid + invalid cases', () => {
    ruleTester.run('no-unclosed-test-pool', rule, {
      valid: [
        // pool + pool.end() → pass
        {
          filename: 'tests/example.test.ts',
          code: [
            `const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });`,
            `afterAll(async () => { await pool.end(); });`,
          ].join('\n'),
        },
        // 不同變數名 + 對應 end() → pass(名稱比對,非寫死 'pool')
        {
          filename: 'tests/example.test.ts',
          code: [
            `const dbPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });`,
            `afterAll(async () => { await dbPool.end(); });`,
          ].join('\n'),
        },
        // 直接 import { Pool } → new Pool() + end() → pass
        {
          filename: 'tests/example.test.ts',
          code: [
            `const pool = new Pool({ connectionString: process.env.DATABASE_URL });`,
            `afterAll(async () => { await pool.end(); });`,
          ].join('\n'),
        },
        // 非測試檔(production)→ 完全不檢(src/lib/db.ts 單例 pool 刻意長命)
        {
          filename: 'src/lib/db.ts',
          code: `const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });`,
        },
        // 測試檔但沒有 pool → pass
        {
          filename: 'tests/example.test.ts',
          code: `const x = new SomethingElse();`,
        },
        // 真實 house pattern:module 頂層 pool + afterAll 內 await pool.end() → pass
        // (end() 的 reference 經 scope 解析仍綁回同一 binding)
        {
          filename: 'tests/example.test.ts',
          code: [
            `const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });`,
            `const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });`,
            `afterAll(async () => {`,
            `  await prisma.$disconnect();`,
            `  await pool.end();`,
            `});`,
          ].join('\n'),
        },
      ],
      invalid: [
        // pool 但沒 end() → unclosedPool
        {
          filename: 'tests/leaky.test.ts',
          code: [
            `const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });`,
            `afterAll(async () => { await prisma.$disconnect(); });`,
          ].join('\n'),
          errors: [{ messageId: 'unclosedPool', data: { name: 'pool' } }],
        },
        // 兩個 pool,只關一個 → 另一個報
        {
          filename: 'tests/leaky.test.ts',
          code: [
            `const poolA = new pg.Pool({ connectionString: process.env.DATABASE_URL });`,
            `const poolB = new pg.Pool({ connectionString: process.env.DATABASE_URL });`,
            `afterAll(async () => { await poolA.end(); });`,
          ].join('\n'),
          errors: [{ messageId: 'unclosedPool', data: { name: 'poolB' } }],
        },
        // 匿名 pool(沒接變數)→ anonymousPool
        {
          filename: 'tests/leaky.test.ts',
          code: `new pg.Pool({ connectionString: process.env.DATABASE_URL });`,
          errors: [{ messageId: 'anonymousPool' }],
        },
        // ⭐ Codex review P2 回歸:module pool 漏關,但同名 shadow 參數呼叫 .end()。
        // 名稱比對版會被騙(false negative);scope binding 版正確報 module pool 未關。
        {
          filename: 'tests/leaky.test.ts',
          code: [
            `const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });`,
            `function cleanup(pool) { pool.end(); }`,
            `afterAll(async () => { cleanup(somethingElse); });`,
          ].join('\n'),
          errors: [{ messageId: 'unclosedPool', data: { name: 'pool' } }],
        },
      ],
    });
  });
});
