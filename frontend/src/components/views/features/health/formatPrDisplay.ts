const KG_PER_LBS = 0.45359237;

export interface PrDisplayLabel {
  displayValue: number;
  displayUnit: 'kg' | 'lbs';
  conversionHint: string | null;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** K-121 — preserve recording units in PR display (display layer only). */
export function formatPrDisplay(
  kg: number,
  blockId: string | undefined,
  weightUnits: Readonly<Record<string, 'kg' | 'lbs'>>,
): PrDisplayLabel {
  const unit = blockId ? (weightUnits[blockId] ?? 'kg') : 'kg';
  if (unit === 'lbs') {
    const lbs = round1(kg / KG_PER_LBS);
    return { displayValue: lbs, displayUnit: 'lbs', conversionHint: `≈${round1(kg)} kg` };
  }
  return {
    displayValue: round1(kg),
    displayUnit: 'kg',
    conversionHint: `≈${round1(kg / KG_PER_LBS)} lbs`,
  };
}
