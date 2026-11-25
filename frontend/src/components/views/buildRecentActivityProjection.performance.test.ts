import { describe, expect, it, vi } from 'vitest';
import { displayNoteTitleForLocale } from './noteDisplayTitle';
import {
  buildRecentActivityProjection,
  RECENT_ACTIVITY_BUCKETS,
  type RecentActivityGroup,
  type RecentActivityItem,
  type RecentActivityProjection,
  type RecentActivityProjectionInput,
} from './buildRecentActivityProjection';
import type { NoteBase } from './noteUtils';
import { classifyRecentActivityBucket, formatActivityTimestamp } from './k102DateFormat';
import { toDateKey } from './features/knowledge/databaseViews/parseDatabaseDate';

const now = new Date(2026, 10, 14, 12);
const labels = { today: 'Today', yesterday: 'Yesterday', daysAgo: (days: number) => `${days}d ago` };

type WorkCounts = {
  identityComparisons: number;
  candidateBuilds: number;
  admitted: number;
  titleFormats: number;
  relativeFormats: number;
};

function workCounts(): WorkCounts {
  return { identityComparisons: 0, candidateBuilds: 0, admitted: 0, titleFormats: 0, relativeFormats: 0 };
}

function makeNotes(size: number, uniqueCount: number, counts?: WorkCounts): NoteBase[] {
  return Array.from({ length: size }, (_, index) => {
    const uniqueIndex = index % uniqueCount;
    const record: Record<string, unknown> = {
      id: `perf-${uniqueIndex}`,
      body: '',
      updatedAt: now.getTime() - (uniqueIndex + 1) * 1_000,
      folderId: null,
      deletedAt: null,
    };
    if (counts) {
      Object.defineProperty(record, 'title', {
        enumerable: true,
        get() {
          counts.titleFormats += 1;
          return `Title from input ${index}`;
        },
      });
    } else {
      record.title = `Title from input ${index}`;
    }
    return record as NoteBase;
  });
}

function makeInput(size: number, uniqueCount: number, counts?: WorkCounts): RecentActivityProjectionInput {
  const measuredLabels = counts ? {
    get today() {
      counts.relativeFormats += 1;
      return 'Today';
    },
    yesterday: 'Yesterday',
    daysAgo: (days: number) => {
      counts.relativeFormats += 1;
      return `${days}d ago`;
    },
  } : labels;
  return {
    notes: makeNotes(size, uniqueCount, counts),
    plannerRecents: [],
    recipeRecents: [],
    archiveRestoreRecents: [],
    labels: measuredLabels,
    locale: 'en',
    now,
  };
}

/** Test-only snapshot of the pre-optimization Notes path, retaining array-scan deduplication. */
function buildLegacyNotesProjection(
  input: RecentActivityProjectionInput,
  counts?: WorkCounts,
): RecentActivityProjection {
  const todayKey = toDateKey(input.now ?? new Date());
  const locale = input.locale;
  const groups: RecentActivityGroup[] = RECENT_ACTIVITY_BUCKETS.map(bucket => ({ bucket, items: [] }));
  const relative = (timestamp: number) => formatActivityTimestamp(timestamp, todayKey, locale, input.labels);

  for (const note of input.notes) {
    if (note.deletedAt) continue;
    const timestamp = Math.max(note.lastOpenedAt ?? 0, note.updatedAt ?? 0);
    if (!timestamp) continue;
    const bucket = classifyRecentActivityBucket(timestamp, todayKey);
    const kind = note.updatedAt && note.updatedAt >= (note.lastOpenedAt ?? 0) ? 'edited' : 'opened';
    const item: RecentActivityItem = {
      id: `notes:${note.id}:${kind}`,
      domain: 'notes',
      kind,
      title: displayNoteTitleForLocale(note.title, locale ?? undefined),
      timestamp,
      relativeLabel: relative(timestamp),
      noteId: note.id,
    };
    if (counts) counts.candidateBuilds += 1;
    const group = groups.find(candidate => candidate.bucket === bucket);
    if (!group) continue;
    const duplicate = group.items.some(existing => {
      if (counts) counts.identityComparisons += 1;
      return existing.domain === item.domain && existing.id === item.id;
    });
    if (duplicate) continue;
    group.items.push(item);
    if (counts) counts.admitted += 1;
  }

  const limit = Math.max(0, input.limitPerBucket ?? 6);
  for (const group of groups) {
    group.items = group.items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => b.item.timestamp - a.item.timestamp || a.index - b.index)
      .slice(0, limit)
      .map(({ item }) => item);
  }
  return { groups, isEmpty: groups.every(group => group.items.length === 0), generatedAt: (input.now ?? new Date()).toISOString() };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function elapsed(run: () => unknown): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

