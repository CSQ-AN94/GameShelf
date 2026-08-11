import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { searchGames } from '../src/search.ts';
import type { Game, GameCollection } from '../src/shared.ts';

const game = (values: Partial<Game> & Pick<Game, 'id' | 'title'>): Game => ({
  chineseTitle: '', developer: '', category: '其他游戏', type: 'other', contentRating: 'general', status: 'unplayed', languages: [], description: '', launchProfiles: [],
  ...values
} as Game);

describe('game search', () => {
  it('matches multiple title tokens and user-visible metadata', () => {
    const games = [
      game({ id: 'fate', title: 'Fate/stay night', chineseTitle: '命运之夜', developer: 'TYPE-MOON', category: 'Galgame', type: 'visual_novel', contentRating: 'r18', status: 'playing', launchProfiles: [{ id: 'localized', name: '汉化版', executablePath: 'G:\\Fate\\Fate.exe', workingDirectory: 'G:\\Fate', launchArguments: '', isDefault: true }] }),
      game({ id: 'white-album', title: 'WHITE ALBUM2', category: 'Galgame', type: 'visual_novel', status: 'completed', wishlist: true })
    ];
    const collections = [{ id: 'white-series', name: '白色相簿系列', gameIds: ['white-album'], createdAt: '' }] as GameCollection[];

    assert.deepEqual(searchGames(games, collections, 'fate night').map((item) => item.id), ['fate']);
    assert.deepEqual(searchGames(games, collections, '游玩中').map((item) => item.id), ['fate']);
    assert.deepEqual(searchGames(games, collections, '已玩完 欲玩').map((item) => item.id), ['white-album']);
    assert.deepEqual(searchGames(games, collections, 'R18 type moon').map((item) => item.id), ['fate']);
    assert.deepEqual(searchGames(games, collections, '白色相簿系列').map((item) => item.id), ['white-album']);
    assert.deepEqual(searchGames(games, collections, '汉化版').map((item) => item.id), ['fate']);
  });

  it('does not turn an empty query into every game', () => {
    assert.deepEqual(searchGames([game({ id: 'one', title: 'One' })], [], '   '), []);
  });
});
