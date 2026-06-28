import {
  sanitizeRemoteBlobProviderErrorMessage,
  type RemoteBlobProviderCapabilities,
  type RemoteBlobProviderConnectionStatus,
  type RemoteBlobProviderType,
} from './remoteBlobProvider';

export type RemoteProviderConnectionBoundaryStatus =
  | 'unconfigured'
  | 'configured'
  | 'available'
  | 'unavailable'
  | 'auth_expired'
  | 'reconnect_required'
  | 'disabled_by_user'
  | 'unsupported'
  | 'error';

export interface RemoteProviderConnectionBoundary {
  readonly providerType?: RemoteBlobProviderType;
  readonly status: RemoteProviderConnectionBoundaryStatus;
  readonly displayLabel: string;
  readonly canUpload: boolean;
  readonly canDownload: boolean;
  readonly canRecover: boolean;
  readonly requiresUserAction: boolean;
  readonly safeMessage: string;
  readonly lastCheckedAt?: string;
  readonly error?: string;
}

export interface ResolveRemoteProviderConnectionBoundaryInput {
  readonly providerType?: RemoteBlobProviderType;
  readonly status?: RemoteProviderConnectionBoundaryStatus;
  readonly connectionStatus?: RemoteBlobProviderConnectionStatus;
  readonly capabilities?: Partial<RemoteBlobProviderCapabilities>;
  readonly disabledByUser?: boolean;
  readonly error?: unknown;
  readonly lastCheckedAt?: string;
}

const DEFAULT_MESSAGE_BY_STATUS: Record<RemoteProviderConnectionBoundaryStatus, string> = {
  unconfigured: 'No remote recovery provider is configured in this build.',
  configured: 'Remote provider is configured, but recovery availability has not been confirmed.',
  available: 'Remote provider is available for explicit per-attachment recovery.',
  unavailable: 'Remote provider is unavailable.',
  auth_expired: 'Remote provider authorization has expired. Reconnect is required before recovery.',
  reconnect_required: 'Remote provider needs reconnect before recovery.',
  disabled_by_user: 'Remote provider is disabled.',
  unsupported: 'Remote provider does not support attachment download recovery.',
  error: 'Remote provider status could not be checked.',
};

const LABEL_BY_STATUS: Record<RemoteProviderConnectionBoundaryStatus, string> = {
  unconfigured: 'Provider not configured',
  configured: 'Provider configured',
  available: 'Provider available',
  unavailable: 'Provider unavailable',
  auth_expired: 'Authorization expired',
  reconnect_required: 'Reconnect required',
  disabled_by_user: 'Provider disabled',
  unsupported: 'Download unsupported',
  error: 'Provider status error',
};

function normalizeStatus(input: ResolveRemoteProviderConnectionBoundaryInput): RemoteProviderConnectionBoundaryStatus {
  if (input.disabledByUser) return 'disabled_by_user';
  if (input.status) return input.status;
  if (!input.connectionStatus) return 'unconfigured';

  switch (input.connectionStatus.state) {
    case 'unconfigured':
      return 'unconfigured';
    case 'connected':
      return 'available';
    case 'reauth_required':
      return 'reconnect_required';
    case 'disconnected':
    case 'unavailable':
      return 'unavailable';
    default:
      return 'error';
  }
}

function safeMessage(input: ResolveRemoteProviderConnectionBoundaryInput, status: RemoteProviderConnectionBoundaryStatus): string {
  const rawMessage = input.error
    ? sanitizeRemoteBlobProviderErrorMessage(input.error)
    : input.connectionStatus?.message
      ? sanitizeRemoteBlobProviderErrorMessage(input.connectionStatus.message)
      : DEFAULT_MESSAGE_BY_STATUS[status];

  return rawMessage || DEFAULT_MESSAGE_BY_STATUS[status];
}

export function resolveRemoteProviderConnectionBoundary(
  input: ResolveRemoteProviderConnectionBoundaryInput = {},
): RemoteProviderConnectionBoundary {
  const status = normalizeStatus(input);
  const canUpload = input.capabilities?.supportsUpload === true;
  const canDownload = input.capabilities?.supportsDownload === true;
  const resolvedStatus: RemoteProviderConnectionBoundaryStatus = status === 'available' && !canDownload ? 'unsupported' : status;
  const requiresUserAction = resolvedStatus === 'auth_expired'
    || resolvedStatus === 'reconnect_required'
    || resolvedStatus === 'unconfigured'
    || resolvedStatus === 'disabled_by_user';

  return {
    providerType: input.providerType ?? input.connectionStatus?.providerType,
    status: resolvedStatus,
    displayLabel: LABEL_BY_STATUS[resolvedStatus],
    canUpload,
    canDownload,
    canRecover: resolvedStatus === 'available' && canDownload,
    requiresUserAction,
    safeMessage: safeMessage(input, resolvedStatus),
    lastCheckedAt: input.lastCheckedAt ?? input.connectionStatus?.checkedAt,
    error: input.error ? sanitizeRemoteBlobProviderErrorMessage(input.error) : undefined,
  };
}

export function recoveryUnavailableReasonForProvider(
  provider: RemoteProviderConnectionBoundary,
  hasRecoveryController: boolean,
  attachmentProvider?: RemoteBlobProviderType,
): string {
  if (provider.status === 'unconfigured') return 'Provider not configured';
  if (attachmentProvider && provider.providerType && attachmentProvider !== provider.providerType) return 'Recovery provider does not match this attachment.';
  if (attachmentProvider && !provider.providerType) return 'Provider mismatch';
  if (provider.status === 'auth_expired' || provider.status === 'reconnect_required') return 'Reconnect required';
  if (provider.status === 'disabled_by_user') return 'Provider disabled';
  if (provider.status === 'unsupported' || !provider.canDownload) return 'Download unsupported by provider';
  if (provider.status === 'unavailable' || provider.status === 'error') return 'Provider unavailable';
  if (!hasRecoveryController) return 'Recovery controller unavailable';
  if (!provider.canRecover) return 'Provider unavailable';
  return 'Recovery unavailable';
}
