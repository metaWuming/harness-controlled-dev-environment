// ESLint flat config(骨架版)
//
// 模板自身:typescript-eslint recommended 掃 scripts/ tests/ stack/。
// 導入 Next.js+Prisma 專案時,參考 stack/nextjs-prisma/README.md 掛上
// 4 支自訂 AST 規則(harness/*),範例(解除註解並把規則檔 copy 到主 repo):
//
//   import noBasePrisma from './eslint-rules/no-base-prisma-without-reason.mjs';
//   import rawPrismaTenantScope from './eslint-rules/raw-prisma-client-tenant-scope.mjs';
//   // ...
//   {
//     plugins: { harness: { rules: {
//       'no-base-prisma-without-reason': noBasePrisma,
//       'raw-prisma-client-tenant-scope': rawPrismaTenantScope,
//     } } },
//     rules: {
//       'harness/no-base-prisma-without-reason': 'error',
//       'harness/raw-prisma-client-tenant-scope': 'error',
//     },
//   },

import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules/**', '.claude/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // 工具腳本常見的實用取捨;導入正式專案可視需要收緊
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
