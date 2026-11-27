import type { RecipeDraft } from '@/types/recipe';

const INGREDIENT_HEADINGS = /^(?:ingredients|ingredient list):?$/i;
const STEP_HEADINGS = /^(?:method|steps|directions|instructions|preparation):?$/i;

function cleanLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*•–—]\s+/, '')
    .replace(/^\d+[.)]\s+(?=\D)/, '')
    .trim();
}

export function splitPastedText(rawText: string): RecipeDraft {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim());
  const nonEmpty = lines.filter((l) => l.length > 0);

  if (nonEmpty.length === 0) {
    return {
      title: '',
      description: null,
      servings: 4,
      prepMinutes: null,
      cookMinutes: null,
      ingredientsText: '',
      stepsText: '',
      notes: null,
      sourceUrl: null,
      sourceName: null,
      tags: [],
      warnings: ['Nothing to split. Paste a recipe with Ingredients and Steps headings.'],
    };
  }

  const title = cleanLine(nonEmpty[0]!);
  let mode: 'preamble' | 'ingredients' | 'steps' = 'preamble';
  const ingredients: string[] = [];
  const steps: string[] = [];
  const preamble: string[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const line = nonEmpty[i]!;
    if (INGREDIENT_HEADINGS.test(line)) {
      mode = 'ingredients';
      continue;
    }
    if (STEP_HEADINGS.test(line)) {
      mode = 'steps';
      continue;
    }

    const cleaned = cleanLine(line);
    if (!cleaned) continue;

    if (mode === 'ingredients') {
      ingredients.push(cleaned);
    } else if (mode === 'steps') {
      steps.push(cleaned);
    } else {
      preamble.push(cleaned);
    }
  }

  const warnings: string[] = [];
  if (ingredients.length === 0 && steps.length === 0) {
    warnings.push('No Ingredients or Steps headings detected. Put everything in Steps for you to adjust.');
    return {
      title: title.slice(0, 200),
      description: null,
      servings: 4,
      prepMinutes: null,
      cookMinutes: null,
      ingredientsText: '',
      stepsText: preamble.join('\n'),
      notes: null,
      sourceUrl: null,
      sourceName: null,
      tags: [],
      warnings,
    };
  }

  if (ingredients.length === 0) {
    warnings.push('No ingredients section found.');
  }
  if (steps.length === 0) {
    warnings.push('No steps section found.');
  }

  return {
    title: title.slice(0, 200),
    description: preamble.length > 0 ? preamble.join(' ').slice(0, 500) : null,
    servings: 4,
    prepMinutes: null,
    cookMinutes: null,
    ingredientsText: ingredients.join('\n'),
    stepsText: steps.join('\n'),
    notes: null,
    sourceUrl: null,
    sourceName: null,
    tags: [],
    warnings,
  };
}
