// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDatabaseViewFromTemplate,
  DATABASE_TEMPLATES,
  findDatabaseTemplate,
} from './databaseTemplates';
import {
  getBoardConfig,
  getCalendarConfig,
  getGalleryConfig,
  getTableConfig,
  getTimelineConfig,
  withPresentationDefaults,
} from './databasePresentationConfig';
import { setDatabaseViewPresentation } from './databaseViewOperations';
import { createDatabaseView, normalizeDatabaseViews, renameDatabaseView } from './databaseViews';
import { loadDatabaseViews, saveDatabaseViews, DATABASE_VIEWS_KEY } from './databaseViewsStorage';
import { resolveDatabaseViewEffectiveQuery } from './resolveDatabaseViewQuery';
import { resolveDatabaseViewSortRules } from './sortDatabaseViewRows';
import { compileVisualFilters } from '../query/visualFilterModels';
import type { DatabaseView } from './databaseViewModels';

const TEMPLATE_IDS = [
  'study-tracker',
  'reading-tracker',
  'project-tracker',
  'language-learning',
  'exam-planner',
  'knowledge-library',
] as const;

function createdView(views: readonly DatabaseView[], name: string): DatabaseView {
  const view = views.find(entry => entry.name === name);
  if (!view) throw new Error(`Missing view: ${name}`);
  return withPresentationDefaults(view);
}

function columnKeys(view: DatabaseView): string[] {
  return getTableConfig(view).columns.map(column => column.key);
}

function sortRuleKeys(view: DatabaseView): string[] {
  return resolveDatabaseViewSortRules(getTableConfig(view)).map(rule => rule.key);
}

describe('DATABASE_TEMPLATES registry', () => {
  it('includes six built-in templates with unique ids', () => {
    expect(DATABASE_TEMPLATES).toHaveLength(6);
    const ids = DATABASE_TEMPLATES.map(template => template.id);
    expect(new Set(ids).size).toBe(6);
    expect(ids).toEqual([...TEMPLATE_IDS]);
  });

  it('exposes name, description, and presentation for each template', () => {
    for (const template of DATABASE_TEMPLATES) {
      expect(template.name.trim()).not.toBe('');
      expect(template.description.trim()).not.toBe('');
      expect(template.presentation).toBeTruthy();
      expect(typeof template.createView).toBe('function');
    }
  });

  it('finds templates by id', () => {
    expect(findDatabaseTemplate('study-tracker')?.name).toBe('Study Tracker');
    expect(findDatabaseTemplate(' missing ')).toBeUndefined();
    expect(findDatabaseTemplate('unknown')).toBeUndefined();
  });
});

describe('createDatabaseViewFromTemplate', () => {
  it('returns unchanged views for unknown templates', () => {
    const seed = createDatabaseView([], 'Manual', 'tag:manual');
    expect(createDatabaseViewFromTemplate(seed, 'not-a-template')).toEqual(seed);
  });

  it('appends a fully configured view sorted by name', () => {
    const next = createDatabaseViewFromTemplate([], 'project-tracker', { id: 'db-project' });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      id: 'db-project',
      name: 'Project Tracker',
      presentation: 'board',
      query: 'tag:project',
    });
  });

  it('allows overriding the generated name', () => {
    const next = createDatabaseViewFromTemplate([], 'study-tracker', { name: 'JLPT Prep' });
    expect(next[0]?.name).toBe('JLPT Prep');
  });
});

