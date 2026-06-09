import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSlashPalette } from './slashPalette';
import { clearSlashRecent, recordSlashUsage } from './slashRecent';

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};

describe('slashPalette', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    store.clear();
  });
  afterEach(() => {
    clearSlashRecent();
    vi.unstubAllGlobals();
  });

  it('empty query returns pinned items', () => {
    const { items } = buildSlashPalette('');
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].type).toBe('paragraph');
  });

  it('search query skips recent section', () => {
    recordSlashUsage('todo');
    const { recent, items } = buildSlashPalette('todo');
    expect(recent).toEqual([]);
    expect(items.some(m => m.type === 'todo')).toBe(true);
  });

  it('recent section excludes duplicates from main list', () => {
    recordSlashUsage('todo');
    recordSlashUsage('toggle');
    const { recent, items } = buildSlashPalette('');
    expect(recent.map(m => m.type)).toEqual(['toggle', 'todo']);
    expect(items.some(m => m.type === 'toggle')).toBe(false);
    expect(items.some(m => m.type === 'todo')).toBe(false);
  });

  it('heading alias matches heading types', () => {
    const types = buildSlashPalette('heading').items.map(m => m.type);
    expect(types).toContain('heading1');
    expect(types).toContain('heading2');
  });

  it('fold alias matches toggle', () => {
    const types = buildSlashPalette('fold').items.map(m => m.type);
    expect(types).toContain('toggle');
  });
});
