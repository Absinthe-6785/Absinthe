/**
 * K-97G — Batch note sync mitigation audit (test/dev only).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import { noteSyncPayload } from '@/components/views/noteUtils';
import {
  BATCH_CHUNK_SIZES,
  chunkNotePayloads,
  estimateBatchRequestCount,
  estimateSingleRequestCount,
} from '@/server/k97gNotesSyncLogic';

export const K97G_BATCH_NOTE_COUNTS = [100, 300, 1000, 3000] as const;
export type K97gBatchNoteCount = (typeof K97G_BATCH_NOTE_COUNTS)[number];

const HEAP_PER_REQUEST_BYTES = 48 * 1024;

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

export interface K97gBatchSyncChunkRow {
  chunkSize: number;
  requestCount: number;
  payloadBytes: number;
  estimatedHeapBytes: number;
  requestReductionPct: number;
}

export interface K97gBatchSyncRow {
  noteCount: number;
  singleRequestCount: number;
  singlePayloadBytes: number;
  singleHeapBytes: number;
  chunks: K97gBatchSyncChunkRow[];
}

export function measureK97gBatchSyncRow(noteCount: K97gBatchNoteCount): K97gBatchSyncRow {
  const { notes } = buildLargeVaultDataset({ noteCount });
  const payloads = notes.filter(n => !n.deletedAt).map(note => noteSyncPayload(note));
  const singleRequestCount = estimateSingleRequestCount(payloads.length);
  const singlePayloadBytes = payloads.reduce((sum, row) => sum + jsonBytes(row), 0);
  const singleHeapBytes = singleRequestCount * HEAP_PER_REQUEST_BYTES + singlePayloadBytes;

  const chunks: K97gBatchSyncChunkRow[] = BATCH_CHUNK_SIZES.map(chunkSize => {
    const groups = chunkNotePayloads(payloads, chunkSize);
    const payloadBytes = groups.reduce((sum, group) => sum + jsonBytes(group), 0);
    const requestCount = estimateBatchRequestCount(payloads.length, chunkSize);
    return {
      chunkSize,
      requestCount,
      payloadBytes,
      estimatedHeapBytes: requestCount * HEAP_PER_REQUEST_BYTES + Math.max(...groups.map(g => jsonBytes(g)), 0),
      requestReductionPct: pctReduction(singleRequestCount, requestCount),
    };
  });

  return {
    noteCount,
    singleRequestCount,
    singlePayloadBytes,
    singleHeapBytes,
    chunks,
  };
}

export function runK97gBatchSyncMatrix(): K97gBatchSyncRow[] {
  return K97G_BATCH_NOTE_COUNTS.map(measureK97gBatchSyncRow);
}

export function readK97gBatchSyncPolicy(): {
  batchEndpointPresent: boolean;
  singlePostPreserved: boolean;
  configurableChunkSize: boolean;
  defaultChunkSize50: boolean;
} {
  const mainSrc = readFileSync(join(repoRoot(), 'backend', 'main.py'), 'utf8');
  const notesSrc = readFileSync(join(repoRoot(), 'backend', 'notes_sync.py'), 'utf8');
  return {
    batchEndpointPresent: mainSrc.includes('@app.post("/api/notes/batch")'),
    singlePostPreserved: mainSrc.includes('@app.post("/api/notes")'),
    configurableChunkSize: mainSrc.includes('chunk_size: int = Query'),
    defaultChunkSize50: notesSrc.includes('DEFAULT_BATCH_CHUNK_SIZE = 50'),
  };
}

export function formatK97gBatchSyncReport(rows: readonly K97gBatchSyncRow[]): string {
  const lines = ['K-97G batch sync request matrix', ''];
  for (const row of rows) {
    lines.push(
      `${row.noteCount} notes — single POST×${row.singleRequestCount} `
      + `(${(row.singlePayloadBytes / 1024).toFixed(1)} KB)`,
    );
    for (const chunk of row.chunks) {
      lines.push(
        `  chunk ${chunk.chunkSize}: ${chunk.requestCount} requests `
        + `(↓${chunk.requestReductionPct}% requests, heap ~${(chunk.estimatedHeapBytes / 1024).toFixed(1)} KB)`,
      );
    }
  }
  return lines.join('\n');
}
