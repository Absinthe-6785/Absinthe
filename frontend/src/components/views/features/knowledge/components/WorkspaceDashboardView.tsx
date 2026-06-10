import { useState } from 'react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { RecentWorkEntry } from '../workspace/workspacePreferences';
import type { FocusPreset } from '../workspace/focusModeModels';
import {
  DEFAULT_QUICK_CAPTURE_MODEL,
  type QuickCaptureType,
} from '../workspace/quickCaptureModels';
import { DEFAULT_TASK_TEMPLATE_ID } from '../workspace/taskTemplateModels';
import type { TaskTemplateDefinition } from '../workspace/taskTemplateModels';
import type { JournalTemplateDefinition } from '../workspace/journalTemplateModels';
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

export interface WorkspaceDashboardFocusProps {
  presets: readonly FocusPreset[];
  presetTargets: Readonly<Record<string, WorkspaceRef | null>>;
  activePresetId?: string;
  workspaceOptions: readonly WorkspaceRef[];
  onCreatePreset: (
    name: string,
    workspace: Pick<WorkspaceRef, 'kind' | 'id'>,
  ) => void;
  onDeletePreset: (id: string) => void;
  onActivatePreset: (id: string) => void;
  onExitPreset: () => void;
}

export interface WorkspaceDashboardQuickCaptureProps {
  taskTemplates: readonly TaskTemplateDefinition[];
  onCapture: (title: string, captureType: QuickCaptureType, taskTemplateId?: string) => void;
}

