import { getUnitFamily } from './units';

const FRACTIONS: Array<{ value: number; symbol: string }> = [
  { value: 0, symbol: '' },
  { value: 0.125, symbol: '⅛' },
  { value: 0.25, symbol: '¼' },
  { value: 1 / 3, symbol: '⅓' },
  { value: 0.5, symbol: '½' },
  { value: 2 / 3, symbol: '⅔' },
  { value: 0.75, symbol: '¾' },
  { value: 1, symbol: '' },
];

const UNICODE_FRAC_VALUES: Record<string, number> = {
  '⅛': 0.125,
  '¼': 0.25,
  '⅓': 1 / 3,
  '⅜': 0.375,
  '½': 0.5,
  '⅝': 0.625,
  '⅔': 2 / 3,
  '¾': 0.75,
  '⅞': 0.875,
};

function roundDecimal(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function formatFractionNumber(value: number): string {
  if (value <= 0) return '0';
  if (value >= 10) {
    return String(Math.round(value));
  }

  let whole = Math.floor(value);
  const rem = value - whole;

  let best = FRACTIONS[0]!;
  let bestDiff = Math.abs(rem - best.value);
  for (const cand of FRACTIONS) {
    const diff = Math.abs(rem - cand.value);
    if (diff < bestDiff) {
      best = cand;
      bestDiff = diff;
    }
  }

  if (best.value === 1) {
    whole += 1;
    return String(whole);
  }
  if (best.value === 0) {
    return whole === 0 ? String(roundDecimal(value, 2)) : String(whole);
  }
  return whole > 0 ? `${whole}${best.symbol}` : best.symbol;
}

export function formatQuantity(value: number | null, unit: string | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  const family = getUnitFamily(unit);

  if (family === 'mass') {
    if (unit === 'g' && value >= 1000) {
      const kg = roundDecimal(value / 1000, 2);
      return `${kg} kg`;
    }
    if (unit === 'g') {
      const rounded = value > 100 ? Math.round(value / 5) * 5 : value >= 10 ? Math.round(value) : roundDecimal(value, 1);
      return `${rounded} g`;
    }
    if (unit === 'kg') {
      return `${roundDecimal(value, 2)} kg`;
    }
    return `${roundDecimal(value, 2)} ${unit ?? ''}`.trim();
  }

  if (family === 'volume_metric') {
    if (unit === 'ml' && value >= 1000) {
      const l = roundDecimal(value / 1000, 2);
      return `${l} l`;
    }
    if (unit === 'ml') {
      const rounded = value > 100 ? Math.round(value / 5) * 5 : value >= 10 ? Math.round(value) : roundDecimal(value, 1);
      return `${rounded} ml`;
    }
    if (unit === 'l') {
      return `${roundDecimal(value, 2)} l`;
    }
    return `${roundDecimal(value, 2)} ${unit ?? ''}`.trim();
  }

  const formatted = formatFractionNumber(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatQuantityNumberOnly(value: number | null, unit: string | null): string {
  if (value === null || !Number.isFinite(value)) return '';
  const family = getUnitFamily(unit);

  if (family === 'mass' || family === 'volume_metric') {
    if ((unit === 'g' || unit === 'ml') && value > 100) {
      return String(Math.round(value / 5) * 5);
    }
    if (value >= 10) return String(Math.round(value));
    return String(roundDecimal(value, 2));
  }
  return formatFractionNumber(value);
}

export function parseQuantity(input: string): number | null {
  const s = input.trim();
  if (!s) return null;

  // Replace unicode fractions with space + decimal equivalent
  let normalized = s;
  for (const [sym, val] of Object.entries(UNICODE_FRAC_VALUES)) {
    if (normalized.includes(sym)) {
      const parts = normalized.split(sym);
      const wholePart = parts[0]?.trim();
      const whole = wholePart ? Number(wholePart) : 0;
      if (Number.isFinite(whole) && (parts[1] ?? '').trim() === '') {
        return whole + val;
      }
    }
  }

  // Mixed number: "1 1/2"
  const mixedMatch = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = Number(mixedMatch[1]);
    const num = Number(mixedMatch[2]);
    const den = Number(mixedMatch[3]);
    if (den !== 0) return whole + num / den;
  }

  // Simple fraction: "1/2"
  const fracMatch = normalized.match(/^(\d+)\/(\d+)$/);
  if (fracMatch) {
    const num = Number(fracMatch[1]);
    const den = Number(fracMatch[2]);
    if (den !== 0) return num / den;
  }

  const num = Number(normalized);
  return Number.isFinite(num) && num >= 0 ? num : null;
}
