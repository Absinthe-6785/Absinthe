// @vitest-environment happy-dom
import { request } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { createServer, resolveConfig, type ViteDevServer } from 'vite';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { readRecipeDraft } from '../src/components/views/features/recipe/recipeDraftStorage';
import { RecipeView } from '../src/components/views/RecipeView';
import { API_URL } from '../src/lib/config';
import { accountBoundRemoteFetcher, accountBoundRemoteKey } from '../src/lib/accountBoundRemote';
import { setRuntimeAccountSyncAccount } from '../src/lib/remoteBoundary';

// Load the Node/Workerd fixture outside Vite's browser-like module transform.
const { alice, eve, openSignedFixture, signedClient } = createRequire(resolve('package.json'))(
  '../prototypes/recipe-d1-local/fixture.mjs',
) as typeof import('../../prototypes/recipe-d1-local/fixture.mjs');
const { fetch: nodeFetch } = createRequire(resolve('../prototypes/recipe-d1-local/package.json'))('undici');

const test = vi.hoisted(() => ({
  token: '',
  sessionGate: null as Promise<void> | null,
  studio: null as Record<string, any> | null,
  form: null as Record<string, any> | null,
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (url: string) => {
    if (url !== 'http://127.0.0.1:54321') throw new Error('Non-QA Auth URL');
    return { auth: { getSession: async () => {
      await test.sessionGate;
      return { data: { session: { access_token: test.token } } };
    } } };
  },
}));
vi.mock('../src/store/useNotesStore', () => ({
  useNotesStore: (select: (v: Record<string, unknown>) => unknown) => select({ createNote: vi.fn(), updateNote: vi.fn() }),
}));
vi.mock('../src/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  resolveAppLanguage: () => 'en',
}));
vi.mock('../src/components/views/features/recipe/components/RecipeStudioView', () => ({
  RecipeStudioView: (props: Record<string, any>) => { test.studio = props; return null; },
}));
vi.mock('../src/components/views/features/recipe/components/RecipeListParts', () => ({
  RecipeFormModal: (props: Record<string, any>) => { test.form = props; return null; },
}));

const origin = 'http://127.0.0.1:5177';
const collection = '/api/recipes';
const firstDraft = { title: 'Synthetic base', category: 'Other', ingredients: 'rice', steps: '', memo: '', starred: false };
const calls: Array<{ method: string; path: string; status: number }> = [];
const blockedTargets: string[] = [];
const toast = vi.fn();
let dev: ViteDevServer | undefined;
let worker: Awaited<ReturnType<typeof openSignedFixture>> | undefined;
let root: Root | undefined;
let host: HTMLDivElement | undefined;
let dropPatchResponse = false;
let dropStarResponse = false;
let holdPatchJson: ((json: () => Promise<unknown>) => Promise<unknown>) | undefined;
let redirectSave = false;
let redirectMode: RequestRedirect | undefined;
let redirectReplies = 0;
let redirectTargetHits = 0;

function localHttp(target: URL, init?: RequestInit): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const req = request(target, { method: init?.method, headers: Object.fromEntries(new Headers(init?.headers)) }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('error', reject);
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), {
        status: res.statusCode, headers: { 'content-type': res.headers['content-type'] ?? '' },
      })));
    });
    req.on('error', reject);
    req.end(typeof init?.body === 'string' ? init.body : undefined);
  });
}

