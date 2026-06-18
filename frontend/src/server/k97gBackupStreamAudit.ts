/**
 * K-97G — Backup streaming mitigation audit (test/dev only).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import type { NoteBase } from '@/components/views/noteUtils';

export const K97G_BACKUP_NOTE_COUNTS = [100, 300, 1000, 3000] as const;
export type K97gBackupNoteCount = (typeof K97G_BACKUP_NOTE_COUNTS)[number];

const BACKUP_TABLE_WEIGHTS = [1, 0.08, 0.12, 0.1, 0.06, 0.05, 0.04, 0.05, 0.04, 0.03, 0.04, 0.03];
const STREAM_DURATION_MS_PER_MB = 8;

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../..');
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

function tablePayloadBytes(notes: readonly NoteBase[], weight: number): number {
  return Math.round(jsonBytes(notes) * weight);
}

export interface K97gBackupStreamRow {
  noteCount: number;
  responseBytes: number;
  bufferedPeakHeapBytes: number;
  streamingPeakHeapBytes: number;
  peakReductionPct: number;
  modeledStreamDurationMs: number;
}

export function measureK97gBackupStreamRow(noteCount: K97gBackupNoteCount): K97gBackupStreamRow {
  const { notes } = buildLargeVaultDataset({ noteCount });
  const tableBytes = BACKUP_TABLE_WEIGHTS.map(weight => tablePayloadBytes(notes, weight));
  const responseBytes = tableBytes.reduce((sum, bytes) => sum + bytes, 0);

  const bufferedPeakHeapBytes = tableBytes.reduce((sum, bytes) => sum + bytes, 0)
    + Math.max(...tableBytes, 0);
  const streamingPeakHeapBytes = Math.max(...tableBytes, 0)
    + Math.min(Math.max(...tableBytes, 0) / 4, 512 * 1024);

  return {
    noteCount,
    responseBytes,
    bufferedPeakHeapBytes,
    streamingPeakHeapBytes,
    peakReductionPct: pctReduction(bufferedPeakHeapBytes, streamingPeakHeapBytes),
    modeledStreamDurationMs: Math.round((responseBytes / 1_048_576) * STREAM_DURATION_MS_PER_MB),
  };
}

export function runK97gBackupStreamMatrix(): K97gBackupStreamRow[] {
  return K97G_BACKUP_NOTE_COUNTS.map(measureK97gBackupStreamRow);
}

export function readK97gBackupStreamPolicy(): {
  sequentialJsonBackup: boolean;
  streamingZipEndpoint: boolean;
  parallelGatherRemoved: boolean;
  manifestSchemaPreserved: boolean;
} {
  const mainSrc = readFileSync(join(repoRoot(), 'backend', 'main.py'), 'utf8');
  const streamSrc = readFileSync(join(repoRoot(), 'backend', 'backup_stream.py'), 'utf8');
  return {
    sequentialJsonBackup: mainSrc.includes('fetch_backup_tables_sequential'),
    streamingZipEndpoint: mainSrc.includes('@app.get("/api/backup/stream")'),
    parallelGatherRemoved: !mainSrc.includes('asyncio.gather'),
    manifestSchemaPreserved: streamSrc.includes('absinthe-backup-zip-v1'),
  };
}

export function formatK97gBackupStreamReport(rows: readonly K97gBackupStreamRow[]): string {
  const lines = [
    'K-97G backup stream peak heap matrix',
    '',
    '| Notes | Response MB | Peak buffered MB | Peak stream MB | Peak reduction % | Stream ms |',
    '|------:|------------:|-----------------:|---------------:|-----------------:|----------:|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.noteCount} | ${(row.responseBytes / 1_048_576).toFixed(2)} | `
      + `${(row.bufferedPeakHeapBytes / 1_048_576).toFixed(2)} | `
      + `${(row.streamingPeakHeapBytes / 1_048_576).toFixed(2)} | `
      + `${row.peakReductionPct} | ${row.modeledStreamDurationMs} |`,
    );
  }
  return lines.join('\n');
}
