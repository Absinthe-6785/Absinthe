import { forwardRef, memo } from 'react';
import { Target } from 'lucide-react';
import type { Inbody, Theme } from '../../../../types';
import { WORKSPACE_CARD } from '../../../common/workspaceCardSizes';
import { useTranslation } from '../../../../lib/i18n';

export interface HealthInbodyQuickPanelProps {
  localInbody: Inbody;
  setLocalInbody: React.Dispatch<React.SetStateAction<Inbody>>;
  setIsInbodyDirty: (v: boolean) => void;
  onSaveInbody: () => void;
  theme: Theme;
  highlight?: boolean;
}

/** K-126A — mobile-first quick InBody entry after workout save. */
export const HealthInbodyQuickPanel = memo(forwardRef<HTMLDivElement, HealthInbodyQuickPanelProps>(
  function HealthInbodyQuickPanel({
    localInbody,
    setLocalInbody,
    setIsInbodyDirty,
    onSaveInbody,
    theme,
    highlight = false,
  }, ref) {
    const { t } = useTranslation();

    return (
      <div
        ref={ref}
        className={`lg:hidden ${WORKSPACE_CARD.sm} rounded-[20px] shadow-sm px-3 py-3 transition-colors shrink-0 ${theme.card} ${
          highlight ? 'ring-2 ring-primary/40' : ''
        }`}
        data-inbody-panel
        data-k126-inbody-quick
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-heading text-sm font-bold flex items-center gap-1.5">
            <Target size={14} className="text-primary" />
            {t('k126QuickInbody')}
          </h2>
          <button
            type="button"
            onClick={onSaveInbody}
            className="text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-xl hover:opacity-90 transition-opacity shrink-0 min-h-[44px]"
          >
            {t('save')}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {([
            { label: t('inbodyWeight'), field: 'weight' as const, unit: 'kg', color: 'text-blue-400' },
            { label: t('inbodySMM'), field: 'smm' as const, unit: 'kg', color: 'text-green-400' },
            { label: t('inbodyPBF'), field: 'pbf' as const, unit: '%', color: 'text-red-400' },
          ]).map(({ label, field, unit, color }) => (
            <div key={field} className={`rounded-xl px-2 py-2 border border-transparent focus-within:border-primary transition-colors ${theme.input}`}>
              <p className={`text-[9px] font-bold uppercase tracking-wide mb-0.5 ${color}`}>{label}</p>
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={localInbody[field] !== 0 ? localInbody[field] : ''}
                  placeholder="0"
                  onChange={e => { setIsInbodyDirty(true); setLocalInbody(prev => ({ ...prev, [field]: Number(e.target.value) })); }}
                  className="w-full bg-transparent text-sm font-black outline-none tabular-nums"
                />
                <span className={`text-[9px] font-semibold ${theme.textMuted}`}>{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
));
