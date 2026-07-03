// eslint-rules/no-prisma-blanket-disable.mjs
//
// 自訂 ESLint rule:防 `// eslint-disable-next-line`(blanket,無 rule name)出現
// 在 dangerous prisma pattern 之上 — 緊鄰下方若是 `import { prisma } from '@/lib/db'`
// 或 `new PrismaClient(...)` 則 fail。
//
// 為何需要(Codex R1 P1):
//   原 grep-based gate(舊版 grep 檢查腳本)能抓「blanket
//   disable 緊鄰危險 import」這種 intentional bypass。但 ESLint 自訂 rule 本身被 blanket
//   `eslint-disable-next-line` 自身 silence(因為 directive disable 所有 rule),
//   所以兩個 prisma rule 都會被繞過。本 rule 在 Program:exit 層級掃整檔 comments,
//   而非在 ImportDeclaration / NewExpression visitor — 它的 report 不依靠 inline 處理,
//   不會被同一個 directive 自身 silence(report 在 comment line,directive 應用在 next line)。
//
// 報告位置:report 在 blanket comment 自身的 token,而非下方的 import / NewExpression。
// 因此即使 `// eslint-disable-next-line` 在 line N(applies to line N+1),本 rule 在 line N
// 報告,不被該 directive 覆蓋。
//
// 允許的逃生口:specific rule list(e.g. `// eslint-disable-next-line no-restricted-imports`)
//   仍 OK — 顯式列出 rule 名稱 = 開發者知道在繞什麼。只有 blanket(無 rule name)被擋。

// Codex R2 P1 fix:接受 ESLint 標準的 description 後綴(`-- text`)。
// 「blanket」= 沒列任何 rule name,可選描述後綴。
//   - `eslint-disable-next-line`(純 blanket)
//   - `eslint-disable-next-line -- 解釋為何 disable`(blanket with description)
//   - `eslint-disable-next-line   ` (trailing whitespace)
// 不接 blanket:`eslint-disable-next-line some-rule` / `eslint-disable-next-line some-rule -- ...`
const BLANKET_DISABLE_RE = /^\s*eslint-disable-next-line(\s*(--.*)?)?\s*$/;

// AST-precise check 取代原 regex(Codex R5 P2 fix):
// - 原 regex 用 sourceCode.getText(statement) 測整段 statement 文字,
//   會誤抓 `for/if/function { ... const prisma = new PrismaClient(); }` 內部
//   (block body 在 targetLine 之後幾行,實際不受 directive silence)。
// - 改 AST-precise:遞迴找 loc.start.line === targetLine 的 ImportDeclaration
//   或 NewExpression(精確判斷是「真的 directive 適用的 dangerous node」)。
//
// directive `// eslint-disable-next-line` 只 silence「下一行 of code」的 diagnostics,
// 即 loc.start.line === targetLine 的 node 報告。Node 內部子節點若在後續行,
// 不會被 silence — 所以不該被誤判為 bypass。

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '禁止用 blanket `// eslint-disable-next-line` 繞過 prisma governance — 必須顯式列 rule name',
      recommended: true,
    },
    schema: [],
    messages: {
      blanketDisableNearPrisma:
        '禁止 blanket `// eslint-disable-next-line`(無 rule name)緊鄰 base prisma import 或 `new PrismaClient(...)`。請改用顯式 rule list(e.g. `// eslint-disable-next-line no-restricted-imports`)+ 上方加 `// Reason: <TAG> — <text>` 標明跨 tenant 用途。詳見 專案安全文件',
    },
  },

  create(context) {
    return {
      'Program:exit'(programNode) {
        const allComments = context.sourceCode.getAllComments();

        for (const comment of allComments) {
          // /review C1 fix:ESLint 接受 block comment `/* eslint-disable-next-line */`
          // 為合法 directive,先前只查 Line comment 漏一條 bypass。同樣處理 Block comment。
          if (comment.type !== 'Line' && comment.type !== 'Block') continue;
          if (!BLANKET_DISABLE_RE.test(comment.value)) continue;

          // ESLint `eslint-disable-next-line` 適用到 comment 所在 line 的下一行 (loc.start.line === targetLine)
          // 的 diagnostics。檢查該 line 是否有真正 dangerous node。
          const targetLine = comment.loc.end.line + 1;

          if (hasDangerousNodeAtLine(programNode, targetLine)) {
            context.report({
              loc: comment.loc,
              messageId: 'blanketDisableNearPrisma',
            });
          }
        }
      },
    };
  },
};

