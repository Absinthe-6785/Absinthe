import type { ElementType, ReactNode } from 'react';
import {
  FileText, CalendarDays, Dumbbell, BookMarked, Archive, Clock,
} from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { SearchHighlight, SearchResultItem, SearchDomain } from '../searchProjectionModels';
import { importanceClassificationLabel } from '../../knowledge/knowledgeLabels';
import type { Language } from '../../../../../lib/i18n';

const DOMAIN_ICONS: Record<SearchDomain, ElementType> = {
  notes: FileText,
  planner: CalendarDays,
  health: Dumbbell,
  recipe: BookMarked,
  archive: Archive,
};

function renderHighlightedTitle(title: string, highlight?: SearchHighlight) {
  if (!highlight?.titleRanges.length) return title;
  const parts: ReactNode[] = [];
  let cursor = 0;
  highlight.titleRanges.forEach((range, i) => {
    if (range.start > cursor) parts.push(title.slice(cursor, range.start));
    parts.push(
      <mark key={i} style={{ background: 'rgba(139, 92, 246, 0.25)', borderRadius: 2, padding: 0 }}>
        {title.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });
  if (cursor < title.length) parts.push(title.slice(cursor));
  return parts;
}

export interface SearchResultCardProps {
  result: SearchResultItem;
  active: boolean;
  colors: NoteChromeColors;
  highlight?: SearchHighlight;
  lang: Language;
  onSelect: () => void;
  onHover: () => void;
  optionId: string;
}

export function SearchResultCard({
  result,
  active,
  colors: c,
  highlight,
  lang,
  onSelect,
  onHover,
  optionId,
}: SearchResultCardProps) {
  const Icon = DOMAIN_ICONS[result.domain];

  return (
    <button
      id={optionId}
      type="button"
      role="option"
      aria-selected={active}
      className="abs-focus-ring"
      data-k111-search-card={result.id}
      data-k111-search-domain={result.domain}
      onMouseEnter={onHover}
      onClick={onSelect}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '7px 10px',
        minHeight: 44,
        border: 'none',
        background: active ? c.accentBg : 'transparent',
        cursor: 'pointer',
        color: c.text,
        boxShadow: active ? `inset 3px 0 0 ${c.accent}` : undefined,
        borderRadius: active ? 6 : 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <Icon size={14} color={active ? c.accent : c.textMuted} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>
              {renderHighlightedTitle(result.title, highlight)}
            </span>
            {result.categoryLabel && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: c.textMuted,
                  background: c.cardHov,
                  borderRadius: 999,
                  padding: '1px 6px',
                }}
                data-k111-search-category
              >
                {result.categoryLabel}
              </span>
            )}
            {result.importanceClass && (
              <span style={{ fontSize: 9, fontWeight: 700, color: c.accent, background: c.accentBg, borderRadius: 999, padding: '1px 6px' }}>
                {importanceClassificationLabel(result.importanceClass as never, lang)}
              </span>
            )}
          </div>
          {(result.subtitle || result.relativeDate) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontSize: 10, color: c.textMuted }}>
              {result.subtitle ? <span>{result.subtitle}</span> : null}
              {result.relativeDate ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Clock size={9} aria-hidden />
                  {result.relativeDate}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
