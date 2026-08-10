import { contextBridge, ipcRenderer } from 'electron';
import type { GameShelfApi, NewGameInput, ProfileInput } from './shared';

const api: GameShelfApi = {
  listGames: () => ipcRenderer.invoke('games:list'),
  getGame: (id) => ipcRenderer.invoke('games:get', id),
  addGame: (input: NewGameInput) => ipcRenderer.invoke('games:add', input),
  updateGameStatus: (id, status) => ipcRenderer.invoke('games:update-status', id, status),
  pickExecutable: () => ipcRenderer.invoke('games:pick-executable'),
  pickCover: () => ipcRenderer.invoke('games:pick-cover'),
  launchGame: (id) => ipcRenderer.invoke('games:launch', id),
  listCollections: () => ipcRenderer.invoke('collections:list'),
  createCollection: (name) => ipcRenderer.invoke('collections:create', name),
  setGameCollections: (gameId, collectionIds) => ipcRenderer.invoke('collections:set-game', gameId, collectionIds),
  getProfile: () => ipcRenderer.invoke('profile:get'),
  saveProfile: (input: ProfileInput) => ipcRenderer.invoke('profile:save', input)
};

contextBridge.exposeInMainWorld('gameshelf', api);
