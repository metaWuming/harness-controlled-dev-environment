// scripts/check-todos-markers.ts
//
// TODOS marker 治理 — 防「marker 過時」自動偵測。
//
// 緣起:`TODOS.md` 的完成/待辦 marker 是手動維護,快速開發節奏下會腐爛
//   ——「✅ 標完工但 PR 其實沒 merge」(打錯號 / 投機性標 ✅),或反過來
//   「🟡/❌ 標待辦但工作其實已 merge」(sprint 落地沒回填 marker)。
// 純提醒擋不住復發 → 立機器 gate(對齊 scripts/check-doc-refs.ts 的 pure-function 範式)。
//
// 兩個檢查(純 git、離線、不需網路 / gh):
//   1. 硬 gate「完成宣稱必須有 merged 證據」:含完成 token(✅ / 完工 / 已晉升)且引用 PR
//      的「完工條目」 —— 行內(同行 token+PR)、`**A-N** [✅ done]`(token 在 heading、PR 在
//      bullet → 聚合整個 body)、`### / #### ✅ … 完工` heading(同上聚合)三種形式。判準:
//      **至少一個**被引用 PR 在 git 史有 squash/merge commit。全都查無 → exit 1(防打錯號 / 投機性
//      標 ✅)。用「至少一個」是因 body 聚合可能順帶引用未合併 follow-up,只要交付 PR 已 merge 即可。
//   2. 軟 advisory「疑似 stale-done」:結構化 `**A-N ...** [🟡 partial|❌ pending]`
//      若其條目 body 引用了已 merged 的交付 PR 且缺明示阻塞詞(⏳ / 卡 / 待外部 / 待拍板 / 律師 …)
//      → 印警告要求人工 re-verify。不擋 CI(避免合理 partial 假陽性)。
//
// merged 判定:對「交付分支」(origin/develop、origin/main;見 buildMergedPrSet)`git log` 抓 commit subject,regex 出
//   - squash 形式 `…(#N)`(feature/fix PR squash→develop)
//   - merge 形式 `Merge pull request #N`(sync develop→main)
//   兩者聯集 = 「有 merge 證據的 PR 號集合」。離線、確定性、無 gh 依賴。
//   另:CI 於 pull_request event 經 env `MARKER_SELF_PR` 傳入當前 PR# → 視為合法證據,
//   解「同 PR 翻 marker 引用本 PR#(尚未 merge)」死鎖(該 PR 正是即將 merge 出證據者)。
//
// ⚠️ 導入注意:若你的 repo 用 `#N` 同時表示 PR 號**與**其他編號(issue / sprint / 內部序號),
//   請在 extractPrCitations 內先移除那類引用再抽 PR,否則會被誤當 PR 號 → 假陽性。
//
// 設計界線:
//   - 只驗 `TODOS.md`(marker 的 SSOT)。其他 narrative doc 易擴(改 MARKER_DOCS),
//     但其完成 claim 多為歷史、雜訊高,預設不納。
//   - 完成行「無引用任何 PR」→ 無法驗證 → 跳過(不強制「每個 ✅ 都要引 PR」,避免對既有散文大量假陽性)。
//   - 跳過 fenced code block(``` / ~~~),避免範例 marker 誤判(對齊 check-doc-refs)。
//   - repo 尚無任何完成宣稱時(模板初始狀態),即使 git 史抓不到任何 merged PR 也放行
//     (無宣稱 = 無可驗證對象,不該擋 CI)。
//
// 已知限制(刻意接受,屬 false-negative=gate 偏寬不偏嚴,不會誤擋合法 PR):
//   done 區塊內的「子完工 sub-claim」若把完成 token 與交付 PR 拆在**不同 bullet 行**
//   (`- ✅ 子完工` 一行、`- 對應 PR` 另一行),其 PR 會被併入父 claim、被父的 merged PR
//   在 at-least-one 語義下遮蔽 → 該子 PR 的 staleness 不被獨立抓出。已關閉的同類:巢狀 `#### ✅`
//   heading(boundary)、inline `- ✅ … PR` bullet(token-bearing body 行不併父)。完整關閉「多行
//   拆分子 claim」需遞迴 markdown 子項剖析,對 marker 治理工具屬過度工程。
//
// 設計原則(pure function 易測):
//   - parseTodosMarkers(content):純解析 → ParseResult
//   - checkTodosMarkers(parsed, prExists):純驗證(prExists 注入)→ CheckResult
//   - main():git IO(建 merged set)+ 編排 + exit code
//
// Usage:  npx tsx scripts/check-todos-markers.ts
// CI:     .github/workflows/ci.yml 加 step「TODOS Markers Check」

