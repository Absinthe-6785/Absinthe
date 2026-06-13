import type { NoteChromeColors } from '../../../noteEditorTheme';

export interface WeakTopicToggleProps {
  colors: NoteChromeColors;
  active: boolean;
  onChange: (weak: boolean) => void;
  disabled?: boolean;
}

/** Manual weak-topic flag — property + tag, no automation. */
export function WeakTopicToggle({ colors: c, active, onChange, disabled }: WeakTopicToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!active)}
      title="약점 주제 표시"
      className="btbtn"
      style={{
        fontSize: 10,
        padding: '3px 8px',
        borderRadius: 5,
        border: `1px solid ${active ? c.danger : c.inputBdr}`,
        background: active ? `${c.danger}22` : c.input,
        color: active ? c.danger : c.textMuted,
        cursor: disabled ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {active ? '약점 ✓' : '약점'}
    </button>
  );
}
