/**
 * singleLineMarkdown.ts — Detect common markdown block patterns without trailing newline (UX-5B.1)
 */
import { makeBlock, type Block } from '../../../../../blockUtils';

/** Parse a single trimmed line into a semantic block when it matches a block pattern. */
export function parseSingleLineMarkdown(line: string): Block[] | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const heading3 = trimmed.match(/^### (.+)$/);
  if (heading3) return [makeBlock('heading3', { content: heading3[1] })];

  const heading2 = trimmed.match(/^## (.+)$/);
  if (heading2) return [makeBlock('heading2', { content: heading2[1] })];

  const heading1 = trimmed.match(/^# (.+)$/);
  if (heading1) return [makeBlock('heading1', { content: heading1[1] })];

  const quote = trimmed.match(/^> (.+)$/);
  if (quote) return [makeBlock('quote', { content: quote[1] })];

  const todoChecked = trimmed.match(/^[-*] \[x\] (.+)$/i);
  if (todoChecked) {
    return [makeBlock('todo', { content: todoChecked[1], checked: true })];
  }

  const todoUnchecked = trimmed.match(/^[-*] \[ \] (.+)$/);
  if (todoUnchecked) {
    return [makeBlock('todo', { content: todoUnchecked[1], checked: false })];
  }

  const bullet = trimmed.match(/^[-*] (.+)$/);
  if (bullet) return [makeBlock('bullet', { content: bullet[1] })];

  const numbered = trimmed.match(/^(\d+)\. (.+)$/);
  if (numbered) {
    return [makeBlock('numbered', {
      content: numbered[2],
      listIndex: Number(numbered[1]),
    })];
  }

  return null;
}

/** True when plain text is a single-line markdown block pattern. */
export function isSingleLineMarkdownBlock(line: string): boolean {
  return parseSingleLineMarkdown(line) !== null;
}
