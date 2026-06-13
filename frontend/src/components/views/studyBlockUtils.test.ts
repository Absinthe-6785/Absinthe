import { describe, it, expect } from 'vitest';
import {
  countQuestionsInMarkdown,
  normalizeQuestionText,
  parseAnswerBody,
  serializeAnswerBody,
} from './studyBlockUtils';

describe('studyBlockUtils', () => {
  it('normalizes Q: prefix', () => {
    expect(normalizeQuestionText('Q: Define photosynthesis.')).toBe('Define photosynthesis.');
  });

  it('parses answer hidden/revealed state', () => {
    const hidden = parseAnswerBody('hidden\nThe answer');
    expect(hidden.revealed).toBe(false);
    expect(hidden.content).toBe('The answer');
    const roundtrip = serializeAnswerBody(hidden.content, hidden.revealed);
    expect(parseAnswerBody(roundtrip)).toEqual(hidden);
  });

  it('counts question blocks in markdown', () => {
    const md = '```question\nQ: What caused the Meiji Restoration?\n```\nQ: Define photosynthesis.';
    expect(countQuestionsInMarkdown(md)).toBe(2);
  });
});
