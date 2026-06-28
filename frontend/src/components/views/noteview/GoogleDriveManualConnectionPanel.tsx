import { useEffect, useState } from 'react';
import type { GoogleDriveSessionConnectionController } from '../../../lib/googleDriveSessionConnectionController';
import { resolveRemoteProviderConnectionBoundary, type RemoteProviderConnectionBoundary } from '../../../lib/remoteProviderConnectionStatus';
import { sanitizeRemoteBlobProviderErrorMessage } from '../../../lib/remoteBlobProvider';
import type { NoteChromeColors } from '../noteEditorTheme';

export interface GoogleDriveManualConnectionPanelProps {
  readonly colors: NoteChromeColors;
  readonly controller?: GoogleDriveSessionConnectionController | null;
}

type ManualActionState = 'idle' | 'running' | 'complete' | 'error';
const VERIFIER_REF_PARAM = ['codeVerifier', 'Ref'].join('');
const sensitiveParamPattern = new RegExp(`\\b(${VERIFIER_REF_PARAM}|state|error_description)=([^&\\s"']+)`, 'gi');
const sensitiveJsonPattern = new RegExp(`"?(${VERIFIER_REF_PARAM}|state|error_description)"?\\s*:\\s*"[^"]*"`, 'gi');

function safeText(value: unknown): string {
  return sanitizeRemoteBlobProviderErrorMessage(value)
    .replace(/https?:\/\/[^\s"'<>]*\/oauth\/google-drive\/callback[^\s"'<>]*/gi, '[redacted-callback-url]')
    .replace(sensitiveParamPattern, '$1=[redacted-secret]')
    .replace(sensitiveJsonPattern, '"$1":"[redacted-secret]"');
}

function unconfiguredStatus(): RemoteProviderConnectionBoundary {
  return {
    ...resolveRemoteProviderConnectionBoundary({
      providerType: 'googleDrive',
      status: 'unconfigured',
      capabilities: {
        supportsDownload: false,
        supportsUpload: false,
      },
    }),
    safeMessage: 'Google Drive connection is disabled in this build unless an explicit session controller is configured.',
  };
}

export function GoogleDriveManualConnectionPanel({
  colors: c,
  controller,
}: GoogleDriveManualConnectionPanelProps) {
  const [connectionStatus, setConnectionStatus] = useState<RemoteProviderConnectionBoundary>(() => unconfiguredStatus());
  const [startStatus, setStartStatus] = useState<ManualActionState>('idle');
  const [completeStatus, setCompleteStatus] = useState<ManualActionState>('idle');
  const [disconnectStatus, setDisconnectStatus] = useState<ManualActionState>('idle');
  const [authorizationUrl, setAuthorizationUrl] = useState('');
  const [authorizationExpiresAt, setAuthorizationExpiresAt] = useState('');
  const [callbackUrl, setCallbackUrl] = useState('');
  const [lastResult, setLastResult] = useState('');
  const [lastError, setLastError] = useState('');

  const configured = Boolean(controller);
  const connected = connectionStatus.status === 'available';

  const refreshStatus = async () => {
    if (!controller) {
      setConnectionStatus(unconfiguredStatus());
      return;
    }
    setConnectionStatus(await controller.getConnectionStatus());
  };

  useEffect(() => {
    void refreshStatus();
  }, [controller]);

  const startAuthorization = async () => {
    if (!controller || connected || startStatus === 'running') return;
    setStartStatus('running');
    setLastError('');
    setLastResult('');
    try {
      const result = await controller.startAuthorization();
      if (result.status === 'authorization_url_created') {
        setAuthorizationUrl(result.authorizationUrl);
        setAuthorizationExpiresAt(result.expiresAt);
        setStartStatus('complete');
        setLastResult('Authorization URL created. Open it manually in a separate browser flow.');
      } else {
        setStartStatus('error');
        setLastError(safeText(result.error ?? result.safeMessage));
      }
      await refreshStatus();
    } catch (error) {
      setStartStatus('error');
      setLastError(safeText(error));
    }
  };

  const completeConnection = async () => {
    if (!controller || !callbackUrl.trim() || completeStatus === 'running') return;
    setCompleteStatus('running');
    setLastError('');
    setLastResult('');
    const submittedCallbackUrl = callbackUrl.trim();
    setCallbackUrl('');
    try {
      const result = await controller.completeCallback({ callbackUrl: submittedCallbackUrl });
      setConnectionStatus(result.connectionStatus);
      if (result.status === 'connected') {
        setCompleteStatus('complete');
        setAuthorizationUrl('');
        setAuthorizationExpiresAt('');
        setLastResult('Google Drive session connected in memory only.');
      } else {
        setCompleteStatus('error');
        setLastError(safeText(result.error?.safeMessage ?? result.safeMessage));
      }
    } catch (error) {
      setCompleteStatus('error');
      setLastError(safeText(error));
      await refreshStatus();
    }
  };

  const disconnect = async () => {
    if (!controller || disconnectStatus === 'running') return;
    setDisconnectStatus('running');
    setLastError('');
    try {
      const result = await controller.disconnect();
      setAuthorizationUrl('');
      setAuthorizationExpiresAt('');
      setCallbackUrl('');
      setLastResult(safeText(result.safeMessage));
      setDisconnectStatus('complete');
      await refreshStatus();
    } catch (error) {
      setDisconnectStatus('error');
      setLastError(safeText(error));
    }
  };

  return (
    <div data-google-drive-manual-connection style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 800 }}>Google Drive Session</div>
        <p style={{ margin: '3px 0 0', fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>
          Google Drive connection is disabled in this build unless an explicit session controller is configured. Connection is session-only; tokens are memory-only and are lost on reload. This section does not upload, recover, sync, evict, or delete attachments automatically.
        </p>
      </div>

      <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.55 }}>
        <div>Status: <strong>{connectionStatus.displayLabel}</strong>{connectionStatus.providerType ? ` (${connectionStatus.providerType})` : ''}</div>
        <div>{connectionStatus.safeMessage}</div>
        <div>Capabilities: recovery {connectionStatus.canRecover ? 'available' : 'unavailable'}, upload {connectionStatus.canUpload ? 'available' : 'unavailable'}</div>
        {connectionStatus.lastCheckedAt ? <div>Last checked: {connectionStatus.lastCheckedAt}</div> : null}
        {connectionStatus.error ? <div style={{ color: c.danger }}>{connectionStatus.error}</div> : null}
      </div>

      {!configured ? (
        <div style={{ fontSize: 10.5, color: c.textMuted }}>
          This unavailable state is intentional. No authorization or callback action can run without an injected session controller.
        </div>
      ) : null}

      {connected ? (
        <div style={{ fontSize: 10.5, color: c.textMuted }}>
          Starting a new authorization while connected is not yet supported. Clear this session first.
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="btbtn"
          onClick={startAuthorization}
          disabled={!configured || connected || startStatus === 'running'}
          style={{ padding: '6px 9px', fontSize: 11, fontWeight: 800 }}
        >
          {startStatus === 'running' ? 'Generating URL...' : 'Generate authorization URL'}
        </button>
        <button
          type="button"
          className="btbtn"
          onClick={disconnect}
          disabled={!configured || disconnectStatus === 'running'}
          style={{ padding: '6px 9px', fontSize: 11, fontWeight: 800, color: c.textMuted }}
        >
          {disconnectStatus === 'running' ? 'Clearing session...' : 'Clear session'}
        </button>
      </div>

      {authorizationUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 10.5, fontWeight: 800 }} htmlFor="google-drive-authorization-url">Authorization URL</label>
          <textarea
            id="google-drive-authorization-url"
            readOnly
            value={authorizationUrl}
            aria-label="Generated Google Drive authorization URL"
            rows={3}
            style={{
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: 7,
              background: c.input,
              color: c.text,
              fontSize: 10,
              lineHeight: 1.45,
              resize: 'vertical',
            }}
          />
          {authorizationExpiresAt ? (
            <div style={{ fontSize: 10, color: c.textFaint }}>Pending authorization expires {authorizationExpiresAt}.</div>
          ) : null}
        </div>
      ) : null}

      {configured ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <label style={{ fontSize: 10.5, fontWeight: 800 }} htmlFor="google-drive-callback-url">Manual callback URL</label>
          <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>
            Paste the full callback URL after completing Google authorization in a separate browser flow. The field is cleared after every submit attempt.
          </div>
          <textarea
            id="google-drive-callback-url"
            value={callbackUrl}
            onChange={event => setCallbackUrl(event.currentTarget.value)}
            disabled={completeStatus === 'running'}
            aria-label="Google Drive callback URL"
            rows={3}
            style={{
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: 7,
              background: c.input,
              color: c.text,
              fontSize: 10,
              lineHeight: 1.45,
              resize: 'vertical',
            }}
          />
          <button
            type="button"
            className="btbtn"
            onClick={completeConnection}
            disabled={!callbackUrl.trim() || completeStatus === 'running'}
            style={{ padding: '6px 9px', fontSize: 11, fontWeight: 800, alignSelf: 'flex-start' }}
          >
            {completeStatus === 'running' ? 'Completing connection...' : 'Complete connection from callback'}
          </button>
        </div>
      ) : null}

      {lastResult ? <div style={{ fontSize: 10.5, color: c.textMuted }}>{lastResult}</div> : null}
      {lastError ? <div style={{ fontSize: 10.5, color: c.danger }}>{lastError}</div> : null}
    </div>
  );
}
