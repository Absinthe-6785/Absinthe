import { memo } from 'react';
import { Target } from 'lucide-react';
import type { HealthProps, Inbody, Theme } from '../../../../types';
import { useTranslation } from '../../../../lib/i18n';
import { WORKSPACE_CARD } from '../../../common/workspaceCardSizes';

export interface HealthInbodyQuickPanelProps {
  theme: Theme;
  localInbody: Inbody;
  setLocalInbody: React.Dispatch<React.SetStateAction<Inbody>>;
  setIsInbodyDirty: (v: boolean) => void;
  onSaveInbody: () => void;
}

/** K-125F — mobile quick InBody entry after workout save. */
export const HealthInbodyQuickPanel = memo(function HealthInbodyQuickPanel({
  theme,
  localInbody,
  setLocalInbody,
  setIsInbodyDirty,
  onSaveInbody,
}: HealthInbodyQuickPanelProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`lg:hidden ${WORKSPACE_CARD.sm} rounded-[20px] shadow-sm px-3 py-2.5 transition-colors shrink-0 relative z-0 ${theme.card}`}
      data-inbody-panel
      data-k125f-inbody-mobile
      data-k125f-health-order="inbody"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="font-heading text-xs font-bold flex items-center gap-1.5">
          <Target size={12} className="text-primary" /> {t('inbody')}
        </h2>
        <button type="button" onClick={onSaveInbody} className="text-[10px] font-bold bg-primary text-primary-foreground px-2.5 py-1.5 rounded-lg shrink-0">
          {t('save')}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([
          { label: t('inbodyWeight'), field: 'weight' as const, unit: 'kg', color: 'text-blue-400' },
          { label: t('inbodySMM'), field: 'smm' as const, unit: 'kg', color: 'text-green-400' },
          { label: t('inbodyPBF'), field: 'pbf' as const, unit: '%', color: 'text-red-400' },
        ]).map(({ label, field, unit, color }) => (
          <div key={field} className={`rounded-xl px-2 py-1.5 ${theme.input}`}>
            <p className={`text-[8px] font-bold uppercase tracking-wide mb-0.5 ${color}`}>{label}</p>
            <div className="flex items-baseline gap-0.5">
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
});
