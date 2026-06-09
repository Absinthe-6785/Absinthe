import { useCallback, useState } from 'react';
import { type Block, type BlockType, updateBlockById } from '../../../../../blockUtils';
import type { BlockEditorColors, SlashMenuState, WikiMenuState } from '../../../../../editorTypes';
import { recordSlashUsage } from '../utils/slashRecent';
import { insertWikiAtCaret } from '../utils/wikiNavigation';
import type { FocusCmd } from '../../selection';
import { applySlashMenuTypeChange } from '../../../utils/blockEditorMutations';

export interface UseEditorMenusOptions {
  getBlocks: () => Block[];
  onChange: (blocks: Block[]) => void;
  onFocusCmd: (cmd: FocusCmd) => void;
  colors: BlockEditorColors;
  wikiTargets: string[];
  searchQuery: string;
  onContentChange: (id: string, content: string) => void;
}

export interface UseEditorMenusResult {
  slashMenu: SlashMenuState | null;
  wikiMenu: WikiMenuState | null;
  setSlashMenu: React.Dispatch<React.SetStateAction<SlashMenuState | null>>;
  setWikiMenu: React.Dispatch<React.SetStateAction<WikiMenuState | null>>;
  closeSlashMenu: () => void;
  closeWikiMenu: () => void;
  closeMenus: () => void;
  isMenuOpenForBlock: (blockId: string) => boolean;
  handleSlashSelect: (type: BlockType) => void;
  handleWikiSelect: (title: string) => void;
}

export function useEditorMenus({
  getBlocks,
  onChange,
  onFocusCmd,
  colors,
  wikiTargets,
  searchQuery,
  onContentChange,
}: UseEditorMenusOptions): UseEditorMenusResult {
  const [slashMenu, setSlashMenu] = useState<SlashMenuState | null>(null);
  const [wikiMenu, setWikiMenu] = useState<WikiMenuState | null>(null);

  const closeSlashMenu = useCallback(() => {
    setSlashMenu(null);
  }, []);

  const closeWikiMenu = useCallback(() => {
    setWikiMenu(null);
  }, []);

  const closeMenus = useCallback(() => {
    setSlashMenu(null);
    setWikiMenu(null);
  }, []);

  const isMenuOpenForBlock = useCallback((blockId: string) =>
    slashMenu?.blockId === blockId || wikiMenu?.blockId === blockId,
  [slashMenu, wikiMenu]);

  const handleSlashSelect = useCallback((type: BlockType) => {
    if (!slashMenu) return;
    const { blockId, query } = slashMenu;

    onChange(updateBlockById(getBlocks(), blockId, b => applySlashMenuTypeChange(b, type, query)));

    recordSlashUsage(type);
    setSlashMenu(null);
    onFocusCmd({ blockId, offset: 'end' });
  }, [slashMenu, onChange, getBlocks, onFocusCmd]);

  const handleWikiSelect = useCallback((title: string) => {
    const el = document.activeElement as HTMLElement | null;
    if (el && el.isContentEditable) {
      const text = insertWikiAtCaret(el, title, colors, wikiTargets, searchQuery);
      if (wikiMenu) onContentChange(wikiMenu.blockId, text);
    }
    setWikiMenu(null);
  }, [wikiMenu, onContentChange, colors, wikiTargets, searchQuery]);

  return {
    slashMenu,
    wikiMenu,
    setSlashMenu,
    setWikiMenu,
    closeSlashMenu,
    closeWikiMenu,
    closeMenus,
    isMenuOpenForBlock,
    handleSlashSelect,
    handleWikiSelect,
  };
}