/**
 * 在 AST 中找 loc.start.line === targetLine 且 type 為 dangerous 的 node。
 *
 * Dangerous node = 四種(後續迭代 Codex R1 P1 擴):
 *   1. ImportDeclaration(source='@/lib/db'),且 specifiers 含 imported.name='prisma'
 *   2. NewExpression(callee.type='Identifier', callee.name='PrismaClient')
 *   3. ImportExpression(source='@/lib/db')— `await import('@/lib/db')`(後續新增)
 *   4. CallExpression(callee.name='require', args[0]='@/lib/db')— CommonJS(後續新增)
 *
 * 設計:遞迴走訪所有節點(用範圍剪枝跳過 loc 不涵蓋 targetLine 的子樹),只報告
 *   start.line === targetLine 的 node — 這對應 ESLint disable-next-line 真正 silence 的 line。
 *   Block body 在 targetLine 之後幾行的 NewExpression 不算(不受 directive silence)。
 *
 * Codex R5 P2 fix:取代原 sourceCode.getText(statement) regex 的 over-match。
 * Codex R1 P1 fix:加 ImportExpression / require CallExpression 兩條 dangerous shape,
 *   不然 `// eslint-disable-next-line` + dynamic import 仍可繞 no-base-prisma rule 報告。
 */
// 後續迭代:補 comment 相關 keys
// 某些 parser(@typescript-eslint/parser 開特定 options 時)會把 comment node 掛在
// `leadingComments` / `trailingComments` / `innerComments` 屬性下,walker 若無 skip
// 會遞迴走進 comment node(type='Line'|'Block'),浪費 stack frame。
// Comment node 沒 dangerous shape 條件不會誤判,但純 perf / noise gate。
const SKIP_KEYS = new Set([
  'parent',
  'loc',
  'range',
  'start',
  'end',
  'tokens',
  'comments',
  'leadingComments',
  'trailingComments',
  'innerComments',
]);

function isDangerousImportAtLine(node, targetLine) {
  if (node.type !== 'ImportDeclaration') return false;
  if (!node.loc || node.loc.start.line !== targetLine) return false;
  if (!node.source || node.source.value !== '@/lib/db') return false;
  if (!Array.isArray(node.specifiers)) return false;
  // Codex R3 + R5 fix:四種 dangerous static import shape 都要當 dangerous
  //   1. Named ImportSpecifier with Identifier-imported (prisma)
  //   2. Named ImportSpecifier with Literal-imported ("prisma" — ES2022 arbitrary names)
  //   3. ImportNamespaceSpecifier (`import * as db from '@/lib/db'` → db.prisma)
  //   4. Side-effect-only import(specifiers 為空,仍 evaluate module 構 PrismaClient)
  if (node.specifiers.length === 0) return true;
  return node.specifiers.some((s) => {
    if (s.type === 'ImportNamespaceSpecifier') return true;
    if (s.type !== 'ImportSpecifier' || !s.imported) return false;
    if (s.imported.type === 'Identifier') return s.imported.name === 'prisma';
    if (s.imported.type === 'Literal') return s.imported.value === 'prisma';
    return false;
  });
}

// Codex R6 P2 fix:TS `import db = require('@/lib/db')` 形態
// @typescript-eslint/parser 解析為 TSImportEqualsDeclaration
function isDangerousTSImportEqualsAtLine(node, targetLine) {
  if (node.type !== 'TSImportEqualsDeclaration') return false;
  if (!node.loc || node.loc.start.line !== targetLine) return false;
  if (!node.moduleReference || node.moduleReference.type !== 'TSExternalModuleReference') return false;
  const expr = node.moduleReference.expression;
  return expr && expr.type === 'Literal' && expr.value === '@/lib/db';
}

