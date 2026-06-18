/**
 * K-97G — Incremental sync mitigation audit (test/dev only).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import type { NoteBase } from '@/components/views/noteUtils';
import { filterNotesIncremental, type DbNoteRow } from '@/server/k97gNotesSyncLogic';

export const K97G_NOTE_COUNTS = [100, 300, 1000, 3000] as const;
export type K97gNoteCount = (typeof K97G_NOTE_COUNTS)[number];

const CHANGE_RATIO = 0.04;
const HEAP_MULTIPLIER = 2.2;

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../..');
}

function backendPath(...parts: string[]): string {
  return join(repoRoot(), 'backend', ...parts);
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

function mapDbNote(note: NoteBase): DbNoteRow {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    updated_at: note.updatedAt,
    folder_id: note.folderId,
    deleted_at: note.deletedAt,
    starred: note.starred ?? false,
    properties: note.properties ?? null,
    user_id: 'audit-user',
  };
}

export interface K97gIncrementalSyncRow {
  noteCount: number;
  fullPayloadBytes: number;
  incrementalPayloadBytes: number;
  estimatedFullHeapBytes: number;
  estimatedIncrementalHeapBytes: number;
  reductionPct: number;
  changedNoteCount: number;
}

export function measureK97gIncrementalSyncRow(noteCount: K97gNoteCount): K97gIncrementalSyncRow {
  const { notes } = buildLargeVaultDataset({ noteCount });
  const active = notes.filter(n => !n.deletedAt);
  const baseTime = Date.now() - 3_600_000;
  const fullPayload = active.map((note, index) => mapDbNote({
    ...note,
    updatedAt: baseTime + index * 1000,
  }));
  const watermark = baseTime + Math.floor(fullPayload.length * (1 - CHANGE_RATIO)) * 1000;
  const incrementalPayload = filterNotesIncremental(fullPayload, watermark);

  const fullPayloadBytes = jsonBytes(fullPayload);
  const incrementalPayloadBytes = jsonBytes(incrementalPayload);

  return {
    noteCount,
    fullPayloadBytes,
    incrementalPayloadBytes,
    estimatedFullHeapBytes: Math.round(fullPayloadBytes * HEAP_MULTIPLIER),
    estimatedIncrementalHeapBytes: Math.round(incrementalPayloadBytes * HEAP_MULTIPLIER),
    reductionPct: pctReduction(fullPayloadBytes, incrementalPayloadBytes),
    changedNoteCount: incrementalPayload.length,
  };
}

export function runK97gIncrementalSyncMatrix(): K97gIncrementalSyncRow[] {
  return K97G_NOTE_COUNTS.map(measureK97gIncrementalSyncRow);
}

export function readK97gIncrementalSyncPolicy(): {
  updatedAfterParam: boolean;
  backwardCompatibleFullSync: boolean;
  batchEndpointPresent: boolean;
  deletedNotesIncluded: boolean;
} {
  const mainSrc = readFileSync(backendPath('main.py'), 'utf8');
  const notesSrc = readFileSync(backendPath('notes_sync.py'), 'utf8');
  return {
    updatedAfterParam: mainSrc.includes('updated_after: int | None = Query'),
    backwardCompatibleFullSync: mainSrc.includes('if updated_after is not None'),
    batchEndpointPresent: mainSrc.includes('@app.post("/api/notes/batch")'),
    deletedNotesIncluded: notesSrc.includes('deleted_at'),
  };
}

export function formatK97gIncrementalSyncReport(rows: readonly K97gIncrementalSyncRow[]): string {
  const lines = [
    'K-97G incremental sync payload matrix',
    '',
    '| Notes | Full KB | Incremental KB | Heap full MB | Heap incr MB | Reduction % | Changed |',
    '|------:|--------:|---------------:|-------------:|-------------:|------------:|--------:|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.noteCount} | ${(row.fullPayloadBytes / 1024).toFixed(1)} | `
      + `${(row.incrementalPayloadBytes / 1024).toFixed(1)} | `
      + `${(row.estimatedFullHeapBytes / 1_048_576).toFixed(2)} | `
      + `${(row.estimatedIncrementalHeapBytes / 1_048_576).toFixed(2)} | `
      + `${row.reductionPct} | ${row.changedNoteCount} |`,
    );
  }
  return lines.join('\n');
}
