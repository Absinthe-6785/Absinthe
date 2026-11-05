// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { GoogleDriveManualConnectionPanel } from './GoogleDriveManualConnectionPanel';
import type { GoogleDriveSessionConnectionController } from '../../../lib/googleDriveSessionConnectionController';
import { resolveRemoteProviderConnectionBoundary } from '../../../lib/remoteProviderConnectionStatus';
import type { NoteChromeColors } from '../noteEditorTheme';
import { readFileSync } from 'node:fs';

const colors: NoteChromeColors = {
  wrap: '#fff', sidebar: '#fff', sideBdr: '#ddd', notelist: '#fff', editor: '#fff',
  toolbar: '#fff', toolBdr: '#ddd', card: '#fff', cardHov: '#eee', cardAct: '#eee',
  cardActBdr: '#8b5cf6', text: '#111', textMuted: '#555', textFaint: '#888',
  accent: '#7c3aed', accentBg: '#f5f3ff', input: '#fff', inputBdr: '#ddd',
  badge: '#eee', badgeTxt: '#7c3aed', tag: '#eee', tagTxt: '#7c3aed', danger: '#d00', green: '#080',
};
const disconnected = resolveRemoteProviderConnectionBoundary({ status: 'unconfigured' });
function controller(): GoogleDriveSessionConnectionController {
  return {
    providerType: 'googleDrive',
    startAuthorization: vi.fn(async () => ({ providerType: 'googleDrive', status: 'blocked', safeMessage: 'blocked' })),
    completeCallback: vi.fn(async () => ({ providerType: 'googleDrive', status: 'blocked', connectionStatus: disconnected, safeMessage: 'blocked' })),
    getConnectionStatus: vi.fn(async () => disconnected),
    disconnect: vi.fn(async () => ({ providerType: 'googleDrive', status: 'disconnected', safeMessage: 'cleared' })),
    getAccessTokenProvider: () => null,
    markReconnectRequired: vi.fn(async () => {}),
  };
}
function setup() {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  return { host, root, dispose() { act(() => root.unmount()); host.remove(); } };
}
function button(host: HTMLElement, label: string) {
  return [...host.querySelectorAll('button')].find(value => value.textContent === label)!;
}
describe('manual Drive UI lifecycle', () => {
  it('does not expose late status results from the previous controller', async () => {
    const ui = setup();
    try {
      const old = controller(), next = controller();
      let resolve!: (value: typeof disconnected) => void;
      old.getConnectionStatus = () => new Promise(done => { resolve = done; });
      const onChange = vi.fn();
      await act(async () => ui.root.render(createElement(GoogleDriveManualConnectionPanel, { colors, controller: old, onConnectionStatusChange: onChange })));
      await act(async () => ui.root.render(createElement(GoogleDriveManualConnectionPanel, { colors, controller: next, onConnectionStatusChange: onChange })));
      const count = onChange.mock.calls.length;
      await act(async () => resolve({ ...disconnected, status: 'available', safeMessage: 'STALE_ACCOUNT_SECRET' }));
      expect(onChange).toHaveBeenCalledTimes(count);
      expect(ui.host.textContent).not.toContain('STALE_ACCOUNT_SECRET');
      expect(ui.host.textContent).toContain('Provider not configured');
    } finally { ui.dispose(); }
  });

  it('disconnect supersedes pending authorization and clears UI secrets', async () => {
    const ui = setup();
    try {
      const owner = controller();
      let resolve!: (value: Awaited<ReturnType<typeof owner.startAuthorization>>) => void;
      owner.startAuthorization = () => new Promise(done => { resolve = done; });
      await act(async () => ui.root.render(createElement(GoogleDriveManualConnectionPanel, { colors, controller: owner })));
      act(() => button(ui.host, 'Generate authorization URL').click());
      await act(async () => button(ui.host, 'Clear session').click());
      await act(async () => resolve({
        providerType: 'googleDrive', status: 'authorization_url_created', authorizationUrl: 'https://example.test/?state=STALE',
        state: 'STALE', expiresAt: '', warnings: [],
      }));
      expect(ui.host.querySelector('[aria-label="Generated Google Drive authorization URL"]')).toBeNull();
      expect(ui.host.textContent).toContain('cleared');
      expect(button(ui.host, 'Generate authorization URL').disabled).toBe(false);
    } finally { ui.dispose(); }
  });

  it('keeps runtime controller injection separate from all legacy attachment controls', () => {
    const sidebar = readFileSync('src/components/views/noteview/NoteViewSidebar.tsx', 'utf8');
    const runtimePanel = readFileSync('src/components/views/noteview/GoogleDriveRuntimeConnectionPanel.tsx', 'utf8');
    expect(sidebar).toContain('<GoogleDriveRuntimeConnectionPanel accountId={accountId}');
    expect(sidebar.match(/<EmbeddedAttachmentMigrationReviewPanel[\s\S]*?\/>/)?.[0]).not.toContain('googleDriveSessionController');
    expect(runtimePanel).not.toContain('uploadAttachmentBlobToRemote');
    expect(runtimePanel).not.toContain('GoogleDriveBlobAdapter');
    expect(runtimePanel).toContain('key={snapshot.generation}');
  });
});
