// Tests for scripts/weekly-health-check.ts(骨架版)
//
// 驗證:
//   - countTodosP1:open / completed / boundary(P2 段不被誤算)/ 檔尾無下個 heading
//   - countLessonsNewEntries:date 過濾 / 警告 entries / 無效日期
//   - collectReviewCost:fenced 範本剝除 / date 過濾 / 缺欄 / step5 null vs 0
//   - ISO 週號:跨年(W53 / W01)
//   - loadPreviousWeek / diffMetric
//   - formatReportMarkdown:trend badge / collector error render

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  countTodosP1,
  countLessonsNewEntries,
  collectReviewCost,
  getISOWeek,
  formatWeekId,
  getMondayOfWeek,
  loadPreviousWeek,
  diffMetric,
  formatReportMarkdown,
  type HealthReport,
} from '../scripts/weekly-health-check';

describe('countTodosP1', () => {
  it('0 open / 0 completed', () => {
    const content = `# TODOS

## P1(上線前必做)

(尚無項目)

## P2

### 🔴 一些 P2 項目
`;
    expect(countTodosP1(content)).toEqual({ open: 0, completed: 0 });
  });

  it('1 open + 1 completed,P2 段的 🔴 不被誤算', () => {
    const content = `# TODOS

## P1(上線前必做)

### ✅ 完工項目 A
- 詳述
- 完工內容

### 🔴 Open 項目 B
- 內容

## P2(上線後 1-3 個月)

### 🔴 P2 項目不該算進 P1
- 內容
`;
    expect(countTodosP1(content)).toEqual({ open: 1, completed: 1 });
  });

  it('多個 open / completed', () => {
    const content = `## P1

### 🔴 A
### 🔴 B
### 🔴 C
### ✅ D
### ✅ E

## P2

### 🔴 不算
`;
    expect(countTodosP1(content)).toEqual({ open: 3, completed: 2 });
  });

  it('無 P1 段 → 0/0', () => {
    expect(countTodosP1('## P2\n### 🔴 X')).toEqual({ open: 0, completed: 0 });
  });

  it('`## P1` 是檔案最後一段(無下個 heading)仍正確 count', () => {
    // regression:regex 若用 \Z(JS 不支援,被當 literal Z)會在無下個 heading 時 silent 0/0
    const content = `# TODOS

## P1(上線前必做)

### 🔴 Open A
### ✅ Completed B
### 🔴 Open C
`;
    expect(countTodosP1(content)).toEqual({ open: 2, completed: 1 });
  });

  it('`## P1` 是檔案最後一段且結尾無換行', () => {
    const content = `## P1\n\n### 🔴 A\n### 🔴 B`;
    expect(countTodosP1(content)).toEqual({ open: 2, completed: 0 });
  });
});

describe('countTodosP1 — 註解/圍籬內的範例不算真項目', () => {
  it('P1 段只有註解掉的範例格式 → 0 open(2026-07-25 週健檢實跑抓到的假指標)', () => {
    // 這正是模板出貨版 TODOS.md 的樣子:P1 段是空的,但放了一段註解掉的範例。
    // 修正前這裡會回 open=1,讓一個全空 backlog 報成「有 1 個 P1 未完」。
    const content = `# TODOS

## P1(上線前必做)

<!-- 範例格式:

### 🔴 <標題>
- **來源**:哪個 review 產生
-->

## P2
`;
    expect(countTodosP1(content)).toEqual({ open: 0, completed: 0 });
  });

  it('註解外的真項目照算,註解內的不算', () => {
    const content = `## P1

### 🔴 真的待辦

<!--
### 🔴 範例
### ✅ 範例已完成
-->

### ✅ 真的完成 (#12)

## P2
`;
    expect(countTodosP1(content)).toEqual({ open: 1, completed: 1 });
  });

  it('fenced code block 內的範例也不算', () => {
    const content = `## P1

\`\`\`markdown
### 🔴 圍籬內的範例
\`\`\`

### 🔴 真的待辦

## P2
`;
    expect(countTodosP1(content)).toEqual({ open: 1, completed: 0 });
  });
});

