import { useState } from 'react';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import { useViewportLayout } from '../../../../../hooks/useViewportLayout';
import { dashboardOuterPadding } from '../../../../../lib/responsiveLayout';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { RecentWorkEntry } from '../workspace/workspacePreferences';
import type { FocusPreset } from '../workspace/focusModeModels';
import {
  DEFAULT_QUICK_CAPTURE_MODEL,
  type QuickCaptureType,
} from '../workspace/quickCaptureModels';
import { DEFAULT_TASK_TEMPLATE_ID } from '../workspace/taskTemplateModels';
import type { TaskTemplateDefinition } from '../workspace/taskTemplateModels';
import type { JournalTemplateDefinition } from '../workspace/journalTemplateModels';
import {
  DEFAULT_RECENT_NOTES_LIMIT,
  formatRecentTimestamp,
  workspaceKindLabel,
  type WorkspaceDashboardModel,
} from '../workspace/workspaceDashboardModels';
import type { WorkspaceRef } from '../workspace/workspaceModels';
import type { KnowledgeReviewLists } from '../review/buildKnowledgeReview';
import { KnowledgeReviewPanel } from './KnowledgeReviewPanel';
import type { KnowledgeMaintenanceData } from './KnowledgeMaintenancePanel';
import { KnowledgeMaintenancePanel } from './KnowledgeMaintenancePanel';
import type { ResearchDashboardData } from '../research/buildResearchDashboard';
import { ResearchDashboardPanel } from './ResearchDashboardPanel';
import type { StudyDashboardData } from '../study/buildStudyDashboard';
import { StudyDashboardPanel } from './StudyDashboardPanel';
import type { SubjectDashboardData } from '../maps/subjectDashboards';
import type { KnowledgeClusterData } from '../maps/buildKnowledgeClusters';
import { SubjectMapsDashboardPanel } from './SubjectMapsDashboardPanel';
import { KnowledgeClusterPanel } from './KnowledgeClusterPanel';
import type { ProjectDashboardData } from '../academic/buildProjectDashboard';
import { ProjectDashboardPanel } from './ProjectDashboardPanel';
import type { AcademicDashboardData } from '../academic/buildAcademicDashboard';
import { AcademicDashboardPanel } from './AcademicDashboardPanel';
import type { AcademicInsightsData } from '../analytics/buildAcademicInsights';
import { AcademicInsightsPanel } from './AcademicInsightsPanel';
import type { SmartCollectionId } from '../collections/smartCollectionModels';
import type { UnifiedWorkspaceDashboardData } from '../workspace/buildUnifiedWorkspaceDashboard';
import { UnifiedWorkspaceDashboard } from './UnifiedWorkspaceDashboard';
import type { ProjectQuickActionsProps } from './ProjectQuickActions';
import type { LearningPathOverviewData } from '../maps/buildLearningPathOverview';
import { LearningPathOverviewPanel } from './LearningPathOverviewPanel';
import { LearningPathEditorPanel } from './LearningPathEditorPanel';
import type { SubjectWorkspaceData } from '../maps/buildSubjectWorkspace';
import { SubjectWorkspacesPanel } from './SubjectWorkspacesPanel';

export interface WorkspaceDashboardReviewProps {
  lists: KnowledgeReviewLists;
  onSelectNote: (noteId: string) => void;
}

export interface WorkspaceDashboardMaintenanceProps {
  data: KnowledgeMaintenanceData;
  onSelectNote: (noteId: string) => void;
}

export interface WorkspaceDashboardResearchProps {
  data: ResearchDashboardData;
  onSelectNote: (noteId: string) => void;
}

export interface WorkspaceDashboardStudyProps {
  data: StudyDashboardData;
  onSelectNote: (noteId: string) => void;
}

export interface WorkspaceDashboardKnowledgeMapsProps {
  subjects: readonly SubjectDashboardData[];
  clusters: KnowledgeClusterData;
  onSelectNote: (noteId: string) => void;
  onActivateSubjectWorkspace?: (collectionId: SmartCollectionId) => void;
}

export interface WorkspaceDashboardProjectProps {
  data: ProjectDashboardData;
  onSelectNote: (noteId: string) => void;
}

export interface WorkspaceDashboardAcademicProps {
  data: AcademicDashboardData;
  onSelectNote: (noteId: string) => void;
}

export interface WorkspaceDashboardAcademicInsightsProps {
  data: AcademicInsightsData;
  onSelectNote: (noteId: string) => void;
}

