// @vitest-environment node
//
// `scripts/mutate.ts` 的守門測試。
//
// 🔴 為什麼一定要有端到端那幾條:**exit-code 型的守門腳本必須有「健康時真的
//    exit 0」的正對照測試**——缺正對照的守門會靜靜失效很久,沒有任何徵兆。
//
// 🔴 為什麼被測物要搬進拋棄式 git repo:假綠圖鑑第 ⑦ 種「環境被 mutation 污染」——
//    這支工具會改檔、跑指令、還原,如果對真 repo 跑,它的輸入就是它自己,測試會互相污染。
//    臨時 repo 讓「乾淨工作樹／髒工作樹／指令綠／指令紅／還原失敗」都由測試自己決定。
//
// 🔴 例外路徑(訊號、還原失敗、路徑逃逸、基礎設施錯誤)為什麼各自有一條:
//    Codex 跨模型 review 逐條在拋棄式 repo 重現了四個 P1,共同形狀是
//    **「工具在非快樂路徑上默默違反自己的安全契約」**。快樂路徑全綠證明不了那些。

import { execFileSync, spawn } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
  symlinkSync,
  statSync,
  chmodSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyMutation,
  classify,
  classifyRun,
  formatSummary,
  isGitInternal,
  isInsideRepo,
  isUtf8Text,
  parseIndexFlags,
  looksLikeTurboCache,
  turboLineIsCacheHit,
  createLineScanner,
  verifyContent,
  writeCheckedSync,
  shouldRestoreAfterWriteFailure,
  parseArgs,
  parseSpecs,
  parseTreeState,
  type MutationResult,
  type MutationSpec,
} from "../scripts/mutate";

const SCRIPT = join(
  execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf-8" }).trim(),
  "scripts/mutate.ts",
);

const created: string[] = [];
afterEach(() => {
  while (created.length) rmSync(created.pop()!, { recursive: true, force: true });
});

const spec = (o: Partial<MutationSpec> = {}): MutationSpec => ({
  file: "src/a.txt",
  find: "GUARD_ON",
  replace: "GUARD_OFF",
  label: "拿掉守衛應該讓測試轉紅",
  ...o,
});

// ───────────────────────────────────────── 閘① 乾淨工作樹

describe("mutate 閘① — 乾淨工作樹", () => {
  it("porcelain 空 → 乾淨", () => {
    expect(parseTreeState("").clean).toBe(true);
    expect(parseTreeState("\n\n").clean).toBe(true);
  });

  it("有任何一筆(含 untracked)→ 不乾淨,且把是哪些檔列出來", () => {
    const t = parseTreeState(" M src/x.ts\n?? scratch.md\n");
    expect(t.clean).toBe(false);
    expect(t.entries).toHaveLength(2);
    expect(t.entries[1]).toContain("scratch.md");
  });
});

// ───────────────────────────────────────── 目標路徑的安全契約

describe("mutate — 目標路徑的安全契約(閘① 只保護 git 工作樹之內)", () => {
  it("🔴 isInsideRepo:repo 內 true;`..` 逃逸 false;等於 root 本身 false", () => {
    expect(isInsideRepo("/repo", "/repo/src/a.ts")).toBe(true);
    expect(isInsideRepo("/repo", "/outside.txt")).toBe(false);
    expect(isInsideRepo("/repo", "/repo")).toBe(false);
    // 前綴相同但不是同一個目錄——路徑比對最常見的 off-by-one
    expect(isInsideRepo("/repo", "/repo-evil/a.ts")).toBe(false);
  });

  it("🔴 isGitInternal:`.git` 與其底下 true,其餘 false", () => {
    expect(isGitInternal("/repo", "/repo/.git")).toBe(true);
    expect(isGitInternal("/repo", "/repo/.git/config")).toBe(true);
    expect(isGitInternal("/repo", "/repo/.github/x.yml")).toBe(false);
    expect(isGitInternal("/repo", "/repo/src/a.ts")).toBe(false);
  });

  it("🔴 isUtf8Text:純文字 true;含 NUL false;非法 UTF-8 byte 序列 false", () => {
    expect(isUtf8Text(Buffer.from("GUARD_ON\n中文也算", "utf-8"))).toBe(true);
    expect(isUtf8Text(Buffer.from([0x47, 0x00, 0x41]))).toBe(false);
    expect(isUtf8Text(Buffer.from([0xff, 0xfe, 0x41]))).toBe(false);
  });

  // 🔴 `--untracked-files=all` 只解決「未追蹤檔看不見」。被 index flag 標記的
  //    tracked 檔,它的修改根本不會出現在 `git status`——閘① 會謊報乾淨。
  it("🔴 parseIndexFlags:小寫 tag(assume-unchanged)與 S(skip-worktree)都要挑出來", () => {
    const out = "H src/ok.ts\nh src/hidden.ts\nS src/skipped.ts\nH src/also-ok.ts\n";
    const flagged = parseIndexFlags(out);
    expect(flagged).toHaveLength(2);
    expect(flagged[0]).toContain("src/hidden.ts");
    expect(flagged[1]).toContain("src/skipped.ts");
  });

  it("正對照:全部都是 H → 沒有被藏起來的檔", () => {
    expect(parseIndexFlags("H a.ts\nH b.ts\n")).toHaveLength(0);
  });
});

// ───────────────────────────────────────── 寫入後的內容驗證

describe("mutate — verifyContent(短寫／截斷的最後一道 backstop)", () => {
  // 🔴 要真的觸發短寫得做 fault injection,但比對邏輯本身可以直接單測。
  //    首次自驗:這條原本沒有任何測試守著,mutant 存活。
  const tmpFile = (body: string | Buffer) => {
    const dir = mkdtempSync(join(tmpdir(), "verify-content-"));
    created.push(dir);
    const abs = join(dir, "f.txt");
    writeFileSync(abs, body);
    return abs;
  };

  it("正對照:內容一致 → null", () => {
    const abs = tmpFile("GUARD_ON\n");
    expect(verifyContent(abs, Buffer.from("GUARD_ON\n", "utf-8"))).toBeNull();
  });

  it("🔴 被截斷(短寫的形狀)→ 回報不一致,並帶上兩邊的長度", () => {
    const abs = tmpFile("GUARD");
    const msg = verifyContent(abs, Buffer.from("GUARD_ON\n", "utf-8"));
    expect(msg).not.toBeNull();
    expect(msg).toContain("9 bytes");
    expect(msg).toContain("5 bytes");
  });

  it("🔴 長度相同但 bytes 不同 → 也要抓到(不能只比長度)", () => {
    const abs = tmpFile("GUARD_OFF");
    expect(verifyContent(abs, Buffer.from("GUARD_ONX", "utf-8"))).not.toBeNull();
  });
});

