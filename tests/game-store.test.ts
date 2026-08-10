import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GameStore } from '../src/game-store.ts';

describe('GameStore', () => {
  it('stores a game and rolls session time into its statistics', () => {
    const store = new GameStore(':memory:');
    const game = store.createGame({
      title: 'Test Game',
      type: 'visual_novel',
      contentRating: 'r18',
      executablePath: 'C:\\Games\\Test\\game.exe',
      workingDirectory: 'C:\\Games\\Test'
    });

    store.recordSession(game.id, new Date('2026-08-10T10:00:00.000Z'), 125.9);
    const updated = store.getGame(game.id);

    assert.deepEqual(updated && {
      title: updated.title,
      status: updated.status,
      totalPlaySeconds: updated.totalPlaySeconds,
      launchCount: updated.launchCount,
      lastPlayedAt: updated.lastPlayedAt
    }, {
      title: 'Test Game',
      status: 'playing',
      totalPlaySeconds: 125,
      launchCount: 1,
      lastPlayedAt: '2026-08-10T10:02:05.000Z'
    });
    store.close();
  });

  it('persists completion, collections, and profile settings', () => {
    const store = new GameStore(':memory:');
    const game = store.createGame({
      title: 'Series Entry',
      type: 'visual_novel',
      contentRating: 'general',
      executablePath: 'C:\\Games\\Series\\game.exe',
      workingDirectory: 'C:\\Games\\Series'
    });
    const collection = store.createCollection('系列作品');

    const completed = store.setStatus(game.id, 'completed');
    const categorized = store.setCategory(game.id, '型月系列');
    store.setGameCollections(game.id, [collection.id]);
    store.setSetting('profile.name', 'Kevin');

    assert.equal(completed.status, 'completed');
    assert.ok(completed.completedAt);
    assert.equal(categorized.category, '型月系列');
    assert.deepEqual(store.listCollections()[0]?.gameIds, [game.id]);
    assert.equal(store.getSetting('profile.name'), 'Kevin');
    store.close();
  });
});