export interface WorkspaceDashboardProductivityProps {
  taskTemplates: readonly TaskTemplateDefinition[];
  journalTemplates: readonly JournalTemplateDefinition[];
  onCreateTask: (templateId: string, title?: string) => void;
  onCreateJournal: (templateId: string, title?: string) => void;
  onCreateTaskDatabase?: () => void;
  onCreateJournalDatabase?: () => void;
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
  focus?: WorkspaceDashboardFocusProps;
  quickCapture?: WorkspaceDashboardQuickCaptureProps;
  productivity?: WorkspaceDashboardProductivityProps;
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
  focus,
  quickCapture,
  productivity,
  recentNotesLimit = DEFAULT_RECENT_NOTES_LIMIT,
}: WorkspaceDashboardViewProps) {
  const notes = recentNotes.slice(0, recentNotesLimit);
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureType, setCaptureType] = useState<QuickCaptureType>('note');
  const [captureTaskTemplateId, setCaptureTaskTemplateId] = useState(DEFAULT_TASK_TEMPLATE_ID);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetWorkspaceKey, setNewPresetWorkspaceKey] = useState('');
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showJournalPicker, setShowJournalPicker] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [journalTitle, setJournalTitle] = useState('');

  const submitCapture = () => {
    const trimmed = captureTitle.trim();
    if (!trimmed || !quickCapture) return;
    quickCapture.onCapture(
      trimmed,
      captureType,
      captureType === 'task' ? captureTaskTemplateId : undefined,
    );
    setCaptureTitle('');
  };

  const submitPreset = () => {
    if (!focus) return;
    const trimmedName = newPresetName.trim();
    const option = focus.workspaceOptions.find(
      ref => `${ref.kind}:${ref.id}` === newPresetWorkspaceKey,
    );
    if (!trimmedName || !option) return;
    focus.onCreatePreset(trimmedName, { kind: option.kind, id: option.id });
    setNewPresetName('');
    setNewPresetWorkspaceKey('');
  };

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

      {focus && (
        <Card colors={c} title="Focus Presets">
          {focus.activePresetId && (
            <button
              type="button"
              className="bwbg"
              style={{ padding: '8px', fontSize: 11, width: '100%' }}
              onClick={focus.onExitPreset}
            >
              Exit Focus Mode
            </button>
          )}
          {focus.presets.length === 0 ? (
            <div style={{ fontSize: 11, color: c.textFaint }}>Create a preset to start focused work.</div>
          ) : focus.presets.map(preset => {
            const target = focus.presetTargets[preset.id];
            const isActive = focus.activePresetId === preset.id;
            return (
              <div
                key={preset.id}
                style={{
                  background: c.cardHov,
                  border: `1px solid ${isActive ? c.accent : c.sideBdr}`,
                  borderRadius: 6,
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c.text }}>{preset.name}</div>
                  <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>
                    {target
                      ? `${target.name} · ${workspaceKindLabel(target.kind)}`
                      : 'Workspace unavailable'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="bwbg"
                    style={{ flex: 1, padding: '6px', fontSize: 11 }}
                    disabled={!target}
                    onClick={() => focus.onActivatePreset(preset.id)}
                  >
                    {isActive ? 'Active' : 'Start'}
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '6px 8px',
                      fontSize: 11,
                      background: c.card,
                      border: `1px solid ${c.sideBdr}`,
                      borderRadius: 5,
                      color: c.textMuted,
                      cursor: 'pointer',
                    }}
                    onClick={() => focus.onDeletePreset(preset.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
          {focus.workspaceOptions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <input
                className="bwi"
                style={{ width: '100%', fontSize: 11 }}
                placeholder="Preset name"
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
              />
              <select
                className="bwi"
                style={{ width: '100%', fontSize: 11 }}
                value={newPresetWorkspaceKey}
                onChange={e => setNewPresetWorkspaceKey(e.target.value)}
              >
                <option value="">Select workspace target</option>
                {focus.workspaceOptions.map(ref => (
                  <option key={`${ref.kind}:${ref.id}`} value={`${ref.kind}:${ref.id}`}>
                    {ref.name} ({workspaceKindLabel(ref.kind)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="bwbg"
                style={{ padding: '6px', fontSize: 11 }}
                onClick={submitPreset}
              >
                Create Preset
              </button>
            </div>
          )}
        </Card>
      )}

      {quickCapture && (
        <Card colors={c} title="Quick Capture">
          <div style={{ fontSize: 10, color: c.textFaint, marginBottom: 4 }}>
            Creates an ordinary note tagged #{DEFAULT_QUICK_CAPTURE_MODEL.inboxTag}
          </div>
          <input
            className="bwi"
            style={{ width: '100%', fontSize: 11 }}
            placeholder="Title"
            value={captureTitle}
            onChange={e => setCaptureTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitCapture();
            }}
          />
          <select
            className="bwi"
            style={{ width: '100%', fontSize: 11 }}
            value={captureType}
            onChange={e => setCaptureType(e.target.value as QuickCaptureType)}
          >
            {DEFAULT_QUICK_CAPTURE_MODEL.types.map(type => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
          </select>
          {captureType === 'task' && quickCapture.taskTemplates.length > 0 && (
            <select
              className="bwi"
              style={{ width: '100%', fontSize: 11 }}
              value={captureTaskTemplateId}
              onChange={e => setCaptureTaskTemplateId(e.target.value)}
            >
              {quickCapture.taskTemplates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="bwbg"
            style={{ padding: '8px', fontSize: 11, width: '100%' }}
            onClick={submitCapture}
          >
            Capture
          </button>
        </Card>
      )}

      <Card colors={c} title="Quick Actions">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className="bwbg" style={{ padding: '8px', fontSize: 11 }} onClick={quickActions.onNewNote}>
            New Note
          </button>
          <button type="button" className="bwbg" style={{ padding: '8px', fontSize: 11 }} onClick={quickActions.onNewDatabaseView}>
            New Database View
          </button>
          {productivity && (
            <>
              <button
                type="button"
                className="bwbg"
                style={{ padding: '8px', fontSize: 11 }}
                onClick={() => { setShowJournalPicker(false); setShowTaskPicker(v => !v); }}
              >
                New Task
              </button>
              <button
                type="button"
                className="bwbg"
                style={{ padding: '8px', fontSize: 11 }}
                onClick={() => { setShowTaskPicker(false); setShowJournalPicker(v => !v); }}
              >
                New Journal
              </button>
            </>
          )}
          <button type="button" className="bwbg" style={{ padding: '8px', fontSize: 11 }} onClick={quickActions.onOpenSearch}>
            Open Search
          </button>
          <button type="button" className="bwbg" style={{ padding: '8px', fontSize: 11 }} onClick={quickActions.onOpenGraph}>
            Open Graph
          </button>
        </div>
        {productivity && showTaskPicker && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <input
              className="bwi"
              style={{ width: '100%', fontSize: 11 }}
              placeholder="Task title (optional)"
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
            />
            {productivity.taskTemplates.map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  productivity.onCreateTask(template.id, taskTitle.trim() || undefined);
                  setTaskTitle('');
                  setShowTaskPicker(false);
                }}
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
                title={template.description}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>{template.name}</div>
                <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{template.description}</div>
              </button>
            ))}
            {productivity.onCreateTaskDatabase && (
              <button
                type="button"
                className="bwbg"
                style={{ padding: '6px', fontSize: 10 }}
                onClick={productivity.onCreateTaskDatabase}
              >
                Create Task Database
              </button>
            )}
          </div>
        )}
        {productivity && showJournalPicker && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <input
              className="bwi"
              style={{ width: '100%', fontSize: 11 }}
              placeholder="Journal title (optional)"
              value={journalTitle}
              onChange={e => setJournalTitle(e.target.value)}
            />
            {productivity.journalTemplates.map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  productivity.onCreateJournal(template.id, journalTitle.trim() || undefined);
                  setJournalTitle('');
                  setShowJournalPicker(false);
                }}
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
                title={template.description}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>{template.name}</div>
                <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{template.description}</div>
              </button>
            ))}
            {productivity.onCreateJournalDatabase && (
              <button
                type="button"
                className="bwbg"
                style={{ padding: '6px', fontSize: 10 }}
                onClick={productivity.onCreateJournalDatabase}
              >
                Create Journal Database
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