// ───────────────────────────────────────── 寫入本身的安全契約

describe("mutate — writeCheckedSync(inode／現值／權限)", () => {
  const tmpFile = (body: string) => {
    const dir = mkdtempSync(join(tmpdir(), "write-checked-"));
    created.push(dir);
    const abs = join(dir, "f.txt");
    writeFileSync(abs, body);
    return abs;
  };
  const ident = (abs: string) => {
    const st = statSync(abs);
    return { dev: st.dev, ino: st.ino, mode: st.mode & 0o7777 };
  };

  it("正對照:inode 對得上 → 寫進去", () => {
    const abs = tmpFile("GUARD_ON\n");
    expect(writeCheckedSync(abs, Buffer.from("GUARD_OFF\n"), ident(abs))).toEqual({ error: null, wrote: true });
    expect(readFileSync(abs, "utf-8")).toBe("GUARD_OFF\n");
  });

  it("🔴 inode 對不上 → 拒寫(目標被掉包)", () => {
    const abs = tmpFile("GUARD_ON\n");
    const bogus = { ...ident(abs), ino: ident(abs).ino + 1 };
    const r = writeCheckedSync(abs, Buffer.from("X"), bogus);
    expect(r.error).toContain("inode 不同");
    // 🔴 前置條件擋下來 → 磁碟原封不動。呼叫端靠這個旗標決定「不要 restore」,
    //    否則會拿舊的 original 蓋掉別人剛寫進去的東西(Codex round 6 P1)
    expect(r.wrote).toBe(false);
    expect(readFileSync(abs, "utf-8")).toBe("GUARD_ON\n");
  });

  // 🔴 Codex round 5 P2:inode 沒變不代表內容沒變——別的程序可以**原地**改它。
  it("🔴 動手前現值跟預期不符 → 拒寫(不要吃掉人家剛寫進去的東西)", () => {
    const abs = tmpFile("SOMEONE_ELSE_WROTE_THIS\n");
    const err = writeCheckedSync(abs, Buffer.from("X"), ident(abs), Buffer.from("GUARD_ON\n"));
    expect(err.error).toContain("拒絕覆蓋");
    expect(err.wrote).toBe(false);
    expect(readFileSync(abs, "utf-8")).toBe("SOMEONE_ELSE_WROTE_THIS\n");
  });

  it("正對照:現值符合預期 → 照寫", () => {
    const abs = tmpFile("GUARD_ON\n");
    expect(writeCheckedSync(abs, Buffer.from("X"), ident(abs), Buffer.from("GUARD_ON\n")).error).toBeNull();
  });

  // 🔴 Codex round 5 P1:git **不追蹤一般 permission bits**,treeDirt 看不見 chmod,
  //    所以權限得自己記、自己還原。E2E 觀測不到(對照會再跑一次同一個指令)。
  // 🔴 這條規則決定「工具會不會反過來毀掉資料」,但那個競態沒辦法從測試端觸發
  //    (要另一個程序卡在我們兩次系統呼叫之間),所以降到純函式上驗。
  it("🔴 前置條件擋下(wrote=false)→ **不可**還原:磁碟原封不動,還原只會蓋掉別人的東西", () => {
    expect(shouldRestoreAfterWriteFailure({ error: "inode 不同", wrote: false })).toBe(false);
  });

  it("寫到一半失敗(wrote=true)→ 要還原", () => {
    expect(shouldRestoreAfterWriteFailure({ error: "寫入中斷", wrote: true })).toBe(true);
  });

  it("🔴 權限被改過 → 寫回時一併還原成原本的 mode", () => {
    const abs = tmpFile("GUARD_ON\n");
    const want = ident(abs);
    chmodSync(abs, 0o600);
    expect(statSync(abs).mode & 0o7777).toBe(0o600);
    expect(writeCheckedSync(abs, Buffer.from("GUARD_ON\n"), want).error).toBeNull();
    expect(statSync(abs).mode & 0o7777).toBe(want.mode);
  });
});

// ───────────────────────────────────────── 閘② 樣本真的套用

describe("mutate 閘② — 樣本真的套用(三種靜默 no-op)", () => {
  it("🔴 樣本找不到 → 不 ok(「以為驗過其實沒改到」的形狀)", () => {
    const r = applyMutation("hello world", spec({ find: "NOPE" }));
    expect(r.ok).toBe(false);
    expect(r.occurrences).toBe(0);
    expect(r.reason).toContain("找不到");
  });

  // 🔴 斷言要對到**這道守衛自己的訊息**,不能只寫 `toContain("相同")`:
  //    後面那道 backstop 的訊息是「替換後內容與原文相同」,也含「相同」二字,
  //    於是拿掉這道守衛時測試照樣綠。首次自驗被 mutate 抓到的真缺口。
  it("find === replace → 不 ok(這條 mutation 什麼都沒改)", () => {
    const r = applyMutation("GUARD_ON", spec({ replace: "GUARD_ON" }));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("find 與 replace 相同");
  });

  it("find 是空字串 → 不 ok", () => {
    expect(applyMutation("anything", spec({ find: "" })).ok).toBe(false);
  });

  it("樣本出現多處而未指定 all → 拒跑(改多處會讓「為什麼紅」對不上)", () => {
    const r = applyMutation("GUARD_ON / GUARD_ON", spec());
    expect(r.ok).toBe(false);
    expect(r.occurrences).toBe(2);
    expect(r.reason).toContain("2 處");
  });

  it("多處 + all → 全換", () => {
    const r = applyMutation("GUARD_ON / GUARD_ON", spec({ all: true }));
    expect(r.ok).toBe(true);
    expect(r.output).toBe("GUARD_OFF / GUARD_OFF");
    expect(r.occurrences).toBe(2);
  });

  it("正對照:剛好一處 → 換掉那一處", () => {
    const r = applyMutation("a GUARD_ON b", spec());
    expect(r.ok).toBe(true);
    expect(r.output).toBe("a GUARD_OFF b");
  });
});

// ───────────────────────────────────────── 驗證指令的收場分類

