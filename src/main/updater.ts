// Self-update for people running Flagship from a git clone (the only way to run it until real releases).
// Update = git pull --ff-only, reinstall dependencies if they changed, rebuild, then the app relaunches.
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type UpdateCheck =
  | { supported: false; reason: string }
  | { supported: true; kind: 'git'; branch: string; upstream: string; current: string; behind: number; latestMessage: string | null }
  | (ReleaseCheck & { hint?: string })
  | { supported: true; kind: 'auto'; state: import('../shared/updates').UpdateState };

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
    return { supported: true, kind: 'git', branch, upstream, current, behind, latestMessage };
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

// ---------- installed builds: check GitHub Releases ----------

export type ReleaseCheck = {
  supported: true;
  kind: 'release';
  current: string;
  latest: string;
  newer: boolean;
  url: string;
};

/** "0.4.0-beta.2" -> comparable parts. Prereleases sort before the matching release. */
function parseVersion(v: string): { nums: number[]; pre: (string | number)[] } | null {
  const m = v.trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9a-z.-]+))?/i);
  if (!m) return null;
  return {
    nums: [Number(m[1]), Number(m[2]), Number(m[3])],
    pre: m[4] ? m[4].split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : p)) : [],
  };
}

export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x.nums[i] !== y.nums[i]) return x.nums[i] - y.nums[i];
  if (!x.pre.length || !y.pre.length) return x.pre.length ? -1 : y.pre.length ? 1 : 0;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i];
    const q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    if (p === q) continue;
    if (typeof p === 'number' && typeof q === 'number') return p - q;
    if (typeof p === 'number') return -1;
    if (typeof q === 'number') return 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

interface GitHubRelease { tag_name: string; html_url: string; draft: boolean; prerelease: boolean }

/** Picks the newest release this user should see. Beta users see betas; stable users only stable. */
export function pickLatestRelease(releases: GitHubRelease[], current: string): GitHubRelease | null {
  const wantPrereleases = (parseVersion(current)?.pre.length ?? 0) > 0;
  const candidates = releases.filter((r) => !r.draft && parseVersion(r.tag_name) && (wantPrereleases || !r.prerelease));
  candidates.sort((a, b) => compareVersions(b.tag_name, a.tag_name));
  return candidates[0] ?? null;
}

type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

/** Fallback for when the API is rate-limited (60/hour per network): the public Atom feed has no limit.
 *  It doesn't flag prereleases, so a dash in the version ("0.4.0-beta.1") marks one, same as our tags. */
export function releasesFromAtom(xml: string, repo: string): GitHubRelease[] {
  const tags = [...xml.matchAll(/\/releases\/tag\/([^"<>\s]+)/g)].map((m) => decodeURIComponent(m[1]));
  return [...new Set(tags)].map((tag) => ({
    tag_name: tag,
    html_url: `https://github.com/${repo}/releases/tag/${encodeURIComponent(tag)}`,
    draft: false,
    prerelease: tag.includes('-'),
  }));
}

export async function checkReleases(current: string, repo = 'Techrul/flagship', fetchImpl: FetchLike = fetch): Promise<ReleaseCheck> {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Flagship-update-check' };
  let releases: GitHubRelease[] | null = null;
  try {
    const response = await fetchImpl(`https://api.github.com/repos/${repo}/releases?per_page=30`, { headers });
    if (response.ok) releases = (await response.json()) as GitHubRelease[];
    else if (response.status !== 403 && response.status !== 429) {
      throw new UpdateError(`GitHub returned an error (HTTP ${response.status}) while checking for updates.`);
    }
  } catch (error) {
    if (error instanceof UpdateError) throw error;
    // Network trouble: try the feed below before giving up.
  }
  if (!releases) {
    try {
      const feed = await fetchImpl(`https://github.com/${repo}/releases.atom`, { headers: { 'User-Agent': headers['User-Agent'] } });
      if (!feed.ok) throw new Error(String(feed.status));
      releases = releasesFromAtom(await feed.text(), repo);
    } catch {
      throw new UpdateError("Couldn't reach GitHub to check for updates. Try again later.");
    }
  }
  const latest = pickLatestRelease(releases, current);
  const latestVersion = latest ? latest.tag_name.replace(/^v/, '') : current;
  return {
    supported: true,
    kind: 'release',
    current,
    latest: latestVersion,
    newer: compareVersions(latestVersion, current) > 0,
    url: latest?.html_url ?? `https://github.com/${repo}/releases`,
  };
}
