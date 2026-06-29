import {
  sanitizeRemoteBlobProviderErrorMessage,
  type RemoteBlobProviderType,
  type SanitizedRemoteBlobProviderError,
} from './remoteBlobProvider';

export interface AttachmentUploadFailureDisplay {
  readonly title: string;
  readonly message: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly retryable: boolean;
  readonly manualReview: boolean;
  readonly remoteObjectAmbiguous: boolean;
  readonly actionHint: string;
}

export interface AttachmentUploadFailureDisplayInput {
  readonly errorDetails?: SanitizedRemoteBlobProviderError | null;
  readonly providerType?: RemoteBlobProviderType;
  readonly reasonCode?: string;
  readonly manualReview?: boolean;
  readonly remoteObjectAmbiguous?: boolean;
}

function providerName(providerType: RemoteBlobProviderType | undefined): string {
  return providerType === 'googleDrive' ? 'Google Drive' : 'Remote provider';
}

function codeFrom(input: AttachmentUploadFailureDisplayInput): string {
  return String(input.reasonCode ?? input.errorDetails?.code ?? '').toLowerCase();
}

export function formatUploadFailureForUi(
  input: AttachmentUploadFailureDisplayInput,
): AttachmentUploadFailureDisplay {
  const provider = providerName(input.providerType);
  const error = input.errorDetails;
  const code = codeFrom(input);
  const category = error?.category;
  const retryable = error?.retryable ?? false;
  const safeMessage = sanitizeRemoteBlobProviderErrorMessage(error?.message ?? '').toLowerCase();

  if (code === 'upload_in_progress') {
    return {
      title: 'Upload already in progress',
      message: 'Wait for the current upload to finish before starting another upload.',
      severity: 'info',
      retryable: false,
      manualReview: false,
      remoteObjectAmbiguous: false,
      actionHint: 'Wait for upload to finish',
    };
  }

  if (code === 'another_upload_in_progress') {
    return {
      title: 'Another upload is in progress',
      message: 'Absinthe allows one explicit Google Drive upload at a time in this panel.',
      severity: 'info',
      retryable: false,
      manualReview: false,
      remoteObjectAmbiguous: false,
      actionHint: 'Wait for the current upload to finish',
    };
  }

  if (code === 'metadata_update_failed' || input.manualReview) {
    return {
      title: 'Upload needs manual review',
      message: 'The remote upload may have succeeded, but Absinthe could not update local metadata safely.',
      severity: 'warning',
      retryable: false,
      manualReview: true,
      remoteObjectAmbiguous: input.remoteObjectAmbiguous ?? true,
      actionHint: 'Review diagnostics before uploading again',
    };
  }

  if (code === 'auth_expired' || code === 'auth_unavailable' || code === 'token_unavailable' || code === 'reconnect_required') {
    return {
      title: `${provider} session expired`,
      message: 'Reconnect your session before uploading this attachment again.',
      severity: 'warning',
      retryable: true,
      manualReview: false,
      remoteObjectAmbiguous: false,
      actionHint: 'Reconnect session',
    };
  }

  if (code === 'authorization_failed' || code === 'forbidden' || code === 'insufficient_scope') {
    return {
      title: `${provider} upload access denied`,
      message: 'This session does not have permission to upload this attachment.',
      severity: 'error',
      retryable,
      manualReview: false,
      remoteObjectAmbiguous: false,
      actionHint: 'Check permissions or reconnect',
    };
  }

  if (code === 'rate_limited') {
    return {
      title: `${provider} is rate limiting uploads`,
      message: 'Try uploading again later.',
      severity: 'warning',
      retryable: true,
      manualReview: false,
      remoteObjectAmbiguous: false,
      actionHint: 'Try again later',
    };
  }

  if (code === 'provider_unavailable' || category === 'network' || safeMessage.includes('network')) {
    return {
      title: `${provider} is temporarily unavailable`,
      message: 'Try uploading again after the provider is available.',
      severity: 'warning',
      retryable: retryable || category === 'network' || code === 'provider_unavailable',
      manualReview: false,
      remoteObjectAmbiguous: false,
      actionHint: 'Try again later',
    };
  }

  if (code === 'local_blob_missing') {
    return {
      title: 'Local file missing',
      message: 'Absinthe could not find the local file to upload.',
      severity: 'error',
      retryable: false,
      manualReview: false,
      remoteObjectAmbiguous: false,
      actionHint: 'Restore or recover the local file first',
    };
  }

  if (code === 'local_blob_unreadable') {
    return {
      title: 'Local file could not be read',
      message: 'Absinthe could not read the local file for upload.',
      severity: 'error',
      retryable,
      manualReview: false,
      remoteObjectAmbiguous: false,
      actionHint: 'Check local storage and try again',
    };
  }

  if (code === 'invalid_response' || code === 'invalid_upload_response' || code === 'missing_remote_id' || safeMessage.includes('remote file id')) {
    return {
      title: 'Upload response could not be verified',
      message: `${provider} responded, but Absinthe could not verify the uploaded file id.`,
      severity: 'warning',
      retryable,
      manualReview: false,
      remoteObjectAmbiguous: true,
      actionHint: 'Review diagnostics before retrying',
    };
  }

  if (code === 'verification_failed' || code === 'size_mismatch' || code === 'checksum_mismatch' || safeMessage.includes('verification failed')) {
    return {
      title: 'Uploaded file could not be verified',
      message: 'The upload completed, but the returned file details did not match the local attachment.',
      severity: 'warning',
      retryable,
      manualReview: false,
      remoteObjectAmbiguous: true,
      actionHint: 'Review diagnostics before retrying',
    };
  }

  if (code === 'upload_failed') {
    return {
      title: 'Upload failed',
      message: `This attachment could not be uploaded to ${provider}.`,
      severity: 'error',
      retryable,
      manualReview: false,
      remoteObjectAmbiguous: false,
      actionHint: retryable ? 'Try again later or review diagnostics' : 'Review diagnostics',
    };
  }

  return {
    title: 'Upload failed',
    message: 'This attachment could not be uploaded.',
    severity: 'error',
    retryable,
    manualReview: false,
    remoteObjectAmbiguous: false,
    actionHint: retryable ? 'Try again later or review diagnostics' : 'Review diagnostics',
  };
}
