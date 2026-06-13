import { useState, useEffect } from 'react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { useViewportLayout } from '../../../../../hooks/useViewportLayout';
import { touchMinSize } from '../../../../../lib/responsiveLayout';
import type { ProjectEditorData } from '../academic/buildProjectEditorData';
import {
  STUDY_PROJECT_STATUSES,
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

const PROJECT_STATUS_KEYS: Record<StudyProjectStatus, 'projectStatusPlanned' | 'projectStatusActive' | 'projectStatusCompleted'> = {
  planned: 'projectStatusPlanned',
  active: 'projectStatusActive',
  completed: 'projectStatusCompleted',
};

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
  const { t } = useTranslation();
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>
        {title}
        {items.length > 0 && <span style={{ color: c.accent, marginLeft: 4 }}>({items.length})</span>}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>{t('knNone')}</div>
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
  const { t } = useTranslation();
  const { isMobile, isTablet } = useViewportLayout();
  const touch = touchMinSize(isMobile, isTablet);
  const [descriptionDraft, setDescriptionDraft] = useState(data.description);

  useEffect(() => {
    setDescriptionDraft(data.description);
  }, [data.description, data.projectId]);

  const commitDescription = () => {
    if (descriptionDraft !== data.description) {
      onUpdateDescription(descriptionDraft);
    }
  };

  const statusLabel = t(PROJECT_STATUS_KEYS[data.status]);

  return (
    <section className="be-project-editor" aria-label={t('knProjectEditorAria')} style={{ padding: '8px 10px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 8, borderTop: `1px solid ${c.sideBdr}`, paddingTop: 8 }}>
        {t('knProjectEditorAria')}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 8 }}>{data.title}</div>

      <label style={{ display: 'block', fontSize: 9, color: c.textMuted, marginBottom: 4 }}>{t('createProjectStatus')}</label>
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
          <option key={status} value={status}>{t(PROJECT_STATUS_KEYS[status])}</option>
        ))}
      </select>

      <label style={{ display: 'block', fontSize: 9, color: c.textMuted, marginBottom: 4 }}>{t('createProjectDescription')}</label>
      <textarea
        value={descriptionDraft}
        onChange={e => setDescriptionDraft(e.target.value)}
        onBlur={commitDescription}
        rows={3}
        placeholder={t('createProjectDescriptionPlaceholder')}
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
        {t('knLinkedNotesSummary')
          .replace('{status}', statusLabel)
          .replace('{percent}', String(data.summary.progressPercent))
          .replace('{count}', String(data.summary.linkedNoteCount))}
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
          {t('knAddMilestone')}
        </button>
      )}

      <EntryList c={c} title={t('traceSectionMilestones')} items={data.milestones} onNavigate={onNavigateToNote} />
      <EntryList c={c} title={t('traceSectionLinkedNotes')} items={data.linkedNotes} onNavigate={onNavigateToNote} />
      <EntryList c={c} title={t('knRelatedConcepts')} items={data.concepts} onNavigate={onNavigateToNote} />
    </section>
  );
}
