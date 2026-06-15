import { useTranslation } from '@/lib/i18n';
import type { NoteChromeColors } from '../../../../noteEditorTheme';
import { suggestionSignalLabel } from '../../knowledgeLabels';
import { formatConnectionReasons, type EnrichedConnectionRecommendation } from './actionEngine';
import { ActionButton, ActionCard } from './actionUi';

export interface ConnectionRecommendationCardProps {
  colors: NoteChromeColors;
  connection: EnrichedConnectionRecommendation;
  onCreateRelation: (targetNoteId: string) => void;
  onNavigate: (targetNoteId: string) => void;
}

export function ConnectionRecommendationCard({
  colors: c,
  connection,
  onCreateRelation,
  onNavigate,
}: ConnectionRecommendationCardProps) {
  const { t, lang } = useTranslation();
  const reasons = formatConnectionReasons(connection, {
    sharedTags: tags => t('k37ReasonSharedTags').replace('{tags}', tags),
    mutualRefs: count => t('k37ReasonMutualRefs').replace('{count}', String(count)),
    signal: signal => suggestionSignalLabel(signal, lang),
  });

  return (
    <ActionCard
      c={c}
      title={connection.noteTitle}
      description={reasons.join('\n')}
      actions={(
        <>
          <ActionButton c={c} onClick={() => onCreateRelation(connection.noteId)}>
            {t('k37ActionCreateRelation')}
          </ActionButton>
          <ActionButton c={c} variant="secondary" onClick={() => onNavigate(connection.noteId)}>
            {t('k37ActionOpen')}
          </ActionButton>
        </>
      )}
    />
  );
}

export interface ConnectionRecommendationListProps {
  colors: NoteChromeColors;
  connections: readonly EnrichedConnectionRecommendation[];
  onCreateRelation: (targetNoteId: string) => void;
  onNavigate: (targetNoteId: string) => void;
}

export function ConnectionRecommendationList({
  colors: c,
  connections,
  onCreateRelation,
  onNavigate,
}: ConnectionRecommendationListProps) {
  const { t } = useTranslation();
  if (connections.length === 0) {
    return (
      <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px 10px', margin: 0 }}>
        {t('k36NoSuggestions')}
      </p>
    );
  }

  return (
    <>
      {connections.map(conn => (
        <ConnectionRecommendationCard
          key={conn.noteId}
          colors={c}
          connection={conn}
          onCreateRelation={onCreateRelation}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}