describe('template presentation defaults', () => {
  it('configures study tracker as a board grouped by status', () => {
    const view = createdView(createDatabaseViewFromTemplate([], 'study-tracker'), 'Study Tracker');
    expect(view.presentation).toBe('board');
    expect(getBoardConfig(view).groupBy).toBe('status');
    expect(columnKeys(view)).toEqual(expect.arrayContaining(['status', 'subject', 'reviewDate']));
  });

  it('configures reading tracker as a table with rating sort', () => {
    const view = createdView(createDatabaseViewFromTemplate([], 'reading-tracker'), 'Reading Tracker');
    expect(view.presentation).toBe('table');
    expect(columnKeys(view)).toEqual(expect.arrayContaining(['status', 'author', 'rating']));
    expect(sortRuleKeys(view)).toEqual(['rating', 'updatedAt']);
  });

  it('configures language learning as a calendar on reviewDate', () => {
    const view = createdView(createDatabaseViewFromTemplate([], 'language-learning'), 'Language Learning');
    expect(view.presentation).toBe('calendar');
    expect(getCalendarConfig(view).dateProperty).toBe('reviewDate');
    expect(columnKeys(view)).toEqual(expect.arrayContaining(['language', 'level', 'reviewDate']));
  });

  it('configures exam planner as a timeline on examDate', () => {
    const view = createdView(createDatabaseViewFromTemplate([], 'exam-planner'), 'Exam Planner');
    expect(view.presentation).toBe('timeline');
    const timeline = getTimelineConfig(view);
    expect(timeline.startDateProperty).toBe('examDate');
    expect(timeline.endDateProperty).toBe('examDate');
  });

  it('configures knowledge library as a gallery with card fields', () => {
    const view = createdView(createDatabaseViewFromTemplate([], 'knowledge-library'), 'Knowledge Library');
    expect(view.presentation).toBe('gallery');
    const gallery = getGalleryConfig(view);
    expect(gallery.coverProperty).toBe('source');
    expect(gallery.cardFields).toEqual(['category', 'source', 'rating']);
  });
});

describe('template filters and sort rules', () => {
  it('persists visual filters on table templates', () => {
    const view = createdView(createDatabaseViewFromTemplate([], 'reading-tracker'), 'Reading Tracker');
    const filters = getTableConfig(view).visualFilters;
    expect(filters).toBeDefined();
    expect(compileVisualFilters(filters!)).toContain('status:active');
    expect(resolveDatabaseViewEffectiveQuery(view)).toContain('status:active');
  });

  it('merges non-table template filters into the base query', () => {
    const view = createdView(createDatabaseViewFromTemplate([], 'study-tracker'), 'Study Tracker');
    expect(view.query).toContain('tag:study');
    expect(view.query).toContain('status:active');
    expect(getTableConfig(view).visualFilters).toBeUndefined();
  });

  it('leaves project tracker without extra filter constraints', () => {
    const view = createdView(createDatabaseViewFromTemplate([], 'project-tracker'), 'Project Tracker');
    expect(view.query).toBe('tag:project');
    expect(getTableConfig(view).visualFilters).toBeUndefined();
    expect(sortRuleKeys(view)).toEqual(['priority']);
  });
});

describe('customization and persistence', () => {
  it('supports normal database view edits after template creation', () => {
    const created = createDatabaseViewFromTemplate([], 'study-tracker', { id: 'db-study' });
    const renamed = renameDatabaseView(created, 'db-study', 'Custom Study Board');
    const source = renamed.find(entry => entry.id === 'db-study');
    if (!source) throw new Error('Missing created view');
    const view = withPresentationDefaults(setDatabaseViewPresentation(source, 'table'));

    expect(view.name).toBe('Custom Study Board');
    expect(view.presentation).toBe('table');
    expect(view.presentationConfig.type).toBe('table');
  });

  describe('persistence', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('persists only database views without template metadata', () => {
      const views = createDatabaseViewFromTemplate([], 'reading-tracker', { id: 'db-reading' });
      saveDatabaseViews(views);
      const raw = localStorage.getItem(DATABASE_VIEWS_KEY);
      expect(raw).toBeTruthy();
      expect(raw).not.toContain('template');
      expect(raw).not.toContain('reading-tracker');

      const loaded = loadDatabaseViews();
      expect(normalizeDatabaseViews(loaded)).toHaveLength(1);
      expect(loaded[0]).toMatchObject({
        id: 'db-reading',
        name: 'Reading Tracker',
        presentation: 'table',
      });
    });
  });
});

describe('backward compatibility', () => {
  it('does not change manual database view creation', () => {
    const manual = createDatabaseView([], 'Manual Table', 'tag:manual');
    const templated = createDatabaseViewFromTemplate(manual, 'project-tracker', { id: 'db-project' });

    expect(manual).toHaveLength(1);
    expect(templated).toHaveLength(2);
    expect(templated[0]?.name).toBe('Manual Table');
    expect(templated[1]?.presentation).toBe('board');
  });
});
