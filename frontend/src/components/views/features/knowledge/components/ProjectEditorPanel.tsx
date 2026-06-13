import { useState, useEffect } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { useViewportLayout } from '../../../../hooks/useViewportLayout';
import { touchMinSize } from '../../../../lib/responsiveLayout';
import type { ProjectEditorData } from '../academic/buildProjectEditorData';
import {
  STUDY_PROJECT_STATUSES,
  STUDY_PROJECT_STATUS_LABELS_KO,
  type StudyProjectStatus,
} from '../academic/studyProjectModels';

export interface ProjectEditorPanelProps {
  colors: NoteChromeColors;
  data: ProjectEditorData;
  onUpdateDescription: (description: string) => void;
  onUpdateStatus: (status: StudyProjectStatus) => void;
  onNavigateToNote: (noteId: string) => void;
  onCreateMilestone?: () => void;
}

function EntryList({
  c,
  title,
  items,
  onNavigate,
}: {
  c: NoteChromeColors;
  title: string;
  items: ProjectEditorData['linkedNotes'];
  onNavigate: (noteId: string) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>
        {title}
        {items.length > 0 && <span style={{ color: c.accent, marginLeft: 4 }}>({items.length})</span>}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>없음</div>
      ) : (
        items.map(item => (
          <button
            key={`${title}-${item.noteId}`}
            type="button"
            onClick={() => onNavigate(item.noteId)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: c.cardHov,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: '5px 8px',
              marginBottom: 3,
              cursor: 'pointer',
              color: c.text,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.noteTitle}
            </div>
            <div style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>{item.meta}</div>
          </button>
        ))
      )}
    </div>
  );
}

/** Project editor — title via note header; status/description via properties. */
export function ProjectEditorPanel({
  colors: c,
  data,
  onUpdateDescription,
  onUpdateStatus,
  onNavigateToNote,
  onCreateMilestone,
}: ProjectEditorPanelProps) {
  const { isMobile } = useViewportLayout();
  const touch = touchMinSize(isMobile);
  const [descriptionDraft, setDescriptionDraft] = useState(data.description);

  useEffect(() => {
    setDescriptionDraft(data.description);
  }, [data.description, data.projectId]);

  const commitDescription = () => {
    if (descriptionDraft !== data.description) {
      onUpdateDescription(descriptionDraft);
    }
  };

  return (
    <section className="be-project-editor" aria-label="프로젝트 편집" style={{ padding: '8px 10px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 8, borderTop: `1px solid ${c.sideBdr}`, paddingTop: 8 }}>
        프로젝트 편집
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 8 }}>{data.title}</div>

      <label style={{ display: 'block', fontSize: 9, color: c.textMuted, marginBottom: 4 }}>상태</label>
      <select
        value={data.status}
        onChange={e => onUpdateStatus(e.target.value as StudyProjectStatus)}
        style={{
          width: '100%',
          marginBottom: 10,
          padding: '5px 8px',
          fontSize: 11,
          borderRadius: 6,
          border: `1px solid ${c.inputBdr}`,
          background: c.input,
          color: c.text,
          minHeight: touch,
          boxSizing: 'border-box',
        }}
      >
        {STUDY_PROJECT_STATUSES.map(status => (
          <option key={status} value={status}>{STUDY_PROJECT_STATUS_LABELS_KO[status]}</option>
        ))}
      </select>

      <label style={{ display: 'block', fontSize: 9, color: c.textMuted, marginBottom: 4 }}>설명</label>
      <textarea
        value={descriptionDraft}
        onChange={e => setDescriptionDraft(e.target.value)}
        onBlur={commitDescription}
        rows={3}
        placeholder="프로젝트 설명"
        style={{
          width: '100%',
          marginBottom: 10,
          padding: '6px 8px',
          fontSize: 11,
          borderRadius: 6,
          border: `1px solid ${c.inputBdr}`,
          background: c.input,
          color: c.text,
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
      />

      <div style={{ fontSize: 9, color: c.textFaint, marginBottom: 10 }}>
        {STUDY_PROJECT_STATUS_LABELS_KO[data.status]} · {data.summary.progressPercent}% · {data.summary.linkedNoteCount} 연결 노트
      </div>

      {onCreateMilestone && (
        <button
          type="button"
          onClick={onCreateMilestone}
          style={{
            width: '100%',
            marginBottom: 10,
            padding: '6px 8px',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 6,
            border: `1px solid ${c.sideBdr}`,
            background: c.cardHov,
            color: c.accent,
            cursor: 'pointer',
          }}
        >
          + 마일스톤 추가
        </button>
      )}

      <EntryList c={c} title="마일스톤" items={data.milestones} onNavigate={onNavigateToNote} />
      <EntryList c={c} title="연결 노트" items={data.linkedNotes} onNavigate={onNavigateToNote} />
      <EntryList c={c} title="관련 개념" items={data.concepts} onNavigate={onNavigateToNote} />
    </section>
  );
}
