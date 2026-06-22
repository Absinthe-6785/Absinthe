import { memo } from 'react';
import { Target } from 'lucide-react';
import type { HealthProps, Inbody, Theme } from '../../../../types';
import { WORKSPACE_CARD } from '../../../common/workspaceCardSizes';
import { ProteinTracker } from './nutrition';
import { useTranslation } from '../../../../lib/i18n';

export interface HealthSupportingPanelsProps {
  selectedDate: Date;
  formatDate: (d: Date) => string;
  theme: Theme;
  localInbody: Inbody;
  setLocalInbody: React.Dispatch<React.SetStateAction<Inbody>>;
  setIsInbodyDirty: (v: boolean) => void;
  onSaveInbody: () => void;
  appSettings: HealthProps['appSettings'];
  showToast: HealthProps['showToast'];
  onOpenNutrition: () => void;
  inbodyHistoryCollapsed: boolean;
}

/** K-125C — InBody + protein only; calendar moved to HealthCalendarPanel. */
export const HealthSupportingPanels = memo(function HealthSupportingPanels({
  selectedDate,
  formatDate,
  theme,
  localInbody,
  setLocalInbody,
  setIsInbodyDirty,
  onSaveInbody,
  appSettings,
  showToast,
  onOpenNutrition,
}: HealthSupportingPanelsProps) {
  const { t } = useTranslation();

  return (
    <div
      className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-3 shrink-0"
      data-workspace-zone="supporting"
      data-k107-health-supporting-panels
      data-k125c-health-order="supporting"
    >
      <div className={`${WORKSPACE_CARD.sm} rounded-[20px] lg:rounded-[24px] shadow-sm px-3 py-2.5 transition-colors ${theme.card}`} data-inbody-panel>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-heading text-xs font-bold flex items-center gap-1.5"><Target size={12} className="text-primary" /> {t('inbody')}</h2>
          <button type="button" onClick={onSaveInbody} className="text-[10px] font-bold bg-primary text-primary-foreground px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition-colors shrink-0">{t('save')}</button>
        </div>
        <div className="flex flex-col gap-2">
          {([
            { label: t('inbodyWeight'), field: 'weight' as const, unit: 'kg', color: 'text-blue-400' },
            { label: t('inbodySMM'), field: 'smm' as const, unit: 'kg', color: 'text-green-400' },
            { label: t('inbodyPBF'), field: 'pbf' as const, unit: '%', color: 'text-red-400' },
          ]).map(({ label, field, unit, color }) => (
            <div key={field} className={`rounded-xl px-2.5 py-2 border border-transparent focus-within:border-primary transition-colors ${theme.input}`}>
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
                  className="w-full bg-transparent text-base font-black outline-none tabular-nums"
                />
                <span className={`text-[10px] font-semibold ${theme.textMuted}`}>{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ProteinTracker
        mode="compact"
        theme={theme}
        darkMode={appSettings.darkMode}
        selectedDate={selectedDate}
        formatDate={formatDate}
        showToast={showToast}
        onOpenFull={onOpenNutrition}
      />
    </div>
  );
});
