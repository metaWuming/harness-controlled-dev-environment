#!/usr/bin/env node
/**
 * scripts/check-mutation-specs.ts — mutation spec 樣本漂移守門(CI 輕量版)
 *
 * 可控開發環境 Layer 3。為什麼需要這支:
 *   `scripts/mutations/*.json` 的 `find` 是**原始碼逐字樣本**。改到那幾行之後,
 *   `mutate.ts` 會以「樣本沒對上」fail-closed(exit 2)——正確,但**只有人工重跑時才會發現**。
 *   前兩個 sprint 內漂移被抓到 4 次,每次都是收尾才發現、再回頭補 spec。
 *
 *   完整 mutation 太慢、不能進 CI(每條探針跑一次 vitest)。這支只做**最便宜的那一半**:
 *   每條探針的 `find` 樣本現在還能不能在原始碼裡精準對上。對得上不代表探針仍會 kill,
 *   對不上則必然是 mutate 會拒跑的形狀——所以它是 mutate 的**前置守門**,不是替代品。
 *
 * 安全邊界(supervisor plan rev 2 P1):spec 檔本身是 PR 作者可改的 CI 輸入。
 *   - `scripts/mutations` 目錄必須是 repo 內的真目錄(非 symlink、realpath 等於正規路徑)。
 *   - 每個 spec 檔**讀之前**先過 `mutate.ts` 的 `checkTarget`(repo 內、git 追蹤、非 symlink、
 *     一般檔、nlink=1、UTF-8;`O_NOFOLLOW` 開一次 fd 取 bytes)。之後**只用那份 bytes** 解析,
 *     不再依路徑讀檔——tracked spec 被換成指向 repo 外的 symlink 時,外部檔不會成為 CI 輸入。
 *   - 探針目標同樣經 `checkTarget` 取 bytes,再交給 `applyMutation`。
 *   所有路徑 / bytes 的判斷**只複用 `mutate.ts` 的純函式**,本檔不另寫一套安全邏輯。
 *
 * spec discovery 契約(P2#3 defer ⑤,D1-D7 拍板;見 plan file):
 *   D1 遞迴子目錄:收(避免子目錄 spec 靜默漏門)
 *   D2 副檔名大小寫:大小寫無關(.json / .JSON / .Json 都收)
 *   D3 walker 邊界:頂層 + 遞迴途中任一 symlink dir → fail-closed exit 2;
 *                    walker 每層 lstat / readdir / stat 的 I/O 失敗或型別無法判定 → fail-closed。
 *                    (檔案級 tracked / non-symlink / nlink=1 仍交給 checkTarget,禁區不動)
 *   D4 同名衝突:collision key = lowercased 完整 POSIX repo-relative path;命中 → fail-closed。
 *                排序:posix 完整路徑排序。
 *   D5 0-spec:遞迴後總數 0 → fail-closed(既有已擋、寫進契約)
 *   D6 checkTarget 呼叫端邊界:本檔對 checkTarget 的呼叫可配合 discovery 調整;
 *                              mutate.ts 的 checkTarget **定義**為禁區、不動(sprint 3-5 拍板)
 *   D7 discovery 函式命名:`discoverSpecFiles`(rev 2 supervisor P2-2)
 *
 * 純讀:不跑測試、不寫檔、不改工作樹、不需要乾淨工作樹。無 env override、無 allowlist。
 *
 * Usage:  npm run check:mutation-specs
 *         npx tsx scripts/check-mutation-specs.ts --root=<dir>   # e2e fixture
 * Exit:   0 = 所有探針樣本都對得上
 *         1 = DRIFT(內容層:JSON / schema 壞、目標檔對不上、樣本消失或多處或無變化)——改 spec 或改碼
 *         2 = 無法判定(目錄邊界失敗、0 個 spec 檔、spec 檔本身不可信、argv 錯、未預期例外)——先查 repo 形狀
 *         1 與 2 在 CI 都是紅;分開只為診斷語意,對齊 `mutate.ts` / `check:cso` 的「無法判定當沒過」。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectInvocation, reportIfNotMain } from "./lib/invoked-as-main";
import { applyMutation, checkTarget, parseSpecs } from "./mutate";

export const SPEC_DIR = "scripts/mutations";

export type SpecFileStatus = "ok" | "drift" | "untrusted";

export interface SpecFileResult {
  /** repo 相對路徑 */
  rel: string;
  status: SpecFileStatus;
  /** 探針數(解析成功時) */
  probes: number;
  /** 每一條問題(人看得懂的一句話) */
  problems: string[];
}

