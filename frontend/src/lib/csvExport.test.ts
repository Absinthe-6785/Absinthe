import { describe, expect, it } from 'vitest';
import { buildWorkoutCsvRows } from './csvExport';

describe('Health workout CSV export', () => {
  it('keeps reps as total and writes assisted reps into a separate column', () => {
    const rows = buildWorkoutCsvRows([{
      date: '2026-09-12',
      exercise_blocks: { name: 'Nordic Curl', type: 'bodyweight' },
      sets: [
        { type: 'bodyweight', set: 1, kg: '', reps: 12, assisted_reps: 4, done: true },
        { type: 'bodyweight', set: 2, kg: '', reps: 8, done: true },
      ],
    }, {
      date: '2026-09-12',
      exercise_blocks: { name: 'Run', type: 'cardio' },
      sets: [{ type: 'cardio', set: 1, time: '10:00', distance: '2.5', pace: '4:00', done: true }],
    }]);

    expect(rows[0]).toBe('date,exercise,type,set,kg,reps,assisted_reps,time,distance,done');
    expect(rows[1]).toBe('2026-09-12,Nordic Curl,bodyweight,1,,12,4,,,true');
    expect(rows[2]).toBe('2026-09-12,Nordic Curl,bodyweight,2,,8,,,,true');
    expect(rows[3]).toBe('2026-09-12,Run,cardio,1,,,,10:00,2.5,true');
  });
});
