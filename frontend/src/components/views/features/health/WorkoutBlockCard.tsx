import { memo, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, X } from 'lucide-react';
import type { ExerciseBlock, Theme } from '../../../../types';
import { useIsMobile } from '../../../../hooks/useIsMobile';
import { UI_INTERACTION } from '../../../../lib/uiInteractionTokens';
import { useTranslation } from '../../../../lib/i18n';
import type { HealthBlockQuickCaptureMeta } from './HealthBlockLibrary';

export interface WorkoutBlockCardProps {
  block: ExerciseBlock;
  theme: Theme;
  compact?: boolean;
  meta?: HealthBlockQuickCaptureMeta;
  onAdd: () => void;
  onEdit: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

/** K-126A — block library card; mobile edit/delete live in overflow menu. */
export const WorkoutBlockCard = memo(function WorkoutBlockCard({
  block: b,
  theme,
  compact = false,
  meta,
  onAdd,
  onEdit,
  onDelete,
}: WorkoutBlockCardProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const typeColor = b.type === 'strength' ? 'bg-blue-500' : b.type === 'bodyweight' ? 'bg-purple-500' : 'bg-green-500';

  return (
    <div
      onClick={onAdd}
      className={`group relative isolate z-0 min-w-0 max-w-full text-xs font-semibold ${compact ? 'px-2.5 py-1.5' : 'px-2.5 py-2'} rounded-lg border border-transparent hover:border-primary active:border-primary cursor-pointer transition-colors ${theme.input}`}
      data-k126-workout-block-card
      data-k129d-quick-capture-block
    >
      <div className="flex items-center gap-1.5 min-w-0 pr-6">
        <div className={`w-2 h-2 rounded-full shrink-0 ${typeColor}`} />
        <span className="truncate">{b.name}</span>
      </div>
      {meta && !compact ? (
        <div className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 pr-6 text-[10px] font-bold ${theme.textMuted}`} data-k129d-exercise-history-preview>
          <span>{meta.lastDate}</span>
          {meta.summary ? <span className="truncate">{meta.summary}</span> : null}
        </div>
      ) : null}
      {meta && compact ? (
        <span className={`mt-0.5 block truncate pr-4 text-[10px] font-bold ${theme.textMuted}`}>
          {meta.summary || meta.lastDate}
        </span>
      ) : null}

      {isMobile ? (
        <div className="absolute top-1 right-1 z-10" ref={menuRef}>
          <button
            type="button"
            aria-label={t('k126BlockActions')}
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className={`inline-flex items-center justify-center rounded-lg ${theme.textMuted} hover:bg-muted/60`}
            style={{ minWidth: UI_INTERACTION.touchTargetMinPx, minHeight: UI_INTERACTION.touchTargetMinPx }}
            data-k126-block-overflow-trigger
          >
            <MoreHorizontal size={14} />
          </button>
          {menuOpen ? (
            <div
              className={`absolute right-0 top-full mt-1 min-w-[120px] rounded-xl shadow-lg border p-1 z-20 ${theme.card} ${theme.border}`}
              data-k126-block-overflow-menu
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold hover:bg-muted/50 min-h-[44px]"
                onClick={e => { setMenuOpen(false); onEdit(e); }}
              >
                <Pencil size={12} /> {t('editBtn')}
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-500/10 min-h-[44px]"
                onClick={e => { setMenuOpen(false); onDelete(e); }}
              >
                <X size={12} /> {t('delete')}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onEdit}
            className="absolute top-1 left-1 bg-blue-500 text-white rounded-full p-0.5 opacity-0 lg:group-hover:opacity-100 active:scale-90 transition-all z-10"
          >
            <Pencil size={10} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 lg:group-hover:opacity-100 active:scale-90 transition-all z-10"
          >
            <X size={10} />
          </button>
        </>
      )}
    </div>
  );
});
