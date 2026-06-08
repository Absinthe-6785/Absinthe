// @vitest-environment happy-dom
/**
 * UX-3A.3 — production copy listener registration
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as blockCopy from './blockCopy';
import { installEditorCopyListener } from './copyListener';
import { makeBlock } from './blockUtils';

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
    const frontendDir = path.resolve(import.meta.dirname, '../../..');
    execSync('npm run build', { cwd: frontendDir, stdio: 'pipe' });

    const assetDir = path.join(frontendDir, 'dist/assets');
    const jsFile = fs.readdirSync(assetDir).find(f => f.endsWith('.js') && f.startsWith('index-'));
    expect(jsFile).toBeTruthy();

    const bundle = fs.readFileSync(path.join(assetDir, jsFile!), 'utf8');
    const copyAddCount = (bundle.match(/addEventListener\(\s*["']copy["']/g) ?? []).length;
    expect(copyAddCount).toBeGreaterThan(0);
  }, 120_000);
});
