import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import {
  clearVaultRestoreSnapshot,
  hasVaultRestoreSnapshot,
  loadVaultRestoreSnapshot,
  saveVaultRestoreSnapshot,
} from './vaultRestoreSnapshot';

function note(id: string): NoteBase {
  return {
    id,
    title: 'Test',
    body: 'body',
    folderId: null,
    starred: false,
    deletedAt: null,
    createdAt: 1,
    updatedAt: 1,
    properties: {},
    relations: {},
  };
}

describe('vaultRestoreSnapshot', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    });
    clearVaultRestoreSnapshot();
  });

  it('saves and loads snapshot', () => {
    saveVaultRestoreSnapshot([note('n1')], [{ id: 'f1', name: 'F', createdAt: 1 }]);
    expect(hasVaultRestoreSnapshot()).toBe(true);
    const snap = loadVaultRestoreSnapshot();
    expect(snap?.notes).toHaveLength(1);
    expect(snap?.folders).toHaveLength(1);
  });

  it('clears snapshot', () => {
    saveVaultRestoreSnapshot([note('n1')], []);
    clearVaultRestoreSnapshot();
    expect(hasVaultRestoreSnapshot()).toBe(false);
  });
});
