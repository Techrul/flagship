// The local game library: one JSON index plus a folder per game holding its cached files.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PlayerSettings, sanitizePlayerSettings } from '../shared/settings';

export interface Game {
  id: string;            // Scratch project ID
  title: string;
  author: string;
  instructions: string;
  description: string;
  projectFile: string;   // e.g. "project.sb3", relative to the game's folder
  hasThumbnail: boolean;
  addedAt: string;       // ISO timestamps
  lastPlayedAt: string | null;
  playtimeSeconds: number;
  notes: string;         // save codes and anything else (UI comes in v0.2)
  profile: string | null;            // setting profile id, or null = use the default profile
  settings: Partial<PlayerSettings>; // per-game overrides on top of the profile
}

interface LibraryFile {
  version: 1;
  games: Game[];
}

const VALID_ID = /^\d{1,12}$/;
const PROFILE_ID = /^[a-z0-9-]{1,40}$/;

export class Library {
  private readonly indexPath: string;
  readonly gamesDir: string;
  private games: Game[] = [];

  constructor(readonly root: string) {
    this.indexPath = path.join(root, 'library.json');
    this.gamesDir = path.join(root, 'games');
    fs.mkdirSync(this.gamesDir, { recursive: true });
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.indexPath)) return;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.indexPath, 'utf8')) as LibraryFile;
      this.games = (Array.isArray(parsed.games) ? parsed.games : []).map((g) => ({
        ...g,
        profile: typeof g.profile === 'string' && PROFILE_ID.test(g.profile) ? g.profile : null,
        settings: sanitizePlayerSettings(g.settings, true), // older libraries have no settings field
      }));
    } catch {
      // Never silently destroy a corrupt library: keep a copy and start fresh.
      fs.copyFileSync(this.indexPath, `${this.indexPath}.corrupt-${Date.now()}`);
      this.games = [];
    }
  }

  private save(): void {
    const data: LibraryFile = { version: 1, games: this.games };
    const tmp = `${this.indexPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, this.indexPath); // atomic replace, so a crash can't half-write the index
  }

  list(): Game[] {
    return [...this.games].sort((a, b) =>
      (b.lastPlayedAt ?? b.addedAt).localeCompare(a.lastPlayedAt ?? a.addedAt));
  }

  get(id: string): Game | undefined {
    return this.games.find((g) => g.id === id);
  }

  has(id: string): boolean {
    return this.games.some((g) => g.id === id);
  }

  gameDir(id: string): string {
    if (!VALID_ID.test(id)) throw new Error(`Invalid project ID: ${id}`);
    return path.join(this.gamesDir, id);
  }

  add(
    meta: Omit<Game, 'projectFile' | 'hasThumbnail' | 'addedAt' | 'lastPlayedAt' | 'playtimeSeconds' | 'notes' | 'settings' | 'profile'>,
    project: { data: Uint8Array; type: string },
    thumbnail: Uint8Array | null,
    profile: string | null = null, // only used for new games; re-downloads keep their profile
  ): Game {
    const dir = this.gameDir(meta.id);
    fs.mkdirSync(dir, { recursive: true });
    const projectFile = `project.${project.type}`;
    fs.writeFileSync(path.join(dir, projectFile), project.data);
    if (thumbnail) fs.writeFileSync(path.join(dir, 'thumbnail.png'), thumbnail);

    const existing = this.get(meta.id);
    const game: Game = {
      ...meta,
      projectFile,
      hasThumbnail: thumbnail !== null || (existing?.hasThumbnail ?? false),
      addedAt: existing?.addedAt ?? new Date().toISOString(),
      lastPlayedAt: existing?.lastPlayedAt ?? null,
      playtimeSeconds: existing?.playtimeSeconds ?? 0,
      notes: existing?.notes ?? '', // re-downloading a game must never wipe its notes
      profile: existing ? existing.profile : (profile && PROFILE_ID.test(profile) ? profile : null),
      settings: existing?.settings ?? {},
    };
    this.games = [...this.games.filter((g) => g.id !== meta.id), game];
    this.save();
    return game;
  }

  remove(id: string): void {
    this.games = this.games.filter((g) => g.id !== id);
    this.save();
    fs.rmSync(this.gameDir(id), { recursive: true, force: true });
  }

  readProject(id: string): Uint8Array {
    const game = this.get(id);
    if (!game) throw new Error(`Game ${id} is not in the library`);
    return fs.readFileSync(path.join(this.gameDir(id), game.projectFile));
  }

  /** Sets a game's profile (null = default) and replaces its overrides ({} = none). */
  setConfig(id: string, config: { profile?: unknown; overrides?: unknown }): Game | undefined {
    const game = this.get(id);
    if (!game) return undefined;
    if (config.profile === null || (typeof config.profile === 'string' && PROFILE_ID.test(config.profile))) {
      game.profile = config.profile;
    }
    if (config.overrides !== undefined) game.settings = sanitizePlayerSettings(config.overrides, true);
    this.save();
    return game;
  }

  recordSession(id: string, seconds: number): void {
    const game = this.get(id);
    if (!game) return;
    game.lastPlayedAt = new Date().toISOString();
    game.playtimeSeconds += Math.max(0, Math.round(seconds));
    this.save();
  }
}
