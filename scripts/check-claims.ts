// scripts/check-claims.ts
//
// SOP Step 4 的「量詞自檢器」(可控開發環境 Layer 3)。
//
// 為什麼有這支:review 的長尾輪次,最大宗往往不是程式缺陷,而是**你自己前一輪修法
// 新引入的過度宣稱**(散文級)。典型形狀是同一句事實被 review 挑戰兩三次才修對——
// 「A ＋ B 一起清空」(B 其實沒被呼叫)→「成立的理由**只有** A」(其實還有 C)→
// 「兩道**各自都足夠**」(其中一道只擋一種來源)。整整幾輪都在修同一句話。
//
// 形狀:**「只有／唯一／各自都足夠／全面」這類量詞,宣稱的是一個你沒有窮舉過的集合。**
// 形容詞錯了通常還救得回來,量詞錯了是邏輯錯。這條紀律靠人腦守常常連幾刀擋不住
// ——「同一個坑踩到第三次就機器化」,這支就是那一階。
//
// ⚠️ 定位(讀我再用,這幾行是它的誠實邊界):
//   - 這**不是 CI gate、不擋任何東西**。量詞在說明文字裡有大量合法用途,硬擋只會逼出
//     以「值」為準的 allowlist——那正是「白名單要用位置不要用值」明訂的反模式。
//   - 它是**待處置清單產生器**,不是對錯判定器。命中不代表寫錯,代表「這句話你得能
//     列出它宣稱的那個集合」。列得出來就留著,列不出來就降級措辭。
//   - **它是 denylist,清單沒人維護時就是一道空門**——而且看起來很像有在守。
//     防跳過的機制只有紀律一條,而且它有順序:**Step 4 備妥「命中數 ＋ 逐條處置」→
//     Step 6 開 PR 時貼進 PR 描述(合併前的關口)→ Step 7 再抄進
//     `.claude/memory/progress.md` 留史**。⚠️ `progress.md` 是事後留痕,Step 7 跑的時候
//     PR 早就合了——**別把它當關口**。
//   - 只掃 **diff 的新增行**。存量不掃——不然第一次跑就會淹掉,然後沒人再看它。
//   - 🔴 **它會把命中的整行印出來,而那份輸出要被貼進 PR 描述**(SOP Step 6)。所以
//     未追蹤檔一律走 `--exclude-standard`:**被 gitignore 的檔(`.env.local` 之類)不進掃描
//     範圍**。拿掉那個旗標＝本機祕密的內容會被印進 stdout 再貼上 PR。
//     `[閘門: tests/check-claims.test.ts 有一條專門守它,mutation 驗過會轉紅]`
//
// Usage:
//   npm run check:claims                             # base 預設 develop(不存在時退 main)
//   npx tsx scripts/check-claims.ts --base=origin/develop
//   npx tsx scripts/check-claims.ts --base=<sha>     # 只看某一輪之後自己新加的東西
//
// Exit codes:
//   0 = 沒有命中
//   1 = **有待處置的命中**(不是「你寫錯了」,是「這幾句要逐條過目」)
//   2 = 無法判定(非法 base / base 不是 HEAD 祖先 / git 取不到 diff)——
//       fail-closed 的意思是「你沒拿到清單,請自己人工掃一遍」,不是「擋下你」。

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * 量詞清單。**每一條都要對得上一個真實踩過的案例**——沒有案例的不要加,
 * 否則命中率上升、訊號下降,最後整支被當雜訊忽略(那就退化成上面說的那道空門)。
 *
 * ⚠️ 刻意**不收**「都」「很」「非常」這類:前者在中文裡幾乎每句都有,後者是形容詞強度
 * 不是集合宣稱。本表只針對**對一個集合下全稱／唯一性斷言**的詞。
 */
export const CLAIM_PATTERNS: { pattern: RegExp; why: string }[] = [
  // ⚠️ **刻意不加 `(?!一)` 的負向前瞻**:第一版想排掉「只有一個」這種單純計數,
  //    但「成立的理由只有『…』**這一條**」正是最危險的形狀——「只有一條」剛好是最該抓的,
  //    排掉它等於漏掉主要案例。寧可多吵。
  { pattern: /只有/, why: '唯一性斷言:那個集合你窮舉過了嗎(「理由只有…這一條」最容易錯)' },
  { pattern: /唯一/, why: '唯一性斷言(同上)' },
  { pattern: /各自都足夠|都足以|皆足以/, why: '多重充分性斷言:每一道真的都獨立成立嗎' },
  { pattern: /完全一樣|完全相同|一模一樣/, why: '等同性斷言:兩者真的每個面向都相同嗎(常有一兩處政策不同)' },
  { pattern: /全面|全部的|所有的|每一(條|支|處|個|次|列|份)/, why: '全稱斷言:真的涵蓋全部,還是只掃了一部分' },
  { pattern: /絕不|絕對不|永遠不|從不/, why: '否定全稱(想過反例了嗎)' },
  { pattern: /一定會|必然會|保證/, why: '必然性斷言(外部系統的行為不要用這個詞)' },
  { pattern: /不可能/, why: '不可能性斷言:是真的不可能,還是低機率' },
  { pattern: /窮舉/, why: '宣稱窮舉過——那份清單附上了嗎' },
  { pattern: /沒有任何|零(缺陷|問題|風險)/, why: '空集合斷言:真的一個都沒有,還是只是沒想到' },
  // ⚠️ **刻意只收窄化版的「不會 X」**:bare `不會` 的訊噪比極差(「不會亮橫幅」「會不會開始」
  //    這種合法敘述佔絕大多數)。加了只會訓練自己跳過整份清單。窄化到「宣稱某個故障模式
  //    不會發生」之後,訊號才乾淨。
  { pattern: /不會(誤報|誤判|誤傷|漏|出錯|失敗|發生|重複|影響)/, why: '宣稱某個故障模式不會發生(反例想過了嗎)' },
  { pattern: /\bnever\b|\balways\b|\bimpossible\b|\bguaranteed\b/i, why: '英文全稱／必然性斷言' },
];

