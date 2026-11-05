import { createGoogleDriveSessionConnectionController, type GoogleDriveSessionConnectionController } from './googleDriveSessionConnectionController';
import { GOOGLE_DRIVE_APP_DATA_SCOPE } from './googleDriveOAuthAuthorization';
import type { GoogleDriveOAuthTokenFetch } from './googleDriveOAuthTokenExchange';
import { resolveRemoteProviderConnectionBoundary } from './remoteProviderConnectionStatus';
import type { RemoteProviderConnectionBoundary } from './remoteProviderConnectionStatus';
import { isLocalOnlyRuntime } from './localAuth';
import { prepareGoogleDriveOriginalExecutionAuthorityForTests, type OriginalExecutionSelection } from './googleDriveOriginalExecutionAuthority';

export interface DriveRuntimeConfig {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly allowedRedirectUris: readonly string[];
}

/** Public configuration only. Callback is static: it must not boot app Auth. */
export function parseDriveRuntimeConfig(env: Record<string, unknown>, origin: string): DriveRuntimeConfig | null {
  try {
    const clientId = String(env.VITE_GOOGLE_DRIVE_OAUTH_CLIENT_ID ?? '').trim();
    const redirectUri = String(env.VITE_GOOGLE_DRIVE_OAUTH_REDIRECT_URI ?? '').trim();
    const allowed: unknown = JSON.parse(String(env.VITE_GOOGLE_DRIVE_OAUTH_ALLOWED_REDIRECT_URIS ?? 'null'));
    const url = new URL(redirectUri);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)
      || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
      || url.origin !== origin || url.pathname !== '/oauth/google-drive/callback.html'
      || url.username || url.password || url.search || url.hash
      || !Array.isArray(allowed) || !allowed.every(value => typeof value === 'string')
      || !allowed.includes(redirectUri)) return null;
    return Object.freeze({ clientId, redirectUri, allowedRedirectUris: Object.freeze([...allowed]) });
  } catch { return null; }
}

