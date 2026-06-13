import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export interface WeakTopicToggleProps {
  colors: NoteChromeColors;
  active: boolean;
  onChange: (weak: boolean) => void;
  disabled?: boolean;
}

/** Manual weak-topic flag — property + tag, no automation. */
export function WeakTopicToggle({ colors: c, active, onChange, disabled }: WeakTopicToggleProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!active)}
      title={t('knWeakTopicToggleTitle')}
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
      {active ? t('knWeakTopicActive') : t('knWeakTopicInactive')}
    </button>
  );
}
