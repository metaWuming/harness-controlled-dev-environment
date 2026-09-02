// Tests for scripts/check-cso-trigger.ts + scripts/cso-trigger.config.ts(/cso 觸發判定)
//
// 驗證:
//   - evaluateCsoTrigger(注入範例路徑表):各域命中 / 純 UI 不命中 / 多域重疊 / 空 diff
//   - collectChangedFiles:四源變更面(committed/staged/unstaged/untracked)聯集去重
//   - config schema:出廠 config 的型別 / 域名合法性(空表也要過)
//
// 路徑表完整性鎖(檔尾)是 **always-on**:依 scripts/harness.config.json 宣告的 mode 分支
//   (PR A2),採用者不需再手動取消註解。

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  evaluateCsoTrigger,
  collectChangedFiles,
  CSO_TRIGGER_PATTERNS,
  type CsoDomain,
} from '../scripts/check-cso-trigger';
import { CSO_NOT_APPLICABLE } from '../scripts/cso-trigger.config';
import { checkCsoDomainDisposition } from '../scripts/check-adoption-readiness';
import { loadHarnessConfig } from '../scripts/lib/harness-config';

// tsx binary + script path 供 argv 白名單子程序測試用
const SCRIPT = path.resolve(__dirname, '../scripts/check-cso-trigger.ts');
function runCli(args: string[]): { code: number | null; stderr: string; stdout: string } {
  const r = spawnSync('npx', ['tsx', SCRIPT, ...args], {
    encoding: 'utf-8',
    // 用 repo 根當 cwd 避免影響 baseline resolution
    cwd: path.resolve(__dirname, '..'),
  });
  return { code: r.status, stderr: r.stderr, stdout: r.stdout };
}

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

  it('空路徑表(出廠狀態)→ evaluateCsoTrigger 本身不命中(engine 純函式)。' +
      '⚠️ main() 對空表現 fail-closed 印 CSO_REQUIRED + exit 2 (Codex R1 F4 修的空表契約)', () => {
    expect(evaluateCsoTrigger(['src/lib/payment/charge.ts'], []).required).toBe(false);
  });
});

describe('collectChangedFiles — 完整變更面聯集', () => {
  it('committed + staged + unstaged + untracked 聯集去重', () => {
    // 🔴 三支 git diff 都會帶 `--no-renames`(P1 修:防 rename 繞道)。fake 用
    //    substring 比對而非 exact 字串,以免下次改 flag 又要一起改測試。
    const fake = (cmd: string): string => {
      if (cmd.includes('...HEAD')) return 'src/lib/payment/charge.ts\ndocs/a.md\n';
      if (cmd.includes('--cached')) return 'src/lib/payment/charge.ts\n'; // 與 committed 重複
      if (cmd.includes('git diff --name-only')) return 'src/lib/pricing.ts\n'; // unstaged (含 --no-renames)
      return 'scripts/new-untracked.ts\n'; // ls-files --others
    };
    const files = collectChangedFiles('develop', fake);
    expect(files.sort()).toEqual(
      ['docs/a.md', 'scripts/new-untracked.ts', 'src/lib/payment/charge.ts', 'src/lib/pricing.ts'].sort()
    );
  });

  it('未 commit 的安全敏感檔編輯照樣觸發(核心情境:腳本在 commit 前被跑)', () => {
    const fake = (cmd: string): string =>
      cmd.includes('git diff --name-only') && !cmd.includes('--cached') && !cmd.includes('...HEAD')
        ? 'src/lib/payment/charge.ts\n'
        : '';
    const r = evaluateCsoTrigger(collectChangedFiles('develop', fake), SAMPLE_PATTERNS);
    expect(r.required).toBe(true);
  });

  it('--no-renames 顯式傳給每個 git diff 呼叫(P1:防 rename 繞道 fixture)', () => {
    const capturedCmds: string[] = [];
    const fake = (cmd: string): string => {
      capturedCmds.push(cmd);
      return '';
    };
    collectChangedFiles('develop', fake);
    // 三支 git diff 都必須帶 --no-renames;ls-files --others 沒 rename 語意、不需要
    const diffCmds = capturedCmds.filter((c) => c.startsWith('git diff'));
    expect(diffCmds.length).toBe(3);
    for (const cmd of diffCmds) {
      expect(cmd).toContain('--no-renames');
    }
  });
});

