import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { moveCategory, orderCategories, parseCategoryOrder } from '../src/category-order.ts';

describe('category order', () => {
  it('keeps a saved order, appends new categories, and moves a dragged category', () => {
    const ordered = orderCategories(['RPG', 'ADV', 'Galgame'], ['Galgame', 'RPG']);
    assert.deepEqual(ordered, ['Galgame', 'RPG', 'ADV']);
    assert.deepEqual(orderCategories(['RPG', 'ADV'], undefined), ['ADV', 'RPG']);
    assert.deepEqual(moveCategory(ordered, 'ADV', 'Galgame'), ['ADV', 'Galgame', 'RPG']);
    assert.deepEqual(moveCategory(ordered, 'missing', 'Galgame'), ordered);
  });

  it('accepts only a small unique string list from preferences', () => {
    assert.deepEqual(parseCategoryOrder('["ADV","ADV","RPG"]'), ['ADV', 'RPG']);
    assert.deepEqual(parseCategoryOrder('{broken'), []);
  });
});
