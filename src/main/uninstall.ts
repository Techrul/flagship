// "Uninstall Flagship" button. Works out what removing this copy means and, where it can, does it.
import { app } from 'electron';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { InstallInfo } from './auto-update';
import type { UninstallPlan } from '../shared/updates';

/** Pure: what to show and do for this install. `self` = the AppImage path, the uninstaller, or the app folder. */
export function uninstallPlan(install: InstallInfo, platform: NodeJS.Platform, self: string): UninstallPlan {
  const pkgRemove = (command: string[], what: string): UninstallPlan => ({
    mode: 'run',
    summary: `Removes the ${what} package. You'll be asked for your password.`,
    command: ['pkexec', ...command],
    manual: `sudo ${command.join(' ')}`,
  });
  switch (install.kind) {
    case 'system':
      if (install.packageType === 'pacman') return pkgRemove(['pacman', '-R', '--noconfirm', 'flagship'], 'flagship');
      if (install.packageType === 'deb') return pkgRemove(['dpkg', '-r', 'flagship'], 'flagship .deb');
      return pkgRemove(['rpm', '-e', 'flagship'], 'flagship .rpm');
    case 'appimage':
      return { mode: 'run', summary: `Deletes ${path.basename(self)} and its app menu entry.`, deleteFile: self };
    case 'nsis':
      return { mode: 'run', summary: 'Opens the Windows uninstaller. (Same as removing it in Settings → Apps.)', uninstaller: self };
    case 'git':
      return { mode: 'manual', summary: 'This is a copy of the source code. Click Remove next to App menu (if it\'s added), then close Flagship and delete this folder:', manual: self };
  }
  // manual installs: say exactly how
  switch (install.packageType) {
    case 'aur': return pkgRemove(['pacman', '-R', '--noconfirm', 'flagship-bin'], 'flagship-bin');
    case 'scoop': return { mode: 'manual', summary: 'Installed with Scoop. Run this in a terminal:', manual: 'scoop uninstall flagship' };
    case 'zip':
    case 'tar.gz': return { mode: 'manual', summary: 'Portable copy: close Flagship and delete its folder:', manual: self };
  }
  if (platform === 'darwin') {
    return { mode: 'manual', summary: 'Installed with Homebrew? Run the command below. Otherwise drag Flagship from Applications to the Trash.', manual: 'brew uninstall --cask flagship' };
  }
  return { mode: 'manual', summary: 'Close Flagship and delete its folder:', manual: self };
}

function run(command: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

/** Does the uninstall. On success Flagship quits; on failure it returns a message to show. */
export async function performUninstall(plan: UninstallPlan, deleteData: boolean, removeMenuEntry: () => void): Promise<string | null> {
  if (plan.mode !== 'run') return 'This copy has to be removed by hand.';
  const data = app.getPath('userData');

  if (plan.uninstaller) {
    // Windows: start the uninstaller once Flagship has quit (it can't remove files that are in use), then the data folder.
    const steps = [`timeout /t 2 /nobreak >nul`, `start "" /wait "${plan.uninstaller}"`];
    if (deleteData) steps.push(`rmdir /s /q "${data}"`);
    spawn('cmd.exe', ['/c', steps.join(' & ')], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    app.quit();
    return null;
  }

  if (plan.command) {
    let code: number;
    try {
      code = await run(plan.command);
    } catch {
      return `Couldn't ask for your password (pkexec is missing). Run this in a terminal instead: ${plan.manual}`;
    }
    if (code === 126) return 'Cancelled.';
    if (code !== 0) return `The uninstall didn't work (exit code ${code}). Try it in a terminal: ${plan.manual}`;
  }

  if (plan.deleteFile) fs.rmSync(plan.deleteFile, { force: true });
  try { removeMenuEntry(); } catch { /* not there */ }
  if (deleteData) fs.rmSync(data, { recursive: true, force: true });
  app.exit(0);
  return null;
}
