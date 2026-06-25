import puppeteer from 'puppeteer';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE_URL = process.env.ABSINTHE_URL ?? 'http://127.0.0.1:5173';
const OUT_DIR = process.env.QA_OUT_DIR ?? '/opt/cursor/artifacts/k135c-qa';

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'laptop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 390, height: 844 },
];

const WORKSPACES = [
  { id: 'home', tabIndex: 0, selector: '[data-workspace="home"]' },
  { id: 'note', tabIndex: 1, selector: '[data-compact-chrome], [data-note-header-title-row]' },
  { id: 'health', tabIndex: 2, selector: '[data-workspace="health"]' },
  { id: 'planner', tabIndex: 4, selector: '[data-workspace="planner"]' },
  { id: 'analytics', tabIndex: 3, selector: '[data-archive-shell], [data-k109-archive-shell]' },
  { id: 'settings', tabIndex: null, selector: '[data-workspace="settings"]' },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadSupabaseEnv() {
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const url = env.match(/VITE_SUPABASE_URL="([^"]+)"/)?.[1];
  const key = env.match(/VITE_SUPABASE_ANON_KEY="([^"]+)"/)?.[1];
  if (!url || !key) throw new Error('Missing Supabase env');
  const projectRef = new URL(url).hostname.split('.')[0];
  return { url, key, projectRef, storageKey: `sb-${projectRef}-auth-token` };
}

async function ensureAuthCredentials() {
  const email = process.env.SUPABASE_TEST_EMAIL;
  const password = process.env.SUPABASE_TEST_PASSWORD;
  if (email && password) return { email, password };

  const { url, key } = loadSupabaseEnv();
  const generated = {
    email: `k135c-qa-${Date.now()}@cursor-qa.invalid`,
    password: `K135cQa!${Math.random().toString(36).slice(2, 10)}`,
  };
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(generated),
  });
  const body = await res.json();
  if (body.error && !body.user) {
    throw new Error(`Signup failed: ${body.error.message ?? JSON.stringify(body)}`);
  }
  return generated;
}

async function fetchSession(email, password) {
  const { url, key } = loadSupabaseEnv();
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!body.access_token) {
    throw new Error(`Sign-in failed: ${body.error?.message ?? JSON.stringify(body)}`);
  }
  return body;
}

async function injectSession(page, session) {
  const { storageKey } = loadSupabaseEnv();
  await page.evaluateOnNewDocument((key, payload) => {
    window.localStorage.setItem(key, JSON.stringify(payload));
  }, storageKey, session);
}

async function captureMetrics(page) {
  return page.evaluate(() => {
    const root = document.getElementById('root');
    const scrollable = [...document.querySelectorAll('*')].filter(el => {
      const style = getComputedStyle(el);
      return (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 4;
    }).length;
    const workspace = document.querySelector('[data-workspace]')?.getAttribute('data-workspace') ?? null;
    const clipped = [...document.querySelectorAll('[class*="max-h"], [style*="max-height"]')].filter(el => {
      return el.scrollHeight > el.clientHeight + 8 && getComputedStyle(el).overflowY === 'hidden';
    }).length;
    return {
      title: document.title,
      workspace,
      bodyOverflow: getComputedStyle(document.body).overflow,
      scrollableRegions: scrollable,
      clippedMaxHeight: clipped,
      hasLogin: Boolean(document.body.innerText.match(/welcome back|create your account/i)),
      textSample: root?.innerText?.slice(0, 300) ?? '',
    };
  });
}

async function navigateWorkspace(page, ws, isMobile) {
  if (ws.id === 'settings') {
    if (isMobile) {
      await page.click('[data-k126-mobile-more-trigger]');
      await sleep(400);
      await page.click('[data-k126-more-settings]');
    } else {
      await page.evaluate(() => {
        const sidebar = document.querySelector('[data-k126-mobile-sidebar]');
        const bottom = sidebar?.querySelector(':scope > div.hidden');
        bottom?.querySelectorAll('button')[1]?.click();
      });
    }
  } else if (ws.tabIndex != null) {
    await page.evaluate((idx) => {
      const sidebar = document.querySelector('[data-k126-mobile-sidebar]');
      const tabs = sidebar?.querySelectorAll(':scope > div:first-child > button') ?? [];
      tabs[idx]?.click();
    }, ws.tabIndex);
  }
  await sleep(1600);
  try {
    await page.waitForSelector(ws.selector, { timeout: 12_000 });
  } catch {
    // workspace may use a different root hook
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const creds = await ensureAuthCredentials();
  const session = await fetchSession(creds.email, creds.password);
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const report = { baseUrl: BASE_URL, credentials: { email: creds.email }, viewports: {}, workspaces: {}, checks: [] };

  for (const vp of VIEWPORTS) {
    const vpReport = { login: null, workspaces: {} };
    const page = await browser.newPage();
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    await injectSession(page, session);
    await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 60_000 });
    await sleep(2000);
    vpReport.login = await captureMetrics(page);
    await page.screenshot({ path: join(OUT_DIR, `auth-${vp.name}-home.png`), fullPage: true });

    for (const ws of WORKSPACES) {
      await navigateWorkspace(page, ws, vp.width < 1024);
      const metrics = await captureMetrics(page);
      vpReport.workspaces[ws.id] = metrics;
      await page.screenshot({ path: join(OUT_DIR, `${ws.id}-${vp.name}.png`), fullPage: true });
    }

    report.viewports[vp.name] = vpReport;
    await page.close();
  }

  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  report.checks.push(await page.evaluate(async () => {
    const { buildValidatedVaultBackupManifest } = await import('/src/lib/vaultBackupExport.ts');
    const { buildVaultRestorePreview, parseVaultBackupJson } = await import('/src/lib/importVaultBackup.ts');
    const notes = [{ id: 'qa-1', title: '', body: 'QA note', folderId: null, starred: false, deletedAt: null, createdAt: 1, updatedAt: 1 }];
    const manifest = buildValidatedVaultBackupManifest(notes, []);
    const parsed = parseVaultBackupJson(JSON.stringify(manifest));
    const preview = buildVaultRestorePreview(parsed, [], []);
    return { backupRoundTrip: preview.valid, corrupted: preview.validation?.corruptedNoteIds ?? [] };
  }));
  await browser.close();

  writeFileSync(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, outDir: OUT_DIR, viewports: Object.keys(report.viewports) }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
