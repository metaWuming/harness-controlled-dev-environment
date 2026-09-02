// @vitest-environment node
//
// `scripts/check-hooks.sh` 的守門測試。
//
// 🔴 為什麼這支必須存在:check-hooks.sh 是「hooks 真的活著嗎」的機器化斷言,
//    這類自己就有斷言邏輯的守門本身也需要斷言——不然 hooks 真的設錯時,它可能
//    用看不懂的 bash 錯誤崩掉、而不是告訴你怎麼修——唯一會用到那條訊息的情境,
//    正好是它壞掉的情境。
//
//    「守門機制要定期實證它還活著」是條紀律,本測試就是那條規則再上一層的機器化:
//    **在拋棄式 repo 裡真的跑一次腳本**。
//
//    每條負向斷言都配一條正對照(沒有正對照的負向測試是假綠)。

import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf-8",
}).trim();

/**
 * 把 global／system git config 切斷。少了這層,若宿主機或 CI runner 設了
 * global `core.hooksPath`,「沒設」那條負對照會讀到 global 值 → 測試仍綠但
 * **測到的不是它宣稱的情境**＝假綠。
 */
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
};

const created: string[] = [];
afterEach(() => {
  while (created.length) rmSync(created.pop()!, { recursive: true, force: true });
});

/** 建一個拋棄式 git repo,把真的守門腳本與 hooks 複製進去,預設是「健康」狀態。 */
function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "check-hooks-"));
  created.push(dir);
  execFileSync("git", ["init", "-q", dir], { env: GIT_ENV });
  mkdirSync(join(dir, "scripts", "git-hooks"), { recursive: true });
  copyFileSync(join(repoRoot, "scripts/check-hooks.sh"), join(dir, "scripts/check-hooks.sh"));
  for (const f of ["pre-commit", "pre-push", "code-pattern.sh"]) {
    copyFileSync(join(repoRoot, "scripts/git-hooks", f), join(dir, "scripts/git-hooks", f));
  }
  chmodSync(join(dir, "scripts/git-hooks/pre-commit"), 0o755);
  chmodSync(join(dir, "scripts/git-hooks/pre-push"), 0o755);
  execFileSync("git", ["-C", dir, "config", "--local", "core.hooksPath", "scripts/git-hooks"], {
    env: GIT_ENV,
  });
  return dir;
}

