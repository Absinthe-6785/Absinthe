import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { ProjectHealthData, ProjectHealthEntry } from '../analytics/buildProjectHealth';

export interface ProjectHealthPanelProps {
  colors: NoteChromeColors;
  data: ProjectHealthData;
  onNavigateToNote: (noteId: string) => void;
}

const INDICATOR_KEYS: Record<ProjectHealthEntry['indicator'], 'knProjectIndicatorActive' | 'knProjectIndicatorStalled' | 'knProjectIndicatorOnTrack'> = {
  active: 'knProjectIndicatorActive',
  stalled: 'knProjectIndicatorStalled',
  'on-track': 'knProjectIndicatorOnTrack',
};

function ProjectRow({
  c,
  entry,
  onNavigate,
}: {
  c: NoteChromeColors;
  entry: ProjectHealthEntry;
  onNavigate: (id: string) => void;
}) {
  const { t } = useTranslation();
  const indicatorColor = entry.indicator === 'stalled' ? c.accent : c.textMuted;
  return (
    <button
      type="button"
      onClick={() => onNavigate(entry.noteId)}
      style={{
        width: '100%',
        textAlign: 'left',
        background: c.cardHov,
        border: `1px solid ${c.sideBdr}`,
        borderRadius: 6,
        padding: '5px 8px',
        marginBottom: 3,
        cursor: 'pointer',
        color: c.text,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600 }}>{entry.title}</div>
      <div style={{ fontSize: 9, color: indicatorColor, marginTop: 1 }}>
        {t(INDICATOR_KEYS[entry.indicator])} · {entry.milestoneLabel} · {t('knDaysAgo').replace('{days}', String(entry.daysSinceActivity))}
      </div>
    </button>
  );
}

/** Project health indicators — no health score. */
export function ProjectHealthPanel({ colors: c, data, onNavigateToNote }: ProjectHealthPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="be-project-health" aria-label={t('knProjectHealthAria')}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>{t('knInProgress')}</div>
      {data.activeProjects.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint, marginBottom: 8 }}>{t('knNone')}</div>
      ) : (
        data.activeProjects.map(p => (
          <ProjectRow key={p.noteId} c={c} entry={p} onNavigate={onNavigateToNote} />
        ))
      )}
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4, marginTop: 6 }}>{t('knStalledProjects')}</div>
      {data.stalledProjects.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>{t('knNone')}</div>
      ) : (
        data.stalledProjects.map(p => (
          <ProjectRow key={`stalled-${p.noteId}`} c={c} entry={p} onNavigate={onNavigateToNote} />
        ))
      )}
    </div>
  );
}
