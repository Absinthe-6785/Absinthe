// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import {
  HEALTH_RECOVERY_IMPORT_UI_BOUNDARY,
  assertHealthRecoveryAccountMatch,
  HealthRecoveryImportPanel,
  isExactRecoveredDataset,
  isHealthRecoveryImportUiEnabled,
  readHealthRecoveryPreflight,
} from './HealthRecoveryImportPanel';
import { setRecoveryModeActiveForTest } from '@/lib/recoverySafetyPolicy';
import { HEALTH_LOCAL_DATABASE_NAME } from '@/lib/healthLocalRepository';
import { HEALTH_RECOVERY_DATASETS, type HealthRecoveryDatasets } from '@/lib/healthRecoveryExport';

const ACCOUNT_ID = '18c8ab7d-6ba7-4547-aa55-f254ce900075';

async function deleteHealthDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(HEALTH_LOCAL_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

describe('temporary Health recovery import UI boundary', () => {
  const theme = { card: '', border: '', input: '', textMuted: '' };

  afterEach(async () => {
    setRecoveryModeActiveForTest(true);
    await deleteHealthDatabase();
  });

  it('is hidden outside the temporary local recovery boundary', () => {
    setRecoveryModeActiveForTest(false);
    expect(isHealthRecoveryImportUiEnabled()).toBe(false);
    expect(HEALTH_RECOVERY_IMPORT_UI_BOUNDARY).toBe('temporary-rtu-local-recovery');
  });

  it('is enabled only inside the temporary local recovery boundary', () => {
    setRecoveryModeActiveForTest(true);
    expect(isHealthRecoveryImportUiEnabled()).toBe(true);
  });

  it('renders the control only while the recovery boundary is active', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    setRecoveryModeActiveForTest(false);
    await act(async () => { root.render(createElement(HealthRecoveryImportPanel, { accountId: 'account', theme })); });
    expect(container.querySelector(`[data-health-recovery-import-boundary="${HEALTH_RECOVERY_IMPORT_UI_BOUNDARY}"]`)).toBeNull();
    setRecoveryModeActiveForTest(true);
    await act(async () => { root.render(createElement(HealthRecoveryImportPanel, { accountId: 'account', theme })); });
    expect(container.querySelector(`[data-health-recovery-import-boundary="${HEALTH_RECOVERY_IMPORT_UI_BOUNDARY}"]`)).not.toBeNull();
    root.unmount();
  });

  it('reads a fresh account through raw local preflight without starting an import', async () => {
    await deleteHealthDatabase();
    const snapshot = await readHealthRecoveryPreflight(ACCOUNT_ID);
    expect(snapshot.importState).toBeNull();
    expect(Object.values(snapshot.datasets).every(rows => rows.length === 0)).toBe(true);
  });

  it('compares the complete local dataset without deduplicating rows', () => {
    const empty = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(dataset => [dataset, []])) as HealthRecoveryDatasets;
    expect(isExactRecoveredDataset(empty, empty)).toBe(true);
  });

  it('rejects an artifact account before raw local preflight', () => {
    const preview = { export: { sourceAccount: { userId: 'artifact-account', email: 'artifact@example.test' } } } as never;
    expect(() => assertHealthRecoveryAccountMatch(preview, ACCOUNT_ID))
      .toThrow('health_import_authenticated_account_mismatch');
  });
});
