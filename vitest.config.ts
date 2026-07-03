import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 測試放 tests/;L2 stack 層的 ESLint rule 測試(.mjs,ESM RuleTester)也納入掃描
    include: [
      'tests/**/*.test.ts',
      'stack/nextjs-prisma/eslint-rules/__tests__/*.test.mjs',
      'stack/nextjs-prisma/tests/**/*.test.ts',
    ],
    // 本模板的測試全是純函式 / fixture 注入,無 DB 依賴,node 環境即可
    environment: 'node',
    reporters: ['default'],
  },
});
