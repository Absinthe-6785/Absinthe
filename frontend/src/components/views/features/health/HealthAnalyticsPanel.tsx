import { memo, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import type { HealthProjection } from './buildHealthProjection';
import type { Theme } from '../../../../types';
import { WORKSPACE_CARD } from '../../../common/workspaceCardSizes';
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
    <div className="flex items-end gap-1 h-16" data-k107-health-weekly-chart>
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
    <div data-k121-health-collapsible={dataHook}>
      <button
        type="button"
        onClick={onToggle}
        className={`text-[11px] font-bold mb-1.5 flex items-center gap-1 min-h-[36px] ${theme.textMuted}`}
      >
        {label}
        {!collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {!collapsed ? children : null}
    </div>
  );
}

/** K-125F — simplified analytics: summary visible, no streak, charts hidden by default. */
export const HealthAnalyticsPanel = memo(function HealthAnalyticsPanel({
  projection,
  loading,
  theme,
  darkMode,
  prefs,
  onPrefsChange,
  onOpenWorkoutNote,
}: HealthAnalyticsPanelProps) {
  const { t } = useTranslation();
  const { ref, visible } = useElementVisible('80px');
  const expanded = !prefs.analyticsCollapsed;
  const chartsExpanded = expanded && !prefs.chartsCollapsed;

  const toggle = (key: keyof HealthSectionPrefs) => {
    onPrefsChange({ ...prefs, [key]: !prefs[key] });
  };

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      className={`${WORKSPACE_CARD.sm} rounded-[20px] lg:rounded-[24px] shadow-sm p-3 lg:p-4 transition-colors ${theme.card} shrink-0 relative z-0`}
      data-k107-health-analytics
      data-k121-health-analytics
      data-k125c-health-order="analytics"
      data-k125f-health-analytics
    >
      <button
        type="button"
        onClick={() => toggle('analyticsCollapsed')}
        className="w-full flex items-center justify-between gap-2 min-h-[44px]"
      >
        <span className="font-heading text-sm font-bold flex items-center gap-1.5">
          <TrendingUp size={14} className="text-primary" />
          {t('k107HealthAnalytics')}
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2" data-k121-health-summary data-k125f-analytics-summary>
          {!visible || loading ? (
            <WorkspaceCardSkeleton bars={1} theme={theme} minHeight={K121_SKELETON_HEIGHT.analyticsSummary} />
          ) : projection ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-center" data-k125f-summary-grid>
                <div className={`rounded-xl py-2 ${theme.input}`}>
                  <p className={`text-[10px] font-bold ${theme.textMuted}`}>{t('k107WeeklySessions')}</p>
                  <p className="text-lg font-black tabular-nums">{projection.weeklySessionCount}</p>
                </div>
                <div className={`rounded-xl py-2 ${theme.input}`}>
                  <p className={`text-[10px] font-bold ${theme.textMuted}`}>{t('k107MonthlySessions')}</p>
                  <p className="text-lg font-black tabular-nums">{projection.monthlySessionCount}</p>
                </div>
              </div>

              <CollapsibleSection
                label={t('k107Charts')}
                collapsed={prefs.chartsCollapsed}
                onToggle={() => toggle('chartsCollapsed')}
                theme={theme}
                dataHook="charts"
              >
                {chartsExpanded && visible && (
                  <HealthWeeklyChart points={projection.chartSeries.weeklySessions} darkMode={darkMode} />
                )}
              </CollapsibleSection>

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
                    empty={<p className={`text-xs py-1 ${theme.textMuted}`} data-k125f-empty-compact>{t('k107NoPrs')}</p>}
                  />
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                label={t('k107RecentSessions')}
                collapsed={prefs.recentSessionsCollapsed}
                onToggle={() => toggle('recentSessionsCollapsed')}
                theme={theme}
                dataHook="recent-sessions"
              >
                <div className={K121_SKELETON_HEIGHT.analyticsRecent}>
                  <HealthVirtualList
                    items={projection.recentSessions}
                    theme={theme}
                    dataHook="recent-sessions"
                    getKey={s => s.date}
                    renderRow={s => (
                      <div className="flex items-center gap-2 w-full min-h-[44px]">
                        <span className="text-xs font-semibold truncate flex-1 flex justify-between gap-2">
                          <span className="tabular-nums shrink-0">{s.date}</span>
                          <span className="truncate opacity-70">{s.exercises.join(', ')}</span>
                        </span>
                        {onOpenWorkoutNote ? (
                          <button
                            type="button"
                            onClick={() => onOpenWorkoutNote(s.date)}
                            className="shrink-0 text-[10px] font-bold text-primary px-2 py-1 rounded-lg hover:bg-primary/10 min-h-[44px] min-w-[44px]"
                            data-k113-cross-ref="health"
                            data-k113-open-workout-note={s.date}
                          >
                            {t('k113OpenWorkoutNote')}
                          </button>
                        ) : null}
                      </div>
                    )}
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
                      <span className="text-xs font-semibold truncate w-full flex justify-between gap-2">
                        <span className="truncate">{r.name}</span>
                        <span className="tabular-nums shrink-0 opacity-70">{r.sessionCount}×</span>
                      </span>
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