function runGate(dir: string) {
  const r = spawnSync("bash", ["scripts/check-hooks.sh"], {
    cwd: dir,
    encoding: "utf-8",
    env: GIT_ENV,
  });
  return { code: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
}

describe("check-hooks.sh — 守門腳本自己的 liveness", () => {
  it("🔴 正對照:hooks 健康時**真的能 exit 0**(缺正對照的守門會靜靜失效很久)", () => {
    const { code, out, err } = runGate(makeRepo());
    expect(err).toBe("");
    expect(out).toContain("✅");
    expect(code).toBe(0);
  });

  it("🔴 hooksPath 指錯地方 → 必須印出修法訊息,不是崩掉", () => {
    const dir = makeRepo();
    execFileSync("git", ["-C", dir, "config", "--local", "core.hooksPath", "scripts/nope"], {
      env: GIT_ENV,
    });
    const { code, err } = runGate(dir);
    expect(code).toBe(1);
    // 崩掉的話這裡會是 bash 的 unbound variable,而不是給人看的修法
    expect(err).not.toMatch(/unbound variable|command not found/);
    expect(err).toContain("setup-hooks");
    expect(err).toContain("core.hooksPath");
  });

  it("hooksPath 沒設 → exit 1 並說「沒設」", () => {
    const dir = makeRepo();
    execFileSync("git", ["-C", dir, "config", "--local", "--unset", "core.hooksPath"], {
      env: GIT_ENV,
    });
    const { code, err } = runGate(dir);
    expect(code).toBe(1);
    expect(err).toContain("沒設");
    expect(err).not.toMatch(/unbound variable/);
  });

  it("hook 少了可執行位元 → exit 1(git 會靜默不執行它,是真實踩過的失效模式)", () => {
    const dir = makeRepo();
    chmodSync(join(dir, "scripts/git-hooks/pre-commit"), 0o644);
    const { code, err } = runGate(dir);
    expect(code).toBe(1);
    expect(err).toContain("可執行位元");
  });

  // 🔴 兩個 SSOT 變數各驗一條:原本只驗 NON_CODE_PATTERN 缺失,但測試名宣稱的是
  //    「變數被改名／打錯字」——只驗一半＝宣稱過度。誤刪 PROTECTED_DOCS 會讓
  //    PR-only 的策略／安全文件被 hook 放行,那是獨立的失效模式。
  it("SSOT 少了 NON_CODE_PATTERN → exit 1(兩支 hook 會靜默放行 code)", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "scripts/git-hooks/code-pattern.sh"), "PROTECTED_DOCS='CLAUDE[.]md'\n");
    const { code, err } = runGate(dir);
    expect(code).toBe(1);
    // 🔴 必須斷言「給人看的那句」而不是只 toContain 變數名——變數未定義時 bash 的
    //    `NON_CODE_PATTERN: unbound variable` 也含這個字串,會讓斷言因崩潰而通過。
    expect(err).not.toMatch(/unbound variable/);
    expect(err).toContain("沒有定義 NON_CODE_PATTERN");
    expect(err).toContain("setup-hooks");
  });

  it("SSOT 少了 PROTECTED_DOCS → exit 1(PR-only 文件會被放行)", () => {
    const dir = makeRepo();
    writeFileSync(
      join(dir, "scripts/git-hooks/code-pattern.sh"),
      "NON_CODE_PATTERN='[.](md|html)$'\n",
    );
    const { code, err } = runGate(dir);
    expect(code).toBe(1);
    expect(err).not.toMatch(/unbound variable/); // 同上:崩潰訊息也含變數名
    expect(err).toContain("沒有定義 PROTECTED_DOCS");
    expect(err).toContain("setup-hooks");
  });

  it("SSOT 少了 TOOL_ARTIFACT_PATTERN → exit 1(工具產物守門會靜默失效;錯訊在既有冒煙測試之後)", () => {
    const dir = makeRepo();
    writeFileSync(
      join(dir, "scripts/git-hooks/code-pattern.sh"),
      "NON_CODE_PATTERN='[.](md|html)$'\nPROTECTED_DOCS='^CLAUDE[.]md$'\n",
    );
    const { code, err } = runGate(dir);
    expect(code).toBe(1);
    expect(err).not.toMatch(/unbound variable/);
    expect(err).toContain("沒有定義 TOOL_ARTIFACT_PATTERN");
  });

  it("code-pattern.sh 有語法錯誤(source 失敗)→ exit 1", () => {
    const dir = makeRepo();
    writeFileSync(join(dir, "scripts/git-hooks/code-pattern.sh"), "if [ ; then\n");
    const { code, err } = runGate(dir);
    expect(code).toBe(1);
    expect(err).toContain("無法 source");
  });

  // 🔴 Codex R1 P1:code-pattern.sh 若因誤貼、被人動過而含 `exit 0`,主 shell 直接
  //    `.` source 會**立刻退出**整支 check-hooks.sh、後續變數存在檢查與冒煙測試
  //    全部 skip、命令卻回傳 0——「hooks 活著」的宣稱與現實脫節。
  //    修法把 source 移到 subshell + sentinel;這條就是那個修法的正對照。
  it("🔴 code-pattern.sh 含 `exit 0` → 不得靜默放行(前面 source 退出後續斷言都 skip)", () => {
    const dir = makeRepo();
    writeFileSync(
      join(dir, "scripts/git-hooks/code-pattern.sh"),
      // 誤貼 exit 0 在最頂端;若主 shell 直接 source 這行會讓 check-hooks.sh 也 exit 0
      "exit 0\nNON_CODE_PATTERN='[.](md|html)$'\nPROTECTED_DOCS='CLAUDE[.]md'\n",
    );
    const { code, err } = runGate(dir);
    expect(code).toBe(1);
    expect(err).toContain("提早退出");
    expect(err).toContain("setup-hooks");
  });

  // 🔴 Codex R2 P1(R1 fix 引入的新表面):R1 版用 `\n` 分隔 subshell 輸出,
  //    如果 pattern 本身**含換行**、父端會把 pattern 的第二半誤讀成 PROTECTED_DOCS、
  //    真正的 PROTECTED_DOCS 內容漂到第 4 行被丟掉。冒煙測試仍可能過、命令 exit 0,
  //    但 SSOT 已經死了。修法改為每個欄位 base64 單行編碼,並斷言輸出行數;
  //    base64 解碼後,多行 pattern 會完整還原。這條就是那條防護的正對照。
  it("🔴 code-pattern.sh 定義多行 pattern → 不得欄位錯位(base64 encode 保護位置對齊)", () => {
    const dir = makeRepo();
    writeFileSync(
      join(dir, "scripts/git-hooks/code-pattern.sh"),
      // NON_CODE_PATTERN 含真實換行(bash `$'...'` 語法)
      "NON_CODE_PATTERN=$'\\.md$\\n^CLAUDE\\.md$'\nPROTECTED_DOCS='NO_MATCH'\n",
    );
    const { code, err } = runGate(dir);
    expect(code).toBe(1);
    expect(err).not.toMatch(/unbound variable/); // 不是崩潰
    // base64 encode 後多行 pattern 會完整還原 → 走到冒煙檢查:
    // PROTECTED_DOCS='NO_MATCH' 對 CLAUDE.md 完全不 match → 冒煙 fail-closed
    expect(err).toContain("對不到 CLAUDE.md");
  });

  it("🔴 code-pattern.sh 用 `return` 提早退出、變數還沒定義 → fail-closed", () => {
    const dir = makeRepo();
    writeFileSync(
      join(dir, "scripts/git-hooks/code-pattern.sh"),
      // return 終止 source、變數定義那兩行不會被跑
      "return 0\nNON_CODE_PATTERN='[.](md|html)$'\nPROTECTED_DOCS='CLAUDE[.]md'\n",
    );
    const { code, err } = runGate(dir);
    expect(code).toBe(1);
    // return 在 sourced 檔是合法的:它終止該次 source,回到父 script。
    // 於是 sentinel 有印(subshell 沒退)、但變數空。應被「NON_CODE_PATTERN 沒有定義」
    // 或「PROTECTED_DOCS 沒有定義」擋住——**變數缺失分支也是 fail-closed 的一種**。
    expect(err).toContain("沒有定義");
    expect(err).not.toMatch(/unbound variable/); // 不是崩潰
  });

  /**
   * 這個檔算不算 shell 腳本?**純函式,單獨測得到**(選檔規則的完整性不能只靠
   * 「三個既有檔案有被找到」這種正對照)。
   *
   * 認定:⑴ 副檔名 `.sh` / `.bash` / `.zsh` / `.ksh`,或 ⑵ shebang 的**任一個 token**
   * 的 basename 落在 sh 家族。
   *
   * 🔴 **比對 basename 不是子字串**——`fish` / `pwsh` 都含 "sh"。
   * 🔴 **刻意不去解析 `env` 的每一個旗標**:`env -S -u NAME bash`、
   *    `env -C DIR bash` 這些**會吃掉下一個 token** 的選項,逐一支援等於把測試輔助函式
   *    做成 env 的 clone,而且永遠會有下一種寫法漏掉——**那才是假綠的來源**。
   *    改成「只要 shebang 裡出現過 sh 家族的執行檔名就納入」。
   *    **取捨方向是刻意的**:漏掉一支腳本會讓這道掃描形同虛設(假綠),多收一個檔只是
   *    多一次人工確認。
   *
   * ⚠️ **會誤報,這是刻意接受的代價**:
   *    ⑴ 非 shell 檔若 shebang 夾帶 `bash` 這種字會被多收,而它正文裡合法的
   *       `"$price(TWD)"` 會被這條 regex 抓到;⑵ 就算是真的 shell 腳本,寫在**註解或
   *       單引號字串**裡的 `$var(` 其實無害——這條掃描**不理解 shell 語法**。
   *    所以錯誤訊息**不會**叫你無腦改成大括號形式,而是要求人工確認那一處是不是真的會展開。
   */
  const SH_FAMILY = ["sh", "bash", "zsh", "ksh", "dash"];
  const basename = (t: string) => t.split("/").pop() ?? "";
  function isShellScript(rel: string, firstLine: string): boolean {
    if (/\.(sh|bash|zsh|ksh)$/.test(rel)) return true;
    const m = /^#!\s*(.+)$/.exec(firstLine);
    if (!m) return false;
    return m[1]
      .trim()
      .split(/\s+/)
      .some((t) => SH_FAMILY.includes(basename(t)));
  }

  /** 掃描範圍＝**全 repo** 被 git 追蹤的檔(不是只有 `scripts/`)。 */
  const shellScripts = execFileSync("git", ["ls-files"], {
    cwd: repoRoot,
    encoding: "utf-8",
  })
    .split("\n")
    .filter(Boolean)
    .filter((rel) => {
      // 🔴 **刻意沒有前置過濾**:第一版先用「有 shell 副檔名或沒有副檔名」篩掉大部分
      //    檔案,但那讓 `tools/deploy.prod`(帶點的檔名 ＋ bash shebang)在進到
      //    `isShellScript()` 之前就被排除——**規則被切成兩半,而只有其中一半被測到**。
      //    現在每個追蹤檔都讀第一行,判定**完全由那支純函式決定**,它的測試就是完整的。
      let firstLine = "";
      try {
        firstLine = readFileSync(join(repoRoot, rel), "utf-8").split("\n")[0];
      } catch {
        return false; // 二進位／讀不到 → 不是 shell 腳本
      }
      return isShellScript(rel, firstLine);
    });

  /**
   * 🔴 **從「只掃 check-hooks.sh」改成掃 repo 裡每一支 shell 腳本。**
   *
   * 原本這條的標題自稱「本次 bug class 的**全面**掃描」,實際上**只掃一個檔**——
   * 於是 `pre-commit` 與 `pre-push` 一路帶著同樣的雷,直到真的踩到才發現:守門
   * **擋是擋住了(fail-closed)**,但印的是 `line 70: branch: unbound variable`,
   * 而不是「你在保護分支上,請開 feature 分支」——**唯一會用到那條訊息的情境,
   * 正好是它壞掉的情境**(與本檔檔頭記的是同一個諷刺)。
   *
   * ⚠️ 誠實界線:只抓「`$var` 直接接非 ASCII」這一種寫法(`${var}` 一律安全);
   * 其他 quoting 問題不在守備範圍。
   */
  it("正對照:選檔器本身——認得 shell、不誤收 fish／pwsh", () => {
    // 少了這條,選檔規則寫壞(例如永遠回 false)下面那條會永遠綠。
    expect(isShellScript("scripts/check-hooks.sh", "#!/usr/bin/env bash")).toBe(true);
    expect(isShellScript("scripts/lib/foo.bash", "")).toBe(true);
    expect(isShellScript("tools/deploy.zsh", "")).toBe(true);
    expect(isShellScript("scripts/git-hooks/pre-commit", "#!/usr/bin/env bash")).toBe(true);
    expect(isShellScript("scripts/git-hooks/pre-push", "#!/bin/sh")).toBe(true);
    // 🔴 `includes("sh")` 會把這兩個誤收——那正是第一版的 bug
    expect(isShellScript("scripts/thing", "#!/usr/bin/env fish")).toBe(false);
    expect(isShellScript("scripts/thing", "#!/usr/bin/pwsh")).toBe(false);
    expect(isShellScript("scripts/mutate.ts", "#!/usr/bin/env node")).toBe(false);
    expect(isShellScript("README.md", "")).toBe(false);
    // 🔴 帶點的檔名也可能是 shell(第一版的前置過濾會在這裡就把它排除掉)
    expect(isShellScript("tools/deploy.prod", "#!/usr/bin/env bash")).toBe(true);
    // 🔴 `env` 的各種寫法都不能讓它漏掉——包含**會吃掉下一個 token** 的選項
    expect(isShellScript("tools/x", "#!/usr/bin/env -S bash -e")).toBe(true);
    expect(isShellScript("tools/x", "#!/usr/bin/env FOO=1 bash")).toBe(true);
    expect(isShellScript("tools/x", "#!/usr/bin/env -S -u BASH_ENV bash")).toBe(true);
    expect(isShellScript("tools/x", "#!/usr/bin/env -C /tmp bash")).toBe(true);
    expect(isShellScript("tools/x", "#!/usr/bin/env -S node --experimental-strip-types")).toBe(false);
  });

  it("正對照:真的掃到了 shell 腳本(不是掃了空集合而空過)", () => {
    expect(shellScripts.length).toBeGreaterThanOrEqual(3);
    expect(shellScripts).toContain("scripts/check-hooks.sh");
    expect(shellScripts).toContain("scripts/git-hooks/pre-commit");
    expect(shellScripts).toContain("scripts/git-hooks/pre-push");
  });

  it("🔴 **全 repo** 每一支 shell 腳本都沒有 `$VAR` 直接接非 ASCII(bash 3.2 會把它吃進變數名)", () => {
    const offenders: string[] = [];
    for (const rel of shellScripts) {
      readFileSync(join(repoRoot, rel), "utf-8")
        .split("\n")
        .forEach((line, i) => {
          if (/\$[A-Za-z_][A-Za-z0-9_]*[^\x00-\x7F]/.test(line)) {
            offenders.push(`${rel}:${i + 1}  ${line.trim().slice(0, 70)}`);
          }
        });
    }
    expect(
      offenders,
      "逐一人工確認:那一處真的會被 shell 展開嗎?會 → 改成大括號形式(dollar + {var});" +
        "在註解／單引號字串裡、或根本不是 shell 檔 → 這是本掃描已知的誤報,把檔案排除或調整判定。",
    ).toEqual([]);
  });
});

