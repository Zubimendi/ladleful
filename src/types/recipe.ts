export interface Ingredient {
  raw: string;
  qty: number | null;
  qtyMax: number | null;
  unit: string | null;
  name: string;
  note: string | null;
  group: string | null;
  warn: boolean;
}

export interface Step {
  text: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  notes: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  imagePath: string | null;
  thumbPath: string | null;
  tags: string[];
  isFavorite: boolean;
  timesCooked: number;
  lastCookedAt: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface RecipeListItem {
  id: string;
  title: string;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  thumbPath: string | null;
  isFavorite: boolean;
  timesCooked: number;
  updatedAt: number;
  tags: string[];
  matchedIngredients?: string[];
}

export interface RecipeDraft {
  id?: string;
  title: string;
  description: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredientsText: string;
  stepsText: string;
  notes: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  imagePath?: string | null;
  thumbPath?: string | null;
  tags: string[];
  warnings?: string[];
}