// Codex R4 P2 fix:`export { prisma } from '@/lib/db'` 重新暴露 raw prisma
function isDangerousExportNamedAtLine(node, targetLine) {
  if (node.type !== 'ExportNamedDeclaration') return false;
  if (!node.loc || node.loc.start.line !== targetLine) return false;
  if (!node.source || node.source.value !== '@/lib/db') return false;
  if (!Array.isArray(node.specifiers)) return false;
  return node.specifiers.some((s) => {
    if (s.type !== 'ExportSpecifier' || !s.local) return false;
    if (s.local.type === 'Identifier') return s.local.name === 'prisma';
    if (s.local.type === 'Literal') return s.local.value === 'prisma';
    return false;
  });
}

// Codex R4 P2 fix:`export * from '@/lib/db'` / `export * as db from '@/lib/db'`
function isDangerousExportAllAtLine(node, targetLine) {
  if (node.type !== 'ExportAllDeclaration') return false;
  if (!node.loc || node.loc.start.line !== targetLine) return false;
  if (!node.source) return false;
  return node.source.value === '@/lib/db';
}

function isDangerousNewExpressionAtLine(node, targetLine) {
  if (node.type !== 'NewExpression') return false;
  if (!node.loc || node.loc.start.line !== targetLine) return false;
  if (!node.callee || node.callee.type !== 'Identifier') return false;
  return node.callee.name === 'PrismaClient';
}

// Codex R2 P1:接受 string Literal 或 no-substitution TemplateLiteral 為 specifier
// `import(\`@/lib/db\`)` source 是 TemplateLiteral 而非 Literal — 原嚴格檢查漏。
function isTargetLibDbSpecifier(node) {
  if (!node) return false;
  if (node.type === 'Literal') return node.value === '@/lib/db';
  if (node.type === 'TemplateLiteral') {
    return (
      node.expressions.length === 0 &&
      node.quasis.length === 1 &&
      node.quasis[0].value.cooked === '@/lib/db'
    );
  }
  return false;
}

// :dynamic `import('@/lib/db')` / `await import('@/lib/db')` / `import(\`@/lib/db\`)`
function isDangerousImportExpressionAtLine(node, targetLine) {
  if (node.type !== 'ImportExpression') return false;
  if (!node.loc || node.loc.start.line !== targetLine) return false;
  return isTargetLibDbSpecifier(node.source);
}

// :CommonJS `require('@/lib/db')`(也接 extra args + template literal,
// 對齊 no-base-prisma Codex R1 P2 + R2 P1 fix)
function isDangerousRequireCallAtLine(node, targetLine) {
  if (node.type !== 'CallExpression') return false;
  if (!node.loc || node.loc.start.line !== targetLine) return false;
  if (!node.callee || node.callee.type !== 'Identifier' || node.callee.name !== 'require') return false;
  if (!Array.isArray(node.arguments) || node.arguments.length < 1) return false;
  return isTargetLibDbSpecifier(node.arguments[0]);
}

function hasDangerousNodeAtLine(programNode, targetLine) {
  let found = false;
  function walk(node) {
    if (found) return;
    if (!node) return;
    if (Array.isArray(node)) {
      for (const c of node) walk(c);
      return;
    }
    if (typeof node !== 'object' || !node.type) return;

    // 範圍剪枝:loc 完全不涵蓋 targetLine → 整個子樹跳過
    if (node.loc) {
      if (node.loc.end.line < targetLine || node.loc.start.line > targetLine) return;
    }

    // 命中:7 種 dangerous node 任一 at targetLine(R4 P2 加 export 兩條 + R6 P2 加 TS import-equals)
    if (
      isDangerousImportAtLine(node, targetLine) ||
      isDangerousNewExpressionAtLine(node, targetLine) ||
      isDangerousImportExpressionAtLine(node, targetLine) ||
      isDangerousRequireCallAtLine(node, targetLine) ||
      isDangerousExportNamedAtLine(node, targetLine) ||
      isDangerousExportAllAtLine(node, targetLine) ||
      isDangerousTSImportEqualsAtLine(node, targetLine)
    ) {
      found = true;
      return;
    }

    // 遞迴走訪所有子節點 property
    for (const key in node) {
      if (SKIP_KEYS.has(key)) continue;
      walk(node[key]);
    }
  }
  walk(programNode);
  return found;
}

export default rule;
