/**
 * Best-effort exclusion for clearly non-common-equity instruments that have
 * been mislabeled as generic "stock" records upstream. This does not replace
 * a proper security-type field in the source database. Fund/ETF-like names are
 * excluded from common-equity lists so their unit prices cannot pollute stock rankings.
 */
const NON_COMMON_SECURITY_NAME = /\b(?:senior notes?|notes due|preferred stock|preferred shares?|depositary shares?|depositary receipts?|warrants?|rights?|units|etf|etn|exchange[- ]traded funds?|closed[- ]end funds?|fund units|investment trusts?|fixed-to-floating rate cumulative redeemable|blank check|special purpose acquisition|acquisition corp(?:oration)?\.?(?:\s+(?:i{1,3}|iv|v|vi|vii|viii|ix|x|\d+))?)\b/i;

export function isLikelyNonCommonSecurity(companyName: unknown): boolean {
  return typeof companyName === 'string' && NON_COMMON_SECURITY_NAME.test(companyName);
}

export function filterCommonEquityRows<T extends { company_name?: unknown; asset_type?: unknown }>(rows: T[]): T[] {
  return rows.filter(row => {
    if (typeof row.asset_type === 'string' && row.asset_type.trim().toLowerCase() !== 'stock') return false;
    return !isLikelyNonCommonSecurity(row.company_name);
  });
}
