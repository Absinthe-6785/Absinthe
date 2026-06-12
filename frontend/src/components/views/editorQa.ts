/** Editor QA instrumentation (clipboard trace, paste pipeline) — dev/test builds only. */
export function isEditorQaEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'test';
}
