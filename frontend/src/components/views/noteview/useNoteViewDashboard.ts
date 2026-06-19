import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Language } from '@/lib/i18n';
import { useNotesStore } from '../../../store/useNotesStore';
import type { NoteBase as Note } from '../noteUtils';
import type { TimelinePeriodMode } from '../features/knowledge/timeline';
import {
  knowledgeIndexService,
  buildUnifiedWorkspaceDashboard,
  buildLearningPathOverview,
  buildDiscoveryFeed,
  buildKnowledgeTimeline,
  resolveCosmosVaultPhase,
} from '../features/knowledge';
import {
  getActivitySummary,
  loadKnowledgeHistoryEvents,
  subscribeKnowledgeHistory,
  maybeBootstrapKnowledgeHistory,
  buildCosmosEvolutionSummary,
  buildExpandedCosmosEvolutionStory,
  buildDiscoveryProgressSummary,
  latestAchievedMilestone,
  getMilestoneNoteId,
  presentHistoryEvent,
  getRecentEvents,
  buildKnowledgeJourney,
  buildEvolutionInsightsSummary,
  exportMarkdownByKind,
  copyMarkdownToClipboard,
  downloadMarkdownFile,
  exportFilename,
  type ExportKind,
  loadBootstrapImportSummary,
  dismissBootstrapSummary,
  isBootstrapSummaryDismissed,
} from '../features/knowledge/history';
import { logMemAudit } from '@/lib/memAudit';
import type { DashboardLoadScope } from './contextPanelTabGate';
import {
  EMPTY_COSMOS_VAULT_PHASE,
  EMPTY_DISCOVERY_FEED,
  EMPTY_KNOWLEDGE_TIMELINE,
} from '../features/knowledge/knowledgeDataStubs';

