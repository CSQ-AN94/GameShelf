import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import started from 'electron-squirrel-startup';
import { GameStore } from './game-store';
import { parseLaunchArguments } from './launch';
import type { Game, NewGameInput, PickedImage } from './shared';

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
  return { ...game, coverDataUrl: await imageDataUrl(game.coverPath) };
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

  ipcMain.handle('games:add', async (event, input: NewGameInput) => {
    assertTrusted(event);
    if (!input || typeof input.title !== 'string' || !input.title.trim()) throw new Error('游戏名称不能为空');
    if (input.title.length > 200) throw new Error('游戏名称过长');
    if (!gameTypes.has(input.type)) throw new Error('无效的游戏类型');
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

  ipcMain.handle('games:launch', async (event, id: unknown) => {
    assertTrusted(event);
    if (typeof id !== 'string') throw new Error('Invalid game id');
    const game = requireStore().getGame(id);
    if (!game) throw new Error('找不到这个游戏');
    await validateExecutable(game.executablePath);
    const startedAt = new Date();
    const child = spawn(game.executablePath, parseLaunchArguments(game.launchArguments), {
      cwd: game.workingDirectory,
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
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0d1117',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

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
