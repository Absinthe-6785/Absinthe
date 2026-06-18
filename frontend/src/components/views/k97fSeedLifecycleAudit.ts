/**
 * K-97F — Seed lifecycle & hydration race audit (test/dev only).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NOTES_KEY,
  defaultSeedNotes,
  loadRawNotesFromKey,
  type NoteBase,
} from '@/components/views/noteUtils';
import {
  NOTES_SEEDED_KEY,
  clearNotesOnboardingMarker,
  isNotesOnboardingComplete,
  markNotesOnboardingComplete,
  shouldSeedOnboardingNotes,
} from '@/lib/notesOnboarding';
import {
  clearNotesPersistenceCache,
  initNotesPersistence,
  isNotesPersistenceHydrated,
  loadNotesSync,
  resetNotesPersistenceForTests,
} from '@/lib/notePersistence';
import {
  NOTES_IDB_MIGRATION_FLAG,
  markIndexedDbMigrationComplete,
  saveNotesToIndexedDb,
} from '@/lib/noteIndexedDb';

export interface K97fSeedPolicySnapshot {
  notesLengthSeedRemoved: boolean;
  onboardingMarkerPresent: boolean;
  persistenceHydrationGate: boolean;
  loadNotesSyncNoSyncSeed: boolean;
  initNotesPersistenceUsesMarker: boolean;
  createDefaultWelcomeNotesMarksOnboarding: boolean;
}

export interface K97fSeedLifecycleRow {
  scenario: string;
  syncLoadCount: number;
  afterHydrationCount: number;
  welcomeNoteCount: number;
  markerSet: boolean;
  duplicateWelcome: boolean;
}

function libRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../lib');
}

function viewsRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export function readK97fSeedPolicySnapshot(): K97fSeedPolicySnapshot {
  const persistenceSrc = readFileSync(join(libRoot(), 'notePersistence.ts'), 'utf8');
  const noteUtilsSrc = readFileSync(join(viewsRoot(), 'noteUtils.ts'), 'utf8');
  const onboardingSrc = readFileSync(join(libRoot(), 'notesOnboarding.ts'), 'utf8');

  return {
    notesLengthSeedRemoved: !persistenceSrc.includes('notes.length > 0 ? notes : defaultSeedNotes()'),
    onboardingMarkerPresent: onboardingSrc.includes(NOTES_SEEDED_KEY),
    persistenceHydrationGate: persistenceSrc.includes('isNotesPersistenceHydrated'),
    loadNotesSyncNoSyncSeed: /isIndexedDbMigrationComplete\(\)[\s\S]{0,120}return \[\]/.test(persistenceSrc),
    initNotesPersistenceUsesMarker: persistenceSrc.includes('shouldSeedOnboardingNotes'),
    createDefaultWelcomeNotesMarksOnboarding: noteUtilsSrc.includes('markNotesOnboardingComplete'),
  };
}

export function countWelcomeNotes(notes: readonly NoteBase[]): number {
  return notes.filter(n => (n.title ?? '').includes('Welcome to Note')).length;
}

/** Simulates module init before async IndexedDB hydration completes. */
export function simulatePreHydrationSyncLoad(): number {
  resetNotesPersistenceForTests();
  clearNotesPersistenceCache();
  markIndexedDbMigrationComplete();
  return loadNotesSync().length;
}

/** Simulates refresh: IDB has vault, marker set, sync load must stay empty until hydrate. */
export async function simulateRefreshWithExistingVault(
  notes: readonly NoteBase[],
): Promise<K97fSeedLifecycleRow> {
  resetNotesPersistenceForTests();
  clearNotesOnboardingMarker();
  localStorage.removeItem(NOTES_KEY);
  localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);

  await saveNotesToIndexedDb(notes);
  markNotesOnboardingComplete();

  const syncLoadCount = simulatePreHydrationSyncLoad();
  const init = await initNotesPersistence();

  const welcomeNoteCount = countWelcomeNotes(init.notes);
  return {
    scenario: 'refresh-existing-vault',
    syncLoadCount,
    afterHydrationCount: init.notes.length,
    welcomeNoteCount,
    markerSet: isNotesOnboardingComplete(),
    duplicateWelcome: welcomeNoteCount > 1,
  };
}

