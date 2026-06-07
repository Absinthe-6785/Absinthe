import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSlashRecent, getSlashRecent, recordSlashUsage } from './slashRecent';

const store = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
};

describe('slashRecent', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    store.clear();
  });
  afterEach(() => {
    clearSlashRecent();
    vi.unstubAllGlobals();
  });

  it('starts empty', () => {
    expect(getSlashRecent()).toEqual([]);
  });

  it('records usage globally with newest first', () => {
    recordSlashUsage('heading1');
    recordSlashUsage('todo');
    recordSlashUsage('toggle');
    expect(getSlashRecent()).toEqual(['toggle', 'todo', 'heading1']);
  });

  it('dedupes on repeat', () => {
    recordSlashUsage('todo');
    recordSlashUsage('heading1');
    recordSlashUsage('todo');
    expect(getSlashRecent()).toEqual(['todo', 'heading1']);
  });

  it('clearSlashRecent resets store', () => {
    recordSlashUsage('code');
    clearSlashRecent();
    expect(getSlashRecent()).toEqual([]);
  });
});
