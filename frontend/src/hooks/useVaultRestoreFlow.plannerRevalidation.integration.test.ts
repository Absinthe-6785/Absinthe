// @vitest-environment happy-dom
import { act, createElement, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import useSWR, { SWRConfig, useSWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { accountBoundRemoteFetcher, accountBoundRemoteKey } from '../lib/accountBoundRemote';
import { revalidatePlannerAccountCache } from '../lib/plannerCacheRevalidation';
import { useVaultRestoreFlow } from './useVaultRestoreFlow';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type CloudRestoreResult = { applied: boolean };

const harness = vi.hoisted(() => ({
  account: 'account-a',
  fetchAccount: 'account-a',
  requests: [] as Array<{ url: string; account: string }>,
  cloudResolvers: [] as Array<(result: CloudRestoreResult) => void>,
  revalidationCallbacks: 0,
  otherAccountRevalidations: 0,
  showToast: vi.fn(),
}));

const restoreManifest = vi.hoisted(() => ({
  schemaVersion: 3,
  exportedAt: '2026-08-18T00:00:00.000Z',
  notes: [],
  folders: [],
  noteCount: 0,
  folderCount: 0,
  cloud: {
    completeness: 'complete',
    planner: { schedules: [] },
    health: { workoutLogs: [], inbodyLogs: [] },
  },
}));

vi.mock('../lib/remoteBoundary', () => ({ remoteSWRKey: (url: string) => url }));
vi.mock('../lib/config', () => ({ API_URL: 'https://example.invalid' }));
vi.mock('../lib/fetcher', () => ({
  fetcher: (input: unknown) => {
    const url = String(input);
    harness.requests.push({ url, account: harness.fetchAccount });
    return Promise.resolve([]);
  },
  isLocalOnlyRemotePausedError: () => false,
}));
vi.mock('../lib/syncMode', () => ({ resolveNotesRuntimeSyncMode: () => 'remote' }));
vi.mock('../lib/recoverySafetyPolicy', async () => {
  const actual = await vi.importActual<typeof import('../lib/recoverySafetyPolicy')>('../lib/recoverySafetyPolicy');
  return {
    ...actual,
    mayRestore: () => true,
    mayRestoreLocalCoreJsonBackup: () => true,
    recordRecoveryBlock: vi.fn(),
  };
});
vi.mock('../lib/importVaultBackup', async () => {
  const actual = await vi.importActual<typeof import('../lib/importVaultBackup')>('../lib/importVaultBackup');
  return {
    ...actual,
    createFullRestoreSelection: () => ({ noteIds: new Set<string>(), folderIds: new Set<string>() }),
  };
});
vi.mock('../lib/vaultRestorePipeline', async () => {
  const actual = await vi.importActual<typeof import('../lib/vaultRestorePipeline')>('../lib/vaultRestorePipeline');
  return {
    ...actual,
    manifestFromSnapshot: () => restoreManifest,
    buildFullVaultRestorePreview: () => ({
      core: {
        valid: true,
        conflictCount: 0,
        noteOptions: [],
        folderOptions: [],
        manifest: restoreManifest,
      },
      impact: {
        noteCount: 0,
        folderCount: 0,
        relationCount: 0,
        savedViewCount: 0,
        ruleCollectionCount: 0,
        databaseViewCount: 0,
        focusPresetCount: 0,
        hasKnowledgeHistory: false,
        healthDraftCount: 0,
        healthMemoCount: 0,
        hasRoutinePlannedSets: false,
        hasSettings: false,
        cloudCompleteness: 'complete',
        cloudScheduleCount: 0,
        cloudWorkoutCount: 0,
        cloudInbodyCount: 0,
        cloudRecipeCount: 0,
        schemaVersion: 3,
        source: 'snapshot',
      },
      exportValidation: { valid: true, errors: [] },
    }),
  };
});
vi.mock('../lib/vaultSnapshotStore', () => ({ loadSnapshotPayload: () => ({ snapshot: true }) }));
vi.mock('../lib/vaultBackupZip', () => ({ parseVaultBackupZip: vi.fn() }));
vi.mock('../lib/vaultRestoreSnapshot', async () => {
  const actual = await vi.importActual<typeof import('../lib/vaultRestoreSnapshot')>('../lib/vaultRestoreSnapshot');
  return actual;
});
vi.mock('../lib/vaultSnapshotAuto', () => ({ createLastSnapshot: vi.fn() }));
vi.mock('../lib/vaultCloudRestore', () => ({
  applyCloudRestore: () => new Promise<CloudRestoreResult>(resolve => {
    harness.cloudResolvers.push(resolve);
  }),
}));
vi.mock('../store/useNotesStore', () => {
  const state = {
    notes: [],
    folders: [],
    importVaultRestore: vi.fn(async () => ({
      importedNotes: 0,
      replacedNotes: 0,
      duplicatedNotes: 0,
      skippedNotes: 0,
      importedFolders: 0,
      skippedFolders: 0,
    })),
  };
  const useNotesStore = Object.assign(
    (selector: (value: typeof state) => unknown) => selector(state),
    { getState: () => state },
  );
  return { useNotesStore };
});
vi.mock('../lib/i18n', () => ({
  resolveAppLanguage: () => 'en',
  getTranslator: () => (key: string) => key,
}));

function WarmPlannerKeys({ account }: { account: string }) {
  harness.fetchAccount = account;
  const urls = [
    'https://example.invalid/api/schedules?date=2026-08-18',
    'https://example.invalid/api/schedules?date=2026-08-17',
    'https://example.invalid/api/schedules/ddays',
    'https://example.invalid/api/routines_with_logs?date=2026-08-18',
    'https://example.invalid/api/routines_with_logs?date=2026-08-17',
    'https://example.invalid/api/workouts?date=2026-08-18',
    'https://example.invalid/api/workouts?date=2026-08-17',
  ] as const;
  for (const url of urls) {
    useSWR(accountBoundRemoteKey(url, account), accountBoundRemoteFetcher, {
      dedupingInterval: 0,
      revalidateOnFocus: false,
    });
  }
  return null;
}

function OtherAccountSentinels() {
  const urls = [
    'https://example.invalid/api/schedules?date=2026-08-18',
    'https://example.invalid/api/schedules/ddays',
    'https://example.invalid/api/routines_with_logs?date=2026-08-18',
    'https://example.invalid/api/workouts?date=2026-08-18',
  ] as const;
  for (const url of urls) {
    useSWR(
      accountBoundRemoteKey(url, 'account-b'),
      async () => {
        harness.otherAccountRevalidations += 1;
        return [];
      },
      { fallbackData: [], revalidateOnMount: false, revalidateOnFocus: false },
    );
  }
  return null;
}

function RestoreHarness({ account, start }: { account: string; start: boolean }) {
  const { mutate: globalMutate } = useSWRConfig();
  const flow = useVaultRestoreFlow(
    harness.showToast,
    (key: string) => key,
    true,
    account,
    () => {
      harness.revalidationCallbacks += 1;
      revalidatePlannerAccountCache(globalMutate, account);
    },
  );
  const startedRef = useRef(false);
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (!start || startedRef.current) return;
    startedRef.current = true;
    flow.openSnapshotRestore('snapshot-1');
  }, [flow.openSnapshotRestore, start]);

  useEffect(() => {
    if (!start || !flow.preview || confirmedRef.current) return;
    confirmedRef.current = true;
    void flow.confirmRestore();
  }, [flow.confirmRestore, flow.preview, start]);

  return createElement('output', {
    'data-restore-preview': flow.preview ? 'ready' : 'pending',
    'data-restore-importing': String(flow.importing),
  });
}

