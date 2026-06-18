import type { NoteChromeColors } from '../components/views/noteEditorTheme';

/** K-99 — shared interaction-state CSS snippets for Note chrome. */
export interface InteractionStateTokens {
  hoverBg: string;
  activeBg: string;
  selectedBg: string;
  selectedBorder: string;
  focusRing: string;
  disabledOpacity: string;
}

export function buildInteractionStateTokens(c: NoteChromeColors): InteractionStateTokens {
  return {
    hoverBg: c.cardHov,
    activeBg: c.accentBg,
    selectedBg: c.cardAct,
    selectedBorder: c.cardActBdr,
    focusRing: `0 0 0 2px ${c.accent}55`,
    disabledOpacity: '0.45',
  };
}

export function interactionStateCss(c: NoteChromeColors): string {
  const t = buildInteractionStateTokens(c);
  return `
    .k99-interactive,.k101-interactive{transition:background .12s,color .12s,opacity .12s,box-shadow .12s,border-color .12s}
    .k99-interactive:hover:not(:disabled),.k101-interactive:hover:not(:disabled){background:${t.hoverBg}}
    .k99-interactive:active:not(:disabled),.k101-interactive:active:not(:disabled){background:${t.activeBg}}
    .k99-interactive:focus-visible,.k101-interactive:focus-visible{outline:none;box-shadow:${t.focusRing}}
    .k99-interactive:disabled,.k101-interactive:disabled{opacity:${t.disabledOpacity};cursor:not-allowed}
    .k99-selected,.k101-selected{background:${t.selectedBg}!important;border-color:${t.selectedBorder}!important}
    .k101-planner-chip{transition:opacity .12s,box-shadow .12s,transform .12s}
    .k101-planner-chip:hover{opacity:.95;box-shadow:0 1px 4px rgba(0,0,0,.12)}
    .k101-planner-chip[data-selected="true"]{box-shadow:inset 0 0 0 2px ${c.accent}}
    .k101-skeleton-pulse{animation:k101-pulse 1.2s ease-in-out infinite}
    @keyframes k101-pulse{0%,100%{opacity:.45}50%{opacity:.85}}
  `;
}
