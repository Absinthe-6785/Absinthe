import { describe, expect, it } from 'vitest';
import {
  conceptRelationLabel,
  formatRelatedReasonsLocalized,
  noteKindLabel,
  relatedReasonLabel,
} from './knowledgeLabels';

describe('knowledgeLabels', () => {
  it('returns English concept relation labels', () => {
    expect(conceptRelationLabel('related-to', 'en')).toBe('related to');
    expect(conceptRelationLabel('causes', 'ko')).toBe('원인');
  });

  it('returns localized related reason labels', () => {
    expect(relatedReasonLabel('backlink', 'en')).toBe('backlink');
    expect(relatedReasonLabel('backlink', 'ko')).toBe('백링크');
  });

  it('formats related reasons for display', () => {
    expect(formatRelatedReasonsLocalized(['shared tag', 'mention'], 'en'))
      .toBe('shared tag + mention');
  });

  it('returns localized note kind labels', () => {
    expect(noteKindLabel('concept', 'en')).toBe('Concept');
    expect(noteKindLabel('source', 'ja')).toBe('出典');
  });
});
