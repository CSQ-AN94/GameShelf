import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { BatchImportInput, BulkEditGamesInput, Game, GameCollection, GamePackage, GameSettingsInput, GameStatus, LaunchProfile, LaunchProfileInput, NewGameInput, PackageChange, PackageKind, SaveBranch, SaveLocation, SaveSnapshot } from './shared';

export const DATABASE_SCHEMA_VERSION = 2;

export interface DatabaseInspection {
  valid: boolean;
  schemaVersion: number;
  message: string;
}

export type BatchImportRecord = Omit<BatchImportInput, 'coverSourcePath'> & {
  id: string;
  workingDirectory: string;
  coverPath: string | null;
};

function quickCheck(database: DatabaseSync): string[] {
  return (database.prepare('PRAGMA quick_check').all() as { quick_check: string }[]).map((row) => row.quick_check);
}

export function inspectGameDatabase(filePath: string, recoverWal = false): DatabaseInspection {
  let database: DatabaseSync | null = null;
  try {
    database = new DatabaseSync(filePath, { readOnly: !recoverWal });
    const results = quickCheck(database);
    if (results.length !== 1 || results[0] !== 'ok') {
      return { valid: false, schemaVersion: -1, message: `数据库完整性校验失败：${results.join('；')}` };
    }
    const schemaVersion = (database.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
    if (schemaVersion > DATABASE_SCHEMA_VERSION) {
      return { valid: false, schemaVersion, message: `备份来自更高版本（数据库版本 ${schemaVersion}），请先更新 GameShelf` };
    }
    const tables = new Set((database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((row) => row.name));
    const gameColumns = new Set((database.prepare('PRAGMA table_info(games)').all() as { name: string }[]).map((row) => row.name));
    if (!tables.has('games') || !['id', 'title', 'executable_path'].every((column) => gameColumns.has(column))) {
      return { valid: false, schemaVersion, message: '所选文件不是可识别的 GameShelf 游戏库备份' };
    }
    return { valid: true, schemaVersion, message: 'ok' };
  } catch (error) {
    return { valid: false, schemaVersion: -1, message: error instanceof Error ? error.message : String(error) };
  } finally {
    database?.close();
  }
}

type GameRow = {
  id: string;
  title: string;
  chinese_title: string;
  type: Game['type'];
  category: string;
  content_rating: Game['contentRating'];
  executable_path: string;
  working_directory: string;
  launch_arguments: string;
  cover_path: string | null;
  background_path: string | null;
  developer: string;
  release_date: string | null;
  languages_json: string;
  score: number | null;
  description: string;
  status: Game['status'];
  wishlist: number;
  hide_in_safe_view: number;
  total_play_seconds: number;
  launch_count: number;
  last_played_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type LaunchProfileRow = {
  id: string;
  name: string;
  executable_path: string;
  working_directory: string;
  launch_arguments: string;
  is_default: number;
};

function rowToLaunchProfile(row: LaunchProfileRow): LaunchProfile {
  return {
    id: row.id,
    name: row.name,
    executablePath: row.executable_path,
    workingDirectory: row.working_directory,
    launchArguments: row.launch_arguments,
    isDefault: Boolean(row.is_default)
  };
}

function rowToGame(row: GameRow, launchProfiles: LaunchProfile[]): Game {
  return {
    id: row.id,
    title: row.title,
    chineseTitle: row.chinese_title,
    type: row.type,
    category: row.category,
    contentRating: row.content_rating,
    executablePath: row.executable_path,
    workingDirectory: row.working_directory,
    launchArguments: row.launch_arguments,
    coverPath: row.cover_path,
    backgroundPath: row.background_path,
    developer: row.developer,
    releaseDate: row.release_date,
    languages: JSON.parse(row.languages_json) as string[],
    score: row.score,
    description: row.description,
    status: row.status,
    wishlist: Boolean(row.wishlist),
    hideInSafeView: Boolean(row.hide_in_safe_view),
    launchProfiles,
    totalPlaySeconds: row.total_play_seconds,
    launchCount: row.launch_count,
    lastPlayedAt: row.last_played_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class GameStore {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    try {
      this.database.exec('PRAGMA foreign_keys = ON');
      const schemaVersion = this.getSchemaVersion();
      if (schemaVersion > DATABASE_SCHEMA_VERSION) {
        throw new Error(`数据库版本 ${schemaVersion} 高于当前支持的 ${DATABASE_SCHEMA_VERSION}，请更新 GameShelf`);
      }
      this.database.exec('PRAGMA journal_mode = WAL');
      this.database.exec('BEGIN IMMEDIATE');
      try {
        this.migrateSchema();
        this.database.exec(`PRAGMA user_version = ${DATABASE_SCHEMA_VERSION}`);
        this.database.exec('COMMIT');
      } catch (error) {
        this.database.exec('ROLLBACK');
        throw error;
      }
      const integrity = quickCheck(this.database);
      if (integrity.length !== 1 || integrity[0] !== 'ok') {
        throw new Error(`数据库完整性校验失败：${integrity.join('；')}`);
      }
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  private migrateSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL CHECK(length(trim(title)) > 0),
        chinese_title TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
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
        wishlist INTEGER NOT NULL DEFAULT 0,
        hide_in_safe_view INTEGER NOT NULL DEFAULT 0,
        total_play_seconds INTEGER NOT NULL DEFAULT 0,
        launch_count INTEGER NOT NULL DEFAULT 0,
        last_played_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS play_sessions (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL CHECK(duration_seconds >= 0)
      );

      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) > 0),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS collection_games (
        collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        PRIMARY KEY (collection_id, game_id)
      );

      CREATE TABLE IF NOT EXISTS launch_profiles (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        name TEXT NOT NULL CHECK(length(trim(name)) > 0),
        executable_path TEXT NOT NULL,
        working_directory TEXT NOT NULL,
        launch_arguments TEXT NOT NULL DEFAULT '',
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS game_packages (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        path TEXT NOT NULL,
        disabled_path TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        detected INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(game_id, path)
      );

      CREATE TABLE IF NOT EXISTS package_changes (
        id TEXT PRIMARY KEY,
        package_id TEXT NOT NULL REFERENCES game_packages(id) ON DELETE CASCADE,
        enabled_before INTEGER NOT NULL,
        enabled_after INTEGER NOT NULL,
        backup_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS save_locations (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(game_id, path)
      );

      CREATE TABLE IF NOT EXISTS save_branches (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL REFERENCES save_locations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(location_id, name COLLATE NOCASE)
      );

      CREATE TABLE IF NOT EXISTS save_snapshots (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL REFERENCES save_branches(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        snapshot_path TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        manifest_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    const gameColumns = this.database.prepare('PRAGMA table_info(games)').all() as { name: string }[];
    if (!gameColumns.some((column) => column.name === 'completed_at')) {
      this.database.exec('ALTER TABLE games ADD COLUMN completed_at TEXT');
    }
    if (!gameColumns.some((column) => column.name === 'chinese_title')) {
      this.database.exec("ALTER TABLE games ADD COLUMN chinese_title TEXT NOT NULL DEFAULT ''");
    }
    if (!gameColumns.some((column) => column.name === 'category')) {
      this.database.exec("ALTER TABLE games ADD COLUMN category TEXT NOT NULL DEFAULT ''");
      this.database.exec(`
        UPDATE games SET category = CASE type
          WHEN 'visual_novel' THEN 'Galgame'
          WHEN 'rpg' THEN 'RPG'
          WHEN 'simulation' THEN '模拟经营'
          WHEN 'action' THEN '动作游戏'
          ELSE '其他游戏'
        END
      `);
    }
    if (!gameColumns.some((column) => column.name === 'wishlist')) {
      this.database.exec('ALTER TABLE games ADD COLUMN wishlist INTEGER NOT NULL DEFAULT 0');
    }
    if (!gameColumns.some((column) => column.name === 'hide_in_safe_view')) {
      this.database.exec('ALTER TABLE games ADD COLUMN hide_in_safe_view INTEGER NOT NULL DEFAULT 0');
      this.database.exec("UPDATE games SET hide_in_safe_view = 1 WHERE content_rating = 'r18'");
    }
    const collectionGameColumns = this.database.prepare('PRAGMA table_info(collection_games)').all() as { name: string }[];
    if (!collectionGameColumns.some((column) => column.name === 'position')) {
      this.database.exec('ALTER TABLE collection_games ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
    }
    this.database.exec(`
      INSERT INTO launch_profiles (
        id, game_id, name, executable_path, working_directory, launch_arguments, is_default, created_at, updated_at
      )
      SELECT id, id, '默认启动', executable_path, working_directory, launch_arguments, 1, created_at, updated_at
      FROM games
      WHERE NOT EXISTS (SELECT 1 FROM launch_profiles WHERE launch_profiles.game_id = games.id)
    `);
  }

  getSchemaVersion(): number {
    return (this.database.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
  }

  getDiagnostics(): { schemaVersion: number; integrity: string; games: number; collections: number; launchProfiles: number; playSessions: number; packages: number; saveSnapshots: number } {
    const count = (table: string) => (this.database.prepare(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }).count;
    return {
      schemaVersion: this.getSchemaVersion(),
      integrity: quickCheck(this.database).join('; '),
      games: count('games'),
      collections: count('collections'),
      launchProfiles: count('launch_profiles'),
      playSessions: count('play_sessions'),
      packages: count('game_packages'),
      saveSnapshots: count('save_snapshots')
    };
  }

  backupTo(destination: string): void {
    this.database.exec('PRAGMA wal_checkpoint(PASSIVE)');
    this.database.prepare('VACUUM INTO ?').run(destination);
  }

  private listLaunchProfiles(gameId: string): LaunchProfile[] {
    return (this.database.prepare('SELECT id, name, executable_path, working_directory, launch_arguments, is_default FROM launch_profiles WHERE game_id = ? ORDER BY is_default DESC, created_at, name COLLATE NOCASE').all(gameId) as LaunchProfileRow[]).map(rowToLaunchProfile);
  }

  listGames(): Game[] {
    const rows = this.database
      .prepare('SELECT * FROM games ORDER BY last_played_at IS NULL, last_played_at DESC, title COLLATE NOCASE')
      .all() as GameRow[];
    return rows.map((row) => rowToGame(row, this.listLaunchProfiles(row.id)));
  }

  getGame(id: string): Game | null {
    const row = this.database.prepare('SELECT * FROM games WHERE id = ?').get(id) as GameRow | undefined;
    return row ? rowToGame(row, this.listLaunchProfiles(row.id)) : null;
  }

  removeGame(id: string): boolean {
    return this.database.prepare('DELETE FROM games WHERE id = ?').run(id).changes > 0;
  }

  createGame(input: NewGameInput & { workingDirectory: string }): Game {
    return this.insertGame(randomUUID(), input, null);
  }

  private insertGame(id: string, input: NewGameInput & { workingDirectory: string }, coverPath: string | null): Game {
    const now = new Date().toISOString();
    this.database
      .prepare(`
        INSERT INTO games (
          id, title, chinese_title, type, category, content_rating, executable_path, working_directory,
          launch_arguments, cover_path, developer, description, status, wishlist, hide_in_safe_view, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.title.trim(),
        input.chineseTitle?.trim() ?? '',
        input.type,
        input.category?.trim() || ({ visual_novel: 'Galgame', rpg: 'RPG', simulation: '模拟经营', action: '动作游戏', other: '其他游戏' } as const)[input.type],
        input.contentRating,
        input.executablePath,
        input.workingDirectory,
        input.launchArguments?.trim() ?? '',
        coverPath,
        input.developer?.trim() ?? '',
        input.description?.trim() ?? '',
        input.status ?? 'unplayed',
        input.wishlist ? 1 : 0,
        (input.hideInSafeView ?? input.contentRating === 'r18') ? 1 : 0,
        input.status === 'completed' ? now : null,
        now,
        now
      );
    this.database.prepare(`
      INSERT INTO launch_profiles (id, game_id, name, executable_path, working_directory, launch_arguments, is_default, created_at, updated_at)
      VALUES (?, ?, '默认启动', ?, ?, ?, 1, ?, ?)
    `).run(id, id, input.executablePath, input.workingDirectory, input.launchArguments?.trim() ?? '', now, now);
    return this.getGame(id)!;
  }

  importGames(inputs: BatchImportRecord[]): Game[] {
    const pathKey = (value: string) => value.replaceAll('\\', '/').toLocaleLowerCase();
    const knownPaths = new Set((this.database.prepare('SELECT executable_path FROM launch_profiles').all() as { executable_path: string }[]).map((row) => pathKey(row.executable_path)));
    for (const input of inputs) {
      for (const profile of input.launchProfiles) {
        const key = pathKey(profile.executablePath);
        if (knownPaths.has(key)) throw new Error(`启动路径已存在：${profile.executablePath}`);
        knownPaths.add(key);
      }
    }
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const imported: Game[] = [];
      for (const input of inputs) {
        const game = this.insertGame(input.id, input, input.coverPath);
        const now = new Date().toISOString();
        for (const profile of input.launchProfiles.filter((item) => pathKey(item.executablePath) !== pathKey(input.executablePath))) {
          this.database.prepare(`
            INSERT INTO launch_profiles (id, game_id, name, executable_path, working_directory, launch_arguments, is_default, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
          `).run(randomUUID(), game.id, profile.name.trim(), profile.executablePath, (profile.executablePath.includes('\\') ? path.win32 : path).dirname(profile.executablePath), profile.launchArguments?.trim() ?? '', now, now);
        }
        imported.push(this.getGame(game.id)!);
      }
      this.database.exec('COMMIT');
      return imported;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  bulkEditGames(input: BulkEditGamesInput): Game[] {
    const now = new Date().toISOString();
    this.database.exec('BEGIN IMMEDIATE');
    try {
      for (const gameId of input.gameIds) {
        if (input.status) this.database.prepare(`
          UPDATE games SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, ?) ELSE NULL END, updated_at = ? WHERE id = ?
        `).run(input.status, input.status, now, now, gameId);
        if (input.category) this.database.prepare('UPDATE games SET category = ?, updated_at = ? WHERE id = ?').run(input.category.trim(), now, gameId);
        if (input.hideInSafeView != null) this.database.prepare('UPDATE games SET hide_in_safe_view = ?, updated_at = ? WHERE id = ?').run(input.hideInSafeView ? 1 : 0, now, gameId);
        for (const collectionId of input.addCollectionIds ?? []) {
          this.database.prepare('INSERT OR IGNORE INTO collection_games (collection_id, game_id, position) VALUES (?, ?, COALESCE((SELECT max(position) + 1 FROM collection_games WHERE collection_id = ?), 0))').run(collectionId, gameId, collectionId);
        }
      }
      this.database.exec('COMMIT');
      return input.gameIds.map((id) => this.getGame(id)!);
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  setCoverPath(id: string, coverPath: string): Game {
    this.database.prepare('UPDATE games SET cover_path = ?, updated_at = ? WHERE id = ?').run(
      coverPath,
      new Date().toISOString(),
      id
    );
    return this.getGame(id)!;
  }

  setBackgroundPath(id: string, backgroundPath: string): Game {
    this.database.prepare('UPDATE games SET background_path = ?, updated_at = ? WHERE id = ?').run(
      backgroundPath,
      new Date().toISOString(),
      id
    );
    return this.getGame(id)!;
  }

  setStatus(id: string, status: GameStatus): Game {
    const now = new Date().toISOString();
    this.database.prepare(`
      UPDATE games
      SET status = ?,
          completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, ?) ELSE NULL END,
          updated_at = ?
      WHERE id = ?
    `).run(status, status, now, now, id);
    return this.getGame(id)!;
  }

  setCategory(id: string, category: string): Game {
    this.database.prepare('UPDATE games SET category = ?, updated_at = ? WHERE id = ?').run(category.trim(), new Date().toISOString(), id);
    return this.getGame(id)!;
  }

  setGameSettings(id: string, input: GameSettingsInput): Game {
    this.database.prepare('UPDATE games SET title = ?, chinese_title = ?, wishlist = ?, hide_in_safe_view = ?, updated_at = ? WHERE id = ?').run(
      input.title.trim(),
      input.chineseTitle.trim(),
      input.wishlist ? 1 : 0,
      input.hideInSafeView ? 1 : 0,
      new Date().toISOString(),
      id
    );
    return this.getGame(id)!;
  }

  getLaunchProfile(gameId: string, profileId?: string): LaunchProfile | null {
    const row = profileId
      ? this.database.prepare('SELECT id, name, executable_path, working_directory, launch_arguments, is_default FROM launch_profiles WHERE id = ? AND game_id = ?').get(profileId, gameId)
      : this.database.prepare('SELECT id, name, executable_path, working_directory, launch_arguments, is_default FROM launch_profiles WHERE game_id = ? ORDER BY is_default DESC, created_at LIMIT 1').get(gameId);
    return row ? rowToLaunchProfile(row as LaunchProfileRow) : null;
  }

  saveLaunchProfile(gameId: string, input: LaunchProfileInput & { workingDirectory: string }): Game {
    const now = new Date().toISOString();
    const id = input.id ?? randomUUID();
    this.database.exec('BEGIN IMMEDIATE');
    try {
      if (input.id) {
        const result = this.database.prepare(`
          UPDATE launch_profiles SET name = ?, executable_path = ?, working_directory = ?, launch_arguments = ?, updated_at = ?
          WHERE id = ? AND game_id = ?
        `).run(input.name.trim(), input.executablePath, input.workingDirectory, input.launchArguments?.trim() ?? '', now, id, gameId);
        if (!result.changes) throw new Error('找不到这个启动项');
      } else {
        this.database.prepare(`
          INSERT INTO launch_profiles (id, game_id, name, executable_path, working_directory, launch_arguments, is_default, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(id, gameId, input.name.trim(), input.executablePath, input.workingDirectory, input.launchArguments?.trim() ?? '', now, now);
      }
      if (input.isDefault) {
        this.database.prepare('UPDATE launch_profiles SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE game_id = ?').run(id, gameId);
        this.database.prepare('UPDATE games SET executable_path = ?, working_directory = ?, launch_arguments = ?, updated_at = ? WHERE id = ?').run(
          input.executablePath,
          input.workingDirectory,
          input.launchArguments?.trim() ?? '',
          now,
          gameId
        );
      }
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    return this.getGame(gameId)!;
  }

  deleteLaunchProfile(gameId: string, profileId: string): Game {
    const profiles = this.listLaunchProfiles(gameId);
    const removed = profiles.find((profile) => profile.id === profileId);
    if (!removed) throw new Error('找不到这个启动项');
    if (profiles.length === 1) throw new Error('至少保留一个启动项');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare('DELETE FROM launch_profiles WHERE id = ? AND game_id = ?').run(profileId, gameId);
      if (removed.isDefault) {
        const replacement = profiles.find((profile) => profile.id !== profileId)!;
        const now = new Date().toISOString();
        this.database.prepare('UPDATE launch_profiles SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END WHERE game_id = ?').run(replacement.id, gameId);
        this.database.prepare('UPDATE games SET executable_path = ?, working_directory = ?, launch_arguments = ?, updated_at = ? WHERE id = ?').run(
          replacement.executablePath,
          replacement.workingDirectory,
          replacement.launchArguments,
          now,
          gameId
        );
      }
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    return this.getGame(gameId)!;
  }

  listCollections(): GameCollection[] {
    const rows = this.database.prepare('SELECT id, name, created_at FROM collections ORDER BY name COLLATE NOCASE').all() as { id: string; name: string; created_at: string }[];
    const memberships = this.database.prepare('SELECT game_id FROM collection_games WHERE collection_id = ? ORDER BY position, rowid');
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      gameIds: (memberships.all(row.id) as { game_id: string }[]).map((item) => item.game_id),
      createdAt: row.created_at
    }));
  }

  createCollection(name: string): GameCollection {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.database.prepare('INSERT INTO collections (id, name, created_at) VALUES (?, ?, ?)').run(id, name.trim(), createdAt);
    return { id, name: name.trim(), gameIds: [], createdAt };
  }

  renameCollection(collectionId: string, name: string): GameCollection {
    const duplicate = this.database.prepare('SELECT id FROM collections WHERE name = ? AND id != ?').get(name.trim(), collectionId);
    if (duplicate) throw new Error('合集名称已存在');
    const result = this.database.prepare('UPDATE collections SET name = ? WHERE id = ?').run(name.trim(), collectionId);
    if (!result.changes) throw new Error('找不到这个合集');
    return this.listCollections().find((collection) => collection.id === collectionId)!;
  }

  deleteCollection(collectionId: string): boolean {
    return this.database.prepare('DELETE FROM collections WHERE id = ?').run(collectionId).changes > 0;
  }

  setGameCollections(gameId: string, collectionIds: string[]): void {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare('DELETE FROM collection_games WHERE game_id = ?').run(gameId);
      const insert = this.database.prepare('INSERT INTO collection_games (collection_id, game_id, position) VALUES (?, ?, COALESCE((SELECT max(position) + 1 FROM collection_games WHERE collection_id = ?), 0))');
      for (const collectionId of collectionIds) insert.run(collectionId, gameId, collectionId);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  setCollectionOrder(collectionId: string, gameIds: string[]): GameCollection {
    const current = this.listCollections().find((collection) => collection.id === collectionId);
    if (!current || current.gameIds.length !== gameIds.length || current.gameIds.some((id) => !gameIds.includes(id))) throw new Error('合集顺序必须包含全部现有作品');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const update = this.database.prepare('UPDATE collection_games SET position = ? WHERE collection_id = ? AND game_id = ?');
      gameIds.forEach((gameId, index) => update.run(index, collectionId, gameId));
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    return this.listCollections().find((collection) => collection.id === collectionId)!;
  }

  listPackages(gameId: string): GamePackage[] {
    return (this.database.prepare('SELECT id, game_id, name, kind, path, disabled_path, enabled, detected, updated_at FROM game_packages WHERE game_id = ? ORDER BY name COLLATE NOCASE').all(gameId) as { id: string; game_id: string; name: string; kind: PackageKind; path: string; disabled_path: string; enabled: number; detected: number; updated_at: string }[]).map((row) => ({
      id: row.id, gameId: row.game_id, name: row.name, kind: row.kind, path: row.path, disabledPath: row.disabled_path, enabled: Boolean(row.enabled), detected: Boolean(row.detected), updatedAt: row.updated_at
    }));
  }

  getPackage(gameId: string, packageId: string): GamePackage | null {
    return this.listPackages(gameId).find((item) => item.id === packageId) ?? null;
  }

  upsertDetectedPackages(gameId: string, inputs: { name: string; kind: PackageKind; path: string; disabledPath: string; enabled: boolean }[]): GamePackage[] {
    const now = new Date().toISOString();
    const upsert = this.database.prepare(`
      INSERT INTO game_packages (id, game_id, name, kind, path, disabled_path, enabled, detected, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(game_id, path) DO UPDATE SET name = excluded.name, kind = excluded.kind, disabled_path = excluded.disabled_path, enabled = excluded.enabled, detected = 1, updated_at = excluded.updated_at
    `);
    this.database.exec('BEGIN IMMEDIATE');
    try {
      for (const input of inputs) upsert.run(randomUUID(), gameId, input.name, input.kind, input.path, input.disabledPath, input.enabled ? 1 : 0, now, now);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    return this.listPackages(gameId);
  }

  recordPackageState(gameId: string, packageId: string, enabled: boolean, backupPath: string): GamePackage {
    const item = this.getPackage(gameId, packageId);
    if (!item) throw new Error('找不到这个 Package');
    const now = new Date().toISOString();
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare('UPDATE game_packages SET enabled = ?, updated_at = ? WHERE id = ? AND game_id = ?').run(enabled ? 1 : 0, now, packageId, gameId);
      this.database.prepare('INSERT INTO package_changes (id, package_id, enabled_before, enabled_after, backup_path, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(randomUUID(), packageId, item.enabled ? 1 : 0, enabled ? 1 : 0, backupPath, now);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
    return this.getPackage(gameId, packageId)!;
  }

  listPackageChanges(gameId: string): PackageChange[] {
    return (this.database.prepare(`
      SELECT changes.id, changes.package_id, packages.name AS package_name, changes.enabled_before, changes.enabled_after, changes.backup_path, changes.created_at
      FROM package_changes changes JOIN game_packages packages ON packages.id = changes.package_id
      WHERE packages.game_id = ? ORDER BY changes.created_at DESC LIMIT 100
    `).all(gameId) as { id: string; package_id: string; package_name: string; enabled_before: number; enabled_after: number; backup_path: string; created_at: string }[]).map((row) => ({
      id: row.id, packageId: row.package_id, packageName: row.package_name, enabledBefore: Boolean(row.enabled_before), enabledAfter: Boolean(row.enabled_after), backupPath: row.backup_path, createdAt: row.created_at
    }));
  }

  listSaveLocations(gameId: string): SaveLocation[] {
    const locations = this.database.prepare('SELECT id, game_id, name, path, created_at FROM save_locations WHERE game_id = ? ORDER BY created_at, name COLLATE NOCASE').all(gameId) as { id: string; game_id: string; name: string; path: string; created_at: string }[];
    const branchesFor = this.database.prepare('SELECT id, location_id, name, created_at FROM save_branches WHERE location_id = ? ORDER BY created_at, name COLLATE NOCASE');
    const snapshotsFor = this.database.prepare('SELECT id, branch_id, name, snapshot_path, kind, manifest_hash, created_at FROM save_snapshots WHERE branch_id = ? ORDER BY created_at DESC');
    return locations.map((location) => ({
      id: location.id, gameId: location.game_id, name: location.name, path: location.path, createdAt: location.created_at,
      branches: (branchesFor.all(location.id) as { id: string; location_id: string; name: string; created_at: string }[]).map((branch): SaveBranch => ({
        id: branch.id, locationId: branch.location_id, name: branch.name, createdAt: branch.created_at,
        snapshots: (snapshotsFor.all(branch.id) as { id: string; branch_id: string; name: string; snapshot_path: string; kind: SaveSnapshot['kind']; manifest_hash: string; created_at: string }[]).map((snapshot) => ({ id: snapshot.id, branchId: snapshot.branch_id, name: snapshot.name, path: snapshot.snapshot_path, kind: snapshot.kind, manifestHash: snapshot.manifest_hash, createdAt: snapshot.created_at }))
      }))
    }));
  }

  createSaveLocation(gameId: string, name: string, savePath: string): SaveLocation {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.database.prepare('INSERT INTO save_locations (id, game_id, name, path, created_at) VALUES (?, ?, ?, ?, ?)').run(id, gameId, name.trim(), savePath, createdAt);
    return { id, gameId, name: name.trim(), path: savePath, createdAt, branches: [] };
  }

  createSaveBranch(locationId: string, name: string): SaveBranch {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    this.database.prepare('INSERT INTO save_branches (id, location_id, name, created_at) VALUES (?, ?, ?, ?)').run(id, locationId, name.trim(), createdAt);
    return { id, locationId, name: name.trim(), createdAt, snapshots: [] };
  }

  getSaveLocation(locationId: string): SaveLocation | null {
    const row = this.database.prepare('SELECT game_id FROM save_locations WHERE id = ?').get(locationId) as { game_id: string } | undefined;
    return row ? this.listSaveLocations(row.game_id).find((item) => item.id === locationId) ?? null : null;
  }

  getSaveLocationByBranch(branchId: string): SaveLocation | null {
    const row = this.database.prepare('SELECT locations.game_id FROM save_branches branches JOIN save_locations locations ON locations.id = branches.location_id WHERE branches.id = ?').get(branchId) as { game_id: string } | undefined;
    return row ? this.listSaveLocations(row.game_id).flatMap((location) => location.branches.some((branch) => branch.id === branchId) ? [location] : [])[0] ?? null : null;
  }

  getSaveSnapshot(snapshotId: string): { snapshot: SaveSnapshot; location: SaveLocation } | null {
    const row = this.database.prepare('SELECT branches.location_id, locations.game_id FROM save_snapshots snapshots JOIN save_branches branches ON branches.id = snapshots.branch_id JOIN save_locations locations ON locations.id = branches.location_id WHERE snapshots.id = ?').get(snapshotId) as { location_id: string; game_id: string } | undefined;
    if (!row) return null;
    const location = this.listSaveLocations(row.game_id).find((item) => item.id === row.location_id)!;
    const snapshot = location.branches.flatMap((branch) => branch.snapshots).find((item) => item.id === snapshotId)!;
    return { snapshot, location };
  }

  addSaveSnapshot(branchId: string, id: string, name: string, snapshotPath: string, kind: SaveSnapshot['kind'], manifestHash: string): SaveSnapshot {
    const createdAt = new Date().toISOString();
    this.database.prepare('INSERT INTO save_snapshots (id, branch_id, name, snapshot_path, kind, manifest_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, branchId, name.trim(), snapshotPath, kind, manifestHash, createdAt);
    return { id, branchId, name: name.trim(), path: snapshotPath, kind, manifestHash, createdAt };
  }

  getSetting(key: string): string | null {
    const row = this.database.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.database.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  recordSession(gameId: string, startedAt: Date, durationSeconds: number): void {
    const seconds = Math.max(0, Math.floor(durationSeconds));
    const endedAt = new Date(startedAt.getTime() + seconds * 1000);
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database
        .prepare('INSERT INTO play_sessions (id, game_id, started_at, ended_at, duration_seconds) VALUES (?, ?, ?, ?, ?)')
        .run(randomUUID(), gameId, startedAt.toISOString(), endedAt.toISOString(), seconds);
      this.database
        .prepare(`
          UPDATE games
          SET total_play_seconds = total_play_seconds + ?,
              launch_count = launch_count + 1,
              last_played_at = ?,
              status = CASE WHEN status = 'unplayed' THEN 'playing' ELSE status END,
              updated_at = ?
          WHERE id = ?
        `)
        .run(seconds, endedAt.toISOString(), endedAt.toISOString(), gameId);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}
