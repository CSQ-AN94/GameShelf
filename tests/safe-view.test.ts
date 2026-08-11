import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applySafeView } from '../src/safe-view.ts';
import type { Game, GameCollection } from '../src/shared.ts';

describe('safe view projection', () => {
  it('removes hidden titles and every collection that could reveal them', () => {
    const visible = { id: 'visible', title: 'Public Game', hideInSafeView: false } as Game;
    const hidden = { id: 'hidden', title: 'Private Game', hideInSafeView: true, lastPlayedAt: '2026-08-11T00:00:00.000Z', totalPlaySeconds: 999 } as Game;
    const collections = [
      { id: 'public', name: 'Public Series', gameIds: ['visible'], createdAt: '' },
      { id: 'private', name: 'Private Series', gameIds: ['hidden'], createdAt: '' },
      { id: 'mixed', name: 'Mixed Series', gameIds: ['visible', 'hidden'], createdAt: '' }
    ] as GameCollection[];

    const safe = applySafeView([visible, hidden], collections, true);
    assert.deepEqual(safe.games.map((game) => game.id), ['visible']);
    assert.deepEqual(safe.collections.map((collection) => collection.id), ['public']);
    assert.equal(JSON.stringify(safe).includes('Private Game'), false);
    assert.equal(JSON.stringify(safe).includes('999'), false);
    assert.deepEqual(applySafeView([visible, hidden], collections, false), { games: [visible, hidden], collections });
  });
});
