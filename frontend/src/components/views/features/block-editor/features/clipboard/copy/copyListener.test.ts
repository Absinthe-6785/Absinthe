// @vitest-environment happy-dom
/**
 * UX-3A.3 — production copy listener registration
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as blockCopy from './blockCopy';
import { installEditorCopyListener } from './copyListener';
import { makeBlock } from '../../../../../blockUtils';

const frontendDir = path.resolve(import.meta.dirname, '../../../../../../../..');

/** Count minified or source-style copy listener registration in bundle text. */
function countCopyListenerRegistrations(source: string): number {
  return (source.match(/addEventListener\(\s*["']copy["']/g) ?? []).length;
}

/** Resolve the main entry script from Vite output (not arbitrary index-*.js chunks). */
function resolveProductionEntryBundle(distDir: string): string {
  const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const match = html.match(/<script[^>]+src="\/assets\/([^"]+\.js)"/);
  if (!match) throw new Error('dist/index.html has no entry script');
  return path.join(distDir, 'assets', match[1]);
}

/** Run vite build into an isolated directory to avoid dist/ lock races in parallel tests. */
function buildProductionBundle(outDir: string): void {
  fs.rmSync(outDir, { recursive: true, force: true });
  execSync(`npx vite build --outDir "${outDir.replace(/\\/g, '/')}"`, {
    cwd: frontendDir,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production' },
  });
}

describe('installEditorCopyListener (UX-3A.3)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('registers a copy listener when DEV is false (preview/production)', () => {
    vi.stubEnv('DEV', 'false');
    const addSpy = vi.spyOn(window, 'addEventListener');
    const uninstall = installEditorCopyListener({
      getRootBlocks: () => [],
      getSelectedIds: () => new Set(),
    });

    const copyRegs = addSpy.mock.calls.filter(([type]) => type === 'copy');
    expect(copyRegs.length).toBe(1);
    uninstall();
  });

  it('real copy event reaches handleEditorCopyEvent in non-DEV mode', () => {
    vi.stubEnv('DEV', 'false');
    const toggle = makeBlock('toggle', {
      id: 't1',
      content: 'Grammar Module',
      children: [makeBlock('paragraph', { content: 'child' })],
    });

    const el = document.createElement('span');
    el.className = 'be-block-text';
    el.setAttribute('data-block-id', 't1');
    el.setAttribute('data-block-type', 'toggle');
    el.textContent = 'Grammar Module';
    const wrap = document.createElement('div');
    wrap.className = 'be-toggle-wrap';
    wrap.appendChild(el);
    const children = document.createElement('div');
    children.className = 'be-toggle-children';
    children.setAttribute('data-toggle-id', 't1');
    wrap.appendChild(children);
    document.body.appendChild(wrap);

    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);

    const handlerSpy = vi.spyOn(blockCopy, 'handleEditorCopyEvent');
    const uninstall = installEditorCopyListener({
      getRootBlocks: () => [toggle],
      getSelectedIds: () => new Set(),
    });

    const clipboard = new DataTransfer();
    window.dispatchEvent(new ClipboardEvent('copy', {
      clipboardData: clipboard,
      bubbles: true,
      cancelable: true,
    }));

    expect(handlerSpy).toHaveBeenCalledTimes(1);
    const report = handlerSpy.mock.results[0]?.value;
    expect(report?.path).toBe('editable-toggle-header');
    expect(clipboard.getData('text/html')).toContain('<details');

    uninstall();
    document.body.innerHTML = '';
  });

  it('preview production bundle includes copy listener registration', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'absinthe-copy-build-'));
    try {
      buildProductionBundle(outDir);

      // Resolve entry from index.html — not readdir's first index-*.js (code-split chunks share the prefix).
      const entryPath = resolveProductionEntryBundle(outDir);
      const entryBundle = fs.readFileSync(entryPath, 'utf8');
      expect(countCopyListenerRegistrations(entryBundle)).toBeGreaterThan(0);

      // Listener must exist somewhere in shipped JS (guards tree-shaking).
      const assetDir = path.join(outDir, 'assets');
      const shippedJs = fs.readdirSync(assetDir)
        .filter(f => f.endsWith('.js'))
        .map(f => fs.readFileSync(path.join(assetDir, f), 'utf8'))
        .join('\n');
      expect(countCopyListenerRegistrations(shippedJs)).toBeGreaterThan(0);
    } finally {
      fs.rmSync(outDir, { recursive: true, force: true });
    }
  }, 120_000);
});
