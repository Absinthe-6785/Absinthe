/** Editor QA instrumentation (clipboard trace, paste pipeline) — dev builds only. */
export function isEditorQaEnabled(): boolean {
  return import.meta.env.DEV;
}
