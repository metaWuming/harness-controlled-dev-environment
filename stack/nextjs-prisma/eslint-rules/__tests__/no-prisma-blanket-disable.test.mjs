// eslint-rules/__tests__/no-prisma-blanket-disable.test.mjs
//
// 守 no-prisma-blanket-disable rule — 防 blanket eslint-disable-next-line 緊鄰危險 prisma 行
// (Codex R1 P1 的 regression fix)

import { RuleTester } from 'eslint';
import { describe, test } from 'vitest';
import tsParser from '@typescript-eslint/parser';
import rule from '../no-prisma-blanket-disable.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

// Codex R6 P2:TSImportEqualsDeclaration 是 TS-only AST,需 @typescript-eslint/parser
const tsRuleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

describe('no-prisma-blanket-disable', () => {
  test('valid + invalid cases', () => {
    ruleTester.run('no-prisma-blanket-disable', rule, {
      valid: [
        // 不是 blanket disable(有 rule name 顯式列出)→ OK
        {
          code: [
            `// eslint-disable-next-line no-restricted-imports`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
        },
        // 多個 rule name 顯式列 → OK (此 rule 只攔 blanket 即無 rule name)
        {
          code: [
            `// eslint-disable-next-line no-restricted-imports, no-console`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
        },
        // Blanket disable 但下一行不是 prisma pattern → OK(其他 rule 仍由 ESLint 標準機制處理)
        {
          code: [
            `// eslint-disable-next-line`,
            `console.log('not prisma');`,
          ].join('\n'),
        },
        // Codex R3 P2 fix:false positive regression — blanket disable 給其他 statement,
        // 後面才有 new PrismaClient(),不該誤報
        {
          code: [
            `// eslint-disable-next-line`,
            `console.log('this is what is disabled');`,
            ``,
            ``,
            ``,
            ``,
            ``,
            `const prisma = new PrismaClient();`,
          ].join('\n'),
        },
        // 巢狀內 disable 給非 prisma statement → 不誤報
        {
          code: [
            `function foo() {`,
            `  // eslint-disable-next-line`,
            `  console.log('disabled');`,
            `  const prisma = new PrismaClient();`,
            `}`,
          ].join('\n'),
        },
        // 同上但 import 在後面
        {
          code: [
            `// eslint-disable-next-line`,
            `console.log('this is what is disabled');`,
            ``,
            ``,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
        },
        // 普通 line comment(非 disable directive)→ OK
        {
          code: [
            `// 一般註解`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
        },
        // Codex R5 P2 fix:directive 在 for/if/try 之前,block body 內含 PrismaClient,
        // 但 directive 只 silence header line(無 prisma),body 內 PrismaClient 不受影響 → 不誤報
        {
          code: [
            `// eslint-disable-next-line`,
            `for (let i = 0; i < 10; i++) {`,
            `  const prisma = new PrismaClient();`,
            `}`,
          ].join('\n'),
        },
        {
          code: [
            `// eslint-disable-next-line`,
            `if (cond) {`,
            `  const prisma = new PrismaClient();`,
            `}`,
          ].join('\n'),
        },
        {
          code: [
            `// eslint-disable-next-line`,
            `try {`,
            `  const prisma = new PrismaClient();`,
            `} catch (e) {}`,
          ].join('\n'),
        },
        // VariableDeclaration with inline function — body 內 prisma 不受 silence
        {
          code: [
            `// eslint-disable-next-line`,
            `const foo = function() {`,
            `  const prisma = new PrismaClient();`,
            `};`,
          ].join('\n'),
        },
      ],

      invalid: [
        // Blanket disable 緊鄰 base prisma import → 報告
        {
          code: [
            `// eslint-disable-next-line`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // Blanket disable 緊鄰 new PrismaClient → 報告
        {
          code: [
            `// eslint-disable-next-line`,
            `const prisma = new PrismaClient();`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // 含 alias 也算危險(只要 import 行符合 base prisma pattern)
        {
          code: [
            `// eslint-disable-next-line`,
            `import { prisma as foo } from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // Codex R2 P1 fix:blanket with description bypass — `-- text` 形式
        {
          code: [
            `// eslint-disable-next-line -- 解釋一下為何 disable`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // Codex R2 P1 fix:multiline import bypass — base prisma import 跨多行
        {
          code: [
            `// eslint-disable-next-line`,
            `import {`,
            `  prisma,`,
            `  somethingElse,`,
            `} from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // Codex R2 P1 fix:multiline `new\nPrismaClient(...)` bypass
        {
          code: [
            `// eslint-disable-next-line`,
            `const prisma = new`,
            `  PrismaClient();`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // Codex R4 P1 fix:nested in IfStatement.consequent
        {
          code: [
            `if (ok) {`,
            `  // eslint-disable-next-line`,
            `  const prisma = new PrismaClient();`,
            `}`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // Codex R4 P1 fix:nested in function body
        {
          code: [
            `function foo() {`,
            `  // eslint-disable-next-line`,
            `  const prisma = new PrismaClient();`,
            `}`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // Codex R4 P1 fix:nested in try block
        {
          code: [
            `try {`,
            `  // eslint-disable-next-line`,
            `  const prisma = new PrismaClient();`,
            `} catch (e) {}`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // /review C1 fix:block comment blanket disable bypass
        {
          code: [
            `/* eslint-disable-next-line */`,
            `import { prisma } from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // /review C1 fix:block comment blanket with description
        {
          code: [
            `/* eslint-disable-next-line -- 解釋一下 */`,
            `const prisma = new PrismaClient();`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // 🔥 Codex R1 P1 fix:blanket disable 緊鄰 dynamic import → 報告
        {
          code: [
            `// eslint-disable-next-line`,
            `const { prisma } = await import('@/lib/db');`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // :blanket disable 緊鄰 import().then() pattern
        {
          code: [
            `// eslint-disable-next-line`,
            `import('@/lib/db').then((m) => m.prisma);`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // :blanket disable 緊鄰 CommonJS require
        {
          code: [
            `// eslint-disable-next-line`,
            `const { prisma } = require('@/lib/db');`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // :blanket disable 緊鄰 require with extra args(對齊 no-base-prisma Codex R1 P2)
        {
          code: [
            `// eslint-disable-next-line`,
            `const { prisma } = require('@/lib/db', undefined);`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // :block comment blanket + dynamic import bypass
        {
          code: [
            `/* eslint-disable-next-line -- 試圖繞 */`,
            `const { prisma } = await import('@/lib/db');`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // 🔥 Codex R2 P1 fix:template literal specifier bypass
        {
          code: [
            `// eslint-disable-next-line`,
            'const { prisma } = await import(`@/lib/db`);',
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        {
          code: [
            `// eslint-disable-next-line`,
            'const { prisma } = require(`@/lib/db`);',
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // 🔥 Codex R3 P1 fix:namespace import bypass with blanket disable
        {
          code: [
            `// eslint-disable-next-line`,
            `import * as db from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // 🔥 Codex R3 P1 fix:Literal-named ImportSpecifier with blanket disable
        {
          code: [
            `// eslint-disable-next-line`,
            `import { "prisma" as p } from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // 🔥 Codex R4 P2 fix:re-export 也算 dangerous
        {
          code: [
            `// eslint-disable-next-line`,
            `export { prisma } from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        {
          code: [
            `// eslint-disable-next-line`,
            `export * from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        {
          code: [
            `// eslint-disable-next-line`,
            `export * as db from '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
        // 🔥 Codex R5 P2 fix:side-effect import 配 blanket disable
        {
          code: [
            `// eslint-disable-next-line`,
            `import '@/lib/db';`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
      ],
    });

    // Codex R6 P2:blanket disable + TS import-equals
    tsRuleTester.run('no-prisma-blanket-disable (R6 TS import-equals)', rule, {
      valid: [
        // 顯式 rule list + TS import-equals → OK
        {
          code: [
            `// eslint-disable-next-line no-restricted-imports`,
            `import db = require('@/lib/db');`,
          ].join('\n'),
        },
        // import-equals 從其他 module → 不攔
        {
          code: [
            `// eslint-disable-next-line`,
            `import other = require('@/lib/something-else');`,
          ].join('\n'),
        },
      ],
      invalid: [
        // blanket + TS import-equals → 報告
        {
          code: [
            `// eslint-disable-next-line`,
            `import db = require('@/lib/db');`,
          ].join('\n'),
          errors: [{ messageId: 'blanketDisableNearPrisma' }],
        },
      ],
    });

    //  valid case sanity:dynamic import / require 不在 blanket disable 緊鄰下面 → 不報
    ruleTester.run('no-prisma-blanket-disable (sanity)', rule, {
      valid: [
        // dynamic import 但前面有顯式 rule list → OK
        {
          code: [
            `// eslint-disable-next-line no-restricted-imports`,
            `const { prisma } = await import('@/lib/db');`,
          ].join('\n'),
        },
        // require 用顯式 rule list → OK(用 ESLint core 已知的 rule 名以免 RuleTester 抱怨)
        {
          code: [
            `// eslint-disable-next-line no-restricted-imports`,
            `const { prisma } = require('@/lib/db');`,
          ].join('\n'),
        },
        // dynamic import 不指向 @/lib/db → 不在本 rule 攔截範圍
        {
          code: [
            `// eslint-disable-next-line`,
            `const { other } = await import('@/lib/something-else');`,
          ].join('\n'),
        },
        // require 不指向 @/lib/db → OK
        {
          code: [
            `// eslint-disable-next-line`,
            `const { other } = require('@/lib/something-else');`,
          ].join('\n'),
        },
      ],
      invalid: [],
    });
  });
});
