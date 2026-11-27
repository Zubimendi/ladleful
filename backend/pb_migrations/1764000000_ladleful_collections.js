/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId('users');

  const recipes = new Collection({
    name: 'recipes',
    type: 'base',
    listRule: '@request.auth.id != "" && owner = @request.auth.id',
    viewRule: '@request.auth.id != "" && owner = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.owner = @request.auth.id',
    updateRule: '@request.auth.id != "" && owner = @request.auth.id && @request.body.owner:isset = false',
    deleteRule: null,
    fields: [
      { name: 'owner', type: 'relation', required: true, collectionId: usersCollection.id, maxSelect: 1 },
      { name: 'title', type: 'text', required: true, min: 1, max: 200 },
      { name: 'description', type: 'text', max: 2000 },
      { name: 'servings', type: 'number', required: true, min: 0.1, max: 1000 },
      { name: 'prep_minutes', type: 'number', min: 0, max: 10080 },
      { name: 'cook_minutes', type: 'number', min: 0, max: 10080 },
      { name: 'ingredients', type: 'json', required: true, maxSize: 200000 },
      { name: 'steps', type: 'json', required: true, maxSize: 200000 },
      { name: 'notes', type: 'text', max: 5000 },
      { name: 'source_url', type: 'text', max: 2000 },
      { name: 'source_name', type: 'text', max: 200 },
      { name: 'tags', type: 'json', maxSize: 20000 },
      { name: 'is_favorite', type: 'bool' },
      { name: 'times_cooked', type: 'number', min: 0 },
      { name: 'last_cooked_at', type: 'number' },
      { name: 'client_updated_at', type: 'number', required: true },
      { name: 'deleted_at', type: 'number' },
    ],
  });
  app.save(recipes);

  const shoppingLists = new Collection({
    name: 'shopping_lists',
    type: 'base',
    listRule: '@request.auth.id != "" && owner = @request.auth.id',
    viewRule: '@request.auth.id != "" && owner = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.owner = @request.auth.id',
    updateRule: '@request.auth.id != "" && owner = @request.auth.id && @request.body.owner:isset = false',
    deleteRule: null,
    fields: [
      { name: 'owner', type: 'relation', required: true, collectionId: usersCollection.id, maxSelect: 1 },
      { name: 'name', type: 'text', required: true, min: 1, max: 200 },
      { name: 'archived', type: 'bool' },
      { name: 'client_updated_at', type: 'number', required: true },
      { name: 'deleted_at', type: 'number' },
    ],
  });
  app.save(shoppingLists);

  const shoppingItems = new Collection({
    name: 'shopping_items',
    type: 'base',
    listRule: '@request.auth.id != "" && owner = @request.auth.id',
    viewRule: '@request.auth.id != "" && owner = @request.auth.id',
    createRule: '@request.auth.id != "" && @request.body.owner = @request.auth.id',
    updateRule: '@request.auth.id != "" && owner = @request.auth.id && @request.body.owner:isset = false',
    deleteRule: null,
    fields: [
      { name: 'owner', type: 'relation', required: true, collectionId: usersCollection.id, maxSelect: 1 },
      { name: 'list', type: 'text', required: true },
      { name: 'name', type: 'text', required: true, min: 1, max: 300 },
      { name: 'merge_key', type: 'text', required: true, max: 350 },
      { name: 'quantity', type: 'number' },
      { name: 'unit', type: 'text', max: 40 },
      { name: 'aisle', type: 'text', required: true, max: 40 },
      { name: 'checked', type: 'bool' },
      { name: 'origin', type: 'text', required: true },
      { name: 'sources', type: 'json', maxSize: 50000 },
      { name: 'note', type: 'text', max: 300 },
      { name: 'sort_order', type: 'number' },
      { name: 'client_updated_at', type: 'number', required: true },
      { name: 'deleted_at', type: 'number' },
    ],
  });
  app.save(shoppingItems);
}, (app) => {
  for (const name of ['shopping_items', 'shopping_lists', 'recipes']) {
    try {
      const col = app.findCollectionByNameOrId(name);
      app.delete(col);
    } catch {
      // ignore if missing
    }
  }
});
