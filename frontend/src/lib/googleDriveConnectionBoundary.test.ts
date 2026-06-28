import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  createGoogleDriveConnectionBoundary,
  createUnavailableGoogleDriveConnectionController,
  refreshGoogleDriveConnectionStatus,
  type GoogleDriveAccessTokenProvider,
} from './googleDriveConnectionBoundary';

describe('Google Drive connection boundary', () => {
  it('defaults to an unconfigured inert production boundary', async () => {
    const controller = createUnavailableGoogleDriveConnectionController();
    const status = await controller.getConnectionStatus();

    expect(controller.providerType).toBe('googleDrive');
    expect(controller.getAccessTokenProvider()).toBeNull();
    expect(status).toMatchObject({
      providerType: 'googleDrive',
      status: 'unconfigured',
      displayLabel: 'Provider not configured',
      canUpload: false,
      canDownload: false,
      canRecover: false,
      safeMessage: 'Google Drive is not configured in this build.',
    });
  });

  it('does not make configured Google Drive recoverable until it is available and download capable', async () => {
    const configured = createGoogleDriveConnectionBoundary({
      status: 'configured',
      canDownload: true,
      safeMessage: 'Google Drive configuration exists, but availability has not been confirmed.',
    });

    await expect(configured.getConnectionStatus()).resolves.toMatchObject({
      providerType: 'googleDrive',
      status: 'configured',
      canDownload: true,
      canRecover: false,
    });
  });

  it('can represent an explicitly injected available dev/test boundary without creating storage', async () => {
    const accessTokenProvider: GoogleDriveAccessTokenProvider = {
      getAccessToken: vi.fn(async () => 'test-only-access-token'),
    };
    const controller = createGoogleDriveConnectionBoundary({
      status: 'available',
      canDownload: true,
      canUpload: true,
      accessTokenProvider,
      lastCheckedAt: '2026-06-28T00:00:00.000Z',
    });

    expect(controller.getAccessTokenProvider()).toBe(accessTokenProvider);
    await expect(controller.getConnectionStatus()).resolves.toMatchObject({
      providerType: 'googleDrive',
      status: 'available',
      canUpload: true,
      canDownload: true,
      canRecover: true,
      lastCheckedAt: '2026-06-28T00:00:00.000Z',
    });
    expect(accessTokenProvider.getAccessToken).not.toHaveBeenCalled();
  });

  it('exposes explicit non-OAuth connect and disconnect placeholders', async () => {
    const controller = createGoogleDriveConnectionBoundary();

    await expect(controller.connect?.()).resolves.toEqual({
      providerType: 'googleDrive',
      status: 'not_implemented',
      safeMessage: 'Google Drive connection management is not implemented in this build.',
    });
    await expect(controller.disconnect?.()).resolves.toEqual({
      providerType: 'googleDrive',
      status: 'not_implemented',
      safeMessage: 'Google Drive disconnection is not implemented in this build.',
    });
  });

  it('refreshes status without OAuth refresh or token access by default', async () => {
    await expect(refreshGoogleDriveConnectionStatus(null)).resolves.toMatchObject({
      providerType: 'googleDrive',
      status: 'unconfigured',
      canRecover: false,
    });
  });

  it('sanitizes status errors without exposing tokens or endpoint URLs', async () => {
    const controller = createGoogleDriveConnectionBoundary({
      status: 'error',
      canDownload: true,
      error: 'Authorization: Bearer token-secret refresh_token=refresh-secret https://oauth2.googleapis.com/token?client_secret=client-secret',
    });
    const status = await controller.getConnectionStatus();

    expect(status.status).toBe('error');
    expect(status.error).toContain('[redacted-secret]');
    expect(JSON.stringify(status)).not.toContain('token-secret');
    expect(JSON.stringify(status)).not.toContain('refresh-secret');
    expect(JSON.stringify(status)).not.toContain('client-secret');
    expect(JSON.stringify(status)).not.toContain('oauth2.googleapis.com/token');
  });

  it('does not implement OAuth, token storage, Google sign-in, or destructive remote controls', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/googleDriveConnectionBoundary.ts'), 'utf8');

    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('indexedDB');
    expect(source).not.toContain('oauth2.googleapis.com/token');
    expect(source).not.toContain('client_secret');
    expect(source).not.toContain('refresh_token');
    expect(source).not.toContain('deleteBlob');
    expect(source).not.toContain('remoteDelete');
    expect(source).not.toContain('Sign in with Google');
    expect(source).not.toContain('Connect Google Drive');
    expect(source).not.toContain('Authorize Google');
  });
});