// ══════════ pre-commit 行為級測試:TOOL_ARTIFACT_PATTERN 在任何分支都擋(真 git commit)══════════
describe("pre-commit — 工具產物守門(git add -A 誤加 untracked 的機器化)", () => {
  function gitc(dir: string, ...a: string[]): { code: number; err: string } {
    const r = spawnSync("git", ["-C", dir, ...a], { encoding: "utf-8" });
    return { code: r.status ?? 1, err: r.stderr };
  }
  function repoOnFeature(): string {
    const dir = makeRepo();
    gitc(dir, "config", "user.email", "t@example.test");
    gitc(dir, "config", "user.name", "t");
    writeFileSync(join(dir, "README.md"), "x\n");
    // 第一道:.gitignore(與本 repo 相同三條);測試用 `add -f` 就是在模擬「ignore 被繞過」
    writeFileSync(join(dir, ".gitignore"), ".codegraph/\n.gbrain-source\n_handoffs/\n");
    gitc(dir, "add", "README.md", ".gitignore");
    expect(gitc(dir, "commit", "-q", "-m", "init").code).toBe(0);
    gitc(dir, "checkout", "-q", "-b", "feature/x");
    return dir;
  }
  it("第一道:.gitignore 真的 ignore 三條路徑(check-ignore);不加 -f 的 git add 對它們無效", () => {
    const dir = repoOnFeature();
    mkdirSync(join(dir, ".codegraph"), { recursive: true });
    writeFileSync(join(dir, ".codegraph/index.db"), "bin");
    writeFileSync(join(dir, ".gbrain-source"), "x");
    for (const rel of [".codegraph/index.db", ".gbrain-source", "_handoffs/x.md"]) {
      expect(gitc(dir, "check-ignore", "-q", rel).code, rel).toBe(0);
    }
    gitc(dir, "add", "-A");
    const staged = spawnSync("git", ["-C", dir, "diff", "--cached", "--name-only"], { encoding: "utf-8" }).stdout;
    expect(staged).not.toContain(".codegraph");
    expect(staged).not.toContain(".gbrain-source");
  });
  it("🔴 C1:非 ASCII 檔名(core.quotePath 會加引號)照樣被擋;C2:git rm --cached 清理產物放行;I3:巢狀路徑也擋", () => {
    const dir = repoOnFeature();
    mkdirSync(join(dir, ".codegraph"), { recursive: true });
    writeFileSync(join(dir, ".codegraph/中文.db"), "bin");
    gitc(dir, "add", "-f", ".codegraph/中文.db");
    let r = gitc(dir, "commit", "-q", "-m", "oops");
    expect(r.code).toBe(1);
    expect(r.err).toContain("TOOL_ARTIFACT_PATTERN");
    // 已誤入版控的產物:用 --no-verify 模擬歷史,再驗清理路徑放行
    expect(gitc(dir, "commit", "-q", "--no-verify", "-m", "legacy").code).toBe(0);
    gitc(dir, "rm", "-q", "--cached", ".codegraph/中文.db");
    r = gitc(dir, "commit", "-q", "-m", "cleanup");
    expect(r.code, r.err).toBe(0);
    mkdirSync(join(dir, "packages/app/.codegraph"), { recursive: true });
    writeFileSync(join(dir, "packages/app/.codegraph/x"), "bin");
    gitc(dir, "add", "-f", "packages/app/.codegraph/x");
    r = gitc(dir, "commit", "-q", "-m", "nested");
    expect(r.code).toBe(1);
    expect(r.err).toContain("packages/app/.codegraph/x");
  });
  it("🔴 feature 分支 stage .codegraph/ 檔 → commit 被擋(exit 1、訊息點名路徑與修法)", () => {
    const dir = repoOnFeature();
    mkdirSync(join(dir, ".codegraph"), { recursive: true });
    writeFileSync(join(dir, ".codegraph/index.db"), "bin");
    writeFileSync(join(dir, "src.ts"), "export {}\n");
    gitc(dir, "add", "-f", ".codegraph/index.db", "src.ts"); // fixture 有 .gitignore,-f 模擬 ignore 被繞過
    const r = gitc(dir, "commit", "-q", "-m", "oops");
    expect(r.code).toBe(1);
    expect(r.err).toContain("TOOL_ARTIFACT_PATTERN");
    expect(r.err).toContain(".codegraph/index.db");
    expect(r.err).toContain("git restore --staged");
  });
  it("正對照:feature 分支只 stage 一般檔 → commit 通過;.gbrain-source / _handoffs/ 各自也擋", () => {
    const dir = repoOnFeature();
    writeFileSync(join(dir, "src.ts"), "export {}\n");
    gitc(dir, "add", "src.ts");
    expect(gitc(dir, "commit", "-q", "-m", "ok").code).toBe(0);
    for (const rel of [".gbrain-source", "_handoffs/HANDOFF.md"]) {
      mkdirSync(join(dir, rel.split("/").slice(0, -1).join("/") || "."), { recursive: true });
      writeFileSync(join(dir, rel), "x");
      gitc(dir, "add", "-f", rel);
      const r = gitc(dir, "commit", "-q", "-m", "oops");
      expect(r.code, rel).toBe(1);
      gitc(dir, "restore", "--staged", rel);
    }
  });
});
