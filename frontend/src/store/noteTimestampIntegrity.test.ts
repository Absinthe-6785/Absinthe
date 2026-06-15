import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';
import { NOTES_KEY } from '../components/views/noteUtils';
import { setNoteKind } from '../components/views/features/knowledge/research/noteClassification';
import { setWeakTopic } from '../components/views/features/knowledge/study/weakTopicTracking';
import { addTag, removeTag } from '../components/views/features/knowledge/tags/noteTags';
import {
  isMetadataOnlyPatch,
  shouldBumpContentUpdatedAt,
  mergeNotePatch,
} from './notePatchPolicy';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => { storage.clear(); },
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() { return storage.size; },
});

vi.mock('../lib/supabase', () => ({
  authFetch: vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
}));

const { useNotesStore } = await import('./useNotesStore');

function baseNote(overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id: 'note-ts-1',
    title: 'Test',
    body: 'Hello',
    updatedAt: 1_000_000,
    folderId: null,
    deletedAt: null,
    starred: false,
    ...overrides,
  };
}

describe('notePatchPolicy', () => {
  it('classifies metadata-only patches', () => {
    expect(isMetadataOnlyPatch({ properties: { tags: 'a' } })).toBe(true);
    expect(isMetadataOnlyPatch({ starred: true })).toBe(true);
    expect(isMetadataOnlyPatch({ relations: {} })).toBe(true);
    expect(isMetadataOnlyPatch({ folderId: 'f1' })).toBe(true);
    expect(isMetadataOnlyPatch({ body: 'x' })).toBe(false);
    expect(isMetadataOnlyPatch({ title: 'New' })).toBe(false);
    expect(isMetadataOnlyPatch({ body: 'x', properties: { tags: 'a' } })).toBe(false);
  });

  it('mergeNotePatch preserves updatedAt for metadata', () => {
    const note = baseNote();
    const tagged = mergeNotePatch(note, { properties: { tags: 'math' } }, 9_999_999);
    expect(tagged.updatedAt).toBe(1_000_000);
    const edited = mergeNotePatch(note, { body: 'Changed' }, 9_999_999);
    expect(edited.updatedAt).toBe(9_999_999);
  });

  it('shouldBumpContentUpdatedAt mirrors metadata detection', () => {
    expect(shouldBumpContentUpdatedAt({ properties: { noteKind: 'concept' } })).toBe(false);
    expect(shouldBumpContentUpdatedAt({ title: 'Renamed' })).toBe(true);
  });
});

describe('useNotesStore updatedAt integrity', () => {
  beforeEach(() => {
    storage.clear();
    useNotesStore.setState({
      notes: [baseNote()],
      folders: [],
      activeNoteId: 'note-ts-1',
      activeFolderId: null,
      vaultStructureVersion: 0,
      indexContentVersion: 0,
      isSyncing: false,
      savedAt: null,
      syncError: null,
    });
    storage.set(NOTES_KEY, JSON.stringify([baseNote()]));
  });

  it('bumps updatedAt on body edit', () => {
    useNotesStore.getState().updateNote('note-ts-1', { body: 'Updated body' });
    expect(useNotesStore.getState().notes[0].updatedAt).toBeGreaterThan(1_000_000);
  });

  it('bumps updatedAt on title edit', () => {
    useNotesStore.getState().updateNote('note-ts-1', { title: 'Renamed' });
    expect(useNotesStore.getState().notes[0].updatedAt).toBeGreaterThan(1_000_000);
  });

  it('does not bump updatedAt on tag property edit', () => {
    const withTag = addTag(baseNote(), 'english');
    useNotesStore.setState({ notes: [withTag] });
    useNotesStore.getState().updateNote('note-ts-1', { properties: withTag.properties });
    expect(useNotesStore.getState().notes[0].updatedAt).toBe(1_000_000);
  });

  it('does not bump updatedAt on tag removal', () => {
    const withTag = addTag(baseNote(), 'english');
    useNotesStore.setState({ notes: [withTag] });
    const cleared = removeTag(withTag, 'english');
    useNotesStore.getState().updateNote('note-ts-1', { properties: cleared.properties });
    expect(useNotesStore.getState().notes[0].updatedAt).toBe(1_000_000);
  });

  it('does not bump updatedAt on classification change', () => {
    const classified = setNoteKind(baseNote(), 'concept');
    useNotesStore.getState().updateNote('note-ts-1', { properties: classified.properties });
    expect(useNotesStore.getState().notes[0].updatedAt).toBe(1_000_000);
  });

  it('does not bump updatedAt on weak topic toggle', () => {
    const weak = setWeakTopic(baseNote(), true);
    useNotesStore.getState().updateNote('note-ts-1', { properties: weak.properties });
    expect(useNotesStore.getState().notes[0].updatedAt).toBe(1_000_000);
  });

  it('does not bump updatedAt on favorite toggle', () => {
    useNotesStore.getState().toggleStar('note-ts-1');
    expect(useNotesStore.getState().notes[0].updatedAt).toBe(1_000_000);
    expect(useNotesStore.getState().notes[0].starred).toBe(true);
  });
});
