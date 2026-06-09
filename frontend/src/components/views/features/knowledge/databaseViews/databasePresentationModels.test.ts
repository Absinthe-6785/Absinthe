import { describe, it, expect } from 'vitest';
import {
  isDatabaseBoardConfig,
  isDatabaseCalendarConfig,
  isDatabaseTableConfig,
  type DatabasePresentationConfig,
} from './databasePresentationModels';

describe('databasePresentationModels', () => {
  it('narrows table config', () => {
    const config: DatabasePresentationConfig = {
      type: 'table',
      columns: [{ key: 'title', visible: true }],
      sort: { key: 'updatedAt', direction: 'desc' },
    };
    expect(isDatabaseTableConfig(config)).toBe(true);
    expect(isDatabaseBoardConfig(config)).toBe(false);
  });

  it('narrows board config', () => {
    const config: DatabasePresentationConfig = {
      type: 'board',
      groupBy: 'status',
      lanes: ['Todo', 'Doing', 'Done'],
    };
    expect(isDatabaseBoardConfig(config)).toBe(true);
    if (isDatabaseBoardConfig(config)) {
      expect(config.groupBy).toBe('status');
    }
  });

  it('narrows calendar config', () => {
    const config: DatabasePresentationConfig = {
      type: 'calendar',
      dateProperty: 'dueDate',
    };
    expect(isDatabaseCalendarConfig(config)).toBe(true);
  });
});
