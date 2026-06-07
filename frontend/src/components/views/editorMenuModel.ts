/**
 * editorMenuModel.ts — English block context menu labels
 */

export const CONTEXT_MENU = {
  sectionBlock: 'Block',
  addAbove: 'Add Block Above',
  addBelow: 'Add Block Below',
  duplicate: 'Duplicate',
  transform: 'Transform',
  color: 'Color',
  sectionStructure: 'Structure',
  indent: 'Indent',
  outdent: 'Outdent',
  moveIntoToggle: 'Move into Toggle',
  moveOutOfToggle: 'Move out of Toggle',
  copyLink: 'Copy Block Link',
  moveUp: 'Move Up',
  moveDown: 'Move Down',
  delete: 'Delete',
  back: 'Back',
} as const;

export const TINT_LABELS: Record<string, string> = {
  default: 'Default',
  purple: 'Purple',
  blue: 'Blue',
  green: 'Green',
  yellow: 'Yellow',
  red: 'Red',
};
