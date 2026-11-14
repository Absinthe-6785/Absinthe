import { afterEach, expect, it, vi } from 'vitest';
import { notesLaptopPublicationUiEnabled, requestLaptopPublication,
  type LaptopPublicationDependencies, type LaptopPublicationPayload, type LaptopPublicationPreview } from './notesLaptopPublication';

const accountId = 'A';
const snapshot = Object.freeze({ title: 'Private title', body: 'Plain body', updated_at: 10, starred: false });
const payload: LaptopPublicationPayload = { noteId: 'original-id', approvalOperationId: 'operator-operation', snapshot };
const preview: LaptopPublicationPreview = {
  status: 'ELIGIBLE_PREVIEW_ONLY', authority: 'NONE', localNoteId: payload.noteId, snapshot,
  sourceRevision: { authorityGeneration: 1, vaultStructureVersion: 1, indexContentVersion: 1,
    noteUpdatedAt: 10, durableReadback: 'MATCHED', attachmentMetadata: 'COMPLETE_EMPTY' },
  isCurrentInMemory: () => true, isCurrent: async () => true,
};
const verified = { status: 'VERIFIED', noteId: payload.noteId, approvalOperationId: payload.approvalOperationId };
function deps(overrides: Partial<LaptopPublicationDependencies> = {}): LaptopPublicationDependencies {
  return {
    featureEnabled: () => true, isTransportAvailable: () => true, getRuntimeAccountId: () => accountId,
    getSession: vi.fn(async () => ({ data: { session: { access_token: 'user-token', user: { id: accountId } } }, error: null })) as any,
    fetch: vi.fn(async () => new Response(JSON.stringify(verified))), apiUrl: 'https://api.example.test/', ...overrides,
  };
}
afterEach(() => vi.unstubAllEnvs());

it('defaults OFF independently of all Cloud Copy flags and makes no request', async () => {
  vi.stubEnv('VITE_NOTES_LAPTOP_PUBLISH_ENABLED', undefined);
  vi.stubEnv('VITE_NOTES_CLOUD_COPY_ENABLED', 'true');
  expect(notesLaptopPublicationUiEnabled(accountId)).toBe(false);
  const fetch = vi.fn();
  const claim = vi.fn(() => true);
  expect(await requestLaptopPublication('publish', payload, accountId, preview, () => true, claim)).toBe('DISABLED');
  expect(fetch).not.toHaveBeenCalled(); expect(claim).not.toHaveBeenCalled();
});

