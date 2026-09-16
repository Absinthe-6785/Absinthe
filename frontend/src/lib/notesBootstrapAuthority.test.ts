import { describe, expect, it } from 'vitest';
import type { NoteBase } from '../components/views/noteUtils';
import type { DbNoteRow } from './notesSyncClient';
import {
  createNotesAuthorityPhaseAggregate,
  normalizeAuthoritativeRemoteBootstrapNote,
  recordNotesAuthorityObservation,
  revalidateResolvedBootstrapNotes,
  resolveSameIdNoteAuthority,
  resolveSameIdNoteAuthorityWithObservation,
  snapshotNotesAuthorityPhaseAggregate,
} from './notesBootstrapAuthority';

const ACCOUNT_ID = 'account-a';

function localNote(overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id: 'note-a',
    title: 'Local title',
    body: 'Local body',
    updatedAt: 20,
    folderId: null,
    deletedAt: null,
    starred: false,
    ...overrides,
  };
}

function remoteNote(overrides: Partial<DbNoteRow> = {}): DbNoteRow {
  return {
    id: 'note-a',
    user_id: ACCOUNT_ID,
    title: 'Remote title',
    body: 'Remote body',
    updated_at: 10,
    folder_id: null,
    deleted_at: null,
    starred: false,
    properties: null,
    relations: null,
    ...overrides,
  };
}

type LegacyOptionalRemoteField = 'starred' | 'properties' | 'relations';

function withoutLegacyFields(
  row: DbNoteRow,
  ...fields: LegacyOptionalRemoteField[]
): DbNoteRow {
  const result = { ...row };
  for (const field of fields) {
    if (field === 'starred') delete result.starred;
    if (field === 'properties') delete result.properties;
    if (field === 'relations') delete result.relations;
  }
  return result;
}

function matchingPair(): { local: NoteBase; remote: DbNoteRow } {
  return {
    local: localNote({ title: 'Same', body: 'Same body', updatedAt: 20 }),
    remote: remoteNote({ title: 'Same', body: 'Same body', updated_at: 20 }),
  };
}

function resolve(
  local: NoteBase,
  remote: DbNoteRow,
  overrides: Partial<{ protectedDeleteConflict: boolean; pendingLocalMutation: boolean }> = {},
) {
  return resolveSameIdNoteAuthority({
    accountId: ACCOUNT_ID,
    local,
    remote,
    protectedDeleteConflict: false,
    pendingLocalMutation: false,
    ...overrides,
  });
}

function observe(
  local: NoteBase,
  remote: DbNoteRow,
  overrides: Partial<{ protectedDeleteConflict: boolean; pendingLocalMutation: boolean }> = {},
) {
  return resolveSameIdNoteAuthorityWithObservation({
    accountId: ACCOUNT_ID,
    local,
    remote,
    protectedDeleteConflict: false,
    pendingLocalMutation: false,
    ...overrides,
  }).observation;
}