describe("mutate — 驗證指令的收場分類(紅 vs 壞掉)", () => {
  it("正對照:exit 0 → green", () => {
    expect(classifyRun(0, null).outcome).toBe("green");
  });

  it("非 0 但 <128 的數字 exit code → red(這才是「測試轉紅」)", () => {
    expect(classifyRun(1, null).outcome).toBe("red");
    expect(classifyRun(127, null).outcome).toBe("red");
  });

  // 🔴 Codex review round 1 P1:我們監看的是 `bash -c`,真正的 test 程序在它裡面跑。
  //    子程序被 SIGKILL / OOM 殺掉時,bash 通常**正常退出**並回傳 128+signum
  //    (shell 慣例:SIGKILL→137、SIGTERM→143)。這條路徑上 `signal` 永遠是 null
  //    (bash 自己沒被砍),舊版把 137/143 當成「測試轉紅」→ mutant 被錯報成 killed
  //    → 工具 exit 0 宣稱「全部被抓到」。
  //
  // 🔴 Codex review round 2 P2:縮到只認 137/143,其他 128-255 恢復當 red——
  //    `exit 200`/`exit 255` 都是使用者可能用的自訂 fail code,不該被誤判 infra。
  it("🔴 137 (SIGKILL / OOM) 與 143 (SIGTERM) → infra(bash 子程序被砍的常見退出碼)", () => {
    expect(classifyRun(137, null).outcome).toBe("infra");
    expect(classifyRun(143, null).outcome).toBe("infra");
    expect(classifyRun(137, null).detail).toContain("SIGKILL");
    expect(classifyRun(143, null).detail).toContain("SIGTERM");
  });

  it("🔴 其他 128-255 exit code 仍歸 red(使用者可用 200/255 當自訂 test 失敗碼)", () => {
    expect(classifyRun(128, null).outcome).toBe("red"); // SIGHUP - 罕見
    expect(classifyRun(130, null).outcome).toBe("red"); // SIGINT - CI 罕用
    expect(classifyRun(200, null).outcome).toBe("red"); // 使用者自訂
    expect(classifyRun(255, null).outcome).toBe("red"); // 使用者自訂
  });

  it("🔴 spawn 失敗 → infra,不是 red(舊版把它當成「測試抓到了」)", () => {
    const c = classifyRun(null, null, { code: "ENOENT", message: "bash not found" });
    expect(c.outcome).toBe("infra");
    expect(c.detail).toContain("不是");
  });

  it("🔴 被訊號砍掉 → infra(OOM／SIGKILL 不代表測試轉紅)", () => {
    const c = classifyRun(null, "SIGKILL");
    expect(c.outcome).toBe("infra");
    expect(c.detail).toContain("SIGKILL");
  });

  it("🔴 沒有 exit code → infra", () => {
    expect(classifyRun(null, null).outcome).toBe("infra");
  });
});

// ───────────────────────────────────────── 閘③ 對照優先

describe("mutate 閘③ — 判定表(對照優先)", () => {
  it("🔴 對照紅 → 一律無法判定(不管 mutant 是紅是綠)", () => {
    expect(classify({ controlOk: false, mutantOk: false }).verdict).toBe("inconclusive");
    expect(classify({ controlOk: false, mutantOk: true }).verdict).toBe("inconclusive");
    expect(classify({ controlOk: false, mutantOk: false }).reason).toContain("對照");
  });

  it("對照綠 + mutant 紅 → killed(測試抓到了)", () => {
    expect(classify({ controlOk: true, mutantOk: false }).verdict).toBe("killed");
  });

  it("對照綠 + mutant 綠 → survived(覆蓋缺口)", () => {
    const c = classify({ controlOk: true, mutantOk: true });
    expect(c.verdict).toBe("survived");
    expect(c.reason).toContain("沒有測試守著");
  });
});

// ───────────────────────────────────────── 假綠:turbo 快取

describe("mutate — turbo 快取偵測", () => {
  // turbo 2.10.8 的真實收尾摘要(實測抄下來的,不是憑印象寫的)
  const TURBO_FULL = " Tasks:    2 successful, 2 total\nCached:    2 cached, 2 total\n  Time:    9ms >>> FULL TURBO\n";
  const TURBO_PARTIAL = " Tasks:    2 successful, 2 total\nCached:    1 cached, 2 total\n  Time:    1.2s\n";
  const TURBO_FRESH = " Tasks:    2 successful, 2 total\nCached:    0 cached, 2 total\n  Time:    2.1s\n";

  it("全快取(Time 行帶 >>> FULL TURBO)→ 判為快取", () => {
    expect(looksLikeTurboCache(TURBO_FULL)).toBe(true);
  });

  it("部分快取(Cached: 1 cached)→ 也算——被快取的那個 task 根本沒跑", () => {
    expect(looksLikeTurboCache(TURBO_PARTIAL)).toBe(true);
  });

  it("正對照:0 cached → 真的跑了,不是快取", () => {
    expect(looksLikeTurboCache(TURBO_FRESH)).toBe(false);
  });

  it("正常 vitest 輸出 → 不是快取", () => {
    expect(looksLikeTurboCache("Tests  930 passed (930)\nDuration 7.98s")).toBe(false);
  });

  // 🔴 首次自驗被自己咬到的那口:舊版 `/FULL TURBO/i` 太寬,vitest 印出的
  //    **測試名稱**裡有那四個字就被誤判成快取命中,好好的一條 killed 被降級成
  //    「無法判定」。偵測器的輸入被被測物污染。
  it("🔴 輸出裡只是「提到」FULL TURBO(例如失敗測試的名稱)→ 不得誤判", () => {
    expect(looksLikeTurboCache("× 輸出含 FULL TURBO → 判為快取(那個綠什麼都沒證明)")).toBe(false);
    expect(looksLikeTurboCache('expect(looksLikeTurboCache(">>> FULL TURBO")).toBe(true)')).toBe(false);
  });

  // 串流用的逐行原語——runCommand 靠它跨 chunk 記住「命中過」,
  // 否則摘要後面再噴幾 MB 就會把證據沖掉(Codex round 2 P2)
  // 🔴 「記憶體有界」是資源不變量——光看工具的 exit code 永遠觀測不到,
  //    所以把它降到 createLineScanner 這個能直接斷言 carryLength 的單元上。
  //    (首次自驗:這條原本沒有任何測試守著,mutant 存活。)
  it("🔴 carry 有上限:完全沒有換行的 1 MB 輸入不得把緩衝撐大", () => {
    const sc = createLineScanner(1024);
    for (let i = 0; i < 16; i++) sc.push("x".repeat(64 * 1024));
    expect(sc.carryLength).toBeLessThanOrEqual(1024);
    expect(sc.push("")).toBe(false);
  });

  it("正對照:命中就永久記住,之後再吐多少東西都不會被沖掉", () => {
    const sc = createLineScanner(1024);
    expect(sc.push("Cached:    1 cached, 2 total\n")).toBe(true);
    sc.push("y".repeat(200_000));
    expect(sc.finish()).toBe(true);
  });

  it("摘要行被切成兩個 chunk 也要認得", () => {
    const sc = createLineScanner();
    expect(sc.push("Cached:    1 ca")).toBe(false);
    expect(sc.push("ched, 2 total\n")).toBe(true);
  });

  it("最後一行沒有換行 → finish() 要補判一次", () => {
    const sc = createLineScanner();
    expect(sc.push("  Time:    9ms >>> FULL TURBO")).toBe(false);
    expect(sc.finish()).toBe(true);
  });

  it("正對照:只是雜訊 → 從頭到尾都不命中", () => {
    const sc = createLineScanner();
    sc.push("Tests  930 passed (930)\nDuration 7.98s\n");
    expect(sc.finish()).toBe(false);
  });

  it("turboLineIsCacheHit:逐行判定與整段判定一致", () => {
    expect(turboLineIsCacheHit("  Time:    9ms >>> FULL TURBO")).toBe(true);
    expect(turboLineIsCacheHit("Cached:    1 cached, 2 total")).toBe(true);
    expect(turboLineIsCacheHit("Cached:    0 cached, 2 total")).toBe(false);
    expect(turboLineIsCacheHit("× 測試名稱裡有 FULL TURBO")).toBe(false);
  });
});

