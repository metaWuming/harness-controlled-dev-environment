// scripts/weekly-health-check.ts
//
// 每週健檢腳本(骨架版)— 「每週手動跑、零維護」的指標 snapshot。
//
// 對「會隨時間 drift 的指標」自動快照,讓未來開發者(包含 AI session)有
// 「上週 vs 本週」對比基準。骨架版只帶兩個通用 collector:
//   1. TODOS.md P1 open / completed(工作累積趨勢)
//   2. LESSONS.md 近 7 天新增條目數(教訓產出速率;暴增 = bug 多 / 知識曲線陡)
//
// TODO: 按需擴充 collector — 常見候選(照本檔 collector 範式加:pure function 吃
//   content/fixture + main 只做 IO 編排 + 單一 collector 失敗不連坐):
//   - 錯誤監控平台未解 issue 數(需 API token,無 token 時 graceful N/A)
//   - dead code 掃描(knip / ts-prune 等,exit 1 是其正常行為,捕 stdout 續跑)
//   - 記憶層檔案行數紅線(progress.md / LESSONS.md 超線提醒該 archive)
//   - 你的 domain 專屬健檢(資料完整性 / 設定覆蓋率等)
//
// Output:
//   - `.claude/memory/health-history/YYYY-W##.md`(人類可讀週報)
//   - `.claude/memory/health-history/YYYY-W##.json`(機器可讀 raw data,下週讀此檔 diff)
//
// Usage:
//   npm run health:weekly
//
// 趨勢比較:
//   讀 `.claude/memory/health-history/` 內最近一份 < 當週 weekId 的 JSON,逐 metric diff。
//   第一次跑(無前週 JSON)顯示 "first run, no trend baseline"。
//
// 設計原則:
//   - Metric collectors 是 pure functions(吃 content string),unit test 直接餵 fixture
//   - 主流程 `main()` 負責 file IO + 編排,測試環境跳過 main()
//   - 單一 metric 失敗不該 fail 整個健檢(per-collector graceful error,不連坐)

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return path.resolve(__dirname, '..');
  }
})();

// =====================================================================
// Types
// =====================================================================

export interface HealthReport {
  weekId: string; // "2026-W21"
  weekStart: string; // ISO date "2026-05-18"
  weekEnd: string; // ISO date "2026-05-24"
  generatedAt: string; // ISO timestamp
  metrics: {
    // raw:'error' = 該 collector 失敗(檔案讀不到等),不連坐其他 metric
    todosP1: { open: number; completed: number; raw?: 'error' };
    lessonsNew: { count: number; entries: string[]; raw?: 'error' };
    // TODO: 按需擴充 collector(新 metric 一律 optional,舊 baseline JSON 無此欄時
    //   render / trend 都要 guard,避免讀舊檔 crash)
  };
  trend: {
    prevWeekId: string | null;
    diff: Record<
      string,
      { from: number; to: number; delta: number; direction: '↑' | '↓' | '→'; caveat?: string }
    >;
  };
}

// =====================================================================
// ISO 8601 week 計算(無 date library,手刻)
// =====================================================================

export function getISOWeek(date: Date): { year: number; week: number } {
  // ISO 8601:週一為一週開始;一年第一週包含該年第一個週四
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // 週日 0 → 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 移到該週週四
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNum };
}

