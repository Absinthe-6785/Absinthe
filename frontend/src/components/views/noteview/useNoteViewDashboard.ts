import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Language } from '@/lib/i18n';
import { useNotesStore } from '../../../store/useNotesStore';
import type { NoteBase as Note } from '../noteUtils';
import type { TimelinePeriodMode } from '../features/knowledge/timeline';
import {
  knowledgeIndexService,
  buildUnifiedWorkspaceDashboard,
  buildLearningPathOverview,
  buildAllSubjectWorkspaces,
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

export function useNoteViewDashboard(params: {
  notes: Note[];
  lang: Language;
  timelineMode: TimelinePeriodMode;
  activeNote: Note | null;
}) {
  const { notes, lang, timelineMode } = params;
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
    () => buildDiscoveryFeed(
      useNotesStore.getState().notes,
      knowledgeIndexService,
      { historyEvents, galaxyCacheKey },
    ),
    [vaultStructureVersion, historyEvents],
  );

  const unifiedWorkspaceDashboard = useMemo(
    () => buildUnifiedWorkspaceDashboard(useNotesStore.getState().notes, {
      limit: 6,
      service: knowledgeIndexService,
      language: lang,
      discoveryFeed,
    }),
    [vaultStructureVersion, lang, discoveryFeed],
  );

  const learningPathOverview = useMemo(
    () => buildLearningPathOverview(useNotesStore.getState().notes),
    [vaultStructureVersion],
  );

  const subjectWorkspaces = useMemo(
    () => buildAllSubjectWorkspaces(useNotesStore.getState().notes, { limit: 6 }),
    [vaultStructureVersion],
  );

  const cosmosVaultPhase = useMemo(
    () => resolveCosmosVaultPhase(
      useNotesStore.getState().notes,
      knowledgeIndexService,
      discoveryFeed.summary.totalCount,
    ),
    [vaultStructureVersion, discoveryFeed.summary.totalCount],
  );

  const knowledgeTimeline = useMemo(
    () => buildKnowledgeTimeline(useNotesStore.getState().notes, knowledgeIndexService, discoveryFeed, {
      mode: timelineMode,
      historyEvents,
      galaxyCacheKey,
    }),
    [vaultStructureVersion, discoveryFeed, timelineMode, historyEvents],
  );

  const activitySummary = useMemo(
    () => getActivitySummary(30, Date.now(), historyEvents),
    [historyEvents],
  );

  const cosmosEvolutionSummary = useMemo(
    () => buildCosmosEvolutionSummary(useNotesStore.getState().notes, knowledgeIndexService, historyEvents),
    [vaultStructureVersion, historyEvents],
  );

  const cosmosEvolutionStory = useMemo(
    () => buildExpandedCosmosEvolutionStory(
      cosmosEvolutionSummary,
      historyEvents,
      useNotesStore.getState().notes,
      knowledgeTimeline.areaEvolution,
      knowledgeTimeline.milestones,
    ),
    [cosmosEvolutionSummary, historyEvents, vaultStructureVersion, knowledgeTimeline.areaEvolution, knowledgeTimeline.milestones],
  );

  const knowledgeJourney = useMemo(
    () => buildKnowledgeJourney(knowledgeTimeline.milestones, historyEvents),
    [knowledgeTimeline.milestones, historyEvents],
  );

  const evolutionInsights = useMemo(
    () => buildEvolutionInsightsSummary(useNotesStore.getState().notes, knowledgeTimeline, historyEvents),
    [vaultStructureVersion, knowledgeTimeline, historyEvents],
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
