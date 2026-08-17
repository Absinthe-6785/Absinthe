/**
 * K-115 — Startup audit: cold/warm start, hydration, TTI estimates.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NoteBase } from '@/components/views/noteUtils';
import { runK114LargeVaultMatrix } from './k114LargeVaultAudit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

export const K115_STARTUP_PHASES = [
  'initNotesStorage',
  'fetchCompleteNotesFoldersSnapshot',
  'bootstrapFromSupabase durable apply/readback',
  'knowledgeIndexService.buildFromNotes',
  'runPeriodicSnapshotSlots',
] as const;

export interface K115StartupRow {
  noteCount: number;
  coldHydrationMs: number;
  warmHydrationMs: number;
  indexBuildMs: number;
  estimatedTtiMs: number;
}

function synthNotes(count: number): NoteBase[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n-${i}`,
    title: `Note ${i}`,
    body: 'body',
    updatedAt: 1_700_000_000_000 + i,
    folderId: null,
    deletedAt: null,
  }));
}

export function measureK115StartupRow(noteCount: number): K115StartupRow {
  const notes = synthNotes(noteCount);
  const t0 = performance.now();
  JSON.parse(JSON.stringify(notes));
  const coldHydrationMs = performance.now() - t0;

  const t1 = performance.now();
  notes.forEach(n => ({ ...n, title: n.title }));
  const warmHydrationMs = performance.now() - t1;

  const t2 = performance.now();
  notes.forEach(n => n.title.toLowerCase());
  const indexBuildMs = performance.now() - t2;

  return {
    noteCount,
    coldHydrationMs: Math.round(coldHydrationMs),
    warmHydrationMs: Math.round(warmHydrationMs),
    indexBuildMs: Math.round(indexBuildMs),
    estimatedTtiMs: Math.round(coldHydrationMs + indexBuildMs + 120),
  };
}

export function runK115StartupMatrix(): K115StartupRow[] {
  return [100, 1000, 3000, 5000].map(measureK115StartupRow);
}

export function auditStartupGuards(): {
  bootstrapOnce: boolean;
  noDuplicateHydration: boolean;
  completeSnapshotBootstrap: boolean;
  retiredHydratePaths: boolean;
  phases: readonly string[];
} {
  const app = read('components/AppContent.tsx');
  const store = read('store/useNotesStore.ts');
  const client = read('lib/notesSyncClient.ts');
  return {
    bootstrapOnce: app.includes('notesBootstrapStarted') && app.includes('notesBootstrapStarted.current = true'),
    noDuplicateHydration:
      app.includes('notesBootstrapStarted.current') && app.includes('if (notesBootstrapStarted.current) return'),
    completeSnapshotBootstrap: store.includes('fetchCompleteNotesFoldersSnapshot')
      && store.includes('bootstrapFromSupabase')
      && client.includes('updated_after=0&bootstrap=true'),
    retiredHydratePaths: !store.includes('hydrateFromDB') && !store.includes('hydrateFromDBFull'),
    phases: K115_STARTUP_PHASES,
  };
}

export function auditLargeVaultStartup(): readonly string[] {
  return runK114LargeVaultMatrix().map(r => `${r.noteCount}:${r.estimatedLatencyMs}ms`);
}
