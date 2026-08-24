// @vitest-environment happy-dom
import { act, createElement, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import type { Theme } from '../../../../types';
import type { PreviousWorkoutSession } from './previousWorkoutSession';
import { PreviousWorkoutSheet, type PreviousWorkoutSheetProps } from './PreviousWorkoutSheet';

const theme = {
  card: '',
  border: '',
  input: '',
  textMuted: '',
  text: '',
} as Theme;

const translate = ((key: string) => key) as PreviousWorkoutSheetProps['t'];

const sessions: PreviousWorkoutSession[] = [
  { date: '2026-08-20', rows: [], matchStrategy: 'date' },
  { date: '2026-08-13', rows: [], matchStrategy: 'date' },
];

function sheetProps(overrides: Partial<PreviousWorkoutSheetProps> = {}): Omit<PreviousWorkoutSheetProps, 'open' | 'onOpenChange'> {
  return {
    session: sessions[0]!,
    sessions,
    selectedDate: sessions[0]!.date,
    isLoading: false,
    hasError: false,
    theme,
    darkMode: false,
    t: translate,
    formatDate: date => date,
    formatCompactDate: date => date,
    formatWeight: value => String(value),
    weightUnit: () => 'kg',
    onRetry: () => undefined,
    onSelectDate: () => undefined,
    ...overrides,
  };
}

function Harness({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(sessions[0]!.date);

  return createElement(
    'div',
    null,
    createElement('button', {
      type: 'button',
      'data-test-trigger': 'true',
      onClick: () => setOpen(true),
    }, 'Previous'),
    children,
    createElement(PreviousWorkoutSheet, {
      ...sheetProps({ selectedDate, onSelectDate: setSelectedDate }),
      open,
      onOpenChange: setOpen,
    }),
  );
}

function mount(node: ReactNode): { root: Root; container: HTMLDivElement; unmount: () => void } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return {
    root,
    container,
    unmount: () => {
      act(() => { root.unmount(); });
      container.remove();
    },
  };
}

describe('PreviousWorkoutSheet', () => {
  it('opens as a modal sheet, locks page scroll, and restores focus on close', () => {
    const { container, unmount } = mount(createElement(Harness));
    const trigger = container.querySelector('[data-test-trigger]') as HTMLButtonElement;

    act(() => { trigger.focus(); trigger.click(); });

    const sheet = document.querySelector('[data-health-previous-sheet]');
    expect(sheet).not.toBeNull();
    expect(sheet?.getAttribute('role')).toBe('dialog');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement).toBe(document.querySelector('[data-health-previous-sheet-close]'));
    expect(document.querySelector('[data-health-previous-sheet-scroll]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(document.querySelector('[data-health-previous-sheet]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(trigger);
    unmount();
  });

  it('preserves the selected historical date across close and reopen', () => {
    const { container, unmount } = mount(createElement(Harness));
    const trigger = container.querySelector('[data-test-trigger]') as HTMLButtonElement;

    act(() => { trigger.click(); });
    const dateButton = Array.from(document.querySelectorAll('[data-health-previous-date-browser] button'))
      .find(button => button.textContent === sessions[1]!.date) as HTMLButtonElement;
    act(() => { dateButton.click(); });
    expect(dateButton.getAttribute('aria-pressed')).toBe('true');

    act(() => { (document.querySelector('[data-health-previous-sheet-close]') as HTMLButtonElement).click(); });
    act(() => { trigger.click(); });

    const selected = Array.from(document.querySelectorAll('[data-health-previous-date-browser] button'))
      .find(button => button.getAttribute('aria-pressed') === 'true');
    expect(selected?.textContent).toBe(sessions[1]!.date);
    unmount();
  });

  it('keeps historical content on the sheet scroll owner without nesting PreviousWorkoutView scroll', () => {
    const { container, unmount } = mount(createElement(Harness));
    const trigger = container.querySelector('[data-test-trigger]') as HTMLButtonElement;

    act(() => { trigger.click(); });

    const sheetScroll = document.querySelector('[data-health-previous-sheet-scroll]') as HTMLElement;
    const previousContent = document.querySelector('[data-health-previous-workout]') as HTMLElement;
    expect(sheetScroll.className).toContain('overflow-y-auto');
    expect(previousContent.className).not.toContain('overflow-y-auto');
    unmount();
  });
});
