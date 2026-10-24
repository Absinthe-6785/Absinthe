import type { TranslationKey } from '../../lib/i18n';

export interface ShortcutEntry {
  keys: string;
  labelKey: TranslationKey;
}

export interface ShortcutSection {
  id: string;
  titleKey: TranslationKey;
  items: ShortcutEntry[];
}

export const EDITOR_SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    id: 'format',
    titleKey: 'selectionFormat',
    items: [
      { keys: 'Ctrl+B', labelKey: 'editorToolbarBold' },
      { keys: 'Ctrl+I', labelKey: 'editorToolbarItalic' },
      { keys: 'Ctrl+Shift+S', labelKey: 'editorToolbarStrike' },
      { keys: 'Ctrl+Shift+M', labelKey: 'editorToolbarHighlight' },
      { keys: 'Ctrl+`', labelKey: 'shortcutInlineCode' },
      { keys: 'Ctrl+Shift+K', labelKey: 'editorToolbarWikiLink' },
      { keys: 'Ctrl+Shift+H', labelKey: 'editorToolbarTags' },
    ],
  },
  {
    id: 'headings',
    titleKey: 'shortcutSectionHeadings',
    items: [
      { keys: 'Ctrl+Shift+0', labelKey: 'shortcutBodyText' },
      { keys: 'Ctrl+Shift+1–4', labelKey: 'shortcutHeadingLevels' },
      { keys: 'Ctrl+Shift+7', labelKey: 'shortcutTodo' },
      { keys: 'Ctrl+Shift+8', labelKey: 'shortcutToggle' },
      { keys: 'Ctrl+Shift+9', labelKey: 'shortcutCallout' },
      { keys: 'Ctrl+Shift+C', labelKey: 'shortcutCodeBlock' },
      { keys: '/', labelKey: 'shortcutSlashCommand' },
    ],
  },
  {
    id: 'navigation',
    titleKey: 'shortcutSectionNavigation',
    items: [
      { keys: 'Ctrl+F', labelKey: 'shortcutNoteSearch' },
      { keys: 'Ctrl+Shift+F', labelKey: 'shortcutFocusMode' },
      { keys: 'Ctrl+S', labelKey: 'save' },
      { keys: 'Ctrl+Z / Ctrl+Y', labelKey: 'shortcutUndoRedo' },
      { keys: 'Ctrl+E', labelKey: 'shortcutReadMode' },
      { keys: 'Tab / Shift+Tab', labelKey: 'shortcutIndentOutdent' },
      { keys: 'Esc', labelKey: 'shortcutClearBlockSelection' },
    ],
  },
  {
    id: 'help',
    titleKey: 'shortcutSectionHelp',
    items: [
      { keys: '?', labelKey: 'shortcutsOverlayAria' },
      { keys: 'Ctrl+/', labelKey: 'shortcutsOverlayAria' },
    ],
  },
];
