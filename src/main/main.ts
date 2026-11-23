import { app, BrowserWindow, ipcMain, net, protocol, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Library } from './library';
import { downloadProject, downloadThumbnail, fetchMetadata, parseProjectInput, ScratchError } from './scratch';
import { runSmokeTest } from './smoke';
import { SettingsStore } from './settings-store';
import { CustomThemes } from './custom-themes';
import { effectiveSettings } from '../shared/settings';

// Serves cached thumbnails to the UI as flagship-media://thumb/<id>
protocol.registerSchemesAsPrivileged([
  { scheme: 'flagship-media', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
let library: Library;
let settings: SettingsStore;
let customThemes: CustomThemes;
let libraryWindow: BrowserWindow | null = null;
const playerWindows = new Map<string, BrowserWindow>();

function createLibraryWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 720,
    minHeight: 480,
    backgroundColor: '#000000',
    title: 'Flagship',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(RENDERER_DIR, 'library', 'index.html'));
  // Links in game descriptions etc. open in the real browser, never inside Flagship.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => { libraryWindow = null; });
  return win;
}

function openPlayer(id: string): BrowserWindow {
  const game = library.get(id);
  if (!game) throw new Error(`Game ${id} is not in the library`);

  const existing = playerWindows.get(id);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return existing;
  }

  const win = new BrowserWindow({
    width: 960,
    height: 760,
    backgroundColor: '#000000',
    title: game.title,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(RENDERER_DIR, 'player', 'player.html'), { query: { id } });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Playtime = how long the player window was open.
  const openedAt = Date.now();
  playerWindows.set(id, win);
  win.on('closed', () => {
    playerWindows.delete(id);
    library.recordSession(id, (Date.now() - openedAt) / 1000);
    libraryWindow?.webContents.send('library:changed');
  });
  return win;
}

function registerIpc(): void {
  ipcMain.handle('library:list', () => library.list());

  ipcMain.handle('library:add', async (event, input: string) => {
    const id = parseProjectInput(String(input));
    if (!id) {
      return { ok: false, error: "That doesn't look like a Scratch project link or ID." };
    }
    const progress = (stage: string, fraction = 0) =>
      event.sender.send('library:add-progress', { id, stage, fraction });
    try {
      progress('Looking up project');
      const meta = await fetchMetadata(id);
      progress('Downloading', 0);
      const project = await downloadProject(id, (f) => progress('Downloading', f));
      progress('Saving');
      const thumbnail = await downloadThumbnail(meta.thumbnailUrl);
      const { thumbnailUrl: _unused, ...rest } = meta;
      const game = library.add(rest, project, thumbnail);
      return { ok: true, game };
    } catch (error) {
      const message = error instanceof ScratchError ? error.message : `Something went wrong: ${(error as Error).message}`;
      return { ok: false, error: message };
    }
  });

  ipcMain.handle('library:remove', (_event, id: string) => {
    playerWindows.get(id)?.close();
    library.remove(String(id));
  });

  ipcMain.handle('game:play', (_event, id: string) => { openPlayer(String(id)); });

  ipcMain.handle('game:get', (_event, id: string) => library.get(String(id)) ?? null);

  // The player asks for its project file; it comes back as raw bytes.
  ipcMain.handle('game:project', (_event, id: string) => library.readProject(String(id)));

  // ----- settings -----
  ipcMain.handle('settings:get', () => settings.get());

  ipcMain.handle('settings:set', (_event, patch: unknown) => {
    const updated = settings.update(patch);
    broadcast('settings:changed', updated);
    return updated;
  });

  ipcMain.handle('game:set-settings', (_event, id: string, overrides: unknown) => {
    const game = library.setSettings(String(id), overrides);
    if (game) broadcast('game:settings-changed', { id: game.id });
    return game ?? null;
  });

  /** Global defaults merged with the game's overrides: what the player actually uses. */
  ipcMain.handle('game:effective-settings', (_event, id: string) =>
    effectiveSettings(settings.get().player, library.get(String(id))?.settings));

  // ----- custom themes -----
  ipcMain.handle('themes:list', () => customThemes.list());
  ipcMain.handle('themes:open-folder', () => shell.openPath(customThemes.dir));

  ipcMain.handle('game:open-on-scratch', (_event, id: string) => {
    if (/^\d+$/.test(String(id))) shell.openExternal(`https://scratch.mit.edu/projects/${id}/`);
  });
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function registerMediaProtocol(): void {
  protocol.handle('flagship-media', (request) => {
    const url = new URL(request.url);
    if (url.host === 'theme') {
      const file = customThemes.resolve(decodeURIComponent(url.pathname.replace(/^\//, '')));
      if (!file) return new Response('', { status: 404, headers: { 'content-type': 'text/css' } });
      return new Response(fs.readFileSync(file), { headers: { 'content-type': 'text/css', 'cache-control': 'no-store' } });
    }
    const id = url.pathname.replace(/^\//, '');
    if (url.host !== 'thumb' || !/^\d{1,12}$/.test(id)) {
      return new Response('Not found', { status: 404 });
    }
    const file = path.join(library.gameDir(id), 'thumbnail.png');
    if (!fs.existsSync(file)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

app.whenReady().then(async () => {
  library = new Library(path.join(app.getPath('userData'), 'library'));
  settings = new SettingsStore(app.getPath('userData'));
  customThemes = new CustomThemes(path.join(app.getPath('userData'), 'themes'));
  registerIpc();
  registerMediaProtocol();
  libraryWindow = createLibraryWindow();

  if (process.env.FLAGSHIP_SMOKE) {
    await runSmokeTest({ library, libraryWindow, openPlayer, outDir: process.env.FLAGSHIP_SMOKE });
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) libraryWindow = createLibraryWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
