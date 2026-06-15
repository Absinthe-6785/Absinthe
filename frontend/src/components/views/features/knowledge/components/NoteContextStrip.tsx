import { AlertTriangle, GitFork, Link2, MapPin, Route, Star } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import type { GraphNodeTier } from '../graph/knowledgeUniverse/graphNodeTier';
import type { ReviewQueueReason } from '../review/reviewQueue';

export interface NoteContextStripProps {
  colors: NoteChromeColors;
  note: NoteBase;
  isArea: boolean;
  areaTitle?: string;
  projectTitle?: string;
  projectId?: string | null;
  learningPathLabel?: string | null;
  reviewReason?: ReviewQueueReason | null;
  connectionCount: number;
  tier: GraphNodeTier;
  /** K-82: weak-topic status visible in compact chrome via context strip */
  isWeakTopic?: boolean;
  onNavigateToNote?: (noteId: string) => void;
  onOpenLinks: () => void;
  onOpenCosmos: () => void;
}

const TIER_SHORT_KEYS = {
  star: 'k35ContextTierStarShort',
  planet: 'k35ContextTierPlanetShort',
  moon: 'k35ContextTierMoonShort',
} as const;

const TIER_FULL_KEYS = {
  star: 'k35ContextTierStar',
  planet: 'k35ContextTierPlanet',
  moon: 'k35ContextTierMoon',
} as const;

const REVIEW_KEYS: Record<ReviewQueueReason, 'knReviewReasonStale' | 'knReviewReasonLinked' | 'knReviewReasonRecent' | 'knReviewReasonMilestone'> = {
  stale: 'knReviewReasonStale',
  linked: 'knReviewReasonLinked',
  recent: 'knReviewReasonRecent',
  milestone: 'knReviewReasonMilestone',
};

function ContextChip({
  c,
  label,
  accent = false,
  icon,
  onClick,
  title,
}: {
  c: NoteChromeColors;
  label: string;
  accent?: boolean;
  icon?: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  const interactive = Boolean(onClick);
  const base = {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 4,
    fontSize: 10,
    lineHeight: 1,
    height: 24,
    padding: '0 8px',
    borderRadius: 999,
    border: `1px solid ${accent ? c.accent : c.sideBdr}`,
    background: accent ? c.accentBg : c.cardHov,
    color: accent ? c.accent : c.textMuted,
    maxWidth: '100%',
    minWidth: 0,
    cursor: interactive ? 'pointer' : 'default',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden' as const,
    textOverflow: 'ellipsis' as const,
    boxSizing: 'border-box' as const,
    flexShrink: 0,
  };

  if (interactive) {
    return (
      <button
        type="button"
        className="be-context-chip-btn"
        title={title ?? label}
        onClick={onClick}
        style={base}
      >
        {icon}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      </button>
    );
  }

  return (
    <span title={title ?? label} style={base}>
      {icon}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
    </span>
  );
}

/** Inline note context — where this note belongs in the knowledge workspace. */
export function NoteContextStrip({
  colors: c,
  isArea,
  areaTitle,
  projectTitle,
  projectId,
  learningPathLabel,
  reviewReason,
  connectionCount,
  tier,
  isWeakTopic = false,
  onNavigateToNote,
  onOpenLinks,
  onOpenCosmos,
}: NoteContextStripProps) {
  const { t } = useTranslation();

  const chips: ReactNode[] = [];

  if (isArea) {
    chips.push(
      <ContextChip
        key="area"
        c={c}
        accent
        icon={<MapPin size={10} style={{ flexShrink: 0 }}/>}
        label={t('k35ContextAreaHub')}
        title={t('k35ContextAreaHubHint')}
      />,
    );
  } else if (areaTitle) {
    chips.push(
      <ContextChip
        key="area-link"
        c={c}
        icon={<MapPin size={10} style={{ flexShrink: 0 }}/>}
        label={areaTitle}
        title={t('k35ContextArea')}
      />,
    );
  }

  if (projectTitle) {
    chips.push(
      <ContextChip
        key="project"
        c={c}
        icon={<Star size={10} style={{ flexShrink: 0 }}/>}
        label={projectTitle}
        title={t('k35ContextProject')}
        onClick={projectId && onNavigateToNote ? () => onNavigateToNote(projectId) : undefined}
      />,
    );
  }

  if (learningPathLabel) {
    chips.push(
      <ContextChip
        key="path"
        c={c}
        icon={<Route size={10} style={{ flexShrink: 0 }}/>}
        label={learningPathLabel}
        title={t('k35ContextPath')}
        onClick={onOpenLinks}
      />,
    );
  }

  if (isWeakTopic) {
    chips.push(
      <ContextChip
        key="weak-topic"
        c={c}
        accent
        icon={<AlertTriangle size={10} style={{ flexShrink: 0, color: c.danger }}/>}
        label={t('knWeakTopicActive')}
        title={t('knWeakTopicToggleTitle')}
      />,
    );
  }

  if (reviewReason) {
    chips.push(
      <ContextChip
        key="review"
        c={c}
        accent
        label={t('k35ContextReview')}
        title={t(REVIEW_KEYS[reviewReason])}
      />,
    );
  }

  chips.push(
    <ContextChip
      key="tier"
      c={c}
      label={t(TIER_SHORT_KEYS[tier])}
      title={`${t(TIER_FULL_KEYS[tier])} — ${t('k35ContextTierHint')}`}
      onClick={onOpenCosmos}
    />,
  );

  if (connectionCount > 0) {
    chips.push(
      <ContextChip
        key="connections"
        c={c}
        icon={<Link2 size={10} style={{ flexShrink: 0 }}/>}
        label={t('k35ContextConnections').replace('{count}', String(connectionCount))}
        title={t('k35ContextConnectionsHint')}
        onClick={onOpenLinks}
      />,
    );
  }

  chips.push(
    <ContextChip
      key="cosmos"
      c={c}
      icon={<GitFork size={10} style={{ flexShrink: 0 }}/>}
      label={t('k35CosmosOpenLocal')}
      title={t('nvGraphMode')}
      onClick={onOpenCosmos}
    />,
  );

  if (chips.length === 0) return null;

  return (
    <div
      className="be-note-context-strip"
      style={{
        padding: '5px 13px',
        borderBottom: `1px solid ${c.sideBdr}`,
        background: c.editor,
        flexShrink: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 5,
        minWidth: 0,
      }}
    >
      {chips}
    </div>
  );
}
