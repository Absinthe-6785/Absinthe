import { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import type { NoteChromeColors } from '../../../../noteEditorTheme';
import type { DiscoveryItem } from '../../discovery';
import { formatFirstDiscoveryMessage } from './cosmosVaultState';
import {
  markFirstDiscoveryCelebrated,
  shouldShowFirstDiscoveryBanner,
} from './cosmosOnboardingStorage';

export interface FirstDiscoveryBannerProps {
  colors: NoteChromeColors;
  topItem: DiscoveryItem | null;
}

/** Non-modal, dismissible celebration when the first discovery appears. */
export function FirstDiscoveryBanner({ colors: c, topItem }: FirstDiscoveryBannerProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (topItem && shouldShowFirstDiscoveryBanner()) {
      setVisible(true);
    }
  }, [topItem]);

  if (!visible || !topItem) return null;

  const detail = topItem.kind === 'missing-connection' && topItem.targetNoteTitle
    ? formatFirstDiscoveryMessage(topItem.title, topItem.targetNoteTitle)
    : topItem.title;

  return (
    <div
      role="status"
      style={{
        margin: '0 8px 8px',
        padding: '10px 10px',
        borderRadius: 8,
        border: `1px solid ${c.accent}`,
        background: c.accentBg,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: c.accent, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {t('k41FirstDiscoveryTitle')}
        </div>
        <div style={{ fontSize: 11, color: c.text, marginTop: 4, lineHeight: 1.45 }}>
          {t('k41FirstDiscoveryBody').replace('{detail}', detail)}
        </div>
      </div>
      <button
        type="button"
        aria-label={t('k41Dismiss')}
        onClick={() => {
          markFirstDiscoveryCelebrated();
          setVisible(false);
        }}
        style={{
          border: 'none',
          background: 'transparent',
          color: c.textMuted,
          cursor: 'pointer',
          fontSize: 14,
          lineHeight: 1,
          padding: 2,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
