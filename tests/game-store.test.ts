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

  it('persists completion, wishlist, collections, and launch profiles', () => {
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
    const configured = store.setGameSettings(game.id, { title: 'Series Entry Remastered', chineseTitle: '系列作品 重制版', wishlist: true, hideInSafeView: true });
    const withArtwork = store.setBackgroundPath(game.id, 'C:\\GameShelf\\backgrounds\\series.jpg');
    const withAlternative = store.saveLaunchProfile(game.id, {
      name: '汉化版',
      executablePath: 'C:\\Games\\Series\\Chinese.exe',
      workingDirectory: 'C:\\Games\\Series',
      launchArguments: '--fullscreen',
      isDefault: true
    });
    store.setGameCollections(game.id, [collection.id]);
    store.setSetting('profile.name', 'Kevin');

    assert.equal(completed.status, 'completed');
    assert.ok(completed.completedAt);
    assert.equal(categorized.category, '型月系列');
    assert.equal(configured.wishlist, true);
    assert.equal(configured.chineseTitle, '系列作品 重制版');
    assert.equal(configured.hideInSafeView, true);
    assert.equal(withArtwork.backgroundPath, 'C:\\GameShelf\\backgrounds\\series.jpg');
    assert.equal(withAlternative.launchProfiles.length, 2);
    assert.equal(withAlternative.launchProfiles[0]?.name, '汉化版');
    assert.equal(withAlternative.executablePath, 'C:\\Games\\Series\\Chinese.exe');
    assert.deepEqual(store.listCollections()[0]?.gameIds, [game.id]);
    assert.equal(store.getSetting('profile.name'), 'Kevin');
    store.close();
  });

  it('removes only the selected library record and its related data', () => {
    const store = new GameStore(':memory:');
    const removed = store.createGame({
      title: 'Remove Me',
      type: 'other',
      contentRating: 'general',
      executablePath: 'C:\\Games\\Remove\\game.exe',
      workingDirectory: 'C:\\Games\\Remove'
    });
    const kept = store.createGame({
      title: 'Keep Me',
      type: 'other',
      contentRating: 'general',
      executablePath: 'C:\\Games\\Keep\\game.exe',
      workingDirectory: 'C:\\Games\\Keep'
    });

    assert.equal(store.removeGame(removed.id), true);
    assert.equal(store.getGame(removed.id), null);
    assert.equal(store.getGame(kept.id)?.title, 'Keep Me');
    store.close();
  });

  it('imports and organizes a reviewed batch atomically', () => {
    const store = new GameStore(':memory:');
    const collection = store.createCollection('系列作品');
    const imported = store.importGames([{
      id: 'batch-game',
      title: 'Batch Game',
      type: 'visual_novel',
      category: 'Galgame',
      contentRating: 'general',
      executablePath: 'C:\\Games\\Batch\\game.exe',
      workingDirectory: 'C:\\Games\\Batch',
      coverPath: null,
      launchProfiles: [
        { name: '默认启动', executablePath: 'C:\\Games\\Batch\\game.exe', isDefault: true },
        { name: '汉化版', executablePath: 'C:\\Games\\Batch\\game_chs.exe', isDefault: false }
      ]
    }]);

    const organized = store.bulkEditGames({ gameIds: [imported[0]!.id], status: 'playing', category: '收藏', hideInSafeView: true, addCollectionIds: [collection.id] });
    assert.equal(organized[0]?.launchProfiles.length, 2);
    assert.equal(organized[0]?.status, 'playing');
    assert.equal(organized[0]?.category, '收藏');
    assert.equal(organized[0]?.hideInSafeView, true);
    assert.deepEqual(store.listCollections()[0]?.gameIds, ['batch-game']);

    assert.throws(() => store.importGames([{
      id: 'duplicate',
      title: 'Duplicate',
      type: 'other',
      category: '其他游戏',
      contentRating: 'general',
      executablePath: 'C:\\Games\\Batch\\GAME.EXE',
      workingDirectory: 'C:\\Games\\Batch',
      coverPath: null,
      launchProfiles: [{ name: '默认启动', executablePath: 'C:\\Games\\Batch\\GAME.EXE', isDefault: true }]
    }]), /启动路径已存在/);
    assert.equal(store.listGames().length, 1);
    store.close();
  });

  it('records reversible packages, save branches, snapshots, and series order', () => {
    const store = new GameStore(':memory:');
    const first = store.createGame({ title: 'First', type: 'other', contentRating: 'general', executablePath: 'C:\\Series\\First\\game.exe', workingDirectory: 'C:\\Series\\First' });
    const second = store.createGame({ title: 'Second', type: 'other', contentRating: 'general', executablePath: 'C:\\Series\\Second\\game.exe', workingDirectory: 'C:\\Series\\Second' });
    const collection = store.createCollection('Series');
    store.setGameCollections(first.id, [collection.id]);
    store.setGameCollections(second.id, [collection.id]);
    assert.deepEqual(store.setCollectionOrder(collection.id, [second.id, first.id]).gameIds, [second.id, first.id]);

    const detected = store.upsertDetectedPackages(first.id, [{ name: 'Mods', kind: 'mod', path: 'C:\\Series\\First\\Mods', disabledPath: 'C:\\Series\\First\\Mods.gameshelf-disabled', enabled: true }]);
    const changed = store.recordPackageState(first.id, detected[0]!.id, false, 'C:\\GameShelf\\package-backups\\one');
    assert.equal(changed.enabled, false);
    assert.deepEqual(store.listPackageChanges(first.id).map((item) => [item.enabledBefore, item.enabledAfter]), [[true, false]]);

    const location = store.createSaveLocation(first.id, '本地存档', 'C:\\Series\\First\\SaveData');
    const branch = store.createSaveBranch(location.id, '主线');
    store.addSaveSnapshot(branch.id, 'snapshot-one', '开始前', 'C:\\GameShelf\\save-snapshots\\one', 'manual', 'a'.repeat(64));
    const saved = store.listSaveLocations(first.id)[0];
    assert.equal(saved?.branches[0]?.name, '主线');
    assert.equal(saved?.branches[0]?.snapshots[0]?.name, '开始前');
    assert.equal(store.getSaveSnapshot('snapshot-one')?.location.path, 'C:\\Series\\First\\SaveData');
    store.close();
  });
});
