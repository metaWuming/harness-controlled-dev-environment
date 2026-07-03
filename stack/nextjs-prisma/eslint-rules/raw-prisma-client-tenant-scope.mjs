// eslint-rules/raw-prisma-client-tenant-scope.js
//
// 自訂 ESLint rule:`new PrismaClient(...)` constructor 直接生 raw client 必須
// 在上方 5 行內附 `// Tenant scope: <TAG> — <text>` comment,標明繞 tenant-scoped
// client 的 raison d'être。
//
// 取代先前 grep regex 的 raw PrismaClient detection(舊版 grep 檢查腳本
// 內的 `/\bnew\s+PrismaClient\s*\(/`)。AST-based 自動 cover:
//   - multiline `new\nPrismaClient(...)`
//   - 各種空白 / 換行變體
//   - string literal false positive 由 AST 區隔(NewExpression 不會 match string content)
//   - alias import (`new PC()` after `import { PrismaClient as PC }` 也偵測)
//
// 7 個 valid Tenant scope TAG enum(對齊 專案安全文件 + scripts/ + tests/ audit):
//   - CROSS_TENANT_SEED      Seed 多 tenant 或 base fixture(seed-*.ts)
//   - CROSS_TENANT_VERIFY    Verify 整資料庫狀態(verify-*.ts)
//   - CROSS_TENANT_CLEANUP   Cleanup / wipe / backfill 跨 tenant(cleanup-*.ts / wipe-*.ts)
//   - CROSS_TENANT_INSPECT   讀全 tenant 統計 / list(check-*.ts / inspect-*.ts)
//   - SINGLE_TENANT_EXPLICIT 顯式指定單一 tenant 操作(restore-*.ts 等)
//   - INFRASTRUCTURE_TOOL    Email / 第三方 API probe(probe-*.ts / test-*.ts)
//   - TEST_FIXTURE           vitest integration test 用 PrismaPg adapter 直連 dev DB(tests/*.test.ts)
//                            後續新增,取代先前版本對 tests/** silent skip
//
// Allowlist(免檢):
//   - src/lib/db.ts(base prisma singleton 本身)

const TENANT_SCOPE_TAGS = new Set([
  'CROSS_TENANT_SEED',
  'CROSS_TENANT_VERIFY',
  'CROSS_TENANT_CLEANUP',
  'CROSS_TENANT_INSPECT',
  'SINGLE_TENANT_EXPLICIT',
  'INFRASTRUCTURE_TOOL',
  'TEST_FIXTURE',
]);

const RAW_PRISMA_ALLOWLIST = new Set(['src/lib/db.ts']);

// `// Tenant scope: <TAG> — <text>`(em-dash / en-dash / ASCII hyphen 都接受)
const TENANT_SCOPE_RE = /^\s*Tenant scope:\s*([A-Z_]+)\s*[—–-]\s*\S.*$/;

