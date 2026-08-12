import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';
import { createStoreBackup, libraryPaths, markRunning, prepareDatabase, restoreStore } from '../src/data-safety.ts';
import { DATABASE_SCHEMA_VERSION, GameStore, inspectGameDatabase } from '../src/game-store.ts';

function temporaryLibrary(): string {
  return mkdtempSync(path.join(tmpdir(), 'gameshelf-safety-'));
}

describe('database safety', () => {
  it('migrates a legacy library transactionally without losing its game', () => {
    const directory = temporaryLibrary();
    const databasePath = path.join(directory, 'gameshelf.sqlite');
    const legacy = new DatabaseSync(databasePath);
    legacy.exec(`
      CREATE TABLE games (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        content_rating TEXT NOT NULL,
        executable_path TEXT NOT NULL,
        working_directory TEXT NOT NULL,
        launch_arguments TEXT NOT NULL DEFAULT '',
        cover_path TEXT,
        background_path TEXT,
        developer TEXT NOT NULL DEFAULT '',
        release_date TEXT,
        languages_json TEXT NOT NULL DEFAULT '[]',
        score REAL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'unplayed',
        total_play_seconds INTEGER NOT NULL DEFAULT 0,
        launch_count INTEGER NOT NULL DEFAULT 0,
        last_played_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO games (id, title, type, content_rating, executable_path, working_directory, created_at, updated_at)
      VALUES ('legacy', 'Legacy Game', 'visual_novel', 'general', 'C:\\Games\\Legacy\\game.exe', 'C:\\Games\\Legacy', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
    `);
    legacy.close();

    const store = new GameStore(databasePath);
    try {
      assert.equal(store.getSchemaVersion(), DATABASE_SCHEMA_VERSION);
      assert.equal(store.getGame('legacy')?.title, 'Legacy Game');
      assert.equal(store.getGame('legacy')?.category, 'Galgame');
      assert.deepEqual(store.getGame('legacy')?.tags, []);
      assert.equal(store.getGame('legacy')?.launchProfiles.length, 1);
    } finally {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('creates a verified backup, restores it, and rejects malformed files first', () => {
    const directory = temporaryLibrary();
    const paths = libraryPaths(directory);
    let store = new GameStore(paths.database);
    store.createGame({ title: 'Keep', type: 'other', contentRating: 'general', executablePath: 'C:\\Games\\Keep\\game.exe', workingDirectory: 'C:\\Games\\Keep' });
    const backup = createStoreBackup(store, directory, 'manual');
    assert.equal(inspectGameDatabase(backup).valid, true);
    store.createGame({ title: 'Later', type: 'other', contentRating: 'general', executablePath: 'C:\\Games\\Later\\game.exe', workingDirectory: 'C:\\Games\\Later' });

    const malformed = path.join(directory, 'not-a-backup.sqlite');
    writeFileSync(malformed, 'not sqlite');
    assert.throws(() => restoreStore(store, malformed, directory), /当前游戏库未被修改/);
    assert.equal(store.listGames().length, 2);

    const future = path.join(directory, 'future.sqlite');
    copyFileSync(backup, future);
    const futureDatabase = new DatabaseSync(future);
    futureDatabase.exec(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION + 1}`);
    futureDatabase.close();
    assert.throws(() => restoreStore(store, future, directory), /更高版本/);
    assert.equal(store.listGames().length, 2);

    const restored = restoreStore(store, backup, directory);
    store = restored.store;
    try {
      assert.deepEqual(store.listGames().map((game) => game.title), ['Keep']);
      assert.equal(inspectGameDatabase(restored.safetyBackup).valid, true);
    } finally {
      store.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('recovers a corrupt library after an unclean exit and preserves the bad file', () => {
    const directory = temporaryLibrary();
    const paths = libraryPaths(directory);
    const store = new GameStore(paths.database);
    store.createGame({ title: 'Recover Me', type: 'other', contentRating: 'general', executablePath: 'C:\\Games\\Recover\\game.exe', workingDirectory: 'C:\\Games\\Recover' });
    createStoreBackup(store, directory, 'manual');
    store.close();
    markRunning(paths);
    writeFileSync(paths.database, 'broken database');

    const startup = prepareDatabase(directory);
    const recovered = new GameStore(paths.database);
    try {
      assert.equal(startup.uncleanExit, true);
      assert.ok(startup.recoveredFrom);
      assert.ok(startup.preservedDatabase && existsSync(startup.preservedDatabase));
      assert.equal(recovered.listGames()[0]?.title, 'Recover Me');
    } finally {
      recovered.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
