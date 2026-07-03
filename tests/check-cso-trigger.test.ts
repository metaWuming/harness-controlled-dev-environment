// Tests for scripts/check-cso-trigger.ts + scripts/cso-trigger.config.ts(/cso 觸發判定)
//
// 驗證:
//   - evaluateCsoTrigger(注入範例路徑表):各域命中 / 純 UI 不命中 / 多域重疊 / 空 diff
//   - collectChangedFiles:四源變更面(committed/staged/unstaged/untracked)聯集去重
//   - config schema:出廠 config 的型別 / 域名合法性(空表也要過)
//
// ⚠️ 填完 scripts/cso-trigger.config.ts 路徑表後,請啟用檔尾註解掉的
//   「路徑表完整性鎖」測試(哨兵檔自比,防路徑表默默失準)。

import { describe, expect, it } from 'vitest';
import {
  evaluateCsoTrigger,
  collectChangedFiles,
  CSO_TRIGGER_PATTERNS,
  type CsoDomain,
} from '../scripts/check-cso-trigger';

// 範例路徑表(中性虛構專案結構)— 只用於驗引擎行為,與出廠空 config 無關。
const SAMPLE_PATTERNS: { domain: CsoDomain; pattern: RegExp }[] = [
  { domain: '金流', pattern: /^src\/lib\/payment\// },
  { domain: '金流', pattern: /^src\/app\/api\/(payment|orders)\// },
  { domain: 'PII', pattern: /^src\/lib\/(auth|member|magic-link)\.ts$/ },
  { domain: 'PII', pattern: /^src\/app\/api\/(member|auth)\// },
  { domain: '權限/IDOR/資產轉移', pattern: /^src\/app\/api\/admin\// },
  { domain: '權限/IDOR/資產轉移', pattern: /^src\/(proxy|middleware)\.ts$/ },
  { domain: 'audit-trail', pattern: /^src\/lib\/audit-log\.ts$/ },
  { domain: '橫切保守項', pattern: /^prisma\/schema\.prisma$/ },
  { domain: '橫切保守項', pattern: /^src\/app\/api\/cron\// },
];

describe('evaluateCsoTrigger — 域別命中(注入範例路徑表)', () => {
  it('金流:payment lib / orders route 命中', () => {
    const r = evaluateCsoTrigger(
      ['src/lib/payment/charge.ts', 'src/app/api/orders/route.ts'],
      SAMPLE_PATTERNS
    );
    expect(r.required).toBe(true);
    expect(r.matches.filter((m) => m.domain === '金流')).toHaveLength(2);
  });

  it('PII:auth lib / member route 命中', () => {
    const r = evaluateCsoTrigger(
      ['src/lib/auth.ts', 'src/app/api/member/profile/route.ts'],
      SAMPLE_PATTERNS
    );
    expect(r.required).toBe(true);
    expect(r.matches.some((m) => m.domain === 'PII')).toBe(true);
  });

  it('權限/IDOR:admin route / middleware 命中', () => {
    const r = evaluateCsoTrigger(
      ['src/app/api/admin/users/route.ts', 'src/middleware.ts'],
      SAMPLE_PATTERNS
    );
    expect(r.required).toBe(true);
    expect(r.matches.filter((m) => m.domain === '權限/IDOR/資產轉移')).toHaveLength(2);
  });

  it('audit trail:audit-log.ts 命中', () => {
    const r = evaluateCsoTrigger(['src/lib/audit-log.ts'], SAMPLE_PATTERNS);
    expect(r.required).toBe(true);
    expect(r.matches[0].domain).toBe('audit-trail');
  });

  it('橫切保守項:schema / cron route 命中', () => {
    const r = evaluateCsoTrigger(
      ['prisma/schema.prisma', 'src/app/api/cron/daily-maintenance/route.ts'],
      SAMPLE_PATTERNS
    );
    expect(r.required).toBe(true);
    expect(r.matches.every((m) => m.domain === '橫切保守項')).toBe(true);
  });

  it('一個檔案命中多域時全部列出(給 /cso 聚焦提示)', () => {
    const multi: { domain: CsoDomain; pattern: RegExp }[] = [
      ...SAMPLE_PATTERNS,
      { domain: '權限/IDOR/資產轉移', pattern: /^src\/app\/api\/member\/tickets\// },
    ];
    const r = evaluateCsoTrigger(['src/app/api/member/tickets/transfer/route.ts'], multi);
    const domains = new Set(r.matches.map((m) => m.domain));
    expect(domains.has('PII')).toBe(true); // api/member/** 整域屬 PII
    expect(domains.has('權限/IDOR/資產轉移')).toBe(true); // 資產轉移面
  });

  it('純 UI / 展示 / 文件 / 測試 / CI 設定不命中', () => {
    const r = evaluateCsoTrigger(
      [
        'src/components/product-card.tsx',
        'src/app/(front)/products/page.tsx',
        'src/lib/format-date.ts',
        'docs/RUNBOOK.md',
        'tests/pricing.test.ts',
        '.github/workflows/ci.yml',
        'scripts/weekly-health-check.ts',
      ],
      SAMPLE_PATTERNS
    );
    expect(r.required).toBe(false);
    expect(r.matches).toHaveLength(0);
  });

  it('空 diff 不命中', () => {
    expect(evaluateCsoTrigger([], SAMPLE_PATTERNS).required).toBe(false);
  });

  it('空路徑表(出廠狀態)→ 任何 diff 都不命中(NOT_REQUIRED,由 main 印導入提醒)', () => {
    expect(evaluateCsoTrigger(['src/lib/payment/charge.ts'], []).required).toBe(false);
  });
});

describe('collectChangedFiles — 完整變更面聯集', () => {
  it('committed + staged + unstaged + untracked 聯集去重', () => {
    const fake = (cmd: string): string => {
      if (cmd.includes('...HEAD')) return 'src/lib/payment/charge.ts\ndocs/a.md\n';
      if (cmd.includes('--cached')) return 'src/lib/payment/charge.ts\n'; // 與 committed 重複
      if (cmd === 'git diff --name-only') return 'src/lib/pricing.ts\n';
      return 'scripts/new-untracked.ts\n'; // ls-files --others
    };
    const files = collectChangedFiles('develop', fake);
    expect(files.sort()).toEqual(
      ['docs/a.md', 'scripts/new-untracked.ts', 'src/lib/payment/charge.ts', 'src/lib/pricing.ts'].sort()
    );
  });

  it('未 commit 的安全敏感檔編輯照樣觸發(核心情境:腳本在 commit 前被跑)', () => {
    const fake = (cmd: string): string =>
      cmd === 'git diff --name-only' ? 'src/lib/payment/charge.ts\n' : '';
    const r = evaluateCsoTrigger(collectChangedFiles('develop', fake), SAMPLE_PATTERNS);
    expect(r.required).toBe(true);
  });
});

describe('cso-trigger.config — 出廠 config schema 驗證', () => {
  const VALID_DOMAINS = new Set<CsoDomain>([
    '金流',
    'PII',
    '權限/IDOR/資產轉移',
    'audit-trail',
    '橫切保守項',
  ]);

  it('CSO_TRIGGER_PATTERNS 是陣列,每條 entry 具 {domain, pattern} 正確型別', () => {
    expect(Array.isArray(CSO_TRIGGER_PATTERNS)).toBe(true);
    for (const entry of CSO_TRIGGER_PATTERNS) {
      expect(VALID_DOMAINS.has(entry.domain)).toBe(true);
      expect(entry.pattern).toBeInstanceOf(RegExp);
    }
  });
});

// =====================================================================
// 路徑表完整性鎖(真檔 SSOT 自比)— 填完 config 後啟用
// =====================================================================
//
// 出廠空 config 下此測試必失敗,故以註解形式保留為範本。導入、填完
// scripts/cso-trigger.config.ts 後:
//   1. 把 SENTINELS 換成你的 repo 內「路徑表聲稱會命中」的真實代表檔(每域一個)
//   2. 取消註解啟用
// 作用:代表檔被改名 / 搬移 → 此測試紅 → 逼人同步更新 CSO_TRIGGER_PATTERNS,
// 防路徑表默默失準(哨兵檔案級;域內其他單檔漏列仍靠 review 紀律)。
//
// import fs from 'node:fs';
// import path from 'node:path';
//
// describe('路徑表完整性鎖(真檔 SSOT 自比)', () => {
//   const REPO = path.join(__dirname, '..');
//   // file = 該域路徑表「聲稱會命中」的真實代表檔(換成你的 repo 內實際路徑)
//   const SENTINELS: { domain: CsoDomain; file: string }[] = [
//     { domain: '金流', file: 'src/lib/payment/charge.ts' },
//     { domain: 'PII', file: 'src/lib/auth.ts' },
//     { domain: '權限/IDOR/資產轉移', file: 'src/middleware.ts' },
//     { domain: 'audit-trail', file: 'src/lib/audit-log.ts' },
//     { domain: '橫切保守項', file: 'prisma/schema.prisma' },
//   ];
//
//   it.each(SENTINELS)('$domain 哨兵檔 $file 存在且被路徑表命中', ({ domain, file }) => {
//     expect(fs.existsSync(path.join(REPO, file))).toBe(true);
//     const r = evaluateCsoTrigger([file]); // 不注入 → 用真 config
//     expect(r.matches.some((m) => m.domain === domain && m.file === file)).toBe(true);
//   });
//
//   it('每個域在路徑表中至少有一條 pattern', () => {
//     const domains = new Set(CSO_TRIGGER_PATTERNS.map((p) => p.domain));
//     expect(domains).toEqual(
//       new Set(['金流', 'PII', '權限/IDOR/資產轉移', 'audit-trail', '橫切保守項'])
//     );
//   });
// });
