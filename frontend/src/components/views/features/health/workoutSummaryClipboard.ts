/** Returns true only when the browser confirms a clipboard write. */
export async function writeWorkoutSummaryClipboard(text: string): Promise<boolean> {
  try {
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard && typeof clipboard.writeText === 'function') {
      await clipboard.writeText(text);
      return true;
    }
  } catch {
    // Try the existing synchronous browser fallback, but report only its result.
  }

  if (typeof document === 'undefined' || !document.body || typeof document.execCommand !== 'function') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  try {
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand('copy') === true;
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
