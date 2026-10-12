import { useTranslation } from '../../../../lib/i18n';
import type { PreviousState } from './legacyPreviousCurrentness';

/** Source-state surface only. Public copy/gesture acceptance is still pending. */
export function LegacyPreviousStatus({ state }: { state: PreviousState }) {
  const { t } = useTranslation();
  if (state === 'CURRENT') return null;
  const key = state === 'REFRESHING' ? 'healthPreviousRefreshing'
    : state === 'UNAVAILABLE' ? 'healthPreviousUnavailable'
      : state === 'NO_MATCH' ? 'healthPreviousNoMatch' : 'healthPreviousSuppressed';
  return <span role="status" data-health-previous-state={state} className="text-[11px] text-muted-foreground">{t(key)}</span>;
}