describe('countLessonsNewEntries', () => {
  it('全部 entries 都在 sinceDate 之前 → 0', () => {
    const content = `# LESSONS

## [2026-04-15] 舊 entry
## [2026-05-01] 舊 entry
`;
    const since = new Date('2026-05-18T00:00:00Z');
    expect(countLessonsNewEntries(content, since)).toEqual({ count: 0, entries: [] });
  });

  it('部分 entries >= sinceDate → 計入', () => {
    const content = `# LESSONS

## [2026-05-23] 新 entry A
## [2026-05-20] 新 entry B
## [2026-05-15] 舊 entry(不算)
`;
    const since = new Date('2026-05-18T00:00:00Z');
    const result = countLessonsNewEntries(content, since);
    expect(result.count).toBe(2);
    expect(result.entries).toEqual(['2026-05-23: 新 entry A', '2026-05-20: 新 entry B']);
  });

  it('支援 ⚠️ 警告 entries', () => {
    const content = `# LESSONS

## ⚠️ [2026-05-23] 警告 entry
## [2026-05-22] 普通 entry
`;
    const since = new Date('2026-05-18T00:00:00Z');
    const result = countLessonsNewEntries(content, since);
    expect(result.count).toBe(2);
    expect(result.entries[0]).toBe('2026-05-23: 警告 entry');
    expect(result.entries[1]).toBe('2026-05-22: 普通 entry');
  });

  it('無效日期格式忽略', () => {
    const content = `## [INVALID] x\n## [2026-05-23] 有效\n`;
    const since = new Date('2026-05-18T00:00:00Z');
    const result = countLessonsNewEntries(content, since);
    expect(result.count).toBe(1);
  });
});

describe('collectReviewCost', () => {
  const SINCE = new Date('2026-05-18T00:00:00Z');

  it('無 entry → 全 0,step5 為 null(無資料 ≠ 填了 0)', () => {
    const r = collectReviewCost('# 開發進度\n\n(尚無 entry)\n', SINCE);
    expect(r).toEqual({
      sprints: 0,
      totalRounds: 0,
      totalP1: 0,
      totalP2: 0,
      step5Independent: null,
    });
  });

  it('fenced code block 內的「Entry 格式範本」不被算成 sprint', () => {
    // 這是本 collector 最重要的一條:progress.md 檔頭本來就有一份含 cost field 的範本。
    // 刻意把範本日期寫成「真日期」——若實作只靠 YYYY-MM-DD 佔位符 parse 失敗來擋,這條會紅。
    const content = [
      '# 開發進度',
      '',
      '## Entry 格式範本',
      '',
      '```markdown',
      '📅 2026-05-20 ⓝ — **標題**',
      '> 📊 成本:CC ~9h / 跨模型 review 99 rounds / P1 99 個 / P2 99 個',
      '```',
      '',
      '<!-- entry 從這裡開始 -->',
      '',
    ].join('\n');
    const r = collectReviewCost(content, SINCE);
    expect(r.sprints).toBe(0);
    expect(r.totalRounds).toBe(0);
  });

  it('多個 entry 加總,sinceDate 之前的不計', () => {
    const content = [
      '📅 2026-05-20 ② — **本週 B**',
      '> 📊 成本:CC ~3h / 跨模型 review 2 rounds / P1 1 個 / P2 4 個 / Step5 獨立發現 2 個',
      '',
      '📅 2026-05-19 ① — **本週 A**',
      '> 📊 成本:CC ~5h / 跨模型 review 3 rounds / P1 2 個 / P2 1 個 / Step5 獨立發現 1 個',
      '',
      '📅 2026-05-10 ⓪ — **上上週,不該被計入**',
      '> 📊 成本:CC ~1h / 跨模型 review 7 rounds / P1 7 個 / P2 7 個 / Step5 獨立發現 7 個',
      '',
    ].join('\n');
    const r = collectReviewCost(content, SINCE);
    expect(r.sprints).toBe(2);
    expect(r.totalRounds).toBe(5);
    expect(r.totalP1).toBe(3);
    expect(r.totalP2).toBe(5);
    expect(r.step5Independent).toBe(3);
  });

  it('舊格式 cost field(無 Step5 欄)→ 其他欄照算,step5 為 null', () => {
    const content = [
      '📅 2026-05-20 ① — **舊格式**',
      '> 📊 成本:CC ~4h / 跨模型 review 2 rounds / P1 1 個 / P2 3 個',
      '',
    ].join('\n');
    const r = collectReviewCost(content, SINCE);
    expect(r.sprints).toBe(1);
    expect(r.totalRounds).toBe(2);
    expect(r.totalP1).toBe(1);
    expect(r.step5Independent).toBeNull();
  });

  it('Step5 明確填 0 → 回 0 而非 null(有資料,且資料顯示無獨立發現)', () => {
    const content = [
      '📅 2026-05-20 ① — **第二道 review 沒抓到新東西**',
      '> 📊 成本:CC ~4h / 跨模型 review 1 rounds / P1 0 個 / P2 0 個 / Step5 獨立發現 0 個',
      '',
    ].join('\n');
    const r = collectReviewCost(content, SINCE);
    expect(r.step5Independent).toBe(0);
  });

  it('entry 有日期標頭但沒有 cost field → 不計入 sprints(避免灌水分母)', () => {
    const content = ['📅 2026-05-20 ① — **忘了寫 cost field**', '> 改動:一些事', ''].join('\n');
    const r = collectReviewCost(content, SINCE);
    expect(r.sprints).toBe(0);
  });
});

