/** K-113 — Shared recent activity projection audit. */
import {
  RECENT_ACTIVITY_BUCKETS,
  RECENT_ACTIVITY_DOMAINS,
} from './buildRecentActivityProjection';

export const K113_RECENT_ACTIVITY_HOOKS = [
  'data-k113-recent-activity',
  'data-k113-recent-activity-group',
  'data-k113-recent-activity-row',
  'data-k113-recent-activity-domain',
  'data-k113-recent-activity-empty',
] as const;

export function auditRecentActivity(): readonly string[] {
  return [
    'buildRecentActivityProjection',
    ...RECENT_ACTIVITY_BUCKETS,
    ...RECENT_ACTIVITY_DOMAINS,
    ...K113_RECENT_ACTIVITY_HOOKS,
  ];
}
