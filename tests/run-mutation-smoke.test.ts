// tests/run-mutation-smoke.test.ts
//
// Sprint 21 C3 CTRL-CI-016 mutation kill smoke runner tests。
// Unit:schema validation + fingerprint verify + runner algorithm 個別分支
// E2E:實跑 runner 對 immutable 6 條 smoke probe(全綠 path)

import { describe, expect, it } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
  validateManifest,
  computeEntryFingerprint,
  verifyFingerprints,
  runMutationSmoke,
  SMOKE_PROBES,
  type SmokeManifest,
  type ProbeResult,
} from "../scripts/run-mutation-smoke";

const REPO_ROOT = path.resolve(__dirname, "..");

describe("computeEntryFingerprint", () => {
  it("canonical JSON with alphabetical key order — file/find/label/replace", () => {
    const entry = { file: "a.ts", find: "x", replace: "y", label: "L" };
    const fp = computeEntryFingerprint(entry);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
    // 順序改變不影響(canonical stringify with allowlist enforces order)
    const entryReordered = { label: "L", replace: "y", find: "x", file: "a.ts" };
    expect(computeEntryFingerprint(entryReordered)).toBe(fp);
  });
  it("any field change → different fingerprint", () => {
    const base = { file: "a.ts", find: "x", replace: "y", label: "L" };
    const fpBase = computeEntryFingerprint(base);
    expect(computeEntryFingerprint({ ...base, file: "a2.ts" })).not.toBe(fpBase);
    expect(computeEntryFingerprint({ ...base, find: "x2" })).not.toBe(fpBase);
    expect(computeEntryFingerprint({ ...base, replace: "y2" })).not.toBe(fpBase);
    expect(computeEntryFingerprint({ ...base, label: "L2" })).not.toBe(fpBase);
  });

  it("F4 pin canonical byte:replacer array 順序改變會影響 fingerprint(defense against refactor)", () => {
    // 目前 canonical algorithm 用 JSON.stringify(entry, ["file", "find", "label", "replace"])。
    // 若未來 refactor 把此 array 順序改成如 ["file", "find", "replace", "label"],
    // 6 條 hardcoded SHA-256 全部漂移。加此 test 釘住 canonical bytes = 具體固定值:
    const entry = { file: "a.ts", find: "x", replace: "y", label: "L" };
    // Expected canonical:JSON.stringify(entry, ["file","find","label","replace"])
    // = '{"file":"a.ts","find":"x","label":"L","replace":"y"}'
    // SHA-256 (immutable):
    expect(computeEntryFingerprint(entry)).toBe(
      "9877ba82a524d57411452531ca3b1ded1ffb3829f773794c084b2f9312fa85f0",
    );
  });
});

