import type { ReactNode } from 'react';
import { useTranslation, type TranslationKey } from '../../../../../../lib/i18n';

export type CosmosGlossaryTerm =
  | 'cosmos'
  | 'galaxy'
  | 'hub'
  | 'discovery'
  | 'area'
  | 'connection';

const TERM_LABEL_KEYS: Record<CosmosGlossaryTerm, TranslationKey> = {
  cosmos: 'k41TermCosmos',
  galaxy: 'k41TermGalaxy',
  hub: 'k41TermHub',
  discovery: 'k41TermDiscovery',
  area: 'k41TermArea',
  connection: 'k41TermConnection',
};

const TERM_TIP_KEYS: Record<CosmosGlossaryTerm, TranslationKey> = {
  cosmos: 'k41TermCosmosTip',
  galaxy: 'k41TermGalaxyTip',
  hub: 'k41TermHubTip',
  discovery: 'k41TermDiscoveryTip',
  area: 'k41TermAreaTip',
  connection: 'k41TermConnectionTip',
};

export interface CosmosTermTooltipProps {
  term: CosmosGlossaryTerm;
  children?: ReactNode;
}

/** Lightweight in-product glossary — native tooltip, no separate page. */
export function CosmosTermTooltip({ term, children }: CosmosTermTooltipProps) {
  const { t } = useTranslation();
  return (
    <abbr
      title={t(TERM_TIP_KEYS[term])}
      style={{
        textDecoration: 'underline dotted',
        textUnderlineOffset: 2,
        cursor: 'help',
        fontStyle: 'normal',
      }}
    >
      {children ?? t(TERM_LABEL_KEYS[term])}
    </abbr>
  );
}
