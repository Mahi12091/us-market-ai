/**
 * Best-effort exclusion for clearly non-common-equity instruments that have
 * been mislabeled as generic "stock" records upstream. This does not replace
 * a proper security-type field in the source database.
 */
const NON_COMMON_SECURITY_NAME = /\b(?:senior notes?|notes due|preferred stock|preferred shares?|depositary shares?|warrants?|rights?|units|fixed-to-floating rate cumulative redeemable)\b/i;

export function isLikelyNonCommonSecurity(companyName: unknown): boolean {
  return typeof companyName === 'string' && NON_COMMON_SECURITY_NAME.test(companyName);
}

export function filterCommonEquityRows<T extends { company_name?: unknown }>(rows: T[]): T[] {
  return rows.filter(row => !isLikelyNonCommonSecurity(row.company_name));
}
