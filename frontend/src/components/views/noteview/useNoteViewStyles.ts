import { useMemo } from 'react';
import type { NoteChromeColors } from '../noteEditorTheme';
import { interactionStateCss } from '../../../theme/k99InteractionTokens';
import { K99_SCROLL_PANE_CLASS, K99_STICKY_HEADER_CLASS } from '../../common/k99ScrollChrome';

export function buildNoteViewStyles(c: NoteChromeColors, dark: boolean): string {
  return `
    ${interactionStateCss(c)}
    /* ── K-99 scroll chrome ── */
    .${K99_SCROLL_PANE_CLASS}{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;scrollbar-width:thin;scrollbar-color:${c.textFaint}55 transparent}
    .${K99_SCROLL_PANE_CLASS}::-webkit-scrollbar{width:6px;height:6px}
    .${K99_SCROLL_PANE_CLASS}::-webkit-scrollbar-thumb{background:${c.textFaint}55;border-radius:999px}
    .${K99_SCROLL_PANE_CLASS}::-webkit-scrollbar-thumb:hover{background:${c.textMuted}77}
    .${K99_STICKY_HEADER_CLASS}{position:sticky;top:0;z-index:2;flex-shrink:0;background:inherit}
    /* ── 프리뷰 렌더 ── */
    .broot{font-size:15px;line-height:1.75;padding:20px 28px;max-width:680px;margin:0 auto;color:${c.text}}
    .bh1{font-size:26px;font-weight:800;margin:32px 0 10px;color:${c.text};letter-spacing:-.5px}
    .bh2{font-size:20px;font-weight:700;margin:24px 0 8px;color:${c.text}}
    .bh3{font-size:16px;font-weight:600;margin:16px 0 6px;color:${c.textMuted}}
    .bpara{margin:4px 0;min-height:1.4em}
    .bempty{height:10px}
    .bbold{font-weight:700}
    .bital{font-style:italic;color:${c.textMuted}}
    .bhl{background:${dark ? '#3d3860' : '#e8e4ff'};color:${c.text};padding:1px 4px;border-radius:3px}
    .bcode{font-family:'JetBrains Mono','Fira Code',monospace;font-size:13px;background:${dark ? '#2C2C2E' : '#F0EDE5'};color:${dark ? '#A8FF78' : '#5C3A1E'};padding:2px 6px;border-radius:4px}
    .bpre{background:${dark ? '#1C1C1E' : '#F5F2EA'};border:1px solid ${c.sideBdr};border-radius:10px;padding:18px 20px;margin:12px 0;overflow-x:auto;font-family:'JetBrains Mono','Fira Code',monospace;font-size:13px;color:${dark ? '#A8FF78' : '#3D2B1A'};white-space:pre;line-height:1.6}
    .bul-group,.bol-group{margin:6px 0 6px 4px;padding:0;list-style:none}
    .bul{position:relative;padding:2px 0 2px 18px;color:${c.text}}
    .bul::before{content:'•';position:absolute;left:4px;color:${c.textMuted}}
    .bol{position:relative;padding:2px 0 2px 18px;color:${c.text};counter-increment:listctr}
    .bchk{padding:3px 0;color:${c.textMuted};font-size:14px;display:flex;align-items:baseline;gap:6px}
    .bchk.done{color:${c.green};text-decoration:line-through;opacity:.75}
    .bhr{border:none;border-top:1px solid ${c.sideBdr};margin:20px 0}
    .bimg{max-width:100%;border-radius:10px;margin:10px 0;border:1px solid ${c.sideBdr}}
    table{border-collapse:collapse;width:100%;margin:14px 0;font-size:14px;border-radius:8px;overflow:hidden}
    th{background:${dark ? '#2C2C2E' : '#F0EDE5'};color:${c.text};padding:9px 14px;text-align:left;border:1px solid ${c.sideBdr};font-weight:600;font-size:13px}
    td{padding:9px 14px;border:1px solid ${c.sideBdr};color:${c.text};font-size:13px}
    tr:nth-child(even) td{background:${dark ? '#1E1E20' : '#FAF8F3'}}
    tr:hover td{background:${c.cardHov}}
    .bwl{color:${c.accent};cursor:pointer;border-bottom:1px solid ${c.accent}55;padding-bottom:1px;font-weight:500}
    .bwl:hover{opacity:.75}
    .bwlm{color:${c.danger};border-bottom:1px dashed ${c.danger}50;padding-bottom:1px}
    .bwtag{color:${c.tagTxt};background:${c.tag};border-radius:4px;padding:1px 7px;font-size:12px;cursor:pointer;font-weight:500}
    .bwtag:hover{opacity:.8}
    .bmathb{overflow-x:auto;padding:12px 0;text-align:center;display:block}
    .bmathi{display:inline}
    .bmerr{color:${c.danger};font-size:12px}
    /* ── Notion 스타일 토글 ── */
    .btoggle{margin:4px 0;border-radius:6px}
    .btsummary{cursor:pointer;padding:4px 6px;border-radius:6px;font-weight:500;list-style:none;display:flex;align-items:center;gap:6px;color:${c.text};user-select:none}
    .btsummary::before{content:'▶';font-size:9px;color:${c.textMuted};transition:transform .15s;flex-shrink:0}
    details[open] > .btsummary::before{transform:rotate(90deg)}
    .btsummary:hover{background:${c.cardHov}}
    .btbody{padding:4px 0 4px 22px;border-left:2px solid ${c.textFaint};margin-left:10px}
    /* ── 에디터/UI ── */
    .btbtn{background:none;border:none;color:${c.textMuted};cursor:pointer;padding:0;width:40px;height:40px;min-width:40px;min-height:40px;border-radius:8px;transition:all .12s;display:inline-flex;align-items:center;justify-content:center;gap:6px}
    .btbtn-sm{width:32px;height:32px;min-width:32px;min-height:32px;border-radius:6px}
    .btbtn-lg{width:48px;height:48px;min-width:48px;min-height:48px;border-radius:10px}
    .btbtn:hover{background:${c.cardHov};color:${c.accent}}
    .btbtn:active{background:${c.accentBg}}
    .btbtn:focus-visible{outline:none;box-shadow:0 0 0 2px ${c.accent}55}
    .btbtn:disabled{opacity:.45;cursor:not-allowed}
    .be-context-chip-btn{background:none;cursor:pointer;font:inherit;transition:background .12s,color .12s,filter .12s}
    .be-context-chip-btn:hover{filter:brightness(1.06)}
    .be-editor-toolbar-btn{background:${c.card};border:1px solid ${c.toolBdr};color:${c.textMuted};cursor:pointer;padding:0;width:24px;height:24px;border-radius:6px;transition:all .12s;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
    .be-editor-toolbar-btn:hover{background:${c.cardHov};color:${c.accent}}
    .be-editor-toolbar-btn:active{background:${c.accentBg}}
    .be-editor-toolbar-btn:focus-visible{outline:none;box-shadow:0 0 0 2px ${c.accent}55}
    .be-editor-toolbar-scope{font-size:10px;padding:0 8px;height:24px;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;box-sizing:border-box;border:1px solid ${c.toolBdr};background:${c.card};color:${c.textMuted};transition:all .12s}
    .be-editor-toolbar-scope:hover{background:${c.cardHov}}
    .be-editor-toolbar-scope.active{background:${c.accentBg};color:${c.accent};border-color:${c.accent}}
    .bfi{display:flex;align-items:center;gap:6px;padding:4px 10px;min-height:28px;cursor:pointer;transition:background .12s;font-size:11px;color:${c.text}}
    [data-list-density="compact"] .bfi{min-height:26px;padding:3px 9px;font-size:10px}
    [data-list-density="ultra"] .bfi{min-height:24px;padding:2px 8px;font-size:10px}
    [data-list-density="compact"] .bni{padding:6px 9px;min-height:36px}
    [data-list-density="ultra"] .bni{padding:4px 8px;min-height:32px}
    .bfi:hover{background:${c.cardHov}}
    .bfi.active{background:${c.accentBg};border-right:2px solid ${c.accent};color:${c.accent};font-weight:600}
    .bni{padding:8px 10px;cursor:pointer;border-bottom:1px solid ${c.sideBdr};transition:background .12s;min-height:44px}
    .bni:hover{background:${c.cardHov}}
    .bni:active{background:${c.accentBg}}
    .bni:focus-visible{outline:none;box-shadow:inset 0 0 0 2px ${c.accent}55}
    .bni.active{background:${c.cardAct};border-left:3px solid ${c.cardActBdr};box-shadow:inset 0 0 0 1px ${c.accent}22}
    .bwi{background:${c.input};border:1px solid ${c.inputBdr};color:${c.text};border-radius:7px;padding:6px 10px;font-size:12px;outline:none}
    .bwi:focus{border-color:${c.accent}}
    .bwbg{background:${c.accent};color:${dark ? '#0F0F11' : '#FFFFFF'};border:none;border-radius:12px;padding:8px 14px;font-size:12px;font-weight:700;cursor:pointer;min-height:36px;transition:opacity .12s,transform .08s}
    .bwbg:hover{opacity:.9}
    .bwbg:active{transform:scale(.98);opacity:.85}
    .bwbg:focus-visible{outline:none;box-shadow:0 0 0 2px ${c.accent}55}
    .bwbg:disabled{opacity:.45;cursor:not-allowed;transform:none}
    .bwsi{background:${c.input};border:1px solid ${c.inputBdr};border-radius:16px;padding:6px 10px 6px 28px;font-size:12px;color:${c.text};outline:none;width:100%}
    .bwsi:focus{border-color:${c.accent}80}
    .bseclbl{padding:6px 10px 2px;font-size:9px;color:${c.textFaint};font-weight:700;letter-spacing:1px;text-transform:uppercase}
    .btoc{display:flex;align-items:center;gap:3px;padding:3px 8px;cursor:pointer;font-size:11px;color:${c.textMuted};border-radius:4px;transition:all .12s}
    .btoc:hover{color:${c.accent};background:${c.cardHov}}
    .btoc.active{color:${c.accent};background:${c.cardHov};font-weight:600}
    .btpill{background:${c.tag};color:${c.tagTxt};border-radius:999px;font-size:10px;padding:2px 8px;cursor:pointer;border:1px solid transparent}
    .btpill:hover{border-color:${c.tagTxt}60}
    .btpill.active{border-color:${c.tagTxt};font-weight:600}
    .bbl{padding:6px 10px;font-size:12px;color:${c.accent};cursor:pointer;border-radius:5px}
    .bbl:hover{background:${c.cardHov}}
    .bshl{background:${dark ? '#5a4f9a' : '#c4b8ff'};color:${c.text};border-radius:3px;padding:1px 4px;box-shadow:0 0 0 1px ${c.accent}66,inset 0 -1px 0 ${c.accent}44}
    .k103-sidebar-sticky{position:sticky;top:0;z-index:2;background:${c.sidebar};padding-top:2px;padding-bottom:2px}
    .k101-interactive:focus-visible{outline:none;box-shadow:inset 0 0 0 2px ${c.accent}55;border-radius:4px}
    [data-document-search-match-count]{animation:k103-match-pulse .35s ease}
    @keyframes k103-match-pulse{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}
    [data-k103-search-no-results]{font-size:10px;color:${c.textMuted};font-style:italic}
    .bsc-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${c.sideBdr};font-size:13px}
    .bsc-key{background:${c.toolbar};border:1px solid ${c.toolBdr};border-radius:4px;padding:2px 7px;font-size:11px;font-family:monospace;color:${c.text}}
    .focus-overlay{position:fixed;inset:0;background:${dark ? '#000' : '#FAF8F3'};opacity:.94;z-index:98;pointer-events:none}
    .mobile-drawer-backdrop{position:fixed;inset:0;background:#00000055;z-index:140}
    .mobile-sidebar-drawer{position:fixed;top:0;left:0;bottom:0;width:min(280px,88vw);z-index:150;box-shadow:4px 0 24px #00000025}
    .mobile-panel-drawer{position:fixed;top:0;right:0;bottom:0;width:min(320px,92vw);z-index:150;box-shadow:-4px 0 24px #00000025}
    .mobile-sidebar-drawer .bfi{min-height:44px;padding:10px 11px}
    .btbtn-mobile{min-height:44px;min-width:44px}
    [data-compact-chrome] .bicon-btn{width:44px;height:44px}
    .bsort-menu{position:absolute;top:30px;right:0;background:${c.card};border:1px solid ${c.sideBdr};border-radius:8px;box-shadow:0 4px 16px #00000015;z-index:100;overflow:hidden;min-width:130px}
    .bsort-item{padding:7px 12px;font-size:12px;cursor:pointer;color:${c.text};display:flex;align-items:center;gap:6px}
    .bsort-item:hover{background:${c.cardHov}}
    .bsort-item.active{color:${c.accent};font-weight:600}
    .bstat-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid ${c.sideBdr}40;font-size:12px}
    .bstat-val{font-weight:700;color:${c.accent}}
    .btag-cloud span{display:inline-block;border-radius:999px;cursor:pointer;transition:all .1s}
    .btag-cloud span:hover{opacity:.75}
    .bdrag-over{background:${c.accentBg} !important;border:1px dashed ${c.accent} !important;border-radius:6px}
    .bnote-drag{opacity:.35}
    /* ── 드래그&드롭 에디터 오버레이 ── */
    .editor-drop-zone{position:relative}
    .editor-drop-overlay{position:absolute;inset:0;background:${c.accentBg};border:3px dashed ${c.accent};border-radius:12px;display:flex;align-items:center;justify-content:center;z-index:20;pointer-events:none;font-size:15px;color:${c.accent};font-weight:700;gap:8px;opacity:.92}
    /* ── 아이콘 사이드바 ── */
    .bicon-bar{display:flex;flex-direction:column;align-items:center;padding:8px 0;gap:2px}
    .bicon-btn{background:none;border:none;cursor:pointer;width:40px;height:40px;display:flex;align-items:center;justify-content:center;border-radius:8px;color:${c.textMuted};transition:all .12s;position:relative}
    .bicon-btn:hover{background:${c.cardHov};color:${c.accent}}
    .bicon-btn:active{background:${c.accentBg}}
    .bicon-btn:focus-visible{outline:none;box-shadow:0 0 0 2px ${c.accent}55}
    .bicon-btn.active{background:${c.accentBg};color:${c.accent}}
    .bicon-tooltip{position:absolute;left:42px;background:${c.card};border:1px solid ${c.sideBdr};color:${c.text};font-size:11px;font-weight:600;padding:3px 8px;border-radius:5px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .1s;z-index:200;box-shadow:0 2px 8px #00000015}
    .bicon-btn:hover .bicon-tooltip{opacity:1}
  `;
}

export function useNoteViewStyles(c: NoteChromeColors, dark: boolean): string {
  return useMemo(() => buildNoteViewStyles(c, dark), [c, dark]);
}
