import { ChevronDown, Clock, X } from 'lucide-react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { RecentWorkEntry } from '../workspace/workspacePreferences';
import { WorkspacePinToggle } from './WorkspacePinToggle';
import { ProductEmptyState } from '../../../../common/ProductEmptyState';

export interface RecentWorkSectionProps {
  colors: NoteChromeColors;
  recent: readonly RecentWorkEntry[];
  activeKind: string | null;
  activeId: string | null;
  isPinned: (kind: RecentWorkEntry['workspace']['kind'], id: string) => boolean;
  onActivate: (entry: RecentWorkEntry) => void;
  onTogglePin: (entry: RecentWorkEntry) => void;
  onClearRecent: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function RecentWorkSection({
  colors: c,
  recent,
  activeKind,
  activeId,
  isPinned,
  onActivate,
  onTogglePin,
  onClearRecent,
  collapsed = false,
  onToggleCollapse,
}: RecentWorkSectionProps) {
  const { t } = useTranslation();

  return (
    <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }} data-k103-recent-workspaces>
      <div
        className="bseclbl"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: onToggleCollapse ? 'pointer' : 'default' }}
        onClick={onToggleCollapse}
        role={onToggleCollapse ? 'button' : undefined}
        tabIndex={onToggleCollapse ? 0 : undefined}
        onKeyDown={onToggleCollapse ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse(); } } : undefined}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onToggleCollapse ? <ChevronDown size={10} style={{ transform: collapsed ? 'rotate(-90deg)' : undefined }} /> : null}
          {t('searchRecent')}
        </span>
        {recent.length > 0 ? (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onClearRecent(); }}
            className="btbtn"
            style={{ padding: '0 2px', fontSize: 9, color: c.textMuted }}
            title={t('knClearRecentWorkspaces')}
          >
            <X size={10} />
          </button>
        ) : null}
      </div>
      {!collapsed && recent.length === 0 ? (
        <ProductEmptyState
          variant="note-chrome"
          colors={c}
          icon={Clock}
          title={t('k103RecentEmptyTitle')}
          description={t('k103RecentEmptyDesc')}
          dataHook="k103-recent-empty"
        />
      ) : null}
      {!collapsed && recent.map(entry => {
        const ref = entry.workspace;
        const isActive = activeKind === ref.kind && activeId === ref.id;
        const pinned = isPinned(ref.kind, ref.id);
        return (
          <div
            key={`${ref.kind}:${ref.id}`}
            className={`bfi ${isActive ? 'active' : ''}`}
            onClick={() => onActivate(entry)}
            style={{ gap: 3, fontSize: 10, minHeight: 30, padding: '4px 8px' }}
            title={ref.subtitle ?? ref.name}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ref.name}
            </span>
            {typeof ref.count === 'number' && (
              <span style={{ fontSize: 9, color: c.textMuted }}>{ref.count}</span>
            )}
            <WorkspacePinToggle
              colors={c}
              pinned={pinned}
              onToggle={e => { e.stopPropagation(); onTogglePin(entry); }}
            />
          </div>
        );
      })}
    </div>
  );
}
