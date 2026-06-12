import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Planner wires CalendarShell event clicks and memo sidebar to openNote (K-30.34).
 * Static wiring check avoids mounting the full PlannerView surface in tests.
 */
describe('PlannerView cross-tab note navigation wiring', () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'PlannerView.tsx'),
    'utf8',
  );

  it('imports openNote and passes it to CalendarShell event clicks', () => {
    expect(source).toContain("from '../../lib/noteNavigation'");
    expect(source).toContain('onEventNoteClick={openNote}');
  });

  it('uses openNote for memo sidebar note rows', () => {
    expect(source).toContain('openNote(n.id)');
  });
});
