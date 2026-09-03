// tests/invoked-as-main.test.ts — invoked-as-main lib 純單元測試(13 案)
//
// 覆蓋:detectInvocation 的三態(main / import-or-not-main / indeterminate)、
// realpath fallback 邊界、reportIfNotMain 副作用(靜默 vs 印)、sanitize 契約
// (控制字元 escape、超長截斷、單行保證)。
//
// 完整 e2e(三 consumer × 4 場景)在 tests/invoked-as-main.e2e.test.ts。

import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectInvocation, reportIfNotMain, sanitizeDiag } from "../scripts/lib/invoked-as-main";

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

function mkTmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), "iam-unit-"));
  tmpDirs.push(d);
  return d;
}

describe("detectInvocation", () => {
  it("#1 兩端相等(絕對路徑)→ main;outcome 保留原字串", () => {
    const dir = mkTmp();
    const file = path.join(dir, "a.ts");
    writeFileSync(file, "");
    const outcome = detectInvocation(pathToFileURL(file).href, file);
    expect(outcome.kind).toBe("main");
    if (outcome.kind === "main") {
      expect(outcome.selfUrl).toBe(pathToFileURL(file).href);
      expect(outcome.argv1).toBe(file);
    }
  });

  it("#2 argv1 undefined → indeterminate reason=argv1-missing", () => {
    const outcome = detectInvocation("file:///anything.ts", undefined);
    expect(outcome).toEqual({
      kind: "indeterminate",
      selfUrl: "file:///anything.ts",
      argv1: undefined,
      reason: "argv1-missing",
    });
  });

  it("#3 symlink 目錄呼叫兩端指同 real path → main", () => {
    const real = mkTmp();
    const link = mkTmp();
    // 建 link/target.ts → real/target.ts 的 symlink
    const realFile = path.join(real, "target.ts");
    writeFileSync(realFile, "");
    const linkFile = path.join(link, "target.ts");
    rmSync(link, { recursive: true, force: true });
    symlinkSync(real, link);
    // selfUrl 用 real path(模擬 tsx 已 realpath 的 import.meta.url)
    // argv1 用 symlink path(模擬使用者從 symlink 目錄呼叫)
    const outcome = detectInvocation(pathToFileURL(realFile).href, linkFile);
    expect(outcome.kind).toBe("main");
  });

  it("#4 argv1 realpath 拋(檔不存在)、selfUrl 正常 → indeterminate realpath-failed:argv1", () => {
    const dir = mkTmp();
    const realFile = path.join(dir, "self.ts");
    writeFileSync(realFile, "");
    const dangling = path.join(dir, "does-not-exist.ts");
    const outcome = detectInvocation(pathToFileURL(realFile).href, dangling);
    expect(outcome.kind).toBe("indeterminate");
    if (outcome.kind === "indeterminate") {
      expect(outcome.reason).toBe("realpath-failed:argv1");
    }
  });

  it("#5 selfUrl realpath 拋、argv1 正常 → indeterminate realpath-failed:self", () => {
    const dir = mkTmp();
    const realFile = path.join(dir, "arg.ts");
    writeFileSync(realFile, "");
    const missingSelf = path.join(dir, "missing-self.ts");
    const outcome = detectInvocation(pathToFileURL(missingSelf).href, realFile);
    expect(outcome.kind).toBe("indeterminate");
    if (outcome.kind === "indeterminate") {
      expect(outcome.reason).toBe("realpath-failed:self");
    }
  });

  it("#6 兩端 realpath 都拋 → indeterminate realpath-failed:both", () => {
    const dir = mkTmp();
    const missingSelf = path.join(dir, "missing-self.ts");
    const missingArg = path.join(dir, "missing-arg.ts");
    const outcome = detectInvocation(pathToFileURL(missingSelf).href, missingArg);
    expect(outcome.kind).toBe("indeterminate");
    if (outcome.kind === "indeterminate") {
      expect(outcome.reason).toBe("realpath-failed:both");
    }
  });

  it("#7 selfUrl 是 data: URL(fileURLToPath 拋)→ indeterminate selfurl-not-file", () => {
    const outcome = detectInvocation("data:text/plain,hello", "/tmp/anything.ts");
    expect(outcome.kind).toBe("indeterminate");
    if (outcome.kind === "indeterminate") {
      expect(outcome.reason).toBe("selfurl-not-file");
    }
  });

  it("#8 兩端真實檔不同(正常 import 情境)→ import-or-not-main", () => {
    const dir = mkTmp();
    const selfFile = path.join(dir, "self.ts");
    const argFile = path.join(dir, "arg.ts");
    writeFileSync(selfFile, "");
    writeFileSync(argFile, "");
    const outcome = detectInvocation(pathToFileURL(selfFile).href, argFile);
    expect(outcome.kind).toBe("import-or-not-main");
    if (outcome.kind === "import-or-not-main") {
      expect(outcome.reason).toBe("argv1-differs-from-selfurl");
    }
  });
});

