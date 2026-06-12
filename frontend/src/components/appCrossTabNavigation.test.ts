import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('AppContent cross-tab note navigation wiring', () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'AppContent.tsx'),
    'utf8',
  );

  it('registers the Notes tab switcher on mount', () => {
    expect(source).toContain("from '../lib/noteNavigation'");
    expect(source).toContain('registerNotesTabSwitcher');
    expect(source).toContain("setActiveTab('note')");
  });
});
