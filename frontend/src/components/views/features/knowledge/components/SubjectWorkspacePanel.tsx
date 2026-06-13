import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { SubjectWorkspaceData } from '../maps/buildSubjectWorkspace';
import type { SubjectDashboardEntry } from '../maps/subjectDashboards';
import { useViewportLayout } from '../../../../../hooks/useViewportLayout';
import { responsiveStatGridColumns, touchMinSize } from '../../../../../lib/responsiveLayout';

export interface SubjectWorkspacePanelProps {
  colors: NoteChromeColors;
  data: SubjectWorkspaceData;
  onNavigateToNote: (noteId: string) => void;
  onOpenWorkspace?: () => void;
  onEditProject?: (projectId: string) => void;
}

type EntrySectionId = 'projects' | 'weakTopics' | 'studyNotes' | 'concepts' | 'recentActivity';

const ENTRY_SECTION_TITLE_KEYS: Record<EntrySectionId, 'createMilestoneProject' | 'studyWeakTopics' | 'knStudyNotes' | 'knConceptShort' | 'knRecentActivity'> = {
  projects: 'createMilestoneProject',
  weakTopics: 'studyWeakTopics',
  studyNotes: 'knStudyNotes',
  concepts: 'knConceptShort',
  recentActivity: 'knRecentActivity',
};

function EntryList({
  c,
  sectionId,
  items,
  onNavigate,
  onEditProject,
  touch,
}: {
  c: NoteChromeColors;
  sectionId: EntrySectionId;
  items: readonly SubjectDashboardEntry[];
  onNavigate: (noteId: string) => void;
  onEditProject?: (projectId: string) => void;
  touch?: number;
}) {
  const { t } = useTranslation();
  const title = t(ENTRY_SECTION_TITLE_KEYS[sectionId]);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>
        {title}
        {items.length > 0 && <span style={{ color: c.accent, marginLeft: 4 }}>({items.length})</span>}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: c.textFaint }}>{t('knNone')}</div>
      ) : (
        items.map(item => (
          <div key={`${sectionId}-${item.noteId}`} style={{ display: 'flex', gap: 4, marginBottom: 3 }}>
            <button
              type="button"
              onClick={() => onNavigate(item.noteId)}
              style={{
                flex: 1,
                textAlign: 'left',
                background: c.cardHov,
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 6,
                padding: '5px 8px',
                cursor: 'pointer',
                color: c.text,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.noteTitle}
              </div>
              <div style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>{item.meta}</div>
            </button>
            {onEditProject && sectionId === 'projects' && (
              <button
                type="button"
                onClick={() => onEditProject(item.noteId)}
                title={t('knEditProject')}
                style={{
                  flexShrink: 0,
                  padding: '5px 10px',
                  fontSize: 9,
                  borderRadius: 6,
                  border: `1px solid ${c.sideBdr}`,
                  background: c.card,
                  color: c.accent,
                  cursor: 'pointer',
                  minHeight: touch ?? undefined,
                }}
              >
                {t('edit')}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/** Per-subject coherent workspace — reuses existing tag-based data. */
export function SubjectWorkspacePanel({
  colors: c,
  data,
  onNavigateToNote,
  onOpenWorkspace,
  onEditProject,
}: SubjectWorkspacePanelProps) {
  const { t } = useTranslation();
  const { isMobile, isTablet } = useViewportLayout();
  const touch = touchMinSize(isMobile, isTablet);
  return (
    <div className="be-subject-workspace" aria-label={t('knSubjectWorkspaceAria').replace('{name}', data.subject.name)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text }}>{data.subject.name}</div>
          <div style={{ fontSize: 9, color: c.textFaint, marginTop: 2 }}>{data.subject.description}</div>
        </div>
        {onOpenWorkspace && (
          <button
            type="button"
            onClick={onOpenWorkspace}
            style={{
              fontSize: 9,
              padding: '3px 8px',
              borderRadius: 5,
              border: `1px solid ${c.sideBdr}`,
              background: c.cardHov,
              color: c.accent,
              cursor: 'pointer',
              flexShrink: 0,
              minHeight: touch,
            }}
          >
            {t('knOpenWorkspace')}
          </button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: responsiveStatGridColumns(isMobile, isTablet, 4), gap: 4, marginBottom: 10 }}>
        {[
          { label: t('note'), count: data.noteCount },
          { label: t('knConceptShort'), count: data.conceptCount },
          { label: t('createMilestoneProject'), count: data.linkedProjectCount },
          { label: t('knWeakShort'), count: data.weakTopics.length },
        ].map(row => (
          <div
            key={row.label}
            style={{
              background: c.cardHov,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: '6px 4px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: c.accent }}>{row.count}</div>
            <div style={{ fontSize: 9, color: c.textMuted }}>{row.label}</div>
          </div>
        ))}
      </div>
      <EntryList c={c} sectionId="projects" items={data.linkedProjects} onNavigate={onNavigateToNote} onEditProject={onEditProject} touch={touch} />
      <EntryList c={c} sectionId="weakTopics" items={data.weakTopics} onNavigate={onNavigateToNote} touch={touch} />
      <EntryList c={c} sectionId="studyNotes" items={data.studyNotes} onNavigate={onNavigateToNote} touch={touch} />
      <EntryList c={c} sectionId="concepts" items={data.conceptNotes} onNavigate={onNavigateToNote} touch={touch} />
      <EntryList c={c} sectionId="recentActivity" items={data.activity} onNavigate={onNavigateToNote} touch={touch} />
    </div>
  );
}
