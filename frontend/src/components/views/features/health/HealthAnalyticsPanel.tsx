import { memo } from 'react';
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import type { HealthProjection } from './buildHealthProjection';
import type { Theme } from '../../../../types';
import { WORKSPACE_CARD } from '../../../common/workspaceCardSizes';
import { useTranslation } from '../../../../lib/i18n';
import { useElementVisible } from '../../../../hooks/useElementVisible';
import { HealthVirtualList } from './HealthVirtualList';
import { WorkspaceCardSkeleton } from '../../../common/WorkspaceCardSkeleton';
import type { HealthSectionPrefs } from './healthSectionPrefs';

export interface HealthAnalyticsPanelProps {
  projection: HealthProjection | null;
  loading: boolean;
  theme: Theme;
  darkMode: boolean;
  prefs: HealthSectionPrefs;
  onPrefsChange: (next: HealthSectionPrefs) => void;
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

export const HealthAnalyticsPanel = memo(function HealthAnalyticsPanel({
  projection,
  loading,
  theme,
  darkMode,
  prefs,
  onPrefsChange,
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
      className={`${WORKSPACE_CARD.sm} rounded-[20px] lg:rounded-[24px] shadow-sm p-3 lg:p-4 transition-colors ${theme.card} shrink-0`}
      data-k107-health-analytics
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
        <div className="mt-2 space-y-3">
          {!visible || loading ? (
            <WorkspaceCardSkeleton bars={2} theme={theme} minHeight="min-h-0" />
          ) : projection ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className={`rounded-xl py-2 ${theme.input}`}>
                  <p className={`text-[10px] font-bold ${theme.textMuted}`}>{t('k107WeeklySessions')}</p>
                  <p className="text-lg font-black tabular-nums">{projection.weeklySessionCount}</p>
                </div>
                <div className={`rounded-xl py-2 ${theme.input}`}>
                  <p className={`text-[10px] font-bold ${theme.textMuted}`}>{t('k107MonthlySessions')}</p>
                  <p className="text-lg font-black tabular-nums">{projection.monthlySessionCount}</p>
                </div>
                <div className={`rounded-xl py-2 ${theme.input}`}>
                  <p className={`text-[10px] font-bold ${theme.textMuted}`}>{t('k107WorkoutStreak')}</p>
                  <p className="text-lg font-black tabular-nums">{projection.workoutStreakDays}</p>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => toggle('chartsCollapsed')}
                  className={`text-[11px] font-bold mb-1.5 flex items-center gap-1 ${theme.textMuted}`}
                  data-k107-health-charts-toggle
                >
                  {t('k107Charts')}
                  {chartsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {chartsExpanded && visible && (
                  <HealthWeeklyChart points={projection.chartSeries.weeklySessions} darkMode={darkMode} />
                )}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => toggle('prSectionCollapsed')}
                  className={`text-[11px] font-bold mb-1.5 flex items-center gap-1 ${theme.textMuted}`}
                >
                  {t('k107RecentPrs')}
                  {!prefs.prSectionCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {!prefs.prSectionCollapsed && (
                  <HealthVirtualList
                    items={projection.prHighlights}
                    theme={theme}
                    dataHook="pr-list"
                    getKey={p => `${p.name}-${p.date}`}
                    renderRow={p => (
                      <span className="text-xs font-semibold truncate w-full flex justify-between gap-2">
                        <span className="truncate">{p.name}</span>
                        <span className="tabular-nums shrink-0">{p.kg}kg</span>
                      </span>
                    )}
                    empty={<p className={`text-xs ${theme.textMuted}`}>{t('k107NoPrs')}</p>}
                  />
                )}
              </div>

              <div>
                <p className={`text-[11px] font-bold mb-1.5 ${theme.textMuted}`}>{t('k107RecentSessions')}</p>
                <HealthVirtualList
                  items={projection.recentSessions}
                  theme={theme}
                  dataHook="recent-sessions"
                  getKey={s => s.date}
                  renderRow={s => (
                    <span className="text-xs font-semibold truncate w-full flex justify-between gap-2">
                      <span className="tabular-nums shrink-0">{s.date}</span>
                      <span className="truncate opacity-70">{s.exercises.join(', ')}</span>
                    </span>
                  )}
                />
              </div>
              <div>
                <p className={`text-[11px] font-bold mb-1.5 ${theme.textMuted}`}>{t('k107ExerciseHistory')}</p>
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
            </>
          ) : null}
        </div>
      )}
    </div>
  );
});
