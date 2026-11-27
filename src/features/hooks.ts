import { useEffect, useState } from 'react';
import { ensureDatabaseInitialized, getDbExecutor, notifyDbChanged, subscribeDbChanges } from '@/db/client';
import { importRecipesBatch } from '@/db/repositories/recipes';
import { parseIngredientLines } from '@/domain/ingredient';
import { now } from '@/lib/clock';
import { generateId } from '@/lib/id';
import type { Recipe } from '@/types/recipe';

export function useDbVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    ensureDatabaseInitialized();
    return subscribeDbChanges(() => setVersion((v) => v + 1));
  }, []);
  return version;
}

export function generateDemoLibrary(count = 1000): number {
  const db = getDbExecutor();
  const baseTime = now();
  const proteins = ['Chicken', 'Beef', 'Tilapia', 'Goat', 'Egg', 'Tofu', 'Shrimp', 'Beans'];
  const styles = ['Stew', 'Rice', 'Soup', 'Porridge', 'Stir-fry', 'Roast', 'Salad', 'Grill'];
  const regions = ['Smoky', 'Spiced', 'Herb', 'Coconut', 'Tomato', 'Garlic', 'Ginger', 'Pepper'];
  const tagsPool = ['quick', 'dinner', 'stew', 'rice', 'soup', 'weekend', 'lunch', 'nigerian'];

  const batch: Recipe[] = [];
  for (let i = 0; i < count; i++) {
    const title = `${regions[i % regions.length]} ${proteins[(i * 3) % proteins.length]} ${styles[(i * 7) % styles.length]} #${i + 1}`;
    const ingLines = [
      `${(i % 4) + 1} cups ${proteins[i % proteins.length]!.toLowerCase()}`,
      `2 tbsp vegetable oil`,
      `1 onion, chopped`,
      `salt to taste`,
    ].join('\n');
    batch.push({
      id: generateId(),
      title,
      description: 'Generated demo recipe for performance benchmarking.',
      servings: 4,
      prepMinutes: 10 + (i % 15),
      cookMinutes: 15 + (i % 40),
      ingredients: parseIngredientLines(ingLines),
      steps: [{ text: 'Prep all ingredients and cook for 20 minutes until tender.' }],
      notes: null,
      sourceUrl: null,
      sourceName: 'Demo Generator',
      imagePath: null,
      thumbPath: null,
      tags: [tagsPool[i % tagsPool.length]!, tagsPool[(i + 2) % tagsPool.length]!],
      isFavorite: i % 9 === 0,
      timesCooked: i % 5,
      lastCookedAt: null,
      createdAt: baseTime - i * 1000,
      updatedAt: baseTime - i * 1000,
      deletedAt: null,
    });
  }

  const res = importRecipesBatch(db, batch, notifyDbChanged);
  return res.ok ? res.value : 0;
}
