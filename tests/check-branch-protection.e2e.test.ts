// tests/check-branch-protection.e2e.test.ts — Sprint 19 C1 e2e
//
// CLI adapter wiring + fake gh executable + workflow structural lock。
// 14 case:8 / 8b(CRLF) / 9 / 10 / 11a / 11b / 11c / 12 / 13 / 14 / 15a / 15b / 15c / 20(workflow structural lock)。

import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.resolve(REPO, 'scripts/check-branch-protection.ts');

interface FakeGh {
  dir: string;
  logPath: string; // fake gh 呼叫次數記錄
}

/** 建 fake gh executable(shell script)、注入 PATH。fake gh 依 FAKE_GH_MODE 環境變數決定行為。 */
function makeFakeGh(): FakeGh {
  const dir = mkdtempSync(path.join(tmpdir(), 'sprint19-c1-fake-gh-'));
  const logPath = path.join(dir, 'call.log');
  const script = `#!/bin/sh
echo call >> "${logPath}"
mode="\${FAKE_GH_MODE:-ok}"
case "$mode" in
  ok) printf 'HTTP/2.0 200 OK\\n\\n{"required_status_checks":{"contexts":["ci"]},"enforce_admins":{"enabled":true},"required_pull_request_reviews":{}}\\n' ;;
  ok-crlf) printf 'HTTP/2.0 200 OK\\r\\nContent-Type: application/json\\r\\n\\r\\n{"required_status_checks":{"contexts":["ci"]},"enforce_admins":{"enabled":true},"required_pull_request_reviews":{}}\\n' ;;
  missing-A) printf 'HTTP/2.0 200 OK\\n\\n{"enforce_admins":{"enabled":true},"required_pull_request_reviews":{}}\\n' ;;
  nonzero-nostatus) exit 1 ;;
  status-401-stderr) printf 'HTTP/2.0 401 Unauthorized\\n\\nbody\\n' 1>&2 ; exit 1 ;;
  status-403-stdout) printf 'HTTP/2.0 403 Forbidden\\n\\nbody\\n' ; exit 1 ;;
  status-404-stderr) printf 'HTTP/2.0 404 Not Found\\n\\nbody\\n' 1>&2 ; exit 1 ;;
  status-5xx-stdout) printf 'HTTP/2.0 502 Bad Gateway\\n\\nbody\\n' ; exit 1 ;;
  malformed-json) printf 'HTTP/2.0 200 OK\\n\\n{malformed\\n' ;;
  multi-main-ok-develop-missingA)
    branch=$(echo "$*" | grep -o '/branches/[^/]*/protection' | sed 's|/branches/||;s|/protection||')
    if [ "$branch" = "main" ]; then
      printf 'HTTP/2.0 200 OK\\n\\n{"required_status_checks":{"contexts":["ci"]},"enforce_admins":{"enabled":true},"required_pull_request_reviews":{}}\\n'
    else
      printf 'HTTP/2.0 200 OK\\n\\n{"enforce_admins":{"enabled":true},"required_pull_request_reviews":{}}\\n'
    fi
    ;;
esac
`;
  const bin = path.join(dir, 'gh');
  writeFileSync(bin, script);
  chmodSync(bin, 0o755);
  return { dir, logPath };
}

interface RunOpts {
  fakeGhMode?: string;
  ghToken?: string;
  githubToken?: string;
  githubRepository?: string;
  githubHeadRepository?: string;
  cwd?: string;
}

interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  ghCalls: number;
}

