// scripts/weekly-health-check.ts
//
// 每週健檢腳本(骨架版)— 「每週手動跑、零維護」的指標 snapshot。
//
// 對「會隨時間 drift 的指標」自動快照,讓未來開發者(包含 AI session)有
// 「上週 vs 本週」對比基準。目前三個 collector:
//   1. TODOS.md P1 open / completed(工作累積趨勢)
//   2. LESSONS.md 近 7 天新增條目數(教訓產出速率;暴增 = bug 多 / 知識曲線陡)
//   3. progress.md cost field 加總(**審查是否鈍化** — 交付量沒少但 findings 持續掉,
//      通常不是程式碼變好而是 review 變走過場)
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
    // 審查產出量(「review 是否鈍化」的資料源)。optional:舊 baseline JSON 無此欄。
    reviewCost?: {
      sprints: number;
      totalRounds: number;
      totalP1: number;
      totalP2: number;
      // null = 本週所有 entry 都沒填這欄(舊格式 cost field)→ 與「填了 0」語意不同,不可混用
      step5Independent: number | null;
      raw?: 'error';
    };
    // TODO: 按需擴充 collector(新 metric 一律 optional,舊 baseline JSON 無此欄時
    //   render / trend 都要 guard,避免讀舊檔 crash)
    //   仍未實作的候選:教訓機器化率(需先在 LESSONS.md 建「已機器化」marker 慣例)、
    //   記憶歸檔解析漂移(需先固定 archive stub 格式)。見 README 關卡⑫ 的現況說明。
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
 *
 * ⚠️ **必須先剝除 HTML 註解**:TODOS.md 的 P1 段本來就放了一段註解掉的「範例格式」,
 * 內含 `### 🔴 <標題>`。不剝除的話,**一個全空的 backlog 會被報成 P1 open = 1**——
 * 假指標比沒指標更糟(2026-07-25 週健檢實跑時抓到)。
 * 同理剝除 fenced code block:未來若有人把範例改成 ``` 圍籬也不會誤算。
 */
export function countTodosP1(todosContent: string): { open: number; completed: number } {
  const cleaned = todosContent
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^```[\s\S]*?^```/gm, '');
  const p1Match = cleaned.match(/^## P1[^\n]*\n([\s\S]*?)(?=^## |^# |$(?![\s\S]))/m);
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

/**
 * 從 progress.md content 抓 `sinceDate` 起收尾的 sprint,加總其 cost field 數字。
 *
 * 回答的問題:**review 是否鈍化?**——同樣的交付量,review 抓到的東西越來越少,
 * 通常不是「程式碼變好了」而是「review 變成走過場」。這是 harness 用來監測
 * 自己的指標,不是專案指標。
 *
 * 資料源:progress entry 的 cost field(格式見 .claude/memory/progress.md 範本)
 *   `📊 成本:CC ~Xh / 跨模型 review N rounds / P1 X 個 / P2 X 個 / Step5 獨立發現 X 個`
 *
 * 實作注意:
 * 1. **先剝除 fenced code block** —— progress.md 檔頭的「Entry 格式範本」本身就含一行
 *    cost field。範本日期是 `YYYY-MM-DD` 佔位符、date parse 會失敗因此「剛好」被擋掉,
 *    但依賴那個副作用太脆(有人把範本日期改成真日期就破)→ 顯式剝除。
 * 2. 每個欄位獨立 optional:舊 entry 沒有 `Step5 獨立發現` 欄很正常,不能因此整條丟掉。
 * 3. `step5Independent` 回 null(不是 0)表示「本週沒有任何 entry 填這欄」——
 *    與「填了但都是 0」語意完全不同:前者是沒資料,後者是 review 真的沒獨立發現。
 */
export function collectReviewCost(
  progressContent: string,
  sinceDate: Date
): {
  sprints: number;
  totalRounds: number;
  totalP1: number;
  totalP2: number;
  step5Independent: number | null;
} {
  const body = progressContent.replace(/^```[\s\S]*?^```/gm, '');

  // 用 entry 日期標頭切段:從每個 `📅 YYYY-MM-DD` 到下一個(或結尾)
  const headRe = /📅\s*(\d{4}-\d{2}-\d{2})/g;
  const heads: { date: Date; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = headRe.exec(body)) !== null) {
    const d = new Date(`${m[1]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) heads.push({ date: d, start: m.index });
  }

  let sprints = 0;
  let totalRounds = 0;
  let totalP1 = 0;
  let totalP2 = 0;
  let step5Sum = 0;
  let step5Seen = false;

  for (let i = 0; i < heads.length; i++) {
    if (heads[i].date < sinceDate) continue;
    const end = i + 1 < heads.length ? heads[i + 1].start : body.length;
    const entry = body.slice(heads[i].start, end);
    const cost = entry.match(/📊[^\n]*/);
    if (!cost) continue;
    const line = cost[0];

    sprints++;
    const rounds = line.match(/(\d+)\s*rounds?/i);
    if (rounds) totalRounds += Number(rounds[1]);
    const p1 = line.match(/P1\s*(\d+)/i);
    if (p1) totalP1 += Number(p1[1]);
    const p2 = line.match(/P2\s*(\d+)/i);
    if (p2) totalP2 += Number(p2[1]);
    const s5 = line.match(/Step\s*5[^0-9]*(\d+)/i);
    if (s5) {
      step5Sum += Number(s5[1]);
      step5Seen = true;
    }
  }

  return {
    sprints,
    totalRounds,
    totalP1,
    totalP2,
    step5Independent: step5Seen ? step5Sum : null,
  };
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

  // reviewCost:欄位 optional(舊 baseline JSON 無此欄)→ 三態 render,不印誤導數值
  const rc = metrics.reviewCost;
  const reviewRows =
    !rc
      ? '| 審查產出 | _(本週報告產生時尚無此 collector)_ | |'
      : rc.raw === 'error'
        ? '| 審查產出 | ERROR(progress.md 讀取失敗) | |'
        : rc.sprints === 0
          ? '| 審查產出 | _本週無 sprint 收尾,不計_ | |'
          : [
              `| 本週收尾 sprint 數 | ${rc.sprints} | |`,
              `| 跨模型 review 總輪數 | ${trendBadge(rc.totalRounds, trend.diff.reviewRounds)} | |`,
              `| P1 findings 總數 | ${trendBadge(rc.totalP1, trend.diff.reviewP1)} | |`,
              `| P2 findings 總數 | ${rc.totalP2} | |`,
              `| Step5 獨立發現數 | ${rc.step5Independent === null ? '_未填(舊格式 cost field)_' : rc.step5Independent} | |`,
            ].join('\n');

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
${reviewRows}

