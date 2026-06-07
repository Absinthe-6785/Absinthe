import { describe, expect, it } from 'vitest';
import {
  selectionHasFormat,
  splitMarkdownAt,
  toggleBold,
  toggleItalic,
  toggleMarkdownWrap,
} from './inlineFormat';

describe('toggleBold', () => {
  it('wraps plain selection', () => {
    expect(toggleBold('hello', 0, 5)).toMatchObject({ text: '**hello**', selStart: 2, selEnd: 7 });
  });

  it('unwraps bold', () => {
    expect(toggleBold('**hello**', 2, 7)).toMatchObject({ text: 'hello', selStart: 0, selEnd: 5 });
  });

  it('promotes italic to bold+italic', () => {
    expect(toggleBold('*hello*', 1, 6)).toMatchObject({ text: '***hello***', selStart: 3, selEnd: 8 });
  });

  it('demotes bold+italic to italic', () => {
    expect(toggleBold('***hello***', 3, 8)).toMatchObject({ text: '*hello*', selStart: 1, selEnd: 6 });
  });
});

describe('toggleItalic', () => {
  it('wraps plain selection', () => {
    expect(toggleItalic('hello', 0, 5)).toMatchObject({ text: '*hello*', selStart: 1, selEnd: 6 });
  });

  it('promotes bold to bold+italic', () => {
    expect(toggleItalic('**hello**', 2, 7)).toMatchObject({ text: '***hello***', selStart: 3, selEnd: 8 });
  });

  it('demotes bold+italic to bold', () => {
    expect(toggleItalic('***hello***', 3, 8)).toMatchObject({ text: '**hello**', selStart: 2, selEnd: 7 });
  });
});

describe('toggleMarkdownWrap', () => {
  it('wraps plain selection with code markers', () => {
    expect(toggleMarkdownWrap('hello world', 0, 5, '`', '`')).toEqual({
      text: '`hello` world',
      caret: 6,
      selStart: 1,
      selEnd: 6,
    });
  });
});

describe('selectionHasFormat', () => {
  it('detects bold and bold+italic', () => {
    expect(selectionHasFormat('**hello**', 2, 7, '**', '**')).toBe(true);
    expect(selectionHasFormat('***hello***', 3, 8, '**', '**')).toBe(true);
    expect(selectionHasFormat('hello', 0, 5, '**', '**')).toBe(false);
  });

  it('detects italic without matching bold markers', () => {
    expect(selectionHasFormat('*hello*', 1, 6, '*', '*')).toBe(true);
    expect(selectionHasFormat('***hello***', 3, 8, '*', '*')).toBe(true);
    expect(selectionHasFormat('**hello**', 2, 7, '*', '*')).toBe(false);
  });
});

describe('splitMarkdownAt', () => {
  it('splits bold phrase in Korean sentence', () => {
    const text = '오늘 공부할 내용은 **EJU 일본사**와 영어이다';
    const splitAt = text.indexOf('일본사');
    expect(splitMarkdownAt(text, splitAt)).toEqual({
      before: '오늘 공부할 내용은 **EJU** ',
      after: '**일본사**와 영어이다',
    });
  });

  it('closes and reopens bold across split', () => {
    expect(splitMarkdownAt('**hello**', 5)).toEqual({
      before: '**hel**',
      after: '**lo**',
    });
  });

  it('closes and reopens bold+italic across split', () => {
    expect(splitMarkdownAt('***hello***', 6)).toEqual({
      before: '***hel***',
      after: '***lo***',
    });
  });

  it('keeps trailing space on the before side for plain text', () => {
    expect(splitMarkdownAt('hello world', 5)).toEqual({
      before: 'hello ',
      after: 'world',
    });
  });
});
