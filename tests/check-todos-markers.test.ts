// Tests for scripts/check-todos-markers.ts(TODOS marker 治理 checker)
//
// 驗 pure functions:
//   - extractPrCitations:PR 號抽取、去重、單位數不算、URL 形式
//   - parseTodosMarkers:完成宣稱行 / 結構化 marker pending 條目 / fenced code 跳過
//   - checkTodosMarkers:硬 violation(完成宣稱引用未 merged PR)+ 軟 advisory(pending 引 merged PR 無阻塞詞)

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  extractPrCitations,
  parseTodosMarkers,
  checkTodosMarkers,
  acknowledgeSelfPr,
} from "../scripts/check-todos-markers";

// 批 10 Step 5 F3:新加 imports 統一雙引號、對齊 check-no-source-terms.test.ts
// (兩支同族 e2e test 保持視覺一致)。既有 describe/it 內既有引號留原樣、
// 避免大量無關 diff。
const REPO_ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
}).trim();
const SCRIPT = join(REPO_ROOT, "scripts/check-todos-markers.ts");
const TSX_BIN = join(REPO_ROOT, "node_modules/.bin/tsx");

const created: string[] = [];
afterEach(() => {
  while (created.length) rmSync(created.pop()!, { recursive: true, force: true });
});

describe('extractPrCitations', () => {
  it('PR #N / (#N) / #N→ 三種形式', () => {
    expect(extractPrCitations('PR #150 完工')).toEqual([150]);
    expect(extractPrCitations('squash 進 (#177)')).toEqual([177]);
    expect(extractPrCitations('#177→develop')).toEqual([177]);
  });

  it('單位數不算 PR(避免 #1/#5 雜訊),多 PR 去重', () => {
    expect(extractPrCitations('#1 #5 #9')).toEqual([]);
    expect(extractPrCitations('PR #43 與 PR #56 與 PR #43')).toEqual([43, 56]);
  });

  it('markdown 連結內的 PR 號', () => {
    expect(extractPrCitations('[#158](https://github.com/x/y/pull/158)')).toEqual([158]);
  });

  it('裸 GitHub PR URL(無 #)也抽號', () => {
    expect(extractPrCitations('完工於 https://github.com/x/y/pull/158')).toEqual([158]);
  });

  it('放寬 PR 號上限到 5 位數', () => {
    expect(extractPrCitations('PR #12345 完工')).toEqual([12345]);
  });

  it('先剝掉 issue #N 引用再抽 PR(避免 issue 號被誤當 PR)', () => {
    // 只有 issue 引用 → 空
    expect(extractPrCitations('spec = GitHub issue #13')).toEqual([]);
    expect(extractPrCitations('issue #42 已 close')).toEqual([]);
    // 混合:issue 引用被剝、PR 引用保留
    expect(extractPrCitations('關聯 issue #13,PR #150 完工')).toEqual([150]);
    // 大小寫不敏感
    expect(extractPrCitations('Issue #99 而 PR #150 完工')).toEqual([150]);
    expect(extractPrCitations('ISSUE #99 而 PR #150 完工')).toEqual([150]);
  });

  it('issue 引用的常見標點形式 (Codex R1 P2 邊界)', () => {
    // 冒號分隔
    expect(extractPrCitations('fixed GitHub issue: #13')).toEqual([]);
    // 全形冒號
    expect(extractPrCitations('已修 issue：#42')).toEqual([]);
    // 半形括號
    expect(extractPrCitations('fixed issue(#13)')).toEqual([]);
    // 全形括號
    expect(extractPrCitations('已修 issue（#42）')).toEqual([]);
    // 井號和數字之間有空白
    expect(extractPrCitations('issue # 13 已 close')).toEqual([]);
    // 混合:標點+PR 保留
    expect(extractPrCitations('已修 GitHub issue: #13,squash 進 PR #150')).toEqual([150]);
  });

  it('左邊界避免 reissue / sub-issue 被誤剝 (Codex R1 P2)', () => {
    // `reissue #150` 中 `issue` 前接 `re` = 字母 → 不該剝 → 150 保留為 PR
    expect(extractPrCitations('reissue #150 之後')).toEqual([150]);
    // `sub-issue #99` 中 `issue` 前接 `-` = 非字母 → 剝掉
    expect(extractPrCitations('sub-issue #99 進度')).toEqual([]);
    // `notaissue #77` 前接 `a` = 字母 → 不剝
    expect(extractPrCitations('notaissue #77 完工')).toEqual([77]);
  });

  it('複數 issues 也要剝 (Fresh review F2 P3)', () => {
    // GitHub `closes issues #13, #14` 這種常見寫法
    expect(extractPrCitations('closes issues #13,PR #150 完工')).toEqual([150]);
    expect(extractPrCitations('issues #42 已 close')).toEqual([]);
    expect(extractPrCitations('關聯 issues #13')).toEqual([]);
  });
});

