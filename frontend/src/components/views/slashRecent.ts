/**
 * slashRecent.ts — Global per-browser slash command recency (localStorage)
 */
import type { BlockType } from './blockUtils';

const STORAGE_KEY = 'absinthe.slashRecent.v1';
const MAX_RECENT = 6;

function readStore(): BlockType[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((t): t is BlockType => typeof t === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeStore(types: BlockType[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(types.slice(0, MAX_RECENT)));
  } catch {
    // quota / private mode
  }
}

/** Most-recent slash picks, newest first. */
export function getSlashRecent(): BlockType[] {
  return readStore();
}

/** Bump a block type to the front of recent list (global, not per-note). */
export function recordSlashUsage(type: BlockType): void {
  const next = [type, ...readStore().filter(t => t !== type)];
  writeStore(next);
}

export function clearSlashRecent(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}
