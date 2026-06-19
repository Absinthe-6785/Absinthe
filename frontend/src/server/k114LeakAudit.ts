/** K-114 — Memory leak candidate audit. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K114_LEAK_CANDIDATES = [
  { area: 'notesCache', file: 'lib/notePersistence.ts', hook: 'notesCache' },
  { area: 'knowledgeIndex', file: 'store/useNotesStore.ts', hook: 'rebuildKnowledgeIndex' },
  { area: 'pendingBodySync', file: 'store/useNotesStore.ts', hook: 'pendingBodySync' },
  { area: 'bodySyncTimers', file: 'store/useNotesStore.ts', hook: 'bodySyncTimers' },
  { area: 'crossTabStorage', file: 'store/useNotesStore.ts', hook: "addEventListener('storage'" },
  { area: 'galaxyCache', file: 'store/useNotesStore.ts', hook: 'invalidateNoteGalaxyMapCache' },
] as const;

export function auditLeakCandidates(): readonly string[] {
  const findings: string[] = [];
  for (const c of K114_LEAK_CANDIDATES) {
    const src = readFileSync(join(ROOT, c.file), 'utf8');
    findings.push(src.includes(c.hook) ? `${c.area}:tracked` : `${c.area}:missing`);
  }
  return findings;
}
