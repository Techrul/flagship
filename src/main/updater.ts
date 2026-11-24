// Self-update for people running Flagship from a git clone (the only way to run it until real releases).
// Update = git pull --ff-only, reinstall dependencies if they changed, rebuild, then the app relaunches.
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type UpdateCheck =
  | { supported: false; reason: string }
  | { supported: true; branch: string; upstream: string; current: string; behind: number; latestMessage: string | null };

export class UpdateError extends Error {}

interface RunOptions { timeout?: number; env?: NodeJS.ProcessEnv; useShell?: boolean }

function run(command: string, args: string[], cwd: string, options: RunOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd,
      timeout: options.timeout ?? 60_000,
      env: options.env ?? process.env,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
      // npm is a .cmd script on Windows, which Node only runs through a shell.
      shell: options.useShell ?? false,
    }, (error, stdout, stderr) => {
      if (error) {
        const detail = (stderr || stdout || error.message).toString().trim().split('\n').slice(-6).join('\n');
        reject(Object.assign(error, { detail }));
      } else {
        resolve(stdout.toString().trim());
      }
    });
  });
}

export class Updater {
  constructor(readonly root: string) {}

  private git(args: string[], timeout?: number) {
    return run('git', args, this.root, { timeout });
  }

  async check(): Promise<UpdateCheck> {
    if (!fs.existsSync(path.join(this.root, '.git'))) {
      return { supported: false, reason: 'Flagship isn\'t running from a git clone, so it can\'t update itself.' };
    }
    try {
      await this.git(['--version']);
    } catch {
      return { supported: false, reason: 'Git isn\'t installed (or isn\'t on your PATH), so Flagship can\'t update itself.' };
    }

    const branch = await this.git(['rev-parse', '--abbrev-ref', 'HEAD']);
    let upstream: string;
    try {
      upstream = await this.git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    } catch {
      return { supported: false, reason: `The "${branch}" branch isn't linked to a GitHub branch, so there's nothing to update from.` };
    }

    const [remote, ...rest] = upstream.split('/');
    try {
      await this.git(['fetch', '--quiet', remote, rest.join('/')], 60_000);
    } catch (error) {
      throw new UpdateError(`Couldn't reach GitHub to check for updates. ${(error as any).detail ?? ''}`.trim());
    }
    const behind = Number(await this.git(['rev-list', '--count', `HEAD..${upstream}`])) || 0;
    const current = await this.git(['rev-parse', '--short', 'HEAD']);
    const latestMessage = behind > 0 ? await this.git(['log', '-1', '--format=%s', upstream]) : null;
    return { supported: true, branch, upstream, current, behind, latestMessage };
  }

  /** Files changed locally that would block a pull. A stray package-lock.json change (npm does this) is undone. */
  private async clearLocalChanges(): Promise<void> {
    // Tracked files that differ from the last commit (staged or not). Untracked files never block a pull.
    const dirty = (await this.git(['diff', '--name-only', 'HEAD']))
      .split('\n').map((line) => line.trim()).filter(Boolean);
    if (dirty.length === 1 && dirty[0] === 'package-lock.json') {
      await this.git(['checkout', '--', 'package-lock.json']);
      return;
    }
    if (dirty.length > 0) {
      throw new UpdateError(
        `You have local changes to Flagship's files (${dirty.slice(0, 3).join(', ')}${dirty.length > 3 ? '…' : ''}). ` +
        'Commit or undo them, then try again.');
    }
  }

  async apply(onStage: (stage: string) => void): Promise<{ from: string; to: string }> {
    await this.clearLocalChanges();
    const from = await this.git(['rev-parse', 'HEAD']);

    onStage('Downloading update');
    try {
      await this.git(['pull', '--ff-only', '--quiet'], 120_000);
    } catch (error) {
      throw new UpdateError(`Downloading the update failed. ${(error as any).detail ?? ''}`.trim());
    }
    const to = await this.git(['rev-parse', 'HEAD']);
    const changed = (await this.git(['diff', '--name-only', from, to])).split('\n');

    if (changed.includes('package.json') || changed.includes('package-lock.json')) {
      onStage('Installing new dependencies');
      try {
        await run('npm', ['install', '--no-audit', '--no-fund'], this.root, {
          timeout: 10 * 60_000,
          useShell: process.platform === 'win32',
        });
        // npm sometimes rewrites the lockfile; undo that so the next update isn't blocked.
        await this.git(['checkout', '--', 'package-lock.json']).catch(() => {});
      } catch (error) {
        throw new UpdateError(
          `The update downloaded, but installing dependencies failed. Run "npm install" in the Flagship folder, then restart. ${(error as any).detail ?? ''}`.trim());
      }
    }

    onStage('Rebuilding');
    try {
      // Run the build script with Electron's own Node, so a separate Node install isn't required here.
      await run(process.execPath, [path.join('scripts', 'build.mjs'), '--dev'], this.root, {
        timeout: 5 * 60_000,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      });
    } catch (error) {
      throw new UpdateError(`The update downloaded, but rebuilding failed. Run "npm start" to rebuild. ${(error as any).detail ?? ''}`.trim());
    }
    return { from: from.slice(0, 7), to: to.slice(0, 7) };
  }
}
