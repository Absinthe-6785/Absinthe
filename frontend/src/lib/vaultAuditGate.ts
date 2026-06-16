/**
 * Opt-in gate for heavy vault audit/benchmark tests.
 * Set RUN_VAULT_AUDIT=1 to enable (e.g. npm run audit:discovery).
 * Skipped in CI and default `npm test` runs.
 */
export function shouldRunVaultAudit(): boolean {
  const flag = process.env.RUN_VAULT_AUDIT;
  return flag === '1' || flag === 'true';
}
