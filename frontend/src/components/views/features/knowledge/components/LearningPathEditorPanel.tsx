import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import {
  buildAddNoteToLearningPathProperties,
  buildLearningPathEditorModel,
  buildLearningPathMovePatches,
  buildLearningPathNormalizePatches,
  buildLearningPathRenamePatches,
  buildRemoveNoteFromLearningPathProperties,
  formatLearningPathLabel,
  learningPathIdExists,
  nextLearningPathStep,
  slugifyLearningPathId,
} from '../maps/learningPathEditor';
import { getLearningPathId } from '../maps/subjectDashboards';

export interface LearningPathEditorPanelProps {
  colors: NoteChromeColors;
  pathId: string | null;
  notes: readonly NoteBase[];
  activeNoteId?: string | null;
  onPathIdChange: (pathId: string | null) => void;
  onUpdateNoteProperties: (noteId: string, properties: Record<string, string>) => void;
  onCreateNote?: (title: string) => string;
  onNavigateToNote: (noteId: string) => void;
}

function noteOptionLabel(note: NoteBase): string {
  return displayNoteTitle(note.title);
}

/** Learning path editor — create, rename, add/remove notes, reorder steps. */
export function LearningPathEditorPanel({
  colors: c,
  pathId,
  notes,
  activeNoteId,
  onPathIdChange,
  onUpdateNoteProperties,
  onCreateNote,
  onNavigateToNote,
}: LearningPathEditorPanelProps) {
  const path = useMemo(
    () => (pathId ? buildLearningPathEditorModel(notes, pathId) : null),
    [notes, pathId],
  );
  const [newPathLabel, setNewPathLabel] = useState('');
  const [renameLabel, setRenameLabel] = useState(path ? formatLearningPathLabel(path.pathId) : '');
  const [selectedNoteId, setSelectedNoteId] = useState('');

  useEffect(() => {
    setRenameLabel(path ? formatLearningPathLabel(path.pathId) : '');
  }, [path?.pathId]);

  const availableNotes = useMemo(
    () => notes
      .filter(n => !n.deletedAt && getLearningPathId(n) !== pathId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 50),
    [notes, pathId],
  );

  const applyPatches = (patches: ReadonlyMap<string, Record<string, string>>) => {
    patches.forEach((properties, noteId) => onUpdateNoteProperties(noteId, properties));
  };

  const handleCreatePath = () => {
    const base = slugifyLearningPathId(newPathLabel);
    let candidate = base;
    let suffix = 2;
    while (learningPathIdExists(notes, candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    onPathIdChange(candidate);
    setNewPathLabel('');
  };

  const handleRenamePath = () => {
    if (!pathId) return;
    const nextId = slugifyLearningPathId(renameLabel);
    if (!nextId || nextId === pathId) return;
    if (learningPathIdExists(notes, nextId) && nextId !== pathId) return;
    applyPatches(buildLearningPathRenamePatches(notes, pathId, nextId));
    onPathIdChange(nextId);
  };

  const handleAddNote = () => {
    if (!pathId || !selectedNoteId) return;
    const note = notes.find(n => n.id === selectedNoteId);
    if (!note) return;
    const step = nextLearningPathStep(notes, pathId);
    const props = buildAddNoteToLearningPathProperties(note, pathId, step);
    onUpdateNoteProperties(note.id, props);
    const virtualNotes = notes.map(n => (n.id === note.id ? { ...n, properties: props } : n));
    applyPatches(buildLearningPathNormalizePatches(virtualNotes, pathId));
    setSelectedNoteId('');
  };

  const handleAddActiveNote = () => {
    if (!pathId || !activeNoteId) return;
    const note = notes.find(n => n.id === activeNoteId);
    if (!note || getLearningPathId(note) === pathId) return;
    const step = nextLearningPathStep(notes, pathId);
    const props = buildAddNoteToLearningPathProperties(note, pathId, step);
    onUpdateNoteProperties(note.id, props);
    const virtualNotes = notes.map(n => (n.id === note.id ? { ...n, properties: props } : n));
    applyPatches(buildLearningPathNormalizePatches(virtualNotes, pathId));
  };

  const handleCreateAndAddNote = () => {
    if (!pathId || !onCreateNote) return;
    const id = onCreateNote('New Step');
    const note = notes.find(n => n.id === id) ?? {
      id,
      title: 'New Step',
      body: '',
      updatedAt: Date.now(),
      folderId: null,
      deletedAt: null,
    };
    const step = nextLearningPathStep(notes, pathId);
    const props = buildAddNoteToLearningPathProperties(note, pathId, step);
    onUpdateNoteProperties(id, props);
    const virtualNotes = [...notes, { ...note, properties: props }];
    applyPatches(buildLearningPathNormalizePatches(virtualNotes, pathId));
  };

  const handleRemoveNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note || !pathId) return;
    onUpdateNoteProperties(note.id, buildRemoveNoteFromLearningPathProperties(note));
    const virtualNotes = notes.filter(n => n.id !== noteId);
    applyPatches(buildLearningPathNormalizePatches(virtualNotes, pathId));
  };

  const handleMove = (noteId: string, direction: 'up' | 'down') => {
    if (!pathId) return;
    const movePatches = buildLearningPathMovePatches(notes, pathId, noteId, direction);
    if (movePatches.size === 0) return;
    applyPatches(movePatches);
    const virtualNotes = notes.map(n => {
      const patch = movePatches.get(n.id);
      return patch ? { ...n, properties: patch } : n;
    });
    applyPatches(buildLearningPathNormalizePatches(virtualNotes, pathId));
  };

  if (!pathId) {
    return (
      <div className="be-learning-path-editor" aria-label="학습 경로 편집" style={{ padding: '8px 0' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 8 }}>새 학습 경로</div>
        <input
          value={newPathLabel}
          onChange={e => setNewPathLabel(e.target.value)}
          placeholder="경로 이름"
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: 11,
            borderRadius: 6,
            border: `1px solid ${c.inputBdr}`,
            background: c.input,
            color: c.text,
            marginBottom: 6,
            boxSizing: 'border-box',
          }}
        />
        <button
          type="button"
          onClick={handleCreatePath}
          disabled={!newPathLabel.trim()}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 6,
            border: `1px solid ${c.sideBdr}`,
            background: c.cardHov,
            color: c.accent,
            cursor: newPathLabel.trim() ? 'pointer' : 'default',
            opacity: newPathLabel.trim() ? 1 : 0.5,
          }}
        >
          <Plus size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          경로 만들기
        </button>
      </div>
    );
  }

  return (
    <div className="be-learning-path-editor" aria-label="학습 경로 편집" style={{ padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted }}>경로 편집</div>
        <button
          type="button"
          onClick={() => onPathIdChange(null)}
          style={{ fontSize: 9, color: c.textFaint, background: 'none', border: 'none', cursor: 'pointer' }}
        >
          닫기
        </button>
      </div>

      <input
        value={renameLabel}
        onChange={e => setRenameLabel(e.target.value)}
        onBlur={handleRenamePath}
        style={{
          width: '100%',
          padding: '6px 8px',
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 6,
          border: `1px solid ${c.inputBdr}`,
          background: c.input,
          color: c.text,
          marginBottom: 8,
          boxSizing: 'border-box',
        }}
      />

      <div style={{ fontSize: 9, color: c.textFaint, marginBottom: 8 }}>
        {path?.steps.length ?? 0}단계 · ID: {pathId}
      </div>

      {path?.steps.map((step, index) => (
        <div
          key={step.noteId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 4,
            padding: '4px 6px',
            background: c.cardHov,
            border: `1px solid ${c.sideBdr}`,
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 9, color: c.accent, width: 16, flexShrink: 0 }}>{step.step}</span>
          <button
            type="button"
            onClick={() => onNavigateToNote(step.noteId)}
            style={{
              flex: 1,
              textAlign: 'left',
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 10,
              color: c.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {step.noteTitle}
          </button>
          <button type="button" onClick={() => handleMove(step.noteId, 'up')} disabled={index === 0} title="위로"
            style={{ background: 'none', border: 'none', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1, color: c.textMuted }}>
            <ChevronUp size={12} />
          </button>
          <button type="button" onClick={() => handleMove(step.noteId, 'down')} disabled={index === (path.steps.length - 1)} title="아래로"
            style={{ background: 'none', border: 'none', cursor: index === (path.steps.length - 1) ? 'default' : 'pointer', opacity: index === (path.steps.length - 1) ? 0.3 : 1, color: c.textMuted }}>
            <ChevronDown size={12} />
          </button>
          <button type="button" onClick={() => handleRemoveNote(step.noteId)} title="제거"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.danger }}>
            <Trash2 size={11} />
          </button>
        </div>
      ))}

      <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${c.sideBdr}` }}>
        <div style={{ fontSize: 9, color: c.textMuted, marginBottom: 4 }}>노트 추가</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <select
            value={selectedNoteId}
            onChange={e => setSelectedNoteId(e.target.value)}
            style={{
              flex: 1,
              padding: '5px 6px',
              fontSize: 10,
              borderRadius: 6,
              border: `1px solid ${c.inputBdr}`,
              background: c.input,
              color: c.text,
            }}
          >
            <option value="">노트 선택…</option>
            {availableNotes.map(n => (
              <option key={n.id} value={n.id}>{noteOptionLabel(n)}</option>
            ))}
          </select>
          <button type="button" onClick={handleAddNote} disabled={!selectedNoteId}
            style={{ padding: '5px 8px', fontSize: 10, borderRadius: 6, border: `1px solid ${c.sideBdr}`, background: c.cardHov, color: c.accent, cursor: selectedNoteId ? 'pointer' : 'default' }}>
            추가
          </button>
        </div>
        {activeNoteId && (
          <button type="button" onClick={handleAddActiveNote}
            style={{ width: '100%', marginBottom: 4, padding: '5px 8px', fontSize: 10, borderRadius: 6, border: `1px solid ${c.sideBdr}`, background: c.cardHov, color: c.text, cursor: 'pointer' }}>
            현재 노트 추가
          </button>
        )}
        {onCreateNote && (
          <button type="button" onClick={handleCreateAndAddNote}
            style={{ width: '100%', padding: '5px 8px', fontSize: 10, borderRadius: 6, border: `1px solid ${c.sideBdr}`, background: c.cardHov, color: c.text, cursor: 'pointer' }}>
            새 노트 만들어 추가
          </button>
        )}
      </div>
    </div>
  );
}
