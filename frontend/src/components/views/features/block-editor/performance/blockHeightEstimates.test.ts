import { describe, expect, it } from 'vitest';
import { makeBlock } from '../../../blockUtils';
import { estimateBlockHeight, getEstimatedHeightForType } from './blockHeightEstimates';

describe('blockHeightEstimates', () => {
  it('returns type defaults', () => {
    expect(getEstimatedHeightForType('paragraph')).toBe(46);
    expect(getEstimatedHeightForType('heading2')).toBe(56);
    expect(getEstimatedHeightForType('code')).toBe(72);
    expect(getEstimatedHeightForType('table')).toBe(160);
    expect(getEstimatedHeightForType('toggle')).toBe(52);
  });

  it('estimates paragraph from content lines', () => {
    const short = makeBlock('paragraph', { content: 'Hi' });
    const long = makeBlock('paragraph', { content: 'word '.repeat(200) });
    expect(estimateBlockHeight(short)).toBeGreaterThanOrEqual(46);
    expect(estimateBlockHeight(long)).toBeGreaterThan(estimateBlockHeight(short));
  });

  it('collapsed toggle uses header estimate', () => {
    const toggle = makeBlock('toggle', {
      content: 'Section',
      collapsed: true,
      children: [makeBlock('paragraph', { content: 'nested' })],
    });
    expect(estimateBlockHeight(toggle)).toBe(52);
  });
});
