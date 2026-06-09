import type { BlockType } from '../../../../../blockUtils';

/** Exact slash shortcuts — `/h1`, `/todo`, `/number`, etc. */
export const SLASH_COMMAND_MAP: Record<string, BlockType> = {
  text: 'paragraph',
  p: 'paragraph',
  paragraph: 'paragraph',
  h1: 'heading1',
  h2: 'heading2',
  h3: 'heading3',
  heading1: 'heading1',
  heading2: 'heading2',
  heading3: 'heading3',
  todo: 'todo',
  task: 'todo',
  toggle: 'toggle',
  bullet: 'bullet',
  ul: 'bullet',
  number: 'numbered',
  numbered: 'numbered',
  ol: 'numbered',
  code: 'code',
  math: 'math',
  quote: 'quote',
  divider: 'divider',
  hr: 'divider',
  image: 'image',
  img: 'image',
  callout: 'callout',
  table: 'table',
};

/** Display label for slash menu (Notion-style English) */
export const SLASH_DISPLAY_LABELS: Partial<Record<BlockType, string>> = {
  paragraph: 'Text',
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  todo: 'Todo',
  toggle: 'Toggle',
  bullet: 'Bullet List',
  numbered: 'Numbered List',
  code: 'Code Block',
  math: 'Math Block',
  quote: 'Quote',
  divider: 'Divider',
  image: 'Image',
  callout: 'Callout',
  table: 'Table',
};

export function slashDisplayLabel(type: BlockType): string {
  return SLASH_DISPLAY_LABELS[type] ?? type;
}

export function slashShortcutFor(type: BlockType): string | undefined {
  const entry = Object.entries(SLASH_COMMAND_MAP).find(([, t]) => t === type);
  return entry?.[0];
}

/** Resolve an exact slash query to a block type, or null. */
export function resolveSlashCommand(query: string): BlockType | null {
  const q = query.toLowerCase().trim().replace(/^\//, '');
  if (!q) return null;
  return SLASH_COMMAND_MAP[q] ?? null;
}

/** Prefix search for slash palette — returns matching command keys. */
export function slashCommandKeysMatching(prefix: string): string[] {
  const q = prefix.toLowerCase().trim().replace(/^\//, '');
  if (!q) return Object.keys(SLASH_COMMAND_MAP);
  return Object.keys(SLASH_COMMAND_MAP).filter(k => k.startsWith(q) || k.includes(q));
}
