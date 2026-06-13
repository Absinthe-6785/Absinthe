import { useCallback, useEffect, useRef, useState } from 'react';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { useTranslation } from '../../../../../lib/i18n';
import { useModalA11y } from '../../../../../hooks/useModalA11y';
import {
  type MilestoneFormValues,
  validateMilestoneForm,
} from './milestoneNotes';

export interface MilestoneNoteDialogProps {
  colors: NoteChromeColors;
  noteTitle: string;
  initialValues: MilestoneFormValues;
  hasExistingMilestone: boolean;
  onSave: (values: MilestoneFormValues) => void;
  onRemoveMilestone?: () => void;
  onClose: () => void;
}

export function MilestoneNoteDialog({
  colors: c,
  noteTitle,
  initialValues,
  hasExistingMilestone,
  onSave,
  onRemoveMilestone,
  onClose,
}: MilestoneNoteDialogProps) {
  const { t } = useTranslation();
  const [milestoneDate, setMilestoneDate] = useState(initialValues.milestoneDate);
  const [milestoneLabel, setMilestoneLabel] = useState(initialValues.milestoneLabel ?? '');
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useModalA11y({ open: true, onClose, containerRef: panelRef });

  useEffect(() => {
    setMilestoneDate(initialValues.milestoneDate);
    setMilestoneLabel(initialValues.milestoneLabel ?? '');
    setError(null);
  }, [initialValues]);

  const handleSave = useCallback(() => {
    const values: MilestoneFormValues = {
      milestoneDate,
      milestoneLabel: milestoneLabel.trim() || undefined,
    };
    const validationError = validateMilestoneForm(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(values);
  }, [milestoneDate, milestoneLabel, onSave]);

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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
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
        aria-labelledby="milestone-note-dialog-title"
        style={{
          width: '100%',
          maxWidth: 360,
          background: c.card,
          border: `1px solid ${c.sideBdr}`,
          borderRadius: 10,
          padding: '14px 16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2
          id="milestone-note-dialog-title"
          style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: c.text }}
        >
          {hasExistingMilestone ? t('nvEditMilestone') : t('nvMarkMilestone')}
        </h2>
        <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 12 }}>
          {t('milestoneNoteFor').replace('{title}', displayNoteTitle(noteTitle))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label>
            <span style={labelStyle}>{t('milestoneDateLabel')}</span>
            <input
              type="date"
              className="bwi"
              style={inputStyle}
              value={milestoneDate}
              onChange={e => setMilestoneDate(e.target.value)}
            />
          </label>

          <label>
            <span style={labelStyle}>{t('milestoneLabelOptional')}</span>
            <input
              className="bwi"
              style={inputStyle}
              value={milestoneLabel}
              onChange={e => setMilestoneLabel(e.target.value)}
              placeholder={t('milestoneDefaultTitle')}
            />
          </label>

          {error && (
            <div style={{ fontSize: 10, color: c.danger }}>{error}</div>
          )}
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginTop: 14,
        }}>
          <div>
            {hasExistingMilestone && onRemoveMilestone && (
              <button
                type="button"
                onClick={onRemoveMilestone}
                style={{
                  background: 'none',
                  border: 'none',
                  color: c.textMuted,
                  fontSize: 10,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {t('milestoneRemoveStatus')}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="bwbg" style={{ fontSize: 11, padding: '6px 12px' }} onClick={onClose}>
              {t('cancel')}
            </button>
            <button
              type="button"
              style={{
                background: c.accent,
                border: 'none',
                borderRadius: 5,
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '6px 12px',
                cursor: 'pointer',
              }}
              onClick={handleSave}
            >
              {t('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