import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// CWD-independent root resolution(對齊 check-doc-refs.ts)
const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    return path.resolve(__dirname, '..');
  }
})();

// marker SSOT。要納更多 doc(progress.md 等)在此擴。
const MARKER_DOCS = ['TODOS.md'];

// 完成宣稱 token(出現任一 = 該行宣稱「已完成」)。刻意不含裸 "done"/"做完"(英中散文太雜)。
const COMPLETION_TOKENS = ['✅', '完工', '已晉升', '已 merge', '已 merged'];
// 軟 advisory 的阻塞詞 escape:pending/partial 條目 body 含任一 = 合理待辦(非 stale-done)。
// ⚠️ 子字串比對(「卡」「待拍板」都是):否定句(「不再待拍板」)照樣命中——這是接受的
//    邊界,不加 lookbehind 去解析語意(每補一次就換一個洞;理由詳見
//    .claude/sop/plan-mode-checklist.md〈壓輪數的三條紀律〉⑶ 的守門段)。操作面
//    的解法寫在 TODOS.md 檔頭:阻塞解除時直接刪詞,不寫否定句。
// 導入時可按你的 repo 慣用語擴充。
const BLOCKER_RE =
  /⏳|卡|待\s*Production|待上線|上線後|上線當天|Production|外部|律師|親自|申請|審核|待拍板/;
// 結構化條目 marker:`**<ID> 標題** [✅ done|🟡 partial|❌ pending]`,ID 形如 A-3 / B-12 / HC-1。
const ITEM_MARKER_RE = /\*\*([A-Z]{1,8}-\d+)\b[^*\n]+?\*\*\s+\[(✅ done|🟡 partial|❌ pending)\]/;

export interface PrRef {
  pr: number;
  line: number;
}
export interface CompletionClaim {
  line: number;
  text: string;
  prs: number[];
}
export interface PendingItem {
  id: string; // "A-3"
  status: 'partial' | 'pending';
  line: number;
  bodyPrs: number[];
  hasBlocker: boolean;
}
export interface ParseResult {
  completionClaims: CompletionClaim[];
  pendingItems: PendingItem[];
  allCitedPrs: number[]; // 完成行引用的全部 PR(去重),供 summary
}
export interface CheckResult {
  violations: { line: number; text: string; missingPrs: number[] }[];
  advisories: { id: string; status: string; mergedPrs: number[] }[];
  verifiedPrs: number; // 完成行引用且有 merge 證據的 PR 數
  totalCompletionPrs: number; // 完成行引用的 PR 總數(去重)
}

