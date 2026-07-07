import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NotesOverviewSignalPanel } from './NotesOverviewSignalPanel';
import {
  createNotesOverviewSignalPanelProps,
  SIGNAL_PANEL_RECENT_NOTE_LIMIT,
  type NotesOverviewSignalPanelAdapterInput,
} from './notesOverviewSignalPanelAdapter';

const formatDateLabel = (value: string | number): string => `label:${value}`;

function renderAdapterOutput(input: NotesOverviewSignalPanelAdapterInput): string {
  return renderToStaticMarkup(
    createElement(NotesOverviewSignalPanel, createNotesOverviewSignalPanelProps(input)),
  );
}

describe('notesOverviewSignalPanelAdapter', () => {
  it('maps empty input to safe empty Signal Panel props', () => {
    const output = createNotesOverviewSignalPanelProps({ notes: [] });

    expect(output).toEqual({
      data: {
        generatedFrom: 'local-note-metadata',
        recentNotes: [],
        activeWriting: { state: 'unavailable' },
        emptyState: {
          hasNotes: false,
          noteCount: 0,
          reason: 'empty-vault',
        },
      },
    });
  });

  it('sorts recent notes by valid updatedAt descending', () => {
    const output = createNotesOverviewSignalPanelProps({
      notes: [
        { id: 'old', title: 'Old', updatedAt: 1000 },
        { id: 'new', title: 'New', updatedAt: 3000 },
        { id: 'middle', title: 'Middle', updatedAt: 2000 },
      ],
    });

    expect(output.data.recentNotes.map(note => note.id)).toEqual(['new', 'middle', 'old']);
  });

  it('falls back to createdAt when updatedAt is missing or invalid', () => {
    const output = createNotesOverviewSignalPanelProps({
      notes: [
        { id: 'created-low', title: 'Created low', createdAt: 1000 },
        { id: 'created-high', title: 'Created high', updatedAt: 'not-a-date', createdAt: 5000 },
        { id: 'updated', title: 'Updated', updatedAt: 3000, createdAt: 1 },
      ],
      formatDateLabel,
    });

    expect(output.data.recentNotes.map(note => note.id)).toEqual([
      'created-high',
      'updated',
      'created-low',
    ]);
    expect(output.data.recentNotes[0]).toMatchObject({
      createdAt: 'label:5000',
    });
    expect(output.data.recentNotes[1]).toMatchObject({
      updatedAt: 'label:3000',
    });
  });

  it('preserves stable input order when timestamps are invalid or missing', () => {
    const output = createNotesOverviewSignalPanelProps({
      notes: [
        { id: 'first', title: 'First', updatedAt: 'invalid' },
        { id: 'second', title: 'Second' },
        { id: 'third', title: 'Third', createdAt: '' },
      ],
    });

    expect(output.data.recentNotes.map(note => note.id)).toEqual(['first', 'second', 'third']);
  });

  it('caps recent notes count', () => {
    const output = createNotesOverviewSignalPanelProps({
      notes: Array.from({ length: SIGNAL_PANEL_RECENT_NOTE_LIMIT + 2 }, (_, index) => ({
        id: `note-${index}`,
        title: `Note ${index}`,
        updatedAt: 10_000 - index,
      })),
    });

    expect(output.data.recentNotes).toHaveLength(SIGNAL_PANEL_RECENT_NOTE_LIMIT);
    expect(output.data.recentNotes.map(note => note.id)).toEqual([
      'note-0',
      'note-1',
      'note-2',
      'note-3',
      'note-4',
    ]);
  });

  it('maps activeNoteId to active writing only when it matches a non-deleted local note', () => {
    const active = createNotesOverviewSignalPanelProps({
      notes: [
        { id: 'visible', title: 'Visible', updatedAt: 1000 },
        { id: 'deleted', title: 'Deleted', updatedAt: 2000, deletedAt: 3000 },
      ],
      activeNoteId: 'visible',
      formatDateLabel,
    });
    const missing = createNotesOverviewSignalPanelProps({
      notes: [{ id: 'visible', title: 'Visible', updatedAt: 1000 }],
      activeNoteId: 'missing',
    });
    const deleted = createNotesOverviewSignalPanelProps({
      notes: [
        { id: 'deleted', title: 'Deleted', updatedAt: 2000, deletedAt: 3000 },
        { id: 'visible', title: 'Visible', updatedAt: 1000 },
      ],
      activeNoteId: 'deleted',
    });

    expect(active.data.activeWriting).toEqual({
      state: 'active',
      currentNoteId: 'visible',
      currentNoteTitle: 'Visible',
      lastEditedAt: 'label:1000',
    });
    expect(missing.data.activeWriting).toEqual({ state: 'idle' });
    expect(deleted.data.activeWriting).toEqual({ state: 'idle' });
  });

  it('maps missing blank and legacy Untitled titles to a safe placeholder', () => {
    const output = createNotesOverviewSignalPanelProps({
      notes: [
        { id: 'blank', title: '   ', updatedAt: 3000 },
        { id: 'legacy', title: 'Untitled', updatedAt: 2000 },
        { id: 'missing', updatedAt: 1000 },
      ],
      activeNoteId: 'blank',
      resolveUntitledTitle: () => 'Local fallback title',
    });

    expect(output.data.recentNotes.map(note => note.title)).toEqual([
      'Local fallback title',
      'Local fallback title',
      'Local fallback title',
    ]);
    expect(output.data.activeWriting.currentNoteTitle).toBe('Local fallback title');
  });

  it('falls back to Untitled note when the fallback resolver is empty', () => {
    const output = createNotesOverviewSignalPanelProps({
      notes: [{ id: 'empty-fallback', title: null, updatedAt: 1000 }],
      resolveUntitledTitle: () => '   ',
    });

    expect(output.data.recentNotes[0].title).toBe('Untitled note');
  });

  it('filters deleted notes from recent notes and note counts', () => {
    const output = createNotesOverviewSignalPanelProps({
      notes: [
        { id: 'visible', title: 'Visible', updatedAt: 1000 },
        { id: 'deleted-number', title: 'Deleted number', updatedAt: 3000, deletedAt: 4000 },
        { id: 'deleted-string', title: 'Deleted string', updatedAt: 2000, deletedAt: '2026-07-07' },
      ],
    });

    expect(output.data.recentNotes.map(note => note.id)).toEqual(['visible']);
    expect(output.data.emptyState).toEqual({
      hasNotes: true,
      noteCount: 1,
      reason: 'ready',
    });
  });

  it('does not throw on invalid dates or nullish optional fields', () => {
    expect(() =>
      createNotesOverviewSignalPanelProps({
        notes: [
          {
            id: 'nullish',
            title: null,
            updatedAt: Number.NaN,
            createdAt: 'not-a-date',
            deletedAt: null,
            starred: undefined,
          },
        ],
        activeNoteId: 'nullish',
        now: 123,
      }),
    ).not.toThrow();
  });

  it('does not mutate input arrays or note objects', () => {
    const note = Object.freeze({ id: 'frozen', title: 'Frozen', updatedAt: 1000 });
    const notes = Object.freeze([
      Object.freeze({ id: 'newer', title: 'Newer', updatedAt: 3000 }),
      note,
    ]);

    const before = JSON.stringify(notes);
    const output = createNotesOverviewSignalPanelProps({ notes });

    expect(output.data.recentNotes.map(item => item.id)).toEqual(['newer', 'frozen']);
    expect(JSON.stringify(notes)).toBe(before);
    expect(notes[1]).toBe(note);
  });

  it('is deterministic for fixed input and now', () => {
    const input: NotesOverviewSignalPanelAdapterInput = {
      notes: [
        { id: 'a', title: 'A', updatedAt: 1000 },
        { id: 'b', title: 'B', updatedAt: 2000 },
      ],
      activeNoteId: 'a',
      now: 42,
      formatDateLabel,
    };

    expect(createNotesOverviewSignalPanelProps(input)).toEqual(
      createNotesOverviewSignalPanelProps(input),
    );
  });

  it('does not expose full body tags or other non-contract fields', () => {
    const output = createNotesOverviewSignalPanelProps({
      notes: [
        {
          id: 'metadata-only',
          title: 'Metadata only',
          updatedAt: 1000,
        },
      ],
    });
    const serialized = JSON.stringify(output);

    expect(serialized).not.toContain('body');
    expect(serialized).not.toContain('bodyPreview');
    expect(serialized).not.toContain('tags');
    expect(serialized).not.toContain('content');
    expect(serialized).not.toContain('markdown');
    expect(serialized).not.toContain('syncStatus');
  });

  it('produces output accepted by NotesOverviewSignalPanel rendering', () => {
    const html = renderAdapterOutput({
      notes: [{ id: 'rendered', title: 'Rendered note', updatedAt: 1000 }],
      activeNoteId: 'rendered',
      formatDateLabel,
    });

    expect(html).toContain('Notes Overview');
    expect(html).toContain('Rendered note');
    expect(html).toContain('data-active-writing-state="active"');
    expect(html).toContain('Read-only local signal from 1 local note.');
  });
});