export interface WorkspaceDashboardUnifiedProps {
  data: UnifiedWorkspaceDashboardData;
  onSelectNote: (noteId: string) => void;
  onActivateSubjectWorkspace?: (collectionId: SmartCollectionId) => void;
  onOpenStudyCollection?: () => void;
  onOpenResearchCollection?: () => void;
  projectQuickActions?: Omit<ProjectQuickActionsProps, 'colors'>;
  learningPathOverview?: Omit<React.ComponentProps<typeof LearningPathOverviewPanel>, 'colors'>;
  learningPathEditor?: Omit<React.ComponentProps<typeof LearningPathEditorPanel>, 'colors' | 'onNavigateToNote'>;
  compact?: boolean;
}

export interface WorkspaceDashboardLearningPathEditorProps {
  pathId: string | null;
  notes: readonly NoteBase[];
  activeNoteId?: string | null;
  onPathIdChange: (pathId: string | null) => void;
  onUpdateNoteProperties: (noteId: string, properties: Record<string, string>) => void;
  onCreateNote?: (title: string) => string;
}

export interface WorkspaceDashboardLearningPathProps {
  data: LearningPathOverviewData;
  onSelectNote: (noteId: string) => void;
  onCreatePath?: () => void;
  onOpenPathEditor?: (pathId: string) => void;
  editor?: WorkspaceDashboardLearningPathEditorProps;
}

export interface WorkspaceDashboardSubjectWorkspacesProps {
  subjects: readonly SubjectWorkspaceData[];
  onSelectNote: (noteId: string) => void;
  onActivateSubjectWorkspace?: (collectionId: SmartCollectionId) => void;
  onEditProject?: (projectId: string) => void;
}

export interface WorkspaceDashboardQuickActions {
  onNewNote: () => void;
  onNewDatabaseView: () => void;
  onOpenSearch: () => void;
  onOpenGraph: () => void;
}

export interface WorkspaceDashboardFocusProps {
  presets: readonly FocusPreset[];
  presetTargets: Readonly<Record<string, WorkspaceRef | null>>;
  activePresetId?: string;
  workspaceOptions: readonly WorkspaceRef[];
  onCreatePreset: (
    name: string,
    workspace: Pick<WorkspaceRef, 'kind' | 'id'>,
  ) => void;
  onDeletePreset: (id: string) => void;
  onActivatePreset: (id: string) => void;
  onExitPreset: () => void;
}

export interface WorkspaceDashboardQuickCaptureProps {
  taskTemplates: readonly TaskTemplateDefinition[];
  onCapture: (title: string, captureType: QuickCaptureType, taskTemplateId?: string) => void;
}

export interface WorkspaceDashboardProductivityProps {
  taskTemplates: readonly TaskTemplateDefinition[];
  journalTemplates: readonly JournalTemplateDefinition[];
  onCreateTask: (templateId: string, title?: string) => void;
  onCreateJournal: (templateId: string, title?: string) => void;
  onCreateReadingNote?: (title?: string) => void;
  onCreateStudyNote?: (title?: string) => void;
  onCreateTaskDatabase?: () => void;
  onCreateJournalDatabase?: () => void;
}

export interface WorkspaceDashboardViewProps {
  colors: NoteChromeColors;
  dashboard: WorkspaceDashboardModel;
  pinned: readonly WorkspaceRef[];
  recent: readonly RecentWorkEntry[];
  resumeWorkspace: WorkspaceRef | null;
  recentNotes: readonly NoteBase[];
  onActivateWorkspace: (ref: WorkspaceRef) => void;
  onResumeWorkspace: () => void;
  onSelectNote: (noteId: string) => void;
  quickActions: WorkspaceDashboardQuickActions;
  focus?: WorkspaceDashboardFocusProps;
  quickCapture?: WorkspaceDashboardQuickCaptureProps;
  productivity?: WorkspaceDashboardProductivityProps;
  review?: WorkspaceDashboardReviewProps;
  maintenance?: WorkspaceDashboardMaintenanceProps;
  /** @deprecated Use unified instead — kept for type compatibility */
  research?: WorkspaceDashboardResearchProps;
  /** @deprecated Use unified instead */
  study?: WorkspaceDashboardStudyProps;
  /** @deprecated Use unified instead */
  knowledgeMaps?: WorkspaceDashboardKnowledgeMapsProps;
  /** @deprecated Use unified instead */
  project?: WorkspaceDashboardProjectProps;
  /** @deprecated Use unified instead */
  academic?: WorkspaceDashboardAcademicProps;
  /** @deprecated Use unified instead */
  academicInsights?: WorkspaceDashboardAcademicInsightsProps;
  unified?: WorkspaceDashboardUnifiedProps;
  learningPath?: WorkspaceDashboardLearningPathProps;
  subjectWorkspaces?: WorkspaceDashboardSubjectWorkspacesProps;
  recentNotesLimit?: number;
}

