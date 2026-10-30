// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Theme } from '@/types';
import type { PlannerScheduleRow } from '../../calendar';
import { ScheduleEventDetailPanel } from './ScheduleEventDetailPanel';

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const theme = {
  card: 'card',
  input: 'input',
  border: 'border',
  textMuted: 'muted',
  hoverBg: 'hover',
} as Theme;

const block: PlannerScheduleRow = {
  id: 'schedule-1',
  dateKey: '2026-10-26',
  title: 'Quarterly planning',
  startTime: '10:00',
  endTime: '11:00',
  endNextDay: false,
  category: 'Work',
  color: 'purple',
  source: 'schedule',
};

describe('ScheduleEventDetailPanel', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('renders ordinary Schedule details without an implicit Note action and keeps Schedule controls operational', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onDuplicate = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root.render(createElement(ScheduleEventDetailPanel, {
        block,
        theme,
        dateLabel: 'October 26, 2026',
        onEdit,
        onDelete,
        onDuplicate,
        onClose,
      }));
    });

    const details = host.querySelector('[data-schedule-event-detail]');
    expect(details?.textContent).toContain(block.title);
    expect(details?.textContent).toContain('October 26, 2026');
    expect(details?.textContent).toContain('10:00');
    expect(details?.textContent).toContain('11:00');
    expect(details?.textContent).toContain('Work');
    expect(host.querySelector('[data-k113-open-related-note]')).toBeNull();
    expect(host.querySelector('[data-k113-cross-ref="planner"]')).toBeNull();

    act(() => {
      (host.querySelector('[data-schedule-event-edit]') as HTMLButtonElement).click();
      (host.querySelector('[data-schedule-event-duplicate]') as HTMLButtonElement).click();
      (host.querySelector('[data-schedule-event-delete]') as HTMLButtonElement).click();
    });
    const confirmDelete = host.querySelector('[data-k103-schedule-delete-confirm] button');
    expect(confirmDelete).not.toBeNull();
    act(() => (confirmDelete as HTMLButtonElement).click());
    act(() => (host.querySelector('[aria-label="close"]') as HTMLButtonElement).click());

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('passes the quick-edit title draft to the existing edit callback while ordinary Edit passes no override', () => {
    const onEdit = vi.fn();
    act(() => {
      root.render(createElement(ScheduleEventDetailPanel, {
        block,
        theme,
        dateLabel: 'October 26, 2026',
        onEdit,
        onDelete: vi.fn(),
        onClose: vi.fn(),
      }));
    });

    act(() => host.querySelector('h3')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const input = host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(input, 'Updated planning title');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onEdit).toHaveBeenLastCalledWith('Updated planning title');

    act(() => (host.querySelector('[data-schedule-event-edit]') as HTMLButtonElement).click());
    expect(onEdit).toHaveBeenLastCalledWith();
  });

  it('does not submit quick edit during IME composition or the keyCode 229 fallback', () => {
    const onEdit = vi.fn();
    act(() => {
      root.render(createElement(ScheduleEventDetailPanel, {
        block,
        theme,
        dateLabel: 'October 26, 2026',
        onEdit,
        onDelete: vi.fn(),
        onClose: vi.fn(),
      }));
    });

    act(() => host.querySelector('h3')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const input = host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!;
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true }));
    });
    expect(onEdit).not.toHaveBeenCalled();
    expect(host.querySelector('[data-schedule-event-quick-edit]')).not.toBeNull();
  });
});