export interface AddedLine {
  file: string;
  line: number;
  text: string;
}

export interface ClaimHit extends AddedLine {
  matched: string;
  why: string;
}

/**
 * 從 `git diff --unified=0` 的輸出解析出「新增行 ＋ 它在新檔中的行號」。
 *
 * 🔴 用 `-U0` 是刻意的:有 context 行時「+ 開頭」與「上下文」要另外分辨,而 `-U0` 讓
 *    hunk 裡**只有**新增與刪除行,行號直接從 hunk header 的 `+start` 累加即可。
 *
 * 🔴 **必須追蹤「在不在 hunk 裡」,不能只看行首是不是 `+++ `**:
 *    新增內容本身若以 `+++` 開頭(markdown、diff 範例、這支自己的測試資料都會),
 *    raw diff 那一行就是 `++++ …` → 只看行首會把它當成檔案 header 切掉,
 *    **那一行的量詞完全不會被掃到,而且靜悄悄的**。
 *    修法:hunk header 的 `+count` 告訴我們這個 hunk 有幾條新增行;數完之前
 *    一律當內容,數完之後才允許解析 header。
 */
export function parseAddedLines(diff: string): AddedLine[] {
  const out: AddedLine[] = [];
  let file: string | null = null;
  let next = 0;
  /** 這個 hunk 還剩幾條新增行沒讀完;> 0 時任何 `+` 開頭都是內容,不是 header。 */
  let remainingAdded = 0;
  for (const raw of diff.split('\n')) {
    if (remainingAdded === 0) {
      if (raw.startsWith('+++ ')) {
        const path = raw.slice(4).trim();
        file = path === '/dev/null' ? null : path.replace(/^b\//, '');
        continue;
      }
      if (raw.startsWith('--- ')) continue;
      const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(raw);
      if (hunk) {
        next = Number(hunk[1]);
        // 省略 count 代表 1(git 的慣例);`+0,0` 代表這個 hunk 沒有新增行。
        remainingAdded = hunk[2] === undefined ? 1 : Number(hunk[2]);
        continue;
      }
    }
    if (raw.startsWith('+') && file && remainingAdded > 0) {
      out.push({ file, line: next, text: raw.slice(1) });
      next += 1;
      remainingAdded -= 1;
    }
  }
  return out;
}

/**
 * 匹配前的正規化:拿掉 markdown 強調記號與反引號。
 *
 * 🔴 為什麼需要(實測,不是預防性設計):散文佈滿 `**`,而過度宣稱的句子偏偏最愛加粗
 *    ——「多掃**不會**誤報」「本次的**全面**掃描」。不正規化的話 `不會誤報` 這種跨記號的
 *    pattern 一條都對不到,**而那正是最該抓的那幾句**。這是所有 pattern 的共同問題,
 *    所以修在這裡、不是逐條把 `\**` 塞進每個 regex(兩條寬窄不一的正則各自算同一件事＝縫)。
 * ⚠️ 回報時用**原文**,不是正規化後的字串——不然清單裡的句子跟檔案裡的長得不一樣,沒法對。
 */
export function normalizeForMatch(text: string): string {
  return text.replace(/[*_`~]/g, '');
}

/** 純函式:新增行 → 命中清單。patterns 可注入(測試用)。 */
export function scanClaims(
  lines: readonly AddedLine[],
  patterns: { pattern: RegExp; why: string }[] = CLAIM_PATTERNS,
): ClaimHit[] {
  const hits: ClaimHit[] = [];
  for (const l of lines) {
    const normalized = normalizeForMatch(l.text);
    for (const { pattern, why } of patterns) {
      const m = pattern.exec(normalized);
      if (m) hits.push({ ...l, matched: m[0], why });
    }
  }
  return hits;
}

/** 未追蹤的新檔:整份都是新增行。二進位(含 NUL)與過大的檔跳過。 */
export function untrackedAsAddedLines(
  files: readonly string[],
  read: (f: string) => string = (f) => readFileSync(f, 'utf-8'),
): AddedLine[] {
  const out: AddedLine[] = [];
  for (const file of files) {
    let content: string;
    try {
      content = read(file);
    } catch {
      continue; // 讀不到(權限／已被刪)就跳過,不是這支的職責
    }
    if (content.includes('\0') || content.length > 1_000_000) continue;
    content.split('\n').forEach((text, i) => out.push({ file, line: i + 1, text }));
  }
  return out;
}

/** 預設 diff base:與 `check-cso-trigger.ts` 同一套解析,行為要一致才不會兩支對不同的東西。 */
function resolveDefaultBase(): string {
  for (const ref of ['develop', 'main']) {
    try {
      execSync(`git rev-parse --verify --quiet ${ref}`, { stdio: 'pipe' });
      return ref;
    } catch {
      /* try next */
    }
  }
  return 'develop';
}

function main(): void {
  const baseArg = process.argv.find((a) => a.startsWith('--base='));
  const base = baseArg ? baseArg.slice('--base='.length) : resolveDefaultBase();
  // 形狀檢查:擋掉 option smuggling(首字不得是 `-`)與 shell 元字元。
  if (!/^[A-Za-z0-9_][\w./-]*$/.test(base)) {
    console.error(`❌ 非法 base ref:${base}(無法判定,請自己人工掃一遍)`);
    process.exit(2);
  }
  try {
    execSync(`git merge-base --is-ancestor ${base} HEAD`, { stdio: 'pipe' });
  } catch {
    console.error(`❌ base=${base} 不是 HEAD 的祖先,diff 會失真(無法判定)`);
    process.exit(2);
  }

  let lines: AddedLine[];
  try {
    // 🔴 `git diff <base>`(不是 `<base>...HEAD`)＝**工作樹**對 base:同時涵蓋
    //    committed／staged／unstaged。這支會在 review 迭代中被跑,那時工作樹通常是髒的
    //    ——只看 committed 會漏掉「我這一輪剛寫、還沒 commit 的那句宣稱」,
    //    而那正是它最該抓的東西。
    const diff = execSync(`git diff ${base} --unified=0 --no-renames --no-color`, {
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    });
    // 🔴 `-z`:Git 預設可能把非 ASCII(受 core.quotePath 影響)、tab、newline、反斜線等
    //    需要 quoting 的路徑加引號並轉義;一般空白本身不會。NUL 分隔可完整保留所有合法路徑。
    //    ⚠️ 被 quote 的字串 `readFileSync` 讀不到 → 被 catch 靜默跳過 → 一個全新的非 ASCII
    //    檔名檔案可以完全不被掃到而工具照樣回 0。
    const untracked = execSync('git ls-files -z --others --exclude-standard', {
      encoding: 'utf-8',
    })
      .split('\0')
      .filter(Boolean);
    lines = [...parseAddedLines(diff), ...untrackedAsAddedLines(untracked)];
  } catch {
    console.error('❌ 取不到 diff(無法判定,請自己人工掃一遍)');
    process.exit(2);
  }

  const hits = scanClaims(lines);
  if (hits.length === 0) {
    console.log(`✅ 量詞自檢:${lines.length} 行新增內容,0 處需要處置(base=${base})`);
    process.exit(0);
  }

  const byFile = new Map<string, ClaimHit[]>();
  for (const h of hits) byFile.set(h.file, [...(byFile.get(h.file) ?? []), h]);

  console.log(
    `🔎 量詞自檢:${lines.length} 行新增內容,**${hits.length} 處**要逐條過目(base=${base})\n` +
      '   命中不代表寫錯——判準是「這句話宣稱的那個集合,你列得出來嗎」。\n' +
      '   列得出來 → 留著;列不出來 → 降級措辭。\n' +
      '   🔴 逐條處置要在**合併前**貼進 PR 描述(Step 7 再抄進 progress.md 留史)。\n',
  );
  // 先印每檔統計:大批命中集中在一兩個檔時(例如**這支工具自己**——它的 pattern 清單與
  // 測試樣本本來就是量詞),一眼就看得出哪些是雜訊、哪些要真的逐條看。
  console.log(
    '   分佈:' + [...byFile.entries()].map(([f, l]) => `${f.split('/').pop()} ${l.length}`).join('、') + '\n',
  );
  for (const [file, list] of byFile) {
    console.log(`  ${file}(${list.length})`);
    for (const h of list) {
      console.log(`    :${h.line}  「${h.matched}」 ${h.text.trim().slice(0, 90)}`);
      console.log(`             ↳ ${h.why}`);
    }
  }
  // exit 1 ＝「有待處置清單」,**不是**「你做錯事」。刻意不進 CI(見檔頭定位)。
  process.exit(1);
}

if (typeof require !== 'undefined' && require.main === module) {
  main();
}
