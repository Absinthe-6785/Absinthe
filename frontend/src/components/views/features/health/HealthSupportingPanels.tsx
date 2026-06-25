import { memo } from 'react';
import { Target } from 'lucide-react';
import type { HealthProps, Inbody, Theme } from '../../../../types';
import { useElementVisible } from '../../../../hooks/useElementVisible';
import { WorkspaceCardSkeleton } from '../../../common/WorkspaceCardSkeleton';
import { WORKSPACE_CARD, WORKSPACE_CARD_SURFACE_COMPACT } from '../../../common/workspaceCardSizes';
import { WorkoutMonthCalendar } from './WorkoutMonthCalendar';
import { ProteinTracker } from './nutrition';
import { K121_SKELETON_HEIGHT } from '../../../../lib/k121SkeletonHeights';
import { useTranslation } from '../../../../lib/i18n';

export interface HealthSupportingPanelsProps {
  selectedDate: Date;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  setSelectedDate: (d: Date) => void;
  formatDate: (d: Date) => string;
  isToday: (dateStr: string) => boolean;
  theme: Theme;
  lang: string;
  workoutDates?: ReadonlySet<string>;
  localInbody: Inbody;
  setLocalInbody: React.Dispatch<React.SetStateAction<Inbody>>;
  setIsInbodyDirty: (v: boolean) => void;
  onSaveInbody: () => void;
  appSettings: HealthProps['appSettings'];
  showToast: HealthProps['showToast'];
  onOpenNutrition: () => void;
  inbodyHistoryCollapsed: boolean;
  layout?: 'grid' | 'stack';
}

export const HealthSupportingPanels = memo(function HealthSupportingPanels({
  selectedDate,
  currentDate,
  setCurrentDate,
  setSelectedDate,
  formatDate,
  isToday,
  theme,
  lang,
  workoutDates,
  localInbody,
  setLocalInbody,
  setIsInbodyDirty,
  onSaveInbody,
  appSettings,
  showToast,
  onOpenNutrition,
  layout = 'grid',
}: HealthSupportingPanelsProps) {
  const { t } = useTranslation();
  const { ref, visible } = useElementVisible('160px');

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={layout === 'stack'
        ? 'flex flex-col gap-2.5 shrink-0'
        : 'grid min-h-0 grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.5fr)_minmax(0,1fr)] lg:items-stretch xl:h-full xl:min-h-0'}
      data-workspace-zone="supporting"
      data-k107-health-supporting-panels
    >
      {!visible ? (
        <>
          <WorkspaceCardSkeleton bars={3} theme={theme} minHeight={K121_SKELETON_HEIGHT.supportingCalendar} />
          <WorkspaceCardSkeleton bars={2} theme={theme} minHeight={K121_SKELETON_HEIGHT.supportingInbody} />
          <WorkspaceCardSkeleton bars={2} theme={theme} minHeight={K121_SKELETON_HEIGHT.supportingProtein} />
        </>
      ) : (
        <>
          <div className="order-3 flex min-w-0 flex-col lg:order-1 xl:h-full xl:min-h-0">
            <WorkoutMonthCalendar
              selectedDate={selectedDate}
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              setSelectedDate={setSelectedDate}
              formatDate={formatDate}
              isToday={isToday}
              theme={theme}
              lang={lang}
              workoutDates={workoutDates}
            />
          </div>
          <div className={`${WORKSPACE_CARD.sm} ${WORKSPACE_CARD_SURFACE_COMPACT} order-1 flex min-w-0 flex-col px-3 py-2 transition-colors lg:order-2 xl:h-full xl:min-h-0 ${theme.card}`} data-inbody-panel>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h2 className="font-heading text-xs font-bold flex items-center gap-1.5"><Target size={12} className="text-primary" /> {t('inbody')}</h2>
              <button type="button" onClick={onSaveInbody} className="text-[10px] font-bold bg-primary text-primary-foreground px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition-colors shrink-0">{t('save')}</button>
            </div>
            <div className="flex flex-col gap-1.5">
              {([
                { label: t('inbodyWeight'), field: 'weight' as const, unit: 'kg', color: 'text-blue-400' },
                { label: t('inbodySMM'), field: 'smm' as const, unit: 'kg', color: 'text-green-400' },
                { label: t('inbodyPBF'), field: 'pbf' as const, unit: '%', color: 'text-red-400' },
              ]).map(({ label, field, unit, color }) => (
                <div key={field} className={`rounded-xl px-2.5 py-1.5 border border-transparent focus-within:border-primary transition-colors ${theme.input}`}>
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
          <div className="order-2 flex min-w-0 flex-col lg:order-3 xl:h-full xl:min-h-0">
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
        </>
      )}
    </div>
  );
});
