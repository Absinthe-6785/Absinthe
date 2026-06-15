/**
 * Lightweight session breadcrumb for cross-workspace note navigation (K-67).
 */
import type { TranslationKey } from './i18n';

export type NoteBreadcrumbSegment =
  | { type: 'key'; key: TranslationKey }
  | { type: 'label'; label: string };

const STORAGE_KEY = 'absinthe.noteNav.breadcrumb';
const listeners = new Set<() => void>();

let segments: NoteBreadcrumbSegment[] = [];

function canUseSessionStorage(): boolean {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

function persist(): void {
  if (!canUseSessionStorage()) return;
  try {
    if (segments.length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(segments));
  } catch {
    /* */
  }
}

function load(): void {
  if (!canUseSessionStorage()) return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) segments = parsed as NoteBreadcrumbSegment[];
  } catch {
    segments = [];
  }
}

function notify(): void {
  persist();
  listeners.forEach(fn => fn());
}

load();

export function subscribeNoteBreadcrumb(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNoteBreadcrumb(): readonly NoteBreadcrumbSegment[] {
  return segments;
}

function segmentsEqual(
  a: readonly NoteBreadcrumbSegment[],
  b: readonly NoteBreadcrumbSegment[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((seg, i) => {
    const other = b[i];
    if (seg.type !== other.type) return false;
    if (seg.type === 'key' && other.type === 'key') return seg.key === other.key;
    if (seg.type === 'label' && other.type === 'label') return seg.label === other.label;
    return false;
  });
}

export function setNoteBreadcrumb(next: readonly NoteBreadcrumbSegment[]): void {
  if (segmentsEqual(segments, next)) return;
  segments = [...next];
  notify();
}

export function clearNoteBreadcrumb(): void {
  segments = [];
  notify();
}

/** Test-only reset. */
export function resetNoteBreadcrumb(): void {
  segments = [];
  if (canUseSessionStorage()) {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* */ }
  }
  notify();
}
