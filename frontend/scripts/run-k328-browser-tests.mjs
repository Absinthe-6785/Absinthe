import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const chromePath = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const fixturePath = '/tests/k328-browser-fixture.html';
const started = Date.now();
const results = [];

function assertion(condition, name, detail = '') {
  if (!condition) throw new Error(`${name}${detail ? `: ${detail}` : ''}`);
  results.push(name);
}

async function waitForHttp(url, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if ((await fetch(url)).ok) return; } catch { /* startup polling */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForDevToolsPort(profile, timeout = 20_000) {
  const file = join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const [port] = (await readFile(file, 'utf8')).trim().split(/\r?\n/);
      if (/^[0-9]+$/.test(port)) return Number(port);
    } catch { /* startup polling */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for Chrome DevToolsActivePort');
}

class Cdp {
  constructor(url) {
    this.url = url;
    this.id = 0;
    this.pending = new Map();
  }
  async connect() {
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('CDP connection closed'));
      this.pending.clear();
    });
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    await this.send('Runtime.enable');
    await this.send('Page.enable');
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Timed out waiting for CDP ${method}`));
      }, 20_000);
      this.pending.set(id, {
        resolve: value => { clearTimeout(timeout); resolve(value); },
        reject: error => { clearTimeout(timeout); reject(error); },
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  close() { this.socket.close(); }
}

async function newPage(url, debugPort) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const target = await response.json();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.connect();
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await cdp.evaluate('Boolean(window.k328)')) return { cdp, targetId: target.id };
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  cdp.close();
  throw new Error('fixture did not initialize');
}

async function closePage(page, debugPort) {
  await fetch(`http://127.0.0.1:${debugPort}/json/close/${page.targetId}`).catch(() => undefined);
  page.cdp.close();
}

async function waitFor(page, expression, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.cdp.evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out: ${expression}`);
}

async function viteOrigin(server) {
  const address = server.httpServer?.address();
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a TCP address');
  return `http://127.0.0.1:${address.port}`;
}

const profile = await mkdtemp(join(tmpdir(), 'absinthe-k328-chrome-'));
const frontendRoot = fileURLToPath(new URL('..', import.meta.url));
let vite;
let viteSecond;
let chrome;
let debugPort;
let pageA;
let pageB;
let pageOther;