describe('parseTodosMarkers', () => {
  it('完成 token + 引用 PR → completionClaim', () => {
    const r = parseTodosMarkers('- ✅ 某功能完工(PR #150,已晉升 main)');
    expect(r.completionClaims).toHaveLength(1);
    expect(r.completionClaims[0].prs).toEqual([150]);
    expect(r.allCitedPrs).toEqual([150]);
  });

  it('完成 token 但無 PR 引用 → 不收(無法驗證,不強制)', () => {
    const r = parseTodosMarkers('- ✅ 某功能完工(dev 早已接線)');
    expect(r.completionClaims).toHaveLength(0);
  });

  it('結構化 marker pending 條目 + body PR / 阻塞詞', () => {
    const content = [
      '**A-3 監控 tag 驗證** [🟡 partial]',
      '- 已接線 PR #150,但 ⏳ 需 Production 上線後驗',
      '',
      '**A-4 別的** [❌ pending]',
      '- 還沒做',
    ].join('\n');
    const r = parseTodosMarkers(content);
    expect(r.pendingItems).toHaveLength(2);
    const a3 = r.pendingItems.find((p) => p.id === 'A-3')!;
    expect(a3.status).toBe('partial');
    expect(a3.bodyPrs).toEqual([150]);
    expect(a3.hasBlocker).toBe(true); // ⏳ / Production
    const a4 = r.pendingItems.find((p) => p.id === 'A-4')!;
    expect(a4.status).toBe('pending');
    expect(a4.bodyPrs).toEqual([]);
  });

  it('非 A 前綴的結構化 ID(B-12 / HC-1)也支援', () => {
    const content = ['**B-12 會員模組** [🟡 partial]', '- 進行中', '', '**HC-1 健檢修復** [❌ pending]'].join('\n');
    const r = parseTodosMarkers(content);
    expect(r.pendingItems.map((p) => p.id).sort()).toEqual(['B-12', 'HC-1']);
  });

  it('結構化 marker [✅ done] 不收進 pendingItems', () => {
    const r = parseTodosMarkers('**A-11 基礎 SEO** [✅ done]\n- 完工 PR #158');
    expect(r.pendingItems).toHaveLength(0);
  });

  it('結構化 marker [✅ done] 的交付 PR 在後續 bullet → 收進 completionClaim', () => {
    // heading 有 ✅ 無 PR、bullet 有 PR 無 ✅ → 逐行掃會兩邊都漏;改解析整個條目 body
    const r = parseTodosMarkers('**A-11 基礎 SEO** [✅ done] (補充說明)\n- 後續 PR #158 補 builder 測試\n');
    expect(r.completionClaims).toHaveLength(1);
    expect(r.completionClaims[0].prs).toEqual([158]);
  });

  it('### / #### ✅ 完工 heading 的交付 PR 在後續 bullet → 聚合進 completionClaim', () => {
    // 同結構化 marker:`### ✅ 完工` heading 含 token、PR 在 token-less bullet,逐行掃會漏 → 聚合整個 body
    const r = parseTodosMarkers('### ✅ 某功能完工\n- 對應 PR #150 已晉升\n');
    expect(r.completionClaims).toHaveLength(1);
    expect(r.completionClaims[0].prs).toEqual([150]);
  });

  it('### ✅ 區塊的 #### 巢狀子節 PR 仍被聚合(level-aware 邊界)', () => {
    // #### 是 ### 的子節(更深),不算 peer 邊界 → 子節裡的交付 PR 要聚合進來
    const content = ['### ✅ 某大功能完工', '- 概述', '#### 子節 A', '- 交付 PR #150'].join('\n');
    const r = parseTodosMarkers(content);
    expect(r.completionClaims).toHaveLength(1);
    expect(r.completionClaims[0].prs).toEqual([150]);
  });

  it('done 條目 body 內 fenced 的 --- / 結構化 marker 範例不截斷 body', () => {
    // fenced code 內的 `---` / `## ` / 結構化 marker 不該被當區段邊界,否則 fence 後的交付 bullet 被漏
    const content = [
      '**A-11 基礎 SEO** [✅ done]',
      '- 說明',
      '```',
      '---',
      '**A-3 範例** [✅ done]',
      '## 假標題',
      '```',
      '- 交付 PR #158',
    ].join('\n');
    const r = parseTodosMarkers(content);
    expect(r.completionClaims).toHaveLength(1);
    expect(r.completionClaims[0].prs).toEqual([158]);
  });

  it('pending 條目 body 內 fenced code 的 PR / 阻塞詞不算', () => {
    const content = [
      '**A-2 平台升級** [❌ pending]',
      '- 規劃中',
      '```',
      '範例:PR #150 已完成、⏳ 待 Production',
      '```',
    ].join('\n');
    const r = parseTodosMarkers(content);
    const a2 = r.pendingItems.find((p) => p.id === 'A-2')!;
    expect(a2.bodyPrs).toEqual([]); // fenced 內 #150 不算
    expect(a2.hasBlocker).toBe(false); // fenced 內 ⏳/Production 不算
  });

  it('跳過 fenced code block 內的假 marker', () => {
    const content = '```\n- ✅ 完工 PR #9999\n```\n- ✅ 真完工 PR #150';
    const r = parseTodosMarkers(content);
    expect(r.completionClaims).toHaveLength(1);
    expect(r.completionClaims[0].prs).toEqual([150]);
  });
});

