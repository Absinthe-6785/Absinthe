import { describe, expect, it } from 'vitest';
import { findSmartCollection } from './smartCollections';
import {
  isUserNamedSmartCollection,
  resolveSmartCollectionGroupLabel,
  resolveSmartCollectionName,
} from './smartCollectionLabels';

describe('smartCollectionLabels', () => {
  const t = (key: string) => key;

  it('localizes system presets via i18n keys', () => {
    const recent = findSmartCollection('recent')!;
    expect(resolveSmartCollectionName(recent, t)).toBe('k108ScRecent');
    const sources = findSmartCollection('research-sources')!;
    expect(resolveSmartCollectionName(sources, t)).toBe('k108ScSources');
  });

  it('keeps subject workspace stored names', () => {
    expect(isUserNamedSmartCollection('subject-politics')).toBe(true);
    const politics = findSmartCollection('subject-politics')!;
    expect(resolveSmartCollectionName(politics, t)).toBe('정치 작업공간');
  });

  it('localizes group labels', () => {
    expect(resolveSmartCollectionGroupLabel('knowledge', '지식', t)).toBe('k108ScGroupKnowledge');
    expect(resolveSmartCollectionGroupLabel('unknown', 'Fallback', t)).toBe('Fallback');
  });
});
