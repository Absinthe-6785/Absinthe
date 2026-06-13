import { useMemo } from 'react';
import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { useTranslation } from '../../../../../lib/i18n';
import {
  areaDiscoveryObservationCount,
  buildAreaDiscoveryProjection,
  hasAreaDiscoveryObservations,
} from './buildAreaDiscoveryProjection';

export interface AreaDiscoveryViewProps {
  colors: NoteChromeColors;
  notes: readonly NoteBase[];
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
}

function TraceSection({
  colors: c,
  title,
  children,
}: {
  colors: NoteChromeColors;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h3 style={{
        margin: 0,
        fontSize: 10,
        fontWeight: 700,
        color: c.textMuted,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
      }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function ObservationButton({
  colors: c,
  active,
  title,
  detail,
  onClick,
}: {
  colors: NoteChromeColors;
  active: boolean;
  title: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: active ? c.cardAct : 'transparent',
        border: active ? `1px solid ${c.cardActBdr}` : '1px solid transparent',
        borderRadius: 6,
        padding: '5px 8px',
        cursor: 'pointer',
        color: c.text,
        fontSize: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {title}
      </span>
      {detail && (
        <span style={{ fontSize: 11, color: c.textMuted }}>{detail}</span>
      )}
    </button>
  );
}

export function AreaDiscoveryView({
  colors: c,
  notes,
  activeNoteId,
  onSelectNote,
}: AreaDiscoveryViewProps) {
  const { t } = useTranslation();
  const projection = useMemo(
    () => buildAreaDiscoveryProjection(notes),
    [notes],
  );

  const hasObservations = hasAreaDiscoveryObservations(projection);
  const observationCount = areaDiscoveryObservationCount(projection);

  return (
    <div style={{
      flex: 1,
      overflow: 'auto',
      background: c.notelist,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: c.text }}>
          {t('traceDiscoverTitle')}
        </div>
        <div style={{ fontSize: 11, color: c.textMuted, lineHeight: 1.5 }}>
          {t('traceDiscoverSubtitle')}
        </div>
      </div>

      {!hasObservations ? (
        <div style={{
          padding: '24px 12px',
          textAlign: 'center',
          color: c.textFaint,
          fontSize: 12,
          lineHeight: 1.5,
        }}>
          {t('traceDiscoveryEmpty')}
        </div>
      ) : (
        <>
          {projection.potentialHubs.length > 0 && (
            <TraceSection colors={c} title={t('traceDiscoveryHubs')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {projection.potentialHubs.map(item => (
                  <ObservationButton
                    key={`hub-${item.noteId}`}
                    colors={c}
                    active={item.noteId === activeNoteId}
                    title={item.title}
                    detail={t('traceReferencedBy').replace('{count}', String(item.referenceCount))}
                    onClick={() => onSelectNote(item.noteId)}
                  />
                ))}
              </div>
            </TraceSection>
          )}

          {projection.recurringConnections.length > 0 && (
            <TraceSection colors={c} title={t('traceDiscoveryConnections')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {projection.recurringConnections.map((cluster, index) => (
                  <div
                    key={`cluster-${index}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      padding: '6px 8px',
                      borderRadius: 6,
                      border: `1px solid ${c.sideBdr}`,
                    }}
                  >
                      {cluster.noteIds.map((noteId, itemIndex) => (
                        <ObservationButton
                          key={`cluster-${index}-${noteId}`}
                          colors={c}
                          active={noteId === activeNoteId}
                          title={displayNoteTitle(cluster.titles[itemIndex])}
                          onClick={() => onSelectNote(noteId)}
                        />
                      ))}
                  </div>
                ))}
              </div>
            </TraceSection>
          )}
        </>
      )}

      {hasObservations && (
        <div style={{ fontSize: 10, color: c.textFaint, lineHeight: 1.5 }}>
          {t('traceObservationFooter').replace('{count}', String(observationCount))}
        </div>
      )}
    </div>
  );
}
