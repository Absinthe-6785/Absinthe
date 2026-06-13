import type { Language } from '../../../../lib/i18n';
import type { ConceptRelationType } from './maps/conceptRelations';
import type { RelatedReason } from './related/relatedNotesScoring';
import type { NoteKind } from './research/noteClassification';

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