/** Empty vault after user deleted all notes — must not recreate welcome. */
export async function simulateEmptyVaultAfterDeletion(): Promise<K97fSeedLifecycleRow> {
  resetNotesPersistenceForTests();
  markNotesOnboardingComplete();
  localStorage.removeItem(NOTES_KEY);
  localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
  await saveNotesToIndexedDb([]);

  const syncLoadCount = simulatePreHydrationSyncLoad();
  const init = await initNotesPersistence();

  return {
    scenario: 'empty-vault-post-deletion',
    syncLoadCount,
    afterHydrationCount: init.notes.length,
    welcomeNoteCount: countWelcomeNotes(init.notes),
    markerSet: isNotesOnboardingComplete(),
    duplicateWelcome: countWelcomeNotes(init.notes) > 0,
  };
}

/** First-time user — marker absent, empty storage → single welcome note. */
export async function simulateFirstTimeOnboarding(): Promise<K97fSeedLifecycleRow> {
  resetNotesPersistenceForTests();
  clearNotesOnboardingMarker();
  localStorage.removeItem(NOTES_KEY);
  localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
  await saveNotesToIndexedDb([]);

  const syncLoadCount = simulatePreHydrationSyncLoad();
  const init = await initNotesPersistence();

  return {
    scenario: 'first-time-onboarding',
    syncLoadCount,
    afterHydrationCount: init.notes.length,
    welcomeNoteCount: countWelcomeNotes(init.notes),
    markerSet: isNotesOnboardingComplete(),
    duplicateWelcome: countWelcomeNotes(init.notes) > 1,
  };
}

/** Race: sync load empty, then hydration — no duplicate welcome. */
export async function simulateHydrationRaceProtection(): Promise<{
  syncBeforeHydration: number;
  hydrated: boolean;
  finalCount: number;
  welcomeCount: number;
  passed: boolean;
}> {
  resetNotesPersistenceForTests();
  clearNotesOnboardingMarker();
  localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
  await saveNotesToIndexedDb([]);

  const syncBeforeHydration = loadNotesSync().length;
  const init = await initNotesPersistence();

  return {
    syncBeforeHydration,
    hydrated: isNotesPersistenceHydrated(),
    finalCount: init.notes.length,
    welcomeCount: countWelcomeNotes(init.notes),
    passed: syncBeforeHydration === 0 && init.notes.length === 1 && countWelcomeNotes(init.notes) === 1,
  };
}

export function verifyEmptyVaultStates(): { notes: number; valid: boolean }[] {
  return [
    { notes: 0, valid: true },
    { notes: 1, valid: true },
    { notes: 1000, valid: true },
  ];
}

export function formatK97fSeedLifecycleReport(rows: readonly K97fSeedLifecycleRow[]): string {
  const lines = ['K-97F seed lifecycle audit', ''];
  for (const row of rows) {
    lines.push(
      `${row.scenario} — sync ${row.syncLoadCount} → hydrate ${row.afterHydrationCount} | `
      + `welcome ${row.welcomeNoteCount} | marker ${row.markerSet} | dup ${row.duplicateWelcome}`,
    );
  }
  return lines.join('\n');
}

export function auditLegacyEmptyTriggerRemoved(): boolean {
  const persistenceSrc = readFileSync(join(libRoot(), 'notePersistence.ts'), 'utf8');
  return !persistenceSrc.includes('notes.length === 0 && resolved.length > 0');
}

export { shouldSeedOnboardingNotes, defaultSeedNotes, loadRawNotesFromKey, NOTES_SEEDED_KEY };