describe('checkTodosMarkers', () => {
  const mergedSet = new Set([150, 156, 158]);
  const prExists = (pr: number) => mergedSet.has(pr);

  it('完成宣稱引用未 merged PR → 硬 violation', () => {
    const parsed = parseTodosMarkers('- ✅ 完工(PR #9999)');
    const res = checkTodosMarkers(parsed, prExists);
    expect(res.violations).toHaveLength(1);
    expect(res.violations[0].missingPrs).toEqual([9999]);
  });

  it('完成宣稱引用已 merged PR → 0 violation', () => {
    const parsed = parseTodosMarkers('- ✅ 完工(PR #150)');
    const res = checkTodosMarkers(parsed, prExists);
    expect(res.violations).toHaveLength(0);
    expect(res.verifiedPrs).toBe(1);
    expect(res.totalCompletionPrs).toBe(1);
  });

  it('完工條目多引用、至少一個 merged → 0 violation(容忍 body 順帶引用未合併 follow-up)', () => {
    // #150 已 merged(交付)、#9999 未 merged(順帶提及的相關/未來 PR)→ 不該誤判擋 CI
    const parsed = parseTodosMarkers('### ✅ 某功能完工\n- 交付 PR #150;相關 follow-up PR #9999\n');
    const res = checkTodosMarkers(parsed, prExists);
    expect(res.violations).toHaveLength(0);
  });

  it('完工條目引用的 PR 全都未 merged → violation(至少一個語義仍擋純假 claim)', () => {
    const parsed = parseTodosMarkers('### ✅ 某功能完工\n- 交付 PR #9998、PR #9999\n');
    const res = checkTodosMarkers(parsed, prExists);
    expect(res.violations).toHaveLength(1);
  });

  it('pending 結構化 marker body 內的子完工 bullet 仍被 line-scan gate(不被 consumed 吞)', () => {
    // pending 區塊不 markConsumed → body 裡含完成 token 的子 bullet 仍由 line-scan 產生 claim
    const parsed = parseTodosMarkers('**A-8 Ops** [🟡 partial]\n- 子項完工 PR #9999\n');
    const res = checkTodosMarkers(parsed, prExists);
    expect(res.violations).toHaveLength(1); // #9999 未 merged
  });

  it('巢狀 #### ✅(自帶完成 token)是獨立 claim,未合併 PR 不被父的 merged PR 遮蔽', () => {
    const content = ['### ✅ 父功能完工', '- 交付 PR #150', '#### ✅ 子功能完工', '- 交付 PR #9999'].join('\n');
    const parsed = parseTodosMarkers(content);
    expect(parsed.completionClaims).toHaveLength(2); // 父 + 巢狀子各一條
    const res = checkTodosMarkers(parsed, prExists);
    expect(res.violations).toHaveLength(1); // 子功能的 #9999 未 merged → 自己一條 violation
  });

  it('done 區塊內 inline 含 token 的子完工 bullet 是獨立 claim,未合併 PR 不被父遮蔽', () => {
    // `- ✅ 子完工 PR #9999` 自帶 token → 不併父、不 consume → line-scan 獨立驗;父 [150] 不遮蔽它
    const content = ['### ✅ 父功能完工', '- 交付 PR #150', '- ✅ 子模組完工 PR #9999'].join('\n');
    const parsed = parseTodosMarkers(content);
    const res = checkTodosMarkers(parsed, prExists);
    expect(res.violations).toHaveLength(1); // #9999 未 merged → 子 bullet 自己一條 violation
  });

  it('pending 條目引用 merged PR 且無阻塞詞 → 軟 advisory(stale-done 疑慮)', () => {
    const parsed = parseTodosMarkers('**A-9 進階功能** [🟡 partial]\n- 已用 PR #156 接線完成,可上線');
    const res = checkTodosMarkers(parsed, prExists);
    expect(res.advisories).toHaveLength(1);
    expect(res.advisories[0].id).toBe('A-9');
    expect(res.advisories[0].mergedPrs).toEqual([156]);
  });

  it('pending 條目引用 merged PR 但有阻塞詞 → 不 advisory(合理 partial)', () => {
    const parsed = parseTodosMarkers('**A-8 Ops** [🟡 partial]\n- dev PR #156 已接線,⏳ 剩 Production 7 天驗證');
    const res = checkTodosMarkers(parsed, prExists);
    expect(res.advisories).toHaveLength(0);
  });

  it('pending 條目引用 merged PR 但含「待拍板」→ hasBlocker 且不 advisory(等 Owner 決策)', () => {
    const parsed = parseTodosMarkers('**A-7 分級方案** [🟡 partial]\n- 基礎版 PR #156 已 merge,待拍板要不要做完整版');
    expect(parsed.pendingItems.find((p) => p.id === 'A-7')!.hasBlocker).toBe(true);
    const res = checkTodosMarkers(parsed, prExists);
    expect(res.advisories).toHaveLength(0);
  });

  it('pending 條目引用未 merged PR → 不 advisory(未 merge 本就不算 stale-done)', () => {
    const parsed = parseTodosMarkers('**A-2 平台升級** [❌ pending]\n- 規劃中 PR #9999');
    const res = checkTodosMarkers(parsed, prExists);
    expect(res.advisories).toHaveLength(0);
  });
});

