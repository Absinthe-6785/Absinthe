/**
 * K-89 — Large vault benchmark helpers (shared by audit test and docs).
 */
import { buildLargeVaultDataset } from './realisticUsageFixture';
import { measureMs } from '@/components/views/editorBenchmark';
import { KnowledgeIndexService } from '@/components/views/features/knowledge/KnowledgeIndexService';
import { buildDiscoveryFeed } from '@/components/views/features/knowledge/discovery/discoveryEngine';
import { buildVaultHealthMetrics } from '@/components/views/features/knowledge/health/vaultHealthMetrics';
import { groupRelatedNotes } from '@/components/views/features/knowledge/related/groupRelatedNotes';
import { buildGlobalGraphData } from '@/components/views/features/knowledge/graph/buildGlobalGraphData';
import { buildWorkspaceSearch } from '@/components/views/features/knowledge/workspace/buildWorkspaceSearch';
import { noteSearchScore } from '@/lib/math/noteSearch';
import type { NoteBase } from '@/components/views/noteUtils';

export interface LargeVaultMetricsRow {
  noteCount: number;
  estimatedBytes: number;
  indexBuildMs: number;
  workspaceSearchMs: number;
  relatedNotesMs: number;
  discoveryFeedMs: number;
  globalGraphMs: number;
  vaultHealthMs: number;
  sidebarSortMs: number;
  plainTextFilterMs: number;
}

function simulateSidebarSort(notes: readonly NoteBase[]): void {
  const list = notes.filter(n => !n.deletedAt);
  list.sort((a, b) => b.updatedAt - a.updatedAt);
}

function simulatePlainTextSidebarFilter(notes: readonly NoteBase[], query: string): NoteBase[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...notes];
  return notes.filter(n => {
    const score = noteSearchScore(n, q);
    return score != null && score > 0;
  });
}

export function measureVaultAtScale(noteCount: number): LargeVaultMetricsRow {
  const dataset = buildLargeVaultDataset({ noteCount });
  const service = new KnowledgeIndexService();

  const indexBuildMs = measureMs(() => {
    service.buildFromNotes(dataset.notes);
  });

  const workspaceSearchMs = measureMs(() => {
    buildWorkspaceSearch('Japanese', dataset.notes, [], { service });
  });

  const sampleNote = dataset.notes[Math.floor(noteCount / 2)]!;
  const relatedNotesMs = measureMs(() => {
    groupRelatedNotes(sampleNote.id, dataset.notes, service);
  });

  const discoveryFeedMs = measureMs(() => {
    buildDiscoveryFeed(dataset.notes, service, { perSectionLimit: 4 });
  });

  const globalGraphMs = measureMs(() => {
    buildGlobalGraphData({ service });
  });

  const vaultHealthMs = measureMs(() => {
    buildVaultHealthMetrics(dataset.notes, service);
  });

  const sidebarSortMs = measureMs(() => {
    simulateSidebarSort(dataset.notes);
  });

  const plainTextFilterMs = measureMs(() => {
    simulatePlainTextSidebarFilter(dataset.notes, 'grammar');
  });

  return {
    noteCount,
    estimatedBytes: dataset.stats.estimatedVaultBytes ?? 0,
    indexBuildMs,
    workspaceSearchMs,
    relatedNotesMs,
    discoveryFeedMs,
    globalGraphMs,
    vaultHealthMs,
    sidebarSortMs,
    plainTextFilterMs,
  };
}

export const LARGE_VAULT_SCALES = [250, 500, 1000, 3000] as const;

export function runLargeVaultBenchmark(
  scales: readonly number[] = LARGE_VAULT_SCALES,
): LargeVaultMetricsRow[] {
  return scales.map(measureVaultAtScale);
}
