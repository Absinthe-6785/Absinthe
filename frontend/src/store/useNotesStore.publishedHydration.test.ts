import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';
import type { NotesPersistenceInitResult } from '../lib/notePersistence';
import {
  activateNotesAccountAuthority,
  detachNotesAccountAuthority,
  getActiveNotesAuthorityRequest,
  isNotesAuthorityRequestActive,
  NOTES_CORE_DOMAIN,
  NOTES_FOLDERS_DOMAIN,
  type NotesAuthorityDomainState,
  type NotesAuthorityRequest,
} from '../lib/notesAccountAuthority';

const persistence = vi.hoisted(() => ({
  initialize: vi.fn(),
  save: vi.fn(async () => ({ status: 'persisted' as const })),
}));

vi.mock('../lib/notePersistence', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/notePersistence')>();
  return {
    ...actual,
    initNotesPersistence: persistence.initialize,
    saveNotesAsync: persistence.save,
    clearNotesPersistence: vi.fn(async () => {}),
  };
});
vi.mock('../lib/supabase', () => ({ authFetch: vi.fn(), authReadFetch: vi.fn() }));
vi.mock('../lib/vaultSnapshotAuto', () => ({ scheduleAutoSnapshot: vi.fn() }));

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
  clear: () => storage.clear(),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size; },
});

const { useNotesStore, observePublishedNotesHydration } = await import('./useNotesStore');
const { resetNotesPersistenceForTests } = await import('../lib/notePersistence');
const { mayReset, setRecoveryModeActiveForTest } = await import('../lib/recoverySafetyPolicy');
const { NOTES_RUNTIME_SYNC_MODE_KEY } = await import('../lib/notesSyncClient');

function note(id: string): NoteBase {
  return { id, title: id, body: id, updatedAt: 1, createdAt: 1, folderId: null, deletedAt: null };
}

function domainState(
  request: NotesAuthorityRequest,
  domainId: NotesAuthorityDomainState['domainId'],
  count: number,
): NotesAuthorityDomainState {
  return {
    accountId: request.accountId, domainId, schemaVersion: 1,
    state: count ? 'LOADED_POPULATED' : 'LOADED_EMPTY', recordCount: count,
    verifiedAt: 1, legacyGlobalDataPresent: false,
  };
}

