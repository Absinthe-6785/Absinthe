import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { useTranslation } from '../../../../../lib/i18n';
import { useModalA11y } from '../../../../../hooks/useModalA11y';
import {
  type EventFormValues,
  validateEventForm,
} from './eventNotes';

export interface EventNoteDialogProps {
  colors: NoteChromeColors;
  mode: 'create' | 'edit';
  initialValues: EventFormValues;
  onSave: (values: EventFormValues) => void;
  onRemoveEvent?: () => void;
  onClose: () => void;
}

export function EventNoteDialog({
  colors: c,
  mode,
  initialValues,
  onSave,
  onRemoveEvent,
  onClose,
}: EventNoteDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialValues.title);
  const [eventDate, setEventDate] = useState(initialValues.eventDate);
  const [eventTime, setEventTime] = useState(initialValues.eventTime ?? '');
  const [showRange, setShowRange] = useState(Boolean(
    initialValues.eventEndDate || initialValues.eventEndTime,
  ));
  const [eventEndDate, setEventEndDate] = useState(initialValues.eventEndDate ?? '');
  const [eventEndTime, setEventEndTime] = useState(initialValues.eventEndTime ?? '');
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useModalA11y({ open: true, onClose, containerRef: panelRef });

  useEffect(() => {
    setTitle(initialValues.title);
    setEventDate(initialValues.eventDate);
    setEventTime(initialValues.eventTime ?? '');
    setShowRange(Boolean(initialValues.eventEndDate || initialValues.eventEndTime));
    setEventEndDate(initialValues.eventEndDate ?? '');
    setEventEndTime(initialValues.eventEndTime ?? '');
    setError(null);
  }, [initialValues]);

  const buildValues = useCallback((): EventFormValues => ({
    title,
    eventDate,
    eventTime: eventTime.trim() || undefined,
    eventEndDate: showRange && eventEndDate.trim() ? eventEndDate : undefined,
    eventEndTime: showRange && eventEndTime.trim() ? eventEndTime : undefined,
  }), [title, eventDate, eventTime, showRange, eventEndDate, eventEndTime]);

  const handleSave = useCallback(() => {
    const values = buildValues();
    const validationError = validateEventForm(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(values);
  }, [buildValues, onSave]);

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
        aria-labelledby="event-note-dialog-title"
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
          id="event-note-dialog-title"
          style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: c.text }}
        >
          {mode === 'create' ? t('eventCreateTitle') : t('eventEditTitle')}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label>
            <span style={labelStyle}>{t('title')}</span>
            <input
              className="bwi"
              style={inputStyle}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={t('eventTitlePlaceholder')}
              autoFocus
            />
          </label>

          <label>
            <span style={labelStyle}>{t('date')}</span>
            <input
              type="date"
              className="bwi"
              style={inputStyle}
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
            />
          </label>

          <label>
            <span style={labelStyle}>{t('eventTimeOptional')}</span>
            <input
              type="time"
              className="bwi"
              style={inputStyle}
              value={eventTime}
              onChange={e => setEventTime(e.target.value)}
            />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showRange}
              onChange={e => setShowRange(e.target.checked)}
            />
            <span style={{ fontSize: 11, color: c.textMuted }}>{t('eventRangeOptional')}</span>
          </label>

          {showRange && (
            <>
              <label>
                <span style={labelStyle}>{t('eventEndDate')}</span>
                <input
                  type="date"
                  className="bwi"
                  style={inputStyle}
                  value={eventEndDate}
                  onChange={e => setEventEndDate(e.target.value)}
                />
              </label>
              <label>
                <span style={labelStyle}>{t('eventEndTimeOptional')}</span>
                <input
                  type="time"
                  className="bwi"
                  style={inputStyle}
                  value={eventEndTime}
                  onChange={e => setEventEndTime(e.target.value)}
                />
              </label>
            </>
          )}

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
            {mode === 'edit' && onRemoveEvent && (
              <button
                type="button"
                onClick={onRemoveEvent}
                style={{
                  background: 'none',
                  border: 'none',
                  color: c.textMuted,
                  fontSize: 10,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {t('eventRemoveStatus')}
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