describe("validateManifest — schema", () => {
  const validProbeIds = [
    "branch-protection-P1",
    "destructive-guard-P1",
    "protectedbranches-drift-P1",
    "mutation-spec-drift-P1",
    "mutation-spec-discovery-P1",
    "baseline-governance-P1",
  ];

  it("accepts valid manifest", () => {
    const r = validateManifest({ $schema: "smoke-manifest v1", probeIds: validProbeIds });
    expect("kind" in r).toBe(false);
    expect((r as SmokeManifest).probeIds).toHaveLength(6);
  });

  it("F6 $schema pin:rejects any non-exact string(包含空字串、其他版本)", () => {
    for (const bad of ["", "v1", "smoke-manifest v2", "SMOKE-MANIFEST V1", 123 as unknown as string]) {
      const r = validateManifest({ $schema: bad, probeIds: validProbeIds });
      expect("kind" in r).toBe(true);
      if ("kind" in r) expect(r.message).toMatch(/\$schema/);
    }
  });

  it("rejects non-object", () => {
    expect("kind" in validateManifest(null)).toBe(true);
    expect("kind" in validateManifest([])).toBe(true);
    expect("kind" in validateManifest("string")).toBe(true);
  });

  it("rejects extra top-level key", () => {
    const r = validateManifest({ $schema: "smoke-manifest v1", probeIds: validProbeIds, extra: 1 });
    expect("kind" in r).toBe(true);
    if ("kind" in r) expect(r.message).toMatch(/unexpected top-level key/);
  });

  it("rejects missing probeIds", () => {
    const r = validateManifest({ $schema: "smoke-manifest v1" });
    expect("kind" in r).toBe(true);
  });

  it("rejects non-string probeIds entry", () => {
    const r = validateManifest({ $schema: "smoke-manifest v1", probeIds: [123] });
    expect("kind" in r).toBe(true);
  });

  it("rejects probeId not matching regex", () => {
    const r = validateManifest({ $schema: "smoke-manifest v1", probeIds: ["BAD_ID"] });
    expect("kind" in r).toBe(true);
    if ("kind" in r) expect(r.message).toMatch(/does not match/);
  });

  it("rejects probeId not in SMOKE_PROBES(unknown)", () => {
    const bad = ["unknown-probe-P1", ...validProbeIds.slice(1)];
    const r = validateManifest({ $schema: "smoke-manifest v1", probeIds: bad });
    expect("kind" in r).toBe(true);
    if ("kind" in r) expect(r.message).toMatch(/not in SMOKE_PROBES/);
  });

  it("P1 cardinality:rejects empty probeIds", () => {
    const r = validateManifest({ $schema: "smoke-manifest v1", probeIds: [] });
    expect("kind" in r).toBe(true);
    if ("kind" in r) expect(r.message).toMatch(/cardinality violation/);
  });

  it("P1 cardinality:rejects 5-length(missing one)", () => {
    const r = validateManifest({ $schema: "smoke-manifest v1", probeIds: validProbeIds.slice(0, 5) });
    expect("kind" in r).toBe(true);
    if ("kind" in r) expect(r.message).toMatch(/cardinality violation/);
  });

  it("P1 cardinality:rejects 7-length(extra)", () => {
    const r = validateManifest({
      $schema: "smoke-manifest v1",
      probeIds: [...validProbeIds, "branch-protection-P1"],
    });
    expect("kind" in r).toBe(true);
  });

  it("P1 duplicate:rejects 6-with-duplicate(missing one, duplicate another)", () => {
    const dup = [
      "branch-protection-P1",
      "branch-protection-P1", // dup
      "protectedbranches-drift-P1",
      "mutation-spec-drift-P1",
      "mutation-spec-discovery-P1",
      "baseline-governance-P1",
    ];
    const r = validateManifest({ $schema: "smoke-manifest v1", probeIds: dup });
    expect("kind" in r).toBe(true);
    if ("kind" in r) expect(r.message).toMatch(/duplicates|set-equality/);
  });

  it("shell metacharacter negative:regex reject $(id) / backtick / ; / | / \\n in probeId", () => {
    for (const meta of ["$(id)", "`ls`", "a;b", "a|b", "a\nb"]) {
      const r = validateManifest({ $schema: "smoke-manifest v1", probeIds: [meta] });
      expect("kind" in r).toBe(true);
      if ("kind" in r) expect(r.message).toMatch(/does not match/);
    }
  });
});

