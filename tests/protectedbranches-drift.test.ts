// tests/protectedbranches-drift.test.ts — 純函式 unit(A3 defer ⑩ drift gate lib)
//
// 覆蓋:集合相同 / 擴大 / 縮小 / 重排 / 空 / 重複去重 / 型別邊界

import { describe, expect, it } from "vitest";
import { diffProtectedBranches } from "../scripts/lib/protectedbranches-drift";

describe("diffProtectedBranches", () => {
  it("#1 集合相同 → added / removed 皆空", () => {
    const r = diffProtectedBranches(["main", "develop"], ["main", "develop"]);
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual([]);
  });

  it("#2 擴大 1 → added 有 1、removed 空", () => {
    const r = diffProtectedBranches(["main"], ["main", "release"]);
    expect(r.added).toEqual(["release"]);
    expect(r.removed).toEqual([]);
  });

  it("#3 擴大多 → added 排序", () => {
    const r = diffProtectedBranches(["main"], ["release", "main", "beta"]);
    expect(r.added).toEqual(["beta", "release"]);
    expect(r.removed).toEqual([]);
  });

  it("#4 縮小 → removed 有、added 空(縮權允許)", () => {
    const r = diffProtectedBranches(["main", "develop"], ["main"]);
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual(["develop"]);
  });

  it("#5 重排(順序改、內容不變)→ 兩側皆空", () => {
    const r = diffProtectedBranches(["main", "develop"], ["develop", "main"]);
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual([]);
  });

  it("#6 同時 added + removed", () => {
    const r = diffProtectedBranches(["main", "develop"], ["main", "release"]);
    expect(r.added).toEqual(["release"]);
    expect(r.removed).toEqual(["develop"]);
  });

  it("#7 base 空 → head 全數 added", () => {
    const r = diffProtectedBranches([], ["main", "release"]);
    expect(r.added).toEqual(["main", "release"]);
    expect(r.removed).toEqual([]);
  });

  it("#8 head 空 → base 全數 removed", () => {
    const r = diffProtectedBranches(["main", "develop"], []);
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual(["develop", "main"]);
  });

  it("#9 兩側都空 → 兩側皆空", () => {
    const r = diffProtectedBranches([], []);
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual([]);
  });

  it("#10 重複元素 → Set 去重、順序不影響", () => {
    const r = diffProtectedBranches(["main", "main"], ["main", "main", "release"]);
    expect(r.added).toEqual(["release"]);
    expect(r.removed).toEqual([]);
  });
});
