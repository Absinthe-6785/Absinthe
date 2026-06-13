// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  openArchiveBrowseDestination,
  openArchiveMarkMonthNavigation,
  openTraceDayNavigation,
  registerTraceNavigation,
} from './traceNavigation';
import { registerNotesTabSwitcher } from './noteNavigation';

describe('traceNavigation', () => {
  beforeEach(() => {
    registerTraceNavigation({
      openTraceDay: vi.fn(),
      openTraceRange: vi.fn(),
      openTraceDiscovery: vi.fn(),
    })();
    registerNotesTabSwitcher(() => {})();
  });

  it('openTraceDayNavigation delegates to registered handlers and switches tab', () => {
    const switcher = vi.fn();
    const openTraceDay = vi.fn();
    registerNotesTabSwitcher(switcher);
    registerTraceNavigation({ openTraceDay, openTraceRange: vi.fn(), openTraceDiscovery: vi.fn() });

    openTraceDayNavigation('2026-06-12');

    expect(openTraceDay).toHaveBeenCalledWith('2026-06-12');
    expect(switcher).toHaveBeenCalledTimes(1);
  });

  it('openArchiveBrowseDestination maps period refs to trace range lenses', () => {
    const openTraceRange = vi.fn();
    registerTraceNavigation({ openTraceDay: vi.fn(), openTraceRange, openTraceDiscovery: vi.fn() });

    openArchiveBrowseDestination({
      type: 'period',
      ref: { kind: 'month', year: 2026, month: 6, label: 'June 2026' },
    });

    expect(openTraceRange).toHaveBeenCalledWith({ kind: 'month', year: 2026, month: 6 });
  });

  it('openArchiveBrowseDestination opens discovery for areas index', () => {
    const openTraceDiscovery = vi.fn();
    registerTraceNavigation({ openTraceDay: vi.fn(), openTraceRange: vi.fn(), openTraceDiscovery });

    openArchiveBrowseDestination({ type: 'areas-index' });

    expect(openTraceDiscovery).toHaveBeenCalledTimes(1);
  });

  it('openArchiveMarkMonthNavigation opens month range lens', () => {
    const openTraceRange = vi.fn();
    registerTraceNavigation({ openTraceDay: vi.fn(), openTraceRange, openTraceDiscovery: vi.fn() });

    openArchiveMarkMonthNavigation(2026, 6);

    expect(openTraceRange).toHaveBeenCalledWith({ kind: 'month', year: 2026, month: 6 });
  });

  it('openTraceRangeNavigation ignores empty date keys for day navigation', () => {
    const openTraceDay = vi.fn();
    registerTraceNavigation({ openTraceDay, openTraceRange: vi.fn(), openTraceDiscovery: vi.fn() });

    openTraceDayNavigation('  ');

    expect(openTraceDay).not.toHaveBeenCalled();
  });
});