describe('ISO 8601 week 計算', () => {
  it('2026-05-23(週六)→ 2026-W21', () => {
    expect(formatWeekId(getISOWeek(new Date('2026-05-23T12:00:00Z')))).toBe('2026-W21');
  });

  it('2026-12-29(週二)→ 2026-W53(2026 是 53 週年)', () => {
    // 2026-01-01 是週四 → 2026 是 53 週年
    expect(formatWeekId(getISOWeek(new Date('2026-12-29T00:00:00Z')))).toBe('2026-W53');
  });

  it('2027-01-04(週一)→ 2027-W01', () => {
    expect(formatWeekId(getISOWeek(new Date('2027-01-04T00:00:00Z')))).toBe('2027-W01');
  });

  it('2027-01-01(週五)→ 仍屬 2026-W53(該週週四 = 2026-12-31)', () => {
    expect(formatWeekId(getISOWeek(new Date('2027-01-01T00:00:00Z')))).toBe('2026-W53');
  });

  it('getMondayOfWeek 2026-05-23(週六)→ 2026-05-18(週一 UTC)', () => {
    const monday = getMondayOfWeek(new Date('2026-05-23T12:00:00Z'));
    expect(monday.toISOString().slice(0, 10)).toBe('2026-05-18');
    expect(monday.getUTCHours()).toBe(0);
  });
});

