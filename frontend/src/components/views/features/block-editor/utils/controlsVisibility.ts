import type { TurnIntoMenuState } from '../../../editorTypes';

export function isControlsVisible(
  blockId: string,
  pinnedControlsId: string | null,
  handleMenu: TurnIntoMenuState | null,
  chromeHoverId: string | null,
): boolean {
  return pinnedControlsId === blockId
    || handleMenu?.blockId === blockId
    || chromeHoverId === blockId;
}
