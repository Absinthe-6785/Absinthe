/**
 * K-97F — Render server memory & payload audit (test/dev only).
 *
 * Models FastAPI backend memory pressure (512 MB Render limit) from vault-scale
 * payloads and client-side sync/export buffers. No production instrumentation yet.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import type { NoteBase } from '@/components/views/noteUtils';
import { noteSyncPayload } from '@/components/views/noteUtils';
import { buildVaultBackupManifest } from '@/lib/exportVaultBackup';
import { MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES } from '@/components/views/features/knowledge/linkContext/linkContextOffsetIndex';

export const K97F_NOTE_COUNTS = [100, 300, 1000, 3000] as const;
export type K97fNoteCount = (typeof K97F_NOTE_COUNTS)[number];

export type K97fServerOperation =
  | 'note-sync'
  | 'export'
  | 'snapshot-generation'
  | 'login-hydration'
  | 'cloud-merge'
  | 'large-note-update';

export interface K97fMemorySample {
  rss: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export interface K97fOperationMemoryRow {
  operation: K97fServerOperation;
  noteCount: number;
  before: K97fMemorySample;
  after: K97fMemorySample;
  deltaHeapBytes: number;
  deltaRssBytes: number;
  payloadBytes: number;
}

export interface K97fPayloadSizeRow {
  noteCount: number;
  notesGetBytes: number;
  syncSingleNoteBytes: number;
  syncFullVaultBytes: number;
  exportZipEstimateBytes: number;
  snapshotPayloadBytes: number;
  duplicateSerializationBytes: number;
}

export interface K97fCacheAuditRow {
  cacheId: string;
  bounded: boolean;
  maxEntries: number | null;
  retainedAfterRequest: boolean;
  growthRisk: 'low' | 'medium' | 'high';
  summary: string;
}

export interface K97fIncrementalSyncAnalysis {
  currentPattern: string;
  candidatePattern: string;
  fullVaultGetBytesAt1000: number;
  estimatedIncrementalBytesAt1000: number;
  estimatedMemorySavingsPct: number;
  implementationStatus: 'documented-only';
}

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../..');
}

function backendMainPath(): string {
  return join(repoRoot(), 'backend', 'main.py');
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

export function sampleProcessMemory(): K97fMemorySample {
  const usage = process.memoryUsage();
  return {
    rss: usage.rss,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers ?? 0,
  };
}

function mapDbNoteShape(note: NoteBase): Record<string, unknown> {
  return {
    id: note.id,
    user_id: 'audit-user',
    title: note.title,
    body: note.body,
    updated_at: note.updatedAt,
    folder_id: note.folderId,
    deleted_at: note.deletedAt,
    starred: note.starred ?? false,
    properties: note.properties ?? null,
  };
}

function buildNotesGetPayload(notes: readonly NoteBase[]): unknown[] {
  return notes.filter(n => !n.deletedAt).map(mapDbNoteShape);
}

function buildHydrationPayload(notes: readonly NoteBase[]): {
  notesBytes: number;
  foldersBytes: number;
  totalBytes: number;
} {
  const notesPayload = buildNotesGetPayload(notes);
  const foldersPayload = [{ id: 'f1', name: 'Study', created_at: Date.now(), user_id: 'audit-user' }];
  const notesBytes = jsonBytes(notesPayload);
  const foldersBytes = jsonBytes(foldersPayload);
  return { notesBytes, foldersBytes, totalBytes: notesBytes + foldersBytes };
}

function simulateOperationBuffer(operation: K97fServerOperation, notes: readonly NoteBase[]): number {
  const active = notes.filter(n => !n.deletedAt);
  switch (operation) {
    case 'note-sync':
      return jsonBytes(noteSyncPayload(active[0] ?? notes[0]!));
    case 'export': {
      const manifest = buildVaultBackupManifest(active, []);
      return jsonBytes(manifest);
    }
    case 'snapshot-generation':
      return jsonBytes({ notes: active, folders: [], exportedAt: Date.now() });
    case 'login-hydration':
      return buildHydrationPayload(active).totalBytes;
    case 'cloud-merge':
      return buildHydrationPayload(active).totalBytes * 2;
    case 'large-note-update': {
      const big = active[0];
      if (!big) return 0;
      const patched = { ...big, body: `${big.body}\n${'x'.repeat(32_000)}` };
      return jsonBytes(noteSyncPayload(patched)) * 2;
    }
    default:
      return 0;
  }
}

export function measureK97fPayloadSizeRow(noteCount: K97fNoteCount): K97fPayloadSizeRow {
  const { notes } = buildLargeVaultDataset({ noteCount });
  const active = notes.filter(n => !n.deletedAt);
  const notesGetPayload = buildNotesGetPayload(active);
  const notesGetBytes = jsonBytes(notesGetPayload);
  const syncSingleNoteBytes = jsonBytes(noteSyncPayload(active[0]!));
  const syncFullVaultBytes = active.reduce((sum, n) => sum + jsonBytes(noteSyncPayload(n)), 0);
  const exportManifest = buildVaultBackupManifest(active, []);
  const exportZipEstimateBytes = Math.round(jsonBytes(exportManifest) * 1.12);
  const snapshotPayloadBytes = jsonBytes({ notes: active, folders: [] });
  const duplicateSerializationBytes = notesGetBytes + syncFullVaultBytes - syncSingleNoteBytes;

  return {
    noteCount,
    notesGetBytes,
    syncSingleNoteBytes,
    syncFullVaultBytes,
    exportZipEstimateBytes,
    snapshotPayloadBytes,
    duplicateSerializationBytes,
  };
}

export function runK97fPayloadSizeMatrix(): K97fPayloadSizeRow[] {
  return K97F_NOTE_COUNTS.map(measureK97fPayloadSizeRow);
}

export function measureK97fOperationMemory(
  operation: K97fServerOperation,
  noteCount: K97fNoteCount,
): K97fOperationMemoryRow {
  const { notes } = buildLargeVaultDataset({ noteCount });
  const before = sampleProcessMemory();
  const payloadBytes = simulateOperationBuffer(operation, notes);
  const serialized = JSON.stringify(buildNotesGetPayload(notes.filter(n => !n.deletedAt)));
  void serialized;
  const after = sampleProcessMemory();

  return {
    operation,
    noteCount,
    before,
    after,
    deltaHeapBytes: Math.max(0, after.heapUsed - before.heapUsed),
    deltaRssBytes: Math.max(0, after.rss - before.rss),
    payloadBytes,
  };
}

export function runK97fOperationMemoryMatrix(
  noteCount: K97fNoteCount = 1000,
): K97fOperationMemoryRow[] {
  const ops: K97fServerOperation[] = [
    'note-sync',
    'export',
    'snapshot-generation',
    'login-hydration',
    'cloud-merge',
    'large-note-update',
  ];
  return ops.map(operation => measureK97fOperationMemory(operation, noteCount));
}

export function listK97fCacheAuditRows(): K97fCacheAuditRow[] {
  return [
    {
      cacheId: 'pendingBodySync',
      bounded: true,
      maxEntries: null,
      retainedAfterRequest: true,
      growthRisk: 'medium',
      summary: 'Debounced body sync Map in useNotesStore — cleared on flush; scales with concurrent edits',
    },
    {
      cacheId: 'bodySyncTimers',
      bounded: true,
      maxEntries: null,
      retainedAfterRequest: false,
      growthRisk: 'low',
      summary: 'Per-note setTimeout handles — cleared on flush/unmount',
    },
    {
      cacheId: 'notesCache',
      bounded: true,
      maxEntries: 1,
      retainedAfterRequest: true,
      growthRisk: 'low',
      summary: 'Single vault snapshot in notePersistence — one array reference',
    },
    {
      cacheId: 'paragraphOffsetCache',
      bounded: true,
      maxEntries: MAX_PARAGRAPH_OFFSET_CACHE_ENTRIES,
      retainedAfterRequest: true,
      growthRisk: 'low',
      summary: 'LRU paragraph offsets (K-95E) — bounded across link-context sessions',
    },
    {
      cacheId: 'galaxyMapCache',
      bounded: true,
      maxEntries: 1,
      retainedAfterRequest: true,
      growthRisk: 'low',
      summary: 'Single memoized galaxy map — invalidateNoteGalaxyMapCache on structure change',
    },
    {
      cacheId: 'exportResponseBuffer',
      bounded: false,
      maxEntries: null,
      retainedAfterRequest: false,
      growthRisk: 'high',
      summary: 'GET /api/backup materializes all tables in memory before response — OOM candidate at scale',
    },
    {
      cacheId: 'hydrateNotesResponse',
      bounded: false,
      maxEntries: null,
      retainedAfterRequest: false,
      growthRisk: 'high',
      summary: 'GET /api/notes returns full vault JSON — primary Render memory spike on login',
    },
  ];
}

export function analyzeK97fIncrementalSync(): K97fIncrementalSyncAnalysis {
  const row = measureK97fPayloadSizeRow(1000);
  const avgNoteBytes = Math.round(row.notesGetBytes / 1000);
  const estimatedIncrementalBytes = avgNoteBytes * 12;
  return {
    currentPattern: 'GET /api/notes → entire vault (no updated_after filter)',
    candidatePattern: 'GET /api/notes?updated_after=<ts> → delta since last sync',
    fullVaultGetBytesAt1000: row.notesGetBytes,
    estimatedIncrementalBytesAt1000: estimatedIncrementalBytes,
    estimatedMemorySavingsPct: pctReduction(row.notesGetBytes, estimatedIncrementalBytes),
    implementationStatus: 'documented-only',
  };
}

export interface K97fOomCandidate {
  rank: number;
  route: string;
  trigger: string;
  estimatedBytesAt3000: number;
  severity: 'critical' | 'high' | 'medium';
}

export function rankK97fOomCandidates(): K97fOomCandidate[] {
  const row3k = measureK97fPayloadSizeRow(3000);
  const candidates: Omit<K97fOomCandidate, 'rank'>[] = [
    {
      route: 'GET /api/backup',
      trigger: 'Full export — 12 tables + notes bodies in one JSON response',
      estimatedBytesAt3000: row3k.exportZipEstimateBytes * 1.4,
      severity: 'critical',
    },
    {
      route: 'GET /api/notes',
      trigger: 'Login hydration — entire vault deserialized server-side and client-side',
      estimatedBytesAt3000: row3k.notesGetBytes,
      severity: 'critical',
    },
    {
      route: 'POST /api/notes (burst)',
      trigger: 'Cloud merge uploads local-only notes in parallel after hydration',
      estimatedBytesAt3000: row3k.syncFullVaultBytes,
      severity: 'high',
    },
    {
      route: 'Client export ZIP',
      trigger: 'buildVaultBackupManifest + JSON.stringify duplicate pass',
      estimatedBytesAt3000: row3k.exportZipEstimateBytes,
      severity: 'high',
    },
    {
      route: 'Snapshot auto-save',
      trigger: 'Periodic vault snapshot serializes full notes[] to storage',
      estimatedBytesAt3000: row3k.snapshotPayloadBytes,
      severity: 'medium',
    },
  ];
  return candidates
    .sort((a, b) => b.estimatedBytesAt3000 - a.estimatedBytesAt3000)
    .map((c, i) => ({ rank: i + 1, ...c }));
}

export function readK97fBackendPolicySnapshot(): {
  notesRouteFullVault: boolean;
  notesIncrementalFilter: boolean;
  backupParallelFetch: boolean;
  notesSelectStar: boolean;
} {
  const src = readFileSync(backendMainPath(), 'utf8');
  return {
    notesRouteFullVault: src.includes('@app.get("/api/notes")'),
    notesIncrementalFilter: src.includes('updated_after'),
    backupParallelFetch: src.includes('asyncio.gather'),
    notesSelectStar: src.includes('notes").select("*")'),
  };
}

export function formatK97fPayloadReport(rows: readonly K97fPayloadSizeRow[]): string {
  const lines = [
    'K-97F server payload audit',
    '',
    '| Notes | GET /api/notes MB | Sync vault MB | Export est. MB | Snapshot MB | Dup serialize MB |',
    '|------:|------------------:|--------------:|---------------:|------------:|-----------------:|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.noteCount} | ${(row.notesGetBytes / 1_048_576).toFixed(2)} | `
      + `${(row.syncFullVaultBytes / 1_048_576).toFixed(2)} | `
      + `${(row.exportZipEstimateBytes / 1_048_576).toFixed(2)} | `
      + `${(row.snapshotPayloadBytes / 1_048_576).toFixed(2)} | `
      + `${(row.duplicateSerializationBytes / 1_048_576).toFixed(2)} |`,
    );
  }
  return lines.join('\n');
}

export function formatK97fOperationMemoryReport(rows: readonly K97fOperationMemoryRow[]): string {
  const lines = ['K-97F operation memory samples @ 1000 notes', ''];
  for (const row of rows) {
    lines.push(
      `${row.operation} — payload ${(row.payloadBytes / 1024).toFixed(1)} KB | `
      + `heap Δ ${(row.deltaHeapBytes / 1024).toFixed(1)} KB | `
      + `rss ${(row.after.rss / 1_048_576).toFixed(1)} MB`,
    );
  }
  return lines.join('\n');
}
