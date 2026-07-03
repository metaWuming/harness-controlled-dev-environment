// scripts/check-prisma-schema-refs.ts
//
// 守「寫 Prisma 程式碼前必須先確認 schema 有對應 model」這條教訓的自動化。
//
// 掃 src/ 與 tests/ 與 scripts/ 內所有 `prisma.<model>.<method>(...)` 與
// `tx.<model>.<method>(...)`(`$transaction` callback 內的別名)呼叫,
// 確認 <model> 對應 prisma/schema.prisma 內真實的 `model X` declaration。
//
// 找不到對應 model → exit 1,印出檔案+行號+offending model 名。
//
// 規則:
//   - 同時掃 `prisma.X.Y(` 與 `tx.X.Y(`(/review F3:涵蓋 transaction 別名)
//   - Skip `prisma.$queryRaw` / `prisma.$queryRawUnsafe` / `prisma.$executeRaw` /
//     `prisma.$executeRawUnsafe` / `prisma.$transaction` / `prisma.$connect` 等
//     `prisma.$X` 開頭的(raw queries / transaction control)
//   - Skip 動態變數呼叫(如 `prisma[modelName]`)— 此 script 不檢查
//   - Skip src/generated/(Prisma client 自動產生)、node_modules/、.next/ 等
//     **用嚴格 path-segment 比對**(/review F1:之前 substring 比對
//     會誤 skip `src/app/api/auth/[...nextauth]/route.ts` 因為含 ".next")
//   - Skip 同一行 `//` 之後的 match(/review findings)
//   - 只掃 .ts / .tsx 檔
//
// 已知不蓋的 case(/review findings):
//   - 跨多行 chained 呼叫(`prisma\n  .foo\n  .bar(`)— codebase 不用此風格
//   - 字串字面值內的 `prisma.X.Y(`(會誤報,但 codebase 0 false positive)
//   - schema 用 `@@map(...)` rename — codebase 不用
//   要嚴格的話請改 TS AST(ts-morph),目前 regex 對既有 codebase 0 FP。
//
// //   npx tsx scripts/check-prisma-schema-refs.ts
//
// CI:
//   .github/workflows/ci.yml 加 step "Prisma Schema Refs Check"

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// CWD-independent root resolution(/review findings)
const REPO_ROOT = (() => {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
  } catch {
    // Fallback to script's parent dir 的 parent(scripts/ 上一層)
    return path.resolve(__dirname, '..');
  }
})();

const SCHEMA_FILE = path.join(REPO_ROOT, 'prisma/schema.prisma');
const SCAN_DIRS = ['src', 'tests', 'scripts'].map((d) => path.join(REPO_ROOT, d));
// 嚴格 path-segment 比對,避免 substring 誤匹配(`[...nextauth]` 含 ".next")
const SKIP_SEGMENTS = new Set(['node_modules', '.next', 'dist', 'build']);
// 特定子路徑(src/generated):用 path.relative + startsWith 比
const SKIP_PREFIXES = ['src/generated'];
const FILE_EXTS = ['.ts', '.tsx'];