describe('Trend: loadPreviousWeek + diffMetric', () => {
  function buildReport(weekId: string, open: number): HealthReport {
    return {
      weekId,
      weekStart: '',
      weekEnd: '',
      generatedAt: '',
      metrics: {
        todosP1: { open, completed: 0 },
        lessonsNew: { count: 0, entries: [] },
      },
      trend: { prevWeekId: null, diff: {} },
    };
  }

  it('historyDir 不存在 → null(first run)', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'health-trend-'));
    try {
      const nonexistent = path.join(tmpRoot, 'never-created');
      expect(loadPreviousWeek(nonexistent, '2026-W21')).toBeNull();
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('historyDir 存在但無前週 JSON → null', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'health-trend-'));
    try {
      const historyDir = path.join(tmpRoot, 'history');
      fs.mkdirSync(historyDir, { recursive: true });
      expect(loadPreviousWeek(historyDir, '2026-W21')).toBeNull();
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('historyDir 有 W20 JSON,當週 W21 → 回傳 W20', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'health-trend-'));
    try {
      const historyDir = path.join(tmpRoot, 'history');
      fs.mkdirSync(historyDir, { recursive: true });
      fs.writeFileSync(path.join(historyDir, '2026-W20.json'), JSON.stringify(buildReport('2026-W20', 5)));
      const result = loadPreviousWeek(historyDir, '2026-W21');
      expect(result?.weekId).toBe('2026-W20');
      expect(result?.metrics.todosP1.open).toBe(5);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('historyDir 有 W21 + W22 JSON,當週 W23 → 回傳 W22(最近一份)', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'health-trend-'));
    try {
      const historyDir = path.join(tmpRoot, 'history');
      fs.mkdirSync(historyDir, { recursive: true });
      fs.writeFileSync(path.join(historyDir, '2026-W21.json'), JSON.stringify(buildReport('2026-W21', 5)));
      fs.writeFileSync(path.join(historyDir, '2026-W22.json'), JSON.stringify(buildReport('2026-W22', 7)));
      const result = loadPreviousWeek(historyDir, '2026-W23');
      expect(result?.weekId).toBe('2026-W22');
      expect(result?.metrics.todosP1.open).toBe(7);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('corrupt JSON → null(不 crash)', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'health-trend-'));
    try {
      const historyDir = path.join(tmpRoot, 'history');
      fs.mkdirSync(historyDir, { recursive: true });
      fs.writeFileSync(path.join(historyDir, '2026-W20.json'), 'not json {{{');
      expect(loadPreviousWeek(historyDir, '2026-W21')).toBeNull();
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('diffMetric ↑ / ↓ / →', () => {
    expect(diffMetric(5, 7)).toEqual({ from: 5, to: 7, delta: 2, direction: '↑' });
    expect(diffMetric(5, 3)).toEqual({ from: 5, to: 3, delta: -2, direction: '↓' });
    expect(diffMetric(5, 5)).toEqual({ from: 5, to: 5, delta: 0, direction: '→' });
  });
});

describe('formatReportMarkdown', () => {
  function buildReport(overrides?: Partial<HealthReport['metrics']>, trend?: HealthReport['trend']): HealthReport {
    return {
      weekId: '2026-W22',
      weekStart: '2026-05-25',
      weekEnd: '2026-05-31',
      generatedAt: '2026-05-31T00:00:00Z',
      metrics: {
        todosP1: { open: 1, completed: 1 },
        lessonsNew: { count: 2, entries: ['2026-05-26: 教訓 A', '2026-05-28: 教訓 B'] },
        ...overrides,
      },
      trend: trend ?? { prevWeekId: null, diff: {} },
    };
  }

  it('first run(無 baseline)→ 印 first run 標示 + 當前數值', () => {
    const md = formatReportMarkdown(buildReport());
    expect(md).toContain('first run, no trend baseline');
    expect(md).toContain('TODOS.md P1 open | 1');
    expect(md).toContain('- 2026-05-26: 教訓 A');
  });

  it('有 trend diff → render trend badge', () => {
    const md = formatReportMarkdown(
      buildReport(undefined, {
        prevWeekId: '2026-W21',
        diff: { todosP1Open: { from: 3, to: 1, delta: -2, direction: '↓' } },
      })
    );
    expect(md).toContain('TODOS.md P1 open | 1 ↓ (was 3, -2)');
  });

  it('collector 失敗(raw:error)→ render ERROR,不印 -1 sentinel', () => {
    const md = formatReportMarkdown(
      buildReport({
        todosP1: { open: -1, completed: -1, raw: 'error' },
        lessonsNew: { count: -1, entries: [], raw: 'error' },
      })
    );
    expect(md).toContain('TODOS.md P1 open | ERROR');
    expect(md).toContain('LESSONS.md 新增(自本週週一 UTC 起) | ERROR');
    expect(md).not.toMatch(/\| -1/);
  });
});
