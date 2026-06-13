import { useState } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { CitationEntry } from '../../../citationUtils';
import { formatCitationLine } from '../../../citationUtils';
import { exportCitationsAsAPA, exportCitationsAsBibTeX } from '../../../citationExport';
import { copyPlainTextToClipboard } from '../../block-editor/features/clipboard/copy/copyToClipboard';

export interface BibliographyPanelProps {
  colors: NoteChromeColors;
  citations: readonly CitationEntry[];
}

/** Note-local bibliography from citation blocks with APA / BibTeX export. */
export function BibliographyPanel({ colors: c, citations }: BibliographyPanelProps) {
  const [exportMsg, setExportMsg] = useState('');

  const runExport = async (format: 'apa' | 'bibtex') => {
    if (citations.length === 0) return;
    const text = format === 'apa'
      ? exportCitationsAsAPA(citations)
      : exportCitationsAsBibTeX(citations);
    const ok = await copyPlainTextToClipboard(text);
    setExportMsg(ok ? (format === 'apa' ? 'APA 복사됨' : 'BibTeX 복사됨') : '복사 실패');
    window.setTimeout(() => setExportMsg(''), 2000);
  };

  return (
    <section className="be-bibliography-panel" style={{ padding: '0 0 8px' }} aria-label="참고문헌">
      <div style={{ padding: '8px 10px 4px', fontSize: 10, color: c.textMuted, fontWeight: 700, borderTop: `1px solid ${c.sideBdr}`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span>
          참고문헌{' '}
          <span style={{ color: citations.length > 0 ? c.accent : c.textFaint }}>
            ({citations.length})
          </span>
        </span>
        {citations.length > 0 && (
          <>
            <button type="button" className="btbtn" style={{ fontSize: 9, padding: '2px 6px', marginLeft: 'auto' }} onClick={() => void runExport('apa')}>
              APA
            </button>
            <button type="button" className="btbtn" style={{ fontSize: 9, padding: '2px 6px' }} onClick={() => void runExport('bibtex')}>
              BibTeX
            </button>
          </>
        )}
      </div>
      {exportMsg && (
        <div style={{ fontSize: 9, color: c.green, padding: '0 10px 4px' }}>{exportMsg}</div>
      )}
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
