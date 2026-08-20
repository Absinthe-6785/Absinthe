import { markdownToBlocks, type Block } from '@/components/views/blockUtils';

/** Shared EJU clipboard/paste document used by the editor regression suites. */
export const EJU_NOTE_MARKDOWN = `# EJU Study Timeline

> Grammar Module
  ## Particles
  - は vs が
  - を particle usage
    - nested bullet
  1. Drill set A
  2. Drill set B
  > Vocab nest
    ### Core kanji
    - 読む
    - 書く

> Reading Module
  ## Comprehension
  - Main idea questions
  - Detail matching
  1. Practice passage 1
  2. Practice passage 2

## Global review checklist
- Redo wrong answers
- Time yourself`;

/** Short EJU toggle used by the focused gutter/browser clipboard reproductions. */
export const EJU_SHORT_NOTE_MARKDOWN = `# EJU Study Timeline

> Grammar Module
  ## Particles
  - は vs が
  - を particle usage
  > Vocab nest
    ### Core kanji
    - 読む`;

export function makeEjuBlocks(markdown = EJU_NOTE_MARKDOWN): Block[] {
  return markdownToBlocks(markdown).filter(
    block => block.type !== 'paragraph' || block.content.trim() !== '',
  );
}