## LESSONS 新增 detail

${metrics.lessonsNew.entries.length === 0 ? '_本週區間無新增_' : metrics.lessonsNew.entries.map((e) => `- ${e}`).join('\n')}

## 該關心什麼?

- **P1 open ↑**:工作累積過快,交付節奏可能失衡
- **LESSONS 暴增**:bug 多 / 知識曲線陡 → 評估是否該開技術 debt sprint
- **交付量沒少但 P1 findings 持續 ↓**:review 可能在**鈍化**(變成走過場)。
  先查是不是 review 步驟被跳過 / effort 調太低 / 對手模型換了
- **Step5 獨立發現連續為 0**:第二道 review 的邊際價值可能已消失,
  值得開 sprint 討論是否簡化(見 SOP Step 5)。**但要看累積資料,不是單週**

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
  let reviewCost: NonNullable<HealthReport['metrics']['reviewCost']>;
  try {
    reviewCost = collectReviewCost(
      fs.readFileSync(path.join(repoRoot, '.claude', 'memory', 'progress.md'), 'utf-8'),
      monday
    );
  } catch {
    reviewCost = {
      sprints: -1,
      totalRounds: -1,
      totalP1: -1,
      totalP2: -1,
      step5Independent: null,
      raw: 'error',
    };
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
    // reviewCost:兩週都要「非 error」且「真的有 sprint 收尾」才 diff——
    // 沒有 sprint 的週全是 0,拿 0 去比會產生「review 大幅下降」的假訊號
    const prevRc = prev.metrics.reviewCost;
    if (
      reviewCost.raw !== 'error' &&
      prevRc &&
      prevRc.raw !== 'error' &&
      reviewCost.sprints > 0 &&
      prevRc.sprints > 0
    ) {
      trend.diff.reviewRounds = diffMetric(prevRc.totalRounds, reviewCost.totalRounds);
      trend.diff.reviewP1 = diffMetric(prevRc.totalP1, reviewCost.totalP1);
    }
  }

  const report: HealthReport = {
    weekId,
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: now.toISOString().slice(0, 10),
    generatedAt: now.toISOString(),
    metrics: { todosP1, lessonsNew, reviewCost },
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
