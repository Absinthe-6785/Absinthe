import type { Language } from '../../../../lib/i18n';
import type { EdgeSemanticKind } from './graph/knowledgeUniverse/edgeVisualization';

const EDGE_LABELS: Record<EdgeSemanticKind, Record<Language, string>> = {
  hierarchy: { en: 'Hierarchy', ko: '계층', ja: '階層' },
  reference: { en: 'Reference', ko: '참조', ja: '参照' },
  related:   { en: 'Related', ko: '관련', ja: '関連' },
  temporal:  { en: 'Temporal', ko: '시간', ja: '時間' },
  strong:    { en: 'Strong', ko: '강함', ja: '強' },
  weak:      { en: 'Weak', ko: '약함', ja: '弱' },
};

export function edgeLegendLabel(kind: EdgeSemanticKind, lang: Language): string {
  return EDGE_LABELS[kind]?.[lang] ?? EDGE_LABELS[kind]?.en ?? kind;
}

export const EDGE_LEGEND_SAMPLES: Record<EdgeSemanticKind, string> = {
  hierarchy: '━━━━',
  reference: '──────',
  related: '┄┄┄┄',
  temporal: '······',
  strong: '◉ glow',
  weak: '○ faint',
};

export function edgeLegendEntries(lang: Language) {
  return (Object.keys(EDGE_LABELS) as EdgeSemanticKind[]).map(kind => ({
    kind,
    sample: EDGE_LEGEND_SAMPLES[kind],
    label: edgeLegendLabel(kind, lang),
  }));
}
