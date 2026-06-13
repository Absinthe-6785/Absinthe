import { useCallback, useEffect, useState } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { useTranslation } from '../../../../../lib/i18n';
import {
  STUDY_PROJECT_STATUSES,
  type StudyProjectStatus,
} from '../academic/studyProjectModels';
import { SUBJECT_DASHBOARDS } from '../maps/subjectDashboards';

export interface CreateProjectFormValues {
  name: string;
  description: string;
  subjectId: string;
  status: StudyProjectStatus;
}

export interface CreateProjectDialogProps {
  colors: NoteChromeColors;
  onSubmit: (values: CreateProjectFormValues) => void;
  onClose: () => void;
}

export function CreateProjectDialog({ colors: c, onSubmit, onClose }: CreateProjectDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [status, setStatus] = useState<StudyProjectStatus>('active');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('createProjectName'));
      return;
    }
    onSubmit({ name: trimmed, description: description.trim(), subjectId, status });
  }, [name, description, subjectId, status, onSubmit, t]);

  const inputStyle = {
    width: '100%',
    background: c.input,
    border: `1px solid ${c.inputBdr}`,
    borderRadius: 5,
    padding: '6px 8px',
    fontSize: 11,
    color: c.text,
    outline: 'none',
  } as const;

  const labelStyle = {
    display: 'block',
    fontSize: 10,
    fontWeight: 600,
    color: c.textMuted,
    marginBottom: 4,
  } as const;

  const statusLabel = (s: StudyProjectStatus) =>
    s === 'planned' ? t('projectStatusPlanned') : s === 'active' ? t('projectStatusActive') : t('projectStatusCompleted');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-dialog-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.35)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          background: c.card,
          border: `1px solid ${c.sideBdr}`,
          borderRadius: 10,
          padding: '14px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 id="create-project-dialog-title" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: c.text }}>
          {t('createProjectTitle')}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label>
            <span style={labelStyle}>{t('createProjectName')}</span>
            <input className="bwi" style={inputStyle} value={name} onChange={e => { setName(e.target.value); setError(null); }} autoFocus />
          </label>
          <label>
            <span style={labelStyle}>{t('createProjectDescription')}</span>
            <textarea
              className="bwi"
              style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </label>
          <label>
            <span style={labelStyle}>{t('createProjectSubject')}</span>
            <select className="bwi" style={inputStyle} value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">{t('createProjectSubjectNone')}</option>
              {SUBJECT_DASHBOARDS.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span style={labelStyle}>{t('createProjectStatus')}</span>
            <select className="bwi" style={inputStyle} value={status} onChange={e => setStatus(e.target.value as StudyProjectStatus)}>
              {STUDY_PROJECT_STATUSES.map(s => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </label>
          {error && <div style={{ fontSize: 10, color: c.danger }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" className="bwbg" onClick={onClose} style={{ flex: 1 }}>{t('cancel')}</button>
            <button type="button" className="bwbg" onClick={handleSubmit} style={{ flex: 1, color: c.accent, fontWeight: 700 }}>{t('createProjectTitle')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