// 匹配 `prisma.foo.bar(` 或 `tx.foo.bar(` — 跳過 `prisma.$xxx`
// 用 \w 而非 [a-zA-Z],容忍底線開頭(理論上 Prisma 不該有,但保守處理)
const PRISMA_CALL = /\b(?:prisma|tx)\.([a-z][a-zA-Z0-9]*)\.\w+\s*\(/g;
const PRISMA_MODEL_DECL = /^model\s+([A-Za-z][A-Za-z0-9]*)\s*\{/;

interface Violation {
  file: string;
  line: number;
  col: number;
  modelName: string;
  context: string;
}

function loadSchemaModels(): Set<string> {
  if (!fs.existsSync(SCHEMA_FILE)) {
    console.error(`❌ ${SCHEMA_FILE} not found`);
    process.exit(1);
  }
  const content = fs.readFileSync(SCHEMA_FILE, 'utf-8');
  const models = new Set<string>();
  for (const line of content.split('\n')) {
    const m = line.match(PRISMA_MODEL_DECL);
    if (m) {
      // Prisma client 把 `model FooBar` 變成 `prisma.fooBar`
      // 把 PascalCase 變成 camelCase
      const pascal = m[1];
      const camel = pascal.charAt(0).toLowerCase() + pascal.slice(1);
      models.add(camel);
    }
  }
  return models;
}

function shouldSkipPath(absPath: string): boolean {
  const rel = path.relative(REPO_ROOT, absPath);
  // 任一 path segment 命中 skip set
  const segments = rel.split(path.sep);
  if (segments.some((s) => SKIP_SEGMENTS.has(s))) return true;
  // 特定相對路徑 prefix
  if (SKIP_PREFIXES.some((p) => rel === p || rel.startsWith(p + path.sep))) return true;
  return false;
}

function* walkFiles(root: string): Generator<string> {
  if (!fs.existsSync(root)) return;
  if (shouldSkipPath(root)) return;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (shouldSkipPath(full)) continue;
      yield* walkFiles(full);
    } else if (FILE_EXTS.includes(path.extname(entry.name))) {
      yield full;
    }
  }
}

function checkFile(file: string, validModels: Set<string>): Violation[] {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  const violations: Violation[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip 整行 // 註解
    if (line.trim().startsWith('//')) continue;
    // Skip /* ... */ 內的部分(粗略 — 嚴格解析要 AST)
    if (line.trim().startsWith('*')) continue;

    // 計算「同行 // 註解開始位置」(粗略 — 不處理字串內的 // ,例 URL)
    // /review findings:避免 trailing `// prisma.foo.bar()` 誤報
    const commentStart = line.indexOf('//');

    let m: RegExpExecArray | null;
    const re = new RegExp(PRISMA_CALL.source, 'g');
    while ((m = re.exec(line)) !== null) {
      // 如果 match 在同行 // 之後,跳過
      if (commentStart >= 0 && m.index >= commentStart) continue;
      const modelName = m[1];
      if (!validModels.has(modelName)) {
        violations.push({
          file: path.relative(REPO_ROOT, file),
          line: i + 1,
          col: m.index + 1,
          modelName,
          context: line.trim(),
        });
      }
    }
  }

  return violations;
}

function main() {
  const validModels = loadSchemaModels();
  console.log(`📚 載入 ${validModels.size} 個 schema models from ${path.relative(REPO_ROOT, SCHEMA_FILE)}`);
  console.log(`   ${Array.from(validModels).sort().join(', ')}\n`);

  let totalFiles = 0;
  const allViolations: Violation[] = [];

  for (const root of SCAN_DIRS) {
    for (const file of walkFiles(root)) {
      totalFiles++;
      const violations = checkFile(file, validModels);
      allViolations.push(...violations);
    }
  }

  console.log(`🔍 掃 ${totalFiles} 個 .ts/.tsx 檔案`);

  if (allViolations.length === 0) {
    console.log(`✅ 0 個 schema mismatch — 全部 prisma.<model>.X(...) / tx.<model>.X(...) 呼叫都對應到真實 model`);
    process.exit(0);
  }

  console.error(`\n❌ ${allViolations.length} 個 prisma/tx 呼叫對應不到 schema model:\n`);
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}:${v.col}`);
    console.error(`    .${v.modelName} — 在 ${path.relative(REPO_ROOT, SCHEMA_FILE)} 找不到對應 model`);
    console.error(`    ${v.context}`);
    console.error('');
  }
  console.error(
    `💡 修法:確認 model 名拼字、大小寫、或補上 schema declaration。\n` +
      `   原則:寫 Prisma 程式碼前先確認 schema 有對應 model`,
  );
  process.exit(1);
}

main();
