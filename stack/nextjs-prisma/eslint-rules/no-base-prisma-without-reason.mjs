// eslint-rules/no-base-prisma-without-reason.js
//
// 自訂 ESLint rule:擋住 `import { prisma } from '@/lib/db'`(以及任何 alias
// 變體 e.g. `import { prisma as foo }`),強制走 tenant-aware getTenantPrisma()。
//
// 例外:若有充分理由(cron worker / cross-tenant batch / non-scoped table),
// 在 import 上方加 `// Reason: <TAG> — <text>` 即可放行。
//
// 取代先前的 grep-based 檢查腳本,
// AST-based 自動 cover:
//   - alias import bypass (`import { prisma as foo }` — Codex R5 dismissed)
//   - multiline import
//   - string literal false positive
//   - mixed-quote bypass
//
// 對齊 專案安全文件。
//
// 7 個 valid Reason TAG enum:
//   - CROSS_TENANT_CRON      cron job 跨 tenant batch operation
//   - CROSS_TENANT_BATCH     非 cron 但跨 tenant batch helper
//   - NON_SCOPED_TABLE       Tenant / Venue / User 等非 tenant-scoped 表
//   - FIRE_AND_FORGET        fire-and-forget 跨 request boundary
//   - HEALTH_CHECK           system-level 健康檢查跨 tenant 統計
//   - EXPLICIT_TENANT_PARAM  helper 接收 caller 顯式傳的 tenantId
//   - TEST_ONLY              vitest fixture by-id 直接讀寫
//
// Infrastructure allowlist(免檢):
//   - src/lib/db-tenant.ts(tenant 機制本身)
//   - src/lib/tenant-context.ts(同上)

const VALID_TAGS = new Set([
  'CROSS_TENANT_CRON',
  'CROSS_TENANT_BATCH',
  'NON_SCOPED_TABLE',
  'FIRE_AND_FORGET',
  'HEALTH_CHECK',
  'EXPLICIT_TENANT_PARAM',
  'TEST_ONLY',
]);

const INFRASTRUCTURE_ALLOWLIST = new Set(['src/lib/db-tenant.ts', 'src/lib/tenant-context.ts']);

