import { ChevronDown } from 'lucide-react';
import { useMemo } from 'react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase } from '../noteUtils';
import { useTranslation } from '../../../lib/i18n';
import { displayNoteTitle } from '../noteDisplayTitle';
import type { ListDensityMode } from '../listDensityPreference';
import { listDensityStyles } from '../listDensityPreference';
import { formatActivityTimestamp } from '../k102DateFormat';
import { buildRelativeDateLabels } from '../k102RelativeDateLabels';
import {
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

function ActivityGroup({
  label,
  entries,
  colors: c,
  activeNoteId,
  densityStyle,
  onSelectNote,
  dataHook,
  todayKey,
  relativeLabels,
  lang,
}: {
  label: string;
  entries: readonly ActivityNoteEntry[];
  colors: NoteChromeColors;
  activeNoteId: string | null;
  densityStyle: ReturnType<typeof listDensityStyles>;
  onSelectNote: (id: string) => void;
  dataHook: string;
  todayKey: string;
  relativeLabels: ReturnType<typeof buildRelativeDateLabels>;
  lang: import('../../../lib/i18n').Language;
}) {
  if (entries.length === 0) return null;
  const rowPad = densityStyle.traceRowPadding;
  const rowMin = Math.max(densityStyle.traceRowMinHeight - 4, 22);
  return (
    <div data-k102-activity-group={dataHook} data-k101-activity-group={dataHook}>
      <div className="bseclbl" style={{ fontSize: 9, paddingTop: 1, paddingBottom: 1 }}>{label}</div>
      {entries.map(entry => (
        <div
          key={entry.id}
          className={`bfi k101-interactive ${activeNoteId === entry.id ? 'active k101-selected' : ''}`}
          onClick={() => onSelectNote(entry.id)}
          style={{ minHeight: rowMin, padding: rowPad, fontSize: 10 }}
          data-k102-activity-item={entry.id}
          data-k101-activity-item={entry.id}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayNoteTitle(entry.title)}
          </span>
          <span
            style={{ fontSize: 9, color: c.textFaint, flexShrink: 0, marginLeft: 4 }}
            data-k102-activity-date
          >
            {formatActivityTimestamp(entry.timestamp, todayKey, lang, relativeLabels)}
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
  const { t, lang } = useTranslation();
  const densityStyle = listDensityStyles(listDensity);
  const relativeLabels = useMemo(() => buildRelativeDateLabels(t), [t]);

  const lastOpened = buildLastOpenedActivity(notes, 3);
  const recentEdited = buildRecentEditedActivity(notes, 3);

  const hasAny = lastOpened.length + recentEdited.length > 0;

  if (!hasAny) return null;

  return (
    <div data-k101-recent-activity style={{ borderTop: `1px solid ${c.sideBdr}`, marginTop: 4 }}>
      <div
        className="bseclbl k101-interactive k103-sidebar-sticky"
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
            label={t('k101LastOpened')}
            entries={lastOpened}
            colors={c}
            activeNoteId={activeNoteId}
            densityStyle={densityStyle}
            onSelectNote={onSelectNote}
            dataHook="last-opened"
            todayKey={todayKey}
            relativeLabels={relativeLabels}
            lang={lang}
          />
          <ActivityGroup
            label={t('k101RecentEdited')}
            entries={recentEdited}
            colors={c}
            activeNoteId={activeNoteId}
            densityStyle={densityStyle}
            onSelectNote={onSelectNote}
            dataHook="recent-edited"
            todayKey={todayKey}
            relativeLabels={relativeLabels}
            lang={lang}
          />
        </>
      ) : (
        <div
          className="bfi"
          style={{ minHeight: Math.max(densityStyle.traceRowMinHeight - 4, 22), padding: densityStyle.traceRowPadding, color: c.textMuted, fontSize: 10 }}
          data-k101-activity-collapsed-summary
          data-k102-activity-collapsed-summary
        >
          {lastOpened.length > 0
            ? `${displayNoteTitle(lastOpened[0]!.title)} · ${formatActivityTimestamp(lastOpened[0]!.timestamp, todayKey, lang, relativeLabels)}`
            : t('k101RecentActivity')}
        </div>
      )}
    </div>
  );
}
