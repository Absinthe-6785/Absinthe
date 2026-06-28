import {
  sanitizeRemoteBlobProviderErrorMessage,
  type RemoteBlobProviderType,
  type SanitizedRemoteBlobProviderError,
} from './remoteBlobProvider';

export interface AttachmentRecoveryFailureDisplay {
  readonly title: string;
  readonly message: string;
  readonly severity: 'warning' | 'error';
  readonly retryable: boolean;
  readonly actionHint: string;
}

export interface AttachmentRecoveryFailureDisplayInput {
  readonly errorDetails?: SanitizedRemoteBlobProviderError | null;
  readonly providerType?: RemoteBlobProviderType;
}

function providerName(providerType: RemoteBlobProviderType | undefined): string {
  return providerType === 'googleDrive' ? 'Google Drive' : 'Remote provider';
}

export function formatRecoveryFailureForUi(
  input: AttachmentRecoveryFailureDisplayInput
): AttachmentRecoveryFailureDisplay {
  const provider = providerName(input.providerType);
  const error = input.errorDetails;
  const code = error?.code;
  const category = error?.category;
  const safeMessage = sanitizeRemoteBlobProviderErrorMessage(error?.message ?? '');

  if (code === 'auth_expired' || code === 'auth_unavailable' || code === 'token_unavailable' || code === 'reconnect_required') {
    return {
      title: `${provider} session expired`,
      message: 'Reconnect your session and try recovering this attachment again.',
      severity: 'warning',
      retryable: true,
      actionHint: 'Reconnect session',
    };
  }

  if (code === 'authorization_failed' || code === 'forbidden' || code === 'insufficient_scope') {
    return {
      title: `${provider} access denied`,
      message: 'This session does not have permission to download the remote file.',
      severity: 'error',
      retryable: false,
      actionHint: 'Check permission or reconnect',
    };
  }

  if (code === 'remote_file_missing') {
    return {
      title: 'Remote file not found',
      message: 'The Google Drive file for this attachment could not be found.',
      severity: 'error',
      retryable: false,
      actionHint: 'Check the remote file or restore from another backup',
    };
  }

  if (code === 'rate_limited') {
    return {
      title: `${provider} is rate limiting requests`,
      message: 'Try again later.',
      severity: 'warning',
      retryable: true,
      actionHint: 'Try again later',
    };
  }

  if (code === 'provider_unavailable' || category === 'network' || code === 'download_failed') {
    return {
      title: `${provider} is temporarily unavailable`,
      message: 'Try again after the provider is available.',
      severity: 'warning',
      retryable: error?.retryable ?? true,
      actionHint: 'Try again later',
    };
  }

  if (
    code === 'invalid_remote_response'
    || code === 'invalid_response'
    || code === 'verification_failed'
    || code === 'size_mismatch'
    || code === 'checksum_mismatch'
    || safeMessage.toLowerCase().includes('empty response body')
  ) {
    return {
      title: 'Downloaded file could not be verified',
      message: 'The remote response was invalid, so the local file was not restored.',
      severity: 'error',
      retryable: error?.retryable ?? false,
      actionHint: 'Try again or check the remote file',
    };
  }

  if (code === 'local_blob_write_failed') {
    return {
      title: 'Local save failed',
      message: 'The remote file was downloaded, but Absinthe could not save it locally.',
      severity: 'error',
      retryable: true,
      actionHint: 'Check local storage and try again',
    };
  }

  if (code === 'metadata_update_failed') {
    return {
      title: 'Recovery status update failed',
      message: 'The file may have downloaded, but Absinthe could not update its local recovery metadata.',
      severity: 'warning',
      retryable: error?.retryable ?? false,
      actionHint: 'Review diagnostics before retrying',
    };
  }

  return {
    title: 'Recovery failed',
    message: 'This attachment could not be recovered.',
    severity: 'error',
    retryable: error?.retryable ?? false,
    actionHint: error?.retryable ? 'Try again later or review diagnostics' : 'Review diagnostics',
  };
}
