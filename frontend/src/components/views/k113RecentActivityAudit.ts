/** K-113 — Shared recent activity projection audit. */
import {
  RECENT_ACTIVITY_BUCKETS,
  RECENT_ACTIVITY_DOMAINS,
} from './buildRecentActivityProjection';

export function auditRecentActivity(): readonly string[] {
  return [
    'buildRecentActivityProjection',
    ...RECENT_ACTIVITY_BUCKETS,
    ...RECENT_ACTIVITY_DOMAINS,
  ];
}
