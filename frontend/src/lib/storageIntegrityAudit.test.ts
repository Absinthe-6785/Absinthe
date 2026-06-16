// @vitest-environment happy-dom
/**
 * K-88 — Storage integrity audit verification.
 * Simulates browser cleanup cases against the canonical key inventory.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  LOCAL_STORAGE_KEYS,
  LOCAL_STORAGE_PREFIXES,
  SESSION_STORAGE_KEYS,
  STORAGE_INVENTORY,
} from './storageInventory';

function seedAllLocalStorage(): void {
  for (const key of LOCAL_STORAGE_KEYS) {
    localStorage.setItem(key, JSON.stringify({ audit: key }));
  }
  localStorage.setItem('healthDraft:2026-06-14', '{"sets":[]}');
  localStorage.setItem('healthMemo:2026-06-14', 'memo');
  localStorage.setItem('sb-test-auth-token', '{"access_token":"x"}');
}

function seedSessionStorage(): void {
  for (const key of SESSION_STORAGE_KEYS) {
    sessionStorage.setItem(key, JSON.stringify({ audit: key }));
  }
}

/** Case C — Chromium "Cookies and other site data" clears origin storage. */
function clearSiteData(): void {
  localStorage.clear();
  sessionStorage.clear();
}

describe('K-88 storage integrity audit', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('inventory covers all documented localStorage keys', () => {
    const documented = new Set<string>([
      ...LOCAL_STORAGE_KEYS,
      ...LOCAL_STORAGE_PREFIXES.map(p => `${p}*`),
      'sb-test-auth-token',
    ]);
    const notesEntry = STORAGE_INVENTORY.find(e => e.id === 'notes');
    expect(notesEntry?.keyOrTable).toBe('notes-v2');
    expect(documented.has('notes-v2')).toBe(true);
    expect(LOCAL_STORAGE_KEYS.length).toBeGreaterThanOrEqual(25);
  });

  it('Case A — cookie-only cleanup does not clear localStorage (simulated)', () => {
    seedAllLocalStorage();
    // Browser: deleting cookies does not invoke localStorage.clear()
    expect(localStorage.getItem('notes-v2')).not.toBeNull();
    expect(localStorage.getItem('note-folders-v2')).not.toBeNull();
  });

  it('Case B — cache-only cleanup does not clear localStorage (simulated)', () => {
    seedAllLocalStorage();
    // HTTP cache eviction has no API in tests; localStorage unchanged by design
    expect(localStorage.getItem('notes-v2')).not.toBeNull();
    expect(localStorage.getItem('planner-storage')).not.toBeNull();
  });

  it('Case C — site data clear wipes notes, tags, and workspace config', () => {
    const tagsNote = {
      id: 'n1',
      title: 'Tagged',
      body: '[]',
      updatedAt: 1,
      properties: { tags: '["Japanese"]' },
    };
    localStorage.setItem('notes-v2', JSON.stringify([tagsNote]));
    seedAllLocalStorage();
    seedSessionStorage();

    clearSiteData();

    expect(localStorage.getItem('notes-v2')).toBeNull();
    expect(localStorage.getItem('note-saved-views-v1')).toBeNull();
    expect(sessionStorage.getItem('absinthe.noteNav.v1')).toBeNull();
  });

  it('Case D — fresh profile starts empty; tags absent until notes loaded', () => {
    expect(localStorage.getItem('notes-v2')).toBeNull();
    const critical = STORAGE_INVENTORY.filter(e => e.tier === 'critical' && e.layer === 'localStorage');
    expect(critical.some(e => e.id === 'notes')).toBe(true);
  });

  it('tags live inside notes-v2 properties — not a separate store', () => {
    const entry = STORAGE_INVENTORY.find(e => e.id === 'note-properties');
    expect(entry?.keyOrTable).toContain('notes-v2');
    expect(entry?.recoverable).toBe('vault-export');

    const note = {
      id: 'x',
      title: 'T',
      body: '[]',
      updatedAt: 1,
      properties: { tags: '["grammar"]' },
    };
    localStorage.setItem('notes-v2', JSON.stringify([note]));
    const loaded = JSON.parse(localStorage.getItem('notes-v2')!) as typeof note[];
    expect(loaded[0].properties.tags).toContain('grammar');
  });

  it('knowledge index is not persisted — loss is recoverable by rebuild', () => {
    const idx = STORAGE_INVENTORY.find(e => e.id === 'knowledge-index');
    expect(idx?.layer).toBe('memory');
    expect(idx?.recoverable).toBe('regenerate');
  });
});
