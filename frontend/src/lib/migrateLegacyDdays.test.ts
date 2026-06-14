import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./supabase', () => ({
  authFetch: vi.fn(),
}));

vi.mock('../store/useNotesStore', () => ({
  useNotesStore: {
    getState: vi.fn(),
  },
}));

import { authFetch } from './supabase';
import { useNotesStore } from '../store/useNotesStore';
import { migrateLegacyDdays, resetDdayMigrationFlag } from './migrateLegacyDdays';

const mockFetch = vi.mocked(authFetch);
const mockGetState = vi.mocked(useNotesStore.getState);

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
  });
  resetDdayMigrationFlag();
  vi.clearAllMocks();
});

describe('migrateLegacyDdays', () => {
  it('skips when migration flag is already set', async () => {
    localStorage.setItem('absinthe:dday-migration-v1', 'done');
    const result = await migrateLegacyDdays();
    expect(result).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sets flag and returns 0 when no legacy rows exist', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const result = await migrateLegacyDdays();
    expect(result).toBe(0);
    expect(localStorage.getItem('absinthe:dday-migration-v1')).toBe('done');
  });

  it('creates event notes and deletes legacy rows', async () => {
    const notes: {
      id: string; title: string; body: string; folderId: null; starred: boolean;
      deletedAt: null; createdAt: number; updatedAt: number;
      properties: Record<string, string>; relations: Record<string, unknown>;
    }[] = [];
    const createNote = vi.fn(({ title }: { title: string }) => {
      const id = 'note-1';
      notes.push({
        id, title, body: '', folderId: null, starred: false,
        deletedAt: null, createdAt: 1, updatedAt: 1, properties: {}, relations: {},
      });
      return id;
    });
    const updateNote = vi.fn();
    mockGetState.mockImplementation(() => ({
      notes,
      createNote,
      updateNote,
    } as ReturnType<typeof useNotesStore.getState>));

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'sch-1', text: 'EJU Exam', date: '2026-11-15' }],
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);

    const result = await migrateLegacyDdays();
    expect(result).toBe(1);
    expect(createNote).toHaveBeenCalledWith({ title: 'EJU Exam' });
    expect(updateNote).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/schedules/sch-1'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(localStorage.getItem('absinthe:dday-migration-v1')).toBe('done');
  });
});