/**
 * 從一段文字抽出 PR 引用號(2-5 位數)。
 * 涵蓋形式:`PR #150` / `(#177)` / `#177→develop` / markdown `[#158](…/pull/158)` /
 * 裸 GitHub PR URL `…/pull/158`。
 * 單位數 `#N` 不算(避免 #1/#5 這類序號雜訊);上限放寬到 5 位數,避免大 repo 撞號。
 *
 * 🔴 **先移除 issue 井號引用再抽 PR**:GitHub 專案常用井號同時指 PR 與 issue,若不
 *    先過濾 issue 引用,`spec = GitHub issue #13` 這種寫法會把 `#13` 當成查無 merge
 *    證據的 PR、假陽性擋掉合法完工條目。
 *
 *    實作邊界(Codex R1 P2):
 *    - **左邊界 `(?<![A-Za-z])`**:避免 `reissue`、`sub-issue`(前接字母) 中的 `issue`
 *      被誤匹配,那些字通常後面接的才是真 PR 號 (`reissue #150` 是 PR、不是 issue)
 *    - **分隔符** `[\s:：（(]*`:涵蓋常見 issue 與井號之間的字元 — 空白、冒號、
 *      全形冒號、半形/全形左括號
 *    - **括號閉合** `[)）]?`:可選右括號 (半形/全形)
 *    - `\s*`:井號與數字之間允許空白
 *
 *    ⚠️ 若你的 repo 用井號也表示其他非 PR 編號(sprint 序號 / 內部工單),照此模式擴充
 *    filter regex (例:`/sprint\s*#\d+/gi`)。
 */
