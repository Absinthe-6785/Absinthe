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
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 10,
        padding: '0 8px',
        height: 24,
        lineHeight: 1,
        borderRadius: 999,
        border: `1px solid ${active ? c.danger : c.sideBdr}`,
        background: active ? `${c.danger}22` : c.cardHov,
        color: active ? c.danger : c.textMuted,
        cursor: disabled ? 'default' : 'pointer',
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}
    >
      {active ? t('knWeakTopicActive') : t('knWeakTopicInactive')}
    </button>
  );
}
