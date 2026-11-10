// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StrengthSet } from '../../../../types';
import type { PreviousWorkoutViewProps } from './PreviousWorkoutView';
import { formatPreviousStrengthReps, formatPreviousStrengthWeight, PreviousWorkoutView } from './PreviousWorkoutView';
import { getTranslator } from '../../../../lib/i18n';

let root: Root | null = null;
let host: HTMLDivElement;
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root?.unmount()); root = null; host.remove(); });

const formatWeight = (value: number | string): string => {
  if (value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : '';
};

function strength(overrides: Partial<StrengthSet> = {}): StrengthSet {
  return { type: 'strength', set: 1, kg: 100, reps: 8, done: true, ...overrides };
}

describe('Previous Workout strength/bodyweight display', () => {
  it('renders a stored strength value with kg', () => {
    expect(formatPreviousStrengthWeight(strength(), 'press', 'strength', formatWeight, 'kg', 'Bodyweight'))
      .toBe('100 kg');
  });

  it('renders a converted strength value with lbs instead of kg', () => {
    expect(formatPreviousStrengthWeight(strength(), 'press', 'strength', () => '220.5', 'lbs', 'Bodyweight'))
      .toBe('220.5 lbs');
    expect(formatPreviousStrengthWeight(strength(), 'press', 'strength', () => '220.5', 'lbs', 'Bodyweight'))
      .not.toBe('220.5 kg');
  });

  it('uses the saved per-set source value for Previous display round trips', () => {
    const saved = strength({ kg: 102.37, weight_source_value: 225.68, weight_source_unit: 'lbs' });
    expect(formatPreviousStrengthWeight(saved, 'press', 'strength', formatWeight, 'kg', 'Bodyweight'))
      .toBe('102.4 kg');
    expect(formatPreviousStrengthWeight(saved, 'press', 'strength', formatWeight, 'lbs', 'Bodyweight'))
      .toBe('225.68 lbs');
  });

  it('uses the canonical bodyweight type instead of missing weight', () => {
    expect(formatPreviousStrengthWeight(strength({ type: 'bodyweight', kg: '' }), 'pull-up', 'strength', formatWeight, 'kg', 'Bodyweight'))
      .toBe('Bodyweight');
  });

  it('renders missing strength weight as a dash, not bodyweight', () => {
    expect(formatPreviousStrengthWeight(strength({ kg: '' }), 'press', 'strength', formatWeight, 'kg', 'Bodyweight'))
      .toBe('—');
    expect(formatPreviousStrengthWeight(strength({ kg: '' }), 'press', 'strength', formatWeight, 'kg', 'Bodyweight'))
      .not.toBe('Bodyweight');
  });

  it('keeps a numeric zero strength weight numeric', () => {
    expect(formatPreviousStrengthWeight(strength({ kg: 0 }), 'press', 'strength', formatWeight, 'kg', 'Bodyweight'))
      .toBe('0 kg');
  });

  it('renders assisted reps as a compact derived split and keeps ordinary reps unchanged', () => {
    expect(formatPreviousStrengthReps(strength({ reps: 12, assisted_reps: 4 }), 'reps', '{unassisted} + {assisted} assisted'))
      .toBe('8 + 4 assisted');
    expect(formatPreviousStrengthReps(strength({ reps: 8 }), 'reps', '{unassisted} + {assisted} assisted'))
      .toBe('8 reps');
  });
});

function previousProps(overrides: Partial<PreviousWorkoutViewProps> = {}): PreviousWorkoutViewProps {
  const session = { date: '2026-08-20', rows: [], matchStrategy: 'date' as const };
  return {
    session, sessions: [session], selectedDate: session.date, isLoading: false, hasError: false,
    theme: { card: '', border: '', input: '', textMuted: '' } as never, darkMode: false,
    t: key => key, formatDate: value => value, formatCompactDate: value => value,
    formatWeight: value => String(value), weightUnit: () => 'kg', onRetry: vi.fn(),
    onSelectDate: vi.fn(), ...overrides,
  };
}

describe('Previous Workout open-day action', () => {
  async function renderView(props: PreviousWorkoutViewProps) {
    await act(async () => root!.render(createElement(PreviousWorkoutView, props)));
  }

  it('shows an accessible native button only for the selected loaded session and calls its owner', async () => {
    const onOpenDay = vi.fn();
    await renderView(previousProps({ onOpenDay }));
    const button = host.querySelector<HTMLButtonElement>('[data-health-open-previous-day]');
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.textContent).toBe('healthOpenPreviousDay');
    await act(async () => button!.click());
    expect(onOpenDay).toHaveBeenCalledTimes(1);

    await renderView(previousProps({ onOpenDay, selectedDate: '2026-08-13' }));
    expect(host.querySelector('[data-health-open-previous-day]')).toBeNull();
    await renderView(previousProps({ onOpenDay, isLoading: true }));
    expect(host.querySelector('[data-health-open-previous-day]')).toBeNull();
    await renderView(previousProps({ onOpenDay, hasError: true }));
    expect(host.querySelector('[data-health-open-previous-day]')).toBeNull();
  });

  it.each([
    ['en', 'Open this day'],
    ['ko', '이 날짜 열기'],
    ['ja', 'この日を開く'],
  ] as const)('has a localized accessible action label for %s', (language, expected) => {
    expect(getTranslator(language)('healthOpenPreviousDay')).toBe(expected);
  });
});
