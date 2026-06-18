/**
 * K-95B — Link context paragraph offset index audit (test/dev only).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import type { NoteBase } from '@/components/views/noteUtils';
import { noteReferencesTitle } from '@/components/views/noteUtils';
import {
  clearLinkContextOffsetIndex,
  extractLinkContexts,
  extractLinkContextsLegacy,
  getCachedParagraphOffsets,
} from '@/components/views/features/knowledge/linkContext/linkContextOffsetIndex';

export const K95B_NOTE_COUNTS = [100, 300, 1000] as const;
export type K95bNoteCount = (typeof K95B_NOTE_COUNTS)[number];

export interface K95bLinkContextScanMetrics {
  noteCount: number;
  targetTitle: string;
  notesScanned: number;
  matchingNotes: number;
  referenceCheckBytes: number;
  paragraphSplits: number;
  paragraphSplitBytes: number;
  offsetLookups: number;
  excerptSliceBytes: number;
  excerptCount: number;
  resultBytes: number;
  scanMs: number;
}

export interface K95bBenchmarkRow {
  noteCount: K95bNoteCount;
  legacy: K95bLinkContextScanMetrics;
  offset: K95bLinkContextScanMetrics;
  paragraphSplitReductionPct: number;
  paragraphByteReductionPct: number;
  scanTimeReductionPct: number;
}

function viewsRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function stringBytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function jsonBytes(value: unknown): number {
  return stringBytes(JSON.stringify(value));
}

function pctReduction(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.round(((before - after) / before) * 1000) / 10;
}

function pickTargetTitle(notes: readonly NoteBase[]): string {
  const linked = notes.find(n => !n.deletedAt && (n.body ?? '').includes('[['));
  if (linked) {
    const match = (linked.body ?? '').match(/\[\[(.+?)\]\]/);
    if (match?.[1]) return match[1];
  }
  return notes.find(n => !n.deletedAt)?.title ?? 'Reference 1';
}

function buildFixture(noteCount: number): { notes: NoteBase[]; targetTitle: string } {
  const dataset = buildLargeVaultDataset({ noteCount });
  return { notes: dataset.notes, targetTitle: pickTargetTitle(dataset.notes) };
}

export function measureLegacyLinkContextScan(
  targetTitle: string,
  notes: readonly NoteBase[],
): K95bLinkContextScanMetrics {
  const start = performance.now();
  let notesScanned = 0;
  let matchingNotes = 0;
  let referenceCheckBytes = 0;
  let paragraphSplits = 0;
  let paragraphSplitBytes = 0;
  let excerptSliceBytes = 0;

  for (const note of notes) {
    if (note.deletedAt) continue;
    notesScanned += 1;
    const body = note.body ?? '';
    referenceCheckBytes += stringBytes(body);
    if (!noteReferencesTitle(body, targetTitle)) continue;
    matchingNotes += 1;
    paragraphSplits += 1;
    paragraphSplitBytes += stringBytes(body);
    const paragraphs = body.split(/\n{2,}/);
    excerptSliceBytes += paragraphs.reduce((sum, p) => sum + stringBytes(p), 0);
    if (paragraphs.filter(p =>
      p.includes('[['),
    ).length === 0) {
      const lines = body.split('\n');
      excerptSliceBytes += lines.reduce((sum, line) => sum + stringBytes(line), 0);
    }
  }

  const result = extractLinkContextsLegacy(targetTitle, notes);
  const scanMs = performance.now() - start;

  return {
    noteCount: notes.filter(n => !n.deletedAt).length,
    targetTitle,
    notesScanned,
    matchingNotes,
    referenceCheckBytes,
    paragraphSplits,
    paragraphSplitBytes,
    offsetLookups: 0,
    excerptSliceBytes,
    excerptCount: result.reduce((sum, row) => sum + row.excerpts.length, 0),
    resultBytes: jsonBytes(result),
    scanMs: Math.round(scanMs * 100) / 100,
  };
}

export function measureOffsetLinkContextScan(
  targetTitle: string,
  notes: readonly NoteBase[],
  contentVersion = 0,
): K95bLinkContextScanMetrics {
  clearLinkContextOffsetIndex();
  const start = performance.now();
  let notesScanned = 0;
  let matchingNotes = 0;
  let referenceCheckBytes = 0;
  let offsetLookups = 0;
  let excerptSliceBytes = 0;

  for (const note of notes) {
    if (note.deletedAt) continue;
    notesScanned += 1;
    const body = note.body ?? '';
    referenceCheckBytes += stringBytes(body);
    if (!noteReferencesTitle(body, targetTitle)) continue;
    matchingNotes += 1;
    offsetLookups += 1;
    const offsets = getCachedParagraphOffsets(note.id, body);
    for (const { start: s, end: e } of offsets) {
      const slice = body.slice(s, e);
      if (!slice.includes('[[')) continue;
      excerptSliceBytes += stringBytes(slice);
    }
  }

  const result = extractLinkContexts(targetTitle, notes, { contentVersion });
  const scanMs = performance.now() - start;

  return {
    noteCount: notes.filter(n => !n.deletedAt).length,
    targetTitle,
    notesScanned,
    matchingNotes,
    referenceCheckBytes,
    paragraphSplits: 0,
    paragraphSplitBytes: 0,
    offsetLookups,
    excerptSliceBytes,
    excerptCount: result.reduce((sum, row) => sum + row.excerpts.length, 0),
    resultBytes: jsonBytes(result),
    scanMs: Math.round(scanMs * 100) / 100,
  };
}

export function runK95bBenchmarkRow(noteCount: K95bNoteCount): K95bBenchmarkRow {
  const { notes, targetTitle } = buildFixture(noteCount);
  const legacy = measureLegacyLinkContextScan(targetTitle, notes);
  const offset = measureOffsetLinkContextScan(targetTitle, notes, 1);
  return {
    noteCount,
    legacy,
    offset,
    paragraphSplitReductionPct: pctReduction(legacy.paragraphSplits, offset.paragraphSplits),
    paragraphByteReductionPct: pctReduction(legacy.paragraphSplitBytes, Math.max(offset.excerptSliceBytes, 1)),
    scanTimeReductionPct: pctReduction(legacy.scanMs, Math.max(offset.scanMs, 0.01)),
  };
}

export function readK95bPolicySnapshot(): {
  offsetModulePresent: boolean;
  noteViewPassesContentVersion: boolean;
  noteUtilsDelegatesToOffsetIndex: boolean;
} {
  const offsetSrc = readFileSync(
    join(viewsRoot(), 'features', 'knowledge', 'linkContext', 'linkContextOffsetIndex.ts'),
    'utf8',
  );
  const noteViewSrc = readFileSync(join(viewsRoot(), 'NoteView.tsx'), 'utf8');
  const noteUtilsSrc = readFileSync(join(viewsRoot(), 'noteUtils.ts'), 'utf8');

  return {
    offsetModulePresent: offsetSrc.includes('ParagraphOffsetIndex'),
    noteViewPassesContentVersion: noteViewSrc.includes('contentVersion: indexContentVersion'),
    noteUtilsDelegatesToOffsetIndex: noteUtilsSrc.includes('linkContext/linkContextOffsetIndex'),
  };
}

export function outputsMatchLegacy(
  notes: readonly NoteBase[],
  targetTitle: string,
): boolean {
  clearLinkContextOffsetIndex();
  const legacy = extractLinkContextsLegacy(targetTitle, notes);
  const next = extractLinkContexts(targetTitle, notes, { contentVersion: 1 });
  return JSON.stringify(legacy) === JSON.stringify(next);
}