// Exercise the actual Vite proxy over HTTP without letting the DOM fixture
// contact any origin or route besides the candidate's Recipe boundary.
const localFetch = vi.fn(async (input: string | URL, init?: RequestInit) => {
  const target = new URL(input);
  if (target.origin !== origin || !/^\/api\/recipes(?:\/|$)/.test(target.pathname)) {
    blockedTargets.push(target.origin + target.pathname);
    throw new Error('Non-QA request denied');
  }
  const method = init?.method ?? 'GET';
  if (redirectSave && method === 'POST') {
    redirectMode = init?.redirect;
    return await nodeFetch(target.href, init);
  }
  const response = await localHttp(target, init);
  calls.push({ method, path: target.pathname, status: response.status });
  if (method === 'PATCH' && dropPatchResponse && response.ok) throw new TypeError('Synthetic response loss after commit');
  if (method === 'PUT' && dropStarResponse && response.ok) throw new TypeError('Synthetic favorite response loss after commit');
  if (method === 'PATCH' && holdPatchJson) {
    const hold = holdPatchJson;
    const json = response.json.bind(response);
    response.json = () => hold(json);
  }
  return response;
});

beforeAll(async () => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  expect(API_URL).toBe(origin);
  worker = await openSignedFixture({ port: 8787 });
  dev = await createServer({
    mode: 'recipe-worker-qa',
    // This test serves API traffic only. Do not start an unrelated background
    // HTML dependency scan or watchers that would race proxy teardown.
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { hmr: false, watch: null },
    plugins: [{
      name: 'test-local-redirect',
      enforce: 'pre',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/__recipe-redirect-target') {
            redirectTargetHits++;
            res.statusCode = 204;
            res.end();
          } else if (redirectSave && req.url === collection && req.method === 'POST') {
            redirectReplies++;
            res.statusCode = 307;
            res.setHeader('Location', origin + '/__recipe-redirect-target');
            res.end();
          } else next();
        });
      },
    }],
  });
  await dev.listen();
  vi.stubGlobal('fetch', localFetch);
  test.token = await worker.token(alice, { session_id: 'mounted-client-a' });
  setRuntimeAccountSyncAccount(alice, headers => headers.set('Authorization', `Bearer ${test.token}`));
}, 30_000);

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  host?.remove();
  localStorage.clear();
  dropPatchResponse = false;
  dropStarResponse = false;
  holdPatchJson = undefined;
  redirectSave = false;
  expect(blockedTargets).toEqual([]);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  setRuntimeAccountSyncAccount(null);
  await Promise.all([dev?.close(), worker?.mf.dispose()]);
});

async function until(check: () => void) {
  await vi.waitFor(async () => {
    await act(async () => { await Promise.resolve(); });
    check();
  }, { timeout: 5_000 });
}

async function mount() {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root?.render(createElement(SWRConfig, {
    value: { provider: () => new Map(), shouldRetryOnError: false, revalidateOnFocus: false },
  }, createElement(RecipeView, {
    accountId: alice, appSettings: { darkMode: true, defaultCategory: 'Other', defaultColor: 'blue', language: 'en' },
    updateSetting: vi.fn(), showToast: toast, THEME_COLORS: [],
    theme: { card: '', input: '', border: '', text: '', textMuted: '', hoverBg: '' },
  }))));
  await until(() => expect(test.studio?.activeAvailability).toMatch(/^READY_/));
}

const setTitle = (title: string) => act(async () => test.form?.setForm({ ...firstDraft, title }));
const save = () => act(async () => { await test.form?.onSave(); });

it('leaves normal Vite dev/build routing untouched and rejects a QA production build', async () => {
  for (const command of ['serve', 'build'] as const) {
    const normal = await resolveConfig({
      mode: command === 'serve' ? 'development' : 'production', envDir: false, envPrefix: [],
    }, command);
    expect(normal.server.proxy).toBeUndefined();
    expect(normal.define?.['import.meta.env.VITE_API_URL']).toBeUndefined();
    expect(normal.define?.['import.meta.env.VITE_SUPABASE_URL']).toBeUndefined();
  }
  await expect(resolveConfig({ mode: 'recipe-worker-qa' }, 'build')).rejects.toThrow('local dev only');
}, 20_000);