describe('argv 白名單 (Codex R1 P1) — 未知/重複/空 --base= 一律 fail-closed exit 2', () => {
  it('未知參數 (拼錯 flag) → exit 2', () => {
    // `--bsae=xxx` 是常見拼錯:舊版靜默 fall-back 到預設 base、可能 fail-open
    const r = runCli(['--bsae=HEAD~1']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('未知參數');
  });

  it('重複 --base= → exit 2', () => {
    const r = runCli(['--base=main', '--base=develop']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('重複 --base=');
  });

  it('空 --base= (無值) → exit 2', () => {
    const r = runCli(['--base=']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('空 --base=');
  });

  it('多餘位置參數 → exit 2', () => {
    const r = runCli(['extra', '--base=main']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('未知參數');
  });

  it('base 形狀不合 (含 `=`) → 印「非法 base ref」而非空表訊號 (Codex R2 P2)', () => {
    // `--base=main=extra` 通過 argv 白名單 (合法 flag) + 值非空 → 該落形狀檢查
    const r = runCli(['--base=main=extra']);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('非法 base ref');
    // 順序保證:形狀檢查在空表檢查之前,不該被空表訊號蓋掉
    expect(r.stdout).not.toContain('路徑表為空');
  });
}, 30_000); // spawnSync 加載 tsx 稍慢,timeout 拉高

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
// 路徑表完整性鎖(always-on,依宣告 mode 分支)— PR A2
// =====================================================================
//
// 舊版是註解掉的範本、要採用者填完 config 後手動取消註解 —— 沒人會記得。現在依
// `scripts/harness.config.json` 的顯式 mode 宣告分支(不是偵測):
//   - adopted:五域各恰一種處置(pattern XOR notApplicable)、每條 pattern 至少命中一個
//     tracked 檔(防路徑表隨重構默默失準;哨兵檔清單改由 git ls-files 取代)
//   - template:路徑表與 notApplicable 皆為空(出廠狀態)
// skip 的那一邊是宣告值決定的,採用者的 `npm test` 會看到 template 分支 1 個 skipped、屬設計。

describe('路徑表完整性鎖(依 harness.config mode 分支)', () => {
  const REPO = path.join(__dirname, '..');
  const cfg = loadHarnessConfig(REPO); // 缺檔 / 壞掉 → 這裡直接 throw = 測試紅(fail-closed)

  it('harness.config 可載入且 mode 合法', () => {
    expect(['template', 'adopted']).toContain(cfg.mode);
  });

  describe.skipIf(cfg.mode !== 'adopted')('adopted', () => {
    it('五域各恰一種處置(pattern XOR notApplicable)', () => {
      expect(checkCsoDomainDisposition(CSO_TRIGGER_PATTERNS, CSO_NOT_APPLICABLE)).toEqual([]);
    });
    it('每條 pattern 至少命中一個 tracked 檔', () => {
      const tracked = execFileSync('git', ['-C', REPO, 'ls-files', '-z'], { encoding: 'utf-8' })
        .split('\0')
        .filter(Boolean);
      for (const { domain, pattern } of CSO_TRIGGER_PATTERNS) {
        const r = evaluateCsoTrigger(tracked, [{ domain, pattern }]);
        expect(r.matches.length, `[${domain}] ${pattern} 對不到任何 tracked 檔`).toBeGreaterThan(0);
      }
    });
  });

  describe.skipIf(cfg.mode !== 'template')('template', () => {
    it('路徑表與 notApplicable 皆為空(出廠狀態)', () => {
      expect(CSO_TRIGGER_PATTERNS).toEqual([]);
      expect(CSO_NOT_APPLICABLE).toEqual([]);
    });
  });
});
