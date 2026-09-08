// scripts/lib/branch-protection.ts — Sprint 19 C1 pure lib
//
// 契約:單一 assertion signature `assertBranchProtection(protection: unknown) → AssertResult`。
// 不做 subprocess call、不讀 env、不讀 git remote(CLI adapter 責任)。
// A-D 契約(承 plan r11):
//   A. protection.required_status_checks object 存在(非 null / undefined)
//   B. protection.required_status_checks.contexts 陣列非空(至少 1 個 required check name)
//   C. protection.enforce_admins.enabled === true
//   D. protection.required_pull_request_reviews object 存在
// restrictions 明確 out-of-scope、不驗。

export interface AssertResult {
  ok: boolean;
  findings: string[]; // 具體不合契約點、對照 A-D、空陣列 iff ok=true
}

/** JSON.parse throws SyntaxError on parse error;CLI adapter catch → exit 2 diagnostic。 */
export function parseBranchProtection(json: string): unknown {
  return JSON.parse(json);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function assertBranchProtection(protection: unknown): AssertResult {
  const findings: string[] = [];
  if (!isObject(protection)) {
    findings.push('protection 非 object');
    return { ok: false, findings };
  }
  // A. required_status_checks object 存在
  const rsc = protection.required_status_checks;
  if (!isObject(rsc)) {
    findings.push('required_status_checks object 不存在(A)');
  } else {
    // B. contexts 陣列非空
    const contexts = rsc.contexts;
    if (!Array.isArray(contexts) || contexts.length === 0) {
      findings.push('required_status_checks.contexts 陣列為空或非陣列(B)');
    }
  }
  // C. enforce_admins.enabled === true
  const ea = protection.enforce_admins;
  if (!isObject(ea) || ea.enabled !== true) {
    findings.push('enforce_admins.enabled 非 true(C)');
  }
  // D. required_pull_request_reviews object 存在
  const rpr = protection.required_pull_request_reviews;
  if (!isObject(rpr)) {
    findings.push('required_pull_request_reviews object 不存在(D)');
  }
  return { ok: findings.length === 0, findings };
}
