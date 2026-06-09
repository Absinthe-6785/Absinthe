// Components
export { BlockContextMenu, type BlockContextMenuProps } from './components/BlockContextMenu';
export { SlashMenu, type SlashMenuProps } from './components/SlashMenu';
export { WikiMenu, type WikiMenuProps } from './components/WikiMenu';

// Hooks
export {
  useEditorMenus,
  type UseEditorMenusOptions,
  type UseEditorMenusResult,
} from './hooks/useEditorMenus';

// Slash commands & palette
export {
  resolveSlashCommand,
  slashCommandKeysMatching,
  slashDisplayLabel,
  slashShortcutFor,
  SLASH_COMMAND_MAP,
  SLASH_DISPLAY_LABELS,
} from './utils/slashCommands';
export { buildSlashPalette, type SlashPaletteResult } from './utils/slashPalette';
export { clearSlashRecent, getSlashRecent, recordSlashUsage } from './utils/slashRecent';

// Wiki menus
export {
  buildWikiInsertText,
  detectWikiQuery,
  findWikiLinkAtOffset,
  insertWikiAtCaret,
} from './utils/wikiNavigation';
export { filterWikiTargets } from './utils/wikiSearch';

// Menu chrome
export { computeFixedMenuPosition } from './utils/menuViewport';
export { CONTEXT_MENU, TINT_LABELS } from './utils/editorMenuModel';
