import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { DiscoveryFeed } from '../discovery';
import { getProperty } from '../properties/noteProperties';
import type {
  AreaEvolutionRow,
  BuildKnowledgeTimelineOptions,
  DiscoveryGrowthMetrics,
  KnowledgeMilestone,
  KnowledgeTimeline,
  RecentEvolutionSummary,
  TimelineGrowthMetrics,
  TimelinePeriodMode,
  TimelineSnapshot,
} from './timelineTypes';
import {
  buildDiscoveryHistory,
  buildSnapshotMetrics,
  countHubs,
  noteEffectiveCreatedAt,
  notesActiveAt,
  structuralGrowthFrom,
  vaultGrowthBetween,
} from './timelineMetrics';
import { buildPeriodBuckets, earliestNoteTime, trimSnapshotsForDisplay } from './timelineSnapshots';
import { evaluateKnowledgeImportance } from '../cosmos/intelligence/knowledgeImportance';
import { buildImportanceInputForNote } from '../cosmos/intelligence/knowledgeOpportunities';
import { getNoteGalaxyMap, type GalaxyAssignment } from '../graph/knowledgeUniverse/galaxyClustering';
import { isAreaNote } from '../trace/areaNotes';
import {
  discoveryHistoryFromEvents,
  mergeGrowthWithHistory,
  recentEvolutionFromHistory,
} from './timelineHistoryMetrics';
import { hasRecordedHistory } from '../history/historyQueries';
import type { KnowledgeHistoryEvent } from '../history/eventTypes';

function buildSnapshots(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  mode: TimelinePeriodMode,
  now: number,
  discoveriesOpen: number,
  galaxyMap: Map<string, GalaxyAssignment>,
): TimelineSnapshot[] {
  const buckets = buildPeriodBuckets(notes, mode, now);
  return buckets.map(bucket => {
    const active = notesActiveAt(notes, bucket.endMs);
    return buildSnapshotMetrics(
      active,
      service,
      discoveriesOpen,
      bucket.id,
      bucket.label,
      galaxyMap,
    );
  });
}

function buildGrowthMetrics(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  snapshots: TimelineSnapshot[],
  buckets: ReturnType<typeof buildPeriodBuckets>,
  discoveriesOpen: number,
  historyEvents: readonly KnowledgeHistoryEvent[],
): TimelineGrowthMetrics {
  const lastBucket = buckets[buckets.length - 1];
  const prevSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2] : null;
  const currentSnapshot = snapshots[snapshots.length - 1];

  if (!lastBucket || !currentSnapshot) {
    return {
      vault: { notesCreated: 0, linksCreated: 0, areasCreated: 0 },
      structural: { hubCount: 0, galaxyCount: 0, connectionDensity: 0 },
      discovery: { discoveriesGenerated: discoveriesOpen, discoveriesResolved: 0, connectionsAdded: 0 },
      periodLabel: '',
    };
  }

  const vault = vaultGrowthBetween(
    prevSnapshot,
    currentSnapshot,
    notes,
    lastBucket.startMs,
    lastBucket.endMs,
  );

  const discoveryHistory = buildDiscoveryHistory(notes, service, Date.now());
  const discovery: DiscoveryGrowthMetrics = {
    discoveriesGenerated: discoveriesOpen,
    discoveriesResolved:
      discoveryHistory.missingConnectionsResolved
      + discoveryHistory.weakHubsCreated
      + discoveryHistory.forgottenNotesRevisited,
    connectionsAdded: vault.linksCreated,
  };

  return mergeGrowthWithHistory(
    {
      vault,
      structural: structuralGrowthFrom(currentSnapshot),
      discovery,
      periodLabel: lastBucket.label,
    },
    lastBucket.startMs,
    lastBucket.endMs,
    historyEvents,
  );
}

function areaLabelForNote(note: NoteBase, service: KnowledgeIndexService, galaxyLabel?: string): string | null {
  const area = getProperty(note, 'area')?.trim();
  if (area) return area;
  if (galaxyLabel && galaxyLabel !== 'Uncategorized') return galaxyLabel;
  const tags = service.getTags(note.id);
  return tags[0] ?? null;
}

