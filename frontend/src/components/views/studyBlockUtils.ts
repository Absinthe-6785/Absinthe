import type { Block } from './blockUtils';
import { markdownToBlocks } from './blockUtils';

/** Parse ```question fence body or Q: line content. */
export function normalizeQuestionText(text: string): string {
  const trimmed = text.trim();
  const qMatch = trimmed.match(/^Q:\s*(.+)$/i);
  return qMatch ? qMatch[1].trim() : trimmed;
}

export function parseQuestionBody(body: string): string {
  return normalizeQuestionText(body);
}

const ANSWER_STATE_HIDDEN = /^hidden\s*$/i;
const ANSWER_STATE_REVEALED = /^revealed\s*$/i;

export function parseAnswerBody(body: string): { content: string; revealed: boolean } {
  const lines = body.split('\n');
  let revealed = false;
  let start = 0;
  if (lines[0] && ANSWER_STATE_HIDDEN.test(lines[0].trim())) {
    revealed = false;
    start = 1;
  } else if (lines[0] && ANSWER_STATE_REVEALED.test(lines[0].trim())) {
    revealed = true;
    start = 1;
  }
  return { content: lines.slice(start).join('\n').trim(), revealed };
}

export function serializeAnswerBody(content: string, revealed: boolean): string {
  return `${revealed ? 'revealed' : 'hidden'}\n${content}`;
}

export function blockToAnswerFields(block: Block): { content: string; revealed: boolean } {
  return {
    content: block.content ?? '',
    revealed: block.answerRevealed ?? false,
  };
}

export function answerFieldsToBlockPatch(content: string, revealed: boolean): Partial<Block> {
  return { content, answerRevealed: revealed };
}

/** Walk block tree and count question blocks. */
export function collectQuestionBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (b.type === 'question') out.push(b);
      if (b.children.length) walk(b.children);
    }
  };
  walk(blocks);
  return out;
}

export function countQuestionsInMarkdown(body: string): number {
  return collectQuestionBlocks(markdownToBlocks(body)).length;
}

export function countQuestionsInNotes(notes: readonly { body?: string; deletedAt?: number | null }[]): number {
  let total = 0;
  for (const note of notes) {
    if (note.deletedAt) continue;
    total += countQuestionsInMarkdown(note.body ?? '');
  }
  return total;
}

export function noteHasQuestionBlocks(body: string): boolean {
  return countQuestionsInMarkdown(body) > 0;
}
