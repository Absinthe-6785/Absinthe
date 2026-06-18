import { ChevronDown, ChevronUp, Pin } from 'lucide-react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { WorkspaceRef } from '../workspace/workspaceModels';
import { WorkspacePinToggle } from './WorkspacePinToggle';
import { ProductEmptyState } from '../../../../common/ProductEmptyState';

export interface PinnedWorkspacesSectionProps {
  colors: NoteChromeColors;
  pinned: readonly WorkspaceRef[];
  activeKind: string | null;
  activeId: string | null;
  onActivate: (ref: WorkspaceRef) => void;
  onUnpin: (ref: WorkspaceRef) => void;
  onMovePinned: (fromIndex: number, toIndex: number) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function PinnedWorkspacesSection({
  colors: c,
  pinned,
  activeKind,
  activeId,
  onActivate,
  onUnpin,
  onMovePinned,
  collapsed = false,
  onToggleCollapse,
}: PinnedWorkspacesSectionProps) {
  const { t } = useTranslation();

  return (
    <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }} data-k103-pinned-workspaces>
      <div
        className="bseclbl"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: onToggleCollapse ? 'pointer' : 'default' }}
        onClick={onToggleCollapse}
        role={onToggleCollapse ? 'button' : undefined}
        tabIndex={onToggleCollapse ? 0 : undefined}
        onKeyDown={onToggleCollapse ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapse(); } } : undefined}
      >
        <span>{t('knPinnedShort')}</span>
        {onToggleCollapse ? <ChevronDown size={10} style={{ transform: collapsed ? 'rotate(-90deg)' : undefined }} /> : null}
      </div>
      {!collapsed && pinned.length === 0 ? (
        <ProductEmptyState
          variant="note-chrome"
          colors={c}
          icon={Pin}
          title={t('k103PinnedEmptyTitle')}
          description={t('k103PinnedEmptyDesc')}
          dataHook="k103-pinned-empty"
        />
      ) : null}
      {!collapsed && pinned.map((ref, index) => {
        const isActive = activeKind === ref.kind && activeId === ref.id;
        return (
          <div
            key={`${ref.kind}:${ref.id}`}
            className={`bfi ${isActive ? 'active' : ''}`}
            onClick={() => onActivate(ref)}
            style={{ gap: 3, fontSize: 10, minHeight: 30, padding: '4px 8px' }}
            title={ref.subtitle ?? ref.name}
          >
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ref.name}
            </span>
            {typeof ref.count === 'number' && (
              <span style={{ fontSize: 9, color: c.textMuted }}>{ref.count}</span>
            )}
            {index > 0 && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onMovePinned(index, index - 1); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 0 }}
                title={t('knMoveUp')}
              >
                <ChevronUp size={9} />
              </button>
            )}
            {index < pinned.length - 1 && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onMovePinned(index, index + 1); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 0 }}
                title={t('knMoveDown')}
              >
                <ChevronDown size={9} />
              </button>
            )}
            <WorkspacePinToggle
              colors={c}
              pinned
              title={t('knUnpinWorkspace')}
              onToggle={e => { e.stopPropagation(); onUnpin(ref); }}
            />
          </div>
        );
      })}
    </div>
  );
}