it('proxies the exact collection with a query but does not forward a neighboring API path', async () => {
  const headers = { authorization: `Bearer ${test.token}`, 'X-Recipe-QA-Expected-Account': alice };
  const forwarded = await localHttp(new URL(collection + '?category=Other', origin), { headers });
  expect(forwarded.status).toBe(200);
  expect(await forwarded.json()).toEqual(expect.any(Array));
  const unrelated = await localHttp(new URL(collection + '-neighbor', origin), { headers });
  expect(unrelated.status).toBe(404);
  expect(await unrelated.text()).toBe('');
});

it('mounts the existing workspace, confirms create and edit, preserves a conflicting draft and a lost-ack draft', async () => {
  const b = signedClient(worker!.mf, await worker!.token(alice, { session_id: 'second-client-b' }));
  await mount();
  await act(async () => test.studio?.onNewRecipe());
  await setTitle(firstDraft.title);
  expect(readRecipeDraft(alice).draft?.form.title).toBe(firstDraft.title);
  await save();
  expect(toast).toHaveBeenCalledWith('recipeSaved');
  expect(readRecipeDraft(alice).draft).toBeNull();
  const [initial] = await (await b('GET')).json();
  await until(() => expect(test.studio?.recipes[0]?.id).toBe(initial.id));
  const path = collection + '/' + initial.id;
  await act(async () => test.studio?.onEdit(test.studio.recipes[0]));
  await setTitle('Confirmed edit from mounted client');
  await save();
  expect(toast).toHaveBeenCalledWith('recipeUpdated');
  const updated = await (await b('GET', path)).json();
  expect(updated).toMatchObject({ id: initial.id, title: 'Confirmed edit from mounted client' });
  expect(updated.edit_revision).not.toBe(initial.edit_revision);
  await until(() => expect(test.studio?.recipes[0]?.edit_revision).toBe(updated.edit_revision));

  await act(async () => test.studio?.onEdit(test.studio.recipes[0]));
  await setTitle('Unsubmitted A draft');
  const winner = await b('PATCH', path, { ...firstDraft, title: 'B wins', expected_revision: updated.edit_revision });
  expect(winner.status).toBe(200);
  await save();
  expect(calls.at(-1)).toEqual({ method: 'PATCH', path, status: 409 });
  expect(test.form?.conflict).toBe('remote-changed');
  expect(readRecipeDraft(alice).draft?.form.title).toBe('Unsubmitted A draft');
  expect((await (await b('GET', path)).json()).title).toBe('B wins');

  // Explicitly accept the new base using the app's existing conflict action.
  await act(async () => test.form?.onUseLocal());
  await setTitle('Committed with response lost');
  dropPatchResponse = true;
  const sentBefore = calls.filter(call => call.method === 'PATCH').length;
  await save();
  expect(toast).toHaveBeenCalledWith('failSaveRecipe', 'error');
  expect(readRecipeDraft(alice).draft?.form.title).toBe('Committed with response lost');
  expect(calls.filter(call => call.method === 'PATCH')).toHaveLength(sentBefore + 1);
  expect((await (await b('GET', path)).json()).title).toBe('Committed with response lost');
  expect(calls.filter(call => call.method === 'POST')).toHaveLength(1);
}, 30_000);

