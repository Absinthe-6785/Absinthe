/** K-114 — Render watchdog audit. */
export const K114_WATCHDOG_FIELDS = [
  'request_id',
  'rss_before',
  'rss_after',
  'delta',
  'duration_ms',
] as const;

export function auditWatchdog(): readonly string[] {
  return [
    'backend/request_memory_watchdog.py',
    'backend/memory_profile.py',
    'X-Request-Id header',
    ...K114_WATCHDOG_FIELDS,
  ];
}
