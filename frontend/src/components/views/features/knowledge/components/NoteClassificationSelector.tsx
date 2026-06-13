import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteKind } from '../research/noteClassification';
import {
  NOTE_KINDS,
  canPromoteKind,
  nextNoteKind,
  noteKindWorkflowStep,
} from '../research/noteClassification';
import { noteKindLabel } from '../knowledgeLabels';

export interface NoteClassificationSelectorProps {
  colors: NoteChromeColors;
  value: NoteKind | null;
  onChange: (kind: NoteKind | null) => void;
  disabled?: boolean;
}

export function NoteClassificationSelector({
  colors: c,
  value,
  onChange,
  disabled,
}: NoteClassificationSelectorProps) {
  const { t, lang } = useTranslation();

  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={e => {
        const v = e.target.value;
        onChange(v && NOTE_KINDS.includes(v as NoteKind) ? v as NoteKind : null);
      }}
      title={t('knNoteClassification')}
      style={{
        background: c.input,
        border: `1px solid ${c.inputBdr}`,
        color: value ? c.accent : c.textMuted,
        borderRadius: 5,
        padding: '3px 6px',
        fontSize: 10,
        outline: 'none',
        cursor: disabled ? 'default' : 'pointer',
        maxWidth: 120,
      }}
    >
      <option value="">{t('knNoClassification')}</option>
      {NOTE_KINDS.map(kind => (
        <option key={kind} value={kind}>{noteKindLabel(kind, lang)}</option>
      ))}
    </select>
  );
}

export interface LiteratureWorkflowIndicatorProps {
  colors: NoteChromeColors;
  kind: NoteKind | null;
  onPromote?: () => void;
}

const WORKFLOW_KINDS: NoteKind[] = ['source', 'literature', 'permanent'];

/** Visual knowledge progression with optional one-click promote. */
export function LiteratureWorkflowIndicator({ colors: c, kind, onPromote }: LiteratureWorkflowIndicatorProps) {
  const { t, lang } = useTranslation();
  const activeStep = noteKindWorkflowStep(kind);
  const nextKind = nextNoteKind(kind);
  const showPromote = onPromote && canPromoteKind(kind);

  return (
    <div
      className="be-literature-workflow"
      aria-label={t('knKnowledgeProgress')}
      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, color: c.textMuted, flexWrap: 'wrap' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {WORKFLOW_KINDS.map((stepKind, idx) => {
          const isActive = activeStep === idx;
          const isPast = activeStep > idx;
          return (
            <span key={stepKind} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {idx > 0 && (
                <span style={{ color: c.textFaint, fontSize: 8 }}>↓</span>
              )}
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? c.accent : isPast ? c.text : c.textFaint,
                  background: isActive ? c.accentBg : 'transparent',
                  border: `1px solid ${isActive ? c.accent : c.sideBdr}`,
                }}
              >
                {noteKindLabel(stepKind, lang)}
              </span>
            </span>
          );
        })}
      </div>
      {showPromote && nextKind && (
        <button
          type="button"
          className="btbtn"
          onClick={onPromote}
          style={{
            fontSize: 9,
            padding: '3px 8px',
            color: c.accent,
            border: `1px solid ${c.accent}`,
            borderRadius: 5,
            background: c.accentBg,
          }}
        >
          → {t('knPromoteTo').replace('{kind}', noteKindLabel(nextKind, lang))}
        </button>
      )}
    </div>
  );
}
