// eslint-rules/__tests__/no-base-prisma-without-reason.test.mjs
//
// 守 no-base-prisma-without-reason custom rule 的契約 — 取代原
// 舊版 grep 檢查腳本的測試 對 import-side detection 的覆蓋。
//
// 包含 後續新增的 alias bypass case(舊 grep regex 抓不到,Codex R5 dismissed)。

import { RuleTester } from 'eslint';
import { describe, test } from 'vitest';
import tsParser from '@typescript-eslint/parser';
import rule from '../no-base-prisma-without-reason.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

// Codex R6 P2:TSImportEqualsDeclaration 是 TS-only AST node,需 @typescript-eslint/parser
const tsRuleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

describe('no-base-prisma-without-reason', () => {
  test('valid + invalid cases', () => {
    ruleTester.run('no-base-prisma-without-reason', rule, {
      valid: [
        // 不 import 任何 prisma 相關 → pass
        {
          code: `import { somethingElse } from '@/lib/db';`,
        },
        // namespace import + Reason tag → pass(Codex R3 P1 配套)
        {
          code: [
            `// Reason: NON_SCOPED_TABLE — operating on Tenant table`,
            `import * as db from '@/lib/db';`,
          ].join('\n'),
        },
        // re-export `export { prisma }` + Reason → pass(Codex R4 P2 配套)
        {
          code: [
            `// Reason: NON_SCOPED_TABLE — barrel re-export for legacy callers`,
            `export { prisma } from '@/lib/db';`,
          ].join('\n'),
        },
        // re-export 非 prisma export(`export { somethingElse } from ...`)→ pass
        {
          code: `export { somethingElse } from '@/lib/db';`,
        },
        // re-export from 其他 module 不該攔
        {
          code: `export { prisma } from '@/lib/something-else';`,
        },
        // side-effect import + Reason → pass(Codex R5 P2 配套)
        {
          code: [
            `// Reason: FIRE_AND_FORGET — initialize singleton at startup`,
            `import '@/lib/db';`,
          ].join('\n'),
        },
        // side-effect import 從其他 module → 不攔
        {
          code: `import '@/lib/something-else';`,
        },
        //  valid sanity:ExportNamedDeclaration 無 source(本檔內 re-declare,非 re-export)
        // `export { foo };` 不算 dangerous(沒從 @/lib/db 拉,只是 export 本檔的 foo)
        {
          code: [
            `const foo = 'x';`,
            `export { foo };`,
          ].join('\n'),
        },
        //  valid sanity:ExportNamedDeclaration 重新命名但無 source
        {
          code: [
            `const prisma = 'this-is-not-the-real-prisma';`,
            `export { prisma };`,
          ].join('\n'),
        },
        // import 其他 named export(不是 prisma)→ pass
        {
          code: `import { getTenantPrisma } from '@/lib/db-tenant';`,
        },
        // import prisma + 上方有 Reason tag(CROSS_TENANT_CRON)→ pass
        {
          code: [
            `// Reason: CROSS_TENANT_CRON — cron 掃所有 tenant`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
        },
        // 上方有 eslint-disable + Reason 都在 → pass(實際 codebase 既有 pattern)
        {
          code: [
            `// Reason: NON_SCOPED_TABLE — 操作 Tenant 表`,
            `// eslint-disable-next-line no-restricted-imports`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
        },
        // 不同 enum tag 全部接受
        ...['CROSS_TENANT_CRON', 'CROSS_TENANT_BATCH', 'NON_SCOPED_TABLE', 'FIRE_AND_FORGET', 'HEALTH_CHECK', 'EXPLICIT_TENANT_PARAM', 'TEST_ONLY'].map((tag) => ({
          code: [
            `// Reason: ${tag} — 測試 tag`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
        })),
        // em-dash / en-dash / ASCII hyphen 三種 separator 都接受
        {
          code: [
            `// Reason: CROSS_TENANT_CRON – en-dash`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
        },
        {
          code: [
            `// Reason: CROSS_TENANT_CRON - ASCII hyphen`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
        },
        // Infrastructure allowlist(用 filename 模擬)
        {
          code: `import { prisma } from '@/lib/db';`,
          filename: `${process.cwd()}/src/lib/db-tenant.ts`,
        },
        {
          code: `import { prisma } from '@/lib/db';`,
          filename: `${process.cwd()}/src/lib/tenant-context.ts`,
        },
      ],

      invalid: [
        // 沒 Reason tag → error
        {
          code: `import { prisma } from '@/lib/db';`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // 上方有 eslint-disable 但無 Reason → error(因為 eslint-disable 只能 disable rule by name,
        // my custom rule 名 harness/no-base-prisma-without-reason 還在 fire — 用 messageId 看)
        {
          code: [
            `// eslint-disable-next-line no-restricted-imports`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // Reason tag 格式錯(沒 dash separator)
        {
          code: [
            `// Reason: CROSS_TENANT_CRON 沒有 dash`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'reasonMalformed' }],
        },
        // Invalid tag enum
        {
          code: [
            `// Reason: NOT_IN_ENUM — 不存在的 tag`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'reasonInvalidTag' }],
        },
        // 🔥 KEY NEW CASE:Alias bypass — `import { prisma as foo }` 也被抓
        // (舊 grep regex 用 `\bprisma\b` 可以抓到 `prisma` 字面,但邊界 case e.g.
        //  跳行 / 跨檔 / 命名空間 import 都會漏)
        {
          code: `import { prisma as basePrisma } from '@/lib/db';`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // Alias 加 eslint-disable 但無 Reason
        {
          code: [
            `// eslint-disable-next-line no-restricted-imports`,
            `import { prisma as dbClient } from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // Multiline import — 第一行 `import {` 開頭,specifier 在後續行
        {
          code: [
            `import {`,
            `  prisma,`,
            `} from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'noBasePrismaImport' }],
        },

        // 🔥 NEW CASE:dynamic import `await import('@/lib/db')` 沒 Reason → error
        {
          code: `const { prisma } = await import('@/lib/db');`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // :dynamic import 有 eslint-disable 但無 Reason → error
        {
          code: [
            `// eslint-disable-next-line no-restricted-imports`,
            `const { prisma } = await import('@/lib/db');`,
          ].join('\n'),
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // :dynamic import via .then() pattern
        {
          code: `import('@/lib/db').then((m) => m.prisma);`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // :dynamic import + Reason format 錯
        {
          code: [
            `// Reason: CROSS_TENANT_CRON 沒有 dash`,
            `const { prisma } = await import('@/lib/db');`,
          ].join('\n'),
          errors: [{ messageId: 'reasonMalformed' }],
        },
        // :dynamic import + invalid enum tag
        {
          code: [
            `// Reason: NOT_IN_ENUM — 不存在的 tag`,
            `const { prisma } = await import('@/lib/db');`,
          ].join('\n'),
          errors: [{ messageId: 'reasonInvalidTag' }],
        },

        // 🔥 NEW CASE:CommonJS require('@/lib/db') 沒 Reason → error
        {
          code: `const { prisma } = require('@/lib/db');`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // :require + Reason malformed
        {
          code: [
            `// Reason: CROSS_TENANT_CRON 沒有 dash`,
            `const { prisma } = require('@/lib/db');`,
          ].join('\n'),
          errors: [{ messageId: 'reasonMalformed' }],
        },
        // 🔥 Codex R1 P2 fix:require 額外 args 仍應攔(Node 忽略額外 args 但 module 已載入)
        {
          code: `const { prisma } = require('@/lib/db', undefined);`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        {
          code: `require('@/lib/db', 'unused-extra-arg', null);`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },

        // 🔥 Codex R2 P1 fix:no-substitution TemplateLiteral specifier 仍應攔
        {
          code: 'const { prisma } = await import(`@/lib/db`);',
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        {
          code: 'const { prisma } = require(`@/lib/db`);',
          errors: [{ messageId: 'noBasePrismaImport' }],
        },

        // 🔥 Codex R3 P1 fix:namespace import bypass(`import * as db from '@/lib/db'` → db.prisma)
        {
          code: `import * as db from '@/lib/db';`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // namespace + alias 各種寫法
        {
          code: `import * as basePrisma from '@/lib/db';`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // namespace 在 multiline 中
        {
          code: [
            `import`,
            `  * as db`,
            `from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // 🔥 Codex R3 P1 fix:Literal-named ImportSpecifier(ES2022 arbitrary module names)
        {
          code: `import { "prisma" as p } from '@/lib/db';`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // 🔥 Codex R4 P2 fix:re-export `export { prisma } from '@/lib/db'`
        {
          code: `export { prisma } from '@/lib/db';`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // re-export with alias `export { prisma as basePrisma } from '@/lib/db'`
        {
          code: `export { prisma as basePrisma } from '@/lib/db';`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // Literal-named re-export `export { "prisma" as p } from '@/lib/db'`
        {
          code: `export { "prisma" as p } from '@/lib/db';`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // 🔥 Codex R4 P2 fix:`export * from '@/lib/db'`
        {
          code: `export * from '@/lib/db';`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // namespace re-export `export * as db from '@/lib/db'`
        {
          code: `export * as db from '@/lib/db';`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // 🔥 Codex R5 P2 fix:side-effect-only import 仍要 Reason tag
        {
          code: `import '@/lib/db';`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
      ],
    });

    //  valid cases:dynamic import / require 加 Reason tag → pass
    ruleTester.run('no-base-prisma-without-reason (dynamic)', rule, {
      valid: [
        // dynamic import + Reason → pass
        {
          code: [
            `// Reason: FIRE_AND_FORGET — lazy load for circular dep avoidance`,
            `const { prisma } = await import('@/lib/db');`,
          ].join('\n'),
          // ImportExpression 需要 ES2020+(async / top-level await 不影響 source-type=module 解析)
          languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
        },
        // require + Reason → pass
        {
          code: [
            `// Reason: CROSS_TENANT_CRON — cron worker legacy CJS entry`,
            `const { prisma } = require('@/lib/db');`,
          ].join('\n'),
        },
        // Codex R2 P1:template literal + Reason → pass
        {
          code: [
            `// Reason: FIRE_AND_FORGET — template literal target`,
            'const { prisma } = await import(`@/lib/db`);',
          ].join('\n'),
          languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
        },
        // import('其他 module') 不該攔
        {
          code: `const { other } = await import('@/lib/something-else');`,
          languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
        },
        // require('其他 module') 不該攔
        {
          code: `const { other } = require('@/lib/something-else');`,
        },
        // require with non-literal argument 不該攔(動態組字串繞過,但這是另一個問題)
        {
          code: `const path = '@/lib/db'; const m = require(path);`,
        },
        // template literal with substitution 不被嚴格 static analysis 識別 → 不攔
        // (cooked 值取決於 runtime,不在  scope)
        {
          code: 'const target = "@/lib/db"; const { prisma } = await import(`${target}`);',
          languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
        },
      ],
      invalid: [],
    });

    // Codex R6 P2:TSImportEqualsDeclaration 用 TS parser
    tsRuleTester.run('no-base-prisma-without-reason (R6 TS import-equals)', rule, {
      valid: [
        // import-equals + Reason → pass
        {
          code: [
            `// Reason: CROSS_TENANT_CRON — legacy CJS interop`,
            `import db = require('@/lib/db');`,
          ].join('\n'),
        },
        // import-equals 從其他 module → 不攔
        {
          code: `import other = require('@/lib/something-else');`,
        },
        //  valid sanity:moduleReference 是 TSQualifiedName 而非 TSExternalModuleReference
        // (e.g. `import X = SomeNamespace.Inner;`)— 完全不關 require 的事,visitor 應該早 return
        {
          code: [
            `namespace SomeNs { export const Inner = 1; }`,
            `import X = SomeNs.Inner;`,
          ].join('\n'),
        },
        //  valid sanity:TSExternalModuleReference 指向其他 module
        // (確認 visitor 對非目標 module 不會誤報;與第一條 valid case 不同 target)
        {
          code: `import legacy = require('legacy-cjs-module');`,
        },
      ],
      invalid: [
        // import-equals 無 Reason → error
        {
          code: `import db = require('@/lib/db');`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // import-equals 帶 alias 名
        {
          code: `import basePrisma = require('@/lib/db');`,
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
      ],
    });

    // 🔥 R7 Claude /review CRITICAL fix:wrapped dynamic import / require bypass
    // 一個 file-top Reason 不該替 closure / object property / sequence expression 內的
    // 動態 import 蒙混 — 那是把 raw prisma 匯出去的 portal,不是 file-local 跨 tenant action。
    ruleTester.run('no-base-prisma-without-reason (R7 wrapped bypass)', rule, {
      valid: [
        // Reason 直接黏在 inner ImportExpression 前 → pass(closure body 內)
        {
          code: [
            `const loadDb = () =>`,
            `  // Reason: FIRE_AND_FORGET — lazy-loaded on demand only`,
            `  import('@/lib/db');`,
          ].join('\n'),
          languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
        },
        // Reason 直接黏在 inner require 前 → pass(closure body 內)
        {
          code: [
            `const loadDb = () =>`,
            `  // Reason: CROSS_TENANT_CRON — legacy CJS interop`,
            `  require('@/lib/db');`,
          ].join('\n'),
        },
      ],
      invalid: [
        // 🔥 arrow function body wrapper:file-top Reason 不接受
        {
          code: [
            `// Reason: NON_SCOPED_TABLE — 試圖蒙混`,
            `const loadDb = () => import('@/lib/db');`,
          ].join('\n'),
          languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // arrow function body wrapper (require):file-top Reason 不接受
        {
          code: [
            `// Reason: CROSS_TENANT_CRON — 試圖蒙混`,
            `const loadDb = () => require('@/lib/db');`,
          ].join('\n'),
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // FunctionExpression body wrapper
        {
          code: [
            `// Reason: NON_SCOPED_TABLE — 試圖蒙混`,
            `const loadDb = function () { return import('@/lib/db'); };`,
          ].join('\n'),
          languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // FunctionDeclaration body wrapper
        {
          code: [
            `// Reason: NON_SCOPED_TABLE — 試圖蒙混`,
            `function loadDb() { return import('@/lib/db'); }`,
          ].join('\n'),
          languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // object property + arrow:nested wrapper
        {
          code: [
            `// Reason: NON_SCOPED_TABLE — 試圖蒙混`,
            `const obj = { load: () => import('@/lib/db') };`,
          ].join('\n'),
          languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
        // SequenceExpression wrapper
        {
          code: [
            `// Reason: NON_SCOPED_TABLE — 試圖蒙混`,
            `const x = (foo(), import('@/lib/db'));`,
          ].join('\n'),
          languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
          errors: [{ messageId: 'noBasePrismaImport' }],
        },
      ],
    });

    // Codex R2 P1 multiline bypass:report loc 鎖到 ImportExpression / require call,
    // 而非 enclosing VariableDeclaration —— 避免 `// eslint-disable-next-line`(targets line N+1)
    // 靜音整個多行 VariableDeclaration 的 noBasePrismaImport 報告
    ruleTester.run('no-base-prisma-without-reason (multiline report loc)', rule, {
      valid: [],
      invalid: [
        // 多行 dynamic import 沒 Reason → 必須報告(loc 在 ImportExpression,line 2)
        {
          code: [
            `const { prisma } =`,
            `  await import('@/lib/db');`,
          ].join('\n'),
          languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
          errors: [
            {
              messageId: 'noBasePrismaImport',
              line: 2, // ImportExpression 在 line 2,不是 VariableDeclaration 的 line 1
            },
          ],
        },
        // 多行 require + Reason malformed → 報告 reasonMalformed at CallExpression loc
        {
          code: [
            `// Reason: CROSS_TENANT_CRON 沒有 dash`,
            `const { prisma } =`,
            `  require('@/lib/db');`,
          ].join('\n'),
          errors: [
            {
              messageId: 'reasonMalformed',
              line: 3, // require call 在 line 3
            },
          ],
        },
      ],
    });
  });
});
