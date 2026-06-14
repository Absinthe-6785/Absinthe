import { useState } from 'react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeTimeline, TimelinePeriodMode, TimelineSnapshot } from '../timeline';
import type { KnowledgeHistoryEvent } from '../history/eventTypes';
import type {
  CosmosEvolutionStory,
  CosmosEvolutionSummary,
  DiscoveryProgressSummary,
} from '../history/historyEvolutionQueries';
import { getMilestoneNoteId } from '../history/historyEvolutionQueries';
import { CosmosSuiteHeader } from '../cosmos/cosmosPanelUi';
import { KnowledgePanelSection, KnowledgePanelEmpty } from './KnowledgePanelSection';
import { TimelineMetricExplain } from '../timeline/TimelineMetricExplain';
import { TimelineActivityFeed } from './TimelineActivityFeed';
import { KnowledgeEvolutionSummary } from './KnowledgeEvolutionSummary';
import { CosmosEvolutionStory as CosmosEvolutionStoryPanel } from './CosmosEvolutionStory';
import { DiscoveryProgressSection } from './DiscoveryProgressSection';

export type TimelineSection = 'overview' | 'activity' | 'milestones';

export interface TimelinePanelProps {
  colors: NoteChromeColors;
  timeline: KnowledgeTimeline;
  mode: TimelinePeriodMode;
  onModeChange: (mode: TimelinePeriodMode) => void;
  historyEvents: readonly KnowledgeHistoryEvent[];
  notes: readonly NoteBase[];
  evolutionSummary: CosmosEvolutionSummary;
  evolutionStory: CosmosEvolutionStory;
  discoveryProgress: DiscoveryProgressSummary;
  onNavigateToNote?: (noteId: string) => void;
  compact?: boolean;
}

function SnapshotRow({ c, snapshot }: { c: NoteChromeColors; snapshot: TimelineSnapshot }) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        margin: '0 8px 4px',
        padding: '8px 10px',
        borderRadius: 8,
        border: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, marginBottom: 4 }}>
        {snapshot.label}
      </div>
      <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55 }}>
        {t('k42SnapshotLine')
          .replace('{notes}', String(snapshot.noteCount))
          .replace('{hubs}', String(snapshot.hubCount))
          .replace('{links}', String(snapshot.linkCount))}
      </div>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: 'growing' | 'stable' | 'dormant' }) {
  const symbol = trend === 'growing' ? '↑' : trend === 'dormant' ? '○' : '→';
  const color = trend === 'growing' ? '#10B981' : trend === 'dormant' ? '#9CA3AF' : '#6B7280';
  return <span style={{ color, fontWeight: 700, marginRight: 4 }} aria-hidden>{symbol}</span>;
}

function trendLabel(trend: 'growing' | 'stable' | 'dormant'): 'k45TrendGrowing' | 'k45TrendStable' | 'k45TrendDormant' {
  if (trend === 'growing') return 'k45TrendGrowing';
  if (trend === 'dormant') return 'k45TrendDormant';
  return 'k45TrendStable';
}

function SectionTabs({
  c,
  section,
  onChange,
}: {
  c: NoteChromeColors;
  section: TimelineSection;
  onChange: (s: TimelineSection) => void;
}) {
  const { t } = useTranslation();
  const tabs: TimelineSection[] = ['overview', 'activity', 'milestones'];
  const labels: Record<TimelineSection, string> = {
    overview: t('k45SectionOverview'),
    activity: t('k45SectionActivity'),
    milestones: t('k45SectionMilestones'),
  };
  return (
    <div style={{ display: 'flex', gap: 4, padding: '0 8px 8px', flexWrap: 'wrap' }}>
      {tabs.map(tab => {
        const active = section === tab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            style={{
              fontSize: 9,
              fontWeight: active ? 700 : 500,
              padding: '4px 8px',
              borderRadius: 999,
              border: `1px solid ${active ? c.accent : c.sideBdr}`,
              background: active ? c.accentBg : c.cardHov,
              color: active ? c.accent : c.textMuted,
              cursor: 'pointer',
            }}
          >
            {labels[tab]}
          </button>
        );
      })}
    </div>
  );
}