function hydrated(request: NotesAuthorityRequest, notes = [note(request.accountId)]): NotesPersistenceInitResult {
  return {
    notes, mode: 'accountScoped', accountId: request.accountId,
    requestGeneration: request.generation, migrated: false, migrationMs: 0, loadMs: 0,
    notesAuthorityState: domainState(request, NOTES_CORE_DOMAIN, notes.length),
    foldersAuthorityState: domainState(request, NOTES_FOLDERS_DOMAIN, 0),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function currentRequest() {
  const request = getActiveNotesAuthorityRequest();
  if (!request) throw new Error('test expected an actual active request');
  return request;
}

async function publish(account = 'A') {
  await useNotesStore.getState().initNotesStorage(account);
  const request = currentRequest();
  expect(persistence.initialize).toHaveBeenLastCalledWith(account, request);
  return request;
}

function expectUnavailable(reason: string) {
  expect(observePublishedNotesHydration()).toEqual({ status: 'UNAVAILABLE', reason });
}

beforeEach(() => {
  useNotesStore.getState().detachNotesStorage();
  resetNotesPersistenceForTests();
  setRecoveryModeActiveForTest(false);
  storage.clear();
  storage.set(NOTES_RUNTIME_SYNC_MODE_KEY, 'local');
  persistence.initialize.mockReset();
  persistence.initialize.mockImplementation(async (_account: string, request: NotesAuthorityRequest) => hydrated(request));
  persistence.save.mockClear();
});

afterEach(() => {
  useNotesStore.getState().detachNotesStorage();
  vi.useRealTimers();
});

describe('published Notes hydration provenance', () => {
  it('H01/H12 publishes the exact initiating request with its Notes before subscribers observe it', async () => {
    const seen: ReturnType<typeof observePublishedNotesHydration>[] = [];
    const unsubscribe = useNotesStore.subscribe(state => {
      if (state.notes.some(item => item.id === 'A')) seen.push(observePublishedNotesHydration());
    });
    try {
      const request = await publish();
      expect(observePublishedNotesHydration()).toEqual({ status: 'CURRENT', request });
      expect(seen.length).toBeGreaterThan(0);
      for (const result of seen) {
        expect(result.status).toBe('CURRENT');
        if (result.status === 'CURRENT') expect(result.request).toBe(request);
      }
      expect(Object.isFrozen(observePublishedNotesHydration())).toBe(true);
    } finally { unsubscribe(); }
  });

  it('H02/H15 leaves old Notes unavailable while same-account replacement hydration is pending', async () => {
    const a1 = await publish();
    const oldNotes = useNotesStore.getState().notes;
    const next = deferred<NotesPersistenceInitResult>();
    persistence.initialize.mockReturnValueOnce(next.promise);
    const loading = useNotesStore.getState().initNotesStorage('A');
    const a2 = currentRequest();
    expect(a2).not.toBe(a1);
    expect(useNotesStore.getState().notes).toBe(oldNotes);
    expectUnavailable('PENDING_REPLACEMENT_HYDRATION');
    next.resolve(hydrated(a2, [note('A2')]));
    await loading;
    expect(observePublishedNotesHydration()).toEqual({ status: 'CURRENT', request: a2 });
    expect(useNotesStore.getState().notes[0].id).toBe('A2');
  });

  it('H03 rejects A1 after A1 -> B -> A2 even when the account string matches again', async () => {
    const a1 = await publish();
    activateNotesAccountAuthority('B');
    activateNotesAccountAuthority('A');
    expect(isNotesAuthorityRequestActive(a1)).toBe(false);
    expectUnavailable('STALE_PUBLISHED_HYDRATION');
  });

  it.each(['B', 'A'])('H04/H05 keeps delayed A1 from overwriting the newer %s publication', async account => {
    const old = deferred<NotesPersistenceInitResult>();
    persistence.initialize.mockReturnValueOnce(old.promise);
    const loadingA1 = useNotesStore.getState().initNotesStorage('A');
    const a1 = currentRequest();
    const winner = await publish(account);
    const winnerNotes = useNotesStore.getState().notes;
    old.resolve(hydrated(a1, [note('late-A1')]));
    await loadingA1;
    expect(useNotesStore.getState().notes).toBe(winnerNotes);
    expect(observePublishedNotesHydration()).toEqual({ status: 'CURRENT', request: winner });
  });

  it('H06 requires a successful new publication after external same-account activation', async () => {
    await publish();
    activateNotesAccountAuthority('A');
    expectUnavailable('STALE_PUBLISHED_HYDRATION');
    const current = await publish();
    expect(observePublishedNotesHydration()).toEqual({ status: 'CURRENT', request: current });
  });

  it('H07 invalidates immediately on authority detach, without a Store update or subscriber', async () => {
    await publish();
    const state = useNotesStore.getState();
    detachNotesAccountAuthority();
    expect(useNotesStore.getState()).toBe(state);
    expectUnavailable('MISSING_AUTHORITY');
  });

  it('H08 does not attest failed hydration and preserves recovery reporting', async () => {
    await publish();
    persistence.initialize.mockRejectedValueOnce(new Error('synthetic hydration failure'));
    await expect(useNotesStore.getState().initNotesStorage('A')).rejects.toThrow('synthetic hydration failure');
    expectUnavailable('NO_PUBLISHED_HYDRATION');
    expect(useNotesStore.getState().notesAuthorityState).toBe('RECOVERY_REQUIRED');
    expect(useNotesStore.getState().syncError).toContain('synthetic hydration failure');
  });

  it.each(['notes', 'folders', 'fallback', 'count'])('H08 does not attest a partial or unproven %s result', async kind => {
    persistence.initialize.mockImplementationOnce(async (_account: string, request: NotesAuthorityRequest) => {
      const result = hydrated(request);
      if (kind === 'notes') result.notesAuthorityState = { ...result.notesAuthorityState!, state: 'RECOVERY_REQUIRED' };
      if (kind === 'folders') result.foldersAuthorityState = { ...result.foldersAuthorityState!, state: 'RECOVERY_REQUIRED' };
      if (kind === 'fallback') result.fallbackError = 'synthetic fallback';
      if (kind === 'count') result.notesAuthorityState = { ...result.notesAuthorityState!, recordCount: 9 };
      return result;
    });
    await useNotesStore.getState().initNotesStorage('A');
    expectUnavailable('NO_PUBLISHED_HYDRATION');
    expect(useNotesStore.getState().notes[0].id).toBe('A');
  });

  it('H09 fails closed with no authority and with an active request that never published', () => {
    expectUnavailable('MISSING_AUTHORITY');
    activateNotesAccountAuthority('A');
    expectUnavailable('NO_PUBLISHED_HYDRATION');
  });

  it('H10 preserves unauthenticated compatibility merging without authenticated provenance', async () => {
    await publish();
    persistence.initialize.mockResolvedValueOnce({
      notes: [note('legacy')], mode: 'localStorage', migrated: false, migrationMs: 0, loadMs: 0,
    });
    await useNotesStore.getState().initNotesStorage();
    expect(useNotesStore.getState().notes.map(item => item.id).sort()).toEqual(['A', 'legacy']);
    expectUnavailable('NO_PUBLISHED_HYDRATION');
  });

  it('H04/H10 prevents an older unauthenticated completion from replacing authenticated Notes', async () => {
    const old = deferred<NotesPersistenceInitResult>();
    persistence.initialize.mockReturnValueOnce(old.promise);
    const legacyRun = useNotesStore.getState().initNotesStorage();
    const winner = await publish('B');
    old.resolve({ notes: [note('legacy')], mode: 'localStorage', migrated: false, migrationMs: 0, loadMs: 0 });
    await legacyRun;
    expect(useNotesStore.getState().notes.map(item => item.id)).toEqual(['B']);
    expect(observePublishedNotesHydration()).toEqual({ status: 'CURRENT', request: winner });
  });

  it('H08 ignores an older failed initializer after a newer authenticated publication', async () => {
    const old = deferred<NotesPersistenceInitResult>();
    persistence.initialize.mockReturnValueOnce(old.promise);
    const oldRun = useNotesStore.getState().initNotesStorage('A');
    const winner = await publish('B');
    old.reject(new Error('obsolete failure'));
    await oldRun;
    expect(useNotesStore.getState().syncError).toBeNull();
    expect(observePublishedNotesHydration()).toEqual({ status: 'CURRENT', request: winner });
  });

  it('H11 refuses an external Notes replacement, including replay of an older recognized snapshot', async () => {
    const request = await publish();
    const original = useNotesStore.getState();
    useNotesStore.getState().updateNote('A', { title: 'edited' });
    expect(observePublishedNotesHydration()).toEqual({ status: 'CURRENT', request });
    useNotesStore.setState(original);
    expectUnavailable('STALE_PUBLISHED_HYDRATION');
    useNotesStore.setState({ notes: [note('external')] });
    expectUnavailable('STALE_PUBLISHED_HYDRATION');
  });

  it('H11 reset invalidates the claim without changing the authority owner', async () => {
    const request = await publish();
    useNotesStore.getState().resetAllNotes();
    expect(getActiveNotesAuthorityRequest()).toBe(request);
    expectUnavailable('NO_PUBLISHED_HYDRATION');
  });

  it('IR01/T01 rejects in-place replacement of B contents with retained A1 Notes', async () => {
    await publish('A');
    const a1Notes = useNotesStore.getState().notes;
    const b = await publish('B');
    const snapshot = useNotesStore.getState();
    const bContents = snapshot.notes.slice();
    expect(observePublishedNotesHydration()).toEqual({ status: 'CURRENT', request: b });
    snapshot.notes.splice(0, snapshot.notes.length, ...a1Notes);
    expect(useNotesStore.getState().notes).toBe(snapshot.notes);
    expect(useNotesStore.getState().notes[0].id).toBe('A');
    expectUnavailable('STALE_PUBLISHED_HYDRATION');
    // Restoring the bytes and authentic snapshot cannot un-revoke the claim.
    snapshot.notes.splice(0, snapshot.notes.length, ...bContents);
    useNotesStore.setState(snapshot);
    expectUnavailable('STALE_PUBLISHED_HYDRATION');
  });

  it.each(['field', 'properties', 'relations'])('IR01/T02 rejects mutation through a retained %s alias', async kind => {
    persistence.initialize.mockImplementationOnce(async (_account: string, request: NotesAuthorityRequest) => hydrated(request, [{
      ...note('A'), properties: { source: 'owned' }, relations: { related: ['owned-target'] },
    }]));
    await publish();
    const alias = useNotesStore.getState().notes[0];
    if (kind === 'field') alias.body = 'foreign content';
    if (kind === 'properties') alias.properties!.source = 'foreign content';
    if (kind === 'relations') alias.relations!.related[0] = 'foreign-target';
    expect(useNotesStore.getState().notes[0]).toBe(alias);
    expectUnavailable('STALE_PUBLISHED_HYDRATION');
  });

  it('IR02/T03 never revives the latest hydration snapshot after an authorized reset', async () => {
    const request = await publish();
    const snapshot = useNotesStore.getState();
    expect(mayReset()).toBe(true);
    snapshot.resetAllNotes();
    expect(getActiveNotesAuthorityRequest()).toBe(request);
    expect(useNotesStore.getState().notes).not.toBe(snapshot.notes);
    useNotesStore.setState(snapshot);
    expect(useNotesStore.getState().notes).toBe(snapshot.notes);
    expectUnavailable('STALE_PUBLISHED_HYDRATION');
  });

  it('IR02/T03 revokes a replacement before snapshot replay even without an intermediate observation', async () => {
    await publish();
    const snapshot = useNotesStore.getState();
    useNotesStore.setState({ notes: [note('unproven')] });
    useNotesStore.setState(snapshot);
    expect(useNotesStore.getState().notes).toBe(snapshot.notes);
    expectUnavailable('STALE_PUBLISHED_HYDRATION');
  });

  it('IR02/T04 permits a new successful hydration after irreversible invalidation', async () => {
    const old = await publish();
    const snapshot = useNotesStore.getState();
    expect(mayReset()).toBe(true);
    snapshot.resetAllNotes();
    useNotesStore.setState(snapshot);
    expectUnavailable('STALE_PUBLISHED_HYDRATION');
    const fresh = await publish();
    expect(fresh).not.toBe(old);
    const observation = observePublishedNotesHydration();
    expect(observation.status).toBe('CURRENT');
    if (observation.status === 'CURRENT') expect(observation.request).toBe(fresh);
  });

  it('IR01/T05 preserves immutable body, property and relation edits by the existing owner', async () => {
    const request = await publish();
    const original = useNotesStore.getState().notes[0];
    useNotesStore.getState().updateNote('A', {
      body: 'owner edit', properties: { source: 'owned' }, relations: { related: ['target'] },
    });
    const updated = useNotesStore.getState().notes[0];
    expect(updated).not.toBe(original);
    expect(updated.body).toBe('owner edit');
    expect(updated.properties).toEqual({ source: 'owned' });
    expect(updated.relations).toEqual({ related: ['target'] });
    const observation = observePublishedNotesHydration();
    expect(observation.status).toBe('CURRENT');
    if (observation.status === 'CURRENT') expect(observation.request).toBe(request);
  });

  it.each(['reset', 'detach'])('H11 prevents pending hydration from reviving Notes after Store %s', async action => {
    const wait = deferred<NotesPersistenceInitResult>();
    persistence.initialize.mockReturnValueOnce(wait.promise);
    const run = useNotesStore.getState().initNotesStorage('A');
    const request = currentRequest();
    if (action === 'reset') useNotesStore.getState().resetAllNotes();
    else useNotesStore.getState().detachNotesStorage();
    const replacement = useNotesStore.getState().notes;
    wait.resolve(hydrated(request, [note('obsolete')]));
    await run;
    expect(useNotesStore.getState().notes).toBe(replacement);
    expect(observePublishedNotesHydration().status).toBe('UNAVAILABLE');
  });

  it('H12 preserves provenance across supported ordinary same-account Notes mutations', async () => {
    const request = await publish();
    useNotesStore.getState().setActiveNoteId('A');
    useNotesStore.getState().toggleStar('A');
    useNotesStore.getState().updateNote('A', { title: 'still owned' });
    useNotesStore.getState().importNote(note('imported'));
    expect(useNotesStore.getState().notes.map(item => item.id)).toContain('A');
    expect(observePublishedNotesHydration()).toEqual({ status: 'CURRENT', request });
    activateNotesAccountAuthority('B');
    useNotesStore.getState().updateNote('A', { title: 'cannot acquire B provenance' });
    expect(observePublishedNotesHydration().status).toBe('UNAVAILABLE');
  });

  it('H13 keeps A2 after three asynchronous A1 -> B -> A2 completions arrive out of order', async () => {
    const waits = [deferred<NotesPersistenceInitResult>(), deferred<NotesPersistenceInitResult>(), deferred<NotesPersistenceInitResult>()];
    for (const wait of waits) persistence.initialize.mockReturnValueOnce(wait.promise);
    const a1Run = useNotesStore.getState().initNotesStorage('A'); const a1 = currentRequest();
    const bRun = useNotesStore.getState().initNotesStorage('B'); const b = currentRequest();
    const a2Run = useNotesStore.getState().initNotesStorage('A'); const a2 = currentRequest();
    waits[2].resolve(hydrated(a2, [note('winner-A2')])); await a2Run;
    waits[1].resolve(hydrated(b)); await bRun;
    waits[0].resolve(hydrated(a1)); await a1Run;
    expect(useNotesStore.getState().notes[0].id).toBe('winner-A2');
    expect(observePublishedNotesHydration()).toEqual({ status: 'CURRENT', request: a2 });
  });

  it('H14 returns the actual request, not a structurally matching object, and rejects a forged Store token', async () => {
    const request = await publish();
    const fabricated = Object.freeze({ ...request });
    expect(isNotesAuthorityRequestActive(fabricated)).toBe(true); // Existing comparator is not an issuance proof.
    const observation = observePublishedNotesHydration();
    expect(observation.status).toBe('CURRENT');
    if (observation.status === 'CURRENT') {
      expect(observation.request).toBe(request);
      expect(observation.request).not.toBe(fabricated);
    }
    const key = Object.getOwnPropertySymbols(useNotesStore.getState())[0];
    expect(key).toBeDefined();
    useNotesStore.setState(Object.assign({}, useNotesStore.getState(), { [key]: Object.freeze({ request: fabricated }) }));
    expectUnavailable('STALE_PUBLISHED_HYDRATION');
  });

  it('H14 does not let an old hydration result borrow the newer request fields', async () => {
    const old = deferred<NotesPersistenceInitResult>();
    persistence.initialize.mockReturnValueOnce(old.promise);
    const a1Run = useNotesStore.getState().initNotesStorage('A');
    const b = await publish('B');
    old.resolve(hydrated(b, [note('forged-old-result')]));
    await a1Run;
    expect(useNotesStore.getState().notes[0].id).toBe('B');
    expect(observePublishedNotesHydration()).toEqual({ status: 'CURRENT', request: b });
  });

  it('never installs an after-set claim following reentrant authority replacement by a subscriber', async () => {
    let replaced = false;
    const unsubscribe = useNotesStore.subscribe(state => {
      if (!replaced && state.notes.some(item => item.id === 'A')) {
        replaced = true;
        activateNotesAccountAuthority('B');
        expectUnavailable('STALE_PUBLISHED_HYDRATION');
      }
    });
    try {
      await useNotesStore.getState().initNotesStorage('A');
      expectUnavailable('STALE_PUBLISHED_HYDRATION');
    } finally { unsubscribe(); }
  });

  it('never authorizes a reentrant unproven Store replacement during hydration publication', async () => {
    let replaced = false;
    const unsubscribe = useNotesStore.subscribe(state => {
      if (!replaced && state.notes.some(item => item.id === 'A')) {
        replaced = true;
        useNotesStore.setState({ notes: [note('unproven')] });
        expectUnavailable('STALE_PUBLISHED_HYDRATION');
      }
    });
    try {
      await useNotesStore.getState().initNotesStorage('A');
      expect(useNotesStore.getState().notes[0].id).toBe('unproven');
      expectUnavailable('STALE_PUBLISHED_HYDRATION');
    } finally { unsubscribe(); }
  });
});
