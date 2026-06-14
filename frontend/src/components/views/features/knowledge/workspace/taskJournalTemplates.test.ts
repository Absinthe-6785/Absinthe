// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { WorkspaceDashboardView } from '../components/WorkspaceDashboardView';
import { DEFAULT_WORKSPACE_DASHBOARD } from './workspaceDashboardModels';
import { TASK_TEMPLATES } from './taskTemplateRegistry';
import { JOURNAL_TEMPLATES } from './journalTemplateRegistry';
import {
  buildTaskNote,
  findTaskTemplate,
  resolveTaskTemplateId,
} from './taskTemplates';
import {
  buildJournalNote,
  findJournalTemplate,
  resolveJournalTemplateId,
} from './journalTemplates';
import { createInboxNote, INBOX_TAG } from './quickCapture';
import { getProperty } from '../properties/noteProperties';
import { hasTag, listTags } from '../tags/noteTags';
import {
  getJournalDatabaseTemplateId,
  getTaskDatabaseTemplateId,
  TASK_DATABASE_TEMPLATE_ID,
} from './productivityDatabaseBridge';
import { TASK_PROPERTY_KEYS } from './taskTemplateModels';
import { findDatabaseTemplate } from '../databaseViews/databaseTemplates';

function note(id = 'n-1', title = 'Test'): NoteBase {
  return { id, title, body: '', updatedAt: 0, folderId: null, deletedAt: null };
}

const colors: NoteChromeColors = {
  wrap: '#fff',
  sidebar: '#fff',
  sideBdr: '#ddd',
  notelist: '#fff',
  editor: '#fff',
  text: '#111',
  textMuted: '#666',
  textFaint: '#999',
  accent: '#8B5CF6',
  accentBg: '#eee',
  card: '#fff',
  cardHov: '#f5f5f5',
  cardAct: '#eee',
  cardActBdr: '#8B5CF6',
  input: '#fff',
  inputBdr: '#ddd',
  toolbar: '#fff',
  toolBdr: '#ddd',
  badge: '#eee',
  badgeTxt: '#333',
  tag: '#eee',
  tagTxt: '#333',
  green: '#0a0',
  danger: '#c00',
};

describe('task template registry', () => {
  it('includes all built-in task templates', () => {
    expect(TASK_TEMPLATES.map(t => t.id)).toEqual([
      'study-task',
      'project-task',
      'exam-task',
      'review-task',
      'research-task',
    ]);
  });

  it('applies task property conventions', () => {
    const template = findTaskTemplate('project-task', TASK_TEMPLATES)!;
    for (const key of TASK_PROPERTY_KEYS) {
      expect(template.properties[key]).toBeDefined();
    }
    const built = buildTaskNote(note(), template, { toInbox: true });
    expect(hasTag(built, INBOX_TAG)).toBe(true);
    expect(hasTag(built, 'task')).toBe(true);
    expect(hasTag(built, 'project')).toBe(true);
    expect(getProperty(built, 'status')).toBe('todo');
    expect(getProperty(built, 'priority')).toBe('high');
  });

  it('resolves default task template', () => {
    expect(resolveTaskTemplateId(undefined, TASK_TEMPLATES)?.id).toBe('study-task');
    expect(resolveTaskTemplateId('exam-task', TASK_TEMPLATES)?.name).toBe('Exam Task');
  });
});

describe('journal template registry', () => {
  it('includes all built-in journal templates', () => {
    expect(JOURNAL_TEMPLATES.map(t => t.id)).toEqual([
      'daily-review',
      'weekly-review',
      'monthly-review',
      'study-reflection',
      'project-retrospective',
    ]);
  });

  it('creates notes with pre-filled editable content', () => {
    const template = findJournalTemplate('daily-review', JOURNAL_TEMPLATES)!;
    const built = buildJournalNote(note(), template);
    expect(built.title).toBe('Daily Review');
    expect(built.body).toContain('What did I learn today?');
    expect(built.body).toContain('What will I do tomorrow?');
    expect(hasTag(built, 'journal')).toBe(true);
    expect(hasTag(built, 'daily')).toBe(true);
  });

  it('creates study reflection prompts', () => {
    const template = resolveJournalTemplateId('study-reflection', JOURNAL_TEMPLATES)!;
    const built = buildJournalNote(note(), template);
    expect(built.body).toContain('What was difficult?');
    expect(built.body).toContain('What remains unclear?');
  });
});

describe('quick capture task integration', () => {
  it('combines inbox workflow with task template properties', () => {
    const template = resolveTaskTemplateId('research-task', TASK_TEMPLATES)!;
    const built = buildTaskNote(note(), template, { title: 'Read paper', toInbox: true });
    expect(listTags(built).sort()).toEqual(['inbox', 'research', 'task'].sort());
    expect(getProperty(built, 'status')).toBe('todo');
    expect(built.title).toBe('Read paper');
  });

  it('preserves non-task inbox capture behavior', () => {
    const built = createInboxNote(note(), { captureType: 'idea' });
    expect(hasTag(built, INBOX_TAG)).toBe(true);
    expect(hasTag(built, 'idea')).toBe(true);
    expect(getProperty(built, 'status')).toBeUndefined();
  });
});

describe('productivity database bridge', () => {
  it('maps to existing database templates', () => {
    expect(getTaskDatabaseTemplateId()).toBe(TASK_DATABASE_TEMPLATE_ID);
    expect(findDatabaseTemplate(getTaskDatabaseTemplateId())).toBeDefined();
    expect(findDatabaseTemplate(getJournalDatabaseTemplateId())).toBeDefined();
  });
});

describe('WorkspaceDashboardView productivity integration', () => {
  it('renders task and journal template pickers in quick actions', () => {
    const onCreateTask = vi.fn();
    const onCreateJournal = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(createElement(WorkspaceDashboardView, {
        colors,
        dashboard: DEFAULT_WORKSPACE_DASHBOARD,
        pinned: [],
        recent: [],
        resumeWorkspace: null,
        recentNotes: [],
        onActivateWorkspace: vi.fn(),
        onResumeWorkspace: vi.fn(),
        onSelectNote: vi.fn(),
        quickActions: {
          onNewNote: vi.fn(),
          onNewDatabaseView: vi.fn(),
          onOpenSearch: vi.fn(),
          onOpenCosmos: vi.fn(),
        },
        quickCapture: {
          taskTemplates: TASK_TEMPLATES,
          onCapture: vi.fn(),
        },
        productivity: {
          taskTemplates: TASK_TEMPLATES,
          journalTemplates: JOURNAL_TEMPLATES,
          onCreateTask,
          onCreateJournal,
        },
      }));
    });

    expect(container.textContent).toContain('새 작업');
    expect(container.textContent).toContain('새 저널');

    const newTaskButton = [...container.querySelectorAll('button')].find(
      b => b.textContent === '새 작업',
    );
    act(() => { newTaskButton?.click(); });
    expect(container.textContent).toContain('Study Task');

    const studyTaskButton = [...container.querySelectorAll('button')].find(
      b => b.textContent?.includes('Study Task'),
    );
    act(() => { studyTaskButton?.click(); });
    expect(onCreateTask).toHaveBeenCalledWith('study-task', undefined);

    const newJournalButton = [...container.querySelectorAll('button')].find(
      b => b.textContent === '새 저널',
    );
    act(() => { newJournalButton?.click(); });
    const dailyReviewButton = [...container.querySelectorAll('button')].find(
      b => b.textContent?.includes('Daily Review'),
    );
    act(() => { dailyReviewButton?.click(); });
    expect(onCreateJournal).toHaveBeenCalledWith('daily-review', undefined);
  });
});
