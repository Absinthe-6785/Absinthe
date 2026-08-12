export const RETURN_TO_USE_ATTACHMENT_ISOLATION_ENV = 'VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION';

export const RETURN_TO_USE_ATTACHMENT_ISOLATION_MESSAGE =
  'Attachments are temporarily disabled while local backup safety is being completed.';

export function isReturnToUseAttachmentIsolationEnabled(): boolean {
  const configured = import.meta.env.VITE_ABSINTHE_RETURN_TO_USE_ATTACHMENT_ISOLATION;
  return configured !== 'false' && configured !== '0';
}
export function returnToUseAttachmentIsolationError(): Error {
  return new Error(RETURN_TO_USE_ATTACHMENT_ISOLATION_MESSAGE);
}
