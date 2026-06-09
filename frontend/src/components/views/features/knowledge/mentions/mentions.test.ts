import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import {
  containsWholeWordMention,
  hasUnlinkedMention,
  bodyHasWikiLinkToTitle,
} from './mentionDetection';
import { KnowledgeIndexService } from '../KnowledgeIndexService';

function note(
  id: string,
  title: string,
  body: string,
  deletedAt: number | null = null,
): NoteBase {
  return { id, title, body, updatedAt: 0, folderId: null, deletedAt };
}

describe('mentionDetection', () => {
  it('detects whole-word mentions case-insensitively', () => {
    expect(containsWholeWordMention('I studied with Genki today.', 'genki')).toBe(true);
    expect(containsWholeWordMention('GENKI is great.', 'Genki')).toBe(true);
  });

  it('rejects partial title matches', () => {
    expect(containsWholeWordMention('GenkiBook is not the same.', 'Genki')).toBe(false);
    expect(containsWholeWordMention('MyGenkiNotes', 'Genki')).toBe(false);
  });

  it('excludes wiki link text from mention detection', () => {
    expect(hasUnlinkedMention('[[Genki]] is a textbook.', 'Genki')).toBe(false);
    expect(bodyHasWikiLinkToTitle('[[Genki]] is a textbook.', 'Genki')).toBe(true);
  });

  it('detects plain mention when wiki link also exists elsewhere', () => {
    const body = '[[Genki]] linked. Genki is also mentioned in plain text.';
    expect(hasUnlinkedMention(body, 'Genki')).toBe(true);
    expect(bodyHasWikiLinkToTitle(body, 'Genki')).toBe(true);
  });
});

describe('KnowledgeIndexService mentions', () => {
  it('indexes unlinked mentions', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('genki', 'Genki', 'Textbook'),
      note('study', 'Japanese Study', 'I studied with Genki.'),
    ]);

    expect(service.getMentioningNotes('genki')).toHaveLength(1);
    expect(service.getMentioningNotes('genki')[0].noteId).toBe('study');
    expect(service.getMentionCount('genki')).toBe(1);
  });

  it('does not index wiki links as mentions', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('genki', 'Genki', 'Textbook'),
      note('study', 'Japanese Study', 'See [[Genki]] for details.'),
    ]);

    expect(service.getMentioningNotes('genki')).toHaveLength(0);
    expect(service.getIncoming('Genki', { excludeNoteId: 'genki' })).toHaveLength(1);
  });

  it('updates mentions incrementally', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('a', 'Note A', 'No mention yet.'),
    ]);
    expect(service.getMentionCount('genki')).toBe(0);

    service.updateNote(note('a', 'Note A', 'Now mentions Genki.'));
    expect(service.getMentionCount('genki')).toBe(1);
  });

  it('removes mentions when source trashed', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('a', 'Note A', 'Genki here.'),
    ]);
    service.removeNote('a');
    expect(service.getMentionCount('genki')).toBe(0);
  });

  it('restores mentions after restore', () => {
    const service = new KnowledgeIndexService();
    const source = note('a', 'Note A', 'Genki here.');
    service.buildFromNotes([note('genki', 'Genki', ''), source]);
    service.removeNote('a');
    service.updateNote({ ...source, deletedAt: null });
    expect(service.getMentionCount('genki')).toBe(1);
  });

  it('follows rename policy — mentions match current title only', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('genki', 'Genki', ''),
      note('a', 'Note A', 'Genki mentioned.'),
    ]);
    service.updateNote(note('genki', 'Genki Second Edition', ''));
    expect(service.getMentionCount('genki')).toBe(0);
  });

  it('resolveMentionNavigation returns source note id', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([
      note('target', 'Target', ''),
      note('src', 'Source', 'Target word here.'),
    ]);
    const ref = service.getMentioningNotes('target')[0];
    expect(service.resolveMentionNavigation(ref)).toBe('src');
  });
});

describe('duplication', () => {
  it('copy inherits mention scan from body text', () => {
    const service = new KnowledgeIndexService();
    service.buildFromNotes([note('target', 'Target', '')]);
    service.updateNote(note('copy', 'Copy', 'Target appears here.'));
    expect(service.getMentionCount('target')).toBe(1);
  });
});
