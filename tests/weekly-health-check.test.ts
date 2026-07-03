// Tests for scripts/weekly-health-check.ts(骨架版)
//
// 驗證:
//   - countTodosP1:open / completed / boundary(P2 段不被誤算)/ 檔尾無下個 heading
//   - countLessonsNewEntries:date 過濾 / 警告 entries / 無效日期
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
