import { describe, expect, it } from 'vitest';
import { toggleMarkdownWrap } from './inlineFormat';

describe('toggleMarkdownWrap', () => {
  it('wraps plain selection', () => {
    expect(toggleMarkdownWrap('hello world', 0, 5, '**', '**')).toEqual({
      text: '**hello** world',
      caret: 9,
    });
  });

  it('unwraps bold when markers are outside selection', () => {
    expect(toggleMarkdownWrap('**hello**', 2, 7, '**', '**')).toEqual({
      text: 'hello',
      caret: 5,
    });
  });

  it('unwraps bold when markers are inside selection', () => {
    expect(toggleMarkdownWrap('**hello**', 0, 9, '**', '**')).toEqual({
      text: 'hello',
      caret: 5,
    });
  });

  it('toggles italic without touching bold markers', () => {
    expect(toggleMarkdownWrap('*hello*', 1, 6, '*', '*')).toEqual({
      text: 'hello',
      caret: 5,
    });
    expect(toggleMarkdownWrap('**hello**', 2, 7, '*', '*')).toEqual({
      text: '***hello***',
      caret: 9,
    });
  });
});