it('rejects a replaced SDK credential for the previously rendered account on both read and Save', async () => {
  await mount();
  await act(async () => test.studio?.onNewRecipe());
  await setTitle('Draft captured for A only');
  const priorToken = test.token;
  const bToken = await worker!.token(eve, { session_id: 'signed-account-b' });
  const b = signedClient(worker!.mf, bToken, eve);
  // Reproduce the window after SDK replacement but before the shell/View
  // account update. A valid token for B must not authorize A's read or write.
  test.token = bToken;
  try {
    const key = accountBoundRemoteKey(API_URL + collection, alice, 'recipes')!;
    await expect(accountBoundRemoteFetcher(key)).rejects.toThrow('401');
    expect(calls.at(-1)).toEqual({ method: 'GET', path: collection, status: 401 });
    await save();
    expect(calls.at(-1)).toEqual({ method: 'POST', path: collection, status: 401 });
    expect(readRecipeDraft(alice).draft?.form.title).toBe('Draft captured for A only');
    expect(await (await b('GET')).json()).toEqual([]);
  } finally {
    test.token = priorToken;
  }

  // A request still acquiring credentials cannot resume after A→B→A.
  const count = calls.length;
  let release!: () => void;
  test.sessionGate = new Promise<void>(resolve => { release = resolve; });
  const pending = accountBoundRemoteFetcher(accountBoundRemoteKey(API_URL + collection, alice, 'recipes')!);
  const denied = expect(pending).rejects.toThrow('Read session is no longer current');
  setRuntimeAccountSyncAccount(eve, headers => headers.set('Authorization', `Bearer ${bToken}`));
  setRuntimeAccountSyncAccount(alice, headers => headers.set('Authorization', `Bearer ${priorToken}`));
  test.sessionGate = null;
  release();
  await denied;
  expect(calls).toHaveLength(count);
}, 15_000);

it.each([200, 409])('suppresses PATCH %i publication if the same-account session changes during JSON read', async status => {
  const b = signedClient(worker!.mf, await worker!.token(alice));
  const seed = await b('POST', collection, { ...firstDraft, title: `Synthetic session test ${status}` });
  expect(seed.status).toBe(200);
  const initial = await seed.json();
  const path = collection + '/' + initial.id;
  await mount();
  await act(async () => test.studio?.onEdit(test.studio.recipes.find((row: { id: string }) => row.id === initial.id)));
  const title = `Draft for revoked session ${status}`;
  await setTitle(title);
  if (status === 409) {
    expect((await b('PATCH', path, { ...firstDraft, title: 'B wins again', expected_revision: initial.edit_revision })).status).toBe(200);
  }
  let reached!: () => void;
  const jsonEntered = new Promise<void>(resolve => { reached = resolve; });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  holdPatchJson = async json => { reached(); await held; return json(); };
  const newToken = await worker!.token(alice, { session_id: 'replacement-while-reading-json' });
  toast.mockClear();
  await act(async () => {
    const saving = test.form?.onSave();
    await Promise.race([jsonEntered, Promise.resolve(saving).then(() => { throw new Error('PATCH did not reach JSON hold'); })]);
    test.token = newToken;
    setRuntimeAccountSyncAccount(alice, headers => headers.set('Authorization', `Bearer ${newToken}`));
    release();
    await saving;
  });
  expect(calls.at(-1)).toEqual({ method: 'PATCH', path, status });
  expect(toast).not.toHaveBeenCalledWith('recipeUpdated');
  expect(readRecipeDraft(alice).draft?.form.title).toBe(title);
  expect(test.form?.conflict).toBeNull();
  expect(test.studio?.recipes.find((row: { id: string }) => row.id === initial.id)?.edit_revision).toBe(initial.edit_revision);
  expect((await (await b('GET', path)).json()).title).toBe(status === 200 ? title : 'B wins again');
}, 15_000);

it('does not follow a loopback 307 on Save or clear the draft', async () => {
  await mount();
  await act(async () => test.studio?.onNewRecipe());
  await setTitle('Draft must not follow a redirect');
  redirectSave = true;
  toast.mockClear();
  await save();
  expect(toast).toHaveBeenCalledWith('failSaveRecipe', 'error');
  expect(redirectMode).toBe('error');
  expect(redirectReplies).toBe(1);
  expect(redirectTargetHits).toBe(0);
  expect(readRecipeDraft(alice).draft?.form.title).toBe('Draft must not follow a redirect');
}, 15_000);

