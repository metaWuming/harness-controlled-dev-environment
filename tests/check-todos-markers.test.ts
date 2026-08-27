// Tests for scripts/check-todos-markers.ts(TODOS marker 治理 checker)
//
// 驗 pure functions:
//   - extractPrCitations:PR 號抽取、去重、單位數不算、URL 形式
//   - parseTodosMarkers:完成宣稱行 / 結構化 marker pending 條目 / fenced code 跳過
//   - checkTodosMarkers:硬 violation(完成宣稱引用未 merged PR)+ 軟 advisory(pending 引 merged PR 無阻塞詞)

import { describe, expect, it } from 'vitest';
import {
  extractPrCitations,
  parseTodosMarkers,
  checkTodosMarkers,
} from '../scripts/check-todos-markers';

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
