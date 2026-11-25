import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';
import {
  AppSettings, BUILT_IN_PROFILES, DEFAULT_APP_SETTINGS, DEFAULT_PLAYER_SETTINGS, Profile,
  sanitizePlayerSettings,
} from '../shared/settings';

const HEX = /^#[0-9a-f]{6}$/i;
const THEME_ID = /^(?:[a-z0-9-]{1,40}|custom:[\w .-]{1,80}\.css)$/i;
const PROFILE_ID = /^[a-z0-9-]{1,40}$/;
const MAX_PROFILES = 50;

/** What's saved to disk: built-in profiles always come from the code, so only custom ones are stored. */
interface StoredSettings {
  version: 2;
  theme: string;
  accent: string | null;
  username: string;
  defaultProfile: string;
  customProfiles: { id: string; name: string; settings: unknown }[];
}

function cleanName(name: unknown, fallback: string): string {
  const text = typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  return text || fallback;
}

export class SettingsStore {
  private readonly file: string;
  private settings: AppSettings;

  constructor(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'settings.json');
    this.settings = this.read();
  }

  private read(): AppSettings {
    if (!fs.existsSync(this.file)) return structuredClone(DEFAULT_APP_SETTINGS);
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return raw?.version === 2 ? this.fromStored(raw) : this.migrateV1(raw);
    } catch {
      fs.copyFileSync(this.file, `${this.file}.corrupt-${Date.now()}`);
      return structuredClone(DEFAULT_APP_SETTINGS);
    }
  }

  /**
   * v0.2 had one set of global defaults. If they were never changed, move to the new Enhanced default.
   * If they were changed, keep them as a "My settings" profile so nothing the user chose is lost.
   */
  private migrateV1(raw: any): AppSettings {
    const player = sanitizePlayerSettings(raw?.player);
    const customized = JSON.stringify(player) !== JSON.stringify(DEFAULT_PLAYER_SETTINGS);
    this.settings = this.fromStored({
      version: 2,
      theme: raw?.theme,
      accent: raw?.accent ?? null,
      username: raw?.player?.username ?? '',
      defaultProfile: customized ? 'my-settings' : 'enhanced',
      customProfiles: customized ? [{ id: 'my-settings', name: 'My settings', settings: player }] : [],
    });
    this.write();
    return this.settings;
  }

  private fromStored(raw: any): AppSettings {
    const custom: Profile[] = [];
    const seen = new Set(BUILT_IN_PROFILES.map((p) => p.id));
    for (const p of Array.isArray(raw?.customProfiles) ? raw.customProfiles.slice(0, MAX_PROFILES) : []) {
      if (typeof p?.id !== 'string' || !PROFILE_ID.test(p.id) || seen.has(p.id)) continue;
      seen.add(p.id);
      custom.push({
        id: p.id,
        name: cleanName(p.name, 'Untitled'),
        builtIn: false,
        description: '',
        settings: sanitizePlayerSettings(p.settings),
      });
    }
    const profiles = [...BUILT_IN_PROFILES.map((p) => structuredClone(p)), ...custom];
    return {
      version: 2,
      theme: typeof raw?.theme === 'string' && THEME_ID.test(raw.theme) ? raw.theme : DEFAULT_APP_SETTINGS.theme,
      accent: typeof raw?.accent === 'string' && HEX.test(raw.accent) ? raw.accent.toLowerCase() : null,
      username: typeof raw?.username === 'string' ? raw.username.slice(0, 32) : '',
      defaultProfile: profiles.some((p) => p.id === raw?.defaultProfile) ? raw.defaultProfile : 'enhanced',
      profiles,
    };
  }

  private write(): void {
    const stored: StoredSettings = {
      version: 2,
      theme: this.settings.theme,
      accent: this.settings.accent,
      username: this.settings.username,
      defaultProfile: this.settings.defaultProfile,
      customProfiles: this.settings.profiles
        .filter((p) => !p.builtIn)
        .map(({ id, name, settings }) => ({ id, name, settings })),
    };
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(stored, null, 2));
    fs.renameSync(tmp, this.file);
  }

  get(): AppSettings {
    return structuredClone(this.settings);
  }

  /** Theme, accent, username and default profile. Invalid values are ignored, keeping the current ones. */
  update(patch: any): AppSettings {
    const next = { ...this.settings };
    if (typeof patch?.theme === 'string' && THEME_ID.test(patch.theme)) next.theme = patch.theme;
    if (patch?.accent === null) next.accent = null;
    else if (typeof patch?.accent === 'string' && HEX.test(patch.accent)) next.accent = patch.accent.toLowerCase();
    if (typeof patch?.username === 'string') next.username = patch.username.trim().slice(0, 32);
    if (typeof patch?.defaultProfile === 'string' && next.profiles.some((p) => p.id === patch.defaultProfile)) {
      next.defaultProfile = patch.defaultProfile;
    }
    this.settings = next;
    this.write();
    return this.get();
  }

  /** Makes a new custom profile copied from an existing one. Returns its id. */
  createProfile(name: unknown, copyFrom: unknown): string {
    if (this.settings.profiles.filter((p) => !p.builtIn).length >= MAX_PROFILES) {
      throw new Error(`You can have up to ${MAX_PROFILES} profiles.`);
    }
    const source = this.settings.profiles.find((p) => p.id === copyFrom) ?? BUILT_IN_PROFILES[0];
    const id = `custom-${randomBytes(4).toString('hex')}`;
    this.settings.profiles.push({
      id,
      name: cleanName(name, `${source.name} copy`),
      builtIn: false,
      description: '',
      settings: { ...source.settings },
    });
    this.write();
    return id;
  }

  /** Renames and/or changes a custom profile. Built-in profiles can't be edited. */
  updateProfile(id: unknown, patch: any): AppSettings {
    const profile = this.settings.profiles.find((p) => p.id === id);
    if (!profile) throw new Error('That profile no longer exists.');
    if (profile.builtIn) throw new Error("Built-in profiles can't be edited. Duplicate it to make your own.");
    if (patch?.name !== undefined) profile.name = cleanName(patch.name, profile.name);
    if (patch?.settings) profile.settings = { ...profile.settings, ...sanitizePlayerSettings(patch.settings, true) };
    this.write();
    return this.get();
  }

  /** Deletes a custom profile. Games that used it fall back to the default profile. */
  deleteProfile(id: unknown): AppSettings {
    const profile = this.settings.profiles.find((p) => p.id === id);
    if (!profile || profile.builtIn) return this.get();
    this.settings.profiles = this.settings.profiles.filter((p) => p.id !== id);
    if (this.settings.defaultProfile === id) this.settings.defaultProfile = 'enhanced';
    this.write();
    return this.get();
  }
}
