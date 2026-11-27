/// <reference path="../pb_data/types.d.ts" />

// Validation and LWW conflict guard for Ladleful collections
onRecordValidate((e) => {
  const col = e.record.collection().name;
  if (col !== 'recipes' && col !== 'shopping_lists' && col !== 'shopping_items') {
    return e.next();
  }

  const nowMs = Date.now();
  const maxFuture = nowMs + 5 * 60 * 1000;
  const clientTs = e.record.getInt('client_updated_at');
  if (clientTs > maxFuture) {
    e.record.set('client_updated_at', nowMs);
  }

  if (col === 'recipes') {
    const ingredients = e.record.get('ingredients');
    if (Array.isArray(ingredients) && ingredients.length > 300) {
      throw new BadRequestError('Too many ingredients (max 300).');
    }
    const steps = e.record.get('steps');
    if (Array.isArray(steps) && steps.length > 200) {
      throw new BadRequestError('Too many steps (max 200).');
    }
  }

  return e.next();
}, 'recipes', 'shopping_lists', 'shopping_items');

onRecordUpdateRequest((e) => {
  const existing = e.record.original();
  const incomingTs = e.record.getInt('client_updated_at');
  const storedTs = existing.getInt('client_updated_at');

  if (incomingTs > 0 && storedTs > 0 && incomingTs < storedTs) {
    return e.json(409, {
      code: 409,
      message: 'stale_write',
      record: existing,
    });
  }

  return e.next();
}, 'recipes', 'shopping_lists', 'shopping_items');
