import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { Game, NewGameInput } from './shared';

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
    `);
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
          launch_arguments, developer, description, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