function renderRestore(
  root: Root,
  cache: Map<unknown, unknown>,
  props: { account: string; start: boolean },
) {
  root.render(createElement(SWRConfig, {
    value: { provider: () => cache, dedupingInterval: 0, revalidateOnFocus: false },
  }, createElement('div', null,
    createElement(WarmPlannerKeys, { account: props.account }),
    createElement(OtherAccountSentinels),
    createElement(RestoreHarness, props),
  )));
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
    });
  }
}

describe('useVaultRestoreFlow Planner revalidation production path', () => {
  let root: Root | null = null;
  let host: HTMLDivElement | null = null;

  beforeEach(() => {
    harness.account = 'account-a';
    harness.fetchAccount = 'account-a';
    harness.requests.length = 0;
    harness.cloudResolvers.length = 0;
    harness.revalidationCallbacks = 0;
    harness.otherAccountRevalidations = 0;
    harness.showToast.mockReset();
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    host?.remove();
    root = null;
    host = null;
  });

  it('revalidates all active and inactive-date Planner families after real restore completion', async () => {
    const cache = new Map<unknown, unknown>();
    root = createRoot(host!);
    await act(async () => renderRestore(root!, cache, { account: 'account-a', start: true }));
    await flush();

    expect(host?.querySelector('[data-restore-preview]')?.getAttribute('data-restore-preview')).toBe('ready');
    expect(harness.cloudResolvers).toHaveLength(1);
    harness.requests.length = 0;

    await act(async () => {
      harness.cloudResolvers.shift()!({ applied: true });
    });
    await flush();

    expect(harness.revalidationCallbacks).toBe(1);
    expect(harness.otherAccountRevalidations).toBe(0);
    const revalidatedUrls = harness.requests.map(request => request.url);
    expect(revalidatedUrls).toEqual(expect.arrayContaining([
      'https://example.invalid/api/schedules?date=2026-08-18',
      'https://example.invalid/api/schedules?date=2026-08-17',
      'https://example.invalid/api/schedules/ddays',
      'https://example.invalid/api/routines_with_logs?date=2026-08-18',
      'https://example.invalid/api/routines_with_logs?date=2026-08-17',
      'https://example.invalid/api/workouts?date=2026-08-18',
      'https://example.invalid/api/workouts?date=2026-08-17',
    ]));
  });

  it('does not revalidate B when A restore completes after an account transition', async () => {
    const cache = new Map<unknown, unknown>();
    root = createRoot(host!);
    await act(async () => renderRestore(root!, cache, { account: 'account-a', start: true }));
    await flush();
    expect(harness.cloudResolvers).toHaveLength(1);

    await act(async () => renderRestore(root!, cache, { account: 'account-b', start: false }));
    await flush();
    const beforeCompletion = harness.requests.length;
    harness.otherAccountRevalidations = 0;

    await act(async () => {
      harness.cloudResolvers.shift()!({ applied: true });
    });
    await flush();

    expect(harness.revalidationCallbacks).toBe(0);
    expect(harness.otherAccountRevalidations).toBe(0);
    expect(harness.requests.length).toBe(beforeCompletion);
  });

  it('does not run success-only Planner invalidation when restore completion reports failure', async () => {
    const cache = new Map<unknown, unknown>();
    root = createRoot(host!);
    await act(async () => renderRestore(root!, cache, { account: 'account-a', start: true }));
    await flush();
    expect(harness.cloudResolvers).toHaveLength(1);
    harness.requests.length = 0;

    await act(async () => {
      harness.cloudResolvers.shift()!({ applied: false });
    });
    await flush();

    expect(harness.revalidationCallbacks).toBe(0);
    expect(harness.otherAccountRevalidations).toBe(0);
    expect(harness.requests).toHaveLength(0);
  });
});
