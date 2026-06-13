import { useCallback, useMemo, useRef, useState } from 'react';
import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { useTranslation } from '../../../../../lib/i18n';
import { useModalA11y } from '../../../../../hooks/useModalA11y';
import {
  MILESTONE_STATUSES,
  type MilestoneStatus,
} from '../academic/projectMilestoneModels';
import { filterStudyProjectContainers } from '../academic/studyProjectModels';

export interface CreateMilestoneFormValues {
  name: string;
  targetDate: string;
  projectId: string;
  status: MilestoneStatus;
}

export interface CreateMilestoneDialogProps {
  colors: NoteChromeColors;
  notes: readonly NoteBase[];
  defaultProjectId?: string;
  onSubmit: (values: CreateMilestoneFormValues) => void;
  onClose: () => void;
}

export function CreateMilestoneDialog({
  colors: c,
  notes,
  defaultProjectId,
  onSubmit,
  onClose,
}: CreateMilestoneDialogProps) {
  const { t } = useTranslation();
  const projects = useMemo(() => filterStudyProjectContainers(notes), [notes]);
  const initialProjectId = defaultProjectId
    ?? filterStudyProjectContainers(notes, 'active')[0]?.id
    ?? projects[0]?.id
    ?? '';
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [projectId, setProjectId] = useState(initialProjectId);
  const [status, setStatus] = useState<MilestoneStatus>('planned');
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useModalA11y({ open: true, onClose, containerRef: panelRef });

  const statusLabel = (s: MilestoneStatus) =>
    s === 'planned' ? t('projectStatusPlanned') : s === 'active' ? t('projectStatusActive') : t('projectStatusCompleted');

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('createMilestoneName'));
      return;
    }
    if (!projectId) {
      setError(t('createMilestoneNoProjects'));
      return;
    }
    onSubmit({ name: trimmed, targetDate: targetDate.trim(), projectId, status });
  }, [name, targetDate, projectId, status, onSubmit, t]);

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

  if (projects.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
        <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="create-milestone-empty-title" style={{ maxWidth: 320, background: c.card, border: `1px solid ${c.sideBdr}`, borderRadius: 10, padding: 16 }} onClick={e => e.stopPropagation()}>
          <p id="create-milestone-empty-title" style={{ fontSize: 12, color: c.text, margin: '0 0 12px' }}>{t('createMilestoneNoProjects')}</p>
          <button type="button" className="bwbg" onClick={onClose} style={{ width: '100%' }}>{t('close')}</button>
        </div>
      </div>
    );
  }

  return (
    <div
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
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-milestone-dialog-title"
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
        <h2 id="create-milestone-dialog-title" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: c.text }}>
          {t('createMilestoneTitle')}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label>
            <span style={labelStyle}>{t('createMilestoneName')}</span>
            <input className="bwi" style={inputStyle} value={name} onChange={e => { setName(e.target.value); setError(null); }} autoFocus />
          </label>
          <label>
            <span style={labelStyle}>{t('createMilestoneTargetDate')}</span>
            <input type="date" className="bwi" style={inputStyle} value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </label>
          <label>
            <span style={labelStyle}>{t('createMilestoneProject')}</span>
            <select className="bwi" style={inputStyle} value={projectId} onChange={e => setProjectId(e.target.value)}>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{displayNoteTitle(p.title)}</option>
              ))}
            </select>
          </label>
          <label>
            <span style={labelStyle}>{t('createProjectStatus')}</span>
            <select className="bwi" style={inputStyle} value={status} onChange={e => setStatus(e.target.value as MilestoneStatus)}>
              {MILESTONE_STATUSES.map(s => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </label>
          {error && <div role="alert" style={{ fontSize: 10, color: c.danger }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" className="bwbg" onClick={onClose} style={{ flex: 1 }}>{t('cancel')}</button>
            <button type="button" className="bwbg" onClick={handleSubmit} style={{ flex: 1, color: c.accent, fontWeight: 700 }}>{t('createMilestoneTitle')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
