import { AISLE_LABELS, AISLE_ORDER } from '@/data/aisles';
import { formatMinutes } from '@/domain/duration';
import { formatQuantity } from '@/domain/quantity';
import type { Recipe } from '@/types/recipe';
import type { Aisle, ShoppingItem, ShoppingList } from '@/types/shopping';

export function formatRecipeShareText(recipe: Recipe, targetServings?: number): string {
  const servings = targetServings ?? recipe.servings;
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  const metaParts = [`Serves ${servings}`];
  if (totalMinutes > 0) {
    metaParts.push(formatMinutes(totalMinutes));
  }

  const lines: string[] = [recipe.title, metaParts.join(' · '), ''];

  lines.push('Ingredients:');
  let lastGroup: string | null = null;
  for (const ing of recipe.ingredients) {
    if (ing.group && ing.group !== lastGroup) {
      lines.push(`\n${ing.group}:`);
      lastGroup = ing.group;
    }
    const qtyStr = formatQuantity(ing.qty, ing.unit);
    const main = [qtyStr, ing.name].filter(Boolean).join(' ');
    const full = ing.note ? `${main}, ${ing.note}` : main;
    lines.push(`- ${full}`);
  }

  lines.push('');
  lines.push('Steps:');
  recipe.steps.forEach((step, idx) => {
    lines.push(`${idx + 1}. ${step.text}`);
  });

  if (recipe.notes) {
    lines.push('');
    lines.push(`Notes: ${recipe.notes}`);
  }

  lines.push('');
  if (recipe.sourceUrl) {
    lines.push(`Source: ${recipe.sourceUrl}`);
  }
  lines.push('Shared from Ladleful');

  return lines.join('\n');
}

export function formatShoppingListShareText(list: ShoppingList, items: ShoppingItem[]): string {
  const lines: string[] = [list.name, ''];
  const activeItems = items.filter((i) => i.deletedAt === null);

  const byAisle = new Map<Aisle, ShoppingItem[]>();
  for (const item of activeItems) {
    const arr = byAisle.get(item.aisle) ?? [];
    arr.push(item);
    byAisle.set(item.aisle, arr);
  }

  for (const aisle of AISLE_ORDER) {
    const group = byAisle.get(aisle);
    if (!group || group.length === 0) continue;
    lines.push(`${AISLE_LABELS[aisle]}:`);
    for (const item of group) {
      const box = item.checked ? '[x]' : '[ ]';
      const qty = formatQuantity(item.quantity, item.unit);
      const label = [qty, item.name].filter(Boolean).join(' ');
      lines.push(`${box} ${label}`);
    }
    lines.push('');
  }

  lines.push('Shared from Ladleful');
  return lines.join('\n');
}
