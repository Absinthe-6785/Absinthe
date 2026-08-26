import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  collect: vi.fn(),
  build: vi.fn(),
  persist: vi.fn(),
}));

const DATASETS = [
  'exercise_blocks',
  'workout_logs',
  'inbody_logs',
  'health_routines',
  'routines',
  'routine_logs',
  'protein_profiles',
  'protein_sources',
  'protein_intake_logs',
  'workout_memos',
] as const;

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

vi.mock('./healthRecoveryExport', () => ({
  HEALTH_RECOVERY_DATASETS: DATASETS,
  collectHealthRecoveryDatasetsReadOnly: mocks.collect,
  buildHealthRecoveryExport: mocks.build,
}));

vi.mock('./healthRecoveryImport', () => ({
  persistReadOnlyHealthBootstrap: mocks.persist,
}));

function datasetsWithCounts(counts: Partial<Record<(typeof DATASETS)[number], number>>) {
  return Object.fromEntries(DATASETS.map(dataset => [
    dataset,
    Array.from({ length: counts[dataset] ?? 0 }, (_, index) => ({
      id: `${dataset}-${index}`,
      user_id: 'account-a',
    })),
  ]));
}

function driverFor(localDatasets: Record<string, unknown[]>, authoritative = localDatasets) {
  return {
    recoverPendingImport: vi.fn().mockResolvedValue('NO_PENDING'),
    readAccountSnapshot: vi.fn().mockResolvedValue({ datasets: localDatasets, importState: null }),
    readAuthoritativeDatasets: vi.fn().mockResolvedValue(authoritative),
  };
}

describe('Health Supabase bootstrap disposition', () => {
  beforeEach(() => {
    mocks.getSession.mockReset().mockResolvedValue({
      data: { session: { user: { id: 'account-a', email: 'a@example.com' }, access_token: 'token' } },
    });
    mocks.collect.mockReset();
    mocks.build.mockReset().mockResolvedValue({
      sourceAccount: { userId: 'account-a', email: 'a@example.com' },
      exportedAt: '2026-08-25T00:00:00.000Z',
      datasets: datasetsWithCounts({}),
      checksum: { value: 'checksum' },
    });
    mocks.persist.mockReset().mockResolvedValue({
      accountId: 'account-a',
      snapshotId: 'snapshot',
      datasetCounts: {},
      totalRows: 0,
      relationships: {},
      sourceFidelity: 'PASS',
      remoteMutationCount: 0,
    });
  });

  it('returns READY_FROM_PRESERVED_LOCAL for incomplete remote data with valid local authority', async () => {
    const remote = datasetsWithCounts({ exercise_blocks: 1 });
    const local = datasetsWithCounts({ exercise_blocks: 2, workout_logs: 1 });
    const driver = driverFor(local);
    mocks.collect.mockResolvedValue(remote);

    const { bootstrapHealthFromSupabase, HEALTH_BOOTSTRAP_INCOMPLETE_REMOTE_PRESERVED_LOCAL } = await import('./healthSupabaseBootstrap');
    const result = await bootstrapHealthFromSupabase({ accountId: 'account-a', driver: driver as never });

    expect(result).toEqual(expect.objectContaining({
      disposition: 'READY_FROM_PRESERVED_LOCAL',
      reason: HEALTH_BOOTSTRAP_INCOMPLETE_REMOTE_PRESERVED_LOCAL,
      localTotalRows: 3,
      remoteTotalRows: 1,
      localDatasetCounts: expect.objectContaining({ exercise_blocks: 2, workout_logs: 1 }),
      remoteDatasetCounts: expect.objectContaining({ exercise_blocks: 1 }),
    }));
    expect(driver.readAuthoritativeDatasets).toHaveBeenCalledWith('account-a');
    expect(mocks.build).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it('keeps incomplete remote rejection fatal when local authority cannot be validated', async () => {
    const remote = datasetsWithCounts({ exercise_blocks: 1 });
    const local = datasetsWithCounts({ exercise_blocks: 2 });
    const driver = driverFor(local);
    driver.readAuthoritativeDatasets.mockRejectedValue(new Error('health_local_data_not_verified'));
    mocks.collect.mockResolvedValue(remote);

    const { bootstrapHealthFromSupabase } = await import('./healthSupabaseBootstrap');
    await expect(bootstrapHealthFromSupabase({ accountId: 'account-a', driver: driver as never })).rejects.toThrow(
      'health_local_data_not_verified',
    );
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it('returns READY_FROM_BOOTSTRAP when remote data is not less complete', async () => {
    const remote = datasetsWithCounts({ exercise_blocks: 1 });
    const local = datasetsWithCounts({});
    const driver = driverFor(local);
    mocks.collect.mockResolvedValue(remote);

    const { bootstrapHealthFromSupabase } = await import('./healthSupabaseBootstrap');
    const result = await bootstrapHealthFromSupabase({ accountId: 'account-a', driver: driver as never });

    expect(result).toEqual(expect.objectContaining({ disposition: 'READY_FROM_BOOTSTRAP' }));
    expect(mocks.build).toHaveBeenCalledTimes(1);
    expect(mocks.persist).toHaveBeenCalledTimes(1);
  });
});
