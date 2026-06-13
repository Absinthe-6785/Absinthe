import { describe, expect, it } from 'vitest';
import { displayNoteTitle, UNTITLED_NOTE_LABEL } from './noteDisplayTitle';

describe('displayNoteTitle', () => {
  it('returns Korean placeholder for empty titles', () => {
    expect(displayNoteTitle('')).toBe(UNTITLED_NOTE_LABEL);
    expect(displayNoteTitle('   ')).toBe(UNTITLED_NOTE_LABEL);
    expect(displayNoteTitle(undefined)).toBe(UNTITLED_NOTE_LABEL);
    expect(displayNoteTitle(null)).toBe(UNTITLED_NOTE_LABEL);
  });

  it('maps legacy Untitled storage to the same placeholder', () => {
    expect(displayNoteTitle('Untitled')).toBe(UNTITLED_NOTE_LABEL);
  });

  it('preserves user titles', () => {
    expect(displayNoteTitle('  My Note  ')).toBe('My Note');
  });
});