it.each(['publish', 'status'] as const)('dispatches exactly one explicit %s with only the contracted snapshot and IDs', async mode => {
  const d = deps();
  const prepared = { ...preview, isCurrent: vi.fn(async () => true) };
  const claim = vi.fn(() => true);
  expect(await requestLaptopPublication(mode, payload, accountId, prepared, () => true, claim, d)).toBe('VERIFIED');
  expect(prepared.isCurrent).toHaveBeenCalledTimes(2);
  expect(d.fetch).toHaveBeenCalledTimes(1);
  expect(claim).toHaveBeenCalledTimes(1);
  const [url, init] = vi.mocked(d.fetch).mock.calls[0];
  expect(url).toBe(`https://api.example.test/api/notes/laptop-publication${mode === 'status' ? '/status' : ''}`);
  expect(init?.method).toBe('POST');
  expect(init?.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer user-token' });
  expect(JSON.parse(init?.body as string)).toEqual(payload);
  expect(init?.body).not.toContain('authority'); expect(init?.body).not.toContain('attestation');
});

it('atomically blocks duplicate dispatches even if two submissions already passed async checks', async () => {
  const d = deps(); let claimed = false;
  const claim = () => { if (claimed) return false; claimed = true; return true; };
  const results = await Promise.all([1, 2].map(() => requestLaptopPublication('publish', payload, accountId, preview, () => true, claim, d)));
  expect(results.sort()).toEqual(['REPEAT_BLOCKED', 'VERIFIED']);
  expect(d.fetch).toHaveBeenCalledTimes(1);
});

it.each([
  [423, { detail: 'NOTES_LAPTOP_PUBLISH_DISABLED' }, 'DISABLED'],
  [409, { detail: 'LAPTOP_PUBLICATION_APPROVAL_REQUIRED' }, 'CONFLICT'],
  [400, { detail: 'INVALID_LAPTOP_PUBLICATION_REQUEST' }, 'BAD_REQUEST'],
  [503, { detail: 'LAPTOP_PUBLICATION_UNAVAILABLE' }, 'UNAVAILABLE'],
  [503, { detail: 'LAPTOP_PUBLICATION_INDETERMINATE' }, 'INDETERMINATE'],
  [503, { detail: 'unavailable' }, 'INDETERMINATE'],
  [503, { detail: { secret: 'not rendered' } }, 'INDETERMINATE'],
] as const)('maps HTTP %s bounded detail without retry', async (status, body, expected) => {
  const d = deps({ fetch: vi.fn(async () => new Response(JSON.stringify(body), { status })) });
  expect(await requestLaptopPublication('publish', payload, accountId, preview, () => true, () => true, d)).toBe(expected);
  expect(d.fetch).toHaveBeenCalledTimes(1);
});

it.each([
  { ...verified, noteId: 'other-id' }, { ...verified, approvalOperationId: 'other-operation' },
  { ...verified, status: 'created' }, null, [],
])('does not verify a malformed or wrong-identity response: %j', async body => {
  const d = deps({ fetch: vi.fn(async () => new Response(JSON.stringify(body))) });
  expect(await requestLaptopPublication('publish', payload, accountId, preview, () => true, () => true, d)).toBe('INDETERMINATE');
});

it('claims the write before an ambiguous network exception and never retries or reads automatically', async () => {
  const claim = vi.fn(() => true);
  const d = deps({ fetch: vi.fn(async () => { expect(claim).toHaveBeenCalledTimes(1); throw Error('lost response'); }) });
  expect(await requestLaptopPublication('publish', payload, accountId, preview, () => true, claim, d)).toBe('INDETERMINATE');
  expect(d.fetch).toHaveBeenCalledTimes(1);
});

it.each(['durable', 'memory', 'owner', 'runtime', 'session', 'snapshot', 'operation', 'path'] as const)('does not dispatch when %s validation fails', async kind => {
  const d = deps(); const claim = vi.fn(() => true);
  let prepared = preview; let input = payload; let current = () => true;
  if (kind === 'durable') prepared = { ...preview, isCurrent: async () => false };
  if (kind === 'memory') prepared = { ...preview, isCurrentInMemory: () => false };
  if (kind === 'owner') current = () => false;
  if (kind === 'runtime') d.getRuntimeAccountId = () => 'B';
  if (kind === 'session') d.getSession = async () => ({ data: { session: { access_token: 'token', user: { id: 'B' } } }, error: null }) as any;
  if (kind === 'snapshot') input = { ...payload, snapshot: { ...snapshot, body: 'Changed' } };
  if (kind === 'operation') input = { ...payload, approvalOperationId: '' };
  if (kind === 'path') d.apiUrl = 'https://api.example.test/other';
  expect(await requestLaptopPublication('publish', input, accountId, prepared, current, claim, d)).not.toBe('VERIFIED');
  expect(d.fetch).not.toHaveBeenCalled(); expect(claim).not.toHaveBeenCalled();
});

it('rechecks the durable snapshot after auth and fences an A-B-A request generation change', async () => {
  let generation = 1;
  const d = deps({ getSession: async () => { generation = 3; return deps().getSession(); } });
  expect(await requestLaptopPublication('publish', payload, accountId, preview, () => generation === 1, () => true, d)).toBe('STALE_RESULT');
  expect(d.fetch).not.toHaveBeenCalled();
  const next = deps();
  const prepared = { ...preview, isCurrent: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false) };
  expect(await requestLaptopPublication('publish', payload, accountId, prepared, () => true, () => true, next)).toBe('SOURCE_CHANGED');
  expect(next.fetch).not.toHaveBeenCalled();
});

it('suppresses an in-flight result after invalidation, including while reading JSON', async () => {
  let current = true; let finish!: (value: unknown) => void; let started!: () => void;
  const reading = new Promise<void>(resolve => { started = resolve; });
  const d = deps({ fetch: vi.fn(async () => ({ ok: true, status: 200, json: () => {
    started(); return new Promise(resolve => { finish = resolve; });
  } })) as any });
  const pending = requestLaptopPublication('publish', payload, accountId, preview, () => current, () => true, d);
  await reading; current = false; finish(verified);
  expect(await pending).toBe('STALE_RESULT'); expect(d.fetch).toHaveBeenCalledTimes(1);
});
