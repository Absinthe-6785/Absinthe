import { Fixture, PROTOCOL, assertOrigin, assertManifest, identifier, keyFor, lockFor } from './core.mjs';

const element = (tag, text, parent = document.body) => {
  const node = document.createElement(tag); node.textContent = text; parent.append(node); return node;
};
const download = (name, bytes) => {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/json' }));
  const link = element('a', 'Download export'); link.href = url; link.download = name;
  link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const sha256 = async (bytes) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map((byte) => byte.toString(16).padStart(2, '0')).join('');
// Generated once when this module executes. A BFCache return does not execute it again.
const documentInstanceId = crypto.randomUUID();

// Called by the immutable role-specific boot module, not a mutable latest endpoint.
export async function boot(loadedArtifact) {
  document.body.replaceChildren();
  element('h1', `${loadedArtifact.role} — qualification only`);
  element('p', 'NOT physical qualification, retirement proof, compatible-creator admission, or product authority.');
  const identity = element('pre', JSON.stringify(loadedArtifact, null, 2));
  identity.className = 'identity';
  element('p', `Origin: ${location.origin} · Path: ${location.pathname}`);
  element('p', `Fresh document instance: ${documentInstanceId} (not a process ID)`);
  element('p', 'Only synthetic run/action labels. Never enter accounts, credentials or personal data. Pair participants use the SAME run/origin/key/lock; do not copy token values into a peer.');
  const alert = element('p', 'Preflight…'); alert.setAttribute('role', 'status');
  let manifestSha256;
  try {
    assertOrigin(location.origin);
    if (loadedArtifact.protocolVersion !== PROTOCOL) throw new Error('PROTOCOL_MISMATCH');
    if (navigator.serviceWorker?.controller) throw new Error('WORKER_PRESENT');
    if (navigator.serviceWorker && (await navigator.serviceWorker.getRegistrations()).length) {
      throw new Error('WORKER_PRESENT');
    }
    const response = await fetch(loadedArtifact.manifestPath, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('MANIFEST_UNAVAILABLE');
    const bytes = await response.arrayBuffer(); manifestSha256 = await sha256(bytes);
    const manifest = JSON.parse(new TextDecoder().decode(bytes));
    assertManifest(manifest, loadedArtifact);
    // Check every delivered asset; current-realm provenance, NOT trusted execution attestation.
    for (const asset of manifest.assets) {
      const fetched = await fetch(asset.path, { cache: 'no-store', credentials: 'omit' });
      const data = await fetched.arrayBuffer();
      if (!fetched.ok || data.byteLength !== asset.size || await sha256(data) !== asset.sha256) {
        throw new Error('ASSET_HASH_MISMATCH');
      }
    }
    element('p', `Fetched build manifest SHA-256: ${manifestSha256}. Embedded boot identity above identifies this execution; fetched-byte hashes are provenance, not browser attestation.`);
    alert.textContent = 'Preflight OK. Start only after review/merge and separate physical-run authorization. No run starts automatically.';
  } catch (error) {
    alert.textContent = `STOP: isolated-origin/worker/artifact preflight failed (${error.name}). No Storage/lock access performed. Do not clear site data or unregister workers.`;
    return;
  }
  const setup = element('section', '');
  const input = (label, value) => {
    const wrapper = element('label', label, setup); const node = document.createElement('input');
    node.value = value; node.maxLength = 64; node.autocomplete = 'off'; wrapper.append(node); return node;
  };
  const query = new URLSearchParams(location.search);
  const run = input('Synthetic run ID ', query.get('run') ?? `r-${crypto.randomUUID()}`);
  const test = input('Test ID (e.g. A1) ', query.get('test') ?? 'setup');
  const action = input('Action ID (use sequence/video for cross-instance order) ', 'a001');
  let fixture; let currentToken = 'NOT_READ';
  const status = element('pre', 'Run not started.'); status.setAttribute('aria-live', 'polite');
  const eventDetails = element('details', ''); element('summary', 'Raw own-instance event log / lock timestamps', eventDetails);
  const eventLog = element('pre', 'No run events yet.', eventDetails);
  const actions = element('section', '');
  const update = () => {
    if (!fixture) return;
    status.textContent = JSON.stringify({ runId: fixture.runId, testId: fixture.testId,
      role: fixture.role, instanceId: fixture.instanceId, protocolVersion: PROTOCOL,
      buildId: fixture.provenance.buildId, key: keyFor(fixture.runId, 'scope-token'),
      lock: lockFor(fixture.runId), lockStatus: fixture.lockStatus,
      tokenExactBytes: currentToken, flush: fixture.flushStatus, error: fixture.lastError,
      capabilities: fixture.capabilities, restoreClass: 'UNKNOWN — classify manually from raw events' }, null, 2);
    eventLog.textContent = JSON.stringify(fixture.eventView(), null, 2);
  };
  const button = (label, fn, parent = actions) => {
    const node = element('button', label, parent); node.type = 'button';
    node.addEventListener('click', () => Promise.resolve().then(fn).catch((error) => {
      alert.textContent = `Action failed: ${error.name}. Keep failure evidence; do not clear/reseed as success.`;
      fixture?.error('UI_ACTION_FAILED'); update();
    })); return node;
  };
  const actionId = () => identifier(action.value);
  const start = button('Start synthetic run', async () => {
    const registrations = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
    fixture = new Fixture({ runId: run.value, testId: test.value, role: loadedArtifact.role,
      provenance: { ...loadedArtifact, manifestSha256 } }, {
      origin: location.origin, storage: localStorage, uuid: () => crypto.randomUUID(), documentInstanceId,
      locks: loadedArtifact.role === 'CURRENT_FIXTURE' ? navigator.locks : undefined,
      locksAvailable: typeof navigator.locks?.request === 'function',
      secureContext: isSecureContext, workerControlled: Boolean(navigator.serviceWorker?.controller),
      workerRegistered: registrations.length > 0,
      displayMode: matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
        ? 'standalone-observed' : 'browser-or-other',
      wall: () => Date.now(), timeOrigin: performance.timeOrigin, now: () => performance.now(),
      visibility: () => document.visibilityState, navigationType: performance.getEntriesByType('navigation')[0]?.type,
      // Core invokes ports as methods; native timers require the Window receiver.
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (id) => window.clearTimeout(id), changed: update,
    });
    start.disabled = true; run.disabled = true; test.disabled = true;
    for (const node of actions.querySelectorAll('button')) node.disabled = false;
    for (const role of ['old', 'current', 'neutral']) {
      const url = new URL(`/${loadedArtifact.buildId}/${role}/`, location.origin);
      url.searchParams.set('run', fixture.runId); url.searchParams.set('test', fixture.testId);
      const link = element('a', `${role.toUpperCase()} same-run link `); link.href = url.href;
    }
    if (fixture.previousInstances.length) {
      const select = document.createElement('select');
      for (const id of fixture.previousInstances) { const option = element('option', id, select); option.value = id; }
      document.body.append(select);
      button('Export previous flushed raw log', () => {
        const raw = fixture.previousLog(select.value);
        if (raw === null) throw new Error('PREVIOUS_LOG_MISSING');
        download(`${fixture.runId}-${select.value}-retained-events.json`, raw);
      });
    }
    document.addEventListener('visibilitychange', () => fixture.lifecycle('visibilitychange'));
    window.addEventListener('pagehide', (event) => fixture.lifecycle('pagehide', event.persisted));
    window.addEventListener('pageshow', (event) => fixture.lifecycle('pageshow', event.persisted,
      performance.getEntriesByType('navigation')[0]?.type));
    update();
  }, setup);
  button('Mark action only', () => { fixture.action(actionId(), 'OPERATOR_MARK'); update(); });
  button(loadedArtifact.role === 'OLD_FIXTURE' ? 'OLD noncooperating raw token write' : 'Write fresh token + own-read control',
    () => { currentToken = fixture.writeToken(actionId()); update(); });
  button('Read exact token', () => { currentToken = fixture.readToken(actionId()); update(); });
  button('Copy displayed synthetic token', async () => {
    if (!/^qual-[a-f0-9-]{36}$/.test(currentToken)) throw new Error('NO_SYNTHETIC_TOKEN');
    fixture.action(actionId(), 'COPY_OWN_TOKEN'); await navigator.clipboard.writeText(currentToken);
  });
  button('Remove exact token only (not a successful retest)', () => { fixture.clearToken(actionId()); currentToken = 'REMOVED'; update(); });
  if (loadedArtifact.role === 'CURRENT_FIXTURE') {
    button('Request exclusive test lock (60s safety budget)', () => { const trial = fixture.requestLock(actionId()); update(); return trial; });
    button('Release / cancel test lock', () => fixture.releaseLock(actionId()));
  }
  button('Export own instance JSON', () => download(`${fixture.runId}-${fixture.instanceId}-events.json`, fixture.export(actionId())));
  button('Cleanup exact known run keys after export', async () => {
    if (!confirm('Export first. Coordinate with peers; cleanup ends this run. Only known exact run keys are removed. Continue?')) return;
    await fixture.cleanup(actionId());
    for (const node of actions.querySelectorAll('button')) node.disabled = true;
    alert.textContent = 'Run closed. Unknown/orphan logs are NOT enumerated or removed. Open a new run URL to continue.';
  });
  for (const node of actions.querySelectorAll('button')) node.disabled = true;
  element('p', 'Protocol S: fresh peer token read, reverse and repeat; do not paste tokens into peers. Protocol L: verify HELD, request in peer, release, verify acquisition, reverse. Timeout/absence is INCONCLUSIVE, never retirement or different scope.');
  element('p', 'Export and release locks BEFORE navigation/close/offline trials. No unload handler, membership channel or Service Worker. BFCache result requires pageshow.persisted=true with retained instance; missing events remain UNKNOWN. IDB probe omitted, never infer IDB from Storage.');
}
