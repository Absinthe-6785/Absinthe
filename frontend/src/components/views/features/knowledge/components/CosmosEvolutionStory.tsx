import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { ExpandedCosmosEvolutionStory } from '../history/historyEvolutionQueries';

export interface CosmosEvolutionStoryProps {
  colors: NoteChromeColors;
  story: ExpandedCosmosEvolutionStory;
}

function formatDate(ts: number | null, lang: string): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(
    lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : undefined,
    { year: 'numeric', month: 'short', day: 'numeric' },
  );
}

/** Narrative summary of cosmos evolution from recorded history. */
export function CosmosEvolutionStory({ colors: c, story }: CosmosEvolutionStoryProps) {
  const { t, lang } = useTranslation();

  if (!story.beganAt) return null;

  return (
    <div
      style={{
        margin: '0 8px 10px',
        padding: '10px 11px',
        borderRadius: 8,
        border: `1px solid ${c.sideBdr}`,
        background: `linear-gradient(135deg, ${c.accentBg} 0%, ${c.cardHov} 100%)`,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: c.text, marginBottom: 6 }}>
        {t('k45StoryTitle')}
      </div>
      <p style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.6, margin: '0 0 6px' }}>
        {t('k45StoryBegan').replace('{date}', formatDate(story.beganAt, lang))}
      </p>
      {story.firstLinkAt && story.daysToFirstLink != null && (
        <p style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.6, margin: '0 0 6px' }}>
          {t('k45StoryFirstLink').replace('{days}', String(story.daysToFirstLink))}
        </p>
      )}
      {story.firstHubAt && (
        <p style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.6, margin: '0 0 6px' }}>
          {t('k45StoryFirstHub').replace('{date}', formatDate(story.firstHubAt, lang))}
        </p>
      )}
      <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, margin: '6px 0 4px' }}>
        {t('k45StorySinceThen')}
      </div>
      <div style={{ fontSize: 10, color: c.text, lineHeight: 1.55 }}>
        {story.notesAdded > 0 && (
          <div>{t('k45StoryNotes').replace('{count}', String(story.notesAdded))}</div>
        )}
        {story.linksAdded > 0 && (
          <div>{t('k45StoryLinks').replace('{count}', String(story.linksAdded))}</div>
        )}
        {story.hubsAdded > 0 && (
          <div>{t('k45StoryHubs').replace('{count}', String(story.hubsAdded))}</div>
        )}
      </div>
      {(story.fastestGrowingArea || story.longestActiveArea || story.mostConnectedArea || story.recentMilestoneTitleKey) && (
        <>
          <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, margin: '8px 0 4px' }}>
            {t('k46StoryHighlights')}
          </div>
          <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55 }}>
            {story.fastestGrowingArea && (
              <div>{t('k46StoryFastestArea').replace('{area}', story.fastestGrowingArea)}</div>
            )}
            {story.longestActiveArea && (
              <div>{t('k46StoryLongestArea').replace('{area}', story.longestActiveArea)}</div>
            )}
            {story.mostConnectedArea && (
              <div>{t('k46StoryConnectedArea').replace('{area}', story.mostConnectedArea)}</div>
            )}
            {story.recentMilestoneTitleKey && (
              <div>{t('k46StoryRecentMilestone')}: {t(story.recentMilestoneTitleKey)}</div>
            )}
          </div>
        </>
      )}
      {story.importedOnly && (
        <div style={{ fontSize: 9, color: c.textFaint, marginTop: 6, lineHeight: 1.4 }}>
          {t('k45ImportedHint')}
        </div>
      )}
    </div>
  );
}
