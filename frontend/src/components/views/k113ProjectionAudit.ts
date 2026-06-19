/** K-113 — Projection sanity — five domain projections + one activity composer. */
import { K112_PROJECTIONS, auditProjectionSinglePass } from './k112ProjectionAudit';

export const K113_ACTIVITY_COMPOSER = {
  name: 'RecentActivityProjection',
  builder: 'buildRecentActivityProjection.ts',
  hook: 'WorkspaceDashboardView / NoteViewSidebar',
  isGlobal: false,
} as const;

export function auditProjections(): readonly string[] {
  return [...K112_PROJECTIONS.map(p => p.name), K113_ACTIVITY_COMPOSER.name];
}

export function auditProjectionIndependence(): boolean {
  return auditProjectionSinglePass() && !K113_ACTIVITY_COMPOSER.isGlobal;
}

export function auditNoGlobalProjection(): boolean {
  return auditProjectionIndependence();
}