describe('recent activity projection work comparison', () => {
  it.each([250, 1_000, 3_000])('matches the legacy output and reports bounded work for %i Notes', size => {
    for (const uniqueCount of [size, size / 2]) {
      const legacyCounts = workCounts();
      const actualCounts = workCounts();
      const expected = buildLegacyNotesProjection(makeInput(size, uniqueCount, legacyCounts), legacyCounts);

      const hasSpy = vi.spyOn(Set.prototype, 'has');
      const addSpy = vi.spyOn(Set.prototype, 'add');
      let actual: RecentActivityProjection;
      let optimizedSetLookups = 0;
      let optimizedAdmissions = 0;
      try {
        actual = buildRecentActivityProjection(makeInput(size, uniqueCount, actualCounts));
        optimizedSetLookups = hasSpy.mock.calls.filter(([value]) => typeof value === 'string' && value.startsWith('notes:perf-')).length;
        optimizedAdmissions = addSpy.mock.calls.filter(([value]) => typeof value === 'string' && value.startsWith('notes:perf-')).length;
      } finally {
        hasSpy.mockRestore();
        addSpy.mockRestore();
      }

      expect(actual!).toEqual(expected);
      expect(legacyCounts.candidateBuilds).toBe(size);
      expect(legacyCounts.admitted).toBe(uniqueCount);
      expect(legacyCounts.titleFormats).toBe(size);
      expect(legacyCounts.relativeFormats).toBe(size);
      expect(actualCounts.titleFormats).toBe(uniqueCount);
      expect(actualCounts.relativeFormats).toBe(uniqueCount);
      expect(optimizedSetLookups).toBe(size);
      expect(optimizedAdmissions).toBe(uniqueCount);
      expect(legacyCounts.identityComparisons).toBeGreaterThan(optimizedSetLookups * 10);

      const input = makeInput(size, uniqueCount);
      // Warm both paths once, then collect repeated same-fixture samples. Timings are evidence only;
      // assertions rely on deterministic operation counts rather than machine-dependent thresholds.
      buildLegacyNotesProjection(input);
      buildRecentActivityProjection(input);
      const legacySamples: number[] = [];
      const optimizedSamples: number[] = [];
      for (let sample = 0; sample < 5; sample += 1) {
        legacySamples.push(elapsed(() => buildLegacyNotesProjection(input)));
        optimizedSamples.push(elapsed(() => buildRecentActivityProjection(input)));
      }

      console.info('RECENT_ACTIVITY_WORK', JSON.stringify({
        notes: size,
        uniqueIdentities: uniqueCount,
        legacy: {
          duplicateComparisons: legacyCounts.identityComparisons,
          candidatesFormatted: legacyCounts.candidateBuilds,
          titleFormats: legacyCounts.titleFormats,
          relativeFormats: legacyCounts.relativeFormats,
          medianMs: Number(median(legacySamples).toFixed(3)),
        },
        indexed: {
          identityLookups: optimizedSetLookups,
          candidatesFormatted: actualCounts.titleFormats,
          titleFormats: actualCounts.titleFormats,
          relativeFormats: actualCounts.relativeFormats,
          medianMs: Number(median(optimizedSamples).toFixed(3)),
        },
        timingSamples: 5,
      }));
    }
  }, 30_000);
});
