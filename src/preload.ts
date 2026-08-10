import { contextBridge, ipcRenderer } from 'electron';
import type { AppPreferences, GameShelfApi, NewGameInput, ProfileInput } from './shared';

const api: GameShelfApi = {
  listGames: () => ipcRenderer.invoke('games:list'),
  getGame: (id) => ipcRenderer.invoke('games:get', id),
  addGame: (input: NewGameInput) => ipcRenderer.invoke('games:add', input),
  updateGameStatus: (id, status) => ipcRenderer.invoke('games:update-status', id, status),
  updateGameCategory: (id, category) => ipcRenderer.invoke('games:update-category', id, category),
  pickExecutable: () => ipcRenderer.invoke('games:pick-executable'),
  analyzeExecutable: (executablePath) => ipcRenderer.invoke('games:analyze-executable', executablePath),
  pickCover: () => ipcRenderer.invoke('games:pick-cover'),
  launchGame: (id) => ipcRenderer.invoke('games:launch', id),
  listCollections: () => ipcRenderer.invoke('collections:list'),
  createCollection: (name) => ipcRenderer.invoke('collections:create', name),
  setGameCollections: (gameId, collectionIds) => ipcRenderer.invoke('collections:set-game', gameId, collectionIds),
  getProfile: () => ipcRenderer.invoke('profile:get'),
  saveProfile: (input: ProfileInput) => ipcRenderer.invoke('profile:save', input),
  getPreferences: () => ipcRenderer.invoke('preferences:get'),
  savePreferences: (preferences: AppPreferences) => ipcRenderer.invoke('preferences:save', preferences),
  openDataDirectory: () => ipcRenderer.invoke('app:open-data-directory')
};

contextBridge.exposeInMainWorld('gameshelf', api);