export function useNoteViewDashboard(params: {
  notes: Note[];
  lang: Language;
  timelineMode: TimelinePeriodMode;
  activeNote: Note | null;
  loadScope?: DashboardLoadScope;
}) {
  const { notes, lang, timelineMode, loadScope } = params;
  const workspaceEnabled = loadScope?.workspace ?? true;
  const discoverEnabled = loadScope?.discover ?? true;
  const timelineEnabled = loadScope?.timeline ?? true;
  const vaultStructureVersion = useNotesStore(s => s.vaultStructureVersion);
  const galaxyCacheKey = String(vaultStructureVersion);

  const [historyVersion, setHistoryVersion] = useState(0);
  const [bootstrapDismissed, setBootstrapDismissed] = useState(() => isBootstrapSummaryDismissed());
  useEffect(() => subscribeKnowledgeHistory(() => setHistoryVersion(v => v + 1)), []);

  useEffect(() => {
    maybeBootstrapKnowledgeHistory(useNotesStore.getState().notes, knowledgeIndexService);
  }, [vaultStructureVersion]);

  const historyEvents = useMemo(
    () => loadKnowledgeHistoryEvents(),
    [historyVersion],
  );

  const discoveryFeed = useMemo(
    () => discoverEnabled
      ? buildDiscoveryFeed(
        useNotesStore.getState().notes,
        knowledgeIndexService,
        { historyEvents, galaxyCacheKey },
      )
      : EMPTY_DISCOVERY_FEED,
    [discoverEnabled, vaultStructureVersion, historyEvents],
  );

  const unifiedWorkspaceDashboard = useMemo(
    () => workspaceEnabled
      ? buildUnifiedWorkspaceDashboard(useNotesStore.getState().notes, {
        limit: 6,
        service: knowledgeIndexService,
        language: lang,
        discoveryFeed,
      })
      : buildUnifiedWorkspaceDashboard([], {
        limit: 6,
        service: knowledgeIndexService,
        language: lang,
        discoveryFeed: EMPTY_DISCOVERY_FEED,
      }),
    [workspaceEnabled, vaultStructureVersion, lang, discoveryFeed],
  );

  const learningPathOverview = useMemo(
    () => workspaceEnabled
      ? buildLearningPathOverview(useNotesStore.getState().notes)
      : { paths: [], totalPathCount: 0 },
    [workspaceEnabled, vaultStructureVersion],
  );

  const subjectWorkspaces = useMemo(
    () => [],
    [],
  );

  const cosmosVaultPhase = useMemo(
    () => discoverEnabled
      ? resolveCosmosVaultPhase(
        useNotesStore.getState().notes,
        knowledgeIndexService,
        discoveryFeed.summary.totalCount,
      )
      : EMPTY_COSMOS_VAULT_PHASE,
    [discoverEnabled, vaultStructureVersion, discoveryFeed.summary.totalCount],
  );

  const knowledgeTimeline = useMemo(
    () => timelineEnabled
      ? buildKnowledgeTimeline(useNotesStore.getState().notes, knowledgeIndexService, discoveryFeed, {
        mode: timelineMode,
        historyEvents,
        galaxyCacheKey,
      })
      : EMPTY_KNOWLEDGE_TIMELINE,
    [timelineEnabled, vaultStructureVersion, discoveryFeed, timelineMode, historyEvents],
  );

  useEffect(() => {
    if (!discoverEnabled && !timelineEnabled && !workspaceEnabled) return;
    logMemAudit({
      source: 'useNoteViewDashboard',
      notes: notes.filter(n => !n.deletedAt).length,
      discoveryItems: discoveryFeed.items.length,
      timelinePeriods: knowledgeTimeline.periods?.length,
    });
  }, [notes, discoveryFeed, knowledgeTimeline, discoverEnabled, timelineEnabled, workspaceEnabled]);

  const activitySummary = useMemo(
    () => getActivitySummary(30, Date.now(), historyEvents),
    [historyEvents],
  );

  const cosmosEvolutionSummary = useMemo(
    () => timelineEnabled
      ? buildCosmosEvolutionSummary(useNotesStore.getState().notes, knowledgeIndexService, historyEvents)
      : null,
    [timelineEnabled, vaultStructureVersion, historyEvents],
  );

  const cosmosEvolutionStory = useMemo(
    () => timelineEnabled && cosmosEvolutionSummary
      ? buildExpandedCosmosEvolutionStory(
        cosmosEvolutionSummary,
        historyEvents,
        useNotesStore.getState().notes,
        knowledgeTimeline.areaEvolution,
        knowledgeTimeline.milestones,
      )
      : null,
    [timelineEnabled, cosmosEvolutionSummary, historyEvents, vaultStructureVersion, knowledgeTimeline.areaEvolution, knowledgeTimeline.milestones],
  );

  const knowledgeJourney = useMemo(
    () => timelineEnabled
      ? buildKnowledgeJourney(knowledgeTimeline.milestones, historyEvents)
      : null,
    [timelineEnabled, knowledgeTimeline.milestones, historyEvents],
  );

  const evolutionInsights = useMemo(
    () => timelineEnabled
      ? buildEvolutionInsightsSummary(useNotesStore.getState().notes, knowledgeTimeline, historyEvents)
      : null,
    [timelineEnabled, vaultStructureVersion, knowledgeTimeline, historyEvents],
  );

  const bootstrapImportSummary = useMemo(() => {
    if (bootstrapDismissed || isBootstrapSummaryDismissed()) return null;
    return loadBootstrapImportSummary();
  }, [bootstrapDismissed, historyVersion]);

  const handleDismissBootstrapSummary = useCallback(() => {
    dismissBootstrapSummary();
    setBootstrapDismissed(true);
  }, []);

  const handleExportHistory = useCallback(async (kind: ExportKind, mode: 'copy' | 'download') => {
    if (!cosmosEvolutionSummary || !cosmosEvolutionStory || !knowledgeJourney || !evolutionInsights) return;
    const markdown = exportMarkdownByKind(kind, {
      evolution: {
        summary: cosmosEvolutionSummary,
        story: cosmosEvolutionStory,
        milestones: knowledgeTimeline.milestones,
        lang,
      },
      report: {
        momentum: evolutionInsights.momentum,
        dormantAreas: evolutionInsights.dormantAreas,
        latestMilestoneTitleKey: evolutionInsights.latestMilestoneTitleKey,
        latestMilestoneAt: evolutionInsights.latestMilestoneAt,
        lang,
        events: historyEvents,
      },
      activity: { events: historyEvents, notes, lang },
      journey: { journey: knowledgeJourney, lang },
    });
    if (mode === 'download') {
      downloadMarkdownFile(exportFilename(kind), markdown);
    } else {
      await copyMarkdownToClipboard(markdown);
    }
  }, [
    cosmosEvolutionSummary,
    cosmosEvolutionStory,
    knowledgeTimeline.milestones,
    evolutionInsights,
    historyEvents,
    notes,
    knowledgeJourney,
    lang,
  ]);

  const discoveryProgress = useMemo(
    () => buildDiscoveryProgressSummary(historyEvents),
    [historyEvents],
  );

  const dashboardRecentActivity = useMemo(() => {
    const recent = getRecentEvents(1, historyEvents)[0];
    if (!recent) return null;
    const row = presentHistoryEvent(recent, useNotesStore.getState().notes);
    return { actionKey: row.actionKey, detail: row.detail, noteId: row.noteId };
  }, [historyEvents, vaultStructureVersion]);

  const dashboardLatestMilestone = useMemo(() => {
    const milestone = latestAchievedMilestone(knowledgeTimeline.milestones);
    if (!milestone) return null;
    return {
      titleKey: milestone.titleKey,
      noteId: getMilestoneNoteId(milestone.id, historyEvents),
    };
  }, [knowledgeTimeline.milestones, historyEvents]);

  return {
    historyVersion,
    bootstrapDismissed,
    historyEvents,
    discoveryFeed,
    unifiedWorkspaceDashboard,
    learningPathOverview,
    subjectWorkspaces,
    cosmosVaultPhase,
    knowledgeTimeline,
    activitySummary,
    cosmosEvolutionSummary,
    cosmosEvolutionStory,
    knowledgeJourney,
    evolutionInsights,
    bootstrapImportSummary,
    discoveryProgress,
    dashboardRecentActivity,
    dashboardLatestMilestone,
    handleDismissBootstrapSummary,
    handleExportHistory,
  };
}
