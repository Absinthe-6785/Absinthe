import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeImportanceInput, NoteIntelligenceSnapshot } from '../cosmos/intelligence';
import type { NoteHistoryContext } from '../history';
import { useTranslation } from '../../../../../lib/i18n';
import { importanceClassificationLabel, areaHealthCategoryLabel } from '../knowledgeLabels';
import { KnowledgePanelSection, KnowledgePanelEmpty } from './KnowledgePanelSection';
import { CosmosEmptyHint } from './CosmosEmptyHint';
import { CosmosSuiteHeader } from '../cosmos/cosmosPanelUi';
import { WhyThisTier } from '../cosmos/onboarding/WhyThisTier';

export interface CosmosInsightsPanelProps {
  colors: NoteChromeColors;
  snapshot: NoteIntelligenceSnapshot;
  tierInput: KnowledgeImportanceInput;
  noteHistory?: NoteHistoryContext | null;
  onNavigateToNote: (noteId: string) => void;
  onOpenLinks?: () => void;
  /** Canonical vault link suggestions live in Discover (K-89B2B). */
  onOpenDiscover?: () => void;
}

function ActionRow({
  c,
  title,
  detail,
  onClick,
}: {
  c: NoteChromeColors;
  title: string;
  detail?: string;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        margin: '0 8px 5px',
        padding: '6px 9px',
        borderRadius: 7,
        border: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
        cursor: interactive ? 'pointer' : 'default',
        display: 'block',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{title}</div>
      {detail && (
        <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2, lineHeight: 1.4 }}>{detail}</div>
      )}
    </button>
  );
}

