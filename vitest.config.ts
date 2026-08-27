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
    // mutate.ts 的端到端測試會 spawn `npx tsx scripts/mutate.ts`——npx 冷啟每次
    // 約 1-2s、對照重跑再乘一遍,vitest 預設 5s 對這批不夠。30s 給 subprocess
    // 冷啟充足 buffer;純函式測試用不到、不會變慢。真的長跑(SIGTERM 之類)仍
    // 用 `it('...', ..., 60_000)` 第三參數個案調整。
    testTimeout: 30_000,
  },
});
