export type UnitFamily = 'mass' | 'volume_metric' | 'volume_spoon' | 'count' | 'other';

export interface UnitDef {
  canonical: string;
  family: UnitFamily;
  toBase: number;
  aliases: string[];
}

export const UNIT_DEFS: UnitDef[] = [
  // Mass (base: g)
  { canonical: 'g', family: 'mass', toBase: 1, aliases: ['g', 'gram', 'grams', 'gm', 'gms'] },
  {
    canonical: 'kg',
    family: 'mass',
    toBase: 1000,
    aliases: ['kg', 'kgs', 'kilogram', 'kilograms', 'kilo', 'kilos'],
  },
  { canonical: 'oz', family: 'mass', toBase: 28.3495, aliases: ['oz', 'ounce', 'ounces'] },
  { canonical: 'lb', family: 'mass', toBase: 453.592, aliases: ['lb', 'lbs', 'pound', 'pounds'] },

  // Volume metric (base: ml)
  {
    canonical: 'ml',
    family: 'volume_metric',
    toBase: 1,
    aliases: ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'],
  },
  {
    canonical: 'l',
    family: 'volume_metric',
    toBase: 1000,
    aliases: ['l', 'litre', 'litres', 'liter', 'liters'],
  },

  // Volume spoon/cup (base: tsp)
  {
    canonical: 'tsp',
    family: 'volume_spoon',
    toBase: 1,
    aliases: ['tsp', 'tsps', 'teaspoon', 'teaspoons'],
  },
  {
    canonical: 'tbsp',
    family: 'volume_spoon',
    toBase: 3,
    aliases: ['tbsp', 'tbsps', 'tbs', 'tbl', 'tablespoon', 'tablespoons'],
  },
  {
    canonical: 'cup',
    family: 'volume_spoon',
    toBase: 48,
    aliases: ['cup', 'cups', 'c'],
  },

  // Count (base: count)
  {
    canonical: 'piece',
    family: 'count',
    toBase: 1,
    aliases: ['piece', 'pieces', 'pc', 'pcs'],
  },

  // Other (exact unit string only, no cross-unit conversion)
  { canonical: 'fl oz', family: 'other', toBase: 1, aliases: ['fl oz', 'fluid ounce', 'fluid ounces'] },
  { canonical: 'clove', family: 'other', toBase: 1, aliases: ['clove', 'cloves'] },
  { canonical: 'slice', family: 'other', toBase: 1, aliases: ['slice', 'slices'] },
  { canonical: 'pinch', family: 'other', toBase: 1, aliases: ['pinch', 'pinches'] },
  { canonical: 'bunch', family: 'other', toBase: 1, aliases: ['bunch', 'bunches'] },
  { canonical: 'tin', family: 'other', toBase: 1, aliases: ['tin', 'tins'] },
  { canonical: 'can', family: 'other', toBase: 1, aliases: ['can', 'cans'] },
  { canonical: 'pack', family: 'other', toBase: 1, aliases: ['pack', 'packs'] },
  { canonical: 'packet', family: 'other', toBase: 1, aliases: ['packet', 'packets', 'sachet', 'sachets'] },
  { canonical: 'cube', family: 'other', toBase: 1, aliases: ['cube', 'cubes'] },
  { canonical: 'stick', family: 'other', toBase: 1, aliases: ['stick', 'sticks'] },
  { canonical: 'sprig', family: 'other', toBase: 1, aliases: ['sprig', 'sprigs'] },
  { canonical: 'derica', family: 'other', toBase: 1, aliases: ['derica', 'dericas'] },
  { canonical: 'head', family: 'other', toBase: 1, aliases: ['head', 'heads'] },
  { canonical: 'stalk', family: 'other', toBase: 1, aliases: ['stalk', 'stalks'] },
  { canonical: 'leaf', family: 'other', toBase: 1, aliases: ['leaf', 'leaves'] },
  { canonical: 'drop', family: 'other', toBase: 1, aliases: ['drop', 'drops'] },
  { canonical: 'dash', family: 'other', toBase: 1, aliases: ['dash', 'dashes'] },
  { canonical: 'handful', family: 'other', toBase: 1, aliases: ['handful', 'handfuls'] },
  { canonical: 'bag', family: 'other', toBase: 1, aliases: ['bag', 'bags'] },
  { canonical: 'bottle', family: 'other', toBase: 1, aliases: ['bottle', 'bottles'] },
  { canonical: 'jar', family: 'other', toBase: 1, aliases: ['jar', 'jars'] },
  { canonical: 'sheet', family: 'other', toBase: 1, aliases: ['sheet', 'sheets'] },
];

const ALIAS_MAP = new Map<string, UnitDef>();
for (const def of UNIT_DEFS) {
  for (const alias of def.aliases) {
    ALIAS_MAP.set(alias.toLowerCase(), def);
  }
}

export function lookupUnit(token: string): UnitDef | null {
  const cleaned = token.trim().toLowerCase().replace(/\.$/, '');
  return ALIAS_MAP.get(cleaned) ?? null;
}

export function getUnitFamily(unit: string | null): UnitFamily {
  if (!unit) return 'count';
  const def = lookupUnit(unit);
  return def ? def.family : 'other';
}

export function toFamilyBase(qty: number, unit: string | null): { value: number; family: UnitFamily } {
  if (!unit) return { value: qty, family: 'count' };
  const def = lookupUnit(unit);
  if (!def) return { value: qty, family: 'other' };
  return { value: qty * def.toBase, family: def.family };
}

export function fromFamilyBase(
  baseValue: number,
  family: UnitFamily,
  originalUnit: string | null,
): { qty: number; unit: string | null } {
  if (family === 'mass') {
    if (baseValue >= 1000) {
      return { qty: baseValue / 1000, unit: 'kg' };
    }
    return { qty: baseValue, unit: 'g' };
  }
  if (family === 'volume_metric') {
    if (baseValue >= 1000) {
      return { qty: baseValue / 1000, unit: 'l' };
    }
    return { qty: baseValue, unit: 'ml' };
  }
  if (family === 'volume_spoon') {
    if (baseValue >= 48) {
      return { qty: baseValue / 48, unit: 'cup' };
    }
    if (baseValue >= 3) {
      return { qty: baseValue / 3, unit: 'tbsp' };
    }
    return { qty: baseValue, unit: 'tsp' };
  }
  if (family === 'count') {
    return { qty: baseValue, unit: originalUnit };
  }
  return { qty: baseValue, unit: originalUnit };
}
