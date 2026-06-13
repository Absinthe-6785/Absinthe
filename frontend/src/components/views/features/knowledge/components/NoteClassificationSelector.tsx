import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteKind } from '../research/noteClassification';
import {
  NOTE_KINDS,
  NOTE_KIND_LABELS_KO,
  canPromoteNoteKind,
  canPromoteKind,
  noteKindWorkflowStep,
  promoteNoteKindLabel,
} from '../research/noteClassification';

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
  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={e => {
        const v = e.target.value;
        onChange(v && NOTE_KINDS.includes(v as NoteKind) ? v as NoteKind : null);
      }}
      title="노트 분류"
      style={{
        background: c.input,
        border: `1px solid ${c.inputBdr}`,
        color: value ? c.accent : c.textMuted,
        borderRadius: 5,
        padding: '3px 6px',
        fontSize: 10,
        outline: 'none',
        cursor: disabled ? 'default' : 'pointer',
        maxWidth: 88,
      }}
    >
      <option value="">분류 없음</option>
      {NOTE_KINDS.map(kind => (
        <option key={kind} value={kind}>{NOTE_KIND_LABELS_KO[kind]}</option>
      ))}
    </select>
  );
}

export interface LiteratureWorkflowIndicatorProps {
  colors: NoteChromeColors;
  kind: NoteKind | null;
  onPromote?: () => void;
}

const STEPS: { kind: NoteKind; label: string }[] = [
  { kind: 'source', label: 'Source' },
  { kind: 'literature', label: 'Literature' },
  { kind: 'permanent', label: 'Permanent' },
];

/** Visual knowledge progression with optional one-click promote. */
export function LiteratureWorkflowIndicator({ colors: c, kind, onPromote }: LiteratureWorkflowIndicatorProps) {
  const activeStep = noteKindWorkflowStep(kind);
  const promoteLabel = promoteNoteKindLabel(kind);
  const showPromote = onPromote && canPromoteKind(kind);

  return (
    <div
      className="be-literature-workflow"
      aria-label="지식 진행 단계"
      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, color: c.textMuted, flexWrap: 'wrap' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {STEPS.map((step, idx) => {
          const isActive = activeStep === idx;
          const isPast = activeStep > idx;
          return (
            <span key={step.kind} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                {step.label}
              </span>
            </span>
          );
        })}
      </div>
      {showPromote && promoteLabel && (
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
          → {promoteLabel} 승격
        </button>
      )}
    </div>
  );
}
