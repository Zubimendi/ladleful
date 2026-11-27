import { classifyAisle } from '@/data/aisles';
import { parseIngredient } from '@/domain/ingredient';
import { computeMergeKey, mergeShopping, normalizeIngredientName } from '@/domain/shopping';
import type { ShoppingItem } from '@/types/shopping';

describe('aisles & normalization', () => {
  it('classifies local and standard ingredients', () => {
    expect(classifyAisle('egusi')).toBe('grains');
    expect(classifyAisle('scotch bonnet peppers')).toBe('produce');
    expect(classifyAisle('palm oil')).toBe('spices');
    expect(classifyAisle('stockfish')).toBe('proteins');
    expect(classifyAisle('mystery gadget')).toBe('other');
  });

  it('normalizes plurals without breaking ss words', () => {
    expect(normalizeIngredientName('Tomatoes')).toBe('tomato');
    expect(normalizeIngredientName('Onions')).toBe('onion');
    expect(normalizeIngredientName('watercress')).toBe('watercress');
  });
});

describe('mergeShopping', () => {
  it('merges within safe unit families (1 tbsp + 2 tsp -> 1 2/3 tbsp)', () => {
    const existing: ShoppingItem[] = [
      {
        id: 'i1',
        listId: 'l1',
        name: 'vegetable oil',
        mergeKey: computeMergeKey('vegetable oil', 'tbsp'),
        quantity: 1,
        unit: 'tbsp',
        aisle: 'spices',
        checked: true,
        origin: 'recipe',
        sources: [{ recipeId: 'r1', title: 'Stew', qty: 1, unit: 'tbsp' }],
        note: null,
        sortOrder: 0,
        createdAt: 1000,
        updatedAt: 1000,
        deletedAt: null,
      },
    ];

    const res = mergeShopping(
      existing,
      [{ ingredient: parseIngredient('2 tsp vegetable oil'), recipeId: 'r2', recipeTitle: 'Jollof' }],
      [],
      2000,
    );

    expect(res.combinedCount).toBe(1);
    expect(res.newItems).toHaveLength(0);
    const updated = res.updatedItems[0]!;
    expect(updated.checked).toBe(false); // Unchecked because more is needed!
    expect(updated.unit).toBe('tbsp');
    expect(updated.quantity).toBeCloseTo(5 / 3, 4);
    expect(updated.sources).toHaveLength(2);
  });

  it('keeps different unit families separate (2 cups rice vs 500 g rice)', () => {
    const res = mergeShopping(
      [],
      [
        { ingredient: parseIngredient('2 cups rice'), recipeId: 'r1', recipeTitle: 'A' },
        { ingredient: parseIngredient('500 g rice'), recipeId: 'r2', recipeTitle: 'B' },
      ],
      [],
      1000,
    );
    expect(res.newItems).toHaveLength(2);
  });

  it('skips pantry staples and never merges manual items', () => {
    const existing: ShoppingItem[] = [
      {
        id: 'm1',
        listId: 'l1',
        name: 'onions',
        mergeKey: computeMergeKey('onions', null),
        quantity: 2,
        unit: null,
        aisle: 'produce',
        checked: false,
        origin: 'manual',
        sources: [],
        note: null,
        sortOrder: 0,
        createdAt: 1000,
        updatedAt: 1000,
        deletedAt: null,
      },
    ];

    const res = mergeShopping(
      existing,
      [
        { ingredient: parseIngredient('salt to taste'), recipeId: 'r1', recipeTitle: 'Stew' },
        { ingredient: parseIngredient('3 onions'), recipeId: 'r1', recipeTitle: 'Stew' },
      ],
      ['salt'],
      2000,
    );

    expect(res.skippedCount).toBe(1);
    expect(res.newItems).toHaveLength(1); // Manual item untouched; recipe onion added separately
  });
});
