import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, Menu, shell, type IpcMainInvokeEvent } from 'electron';
import started from 'electron-squirrel-startup';
import { GameStore } from './game-store';
import { analyzeExecutable } from './game-detection';
import { parseLaunchArguments } from './launch';
import type { AppPreferences, Game, GameSettingsInput, GameStatus, LaunchProfileInput, NewGameInput, PickedImage, ProfileInput, UserProfile } from './shared';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

if (started) app.quit();

let mainWindow: BrowserWindow | null = null;
let store: GameStore | null = null;

const gameTypes = new Set(['visual_novel', 'rpg', 'simulation', 'action', 'other']);
const contentRatings = new Set(['general', 'mature', 'r18']);
const gameStatuses = new Set(['unplayed', 'playing', 'completed', 'paused']);

function assertTrusted(event: IpcMainInvokeEvent): void {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('Untrusted renderer request');
  }
}

function requireStore(): GameStore {
  if (!store) throw new Error('Database is not ready');
  return store;
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
  const details = await stat(executablePath);
  if (!details.isFile()) throw new Error('启动文件不存在');
}

async function copyCover(gameId: string, sourcePath: string): Promise<string> {
  const extension = path.extname(sourcePath).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) throw new Error('不支持的封面格式');
  const destinationDirectory = path.join(app.getPath('userData'), 'covers');
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
    safeView: preferenceStore.getSetting('privacy.safeView') === 'true',
    sidebarCollapsed: preferenceStore.getSetting('appearance.sidebarCollapsed') === 'true'
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
      const coverPath = await copyCover(game.id, input.coverSourcePath);
      game = requireStore().setCoverPath(game.id, coverPath);
    }
    return hydrateGame(game);
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
    if (typeof id !== 'string' || !input || typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 200) throw new Error('游戏名称无效');
    if (typeof input.wishlist !== 'boolean' || typeof input.hideInSafeView !== 'boolean') throw new Error('游戏设置无效');
    if (input.coverSourcePath != null && (typeof input.coverSourcePath !== 'string' || !path.isAbsolute(input.coverSourcePath))) throw new Error('封面路径无效');
    if (!requireStore().getGame(id)) throw new Error('找不到这个游戏');
    let game = requireStore().setGameSettings(id, input);
    if (input.coverSourcePath) game = requireStore().setCoverPath(id, await copyCover(id, input.coverSourcePath));
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
    const child = spawn(profile.executablePath, parseLaunchArguments(profile.launchArguments), {
      cwd: profile.workingDirectory,
      windowsHide: false,
      stdio: 'ignore'
    });
    await new Promise<void>((resolve, reject) => {
      child.once('spawn', resolve);
      child.once('error', reject);
    });
    child.once('close', () => {
      store?.recordSession(game.id, startedAt, (Date.now() - startedAt.getTime()) / 1000);
    });
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

  ipcMain.handle('collections:set-game', (event, gameId: unknown, collectionIds: unknown) => {
    assertTrusted(event);
    if (typeof gameId !== 'string' || !Array.isArray(collectionIds) || !collectionIds.every((id) => typeof id === 'string')) throw new Error('无效的合集设置');
    if (!requireStore().getGame(gameId)) throw new Error('找不到这个游戏');
    const validIds = new Set(requireStore().listCollections().map((collection) => collection.id));
    if (!(collectionIds as string[]).every((id) => validIds.has(id))) throw new Error('合集不存在');
    requireStore().setGameCollections(gameId, [...new Set(collectionIds as string[])]);
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
    if (!preferences || !['dark', 'light'].includes(preferences.theme) || typeof preferences.safeView !== 'boolean' || typeof preferences.sidebarCollapsed !== 'boolean') throw new Error('无效的应用设置');
    const preferenceStore = requireStore();
    preferenceStore.setSetting('appearance.theme', preferences.theme);
    preferenceStore.setSetting('privacy.safeView', String(preferences.safeView));
    preferenceStore.setSetting('appearance.sidebarCollapsed', String(preferences.sidebarCollapsed));
    return readPreferences();
  });

  ipcMain.handle('app:open-data-directory', async (event) => {
    assertTrusted(event);
    const dataDirectory = app.getPath('userData');
    const error = await shell.openPath(dataDirectory);
    if (error) throw new Error(error);
    return dataDirectory;
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0d1117',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.squirrel.GameShelf.GameShelf');
  Menu.setApplicationMenu(null);
  store = new GameStore(path.join(app.getPath('userData'), 'gameshelf.sqlite'));
  registerIpc();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  store?.close();
  store = null;
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