// `// Reason: <TAG> — <text>`(em-dash / en-dash / ASCII hyphen 都接受)
const REASON_RE = /^\s*Reason:\s*([A-Z_]+)\s*[—–-]\s*\S.*$/;

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止直接 import base prisma 不附 Reason tag — natively cover alias bypass',
      recommended: true,
    },
    schema: [],
    messages: {
      noBasePrismaImport: '禁止 `import {{ originalName }}{{ aliasNote }} from "@/lib/db"`。請改走 `getTenantPrisma()` from @/lib/db-tenant 以確保 tenant 隔離。若這檔案真的需要跨 tenant,在 import 上方加 `// Reason: <TAG> — <text>` 即可放行(TAG 限以下 enum:{{ tagList }})',
      reasonInvalidTag: '`// Reason: {{ tag }} — ...` tag 不在 enum 內。有效 tag:{{ tagList }}',
      reasonMalformed: 'Import 上方需 `// Reason: <TAG> — <一句說明>` 格式註解。當前上方註解內容:"{{ commentText }}"',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    // 把絕對路徑轉成相對於 repo root 的路徑(用 cwd 推算)
    const cwd = context.cwd ?? context.getCwd?.() ?? process.cwd();
    const relativePath = filename.startsWith(cwd) ? filename.slice(cwd.length + 1) : filename;

    // Infrastructure allowlist 免檢
    if (INFRASTRUCTURE_ALLOWLIST.has(relativePath)) {
      return {};
    }

    /**
     * 共用 Reason tag 檢查:從目標 statement 往上找最近 Reason comment,
     * 驗證 enum + 格式。共用於 static `ImportDeclaration` 與 後續新增的
     * `ImportExpression`(`await import('@/lib/db')`)/ `CallExpression`(`require('@/lib/db')`)。
     *
     * @param {import('eslint').Rule.Node} tagSearchNode — 找 Reason comment 的 statement 級 node
     * @param {import('eslint').Rule.Node} reportNode — context.report 的 location anchor
     *   (Codex R2 P1 fix:多行 case 把 report loc 鎖到 expression 本身,
     *    避免 `// eslint-disable-next-line` + 多行 `const { prisma } =\n  await import('@/lib/db')`
     *    讓 directive 靜音整個 VariableDeclaration 的報告)
     * @param {object} reportData — `noBasePrismaImport` messageId 用的 data
     */
    function checkReasonTag(tagSearchNode, reportNode, reportData) {
      const commentsBefore = context.sourceCode.getCommentsBefore(tagSearchNode);
      const reasonComment = [...commentsBefore].reverse().find((c) => {
        const text = c.value.trim();
        return text.startsWith('Reason:');
      });

      if (!reasonComment) {
        context.report({
          node: reportNode,
          loc: reportNode.loc,
          messageId: 'noBasePrismaImport',
          data: {
            ...reportData,
            tagList: Array.from(VALID_TAGS).join(' / '),
          },
        });
        return;
      }

      const match = reasonComment.value.trim().match(REASON_RE);
      if (!match) {
        context.report({
          node: reportNode,
          loc: reportNode.loc,
          messageId: 'reasonMalformed',
          data: { commentText: reasonComment.value.trim() },
        });
        return;
      }

      const tag = match[1];
      if (!VALID_TAGS.has(tag)) {
        context.report({
          node: reportNode,
          loc: reportNode.loc,
          messageId: 'reasonInvalidTag',
          data: {
            tag,
            tagList: Array.from(VALID_TAGS).join(' / '),
          },
        });
      }
    }

    /**
     * Codex R2 P1 fix:接受 string Literal **或** no-substitution TemplateLiteral
     * (`\`@/lib/db\``)為目標 specifier。ESTree 把 `import(\`@/lib/db\`)` source 設為
     * `TemplateLiteral` 而非 `Literal`,原 visitor `type === 'Literal'` 嚴格檢查漏。
     *
     * 只接受沒 ${} 的 template(`expressions.length === 0`)— 有 substitution 的
     * template 因為 cooked 值取決於 runtime expression value,無法 static analysis 判斷。
     */
    function isTargetSpecifier(specNode) {
      if (!specNode) return false;
      if (specNode.type === 'Literal') return specNode.value === '@/lib/db';
      if (specNode.type === 'TemplateLiteral') {
        return (
          specNode.expressions.length === 0 &&
          specNode.quasis.length === 1 &&
          specNode.quasis[0].value.cooked === '@/lib/db'
        );
      }
      return false;
    }

    return {
      ImportDeclaration(node) {
        // Source 必須是 `@/lib/db`(精確 match,不 cover transitive)
        if (node.source.value !== '@/lib/db') return;

        // Codex R3 + R5 fix:四種 dangerous static import shape 都要攔
        //   1. `import { prisma } from '@/lib/db'`(named,Identifier-imported)
        //   2. `import { "prisma" as p } from '@/lib/db'`(named,Literal-imported,ES2022)
        //   3. `import * as db from '@/lib/db'`(namespace — 之後 `db.prisma` 取得 raw client)
        //   4. `import '@/lib/db';`(side-effect-only — 仍 evaluate module 構 PrismaClient
        //      singleton。對齊 dynamic import / require 對 bare load 也要求 Reason tag 的嚴格)

        const namespaceSpec = node.specifiers.find(
          (s) => s.type === 'ImportNamespaceSpecifier'
        );

        const prismaSpec = node.specifiers.find(
          (s) =>
            s.type === 'ImportSpecifier' &&
            s.imported &&
            ((s.imported.type === 'Identifier' && s.imported.name === 'prisma') ||
              (s.imported.type === 'Literal' && s.imported.value === 'prisma'))
        );

        const isSideEffectImport = node.specifiers.length === 0;

        if (!namespaceSpec && !prismaSpec && !isSideEffectImport) return;

        let originalName;
        let aliasNote = '';
        if (namespaceSpec) {
          originalName = `* as ${namespaceSpec.local.name}`;
        } else if (isSideEffectImport) {
          originalName = "'@/lib/db' (side-effect)";
        } else {
          originalName = '{ prisma }';
          aliasNote =
            prismaSpec.local.name !== 'prisma' ? ` as ${prismaSpec.local.name}` : '';
        }
        // static import 沒有多行 bypass 問題,tagSearch + report 同一個 node
        checkReasonTag(node, node, { originalName, aliasNote });
      },

      // Codex R6 P2 fix:TS `import db = require('@/lib/db')` 形態
      // @typescript-eslint/parser 解析為 TSImportEqualsDeclaration with
      // moduleReference.type === 'TSExternalModuleReference'。
      // 編譯到 JS 後是 `require('@/lib/db')`,構 PrismaClient — 同樣 bypass surface。
      // scripts/** 用 tsx 跑 TS 但不過 Next tsconfig,正是這形態的高危地帶。
      TSImportEqualsDeclaration(node) {
        if (!node.moduleReference) return;
        if (node.moduleReference.type !== 'TSExternalModuleReference') return;
        const expr = node.moduleReference.expression;
        if (!expr) return;
        if (expr.type === 'Literal' && expr.value === '@/lib/db') {
          const localName = node.id && node.id.name ? node.id.name : 'db';
          checkReasonTag(node, node, {
            originalName: `import ${localName} = require('@/lib/db')`,
            aliasNote: '',
          });
        }
      },

      // Codex R4 P2 fix:re-export bypass
      // `export { prisma } from '@/lib/db'` / `export { prisma as p } from '@/lib/db'`
      // 同 ImportDeclaration 但 specifier 在 ExportNamedDeclaration.specifiers,
      // 結構是 ExportSpecifier(`local`, `exported`)。`local.name === 'prisma'` 表示
      // 從 source 抓出 prisma export 重新暴露,這正是 bypass surface — 下游 import
      // 從 re-exporter 拿到 raw prisma,而 ESLint 看不到 `@/lib/db` 字串。
      ExportNamedDeclaration(node) {
        if (!node.source || node.source.value !== '@/lib/db') return;
        if (!Array.isArray(node.specifiers)) return;

        // 找 `export { prisma } from '@/lib/db'`:ExportSpecifier with local.name === 'prisma'
        // 也接受 ES2022 Literal-name:`export { "prisma" as p } from '@/lib/db'`
        const prismaSpec = node.specifiers.find((s) => {
          if (s.type !== 'ExportSpecifier' || !s.local) return false;
          if (s.local.type === 'Identifier') return s.local.name === 'prisma';
          if (s.local.type === 'Literal') return s.local.value === 'prisma';
          return false;
        });

        if (!prismaSpec) return;

        const exportedName =
          prismaSpec.exported.type === 'Identifier'
            ? prismaSpec.exported.name
            : prismaSpec.exported.value;
        const aliasNote = exportedName !== 'prisma' ? ` as ${exportedName}` : '';
        checkReasonTag(node, node, { originalName: 'export { prisma }', aliasNote });
      },

      // Codex R4 P2 fix:`export * from '@/lib/db'` / `export * as db from '@/lib/db'`
      // ExportAllDeclaration 把整個 source namespace re-expose,任何下游可拿 prisma
      ExportAllDeclaration(node) {
        if (!node.source || node.source.value !== '@/lib/db') return;
        const namespaceNote = node.exported
          ? `* as ${node.exported.type === 'Identifier' ? node.exported.name : node.exported.value}`
          : '*';
        checkReasonTag(node, node, { originalName: `export ${namespaceNote}`, aliasNote: '' });
      },

      // 後續迭代:dynamic import bypass detection
      // 攔 `await import('@/lib/db')` / `import('@/lib/db').then(...)` / `import(\`@/lib/db\`)`
      // AST node:`ImportExpression`(source 是 string Literal 或 no-substitution TemplateLiteral)
      //
      // Codex R2 P1 fix(template literal):isTargetSpecifier 接受 Literal + TemplateLiteral
      // Codex R2 P1 fix(multiline bypass):report loc 用 ImportExpression 本身(node),不是
      //   findEnclosingStatement,避免 `// eslint-disable-next-line` 靜音整個多行 VariableDeclaration
      //
      // R7 Claude /review CRITICAL fix(wrapped bypass):
      //   原 tagSearch=findEnclosingStatement(node) 對於 `const loadDb = () => import('@/lib/db')`
      //   會走到 VariableDeclaration,接受其上方 Reason — 但 Reason 註解距離 import 隔了一個
      //   ArrowFunctionExpression body,等於替「閉包導出」貼合規貼紙,實際是把 raw prisma
      //   匯出給其他 module 使用。改:若 walk 過程跨越 function / object / sequence 等
      //   wrapper boundary,tagSearch 必須改回 inner ImportExpression node,Reason 註解
      //   必須直接黏在 import 表達式之前。
      ImportExpression(node) {
        if (!isTargetSpecifier(node.source)) return;
        const { stmt, wrapped } = findEnclosingStatementWithWrapDetection(node);
        const tagSearchNode = wrapped ? node : stmt;
        checkReasonTag(tagSearchNode, node, {
          originalName: "import('@/lib/db')",
          aliasNote: '',
        });
      },

      // 後續迭代:CommonJS require bypass detection
      // 攔 `require('@/lib/db')`(包含 `const { prisma } = require('@/lib/db')`)
      // AST node:`CallExpression` with callee.name === 'require',**args[0]** string literal
      // TS / Next.js 主要走 ESM,但留條 require 防線(typo 或 legacy code path)
      //
      // Codex R1 P2 fix:Node `require(target, ...extra)` 只看 args[0],額外參數會被忽略
      // 但仍載入同樣 module。原 `arguments.length !== 1` 嚴格檢查可被 `require('@/lib/db', undefined)`
      // 繞過 — 改成只看「至少有一個 arg 且 args[0] 是目標 literal」。
      //
      // Codex R2 P1 fix(template literal):isTargetSpecifier 接受 Literal + TemplateLiteral
      // Codex R2 P1 fix(multiline bypass):report loc 用 require CallExpression 本身
      // R7 Claude /review CRITICAL fix:wrapped require 同 ImportExpression 處理
      //   (`const loadDb = () => require('@/lib/db')` 也是 closure 導出 bypass)
      CallExpression(node) {
        if (
          node.callee.type !== 'Identifier' ||
          node.callee.name !== 'require' ||
          node.arguments.length < 1 ||
          !isTargetSpecifier(node.arguments[0])
        )
          return;

        const { stmt, wrapped } = findEnclosingStatementWithWrapDetection(node);
        const tagSearchNode = wrapped ? node : stmt;
        checkReasonTag(tagSearchNode, node, {
          originalName: "require('@/lib/db')",
          aliasNote: '',
        });
      },
    };
  },
};

