import { describe, it, expect } from 'vitest';
import {
  extractFootnoteDefinitions,
  extractInlineFootnoteRefs,
  extractNoteReferenceSummary,
} from './extractNoteReferenceSummary';
import type { NoteBase } from '../../../noteUtils';

function n(id: string, title: string, body: string): NoteBase {
  return { id, title, body, updatedAt: 1, folderId: null, deletedAt: null };
}

describe('extractNoteReferenceSummary', () => {
  it('extracts footnote definitions and inline refs', () => {
    const body = 'See[^1] and[^note].\n\n[^1]: First ref.\n[^note]: Named ref.';
    expect(extractFootnoteDefinitions(body)).toEqual([
      { id: '1', content: 'First ref.' },
      { id: 'note', content: 'Named ref.' },
    ]);
    expect(extractInlineFootnoteRefs(body)).toEqual(['1', 'note']);
  });

  it('builds unified reference summary for a note', () => {
    const notes = [
      n('a', 'Alpha', 'links [[Beta]]'),
      n('b', 'Beta', 'back [[Alpha]]'),
    ];
    const summary = extractNoteReferenceSummary(notes[0], notes);
    expect(summary.outgoing).toHaveLength(1);
    expect(summary.outgoing[0].targetNoteId).toBe('b');
    expect(summary.incoming).toHaveLength(1);
    expect(summary.incoming[0].noteId).toBe('b');
    expect(summary.citationCount).toBeGreaterThan(0);
  });
});
