// tests/check-protectedbranches-drift.e2e.test.ts — A3 defer ⑩ CTRL-CI-014 真 git fixture e2e
//
// 10 case:相同 / 擴大 / 縮小 / 重排 / base 缺 config / head 缺 config /
// base config JSON 壞 / merge-base 失敗 / argv 錯 / 大小寫差異(字面敏感)
//
// fixture:A(main,config protectedBranches=["main"])→ feature 分支 commit 動 config

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const REPO = path.resolve(__dirname, "..");
const TSX = path.join(REPO, "node_modules/.bin/tsx");
const SCRIPT = path.join(REPO, "scripts/check-protectedbranches-drift.ts");
const CONFIG_PATH = "scripts/harness.config.json";

function run(cwd: string, args: string[]): { code: number | null; out: string; err: string } {
  const r = spawnSync(TSX, [SCRIPT, ...args], { cwd, encoding: "utf-8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

const madeDirs: string[] = [];
afterAll(() => {
  for (const d of madeDirs) rmSync(d, { recursive: true, force: true });
});

function makeHarnessCfg(protectedBranches: string[], overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 2,
    mode: "template",
    projectId: "__TEMPLATE__",
    templatePackageName: "x",
    protectedBranches,
    deliveryBranches: protectedBranches.slice(0, 1).length > 0 ? protectedBranches.slice(0, 1) : ["main"],
    requiredAgentAdapters: ["claude"],
    githubGovernanceRequired: false,
    mergeStrategy: "squash",
    ...overrides,
  });
}

interface Fx {
  dir: string;
  A: string; // base commit(main tip、mb 那側)
  git: (...a: string[]) => string;
  write: (rel: string, text: string) => void;
  commit: (msg: string) => string;
}
function fixture(baseProtected: string[]): Fx {
  const dir = mkdtempSync(path.join(tmpdir(), "pbd-e2e-"));
  madeDirs.push(dir);
  const git = (...a: string[]) =>
    execFileSync("git", ["-C", dir, ...a], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const write = (rel: string, text: string) => {
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), text);
  };
  const commit = (msg: string): string => {
    git("add", "-A");
    git("commit", "-q", "-m", msg);
    return git("rev-parse", "HEAD");
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "e2e@example.test");
  git("config", "user.name", "e2e");
  write(CONFIG_PATH, makeHarnessCfg(baseProtected));
  write("README.md", "readme\n");
  const A = commit("A: initial config");
  git("checkout", "-q", "-b", "feature");
  return { dir, A, git, write, commit };
}