export function extractPrCitations(text: string): number[] {
  // 先剝掉「issue[s] 井號N」引用(大小寫不敏感),避免 issue 號被誤當 PR 號
  // 🔴 Fresh F2 修:`issues?` 涵蓋複數形式;GitHub `closes issues #13, #14` 這種常見寫法
  //    若不涵蓋複數、`#13` 會被誤當 PR 號。
  const cleaned = text.replace(
    /(?<![A-Za-z])(?:github\s+)?issues?[\s:：（(]*#\s*\d+[)）]?/gi,
    ''
  );
  const out = new Set<number>();
  for (const re of [/#(\d{2,5})\b/g, /\/pull\/(\d{2,5})\b/g]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned)) !== null) {
      out.add(Number(m[1]));
    }
  }
  return [...out];
}

function hasCompletionToken(text: string): boolean {
  return COMPLETION_TOKENS.some((t) => text.includes(t));
}

/** `### ` / `#### ` heading 且含完成 token → 該 heading 是一個獨立完工條目(自己一個 completionClaim)。 */
function isDoneHeadingLine(s: string): boolean {
  return (s.startsWith('### ') || s.startsWith('#### ')) && hasCompletionToken(s);
}

/**
 * 純解析:逐行掃 TODOS 內容(跳過 fenced code),抽:
 *   - completionClaims:含完成 token 且引用 PR 的行(硬 gate 對象)
 *   - pendingItems:結構化 `**A-N …** [🟡/❌]` 條目 + 其 body PR / 阻塞詞(軟 advisory 對象)
 */
export function parseTodosMarkers(content: string): ParseResult {
  const lines = content.split('\n');
  const completionClaims: CompletionClaim[] = [];
  const pendingItems: PendingItem[] = [];
  const allCited = new Set<number>();

  // fenced code 追蹤(對齊 check-doc-refs:同款 marker 才能關)
  let fenceMarker: '```' | '~~~' | null = null;
  const inFence: boolean[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const mk = trimmed.startsWith('```') ? '```' : trimmed.startsWith('~~~') ? '~~~' : null;
    if (mk) {
      if (fenceMarker === null) fenceMarker = mk;
      else if (mk === fenceMarker) fenceMarker = null;
      inFence[i] = true; // fence 標記行本身也跳過
      continue;
    }
    inFence[i] = fenceMarker !== null;
  }

  // markdown heading 層級(`#` 數;非 heading 視為最深 Infinity → 任何 heading 都是其邊界)。
  const headingLevel = (s: string): number => {
    const m = s.match(/^(#{1,6})\s/);
    return m ? m[1].length : Infinity;
  };

  // 蒐集一個條目的 body(含起始行,跳過 fenced;到下一個「同層或更高層」區段邊界停)。
  // - level-aware:`### ✅` 區塊內的 `#### ` 是巢狀子節(更深)不算邊界,其交付 PR 仍要聚合。
  // - markConsumed:只有「會產生 completionClaim 取代行內掃描」的 done 區塊才標記 body 已吸收,
  //   避免 pending body 裡的子完工 bullet(`- 子項完工 PR #N`)被吞掉而逃 line-scan gate。
  // - fenced 行既不算 body、也不能當邊界(inFence 必須在邊界判斷之前;否則 fenced 範例提前截斷 body)。
  const consumed: boolean[] = [];
  const collectBody = (startIdx: number, markConsumed: boolean): string => {
    const startLevel = headingLevel(lines[startIdx]);
    const parts: string[] = [lines[startIdx]];
    for (let j = startIdx + 1; j < lines.length; j++) {
      if (inFence[j]) continue;
      const nxt = lines[j];
      const lvl = headingLevel(nxt);
      // 邊界:結構化 marker / `---` / 「同層或更高層的 heading」/ 「本身是 done-heading 的巢狀標題」。
      // - 非 heading 的 body 行(lvl=Infinity)不算邊界 —— 否則結構化 marker 起始(startLevel=Infinity)
      //   會在第一個 body 行 Infinity<=Infinity 即斷。
      // - 巢狀 `#### ✅`(深於父但自帶完成 token)是獨立完工 claim,不可被父吸收 —— 否則其未合併 PR
      //   會被父的 merged PR 遮蔽(at-least-one 語義下)而逃 gate。
      if (
        ITEM_MARKER_RE.test(nxt) ||
        nxt.startsWith('---') ||
        (lvl !== Infinity && lvl <= startLevel) ||
        isDoneHeadingLine(nxt)
      ) {
        break;
      }
      // done 區塊內「自帶完成 token 的 body 行」(inline 子完工 bullet,如 `- ✅ 子功能 PR #N`)是
      // 自己一個 completion claim:不併入父 body、也不 consume → 留給 line-scan 獨立驗其 PR,否則父的
      // merged PR 會在 at-least-one 語義下遮蔽它。pending 區塊(markConsumed=false)
      // 不做此跳過:body 要完整供 advisory 判定,token bullet 本就由 line-scan 處理(pending 不 consume)。
      if (markConsumed && hasCompletionToken(nxt)) continue;
      parts.push(nxt);
      if (markConsumed) consumed[j] = true;
    }
    return parts.join('\n');
  };

  for (let i = 0; i < lines.length; i++) {
    if (inFence[i] || consumed[i]) continue; // fenced / 已被 done 區塊吸收的 body 行不獨立處理
    const line = lines[i];
    const lineNo = i + 1;
    const am = line.match(ITEM_MARKER_RE);
    const isDoneHeading = isDoneHeadingLine(line);

    if (am) {
      // 結構化條目 marker `**<ID> …** [狀態]`:done / pending 都看整個條目 body
      // (`[✅ done]` 在 heading、交付 PR 常在後續 bullet — 逐行掃兩邊都漏)。
      // 只有 done 才 markConsumed(取代行內掃描);pending 不吞 body → 子完工 bullet 仍被 line-scan gate。
      if (am[2] === '✅ done') {
        const bodyPrs = extractPrCitations(collectBody(i, true));
        if (bodyPrs.length > 0) {
          completionClaims.push({ line: lineNo, text: line.trim(), prs: bodyPrs });
          bodyPrs.forEach((p) => allCited.add(p));
        }
      } else {
        const body = collectBody(i, false);
        pendingItems.push({
          id: am[1],
          status: am[2] === '🟡 partial' ? 'partial' : 'pending',
          line: lineNo,
          bodyPrs: extractPrCitations(body),
          hasBlocker: BLOCKER_RE.test(body),
        });
      }
    } else if (isDoneHeading) {
      // 完工 heading 區塊(### / #### 含完成 token):交付 PR 常寫在後續 bullet → 聚合整個 body。
      const bodyPrs = extractPrCitations(collectBody(i, true));
      if (bodyPrs.length > 0) {
        completionClaims.push({ line: lineNo, text: line.trim(), prs: bodyPrs });
        bodyPrs.forEach((p) => allCited.add(p));
      }
    } else if (hasCompletionToken(line)) {
      // 行內完成宣稱(非 heading 行;heading 由上面區塊邏輯處理,避免重複)
      const prs = extractPrCitations(line);
      if (prs.length > 0) {
        completionClaims.push({ line: lineNo, text: line.trim(), prs });
        prs.forEach((p) => allCited.add(p));
      }
    }
  }

  return { completionClaims, pendingItems, allCitedPrs: [...allCited] };
}

/** 純驗證:用注入的 prExists 判定 violations(硬) + advisories(軟)。 */
export function checkTodosMarkers(
  parsed: ParseResult,
  prExists: (pr: number) => boolean
): CheckResult {
  const violations: CheckResult['violations'] = [];
  for (const c of parsed.completionClaims) {
    // 「至少一個被引用 PR 有 merge 證據」= 該完工宣稱有真實交付。全部都查無 merge 證據 → 失效
    // (打錯號 / 投機性標 ✅)。用「至少一個」而非「全部」:body 聚合可能順帶引用未合併的
    // follow-up / 相關 PR,只要交付 PR 已 merge 就不該誤判(避免 false-positive 擋 CI)。
    const anyMerged = c.prs.some((p) => prExists(p));
    if (!anyMerged) {
      violations.push({ line: c.line, text: c.text, missingPrs: c.prs });
    }
  }

  const advisories: CheckResult['advisories'] = [];
  for (const it of parsed.pendingItems) {
    const mergedPrs = it.bodyPrs.filter((p) => prExists(p));
    if (mergedPrs.length > 0 && !it.hasBlocker) {
      advisories.push({ id: it.id, status: it.status, mergedPrs });
    }
  }

  const totalCompletionPrs = parsed.allCitedPrs.length;
  const verifiedPrs = parsed.allCitedPrs.filter((p) => prExists(p)).length;
  return { violations, advisories, verifiedPrs, totalCompletionPrs };
}

/** 交付分支候選來源四條(依序試 resolve,取所有能 resolve 的組成 trusted set):
 *   ①`origin/HEAD` 偵測到的當前 default branch(涵蓋 main / master / trunk 等 rename)
 *   ②env `DELIVERY_REFS`(逗號分隔的額外 delivery refs;**只支援固定 ref 名**、
 *      **不支援 glob**——`release/**` 這種要自己延伸 script)
 *   ③fallback:①②都空 → `origin/develop`(GitFlow 慣例;放這裡而不是無條件並列,
 *      避免 abandoned/legacy `origin/develop` 分支上的 `(#N)` subject 假通過——
 *      Step 5 review #2 抓到的 round 6 flaw 換位置重演)
 *   ④last-resort dev-mode fallback:①②③都空 → 本地 `main` / `develop`
 *      (僅開發環境未 clone 時有效;CI 有 origin/HEAD 走不到這;⚠️ 仍有 round 6-like
 *      風險:本地實驗分支同名時會被信任、無法區分)
 *
 * 🔴 Codex batch 6 round 6 P2:不再無條件並列 `master` / `trunk` / 本地慣例名。
 * 🔴 Step 5 sanity check #2:origin/develop 挪到 fallback,不與 origin/HEAD 並列。
 *
 * env 值嚴格 whitelist:只認 `[A-Za-z0-9_./-]`,擋 shell metacharacter/option injection
 * (`--all` 會繞掉 hardening、`;pwd` 走 shell 拆兩條)。 */
const DEFAULT_DELIVERY_ENV = 'DELIVERY_REFS';
const SAFE_REF_RE = /^[A-Za-z0-9_./-]+$/;

/**
 * git IO:從「交付分支」commit subject 建「有 merge 證據的 PR 號集合」。
 * 只認交付分支的 ancestry —— **不用 `git log --all`**(會掃未合併 feature 分支的 `(#N)`),
 * **也絕不退回 HEAD**(feature 分支 HEAD 含未合併 commit,其 `(#N)` 會假「已交付」——
 * Codex review:HEAD fallback 會讓未合併 commit 充當 merge 證據,gate 假綠)。
 * 候選來源與 fallback 順序見上面 `DEFAULT_DELIVERY_ENV` docstring;refs 全空 → 回空集合
 * (有宣稱時 fail-closed,警告訊息指引使用者設定 env `DELIVERY_REFS` 或確認 origin/HEAD)。
 */
function buildMergedPrSet(): Set<number> {
  const merged = new Set<number>();
  // ref 存不存在:改用 execFileSync + arg array,擋 shell injection(env `DELIVERY_REFS`
  // 可能來自不受信任的來源;字串 interpolation 會讓 `main;pwd` 走 shell 拆兩條)
  const resolves = (r: string) => {
    if (!SAFE_REF_RE.test(r)) return false; // whitelist,擋 `--all` / `;` / space
    try {
      execFileSync('git', ['rev-parse', '--verify', '--quiet', r], {
        cwd: REPO_ROOT,
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  };
  const refs: string[] = [];
  const seen = new Set<string>();
  const push = (r: string) => {
    if (!r || seen.has(r)) return;
    if (!resolves(r)) return;
    seen.add(r);
    refs.push(r);
  };

  // ①origin/HEAD 偵測 default_branch(涵蓋 main / master / trunk 等 repo 主線 rename)
  try {
    const def = execFileSync('git', ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
    })
      .trim()
      .replace('refs/remotes/', '');
    if (def) push(def);
  } catch {
    /* origin/HEAD 未設(常見於非 clone 的 repo)→ 走下方 fallback */
  }

  // ②env DELIVERY_REFS(逗號分隔)——導入者用固定 release branch 或其他自訂 delivery。
  //    ⚠️ 只支援固定 ref 名、不支援 glob(rev-parse 不展開 `release/**`)
  const extras = (process.env[DEFAULT_DELIVERY_ENV] ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const r of extras) push(r);

  // ③fallback:①②都空 → origin/develop(GitFlow 慣例)。放這裡而不是無條件並列,
  //    避免 abandoned origin/develop 上的 `(#N)` subject 假通過(Step 5 review #2)
  if (refs.length === 0) push('origin/develop');

  // ④last-resort dev-mode fallback:①②③都空 → 本地 main / develop
  //    (僅開發環境未 clone 時有效;CI 有 origin/HEAD 不會走這條;仍有 round 6-like 風險
  //    但命中率極低,tolerate 作為離線 fallback。要嚴格 fail-closed 者可拿掉本區塊)
  if (refs.length === 0) {
    push('main');
    push('develop');
  }

  if (refs.length === 0) {
    console.warn(
      '⚠️ 找不到任何交付 ref(origin/HEAD / env DELIVERY_REFS / origin/develop / 本地 main / 本地 develop 都不存在)。' +
        '不以 HEAD 充當 merge 證據(未合併 commit 會假交付)——若 TODOS 有完成宣稱將直接失效。' +
        '請在 CI 或本地設 DELIVERY_REFS env(如 `origin/release`——remote-tracking ref 需先 fetch 進 local),或確認 origin/HEAD 已設。'
    );
    return merged;
  }
  let log = '';
  try {
    // execFileSync + arg array:與 resolves() 同樣 fail-closed(refs 已通過 SAFE_REF_RE)
    log = execFileSync('git', ['log', ...refs, '--oneline', '--no-color'], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return merged; // 非 git repo / git 不可用 → 空集合(main 會據此決定)
  }
  const squashRe = /\(#(\d{2,5})\)/g;
  const mergeRe = /pull request #(\d{2,5})/gi;
  for (const line of log.split('\n')) {
    let m: RegExpExecArray | null;
    while ((m = squashRe.exec(line)) !== null) merged.add(Number(m[1]));
    while ((m = mergeRe.exec(line)) !== null) merged.add(Number(m[1]));
  }
  return merged;
}

function main() {
  const merged = buildMergedPrSet();
  // 解死鎖:SOP 鼓勵「同 PR 順手翻 marker 引用本 PR#」,但本 PR squash commit 在 merge 前不存在於
  // develop/main(且刻意排除 HEAD)→ 會擋下「產生證據的那次 merge」。CI 於 pull_request event 把
  // 當前 PR# 經 env `MARKER_SELF_PR` 傳入,視為合法 merge 證據(它正是即將 merge 出證據的 PR)。
  const selfPr = Number(process.env.MARKER_SELF_PR);
  if (Number.isInteger(selfPr) && selfPr > 0) merged.add(selfPr);
  const prExists = (pr: number) => merged.has(pr);

  // 先解析所有 doc,再決定 merged set 是否為硬性前提:
  // repo 完全沒有「引用 PR 的完成宣稱」時(模板初始狀態 / 全新導入),即使 git 史抓不到
  // 任何 merged PR 也放行 —— 無宣稱 = 無可驗證對象,不該擋 CI。
  const parsedDocs: { doc: string; parsed: ParseResult }[] = [];
  for (const doc of MARKER_DOCS) {
    const abs = path.join(REPO_ROOT, doc);
    if (!fs.existsSync(abs)) continue;
    parsedDocs.push({ doc, parsed: parseTodosMarkers(fs.readFileSync(abs, 'utf-8')) });
  }
  const totalClaims = parsedDocs.reduce((n, d) => n + d.parsed.completionClaims.length, 0);
  if (totalClaims > 0 && merged.size === 0) {
    console.error('❌ 有完成宣稱待驗,但無法從 git 史建立 merged PR 集合(非 git repo 或 git 不可用)');
    process.exit(1);
  }

  const allViolations: (CheckResult['violations'][number] & { doc: string })[] = [];
  const allAdvisories: (CheckResult['advisories'][number] & { doc: string })[] = [];
  let totalCompletionPrs = 0;
  let verifiedPrs = 0;

  for (const { doc, parsed } of parsedDocs) {
    const res = checkTodosMarkers(parsed, prExists);
    allViolations.push(...res.violations.map((v) => ({ ...v, doc })));
    allAdvisories.push(...res.advisories.map((a) => ({ ...a, doc })));
    totalCompletionPrs += res.totalCompletionPrs;
    verifiedPrs += res.verifiedPrs;
  }

  console.log(
    `🔖 TODOS marker check — 完成宣稱引用 ${totalCompletionPrs} 個 PR,其中 ${verifiedPrs} 個有 merge 證據`
  );

  // 軟 advisory(不擋 CI)
  if (allAdvisories.length > 0) {
    console.warn(`\n⚠️ ${allAdvisories.length} 條疑似 stale-done(pending/partial 但引用已 merged PR、無阻塞詞):`);
    for (const a of allAdvisories) {
      console.warn(`  ${a.doc} ${a.id} [${a.status}] → 引用已 merged PR #${a.mergedPrs.join(', #')}`);
    }
    console.warn('  💡 人工 re-verify:該條目是否其實已完成?是 → 翻 ✅;否 → 補阻塞詞說明為何仍 partial。');
  }

  // 硬 gate
  if (allViolations.length === 0) {
    console.log('✅ 0 個失效完成宣稱 — 所有「✅/完工」條目至少有一個引用 PR 具 merge 證據');
    process.exit(0);
  }

  console.error(`\n❌ ${allViolations.length} 個失效的完成宣稱(標完工但引用的 PR 全都無 merge 證據):`);
  for (const v of allViolations) {
    console.error(`  ${v.doc}:${v.line}  → 引用 PR #${v.missingPrs.join(', #')} 全都找不到 merge commit`);
    console.error(`    ${v.text.slice(0, 90)}`);
    console.error('');
  }
  console.error(
    '💡 修法:確認該 PR 號是否打錯,或工作其實尚未 merge(投機性標 ✅)。\n' +
      '   PR 已 squash→develop 即有 `(#N)` commit;已 sync→main 有「Merge pull request #N」。'
  );
  process.exit(1);
}

// 只在直接 invoke 時跑 main(unit test import 時跳過)
if (typeof require !== 'undefined' && require.main === module) {
  main();
}
