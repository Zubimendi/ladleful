import { parseIngredient, parseIngredientLines } from '@/domain/ingredient';

interface ParserCase {
  input: string;
  qty: number | null;
  qtyMax?: number | null;
  unit: string | null;
  name: string;
  note?: string | null;
  group?: string | null;
  warn?: boolean;
}

const CASES: ParserCase[] = [
  { input: '2 cups rice', qty: 2, unit: 'cup', name: 'rice' },
  { input: '1 1/2 tbsp olive oil', qty: 1.5, unit: 'tbsp', name: 'olive oil' },
  { input: '½ tsp salt', qty: 0.5, unit: 'tsp', name: 'salt' },
  { input: '1½ cups flour', qty: 1.5, unit: 'cup', name: 'flour' },
  { input: '500g tomatoes, chopped', qty: 500, unit: 'g', name: 'tomatoes', note: 'chopped' },
  { input: '2-3 cloves garlic', qty: 2, qtyMax: 3, unit: 'clove', name: 'garlic' },
  { input: 'salt to taste', qty: null, unit: null, name: 'salt', note: 'to taste' },
  { input: '3 large eggs', qty: 3, unit: null, name: 'large eggs' },
  { input: '1 (400 g) tin tomatoes', qty: 1, unit: 'tin', name: 'tomatoes', note: '400 g' },
  { input: '2 derica rice', qty: 2, unit: 'derica', name: 'rice', warn: true },
  { input: 'A pinch of nutmeg', qty: 1, unit: 'pinch', name: 'nutmeg' },
  { input: 'For the sauce:', qty: null, unit: null, name: 'For the sauce', group: 'For the sauce' },
  { input: 'Pepper', qty: null, unit: null, name: 'Pepper' },
  { input: '¼ cup sugar', qty: 0.25, unit: 'cup', name: 'sugar' },
  { input: '⅓ cup milk', qty: 1 / 3, unit: 'cup', name: 'milk' },
  { input: '⅔ cup water', qty: 2 / 3, unit: 'cup', name: 'water' },
  { input: '¾ tsp baking powder', qty: 0.75, unit: 'tsp', name: 'baking powder' },
  { input: '⅛ tsp cayenne pepper', qty: 0.125, unit: 'tsp', name: 'cayenne pepper' },
  { input: '2.5 kg yam', qty: 2.5, unit: 'kg', name: 'yam' },
  { input: '1.25 l chicken stock', qty: 1.25, unit: 'l', name: 'chicken stock' },
  { input: '250 ml vegetable oil', qty: 250, unit: 'ml', name: 'vegetable oil' },
  { input: '4 oz cheddar cheese, grated', qty: 4, unit: 'oz', name: 'cheddar cheese', note: 'grated' },
  { input: '1 lb ground beef', qty: 1, unit: 'lb', name: 'ground beef' },
  { input: '2 lbs chicken thighs', qty: 2, unit: 'lb', name: 'chicken thighs' },
  { input: '3 tbsp. tomato paste', qty: 3, unit: 'tbsp', name: 'tomato paste' },
  { input: '2 tsp. curry powder', qty: 2, unit: 'tsp', name: 'curry powder' },
  { input: '1 bunch ugu leaves, sliced', qty: 1, unit: 'bunch', name: 'ugu leaves', note: 'sliced' },
  { input: '2 cans coconut milk', qty: 2, unit: 'can', name: 'coconut milk' },
  { input: '4 slices bread', qty: 4, unit: 'slice', name: 'bread' },
  { input: '2 stock cubes', qty: 2, unit: null, name: 'stock cubes' },
  { input: '2 cubes maggi', qty: 2, unit: 'cube', name: 'maggi' },
  { input: '1 stick butter, softened', qty: 1, unit: 'stick', name: 'butter', note: 'softened' },
  { input: '3 sprigs fresh thyme', qty: 3, unit: 'sprig', name: 'fresh thyme' },
  { input: '2 bay leaves', qty: 2, unit: null, name: 'bay leaves' },
  { input: '1 head garlic', qty: 1, unit: 'head', name: 'garlic' },
  { input: '2 stalks celery, diced', qty: 2, unit: 'stalk', name: 'celery', note: 'diced' },
  { input: '1 packet yeast', qty: 1, unit: 'packet', name: 'yeast' },
  { input: '1 pack noodles', qty: 1, unit: 'pack', name: 'noodles' },
  { input: '2 pieces fried fish', qty: 2, unit: 'piece', name: 'fried fish' },
  { input: '4 pcs plantain', qty: 4, unit: 'piece', name: 'plantain' },
  { input: '1 handful crayfish', qty: 1, unit: 'handful', name: 'crayfish' },
  { input: '3 drops vanilla extract', qty: 3, unit: 'drop', name: 'vanilla extract' },
  { input: '1 dash bitters', qty: 1, unit: 'dash', name: 'bitters' },
  { input: '2 bottles palm oil', qty: 2, unit: 'bottle', name: 'palm oil' },
  { input: '1 jar peanut butter', qty: 1, unit: 'jar', name: 'peanut butter' },
  { input: '2 sheets nori', qty: 2, unit: 'sheet', name: 'nori' },
  { input: '6 fl oz evaporated milk', qty: 6, unit: 'fl oz', name: 'evaporated milk' },
  { input: '- 2 onions, sliced', qty: 2, unit: null, name: 'onions', note: 'sliced' },
  { input: '* 1 scotch bonnet pepper', qty: 1, unit: null, name: 'scotch bonnet pepper' },
  { input: '• 300g egusi, ground', qty: 300, unit: 'g', name: 'egusi', note: 'ground' },
  { input: '1. 2 cups parboiled rice, washed', qty: 2, unit: 'cup', name: 'parboiled rice', note: 'washed' },
  { input: '2 to 3 tbsp palm oil', qty: 2, qtyMax: 3, unit: 'tbsp', name: 'palm oil' },
  { input: '4–5 red bell peppers (tatashe)', qty: 4, qtyMax: 5, unit: null, name: 'red bell peppers', note: 'tatashe' },
  { input: '1/2 cup chopped cilantro', qty: 0.5, unit: 'cup', name: 'chopped cilantro' },
  { input: '2 1/4 cups all-purpose flour', qty: 2.25, unit: 'cup', name: 'all-purpose flour' },
  { input: '100 grams dark chocolate', qty: 100, unit: 'g', name: 'dark chocolate' },
  { input: '500 millilitres warm water', qty: 500, unit: 'ml', name: 'warm water' },
  { input: '2 litres vegetable broth', qty: 2, unit: 'l', name: 'vegetable broth' },
  { input: '1 kilogram beef brisket', qty: 1, unit: 'kg', name: 'beef brisket' },
  { input: '100g butter (unsalted), melted', qty: 100, unit: 'g', name: 'butter', note: 'unsalted, melted' },
  { input: '2 mudu brown beans', qty: 2, unit: 'mudu', name: 'brown beans', warn: true },
  { input: 'Freshly ground black pepper, optional', qty: null, unit: null, name: 'Freshly ground black pepper', note: 'optional' },
  { input: '200g', qty: 200, unit: 'g', name: '200g', warn: true },
  { input: 'tomatoes (400 g)', qty: 400, unit: 'g', name: 'tomatoes' },
];

