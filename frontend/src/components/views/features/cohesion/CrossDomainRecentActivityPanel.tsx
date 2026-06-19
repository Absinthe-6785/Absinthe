import type { NoteChromeColors } from '../../noteEditorTheme';
import type { TranslationKey } from '../../../../lib/i18n';
import type { RecentActivityGroup, RecentActivityItem } from '../../buildRecentActivityProjection';

const DOMAIN_LABEL_KEYS: Record<RecentActivityItem['domain'], TranslationKey> = {
  notes: 'k113DomainNotes',
  planner: 'k113DomainPlanner',
  recipe: 'k113DomainRecipe',
  archive: 'k113DomainArchive',
};

const BUCKET_LABEL_KEYS: Record<RecentActivityGroup['bucket'], TranslationKey> = {
  today: 'k109HistoryToday',
  yesterday: 'k109HistoryYesterday',
  earlier: 'k109HistoryEarlier',
};

export interface CrossDomainRecentActivityPanelProps {
  colors: NoteChromeColors;
  groups: readonly RecentActivityGroup[];
  isEmpty: boolean;
  t: (key: TranslationKey) => string;
  onNavigate: (item: RecentActivityItem) => void;
}

export function CrossDomainRecentActivityPanel({
  colors: c,
  groups,
  isEmpty,
  t,
  onNavigate,
}: CrossDomainRecentActivityPanelProps) {
  if (isEmpty) {
    return (
      <div style={{ fontSize: 11, color: c.textFaint }} data-k113-recent-activity-empty>
        {t('k113NoRecentActivity')}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-k113-recent-activity>
      {groups.map(group => {
        if (group.items.length === 0) return null;
        return (
          <div key={group.bucket} data-k113-recent-activity-group={group.bucket}>
            <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {t(BUCKET_LABEL_KEYS[group.bucket])}
            </p>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {group.items.map(item => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item)}
                    data-k113-recent-activity-row
                    data-k113-recent-activity-domain={item.domain}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: c.cardHov,
                      border: `1px solid ${c.sideBdr}`,
                      borderRadius: 6,
                      padding: '8px 10px',
                      minHeight: 44,
                      cursor: 'pointer',
                      color: c.text,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, flexShrink: 0 }}>
                        {t(DOMAIN_LABEL_KEYS[item.domain])}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>
                      {item.relativeLabel}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
