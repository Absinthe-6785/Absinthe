import { describe, expect, it } from 'vitest';
import {
  recoveryUnavailableReasonForProvider,
  resolveRemoteProviderConnectionBoundary,
} from './remoteProviderConnectionStatus';

const downloadCapable = {
  supportsUpload: false,
  supportsDownload: true,
};

describe('remote provider connection boundary', () => {
  it('defaults to an unconfigured observe-only provider state', () => {
    const status = resolveRemoteProviderConnectionBoundary();

    expect(status).toMatchObject({
      status: 'unconfigured',
      displayLabel: 'Provider not configured',
      canRecover: false,
      requiresUserAction: true,
    });
    expect(recoveryUnavailableReasonForProvider(status, true)).toBe('Provider not configured');
  });

  it('allows recovery only for available providers with download support', () => {
    const status = resolveRemoteProviderConnectionBoundary({
      providerType: 'googleDrive',
      status: 'available',
      capabilities: downloadCapable,
    });

    expect(status).toMatchObject({
      providerType: 'googleDrive',
      status: 'available',
      canDownload: true,
      canRecover: true,
    });
    expect(recoveryUnavailableReasonForProvider(status, false)).toBe('Recovery controller unavailable');
  });

  it('blocks available providers that do not support download', () => {
    const status = resolveRemoteProviderConnectionBoundary({
      providerType: 'googleDrive',
      status: 'available',
      capabilities: { supportsDownload: false },
    });

    expect(status.status).toBe('unsupported');
    expect(status.canRecover).toBe(false);
    expect(recoveryUnavailableReasonForProvider(status, true)).toBe('Download unsupported by provider');
  });

  it('maps existing remote blob provider connection states safely', () => {
    const status = resolveRemoteProviderConnectionBoundary({
      connectionStatus: {
        providerType: 'googleDrive',
        state: 'reauth_required',
        checkedAt: '2026-06-28T00:00:00.000Z',
        message: 'Drive needs access_token=secret and https://oauth2.googleapis.com/token?client_secret=secret',
      },
      capabilities: downloadCapable,
    });

    expect(status).toMatchObject({
      providerType: 'googleDrive',
      status: 'reconnect_required',
      displayLabel: 'Reconnect required',
      canRecover: false,
      requiresUserAction: true,
      lastCheckedAt: '2026-06-28T00:00:00.000Z',
    });
    expect(status.safeMessage).toContain('[redacted-secret]');
    expect(status.safeMessage).not.toContain('access_token=secret');
    expect(status.safeMessage).not.toContain('client_secret=secret');
    expect(status.safeMessage).not.toContain('oauth2.googleapis.com/token');
    expect(recoveryUnavailableReasonForProvider(status, true)).toBe('Reconnect required');
  });

  it('sanitizes explicit auth-expired and error messages', () => {
    const status = resolveRemoteProviderConnectionBoundary({
      providerType: 'googleDrive',
      status: 'auth_expired',
      capabilities: downloadCapable,
      error: 'Authorization: Bearer token-secret refresh_token=refresh-secret',
    });

    expect(status.displayLabel).toBe('Authorization expired');
    expect(status.error).toContain('[redacted-secret]');
    expect(status.error).not.toContain('token-secret');
    expect(status.error).not.toContain('refresh-secret');
    expect(status.canRecover).toBe(false);
  });

  it('reports provider mismatch before exposing recovery', () => {
    const status = resolveRemoteProviderConnectionBoundary({
      providerType: 'googleDrive',
      status: 'available',
      capabilities: downloadCapable,
    });

    expect(recoveryUnavailableReasonForProvider(status, true, 'r2')).toBe('Recovery provider does not match this attachment.');
    expect(recoveryUnavailableReasonForProvider(status, true, 'googleDrive')).toBe('Recovery unavailable');
  });

  it('represents disabled and error states without recovery capability', () => {
    const disabled = resolveRemoteProviderConnectionBoundary({
      providerType: 'googleDrive',
      status: 'disabled_by_user',
      capabilities: downloadCapable,
    });
    const error = resolveRemoteProviderConnectionBoundary({
      providerType: 'googleDrive',
      status: 'error',
      capabilities: downloadCapable,
      error: 'raw provider response Authorization: Bearer token-secret',
    });

    expect(disabled).toMatchObject({
      status: 'disabled_by_user',
      displayLabel: 'Provider disabled',
      canRecover: false,
      requiresUserAction: true,
    });
    expect(recoveryUnavailableReasonForProvider(disabled, true, 'googleDrive')).toBe('Provider disabled');
    expect(error).toMatchObject({
      status: 'error',
      displayLabel: 'Provider status error',
      canRecover: false,
    });
    expect(error.error).not.toContain('token-secret');
    expect(recoveryUnavailableReasonForProvider(error, true, 'googleDrive')).toBe('Provider unavailable');
  });
});