describe('parseIngredient (64 table cases)', () => {
  test.each(CASES)('parses "$input"', (tc) => {
    const res = parseIngredient(tc.input);
    expect(res.raw).toBe(tc.input);
    if (tc.qty === null) {
      expect(res.qty).toBeNull();
    } else {
      expect(res.qty).toBeCloseTo(tc.qty, 4);
    }
    if (tc.qtyMax !== undefined) {
      if (tc.qtyMax === null) expect(res.qtyMax).toBeNull();
      else expect(res.qtyMax).toBeCloseTo(tc.qtyMax, 4);
    }
    expect(res.unit).toBe(tc.unit);
    expect(res.name).toBe(tc.name);
    if (tc.note !== undefined) {
      expect(res.note).toBe(tc.note);
    }
    if (tc.group !== undefined) {
      expect(res.group).toBe(tc.group);
    }
    if (tc.warn !== undefined) {
      expect(res.warn).toBe(tc.warn);
    }
  });

  it('tracks group headings across multiple lines', () => {
    const lines = parseIngredientLines('For the marinade:\n2 tbsp soy sauce\n1 clove garlic\nFor the rice:\n2 cups rice');
    expect(lines).toHaveLength(3);
    expect(lines[0]?.group).toBe('For the marinade');
    expect(lines[1]?.group).toBe('For the marinade');
    expect(lines[2]?.group).toBe('For the rice');
  });
});
