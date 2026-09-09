#!/usr/bin/env tsx
// scripts/run-mutation-smoke.ts
//
// Sprint 21 C3 引入:CTRL-CI-016 Mutation Kill Smoke Check。
//
// 目的:對 pinned 6 條 smoke probe、CI 自動 apply mutation + 跑 pinned test + assert mutant killed。
//
// ⚠️ 誠實邊界(不變量、三處 SSOT 對齊 catalog notes / ADOPTION §5.2 / CI step comment):
//   - 本 gate 是 **accidental-regression signal**、非 **malicious-PR security boundary**
//   - CI wiring(此檔 / manifest / test / workflow / package.json)都 PR-controllable
//   - Machine gate **不對抗** PR wiring 修改
//   - **durable evidence boundary**(Step 4 Codex 校正、live-probe-only、不由 config
//     或某次 probe snapshot 靜態推論):
//     (1) **遠端 enforcement 是 live GitHub state**:必須以 `gh api /repos/.../
//         branches/main/protection` + `/rules/branches/main` + `/branches/main`
//         的 live probe 現場確認;不能由 config 靜態推論、不能由某次 probe snapshot
//         宣稱永久狀態(本 header 不宣稱目前已啟用或未部署)
//     (2) **template config `githubGovernanceRequired:false`** 僅表示 adopter
//         requirement default(本模板對下游 adopter 沒硬性要求):不能由此推論
//         template repo 自身有或無 GitHub-side enforcement
//     (3) **schedule A-D audit(CTRL-GOV-005 / CTRL-CI-015)**:僅在
//         `BRANCH_PROTECTION_TOKEN` 已設 **且** schedule workflow 實際成功時才提供
//         evidence;此 evidence **非** per-PR required check
//     (4) **手動 SOP practices(不論 remote 部署與否都適用、本身非 GitHub-enforced)**:
//         (a) protected-path human review(SOP 紀律,非 GitHub protection rule)+
//         (b) Owner 稽核 GOV-005 / CI-015 daily schedule drift(Actions tab manual
//         review、非 active gate)
//     (5) **per-PR A-D verification / malicious-PR defense**:需 PR-head verifier +
//         另議部署,out-of-scope、本 harness 尚未提供
//   - ⚠️ 舊 wording「唯一防線 = required-check(GOV-005 + CI-015)」不成立:GOV-005 /
//     CI-015 皆 schedule-only、不在 PR head 執行、不能作 required status check
//
// Algorithm(7 步、fail-closed):
//   1. Read + validate manifest schema(cardinality/duplicate/set-equality)
//   2. Verify clean tree + capture startHEAD
//   3. Verify SMOKE_PROBES entry fingerprints(full entry canonical JSON SHA-256)
//   4. Pre-control(runner-level defense-in-depth):unique testSuite 跑、必須全綠
//   5. 每 probe loop:spawn mutate.ts argv-safe、collect exit code
//   6. Post-control:再跑 unique testSuite、驗 restore idempotent
//   7. Verify tree + HEAD + summary + exit
//
// Exit:
//   0 = 全 killed
//   1 = 任一 survived(mutant 未被 kill)
//   2 = indeterminate(schema / fingerprint / control / restore / timeout / infra)

import { spawnSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { detectInvocation, reportIfNotMain } from "./lib/invoked-as-main";

// ─────────────────────────────────────────────────────────────
// SMOKE_PROBES 硬編碼(承 Sprint 21 plan r6、fingerprint verified against
// immutable f51483d18a4f4cba6da4682ef75a8cd05448466e = Sprint 20 squash tip)
// ─────────────────────────────────────────────────────────────

type SmokeProbe = {
  spec: string; // exact hardcoded spec path
  index: number; // exact hardcoded index
  expectedEntryFingerprint: string; // SHA-256 of canonical JSON of {file, find, replace, label}
  testSuite: readonly string[]; // exact test files
};

// Canonical fingerprint algorithm(runner + plan review 共用):
//   input = { file, find, replace, label }
//   canonical = JSON.stringify(input, ["file", "find", "label", "replace"])  // alphabetical key order via allowlist
//   fingerprint = SHA-256(canonical) as lowercase hex
export function computeEntryFingerprint(entry: {
  file: string;
  find: string;
  replace: string;
  label: string;
}): string {
  const canonical = JSON.stringify(entry, ["file", "find", "label", "replace"]);
  return createHash("sha256").update(canonical).digest("hex");
}

export const SMOKE_PROBES: Record<string, SmokeProbe> = {
  "branch-protection-P1": {
    spec: "scripts/mutations/branch-protection.json",
    index: 0,
    expectedEntryFingerprint:
      "36d0789e5b8a7263ac6be732254682821ac10b83374d89752d618a8eb3da630b",
    testSuite: [
      "tests/branch-protection.test.ts",
      "tests/check-branch-protection.e2e.test.ts",
    ],
  },
  "destructive-guard-P1": {
    spec: "scripts/mutations/destructive-guard.json",
    index: 0,
    expectedEntryFingerprint:
      "49cbd57e7bd92d1fb1fa9d3472e7199e10a3db8e3c290f4b39aa18102cff375d",
    testSuite: ["tests/destructive-guard.test.ts"],
  },
  "protectedbranches-drift-P1": {
    spec: "scripts/mutations/protectedbranches-drift.json",
    index: 0,
    expectedEntryFingerprint:
      "11942657a0b81d40c72feeb5d1c0d2ada8bed99c5fdf678e5fcdcb81a0b4d22f",
    testSuite: [
      "tests/protectedbranches-drift.test.ts",
      "tests/check-protectedbranches-drift.e2e.test.ts",
    ],
  },
  "mutation-spec-drift-P1": {
    spec: "scripts/mutations/mutation-spec-drift.json",
    index: 0,
    expectedEntryFingerprint:
      "7d0c294139cee9471d198ed9a674b2f4ffe87af4eda7e377f1e98f1886fbb52d",
    testSuite: ["tests/check-mutation-specs.test.ts"],
  },
  "mutation-spec-discovery-P1": {
    spec: "scripts/mutations/mutation-spec-discovery.json",
    index: 0,
    expectedEntryFingerprint:
      "c2e7f61d6021b75c1cbd360e7513218d281f17f218059710ed2578d3dc00c0d1",
    testSuite: ["tests/check-mutation-specs.test.ts"],
  },
  "baseline-governance-P1": {
    spec: "scripts/mutations/baseline-governance.json",
    index: 0,
    expectedEntryFingerprint:
      "9a681b12de0156239b71da961199971405a1e21e78b2538b431a9827f2c68b3b",
    testSuite: ["tests/check-baseline-governance.e2e.test.ts"],
  },
};

const PROBE_ID_REGEX = /^[a-z][a-z0-9-]*-P[0-9]+$/;
const PER_PROBE_TIMEOUT_MS = 60_000;
const SIGKILL_GRACE_MS = 5_000; // SIGTERM → wait grace → SIGKILL (承 mutate.ts groupKill discipline)

// ─────────────────────────────────────────────────────────────
// Schema + fingerprint validation
// ─────────────────────────────────────────────────────────────

export type SmokeManifest = {
  $schema: string;
  probeIds: string[];
};

export type SchemaError = { kind: "schema"; message: string };
export type FingerprintError = {
  kind: "fingerprint";
  probeId: string;
  expected: string;
  actual: string;
};

export function validateManifest(
  raw: unknown,
  smokeProbes: Record<string, SmokeProbe> = SMOKE_PROBES,
): SmokeManifest | SchemaError {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { kind: "schema", message: "manifest must be a JSON object" };
  }
  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  const allowed = new Set(["$schema", "probeIds"]);
  for (const k of keys) {
    if (!allowed.has(k)) {
      return {
        kind: "schema",
        message: `unexpected top-level key ${JSON.stringify(k)}(only $schema + probeIds allowed)`,
      };
    }
  }
  if (obj.$schema !== "smoke-manifest v1") {
    // F6 pin: 未來 schema 升級需明確 code diff;不接受任意 string
    return { kind: "schema", message: `$schema must be exactly "smoke-manifest v1", got ${JSON.stringify(obj.$schema)}` };
  }
  if (!Array.isArray(obj.probeIds)) {
    return { kind: "schema", message: "probeIds must be an array" };
  }
  const ids = obj.probeIds;
  for (const id of ids) {
    if (typeof id !== "string") {
      return {
        kind: "schema",
        message: `probeIds contains non-string entry ${JSON.stringify(id)}`,
      };
    }
    if (!PROBE_ID_REGEX.test(id)) {
      return {
        kind: "schema",
        message: `probeId ${JSON.stringify(id)} does not match /^[a-z][a-z0-9-]*-P[0-9]+$/`,
      };
    }
    if (!(id in smokeProbes)) {
      return {
        kind: "schema",
        message: `probeId ${JSON.stringify(id)} not in SMOKE_PROBES allowlist`,
      };
    }
  }
  const expectedKeys = Object.keys(smokeProbes);
  if (ids.length !== expectedKeys.length) {
    return {
      kind: "schema",
      message: `probeIds.length = ${ids.length}, expected ${expectedKeys.length}(cardinality violation)`,
    };
  }
  const idSet = new Set(ids as string[]);
  if (idSet.size !== ids.length) {
    return {
      kind: "schema",
      message: `probeIds contains duplicates(size ${idSet.size} vs length ${ids.length})`,
    };
  }
  const expectedSet = new Set(expectedKeys);
  for (const id of expectedSet) {
    if (!idSet.has(id)) {
      return {
        kind: "schema",
        message: `probeIds missing required probe ${JSON.stringify(id)}(set-equality violation)`,
      };
    }
  }
  return { $schema: obj.$schema, probeIds: ids as string[] };
}

