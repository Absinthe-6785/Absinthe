import { describe, expect, it } from 'vitest';
import { isReadingMode, toggleEditReading, type EditorMode } from './editorMode';
import {
  READING_LINE_HEIGHT,
  READING_MAX_WIDTH_PX,
  readingRootClass,
  shouldShowBlockChrome,
} from './editorReading';

describe('editorMode', () => {
  it('isReadingMode', () => {
    expect(isReadingMode('reading')).toBe(true);
    expect(isReadingMode('edit')).toBe(false);
  });

  it('toggleEditReading', () => {
    expect(toggleEditReading('edit')).toBe('reading');
    expect(toggleEditReading('reading')).toBe('edit');
    expect(toggleEditReading('graph')).toBe('edit');
  });
});

describe('editorReading', () => {
  it('readingRootClass', () => {
    expect(readingRootClass(true)).toBe('be-reading be-document');
    expect(readingRootClass(false)).toBe('be-document');
  });

  it('shouldShowBlockChrome', () => {
    expect(shouldShowBlockChrome(false)).toBe(true);
    expect(shouldShowBlockChrome(true)).toBe(false);
  });

  it('focus mode constants', () => {
    expect(READING_LINE_HEIGHT).toBe(1.8);
    expect(READING_MAX_WIDTH_PX).toBe(720);
  });
});