export function createGoogleDriveSessionRuntime(config: DriveRuntimeConfig | null, fetchToken: GoogleDriveOAuthTokenFetch,
  executionFetcherForTests?: typeof fetch) {
  const connectionOnlyStatus = (value: RemoteProviderConnectionBoundary): RemoteProviderConnectionBoundary => ({
    ...value,
    // The generic boundary's "unsupported" means download is disabled, not that
    // this memory-only OAuth connection failed.
    status: value.status === 'unsupported' ? 'available' : value.status,
    displayLabel: value.status === 'unsupported' ? 'Connected (connection only)' : value.displayLabel,
    canUpload: false, canDownload: false, canRecover: false,
    safeMessage: value.status === 'unsupported' || value.status === 'available'
      ? 'Google Drive connected in memory. Upload and recovery remain disabled.' : value.safeMessage,
  });
  type Snapshot = Readonly<{ accountId: string | null; generation: number; controller: GoogleDriveSessionConnectionController | null }>;
  let snapshot: Snapshot = Object.freeze({ accountId: null, generation: 0, controller: null });
  let revoke: (() => void) | undefined;
  let executionRevision = 0;
  let executionConnectionReady = false;
  const executionRevokers = new Set<() => void>();
  const invalidateExecution = () => {
    executionRevision += 1;
    executionConnectionReady = false;
    for (const listener of Array.from(executionRevokers)) listener();
    executionRevokers.clear();
  };
  let privateController: GoogleDriveSessionConnectionController | null = null;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async prepareSingleOriginalBackupForTests(input: OriginalExecutionSelection) {
      if (import.meta.env.MODE !== 'test' || !executionFetcherForTests || !privateController || !snapshot.accountId || !executionConnectionReady) return null;
      const owner = snapshot, inner = privateController, revision = executionRevision;
      return prepareGoogleDriveOriginalExecutionAuthorityForTests(input, {
        accountId: owner.accountId!, generation: owner.generation,
        isCurrent: () => snapshot === owner && privateController === inner && executionRevision === revision && executionConnectionReady,
        getPrivateTokenProvider: () => inner.getAccessTokenProvider(), fetcher: executionFetcherForTests,
        onRevoke(listener) {
          if (snapshot !== owner || executionRevision !== revision || !executionConnectionReady) { listener(); return () => {}; }
          executionRevokers.add(listener);
          return () => { executionRevokers.delete(listener); };
        },
      });
    },
    /** Called synchronously by the authenticated app shell on actual session replacement. */
    replaceAccount(accountId: string | null) {
      invalidateExecution();
      privateController = null;
      revoke?.();
      revoke = undefined;
      const generation = snapshot.generation + 1;
      let controller: GoogleDriveSessionConnectionController | null = null;
      if (accountId && config) {
        let retired = false;
        const isCurrent = () => !retired && snapshot.accountId === accountId && snapshot.generation === generation;
        const inner = createGoogleDriveSessionConnectionController({
          ...config, fetchToken, canUpload: false, canDownload: false, isCurrent,
        });
        privateController = inner;
        revoke = () => { retired = true; void inner.disconnect(); };
        const deniedStatus = () => resolveRemoteProviderConnectionBoundary({
          providerType: 'googleDrive', status: 'unconfigured',
          capabilities: { supportsUpload: false, supportsDownload: false },
        });
        controller = {
          providerType: 'googleDrive',
          async startAuthorization(input) {
            if (!isCurrent()) return { providerType: 'googleDrive', status: 'blocked', safeMessage: 'Session replaced.' };
            invalidateExecution();
            return inner.startAuthorization({ ...input, scopes: [GOOGLE_DRIVE_APP_DATA_SCOPE], includeGrantedScopes: false, accessType: 'online' });
          },
          async completeCallback(input) {
            const executionOperation = executionRevision;
            const blocked = () => ({
              providerType: 'googleDrive' as const, status: 'blocked' as const,
              connectionStatus: deniedStatus(), safeMessage: 'Session or callback is not authorized.',
            });
            if (!isCurrent()) return blocked();
            // Runtime accepts only the full, exact callback URL, not bare query parameters.
            const value = typeof input === 'object' && 'callbackUrl' in input ? input.callbackUrl : input;
            try {
              const url = new URL(String(value));
              if (url.origin + url.pathname !== config.redirectUri || url.hash || url.username || url.password) return blocked();
            } catch { return blocked(); }
            const result = await inner.completeCallback(input);
            if (isCurrent() && executionOperation === executionRevision && result.status === 'connected') executionConnectionReady = true;
            return isCurrent() ? {
              ...result, connectionStatus: connectionOnlyStatus(result.connectionStatus),
            } : blocked();
          },
          async getConnectionStatus() {
            if (!isCurrent()) return deniedStatus();
            const result = await inner.getConnectionStatus();
            return isCurrent() ? connectionOnlyStatus(result) : deniedStatus();
          },
          // Connection-only facade: injection cannot obtain a token for legacy writers.
          getAccessTokenProvider: () => null,
          disconnect: () => { if (isCurrent()) invalidateExecution(); return inner.disconnect(); },
          markReconnectRequired: () => { if (isCurrent()) invalidateExecution(); return inner.markReconnectRequired(); },
        };
      }
      snapshot = Object.freeze({ accountId, generation, controller });
      listeners.forEach(listener => listener());
    },
  };
}

const config = parseDriveRuntimeConfig(import.meta.env, typeof location === 'undefined' ? '' : location.origin);
export const googleDriveSessionRuntime = createGoogleDriveSessionRuntime(config, (url, init) =>
  fetch(url, { ...init, credentials: 'omit', redirect: 'error' }));
export function replaceGoogleDriveRuntimeAccount(accountId: string | null): void {
  googleDriveSessionRuntime.replaceAccount(isLocalOnlyRuntime() ? null : accountId);
}
