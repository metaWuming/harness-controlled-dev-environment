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

/**
 * 目錄邊界:`scripts/mutations` 必須是 repo 內的真目錄。
 * 目錄被換成 symlink(即使指向 repo 內別處)→ 拒判,因為列舉結果不再對應 tracked tree。
 */
export function listSpecFiles(repoRootReal: string): DirCheck {
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

  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    return { ok: false, reason: `讀不到 ${SPEC_DIR}:${(e as Error).message}` };
  }
  // 只看名稱;型別 / symlink / tracked 全交給 checkTarget(不用 dirent 當安全依據)
  const specs = names
    .filter((n) => n.endsWith(".json"))
    .sort()
    .map((n) => path.posix.join(SPEC_DIR, n));
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
  const dir = listSpecFiles(repoRootReal);
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