function Card({
  colors: c,
  title,
  children,
}: {
  colors: NoteChromeColors;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{
      background: c.card,
      border: `1px solid ${c.sideBdr}`,
      borderRadius: 8,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <h3 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: c.textMuted, letterSpacing: 0.3 }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

function WorkspaceRow({
  colors: c,
  workspaceRef,
  meta,
  onClick,
}: {
  colors: NoteChromeColors;
  workspaceRef: WorkspaceRef;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: c.cardHov,
        border: `1px solid ${c.sideBdr}`,
        borderRadius: 6,
        padding: '8px 10px',
        cursor: 'pointer',
        color: c.text,
      }}
      title={workspaceRef.subtitle ?? workspaceRef.name}
    >
      <div style={{ fontSize: 12, fontWeight: 600 }}>{workspaceRef.name}</div>
      <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>
        {workspaceKindLabel(workspaceRef.kind)}
        {meta ? ` · ${meta}` : ''}
      </div>
    </button>
  );
}

export function WorkspaceDashboardView({
  colors: c,
  dashboard,
  pinned,
  recent,
  resumeWorkspace,
  recentNotes,
  onActivateWorkspace,
  onResumeWorkspace,
  onSelectNote,
  quickActions,
  focus,
  quickCapture,
  productivity,
  review,
  maintenance,
  research,
  study,
  knowledgeMaps,
  project,
  academic,
  academicInsights,
  unified,
  learningPath,
  subjectWorkspaces,
  recentNotesLimit = DEFAULT_RECENT_NOTES_LIMIT,
}: WorkspaceDashboardViewProps) {
  const { isMobile, isTablet, isNarrow } = useViewportLayout();
  const outerPadding = dashboardOuterPadding(isMobile, isTablet);
  const panelGap = isMobile ? 8 : 12;
  const notes = recentNotes.slice(0, recentNotesLimit);
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureType, setCaptureType] = useState<QuickCaptureType>('note');
  const [captureTaskTemplateId, setCaptureTaskTemplateId] = useState(DEFAULT_TASK_TEMPLATE_ID);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetWorkspaceKey, setNewPresetWorkspaceKey] = useState('');
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [showJournalPicker, setShowJournalPicker] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [journalTitle, setJournalTitle] = useState('');

  const submitCapture = () => {
    const trimmed = captureTitle.trim();
    if (!trimmed || !quickCapture) return;
    quickCapture.onCapture(
      trimmed,
      captureType,
      captureType === 'task' ? captureTaskTemplateId : undefined,
    );
    setCaptureTitle('');
  };

  const submitPreset = () => {
    if (!focus) return;
    const trimmedName = newPresetName.trim();
    const option = focus.workspaceOptions.find(
      ref => `${ref.kind}:${ref.id}` === newPresetWorkspaceKey,
    );
    if (!trimmedName || !option) return;
    focus.onCreatePreset(trimmedName, { kind: option.kind, id: option.id });
    setNewPresetName('');
    setNewPresetWorkspaceKey('');
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: outerPadding, display: 'flex', flexDirection: 'column', gap: panelGap }}>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: c.text }}>{dashboard.name}</div>
        <div style={{ fontSize: 11, color: c.textMuted, marginTop: 2 }}>생산성 시작점</div>
      </div>

      <Card colors={c} title="고정된 작업공간">
        {pinned.length === 0 ? (
          <div style={{ fontSize: 11, color: c.textFaint }}>사이드바에서 작업공간을 고정하면 여기에 표시됩니다.</div>
        ) : pinned.map(ref => (
          <WorkspaceRow
            key={`${ref.kind}:${ref.id}`}
            colors={c}
            workspaceRef={ref}
            onClick={() => onActivateWorkspace(ref)}
          />
        ))}
      </Card>

      <Card colors={c} title="최근 작업">
        {recent.length === 0 ? (
          <div style={{ fontSize: 11, color: c.textFaint }}>최근에 연 작업공간이 여기에 표시됩니다.</div>
        ) : recent.map(entry => (
          <WorkspaceRow
            key={`${entry.workspace.kind}:${entry.workspace.id}`}
            colors={c}
            workspaceRef={entry.workspace}
            meta={formatRecentTimestamp(entry.lastOpenedAt)}
            onClick={() => onActivateWorkspace(entry.workspace)}
          />
        ))}
      </Card>

      <Card colors={c} title="마지막 작업공간 이어하기">
        {resumeWorkspace ? (
          <WorkspaceRow
            colors={c}
            workspaceRef={resumeWorkspace}
            meta="이전 작업을 이어갑니다"
            onClick={onResumeWorkspace}
          />
        ) : (
          <div style={{ fontSize: 11, color: c.textFaint }}>이어할 작업공간이 없습니다.</div>
        )}
      </Card>

      <Card colors={c} title="최근 노트">
        {notes.length === 0 ? (
          <div style={{ fontSize: 11, color: c.textFaint }}>노트가 없습니다.</div>
        ) : notes.map(note => (
          <button
            key={note.id}
            type="button"
            onClick={() => onSelectNote(note.id)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: c.cardHov,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: '8px 10px',
              cursor: 'pointer',
              color: c.text,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600 }}>{displayNoteTitle(note.title)}</div>
            <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>
              수정 {formatRecentTimestamp(note.updatedAt)}
            </div>
          </button>
        ))}
      </Card>

      {maintenance && (
        <Card colors={c} title="지식 유지보수">
          <KnowledgeMaintenancePanel
            colors={c}
            data={maintenance.data}
            onNavigateToNote={maintenance.onSelectNote}
          />
        </Card>
      )}

      {unified && (
        <Card colors={c} title="작업공간">
          <UnifiedWorkspaceDashboard
            colors={c}
            data={unified.data}
            onNavigateToNote={unified.onSelectNote}
            onActivateSubjectWorkspace={unified.onActivateSubjectWorkspace}
            onOpenStudyCollection={unified.onOpenStudyCollection}
            onOpenResearchCollection={unified.onOpenResearchCollection}
            projectQuickActions={unified.projectQuickActions}
            learningPathOverview={unified.learningPathOverview}
            learningPathEditor={unified.learningPathEditor}
            compact={isMobile || isTablet}
          />
        </Card>
      )}

      {!unified && academicInsights && (
        <Card colors={c} title="학습 인사이트">
          <AcademicInsightsPanel
            colors={c}
            data={academicInsights.data}
            onNavigateToNote={academicInsights.onSelectNote}
          />
        </Card>
      )}

      {!unified && academic && (
        <Card colors={c} title="학술 대시보드">
          <AcademicDashboardPanel
            colors={c}
            data={academic.data}
            onNavigateToNote={academic.onSelectNote}
          />
        </Card>
      )}

      {!unified && project && (
        <Card colors={c} title="프로젝트 대시보드">
          <ProjectDashboardPanel
            colors={c}
            data={project.data}
            onNavigateToNote={project.onSelectNote}
          />
        </Card>
      )}

      {!unified && research && (
        <Card colors={c} title="연구 대시보드">
          <ResearchDashboardPanel
            colors={c}
            data={research.data}
            onNavigateToNote={research.onSelectNote}
          />
        </Card>
      )}

      {!unified && study && (
        <Card colors={c} title="학습 대시보드">
          <StudyDashboardPanel
            colors={c}
            data={study.data}
            onNavigateToNote={study.onSelectNote}
          />
        </Card>
      )}

      {!unified && knowledgeMaps && (
        <>
          <Card colors={c} title="주제 지식">
            <SubjectMapsDashboardPanel
              colors={c}
              subjects={knowledgeMaps.subjects}
              onNavigateToNote={knowledgeMaps.onSelectNote}
              onActivateSubjectWorkspace={knowledgeMaps.onActivateSubjectWorkspace}
            />
          </Card>
          <Card colors={c} title="지식 클러스터">
            <KnowledgeClusterPanel
              colors={c}
              data={knowledgeMaps.clusters}
              onNavigateToNote={knowledgeMaps.onSelectNote}
            />
          </Card>
        </>
      )}

      {!unified && review && (
        <Card colors={c} title="지식 검토">
          <KnowledgeReviewPanel
            colors={c}
            lists={review.lists}
            onNavigateToNote={review.onSelectNote}
            compact
          />
        </Card>
      )}

      {learningPath && (
        <Card colors={c} title="학습 경로">
          <LearningPathOverviewPanel
            colors={c}
            data={learningPath.data}
            onNavigateToNote={learningPath.onSelectNote}
            onCreatePath={learningPath.onCreatePath}
            onOpenPathEditor={learningPath.onOpenPathEditor}
          />
          {learningPath.editor && (
            <LearningPathEditorPanel
              colors={c}
              pathId={learningPath.editor.pathId}
              notes={learningPath.editor.notes}
              activeNoteId={learningPath.editor.activeNoteId}
              onPathIdChange={learningPath.editor.onPathIdChange}
              onUpdateNoteProperties={learningPath.editor.onUpdateNoteProperties}
              onCreateNote={learningPath.editor.onCreateNote}
              onNavigateToNote={learningPath.onSelectNote}
            />
          )}
        </Card>
      )}

      {subjectWorkspaces && (
        <Card colors={c} title="주제 작업공간">
          <SubjectWorkspacesPanel
            colors={c}
            subjects={subjectWorkspaces.subjects}
            onNavigateToNote={subjectWorkspaces.onSelectNote}
            onActivateSubjectWorkspace={subjectWorkspaces.onActivateSubjectWorkspace}
            onEditProject={subjectWorkspaces.onEditProject}
          />
        </Card>
      )}

      {focus && (
        <Card colors={c} title="집중 프리셋">
          {focus.activePresetId && (
            <button
              type="button"
              className="bwbg"
              style={{ padding: '8px', fontSize: 11, width: '100%' }}
              onClick={focus.onExitPreset}
            >
              집중 모드 종료
            </button>
          )}
          {focus.presets.length === 0 ? (
            <div style={{ fontSize: 11, color: c.textFaint }}>집중 작업을 시작하려면 프리셋을 만드세요.</div>
          ) : focus.presets.map(preset => {
            const target = focus.presetTargets[preset.id];
            const isActive = focus.activePresetId === preset.id;
            return (
              <div
                key={preset.id}
                style={{
                  background: c.cardHov,
                  border: `1px solid ${isActive ? c.accent : c.sideBdr}`,
                  borderRadius: 6,
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c.text }}>{preset.name}</div>
                  <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>
                    {target
                      ? `${target.name} · ${workspaceKindLabel(target.kind)}`
                      : '작업공간을 사용할 수 없음'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="bwbg"
                    style={{ flex: 1, padding: '6px', fontSize: 11 }}
                    disabled={!target}
                    onClick={() => focus.onActivatePreset(preset.id)}
                  >
                    {isActive ? '활성' : '시작'}
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '6px 8px',
                      fontSize: 11,
                      background: c.card,
                      border: `1px solid ${c.sideBdr}`,
                      borderRadius: 5,
                      color: c.textMuted,
                      cursor: 'pointer',
                    }}
                    onClick={() => focus.onDeletePreset(preset.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
          {focus.workspaceOptions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <input
                className="bwi"
                style={{ width: '100%', fontSize: 11 }}
                placeholder="프리셋 이름"
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
              />
              <select
                className="bwi"
                style={{ width: '100%', fontSize: 11 }}
                value={newPresetWorkspaceKey}
                onChange={e => setNewPresetWorkspaceKey(e.target.value)}
              >
                <option value="">작업공간 선택</option>
                {focus.workspaceOptions.map(ref => (
                  <option key={`${ref.kind}:${ref.id}`} value={`${ref.kind}:${ref.id}`}>
                    {ref.name} ({workspaceKindLabel(ref.kind)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="bwbg"
                style={{ padding: '6px', fontSize: 11 }}
                onClick={submitPreset}
              >
                프리셋 만들기
              </button>
            </div>
          )}
        </Card>
      )}

      {quickCapture && (
        <Card colors={c} title="빠른 캡처">
          <div style={{ fontSize: 10, color: c.textFaint, marginBottom: 4 }}>
            #{DEFAULT_QUICK_CAPTURE_MODEL.inboxTag} 태그가 붙은 일반 노트를 만듭니다
          </div>
          <input
            className="bwi"
            style={{ width: '100%', fontSize: 11 }}
            placeholder="제목"
            value={captureTitle}
            onChange={e => setCaptureTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitCapture();
            }}
          />
          <select
            className="bwi"
            style={{ width: '100%', fontSize: 11 }}
            value={captureType}
            onChange={e => setCaptureType(e.target.value as QuickCaptureType)}
          >
            {DEFAULT_QUICK_CAPTURE_MODEL.types.map(type => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
          </select>
          {captureType === 'task' && quickCapture.taskTemplates.length > 0 && (
            <select
              className="bwi"
              style={{ width: '100%', fontSize: 11 }}
              value={captureTaskTemplateId}
              onChange={e => setCaptureTaskTemplateId(e.target.value)}
            >
              {quickCapture.taskTemplates.map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="bwbg"
            style={{ padding: '8px', fontSize: 11, width: '100%' }}
            onClick={submitCapture}
          >
            캡처
          </button>
        </Card>
      )}

      <Card colors={c} title="빠른 작업">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button type="button" className="bwbg" style={{ padding: '8px', fontSize: 11 }} onClick={quickActions.onNewNote}>
            새 노트
          </button>
          <button type="button" className="bwbg" style={{ padding: '8px', fontSize: 11 }} onClick={quickActions.onNewDatabaseView}>
            새 데이터베이스 보기
          </button>
          {productivity && (
            <>
              <button
                type="button"
                className="bwbg"
                style={{ padding: '8px', fontSize: 11 }}
                onClick={() => { setShowJournalPicker(false); setShowTaskPicker(v => !v); }}
              >
                새 작업
              </button>
              <button
                type="button"
                className="bwbg"
                style={{ padding: '8px', fontSize: 11 }}
                onClick={() => { setShowTaskPicker(false); setShowJournalPicker(v => !v); }}
              >
                새 저널
              </button>
              {productivity.onCreateReadingNote && (
                <button
                  type="button"
                  className="bwbg"
                  style={{ padding: '8px', fontSize: 11, gridColumn: '1 / -1' }}
                  onClick={() => productivity.onCreateReadingNote?.()}
                >
                  새 읽기 노트
                </button>
              )}
              {productivity.onCreateStudyNote && (
                <button
                  type="button"
                  className="bwbg"
                  style={{ padding: '8px', fontSize: 11, gridColumn: '1 / -1' }}
                  onClick={() => productivity.onCreateStudyNote?.()}
                >
                  새 학습 노트
                </button>
              )}
            </>
          )}
          <button type="button" className="bwbg" style={{ padding: '8px', fontSize: 11 }} onClick={quickActions.onOpenSearch}>
            검색 열기
          </button>
          <button type="button" className="bwbg" style={{ padding: '8px', fontSize: 11 }} onClick={quickActions.onOpenGraph}>
            그래프 열기
          </button>
        </div>
        {productivity && showTaskPicker && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <input
              className="bwi"
              style={{ width: '100%', fontSize: 11 }}
              placeholder="작업 제목 (선택)"
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
            />
            {productivity.taskTemplates.map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  productivity.onCreateTask(template.id, taskTitle.trim() || undefined);
                  setTaskTitle('');
                  setShowTaskPicker(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: c.cardHov,
                  border: `1px solid ${c.sideBdr}`,
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  color: c.text,
                }}
                title={template.description}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>{template.name}</div>
                <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{template.description}</div>
              </button>
            ))}
            {productivity.onCreateTaskDatabase && (
              <button
                type="button"
                className="bwbg"
                style={{ padding: '6px', fontSize: 10 }}
                onClick={productivity.onCreateTaskDatabase}
              >
                작업 데이터베이스 만들기
              </button>
            )}
          </div>
        )}
        {productivity && showJournalPicker && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            <input
              className="bwi"
              style={{ width: '100%', fontSize: 11 }}
              placeholder="저널 제목 (선택)"
              value={journalTitle}
              onChange={e => setJournalTitle(e.target.value)}
            />
            {productivity.journalTemplates.map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  productivity.onCreateJournal(template.id, journalTitle.trim() || undefined);
                  setJournalTitle('');
                  setShowJournalPicker(false);
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: c.cardHov,
                  border: `1px solid ${c.sideBdr}`,
                  borderRadius: 6,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  color: c.text,
                }}
                title={template.description}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>{template.name}</div>
                <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>{template.description}</div>
              </button>
            ))}
            {productivity.onCreateJournalDatabase && (
              <button
                type="button"
                className="bwbg"
                style={{ padding: '6px', fontSize: 10 }}
                onClick={productivity.onCreateJournalDatabase}
              >
                저널 데이터베이스 만들기
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