function buildAreaEvolution(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  mode: TimelinePeriodMode,
  now: number,
  galaxyMap: Map<string, GalaxyAssignment>,
): AreaEvolutionRow[] {
  const buckets = buildPeriodBuckets(notes, mode, now);
  if (buckets.length === 0) return [];

  const areaMap = new Map<string, { label: string; periods: { label: string; noteCount: number }[] }>();

  for (const bucket of buckets.slice(-6)) {
    const active = notesActiveAt(notes, bucket.endMs);
    const counts = new Map<string, number>();
    for (const note of active) {
      const label = areaLabelForNote(note, service, galaxyMap.get(note.id)?.galaxyLabel);
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    for (const [label, count] of counts) {
      const row = areaMap.get(label) ?? { label, periods: [] };
      row.periods.push({ label: bucket.label, noteCount: count });
      areaMap.set(label, row);
    }
  }

  return [...areaMap.values()]
    .filter(row => row.periods.length >= 1)
    .map(row => {
      const first = row.periods[0]?.noteCount ?? 0;
      const last = row.periods[row.periods.length - 1]?.noteCount ?? 0;
      let trend: AreaEvolutionRow['trend'] = 'stable';
      if (last > first) trend = 'growing';
      else if (last === first && last <= 2) trend = 'dormant';
      return { areaLabel: row.label, periods: row.periods, trend };
    })
    .sort((a, b) => {
      const aLast = a.periods[a.periods.length - 1]?.noteCount ?? 0;
      const bLast = b.periods[b.periods.length - 1]?.noteCount ?? 0;
      return bLast - aLast;
    })
    .slice(0, 6);
}

function milestoneAtThreshold(
  snapshots: TimelineSnapshot[],
  buckets: ReturnType<typeof buildPeriodBuckets>,
  field: 'noteCount' | 'linkCount' | 'hubCount',
  threshold: number,
): number | null {
  for (let i = 0; i < snapshots.length; i += 1) {
    if (snapshots[i][field] >= threshold) {
      return buckets[i]?.endMs ?? null;
    }
  }
  return null;
}

function buildMilestones(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  snapshots: TimelineSnapshot[],
  buckets: ReturnType<typeof buildPeriodBuckets>,
  galaxyMap: Map<string, GalaxyAssignment>,
): KnowledgeMilestone[] {
  const active = notes.filter(n => !n.deletedAt);
  const earliest = earliestNoteTime(notes);

  const firstLinkMs = milestoneAtThreshold(snapshots, buckets, 'linkCount', 1);
  const notes100Ms = milestoneAtThreshold(snapshots, buckets, 'noteCount', 100);
  const links500Ms = milestoneAtThreshold(snapshots, buckets, 'linkCount', 500);
  const hubs10Ms = milestoneAtThreshold(snapshots, buckets, 'hubCount', 10);

  let firstHubMs: number | null = null;
  for (const note of active) {
    if (!isAreaNote(note)) continue;
    const created = noteEffectiveCreatedAt(note);
    if (firstHubMs == null || created < firstHubMs) firstHubMs = created;
  }
  if (firstHubMs == null) {
    for (const note of active) {
      const input = buildImportanceInputForNote(note, service, galaxyMap.get(note.id));
      if (evaluateKnowledgeImportance(input).classification !== 'core-hub') continue;
      const created = noteEffectiveCreatedAt(note);
      if (firstHubMs == null || created < firstHubMs) firstHubMs = created;
    }
  }

  const currentNotes = active.length;
  const currentLinks = snapshots[snapshots.length - 1]?.linkCount ?? 0;
  const currentHubs = countHubs(active, service);

  return [
    { id: 'first-note', titleKey: 'k42MilestoneFirstNote', achieved: currentNotes >= 1, achievedAt: earliest },
    { id: 'first-link', titleKey: 'k42MilestoneFirstLink', achieved: currentLinks >= 1, achievedAt: firstLinkMs },
    { id: 'first-hub', titleKey: 'k42MilestoneFirstHub', achieved: firstHubMs != null, achievedAt: firstHubMs },
    { id: 'notes-100', titleKey: 'k42Milestone100Notes', achieved: currentNotes >= 100, achievedAt: notes100Ms },
    { id: 'links-500', titleKey: 'k42Milestone500Links', achieved: currentLinks >= 500, achievedAt: links500Ms },
    { id: 'core-hubs-10', titleKey: 'k42Milestone10Hubs', achieved: currentHubs >= 10, achievedAt: hubs10Ms },
  ];
}

function buildRecentEvolution(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  snapshots: TimelineSnapshot[],
  now: number,
  recentDays: number,
  areaEvolution: AreaEvolutionRow[],
  historyEvents: readonly KnowledgeHistoryEvent[],
): RecentEvolutionSummary {
  const startMs = now - recentDays * 86_400_000;
  const nowSnapshot = snapshots[snapshots.length - 1];
  const pastBuckets = buildPeriodBuckets(notes, 'month', now);
  const pastBucket = pastBuckets.find(b => b.endMs >= startMs && b.startMs <= startMs);
  const pastSnapshot = pastBucket
    ? buildSnapshotMetrics(notesActiveAt(notes, pastBucket.startMs), service, 0, 'past', '')
    : null;

  const notesAdded = notes.filter(n => {
    if (n.deletedAt != null) return false;
    const c = noteEffectiveCreatedAt(n);
    return c >= startMs && c <= now;
  }).length;

  const linksAdded = nowSnapshot && pastSnapshot
    ? Math.max(0, nowSnapshot.linkCount - pastSnapshot.linkCount)
    : nowSnapshot?.linkCount ?? 0;

  const areas = areaEvolution;
  const fastestGrowingArea = areas.find(a => a.trend === 'growing')?.areaLabel ?? areas[0]?.areaLabel ?? null;

  const historyCounts = recentEvolutionFromHistory(
    startMs,
    now,
    historyEvents,
    notesAdded,
    linksAdded,
  );

  return {
    notesAdded: historyCounts.notesAdded,
    linksAdded: historyCounts.linksAdded,
    periodDays: recentDays,
    fastestGrowingArea,
  };
}

/** Build vault knowledge timeline from existing note metadata. */
export function buildKnowledgeTimeline(
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  discoveryFeed?: DiscoveryFeed,
  options: BuildKnowledgeTimelineOptions = {},
): KnowledgeTimeline {
  const mode = options.mode ?? 'month';
  const now = options.now ?? Date.now();
  const recentDays = options.recentDays ?? 30;
  const discoveriesOpen = discoveryFeed?.summary.totalCount ?? 0;
  const historyEvents = options.historyEvents ?? [];
  const usesEventHistory = hasRecordedHistory(historyEvents);

  const galaxyMap = getNoteGalaxyMap(
    notes.filter(n => !n.deletedAt),
    service,
    options.galaxyCacheKey,
  );

  const buckets = buildPeriodBuckets(notes, mode, now);
  const snapshots = buildSnapshots(notes, service, mode, now, discoveriesOpen, galaxyMap);
  const displaySnapshots = trimSnapshotsForDisplay(snapshots, mode === 'all' ? 1 : 8);
  const areaEvolution = buildAreaEvolution(notes, service, mode, now, galaxyMap);

  const estimatedDiscoveryHistory = buildDiscoveryHistory(notes, service, now, recentDays, galaxyMap);
  const windowStart = now - recentDays * 86_400_000;

  return {
    mode,
    periods: buckets,
    snapshots: displaySnapshots,
    growth: buildGrowthMetrics(notes, service, snapshots, buckets, discoveriesOpen, historyEvents),
    areaEvolution,
    milestones: buildMilestones(notes, service, snapshots, buckets, galaxyMap),
    discoveryHistory: discoveryHistoryFromEvents(
      windowStart,
      now,
      historyEvents,
      estimatedDiscoveryHistory,
    ),
    recentEvolution: buildRecentEvolution(
      notes,
      service,
      snapshots,
      now,
      recentDays,
      areaEvolution,
      historyEvents,
    ),
    usesEventHistory,
  };
}