/** Primary "what should I do next?" panel — importance, opportunities, suggestions. */
export function CosmosInsightsPanel({
  colors: c,
  snapshot,
  tierInput,
  noteHistory,
  onNavigateToNote,
  onOpenLinks,
  onOpenDiscover,
}: CosmosInsightsPanelProps) {
  const { t, lang } = useTranslation();
  const classification = importanceClassificationLabel(snapshot.importance.classification, lang);

  const formatDate = (ms: number | null) => {
    if (!ms) return null;
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <CosmosSuiteHeader c={c} active="insights" t={t} />
      <KnowledgePanelSection colors={c} first title={t('k36InsightsImportance')} count={snapshot.importance.importanceScore}>
        <div style={{ padding: '0 10px 8px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: c.accent, marginBottom: 4 }}>{classification}</div>
          <WhyThisTier
            colors={c}
            classification={snapshot.importance.classification}
            input={tierInput}
            result={snapshot.importance}
          />
          <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.5, marginTop: 6 }}>
            {t('k36InsightsConnectionSummary')
              .replace('{connections}', String(snapshot.connectionCount))
              .replace('{backlinks}', String(snapshot.backlinkCount))}
          </div>
        </div>
      </KnowledgePanelSection>

      <KnowledgePanelSection colors={c} title={t('k36InsightsContext')}>
        <div style={{ padding: '0 10px 8px', fontSize: 10, color: c.textMuted, lineHeight: 1.6 }}>
          <div>{t('k36InsightsGalaxy')}: <span style={{ color: c.text }}>{snapshot.galaxyLabel}</span></div>
          {snapshot.areaLabel && (
            <div>{t('k36InsightsArea')}: <span style={{ color: c.text }}>{snapshot.areaLabel}</span></div>
          )}
          {snapshot.areaHealth && (
            <div style={{ marginTop: 4 }}>
              {snapshot.areaHealth.label}{' '}
              <span style={{ color: c.accent, fontWeight: 700 }}>{snapshot.areaHealth.score}%</span>{' '}
              <span style={{ color: c.textFaint }}>
                {areaHealthCategoryLabel(snapshot.areaHealth.category, lang)}
              </span>
            </div>
          )}
        </div>
      </KnowledgePanelSection>

      {noteHistory && (noteHistory.firstSeenAt || noteHistory.lastLinkedAt || noteHistory.activityScore > 0) && (
        <KnowledgePanelSection colors={c} title={t('k44InsightsHistory')}>
          <div style={{ padding: '0 10px 8px', fontSize: 10, color: c.textMuted, lineHeight: 1.6 }}>
            {noteHistory.firstSeenAt && (
              <div>{t('k44FirstSeen')}: <span style={{ color: c.text }}>{formatDate(noteHistory.firstSeenAt)}</span></div>
            )}
            {noteHistory.lastLinkedAt && (
              <div>{t('k44LastLinked')}: <span style={{ color: c.text }}>{formatDate(noteHistory.lastLinkedAt)}</span></div>
            )}
            {noteHistory.lastMajorUpdateAt && (
              <div>{t('k44LastMajorUpdate')}: <span style={{ color: c.text }}>{formatDate(noteHistory.lastMajorUpdateAt)}</span></div>
            )}
            {noteHistory.activityScore > 0 && (
              <div>{t('k44ActivityScore')}: <span style={{ color: c.accent, fontWeight: 700 }}>{noteHistory.activityScore}</span></div>
            )}
          </div>
        </KnowledgePanelSection>
      )}

      <KnowledgePanelSection
        colors={c}
        title={t('k36SuggestedConnections')}
        count={snapshot.suggestedConnections.length}
      >
        {snapshot.suggestedConnections.length === 0 ? (
          <>
            <KnowledgePanelEmpty
              colors={c}
              actionLabel={onOpenLinks ? t('k53ContextCreateWikiLink') : undefined}
              onAction={onOpenLinks}
            >
              {t('k36NoSuggestions')}
            </KnowledgePanelEmpty>
            <CosmosEmptyHint colors={c}>{t('k36SuggestionsHint')}</CosmosEmptyHint>
          </>
        ) : (
          <KnowledgePanelEmpty
            colors={c}
            actionLabel={onOpenDiscover ? t('k53ContextOpenDiscover') : undefined}
            onAction={onOpenDiscover}
          >
            {t('k89b2InsightsDiscoverHint').replace(
              '{count}',
              String(snapshot.suggestedConnections.length),
            )}
          </KnowledgePanelEmpty>
        )}
      </KnowledgePanelSection>

      <KnowledgePanelSection
        colors={c}
        title={t('k36KnowledgeOpportunities')}
        count={snapshot.opportunities.length}
      >
        {snapshot.opportunities.length === 0 ? (
          <KnowledgePanelEmpty colors={c}>{t('k36NoOpportunities')}</KnowledgePanelEmpty>
        ) : (
          snapshot.opportunities.map(opp => {
            let detail = t(opp.actionKey).replace('{title}', opp.noteTitle);
            if (opp.targetNoteTitle) {
              detail = `${detail} → ${opp.targetNoteTitle}`;
            }
            return (
              <ActionRow
                key={`${opp.noteId}-${opp.kind}`}
                c={c}
                title={opp.noteTitle}
                detail={detail}
                onClick={
                  opp.targetNoteId
                    ? () => onNavigateToNote(opp.targetNoteId!)
                    : onOpenLinks
                }
              />
            );
          })
        )}
      </KnowledgePanelSection>

      <KnowledgePanelSection colors={c} title={t('k36KnowledgeGaps')} count={snapshot.gaps.length}>
        {snapshot.gaps.length === 0 ? (
          <KnowledgePanelEmpty colors={c}>{t('k36NoGaps')}</KnowledgePanelEmpty>
        ) : (
          snapshot.gaps.map(gap => (
            <ActionRow
              key={`${gap.galaxyId}-${gap.kind}`}
              c={c}
              title={gap.galaxyLabel}
              detail={t(gap.messageKey)
                .replace('{notes}', String(gap.noteCount))
                .replace('{links}', String(gap.linkCount))}
            />
          ))
        )}
      </KnowledgePanelSection>
    </div>
  );
}
