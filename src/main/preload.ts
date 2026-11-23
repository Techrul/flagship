// The only bridge between the web UI and the rest of the app. Keep it small.
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('flagship', {
  listGames: () => ipcRenderer.invoke('library:list'),
  addGame: (input: string) => ipcRenderer.invoke('library:add', input),
  removeGame: (id: string) => ipcRenderer.invoke('library:remove', id),
  playGame: (id: string) => ipcRenderer.invoke('game:play', id),
  getGame: (id: string) => ipcRenderer.invoke('game:get', id),
  getProject: (id: string) => ipcRenderer.invoke('game:project', id),
  openOnScratch: (id: string) => ipcRenderer.invoke('game:open-on-scratch', id),
  onAddProgress: (callback: (p: { id: string; stage: string; fraction: number }) => void) => {
    ipcRenderer.on('library:add-progress', (_event, p) => callback(p));
  },
  onLibraryChanged: (callback: () => void) => {
    ipcRenderer.on('library:changed', () => callback());
  },
});
