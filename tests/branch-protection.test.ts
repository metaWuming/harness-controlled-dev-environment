// tests/branch-protection.test.ts — Sprint 19 C1 pure lib unit
//
// 契約(承 plan r11):
//   assertBranchProtection(protection: unknown) → AssertResult
//   parseBranchProtection(json: string) throws SyntaxError on parse error(單一路徑、不回 findings)
// Case 1-5:A-D contract + 正對照
// Case 6:JSON parse throws SyntaxError(單一路徑)
// Case 7:restrictions 存在或不存在皆不影響(承 out-of-scope pinned)

import { describe, expect, it } from 'vitest';
import { assertBranchProtection, parseBranchProtection } from '../scripts/lib/branch-protection';

const OK = {
  required_status_checks: { contexts: ['ci'] },
  enforce_admins: { enabled: true },
  required_pull_request_reviews: {},
};

describe('assertBranchProtection — A-D contract + restrictions out-of-scope', () => {
  it('case 1:正對照齊備 A-D → ok', () => {
    const r = assertBranchProtection(OK);
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
  });
  it('case 2:assertion A fail — required_status_checks 缺', () => {
    const rest = { enforce_admins: OK.enforce_admins, required_pull_request_reviews: OK.required_pull_request_reviews };
    const r = assertBranchProtection(rest);
    expect(r.ok).toBe(false);
    expect(r.findings.join('|')).toMatch(/required_status_checks/);
  });
  it('case 3:assertion B fail — contexts 空', () => {
    const r = assertBranchProtection({ ...OK, required_status_checks: { contexts: [] } });
    expect(r.ok).toBe(false);
    expect(r.findings.join('|')).toMatch(/contexts/);
  });
  it('case 4:assertion C fail — enforce_admins.enabled false', () => {
    const r = assertBranchProtection({ ...OK, enforce_admins: { enabled: false } });
    expect(r.ok).toBe(false);
    expect(r.findings.join('|')).toMatch(/enforce_admins/);
  });
  it('case 5:assertion D fail — required_pull_request_reviews 缺', () => {
    const rest = { required_status_checks: OK.required_status_checks, enforce_admins: OK.enforce_admins };
    const r = assertBranchProtection(rest);
    expect(r.ok).toBe(false);
    expect(r.findings.join('|')).toMatch(/required_pull_request_reviews/);
  });
  it('case 6:parseBranchProtection JSON parse → throws SyntaxError(單一路徑)', () => {
    expect(() => parseBranchProtection('{malformed')).toThrow(SyntaxError);
  });
  it('case 7:restrictions 存在或不存在皆不影響(out-of-scope)', () => {
    expect(assertBranchProtection({ ...OK, restrictions: {} }).ok).toBe(true);
    expect(assertBranchProtection({ ...OK, restrictions: null }).ok).toBe(true);
    expect(assertBranchProtection(OK).ok).toBe(true);
  });
});