export function verifyFingerprints(
  manifest: SmokeManifest,
  repoRoot: string,
  smokeProbes: Record<string, SmokeProbe> = SMOKE_PROBES,
): null | FingerprintError {
  for (const probeId of manifest.probeIds) {
    const probe = smokeProbes[probeId];
    const specPath = path.join(repoRoot, probe.spec);
    let specRaw: string;
    try {
      specRaw = readFileSync(specPath, "utf8");
    } catch (e) {
      return {
        kind: "fingerprint",
        probeId,
        expected: probe.expectedEntryFingerprint,
        actual: `ENOENT ${probe.spec}: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    let entries: Array<{ file: string; find: string; replace: string; label: string }>;
    try {
      const parsed = JSON.parse(specRaw);
      entries = Array.isArray(parsed) ? parsed : parsed.probes;
    } catch (e) {
      return {
        kind: "fingerprint",
        probeId,
        expected: probe.expectedEntryFingerprint,
        actual: `parse error: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    const entry = entries[probe.index];
    if (!entry) {
      return {
        kind: "fingerprint",
        probeId,
        expected: probe.expectedEntryFingerprint,
        actual: `index ${probe.index} out of range(spec has ${entries.length} entries)`,
      };
    }
    const actual = computeEntryFingerprint({
      file: entry.file,
      find: entry.find,
      replace: entry.replace,
      label: entry.label,
    });
    if (actual !== probe.expectedEntryFingerprint) {
      return {
        kind: "fingerprint",
        probeId,
        expected: probe.expectedEntryFingerprint,
        actual,
      };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Git helpers(shell-safe)
// ─────────────────────────────────────────────────────────────

function gitStatusPorcelain(cwd: string): string {
  const r = spawnSync("git", ["status", "--porcelain"], {
    cwd,
    encoding: "utf8",
    shell: false,
  });
  if (r.status !== 0) {
    return `<git status failed: ${r.stderr}>`;
  }
  return r.stdout;
}

function gitRevParseHead(cwd: string): string {
  const r = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
    shell: false,
  });
  if (r.status !== 0) {
    throw new Error(`git rev-parse HEAD failed: ${r.stderr}`);
  }
  return r.stdout.trim();
}

// ─────────────────────────────────────────────────────────────
// Test suite runner(spawn argv-safe)
// ─────────────────────────────────────────────────────────────

export async function runTestSuite(
  testFiles: readonly string[],
  cwd: string,
): Promise<{ exitCode: number; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn("npx", ["vitest", "run", ...testFiles], {
      cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.stdout.on("data", () => {}); // drain to avoid backpressure
    proc.on("exit", (code) => {
      resolve({ exitCode: code ?? -1, stderr });
    });
    proc.on("error", () => {
      resolve({ exitCode: -1, stderr: "spawn error" });
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Per-probe mutate.ts runner
// ─────────────────────────────────────────────────────────────

export type ProbeResult = {
  probeId: string;
  exitCode: number; // mutate.ts exit code: 0=killed, 1=survived, 2=indeterminate
  durationMs: number;
  stderr: string;
};

export async function runProbe(
  probeId: string,
  entry: { file: string; find: string; replace: string; label: string },
  testSuite: readonly string[],
  cwd: string,
): Promise<ProbeResult> {
  const testCmd = ["npx", "vitest", "run", ...testSuite].join(" ");
  const start = Date.now();
  return new Promise((resolve) => {
    // detached: true → 新 process group;timeout 時對負 PID 送 signal、殺整個 group
    // (mutate.ts 內又 detached 起 test shell、只送 leader 可能漏)
    const proc = spawn(
      "npx",
      [
        "tsx",
        "scripts/mutate.ts",
        "--file",
        entry.file,
        "--find",
        entry.find,
        "--replace",
        entry.replace,
        "--label",
        entry.label,
        "--cmd",
        testCmd,
      ],
      {
        cwd,
        shell: false,
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    let timedOut = false;
    // Timeout escalation:對負 PID group 送 SIGTERM → grace → SIGKILL
    const groupKill = (sig: NodeJS.Signals) => {
      try {
        if (proc.pid !== undefined) {
          process.kill(-proc.pid, sig);
        }
      } catch {
        // group already gone
      }
    };
    const termTimer = setTimeout(() => {
      timedOut = true;
      groupKill("SIGTERM");
      const killTimer = setTimeout(() => {
        groupKill("SIGKILL");
      }, SIGKILL_GRACE_MS);
      proc.once("exit", () => clearTimeout(killTimer));
    }, PER_PROBE_TIMEOUT_MS);
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.stdout.on("data", () => {}); // drain
    proc.on("exit", (code, signal) => {
      clearTimeout(termTimer);
      const durationMs = Date.now() - start;
      if (timedOut || signal === "SIGKILL" || signal === "SIGTERM") {
        resolve({ probeId, exitCode: 2, durationMs, stderr: stderr + "\n<timeout>" });
      } else {
        resolve({ probeId, exitCode: code ?? 2, durationMs, stderr });
      }
    });
    proc.on("error", () => {
      clearTimeout(termTimer);
      resolve({ probeId, exitCode: 2, durationMs: Date.now() - start, stderr: "spawn error" });
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Main runner algorithm(7 steps)
// ─────────────────────────────────────────────────────────────

export type RunnerOutput = {
  exitCode: 0 | 1 | 2;
  message: string;
  perProbe?: ProbeResult[];
};

export type RunnerDeps = {
  runTestSuiteFn?: typeof runTestSuite;
  runProbeFn?: typeof runProbe;
  gitStatusFn?: (cwd: string) => string;
  gitHeadFn?: (cwd: string) => string;
};

export async function runMutationSmoke(opts: {
  manifestPath: string;
  cwd: string;
  smokeProbes?: Record<string, SmokeProbe>;
  deps?: RunnerDeps;
}): Promise<RunnerOutput> {
  const smokeProbes = opts.smokeProbes ?? SMOKE_PROBES;
  const testSuiteFn = opts.deps?.runTestSuiteFn ?? runTestSuite;
  const probeFn = opts.deps?.runProbeFn ?? runProbe;
  const statusFn = opts.deps?.gitStatusFn ?? gitStatusPorcelain;
  const headFn = opts.deps?.gitHeadFn ?? gitRevParseHead;

  // Step 1: read + validate manifest
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(opts.manifestPath, "utf8"));
  } catch (e) {
    return { exitCode: 2, message: `manifest read/parse: ${e instanceof Error ? e.message : String(e)}` };
  }
  const validated = validateManifest(raw, smokeProbes);
  if ("kind" in validated) {
    return { exitCode: 2, message: `manifest schema: ${validated.message}` };
  }
  const manifest = validated;

  // Step 2: verify clean tree + capture startHEAD
  const dirty = statusFn(opts.cwd).trim();
  if (dirty !== "") {
    return { exitCode: 2, message: `working tree not clean before smoke:\n${dirty}` };
  }
  let startHead: string;
  try {
    startHead = headFn(opts.cwd);
  } catch (e) {
    return { exitCode: 2, message: `capture startHEAD: ${e instanceof Error ? e.message : String(e)}` };
  }

  // Step 3: verify SMOKE_PROBES entry fingerprints
  const fpErr = verifyFingerprints(manifest, opts.cwd, smokeProbes);
  if (fpErr) {
    return {
      exitCode: 2,
      message: `fingerprint mismatch for ${fpErr.probeId}: expected ${fpErr.expected} got ${fpErr.actual}`,
    };
  }

  // Step 4: pre-control - unique test suites all green
  const uniqueTestSuites = new Set<string>();
  for (const probeId of manifest.probeIds) {
    for (const t of smokeProbes[probeId].testSuite) uniqueTestSuites.add(t);
  }
  const testSuiteArr = [...uniqueTestSuites];
  const preRes = await testSuiteFn(testSuiteArr, opts.cwd);
  if (preRes.exitCode !== 0) {
    return { exitCode: 2, message: `pre-control test suite red (exit ${preRes.exitCode}):\n${preRes.stderr.slice(-500)}` };
  }

  // Step 5: per-probe loop
  const perProbe: ProbeResult[] = [];
  for (const probeId of manifest.probeIds) {
    const probe = smokeProbes[probeId];
    const specRaw = readFileSync(path.join(opts.cwd, probe.spec), "utf8");
    const parsed = JSON.parse(specRaw);
    const entries = Array.isArray(parsed) ? parsed : parsed.probes;
    const entry = entries[probe.index];
    const result = await probeFn(probeId, entry, probe.testSuite, opts.cwd);
    perProbe.push(result);
  }

  // Step 6: post-control - re-run unique test suites, must be green (restore idempotent)
  const postRes = await testSuiteFn(testSuiteArr, opts.cwd);
  if (postRes.exitCode !== 0) {
    return {
      exitCode: 2,
      message: `post-control test suite red (exit ${postRes.exitCode}) — restore not idempotent:\n${postRes.stderr.slice(-500)}`,
      perProbe,
    };
  }

  // Step 7: verify tree + HEAD + summary + exit
  const dirtyPost = statusFn(opts.cwd).trim();
  if (dirtyPost !== "") {
    return { exitCode: 2, message: `working tree dirty after smoke:\n${dirtyPost}`, perProbe };
  }
  let endHead: string;
  try {
    endHead = headFn(opts.cwd);
  } catch (e) {
    return { exitCode: 2, message: `capture endHEAD: ${e instanceof Error ? e.message : String(e)}`, perProbe };
  }
  if (endHead !== startHead) {
    return { exitCode: 2, message: `HEAD changed during smoke: ${startHead} → ${endHead}`, perProbe };
  }

  const survived = perProbe.filter((r) => r.exitCode === 1);
  const indeterminate = perProbe.filter((r) => r.exitCode !== 0 && r.exitCode !== 1);
  if (survived.length > 0) {
    return {
      exitCode: 1,
      message: `${survived.length}/${perProbe.length} mutant(s) survived: ${survived.map((r) => r.probeId).join(", ")}`,
      perProbe,
    };
  }
  if (indeterminate.length > 0) {
    return {
      exitCode: 2,
      message: `${indeterminate.length}/${perProbe.length} probe(s) indeterminate: ${indeterminate.map((r) => `${r.probeId}(exit ${r.exitCode})`).join(", ")}`,
      perProbe,
    };
  }
  return {
    exitCode: 0,
    message: `all ${perProbe.length} smoke probes killed`,
    perProbe,
  };
}

function formatSummary(out: RunnerOutput): string {
  const lines: string[] = [];
  lines.push(`─────────────────────────────────────────`);
  lines.push(` Mutation Kill Smoke — exit ${out.exitCode}`);
  lines.push(`─────────────────────────────────────────`);
  lines.push(out.message);
  if (out.perProbe && out.perProbe.length > 0) {
    lines.push("");
    for (const r of out.perProbe) {
      const mark = r.exitCode === 0 ? "✅ killed" : r.exitCode === 1 ? "🔴 survived" : `⚠️  exit ${r.exitCode}`;
      lines.push(`  ${mark}  ${r.probeId}  (${r.durationMs} ms)`);
    }
  }
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────
// CLI entry point
// ─────────────────────────────────────────────────────────────

// ESM main 判定改用 scripts/lib/invoked-as-main.ts 共用 lib(P2#3 defer ①② 後續遷移):
// 兩端 realpath、indeterminate 由 caller 顯式 exit(2)、被當 import 用時完全靜默。
// macOS `/tmp` → `/private/tmp` 這種 symlink 目錄呼叫下,原本 path.resolve 對稱檢查
// 會判定 false → smoke runner silent exit 0(fail-open),已由 helper 兩端 realpath 修正。
const outcome = detectInvocation(import.meta.url, process.argv[1]);
const isMain = reportIfNotMain(outcome, "run-mutation-smoke");

if (isMain) {
  const cwd = process.cwd();
  const manifestPath = path.join(cwd, "scripts", "mutation-smoke-manifest.json");
  runMutationSmoke({ manifestPath, cwd }).then((out) => {
    process.stderr.write(formatSummary(out) + "\n");
    process.exit(out.exitCode);
  }).catch((e) => {
    process.stderr.write(`smoke runner crashed: ${e instanceof Error ? e.stack : String(e)}\n`);
    process.exit(2);
  });
} else if (outcome.kind === "indeterminate") {
  process.exit(2);
}
