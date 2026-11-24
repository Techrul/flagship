// Adds Flagship to the system app menu, launching this exact install (so the git-based updater keeps working).
// Linux: ~/.local/share/applications/flagship.desktop   Windows: Start Menu shortcut.
import { shell } from 'electron';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export type MenuStatus =
  | { supported: false; reason: string }
  | { supported: true; installed: boolean; location: string; stale: boolean };

/** Quotes one argument for the Exec= line of a .desktop file (freedesktop Desktop Entry spec). */
function desktopQuote(arg: string): string {
  return `"${arg.replace(/[\\"`$]/g, (c) => `\\${c}`)}"`;
}

export class DesktopEntry {
  constructor(
    private readonly appPath: string,    // the Flagship folder
    private readonly electronPath: string, // the Electron binary running us
  ) {}

  private get iconPng() { return path.join(this.appPath, 'assets', 'icon.png'); }
  private get iconIco() { return path.join(this.appPath, 'assets', 'icon.ico'); }

  private location(): string | null {
    if (process.platform === 'linux') {
      const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
      return path.join(dataHome, 'applications', 'flagship.desktop');
    }
    if (process.platform === 'win32' && process.env.APPDATA) {
      return path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Flagship.lnk');
    }
    return null;
  }

  linuxEntry(): string {
    return [
      '[Desktop Entry]',
      'Type=Application',
      'Name=Flagship',
      'GenericName=Game Launcher',
      'Comment=Play Scratch games',
      `Exec=${desktopQuote(this.electronPath)} ${desktopQuote(this.appPath)}`,
      `Icon=${this.iconPng}`,
      'Terminal=false',
      'Categories=Game;',
      'Keywords=scratch;turbowarp;games;launcher;',
      'StartupWMClass=flagship', // matches the window, so the taskbar groups it with this entry
      '',
    ].join('\n');
  }

  status(): MenuStatus {
    const location = this.location();
    if (!location) {
      return { supported: false, reason: 'Adding to the app menu works on Linux and Windows for now.' };
    }
    const installed = fs.existsSync(location);
    // "Stale" = the shortcut points somewhere else (e.g. you moved the Flagship folder).
    let stale = false;
    if (installed && process.platform === 'linux') {
      stale = fs.readFileSync(location, 'utf8') !== this.linuxEntry();
    } else if (installed && process.platform === 'win32') {
      try {
        stale = shell.readShortcutLink(location).target !== this.electronPath;
      } catch {
        stale = true;
      }
    }
    return { supported: true, installed, location, stale };
  }

  install(): MenuStatus {
    const location = this.location();
    if (!location) return this.status();
    fs.mkdirSync(path.dirname(location), { recursive: true });
    if (process.platform === 'linux') {
      fs.writeFileSync(location, this.linuxEntry(), { mode: 0o755 });
    } else {
      const ok = shell.writeShortcutLink(location, 'replace', {
        target: this.electronPath,
        args: `"${this.appPath}"`,
        cwd: this.appPath,
        description: 'Play Scratch games',
        icon: this.iconIco,
        iconIndex: 0,
        appUserModelId: 'com.techrul.flagship',
      });
      if (!ok) throw new Error('Windows refused to create the Start Menu shortcut.');
    }
    return this.status();
  }

  remove(): MenuStatus {
    const location = this.location();
    if (location) fs.rmSync(location, { force: true });
    return this.status();
  }
}
