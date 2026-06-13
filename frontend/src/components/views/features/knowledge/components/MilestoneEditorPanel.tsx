import { useState, useEffect } from 'react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { useViewportLayout } from '../../../../../hooks/useViewportLayout';
import { touchMinSize } from '../../../../../lib/responsiveLayout';
import {
  MILESTONE_STATUSES,
  type MilestoneStatus,
} from '../academic/projectMilestoneModels';

export interface MilestoneEditorPanelProps {
  colors: NoteChromeColors;
  title: string;
  status: MilestoneStatus;
  targetDate: string | null;
  projectId: string | null;
  projectTitle: string;
  onUpdateStatus: (status: MilestoneStatus) => void;
  onUpdateTargetDate: (targetDate: string | null) => void;
  onNavigateToProject?: () => void;
}

const MILESTONE_STATUS_KEYS: Record<MilestoneStatus, 'projectStatusPlanned' | 'projectStatusActive' | 'projectStatusCompleted'> = {
  planned: 'projectStatusPlanned',
  active: 'projectStatusActive',
  completed: 'projectStatusCompleted',
};

/** Milestone editor — title via note header; status/date via properties. */
export function MilestoneEditorPanel({
  colors: c,
  title,
  status,
  targetDate,
  projectId,
  projectTitle,
  onUpdateStatus,
  onUpdateTargetDate,
  onNavigateToProject,
}: MilestoneEditorPanelProps) {
  const { t } = useTranslation();
  const { isMobile, isTablet } = useViewportLayout();
  const touch = touchMinSize(isMobile, isTablet);
  const [dateDraft, setDateDraft] = useState(targetDate ?? '');

  useEffect(() => {
    setDateDraft(targetDate ?? '');
  }, [targetDate, title]);

  const commitDate = () => {
    const trimmed = dateDraft.trim();
    onUpdateTargetDate(trimmed || null);
  };

  return (
    <section className="be-milestone-editor" aria-label={t('knMilestoneEditorAria')} style={{ padding: '8px 10px' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 8, borderTop: `1px solid ${c.sideBdr}`, paddingTop: 8 }}>
        {t('knMilestoneEditorAria')}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 8 }}>{title}</div>

      {projectId && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: c.textMuted, marginBottom: 2 }}>{t('createMilestoneProject')}</div>
          {onNavigateToProject ? (
            <button
              type="button"
              onClick={onNavigateToProject}
              style={{
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 5,
                border: `1px solid ${c.sideBdr}`,
                background: c.cardHov,
                color: c.accent,
                cursor: 'pointer',
              }}
            >
              {projectTitle || projectId}
            </button>
          ) : (
            <span style={{ fontSize: 10, color: c.text }}>{projectTitle || projectId}</span>
          )}
        </div>
      )}

      <label style={{ display: 'block', fontSize: 9, color: c.textMuted, marginBottom: 4 }}>{t('createProjectStatus')}</label>
      <select
        value={status}
        onChange={e => onUpdateStatus(e.target.value as MilestoneStatus)}
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
        {MILESTONE_STATUSES.map(s => (
          <option key={s} value={s}>{t(MILESTONE_STATUS_KEYS[s])}</option>
        ))}
      </select>

      <label style={{ display: 'block', fontSize: 9, color: c.textMuted, marginBottom: 4 }}>{t('knTargetDate')}</label>
      <input
        type="date"
        value={dateDraft}
        onChange={e => setDateDraft(e.target.value)}
        onBlur={commitDate}
        style={{
          width: '100%',
          marginBottom: 8,
          padding: '5px 8px',
          fontSize: 11,
          borderRadius: 6,
          border: `1px solid ${c.inputBdr}`,
          background: c.input,
          color: c.text,
          boxSizing: 'border-box',
          minHeight: touch,
        }}
      />
      <div style={{ fontSize: 9, color: c.textFaint }}>
        {t(MILESTONE_STATUS_KEYS[status])}
        {targetDate ? ` · ${t('knTargetDateValue').replace('{date}', targetDate)}` : ''}
      </div>
    </section>
  );
}
