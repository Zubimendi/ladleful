export type Aisle =
  | 'produce'
  | 'grains'
  | 'proteins'
  | 'dairy'
  | 'spices'
  | 'drinks'
  | 'household'
  | 'other';

export interface ShoppingSource {
  recipeId: string;
  title: string;
  qty: number | null;
  unit: string | null;
}

export interface ShoppingList {
  id: string;
  name: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  itemCount?: number;
  uncheckedCount?: number;
}

export interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  mergeKey: string;
  quantity: number | null;
  unit: string | null;
  aisle: Aisle;
  checked: boolean;
  origin: 'recipe' | 'manual';
  sources: ShoppingSource[];
  note: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