it('loads account-owned trash and confirms a favorite through the mounted workspace and second client', async () => {
  const b = signedClient(worker!.mf, await worker!.token(alice, { session_id: 'favorite-second-client' }));
  const other = signedClient(worker!.mf, await worker!.token(eve), eve);
  const create = async (client: typeof b, title: string) => {
    const response = await client('POST', collection, { ...firstDraft, title });
    expect(response.status).toBe(200);
    return response.json();
  };
  const active = await create(b, 'Synthetic favorite');
  const newer = await create(b, 'Mine newer');
  const older = await create(b, 'Mine older');
  const foreign = await create(other, 'Hidden foreign trash');
  const deletionA = '2025-01-04T00:00:00.000Z';
  const deletionB = '2025-01-02T00:00:00.000Z';
  for (const [row, when] of [[newer, deletionA], [older, deletionB], [foreign, deletionA]]) {
    await worker!.db!.prepare('UPDATE recipes SET deleted_at=? WHERE id=?').bind(when, row.id).run();
  }
  await mount();
  await until(() => expect(test.studio?.trashAvailability).toBe('READY_WITH_DATA'));
  expect(test.studio?.deletedRecipes).toEqual([
    { ...newer, deleted_at: deletionA }, { ...older, deleted_at: deletionB },
  ]);
  expect(calls).toContainEqual({ method: 'GET', path: collection + '/trash', status: 200 });
  expect(test.studio?.recipes.some((row: { id: string }) => row.id === newer.id)).toBe(false);

  const readActive = () => test.studio?.recipes.find((row: { id: string }) => row.id === active.id);
  const path = collection + '/' + active.id;
  const favorites = () => calls.filter(c => c.method === 'PUT' && c.path === path + '/star');
  const start = calls.length;
  await act(async () => { await test.studio?.onToggleStar(readActive()); });
  const saved = await (await b('GET', path)).json();
  expect(saved.edit_revision).not.toBe(active.edit_revision);
  expect(saved).toEqual({ ...active, starred: true, edit_revision: saved.edit_revision });
  await until(() => expect(readActive()).toEqual(saved));
  expect(favorites()).toEqual([{ method: 'PUT', path: path + '/star', status: 200 }]);

  // The revalidation reconciles a committed favorite with a lost reply without another PUT.
  dropStarResponse = true;
  toast.mockClear();
  await act(async () => { await test.studio?.onToggleStar(readActive()); });
  expect(toast).toHaveBeenCalledWith('failSaveRecipe', 'error');
  const reconciled = await (await b('GET', path)).json();
  expect(reconciled.edit_revision).not.toBe(saved.edit_revision);
  expect(reconciled).toEqual({ ...saved, starred: false, edit_revision: reconciled.edit_revision });
  await until(() => expect(readActive()).toEqual(reconciled));
  expect(favorites()).toHaveLength(2);
  expect(calls.slice(start).filter(c => c.method !== 'GET')).toEqual(favorites());
}, 20_000);

it('preserves a mounted editor draft after a second device changes only the favorite', async () => {
  const b = signedClient(worker!.mf, await worker!.token(alice, { session_id: 'second-client-star-conflict' }));
  const seeded = await b('POST', collection, { ...firstDraft, title: 'Synthetic favorite conflict' });
  expect(seeded.status).toBe(200);
  const initial = await seeded.json();
  const path = collection + '/' + initial.id;
  await mount();
  await act(async () => test.studio?.onEdit(test.studio.recipes.find((row: { id: string }) => row.id === initial.id)));
  await setTitle('Draft before another device starred');
  const result = await b('PUT', path + '/star', { starred: true });
  expect(result.status).toBe(200);
  const starred = await result.json();
  await save();
  expect(calls.at(-1)).toEqual({ method: 'PATCH', path, status: 409 });
  expect(test.form?.conflict).toBe('remote-changed');
  expect(readRecipeDraft(alice).draft?.form.title).toBe('Draft before another device starred');
  expect((await (await b('GET', path)).json())).toEqual(starred);
}, 15_000);