// 5 行 lookback window(NewExpression 上方 5 行內找 tag comment)
const LOOKBACK_LINES = 5;

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: '`new PrismaClient` constructor 必須附 Tenant scope tag — natively cover multiline / alias',
      recommended: true,
    },
    schema: [],
    messages: {
      missingTenantScope:
        '`new PrismaClient(...)` 上方 {{ lookback }} 行內沒有 `// Tenant scope: <TAG> — <text>` comment。請依 專案安全文件 加 tag(有效 tag:{{ tagList }})',
      missingTenantScopeWithHint:
        '`new PrismaClient(...)` 上方 {{ lookback }} 行內沒有 `// Tenant scope: <TAG> — <text>` comment(line {{ hintLine }} 有 tag 但太遠 — 請移近至 5 行 lookback window 內)。有效 tag:{{ tagList }}',
      invalidTenantScopeTag:
        'Tenant scope tag `{{ tag }}` 不在 enum 內。有效 tag:{{ tagList }}',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    const cwd = context.cwd ?? context.getCwd?.() ?? process.cwd();
    const relativePath = filename.startsWith(cwd) ? filename.slice(cwd.length + 1) : filename;

    // Allowlist 免檢
    if (RAW_PRISMA_ALLOWLIST.has(relativePath)) {
      return {};
    }

    return {
      NewExpression(node) {
        // 兩種 callee 都偵測(/review C2 fix):
        //   1. 直接 Identifier:`new PrismaClient(...)` — 最常見
        //   2. MemberExpression with property name = PrismaClient:`new Prisma.PrismaClient()`
        //      / `new PrismaGen.PrismaClient()`(namespace import + member access 變體)
        //      原只查 Identifier 漏這條 — 而 `import * as PrismaGen from '@/generated/prisma/client'`
        //      正是 codebase 既有用法之一(src/lib/db.ts pattern 變體)
        //
        // Alias case `import { PrismaClient as PC }` 後 `new PC(...)` 仍漏(callee.name = PC),
        // 屬 intentional bypass(必須寫 alias 故意繞)— 留 code review 階段攔,
        // SECURITY.md §3.5 已記錄為已知 limitation。
        const isDirectIdent = node.callee.type === 'Identifier' && node.callee.name === 'PrismaClient';
        const isMemberAccess =
          node.callee.type === 'MemberExpression' &&
          node.callee.property &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'PrismaClient';
        if (!isDirectIdent && !isMemberAccess) return;

        const newKeywordLine = node.loc.start.line;

        // 用 `getAllComments()` 而非 `getCommentsBefore(node)` — 後者只回傳「緊鄰」node
        // 的 comments,中間若有 code(e.g. `const pool = ...` + 另一個 `// eslint-disable-next-line`)
        // 隔開,earlier comment 抓不到。整檔掃 + line range filter 才能 cover 真實 lookback。
        const allComments = context.sourceCode.getAllComments();
        const nearbyComments = allComments.filter(
          (c) =>
            c.loc.end.line >= newKeywordLine - LOOKBACK_LINES &&
            c.loc.end.line < newKeywordLine
        );

        // 找最近一條 Tenant scope tag
        const tagComment = [...nearbyComments].reverse().find((c) => {
          const text = c.value.trim();
          return text.startsWith('Tenant scope:');
        });

        if (!tagComment) {
          // /review M4 fix:用 reverse().find() 取得「最接近 lookback 邊界」的 tag
          // (allComments 依 source order 升序;原 .find() 會回傳最遠的 tag,
          // 對使用者來說 hint 提示「太遠」不具行動性 — 改提示最近的那個即可移近)
          const farTagComment = [...allComments].reverse().find(
            (c) =>
              c.loc.end.line < newKeywordLine - LOOKBACK_LINES &&
              c.loc.end.line >= newKeywordLine - 20 &&
              c.value.trim().startsWith('Tenant scope:')
          );

          if (farTagComment) {
            context.report({
              node,
              messageId: 'missingTenantScopeWithHint',
              data: {
                lookback: String(LOOKBACK_LINES),
                hintLine: String(farTagComment.loc.start.line),
                tagList: Array.from(TENANT_SCOPE_TAGS).join(' / '),
              },
            });
          } else {
            context.report({
              node,
              messageId: 'missingTenantScope',
              data: {
                lookback: String(LOOKBACK_LINES),
                tagList: Array.from(TENANT_SCOPE_TAGS).join(' / '),
              },
            });
          }
          return;
        }

        const match = tagComment.value.trim().match(TENANT_SCOPE_RE);
        if (!match) {
          context.report({
            node,
            messageId: 'invalidTenantScopeTag',
            data: {
              tag: tagComment.value.trim(),
              tagList: Array.from(TENANT_SCOPE_TAGS).join(' / '),
            },
          });
          return;
        }

        const tag = match[1];
        if (!TENANT_SCOPE_TAGS.has(tag)) {
          context.report({
            node,
            messageId: 'invalidTenantScopeTag',
            data: {
              tag,
              tagList: Array.from(TENANT_SCOPE_TAGS).join(' / '),
            },
          });
        }
      },
    };
  },
};

export default rule;
