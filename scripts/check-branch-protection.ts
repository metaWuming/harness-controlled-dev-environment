#!/usr/bin/env tsx
// scripts/check-branch-protection.ts — Sprint 19 C1 CLI adapter
//
// Owner objective:讓 CTRL-GOV-005 從 record-only 升成 machine-verifiable。
// Trust boundary(承 plan r11):此 script 只在 trusted workflow branch-protection.yml
// (schedule-only + ref: main + trusted checkout)執行、絕不在 PR CI 執行。
//
// 契約(承 plan r11):
//   1. Auth preflight:GH_TOKEN → GITHUB_TOKEN;皆缺 → exit 2 pre-gh(不呼叫 gh)
//   2. Owner/repo:GITHUB_REPOSITORY env 優先 → 否則 git remote parse → 兩者皆缺 → exit 2
//   3. 讀 scripts/harness.config.json protectedBranches list、每支獨立驗
//   4. gh api --include + CRLF/LF normalization + 雙 stream status parse
//   5. Status mapping:401/403(auth/scope、fork 情境加 wording)/ 404 / 5xx / non-status non-zero / malformed JSON
//   6. Pure lib assertBranchProtection A-D 契約
//   7. 任一分支或 preflight fail → exit 2、diagnostic 明列

import { execFileSync } from 'node:child_process';
import { loadHarnessConfig } from './lib/harness-config';
import { assertBranchProtection, parseBranchProtection } from './lib/branch-protection';

interface Repo {
  owner: string;
  name: string;
}

/** 解析 git remote origin URL 為 {owner, name}。無法解析回 null。 */
export function parseGitRemote(url: string): Repo | null {
  // https://github.com/owner/name.git 或 git@github.com:owner/name.git
  const httpsMatch = /^https:\/\/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?\/?$/i.exec(url.trim());
  if (httpsMatch) return { owner: httpsMatch[1]!, name: httpsMatch[2]! };
  const sshMatch = /^git@github\.com:([^/]+)\/([^/.]+)(?:\.git)?$/i.exec(url.trim());
  if (sshMatch) return { owner: sshMatch[1]!, name: sshMatch[2]! };
  return null;
}

