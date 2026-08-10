import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { Game, GameCollection, GameStatus, NewGameInput } from './shared';

type GameRow = {
  id: string;
  title: string;
  type: Game['type'];
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
  total_play_seconds: number;
  launch_count: number;
  last_played_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function rowToGame(row: GameRow): Game {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
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
    this.database.exec('PRAGMA foreign_keys = ON');
    this.database.exec('PRAGMA journal_mode = WAL');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL CHECK(length(trim(title)) > 0),
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

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    const gameColumns = this.database.prepare('PRAGMA table_info(games)').all() as { name: string }[];
    if (!gameColumns.some((column) => column.name === 'completed_at')) {
      this.database.exec('ALTER TABLE games ADD COLUMN completed_at TEXT');
    }
  }

  listGames(): Game[] {
    const rows = this.database
      .prepare('SELECT * FROM games ORDER BY last_played_at IS NULL, last_played_at DESC, title COLLATE NOCASE')
      .all() as GameRow[];
    return rows.map(rowToGame);
  }

  getGame(id: string): Game | null {
    const row = this.database.prepare('SELECT * FROM games WHERE id = ?').get(id) as GameRow | undefined;
    return row ? rowToGame(row) : null;
  }

  createGame(input: NewGameInput & { workingDirectory: string }): Game {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database
      .prepare(`
        INSERT INTO games (
          id, title, type, content_rating, executable_path, working_directory,
          launch_arguments, developer, description, status, completed_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.title.trim(),
        input.type,
        input.contentRating,
        input.executablePath,
        input.workingDirectory,
        input.launchArguments?.trim() ?? '',
        input.developer?.trim() ?? '',
        input.description?.trim() ?? '',
        input.status ?? 'unplayed',
        input.status === 'completed' ? now : null,
        now,
        now
      );
    return this.getGame(id)!;
  }

  setCoverPath(id: string, coverPath: string): Game {
    this.database.prepare('UPDATE games SET cover_path = ?, updated_at = ? WHERE id = ?').run(
      coverPath,
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

  listCollections(): GameCollection[] {
    const rows = this.database.prepare('SELECT id, name, created_at FROM collections ORDER BY name COLLATE NOCASE').all() as { id: string; name: string; created_at: string }[];
    const memberships = this.database.prepare('SELECT game_id FROM collection_games WHERE collection_id = ? ORDER BY game_id');
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

  setGameCollections(gameId: string, collectionIds: string[]): void {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      this.database.prepare('DELETE FROM collection_games WHERE game_id = ?').run(gameId);
      const insert = this.database.prepare('INSERT INTO collection_games (collection_id, game_id) VALUES (?, ?)');
      for (const collectionId of collectionIds) insert.run(collectionId, gameId);
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
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
