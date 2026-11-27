import type { Ingredient } from '@/types/recipe';
import { lookupUnit } from './units';

const UNICODE_FRACTIONS: Record<string, string> = {
  '⅛': '1/8',
  '¼': '1/4',
  '⅓': '1/3',
  '⅜': '3/8',
  '½': '1/2',
  '⅝': '5/8',
  '⅔': '2/3',
  '¾': '3/4',
  '⅞': '7/8',
};

const LOCAL_WARN_UNITS = new Set(['derica']);

const NON_UNIT_ADJECTIVES = new Set([
  'red',
  'green',
  'yellow',
  'white',
  'black',
  'brown',
  'fresh',
  'dried',
  'dry',
  'ground',
  'chopped',
  'sliced',
  'diced',
  'minced',
  'crushed',
  'grated',
  'large',
  'medium',
  'small',
  'whole',
  'scotch',
  'sweet',
  'hot',
  'raw',
  'cooked',
  'ripe',
  'boneless',
  'skinless',
  'unsalted',
  'salted',
  'extra',
  'long',
  'short',
  'parboiled',
  'warm',
  'cold',
  'dark',
  'light',
  'heavy',
  'soft',
  'hard',
  'lean',
  'smoked',
  'roasted',
  'toasted',
  'fried',
  'boiled',
]);

function normalizeUnicodeFractions(str: string): string {
  let out = str;
  for (const [sym, frac] of Object.entries(UNICODE_FRACTIONS)) {
    // Handle attached whole number like "1½" -> "1 1/2"
    out = out.replace(new RegExp(`(\\d)${sym}`, 'g'), `$1 ${frac}`);
    out = out.replace(new RegExp(sym, 'g'), frac);
  }
  return out;
}

function stripListMarkers(line: string): string {
  let s = line.trim();
  // Remove bullet markers: -, *, •, –
  s = s.replace(/^[-*•–—]\s+/, '');
  // Remove leading numbering like "1. " (a decimal like "1.5" has no space after the dot)
  s = s.replace(/^\d+\.\s+/, '');
  return s.trim();
}

function parseSingleNumber(token: string): number | null {
  const mixed = token.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const den = Number(mixed[3]);
    if (den !== 0) return Number(mixed[1]) + Number(mixed[2]) / den;
  }
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const den = Number(frac[2]);
    if (den !== 0) return Number(frac[1]) / den;
  }
  const dec = Number(token);
  if (Number.isFinite(dec) && token.trim() !== '') return dec;
  return null;
}

interface QtyParseResult {
  qty: number | null;
  qtyMax: number | null;
  rest: string;
}

function extractLeadingQuantity(input: string): QtyParseResult {
  // Handle "a pinch of..." / "an onion" -> qty 1 if followed by known unit
  const articleMatch = input.match(/^(?:a|an)\s+(.+)$/i);
  if (articleMatch) {
    const afterArticle = articleMatch[1]!.trim();
    const firstWord = afterArticle.split(/\s+/)[0] ?? '';
    if (lookupUnit(firstWord)) {
      return { qty: 1, qtyMax: null, rest: afterArticle };
    }
  }

  // Normalize en/em dashes in ranges and attached units like "500g" -> "500 g"
  const s = input
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2')
    .replace(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\b/, '$1 $2');

  // Range: mixed/frac/dec - mixed/frac/dec  OR  ... to ...
  const numPattern = '(?:\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:\\.\\d+)?)';
  const rangeRegex = new RegExp(`^(${numPattern})\\s*(?:-|to)\\s*(${numPattern})(?:\\s+|$)(.*)$`, 'i');
  const rangeMatch = s.match(rangeRegex);
  if (rangeMatch) {
    const q1 = parseSingleNumber(rangeMatch[1]!);
    const q2 = parseSingleNumber(rangeMatch[2]!);
    if (q1 !== null && q2 !== null) {
      return { qty: q1, qtyMax: q2, rest: (rangeMatch[3] ?? '').trim() };
    }
  }

  // Single quantity (mixed, fraction, decimal, integer)
  const singleRegex = new RegExp(`^(${numPattern})(?:\\s+|$)(.*)$`);
  const singleMatch = s.match(singleRegex);
  if (singleMatch) {
    const q = parseSingleNumber(singleMatch[1]!);
    if (q !== null) {
      return { qty: q, qtyMax: null, rest: (singleMatch[2] ?? '').trim() };
    }
  }

  return { qty: null, qtyMax: null, rest: input };
}

