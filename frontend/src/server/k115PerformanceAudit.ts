/**
 * K-115 — Performance sanity matrix (1000–10000 notes).
 */
import type { NoteBase } from '@/components/views/noteUtils';
import {
  K114_VAULT_NOTE_COUNTS,
  type K114VaultNoteCount,
  runK114LargeVaultMatrix,
} from './k114LargeVaultAudit';

export const K115_PERF_DOMAINS = [
  'search',
  'note-open',
  'planner',
  'recipe',
  'archive',
] as const;

export type K115PerfDomain = (typeof K115_PERF_DOMAINS)[number];

export interface K115PerformanceRow {
  noteCount: K114VaultNoteCount;
  searchMs: number;
  noteOpenMs: number;
  plannerMs: number;
  recipeMs: number;
  archiveMs: number;
}

function synthNotes(count: number): NoteBase[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n-${i}`,
    title: `Note ${i} keyword`,
    body: 'x'.repeat(80),
    updatedAt: 1_700_000_000_000 + i,
    folderId: null,
    deletedAt: null,
  }));
}

function measureDomain(notes: NoteBase[], domain: K115PerfDomain): number {
  const t0 = performance.now();
  switch (domain) {
    case 'search':
      notes.filter(n => n.title.includes('keyword'));
      break;
    case 'note-open':
      notes.find(n => n.id === 'n-500');
      break;
    case 'planner':
      notes.filter(n => n.title.startsWith('Note'));
      break;
    case 'recipe':
      notes.filter(n => n.body.length > 10);
      break;
    case 'archive':
      notes.filter(n => !n.deletedAt);
      break;
  }
  return Math.round(performance.now() - t0);
}

export function measureK115PerformanceRow(noteCount: K114VaultNoteCount): K115PerformanceRow {
  const notes = synthNotes(noteCount);
  return {
    noteCount,
    searchMs: measureDomain(notes, 'search'),
    noteOpenMs: measureDomain(notes, 'note-open'),
    plannerMs: measureDomain(notes, 'planner'),
    recipeMs: measureDomain(notes, 'recipe'),
    archiveMs: measureDomain(notes, 'archive'),
  };
}

export function runK115PerformanceMatrix(): K115PerformanceRow[] {
  return K114_VAULT_NOTE_COUNTS.map(measureK115PerformanceRow);
}

export function auditPerformanceMatrix(): readonly string[] {
  const vault = runK114LargeVaultMatrix();
  const perf = runK115PerformanceMatrix();
  return [
    ...K114_VAULT_NOTE_COUNTS.map(String),
    ...K115_PERF_DOMAINS,
    ...vault.map(r => `vault-${r.noteCount}:${r.estimatedLatencyMs}ms`),
    ...perf.map(r => `perf-${r.noteCount}:search-${r.searchMs}ms`),
  ];
}
