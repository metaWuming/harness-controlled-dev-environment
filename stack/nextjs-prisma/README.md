# L2 堆疊層:Next.js + Prisma(opt-in)

本目錄是 harness 的 **L2(堆疊層)** 組件:只有當你的專案是 **Next.js + Prisma + PostgreSQL** 堆疊時才需要。L0/L1(通用層)不依賴這裡的任何檔案;反之,這裡的組件假設主 repo 具備:

- `prisma/schema.prisma` + `prisma/migrations/`
- base Prisma client 單例在 `src/lib/db.ts`(export 名 `prisma`,import 路徑 alias `@/lib/db`)
- multi-tenant 專案另有 tenant-scoped client(如 `src/lib/db-tenant.ts` 的 `getTenantPrisma()`)

> 路徑跟你的專案不同?各 rule 檔頂部的 allowlist 常數與 `'@/lib/db'` 字面值都集中好改,搬過去後先對齊你的實際路徑。

## 目錄內容

| 路徑 | 用途 | 複製到主 repo 的位置 |
|---|---|---|
| `eslint-rules/*.mjs` | 4 支自訂 ESLint rule(Prisma 治理)| `eslint-rules/` |
| `eslint-rules/__tests__/*.test.mjs` | rule 的 RuleTester 契約測試 | `eslint-rules/__tests__/` |
| `scripts/check-prisma-schema-refs.ts` | 掃 `prisma.<model>.X()` 呼叫是否對應真實 schema model | `scripts/` |
| `scripts/safe-migrate.ts` | dev/prod migration 安全包裝(env 檢查、pooler 驗證、status 分流)| `scripts/` |
| `scripts/ci-migrate.sh` | CI 兩段式 migrate 編排(資料 migration 依賴 seed 時用)| `scripts/` |
| `ci-snippets/prisma-ci-steps.yml` | 貼回 `.github/workflows/ci.yml` 的 Prisma 步驟片段 | (片段,非獨立檔)|
| `tests/safe-migrate.test.ts` | safe-migrate 純函式測試 | `tests/` |

## 4 支 ESLint rule 一句話說明

| Rule | 擋什麼 / 為什麼 |
|---|---|
| `no-base-prisma-without-reason` | 擋任何形態的 `import { prisma } from '@/lib/db'`(含 alias、namespace、dynamic import、require、re-export、side-effect import)沒附 `// Reason: <TAG> — <text>` 註解 — 強制走 tenant-scoped client,防跨租戶資料外洩。 |
| `raw-prisma-client-tenant-scope` | 擋 `new PrismaClient(...)` 上方 5 行內沒有 `// Tenant scope: <TAG> — <text>` 註解 — 每個 raw client 都要標明繞過 tenant 隔離的理由。 |
| `no-prisma-blanket-disable` | 擋 blanket `// eslint-disable-next-line`(無 rule 名)緊鄰危險 prisma 行 — 防止用一行 directive 同時靜音上面兩支 rule;要繞必須顯式列 rule 名。 |
| `no-unclosed-test-pool` | 擋 `tests/**/*.test.ts` 內建了 `pg.Pool` 卻沒呼叫 `pool.end()` — 防單一長命 vitest worker 整輪累積連線耗盡 DB,造成偶發級聯崩潰。 |

## 安裝方式

### 1. 複製檔案

依上表把各檔複製到主 repo 對應位置(`ci-snippets/` 除外,那是貼片段用的)。

### 2. eslint flat config 掛 rules

在主 repo `eslint.config.mjs`:

```js
import noBasePrismaWithoutReason from './eslint-rules/no-base-prisma-without-reason.mjs';
import rawPrismaClientTenantScope from './eslint-rules/raw-prisma-client-tenant-scope.mjs';
import noPrismaBlanketDisable from './eslint-rules/no-prisma-blanket-disable.mjs';
import noUnclosedTestPool from './eslint-rules/no-unclosed-test-pool.mjs';

export default [
  // ...你既有的 config...
  {
    plugins: {
      harness: {
        rules: {
          'no-base-prisma-without-reason': noBasePrismaWithoutReason,
          'raw-prisma-client-tenant-scope': rawPrismaClientTenantScope,
          'no-prisma-blanket-disable': noPrismaBlanketDisable,
          'no-unclosed-test-pool': noUnclosedTestPool,
        },
      },
    },
    rules: {
      'harness/no-base-prisma-without-reason': 'error',
      'harness/raw-prisma-client-tenant-scope': 'error',
      'harness/no-prisma-blanket-disable': 'error',
      'harness/no-unclosed-test-pool': 'error',
    },
  },
];
```

並確認 CI 的 lint scope 含 `scripts/` 與 `prisma/`(不然 scripts 內的 raw prisma import 會繞過規則):

```
npx eslint src/ tests/ scripts/ prisma/
```

### 3. rule 測試納入 vitest

在主 repo `vitest.config.ts` 的 `include` 加:

```ts
include: [
  'tests/**/*.test.ts',
  'eslint-rules/__tests__/*.test.mjs',
],
```

測試依賴 `eslint`(RuleTester)與 `@typescript-eslint/parser`(TS-only AST 的 case),都是 Next.js + TS 專案的常備 devDependency。

### 4. ci-snippets 貼法

`ci-snippets/prisma-ci-steps.yml` **不是獨立 workflow**,是貼回 `.github/workflows/ci.yml` 的片段:

1. `services:` 段 → 貼進你的 job(與 `runs-on:` 同層):postgres service container,CI 每次從空 DB 重建,不碰雲端 DB
2. `env:` 段 → 貼進同一個 job:`DATABASE_URL` / `DIRECT_URL` 指向 service container
3. `steps:` 段 → 依序插入 checkout / setup-node / `npm ci` 之後;seed 步驟是 placeholder,換成你專案的 seed 指令

migration 史單純的專案直接 `npx prisma migrate deploy`;只有「資料 migration 依賴 seed 資料」的專案才需要 `ci-migrate.sh`(使用前必改 gate migration 名與 seed 指令,見腳本頭註解)。

### 5. safe-migrate 掛 npm scripts(建議)

```json
{
  "scripts": {
    "migrate:status": "tsx scripts/safe-migrate.ts status",
    "migrate:dev": "tsx scripts/safe-migrate.ts dev",
    "migrate:prod": "tsx scripts/safe-migrate.ts prod"
  }
}
```

注意:`safe-migrate.ts` 的 pooler 驗證是針對 Supabase 的 hostname 慣例(`*.pooler.supabase.com` / `db.*.supabase.co`);用其他 PostgreSQL 託管服務時,改 `validateProdDatabaseUrl()` 內的判斷即可(測試在 `tests/safe-migrate.test.ts`,改完讓它們跟著過)。

## 在本模板 repo 內驗證

```bash
npx vitest run stack/   # rule 契約測試 + safe-migrate 純函式測試
npx tsc --noEmit        # 型別檢查(tsconfig 已含 stack/**)
```