describe("verifyFingerprints — real specs", () => {
  it("all 6 fingerprints MATCH current tree(sanity)", () => {
    const manifest: SmokeManifest = {
      $schema: "smoke-manifest v1",
      probeIds: Object.keys(SMOKE_PROBES),
    };
    const err = verifyFingerprints(manifest, REPO_ROOT, SMOKE_PROBES);
    if (err) {
      // If fingerprint drift happens (spec 被改),此 test 會抓、明列 mismatch。此為 accidental-regression signal。
      throw new Error(
        `fingerprint mismatch for ${err.probeId}: expected ${err.expected} got ${err.actual}`,
      );
    }
  });

  it("fingerprint mismatch(mock spec 缺 index)→ error", () => {
    // 用 stub SMOKE_PROBES:index 指向不存在
    const stub = {
      ...SMOKE_PROBES,
      "branch-protection-P1": {
        ...SMOKE_PROBES["branch-protection-P1"],
        index: 9999,
      },
    };
    const err = verifyFingerprints(
      { $schema: "smoke-manifest v1", probeIds: ["branch-protection-P1"] },
      REPO_ROOT,
      stub,
    );
    expect(err).not.toBeNull();
    if (err) expect(err.actual).toMatch(/out of range/);
  });

  it("fingerprint mismatch(mock 錯 expected SHA)→ error", () => {
    const stub = {
      ...SMOKE_PROBES,
      "branch-protection-P1": {
        ...SMOKE_PROBES["branch-protection-P1"],
        expectedEntryFingerprint: "0000000000000000000000000000000000000000000000000000000000000000",
      },
    };
    const err = verifyFingerprints(
      { $schema: "smoke-manifest v1", probeIds: ["branch-protection-P1"] },
      REPO_ROOT,
      stub,
    );
    expect(err).not.toBeNull();
    if (err) {
      expect(err.expected).toBe("0000000000000000000000000000000000000000000000000000000000000000");
      expect(err.actual).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("runMutationSmoke — inject deps, cover branches", () => {
  const validManifest: SmokeManifest = {
    $schema: "smoke-manifest v1",
    probeIds: Object.keys(SMOKE_PROBES),
  };

  function writeManifest(content: unknown): string {
    const dir = mkdtempSync(path.join(tmpdir(), "smoke-e2e-"));
    const p = path.join(dir, "smoke-manifest.json");
    writeFileSync(p, JSON.stringify(content));
    return p;
  }

  const cleanTree = () => "";
  const dirtyTree = () => " M some/file.ts";
  const stableHead = () => "abcd1234abcd1234abcd1234abcd1234abcd1234";
  const changedHead = () => {
    let calls = 0;
    return () => (calls++ === 0 ? "aaaa" : "bbbb");
  };

  it("schema violation → exit 2", async () => {
    const p = writeManifest({ $schema: "smoke-manifest v1", probeIds: [] });
    const out = await runMutationSmoke({
      manifestPath: p,
      cwd: REPO_ROOT,
      deps: { gitStatusFn: cleanTree, gitHeadFn: stableHead },
    });
    expect(out.exitCode).toBe(2);
    expect(out.message).toMatch(/schema/);
  });

  it("dirty tree(pre)→ exit 2", async () => {
    const p = writeManifest(validManifest);
    const out = await runMutationSmoke({
      manifestPath: p,
      cwd: REPO_ROOT,
      deps: {
        gitStatusFn: dirtyTree,
        gitHeadFn: stableHead,
      },
    });
    expect(out.exitCode).toBe(2);
    expect(out.message).toMatch(/tree not clean/);
  });

  it("pre-control red → exit 2", async () => {
    const p = writeManifest(validManifest);
    const out = await runMutationSmoke({
      manifestPath: p,
      cwd: REPO_ROOT,
      deps: {
        gitStatusFn: cleanTree,
        gitHeadFn: stableHead,
        runTestSuiteFn: async () => ({ exitCode: 1, stderr: "test failed" }),
        runProbeFn: async () => ({ probeId: "x", exitCode: 0, durationMs: 1, stderr: "" }),
      },
    });
    expect(out.exitCode).toBe(2);
    expect(out.message).toMatch(/pre-control/);
  });

  it("all 6 probes killed(happy path)→ exit 0", async () => {
    const p = writeManifest(validManifest);
    const killedResults: ProbeResult[] = validManifest.probeIds.map((id) => ({
      probeId: id,
      exitCode: 0,
      durationMs: 100,
      stderr: "",
    }));
    const out = await runMutationSmoke({
      manifestPath: p,
      cwd: REPO_ROOT,
      deps: {
        gitStatusFn: cleanTree,
        gitHeadFn: stableHead,
        runTestSuiteFn: async () => ({ exitCode: 0, stderr: "" }),
        runProbeFn: async (id) => killedResults.find((r) => r.probeId === id)!,
      },
    });
    expect(out.exitCode).toBe(0);
    expect(out.message).toMatch(/all 6 smoke probes killed/);
  });

  it("one probe survived → exit 1", async () => {
    const p = writeManifest(validManifest);
    const out = await runMutationSmoke({
      manifestPath: p,
      cwd: REPO_ROOT,
      deps: {
        gitStatusFn: cleanTree,
        gitHeadFn: stableHead,
        runTestSuiteFn: async () => ({ exitCode: 0, stderr: "" }),
        runProbeFn: async (id) => ({
          probeId: id,
          exitCode: id === "branch-protection-P1" ? 1 : 0,
          durationMs: 100,
          stderr: "",
        }),
      },
    });
    expect(out.exitCode).toBe(1);
    expect(out.message).toMatch(/survived: branch-protection-P1/);
  });

  it("one probe indeterminate(exit 2)→ exit 2", async () => {
    const p = writeManifest(validManifest);
    const out = await runMutationSmoke({
      manifestPath: p,
      cwd: REPO_ROOT,
      deps: {
        gitStatusFn: cleanTree,
        gitHeadFn: stableHead,
        runTestSuiteFn: async () => ({ exitCode: 0, stderr: "" }),
        runProbeFn: async (id) => ({
          probeId: id,
          exitCode: id === "destructive-guard-P1" ? 2 : 0,
          durationMs: 100,
          stderr: "",
        }),
      },
    });
    expect(out.exitCode).toBe(2);
    expect(out.message).toMatch(/indeterminate: destructive-guard-P1/);
  });

  it("post-control red → exit 2(restore idempotent violated)", async () => {
    const p = writeManifest(validManifest);
    let call = 0;
    const out = await runMutationSmoke({
      manifestPath: p,
      cwd: REPO_ROOT,
      deps: {
        gitStatusFn: cleanTree,
        gitHeadFn: stableHead,
        runTestSuiteFn: async () => {
          call++;
          return { exitCode: call === 1 ? 0 : 1, stderr: "post fail" };
        },
        runProbeFn: async (id) => ({ probeId: id, exitCode: 0, durationMs: 100, stderr: "" }),
      },
    });
    expect(out.exitCode).toBe(2);
    expect(out.message).toMatch(/post-control/);
  });

  it("HEAD changed during smoke → exit 2", async () => {
    const p = writeManifest(validManifest);
    const headSeq = changedHead();
    const out = await runMutationSmoke({
      manifestPath: p,
      cwd: REPO_ROOT,
      deps: {
        gitStatusFn: cleanTree,
        gitHeadFn: headSeq,
        runTestSuiteFn: async () => ({ exitCode: 0, stderr: "" }),
        runProbeFn: async (id) => ({ probeId: id, exitCode: 0, durationMs: 100, stderr: "" }),
      },
    });
    expect(out.exitCode).toBe(2);
    expect(out.message).toMatch(/HEAD changed/);
  });

  it("post-tree dirty → exit 2", async () => {
    const p = writeManifest(validManifest);
    let call = 0;
    const out = await runMutationSmoke({
      manifestPath: p,
      cwd: REPO_ROOT,
      deps: {
        gitStatusFn: () => (call++ === 0 ? "" : " M leftover.ts"),
        gitHeadFn: stableHead,
        runTestSuiteFn: async () => ({ exitCode: 0, stderr: "" }),
        runProbeFn: async (id) => ({ probeId: id, exitCode: 0, durationMs: 100, stderr: "" }),
      },
    });
    expect(out.exitCode).toBe(2);
    expect(out.message).toMatch(/tree dirty after smoke/);
  });
});

// F2 承 Sprint 21 Step 5 adversarial finding:test 內 real e2e wiring apply mutation
// 到 scripts/lib/destructive-guard.ts、與其他 vitest fork 平行跑 tests/destructive-guard.test.ts
// 存在 race window(mutation applied 期間他 fork 讀到 mutant 誤失敗)。承 F2 建議拿掉此
// test 內 e2e、依 CI step `npm run mutation:smoke` 承 P1-3 executable evidence:
// - Full 6 probe 完整 apply / test / restore + tree/HEAD verify(runner algorithm 7 步全跑)
// - CI step timeout-minutes: 5(runtime 實測 ~130s = 70s per-probe + 2 control run)
// - 本地 evidence 見 commit 7d3ccc4 附輸出、6/6 killed exit 0
// runner branch coverage 由上方 injectable deps tests 保、fingerprint verify 由 real specs
// sanity + mock mismatch test 保。此 tradeoff 也解決 F7(5/6 probe 本地不驗、CI step 全覆)。

describe("SMOKE_PROBES map", () => {
  it("has exactly 6 entries", () => {
    expect(Object.keys(SMOKE_PROBES)).toHaveLength(6);
  });

  it("all probeIds match regex", () => {
    for (const id of Object.keys(SMOKE_PROBES)) {
      expect(id).toMatch(/^[a-z][a-z0-9-]*-P[0-9]+$/);
    }
  });

  it("all specs point to scripts/mutations/*.json", () => {
    for (const p of Object.values(SMOKE_PROBES)) {
      expect(p.spec).toMatch(/^scripts\/mutations\/[a-z-]+\.json$/);
      expect(p.index).toBe(0);
      expect(p.expectedEntryFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(p.testSuite.length).toBeGreaterThan(0);
      for (const t of p.testSuite) {
        expect(t).toMatch(/^tests\/.+\.ts$/);
      }
    }
  });
});
