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
    .k99-interactive{transition:background .12s,color .12s,opacity .12s,box-shadow .12s}
    .k99-interactive:hover:not(:disabled){background:${t.hoverBg}}
    .k99-interactive:active:not(:disabled){background:${t.activeBg}}
    .k99-interactive:focus-visible{outline:none;box-shadow:${t.focusRing}}
    .k99-interactive:disabled{opacity:${t.disabledOpacity};cursor:not-allowed}
    .k99-selected{background:${t.selectedBg};border-color:${t.selectedBorder}}
  `;
}
