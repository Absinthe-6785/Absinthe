import type { Block } from './blockUtils';

/** Test helper mirroring useBlockEditor structural detection. */
export function isStructuralBlockChangeForTest(prev: Block[], next: Block[]): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i].id !== next[i].id || prev[i].type !== next[i].type) return true;
    if ((prev[i].indent ?? 0) !== (next[i].indent ?? 0)) return true;
  }
  return false;
}