/** 建 fixture repo(harness.config.json)、注入 fake gh、跑 check-branch-protection.ts、回結果。 */
function run(opts: RunOpts): RunResult {
  const cwd = opts.cwd ?? mkdtempSync(path.join(tmpdir(), 'sprint19-c1-fixture-'));
  const scriptsDir = path.join(cwd, 'scripts');
  mkdirSync(scriptsDir, { recursive: true });
  // 用 protectedBranches ['main'](除非 multi-branch mode)
  const branches = opts.fakeGhMode === 'multi-main-ok-develop-missingA' ? ['main', 'develop'] : ['main'];
  const cfg = {
    schemaVersion: 2,
    mergeStrategy: 'squash',
    mode: 'template',
    projectId: '__TEMPLATE__',
    templatePackageName: 'harness-controlled-dev-environment',
    protectedBranches: branches,
    deliveryBranches: ['main'],
    requiredAgentAdapters: ['claude', 'codex'],
    githubGovernanceRequired: false,
  };
  writeFileSync(path.join(scriptsDir, 'harness.config.json'), JSON.stringify(cfg));

  const fake = makeFakeGh();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${fake.dir}:${process.env.PATH}`,
    FAKE_GH_MODE: opts.fakeGhMode ?? 'ok',
  };
  // 清除既有 GH_TOKEN / GITHUB_TOKEN(避免主機 env 污染 fixture)
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  delete env.GITHUB_REPOSITORY;
  delete env.GITHUB_HEAD_REPOSITORY;
  if (opts.ghToken !== undefined) env.GH_TOKEN = opts.ghToken;
  if (opts.githubToken !== undefined) env.GITHUB_TOKEN = opts.githubToken;
  if (opts.githubRepository !== undefined) env.GITHUB_REPOSITORY = opts.githubRepository;
  if (opts.githubHeadRepository !== undefined) env.GITHUB_HEAD_REPOSITORY = opts.githubHeadRepository;

  const r = spawnSync('npx', ['tsx', SCRIPT], { cwd, env, encoding: 'utf-8' });
  let ghCalls = 0;
  try {
    ghCalls = readFileSync(fake.logPath, 'utf-8').split('\n').filter(Boolean).length;
  } catch {}
  rmSync(fake.dir, { recursive: true, force: true });
  rmSync(cwd, { recursive: true, force: true });
  return {
    code: r.status,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? '',
    ghCalls,
  };
}

describe('check-branch-protection e2e — CLI adapter wiring + fake gh + status seam', () => {
  it('case 8:正對照 LF wiring → exit 0', () => {
    const r = run({ ghToken: 'x', githubRepository: 'ownerx/repox' });
    expect(r.code).toBe(0);
    expect(r.stderr).toBe('');
  });
  it('case 8b:CRLF header normalization → exit 0', () => {
    const r = run({ fakeGhMode: 'ok-crlf', ghToken: 'x', githubRepository: 'ownerx/repox' });
    expect(r.code).toBe(0);
  });
  it('case 9:orchestration assertion fail(缺 A)', () => {
    const r = run({ fakeGhMode: 'missing-A', ghToken: 'x', githubRepository: 'ownerx/repox' });
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/required_status_checks/);
    expect(r.stderr).toMatch(/main/);
  });
  it('case 10:gh non-zero exit、無 HTTP status', () => {
    const r = run({ fakeGhMode: 'nonzero-nostatus', ghToken: 'x', githubRepository: 'ownerx/repox' });
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/無 HTTP status/);
  });
  it('case 11a:token preflight(gh 未呼叫)', () => {
    const r = run({ githubRepository: 'ownerx/repox' }); // 無 token
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/auth token missing/);
    expect(r.ghCalls).toBe(0);
  });
  it('case 11b:gh 401 via stderr', () => {
    const r = run({ fakeGhMode: 'status-401-stderr', ghToken: 'x', githubRepository: 'ownerx/repox' });
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/401/);
  });
  it('case 11c:gh 403 non-fork via stdout', () => {
    const r = run({ fakeGhMode: 'status-403-stdout', ghToken: 'x', githubRepository: 'ownerx/repox' });
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/403/);
    expect(r.stderr).toMatch(/非 fork context/);
  });
  it('case 12:owner/repo missing', () => {
    // GH_TOKEN present、GITHUB_REPOSITORY unset、cwd 為 empty tmpdir(無 git remote)
    const r = run({ ghToken: 'x' });
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/無法決定 owner\/repo/);
    expect(r.ghCalls).toBe(0);
  });
  it('case 13:多分支(main pass、develop fail)', () => {
    const r = run({
      fakeGhMode: 'multi-main-ok-develop-missingA',
      ghToken: 'x',
      githubRepository: 'ownerx/repox',
    });
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/branch=develop/);
    expect(r.stderr).toMatch(/pass.*main|main.*pass/i);
  });
  it('case 14:fork PR preflight(token unset + fork context)', () => {
    const r = run({
      githubRepository: 'ownerx/repox',
      githubHeadRepository: 'attacker/fork',
    }); // 無 token
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/fork PR context detected/);
    expect(r.ghCalls).toBe(0);
  });
  it('case 15a:HTTP 404 via stderr', () => {
    const r = run({ fakeGhMode: 'status-404-stderr', ghToken: 'x', githubRepository: 'ownerx/repox' });
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/branch not found|404/);
  });
  it('case 15b:HTTP 5xx via stdout', () => {
    const r = run({ fakeGhMode: 'status-5xx-stdout', ghToken: 'x', githubRepository: 'ownerx/repox' });
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/5xx|502/);
  });
  it('case 15c:malformed JSON → parseBranchProtection throw catch', () => {
    const r = run({ fakeGhMode: 'malformed-json', ghToken: 'x', githubRepository: 'ownerx/repox' });
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/非 valid JSON/);
  });
});

// Case 20:workflow structural lock(scoped job/step block + cross-file trust boundary)
// 承 plan r7-r11 P1 + Step 4 r1 P1:必須用 scoped job block、非 whole-file regex。
//
// 抽 branch-protection-check job block:找 `jobs:` line、找 `branch-protection-check:` header、
// 拿其縮排(job header indent)、收集所有 indent > job header indent 的行、遇到同 indent 且非
// blank/comment 的下個 job header(或檔案結束)就終止。之後 assert 全部發生在 job block 內。
//
// Secret binding scope 驗證:secret binding count 在整檔 = 1、且發生在 branch-protection-check
// job block 內、非其他 job/step、非 comment。
describe('case 20:trusted workflow structural lock(scoped job block + cross-file trust boundary)', () => {
  const bpYmlPath = path.join(REPO, '.github/workflows/branch-protection.yml');
  const ciYmlPath = path.join(REPO, '.github/workflows/ci.yml');

  function stripComments(yml: string): string {
    return yml
      .split('\n')
      .map((l) => l.replace(/(^|[^\\])#.*$/, '$1'))
      .join('\n');
  }

  // findJobBlock:承 supervisor Step 4 r2 P2 明列、必須鎖 jobs 直接子(direct child)
  // 用「jobs 下第一個非 blank/comment header 的 indent」當 direct child indent、
  // 之後只接受**恰為此 indent** 的 `<jobName>:` 作為 job header;
  // nested same-name key 不被接受(indent > direct-child indent → 拒絕)。
  function findJobBlock(yml: string, jobName: string): { block: string; startLine: number; endLine: number } | null {
    const lines = yml.split('\n');
    // 1. 找 top-level jobs: header
    let jobsIdx = -1;
    let jobsIndent = -1;
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i]!;
      if (/^\s*#/.test(raw) || !raw.trim()) continue;
      const indent = /^\s*/.exec(raw)![0].length;
      if (/^\s*jobs:\s*$/.test(raw) && indent === 0) {
        jobsIdx = i;
        jobsIndent = indent;
        break;
      }
    }
    if (jobsIdx < 0) return null;
    // 2. 決定 direct-child indent:jobs 下第一個非 blank/comment 行的 indent
    let directChildIndent = -1;
    for (let i = jobsIdx + 1; i < lines.length; i++) {
      const raw = lines[i]!;
      if (/^\s*#/.test(raw) || !raw.trim()) continue;
      const indent = /^\s*/.exec(raw)![0].length;
      if (indent <= jobsIndent) return null; // 離開 jobs 區塊、未找到任何 child
      directChildIndent = indent;
      break;
    }
    if (directChildIndent < 0) return null;
    // 3. 找 job header at EXACT direct-child indent、header 為 `<jobName>:`
    const jobHeaderPrefix = ' '.repeat(directChildIndent) + jobName + ':';
    let jobHeaderIdx = -1;
    for (let i = jobsIdx + 1; i < lines.length; i++) {
      const raw = lines[i]!;
      if (/^\s*#/.test(raw) || !raw.trim()) continue;
      const indent = /^\s*/.exec(raw)![0].length;
      // 離開 jobs 區塊
      if (indent <= jobsIndent) break;
      // 只認 direct-child indent(nested same-name key 拒絕)
      if (indent !== directChildIndent) continue;
      const t = raw.replace(/\s+$/, '');
      if (t === jobHeaderPrefix) {
        jobHeaderIdx = i;
        break;
      }
    }
    if (jobHeaderIdx < 0) return null;
    // 4. 收集 job block:endIdx 為下一個 indent <= directChildIndent 且非 blank/comment 的 line
    let endIdx = lines.length;
    for (let i = jobHeaderIdx + 1; i < lines.length; i++) {
      const raw = lines[i]!;
      if (/^\s*#/.test(raw) || !raw.trim()) continue;
      const indent = /^\s*/.exec(raw)![0].length;
      if (indent <= directChildIndent) {
        endIdx = i;
        break;
      }
    }
    return {
      block: lines.slice(jobHeaderIdx + 1, endIdx).join('\n'),
      startLine: jobHeaderIdx + 1,
      endLine: endIdx,
    };
  }

  it('branch-protection.yml 存在', () => {
    expect(() => readFileSync(bpYmlPath, 'utf-8')).not.toThrow();
  });

  it('findJobBlock 只認 jobs 直接子(direct child indent)、拒 nested same-name key', () => {
    // Fixture:另一 job 內含 nested `branch-protection-check:` key(indent 更深)
    // 應該拒絕、不 false-pass
    const nestedFixture = [
      'name: Test',
      'on:',
      '  schedule:',
      "    - cron: '0 0 * * *'",
      'jobs:',
      '  other-job:',
      '    runs-on: ubuntu-latest',
      '    strategy:',
      '      matrix:',
      '        branch-protection-check: [1, 2, 3]', // nested same-name key、更深 indent
      '    steps:',
      '      - name: Whatever',
      '        run: echo hi',
      '',
    ].join('\n');
    const r = findJobBlock(nestedFixture, 'branch-protection-check');
    expect(r).toBeNull(); // nested 不接受、承 supervisor Step 4 r2 P2
  });

  it('findJobBlock 接受 jobs 直接子(承 shipped branch-protection.yml 結構)', () => {
    const shipped = readFileSync(bpYmlPath, 'utf-8');
    const r = findJobBlock(shipped, 'branch-protection-check');
    expect(r).not.toBeNull();
    expect(r!.block).toMatch(/runs-on:/);
  });

  it('workflow on: 只含 schedule、無 pull_request / push / workflow_dispatch', () => {
    const yml = stripComments(readFileSync(bpYmlPath, 'utf-8'));
    expect(yml).toMatch(/^on:\s*$[\s\S]*?schedule:/m);
    expect(yml).not.toMatch(/^\s+pull_request:/m);
    expect(yml).not.toMatch(/^\s+pull_request_target:/m);
    expect(yml).not.toMatch(/^\s+push:/m);
    expect(yml).not.toMatch(/^\s+workflow_dispatch:/m);
  });

  it('schedule cron 存在', () => {
    const yml = readFileSync(bpYmlPath, 'utf-8');
    expect(yml).toMatch(/cron:\s*['"]([^'"]+)['"]/);
  });

  it('permissions: contents: read、無 administration:', () => {
    const yml = stripComments(readFileSync(bpYmlPath, 'utf-8'));
    expect(yml).toMatch(/permissions:\s*[\s\S]*?contents:\s*read/);
    expect(yml).not.toMatch(/administration:/);
  });

  it('job block:branch-protection-check job 存在', () => {
    const yml = readFileSync(bpYmlPath, 'utf-8');
    const job = findJobBlock(yml, 'branch-protection-check');
    expect(job).not.toBeNull();
  });

  it('scoped:secret binding 恰 1 次、且落在 branch-protection-check job 內', () => {
    const yml = stripComments(readFileSync(bpYmlPath, 'utf-8'));
    const job = findJobBlock(readFileSync(bpYmlPath, 'utf-8'), 'branch-protection-check')!;
    const jobBlockClean = stripComments(job.block);
    // 全檔 comment-stripped 內 BRANCH_PROTECTION_TOKEN 恰 1 次
    const matches = yml.match(/BRANCH_PROTECTION_TOKEN/g) ?? [];
    expect(matches.length).toBe(1);
    // 該 occurrence 落在 job block 內(comment-stripped)
    expect(jobBlockClean).toMatch(/GH_TOKEN:\s*\$\{\{\s*secrets\.BRANCH_PROTECTION_TOKEN\s*\}\}/);
  });

  it('scoped:job block 內 checkout ref: main、無 PR-controlled ref', () => {
    const yml = readFileSync(bpYmlPath, 'utf-8');
    const job = findJobBlock(yml, 'branch-protection-check')!;
    const jobBlockClean = stripComments(job.block);
    expect(jobBlockClean).toMatch(/uses:\s*actions\/checkout@v4/);
    expect(jobBlockClean).toMatch(/ref:\s*main/);
    expect(jobBlockClean).not.toMatch(/github\.head_ref/);
    expect(jobBlockClean).not.toMatch(/github\.event\.pull_request\.head/);
    expect(jobBlockClean).not.toMatch(/github\.ref\b/);
  });

  it('scoped:job block 內 bootstrap setup-node@v4 + node-version 20 + npm ci', () => {
    const yml = readFileSync(bpYmlPath, 'utf-8');
    const job = findJobBlock(yml, 'branch-protection-check')!;
    const jobBlockClean = stripComments(job.block);
    expect(jobBlockClean).toMatch(/uses:\s*actions\/setup-node@v4/);
    expect(jobBlockClean).toMatch(/node-version:\s*['"]20['"]/);
    expect(jobBlockClean).toMatch(/run:\s*npm ci/);
  });

  it('scoped:job block 內 GITHUB_REPOSITORY mapping、無 GITHUB_HEAD_REPOSITORY', () => {
    const yml = readFileSync(bpYmlPath, 'utf-8');
    const job = findJobBlock(yml, 'branch-protection-check')!;
    const jobBlockClean = stripComments(job.block);
    expect(jobBlockClean).toMatch(/GITHUB_REPOSITORY:\s*\$\{\{\s*github\.repository\s*\}\}/);
    expect(jobBlockClean).not.toMatch(/GITHUB_HEAD_REPOSITORY:/);
  });

  it('scoped:step 順序 Checkout → Setup Node → Install dependencies → Branch Protection Check、Branch Protection Check step 呼叫 npx tsx', () => {
    const yml = readFileSync(bpYmlPath, 'utf-8');
    const job = findJobBlock(yml, 'branch-protection-check')!;
    const stepNames = job.block
      .split('\n')
      .filter((l) => /^\s*-\s*name:/.test(l))
      .map((l) => l.replace(/^\s*-\s*name:\s*/, '').trim().replace(/^["']|["']$/g, ''));
    expect(stepNames).toEqual(['Checkout', 'Setup Node', 'Install dependencies', 'Branch Protection Check']);
    const jobBlockClean = stripComments(job.block);
    expect(jobBlockClean).toMatch(/name:\s*Branch Protection Check[\s\S]*?run:\s*npx tsx scripts\/check-branch-protection\.ts/);
  });

  it('cross-file:ci.yml 完全不含 BRANCH_PROTECTION_TOKEN(comment-stripped)', () => {
    const ciYmlClean = stripComments(readFileSync(ciYmlPath, 'utf-8'));
    expect(ciYmlClean).not.toMatch(/BRANCH_PROTECTION_TOKEN/);
  });
});
