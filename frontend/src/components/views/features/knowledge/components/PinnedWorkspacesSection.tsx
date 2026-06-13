import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { WorkspaceRef } from '../workspace/workspaceModels';
import { WorkspacePinToggle } from './WorkspacePinToggle';

export interface PinnedWorkspacesSectionProps {
  colors: NoteChromeColors;
  pinned: readonly WorkspaceRef[];
  activeKind: string | null;
  activeId: string | null;
  onActivate: (ref: WorkspaceRef) => void;
  onUnpin: (ref: WorkspaceRef) => void;
  onMovePinned: (fromIndex: number, toIndex: number) => void;
}

export function PinnedWorkspacesSection({
  colors: c,
  pinned,
  activeKind,
  activeId,
  onActivate,
  onUnpin,
  onMovePinned,
}: PinnedWorkspacesSectionProps) {
  if (pinned.length === 0) return null;

  return (
    <div style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
      <div className="bseclbl">
        <span>고정</span>
      </div>
      {pinned.map((ref, index) => {
        const isActive = activeKind === ref.kind && activeId === ref.id;
        return (
          <div
            key={`${ref.kind}:${ref.id}`}
            className={`bfi ${isActive ? 'active' : ''}`}
            onClick={() => onActivate(ref)}
            style={{ gap: 4, fontSize: 11 }}
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
                title="위로"
              >
                <ChevronUp size={9} />
              </button>
            )}
            {index < pinned.length - 1 && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onMovePinned(index, index + 1); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textMuted, padding: 0 }}
                title="아래로"
              >
                <ChevronDown size={9} />
              </button>
            )}
            <WorkspacePinToggle
              colors={c}
              pinned
              title="작업공간 고정 해제"
              onToggle={e => { e.stopPropagation(); onUnpin(ref); }}
            />
          </div>
        );
      })}
    </div>
  );
}
