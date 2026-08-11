import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATABASE_SCHEMA_VERSION, GameStore, inspectGameDatabase } from './game-store.ts';

export interface LibraryPaths {
  dataDirectory: string;
  database: string;
  backups: string;
  log: string;
  runningMarker: string;
}

export interface StartupSafetyResult {
  paths: LibraryPaths;
  uncleanExit: boolean;
  recoveredFrom: string | null;
  preservedDatabase: string | null;
  preMigrationBackup: string | null;
}

function stamp(date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace('T', '-').replace('Z', '').replace('.', '-');
}

export function libraryPaths(dataDirectory: string): LibraryPaths {
  return {
    dataDirectory,
    database: path.join(dataDirectory, 'gameshelf.sqlite'),
    backups: path.join(dataDirectory, 'backups'),
    log: path.join(dataDirectory, 'logs', 'gameshelf.log'),
    runningMarker: path.join(dataDirectory, '.gameshelf-running')
  };
}

function snapshotDatabase(source: string, destination: string): void {
  rmSync(destination, { force: true });
  const database = new DatabaseSync(source);
  try {
    database.prepare('VACUUM INTO ?').run(destination);
  } finally {
    database.close();
  }
  const inspection = inspectGameDatabase(destination);
  if (!inspection.valid) {
    rmSync(destination, { force: true });
    throw new Error(`备份校验失败：${inspection.message}`);
  }
}

function latestValidBackup(directory: string): string | null {
  const candidates = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sqlite') && !entry.name.includes('-corrupt-') && !entry.name.includes('-rejected-'))
    .map((entry) => path.join(directory, entry.name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  return candidates.find((candidate) => inspectGameDatabase(candidate).valid) ?? null;
}

function moveDatabaseWithSidecars(source: string, destination: string): void {
  renameSync(source, destination);
  for (const suffix of ['-wal', '-shm']) {
    if (existsSync(`${source}${suffix}`)) renameSync(`${source}${suffix}`, `${destination}${suffix}`);
  }
}

export function prepareDatabase(dataDirectory: string): StartupSafetyResult {
  const paths = libraryPaths(dataDirectory);
  mkdirSync(paths.backups, { recursive: true });
  mkdirSync(path.dirname(paths.log), { recursive: true });
  const result: StartupSafetyResult = {
    paths,
    uncleanExit: existsSync(paths.runningMarker),
    recoveredFrom: null,
    preservedDatabase: null,
    preMigrationBackup: null
  };
  if (!existsSync(paths.database)) return result;

  // A writable open lets SQLite replay a surviving WAL before we decide the live database is corrupt.
  let inspection = inspectGameDatabase(paths.database, true);
  if (inspection.schemaVersion > DATABASE_SCHEMA_VERSION) throw new Error(inspection.message);
  if (!inspection.valid) {
    const backup = latestValidBackup(paths.backups);
    if (!backup) {
      throw new Error(`游戏库校验失败，且没有可用备份。原文件未被修改：${paths.database}。请先复制整个 data 文件夹再排查。`);
    }
    const preserved = path.join(paths.backups, `gameshelf-corrupt-${stamp()}.sqlite`);
    moveDatabaseWithSidecars(paths.database, preserved);
    copyFileSync(backup, paths.database);
    inspection = inspectGameDatabase(paths.database);
    if (!inspection.valid) {
      moveDatabaseWithSidecars(paths.database, path.join(paths.backups, `gameshelf-rejected-${stamp()}.sqlite`));
      moveDatabaseWithSidecars(preserved, paths.database);
      throw new Error(`自动恢复后的数据库仍未通过校验：${inspection.message}`);
    }
    result.recoveredFrom = backup;
    result.preservedDatabase = preserved;
  }

  if (inspection.schemaVersion < DATABASE_SCHEMA_VERSION) {
    const migrationBackup = path.join(paths.backups, `gameshelf-before-migration-v${inspection.schemaVersion}-${stamp()}.sqlite`);
    snapshotDatabase(paths.database, migrationBackup);
    result.preMigrationBackup = migrationBackup;
  }
  return result;
}

export function createStoreBackup(store: GameStore, dataDirectory: string, kind: 'auto' | 'manual' | 'before-restore'): string {
  const paths = libraryPaths(dataDirectory);
  mkdirSync(paths.backups, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const destination = path.join(paths.backups, kind === 'auto' ? `gameshelf-auto-${day}.sqlite` : `gameshelf-${kind}-${stamp()}.sqlite`);
  if (kind === 'auto' && existsSync(destination) && inspectGameDatabase(destination).valid) return destination;
  const temporary = `${destination}.tmp`;
  rmSync(temporary, { force: true });
  rmSync(destination, { force: true });
  try {
    store.backupTo(temporary);
    const inspection = inspectGameDatabase(temporary);
    if (!inspection.valid) throw new Error(inspection.message);
    renameSync(temporary, destination);
    return destination;
  } catch (error) {
    rmSync(temporary, { force: true });
    throw new Error(`创建备份失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

export function restoreStore(store: GameStore, source: string, dataDirectory: string): { store: GameStore; safetyBackup: string } {
  const inspection = inspectGameDatabase(source);
  if (!inspection.valid) throw new Error(`无法恢复：${inspection.message}。当前游戏库未被修改。`);
  const paths = libraryPaths(dataDirectory);
  const safetyBackup = createStoreBackup(store, dataDirectory, 'before-restore');
  const staged = `${paths.database}.restore-new`;
  const previous = `${paths.database}.restore-old`;
  rmSync(staged, { force: true });
  rmSync(previous, { force: true });
  store.close();
  let currentMoved = false;
  try {
    copyFileSync(source, staged);
    const stagedInspection = inspectGameDatabase(staged);
    if (!stagedInspection.valid) throw new Error(stagedInspection.message);
    for (const suffix of ['-wal', '-shm']) rmSync(`${paths.database}${suffix}`, { force: true });
    if (existsSync(paths.database)) {
      renameSync(paths.database, previous);
      currentMoved = true;
    }
    renameSync(staged, paths.database);
    const restored = new GameStore(paths.database);
    try { rmSync(previous, { force: true }); } catch { /* verified safetyBackup remains available */ }
    return { store: restored, safetyBackup };
  } catch (error) {
    rmSync(staged, { force: true });
    if (currentMoved) {
      if (existsSync(paths.database)) renameSync(paths.database, path.join(paths.backups, `gameshelf-rejected-${stamp()}.sqlite`));
      renameSync(previous, paths.database);
    }
    throw new Error(`恢复失败，已保留原游戏库：${error instanceof Error ? error.message : String(error)}`);
  }
}

export function markRunning(paths: LibraryPaths): void {
  writeFileSync(paths.runningMarker, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), 'utf8');
}

export function clearRunning(paths: LibraryPaths): void {
  rmSync(paths.runningMarker, { force: true });
}

export function appendLog(logFile: string, level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  mkdirSync(path.dirname(logFile), { recursive: true });
  appendFileSync(logFile, `${new Date().toISOString()} ${level} ${message.replace(/\r?\n/g, ' ')}\n`, 'utf8');
}

export function logTail(logFile: string, replacements: string[]): string[] {
  if (!existsSync(logFile)) return [];
  let text = readFileSync(logFile, 'utf8');
  for (const value of replacements.filter(Boolean).sort((left, right) => right.length - left.length)) {
    text = text.split(value).join(value === replacements[0] ? '<DATA_DIR>' : '<HOME>');
  }
  return text.trim().split(/\r?\n/).slice(-200);
}
