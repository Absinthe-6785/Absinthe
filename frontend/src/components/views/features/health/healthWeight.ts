import type { StrengthSet } from '../../../../types';

export type WeightUnit = 'kg' | 'lbs';

export const KG_PER_LBS = 0.45359237;

type WeightSource = { value: number; unit: WeightUnit };

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function roundWeightSource(value: number | string): number | null {
  const parsed = finiteNumber(value);
  return parsed === null || parsed < 0 ? null : round(parsed, 2);
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value;
  return from === 'lbs' ? value * KG_PER_LBS : value / KG_PER_LBS;
}

export function canonicalWeightKg(value: number, unit: WeightUnit): number {
  return round(convertWeight(value, unit, 'kg'), 2);
}

export function formatWeightNumber(value: number, decimals: number): string {
  const rounded = round(value, decimals);
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

export function formatCanonicalWeight(kg: number | string, displayUnit: WeightUnit): string {
  const parsed = finiteNumber(kg);
  if (parsed === null || parsed < 0) return '';
  return formatWeightNumber(convertWeight(parsed, 'kg', displayUnit), 1);
}

function hasSourceMetadata(set: Pick<StrengthSet, 'weight_source_value' | 'weight_source_unit'>): boolean {
  return typeof set.weight_source_value === 'number'
    && Number.isFinite(set.weight_source_value)
    && (set.weight_source_unit === 'kg' || set.weight_source_unit === 'lbs');
}

export function savedWeightSource(set: Pick<StrengthSet, 'kg' | 'weight_source_value' | 'weight_source_unit'>): WeightSource | null {
  if (hasSourceMetadata(set)) {
    return { value: set.weight_source_value!, unit: set.weight_source_unit! };
  }
  const legacyKg = finiteNumber(set.kg);
  return legacyKg === null || legacyKg < 0 ? null : { value: legacyKg, unit: 'kg' };
}

export function formatSavedWeight(set: Pick<StrengthSet, 'kg' | 'weight_source_value' | 'weight_source_unit'>, displayUnit: WeightUnit): string {
  const source = savedWeightSource(set);
  if (!source) return '';
  if (source.unit === displayUnit) {
    return formatWeightNumber(source.value, hasSourceMetadata(set) ? 2 : 1);
  }
  return formatWeightNumber(convertWeight(source.value, source.unit, displayUnit), 1);
}

export function editableWeightValue(
  set: Pick<StrengthSet, 'kg' | 'weight_source_value' | 'weight_source_unit' | 'weight_input_raw' | 'weight_input_unit'>,
  displayUnit: WeightUnit,
): string {
  if (set.weight_input_raw !== undefined) {
    const inputUnit = set.weight_input_unit ?? displayUnit;
    if (inputUnit === displayUnit) return set.weight_input_raw;
    const raw = finiteNumber(set.weight_input_raw);
    if (raw !== null && raw >= 0) return formatWeightNumber(convertWeight(raw, inputUnit, displayUnit), 1);
  }
  return formatSavedWeight(set, displayUnit);
}

export function hasWeightInputDraft(
  set: Pick<StrengthSet, 'weight_input_raw' | 'weight_input_unit'>,
): boolean {
  return typeof set.weight_input_raw === 'string'
    && (set.weight_input_unit === 'kg' || set.weight_input_unit === 'lbs');
}

export function inputToCanonicalKg(value: string, unit: WeightUnit): string {
  if (value === '') return '';
  const parsed = finiteNumber(value);
  if (parsed === null || parsed < 0) return '';
  return String(convertWeight(parsed, unit, 'kg'));
}

export function normalizeStrengthSetForSave(
  set: StrengthSet,
  activeUnit: WeightUnit,
): StrengthSet {
  const {
    weight_input_raw: rawInput,
    weight_input_unit: rawInputUnit,
    weight_source_value: sourceValueMetadata,
    weight_source_unit: sourceUnitMetadata,
    ...persisted
  } = set;
  const sourceMetadataExists = sourceValueMetadata !== undefined && sourceUnitMetadata !== undefined;
  if (set.type === 'bodyweight') {
    return sourceMetadataExists
      ? {
        ...persisted,
        weight_source_value: sourceValueMetadata,
        weight_source_unit: sourceUnitMetadata,
      }
      : persisted;
  }

  const hasRawInput = hasWeightInputDraft({ weight_input_raw: rawInput, weight_input_unit: rawInputUnit });
  if (!hasRawInput) {
    // Preserve legacy kg-only records and source-aware records when a user only
    // toggles units or edits a non-weight field.
    return sourceMetadataExists
      ? {
        ...persisted,
        weight_source_value: sourceValueMetadata,
        weight_source_unit: sourceUnitMetadata,
      }
      : persisted;
  }

  const sourceUnit = rawInputUnit ?? activeUnit;
  let sourceValue: number | null;
  if (hasRawInput) {
    sourceValue = roundWeightSource(rawInput!);
  } else if (sourceMetadataExists) {
    const source = { value: sourceValueMetadata!, unit: sourceUnitMetadata! } as WeightSource;
    sourceValue = roundWeightSource(convertWeight(source.value, source.unit, sourceUnit));
  } else {
    const legacyKg = finiteNumber(set.kg);
    sourceValue = legacyKg === null ? null : roundWeightSource(convertWeight(legacyKg, 'kg', sourceUnit));
  }

  if (sourceValue === null) {
    return { ...persisted, kg: '' };
  }
  return {
    ...persisted,
    kg: canonicalWeightKg(sourceValue, sourceUnit),
    weight_source_value: sourceValue,
    weight_source_unit: sourceUnit,
  };
}
