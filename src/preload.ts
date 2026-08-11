import { contextBridge, ipcRenderer } from 'electron';
import type { AppPreferences, GameSettingsInput, GameShelfApi, LaunchProfileInput, NewGameInput, ProfileInput } from './shared';

const api: GameShelfApi = {
  listGames: () => ipcRenderer.invoke('games:list'),
  getGame: (id) => ipcRenderer.invoke('games:get', id),
  addGame: (input: NewGameInput) => ipcRenderer.invoke('games:add', input),
  removeGame: (id) => ipcRenderer.invoke('games:remove', id),
  updateGameStatus: (id, status) => ipcRenderer.invoke('games:update-status', id, status),
  updateGameCategory: (id, category) => ipcRenderer.invoke('games:update-category', id, category),
  updateGameSettings: (id, input: GameSettingsInput) => ipcRenderer.invoke('games:update-settings', id, input),
  saveLaunchProfile: (gameId, input: LaunchProfileInput) => ipcRenderer.invoke('games:save-launch-profile', gameId, input),
  deleteLaunchProfile: (gameId, profileId) => ipcRenderer.invoke('games:delete-launch-profile', gameId, profileId),
  pickExecutable: () => ipcRenderer.invoke('games:pick-executable'),
  analyzeExecutable: (executablePath) => ipcRenderer.invoke('games:analyze-executable', executablePath),
  pickCover: () => ipcRenderer.invoke('games:pick-cover'),
  pickBackground: () => ipcRenderer.invoke('games:pick-background'),
  launchGame: (id, profileId) => ipcRenderer.invoke('games:launch', id, profileId),
  openGameDirectory: (id) => ipcRenderer.invoke('games:open-directory', id),
  listCollections: () => ipcRenderer.invoke('collections:list'),
  createCollection: (name) => ipcRenderer.invoke('collections:create', name),
  setGameCollections: (gameId, collectionIds) => ipcRenderer.invoke('collections:set-game', gameId, collectionIds),
  getProfile: () => ipcRenderer.invoke('profile:get'),
  saveProfile: (input: ProfileInput) => ipcRenderer.invoke('profile:save', input),
  getPreferences: () => ipcRenderer.invoke('preferences:get'),
  savePreferences: (preferences: AppPreferences) => ipcRenderer.invoke('preferences:save', preferences),
  openDataDirectory: () => ipcRenderer.invoke('app:open-data-directory'),
  createBackup: () => ipcRenderer.invoke('app:create-backup'),
  restoreBackup: () => ipcRenderer.invoke('app:restore-backup'),
  exportDiagnostics: () => ipcRenderer.invoke('app:export-diagnostics')
};

contextBridge.exposeInMainWorld('gameshelf', api);
