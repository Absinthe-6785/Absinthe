import { supabase } from './supabase';
import {
  buildHealthRecoveryExport,
  collectHealthRecoveryDatasetsReadOnly,
  HEALTH_RECOVERY_DATASETS,
  type HealthRecoveryDatasetName,
  type HealthRecoveryDatasets,
} from './healthRecoveryExport';
import {
  createLocalHealthDriver,
  type LocalHealthDriver,
} from './healthLocalRepository';
import { persistReadOnlyHealthBootstrap } from './healthRecoveryImport';

export const HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT = 'absinthe-health-local-bootstrap-complete';
export const HEALTH_BOOTSTRAP_INCOMPLETE_REMOTE_PRESERVED_LOCAL =
  'health_bootstrap_incomplete_remote_preserved_local';

type ReadOnlyFetch = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json' | 'headers'>>;

export type HealthDatasetCounts = Record<HealthRecoveryDatasetName, number>;

type HealthBootstrapSuccess = Awaited<ReturnType<typeof persistReadOnlyHealthBootstrap>> & {
  disposition: 'READY_FROM_BOOTSTRAP';
};

export type HealthSupabaseBootstrapResult = HealthBootstrapSuccess | {
  disposition: 'READY_FROM_PRESERVED_LOCAL';
  reason: typeof HEALTH_BOOTSTRAP_INCOMPLETE_REMOTE_PRESERVED_LOCAL;
  accountId: string;
  localDatasetCounts: HealthDatasetCounts;
  remoteDatasetCounts: HealthDatasetCounts;
  localTotalRows: number;
  remoteTotalRows: number;
};

function datasetCounts(datasets: HealthRecoveryDatasets): HealthDatasetCounts {
  return Object.fromEntries(
    HEALTH_RECOVERY_DATASETS.map(dataset => [dataset, datasets[dataset].length]),
  ) as HealthDatasetCounts;
}

function totalRows(counts: HealthDatasetCounts): number {
  return HEALTH_RECOVERY_DATASETS.reduce((sum, dataset) => sum + counts[dataset], 0);
}

function isRemoteIncomplete(
  remote: HealthDatasetCounts,
  local: HealthDatasetCounts,
): boolean {
  const remoteTotal = totalRows(remote);
  const localTotal = totalRows(local);
  return (remoteTotal < localTotal)
    || (remoteTotal === 0 && localTotal > 0)
    || HEALTH_RECOVERY_DATASETS.some(dataset => remote[dataset] < local[dataset])
    || HEALTH_RECOVERY_DATASETS.some(dataset => remote[dataset] === 0 && local[dataset] > 0);
}

/**
 * Fetch, validate, durably apply, and read back all reviewed Health datasets.
 * This is intentionally a one-shot SELECT-only recovery path; normal Health
 * writes remain behind their existing mutation APIs and are not touched here.
 */
export async function bootstrapHealthFromSupabase(input: {
  accountId: string;
  email?: string | null;
  driver?: LocalHealthDriver;
  endpoint?: string;
  apiKey?: string;
  accessToken?: string;
  fetchImpl?: ReadOnlyFetch;
  now?: () => string;
}): Promise<HealthSupabaseBootstrapResult> {
  const sessionResult = await supabase.auth.getSession();
  const sessionUser = sessionResult.data.session?.user;
  const accessToken = input.accessToken ?? sessionResult.data.session?.access_token;
  if (!sessionUser || sessionUser.id !== input.accountId || !accessToken) {
    throw new Error('health_bootstrap_authenticated_account_mismatch');
  }
  const endpoint = input.endpoint ?? import.meta.env.VITE_SUPABASE_URL;
  const apiKey = input.apiKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
  const datasets = await collectHealthRecoveryDatasetsReadOnly({
    endpoint,
    apiKey,
    accessToken,
    userId: input.accountId,
    fetchImpl: input.fetchImpl,
  });
  const latestSession = await supabase.auth.getSession();
  if (latestSession.data.session?.user.id !== input.accountId) {
    throw new Error('health_bootstrap_stale_account');
  }
  const priorDriver = input.driver ?? await createLocalHealthDriver();
  // Resolve any interrupted local import before comparing completeness. This
  // keeps the comparison bound to the same verified local authority that the
  // durable writer will read, without changing the remote read-only boundary.
  await priorDriver.recoverPendingImport(input.accountId);
  const prior = await priorDriver.readAccountSnapshot(input.accountId);
  const remoteDatasetCounts = datasetCounts(datasets);
  const priorDatasetCounts = datasetCounts(prior.datasets);
  if (isRemoteIncomplete(remoteDatasetCounts, priorDatasetCounts)) {
    // A snapshot alone is not enough to establish usable local authority. The
    // authoritative read validates the verified import marker, pending-import
    // recovery, dataset shape, and count binding before this is treated as a
    // successful preserved-local startup disposition.
    const authoritativeDatasets = await priorDriver.readAuthoritativeDatasets(input.accountId);
    const localDatasetCounts = datasetCounts(authoritativeDatasets);
    if (isRemoteIncomplete(remoteDatasetCounts, localDatasetCounts)) {
      return {
        disposition: 'READY_FROM_PRESERVED_LOCAL',
        reason: HEALTH_BOOTSTRAP_INCOMPLETE_REMOTE_PRESERVED_LOCAL,
        accountId: input.accountId,
        localDatasetCounts,
        remoteDatasetCounts,
        localTotalRows: totalRows(localDatasetCounts),
        remoteTotalRows: totalRows(remoteDatasetCounts),
      };
    }
  }
  const recoveryExport = await buildHealthRecoveryExport({
    sourceAccount: {
      userId: input.accountId,
      email: input.email ?? sessionUser.email ?? '',
    },
    exportedAt: (input.now ?? (() => new Date().toISOString()))(),
    datasets: datasets as HealthRecoveryDatasets,
  });
  const result = await persistReadOnlyHealthBootstrap({
    export: recoveryExport,
    driver: priorDriver,
    accountId: input.accountId,
    now: input.now,
  });
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT));
  return { ...result, disposition: 'READY_FROM_BOOTSTRAP' };
}
