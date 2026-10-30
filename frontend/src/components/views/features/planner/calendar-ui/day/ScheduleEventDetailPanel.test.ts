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

  it('represents D-day targets without suggesting a timed event or an unsupported duplicate action', () => {
    act(() => root.render(createElement(ScheduleEventDetailPanel, {
      block: { ...block, isDday: true, startTime: '00:00', endTime: '23:59' },
      theme,
      dateLabel: 'June 20, 2026',
      onEdit: vi.fn(),
      onDelete: vi.fn(),
      onDuplicate: vi.fn(),
      onClose: vi.fn(),
    })));
    const details = host.querySelector('[data-schedule-event-detail]');
    expect(details?.textContent).toContain('June 20, 2026');
    expect(details?.textContent).toContain('k80DdayTimeHint');
    expect(details?.textContent).not.toContain('00:00–23:59');
    expect(host.querySelector('[data-schedule-event-duplicate]')).toBeNull();
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
    act(() => root.render(createElement(ScheduleEventDetailPanel, {
      block, theme, dateLabel: 'October 26, 2026', onEdit, onDelete: vi.fn(), onClose: vi.fn(),
    })));
    act(() => host.querySelector('h3')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const input = host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!;
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true }));
    });
    expect(onEdit).not.toHaveBeenCalled();
    expect(host.querySelector('[data-schedule-event-quick-edit]')).not.toBeNull();
  });

  it('discards a cancelled quick-edit draft before the editor is reopened', () => {
    const onEdit = vi.fn();
    act(() => root.render(createElement(ScheduleEventDetailPanel, {
      block, theme, dateLabel: 'October 26, 2026', onEdit, onDelete: vi.fn(), onClose: vi.fn(),
    })));

    act(() => host.querySelector('h3')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const input = host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(input, 'Cancelled draft');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(host.querySelector('[data-schedule-event-quick-edit]')).toBeNull();

    act(() => host.querySelector('h3')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!.value).toBe(block.title);
    act(() => host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(onEdit).toHaveBeenCalledWith(block.title);
  });

  it('does not fire E, D, or Delete global shortcuts while typing in quick edit', () => {
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    act(() => root.render(createElement(ScheduleEventDetailPanel, {
      block, theme, dateLabel: 'October 26, 2026', onEdit, onDuplicate, onDelete, onClose: vi.fn(),
    })));

    act(() => host.querySelector('h3')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const input = host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!;
    act(() => {
      for (const key of ['d', 'e', 'Delete']) {
        input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
      }
    });
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDuplicate).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(host.querySelector('[data-k103-schedule-delete-confirm]')).toBeNull();
  });

  it('guards textarea, plaintext-only contenteditable, and shadow-DOM editable targets', () => {
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    act(() => root.render(createElement(ScheduleEventDetailPanel, {
      block, theme, dateLabel: 'October 26, 2026', onEdit, onDuplicate, onDelete: vi.fn(), onClose: vi.fn(),
    })));

    const textarea = document.createElement('textarea');
    const plaintext = document.createElement('div');
    plaintext.setAttribute('contenteditable', 'plaintext-only');
    const shadowHost = document.createElement('div');
    const shadow = shadowHost.attachShadow({ mode: 'open' });
    const shadowEditor = document.createElement('div');
    shadowEditor.setAttribute('contenteditable', 'true');
    shadow.append(shadowEditor);
    document.body.append(textarea, plaintext, shadowHost);
    try {
      act(() => {
        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true, composed: true }));
        plaintext.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, composed: true }));
        shadowEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true, composed: true }));
      });
      expect(onEdit).not.toHaveBeenCalled();
      expect(onDuplicate).not.toHaveBeenCalled();
      expect(host.querySelector('[data-k103-schedule-delete-confirm]')).toBeNull();
    } finally {
      textarea.remove();
      plaintext.remove();
      shadowHost.remove();
    }
  });

  it('keeps global shortcuts active outside editable controls and suppresses them during IME composition', () => {
    const onEdit = vi.fn();
    const onDuplicate = vi.fn();
    act(() => root.render(createElement(ScheduleEventDetailPanel, {
      block, theme, dateLabel: 'October 26, 2026', onEdit, onDuplicate, onDelete: vi.fn(), onClose: vi.fn(),
    })));

    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true }));
    });
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, isComposing: true }));
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', bubbles: true, keyCode: 229 }));
    });
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-k103-schedule-delete-confirm]')).toBeNull();
  });

  it('suppresses quick-edit Enter during IME composition and keeps ordinary Enter handling active', () => {
    const onEdit = vi.fn();
    act(() => root.render(createElement(ScheduleEventDetailPanel, {
      block, theme, dateLabel: 'October 26, 2026', onEdit, onDelete: vi.fn(), onClose: vi.fn(),
    })));
    act(() => host.querySelector('h3')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const input = host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!;
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, isComposing: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, keyCode: 229 }));
    });
    expect(onEdit).not.toHaveBeenCalled();
    expect(host.querySelector('[data-schedule-event-quick-edit]')).not.toBeNull();
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true })));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('does not cancel quick edit on IME Escape, but preserves Escape cancellation and closes from other editable controls', () => {
    const onClose = vi.fn();
    act(() => root.render(createElement(ScheduleEventDetailPanel, {
      block, theme, dateLabel: 'October 26, 2026', onEdit: vi.fn(), onDelete: vi.fn(), onClose,
    })));
    act(() => host.querySelector('h3')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    const input = host.querySelector<HTMLInputElement>('[data-schedule-event-quick-edit]')!;

    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true, isComposing: true })));
    expect(host.querySelector('[data-schedule-event-quick-edit]')).not.toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true })));
    expect(host.querySelector('[data-schedule-event-quick-edit]')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    const textarea = document.createElement('textarea');
    document.body.append(textarea);
    act(() => textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true })));
    expect(onClose).toHaveBeenCalledTimes(1);
    textarea.remove();
  });
});
