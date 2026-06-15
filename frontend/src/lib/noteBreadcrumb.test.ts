// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getNoteBreadcrumb,
  setNoteBreadcrumb,
  clearNoteBreadcrumb,
  resetNoteBreadcrumb,
  subscribeNoteBreadcrumb,
} from './noteBreadcrumb';

const storage = new Map<string, string>();
vi.stubGlobal('sessionStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => { storage.clear(); },
  key: () => null,
  length: 0,
});

describe('noteBreadcrumb', () => {
  beforeEach(() => {
    storage.clear();
    resetNoteBreadcrumb();
  });

  it('starts empty', () => {
    expect(getNoteBreadcrumb()).toEqual([]);
  });

  it('setNoteBreadcrumb stores segments in sessionStorage', () => {
    const segments = [
      { type: 'key' as const, key: 'archiveHomeTitle' as const },
      { type: 'label' as const, label: 'My note' },
    ];
    setNoteBreadcrumb(segments);
    expect(getNoteBreadcrumb()).toEqual(segments);
    const raw = sessionStorage.getItem('absinthe.noteNav.breadcrumb');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual(segments);
  });

  it('clearNoteBreadcrumb removes persisted state', () => {
    setNoteBreadcrumb([{ type: 'key', key: 'healthNavWorkout' }]);
    clearNoteBreadcrumb();
    expect(getNoteBreadcrumb()).toEqual([]);
    expect(sessionStorage.getItem('absinthe.noteNav.breadcrumb')).toBeNull();
  });

  it('subscribeNoteBreadcrumb notifies on change', () => {
    const calls: number[] = [];
    const unsub = subscribeNoteBreadcrumb(() => calls.push(calls.length));
    setNoteBreadcrumb([{ type: 'key', key: 'graphModeCosmos' }]);
    clearNoteBreadcrumb();
    unsub();
    expect(calls.length).toBe(2);
  });
});
