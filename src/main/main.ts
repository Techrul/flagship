import { app, BrowserWindow, ipcMain, net, protocol, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { Library } from './library';
import { downloadProject, downloadThumbnail, fetchMetadata, parseProjectInput, ScratchError } from './scratch';
import { runSmokeTest } from './smoke';
import { SettingsStore } from './settings-store';
import { CustomThemes } from './custom-themes';
import { effectiveSettings, resolveProfile } from '../shared/settings';
import { Updater, UpdateError } from './updater';
import { DesktopEntry } from './desktop-entry';

// Serves cached thumbnails to the UI as flagship-media://thumb/<id>
protocol.registerSchemesAsPrivileged([
  { scheme: 'flagship-media', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const RENDERER_DIR = path.join(__dirname, '..', 'renderer');
let library: Library;
let settings: SettingsStore;
let customThemes: CustomThemes;
let updater: Updater;
let desktopEntry: DesktopEntry;
const ICON = path.join(app.getAppPath(), 'assets', 'icon.png');

// Windows groups taskbar windows by this id; it must match the Start Menu shortcut.
if (process.platform === 'win32') app.setAppUserModelId('com.techrul.flagship');
let updating = false;
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
    icon: ICON,
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
    icon: ICON,
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

  ipcMain.handle('library:add', async (event, input: string, profile: string | null = null) => {
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
      const game = library.add(rest, project, thumbnail, typeof profile === 'string' ? profile : null);
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

  // ----- setting profiles -----
  const profileAction = (fn: () => unknown) => {
    try {
      const result = fn();
      broadcast('settings:changed', settings.get());
      return { ok: true, result };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  };
  ipcMain.handle('profiles:create', (_event, name: unknown, copyFrom: unknown) =>
    profileAction(() => settings.createProfile(name, copyFrom)));
  ipcMain.handle('profiles:update', (_event, id: unknown, patch: unknown) =>
    profileAction(() => settings.updateProfile(id, patch)));
  ipcMain.handle('profiles:delete', (_event, id: unknown) =>
    profileAction(() => settings.deleteProfile(id)));

  /** config = { profile?: id | null, overrides?: {...} } */
  ipcMain.handle('game:set-config', (_event, id: string, config: any) => {
    const game = library.setConfig(String(id), { profile: config?.profile, overrides: config?.overrides });
    if (game) broadcast('game:settings-changed', { id: game.id });
    return game ?? null;
  });

  /** The game's profile merged with its overrides: what the player actually uses. */
  ipcMain.handle('game:effective-settings', (_event, id: string) => {
    const game = library.get(String(id));
    return effectiveSettings(resolveProfile(settings.get(), game?.profile).settings, game?.settings);
  });

  // ----- updates -----
  ipcMain.handle('updates:check', async () => {
    try {
      return { ok: true, result: await updater.check() };
    } catch (error) {
      return { ok: false, error: error instanceof UpdateError ? error.message : `Update check failed: ${(error as Error).message}` };
    }
  });

  ipcMain.handle('updates:apply', async (event) => {
    if (updating) return { ok: false, error: 'An update is already running.' };
    updating = true;
    try {
      const result = await updater.apply((stage) => event.sender.send('updates:progress', stage));
      event.sender.send('updates:progress', 'Restarting');
      setTimeout(() => { app.relaunch(); app.exit(0); }, 800);
      return { ok: true, result };
    } catch (error) {
      return { ok: false, error: error instanceof UpdateError ? error.message : `Update failed: ${(error as Error).message}` };
    } finally {
      updating = false;
    }
  });

  ipcMain.handle('app:version', () => app.getVersion());

  // ----- app menu shortcut -----
  const menuAction = (fn: () => unknown) => {
    try {
      return { ok: true, result: fn() };
    } catch (error) {
      return { ok: false, error: `Couldn't change the app menu shortcut: ${(error as Error).message}` };
    }
  };
  ipcMain.handle('menu:status', () => menuAction(() => desktopEntry.status()));
  ipcMain.handle('menu:install', () => menuAction(() => desktopEntry.install()));
  ipcMain.handle('menu:remove', () => menuAction(() => desktopEntry.remove()));

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
  updater = new Updater(app.getAppPath());
  desktopEntry = new DesktopEntry(app.getAppPath(), process.execPath);
  registerIpc();
  registerMediaProtocol();
  libraryWindow = createLibraryWindow();

  if (process.env.FLAGSHIP_SMOKE) {
    try {
      await runSmokeTest({ library, libraryWindow, openPlayer, outDir: process.env.FLAGSHIP_SMOKE });
    } catch (error) {
      console.log('[smoke] FAILED:', error);
      process.exitCode = 1;
    }
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) libraryWindow = createLibraryWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
