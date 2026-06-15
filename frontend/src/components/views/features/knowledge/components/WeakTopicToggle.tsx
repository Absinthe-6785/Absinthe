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
          padding: '2px 6px',
          height: 22,
          lineHeight: 1.2,
          borderRadius: 4,
          border: 'none',
          background: active ? `${c.danger}22` : 'transparent',
          color: active ? c.danger : c.textMuted,
          cursor: disabled ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
        }}
      >
      {active ? t('knWeakTopicActive') : t('knWeakTopicInactive')}
    </button>
  );
}
