import { memo, useCallback, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, X } from 'lucide-react';
import type { ExerciseBlock, Theme } from '../../../../types';
import { UI_INTERACTION } from '../../../../lib/uiInteractionTokens';

export interface WorkoutBlockCardProps {
  block: ExerciseBlock;
  theme: Theme;
  onAdd: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

/** K-125F — library block card; mobile actions behind overflow menu. */
export const WorkoutBlockCard = memo(function WorkoutBlockCard({
  block: b,
  theme,
  onAdd,
  onEdit,
  onDelete,
}: WorkoutBlockCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const startLongPress = useCallback(() => {
    clearLongPress();
    longPressTimer.current = setTimeout(() => setMenuOpen(true), 500);
  }, [clearLongPress]);

  return (
    <div
      onClick={onAdd}
      onTouchStart={startLongPress}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onContextMenu={e => { e.preventDefault(); setMenuOpen(true); }}
      className={`group relative text-xs font-semibold px-2.5 py-2 rounded-lg border border-transparent hover:border-primary active:border-primary cursor-pointer transition-colors ${theme.input}`}
      data-k125f-block-card
    >
      <div className="flex items-center gap-1.5 min-w-0 pr-6 lg:pr-0">
        <div className={`w-2 h-2 rounded-full shrink-0 ${b.type === 'strength' ? 'bg-blue-500' : b.type === 'bodyweight' ? 'bg-purple-500' : 'bg-green-500'}`} />
        <span className="truncate">{b.name}</span>
      </div>

      <button
        type="button"
        onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
        className="lg:hidden absolute top-1 right-1 p-1 rounded-md text-muted-foreground hover:bg-black/5"
        aria-label="Block actions"
        data-k125f-block-overflow
        style={{ minHeight: UI_INTERACTION.touchTargetMinPx, minWidth: UI_INTERACTION.touchTargetMinPx }}
      >
        <MoreHorizontal size={14} />
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            className="lg:hidden fixed inset-0 z-[198]"
            aria-label="Close menu"
            onClick={e => { e.stopPropagation(); setMenuOpen(false); }}
          />
          <div
            className="lg:hidden absolute right-0 top-full mt-1 z-[199] min-w-[120px] rounded-xl border shadow-lg bg-background p-1"
            data-k125f-block-menu
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg hover:bg-black/5"
              onClick={e => { onEdit(e); setMenuOpen(false); }}
            >
              <Pencil size={12} /> Edit
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-red-500 hover:bg-red-500/10"
              onClick={e => { onDelete(e); setMenuOpen(false); }}
            >
              <X size={12} /> Delete
            </button>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={onEdit}
        className="hidden lg:block absolute -top-1.5 -left-1.5 bg-blue-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 active:scale-90 transition-all"
        data-k125f-block-edit
      >
        <Pencil size={10} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="hidden lg:block absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 active:scale-90 transition-all"
        data-k125f-block-delete
      >
        <X size={10} />
      </button>
    </div>
  );
});