// 找包住 expression 的最近 Statement(comments 在 ESLint 通常 attach 到 statement-level
// node),並回報是否跨越「wrapper」boundary
// (function body / object value / sequence expression)。wrapped=true 表示 import 被 closure /
// nested object / comma operator 隔開,enclosing statement 上方的 Reason 註解實際在描述「閉包
// 宣告」而非「實際 import」。此時 Reason 必須直接黏在 inner ImportExpression / require call
// 之前(不可以靠 outer statement 的 Reason 蒙混過關)。
//
// 不算 wrapper 的(import 仍直接在 statement 層級執行):
//   - AwaitExpression(`await import()`)
//   - MemberExpression(`import().then()`)
//   - VariableDeclarator(`const x = import()`)
//   - ArrayExpression / ConditionalExpression / LogicalExpression / BinaryExpression
//     (import 直接是值,不被 closure 延遲執行)
//
// 算 wrapper 的(import 被 defer / nested / 隱藏):
//   - ArrowFunctionExpression / FunctionExpression / FunctionDeclaration / MethodDefinition
//   - ObjectExpression / Property / PropertyDefinition
//   - SequenceExpression(`(foo(), import())`)
//   - ClassBody(class member 內部)
const WRAPPER_NODE_TYPES = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
  'MethodDefinition',
  'PropertyDefinition',
  'ObjectExpression',
  'Property',
  'SequenceExpression',
  'ClassBody',
]);

function findEnclosingStatementWithWrapDetection(node) {
  let current = node.parent;
  let wrapped = false;
  while (current) {
    if (WRAPPER_NODE_TYPES.has(current.type)) {
      wrapped = true;
    }
    if (current.type.endsWith('Statement') || current.type === 'VariableDeclaration') {
      return { stmt: current, wrapped };
    }
    current = current.parent;
  }
  return { stmt: node, wrapped };
}

export default rule;
