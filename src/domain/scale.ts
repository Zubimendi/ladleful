import type { Ingredient } from '@/types/recipe';

export function scaleIngredients(
  ingredients: Ingredient[],
  baseServings: number,
  targetServings: number,
): Ingredient[] {
  if (baseServings <= 0 || targetServings <= 0 || baseServings === targetServings) {
    return ingredients;
  }

  const factor = targetServings / baseServings;

  return ingredients.map((ing) => {
    if (ing.qty === null) {
      return ing;
    }
    return {
      ...ing,
      qty: ing.qty * factor,
      qtyMax: ing.qtyMax !== null ? ing.qtyMax * factor : null,
    };
  });
}
