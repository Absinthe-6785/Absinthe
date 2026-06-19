/**
 * K-114 — Large vault stress audit (extends K-97F/K-97G matrices).
 */
import type { NoteBase } from '@/components/views/noteUtils';
import { measureK97fPayloadSizeRow, type K97fNoteCount } from './k97fServerMemoryAudit';

export const K114_VAULT_NOTE_COUNTS = [1000, 3000, 5000, 10000] as const;
export type K114VaultNoteCount = (typeof K114_VAULT_NOTE_COUNTS)[number];

export interface K114LargeVaultRow {
  noteCount: K114VaultNoteCount;
  getNotesJsonBytes: number;
  syncVaultBytes: number;
  estimatedLatencyMs: number;
}

function synthNotes(count: number): NoteBase[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `n-${i}`,
    title: `Note ${i}`,
    body: 'x'.repeat(120),
    updatedAt: 1_700_000_000_000 + i,
    folderId: null,
    deletedAt: null,
  }));
}

export function measureK114LargeVaultRow(noteCount: K114VaultNoteCount): K114LargeVaultRow {
  const base = measureK97fPayloadSizeRow(Math.min(noteCount, 3000) as K97fNoteCount);
  const notes = synthNotes(noteCount);
  const jsonBytes = Buffer.byteLength(JSON.stringify(notes), 'utf8');
  const scale = noteCount / 1000;
  return {
    noteCount,
    getNotesJsonBytes: jsonBytes,
    syncVaultBytes: jsonBytes,
    estimatedLatencyMs: Math.round((base.syncFullVaultBytes / 50_000) * scale),
  };
}

export function runK114LargeVaultMatrix(): K114LargeVaultRow[] {
  return K114_VAULT_NOTE_COUNTS.map(measureK114LargeVaultRow);
}

export function auditLargeVault(): readonly string[] {
  return K114_VAULT_NOTE_COUNTS.map(String);
}