/** 決定 owner/repo:GITHUB_REPOSITORY 優先、否則 git remote parse、兩者皆缺回 null。 */
export function detectRepo(cwd: string, env: NodeJS.ProcessEnv): Repo | null {
  const envRepo = env.GITHUB_REPOSITORY;
  if (envRepo && envRepo.includes('/')) {
    const [owner, name] = envRepo.split('/');
    if (owner && name) return { owner, name };
  }
  try {
    const url = execFileSync('git', ['-C', cwd, 'config', '--get', 'remote.origin.url'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!url) return null;
    return parseGitRemote(url);
  } catch {
    return null;
  }
}

/** Auth preflight:GH_TOKEN → GITHUB_TOKEN;皆缺回 null。 */
export function preflightAuth(env: NodeJS.ProcessEnv): string | null {
  const gh = env.GH_TOKEN;
  if (gh && gh.length > 0) return gh;
  const github = env.GITHUB_TOKEN;
  if (github && github.length > 0) return github;
  return null;
}

/** 從 env 決定 fork context。GITHUB_HEAD_REPOSITORY set 且 ≠ GITHUB_REPOSITORY 為 fork。 */
export function detectForkContext(env: NodeJS.ProcessEnv): { isFork: boolean; head: string | null } {
  const head = env.GITHUB_HEAD_REPOSITORY ?? null;
  const base = env.GITHUB_REPOSITORY ?? null;
  if (head && base && head !== base) return { isFork: true, head };
  return { isFork: false, head };
}

/** 從 gh --include 輸出抽 HTTP status code、支援 CRLF/LF。找不到回 null。 */
export function parseHttpStatus(raw: string): number | null {
  const normalized = raw.replace(/\r\n/g, '\n');
  const m = /^HTTP\/[0-9.]+\s+([0-9]{3})/m.exec(normalized);
  return m ? parseInt(m[1]!, 10) : null;
}

/** 從 gh --include 輸出抽 body(header 後、CRLF/LF normalization)。找不到回 ''。 */
export function extractBody(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n');
  const idx = normalized.indexOf('\n\n');
  return idx === -1 ? '' : normalized.slice(idx + 2);
}

/** 對單一 branch 呼叫 gh api、回 {status, body} 或 error 資訊。 */
export interface GhFetchResult {
  ok: boolean;
  status: number | null;
  body: string;
  diagnostic?: string;
}

export function ghFetchBranchProtection(repo: Repo, branch: string, token: string): GhFetchResult {
  const endpoint = `repos/${repo.owner}/${repo.name}/branches/${branch}/protection`;
  try {
    const stdout = execFileSync('gh', ['api', '--include', endpoint], {
      encoding: 'utf-8',
      env: { ...process.env, GH_TOKEN: token },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const status = parseHttpStatus(stdout);
    if (status === 200) {
      return { ok: true, status, body: extractBody(stdout) };
    }
    return { ok: false, status, body: extractBody(stdout), diagnostic: `gh api unexpected status ${status}` };
  } catch (e: unknown) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string };
    const stdout = String(err.stdout ?? '');
    const stderr = String(err.stderr ?? '');
    // 雙 stream status parse:stdout + stderr 任一含 HTTP status 都採用
    const status = parseHttpStatus(stdout) ?? parseHttpStatus(stderr);
    return { ok: false, status, body: extractBody(stdout) || extractBody(stderr), diagnostic: undefined };
  }
}

function diagnosticFromStatus(status: number | null, isFork: boolean): string {
  if (status === null) return 'gh CLI exit non-zero、無 HTTP status 資訊';
  if (status === 401) return `gh api 401、token 無效或無 admin scope`;
  if (status === 403) {
    return isFork
      ? `gh api 403、fork PR 缺 admin token 讀 branch protection、head repo ≠ base repo`
      : `gh api 403、token 缺 admin: read scope、非 fork context`;
  }
  if (status === 404) return `branch not found 或 無 branch protection 設定`;
  if (status >= 500 && status < 600) return `gh api 5xx server error、狀態碼 ${status}、稍後重試`;
  return `gh api 未預期狀態碼 ${status}`;
}

function main(): number {
  const cwd = process.cwd();
  const env = process.env;

  // 1. Auth preflight(gh 呼叫前)
  const token = preflightAuth(env);
  const fork = detectForkContext(env);
  if (token === null) {
    if (fork.isFork) {
      console.error(
        `fork PR context detected(head=${fork.head}, base=${env.GITHUB_REPOSITORY ?? '?'})、secret 不傳 fork、承 5a fail-closed`
      );
    } else {
      console.error(`auth token missing、GH_TOKEN 與 GITHUB_TOKEN 皆未設`);
    }
    return 2;
  }

  // 2. Owner/repo detection
  const repo = detectRepo(cwd, env);
  if (repo === null) {
    console.error(`無法決定 owner/repo(GITHUB_REPOSITORY env unset 且 git remote 解析失敗)`);
    return 2;
  }

  // 3. 讀 harness.config.json protectedBranches
  let branches: string[];
  try {
    const cfg = loadHarnessConfig(cwd);
    branches = [...cfg.protectedBranches];
  } catch (e) {
    console.error(`讀 harness.config.json 失敗:${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  if (branches.length === 0) {
    console.error(`harness.config.json protectedBranches 為空`);
    return 2;
  }

  // 4. 對每支 branch 驗
  const passBranches: string[] = [];
  const failBranches: Array<{ branch: string; msg: string }> = [];
  for (const branch of branches) {
    const res = ghFetchBranchProtection(repo, branch, token);
    if (!res.ok) {
      const diag = diagnosticFromStatus(res.status, fork.isFork);
      failBranches.push({ branch, msg: diag });
      continue;
    }
    // Parse + assert
    let protection: unknown;
    try {
      protection = parseBranchProtection(res.body);
    } catch (e) {
      const msg = e instanceof SyntaxError ? e.message : String(e);
      failBranches.push({ branch, msg: `gh api response 非 valid JSON:${msg}` });
      continue;
    }
    const assertion = assertBranchProtection(protection);
    if (!assertion.ok) {
      failBranches.push({ branch, msg: `assertion fail:${assertion.findings.join(' / ')}` });
      continue;
    }
    passBranches.push(branch);
  }

  if (failBranches.length > 0) {
    console.error(`BRANCH_PROTECTION_CHECK — FAIL`);
    for (const f of failBranches) console.error(`  [fail] branch=${f.branch}:${f.msg}`);
    if (passBranches.length > 0) console.error(`  [pass] branches:${passBranches.join(', ')}`);
    return 2;
  }

  console.log(`BRANCH_PROTECTION_CHECK — OK(${passBranches.length} branches):${passBranches.join(', ')}`);
  return 0;
}

// invoked-as-main pattern(承 scripts/lib/invoked-as-main.ts 慣例、簡化版直接檢查)
if (process.argv[1] && process.argv[1].endsWith('check-branch-protection.ts')) {
  process.exit(main());
}