describe('Notes bootstrap same-ID revision authority', () => {
  it('preserves a newer active local Note and marks later remote convergence pending', () => {
    const local = localNote();
    expect(resolve(local, remoteNote())).toEqual({
      outcome: 'LOCAL_NEWER',
      resolved: local,
      pendingRemoteSync: true,
      conflict: false,
    });
  });

  it('accepts a newer active authoritative remote Note', () => {
    const result = resolve(localNote({ updatedAt: 10 }), remoteNote({ updated_at: 30 }));
    expect(result).toEqual({
      outcome: 'REMOTE_NEWER',
      resolved: expect.objectContaining({ title: 'Remote title', updatedAt: 30 }),
      pendingRemoteSync: false,
      conflict: false,
    });
  });

  it('retains the local object and local-only metadata for equal canonical payloads', () => {
    const local = localNote({
      title: 'Same', body: 'Same body', updatedAt: 20, createdAt: 1, lastOpenedAt: 99,
      properties: { Topic: 'notes' }, relations: { Related: ['note-b'] },
    });
    const result = resolve(local, remoteNote({
      title: 'Same', body: 'Same body', updated_at: 20,
      properties: { Topic: 'notes' }, relations: { Related: ['note-b'] },
    }));
    expect(result).toEqual({
      outcome: 'EQUAL', resolved: local, pendingRemoteSync: false, conflict: false,
    });
    expect(result.resolved).toBe(local);
  });

  it('uses existing payload normalization for equal canonical payload identity', () => {
    const local = localNote({
      title: 'Same',
      body: 'asset data:image/png;base64,AAAA',
      properties: { ' Topic ': 'notes', Alpha: 'one' },
      relations: { ' Related ': [' note-b ', 'note-b'], Parent: ['note-c'] },
    });
    const result = resolve(local, remoteNote({
      title: 'Same',
      body: 'asset [blob-data-omitted:attachment-boundary]',
      updated_at: 20,
      properties: { Alpha: 'one', Topic: 'notes' },
      relations: { Parent: ['note-c'], Related: ['note-b'] },
    }));
    expect(result.outcome).toBe('EQUAL');
    expect(result.conflict).toBe(false);
    expect(result.resolved).toBe(local);
  });

  it('preserves local and reports conflict for equal revisions with different payloads', () => {
    const local = localNote({ updatedAt: 20 });
    const result = resolve(local, remoteNote({ updated_at: 20 }));
    expect(result).toEqual({
      outcome: 'EQUAL', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it('accepts a newer remote tombstone over an older active local Note', () => {
    const result = resolve(
      localNote({ updatedAt: 10 }),
      remoteNote({ updated_at: 10, deleted_at: 30 }),
    );
    expect(result.outcome).toBe('REMOTE_NEWER');
    expect(result.resolved.deletedAt).toBe(30);
  });

  it('preserves a newer locally restored active Note over an older remote tombstone', () => {
    const local = localNote({ updatedAt: 40, deletedAt: null });
    const result = resolve(local, remoteNote({ updated_at: 10, deleted_at: 30 }));
    expect(result).toEqual({
      outcome: 'LOCAL_NEWER', resolved: local, pendingRemoteSync: true, conflict: false,
    });
  });

  it('preserves a newer local tombstone over an older remote active Note', () => {
    const local = localNote({ updatedAt: 10, deletedAt: 40 });
    const result = resolve(local, remoteNote({ updated_at: 30, deleted_at: null }));
    expect(result).toEqual({
      outcome: 'LOCAL_NEWER', resolved: local, pendingRemoteSync: true, conflict: false,
    });
  });

  it('accepts a newer remote active Note over an older local tombstone', () => {
    const result = resolve(
      localNote({ updatedAt: 10, deletedAt: 20 }),
      remoteNote({ updated_at: 30, deleted_at: null }),
    );
    expect(result.outcome).toBe('REMOTE_NEWER');
    expect(result.resolved.deletedAt).toBeNull();
  });

  it('preserves local on equal effective revision with different deletion state', () => {
    const local = localNote({ updatedAt: 30, deletedAt: null });
    const result = resolve(local, remoteNote({ updated_at: 10, deleted_at: 30 }));
    expect(result).toEqual({
      outcome: 'EQUAL', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it('treats malformed local tombstone chronology as incomparable', () => {
    const local = localNote({ updatedAt: 30, deletedAt: 20 });
    expect(resolve(local, remoteNote({ updated_at: 40 }))).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it('treats malformed remote tombstone chronology as incomparable', () => {
    const local = localNote({ updatedAt: 10 });
    expect(resolve(local, remoteNote({ updated_at: 40, deleted_at: 30 }))).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ])('treats invalid remote revision %s as incomparable', updated_at => {
    const local = localNote({ updatedAt: 10 });
    expect(resolve(local, remoteNote({ updated_at }))).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it('treats an ownership mismatch as incomparable', () => {
    const local = localNote({ updatedAt: 10 });
    expect(resolve(local, remoteNote({ user_id: 'account-b', updated_at: 30 }))).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it.each([
    ['missing starred only', ['starred']],
    ['missing properties only', ['properties']],
    ['missing relations only', ['relations']],
    ['all legacy-optional fields missing', ['starred', 'properties', 'relations']],
  ] as const)('projects %s to canonical defaults for equal comparison', (_name, fields) => {
    const { local, remote } = matchingPair();
    const result = resolve(local, withoutLegacyFields(remote, ...fields));
    expect(result).toEqual({
      outcome: 'EQUAL', resolved: local, pendingRemoteSync: false, conflict: false,
    });
  });

  it.each([
    ['explicit starred false', { starred: false }],
    ['explicit properties null', { properties: null }],
    ['explicit properties empty object', { properties: {} }],
    ['explicit relations null', { relations: null }],
    ['explicit relations empty object', { relations: {} }],
  ] as const)('preserves %s canonical equality', (_name, remoteOverrides) => {
    const { local, remote } = matchingPair();
    expect(resolve(local, { ...remote, ...remoteOverrides })).toMatchObject({
      outcome: 'EQUAL', conflict: false,
    });
  });

  it.each([
    ['own starred undefined', 'starred', undefined],
    ['starred null', 'starred', null],
    ['starred wrong type', 'starred', 'false'],
    ['own properties undefined', 'properties', undefined],
    ['properties array', 'properties', []],
    ['properties invalid nested value', 'properties', { Topic: 1 }],
    ['own relations undefined', 'relations', undefined],
    ['relations array', 'relations', []],
    ['relations invalid target', 'relations', { Related: [1] }],
  ] as const)('keeps %s malformed-present and incomparable', (_name, field, value) => {
    const { local, remote } = matchingPair();
    const malformed = { ...remote, [field]: value } as unknown as DbNoteRow;
    expect(resolveSameIdNoteAuthorityWithObservation({
      accountId: ACCOUNT_ID,
      local,
      remote: malformed,
      protectedDeleteConflict: false,
      pendingLocalMutation: false,
    })).toMatchObject({
      resolution: { outcome: 'INCOMPARABLE', resolved: local, conflict: true },
      observation: {
        conflictSubtype: 'INCOMPARABLE',
        incomparableReason: 'REMOTE_AUTHORITY_SHAPE_INVALID',
      },
    });
  });

  it.each([
    ['missing properties with malformed relations', ['properties'], { relations: [] }],
    ['missing relations with malformed starred', ['relations'], { starred: null }],
  ] as const)('rejects %s', (_name, missing, malformedSibling) => {
    const { local, remote } = matchingPair();
    const malformed = {
      ...withoutLegacyFields(remote, ...missing),
      ...malformedSibling,
    } as unknown as DbNoteRow;
    expect(observe(local, malformed)).toMatchObject({
      outcome: 'INCOMPARABLE',
      incomparableReason: 'REMOTE_AUTHORITY_SHAPE_INVALID',
    });
  });

  it('treats inherited legacy values as absent own properties', () => {
    const { local, remote } = matchingPair();
    const inherited = Object.assign(
      Object.create({ starred: true, properties: { Topic: 1 }, relations: [] }) as object,
      withoutLegacyFields(remote, 'starred', 'properties', 'relations'),
    ) as DbNoteRow;
    expect(resolve(local, inherited)).toMatchObject({ outcome: 'EQUAL', conflict: false });
  });

  it('does not mutate the original remote row while projecting missing fields', () => {
    const { local, remote } = matchingPair();
    const legacyRemote = withoutLegacyFields(remote, 'starred', 'properties', 'relations');
    const original = structuredClone(legacyRemote);
    resolve(local, legacyRemote);
    expect(legacyRemote).toEqual(original);
    expect(Object.hasOwn(legacyRemote, 'starred')).toBe(false);
    expect(Object.hasOwn(legacyRemote, 'properties')).toBe(false);
    expect(Object.hasOwn(legacyRemote, 'relations')).toBe(false);
  });

  it('does not broaden strict remote normalization outside same-ID comparison', () => {
    const legacyRemote = withoutLegacyFields(
      remoteNote(),
      'starred', 'properties', 'relations',
    );
    expect(normalizeAuthoritativeRemoteBootstrapNote(legacyRemote, ACCOUNT_ID)).toBeNull();
  });

  it('preserves revision outcomes after projecting all legacy-optional fields', () => {
    const localNewer = localNote({ title: 'Same', body: 'Same body', updatedAt: 30 });
    const remoteNewer = withoutLegacyFields(remoteNote({
      title: 'Same', body: 'Same body', updated_at: 20,
    }), 'starred', 'properties', 'relations');
    expect(resolve(localNewer, remoteNewer)).toMatchObject({
      outcome: 'LOCAL_NEWER', pendingRemoteSync: true, conflict: false,
    });

    const olderLocal = localNote({ title: 'Same', body: 'Same body', updatedAt: 10 });
    expect(resolve(olderLocal, remoteNewer)).toMatchObject({
      outcome: 'REMOTE_NEWER',
      resolved: { starred: false, properties: undefined, relations: undefined },
      pendingRemoteSync: false,
      conflict: false,
    });
  });

  it.each([
    ['starred', { starred: true }, ['starred']],
    ['properties', { properties: { Topic: 'notes' } }, ['properties']],
    ['relations', { relations: { Related: ['note-b'] } }, ['relations']],
  ] as const)('keeps equal-revision non-default local %s as a payload mismatch', (
    _name,
    localOverrides,
    missing,
  ) => {
    const { local, remote } = matchingPair();
    const result = resolveSameIdNoteAuthorityWithObservation({
      accountId: ACCOUNT_ID,
      local: { ...local, ...localOverrides },
      remote: withoutLegacyFields(remote, ...missing),
      protectedDeleteConflict: false,
      pendingLocalMutation: false,
    });
    expect(result).toMatchObject({
      resolution: { outcome: 'EQUAL', conflict: true },
      observation: { conflictSubtype: 'EQUAL_PAYLOAD_MISMATCH', incomparableReason: null },
    });
  });

  it('lets existing revision authority decide non-default local versus remote absence', () => {
    const newerRemote = withoutLegacyFields(remoteNote({
      title: 'Same', body: 'Same body', updated_at: 30,
    }), 'starred');
    expect(resolve(
      localNote({ title: 'Same', body: 'Same body', updatedAt: 20, starred: true }),
      newerRemote,
    )).toMatchObject({
      outcome: 'REMOTE_NEWER',
      resolved: { starred: false },
      conflict: false,
    });

    const olderRemote = withoutLegacyFields(remoteNote({
      title: 'Same', body: 'Same body', updated_at: 20,
    }), 'properties');
    const newerLocal = localNote({
      title: 'Same', body: 'Same body', updatedAt: 30, properties: { Topic: 'notes' },
    });
    expect(resolve(newerLocal, olderRemote)).toMatchObject({
      outcome: 'LOCAL_NEWER', resolved: newerLocal, conflict: false,
    });
  });

  it('preserves tombstone authority and chronology diagnostics with legacy fields absent', () => {
    const missing = ['starred', 'properties', 'relations'] as const;
    expect(resolve(
      localNote({ updatedAt: 10 }),
      withoutLegacyFields(remoteNote({ updated_at: 10, deleted_at: 30 }), ...missing),
    )).toMatchObject({ outcome: 'REMOTE_NEWER', resolved: { deletedAt: 30 } });

    expect(resolve(
      localNote({ updatedAt: 40 }),
      withoutLegacyFields(remoteNote({ updated_at: 10, deleted_at: 30 }), ...missing),
    )).toMatchObject({ outcome: 'LOCAL_NEWER' });

    expect(resolve(
      localNote({ updatedAt: 30 }),
      withoutLegacyFields(remoteNote({ updated_at: 10, deleted_at: 30 }), ...missing),
    )).toMatchObject({ outcome: 'EQUAL', conflict: true });

    expect(observe(
      localNote({ updatedAt: 10 }),
      withoutLegacyFields(remoteNote({ updated_at: 30, deleted_at: 20 }), ...missing),
    )).toMatchObject({
      outcome: 'INCOMPARABLE',
      incomparableReason: 'REMOTE_TOMBSTONE_CHRONOLOGY_INVALID',
    });
  });

  it('preserves pending mutation, permanent-delete, and account guards with legacy fields absent', () => {
    const remote = withoutLegacyFields(
      remoteNote({ updated_at: 30 }),
      'starred', 'properties', 'relations',
    );
    expect(resolveSameIdNoteAuthorityWithObservation({
      accountId: ACCOUNT_ID,
      local: localNote({ updatedAt: 10 }),
      remote,
      protectedDeleteConflict: false,
      pendingLocalMutation: true,
    })).toMatchObject({
      resolution: { outcome: 'INCOMPARABLE', pendingRemoteSync: true },
      observation: { incomparableReason: 'PENDING_LOCAL_MUTATION' },
    });
    expect(resolveSameIdNoteAuthorityWithObservation({
      accountId: ACCOUNT_ID,
      local: localNote({ updatedAt: 10 }),
      remote,
      protectedDeleteConflict: true,
      pendingLocalMutation: false,
    })).toMatchObject({
      resolution: { outcome: 'INCOMPARABLE' },
      observation: { conflictSubtype: null, incomparableReason: 'PERMANENT_DELETE_PROTECTED' },
    });
    expect(observe(localNote({ updatedAt: 10 }), { ...remote, user_id: 'account-b' }))
      .toMatchObject({
        outcome: 'INCOMPARABLE',
        incomparableReason: 'REMOTE_AUTHORITY_SHAPE_INVALID',
      });
  });

  it('preserves atomic revalidation comparison semantics', () => {
    const current = localNote({ title: 'Same', body: 'Same body', updatedAt: 20 });
    const result = revalidateResolvedBootstrapNotes({
      accountId: ACCOUNT_ID,
      currentDurable: [current],
      previousLocal: [current],
      resolvedCandidate: [{ ...current }],
      authorizedMissingNoteIds: new Set(),
    });
    expect(result.notes).toEqual([current]);
    expect(result.pendingRemoteSyncNotes).toEqual([]);
    expect(result.conflictNoteIds).toEqual([]);
    expect(result.authorityAggregate).toMatchObject({
      authorityOutcomeCounts: { EQUAL: 1, INCOMPARABLE: 0 },
      incomparableReasonCounts: { REMOTE_LEGACY_FIELDS_ABSENT: 0 },
    });
  });

  it('preserves existing permanent-delete authority precedence', () => {
    const local = localNote({ updatedAt: 10 });
    expect(resolve(local, remoteNote({ updated_at: 30 }), { protectedDeleteConflict: true })).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: false, conflict: true,
    });
  });

  it('does not allow a pending local mutation to be superseded', () => {
    const local = localNote({ updatedAt: 10 });
    expect(resolve(local, remoteNote({ updated_at: 30 }), { pendingLocalMutation: true })).toEqual({
      outcome: 'INCOMPARABLE', resolved: local, pendingRemoteSync: true, conflict: true,
    });
  });

  it.each([
    ['PERMANENT_DELETE_PROTECTED', null, localNote(), remoteNote(), { protectedDeleteConflict: true }],
    ['PENDING_LOCAL_MUTATION', 'INCOMPARABLE', localNote(), remoteNote(), { pendingLocalMutation: true }],
    ['NOTE_ID_MISMATCH', 'INCOMPARABLE', localNote(), remoteNote({ id: 'note-b' }), {}],
    ['LOCAL_REVISION_SHAPE_INVALID', 'INCOMPARABLE', localNote({ updatedAt: 1.5 }), remoteNote(), {}],
    ['REMOTE_REVISION_SHAPE_INVALID', 'INCOMPARABLE', localNote(), remoteNote({ updated_at: -1 }), {}],
    [
      'LOCAL_TOMBSTONE_CHRONOLOGY_INVALID',
      'INCOMPARABLE',
      localNote({ updatedAt: 30, deletedAt: 20 }),
      remoteNote(),
      {},
    ],
    [
      'REMOTE_TOMBSTONE_CHRONOLOGY_INVALID',
      'INCOMPARABLE',
      localNote(),
      remoteNote({ updated_at: 30, deleted_at: 20 }),
      {},
    ],
    [
      'LOCAL_AUTHORITY_SHAPE_INVALID',
      'INCOMPARABLE',
      localNote({ starred: 'invalid' as unknown as boolean }),
      remoteNote(),
      {},
    ],
    [
      'REMOTE_AUTHORITY_SHAPE_INVALID',
      'INCOMPARABLE',
      localNote(),
      remoteNote({ starred: 'invalid' as unknown as boolean }),
      {},
    ],
  ] as const)(
    'classifies incomparable authority as %s',
    (reason, conflictSubtype, local, remote, overrides) => {
      const observation = observe(local, remote, overrides);
      expect(observation).toMatchObject({
        outcome: 'INCOMPARABLE',
        conflictSubtype,
        incomparableReason: reason,
      });

      const aggregate = createNotesAuthorityPhaseAggregate();
      recordNotesAuthorityObservation(aggregate, observation);
      expect(snapshotNotesAuthorityPhaseAggregate(aggregate).incomparableReasonCounts[reason]).toBe(1);
    },
  );

  it('does not count a permanent-delete-protected comparison as an authority conflict', () => {
    const aggregate = createNotesAuthorityPhaseAggregate();
    recordNotesAuthorityObservation(
      aggregate,
      observe(localNote(), remoteNote(), { protectedDeleteConflict: true }),
    );

    expect(snapshotNotesAuthorityPhaseAggregate(aggregate)).toMatchObject({
      conflictCount: 0,
      authorityOutcomeCounts: { INCOMPARABLE: 1 },
      conflictSubtypeCounts: { EQUAL_PAYLOAD_MISMATCH: 0, INCOMPARABLE: 0 },
      incomparableReasonCounts: { PERMANENT_DELETE_PROTECTED: 1 },
    });
  });

  it('aggregates all bounded live-state pairs without retaining Note identity', () => {
    const aggregate = createNotesAuthorityPhaseAggregate();
    for (const observation of [
      observe(localNote(), remoteNote()),
      observe(localNote(), remoteNote({ updated_at: 20, deleted_at: 30 })),
      observe(localNote({ updatedAt: 10, deletedAt: 20 }), remoteNote({ updated_at: 30 })),
      observe(
        localNote({ updatedAt: 10, deletedAt: 20 }),
        remoteNote({ updated_at: 10, deleted_at: 20 }),
      ),
    ]) {
      recordNotesAuthorityObservation(aggregate, observation);
    }

    expect(snapshotNotesAuthorityPhaseAggregate(aggregate).liveStatePairCounts).toEqual({
      LIVE_LIVE: 1,
      LIVE_TOMBSTONE: 1,
      TOMBSTONE_LIVE: 1,
      TOMBSTONE_TOMBSTONE: 1,
    });
  });
});
