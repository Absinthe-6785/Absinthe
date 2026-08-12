import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '@/components/views/noteUtils';
import {
  clearVaultRestoreSnapshot,
  hasVaultRestoreSnapshot,
  loadVaultRestoreSnapshot,
  saveVaultRestoreSnapshot,
  VAULT_RESTORE_SNAPSHOT_FAILURE_MESSAGE,
  VAULT_RESTORE_SNAPSHOT_KEY,
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

  it('fails closed when the backing store rejects the snapshot write', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); },
      removeItem: (key: string) => { store.delete(key); },
    });

    expect(() => saveVaultRestoreSnapshot([note('n1')], []))
      .toThrow(VAULT_RESTORE_SNAPSHOT_FAILURE_MESSAGE);
    expect(hasVaultRestoreSnapshot()).toBe(false);
  });

  it('preserves a previously valid undo snapshot when a replacement write fails', () => {
    saveVaultRestoreSnapshot([note('previous')], []);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (value.includes('replacement')) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        store.set(key, value);
      },
      removeItem: (key: string) => { store.delete(key); },
    });

    expect(() => saveVaultRestoreSnapshot([note('replacement')], []))
      .toThrow(VAULT_RESTORE_SNAPSHOT_FAILURE_MESSAGE);
    expect(loadVaultRestoreSnapshot()?.notes[0]?.id).toBe('previous');
  });

  it('fails closed when a write is not present on readback', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => key === VAULT_RESTORE_SNAPSHOT_KEY ? null : store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    });

    expect(() => saveVaultRestoreSnapshot([note('n1')], []))
      .toThrow(VAULT_RESTORE_SNAPSHOT_FAILURE_MESSAGE);
    expect(hasVaultRestoreSnapshot()).toBe(false);
  });

  it('rejects malformed or partial persisted snapshot data', () => {
    store.set(VAULT_RESTORE_SNAPSHOT_KEY, JSON.stringify({
      savedAt: '2026-01-01T00:00:00.000Z',
      notes: [{ id: 'partial-note' }],
      folders: [],
    }));

    expect(loadVaultRestoreSnapshot()).toBeNull();
    expect(hasVaultRestoreSnapshot()).toBe(false);
  });
});
