import { buildStarterRecipes } from '@/data/starterRecipes';
import { serializeBackup } from '@/export/backup';
import { formatRecipeShareText } from '@/export/shareText';
import { resolveConflictRecipes, validateAndPlanBackup } from '@/import/backup';

describe('backup round-trip and validation', () => {
  it('round-trips starter recipes with zero field differences', () => {
    const recipes = buildStarterRecipes(1764000000000);
    const json = serializeBackup(recipes, [], new Map(), 1764000000000);
    const plan = validateAndPlanBackup(json, new Set());
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;

    expect(plan.value.newRecipeCount).toBe(recipes.length);
    expect(plan.value.invalidRecipeCount).toBe(0);
    expect(plan.value.recipes).toEqual(recipes);
  });

  it('rejects newer schema versions and invalid files', () => {
    const newer = JSON.stringify({ app: 'ladleful', schemaVersion: 99, exportedAt: 1, recipes: [] });
    const res1 = validateAndPlanBackup(newer, new Set());
    expect(res1.ok).toBe(false);
    if (!res1.ok && res1.error.kind === 'import') {
      expect(res1.error.subtype).toBe('newerVersion');
    }

    const wrongApp = JSON.stringify({ app: 'other', schemaVersion: 1, exportedAt: 1, recipes: [] });
    const res2 = validateAndPlanBackup(wrongApp, new Set());
    expect(res2.ok).toBe(false);
  });

  it('handles skip, replace, and keepBoth conflict modes', () => {
    const recipes = buildStarterRecipes(1764000000000);
    const existing = new Set([recipes[0]!.id]);

    expect(resolveConflictRecipes(recipes, existing, 'skip')).toHaveLength(2);
    expect(resolveConflictRecipes(recipes, existing, 'replace')).toHaveLength(3);

    const kept = resolveConflictRecipes(recipes, existing, 'keepBoth');
    expect(kept).toHaveLength(3);
    expect(kept[0]!.id).not.toBe(recipes[0]!.id);
    expect(kept[0]!.title).toContain('(imported)');
  });
});

describe('shareText', () => {
  it('formats recipe share text', () => {
    const recipe = buildStarterRecipes(1764000000000)[0]!;
    const text = formatRecipeShareText(recipe);
    expect(text).toContain('Tomato stew base');
    expect(text).toContain('Serves 8 · 55 min');
    expect(text).toContain('Shared from Ladleful');
  });
});
