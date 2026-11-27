// Self-updating for installed builds, using electron-updater with GitHub Releases.
// Which method applies depends on how Flagship was installed; see InstallKind in shared/updates.ts.
import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { InstallKind, UpdateState } from '../shared/updates';

export interface InstallInfo {
  kind: InstallKind;
  packageType?: string;
  hint?: string;
}

/** Works out how this copy was installed. Pure-ish: everything it looks at is passed in, so it's testable. */
export function detectInstall(env: {
  isPackaged: boolean;
  platform: NodeJS.Platform;
  execPath: string;
  resourcesPath: string;
  appImage?: string;
  exists: (p: string) => boolean;
  read: (p: string) => string;
}): InstallInfo {
  if (!env.isPackaged) return { kind: 'git' };

  if (env.platform === 'linux') {
    if (env.appImage) return { kind: 'appimage' };
    const typeFile = path.join(env.resourcesPath, 'package-type');
    const type = env.exists(typeFile) ? env.read(typeFile).trim() : '';
    if (type === 'pacman' || type === 'deb' || type === 'rpm') return { kind: 'system', packageType: type };
    if (env.execPath.startsWith('/opt/flagship/')) {
      return { kind: 'manual', hint: 'Installed from the AUR: update with your AUR helper, e.g. yay -Syu.' };
    }
    return { kind: 'manual', hint: 'Download the new .tar.gz (or switch to the AppImage, which updates itself).' };
  }

  if (env.platform === 'win32') {
    const dir = path.win32.dirname(env.execPath);
    if (/[\\/]scoop[\\/]apps[\\/]/i.test(env.execPath)) {
      return { kind: 'manual', hint: 'Installed with Scoop: run scoop update flagship.' };
    }
    // The installer puts an uninstaller next to the app; the portable zip doesn't.
    if (env.exists(path.win32.join(dir, 'Uninstall Flagship.exe'))) return { kind: 'nsis' };
    return { kind: 'manual', hint: 'Portable copy: download the new .zip (or use the installer, which updates itself).' };
  }

  // macOS: automatic updates need a paid Apple signature, which Flagship doesn't have yet.
  return { kind: 'manual', hint: 'Installed with Homebrew? Run brew upgrade. Otherwise download the new .dmg.' };
}

export function currentInstall(): InstallInfo {
  return detectInstall({
    isPackaged: app.isPackaged,
    platform: process.platform,
    execPath: process.execPath,
    resourcesPath: process.resourcesPath,
    appImage: process.env.APPIMAGE,
    exists: (p) => fs.existsSync(p),
    read: (p) => fs.readFileSync(p, 'utf8'),
  });
}

/** Drives electron-updater for appimage / nsis / system installs and reports progress as UpdateState. */
export class AutoUpdater {
  private state: UpdateState;
  private updater: any = null; // electron-updater's autoUpdater, loaded lazily

  constructor(private readonly install: InstallInfo, private readonly onState: (s: UpdateState) => void) {
    this.state = { kind: install.kind, phase: 'idle', current: app.getVersion(), packageType: install.packageType };
  }

  get snapshot(): UpdateState {
    return { ...this.state };
  }

  private set(patch: Partial<UpdateState>): void {
    this.state = { ...this.state, ...patch };
    this.onState(this.snapshot);
  }

  private load(): any {
    if (this.updater) return this.updater;
    // Loaded on demand so git clones and manual installs never touch it.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { autoUpdater } = require('electron-updater');
    const silentInstall = this.install.kind === 'appimage' || this.install.kind === 'nsis';

    autoUpdater.autoDownload = true;
    // AppImage / Windows: install quietly when you quit. System packages need your password,
    // so they only install when you click Install (never a surprise prompt while closing).
    autoUpdater.autoInstallOnAppQuit = silentInstall;
    autoUpdater.allowPrerelease = app.getVersion().includes('-'); // betas follow betas
    autoUpdater.allowDowngrade = false;
    autoUpdater.logger = {
      info: (m: unknown) => console.log('[updater]', m),
      warn: (m: unknown) => console.warn('[updater]', m),
      error: (m: unknown) => console.error('[updater]', m),
      debug: () => {},
    };

    // Testing only: point at a local server instead of GitHub Releases.
    if (process.env.FLAGSHIP_UPDATE_FEED) {
      autoUpdater.setFeedURL({ provider: 'generic', url: process.env.FLAGSHIP_UPDATE_FEED });
      autoUpdater.forceDevUpdateConfig = true;
    }

    autoUpdater.on('checking-for-update', () => this.set({ phase: 'checking', error: undefined }));
    autoUpdater.on('update-not-available', () => this.set({ phase: 'none' }));
    autoUpdater.on('update-available', (info: { version: string }) =>
      this.set({ phase: 'downloading', version: info.version, percent: 0 }));
    autoUpdater.on('download-progress', (p: { percent: number }) =>
      this.set({ phase: 'downloading', percent: Math.round(p.percent) }));
    autoUpdater.on('update-downloaded', (info: { version: string }) =>
      this.set({ phase: 'ready', version: info.version, percent: 100 }));
    autoUpdater.on('error', (error: Error) =>
      this.set({ phase: 'error', error: friendlyError(error) }));

    this.updater = autoUpdater;
    return autoUpdater;
  }

  async check(): Promise<UpdateState> {
    // Don't restart a download that's running or finished.
    if (this.state.phase === 'downloading' || this.state.phase === 'ready' || this.state.phase === 'installing') {
      return this.snapshot;
    }
    try {
      await this.load().checkForUpdates();
    } catch (error) {
      this.set({ phase: 'error', error: friendlyError(error as Error) });
    }
    return this.snapshot;
  }

  /** Installs the downloaded update now and restarts Flagship. System packages ask for your password. */
  installNow(): void {
    if (this.state.phase !== 'ready') return;
    this.set({ phase: 'installing' });
    // (isSilent, isForceRunAfter): silent Windows install, then reopen Flagship.
    setImmediate(() => this.load().quitAndInstall(true, true));
  }
}

function friendlyError(error: Error): string {
  const msg = String(error?.message ?? error);
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|net::ERR_/i.test(msg)) return "Couldn't reach GitHub to check for updates.";
  if (/latest.*\.yml.*(404|not found)|Cannot find .*latest/i.test(msg)) {
    return "This release doesn't have update info yet. Download the new version once; after that, updates are automatic.";
  }
  if (/rate limit|403/i.test(msg)) return 'GitHub is rate-limiting update checks right now. Try again later.';
  return `Update failed: ${msg.split('\n')[0].slice(0, 200)}`;
}