export interface DirCheck {
  ok: boolean;
  reason?: string;
  /** repo 相對路徑清單(排序後),ok 時必有 */
  specs?: string[];
}

/** walker 的 I/O 介面(可注入,供 unit 測試 mock IO 失敗場景;預設 = node fs sync API)。 */
export interface WalkerIO {
  lstat: (p: string) => fs.Stats;
  stat: (p: string) => fs.Stats;
  readdir: (p: string) => string[];
}

const DEFAULT_IO: WalkerIO = {
  lstat: fs.lstatSync,
  stat: fs.statSync,
  readdir: fs.readdirSync,
};

/** collision 分組:key 是 lowercased posix repo-relative path,members 是原始 path 集合。 */
export interface CollisionGroup {
  key: string;
  members: string[];
}

/**
 * 對 lowercased posix 完整路徑分組、回 group.size > 1 的清單。純函式,無 IO。
 * key 用完整 path(非 basename)→ `sprint-a/guard.json` 與 `sprint-b/guard.json`
 * 是**合法不同 spec**、不算衝突。
 */
export function findCaseCollisions(paths: string[]): CollisionGroup[] {
  const groups = new Map<string, string[]>();
  for (const p of paths) {
    const key = p.toLowerCase();
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }
  const collisions: CollisionGroup[] = [];
  for (const [key, members] of groups.entries()) {
    if (members.length > 1) collisions.push({ key, members: [...members].sort() });
  }
  return collisions.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * 遞迴走 `scripts/mutations` 底下,回 basename lowercase 結尾 `.json` 的相對路徑。
 *
 * fail-closed 邊界(P2#3 defer ⑤ D3):
 *   - readdir throw → `readdir 失敗於 <rel>:<message>`
 *   - lstat throw   → `lstat 失敗於 <rel>:<message>`
 *   - symlink 且 stat 失敗 → `symlink 目標無法讀於 <rel>:<message>`
 *   - symlink 指向 dir     → `symlink directory:<rel>`(supervisor P1-1:不能靜默略過)
 *   - symlink 指向 file    → 收入(交給 checkTarget 檔案讀前防線判 untrusted)
 *   - 既非 file / dir / symlink 的異常型別 → `未預期型別於 <rel>`
 *
 * 只做 traversal + 副檔名過濾;檔案本身的 tracked / non-symlink / nlink=1 判定
 * 交給 checkTarget(mutate.ts 讀前防線,禁區不動)。
 */
export function walkSpecDir(
  absDir: string,
  relPrefix: string,
  io: WalkerIO = DEFAULT_IO,
): { ok: true; entries: string[] } | { ok: false; reason: string } {
  let names: string[];
  try {
    names = io.readdir(absDir);
  } catch (e) {
    return { ok: false, reason: `readdir 失敗於 ${relPrefix || "."}:${(e as Error).message}` };
  }
  const entries: string[] = [];
  for (const name of [...names].sort()) {
    const abs = path.join(absDir, name);
    const rel = relPrefix ? path.posix.join(relPrefix, name) : name;
    let st: fs.Stats;
    try {
      st = io.lstat(abs);
    } catch (e) {
      return { ok: false, reason: `lstat 失敗於 ${rel}:${(e as Error).message}` };
    }
    if (st.isSymbolicLink()) {
      let target: fs.Stats;
      try {
        target = io.stat(abs);
      } catch (e) {
        return { ok: false, reason: `symlink 目標無法讀於 ${rel}:${(e as Error).message}` };
      }
      if (target.isDirectory()) return { ok: false, reason: `symlink directory:${rel}` };
      if (target.isFile()) {
        if (name.toLowerCase().endsWith(".json")) entries.push(rel);
        continue;
      }
      return { ok: false, reason: `未預期 symlink 目標型別於 ${rel}` };
    }
    if (st.isDirectory()) {
      const sub = walkSpecDir(abs, rel, io);
      if (!sub.ok) return sub;
      entries.push(...sub.entries);
      continue;
    }
    if (st.isFile()) {
      if (name.toLowerCase().endsWith(".json")) entries.push(rel);
      continue;
    }
    return { ok: false, reason: `未預期型別於 ${rel}` };
  }
  return { ok: true, entries };
}

/**
 * 目錄邊界 + 遞迴 discovery:`scripts/mutations` 必須是 repo 內的真目錄。
 * 目錄被換成 symlink(即使指向 repo 內別處)→ 拒判,因為列舉結果不再對應 tracked tree。
 * 遞迴 walker 邊界見 `walkSpecDir` docstring。契約總覽見檔頭 D1-D7。
 *
 * `io` 參數供 unit 測試 mock walker IO 失敗場景;預設 = node fs sync API。
 */
export function discoverSpecFiles(repoRootReal: string, io: WalkerIO = DEFAULT_IO): DirCheck {
  const dir = path.join(repoRootReal, SPEC_DIR);
  let st: fs.Stats;
  try {
    st = fs.lstatSync(dir);
  } catch {
    return { ok: false, reason: `${SPEC_DIR} 目錄不存在` };
  }
  if (st.isSymbolicLink()) return { ok: false, reason: `${SPEC_DIR} 是 symlink——列舉結果不對應 tracked tree,拒判` };
  if (!st.isDirectory()) return { ok: false, reason: `${SPEC_DIR} 不是目錄` };
  let real: string;
  try {
    real = fs.realpathSync(dir);
  } catch (e) {
    return { ok: false, reason: `${SPEC_DIR} realpath 失敗:${(e as Error).message}` };
  }
  if (real !== dir) return { ok: false, reason: `${SPEC_DIR} 的 realpath 與正規路徑不同(${real})` };

  const walked = walkSpecDir(dir, "", io);
  if (!walked.ok) return { ok: false, reason: walked.reason };
  const specs = walked.entries.map((rel) => path.posix.join(SPEC_DIR, rel)).sort();
  const collisions = findCaseCollisions(specs);
  if (collisions.length > 0) {
    const msg = collisions.map((c) => `${c.key} → [${c.members.join(", ")}]`).join(";");
    return { ok: false, reason: `同名衝突(大小寫差異):${msg}` };
  }
  if (specs.length === 0) return { ok: false, reason: `${SPEC_DIR} 沒有任何 spec 檔——空表 = 這道閘門形同虛設` };
  return { ok: true, specs };
}

/** 單一 spec 檔的完整判定。純函式(只讀)。 */
export function checkSpecFile(repoRootReal: string, rel: string): SpecFileResult {
  const self = checkTarget(repoRootReal, rel);
  // `original` 在 ok 時必有;缺了就是 mutate.ts 契約被改,一樣當不可信(fail-closed)
  if (!self.ok || !self.original) {
    return { rel, status: "untrusted", probes: 0, problems: [`spec 檔 ${rel}:${self.reason}`] };
  }
  let specs;
  try {
    specs = parseSpecs(JSON.parse(self.original.toString("utf8")));
  } catch (e) {
    return { rel, status: "drift", probes: 0, problems: [`spec 檔 ${rel} 解析失敗:${(e as Error).message}`] };
  }
  const problems: string[] = [];
  specs.forEach((spec, i) => {
    const target = checkTarget(repoRootReal, spec.file);
    if (!target.ok || !target.original) {
      problems.push(`${rel}[${i}] ${spec.label} → 目標 ${spec.file}:${target.reason ?? "讀不到內容"}`);
      return;
    }
    const applied = applyMutation(target.original.toString("utf8"), spec);
    if (!applied.ok) problems.push(`${rel}[${i}] ${spec.label} → ${spec.file}:${applied.reason}`);
  });
  return { rel, status: problems.length === 0 ? "ok" : "drift", probes: specs.length, problems };
}

export interface Report {
  text: string;
  /** 0 / 1 / 2,語意見檔頭 */
  code: 0 | 1 | 2;
}

export function formatReport(results: SpecFileResult[]): Report {
  const untrusted = results.filter((r) => r.status === "untrusted");
  const drift = results.filter((r) => r.status === "drift");
  const total = results.reduce((n, r) => n + r.probes, 0);
  const lines: string[] = [];
  for (const r of results) {
    if (r.status === "ok") lines.push(`  ${r.rel} — ${r.probes} 條探針樣本都對得上`);
    else lines.push(`✗ ${r.rel} — ${r.status === "untrusted" ? "無法判定" : "DRIFT"}`, ...r.problems.map((p) => `    ${p}`));
  }
  if (untrusted.length > 0) {
    return {
      code: 2,
      text: [`✗ 無法判定:${untrusted.length} 個 spec 檔本身不可信(symlink / 未追蹤 / 非一般檔)——先查 repo 形狀,再談漂移`, ...lines].join("\n"),
    };
  }
  if (drift.length > 0) {
    return {
      code: 1,
      text: [
        `✗ mutation spec 漂移:${drift.length} 個 spec 檔的探針對不上原始碼——改了那幾行就要同步改 spec 的 find(否則 mutate 會拒跑)`,
        ...lines,
      ].join("\n"),
    };
  }
  return { code: 0, text: [`✅ mutation spec 樣本都對得上(${results.length} 個 spec 檔、${total} 條探針)`, ...lines].join("\n") };
}

export function runCheck(root: string): Report {
  let repoRootReal: string;
  try {
    repoRootReal = fs.realpathSync(root);
  } catch (e) {
    return { code: 2, text: `✗ 無法判定:root 解析失敗:${(e as Error).message}` };
  }
  const dir = discoverSpecFiles(repoRootReal);
  if (!dir.ok || !dir.specs) return { code: 2, text: `✗ 無法判定:${dir.reason}` };
  return formatReport(dir.specs.map((rel) => checkSpecFile(repoRootReal, rel)));
}

function repoRootFromHere(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

/** argv 只收單一 `--root=<dir>`;其他一律 fail-closed exit 2(對齊 check:catalog)。 */
export function parseRootArg(argv: string[]): { ok: true; root: string | null } | { ok: false; reason: string } {
  const rootArgs = argv.filter((a) => a.startsWith("--root="));
  const unknown = argv.filter((a) => !a.startsWith("--root="));
  if (unknown.length > 0 || rootArgs.length > 1 || (rootArgs.length === 1 && rootArgs[0] === "--root=")) {
    return { ok: false, reason: `參數錯誤:${argv.join(" ")}(只接受單一 --root=<dir>)` };
  }
  return { ok: true, root: rootArgs.length === 1 ? rootArgs[0]!.slice("--root=".length) : null };
}

// ESM main 判定改用 scripts/lib/invoked-as-main.ts 共用 lib(P2#3 defer ①②):
// 兩端 realpath、indeterminate 由 caller 顯式 exit(2)、被當 import 用時完全靜默。
const outcome = detectInvocation(import.meta.url, process.argv[1]);
const isMain = reportIfNotMain(outcome, "check-mutation-specs");

if (isMain) {
  let code: 0 | 1 | 2 = 2;
  try {
    const arg = parseRootArg(process.argv.slice(2));
    if (!arg.ok) {
      console.error(`✗ 無法判定:${arg.reason}`);
    } else {
      const report = runCheck(arg.root ?? repoRootFromHere());
      code = report.code;
      console[code === 0 ? "log" : "error"](report.text);
    }
  } catch (e) {
    console.error(`✗ 無法判定:未預期例外:${(e as Error).message}`);
  }
  process.exit(code);
} else if (outcome.kind === "indeterminate") {
  process.exit(2);
}
