// eslint-rules/no-unclosed-test-pool.mjs
//
// 自訂 ESLint rule:tests/ 下的測試檔若 `new pg.Pool(...)` 建立連線池,
// 必須在同檔內呼叫對應的 `<pool>.end()` 收尾,否則報錯。
//
// 為什麼存在(根因):
//   vitest.config.ts 設 `fileParallelism: false` → 所有測試檔序列跑在「單一長命 worker」,
//   `isolate: true`(預設)下該 worker 整輪不死。每個測試檔在 module 頂層
//   `const pool = new pg.Pool({ connectionString: DATABASE_URL })`(pg 預設 max:10)。
//   Prisma 7 driver adapter 下 `prisma.$disconnect()` 只 flush 引擎、**不會關外部傳入的
//   pg.Pool** → 漏關的 pool 連線整輪累積,越過共用 dev DB 的 max_connections(60)後,
//   後續檔 beforeAll 取不到連線 → 偶發、非確定性的「整檔 setup 失敗 + 級聯崩潰」。
//   (根治:一次補了 5 個漏關檔,本 rule 防第 6 個再悄悄出現。)
//
// 偵測策略(AST + scope binding,對齊 raw-prisma-client-tenant-scope 的 house style):
//   1. NewExpression callee 是 `pg.Pool`(MemberExpression)或 `Pool`(Identifier)→ 透過
//      sourceCode.getDeclaredVariables() 取得「該宣告的 binding」(不是只記變數名)
//   2. Program:exit:對每個 pool binding,掃它的 scope references — 只要有一條 reference
//      被當成 `<pool>.end()` 的 callee 物件,即視為已收尾;否則報 unclosedPool
//   ⚠️ 用 binding(scope reference)而非「變數名字串比對」:後者會被 shadow 騙過 —
//      例如 `const pool = new pg.Pool()` 漏關,但另有 `function cleanup(pool){ pool.end() }`
//      的同名參數呼叫 .end(),字串比對會誤判已關(false negative,放走真洩漏)。
//      (Codex review P2)
//
// 範圍:只檢 `tests/**/*.test.ts`(production 的 src/lib/db.ts 是「整個 app 生命週期單例 pool,
//        刻意不 end」,不在本 rule 範圍)。
//
// 已知限制(/review P3;對齊 raw-prisma-client-tenant-scope 對 alias 的同類處置 —
// 不做 import-binding 解析,過度複雜且 alias 本身是刻意繞過訊號,留 code review 攔):
//   - aliased import:`import { Pool as X } from 'pg'` 後 `new X()` callee 名非 Pool / pg.Pool
//     → 偵測不到(罕見)。一般 `import { Pool } from 'pg'` + `new Pool()`(Identifier callee)
//     與 `import pg from 'pg'` + `new pg.Pool()`(MemberExpression callee)皆偵測得到。
//   - `let pool; pool = new pg.Pool()`(assign 給先宣告變數,非 const 宣告)→ 報 anonymousPool,
//     訊息文字不精準但仍 flag 洩漏(fail-safe)。測試檔的 pool 一律 module 頂層 `const`,
//     實務不發生。

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '測試檔建立的 pg.Pool 必須呼叫對應的 pool.end() 收尾,避免單一 worker 整輪累積連線耗盡 DB',
      recommended: true,
    },
    schema: [],
    messages: {
      unclosedPool:
        '測試檔建立的 pg.Pool `{{ name }}` 沒有對應的 `{{ name }}.end()` 呼叫。漏關會在 vitest 單一長命 worker 整輪累積連線 → 耗盡共用 dev DB → 後續檔 setup 級聯崩潰。請在 afterAll 加 `await {{ name }}.end()`。',
      anonymousPool:
        '匿名 `new pg.Pool(...)`(未賦值給變數)無法保證被 .end() 收尾。請先 `const pool = new pg.Pool(...)` 再在 afterAll `await pool.end()`。',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();
    // 只檢 tests/ 下的 *.test.ts(production pool 例如 src/lib/db.ts 刻意長命,不在範圍)。
    // `(^|[\\/])` 同時涵蓋 eslint 的絕對路徑與 RuleTester 的相對 filename(`tests/foo.test.ts`)。
    if (!/(^|[\\/])tests[\\/].*\.test\.ts$/.test(filename)) {
      return {};
    }

    const sourceCode = context.sourceCode ?? context.getSourceCode();

    // callee 是否為 pg.Pool / Pool 建構
    function isPgPoolNew(node) {
      const c = node.callee;
      if (
        c.type === 'MemberExpression' &&
        c.property &&
        c.property.type === 'Identifier' &&
        c.property.name === 'Pool'
      ) {
        return true;
      }
      if (c.type === 'Identifier' && c.name === 'Pool') {
        return true;
      }
      return false;
    }

    // 某個 binding(scope Variable)是否有 reference 被當成 `<pool>.end()` 的 callee 物件
    function hasEndCall(variable) {
      if (!variable) return false;
      return variable.references.some((ref) => {
        const id = ref.identifier;
        const member = id.parent;
        return (
          member &&
          member.type === 'MemberExpression' &&
          member.object === id &&
          member.property &&
          member.property.type === 'Identifier' &&
          member.property.name === 'end' &&
          member.parent &&
          member.parent.type === 'CallExpression' &&
          member.parent.callee === member
        );
      });
    }

    /** @type {Array<{ name: string, node: import('eslint').Rule.Node, variable: import('eslint').Scope.Variable | undefined }>} */
    const poolBindings = [];

    return {
      NewExpression(node) {
        if (!isPgPoolNew(node)) return;
        const parent = node.parent;
        if (
          parent &&
          parent.type === 'VariableDeclarator' &&
          parent.id.type === 'Identifier'
        ) {
          // 取得「這個宣告所建立的 binding」(scope-correct,不會被同名 shadow 混淆)
          const declared = sourceCode.getDeclaredVariables(parent);
          const variable = declared.find((v) => v.name === parent.id.name) ?? declared[0];
          poolBindings.push({ name: parent.id.name, node, variable });
        } else {
          // 匿名 pool(沒接變數)→ 一定無法 .end(),直接報
          context.report({ node, messageId: 'anonymousPool' });
        }
      },

      'Program:exit'() {
        for (const { name, node, variable } of poolBindings) {
          if (!hasEndCall(variable)) {
            context.report({ node, messageId: 'unclosedPool', data: { name } });
          }
        }
      },
    };
  },
};

export default rule;
