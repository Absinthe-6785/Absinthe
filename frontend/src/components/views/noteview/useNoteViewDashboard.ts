import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Language } from '@/lib/i18n';
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

  const [historyVersion, setHistoryVersion] = useState(0);
  const [bootstrapDismissed, setBootstrapDismissed] = useState(() => isBootstrapSummaryDismissed());
  useEffect(() => subscribeKnowledgeHistory(() => setHistoryVersion(v => v + 1)), []);

  useEffect(() => {
    maybeBootstrapKnowledgeHistory(notes, knowledgeIndexService);
  }, [notes]);

  const historyEvents = useMemo(
    () => loadKnowledgeHistoryEvents(),
    [historyVersion],
  );

  const discoveryFeed = useMemo(
    () => buildDiscoveryFeed(notes, knowledgeIndexService, { historyEvents }),
    [notes, historyEvents],
  );

  const unifiedWorkspaceDashboard = useMemo(
    () => buildUnifiedWorkspaceDashboard(notes, {
      limit: 6,
      service: knowledgeIndexService,
      language: lang,
      discoveryFeed,
    }),
    [notes, lang, discoveryFeed],
  );

  const learningPathOverview = useMemo(
    () => buildLearningPathOverview(notes),
    [notes],
  );

  const subjectWorkspaces = useMemo(
    () => buildAllSubjectWorkspaces(notes, { limit: 6 }),
    [notes],
  );

  const cosmosVaultPhase = useMemo(
    () => resolveCosmosVaultPhase(notes, knowledgeIndexService, discoveryFeed.summary.totalCount),
    [notes, discoveryFeed.summary.totalCount],
  );

  const knowledgeTimeline = useMemo(
    () => buildKnowledgeTimeline(notes, knowledgeIndexService, discoveryFeed, {
      mode: timelineMode,
      historyEvents,
    }),
    [notes, discoveryFeed, timelineMode, historyEvents],
  );

  const activitySummary = useMemo(
    () => getActivitySummary(30, Date.now(), historyEvents),
    [historyEvents],
  );

  const cosmosEvolutionSummary = useMemo(
    () => buildCosmosEvolutionSummary(notes, knowledgeIndexService, historyEvents),
    [notes, historyEvents],
  );

  const cosmosEvolutionStory = useMemo(
    () => buildExpandedCosmosEvolutionStory(
      cosmosEvolutionSummary,
      historyEvents,
      notes,
      knowledgeTimeline.areaEvolution,
      knowledgeTimeline.milestones,
    ),
    [cosmosEvolutionSummary, historyEvents, notes, knowledgeTimeline.areaEvolution, knowledgeTimeline.milestones],
  );

  const knowledgeJourney = useMemo(
    () => buildKnowledgeJourney(knowledgeTimeline.milestones, historyEvents),
    [knowledgeTimeline.milestones, historyEvents],
  );

  const evolutionInsights = useMemo(
    () => buildEvolutionInsightsSummary(notes, knowledgeTimeline, historyEvents),
    [notes, knowledgeTimeline, historyEvents],
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
    const row = presentHistoryEvent(recent, notes);
    return { actionKey: row.actionKey, detail: row.detail, noteId: row.noteId };
  }, [historyEvents, notes]);

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
