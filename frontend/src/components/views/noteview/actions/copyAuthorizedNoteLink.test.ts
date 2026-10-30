import { describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '../../noteUtils';
import { serializeIdWikiLink, type WikiNoteTarget } from '../../wikiLinks';
import { copyAuthorizedNoteLink } from './copyAuthorizedNoteLink';

const note = (id: string, title: string, deletedAt: number | null = null): NoteBase => ({
  id, title, body: 'unchanged', updatedAt: 1, folderId: null, deletedAt,
});

function target(id: string, isCurrent = () => true): WikiNoteTarget {
  return { id, title: 'captured title', isCurrent };
}

describe('copyAuthorizedNoteLink', () => {
  it('copies the exact active ID with its current title, even when titles are duplicated', async () => {
    const state = { activeNoteId: 'note-b', notes: [note('note-a', 'Same title'), note('note-b', 'Same title')] };
    const writeText = vi.fn(async () => {});

    const result = await copyAuthorizedNoteLink({
      activeNoteId: state.activeNoteId,
      targets: [target('note-a'), target('note-b')],
      getCurrentState: () => state,
      writeText,
    });

    expect(result).toBe('copied');
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith(serializeIdWikiLink('note-b', 'Same title'));
    expect(state.notes.map(value => value.body)).toEqual(['unchanged', 'unchanged']);
  });

  it('keeps the immutable ID while using a renamed current title as the label', async () => {
    const state = { activeNoteId: 'stable-id', notes: [note('stable-id', 'Renamed')] };
    const writeText = vi.fn(async () => {});

    await copyAuthorizedNoteLink({
      activeNoteId: state.activeNoteId,
      targets: [target('stable-id')],
      getCurrentState: () => state,
      writeText,
    });

    expect(writeText).toHaveBeenCalledWith(serializeIdWikiLink('stable-id', 'Renamed'));
  });

  it.each([
    { label: 'no active note', activeNoteId: null, notes: [note('note-a', 'A')], current: true },
    { label: 'deleted note', activeNoteId: 'note-a', notes: [note('note-a', 'A', 2)], current: true },
    { label: 'stale publication', activeNoteId: 'note-a', notes: [note('note-a', 'A')], current: false },
  ])('does not copy for $label', async ({ activeNoteId, notes, current }) => {
    const writeText = vi.fn(async () => {});
    const result = await copyAuthorizedNoteLink({
      activeNoteId,
      targets: [target('note-a', () => current)],
      getCurrentState: () => ({ activeNoteId, notes }),
      writeText,
    });
    expect(result).toBe('stale');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('fails clearly when clipboard writing is unavailable or rejected', async () => {
    const state = { activeNoteId: 'note-a', notes: [note('note-a', 'A')] };
    const args = {
      activeNoteId: state.activeNoteId,
      targets: [target('note-a')],
      getCurrentState: () => state,
    };

    expect(await copyAuthorizedNoteLink(args)).toBe('unavailable');
    expect(await copyAuthorizedNoteLink({ ...args, writeText: async () => { throw new Error('denied'); } })).toBe('failed');
  });

  it('does not report success if the authorized selection changes while clipboard write is pending', async () => {
    const state = { activeNoteId: 'note-a' as string | null, notes: [note('note-a', 'A')] };
    let finish!: () => void;
    const writeText = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const resultPromise = copyAuthorizedNoteLink({
      activeNoteId: 'note-a',
      targets: [target('note-a')],
      getCurrentState: () => state,
      writeText,
    });
    state.activeNoteId = 'note-b';
    finish();

    expect(await resultPromise).toBe('stale');
  });
});