// ───────────────────────────────────────── 批 10:acknowledgeSelfPr(MARKER_SELF_PR env 讀取)
//
// 契約對稱 check-no-source-terms.ts:loadAllowedPrs L411 的守——同一 MARKER_SELF_PR
// env、兩 script 讀,兩處驗證要一致。批 9 Step 5 F-round23-5(conf 4)發現原本
// check-todos-markers L424 只有 `Number.isInteger && > 0` 沒 `< 1e9` 上限、
// 兩處不對稱。批 10 修法把驗證抽 pure fn 出來、單一入口 SSOT。

describe('acknowledgeSelfPr — MARKER_SELF_PR env 讀取(批 10)', () => {
  it('合法正整數 → 回傳該值', () => {
    expect(acknowledgeSelfPr('42')).toBe(42);
    expect(acknowledgeSelfPr('1')).toBe(1);
    expect(acknowledgeSelfPr('999999999')).toBe(999999999); // 1e9 - 1、剛好過
  });

  it('undefined(env 未設)→ null', () => {
    expect(acknowledgeSelfPr(undefined)).toBe(null);
  });

  it('空字串(non-PR event 展開)→ null', () => {
    // Number("") === 0、`> 0` 擋。GitHub Actions non-PR event
    // `github.event.pull_request.number` 展開為空字串的預期行為
    expect(acknowledgeSelfPr('')).toBe(null);
  });

  it('非數字(NaN)→ null', () => {
    expect(acknowledgeSelfPr('abc')).toBe(null);
    expect(acknowledgeSelfPr('foo123')).toBe(null);
  });

  it('負值 / 零 → null', () => {
    expect(acknowledgeSelfPr('-1')).toBe(null);
    expect(acknowledgeSelfPr('0')).toBe(null);
  });

  it('浮點 → null(Number.isInteger 擋)', () => {
    expect(acknowledgeSelfPr('1.5')).toBe(null);
    expect(acknowledgeSelfPr('42.0')).toBe(42); // 42.0 是 integer(Number.isInteger 認)
  });

  it('🔴 批 10 F-round23-5 修法:≥ 1e9 上限守 → null', () => {
    // 若 mutation 拿掉 `< 1e9`(恢復 pre-batch-10 行為),此 case 會轉紅
    expect(acknowledgeSelfPr('1000000000')).toBe(null); // = 1e9 精確邊界
    expect(acknowledgeSelfPr('9999999999')).toBe(null); // 遠超上限
  });
});

