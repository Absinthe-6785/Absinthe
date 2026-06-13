import type { BlockType } from './blockUtils';

/** Typing shortcuts — longest triggers first. Skipped in code blocks. */
export const SYMBOL_SHORTCUTS: readonly { trigger: string; replacement: string }[] = [
  { trigger: '<=>', replacement: '⇔' },
  { trigger: '=>', replacement: '⇒' },
  { trigger: '->', replacement: '→' },
  { trigger: '<-', replacement: '←' },
  { trigger: '>=', replacement: '≥' },
  { trigger: '<=', replacement: '≤' },
  { trigger: '!=', replacement: '≠' },
];

export function applySymbolShortcut(
  text: string,
  blockType: BlockType,
): { text: string; applied: boolean; caretDelta: number } {
  if (blockType === 'code') return { text, applied: false, caretDelta: 0 };
  for (const { trigger, replacement } of SYMBOL_SHORTCUTS) {
    if (text.endsWith(trigger)) {
      return {
        text: text.slice(0, -trigger.length) + replacement,
        applied: true,
        caretDelta: replacement.length - trigger.length,
      };
    }
  }
  return { text, applied: false, caretDelta: 0 };
}
