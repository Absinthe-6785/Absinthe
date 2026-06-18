export type ListDensityMode = 'comfortable' | 'compact' | 'ultra';

export const LIST_DENSITY_STORAGE_KEY = 'absinthe-list-density';
export const DEFAULT_LIST_DENSITY: ListDensityMode = 'comfortable';

const DENSITY_ORDER: readonly ListDensityMode[] = ['comfortable', 'compact', 'ultra'];

export function isListDensityMode(value: string | null | undefined): value is ListDensityMode {
  return value === 'comfortable' || value === 'compact' || value === 'ultra';
}

export function readListDensityMode(): ListDensityMode {
  try {
    const stored = localStorage.getItem(LIST_DENSITY_STORAGE_KEY);
    if (isListDensityMode(stored)) return stored;
  } catch { /* ignore */ }
  return DEFAULT_LIST_DENSITY;
}

export function writeListDensityMode(mode: ListDensityMode): void {
  try {
    localStorage.setItem(LIST_DENSITY_STORAGE_KEY, mode);
  } catch { /* ignore */ }
}

export function cycleListDensityMode(current: ListDensityMode): ListDensityMode {
  const idx = DENSITY_ORDER.indexOf(current);
  return DENSITY_ORDER[(idx + 1) % DENSITY_ORDER.length] ?? DEFAULT_LIST_DENSITY;
}

export interface ListDensityStyles {
  noteItemPadding: string;
  noteItemMinHeight: number;
  traceRowPadding: string;
  traceRowMinHeight: number;
  sectionLabelSize: number;
}

export function listDensityStyles(mode: ListDensityMode): ListDensityStyles {
  if (mode === 'ultra') {
    return {
      noteItemPadding: '4px 8px',
      noteItemMinHeight: 32,
      traceRowPadding: '2px 8px',
      traceRowMinHeight: 24,
      sectionLabelSize: 8,
    };
  }
  if (mode === 'compact') {
    return {
      noteItemPadding: '6px 9px',
      noteItemMinHeight: 36,
      traceRowPadding: '3px 9px',
      traceRowMinHeight: 26,
      sectionLabelSize: 9,
    };
  }
  return {
    noteItemPadding: '8px 10px',
    noteItemMinHeight: 44,
    traceRowPadding: '4px 10px',
    traceRowMinHeight: 28,
    sectionLabelSize: 9,
  };
}
