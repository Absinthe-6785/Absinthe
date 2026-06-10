import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { RecentWorkEntry } from '../workspace/workspacePreferences';
import {
  DEFAULT_RECENT_NOTES_LIMIT,
  formatRecentTimestamp,
  workspaceKindLabel,
  type WorkspaceDashboardModel,
} from '../workspace/workspaceDashboardModels';
import type { WorkspaceRef } from '../workspace/workspaceModels';

export interface WorkspaceDashboardQuickActions {
  onNewNote: () => void;
  onNewDatabaseView: () => void;
  onOpenSearch: () => void;
  onOpenGraph: () => void;
}

export interface WorkspaceDashboardViewProps {
  colors: NoteChromeColors;
  dashboard: WorkspaceDashboardModel;
  pinned: readonly WorkspaceRef[];
  recent: readonly RecentWorkEntry[];
  resumeWorkspace: WorkspaceRef | null;
  recentNotes: readonly NoteBase[];
  onActivateWorkspace: (ref: WorkspaceRef) => void;
  onResumeWorkspace: () => void;
  onSelectNote: (noteId: string) => void;
  quickActions: WorkspaceDashboardQuickActions;
  recentNotesLimit?: number;
}

function Card({
  colors: c,
  title,
  children,
}: {
  colors: NoteChromeColors;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{
      background: c.card,
      border: `1px solid ${c.sideBdr}`,
      borderRadius: 8,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: 0.3 }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function WorkspaceRow({
  colors: c,
  workspaceRef,
  meta,
  onClick,
}: {
  colors: NoteChromeColors;
  workspaceRef: WorkspaceRef;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: c.cardHov,
        border: `1px solid ${c.sideBdr}`,
        borderRadius: 6,
        padding: '8px 10px',
        cursor: 'pointer',
        color: c.text,
      }}
      title={workspaceRef.subtitle ?? workspaceRef.name}
    >
      <div style={{ fontSize: 12, fontWeight: 600 }}>{workspaceRef.name}</div>
      <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>
        {workspaceKindLabel(workspaceRef.kind)}
        {meta ? ` · ${meta}` : ''}
      </div>
    </button>
  );
}

export function WorkspaceDashboardView({
  colors: c,
  dashboard,
  pinned,
  recent,
  resumeWorkspace,
  recentNotes,
  onActivateWorkspace,
  onResumeWorkspace,
  onSelectNote,
  quickActions,
  recentNotesLimit = DEFAULT_RECENT_NOTES_LIMIT,
}: WorkspaceDashboardViewProps) {
  const notes = recentNotes.slice(0, recentNotesLimit);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: c.text }}>{dashboard.name}</div>
        <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>Your productivity entry point</div>
      </div>

      <Card colors={c} title="Pinned Workspaces">
        {pinned.length === 0 ? (
          <div style={{ fontSize: 11, color: c.textFaint }}>Pin workspaces from the sidebar to see them here.</div>
        ) : pinned.map(ref => (
          <WorkspaceRow
            key={`${ref.kind}:${ref.id}`}
            colors={c}
            workspaceRef={ref}
            onClick={() => onActivateWorkspace(ref)}
          />
        ))}
      </Card>

      <Card colors={c} title="Recent Work">
        {recent.length === 0 ? (
          <div style={{ fontSize: 11, color: c.textFaint }}>Recently opened workspaces appear here.</div>
        ) : recent.map(entry => (
          <WorkspaceRow
            key={`${entry.workspace.kind}:${entry.workspace.id}`}
            colors={c}
            workspaceRef={entry.workspace}
            meta={formatRecentTimestamp(entry.lastOpenedAt)}
            onClick={() => onActivateWorkspace(entry.workspace)}
          />
        ))}
      </Card>

      <Card colors={c} title="Resume Last Workspace">
        {resumeWorkspace ? (
          <WorkspaceRow
            colors={c}
            workspaceRef={resumeWorkspace}
            meta="Continue where you left off"
            onClick={onResumeWorkspace}
          />
        ) : (
          <div style={{ fontSize: 11, color: c.textFaint }}>No previous workspace to resume.</div>
        )}
      </Card>

      <Card colors={c} title="Recent Notes">
        {notes.length === 0 ? (
          <div style={{ fontSize: 11, color: c.textFaint }}>No notes yet.</div>
        ) : notes.map(note => (
          <button
            key={note.id}
            type="button"
            onClick={() => onSelectNote(note.id)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: c.cardHov,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: '8px 10px',
              cursor: 'pointer',
              color: c.text,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600 }}>{note.title?.trim() || 'Untitled'}</div>
            <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>
              Updated {formatRecentTimestamp(note.updatedAt)}
            </div>
          </button>
        ))}
      </Card>

      <Card colors={c} title="Quick Actions">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className="bwbg" style={{ padding: '8px', fontSize: 11 }} onClick={quickActions.onNewNote}>
            New Note
          </button>
          <button type="button" className="bwbg" style={{ padding: '8px', fontSize: 11 }} onClick={quickActions.onNewDatabaseView}>
            New Database View
          </button>
          <button type="button" className="bwbg" style={{ padding: '8px', fontSize: 11 }} onClick={quickActions.onOpenSearch}>
            Open Search
          </button>
          <button type="button" className="bwbg" style={{ padding: '8px', fontSize: 11 }} onClick={quickActions.onOpenGraph}>
            Open Graph
          </button>
        </div>
      </Card>
    </div>
  );
}