/** Cosmos Timeline — growth metrics, activity feed, milestones. */
export function TimelinePanel({
  colors: c,
  timeline,
  mode,
  onModeChange,
  historyEvents,
  notes,
  evolutionSummary,
  evolutionStory,
  discoveryProgress,
  onNavigateToNote,
  compact,
}: TimelinePanelProps) {
  const { t } = useTranslation();
  const [section, setSection] = useState<TimelineSection>('overview');

  const modes: TimelinePeriodMode[] = ['month', 'quarter', 'all'];
  const achievedMilestones = timeline.milestones.filter(m => m.achieved);
  const hasContent = timeline.snapshots.length > 0 || historyEvents.length > 0;

  if (!hasContent) {
    return (
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <CosmosSuiteHeader c={c} active="timeline" t={t} />
        <KnowledgePanelEmpty colors={c}>{t('k42TimelineEmpty')}</KnowledgePanelEmpty>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <CosmosSuiteHeader c={c} active="timeline" t={t} />
      <SectionTabs c={c} section={section} onChange={setSection} />

      {section === 'overview' && (
        <>
          <KnowledgeEvolutionSummary
            colors={c}
            summary={evolutionSummary}
            onNavigateToNote={onNavigateToNote}
          />
          <CosmosEvolutionStoryPanel colors={c} story={evolutionStory} />

          {timeline.snapshots.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 4, padding: '0 8px 8px', flexWrap: 'wrap' }}>
                {modes.map(m => {
                  const active = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => onModeChange(m)}
                      style={{
                        fontSize: 9,
                        fontWeight: active ? 700 : 500,
                        padding: '4px 8px',
                        borderRadius: 999,
                        border: `1px solid ${active ? c.accent : c.sideBdr}`,
                        background: active ? c.accentBg : c.cardHov,
                        color: active ? c.accent : c.textMuted,
                        cursor: 'pointer',
                      }}
                    >
                      {t(m === 'month' ? 'k42ViewMonth' : m === 'quarter' ? 'k42ViewQuarter' : 'k42ViewAllTime')}
                    </button>
                  );
                })}
              </div>

              <KnowledgePanelSection colors={c} first title={t('k42SectionEvolution')} count={timeline.snapshots.length}>
                {timeline.snapshots.map((snapshot, index) => (
                  <div key={snapshot.periodId}>
                    <SnapshotRow c={c} snapshot={snapshot} />
                    {index < timeline.snapshots.length - 1 && (
                      <div style={{ textAlign: 'center', color: c.textFaint, fontSize: 10, margin: '2px 0 4px' }}>↓</div>
                    )}
                  </div>
                ))}
              </KnowledgePanelSection>

              <KnowledgePanelSection colors={c} title={t('k42SectionVaultGrowth')}>
                <div style={{ padding: '0 10px 8px', fontSize: 10, color: c.textMuted, lineHeight: 1.6 }}>
                  <div>{t('k42GrowthNotes').replace('{count}', String(timeline.growth.vault.notesCreated))}</div>
                  <div>{t('k42GrowthLinks').replace('{count}', String(timeline.growth.vault.linksCreated))}</div>
                  <div>{t('k42GrowthAreas').replace('{count}', String(timeline.growth.vault.areasCreated))}</div>
                </div>
                <div style={{ padding: '0 10px 8px' }}>
                  <TimelineMetricExplain colors={c} compact={compact} metricKey="k42MetricConnectionDensity" explainKey="k42ExplainConnectionDensity" />
                </div>
              </KnowledgePanelSection>

              <KnowledgePanelSection colors={c} title={t('k42SectionStructuralGrowth')}>
                <div style={{ padding: '0 10px 8px', fontSize: 10, color: c.textMuted, lineHeight: 1.6 }}>
                  <div>{t('k42StructuralHubs').replace('{count}', String(timeline.growth.structural.hubCount))}</div>
                  <div>{t('k42StructuralGalaxies').replace('{count}', String(timeline.growth.structural.galaxyCount))}</div>
                  <div>{t('k42StructuralDensity').replace('{value}', String(timeline.growth.structural.connectionDensity))}</div>
                </div>
              </KnowledgePanelSection>
            </>
          )}

          {timeline.areaEvolution.length > 0 && (
            <KnowledgePanelSection colors={c} title={t('k42SectionAreaEvolution')} count={timeline.areaEvolution.length}>
              {timeline.areaEvolution.map(row => (
                <div
                  key={row.areaLabel}
                  style={{
                    margin: '0 8px 6px',
                    padding: '7px 9px',
                    borderRadius: 7,
                    border: `1px solid ${c.sideBdr}`,
                    background: c.cardHov,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: c.text, marginBottom: 4 }}>
                    <TrendIndicator trend={row.trend} />
                    {row.areaLabel}
                    <span style={{ fontSize: 9, fontWeight: 500, color: c.textFaint, marginLeft: 6 }}>
                      {t(trendLabel(row.trend))}
                    </span>
                  </div>
                  {row.periods.map(p => (
                    <div key={`${row.areaLabel}-${p.label}`} style={{ fontSize: 9, color: c.textMuted }}>
                      {p.label}: {p.noteCount} {t('k42NotesLabel')}
                    </div>
                  ))}
                </div>
              ))}
            </KnowledgePanelSection>
          )}

          {discoveryProgress.resolvedCount > 0 && (
            <KnowledgePanelSection colors={c} title={t('k45DiscoveryProgress')}>
              <DiscoveryProgressSection
                colors={c}
                progress={discoveryProgress}
                notes={notes}
                onNavigateToNote={onNavigateToNote}
              />
            </KnowledgePanelSection>
          )}

          {!timeline.usesEventHistory && timeline.snapshots.length > 0 && (
            <KnowledgePanelSection colors={c} title={t('k42SectionDiscoveryHistory')}>
              <div style={{ padding: '0 10px 8px', fontSize: 10, color: c.textMuted, lineHeight: 1.6 }}>
                <div>{t('k42DiscResolved').replace('{count}', String(timeline.discoveryHistory.missingConnectionsResolved))}</div>
                <div>{t('k42DiscHubsCreated').replace('{count}', String(timeline.discoveryHistory.weakHubsCreated))}</div>
                <div>{t('k42DiscRevisited').replace('{count}', String(timeline.discoveryHistory.forgottenNotesRevisited))}</div>
              </div>
            </KnowledgePanelSection>
          )}
        </>
      )}

      {section === 'activity' && (
        <KnowledgePanelSection colors={c} first title={t('k45SectionActivity')} count={historyEvents.length}>
          <TimelineActivityFeed
            colors={c}
            events={historyEvents}
            notes={notes}
            onNavigateToNote={onNavigateToNote}
            compact={compact}
          />
        </KnowledgePanelSection>
      )}

      {section === 'milestones' && (
        <KnowledgePanelSection colors={c} first title={t('k42SectionMilestones')} count={achievedMilestones.length}>
          {timeline.milestones.map(m => {
            const noteId = m.achieved ? getMilestoneNoteId(m.id, historyEvents) : null;
            const interactive = Boolean(m.achieved && noteId && onNavigateToNote);
            return (
              <button
                key={m.id}
                type="button"
                disabled={!interactive}
                onClick={() => noteId && onNavigateToNote?.(noteId)}
                style={{
                  width: 'calc(100% - 16px)',
                  margin: '0 8px 5px',
                  padding: '6px 9px',
                  borderRadius: 7,
                  border: `1px solid ${m.achieved ? c.accent : c.sideBdr}`,
                  background: m.achieved ? c.accentBg : c.cardHov,
                  opacity: m.achieved ? 1 : 0.65,
                  fontSize: 10,
                  color: m.achieved ? c.text : c.textMuted,
                  textAlign: 'left',
                  cursor: interactive ? 'pointer' : 'default',
                }}
              >
                {m.achieved ? '✓ ' : '○ '}{t(m.titleKey)}
              </button>
            );
          })}
        </KnowledgePanelSection>
      )}
    </div>
  );
}
