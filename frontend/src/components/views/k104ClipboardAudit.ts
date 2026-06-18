/** K-104 — Image clipboard audit. */
export const K104_CLIPBOARD_MIME_TYPES = ['text/plain', 'text/html', 'image/png'] as const;

export function auditClipboardSupport(): string[] {
  return [...K104_CLIPBOARD_MIME_TYPES];
}

export function formatK104ClipboardReport(types: readonly string[]): string {
  return ['K-104 clipboard audit', '', ...types.map(t => `  ${t}`)].join('\n');
}