try {
  vite = await createViteServer({
    root: frontendRoot, configFile: false, logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  viteSecond = await createViteServer({
    root: frontendRoot, configFile: false, logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await Promise.all([vite.listen(), viteSecond.listen()]);
  const origin = await viteOrigin(vite);
  const secondOrigin = await viteOrigin(viteSecond);

  chrome = spawn(chromePath, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--remote-allow-origins=*', '--no-first-run', '--disable-default-apps',
    '--disable-background-networking', '--disable-gpu', '--disable-gpu-compositing',
    '--disable-features=SkiaGraphite,DawnGraphite,Vulkan', '--no-sandbox', 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  debugPort = await waitForDevToolsPort(profile);
  await Promise.all([
    waitForHttp(`${origin}${fixturePath}`),
    waitForHttp(`${secondOrigin}${fixturePath}`),
    waitForHttp(`http://127.0.0.1:${debugPort}/json/version`),
  ]);
  const browserVersion = (await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json()).Browser;
  pageA = await newPage(`${origin}${fixturePath}`, debugPort);
  pageB = await newPage(`${origin}${fixturePath}`, debugPort);
  pageOther = await newPage(`${secondOrigin}${fixturePath}`, debugPort);

  for (const kind of ['extra_store', 'missing_authority', 'missing_candidate', 'key_path', 'auto_increment', 'index']) {
    assertion(
      await pageA.cdp.evaluate(`window.k328.malformedSchema(${JSON.stringify(kind)})`) === 'DATABASE_SCHEMA_INVALID',
      `exact schema rejects ${kind}`,
    );
  }

  await pageA.cdp.evaluate('window.k328.startBlockedOpenScenario()');
  await waitFor(pageA, 'window.k328.blockedOpenState()?.blockedObserved === true');
  await waitFor(pageA, 'window.k328.blockedOpenState()?.callerRejected === true');
  const blockedBeforeRelease = await pageA.cdp.evaluate('window.k328.blockedOpenState()');
  assertion(
    blockedBeforeRelease.rejectionCode === 'DATABASE_OPEN_BLOCKED'
      && blockedBeforeRelease.blockerReleased === false,
    'real blocked open rejects fail closed before blocker release',
  );
  assertion(
    blockedBeforeRelease.events.indexOf('blocked_observed')
      < blockedBeforeRelease.events.indexOf('caller_rejected'),
    'real Chrome blocked event precedes caller rejection',
  );
  assertion(
    await pageA.cdp.evaluate('window.k328.releaseBlockedOpenScenario()') === true,
    'blocked connection releases only after caller rejection',
  );
  await waitFor(pageA, 'window.k328.blockedOpenState()?.lateSuccessObserved === true');
  await waitFor(pageA, 'window.k328.blockedOpenState()?.lateConnectionClosed === true');
  const blockedComplete = await pageA.cdp.evaluate('window.k328.finishBlockedOpenScenario()');
  const blockedOrder = [
    'blocker_open', 'blocked_observed', 'caller_rejected', 'blocker_released',
    'late_success_observed', 'late_connection_closed', 'leak_check_passed', 'clean_reopen_passed',
  ];
  const blockedIndexes = blockedOrder.map(event => blockedComplete.events.indexOf(event));
  assertion(
    blockedIndexes.every((value, index) => value >= 0
      && (index === 0 || blockedIndexes[index - 1] < value)),
    'blocked open follows the explicit real-browser settlement order',
  );
  assertion(blockedComplete.lateConnectionClosed === true,
    'late-success connection is immediately closed');
  assertion(blockedComplete.leakCheckPassed === true,
    'late-success connection does not block database deletion');
  assertion(blockedComplete.cleanReopenPassed === true,
    'production open succeeds with exact clean schema after blocked scenario');

  await pageA.cdp.evaluate('window.k328.reset()');
  const created = await pageA.cdp.evaluate('window.k328.run("A")');
  assertion(created.status === 'created', 'real IndexedDB candidate/authority creation');
  assertion(JSON.stringify(await pageA.cdp.evaluate('window.k328.counts()')) === '{"authority":1,"candidate":1}', 'real IndexedDB object counts');
  assertion(await pageA.cdp.evaluate('window.k328.duplicateAdd()') === 'ConstraintError', 'real add() uniqueness conflict');
  assertion((await pageA.cdp.evaluate('window.k328.run("A")')).status === 'existing_identical', 'real identical replay is zero-write');

  const beforeClose = await pageA.cdp.evaluate('window.k328.evidenceBytes()');
  await closePage(pageA, debugPort);
  pageA = await newPage(`${origin}${fixturePath}`, debugPort);
  const restarted = await pageA.cdp.evaluate('window.k328.restart().then(v => ({state:v.authority.state,id:v.candidate.candidateId}))');
  assertion(restarted.state === 'read_only_handoff', 'page-close/reopen restart validation');
  assertion(JSON.stringify(await pageA.cdp.evaluate('window.k328.evidenceBytes()')) === JSON.stringify(beforeClose), 'restart does not rewrite evidence');

  for (const point of ['after_candidate_request', 'after_both_requests']) {
    const aborted = await pageA.cdp.evaluate(`window.k328.abortAtomic(${JSON.stringify(point)})`);
    assertion(aborted.code === 'TRANSACTION_ABORTED' && aborted.counts.authority === 0 && aborted.counts.candidate === 0, `real transaction abort ${point}`);
  }
  const versionChange = await pageA.cdp.evaluate('window.k328.versionChangeBehavior()');
  assertion(versionChange.upgradeResult === 'AbortError' && versionChange.priorConnectionClosed === true,
    'versionchange closes prior connection and aborted upgrade remains reopenable');

  await pageA.cdp.evaluate('window.k328.reset()');
  const collisionKey = await pageA.cdp.evaluate('window.k328.candidateId("first")');
  const emptyMismatch = await pageB.cdp.evaluate(`window.k328.persistWithKey("second", ${JSON.stringify(collisionKey)})`);
  assertion(emptyMismatch.code === 'PERSISTED_EVIDENCE_MISMATCH', 'empty injected mismatch fails before write');
  assertion(JSON.stringify(await pageA.cdp.evaluate('window.k328.counts()')) === '{"authority":0,"candidate":0}', 'empty injected mismatch leaves zero records');
  const emptyAbsence = await pageA.cdp.evaluate(
    `window.k328.emptyMismatchAbsenceAcrossReopen("second", ${JSON.stringify(collisionKey)})`,
  );
  assertion(
    emptyAbsence.payloadCandidateId !== collisionKey
      && emptyAbsence.beforeClose.injectedAbsent
      && emptyAbsence.beforeClose.payloadAbsent
      && emptyAbsence.beforeClose.authorityAbsent
      && emptyAbsence.beforeClose.counts.authority === 0
      && emptyAbsence.beforeClose.counts.candidate === 0
      && emptyAbsence.afterReopen.injectedAbsent
      && emptyAbsence.afterReopen.payloadAbsent
      && emptyAbsence.afterReopen.authorityAbsent
      && emptyAbsence.afterReopen.counts.authority === 0
      && emptyAbsence.afterReopen.counts.candidate === 0,
    'empty injected mismatch remains direct-key absent across production reopen',
  );
  const first = await pageA.cdp.evaluate(`window.k328.persistWithKey("first", ${JSON.stringify(collisionKey)})`);
  const second = await pageB.cdp.evaluate(`window.k328.persistWithKey("second", ${JSON.stringify(collisionKey)})`);
  assertion(first.status === 'created', 'existing-key collision fixture creates original candidate');
  assertion(second.code === 'CANDIDATE_KEY_COLLISION', 'existing-key collision rejects conflicting caller');
  assertion((await pageA.cdp.evaluate('window.k328.counts()')).candidate === 1, 'existing-key collision preserves one candidate');

  await pageA.cdp.evaluate('window.k328.reset()');
  await pageA.cdp.evaluate('window.k328.startControlledHandoff("same-a", "same")');
  await waitFor(pageA, 'window.k328.controlledState("same-a")?.lockEntered === true && window.k328.controlledState("same-a")?.sourceEntered === true');
  await pageB.cdp.evaluate('window.k328.startControlledHandoff("same-b", "same")');
  await waitFor(pageB, 'window.k328.controlledState("same-b")?.lockRequested === true');
  await waitFor(pageB, 'window.k328.lockQueueState(location.origin).then(v => v.pending === 1)');
  assertion(await pageB.cdp.evaluate('window.k328.controlledState("same-b")?.lockEntered === false'), 'same-source second handoff is explicitly queued');
  await pageA.cdp.evaluate('window.k328.releaseControlledHandoff("same-a")');
  await waitFor(pageA, 'window.k328.controlledState("same-a")?.done === true');
  await waitFor(pageB, 'window.k328.controlledState("same-b")?.lockEntered === true && window.k328.controlledState("same-b")?.done === true');
  const sameA = await pageA.cdp.evaluate('window.k328.controlledState("same-a")');
  const sameB = await pageB.cdp.evaluate('window.k328.controlledState("same-b")');
  assertion(sameA.result.status === 'created' && sameB.result.status === 'existing_identical', 'two actual same-source handoffs produce create then validated replay');
  assertion(sameA.result.candidateId === sameB.result.candidateId, 'same-source callers bind one candidate ID');
  assertion(sameA.candidateCommittedWrites + sameB.candidateCommittedWrites === 1, 'same-source callers commit exactly one candidate create');
  assertion(sameB.candidateCommittedWrites === 0 && sameB.authorityCommittedWrites === 0, 'terminal replay performs zero committed writes');
  assertion(
    sameA.result.physicalSourceDigest === sameB.result.physicalSourceDigest
      && sameA.result.sessionId === sameB.result.sessionId
      && sameA.result.sourceRevision === sameB.result.sourceRevision,
    'same-source results agree on physical, session, and revision binding',
  );
  const [sameBindingA, sameBindingB] = await Promise.all([
    pageA.cdp.evaluate('window.k328.validatedBinding(location.origin)'),
    pageB.cdp.evaluate('window.k328.validatedBinding(location.origin)'),
  ]);
  assertion(JSON.stringify(sameBindingA) === JSON.stringify(sameBindingB),
    'same-source restart reads return one complete shared binding');
  assertion(
    sameBindingA.authority.state === 'read_only_handoff'
      && sameBindingA.authority.physicalSourceDigest === sameBindingA.candidate.physicalSourceDigest
      && sameBindingA.authority.candidateId === sameBindingA.candidate.candidateId
      && sameBindingA.authority.sessionId === sameBindingA.candidate.sessionId
      && sameBindingA.authority.sourceRevision === sameBindingA.candidate.sourceRevision
      && sameBindingA.authority.snapshotDigest === sameBindingA.candidate.snapshotDigest
      && sameBindingA.authority.rootDigest === sameBindingA.candidate.rootDigest
      && sameBindingA.authority.manifestDigest === sameBindingA.candidate.manifestDigest,
    'same-source persisted authority and candidate full binding validates',
  );
  assertion(
    sameA.result.candidateId === sameBindingA.candidate.candidateId
      && sameA.result.physicalSourceDigest === sameBindingA.candidate.physicalSourceDigest
      && sameA.result.sessionId === sameBindingA.candidate.sessionId
      && sameA.result.sourceRevision === sameBindingA.candidate.sourceRevision,
    'same-source results reference the restart-validated graph',
  );
  assertion(JSON.stringify(await pageA.cdp.evaluate('window.k328.counts()')) === '{"authority":1,"candidate":1}', 'same-source concurrent handoff leaves one evidence graph');

  await pageA.cdp.evaluate('window.k328.reset()');
  const sourceA = 'https://legacy-source-a.example.test';
  const sourceB = 'https://legacy-source-b.example.test';
  await pageA.cdp.evaluate(`window.k328.startControlledHandoff("distinct-a", "A", ${JSON.stringify(sourceA)})`);
  await pageB.cdp.evaluate(`window.k328.startControlledHandoff("distinct-b", "B", ${JSON.stringify(sourceB)})`);
  await Promise.all([
    waitFor(pageA, 'window.k328.controlledState("distinct-a")?.sourceEntered === true'),
    waitFor(pageB, 'window.k328.controlledState("distinct-b")?.sourceEntered === true'),
  ]);
  const [lockA, lockB] = await Promise.all([
    pageA.cdp.evaluate(`window.k328.lockQueueState(${JSON.stringify(sourceA)})`),
    pageB.cdp.evaluate(`window.k328.lockQueueState(${JSON.stringify(sourceB)})`),
  ]);
  assertion(lockA.lockName !== lockB.lockName && lockA.held === 1 && lockB.held === 1, 'same-origin distinct physical sources hold different locks concurrently');
  await Promise.all([
    pageA.cdp.evaluate('window.k328.releaseControlledHandoff("distinct-a")'),
    pageB.cdp.evaluate('window.k328.releaseControlledHandoff("distinct-b")'),
  ]);
  await Promise.all([
    waitFor(pageA, 'window.k328.controlledState("distinct-a")?.done === true'),
    waitFor(pageB, 'window.k328.controlledState("distinct-b")?.done === true'),
  ]);
  const distinctA = await pageA.cdp.evaluate('window.k328.controlledState("distinct-a")');
  const distinctB = await pageB.cdp.evaluate('window.k328.controlledState("distinct-b")');
  assertion(
    distinctA.errorCode === null && distinctB.errorCode === null
      && distinctA.result.status === 'created' && distinctB.result.status === 'created',
    'same-origin distinct-source handoffs both complete successfully',
  );
  const [bindingA, bindingB] = await Promise.all([
    pageA.cdp.evaluate(`window.k328.validatedBinding(${JSON.stringify(sourceA)})`),
    pageB.cdp.evaluate(`window.k328.validatedBinding(${JSON.stringify(sourceB)})`),
  ]);
  assertion(
    bindingA.authority.physicalSourceDigest !== bindingB.authority.physicalSourceDigest
      && distinctA.result.physicalSourceDigest === bindingA.authority.physicalSourceDigest
      && distinctB.result.physicalSourceDigest === bindingB.authority.physicalSourceDigest,
    'distinct-source results and authorities retain distinct physical bindings',
  );
  assertion(
    bindingA.authority.candidateId === bindingA.candidate.candidateId
      && bindingA.authority.physicalSourceDigest === bindingA.candidate.physicalSourceDigest
      && bindingA.authority.snapshotDigest === bindingA.candidate.snapshotDigest
      && bindingA.authority.rootDigest === bindingA.candidate.rootDigest
      && bindingA.authority.manifestDigest === bindingA.candidate.manifestDigest
      && bindingB.authority.candidateId === bindingB.candidate.candidateId
      && bindingB.authority.physicalSourceDigest === bindingB.candidate.physicalSourceDigest
      && bindingB.authority.snapshotDigest === bindingB.candidate.snapshotDigest
      && bindingB.authority.rootDigest === bindingB.candidate.rootDigest
      && bindingB.authority.manifestDigest === bindingB.candidate.manifestDigest,
    'distinct-source restart reads validate each complete authority-candidate binding',
  );
  const [crossAB, crossBA] = await Promise.all([
    pageA.cdp.evaluate(`window.k328.crossBindingCode(${JSON.stringify(sourceA)}, ${JSON.stringify(sourceB)})`),
    pageB.cdp.evaluate(`window.k328.crossBindingCode(${JSON.stringify(sourceB)}, ${JSON.stringify(sourceA)})`),
  ]);
  assertion(crossAB === 'PERSISTED_EVIDENCE_MISMATCH' && crossBA === 'PERSISTED_EVIDENCE_MISMATCH',
    'distinct-source authority-candidate cross-binding is rejected both ways');
  assertion(JSON.stringify(await pageA.cdp.evaluate('window.k328.counts()')) === '{"authority":2,"candidate":2}', 'same-origin distinct sources persist separate evidence graphs');

  await pageA.cdp.evaluate('window.k328.reset()');
  await pageA.cdp.evaluate('window.k328.run("valid")');
  await pageA.cdp.evaluate('window.k328.corruptCandidate()');
  const corruptCode = await pageA.cdp.evaluate('window.k328.restart().then(() => "unexpected", e => e.code)');
  assertion(corruptCode === 'CANDIDATE_CORRUPT', 'malformed persisted UTF-8 fails closed');

  await pageA.cdp.evaluate('window.k328.hold("abort-a")');
  await waitFor(pageA, 'window.k328.holdState("abort-a")?.entered === true');
  await pageB.cdp.evaluate('window.k328.holdAbortable("abort-b")');
  await waitFor(pageB, 'window.k328.lockQueueState(location.origin).then(v => v.pending === 1)');
  await pageB.cdp.evaluate('window.k328.abortHold("abort-b")');
  await waitFor(pageB, 'window.k328.holdState("abort-b")?.done === true');
  assertion(await pageB.cdp.evaluate('window.k328.holdState("abort-b")?.status === "aborted" && window.k328.holdState("abort-b")?.entered === false'), 'aborted waiter never enters');
  await pageA.cdp.evaluate('window.k328.release("abort-a")');

  assertion(await pageA.cdp.evaluate('window.k328.failInsideLock()') === 'operation_failed', 'lock callback failure is distinct');
  await pageB.cdp.evaluate('window.k328.hold("after-failure")');
  await waitFor(pageB, 'window.k328.holdState("after-failure")?.entered === true');
  await pageB.cdp.evaluate('window.k328.release("after-failure")');
  assertion(true, 'native lock releases after callback failure');

  await pageA.cdp.evaluate('window.k328.hold("origin-a")');
  await pageOther.cdp.evaluate('window.k328.hold("origin-b")');
  await Promise.all([
    waitFor(pageA, 'window.k328.holdState("origin-a")?.entered === true'),
    waitFor(pageOther, 'window.k328.holdState("origin-b")?.entered === true'),
  ]);
  assertion(true, 'different physical origins progress independently');
  await pageA.cdp.evaluate('window.k328.release("origin-a")');
  await pageOther.cdp.evaluate('window.k328.release("origin-b")');

  console.log(JSON.stringify({
    browser: browserVersion,
    noSandbox: true,
    dynamicPorts: { vite: true, devTools: true },
    passed: results.length,
    failed: 0,
    durationMs: Date.now() - started,
    cases: results,
  }, null, 2));
} finally {
  for (const page of [pageA, pageB, pageOther]) {
    if (page && debugPort) await closePage(page, debugPort).catch(() => undefined);
  }
  if (chrome) {
    chrome.kill();
    await new Promise(resolve => {
      if (chrome.exitCode !== null) resolve();
      else {
        chrome.once('exit', resolve);
        setTimeout(resolve, 5_000);
      }
    });
  }
  await Promise.all([
    vite?.close().catch(() => undefined),
    viteSecond?.close().catch(() => undefined),
  ]);
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
}
