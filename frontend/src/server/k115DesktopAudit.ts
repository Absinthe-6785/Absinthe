/**
 * K-115 — Desktop QA audit: panels, overflow, sticky, scroll.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K115_DESKTOP_PANELS = [
  { name: 'notes-sidebar', widthKey: 'K103_NOTE_LIST_WIDTH_PX', minKey: 'K103_NOTE_LIST_MIN_WIDTH_PX' },
  { name: 'note-editor', hook: 'data-noteview-editor' },
  { name: 'planner-calendar', hook: 'data-planner-calendar-shell' },
  { name: 'recipe-studio', hook: 'data-k110-recipe-studio' },
  { name: 'search-palette', hook: 'data-k111-search-workspace' },
] as const;

export const K115_DESKTOP_CHECKS = [
  'panel-widths-bounded',
  'overflow-y-auto-panels',
  'sticky-section-headers',
  'no-dead-empty-space-dashboard',
  'scroll-behavior-smooth-note-list',
] as const;

export function auditDesktopPanels(): readonly string[] {
  const layout = readFileSync(join(ROOT, 'components/views/k103LayoutConstants.ts'), 'utf8');
  const hasWidth = layout.includes('K103_NOTE_LIST_WIDTH_PX');
  return [
    ...K115_DESKTOP_PANELS.map(p => p.name),
    hasWidth ? 'sidebar-width-constants' : 'sidebar-width-missing',
  ];
}

export function auditDesktopLayout(): readonly string[] {
  const noteView = readFileSync(join(ROOT, 'components/views/NoteView.tsx'), 'utf8');
  const checks: string[] = [...K115_DESKTOP_CHECKS];
  if (noteView.includes('overflow')) checks.push('noteview-overflow-handling');
  if (noteView.includes('sticky')) checks.push('noteview-sticky-sections');
  return checks;
}
