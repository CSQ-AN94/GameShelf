import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type IpcMainInvokeEvent } from 'electron';
import started from 'electron-squirrel-startup';
import { parseCategoryOrder } from './category-order';
import { appendLog, clearRunning, createStoreBackup, libraryPaths, logTail, markRunning, prepareDatabase, restoreStore, type StartupSafetyResult } from './data-safety';
import { GameStore, inspectGameDatabase } from './game-store';
import { analyzeExecutable } from './game-detection';
import { createTreeSnapshot, isPathInside, renameDirectorySafely, restoreTreeSnapshot, validateTreeSnapshot } from './file-safety';
import { detachedGameProcessOptions, parseLaunchArguments } from './launch';
import { scanLibraryRoots } from './library-scan';
import type { AppPreferences, BatchImportInput, BulkEditGamesInput, Game, GamePackage, GameSettingsInput, GameStatus, LaunchProfileInput, NewGameInput, PackageChangePreview, PackageKind, PickedImage, ProfileInput, SaveRestorePreview, UserProfile } from './shared';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

if (started) app.quit();

const configuredDataDirectory = process.env.GAMESHELF_DATA_DIR?.trim();
if (app.isPackaged || configuredDataDirectory) {
  const dataDirectory = configuredDataDirectory
    ? path.resolve(configuredDataDirectory)
    : path.join(path.dirname(process.execPath), 'data');
  mkdirSync(dataDirectory, { recursive: true });
  app.setPath('userData', dataDirectory);
}

let mainWindow: BrowserWindow | null = null;
let store: GameStore | null = null;
let startupSafety: StartupSafetyResult | null = null;
const startupMessages: string[] = [];

const gameTypes = new Set(['visual_novel', 'rpg', 'simulation', 'action', 'other']);
const contentRatings = new Set(['general', 'mature', 'r18']);
const gameStatuses = new Set(['unplayed', 'playing', 'completed', 'paused']);
const pendingPackageChanges = new Map<string, { gameId: string; preview: PackageChangePreview; createdAt: number }>();
const pendingSaveRestores = new Map<string, { gameId: string; branchId: string; preview: SaveRestorePreview; preRestoreSnapshotId: string; createdAt: number }>();

function assertTrusted(event: IpcMainInvokeEvent): void {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('Untrusted renderer request');
  }
}

function requireStore(): GameStore {
  if (!store) throw new Error('游戏库暂时不可用，请重启 GameShelf；若问题仍存在，请导出诊断信息');
  return store;
}

function errorText(error: unknown): string {
  return error instanceof Error ? `${error.message}${error.stack ? ` | ${error.stack}` : ''}` : String(error);
}

function log(level: 'INFO' | 'WARN' | 'ERROR', message: string): void {
  try {
    appendLog(startupSafety?.paths.log ?? libraryPaths(app.getPath('userData')).log, level, message);
  } catch {
    // Logging must never replace the original failure.
  }
}

function operationStamp(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, '');
}

function packageKind(directory: string): PackageKind {
  const name = path.basename(directory).toLocaleLowerCase();
  if (/(?:汉化|translation|chinese)/i.test(name)) return 'translation';
  if (/(?:无码|r18|adult)/i.test(name)) return 'adult_patch';
  if (/(?:voice|语音)/i.test(name)) return 'voice';
  if (/(?:fix|修复)/i.test(name)) return 'fix';
  if (/(?:mod|bepinex|melonloader)/i.test(name)) return 'mod';
  return 'other';
}

async function detectGamePackages(game: Game): Promise<GamePackage[]> {
  const detected: string[] = [];
  for (const profile of game.launchProfiles) {
    const analysis = await analyzeExecutable(profile.executablePath);
    detected.push(...analysis.modDirectories, ...analysis.patchDirectories);
  }
  const unique = [...new Map(detected.map((item) => [path.resolve(item).toLocaleLowerCase(), path.resolve(item)])).values()]
    .sort((left, right) => left.length - right.length)
    .filter((candidate, index, values) => !values.slice(0, index).some((parent) => isPathInside(parent, candidate)));
  const roots = game.launchProfiles.map((profile) => profile.workingDirectory);
  const records = unique.filter((candidate) => roots.some((root) => isPathInside(root, candidate))).map((candidate) => ({
    name: path.basename(candidate),
    kind: packageKind(candidate),
    path: candidate,
    disabledPath: `${candidate}.gameshelf-disabled`,
    enabled: true
  }));
  return requireStore().upsertDetectedPackages(game.id, records);
}

function requireFresh<T>(map: Map<string, T & { createdAt: number }>, token: string): T & { createdAt: number } {
  const pending = map.get(token);
  map.delete(token);
  if (!pending || Date.now() - pending.createdAt > 10 * 60 * 1000) throw new Error('操作预览已过期，请重新预览');
  return pending;
}