// ───────────────────────────────────────── 批 10 P2-2:CLI 接線 e2e
//
// 批 5 教訓「call site 必須另守」——純函式 acknowledgeSelfPr 測 7 case 全綠,
// 但若刪掉 main() 內 `merged.add(selfPr)` 那行、pure fn 測試照樣通過。
// 加 disposable-repo e2e 直接跑 check-todos-markers CLI、驗 self-PR 引用完工
// 宣稱過 gate,守 call site 接線。

function makeRepo(opts: {
  todosContent: string;
  /** 額外要 commit 的檔案(如生 delivery merged commit fixture) */
  extraCommits?: Array<{ message: string; files?: Record<string, string> }>;
  /** P2#2:預設寫 harness.config.json(deliveryBranches ['main'])+ 建 bare origin + set-head main;noOrigin 只給負對照 */
  noOrigin?: boolean;
  deliveryBranches?: string[];
}): string {
  const wrap = mkdtempSync(join(tmpdir(), 'ctm-e2e-'));
  created.push(wrap);
  const dir = join(wrap, 'repo');
  mkdirSync(dir, { recursive: true });
  const git = (...a: string[]) =>
    execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  writeFileSync(join(dir, 'TODOS.md'), opts.todosContent, 'utf-8');
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'scripts/harness.config.json'), harnessConfigJson(opts.deliveryBranches ?? ['main']) + '\n', 'utf-8');
  git('add', '-A');
  git('commit', '-qm', 'init: TODOS.md');
  for (const c of opts.extraCommits ?? []) {
    if (c.files) {
      for (const [rel, body] of Object.entries(c.files)) {
        writeFileSync(join(dir, rel), body, 'utf-8');
      }
      git('add', '-A');
      git('commit', '-qm', c.message);
    } else {
      git('commit', '--allow-empty', '-qm', c.message);
    }
  }
  if (!opts.noOrigin) {
    const originDir = join(wrap, 'origin.git');
    execFileSync('git', ['init', '--bare', '-q', originDir], { stdio: 'ignore' });
    git('remote', 'add', 'origin', originDir);
    git('push', '-q', 'origin', 'main:refs/heads/main');
    git('fetch', '-q', 'origin');
    git('remote', 'set-head', 'origin', 'main');
  }
  return dir;
}

