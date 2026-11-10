const COSMOS_NODE_SELECTOR = '[data-cosmos-graph-node="true"]';
const INTERACTIVE_TARGET_SELECTOR = [
  'input', 'textarea', 'select', 'button', 'a[href]',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]', '[role="link"]', '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Restrict window-level graph navigation to graph/background focus only. */
export function shouldHandleCosmosGraphKeyboardEvent(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return false;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (!target.closest('[data-cosmos-graph-surface="true"]')) return false;

  const graphNode = target.closest(COSMOS_NODE_SELECTOR);
  if (graphNode) return event.key.startsWith('Arrow') || event.key === 'Escape';
  return !target.closest(INTERACTIVE_TARGET_SELECTOR);
}