async function imageDataUrl(filePath: string | null): Promise<string | null> {
  if (!filePath) return null;
  const extension = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
  };
  const mimeType = mimeTypes[extension];
  if (!mimeType) return null;
  try {
    const details = await stat(filePath);
    if (!details.isFile() || details.size > 12 * 1024 * 1024) return null;
    const data = await readFile(filePath);
    return `data:${mimeType};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}

async function hydrateGame(game: Game): Promise<Game> {
  const [coverDataUrl, backgroundDataUrl] = await Promise.all([
    imageDataUrl(game.coverPath),
    imageDataUrl(game.backgroundPath)
  ]);
  return { ...game, coverDataUrl, backgroundDataUrl };
}

async function validateExecutable(executablePath: string): Promise<void> {
  if (!path.isAbsolute(executablePath) || path.extname(executablePath).toLowerCase() !== '.exe') {
    throw new Error('请选择有效的 Windows .exe 文件');
  }
  let details: Awaited<ReturnType<typeof stat>>;
  try {
    details = await stat(executablePath);
  } catch {
    throw new Error('启动文件不存在或无法访问，请在“游戏设置 → 启动项”中重新选择 .exe 文件');
  }
  if (!details.isFile()) throw new Error('启动文件不存在');
}

async function copyArtwork(gameId: string, sourcePath: string, directoryName: 'covers' | 'backgrounds'): Promise<string> {
  const extension = path.extname(sourcePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) throw new Error('不支持的图片格式');
  const details = await stat(sourcePath);
  if (!details.isFile() || details.size > 12 * 1024 * 1024) throw new Error('图片无效或过大');
  const destinationDirectory = path.join(app.getPath('userData'), directoryName);
  await mkdir(destinationDirectory, { recursive: true });
  const destination = path.join(destinationDirectory, `${gameId}${extension}`);
  await copyFile(sourcePath, destination);
  return destination;
}

async function copyProfileAvatar(sourcePath: string): Promise<string> {
  const extension = path.extname(sourcePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) throw new Error('不支持的头像格式');
  const details = await stat(sourcePath);
  if (!details.isFile() || details.size > 12 * 1024 * 1024) throw new Error('头像文件无效或过大');
  const destinationDirectory = path.join(app.getPath('userData'), 'profile');
  await mkdir(destinationDirectory, { recursive: true });
  const destination = path.join(destinationDirectory, `avatar${extension}`);
  await copyFile(sourcePath, destination);
  return destination;
}

async function removeManagedArtwork(gameId: string, filePath: string | null, directoryName: 'covers' | 'backgrounds'): Promise<void> {
  if (!filePath) return;
  const managedDirectory = path.resolve(app.getPath('userData'), directoryName);
  const resolvedPath = path.resolve(filePath);
  if (path.dirname(resolvedPath) !== managedDirectory || !path.basename(resolvedPath).startsWith(`${gameId}.`)) return;
  await unlink(resolvedPath).catch(() => undefined);
}

async function hydrateProfile(): Promise<UserProfile> {
  const profileStore = requireStore();
  const avatarPath = profileStore.getSetting('profile.avatarPath');
  return {
    name: profileStore.getSetting('profile.name') ?? '玩家',
    avatarPath,
    avatarDataUrl: await imageDataUrl(avatarPath)
  };
}

function readPreferences(): AppPreferences {
  const preferenceStore = requireStore();
  return {
    theme: preferenceStore.getSetting('appearance.theme') === 'light' ? 'light' : 'dark',
    titleDisplayMode: preferenceStore.getSetting('appearance.titleDisplayMode') === 'chinese' ? 'chinese' : 'original',
    libraryViewMode: preferenceStore.getSetting('appearance.libraryViewMode') === 'list' ? 'list' : 'grid',
    safeView: preferenceStore.getSetting('privacy.safeView') === 'true',
    sidebarCollapsed: preferenceStore.getSetting('appearance.sidebarCollapsed') === 'true',
    categoryOrder: parseCategoryOrder(preferenceStore.getSetting('appearance.categoryOrder'))
  };
}

function registerIpc(): void {
  ipcMain.handle('games:list', async (event) => {
    assertTrusted(event);
    return Promise.all(requireStore().listGames().map(hydrateGame));
  });

  ipcMain.handle('games:get', async (event, id: unknown) => {
    assertTrusted(event);
    if (typeof id !== 'string') throw new Error('Invalid game id');
    const game = requireStore().getGame(id);
    return game ? hydrateGame(game) : null;
  });

  ipcMain.handle('games:pick-executable', async (event) => {
    assertTrusted(event);
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择游戏启动文件',
      properties: ['openFile'],
      filters: [{ name: 'Windows executable', extensions: ['exe'] }]
    });
    return result.canceled ? null : result.filePaths[0] ?? null;
  });

  ipcMain.handle('games:pick-cover', async (event): Promise<PickedImage | null> => {
    assertTrusted(event);
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择游戏封面',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    });
    const selectedPath = result.filePaths[0];
    if (result.canceled || !selectedPath) return null;
    const dataUrl = await imageDataUrl(selectedPath);
    if (!dataUrl) throw new Error('封面无法读取或文件过大');
    return { path: selectedPath, dataUrl };
  });

  ipcMain.handle('games:pick-background', async (event): Promise<PickedImage | null> => {
    assertTrusted(event);
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择横向背景图',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
    });
    const selectedPath = result.filePaths[0];
    if (result.canceled || !selectedPath) return null;
    const dataUrl = await imageDataUrl(selectedPath);
    if (!dataUrl) throw new Error('背景图无法读取或文件过大');
    return { path: selectedPath, dataUrl };
  });

  ipcMain.handle('games:analyze-executable', async (event, executablePath: unknown) => {
    assertTrusted(event);
    if (typeof executablePath !== 'string') throw new Error('请选择启动文件');
    await validateExecutable(executablePath);
    return analyzeExecutable(executablePath);
  });

  ipcMain.handle('games:add', async (event, input: NewGameInput) => {
    assertTrusted(event);
    if (!input || typeof input.title !== 'string' || !input.title.trim()) throw new Error('游戏名称不能为空');
    if (input.title.length > 200) throw new Error('游戏名称过长');
    if (input.chineseTitle != null && (typeof input.chineseTitle !== 'string' || input.chineseTitle.trim().length > 200)) throw new Error('中文名称无效');
    if (!gameTypes.has(input.type)) throw new Error('无效的游戏类型');
    if (input.category != null && (typeof input.category !== 'string' || input.category.trim().length > 60)) throw new Error('无效的游戏分类');
    if (!contentRatings.has(input.contentRating)) throw new Error('无效的内容分级');
    if (input.status && !gameStatuses.has(input.status)) throw new Error('无效的游玩状态');
    if (typeof input.executablePath !== 'string') throw new Error('请选择启动文件');
    if (input.coverSourcePath != null && typeof input.coverSourcePath !== 'string') throw new Error('无效的封面路径');
    await validateExecutable(input.executablePath);
    let game = requireStore().createGame({
      ...input,
      workingDirectory: path.dirname(input.executablePath)
    });
    if (input.coverSourcePath) {
      const coverPath = await copyArtwork(game.id, input.coverSourcePath, 'covers');
      game = requireStore().setCoverPath(game.id, coverPath);
    }
    return hydrateGame(game);
  });

  ipcMain.handle('games:scan-library', async (event) => {
    assertTrusted(event);
    const selected = await dialog.showOpenDialog(mainWindow!, {
      title: '选择要扫描的游戏目录',
      properties: ['openDirectory', 'multiSelections']
    });
    if (selected.canceled || selected.filePaths.length === 0) return null;
    return scanLibraryRoots(selected.filePaths, requireStore().listGames());
  });

  ipcMain.handle('games:import', async (event, inputs: BatchImportInput[]) => {
    assertTrusted(event);
    if (!Array.isArray(inputs) || inputs.length === 0 || inputs.length > 500) throw new Error('请选择 1 至 500 个扫描结果');
    const records = [];
    const copiedArtwork: { id: string; path: string }[] = [];
    try {
      for (const input of inputs) {
        if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 200) throw new Error('扫描结果中的游戏名称无效');
        if (!gameTypes.has(input.type) || !contentRatings.has(input.contentRating) || (input.status && !gameStatuses.has(input.status))) throw new Error('扫描结果中的游戏资料无效');
        if (typeof input.category !== 'string' || !input.category.trim() || input.category.trim().length > 60) throw new Error('扫描结果中的分类无效');
        if (!Array.isArray(input.launchProfiles) || input.launchProfiles.length === 0 || input.launchProfiles.length > 16) throw new Error('每个游戏必须包含 1 至 16 个启动项');
        for (const profile of input.launchProfiles) {
          if (!profile || typeof profile.name !== 'string' || !profile.name.trim() || profile.name.trim().length > 60 || typeof profile.executablePath !== 'string') throw new Error('扫描结果中的启动项无效');
          await validateExecutable(profile.executablePath);
        }
        if (!input.launchProfiles.some((profile) => profile.executablePath === input.executablePath)) throw new Error('默认启动项不在扫描结果中');
        const id = randomUUID();
        let coverPath: string | null = null;
        if (input.coverSourcePath) {
          if (typeof input.coverSourcePath !== 'string' || !path.isAbsolute(input.coverSourcePath)) throw new Error('扫描结果中的封面路径无效');
          coverPath = await copyArtwork(id, input.coverSourcePath, 'covers');
          copiedArtwork.push({ id, path: coverPath });
        }
        records.push({ ...input, id, coverPath, workingDirectory: path.dirname(input.executablePath) });
      }
      return Promise.all(requireStore().importGames(records).map(hydrateGame));
    } catch (error) {
      await Promise.all(copiedArtwork.map((item) => removeManagedArtwork(item.id, item.path, 'covers')));
      throw error;
    }
  });

  ipcMain.handle('games:bulk-edit', async (event, input: BulkEditGamesInput) => {
    assertTrusted(event);
    if (!input || !Array.isArray(input.gameIds) || input.gameIds.length === 0 || input.gameIds.length > 500 || !input.gameIds.every((id) => typeof id === 'string')) throw new Error('请选择要整理的游戏');
    const gameIds = [...new Set(input.gameIds)];
    if (gameIds.some((id) => !requireStore().getGame(id))) throw new Error('批量整理中包含不存在的游戏');
    if (input.status != null && !gameStatuses.has(input.status)) throw new Error('无效的游玩状态');
    if (input.category != null && (typeof input.category !== 'string' || !input.category.trim() || input.category.trim().length > 60)) throw new Error('无效的游戏分类');
    if (input.hideInSafeView != null && typeof input.hideInSafeView !== 'boolean') throw new Error('无效的隐私设置');
    if (input.addCollectionIds != null && (!Array.isArray(input.addCollectionIds) || !input.addCollectionIds.every((id) => typeof id === 'string'))) throw new Error('无效的合集设置');
    const collectionIds = [...new Set(input.addCollectionIds ?? [])];
    const validCollectionIds = new Set(requireStore().listCollections().map((collection) => collection.id));
    if (collectionIds.some((id) => !validCollectionIds.has(id))) throw new Error('批量整理中包含不存在的合集');
    return Promise.all(requireStore().bulkEditGames({ ...input, gameIds, addCollectionIds: collectionIds }).map(hydrateGame));
  });

  ipcMain.handle('games:remove', async (event, id: unknown) => {
    assertTrusted(event);
    if (typeof id !== 'string') throw new Error('无效的游戏');
    const game = requireStore().getGame(id);
    if (!game) throw new Error('找不到这个游戏');
    if (!requireStore().removeGame(id)) throw new Error('移出游戏库失败');
    await Promise.all([
      removeManagedArtwork(id, game.coverPath, 'covers'),
      removeManagedArtwork(id, game.backgroundPath, 'backgrounds')
    ]);
  });

  ipcMain.handle('games:update-status', async (event, id: unknown, status: unknown) => {
    assertTrusted(event);
    if (typeof id !== 'string' || !gameStatuses.has(status as string)) throw new Error('无效的游玩状态');
    if (!requireStore().getGame(id)) throw new Error('找不到这个游戏');
    return hydrateGame(requireStore().setStatus(id, status as GameStatus));
  });

  ipcMain.handle('games:update-category', async (event, id: unknown, category: unknown) => {
    assertTrusted(event);
    if (typeof id !== 'string' || typeof category !== 'string' || !category.trim() || category.trim().length > 60) throw new Error('无效的游戏分类');
    if (!requireStore().getGame(id)) throw new Error('找不到这个游戏');
    return hydrateGame(requireStore().setCategory(id, category));
  });

  ipcMain.handle('games:update-settings', async (event, id: unknown, input: GameSettingsInput) => {
    assertTrusted(event);
    if (typeof id !== 'string' || !input || typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 200) throw new Error('游戏原名无效');
    if (typeof input.chineseTitle !== 'string' || input.chineseTitle.trim().length > 200) throw new Error('中文名称无效');
    if (typeof input.wishlist !== 'boolean' || typeof input.hideInSafeView !== 'boolean') throw new Error('游戏设置无效');
    if (input.coverSourcePath != null && (typeof input.coverSourcePath !== 'string' || !path.isAbsolute(input.coverSourcePath))) throw new Error('封面路径无效');
    if (input.backgroundSourcePath != null && (typeof input.backgroundSourcePath !== 'string' || !path.isAbsolute(input.backgroundSourcePath))) throw new Error('背景图路径无效');
    if (!requireStore().getGame(id)) throw new Error('找不到这个游戏');
    let game = requireStore().setGameSettings(id, input);
    if (input.coverSourcePath) game = requireStore().setCoverPath(id, await copyArtwork(id, input.coverSourcePath, 'covers'));
    if (input.backgroundSourcePath) game = requireStore().setBackgroundPath(id, await copyArtwork(id, input.backgroundSourcePath, 'backgrounds'));
    return hydrateGame(game);
  });

  ipcMain.handle('games:save-launch-profile', async (event, gameId: unknown, input: LaunchProfileInput) => {
    assertTrusted(event);
    if (typeof gameId !== 'string' || !requireStore().getGame(gameId)) throw new Error('找不到这个游戏');
    if (!input || (input.id != null && typeof input.id !== 'string') || typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 60) throw new Error('启动项名称无效');
    if (typeof input.executablePath !== 'string' || (input.launchArguments != null && typeof input.launchArguments !== 'string') || typeof input.isDefault !== 'boolean') throw new Error('启动项设置无效');
    await validateExecutable(input.executablePath);
    return hydrateGame(requireStore().saveLaunchProfile(gameId, { ...input, workingDirectory: path.dirname(input.executablePath) }));
  });

  ipcMain.handle('games:delete-launch-profile', async (event, gameId: unknown, profileId: unknown) => {
    assertTrusted(event);
    if (typeof gameId !== 'string' || typeof profileId !== 'string') throw new Error('启动项无效');
    return hydrateGame(requireStore().deleteLaunchProfile(gameId, profileId));
  });

  ipcMain.handle('games:launch', async (event, id: unknown, profileId: unknown) => {
    assertTrusted(event);
    if (typeof id !== 'string') throw new Error('Invalid game id');
    const game = requireStore().getGame(id);
    if (!game) throw new Error('找不到这个游戏');
    if (profileId != null && typeof profileId !== 'string') throw new Error('启动项无效');
    const profile = requireStore().getLaunchProfile(id, profileId as string | undefined);
    if (!profile) throw new Error('找不到这个启动项');
    await validateExecutable(profile.executablePath);
    const startedAt = new Date();
    const child = spawn(profile.executablePath, parseLaunchArguments(profile.launchArguments), detachedGameProcessOptions(profile.workingDirectory));
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', (error) => reject(new Error(`启动失败：${error.message}。请检查启动文件权限和启动参数`)));
    });
    child.unref();
    child.once('close', () => {
      try {
        store?.recordSession(game.id, startedAt, (Date.now() - startedAt.getTime()) / 1000);
      } catch (error) {
        log('ERROR', `记录游玩时长失败：${errorText(error)}`);
      }
    });
  });

  ipcMain.handle('games:open-directory', async (event, id: unknown) => {
    assertTrusted(event);
    if (typeof id !== 'string') throw new Error('无效的游戏');
    const game = requireStore().getGame(id);
    if (!game) throw new Error('找不到这个游戏');
    let details: Awaited<ReturnType<typeof stat>>;
    try {
      details = await stat(game.workingDirectory);
    } catch {
      throw new Error('游戏文件夹不存在或无法访问，请检查磁盘连接和游戏启动项路径');
    }
    if (!details.isDirectory()) throw new Error('游戏文件夹不存在');
    const error = await shell.openPath(game.workingDirectory);
    if (error) throw new Error(error);
    return game.workingDirectory;
  });

  ipcMain.handle('collections:list', (event) => {
    assertTrusted(event);
    return requireStore().listCollections();
  });

  ipcMain.handle('collections:create', (event, name: unknown) => {
    assertTrusted(event);
    if (typeof name !== 'string' || !name.trim()) throw new Error('合集名称不能为空');
    if (name.trim().length > 80) throw new Error('合集名称过长');
    return requireStore().createCollection(name);
  });

  ipcMain.handle('collections:rename', (event, collectionId: unknown, name: unknown) => {
    assertTrusted(event);
    if (typeof collectionId !== 'string' || typeof name !== 'string' || !name.trim()) throw new Error('合集名称不能为空');
    if (name.trim().length > 80) throw new Error('合集名称过长');
    return requireStore().renameCollection(collectionId, name);
  });

  ipcMain.handle('collections:delete', (event, collectionId: unknown) => {
    assertTrusted(event);
    if (typeof collectionId !== 'string' || !requireStore().deleteCollection(collectionId)) throw new Error('找不到这个合集');
  });

  ipcMain.handle('collections:set-game', (event, gameId: unknown, collectionIds: unknown) => {
    assertTrusted(event);
    if (typeof gameId !== 'string' || !Array.isArray(collectionIds) || !collectionIds.every((id) => typeof id === 'string')) throw new Error('无效的合集设置');
    if (!requireStore().getGame(gameId)) throw new Error('找不到这个游戏');
    const validIds = new Set(requireStore().listCollections().map((collection) => collection.id));
    if (!(collectionIds as string[]).every((id) => validIds.has(id))) throw new Error('合集不存在');
    requireStore().setGameCollections(gameId, [...new Set(collectionIds as string[])]);
  });

  ipcMain.handle('collections:set-order', (event, collectionId: unknown, gameIds: unknown) => {
    assertTrusted(event);
    if (typeof collectionId !== 'string' || !Array.isArray(gameIds) || !gameIds.every((id) => typeof id === 'string') || new Set(gameIds).size !== gameIds.length) throw new Error('无效的作品顺序');
    return requireStore().setCollectionOrder(collectionId, gameIds as string[]);
  });

  ipcMain.handle('packages:list', (event, gameId: unknown) => {
    assertTrusted(event);
    if (typeof gameId !== 'string' || !requireStore().getGame(gameId)) throw new Error('找不到这个游戏');
    return requireStore().listPackages(gameId);
  });

  ipcMain.handle('packages:detect', async (event, gameId: unknown) => {
    assertTrusted(event);
    if (typeof gameId !== 'string') throw new Error('找不到这个游戏');
    const game = requireStore().getGame(gameId);
    if (!game) throw new Error('找不到这个游戏');
    return detectGamePackages(game);
  });

  ipcMain.handle('packages:changes', (event, gameId: unknown) => {
    assertTrusted(event);
    if (typeof gameId !== 'string' || !requireStore().getGame(gameId)) throw new Error('找不到这个游戏');
    return requireStore().listPackageChanges(gameId);
  });

  ipcMain.handle('packages:preview-change', (event, gameId: unknown, packageId: unknown, enabled: unknown): PackageChangePreview => {
    assertTrusted(event);
    if (typeof gameId !== 'string' || typeof packageId !== 'string' || typeof enabled !== 'boolean') throw new Error('无效的 Package 变更');
    const game = requireStore().getGame(gameId);
    const item = requireStore().getPackage(gameId, packageId);
    if (!game || !item) throw new Error('找不到这个 Package');
    if (item.enabled === enabled) throw new Error(enabled ? 'Package 已启用' : 'Package 已停用');
    const sourcePath = item.enabled ? item.path : item.disabledPath;
    const targetPath = enabled ? item.path : item.disabledPath;
    const roots = game.launchProfiles.map((profile) => profile.workingDirectory);
    if (!roots.some((root) => isPathInside(root, sourcePath) && isPathInside(root, targetPath))) throw new Error('Package 路径超出游戏目录，已拒绝操作');
    const token = randomUUID();
    const backupPath = path.join(app.getPath('userData'), 'package-backups', gameId, packageId, `${operationStamp()}-${enabled ? 'before-enable' : 'before-disable'}`);
    const preview = { token, packageId, packageName: item.name, enabled, sourcePath, targetPath, backupPath };
    pendingPackageChanges.set(token, { gameId, preview, createdAt: Date.now() });
    return preview;
  });

  ipcMain.handle('packages:apply-change', async (event, token: unknown) => {
    assertTrusted(event);
    if (typeof token !== 'string') throw new Error('无效的 Package 操作');
    const pending = requireFresh(pendingPackageChanges, token);
    const item = requireStore().getPackage(pending.gameId, pending.preview.packageId);
    if (!item || item.enabled === pending.preview.enabled) throw new Error('Package 状态已改变，请重新预览');
    const expectedSource = item.enabled ? item.path : item.disabledPath;
    const expectedTarget = pending.preview.enabled ? item.path : item.disabledPath;
    if (expectedSource !== pending.preview.sourcePath || expectedTarget !== pending.preview.targetPath) throw new Error('Package 路径已改变，请重新检测');
    const confirmation = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: pending.preview.enabled ? '启用 Package' : '停用 Package',
      message: `${pending.preview.enabled ? '启用' : '停用'}“${item.name}”？`,
      detail: `来源：${pending.preview.sourcePath}\n目标：${pending.preview.targetPath}\n备份：${pending.preview.backupPath}\n\nGameShelf 会先复制并校验备份，再执行同目录重命名。`,
      buttons: ['取消', '确认执行'], defaultId: 0, cancelId: 0, noLink: true
    });
    if (confirmation.response !== 1) throw new Error('操作已取消');
    await createTreeSnapshot(pending.preview.sourcePath, pending.preview.backupPath);
    await renameDirectorySafely(pending.preview.sourcePath, pending.preview.targetPath);
    try {
      const updated = requireStore().recordPackageState(pending.gameId, item.id, pending.preview.enabled, pending.preview.backupPath);
      log('INFO', `Package ${item.id} 已${updated.enabled ? '启用' : '停用'}；备份 ${pending.preview.backupPath}`);
      return updated;
    } catch (error) {
      try { await renameDirectorySafely(pending.preview.targetPath, pending.preview.sourcePath); }
      catch (rollbackError) { throw new Error(`Package 记录失败且自动回滚失败。备份仍在 ${pending.preview.backupPath}。${errorText(rollbackError)}`); }
      throw error;
    }
  });

  ipcMain.handle('saves:pick-directory', async (event) => {
    assertTrusted(event);
    const selected = await dialog.showOpenDialog(mainWindow!, { title: '选择存档文件夹', properties: ['openDirectory'] });
    return selected.canceled ? null : selected.filePaths[0] ?? null;
  });

  ipcMain.handle('saves:list', (event, gameId: unknown) => {
    assertTrusted(event);
    if (typeof gameId !== 'string' || !requireStore().getGame(gameId)) throw new Error('找不到这个游戏');
    return requireStore().listSaveLocations(gameId);
  });

  ipcMain.handle('saves:add-location', async (event, gameId: unknown, name: unknown, savePath: unknown) => {
    assertTrusted(event);
    if (typeof gameId !== 'string' || !requireStore().getGame(gameId)) throw new Error('找不到这个游戏');
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || typeof savePath !== 'string' || !path.isAbsolute(savePath)) throw new Error('存档位置设置无效');
    const details = await lstat(savePath);
    if (!details.isDirectory() || details.isSymbolicLink()) throw new Error('存档位置不是普通文件夹');
    requireStore().createSaveLocation(gameId, name, path.resolve(savePath));
    return requireStore().listSaveLocations(gameId);
  });

  ipcMain.handle('saves:create-branch', (event, locationId: unknown, name: unknown) => {
    assertTrusted(event);
    if (typeof locationId !== 'string' || typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new Error('存档分支名称无效');
    const location = requireStore().getSaveLocation(locationId);
    if (!location) throw new Error('找不到存档位置');
    requireStore().createSaveBranch(locationId, name);
    return requireStore().listSaveLocations(location.gameId);
  });

  ipcMain.handle('saves:create-snapshot', async (event, branchId: unknown, name: unknown) => {
    assertTrusted(event);
    if (typeof branchId !== 'string' || typeof name !== 'string' || !name.trim() || name.trim().length > 80) throw new Error('快照名称无效');
    const location = requireStore().getSaveLocationByBranch(branchId);
    if (!location) throw new Error('找不到存档分支');
    const id = randomUUID();
    const destination = path.join(app.getPath('userData'), 'save-snapshots', location.gameId, branchId, id);
    const result = await createTreeSnapshot(location.path, destination);
    requireStore().addSaveSnapshot(branchId, id, name, destination, 'manual', result.manifestHash);
    log('INFO', `已创建存档快照 ${id}；${result.fileCount} 个文件`);
    return requireStore().listSaveLocations(location.gameId);
  });

  ipcMain.handle('saves:preview-restore', async (event, snapshotId: unknown): Promise<SaveRestorePreview> => {
    assertTrusted(event);
    if (typeof snapshotId !== 'string') throw new Error('无效的存档快照');
    const record = requireStore().getSaveSnapshot(snapshotId);
    if (!record) throw new Error('找不到存档快照');
    const snapshotRoot = path.join(app.getPath('userData'), 'save-snapshots');
    if (!isPathInside(snapshotRoot, record.snapshot.path)) throw new Error('快照路径超出 GameShelf 数据目录');
    const validation = await validateTreeSnapshot(record.snapshot.path);
    if (validation.manifestHash !== record.snapshot.manifestHash) throw new Error('快照清单与数据库记录不一致');
    const token = randomUUID();
    const preRestoreSnapshotId = randomUUID();
    const preRestoreSnapshotPath = path.join(snapshotRoot, record.location.gameId, record.snapshot.branchId, preRestoreSnapshotId);
    const preview = { token, snapshotId, snapshotName: record.snapshot.name, sourcePath: record.snapshot.path, targetPath: record.location.path, preRestoreSnapshotPath };
    pendingSaveRestores.set(token, { gameId: record.location.gameId, branchId: record.snapshot.branchId, preview, preRestoreSnapshotId, createdAt: Date.now() });
    return preview;
  });

  ipcMain.handle('saves:apply-restore', async (event, token: unknown) => {
    assertTrusted(event);
    if (typeof token !== 'string') throw new Error('无效的恢复操作');
    const pending = requireFresh(pendingSaveRestores, token);
    const record = requireStore().getSaveSnapshot(pending.preview.snapshotId);
    if (!record || record.snapshot.path !== pending.preview.sourcePath || record.location.path !== pending.preview.targetPath) throw new Error('存档位置或快照已改变，请重新预览');
    const validation = await validateTreeSnapshot(record.snapshot.path);
    if (validation.manifestHash !== record.snapshot.manifestHash) throw new Error('快照校验失败，当前存档未被修改');
    const confirmation = await dialog.showMessageBox(mainWindow!, {
      type: 'warning', title: '恢复存档快照', message: `恢复“${record.snapshot.name}”到当前存档位置？`,
      detail: `已通过 SHA-256 校验。恢复前快照将保存到：\n${pending.preview.preRestoreSnapshotPath}\n\n当前存档目录会保留为同级 recovery 副本，不会被删除。`,
      buttons: ['取消', '恢复'], defaultId: 0, cancelId: 0, noLink: true
    });
    if (confirmation.response !== 1) throw new Error('恢复已取消');
    const before = await createTreeSnapshot(record.location.path, pending.preview.preRestoreSnapshotPath);
    requireStore().addSaveSnapshot(pending.branchId, pending.preRestoreSnapshotId, `恢复前 · ${new Date().toLocaleString('zh-CN')}`, pending.preview.preRestoreSnapshotPath, 'before_restore', before.manifestHash);
    const restored = await restoreTreeSnapshot(record.snapshot.path, record.location.path);
    log('INFO', `已恢复存档快照 ${record.snapshot.id}；恢复前快照 ${pending.preRestoreSnapshotId}；原目录 ${restored.recoveryPath}`);
    return requireStore().listSaveLocations(pending.gameId);
  });

  ipcMain.handle('profile:get', (event) => {
    assertTrusted(event);
    return hydrateProfile();
  });

  ipcMain.handle('profile:save', async (event, input: ProfileInput) => {
    assertTrusted(event);
    if (!input || typeof input.name !== 'string' || !input.name.trim()) throw new Error('昵称不能为空');
    if (input.name.trim().length > 40) throw new Error('昵称过长');
    const profileStore = requireStore();
    profileStore.setSetting('profile.name', input.name.trim());
    if (input.avatarSourcePath != null) {
      if (typeof input.avatarSourcePath !== 'string' || !path.isAbsolute(input.avatarSourcePath)) throw new Error('头像路径无效');
      profileStore.setSetting('profile.avatarPath', await copyProfileAvatar(input.avatarSourcePath));
    }
    return hydrateProfile();
  });

  ipcMain.handle('preferences:get', (event) => {
    assertTrusted(event);
    return readPreferences();
  });

  ipcMain.handle('preferences:save', (event, preferences: AppPreferences) => {
    assertTrusted(event);
    const validCategoryOrder = Array.isArray(preferences?.categoryOrder) && preferences.categoryOrder.length <= 200 && preferences.categoryOrder.every((category) => typeof category === 'string' && Boolean(category.trim()) && category.length <= 80) && new Set(preferences.categoryOrder).size === preferences.categoryOrder.length;
    if (!preferences || !['dark', 'light'].includes(preferences.theme) || !['original', 'chinese'].includes(preferences.titleDisplayMode) || !['grid', 'list'].includes(preferences.libraryViewMode) || typeof preferences.safeView !== 'boolean' || typeof preferences.sidebarCollapsed !== 'boolean' || !validCategoryOrder) throw new Error('无效的应用设置');
    const preferenceStore = requireStore();
    preferenceStore.setSetting('appearance.theme', preferences.theme);
    preferenceStore.setSetting('appearance.titleDisplayMode', preferences.titleDisplayMode);
    preferenceStore.setSetting('appearance.libraryViewMode', preferences.libraryViewMode);
    preferenceStore.setSetting('privacy.safeView', String(preferences.safeView));
    preferenceStore.setSetting('appearance.sidebarCollapsed', String(preferences.sidebarCollapsed));
    preferenceStore.setSetting('appearance.categoryOrder', JSON.stringify(preferences.categoryOrder));
    return readPreferences();
  });

  ipcMain.handle('app:open-data-directory', async (event) => {
    assertTrusted(event);
    const dataDirectory = app.getPath('userData');
    const error = await shell.openPath(dataDirectory);
    if (error) throw new Error(`无法打开数据文件夹：${error}`);
    return dataDirectory;
  });

  ipcMain.handle('app:create-backup', (event) => {
    assertTrusted(event);
    const destination = createStoreBackup(requireStore(), app.getPath('userData'), 'manual');
    log('INFO', `已创建手动备份：${destination}`);
    return { message: '备份已创建并通过完整性校验', path: destination };
  });

  ipcMain.handle('app:restore-backup', async (event) => {
    assertTrusted(event);
    const dataDirectory = app.getPath('userData');
    const selected = await dialog.showOpenDialog(mainWindow!, {
      title: '选择 GameShelf 数据库备份',
      defaultPath: libraryPaths(dataDirectory).backups,
      properties: ['openFile'],
      filters: [{ name: 'GameShelf database', extensions: ['sqlite', 'db'] }]
    });
    const source = selected.filePaths[0];
    if (selected.canceled || !source) return null;
    const inspection = inspectGameDatabase(source);
    if (!inspection.valid) throw new Error(`无法恢复：${inspection.message}。当前游戏库未被修改。`);
    const confirmation = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      title: '恢复游戏库',
      message: '用所选备份替换当前游戏库？',
      detail: `已通过完整性校验（数据库版本 ${inspection.schemaVersion}）。GameShelf 会先自动保存当前游戏库；游戏目录不会被修改。`,
      buttons: ['取消', '恢复'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    });
    if (confirmation.response !== 1) return null;

    const current = requireStore();
    try {
      const restored = restoreStore(current, source, dataDirectory);
      store = restored.store;
      log('WARN', '已从用户选择的备份恢复游戏库，并保留恢复前备份');
      return { message: '游戏库已恢复；恢复前副本也已保留', path: restored.safetyBackup };
    } catch (error) {
      try {
        current.getDiagnostics();
        store = current;
      } catch {
        store = new GameStore(libraryPaths(dataDirectory).database);
      }
      log('ERROR', `恢复游戏库失败：${errorText(error)}`);
      throw error;
    }
  });

  ipcMain.handle('app:export-diagnostics', async (event) => {
    assertTrusted(event);
    const day = new Date().toISOString().slice(0, 10);
    const selected = await dialog.showSaveDialog(mainWindow!, {
      title: '导出 GameShelf 诊断信息',
      defaultPath: `GameShelf-diagnostics-${day}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (selected.canceled || !selected.filePath) return null;
    const dataDirectory = app.getPath('userData');
    const diagnostics = {
      exportedAt: new Date().toISOString(),
      app: { version: app.getVersion(), packaged: app.isPackaged },
      system: { platform: process.platform, release: os.release(), arch: process.arch, electron: process.versions.electron, node: process.versions.node },
      database: requireStore().getDiagnostics(),
      startup: {
        previousExitWasUnclean: startupSafety?.uncleanExit ?? false,
        recoveredFromBackup: Boolean(startupSafety?.recoveredFrom),
        preMigrationBackupCreated: Boolean(startupSafety?.preMigrationBackup)
      },
      privacy: '游戏名称、启动路径和图片路径未包含在此报告中；日志中的用户目录已替换。',
      recentLogs: logTail(libraryPaths(dataDirectory).log, [dataDirectory, os.homedir()])
    };
    await writeFile(selected.filePath, `${JSON.stringify(diagnostics, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    log('INFO', '已导出诊断信息');
    return { message: '诊断信息已导出（不包含游戏名称和启动路径）', path: selected.filePath };
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    icon: path.join(app.getAppPath(), 'assets', 'app-icon.png'),
    backgroundColor: '#0d1117',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (startupMessages.length > 0) {
      void dialog.showMessageBox(mainWindow!, {
        type: startupSafety?.recoveredFrom ? 'warning' : 'info',
        title: 'GameShelf 数据安全检查',
        message: startupSafety?.recoveredFrom ? '游戏库已从最近的有效备份恢复' : '游戏库安全检查已完成',
        detail: startupMessages.join('\n'),
        buttons: ['知道了'],
        noLink: true
      });
    }
  });
  mainWindow.on('unresponsive', () => log('ERROR', '主窗口无响应'));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

process.once('uncaughtException', (error) => {
  log('ERROR', `主进程崩溃：${errorText(error)}`);
  dialog.showErrorBox('GameShelf 意外退出', '崩溃日志已保存在 data\\logs。已经启动的游戏不会被关闭；重新打开 GameShelf 时会自动校验游戏库。');
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('ERROR', `未处理的异步错误：${errorText(reason)}`);
});

app.on('render-process-gone', (_event, webContents, details) => {
  if (details.reason === 'clean-exit') return;
  log('ERROR', `渲染进程退出：reason=${details.reason} exitCode=${details.exitCode}`);
  if (mainWindow?.webContents === webContents) {
    void dialog.showMessageBox(mainWindow, {
      type: 'error',
      title: 'GameShelf 界面意外退出',
      message: '游戏库和已经启动的游戏不受影响。',
      detail: '你可以重新载入界面；若问题重复出现，请在“设置”中导出诊断信息。',
      buttons: ['关闭', '重新载入'],
      defaultId: 1,
      cancelId: 0,
      noLink: true
    }).then((result) => {
      if (result.response === 1 && !webContents.isDestroyed()) webContents.reload();
    });
  }
});

app.whenReady().then(() => {
  app.setAppUserModelId('com.squirrel.GameShelf.GameShelf');
  Menu.setApplicationMenu(null);
  const dataDirectory = app.getPath('userData');
  startupSafety = prepareDatabase(dataDirectory);
  if (startupSafety.recoveredFrom) {
    startupMessages.push(`${startupSafety.uncleanExit ? '上次未正常退出，且' : ''}数据库校验失败；已从 ${startupSafety.recoveredFrom} 恢复。原文件保存在 ${startupSafety.preservedDatabase}。`);
  } else if (startupSafety.uncleanExit) {
    startupMessages.push('检测到上次未正常退出；SQLite 恢复与完整性校验通过，没有回退数据。');
  }
  if (startupSafety.preMigrationBackup) log('INFO', `迁移前备份：${startupSafety.preMigrationBackup}`);
  store = new GameStore(startupSafety.paths.database);
  try {
    const automaticBackup = createStoreBackup(store, dataDirectory, 'auto');
    log('INFO', `自动备份可用：${automaticBackup}`);
  } catch (error) {
    log('ERROR', `自动备份失败：${errorText(error)}`);
    startupMessages.push(`自动备份失败：${error instanceof Error ? error.message : String(error)}。请检查 data 文件夹剩余空间与写入权限。`);
  }
  markRunning(startupSafety.paths);
  log('INFO', `GameShelf ${app.getVersion()} 启动；数据库版本 ${store.getSchemaVersion()}`);
  registerIpc();
  createWindow();
}).catch((error) => {
  log('ERROR', `启动失败：${errorText(error)}`);
  dialog.showErrorBox('无法打开 GameShelf 游戏库', `${error instanceof Error ? error.message : String(error)}\n\n原游戏目录不会被修改。请先复制 data 文件夹，再查看 data\\logs\\gameshelf.log。`);
  app.exit(1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  try {
    store?.close();
    store = null;
    if (startupSafety) clearRunning(startupSafety.paths);
    log('INFO', 'GameShelf 正常退出');
  } catch (error) {
    log('ERROR', `关闭游戏库失败：${errorText(error)}`);
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
