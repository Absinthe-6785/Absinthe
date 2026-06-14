import type { ReactNode } from 'react';
import { Orbit } from 'lucide-react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { KnowledgePanelSection } from './KnowledgePanelSection';

export interface LinksContextPanelProps {
  colors: NoteChromeColors;
  structure: ReactNode;
  connections: ReactNode;
  sources: ReactNode;
  structureCount?: number;
  connectionsCount?: number;
  sourcesCount?: number;
}

/** Groups link sub-panels into a unified Knowledge Context links experience. */
export function LinksContextPanel({
  colors: c,
  structure,
  connections,
  sources,
  structureCount = 0,
  connectionsCount = 0,
  sourcesCount = 0,
}: LinksContextPanelProps) {
  const { t } = useTranslation();

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <KnowledgePanelSection colors={c} first title={t('k35LinksGroupStructure')} count={structureCount}>
        {structure}
      </KnowledgePanelSection>
      <KnowledgePanelSection colors={c} title={t('k35LinksGroupConnections')} count={connectionsCount}>
        {connections}
      </KnowledgePanelSection>
      <KnowledgePanelSection colors={c} title={t('k35LinksGroupSources')} count={sourcesCount}>
        {sources}
      </KnowledgePanelSection>
    </div>
  );
}

export interface CosmosContextFooterProps {
  colors: NoteChromeColors;
  onOpenFullCosmos: () => void;
}

/** Contextual Cosmos entry — connects local neighborhood graph to full view. */
export function CosmosContextFooter({ colors: c, onOpenFullCosmos }: CosmosContextFooterProps) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        flexShrink: 0,
        padding: '8px 10px',
        borderTop: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
      }}
    >
      <p style={{ fontSize: 10, color: c.textFaint, margin: '0 0 6px', lineHeight: 1.45 }}>
        {t('k35CosmosPanelHint')}
      </p>
      <button
        type="button"
        onClick={onOpenFullCosmos}
        className="btbtn"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          padding: '6px 8px',
          borderRadius: 6,
          border: `1px solid ${c.sideBdr}`,
          background: c.accentBg,
          color: c.accent,
          fontSize: 10,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <Orbit size={12}/>
        {t('k35CosmosOpenFull')}
      </button>
    </div>
  );
}
