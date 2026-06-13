import { describe, expect, it } from 'vitest';
import { displayNoteTitle, resolveUntitledNoteLabel } from './noteDisplayTitle';

describe('displayNoteTitle', () => {
  it('returns locale-aware placeholder for empty titles', () => {
    expect(displayNoteTitle('', 'en')).toBe('Untitled');
    expect(displayNoteTitle('   ', 'ko')).toBe('제목 없음');
    expect(displayNoteTitle(undefined, 'ja')).toBe('無題');
    expect(displayNoteTitle(null, 'en')).toBe('Untitled');
  });

  it('maps legacy Untitled storage to the same placeholder', () => {
    expect(displayNoteTitle('Untitled', 'en')).toBe('Untitled');
    expect(displayNoteTitle('Untitled', 'ko')).toBe('제목 없음');
  });

  it('preserves user titles', () => {
    expect(displayNoteTitle('  My Note  ')).toBe('My Note');
  });

  it('resolveUntitledNoteLabel accepts explicit language', () => {
    expect(resolveUntitledNoteLabel('en')).toBe('Untitled');
    expect(resolveUntitledNoteLabel('ko')).toBe('제목 없음');
  });
});