export function parseIngredient(rawLine: string, currentGroup: string | null = null): Ingredient {
  const raw = rawLine;
  const cleaned = stripListMarkers(rawLine);

  if (!cleaned) {
    return {
      raw,
      qty: null,
      qtyMax: null,
      unit: null,
      name: '',
      note: null,
      group: currentGroup,
      warn: true,
    };
  }

  // Group heading check: ends with ":" and has no leading number
  if (cleaned.endsWith(':') && !/^\d/.test(cleaned)) {
    const heading = cleaned.slice(0, -1).trim();
    return {
      raw,
      qty: null,
      qtyMax: null,
      unit: null,
      name: heading,
      note: null,
      group: heading,
      warn: false,
    };
  }

  const normalized = normalizeUnicodeFractions(cleaned);
  let { qty, qtyMax, rest } = extractLeadingQuantity(normalized);

  // Extract parenthetical notes before unit matching, e.g. "1 (400 g) tin tomatoes"
  const parenNotes: string[] = [];
  rest = rest.replace(/\(([^)]+)\)/g, (_, inner: string) => {
    parenNotes.push(inner.trim());
    return ' ';
  });
  rest = rest.replace(/\s+/g, ' ').trim();

  // If no leading qty was found, check if a parenNote had the only quantity (e.g. "tomatoes (400 g)")
  // Per spec: parentheses become part of note unless it contains the only quantity
  if (qty === null && parenNotes.length === 1) {
    const innerQty = extractLeadingQuantity(parenNotes[0]!);
    if (innerQty.qty !== null && innerQty.rest.length > 0) {
      const possibleUnit = lookupUnit(innerQty.rest);
      if (possibleUnit) {
        qty = innerQty.qty;
        qtyMax = innerQty.qtyMax;
        parenNotes.pop();
        rest = `${possibleUnit.canonical} ${rest}`.trim();
      }
    }
  }

  // Unit matching
  let unit: string | null = null;
  let warn = false;

  if (qty !== null && rest.length > 0) {
    const tokens = rest.split(/\s+/);
    // Two-token unit check (e.g. "fl oz")
    if (tokens.length >= 3) {
      const twoTok = `${tokens[0]} ${tokens[1]}`;
      const def2 = lookupUnit(twoTok);
      if (def2) {
        unit = def2.canonical;
        rest = tokens.slice(2).join(' ');
      }
    }

    if (unit === null && tokens.length >= 1) {
      const firstTok = tokens[0]!;
      const def1 = lookupUnit(firstTok);
      if (def1) {
        unit = def1.canonical;
        if (LOCAL_WARN_UNITS.has(def1.canonical)) {
          warn = true;
        }
        rest = tokens.slice(1).join(' ');
      } else if (
        tokens.length >= 3 &&
        /^[a-zA-Z]{2,12}$/.test(firstTok) &&
        !NON_UNIT_ADJECTIVES.has(firstTok.toLowerCase())
      ) {
        // Unknown unit accepted only when qty exists and at least 2 more tokens remain
        unit = firstTok.toLowerCase();
        warn = true;
        rest = tokens.slice(1).join(' ');
      }
    }
  }

  // Strip leading "of " after unit
  if (unit !== null) {
    rest = rest.replace(/^of\s+/i, '').trim();
  }

  // Split name and note at first comma
  let namePart = rest;
  let commaNote: string | null = null;
  const commaIdx = rest.indexOf(',');
  if (commaIdx !== -1) {
    namePart = rest.slice(0, commaIdx).trim();
    const afterComma = rest.slice(commaIdx + 1).trim();
    if (afterComma) {
      commaNote = afterComma;
    }
  }

  // Handle "to taste" suffix when qty is null (e.g., "salt to taste")
  let toTasteNote: string | null = null;
  if (qty === null) {
    const toTasteMatch = namePart.match(/^(.+?)\s+(to taste)$/i);
    if (toTasteMatch) {
      namePart = toTasteMatch[1]!.trim();
      toTasteNote = toTasteMatch[2]!.toLowerCase();
    }
  }

  const noteParts = [...parenNotes, ...(commaNote ? [commaNote] : []), ...(toTasteNote ? [toTasteNote] : [])];
  const note = noteParts.length > 0 ? noteParts.join(', ') : null;

  let name = namePart.trim();
  if (!name) {
    name = raw.trim();
    warn = true;
  }

  return {
    raw,
    qty,
    qtyMax,
    unit,
    name,
    note,
    group: currentGroup,
    warn,
  };
}

export function parseIngredientLines(text: string): Ingredient[] {
  const lines = text.split(/\r?\n/);
  const result: Ingredient[] = [];
  let currentGroup: string | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const parsed = parseIngredient(line, currentGroup);
    if (parsed.group && parsed.qty === null && line.trim().endsWith(':')) {
      currentGroup = parsed.group;
      continue;
    }
    result.push(parsed);
  }

  return result;
}