export function formatWeekId({ year, week }: { year: number; week: number }): string {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getMondayOfWeek(date: Date): Date {
  // 該週週一 00:00 UTC(ISO week 起點)
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// =====================================================================
// Metric collectors(pure functions,吃 content string,易測試)
// =====================================================================

/**
 * 從 TODOS.md content 抓 P1 段內的 `### 🔴`(open)與 `### ✅`(completed)。
 *
 * P1 段邊界:`## P1` heading 至下個 `## ` heading(通常是 `## P2`)。
 * 注意:JavaScript regex 不支援 `\Z` EOF anchor,用 `$(?![\s\S])` lookahead 確認字串結尾
 * —— 否則 `## P1` 是檔案最後一段(無下個 heading)時會 silent 失配回 0/0。
 */
export function countTodosP1(todosContent: string): { open: number; completed: number } {
  const p1Match = todosContent.match(/^## P1[^\n]*\n([\s\S]*?)(?=^## |^# |$(?![\s\S]))/m);
  if (!p1Match) return { open: 0, completed: 0 };
  const p1Section = p1Match[1];
  const open = (p1Section.match(/^### 🔴/gm) ?? []).length;
  const completed = (p1Section.match(/^### ✅/gm) ?? []).length;
  return { open, completed };
}

/**
 * 從 LESSONS.md content 抓自 `sinceDate` 起新增的 entries。
 *
 * Entry 格式:`## [YYYY-MM-DD] title` 或 `## ⚠️ [YYYY-MM-DD] title`(警告類)。
 *
 * NOTE:**archive stub 也會被 regex match**(stub 仍保留 `## [YYYY-MM-DD] title`
 * heading 讓 grep 可找到該 entry 存在)。若季 retro 的 archive 動作落在 lookback
 * 窗內,該週 count 會把 stub 也算進新教訓 —— 屬已知偏差,看趨勢即可。
 */
export function countLessonsNewEntries(
  lessonsContent: string,
  sinceDate: Date
): { count: number; entries: string[] } {
  const entryRe = /^## (?:⚠️\s*)?\[(\d{4}-\d{2}-\d{2})\]\s*(.+?)\s*$/gm;
  const entries: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = entryRe.exec(lessonsContent)) !== null) {
    const [, dateStr, title] = match;
    const entryDate = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(entryDate.getTime())) continue;
    if (entryDate >= sinceDate) {
      entries.push(`${dateStr}: ${title}`);
    }
  }
  return { count: entries.length, entries };
}

// =====================================================================
// Trend comparison
// =====================================================================

/**
 * 找 historyDir 內最近一份 weekId < currentWeekId 的 JSON,parse 回傳。
 * 找不到 → null(first run)。
 */
export function loadPreviousWeek(
  historyDir: string,
  currentWeekId: string
): HealthReport | null {
  if (!fs.existsSync(historyDir)) return null;
  const files = fs
    .readdirSync(historyDir)
    .filter((f) => /^\d{4}-W\d{2}\.json$/.test(f))
    .filter((f) => f.replace('.json', '') < currentWeekId)
    .sort(); // ISO 週號字典序 = 時序
  if (files.length === 0) return null;
  const lastFile = files[files.length - 1];
  try {
    return JSON.parse(fs.readFileSync(path.join(historyDir, lastFile), 'utf-8')) as HealthReport;
  } catch {
    return null;
  }
}

export function diffMetric(
  from: number,
  to: number
): { from: number; to: number; delta: number; direction: '↑' | '↓' | '→' } {
  const delta = to - from;
  const direction = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
  return { from, to, delta, direction };
}

// =====================================================================
// Report formatting
// =====================================================================

function trendBadge(
  current: number | string,
  diff: HealthReport['trend']['diff'][string] | undefined
): string {
  if (!diff) return `${current}`;
  const star = diff.caveat ? ' *' : '';
  return `${current} ${diff.direction}${star} (was ${diff.from}, ${diff.delta >= 0 ? '+' : ''}${diff.delta})`;
}

export function formatReportMarkdown(report: HealthReport): string {
  const { weekId, weekStart, weekEnd, generatedAt, metrics, trend } = report;

  // collector 失敗(raw:'error')→ render ERROR,不印 sentinel 數值誤導讀者
  const todosDisplay = (v: number, d?: HealthReport['trend']['diff'][string]) =>
    metrics.todosP1.raw === 'error' ? 'ERROR(TODOS.md 讀取失敗)' : trendBadge(v, d);
  const lessonsDisplay =
    metrics.lessonsNew.raw === 'error'
      ? 'ERROR(LESSONS.md 讀取失敗)'
      : trendBadge(metrics.lessonsNew.count, trend.diff.lessonsNew);

  return `# Weekly Health Check — ${weekId}

> 生成時間:${generatedAt}
> 週區間:${weekStart} ~ ${weekEnd}
> 上週對比:${trend.prevWeekId ?? '_(first run, no trend baseline)_'}

## 指標摘要

| 指標 | 數值 | 趨勢 |
|---|---|---|
| TODOS.md P1 open | ${todosDisplay(metrics.todosP1.open, trend.diff.todosP1Open)} | |
| TODOS.md P1 completed | ${todosDisplay(metrics.todosP1.completed, trend.diff.todosP1Completed)} | |
| LESSONS.md 新增(自本週週一 UTC 起) | ${lessonsDisplay} | |

## LESSONS 新增 detail

${metrics.lessonsNew.entries.length === 0 ? '_本週區間無新增_' : metrics.lessonsNew.entries.map((e) => `- ${e}`).join('\n')}

## 該關心什麼?

- **P1 open ↑**:工作累積過快,交付節奏可能失衡
- **LESSONS 暴增**:bug 多 / 知識曲線陡 → 評估是否該開技術 debt sprint

## 怎麼用

- 每週日晚 / 週一早:\`npm run health:weekly\`(自動寫到 .claude/memory/health-history/)
- 擴充 collector:見本檔檔頭 TODO 清單
`;
}

// =====================================================================
// Main(entry point;測試環境跳過)
// =====================================================================

export function runHealthCheck(opts?: {
  repoRoot?: string;
  historyDir?: string;
  now?: Date;
}): HealthReport {
  const repoRoot = opts?.repoRoot ?? REPO_ROOT;
  const historyDir = opts?.historyDir ?? path.join(repoRoot, '.claude', 'memory', 'health-history');
  const now = opts?.now ?? new Date();

  const { year, week } = getISOWeek(now);
  const weekId = formatWeekId({ year, week });
  const monday = getMondayOfWeek(now);

  // Collect(per-collector try/catch:單一來源檔缺失 / 讀取失敗不連坐其他 metric)
  let todosP1: HealthReport['metrics']['todosP1'];
  try {
    todosP1 = countTodosP1(fs.readFileSync(path.join(repoRoot, 'TODOS.md'), 'utf-8'));
  } catch {
    todosP1 = { open: -1, completed: -1, raw: 'error' };
  }
  let lessonsNew: HealthReport['metrics']['lessonsNew'];
  try {
    lessonsNew = countLessonsNewEntries(
      fs.readFileSync(path.join(repoRoot, '.claude', 'memory', 'LESSONS.md'), 'utf-8'),
      monday
    );
  } catch {
    lessonsNew = { count: -1, entries: [], raw: 'error' };
  }

  // Trend(兩邊都非 error 才 diff,避免 -1 sentinel 假趨勢)
  const prev = loadPreviousWeek(historyDir, weekId);
  const trend: HealthReport['trend'] = { prevWeekId: prev?.weekId ?? null, diff: {} };
  if (prev) {
    if (todosP1.raw !== 'error' && prev.metrics.todosP1?.raw !== 'error' && prev.metrics.todosP1) {
      trend.diff.todosP1Open = diffMetric(prev.metrics.todosP1.open, todosP1.open);
      trend.diff.todosP1Completed = diffMetric(prev.metrics.todosP1.completed, todosP1.completed);
    }
    if (lessonsNew.raw !== 'error' && prev.metrics.lessonsNew?.raw !== 'error' && prev.metrics.lessonsNew) {
      trend.diff.lessonsNew = diffMetric(prev.metrics.lessonsNew.count, lessonsNew.count);
    }
  }

  const report: HealthReport = {
    weekId,
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: now.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    metrics: { todosP1, lessonsNew },
    trend,
  };

  // Write outputs
  if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
  fs.writeFileSync(path.join(historyDir, `${weekId}.json`), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(historyDir, `${weekId}.md`), formatReportMarkdown(report));

  return report;
}

function main(): void {
  const report = runHealthCheck();
  console.log(formatReportMarkdown(report));
  console.log(`\n→ Written: .claude/memory/health-history/${report.weekId}.md + ${report.weekId}.json`);
}

// 只在直接 invoke 時跑 main(unit test import 時跳過)
if (typeof require !== 'undefined' && require.main === module) {
  main();
}