function harnessConfigJson(deliveryBranches: readonly string[]): string {
  // P2#2:交付 ref 契約讀 harness.config.json 的 deliveryBranches(靜態宣告);fixture 預設只宣告 main
  return JSON.stringify({
    schemaVersion: 2,
    mode: 'template',
    projectId: '__TEMPLATE__',
    templatePackageName: 'harness-controlled-dev-environment',
    // loader 要求 deliveryBranches ⊆ protectedBranches
    protectedBranches: [...deliveryBranches],
    deliveryBranches: [...deliveryBranches],
    requiredAgentAdapters: ['claude'],
    githubGovernanceRequired: false,
    mergeStrategy: 'squash',
  });
}

function runChecker(cwd: string, envOverride?: Record<string, string>): { code: number; out: string } {
  // 從 parent env 移除 MARKER_SELF_PR 與(已移除、腳本不再讀的)DELIVERY_REFS,避免宿主 CI 洩漏污染
  const baseEnv: NodeJS.ProcessEnv = { ...process.env };
  delete baseEnv.DELIVERY_REFS;
  delete baseEnv.MARKER_SELF_PR;
  try {
    const out = execFileSync(TSX_BIN, [SCRIPT], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...baseEnv, ...(envOverride ?? {}) },
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('check-todos-markers — 端到端(CLI 接線)', () => {
  it('🔴 批 10 P2-2:MARKER_SELF_PR call site 接線 → self-PR 引用完工宣稱過 gate', () => {
    // fixture:TODOS.md 完工宣稱引用 #42(self-PR 尚未 merge、delivery 史無 #42)
    // envOverride MARKER_SELF_PR=42 → acknowledgeSelfPr 回 42 → main() call site
    // 呼叫 merged.add(42) → prExists(42) = true → 完工宣稱過 gate。
    // 若 mutation 刪 call site (`if (selfPr !== null) merged.add(selfPr)` 該行),
    // 純函式測試照樣綠、但此 e2e 轉紅——守 call site 接線
    const dir = makeRepo({
      todosContent: '# TODOS\n\n## P3\n\n### ✅ some completion (#42)\n- done\n',
    });
    const { code, out } = runChecker(dir, { MARKER_SELF_PR: '42' });
    expect(out).toContain('1 個 PR');
    expect(out).toContain('1 個有 merge 證據');
    expect(code).toBe(0);
  });

  it('🔴 P2#2 正對照:origin/HEAD=main 含 (#42) → 完工宣稱過', () => {
    const dir = makeRepo({
      todosContent: '# TODOS\n\n## P3\n\n### ✅ some completion (#42)\n- done\n',
      extraCommits: [{ message: 'feat: x (#42)' }],
    });
    expect(runChecker(dir).code).toBe(0);
  });

  it('🟢 P2#2 defer ⑤:本地 tag `origin/main` 存在時 checker 仍通過(名字空間 collision regression)', () => {
    // 舊契約(canonicality check via short-name lookup):本地 tag origin/main 讓短名 lookup
    // ambiguous、canon !== fullRef → base.noncanonical → 兩 gate 對所有 PR fail-closed exit 2。
    // 新契約:canonicality check 已移除、完整 ref existence check 已足;tag 不影響 checker 結果。
    const dir = makeRepo({
      todosContent: '# TODOS\n\n## P3\n\n### ✅ some completion (#42)\n- done\n',
      extraCommits: [{ message: 'feat: x (#42)' }],
    });
    execFileSync('git', ['tag', 'origin/main'], { cwd: dir, stdio: 'ignore' });
    const { code, out } = runChecker(dir);
    expect(code).toBe(0);
    expect(out).toContain('✅ 0 個失效完成宣稱');
    expect(out).not.toContain('[base.');
  });

  it('🔴 env 已移除:DELIVERY_REFS 指向含未合併 (#42) 的 origin 分支 / 垃圾值 → 輸出與 exit 與不設 env 逐位元相同(#42 仍無證據、exit 1)', () => {
    const dir = makeRepo({
      todosContent: '# TODOS\n\n## P3\n\n### ✅ some completion (#42)\n- done\n',
      deliveryBranches: ['main', 'feature/x'],
    });
    const git = (...a: string[]) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
    git('checkout', '-q', '-b', 'feature/x');
    git('commit', '--allow-empty', '-qm', 'feat: x (#42)');
    git('push', '-q', 'origin', 'feature/x:refs/heads/feature/x');
    git('checkout', '-q', 'main');
    git('fetch', '-q', 'origin');
    const plain = runChecker(dir);
    expect(plain.code).toBe(1);
    for (const v of ['origin/feature/x', 'HEAD', 'feature/x', ';pwd']) {
      const r = runChecker(dir, { DELIVERY_REFS: v });
      expect(r.code, v).toBe(plain.code);
      expect(r.out, v).toBe(plain.out);
    }
  });

  it('🔴 P2#2 base.undeclared:origin/HEAD 指向可解、未宣告分支 → exit 2、不放行', () => {
    const dir = makeRepo({
      todosContent: '# TODOS\n\n## P3\n\n### ✅ some completion (#42)\n- done\n',
      extraCommits: [{ message: 'feat: x (#42)' }],
      deliveryBranches: ['trunk'],
    });
    const { code, out } = runChecker(dir);
    expect(code).toBe(2);
    expect(out).toContain('[base.undeclared] refs/remotes/origin/main');
  });

  it('🔴 P2#2 base.missing:noOrigin(無 origin remote)→ exit 2(本地 main fallback 已移除)', () => {
    const dir = makeRepo({
      todosContent: '# TODOS\n\n## P3\n\n### ✅ some completion (#42)\n- done\n',
      extraCommits: [{ message: 'feat: x (#42)' }],
      noOrigin: true,
    });
    const { code, out } = runChecker(dir);
    expect(code).toBe(2);
    expect(out).toContain('[base.missing]');
  });

  it('🔴 批 10 P2-2 反例:MARKER_SELF_PR 未設 → self-PR 引用被擋(未 merge 證據)', () => {
    // 同 fixture、無 envOverride(MARKER_SELF_PR baseEnv strip 掉)、
    // delivery 史無 #42 → prExists(42) = false → 完工宣稱擋 → exit 1。
    // 這條驗證「acknowledgeSelfPr 通道確實影響 gate」(反向 assertion)
    const dir = makeRepo({
      todosContent: '# TODOS\n\n## P3\n\n### ✅ some completion (#42)\n- done\n',
    });
    const { code, out } = runChecker(dir);
    // makeRepo 預設建 origin + set-head main;受驗 origin/HEAD 合格但 log 內無 (#42)
    // → merged set 空 → 有 completionClaim 但 merged.size = 0 → 走 fail-hard
    // 路徑(script L437-439)、exit 1。若 MARKER_SELF_PR call site 破損、
    // 就算 env 傳 42 也不會進 merged set,同樣走 fail-hard。此 case 驗
    // 「無 self-PR 通道時 completion claim 被擋」的 baseline
    expect(out).toContain('無法從 git 史建立 merged PR 集合');
    expect(code).toBe(1);
  });
});
