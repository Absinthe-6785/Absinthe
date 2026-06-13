import type { LinkContext } from '../../../noteUtils';
import { findWikiLinkInText } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { PageReference } from '../backlinks';

export interface BacklinkPanelProps {
  colors: NoteChromeColors;
  activeNoteTitle: string;
  incoming: readonly PageReference[];
  contexts: readonly LinkContext[];
  onNavigateToNote: (noteId: string) => void;
}

/** Dedicated incoming wiki-link backlinks with count and contextual excerpts. */
export function BacklinkPanel({
  colors: c,
  activeNoteTitle,
  incoming,
  contexts,
  onNavigateToNote,
}: BacklinkPanelProps) {
  const contextByNoteId = new Map(contexts.map(ctx => [ctx.noteId, ctx]));

  return (
    <section className="be-backlink-panel" style={{ padding: '0 0 4px' }}>
      <div style={{ padding: '0 10px 6px', fontSize: 10, color: c.textMuted, fontWeight: 700 }}>
        백링크{' '}
        <span style={{ color: incoming.length > 0 ? c.accent : c.textFaint }}>
          ({incoming.length})
        </span>
      </div>

      {incoming.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px 8px 4px' }}>
          이 노트를 참조하는 노트 없음
        </p>
      ) : (
        incoming.map(ref => {
          const excerpts = contextByNoteId.get(ref.noteId)?.excerpts ?? [];
          return (
            <div
              key={ref.noteId}
              role="button"
              tabIndex={0}
              style={{
                margin: '0 8px 6px',
                borderRadius: 7,
                border: `1px solid ${c.sideBdr}`,
                background: c.cardHov,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={() => onNavigateToNote(ref.noteId)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNavigateToNote(ref.noteId);
                }
              }}
            >
              <div
                style={{
                  padding: '5px 9px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  borderBottom: excerpts.length > 0 ? `1px solid ${c.sideBdr}` : 'none',
                }}
              >
                <span style={{ fontSize: 10, color: c.accent, flexShrink: 0 }} aria-hidden>↩</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: c.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {ref.noteTitle}
                </span>
              </div>

              {excerpts.map((excerpt, ei) => {
                const target =
                  findWikiLinkInText(excerpt, activeNoteTitle) ?? `[[${activeNoteTitle}]]`;
                const parts = excerpt.split(target);
                return (
                  <div
                    key={ei}
                    style={{
                      padding: '4px 9px 5px',
                      fontSize: 10,
                      lineHeight: 1.55,
                      color: c.textMuted,
                      borderTop: ei > 0 ? `1px dashed ${c.sideBdr}` : 'none',
                    }}
                  >
                    {parts.map((part, pi) => (
                      <span key={pi}>
                        {part}
                        {pi < parts.length - 1 && (
                          <mark
                            style={{
                              background: c.accentBg,
                              color: c.accent,
                              borderRadius: 3,
                              padding: '0 2px',
                              fontWeight: 600,
                            }}
                          >
                            {target}
                          </mark>
                        )}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </section>
  );
}
