// The only bridge between the web UI and the rest of the app. Keep it small.
import { contextBridge, ipcRenderer } from 'electron';

const on = (channel: string) => (callback: (payload: any) => void) => {
  ipcRenderer.on(channel, (_event, payload) => callback(payload));
};

contextBridge.exposeInMainWorld('flagship', {
  listGames: () => ipcRenderer.invoke('library:list'),
  addGame: (input: string) => ipcRenderer.invoke('library:add', input),
  removeGame: (id: string) => ipcRenderer.invoke('library:remove', id),
  playGame: (id: string) => ipcRenderer.invoke('game:play', id),
  getGame: (id: string) => ipcRenderer.invoke('game:get', id),
  getProject: (id: string) => ipcRenderer.invoke('game:project', id),
  openOnScratch: (id: string) => ipcRenderer.invoke('game:open-on-scratch', id),
  setGameSettings: (id: string, overrides: unknown) => ipcRenderer.invoke('game:set-settings', id, overrides),
  getEffectiveSettings: (id: string) => ipcRenderer.invoke('game:effective-settings', id),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: unknown) => ipcRenderer.invoke('settings:set', patch),
  listCustomThemes: () => ipcRenderer.invoke('themes:list'),
  openThemesFolder: () => ipcRenderer.invoke('themes:open-folder'),
  onAddProgress: on('library:add-progress'),
  onLibraryChanged: on('library:changed'),
  onSettingsChanged: on('settings:changed'),
  onGameSettingsChanged: on('game:settings-changed'),
});
