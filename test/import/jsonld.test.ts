import { extractRecipeFromHtml } from '@/import/jsonld';
import { splitPastedText } from '@/import/text';

describe('jsonld extractor', () => {
  it('extracts single Recipe object', () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: 'Pepper Soup &amp; Yam',
      recipeYield: '4 servings',
      prepTime: 'PT15M',
      cookTime: 'PT45M',
      recipeIngredient: ['500g goat meat', '2 scotch bonnet peppers'],
      recipeInstructions: ['Boil meat.', 'Add spices.'],
      keywords: 'soup, spicy',
      author: { '@type': 'Person', name: 'Chef Ada' },
    })}</script></head></html>`;

    const res = extractRecipeFromHtml(html, 'https://example.com/pepper-soup');
    expect(res).not.toBeNull();
    expect(res!.draft.title).toBe('Pepper Soup & Yam');
    expect(res!.draft.servings).toBe(4);
    expect(res!.draft.prepMinutes).toBe(15);
    expect(res!.draft.cookMinutes).toBe(45);
    expect(res!.draft.tags).toEqual(['soup', 'spicy']);
    expect(res!.draft.sourceName).toBe('Chef Ada');
  });

  it('extracts Recipe from @graph with HowToSection and skips malformed blocks', () => {
    const html = `
      <script type="application/ld+json">{ bad json }</script>
      <script type="application/ld+json">${JSON.stringify({
        '@graph': [
          { '@type': 'WebPage', name: 'Ignore' },
          {
            '@type': 'Recipe',
            name: 'Plantain Porridge',
            recipeIngredient: ['3 unripe plantains', '2 tbsp palm oil'],
            recipeInstructions: [
              {
                '@type': 'HowToSection',
                name: 'Prep',
                itemListElement: [{ '@type': 'HowToStep', text: 'Peel and chop.' }],
              },
            ],
          },
        ],
      })}</script>
    `;
    const res = extractRecipeFromHtml(html, 'https://example.com/porridge');
    expect(res).not.toBeNull();
    expect(res!.draft.title).toBe('Plantain Porridge');
    expect(res!.draft.stepsText).toBe('Peel and chop.');
  });

  it('returns null when no Recipe object exists', () => {
    const html = `<html><script type="application/ld+json">{"@type":"Article","name":"Hello"}</script></html>`;
    expect(extractRecipeFromHtml(html, 'https://example.com')).toBeNull();
  });
});

describe('splitPastedText', () => {
  it('splits title, ingredients, and steps', () => {
    const raw = `
      Quick Egg Sauce
      Ingredients:
      - 4 eggs
      - 2 tomatoes, chopped
      Steps:
      1. Beat eggs.
      2. Fry tomatoes and add eggs.
    `;
    const draft = splitPastedText(raw);
    expect(draft.title).toBe('Quick Egg Sauce');
    expect(draft.ingredientsText).toBe('4 eggs\n2 tomatoes, chopped');
    expect(draft.stepsText).toBe('Beat eggs.\nFry tomatoes and add eggs.');
    expect(draft.warnings).toEqual([]);
  });
});