describe("reportIfNotMain", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });
  afterEach(() => {
    spy.mockRestore();
  });

  it("#9 main → true、無 stderr", () => {
    const result = reportIfNotMain(
      { kind: "main", selfUrl: "file:///a.ts", argv1: "/a.ts" },
      "test-label",
    );
    expect(result).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it("#10 import-or-not-main → false、完全靜默", () => {
    const result = reportIfNotMain(
      {
        kind: "import-or-not-main",
        selfUrl: "file:///a.ts",
        argv1: "/b.ts",
        reason: "argv1-differs-from-selfurl",
      },
      "test-label",
    );
    expect(result).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("#11 indeterminate → false、stderr 恰一行、含 label + reason + selfUrl + argv1", () => {
    const result = reportIfNotMain(
      {
        kind: "indeterminate",
        selfUrl: "file:///self.ts",
        argv1: "/arg.ts",
        reason: "realpath-failed:argv1",
      },
      "my-script",
    );
    expect(result).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0]?.[0] as string;
    expect(call).toContain("[invoked-as-main]");
    expect(call).toContain("my-script");
    expect(call).toContain("reason=realpath-failed:argv1");
    expect(call).toContain("selfUrl=file:///self.ts");
    expect(call).toContain("argv1=/arg.ts");
    // 保單行:結尾恰一 \n、內容無其他 \n
    expect(call.endsWith("\n")).toBe(true);
    expect(call.slice(0, -1)).not.toContain("\n");
  });

  it("#12 indeterminate with 控制字元 argv1 → 輸出恰一行、控制字元 escape", () => {
    const dirty = "/tmp/x\ny\rz\tw\x1bend";
    const result = reportIfNotMain(
      {
        kind: "indeterminate",
        selfUrl: "file:///self.ts",
        argv1: dirty,
        reason: "realpath-failed:argv1",
      },
      "my-script",
    );
    expect(result).toBe(false);
    const call = spy.mock.calls[0]?.[0] as string;
    // 結尾恰一 \n、內容不含真控制字元
    expect(call.endsWith("\n")).toBe(true);
    expect(call.slice(0, -1)).not.toMatch(/[\x00-\x1f\x7f]/);
    // 含 escape 表示
    expect(call).toContain("\\x0A"); // \n
    expect(call).toContain("\\x0D"); // \r
    expect(call).toContain("\\x09"); // \t
    expect(call).toContain("\\x1B"); // ESC
  });

  it("#13 indeterminate with 400 字 selfUrl → 輸出恰一行、含 truncated 尾綴", () => {
    const long = "file:///" + "a".repeat(400);
    const result = reportIfNotMain(
      {
        kind: "indeterminate",
        selfUrl: long,
        argv1: "/short.ts",
        reason: "selfurl-not-file",
      },
      "my-script",
    );
    expect(result).toBe(false);
    const call = spy.mock.calls[0]?.[0] as string;
    expect(call.endsWith("\n")).toBe(true);
    expect(call.slice(0, -1)).not.toContain("\n");
    expect(call).toContain("...(truncated;len=");
  });
});

describe("sanitizeDiag(internal helper)", () => {
  it("undefined → <undefined>", () => {
    expect(sanitizeDiag(undefined)).toBe("<undefined>");
  });
  it("plain string → unchanged", () => {
    expect(sanitizeDiag("hello.ts")).toBe("hello.ts");
  });
  it("控制字元 → escaped", () => {
    expect(sanitizeDiag("a\nb")).toBe("a\\x0Ab");
  });
  it("超過 200 字 → truncated", () => {
    const s = "x".repeat(300);
    const out = sanitizeDiag(s);
    expect(out.length).toBeLessThan(s.length);
    expect(out).toContain("...(truncated;len=300)");
  });
});
