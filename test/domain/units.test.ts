import { formatQuantity, parseQuantity } from '@/domain/quantity';
import { scaleIngredients } from '@/domain/scale';
import { fromFamilyBase, getUnitFamily, lookupUnit, toFamilyBase } from '@/domain/units';
import type { Ingredient } from '@/types/recipe';

describe('units', () => {
  it('resolves canonical units and aliases case-insensitively with optional periods', () => {
    expect(lookupUnit('tbsp')?.canonical).toBe('tbsp');
    expect(lookupUnit('Tablespoons')?.canonical).toBe('tbsp');
    expect(lookupUnit('oz.')?.canonical).toBe('oz');
    expect(lookupUnit('g')?.family).toBe('mass');
    expect(lookupUnit('derica')?.family).toBe('other');
  });

  it('converts within unit families', () => {
    const b1 = toFamilyBase(1, 'tbsp');
    expect(b1).toEqual({ value: 3, family: 'volume_spoon' });

    const b2 = toFamilyBase(1, 'cup');
    expect(b2).toEqual({ value: 48, family: 'volume_spoon' });

    const merged = fromFamilyBase(b1.value + 2, 'volume_spoon', 'tbsp');
    expect(merged.unit).toBe('tbsp');
    expect(merged.qty).toBeCloseTo(5 / 3, 4);
  });

  it('keeps families separate', () => {
    expect(getUnitFamily('cup')).toBe('volume_spoon');
    expect(getUnitFamily('ml')).toBe('volume_metric');
    expect(getUnitFamily('g')).toBe('mass');
    expect(getUnitFamily(null)).toBe('count');
  });
});

describe('formatQuantity & parseQuantity', () => {
  it('formats friendly fractions for spoon/cup/count under 10', () => {
    expect(formatQuantity(1.5, 'cup')).toBe('1½ cup');
    expect(formatQuantity(0.3333, 'tsp')).toBe('⅓ tsp');
    expect(formatQuantity(2.6667, 'cup')).toBe('2⅔ cup');
    expect(formatQuantity(0.25, 'tbsp')).toBe('¼ tbsp');
    expect(formatQuantity(12.4, null)).toBe('12');
  });

  it('formats mass and metric volume and switches to kg/l at 1000', () => {
    expect(formatQuantity(1500, 'g')).toBe('1.5 kg');
    expect(formatQuantity(1000, 'ml')).toBe('1 l');
    expect(formatQuantity(502, 'g')).toBe('500 g');
  });

  it('parses fractions and mixed numbers back', () => {
    expect(parseQuantity('1 1/2')).toBe(1.5);
    expect(parseQuantity('1½')).toBe(1.5);
    expect(parseQuantity('1/4')).toBe(0.25);
    expect(parseQuantity('2.5')).toBe(2.5);
  });
});

describe('scaleIngredients', () => {
  const sample: Ingredient[] = [
    { raw: '2 cups rice', qty: 2, qtyMax: null, unit: 'cup', name: 'rice', note: null, group: null, warn: false },
    { raw: '2-3 cloves garlic', qty: 2, qtyMax: 3, unit: 'clove', name: 'garlic', note: null, group: null, warn: false },
    { raw: 'salt to taste', qty: null, qtyMax: null, unit: null, name: 'salt', note: 'to taste', group: null, warn: false },
  ];

  it('scales quantities and ranges while leaving null quantities unchanged', () => {
    const scaled = scaleIngredients(sample, 4, 6);
    expect(scaled[0]?.qty).toBe(3);
    expect(scaled[1]?.qty).toBe(3);
    expect(scaled[1]?.qtyMax).toBe(4.5);
    expect(scaled[2]?.qty).toBeNull();
  });
});
