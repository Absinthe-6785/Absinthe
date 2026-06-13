import type { LinkContext } from '../../../noteUtils';
import { findWikiLinkInText } from '../../../noteUtils';
import { findMentionInText } from '../mentions';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { OutgoingReference, PageReference } from '../backlinks';

export interface LinkedReferencesPanelProps {
  colors: NoteChromeColors;
  activeNoteTitle: string;
  incoming: PageReference[];
  contexts: LinkContext[];
  mentioning: PageReference[];
  mentionContexts: LinkContext[];
  outgoing: OutgoingReference[];
  onNavigateToNote: (noteId: string) => void;
  onNavigateToWiki: (title: string) => void;
}

export function LinkedReferencesPanel({
  colors: c,
  activeNoteTitle,
  incoming,
  contexts,
  mentioning,
  mentionContexts,
  outgoing,
  onNavigateToNote,
  onNavigateToWiki,
}: LinkedReferencesPanelProps) {
  const contextByNoteId = new Map(contexts.map(ctx => [ctx.noteId, ctx]));
  const mentionContextByNoteId = new Map(mentionContexts.map(ctx => [ctx.noteId, ctx]));
  const resolvedOutgoing = outgoing.filter(o => o.targetNoteId);
  const brokenOutgoing = outgoing.filter(o => !o.targetNoteId);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0', minHeight: 0 }}>
      <div style={{ padding: '0 10px 6px', fontSize: 10, color: c.textMuted, fontWeight: 600 }}>
        연결된 참조{' '}
        {incoming.length > 0 && (
          <span style={{ color: c.accent }}>({incoming.length})</span>
        )}
      </div>

      {incoming.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '10px 8px' }}>
          연결된 참조 없음
        </p>
      ) : (
        incoming.map(ref => {
          const ctx = contextByNoteId.get(ref.noteId);
          const excerpts = ctx?.excerpts ?? [];

          return (
            <div
              key={ref.noteId}
              style={{
                margin: '0 8px 6px',
                borderRadius: 7,
                border: `1px solid ${c.sideBdr}`,
                background: c.cardHov,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={() => onNavigateToNote(ref.noteId)}
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
                <span style={{ fontSize: 10, color: c.accent, flexShrink: 0 }}>↗</span>
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

      <div
        style={{
          padding: '8px 10px 4px',
          fontSize: 10,
          color: c.textMuted,
          fontWeight: 600,
          borderTop: `1px solid ${c.sideBdr}`,
          marginTop: incoming.length > 0 ? 4 : 0,
        }}
      >
        언급된 곳{' '}
        {mentioning.length > 0 && (
          <span style={{ color: c.textMuted }}>({mentioning.length})</span>
        )}
      </div>

      {mentioning.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '10px 8px' }}>
          연결되지 않은 언급 없음
        </p>
      ) : (
        mentioning.map(ref => {
          const ctx = mentionContextByNoteId.get(ref.noteId);
          const excerpts = ctx?.excerpts ?? [];

          return (
            <div
              key={`mention-${ref.noteId}`}
              style={{
                margin: '0 8px 6px',
                borderRadius: 7,
                border: `1px solid ${c.sideBdr}`,
                background: c.cardHov,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={() => onNavigateToNote(ref.noteId)}
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
                <span style={{ fontSize: 10, color: c.textMuted, flexShrink: 0 }}>↗</span>
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
                  findMentionInText(excerpt, activeNoteTitle) ?? activeNoteTitle;
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
                              background: c.cardAct,
                              color: c.text,
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

      {outgoing.length > 0 && (
        <>
          <div
            style={{
              padding: '8px 10px 4px',
              fontSize: 10,
              color: c.textMuted,
              fontWeight: 600,
              borderTop: `1px solid ${c.sideBdr}`,
              marginTop: 4,
            }}
          >
            나가는 링크{' '}
            <span style={{ color: c.green }}>({resolvedOutgoing.length})</span>
            {brokenOutgoing.length > 0 && (
              <span style={{ color: c.textFaint }}> · {brokenOutgoing.length}개 없음</span>
            )}
          </div>

          {outgoing.map(link => {
            if (link.targetNoteId) {
              return (
                <div
                  key={link.title}
                  className="bbl"
                  style={{ color: c.green }}
                  onClick={() => onNavigateToNote(link.targetNoteId!)}
                >
                  → {link.title}
                </div>
              );
            }
            return (
              <div
                key={link.title}
                className="bbl"
                style={{ color: c.textMuted, fontStyle: 'italic' }}
                title="클릭하여 노트 만들기"
                onClick={() => onNavigateToWiki(link.title)}
              >
                → {link.title}{' '}
                <span style={{ fontSize: 9, color: c.accent }}>+ 만들기</span>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