// ───────────────────────────────────────── spec 驗證

describe("mutate — spec 驗證", () => {
  it("🔴 label 必填(沒有 label,收尾摘要就對不回 PR 的覆蓋率宣稱)", () => {
    expect(() => parseSpecs([{ file: "a", find: "b", replace: "c" }])).toThrow(/label/);
  });

  it("空陣列 → throw(空表會讓這道驗證形同虛設)", () => {
    expect(() => parseSpecs([])).toThrow(/空/);
  });

  it("絕對路徑 → throw(一律 repo 相對)", () => {
    expect(() => parseSpecs([{ ...spec(), file: "/etc/passwd" }])).toThrow(/相對路徑/);
  });

  it("正對照:合法 spec → 過,all 預設 false", () => {
    const s = parseSpecs([{ file: "a", find: "b", replace: "c", label: "d" }]);
    expect(s).toHaveLength(1);
    expect(s[0].all).toBe(false);
  });
});

// ───────────────────────────────────────── CLI 參數

describe("mutate — 參數", () => {
  it("預設 cwd 是 `.`(非 monorepo),預設指令是 vitest 本體(不透過 turbo)", () => {
    const a = parseArgs([]);
    expect(a.cwd).toBe(".");
    expect(a.cmd).toBe("npx vitest run");
    expect(a.cmd).not.toContain("turbo");
  });

  it("不認識的參數 → throw(打錯字不該被靜靜忽略)", () => {
    expect(() => parseArgs(["--nope"])).toThrow(/不認識/);
  });

  it("旗標後面缺參數 → throw", () => {
    expect(() => parseArgs(["--file"])).toThrow(/缺參數/);
  });
});

// ───────────────────────────────────────── 摘要

describe("mutate — 摘要與 exit code", () => {
  const r = (verdict: MutationResult["verdict"]): MutationResult => ({
    spec: spec(),
    verdict,
    occurrences: 1,
  });

  it("全部 killed + 對照綠 → exit 0", () => {
    const { text, exitCode } = formatSummary([r("killed"), r("killed")], true);
    expect(exitCode).toBe(0);
    expect(text).toContain("✅");
  });

  it("有 survived → exit 1,且訊息要求逐條交代", () => {
    const { text, exitCode } = formatSummary([r("killed"), r("survived")], true);
    expect(exitCode).toBe(1);
    expect(text).toContain("覆蓋缺口");
  });

  it("有 inconclusive → exit 2(無法判定＝沒過,語意對齊 check:cso)", () => {
    expect(formatSummary([r("killed"), r("inconclusive")], true).exitCode).toBe(2);
  });

  it("🔴 對照紅 → exit 2,即使每條都 killed", () => {
    const { text, exitCode } = formatSummary([r("killed"), r("killed")], false);
    expect(exitCode).toBe(2);
    expect(text).toContain("作廢");
  });

  it("摘要逐條印出 label——這張表要能直接貼進 PR", () => {
    expect(formatSummary([r("killed")], true).text).toContain("拿掉守衛應該讓測試轉紅");
  });
});

// ───────────────────────────────────────── 端到端(拋棄式 git repo)

/**
 * 建一個拋棄式 git repo:`<wrap>/repo`,src/a.txt 內含 GUARD_ON,已 commit,工作樹乾淨。
 * repo 外面刻意包一層 `wrap`,好讓 `../outside.txt` 這種逃逸有地方落腳而不污染 tmpdir。
 */
