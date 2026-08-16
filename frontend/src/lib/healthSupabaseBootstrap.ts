import { supabase } from './supabase';
import {
  buildHealthRecoveryExport,
  collectHealthRecoveryDatasetsReadOnly,
  HEALTH_RECOVERY_DATASETS,
  type HealthRecoveryDatasets,
} from './healthRecoveryExport';
import {
  createLocalHealthDriver,
  type LocalHealthDriver,
} from './healthLocalRepository';
import { persistReadOnlyHealthBootstrap } from './healthRecoveryImport';

export const HEALTH_LOCAL_BOOTSTRAP_COMPLETE_EVENT = 'absinthe-health-local-bootstrap-complete';

type ReadOnlyFetch = (input: string, init?: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json' | 'headers'>>;

export type HealthSupabaseBootstrapResult = Awaited<ReturnType<typeof persistReadOnlyHealthBootstrap>>;

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
  const prior = await priorDriver.readAccountSnapshot(input.accountId);
  const remoteTotal = HEALTH_RECOVERY_DATASETS.reduce((sum, dataset) => sum + datasets[dataset].length, 0);
  const priorTotal = HEALTH_RECOVERY_DATASETS.reduce((sum, dataset) => sum + prior.datasets[dataset].length, 0);
  if ((remoteTotal < priorTotal)
    || (remoteTotal === 0 && priorTotal > 0)
    || HEALTH_RECOVERY_DATASETS.some(dataset => datasets[dataset].length < prior.datasets[dataset].length)
    || HEALTH_RECOVERY_DATASETS.some(dataset => datasets[dataset].length === 0 && prior.datasets[dataset].length > 0)) {
    throw new Error('health_bootstrap_incomplete_remote_preserved_local');
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
  return result;
}
