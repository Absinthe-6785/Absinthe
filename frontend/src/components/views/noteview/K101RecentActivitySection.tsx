import { ChevronDown } from 'lucide-react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase } from '../noteUtils';
import { useTranslation } from '../../../lib/i18n';
import { displayNoteTitle } from '../noteDisplayTitle';
import type { ListDensityMode } from '../listDensityPreference';
import { listDensityStyles } from '../listDensityPreference';
import {
  buildActivityToday,
  buildActivityYesterday,
  buildActivityThisWeek,
  buildLastOpenedActivity,
  buildRecentEditedActivity,
  type ActivityNoteEntry,
} from '../k101RecentActivity';

export interface K101RecentActivitySectionProps {
  colors: NoteChromeColors;
  notes: readonly NoteBase[];
  todayKey: string;
  activeNoteId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  listDensity: ListDensityMode;
  onSelectNote: (id: string) => void;
}

function formatActivityTime(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ActivityGroup({
  label,
  entries,
  colors: c,
  activeNoteId,
  densityStyle,
  onSelectNote,
  dataHook,
}: {
  label: string;
  entries: readonly ActivityNoteEntry[];
  colors: NoteChromeColors;
  activeNoteId: string | null;
  densityStyle: ReturnType<typeof listDensityStyles>;
  onSelectNote: (id: string) => void;
  dataHook: string;
}) {
  if (entries.length === 0) return null;
  return (
    <div data-k101-activity-group={dataHook}>
      <div className="bseclbl" style={{ fontSize: 9, paddingTop: 2 }}>{label}</div>
      {entries.map(entry => (
        <div
          key={entry.id}
          className={`bfi k101-interactive ${activeNoteId === entry.id ? 'active k101-selected' : ''}`}
          onClick={() => onSelectNote(entry.id)}
          style={{ minHeight: densityStyle.traceRowMinHeight, padding: densityStyle.traceRowPadding, fontSize: 11 }}
          data-k101-activity-item={entry.id}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayNoteTitle(entry.title)}
          </span>
          <span style={{ fontSize: 9, color: c.textFaint, flexShrink: 0, marginLeft: 4 }}>
            {formatActivityTime(entry.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function K101RecentActivitySection({
  colors: c,
  notes,
  todayKey,
  activeNoteId,
  collapsed,
  onToggleCollapse,
  listDensity,
  onSelectNote,
}: K101RecentActivitySectionProps) {
  const { t } = useTranslation();
  const densityStyle = listDensityStyles(listDensity);

  const today = buildActivityToday(notes, todayKey);
  const yesterday = buildActivityYesterday(notes, todayKey);
  const week = buildActivityThisWeek(notes, todayKey);
  const lastOpened = buildLastOpenedActivity(notes);
  const recentEdited = buildRecentEditedActivity(notes);

  const hasAny = today.length + yesterday.length + week.length + lastOpened.length + recentEdited.length > 0;

  if (!hasAny) return null;

  return (
    <div data-k101-recent-activity style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
      <div
        className="bseclbl k101-interactive"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={onToggleCollapse}
        role="button"
        tabIndex={0}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleCollapse();
          }
        }}
        data-k101-activity-toggle
      >
        <span>{t('k101RecentActivity')}</span>
        <ChevronDown
          size={10}
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform .15s',
          }}
        />
      </div>
      {!collapsed ? (
        <>
          <ActivityGroup
            label={t('nvToday')}
            entries={today}
            colors={c}
            activeNoteId={activeNoteId}
            densityStyle={densityStyle}
            onSelectNote={onSelectNote}
            dataHook="today"
          />
          <ActivityGroup
            label={t('nvYesterday')}
            entries={yesterday}
            colors={c}
            activeNoteId={activeNoteId}
            densityStyle={densityStyle}
            onSelectNote={onSelectNote}
            dataHook="yesterday"
          />
          <ActivityGroup
            label={t('nvThisWeek')}
            entries={week}
            colors={c}
            activeNoteId={activeNoteId}
            densityStyle={densityStyle}
            onSelectNote={onSelectNote}
            dataHook="week"
          />
          <ActivityGroup
            label={t('k101LastOpened')}
            entries={lastOpened}
            colors={c}
            activeNoteId={activeNoteId}
            densityStyle={densityStyle}
            onSelectNote={onSelectNote}
            dataHook="last-opened"
          />
          <ActivityGroup
            label={t('k101RecentEdited')}
            entries={recentEdited}
            colors={c}
            activeNoteId={activeNoteId}
            densityStyle={densityStyle}
            onSelectNote={onSelectNote}
            dataHook="recent-edited"
          />
        </>
      ) : (
        <div
          className="bfi"
          style={{ minHeight: densityStyle.traceRowMinHeight, padding: densityStyle.traceRowPadding, color: c.textMuted, fontSize: 10 }}
          data-k101-activity-collapsed-summary
        >
          {lastOpened.length > 0
            ? displayNoteTitle(lastOpened[0]!.title)
            : t('k101RecentActivity')}
        </div>
      )}
    </div>
  );
}