function makeRepo(
  files: Record<string, string | Buffer> = { "src/a.txt": "keep\nGUARD_ON\nkeep\n" },
  prepare?: (dir: string) => void,
): string {
  const wrap = mkdtempSync(join(tmpdir(), "mutate-e2e-"));
  created.push(wrap);
  const dir = join(wrap, "repo");
  mkdirSync(dir, { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    const abs = join(dir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, body);
  }
  const git = (...a: string[]) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  prepare?.(dir);
  git("add", "-A");
  git("commit", "-qm", "init");
  return dir;
}

/** 跑真腳本,回傳 {code, out}。指令非 0 不 throw。 */
function runScript(cwd: string, args: string[]): { code: number; out: string } {
  try {
    const out = execFileSync("npx", ["tsx", SCRIPT, ...args], { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

const BASE = ["--file", "src/a.txt", "--find", "GUARD_ON", "--replace", "GUARD_OFF", "--label", "拿掉守衛", "--cwd", "."];
const CATCHES = "grep -q GUARD_ON src/a.txt"; // 守衛在→exit 0;被改掉→exit 1

describe("mutate — 端到端(真的跑腳本)", () => {
  it("🔴 正對照:測試抓得到 mutation → exit 0,且檔案被還原", () => {
    const dir = makeRepo();
    const before = readFileSync(join(dir, "src/a.txt"), "utf-8");
    const { code, out } = runScript(dir, [...BASE, "--cmd", CATCHES]);
    expect(out).toContain("✅");
    expect(code).toBe(0);
    expect(readFileSync(join(dir, "src/a.txt"), "utf-8")).toBe(before);
  });

  it("🔴 mutant 存活(指令永遠綠)→ exit 1", () => {
    const { code, out } = runScript(makeRepo(), [...BASE, "--cmd", "true"]);
    expect(code).toBe(1);
    expect(out).toContain("存活");
  });

  it("🔴 閘①:工作樹髒 → 拒跑 exit 2,且**沒有動到任何檔案**", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "dirty.txt"), "未提交的東西");
    const { code, out } = runScript(dir, [...BASE, "--cmd", CATCHES]);
    expect(code).toBe(2);
    expect(out).toContain("拒跑");
    expect(out).toContain("dirty.txt");
    expect(readFileSync(join(dir, "src/a.txt"), "utf-8")).toContain("GUARD_ON");
  });

  it("🔴 閘②:樣本沒對上 → exit 2(不是靜靜跳過然後報綠)", () => {
    const { code, out } = runScript(makeRepo(), [
      "--file", "src/a.txt", "--find", "NOT_THERE", "--replace", "x",
      "--label", "打錯樣本", "--cwd", ".", "--cmd", "true",
    ]);
    expect(code).toBe(2);
    expect(out).toContain("找不到");
  });

  it("🔴 閘③:對照本身是紅的 → exit 2(mutation 轉紅證明不了任何事)", () => {
    const { code, out } = runScript(makeRepo(), [...BASE, "--cmd", "false"]);
    expect(code).toBe(2);
    expect(out).toContain("作廢");
  });

  it("檔案不存在 → exit 2", () => {
    const { code } = runScript(makeRepo(), [
      "--file", "src/missing.txt", "--find", "a", "--replace", "b",
      "--label", "路徑打錯", "--cwd", ".", "--cmd", "true",
    ]);
    expect(code).toBe(2);
  });

  it("--spec 批次:一條抓到、一條存活 → exit 1,摘要兩條 label 都在", () => {
    const dir = makeRepo({ "src/a.txt": "GUARD_ON\n", "src/b.txt": "OTHER\n" });
    writeFileSync(
      join(dir, "m.json"),
      JSON.stringify([
        { file: "src/a.txt", find: "GUARD_ON", replace: "GUARD_OFF", label: "守衛 A 有測試守著" },
        { file: "src/b.txt", find: "OTHER", replace: "MUTATED", label: "守衛 B 沒人守" },
      ]),
    );
    execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["commit", "-qm", "spec"], { cwd: dir, stdio: "ignore" });

    const { code, out } = runScript(dir, ["--spec", "m.json", "--cwd", ".", "--cmd", CATCHES]);
    expect(code).toBe(1);
    expect(out).toContain("守衛 A 有測試守著");
    expect(out).toContain("守衛 B 沒人守");
    expect(readFileSync(join(dir, "src/b.txt"), "utf-8")).toBe("OTHER\n");
  });
});

// ───────────────────────────────────────── 端到端:例外路徑(Codex review 的四個 P1)

describe("mutate — 端到端:安全契約在非快樂路徑上也要成立", () => {
  it("🔴 路徑逃逸 `../outside.txt` → 拒跑,且 repo 外的檔案沒被動到", () => {
    const dir = makeRepo();
    const outside = join(dir, "..", "outside.txt");
    writeFileSync(outside, "GUARD_ON\n");
    const { code, out } = runScript(dir, [
      "--file", "../outside.txt", "--find", "GUARD_ON", "--replace", "GUARD_OFF",
      "--label", "逃到 repo 外", "--cwd", ".", "--cmd", "true",
    ]);
    expect(code).toBe(2);
    expect(out).toContain("repo 之外");
    // 閘①「repo 全乾淨」對 repo 外的檔案完全無效,所以這條斷言才是重點
    expect(readFileSync(outside, "utf-8")).toBe("GUARD_ON\n");
  });

  it("🔴 symlink → 拒跑(可能指到 repo 之外)", () => {
    const dir = makeRepo({ "src/a.txt": "GUARD_ON\n" }, (d) => {
      symlinkSync("a.txt", join(d, "src/link.txt"));
    });
    const { code, out } = runScript(dir, [
      "--file", "src/link.txt", "--find", "GUARD_ON", "--replace", "GUARD_OFF",
      "--label", "透過 symlink 改", "--cwd", ".", "--cmd", "true",
    ]);
    expect(code).toBe(2);
    // 斷言要對到守衛自己的訊息——`toContain("symlink")` 會被印出來的 label 誤中,
    // 拿掉守衛也照樣綠(首次自驗抓到,跟 `.git` 那條同一個陷阱)
    expect(out).toContain("目標是 symlink");
  });

  it("🔴 `.git/` 內部 → 拒跑(那是 git 自己的狀態,閘① 保不住)", () => {
    const { code, out } = runScript(makeRepo(), [
      "--file", ".git/config", "--find", "[core]", "--replace", "[nope]",
      "--label", "改 git 自己", "--cwd", ".", "--cmd", "true",
    ]);
    expect(code).toBe(2);
    // 斷言要對到守衛自己的訊息——只寫 `.git` 會被印出來的檔名那行誤中
    expect(out).toContain(".git/ 內部");
  });

  it("🔴 沒被 git 追蹤的檔(gitignore 掉的)→ 拒跑,還原失敗時沒有救命路", () => {
    const dir = makeRepo({
      "src/a.txt": "GUARD_ON\n",
      ".gitignore": "ignored.txt\n",
      "ignored.txt": "GUARD_ON\n",
    });
    const { code, out } = runScript(dir, [
      "--file", "ignored.txt", "--find", "GUARD_ON", "--replace", "GUARD_OFF",
      "--label", "改沒被追蹤的檔", "--cwd", ".", "--cmd", "true",
    ]);
    expect(code).toBe(2);
    expect(out).toContain("追蹤");
    expect(readFileSync(join(dir, "ignored.txt"), "utf-8")).toBe("GUARD_ON\n");
  });

  it("🔴 二進位檔 → 拒跑(UTF-8 來回一趟會默默改掉 bytes,還原就不是還原)", () => {
    const bin = Buffer.from([0x47, 0x55, 0x41, 0x52, 0x44, 0x00, 0xff, 0xfe]);
    const dir = makeRepo({ "src/a.txt": "GUARD_ON\n", "src/blob.bin": bin });
    const { code, out } = runScript(dir, [
      "--file", "src/blob.bin", "--find", "GUARD", "--replace", "BROKE",
      "--label", "改二進位檔", "--cwd", ".", "--cmd", "true",
    ]);
    expect(code).toBe(2);
    expect(out).toContain("UTF-8");
    expect(readFileSync(join(dir, "src/blob.bin"))).toEqual(bin);
  });

  it("🔴 驗證指令被訊號砍掉 → 無法判定 exit 2,**不得**當成「測試轉紅」", () => {
    const { code, out } = runScript(makeRepo(), [...BASE, "--cmd", "kill -9 $$"]);
    expect(code).toBe(2);
    expect(out).toContain("訊號");
    expect(out).not.toContain("✅ 抓到");
  });

  // 🔴 Codex review round 1 P1:上一條殺的是 wrapper bash 本身(pid `$$`),
  //    bash 沒機會回傳 exit code、Node 用 `signal='SIGKILL'` 收場。
  //    真正的常見情境是**測試程序**被 SIGKILL / OOM 砍掉、bash wrapper 正常退出
  //    並回傳 shell 慣例的 137(128+9)。前者被 `signal` 分支擋到,後者
  //    (實務上遠更常見)過去會被誤判成 red。用 `exit 137` 直接模擬 bash 的
  //    這種收場,驗新加的 128-255 infra 分類端到端成立。
  it("🔴 bash 回 exit 137(子程序被 SIGKILL/OOM)→ infra 不是 red、mutant 不得被錯報 killed", () => {
    const { code, out } = runScript(makeRepo(), [...BASE, "--cmd", "exit 137"]);
    expect(code).toBe(2);
    // 斷言要對到新加的分類自己的訊息——只寫 toContain("infra") 拿掉 137/143 分支
    // 也照樣過(對照那輪的 `run.outcome === "infra"` 也會走同一條 detail 分支)
    expect(out).toContain("SIGKILL");
    expect(out).not.toContain("✅ 抓到");
    expect(out).not.toContain("🔴 存活");
  });

  // 🔴 Codex R2 P2 正對照:縮小 137/143 保留區間後,其他 128-255 必須恢復 red 語意。
  //    直接送 `exit 200` 代表 mutant 造成合法自訂失敗——工具應判為 killed(轉紅),
  //    不是 inconclusive。
  it("🔴 mutant exit 200(使用者自訂 test fail code)→ red、判 killed 不是 inconclusive", () => {
    // 只有 mutation 版本會 exit 200;對照跑的是還原後的 `exit 0`(用 CATCHES 邏輯)。
    // 這裡用 `grep -q GUARD_ON src/a.txt || exit 200`——守衛在時 exit 0、被拿掉時 exit 200
    const { code, out } = runScript(makeRepo(), [
      ...BASE,
      "--cmd", "grep -q GUARD_ON src/a.txt || exit 200",
    ]);
    expect(code).toBe(0);
    expect(out).toContain("✅ 抓到"); // 該被判 killed、不是 inconclusive
  });

  // 🔴 Codex 用「mutant 輸出 2 MB、對照正常」的指令重現過:舊版 execFileSync 撞到預設
  //    maxBuffer 拋例外,被當成「測試轉紅」→ 工具 exit 0 宣稱「全部被抓到」,
  //    實際上驗證程序根本沒跑完。偵測假綠的工具自己報了假綠。
  it("🔴 指令輸出爆量(8 MB)→ 照樣依 exit code 判定,不得被緩衝區大小左右", () => {
    const { code, out } = runScript(makeRepo(), [
      ...BASE,
      "--cmd",
      // 有守衛時安靜地 exit 0;守衛被拿掉時狂噴 8 MB 再 exit 1
      `if grep -q GUARD_ON src/a.txt; then exit 0; else head -c 8000000 /dev/zero | tr '\\0' 'x'; exit 1; fi`,
    ]);
    expect(code).toBe(0);
    expect(out).toContain("✅ 抓到");
  });

  it("🔴 還原失敗 → exit 2 並大聲講出來(不得吞掉錯誤還宣稱跑完)", () => {
    const dir = makeRepo();
    // 指令自己把目標改成唯讀 → 還原時 EACCES。指令本身 exit 0(避免跟「對照紅」混淆)
    const { code, out } = runScript(dir, [...BASE, "--cmd", "chmod 444 src/a.txt"]);
    expect(code).toBe(2);
    expect(out).toContain("還原失敗");
    expect(out).toContain("git checkout --");
  });

  it("🔴 還原失敗後**停手**,不繼續往下改更多檔", () => {
    const dir = makeRepo({ "src/a.txt": "GUARD_ON\n", "src/b.txt": "SECOND\n" });
    writeFileSync(
      join(dir, "m.json"),
      JSON.stringify([
        { file: "src/a.txt", find: "GUARD_ON", replace: "GUARD_OFF", label: "第一條會讓還原失敗" },
        { file: "src/b.txt", find: "SECOND", replace: "MUTATED", label: "後面這條不該被跑到" },
      ]),
    );
    execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["commit", "-qm", "spec"], { cwd: dir, stdio: "ignore" });

    const { code, out } = runScript(dir, ["--spec", "m.json", "--cwd", ".", "--cmd", "chmod 444 src/a.txt"]);
    expect(code).toBe(2);
    expect(out).toContain("還原失敗");
    // 安全契約已經破了,繼續改別的檔只會讓現場更難救
    expect(out).not.toContain("後面這條不該被跑到");
    expect(readFileSync(join(dir, "src/b.txt"), "utf-8")).toBe("SECOND\n");
    // 🔴 而且要停在**正確的地方**:靠後面那道「工作樹乾淨」檢查兜住不算數。
    //    只斷言「有停下來」時,拿掉這裡的 early return 也照樣綠(自驗抓到的備援遮蔽)。
    expect(out).not.toContain("工作樹仍不乾淨");
  });

  // ── 以下四條是 Codex 跨模型 review round 2 抓到的(全部有重現)。
  //    共同形狀:**驗證指令與子程序是敵對輸入**,不是乖乖跑完就算的黑盒子。

  it("🔴 TOCTOU:驗證指令中途把目標換成 symlink → 拒絕跟著寫出去,repo 外的檔案沒被動", () => {
    const dir = makeRepo();
    const outside = join(dir, "..", "outside.txt");
    writeFileSync(outside, "OUTSIDE_INTACT\n");
    const { code, out } = runScript(dir, [
      ...BASE,
      "--cmd", "rm src/a.txt && ln -s ../../outside.txt src/a.txt",
    ]);
    expect(code).toBe(2);
    expect(out).toContain("還原失敗");
    // 🔴 斷言要對到 symlink 那道檢查自己的訊息:inode 檢查也會攔到同一個情境,
    //    只寫「還原失敗」的話拿掉 symlink 檢查照樣綠(自驗抓到的備援遮蔽)
    expect(out).toContain("已被換成 symlink");
    // 重點:checkTarget 在動手前擋不住這個——它是跑到一半才被掉包的
    expect(readFileSync(outside, "utf-8")).toBe("OUTSIDE_INTACT\n");
  });

  it("🔴 TOCTOU:驗證指令把目標換成另一個一般檔(inode 不同)→ 拒絕覆寫別的檔", () => {
    const dir = makeRepo();
    // 🔴 不能寫成 `rm src/a.txt && printf ... > src/a.txt`:**Linux 會立刻重用剛釋放的
    //    inode**(ext4／tmpfs),新檔常常拿到同一個 inode number,inode 檢查就不會觸發
    //    ——macOS/APFS 上看不到這個差異,是 CI 抓到的。
    //    先在原檔還在時建出新檔(保證拿到不同 inode),再 mv 蓋上去,這樣兩個平台都成立。
    const { code, out } = runScript(dir, [
      ...BASE,
      "--cmd", "printf 'REPLACED\\n' > src/tmp.txt && mv src/tmp.txt src/a.txt",
    ]);
    expect(code).toBe(2);
    expect(out).toContain("inode 不同");
  });

  it("🔴 驗證指令去動別的 tracked file → 還原後工作樹不乾淨 → exit 2", () => {
    const dir = makeRepo({ "src/a.txt": "GUARD_ON\n", "src/b.txt": "UNTOUCHED\n" });
    const { code, out } = runScript(dir, [
      ...BASE,
      "--cmd", "printf 'TOUCHED\\n' > src/b.txt; grep -q GUARD_ON src/a.txt",
    ]);
    expect(code).toBe(2);
    expect(out).toContain("工作樹仍不乾淨");
    expect(out).toContain("src/b.txt");
  });

  it("🔴 turbo 摘要之後又噴 5 MB(超過保留上限)→ 仍要判為快取命中,不得錯報 survived", () => {
    const { code, out } = runScript(makeRepo(), [
      ...BASE,
      "--cmd",
      // 先印快取摘要,再噴 5 MB 把它擠出保留視窗,然後 exit 0
      `printf 'Cached:    1 cached, 2 total\\n'; head -c 5000000 /dev/zero | tr '\\0' 'x'; exit 0`,
    ]);
    expect(code).toBe(2);
    expect(out).toContain("turbo 快取");
    expect(out).not.toContain("🔴 存活");
  });

  it(
    "🔴 leader 結束不等於驗證結束:指令留下背景程序 → 判無法判定並砍掉整組",
    async () => {
      const dir = makeRepo();
      const file = join(dir, "src/a.txt");
      const before = readFileSync(file, "utf-8");
      // 背景子程序把 stdio 都 redirect 掉(所以 leader 的 close 會如常觸發),
      // 3 秒後才把檔案寫壞——那時工具早就還原、對照跑完、準備 exit 0 了
      const { code, out } = runScript(dir, [
        ...BASE,
        "--cmd", "( sleep 3; printf 'BAD\\n' > src/a.txt ) </dev/null >/dev/null 2>&1 & grep -q GUARD_ON src/a.txt",
      ]);
      expect(code).toBe(2);
      expect(out).toContain("背景程序");
      expect(out).not.toContain("✅ 抓到");
      // 等過背景程序原本要動手的時間點,現場必須還在
      await new Promise((r) => setTimeout(r, 4000));
      expect(readFileSync(file, "utf-8")).toBe(before);
    },
    60_000,
  );

  it("🔴 repo 設了 status.showUntrackedFiles=no → 閘① 仍要看得見未追蹤檔", () => {
    const dir = makeRepo();
    execFileSync("git", ["config", "status.showUntrackedFiles", "no"], { cwd: dir, stdio: "ignore" });
    writeFileSync(join(dir, "untracked.txt"), "未提交的東西");
    const { code, out } = runScript(dir, [...BASE, "--cmd", CATCHES]);
    expect(code).toBe(2);
    expect(out).toContain("拒跑");
    expect(out).toContain("untracked.txt");
  });

  it("🔴 index flag(assume-unchanged)會讓 git status 看不見修改 → 開跑前就拒跑", () => {
    const dir = makeRepo({ "src/a.txt": "GUARD_ON\n", "src/b.txt": "SECOND\n" });
    execFileSync("git", ["update-index", "--assume-unchanged", "src/b.txt"], { cwd: dir, stdio: "ignore" });
    const { code, out } = runScript(dir, [...BASE, "--cmd", CATCHES]);
    expect(code).toBe(2);
    // 🔴 斷言要對到**開跑前**那道檢查自己的訊息:treeDirt 也驗 index flag,
    //    只寫 toContain("index flag") 的話拿掉開跑前那道照樣綠(自驗抓到的備援遮蔽)
    expect(out).toContain("拒跑:有檔案被 index flag 藏起來");
    expect(out).toContain("src/b.txt");
  });

  it("🔴 驗證指令在跑的期間才設 index flag → 收尾的乾淨檢查仍要看得見", () => {
    const dir = makeRepo({ "src/a.txt": "GUARD_ON\n", "src/b.txt": "SECOND\n" });
    // 指令先把 b.txt 設成 assume-unchanged 再改它——git status 從此對它閉嘴
    const { code, out } = runScript(dir, [
      ...BASE,
      "--cmd", "git update-index --assume-unchanged src/b.txt; printf 'TOUCHED\\n' > src/b.txt; true",
    ]);
    expect(code).toBe(2);
    expect(out).toContain("index flag");
    expect(out).toContain("src/b.txt");
  });

  it("🔴 驗證指令 chmod 了另一個 tracked 檔 → git 看不見,但工具要抓到、還原、判無效", () => {
    const dir = makeRepo({ "src/a.txt": "GUARD_ON\n", "src/b.txt": "SECOND\n" });
    const before = statSync(join(dir, "src/b.txt")).mode & 0o7777;
    const { code, out } = runScript(dir, [...BASE, "--cmd", "chmod 600 src/b.txt; " + CATCHES]);
    expect(code).toBe(2);
    expect(out).toContain("src/b.txt");
    // 🔴 要停在**每輪還原後**那道,不是靠對照跑完那道兜住(自驗抓到的備援遮蔽)
    expect(out).toContain("驗證指令改了 tracked 檔的權限");
    expect(out).not.toContain("對照跑完後 tracked 檔的權限");
    expect(statSync(join(dir, "src/b.txt")).mode & 0o7777).toBe(before);
  });

  it("🔴 驗證指令原地改了我們 mutate 的那個檔 → 判無法判定(它跑的已不是這條 mutation)", () => {
    const dir = makeRepo();
    const before = readFileSync(join(dir, "src/a.txt"), "utf-8");
    const { code, out } = runScript(dir, [
      ...BASE,
      // 同一個 inode、原地改內容,所以 inode 檢查抓不到
      "--cmd", "printf 'SOMETHING_ELSE\\n' > src/a.txt",
    ]);
    expect(code).toBe(2);
    expect(out).toContain("動過我們 mutate 的檔");
    // 內容不斷言:對照會再跑一次同一個指令,那次的副作用不是我們該還原的
    expect(before).toContain("GUARD_ON");
  });

  it("🔴 目標有 hardlink(nlink>1)→ 拒跑:原地覆寫會一併改到 repo 外的 alias", () => {
    const dir = makeRepo({ "src/a.txt": "GUARD_ON\n" }, (d) => {
      // repo 外先放一個檔,再從 repo 內做一個 hardlink 指向它
      writeFileSync(join(d, "..", "outside.txt"), "GUARD_ON\n");
      execFileSync("ln", [join(d, "..", "outside.txt"), join(d, "src/hard.txt")]);
    });
    const { code, out } = runScript(dir, [
      "--file", "src/hard.txt", "--find", "GUARD_ON", "--replace", "GUARD_OFF",
      "--label", "透過 hardlink 改", "--cwd", ".", "--cmd", "true",
    ]);
    expect(code).toBe(2);
    // 🔴 斷言要對到 checkTarget 自己的訊息——writeCheckedSync 的備援訊息也含「hardlink」,
    //    只寫 toContain("hardlink") 的話拿掉前面那道檢查照樣綠(自驗抓到的備援遮蔽)
    expect(out).toContain("個 hardlink——原地覆寫");
    expect(readFileSync(join(dir, "..", "outside.txt"), "utf-8")).toBe("GUARD_ON\n");
  });

  it("🔴 指令吐 8 MB 完全沒有換行的輸出 → 不得把 carry 撐爆,判定照常", () => {
    const { code, out } = runScript(makeRepo(), [
      ...BASE,
      // stdout 與 stderr 各 4 MB、全程沒有一個換行;守衛在時 exit 0
      "--cmd",
      `head -c 4000000 /dev/zero | tr '\\0' 'x' >&2; head -c 4000000 /dev/zero | tr '\\0' 'y'; grep -q GUARD_ON src/a.txt`,
    ]);
    expect(code).toBe(0);
    expect(out).toContain("✅ 抓到");
  });

  it("🔴 指令把目標整個刪掉 → 還原失敗要走「還原失敗」那條路,不是靠工作樹檢查兜住", () => {
    const dir = makeRepo();
    const { code, out } = runScript(dir, [...BASE, "--cmd", "rm src/a.txt"]);
    expect(code).toBe(2);
    expect(out).toContain("還原失敗");
    expect(out).not.toContain("工作樹仍不乾淨");
  });

  it("🔴 stderr 先吐沒有換行的雜訊 → 不得把 stdout 的 turbo 摘要黏成非行首而漏判", () => {
    const { code, out } = runScript(makeRepo(), [
      ...BASE,
      "--cmd", `printf 'noise-without-newline' >&2; printf 'Cached:    1 cached, 2 total\\n'; exit 0`,
    ]);
    expect(code).toBe(2);
    expect(out).toContain("turbo 快取");
  });

  it(
    "🔴 忽略 SIGTERM 的孫程序:leader 死掉不等於整組死掉,runner 退出後檔案不得再被改",
    async () => {
      const dir = makeRepo();
      const file = join(dir, "src/a.txt");
      const before = readFileSync(file, "utf-8");

      // 孫程序 trap 掉 TERM、busy-wait 6 秒後把檔案寫壞;leader 只是 sleep 30。
      // 6 秒是刻意的:要**比「SIGTERM 後等 1.5s ＋ 再等 3s」還久**,
      // 否則「乖乖等它自己死完再還原」也會兜住,SIGKILL 那道升級就測不出來
      // (自驗抓到的備援遮蔽)。只有真的 SIGKILL 才能在 1.5 秒把它砍掉。
      const cmd =
        `bash -c 'trap "" TERM; while [ $SECONDS -lt 6 ]; do :; done; printf "BAD\\n" > src/a.txt'` +
        ` </dev/null >/dev/null 2>&1 & sleep 30`;
      const child = spawn("npx", ["tsx", SCRIPT, ...BASE, "--cmd", cmd], {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const deadline = Date.now() + 20_000;
      while (readFileSync(file, "utf-8") === before) {
        if (Date.now() > deadline) throw new Error("mutation 一直沒被套用,這條測試沒測到該測的東西");
        await new Promise((r) => setTimeout(r, 50));
      }
      child.kill("SIGINT");
      const code = await new Promise<number>((resolve) => child.on("close", (c) => resolve(c ?? -1)));
      expect(code).toBe(2);
      expect(readFileSync(file, "utf-8")).toBe(before);

      // runner 已經退出——等過孫程序原本要動手的時間點(6 秒),現場必須還在
      await new Promise((r) => setTimeout(r, 8000));
      expect(readFileSync(file, "utf-8")).toBe(before);
    },
    60_000,
  );

  it(
    "🔴 SIGINT:子命令還在跑時中斷 → 檔案要被還原、exit 2,而且不會等子命令自己跑完",
    async () => {
      const dir = makeRepo();
      const file = join(dir, "src/a.txt");
      const before = readFileSync(file, "utf-8");

      const child = spawn("npx", ["tsx", SCRIPT, ...BASE, "--cmd", "sleep 30"], {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
      });

      // 等 mutation 真的落到磁碟上,才代表我們中斷在「檔案是壞的」那個視窗裡
      const deadline = Date.now() + 20_000;
      while (readFileSync(file, "utf-8") === before) {
        if (Date.now() > deadline) throw new Error("mutation 一直沒被套用,這條測試沒測到該測的東西");
        await new Promise((r) => setTimeout(r, 50));
      }

      const started = Date.now();
      child.kill("SIGINT");
      const code = await new Promise<number>((resolve) => {
        child.on("close", (c) => resolve(c ?? -1));
      });

      expect(readFileSync(file, "utf-8")).toBe(before); // 還原了
      expect(code).toBe(2);
      expect(Date.now() - started).toBeLessThan(20_000); // 沒有傻等 sleep 30
    },
    60_000,
  );

  // 🔴 Codex R1 P2:上面兩條「忽略 SIGTERM 的孫程序」與「SIGINT」都覆蓋不到
  //    「**外部**對 runner 發 SIGTERM」這條路。CI / 容器 timeout / kubectl kill
  //    通常先送 SIGTERM,若 `process.on("SIGTERM", ...)` handler 壞掉、runner 會
  //    被拖到外部 SIGKILL,mutation 永久留在磁碟。
  //    這條就是那條 handler 的正對照。
  it(
    "🔴 外部送 SIGTERM 給 runner → 走完 teardown、還原檔案、exit 2(不得被拖到 SIGKILL 才收場)",
    async () => {
      const dir = makeRepo();
      const file = join(dir, "src/a.txt");
      const before = readFileSync(file, "utf-8");

      const child = spawn("npx", ["tsx", SCRIPT, ...BASE, "--cmd", "sleep 30"], {
        cwd: dir,
        stdio: ["ignore", "pipe", "pipe"],
      });

      // 等 mutation 真的落到磁碟上,才代表我們中斷在「檔案是壞的」那個視窗裡
      const deadline = Date.now() + 20_000;
      while (readFileSync(file, "utf-8") === before) {
        if (Date.now() > deadline) throw new Error("mutation 一直沒被套用,這條測試沒測到該測的東西");
        await new Promise((r) => setTimeout(r, 50));
      }

      const started = Date.now();
      child.kill("SIGTERM");
      const code = await new Promise<number>((resolve) => {
        child.on("close", (c) => resolve(c ?? -1));
      });

      expect(readFileSync(file, "utf-8")).toBe(before); // 還原了
      expect(code).toBe(2);
      expect(Date.now() - started).toBeLessThan(20_000); // 沒有傻等 sleep 30
    },
    60_000,
  );
});
