// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import { buildLargeVaultDataset } from '@/dev/realisticUsageFixture';
import {
  auditLegacyEmptyTriggerRemoved,
  formatK97fSeedLifecycleReport,
  readK97fSeedPolicySnapshot,
  simulateEmptyVaultAfterDeletion,
  simulateFirstTimeOnboarding,
  simulateHydrationRaceProtection,
  simulatePreHydrationSyncLoad,
  simulateRefreshWithExistingVault,
  verifyEmptyVaultStates,
} from '@/components/views/k97fSeedLifecycleAudit';
import {
  NOTES_IDB_MIGRATION_FLAG,
  clearIndexedDbNotes,
  markIndexedDbMigrationComplete,
  saveNotesToIndexedDb,
} from '@/lib/noteIndexedDb';
import { clearNotesOnboardingMarker } from '@/lib/notesOnboarding';

describe('k97fSeedLifecycleAudit policy', () => {
  it('reads post-K-97F seed lifecycle hooks from source', () => {
    const policy = readK97fSeedPolicySnapshot();
    expect(policy.notesLengthSeedRemoved).toBe(true);
    expect(policy.onboardingMarkerPresent).toBe(true);
    expect(policy.persistenceHydrationGate).toBe(true);
    expect(policy.loadNotesSyncNoSyncSeed).toBe(true);
    expect(policy.initNotesPersistenceUsesMarker).toBe(true);
    expect(policy.createDefaultWelcomeNotesMarksOnboarding).toBe(true);
    expect(auditLegacyEmptyTriggerRemoved()).toBe(true);
  });
});

describe('k97f seed lifecycle scenarios', () => {
  beforeEach(async () => {
    localStorage.clear();
    clearNotesOnboardingMarker();
    localStorage.removeItem(NOTES_IDB_MIGRATION_FLAG);
    try {
      await clearIndexedDbNotes();
    } catch { /**/ }
  });

  it('does not seed on sync load before IndexedDB hydration', () => {
    expect(simulatePreHydrationSyncLoad()).toBe(0);
  });

  it('preserves existing vault on refresh without duplicate welcome notes', async () => {
    const { notes } = buildLargeVaultDataset({ noteCount: 50 });
    const row = await simulateRefreshWithExistingVault(notes);
    expect(row.syncLoadCount).toBe(0);
    expect(row.afterHydrationCount).toBe(50);
    expect(row.duplicateWelcome).toBe(false);
    expect(row.markerSet).toBe(true);
  });

  it('keeps empty vault when onboarding marker is set', async () => {
    const row = await simulateEmptyVaultAfterDeletion();
    expect(row.afterHydrationCount).toBe(0);
    expect(row.welcomeNoteCount).toBe(0);
    expect(row.duplicateWelcome).toBe(false);
  });

  it('creates exactly one welcome note on first-time onboarding', async () => {
    const row = await simulateFirstTimeOnboarding();
    expect(row.afterHydrationCount).toBe(1);
    expect(row.welcomeNoteCount).toBe(1);
    expect(row.duplicateWelcome).toBe(false);
    expect(row.markerSet).toBe(true);
  });

  it('protects against hydration race duplicate welcome notes', async () => {
    const race = await simulateHydrationRaceProtection();
    expect(race.passed).toBe(true);
    expect(race.hydrated).toBe(true);
  });

  it('supports 0 / 1 / 1000 note vault states', () => {
    const states = verifyEmptyVaultStates();
    expect(states.every(s => s.valid)).toBe(true);
  });

  it('prints seed lifecycle report', async () => {
    const rows = [
      await simulateFirstTimeOnboarding(),
      await simulateEmptyVaultAfterDeletion(),
      await simulateRefreshWithExistingVault(buildLargeVaultDataset({ noteCount: 100 }).notes),
    ];
    // eslint-disable-next-line no-console
    console.log(formatK97fSeedLifecycleReport(rows));
  });
});
