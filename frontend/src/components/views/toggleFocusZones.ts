/**
 * toggleFocusZones.ts — Toggle-aware hit zones for document focus (UX-3C)
 */
import { findBlockById, type Block } from './blockUtils';
import { isToggleBlockType } from './toggleBlockTypes';

/** Slack below collapsed toggle header treated as part of the toggle row. */
export const COLLAPSED_TOGGLE_ROW_EXTENSION_PX = 48;

/** Slack below expanded toggle children for footer-zone classification only. */
export const EXPANDED_TOGGLE_FOOTER_SLACK_PX = 32;

export type ToggleFooterZoneKind = 'none' | 'footer-candidate';

export interface ToggleFooterZoneHit {
  kind: ToggleFooterZoneKind;
  toggleId: string | null;
  /** True when click is inside toggle wrap but below last visible child. */
  insideWrapBelowChildren: boolean;
}

export type ToggleFooterRecommendation =
  | 'keep-outside-insertion'
  | 'optional-inside-insertion'
  | 'hybrid-model';

export interface ToggleFooterFeasibility {
  feasible: boolean;
  domDetectable: boolean;
  requiresPastePathChange: boolean;
  nestedEditorAware: boolean;
  recommendation: ToggleFooterRecommendation;
  rationale: string;
}

export function isCollapsedToggle(block: Block): boolean {
  return isToggleBlockType(block.type) && !!block.collapsed;
}

export function toggleNestDepth(wrap: Element): number {
  let depth = 0;
  let el: Element | null = wrap.parentElement;
  while (el) {
    if (el.classList.contains('be-toggle-wrap')) depth++;
    el = el.parentElement;
  }
  return depth;
}

export function collapsedToggleRowBounds(
  headerRect: DOMRect,
  extensionPx = COLLAPSED_TOGGLE_ROW_EXTENSION_PX,
): { top: number; bottom: number } {
  return { top: headerRect.top, bottom: headerRect.bottom + extensionPx };
}

export function isClientYInCollapsedToggleRow(
  clientY: number,
  headerRect: DOMRect,
  extensionPx = COLLAPSED_TOGGLE_ROW_EXTENSION_PX,
): boolean {
  const zone = collapsedToggleRowBounds(headerRect, extensionPx);
  return clientY >= zone.top && clientY <= zone.bottom;
}

/** Deepest collapsed toggle whose extended row zone contains clientY. */
export function findCollapsedToggleZoneHit(
  clientY: number,
  editorRoot: HTMLElement,
  rootBlocks: Block[],
  extensionPx = COLLAPSED_TOGGLE_ROW_EXTENSION_PX,
): string | null {
  const wraps = editorRoot.querySelectorAll('.be-toggle-wrap.be-toggle-collapsed');
  let bestId: string | null = null;
  let bestDepth = -1;

  for (const wrap of wraps) {
    const header = wrap.querySelector('.be-toggle-header-block[data-drag-id]') as HTMLElement | null;
    if (!header) continue;
    const id = header.getAttribute('data-drag-id');
    if (!id) continue;

    const block = findBlockById(rootBlocks, id);
    if (!block || !isCollapsedToggle(block)) continue;

    const rect = header.getBoundingClientRect();
    if (!isClientYInCollapsedToggleRow(clientY, rect, extensionPx)) continue;

    const depth = toggleNestDepth(wrap);
    if (depth > bestDepth) {
      bestDepth = depth;
      bestId = id;
    }
  }

  return bestId;
}

function footerZoneBounds(wrap: Element): { footerTop: number; footerBottom: number; childrenBottom: number } | null {
  const children = wrap.querySelector('.be-toggle-children') as HTMLElement | null;
  if (!children) return null;
  const wrapRect = wrap.getBoundingClientRect();
  const childrenRect = children.getBoundingClientRect();
  return {
    footerTop: childrenRect.bottom - EXPANDED_TOGGLE_FOOTER_SLACK_PX,
    footerBottom: Math.max(wrapRect.bottom, childrenRect.bottom) + EXPANDED_TOGGLE_FOOTER_SLACK_PX,
    childrenBottom: childrenRect.bottom,
  };
}

/** Deepest expanded toggle whose footer slack zone contains clientY. */
export function findExpandedToggleFooterHit(
  clientY: number,
  editorRoot: HTMLElement,
  rootBlocks: Block[],
): string | null {
  const wraps = editorRoot.querySelectorAll('.be-toggle-wrap:not(.be-toggle-collapsed)');
  let bestId: string | null = null;
  let bestDepth = -1;

  for (const wrap of wraps) {
    const header = wrap.querySelector('.be-toggle-header-block[data-drag-id]') as HTMLElement | null;
    const toggleId = header?.getAttribute('data-drag-id') ?? null;
    if (!toggleId) continue;

    const block = findBlockById(rootBlocks, toggleId);
    if (!block || isCollapsedToggle(block)) continue;

    const bounds = footerZoneBounds(wrap);
    if (!bounds) continue;
    if (clientY < bounds.footerTop || clientY > bounds.footerBottom) continue;

    const depth = toggleNestDepth(wrap);
    if (depth > bestDepth) {
      bestDepth = depth;
      bestId = toggleId;
    }
  }

  return bestId;
}

/** Classify expanded-toggle footer zone for chrome clicks after last child. */
export function classifyToggleFooterZone(
  clientY: number,
  editorRoot: HTMLElement,
  rootBlocks: Block[] = [],
): ToggleFooterZoneHit {
  const toggleId = findExpandedToggleFooterHit(clientY, editorRoot, rootBlocks);
  if (!toggleId) {
    return { kind: 'none', toggleId: null, insideWrapBelowChildren: false };
  }

  const wrap = editorRoot.querySelector(
    `.be-toggle-header-block[data-drag-id="${toggleId}"]`,
  )?.closest('.be-toggle-wrap');
  const bounds = wrap ? footerZoneBounds(wrap) : null;

  return {
    kind: 'footer-candidate',
    toggleId,
    insideWrapBelowChildren: bounds ? clientY > bounds.childrenBottom : true,
  };
}

/** UX-3C feasibility verdict for expanded toggle footer insertion. */
export function evaluateToggleFooterFeasibility(): ToggleFooterFeasibility {
  return {
    feasible: true,
    domDetectable: true,
    requiresPastePathChange: false,
    nestedEditorAware: true,
    recommendation: 'hybrid-model',
    rationale:
      'Footer zone is DOM-detectable via .be-toggle-wrap + .be-toggle-children bounds. '
      + 'Inside-child insertion requires nested onChange scoped to toggle.children and differs from '
      + 'root-level append UX-3B path. Recommend hybrid: keep outside insertion as default; '
      + 'optional inside insertion when footer-candidate AND expanded toggle is last focused context (future UX-3D).',
  };
}

/** Resolve toggle-priority focus before generic nearest-block / append logic. */
export function resolveToggleAwareFocus(
  clientY: number,
  rootBlocks: Block[],
  editorRoot: HTMLElement,
): { blockId: string; offset: 'start' | 'end' } | null {
  const collapsedId = findCollapsedToggleZoneHit(clientY, editorRoot, rootBlocks);
  if (!collapsedId) return null;
  const block = findBlockById(rootBlocks, collapsedId);
  if (!block) return null;
  const offset = block.content.trim() ? 'end' : 'start';
  return { blockId: collapsedId, offset };
}
