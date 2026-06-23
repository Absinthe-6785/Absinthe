import { memo, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import type { HealthProjection } from './buildHealthProjection';
import type { Theme } from '../../../../types';
import { WORKSPACE_CARD, WORKSPACE_CARD_SURFACE_COMPACT } from '../../../common/workspaceCardSizes';
import { useTranslation } from '../../../../lib/i18n';
import { useElementVisible } from '../../../../hooks/useElementVisible';
import { HealthVirtualList } from './HealthVirtualList';
import { WorkspaceCardSkeleton } from '../../../common/WorkspaceCardSkeleton';
import type { HealthSectionPrefs } from './healthSectionPrefs';
import { K121_SKELETON_HEIGHT } from '../../../../lib/k121SkeletonHeights';

export interface HealthAnalyticsPanelProps {
  projection: HealthProjection | null;
  loading: boolean;
  theme: Theme;
  darkMode: boolean;
  prefs: HealthSectionPrefs;
  onPrefsChange: (next: HealthSectionPrefs) => void;
  onOpenWorkoutNote?: (dateLabel: string) => void;
  standalone?: boolean;
}

const HealthWeeklyChart = memo(function HealthWeeklyChart({
  points,
  darkMode,
}: {
  points: { label: string; value: number }[];
  darkMode: boolean;
}) {
  const max = Math.max(1, ...points.map(p => p.value));
  return (
    <div className="flex items-end gap-1 h-12" data-k107-health-weekly-chart data-k126-health-chart>
      {points.map(p => (
        <div key={p.label} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className={`w-full rounded-t-sm ${p.value > 0 ? 'bg-primary' : darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
            style={{ height: `${Math.max(4, (p.value / max) * 100)}%` }}
          />
          <span className="text-[9px] tabular-nums opacity-60">{p.label}</span>
        </div>
      ))}
    </div>
  );
});

function CollapsibleSection({
  label,
  collapsed,
  onToggle,
  theme,
  children,
  dataHook,
}: {
  label: string;
  collapsed: boolean;
  onToggle: () => void;
  theme: Theme;
  children: ReactNode;
  dataHook?: string;
}) {
  return (
    <div data-k121-health-collapsible={dataHook} data-k126-health-subsection={dataHook}>
      <button
        type="button"
        onClick={onToggle}
        className={`text-[11px] font-bold mb-1 flex items-center gap-1 min-h-[36px] ${theme.textMuted}`}
      >
        {label}
        {!collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {!collapsed ? children : null}
    </div>
  );
}

export const HealthAnalyticsPanel = memo(function HealthAnalyticsPanel({
  projection,
  loading,
  theme,
  darkMode,
  prefs,
  onPrefsChange,
  onOpenWorkoutNote,
  standalone = false,
}: HealthAnalyticsPanelProps) {
  const { t } = useTranslation();
  const { ref, visible } = useElementVisible('80px');
  const expanded = standalone || !prefs.analyticsCollapsed;
  const chartsExpanded = expanded && !prefs.chartsCollapsed;

  const toggle = (key: keyof HealthSectionPrefs) => {
    onPrefsChange({ ...prefs, [key]: !prefs[key] });
  };

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`${standalone ? WORKSPACE_CARD.lg : WORKSPACE_CARD.sm} ${standalone ? 'p-3.5 lg:p-4 flex flex-col min-h-0 lg:overflow-hidden' : `${WORKSPACE_CARD_SURFACE_COMPACT} shrink-0`} transition-colors ${theme.card}`}
      data-k107-health-analytics
      data-k121-health-analytics
      data-k126-health-analytics
      data-k129b-health-analysis={standalone ? 'true' : undefined}
    >
      <div className="w-full flex items-center justify-between gap-2 min-h-[38px] shrink-0">
        <span className="font-heading text-sm font-bold flex items-center gap-1.5">
          <TrendingUp size={14} className="text-primary" />
          {t('k107HealthAnalytics')}
        </span>
        {!standalone ? (
          <button
            type="button"
            onClick={() => toggle('analyticsCollapsed')}
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl ${theme.textMuted} hover:text-foreground`}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        ) : null}
      </div>

      {expanded && (
        <div className={`mt-1.5 space-y-2 ${standalone ? 'min-h-0 lg:overflow-y-auto pr-1' : ''}`} data-k121-health-summary data-k126-health-summary>
          {!visible || loading ? (
            <WorkspaceCardSkeleton bars={2} theme={theme} minHeight={K121_SKELETON_HEIGHT.analyticsSummary} />
          ) : projection ? (
            <>
              <div className="grid grid-cols-2 gap-1.5 text-center" data-k126-health-summary-grid>
                <div className={`rounded-lg py-1 px-2 ${theme.input}`}>
                  <p className={`text-[10px] font-bold ${theme.textMuted}`}>{t('k107WeeklySessions')}</p>
                  <p className="text-sm font-black tabular-nums">{projection.weeklySessionCount}</p>
                </div>
                <div className={`rounded-lg py-1 px-2 ${theme.input}`}>
                  <p className={`text-[10px] font-bold ${theme.textMuted}`}>{t('k107MonthlySessions')}</p>
                  <p className="text-sm font-black tabular-nums">{projection.monthlySessionCount}</p>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => toggle('chartsCollapsed')}
                  className={`text-[11px] font-bold mb-1 flex items-center gap-1 min-h-[36px] ${theme.textMuted}`}
                  data-k107-health-charts-toggle
                >
                  {t('k107Charts')}
                  {chartsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {chartsExpanded && visible && (
                  <HealthWeeklyChart points={projection.chartSeries.weeklySessions} darkMode={darkMode} />
                )}
              </div>

              <CollapsibleSection
                label={t('k107RecentPrs')}
                collapsed={prefs.prSectionCollapsed}
                onToggle={() => toggle('prSectionCollapsed')}
                theme={theme}
                dataHook="pr"
              >
                <div className={K121_SKELETON_HEIGHT.analyticsPr}>
                  <HealthVirtualList
                    items={projection.prHighlights}
                    theme={theme}
                    dataHook="pr-list"
                    getKey={p => `${p.name}-${p.date}`}
                    renderRow={p => (
                      <span className="text-xs font-semibold truncate w-full flex justify-between gap-2">
                        <span className="truncate">{p.name}</span>
                        <span className="tabular-nums shrink-0" title={p.conversionHint ?? undefined}>
                          {p.displayValue} {p.displayUnit}
                        </span>
                      </span>
                    )}
                    empty={<p className={`text-xs ${theme.textMuted}`}>{t('k107NoPrs')}</p>}
                  />
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                label={t('k107ExerciseHistory')}
                collapsed={prefs.exerciseHistoryCollapsed}
                onToggle={() => toggle('exerciseHistoryCollapsed')}
                theme={theme}
                dataHook="exercise-history"
              >
                <div className={K121_SKELETON_HEIGHT.analyticsHistory}>
                  <HealthVirtualList
                    items={projection.exerciseHistory}
                    theme={theme}
                    dataHook="exercise-history"
                    getKey={r => r.name}
                    renderRow={r => (
                      <div className="flex items-center gap-2 w-full min-h-[40px] py-0.5">
                        <span className="text-xs font-semibold truncate flex-1 flex justify-between gap-2">
                          <span className="truncate">{r.name}</span>
                          <span className="tabular-nums shrink-0 opacity-70">{r.sessionCount}×</span>
                        </span>
                        {onOpenWorkoutNote && r.lastDate ? (
                          <button
                            type="button"
                            onClick={() => onOpenWorkoutNote(r.lastDate)}
                            className="shrink-0 text-[10px] font-bold text-primary px-2 py-1 rounded-lg hover:bg-primary/10 min-h-[44px]"
                            data-k113-cross-ref="health"
                            data-k113-open-workout-note={r.lastDate}
                          >
                            {t('k113OpenWorkoutNote')}
                          </button>
                        ) : null}
                      </div>
                    )}
                  />
                </div>
              </CollapsibleSection>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
});
