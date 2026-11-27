import { formatMinutes } from '@/domain/duration';
import { formatQuantity } from '@/domain/quantity';
import type { Recipe } from '@/types/recipe';

export function formatRecipeMarkdown(recipe: Recipe): string {
  const lines: string[] = [`# ${recipe.title}`, ''];

  if (recipe.description) {
    lines.push(recipe.description, '');
  }

  const meta: string[] = [`**Servings:** ${recipe.servings}`];
  if (recipe.prepMinutes) meta.push(`**Prep:** ${formatMinutes(recipe.prepMinutes)}`);
  if (recipe.cookMinutes) meta.push(`**Cook:** ${formatMinutes(recipe.cookMinutes)}`);
  if (recipe.tags.length > 0) meta.push(`**Tags:** ${recipe.tags.join(', ')}`);
  lines.push(meta.join(' · '), '');

  lines.push('## Ingredients', '');
  let lastGroup: string | null = null;
  for (const ing of recipe.ingredients) {
    if (ing.group && ing.group !== lastGroup) {
      lines.push(`### ${ing.group}`, '');
      lastGroup = ing.group;
    }
    const qtyStr = formatQuantity(ing.qty, ing.unit);
    const main = [qtyStr, ing.name].filter(Boolean).join(' ');
    const full = ing.note ? `${main}, ${ing.note}` : main;
    lines.push(`- ${full}`);
  }
  lines.push('');

  lines.push('## Steps', '');
  recipe.steps.forEach((step, idx) => {
    lines.push(`${idx + 1}. ${step.text}`);
  });
  lines.push('');

  if (recipe.notes) {
    lines.push('## Notes', '', recipe.notes, '');
  }

  if (recipe.sourceUrl || recipe.sourceName) {
    const src = recipe.sourceUrl
      ? `[${recipe.sourceName ?? recipe.sourceUrl}](${recipe.sourceUrl})`
      : recipe.sourceName;
    lines.push(`*Source: ${src}*`);
  }

  return lines.join('\n');
}