describe("check-protectedbranches-drift e2e(A3 defer ⑩ CTRL-CI-014)", () => {
  it("#1 相同 → exit 0(main main 相同)", () => {
    const fx = fixture(["main"]);
    fx.write("README.md", "changed\n");
    fx.commit("B: touch README");
    const r = run(fx.dir, [`--base=${fx.A}`]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("集合未擴大");
  });

  it("#2 擴大 → exit 2 + stderr 列 added", () => {
    const fx = fixture(["main"]);
    fx.write(CONFIG_PATH, makeHarnessCfg(["main", "release"]));
    fx.commit("B: add release to protectedBranches");
    const r = run(fx.dir, [`--base=${fx.A}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("集合擴大");
    expect(r.err).toContain('"release"');
  });

  it("#3 縮小 → exit 0(縮權允許)", () => {
    const fx = fixture(["main", "develop"]);
    fx.write(CONFIG_PATH, makeHarnessCfg(["main"]));
    fx.commit("B: remove develop");
    const r = run(fx.dir, [`--base=${fx.A}`]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("removed");
  });

  it("#4 重排 → exit 0", () => {
    const fx = fixture(["main", "develop"]);
    fx.write(CONFIG_PATH, makeHarnessCfg(["develop", "main"]));
    fx.commit("B: reorder");
    const r = run(fx.dir, [`--base=${fx.A}`]);
    expect(r.code).toBe(0);
    expect(r.out).toContain("無變更");
  });

  it("#5 merge-base 那側缺 config → exit 2", () => {
    // 建立 A 時**不**寫 CONFIG_PATH
    const dir = mkdtempSync(path.join(tmpdir(), "pbd-e2e-"));
    madeDirs.push(dir);
    const git = (...a: string[]) =>
      execFileSync("git", ["-C", dir, ...a], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    git("init", "-q", "-b", "main");
    git("config", "user.email", "e2e@example.test");
    git("config", "user.name", "e2e");
    writeFileSync(path.join(dir, "README.md"), "readme\n");
    git("add", "-A");
    git("commit", "-q", "-m", "A: no config");
    const A = git("rev-parse", "HEAD");
    git("checkout", "-q", "-b", "feature");
    mkdirSync(path.dirname(path.join(dir, CONFIG_PATH)), { recursive: true });
    writeFileSync(path.join(dir, CONFIG_PATH), makeHarnessCfg(["main"]));
    git("add", "-A");
    git("commit", "-q", "-m", "B: add config");
    const r = run(dir, [`--base=${A}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("讀不到");
  });

  it("#6 HEAD 缺 config → exit 2", () => {
    const fx = fixture(["main"]);
    // 刪 HEAD 側的 config
    fx.git("rm", "-q", CONFIG_PATH);
    fx.commit("B: remove config");
    const r = run(fx.dir, [`--base=${fx.A}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("讀不到");
  });

  it("#7 HEAD config JSON 壞 → exit 2 fail-closed", () => {
    const fx = fixture(["main"]);
    fx.write(CONFIG_PATH, "{not json");
    fx.commit("B: broken JSON");
    const r = run(fx.dir, [`--base=${fx.A}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("parse 失敗");
  });

  it("#8 merge-base 失敗(unrelated histories)→ exit 2", () => {
    const fx = fixture(["main"]);
    fx.write("README.md", "changed\n");
    fx.commit("B");
    // 傳一個完全不相關的 sha(隨機 40 字元 zero → 不存在)
    const r = run(fx.dir, [`--base=0000000000000000000000000000000000000000`]);
    expect(r.code).toBe(2);
    // git merge-base 對不存在 SHA 會 stderr fatal;script 走 mb.ok=false 分支
    expect(r.err).toMatch(/無法判定|merge-base|失敗/);
  });

  it("#9 argv 缺 --base → exit 2", () => {
    const fx = fixture(["main"]);
    fx.write("README.md", "b\n");
    fx.commit("B");
    const r = run(fx.dir, []);
    expect(r.code).toBe(2);
    expect(r.err).toContain("--base=<sha> 必填");
  });

  it("#10a --base=HEAD → exit 2(拒 branch ref、Codex Step 4 r1 P1 kill)", () => {
    const fx = fixture(["main"]);
    fx.write(CONFIG_PATH, makeHarnessCfg(["main", "release"]));
    fx.commit("B: expand");
    const r = run(fx.dir, ["--base=HEAD"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("必為 immutable 完整 40 字元 hex SHA");
  });

  it("#10b --base=origin/main → exit 2(拒 branch ref)", () => {
    const fx = fixture(["main"]);
    fx.write("README.md", "b\n");
    fx.commit("B");
    const r = run(fx.dir, ["--base=origin/main"]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("必為 immutable 完整 40 字元 hex SHA");
  });

  it("#10c --base=<短 SHA> → exit 2(拒短 SHA)", () => {
    const fx = fixture(["main"]);
    fx.write("README.md", "b\n");
    fx.commit("B");
    const r = run(fx.dir, [`--base=${fx.A.slice(0, 7)}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain("必為 immutable 完整 40 字元 hex SHA");
  });

  it("#10 大小寫差異(擴大 'Main' vs base 'main')→ exit 2(字面 Set 敏感、依 parseHarnessConfig 語意)", () => {
    // 「Main」與「main」是不同字面 → parseHarnessConfig 通過(LITERAL_BRANCH_RE 允許)
    // → Set 視為不同元素 → 擴大
    const fx = fixture(["main"]);
    fx.write(CONFIG_PATH, makeHarnessCfg(["main", "Main"]));
    fx.commit("B: add case-diff");
    const r = run(fx.dir, [`--base=${fx.A}`]);
    expect(r.code).toBe(2);
    expect(r.err).toContain('"Main"');
  });
});
