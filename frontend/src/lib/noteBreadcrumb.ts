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

export function setNoteBreadcrumb(next: readonly NoteBreadcrumbSegment[]): void {
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
