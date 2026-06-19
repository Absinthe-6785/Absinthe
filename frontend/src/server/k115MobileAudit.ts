/**
 * K-115 — Release candidate mobile QA audit (320 / 375 / 768).
 */
import { TOUCH_TARGET_MIN_PX } from '../lib/responsiveLayout';

export const K115_MOBILE_WIDTHS = [320, 375, 768] as const;

export const K115_MOBILE_DOMAINS = [
  { domain: 'notes', hooks: ['data-noteview-new-note-btn', 'mobile-sidebar-drawer'] },
  { domain: 'planner', hooks: ['data-schedule-event-detail', 'data-k108-empty'] },
  { domain: 'health', hooks: ['data-k107-empty', 'data-k113-open-workout-note'] },
  { domain: 'archive', hooks: ['data-k109-archive-shell', 'data-k113-open-in-notes'] },
  { domain: 'recipe', hooks: ['data-k110-recipe-studio', 'data-k113-open-cooking-note'] },
  { domain: 'search', hooks: ['data-k111-search-modal', 'data-k111-search-card'] },
] as const;

export const K115_MOBILE_CHECKLIST = [
  'headers-compact',
  'toolbars-touch-44px',
  'more-menus-overflow',
  'empty-states-product',
  'cross-links-touch-44px',
] as const;

export function auditMobileWidths(): readonly number[] {
  return K115_MOBILE_WIDTHS;
}

export function auditMobileTouchTargets(): boolean {
  return TOUCH_TARGET_MIN_PX >= 44;
}

export function auditMobileDomains(): readonly string[] {
  return K115_MOBILE_DOMAINS.flatMap(d => d.hooks.map(h => `${d.domain}:${h}`));
}

export function auditMobileChecklist(): readonly string[] {
  return [...K115_MOBILE_CHECKLIST, ...K115_MOBILE_WIDTHS.map(String)];
}
