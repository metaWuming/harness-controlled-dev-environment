#!/usr/bin/env node
/**
 * scripts/check-doc-size.ts — 記錄檔肥大守門
 *
 * 可控開發環境 Layer 3。為什麼需要這支：
 *   SOP Step 1 規定每次開工讀 `progress.md` + `LESSONS.md` 這類「記錄檔」;若這些檔案
 *   無節制成長,程式碼還沒開始讀就先吃掉一大塊 context。
 *
 *   真正的傷害不是 token,是**過期資訊會主動教錯下一棒**——一句過期的操作提示可能讓
 *   後續好幾個 session 走冤枉路;一條與現況相反的教訓,而且它每次開工必讀,傷害更大。
 *
 *   輪替規則其實老早就寫在記錄檔的檔頭(「累積 ≥ N 條就 archive」),但**靠紀律擋不住**——
 *   壓縮總發生在收工前、由寫那些內容的同一個 agent 自己動手,最糟的時機配最糟的審查者。
 *   本 repo 的教訓升級階梯是「重複踩就機器化」,這支就是那一步:**靠紀律擋不住,靠閘門擋。**
 *
 * 只管「每次開工會被讀進 context 的檔」。封存檔(`*-archive/`、`TODOS-done.md` 等)
 * **刻意不管**——它們本來就該無限成長,而且沒人會把它們讀進 context。
 *
 * 額度是**可調示範值**。導入者依自己實際的讀清單:
 *   - **增補** BUDGETS 陣列(TODOS.md、HANDOFF.md、其他 memory 檔)
 *   - **依實際檔案大小 × 1.2–1.6 調整上限**,留成長空間但會在回到肥大前先響
 *   - **調整必須寫下理由**——無聲調高就是把閘門關掉
 *   - **拆檔仍是首選**:真的還要再擴,先問專案 Owner、別自己調
 *
 * Usage:  npm run check:doc-size    # 或 npx tsx scripts/check-doc-size.ts
 * Exit:   0 = 都在額度內 / 1 = 有檔案超標(訊息會講怎麼瘦)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface DocBudget {
  /** repo 相對路徑 */
  doc: string;
  /** 上限(bytes) */
  maxBytes: number;
  /** 超標時要做什麼——訊息直接給出動作,不要只說「太大了」 */
  remedy: string;
}

/**
 * 預設額度只涵蓋**模板本身實際附帶**的記錄檔(progress.md、LESSONS.md)。
 * 導入者依自己的讀清單增補;每個新增條目都要寫下 remedy 說「超了要做什麼」。
 *
 * 🔴 缺檔 → fail-closed(見 `checkDocSizes`):列在 BUDGETS 裡的檔案必須存在,
 *    否則被改名／刪掉會讓這道閘靜靜變成 0 個檢查。**如果專案還沒建某個檔,
 *    先別把它列進 BUDGETS**,建了再加。
 */
export const BUDGETS: DocBudget[] = [
  {
    doc: ".claude/memory/progress.md",
    maxBytes: 20_000,
    remedy: "只滾動保留最近 N 筆,其餘搬到 `.claude/memory/progress-archive/`;每筆控制在 25 行內。",
  },
  {
    doc: ".claude/memory/LESSONS.md",
    maxBytes: 60_000,
    remedy:
      "同 bug class 的多條合併成一條;已被機器化擋住的教訓縮成一行(機器會擋,人不必記細節)。" +
      "真的要留長文再搬 `.claude/memory/LESSONS-archive/`。" +
      "🔴 拆檔仍是首選,真的還要再擴先問專案 Owner、別自己調(檔頭已解釋為什麼)。",
  },
];

export interface SizeResult {
  doc: string;
  bytes: number;
  maxBytes: number;
  over: boolean;
  missing: boolean;
  remedy: string;
}

export function checkDocSizes(repoRoot: string, budgets: DocBudget[] = BUDGETS): SizeResult[] {
  return budgets.map((b) => {
    const abs = path.resolve(repoRoot, b.doc);
    // 缺檔 → fail-closed。檔案被改名／刪掉不該讓這道閘靜靜變成 0 個檢查。
    if (!fs.existsSync(abs)) {
      return { doc: b.doc, bytes: 0, maxBytes: b.maxBytes, over: true, missing: true, remedy: b.remedy };
    }
    const bytes = fs.statSync(abs).size;
    return { doc: b.doc, bytes, maxBytes: b.maxBytes, over: bytes > b.maxBytes, missing: false, remedy: b.remedy };
  });
}

export function formatReport(results: SizeResult[]): { text: string; ok: boolean } {
  const bad = results.filter((r) => r.over);
  const lines: string[] = [];
  for (const r of results) {
    const kb = (r.bytes / 1000).toFixed(1);
    const maxKb = (r.maxBytes / 1000).toFixed(0);
    if (r.missing) {
      lines.push(`✗ ${r.doc} — 檔案不存在(fail-closed:改名或刪除要同步改本閘門的額度表)`);
    } else if (r.over) {
      lines.push(`✗ ${r.doc} — ${kb} KB / 上限 ${maxKb} KB\n    → ${r.remedy}`);
    } else {
      const pct = Math.round((r.bytes / r.maxBytes) * 100);
      lines.push(`  ${r.doc} — ${kb} KB / ${maxKb} KB(${pct}%)`);
    }
  }
  const head = bad.length
    ? `✗ 記錄檔超標 ${bad.length} 個——每次開工都會被讀進 context,先瘦身再繼續:`
    : `✅ 記錄檔都在額度內(${results.length} 個)`;
  return { text: [head, ...lines].join("\n"), ok: bad.length === 0 };
}

function repoRootFromHere(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

// ESM main invocation 檢查:同時支援 `tsx scripts/check-doc-size.ts` 直跑
// 與被別的檔 import 兩種情境。
const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const { text, ok } = formatReport(checkDocSizes(repoRootFromHere()));
  console[ok ? "log" : "error"](text);
  process.exit(ok ? 0 : 1);
}
