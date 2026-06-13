import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { CitationEntry } from '../../../citationUtils';
import { formatCitationLine } from '../../../citationUtils';

export interface BibliographyPanelProps {
  colors: NoteChromeColors;
  citations: readonly CitationEntry[];
}

/** Note-local bibliography from citation blocks — read-only, no export formatting. */
export function BibliographyPanel({ colors: c, citations }: BibliographyPanelProps) {
  return (
    <section className="be-bibliography-panel" style={{ padding: '0 0 8px' }} aria-label="참고문헌">
      <div style={{ padding: '8px 10px 4px', fontSize: 10, color: c.textMuted, fontWeight: 700, borderTop: `1px solid ${c.sideBdr}` }}>
        참고문헌{' '}
        <span style={{ color: citations.length > 0 ? c.accent : c.textFaint }}>
          ({citations.length})
        </span>
      </div>
      {citations.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px' }}>
          인용 블록 없음 · /citation
        </p>
      ) : (
        <ol style={{ margin: '0 8px', paddingLeft: 18, fontSize: 11, lineHeight: 1.55, color: c.text }}>
          {citations.map(cite => (
            <li key={cite.blockId} style={{ marginBottom: 6 }}>
              {formatCitationLine(cite)}
              {cite.url && (
                <div style={{ fontSize: 9, color: c.textMuted, marginTop: 2, wordBreak: 'break-all' }}>
                  {cite.url}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
