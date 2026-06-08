/**
 * htmlToggleParser.ts — HTML <details> / Absinthe .btoggle → toggle Block (UX-3A)
 */
import { makeBlock, type Block } from './blockUtils';

function inlineText(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/** True when element is a details/toggle container we can parse. */
export function isDetailsToggleElement(el: Element): boolean {
  const tag = el.tagName.toUpperCase();
  return tag === 'DETAILS' || el.classList.contains('btoggle');
}

function bodyNodesFromDetails(details: HTMLElement): Node[] {
  const btbody = details.querySelector(':scope > .btbody');
  if (btbody) return Array.from(btbody.childNodes);

  const nodes: Node[] = [];
  for (const child of Array.from(details.children)) {
    const tag = child.tagName.toUpperCase();
    if (tag === 'SUMMARY') continue;
    nodes.push(child);
  }
  return nodes;
}

/**
 * Parse <details> (or .btoggle) into a toggle block.
 * Returns null when no <summary> — caller should paragraph-fallback.
 */
export function toggleBlockFromDetails(
  details: HTMLElement,
  parseBodyNodes: (nodes: Node[]) => Block[],
): Block | null {
  const summaryEl = details.querySelector(':scope > summary');
  if (!summaryEl) return null;

  const content = inlineText(summaryEl);
  const collapsed = details.tagName.toUpperCase() === 'DETAILS'
    ? !(details as HTMLDetailsElement).open
    : false;

  const children = parseBodyNodes(bodyNodesFromDetails(details));
  return makeBlock('toggle', { content, children, collapsed });
}
