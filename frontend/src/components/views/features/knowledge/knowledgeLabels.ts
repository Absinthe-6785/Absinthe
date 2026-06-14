import type { Language } from '../../../../lib/i18n';
import type { ConceptRelationType } from './maps/conceptRelations';
import type { RelatedReason } from './related/relatedNotesScoring';
import type { NoteKind } from './research/noteClassification';
import type { ImportanceClassification } from './cosmos/intelligence/knowledgeImportance';
import type { AreaHealthCategory } from './cosmos/intelligence/areaHealth';
import type { SuggestionSignal } from './cosmos/intelligence/suggestedConnections';

const CONCEPT_RELATION: Record<ConceptRelationType, Record<Language, string>> = {
  causes:         { en: 'causes',         ko: '원인',   ja: '原因'     },
  influences:     { en: 'influences',     ko: '영향',   ja: '影響'     },
  'depends-on':   { en: 'depends on',     ko: '의존',   ja: '依存'     },
  'related-to':   { en: 'related to',     ko: '관련',   ja: '関連'     },
  'contrasts-with': { en: 'contrasts with', ko: '대조', ja: '対比'     },
};

const RELATED_REASON: Record<RelatedReason, Record<Language, string>> = {
  'shared tag':      { en: 'shared tag',      ko: '공유 태그', ja: '共有タグ'   },
  backlink:          { en: 'backlink',          ko: '백링크',   ja: 'バックリンク' },
  'mutual backlink': { en: 'mutual link',       ko: '상호 링크', ja: '相互リンク' },
  mention:           { en: 'mention',           ko: '언급',     ja: '言及'       },
};

const NOTE_KIND: Record<NoteKind, Record<Language, string>> = {
  source:     { en: 'Source',     ko: '출처', ja: '出典'     },
  literature: { en: 'Literature', ko: '문헌', ja: '文献'     },
  permanent:  { en: 'Permanent',  ko: '영구', ja: '永久'     },
  concept:    { en: 'Concept',    ko: '개념', ja: '概念'     },
};

const IMPORTANCE_CLASS: Record<ImportanceClassification, Record<Language, string>> = {
  'core-hub':    { en: 'Core Hub',        ko: '핵심 허브',   ja: 'コアハブ'     },
  'major-hub':   { en: 'Major Hub',       ko: '주요 허브',   ja: '主要ハブ'     },
  supporting:    { en: 'Supporting Note', ko: '보조 노트',   ja: 'サポートノート' },
  satellite:     { en: 'Satellite',       ko: '위성 노트',   ja: 'サテライト'   },
  isolated:      { en: 'Isolated',        ko: '고립',       ja: '孤立'         },
};

const AREA_HEALTH: Record<AreaHealthCategory, Record<Language, string>> = {
  thriving:   { en: 'Thriving',   ko: '번영',   ja: '好調'     },
  healthy:    { en: 'Healthy',    ko: '건강',   ja: '健全'     },
  growing:    { en: 'Growing',    ko: '성장',   ja: '成長'     },
  fragmented: { en: 'Fragmented', ko: '분산',   ja: '断片化'   },
  critical:   { en: 'Critical',   ko: '위험',   ja: '危機'     },
};

const SUGGESTION_SIGNAL: Record<SuggestionSignal, Record<Language, string>> = {
  'shared-tag':        { en: 'shared tag',        ko: '공유 태그',   ja: '共有タグ'   },
  'shared-area':       { en: 'shared area',       ko: '공유 영역',   ja: '共有エリア' },
  'title-similarity':  { en: 'similar title',     ko: '유사 제목',   ja: '類似タイトル' },
  'mutual-mention':    { en: 'mutual mention',    ko: '상호 언급',   ja: '相互言及'   },
  'common-backlink':   { en: 'common backlink',   ko: '공통 백링크', ja: '共通バックリンク' },
  related:             { en: 'related',           ko: '관련',       ja: '関連'       },
};

export function conceptRelationLabel(type: ConceptRelationType, lang: Language): string {
  return CONCEPT_RELATION[type]?.[lang] ?? CONCEPT_RELATION[type]?.en ?? type;
}

export function relatedReasonLabel(reason: RelatedReason, lang: Language): string {
  return RELATED_REASON[reason]?.[lang] ?? RELATED_REASON[reason]?.en ?? reason;
}

export function formatRelatedReasonsLocalized(
  reasons: readonly RelatedReason[],
  lang: Language,
): string {
  return reasons.map(r => relatedReasonLabel(r, lang)).join(' + ');
}

export function noteKindLabel(kind: NoteKind, lang: Language): string {
  return NOTE_KIND[kind]?.[lang] ?? NOTE_KIND[kind]?.en ?? kind;
}

export function importanceClassificationLabel(
  classification: ImportanceClassification,
  lang: Language,
): string {
  return IMPORTANCE_CLASS[classification]?.[lang] ?? IMPORTANCE_CLASS[classification]?.en ?? classification;
}

export function areaHealthCategoryLabel(category: AreaHealthCategory, lang: Language): string {
  return AREA_HEALTH[category]?.[lang] ?? AREA_HEALTH[category]?.en ?? category;
}

export function suggestionSignalLabel(signal: SuggestionSignal, lang: Language): string {
  return SUGGESTION_SIGNAL[signal]?.[lang] ?? SUGGESTION_SIGNAL[signal]?.en ?? signal;
}
