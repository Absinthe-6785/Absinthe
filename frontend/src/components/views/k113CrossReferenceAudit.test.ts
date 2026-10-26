import { describe, expect, it } from 'vitest';
import { auditCrossReferences, K113_CROSS_REFERENCE_SURFACES } from './k113CrossReferenceAudit';

describe('k113CrossReferenceAudit', () => {
  it('lists cross-domain reference hooks per domain', () => {
    expect(K113_CROSS_REFERENCE_SURFACES.map(surface => surface.domain)).toEqual(['planner', 'health', 'archive']);
    expect(auditCrossReferences()).toContain('data-k113-open-related-note');
    expect(auditCrossReferences()).not.toContain('data-k113-open-cooking-note');
  });
});
