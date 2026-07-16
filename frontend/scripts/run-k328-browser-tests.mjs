import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const chromePath = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const vitePort = 41828;
const secondVitePort = 41829;
const debugPort = 9328;
const origin = `http://127.0.0.1:${vitePort}`;
const secondOrigin = `http://127.0.0.1:${secondVitePort}`;
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
    try { if ((await fetch(url)).ok) return; } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
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

async function newPage(url) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const target = await response.json();
  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.connect();
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (await cdp.evaluate('Boolean(window.k328)')) return { cdp, targetId: target.id };
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('fixture did not initialize');
}

async function closePage(page) {
  await fetch(`http://127.0.0.1:${debugPort}/json/close/${page.targetId}`);
  page.cdp.close();
}

async function waitFor(page, expression, timeout = 5_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.cdp.evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out: ${expression}`);
}

const profile = await mkdtemp(join(tmpdir(), 'absinthe-k328-chrome-'));
const frontendRoot = fileURLToPath(new URL('..', import.meta.url));
const commandShell = process.env.ComSpec ?? 'cmd.exe';
const vite = spawn(commandShell, ['/d', '/s', '/c', `npm run dev -- --host 127.0.0.1 --port ${vitePort} --strictPort`], {
  cwd: frontendRoot, stdio: 'ignore', windowsHide: true,
});
const viteSecond = spawn(commandShell, ['/d', '/s', '/c', `npm run dev -- --host 127.0.0.1 --port ${secondVitePort} --strictPort`], {
  cwd: frontendRoot, stdio: 'ignore', windowsHide: true,
});
const chrome = spawn(chromePath, [
  '--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`,
  '--remote-allow-origins=*', '--no-first-run', '--disable-default-apps',
  '--disable-background-networking', '--disable-gpu', '--disable-gpu-compositing',
  '--disable-features=SkiaGraphite,DawnGraphite,Vulkan', '--no-sandbox', 'about:blank',
], { stdio: 'ignore', windowsHide: true });

let pageA;
let pageB;
let pageOther;
try {
  await Promise.all([
    waitForHttp(`${origin}${fixturePath}`), waitForHttp(`${secondOrigin}${fixturePath}`),
    waitForHttp(`http://127.0.0.1:${debugPort}/json/version`),
  ]);
  pageA = await newPage(`${origin}${fixturePath}`);
  pageB = await newPage(`${origin}${fixturePath}`);
  pageOther = await newPage(`${secondOrigin}${fixturePath}`);

  await pageA.cdp.evaluate('window.k328.reset()');
  const created = await pageA.cdp.evaluate('window.k328.run("A")');
  assertion(created.status === 'created', 'real IndexedDB candidate/authority creation');
  assertion(JSON.stringify(await pageA.cdp.evaluate('window.k328.counts()')) === '{"authority":1,"candidate":1}', 'real IndexedDB object counts');
  assertion(await pageA.cdp.evaluate('window.k328.duplicateAdd()') === 'ConstraintError', 'real add() uniqueness conflict');
  assertion((await pageA.cdp.evaluate('window.k328.run("A")')).status === 'existing_identical', 'real identical replay is zero-write');

  const beforeClose = await pageA.cdp.evaluate('window.k328.evidenceBytes()');
  await closePage(pageA);
  pageA = await newPage(`${origin}${fixturePath}`);
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
  const firstPromise = pageA.cdp.evaluate(`window.k328.persistWithKey("first", ${JSON.stringify(collisionKey)})`);
  await new Promise(resolve => setTimeout(resolve, 10));
  const secondPromise = pageB.cdp.evaluate(`window.k328.persistWithKey("second", ${JSON.stringify(collisionKey)})`);
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assertion(first.status === 'created', 'same-key race first candidate created');
  assertion(second.code === 'CANDIDATE_KEY_COLLISION', 'same-key race conflicting caller rejected');
  assertion((await pageA.cdp.evaluate('window.k328.counts()')).candidate === 1, 'same-key race preserves one candidate');

  await pageA.cdp.evaluate('window.k328.reset()');
  await pageA.cdp.evaluate('window.k328.run("valid")');
  await pageA.cdp.evaluate('window.k328.corruptCandidate()');
  const corruptCode = await pageA.cdp.evaluate('window.k328.restart().then(() => "unexpected", e => e.code)');
  assertion(corruptCode === 'CANDIDATE_CORRUPT', 'malformed persisted UTF-8 fails closed');

  await pageA.cdp.evaluate('window.k328.hold("same-a")');
  await waitFor(pageA, 'window.k328.holdState("same-a")?.entered === true');
  await pageB.cdp.evaluate('window.k328.hold("same-b")');
  await new Promise(resolve => setTimeout(resolve, 150));
  assertion(await pageB.cdp.evaluate('window.k328.holdState("same-b")?.entered === false'), 'same physical source serializes two contexts');
  await pageA.cdp.evaluate('window.k328.release("same-a")');
  await waitFor(pageB, 'window.k328.holdState("same-b")?.entered === true');
  await pageB.cdp.evaluate('window.k328.release("same-b")');

  await pageA.cdp.evaluate('window.k328.hold("abort-a")');
  await waitFor(pageA, 'window.k328.holdState("abort-a")?.entered === true');
  await pageB.cdp.evaluate('window.k328.holdAbortable("abort-b")');
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
    browser: 'Google Chrome (headless Chromium)', passed: results.length, failed: 0,
    durationMs: Date.now() - started, cases: results,
  }, null, 2));
} finally {
  for (const page of [pageA, pageB, pageOther]) {
    if (page) await closePage(page).catch(() => undefined);
  }
  chrome.kill(); vite.kill(); viteSecond.kill();
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
}
