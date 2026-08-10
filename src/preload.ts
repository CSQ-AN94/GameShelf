import { contextBridge, ipcRenderer } from 'electron';
import type { GameShelfApi, NewGameInput } from './shared';

const api: GameShelfApi = {
  listGames: () => ipcRenderer.invoke('games:list'),
  getGame: (id) => ipcRenderer.invoke('games:get', id),
  addGame: (input: NewGameInput) => ipcRenderer.invoke('games:add', input),
  pickExecutable: () => ipcRenderer.invoke('games:pick-executable'),
  pickCover: () => ipcRenderer.invoke('games:pick-cover'),
  launchGame: (id) => ipcRenderer.invoke('games:launch', id)
};

contextBridge.exposeInMainWorld('gameshelf', api);
