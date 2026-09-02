// tests/fixtures/invoked-as-main-wrapper/check-mutation-specs-wrapper.mjs
// e2e case #3 / case #4 共用 wrapper — 同 mutate-wrapper.mjs 說明。

import { fileURLToPath, pathToFileURL } from "node:url";

if (process.env.IAM_DANGLING === "1") {
  process.argv[1] = "/tmp/definitely-does-not-exist-" + Date.now() + "/dangling.ts";
}

const target = fileURLToPath(new URL("../../../scripts/check-mutation-specs.ts", import.meta.url));
await import(pathToFileURL(target).href);
