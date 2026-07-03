// eslint-rules/__tests__/raw-prisma-client-tenant-scope.test.mjs
//
// 守 raw-prisma-client-tenant-scope custom rule 的契約 — 取代原
// 舊版 grep 檢查腳本的測試 對 raw `new PrismaClient` 偵測的覆蓋。
//
// AST-based 自動 cover:
//   - multiline `new\nPrismaClient(...)`(grep regex 用整檔 scan 也能 cover,但 AST 更乾淨)
//   - 各種空白變體
//   - string literal false positive(NewExpression 本來就不會 match string)
//   - mixed-quote bypass(同上)

import { RuleTester } from 'eslint';
import { describe, test } from 'vitest';
import rule from '../raw-prisma-client-tenant-scope.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

describe('raw-prisma-client-tenant-scope', () => {
  test('valid + invalid cases', () => {
    ruleTester.run('raw-prisma-client-tenant-scope', rule, {
      valid: [
        // 沒有 new PrismaClient → pass
        {
          code: `const x = new SomethingElse();`,
        },
        // new PrismaClient + 上方有 Tenant scope tag → pass
        {
          code: [
            `// Tenant scope: CROSS_TENANT_SEED — Seed tenant fixture`,
            `const prisma = new PrismaClient();`,
          ].join('\n'),
        },
        // 7 種 enum tag 全部接受(後續新增 TEST_FIXTURE)
        ...['CROSS_TENANT_SEED', 'CROSS_TENANT_VERIFY', 'CROSS_TENANT_CLEANUP', 'CROSS_TENANT_INSPECT', 'SINGLE_TENANT_EXPLICIT', 'INFRASTRUCTURE_TOOL', 'TEST_FIXTURE'].map((tag) => ({
          code: [
            `// Tenant scope: ${tag} — 測試 tag`,
            `const prisma = new PrismaClient();`,
          ].join('\n'),
        })),
        //  KEY CASE:TEST_FIXTURE 在真實 vitest test file pattern 內(PrismaPg adapter)
        // 用 default parser 跑 ESM source(無 TS `as any` cast — TS-specific syntax 不在
        // RuleTester default parser 範圍。AST rule 本身 parser-agnostic,真正 codebase 有 cast
        // 也不影響 NewExpression 偵測)
        {
          code: [
            `// Tenant scope: TEST_FIXTURE — vitest integration test fixture`,
            `const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });`,
            `const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });`,
          ].join('\n'),
        },
        // Tag 在 4 行內(within 5-line lookback)→ pass
        {
          code: [
            `// Tenant scope: CROSS_TENANT_SEED — 距離 4 行`,
            ``,
            ``,
            ``,
            `const prisma = new PrismaClient();`,
          ].join('\n'),
        },
        // 中間有 code 隔開 tag 與 new PrismaClient(用 getAllComments 而非 getCommentsBefore
        // 的關鍵 case)— 對齊真實 cleanup 腳本 pattern
        {
          code: [
            `// Tenant scope: CROSS_TENANT_CLEANUP — 中間有 code 隔開`,
            `const pool = new pg.Pool({ connectionString: 'postgres://...' });`,
            `// 中間有個 line comment 但跟 Tenant scope 無關`,
            `const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });`,
          ].join('\n'),
        },
        // em-dash / en-dash / ASCII hyphen
        {
          code: [
            `// Tenant scope: CROSS_TENANT_SEED – en-dash`,
            `const prisma = new PrismaClient();`,
          ].join('\n'),
        },
        // Allowlist: src/lib/db.ts
        {
          code: `const prisma = new PrismaClient();`,
          filename: `${process.cwd()}/src/lib/db.ts`,
        },
      ],

      invalid: [
        // 無 tag → error
        {
          code: `const prisma = new PrismaClient();`,
          errors: [{ messageId: 'missingTenantScope' }],
        },
        // Tag 太遠(5 行以外但 20 行以內)→ error with hint
        {
          code: [
            `// Tenant scope: CROSS_TENANT_SEED — 距離 7 行,超出 5 行 lookback`,
            ``,
            ``,
            ``,
            ``,
            ``,
            ``,
            `const prisma = new PrismaClient();`,
          ].join('\n'),
          errors: [{ messageId: 'missingTenantScopeWithHint' }],
        },
        // Invalid enum tag
        {
          code: [
            `// Tenant scope: NOT_IN_ENUM — 不存在的 tag`,
            `const prisma = new PrismaClient();`,
          ].join('\n'),
          errors: [{ messageId: 'invalidTenantScopeTag' }],
        },
        // Multiline `new\nPrismaClient(...)`
        {
          code: [
            `const prisma = new`,
            `  PrismaClient();`,
          ].join('\n'),
          errors: [{ messageId: 'missingTenantScope' }],
        },
        // 額外空白變體 — AST 不在意空白
        {
          code: `const prisma = new   PrismaClient   ();`,
          errors: [{ messageId: 'missingTenantScope' }],
        },
        // /review C2 fix:Member-callee `new Prisma.PrismaClient()` 也偵測
        // (codebase 用 `import * as PrismaGen from '@/generated/prisma/client'` 的變體)
        {
          code: [
            `import * as PrismaGen from '@/generated/prisma/client';`,
            `const p = new PrismaGen.PrismaClient();`,
          ].join('\n'),
          errors: [{ messageId: 'missingTenantScope' }],
        },
        // Member-callee 含正確 tag → pass
      ],
    });
  });
});
