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

/** How to start this copy of Flagship. null = an installer already handles the app menu. */
export interface LaunchSpec {
  exec: string;      // program to run
  args: string[];    // its arguments
  iconPng: string;
  iconIco: string;
}

export class DesktopEntry {
  constructor(
    private readonly launch: LaunchSpec | null,
    private readonly unsupportedReason = 'Your installer already added Flagship to your app menu.',
  ) {}

  /** A git clone: run Electron on the Flagship folder. */
  static forClone(appPath: string, electronPath: string): DesktopEntry {
    return new DesktopEntry({
      exec: electronPath,
      args: [appPath],
      iconPng: path.join(appPath, 'assets', 'icon.png'),
      iconIco: path.join(appPath, 'assets', 'icon.ico'),
    });
  }

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
      `Exec=${[this.launch!.exec, ...this.launch!.args].map(desktopQuote).join(' ')}`,
      `Icon=${this.launch!.iconPng}`,
      'Terminal=false',
      'Categories=Game;',
      'Keywords=scratch;turbowarp;games;launcher;',
      'StartupWMClass=flagship', // matches the window, so the taskbar groups it with this entry
      '',
    ].join('\n');
  }

  status(): MenuStatus {
    if (!this.launch) return { supported: false, reason: this.unsupportedReason };
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
        stale = shell.readShortcutLink(location).target !== this.launch.exec;
      } catch {
        stale = true;
      }
    }
    return { supported: true, installed, location, stale };
  }

  install(): MenuStatus {
    const location = this.location();
    if (!location || !this.launch) return this.status();
    fs.mkdirSync(path.dirname(location), { recursive: true });
    if (process.platform === 'linux') {
      fs.writeFileSync(location, this.linuxEntry(), { mode: 0o755 });
    } else {
      const ok = shell.writeShortcutLink(location, 'replace', {
        target: this.launch.exec,
        args: this.launch.args.map((a) => `"${a}"`).join(' '),
        description: 'Play Scratch games',
        icon: this.launch.iconIco,
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
