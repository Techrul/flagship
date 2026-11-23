import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppSettings, DEFAULT_APP_SETTINGS, sanitizePlayerSettings } from '../shared/settings';

const HEX = /^#[0-9a-f]{6}$/i;
const THEME_ID = /^(?:[a-z0-9-]{1,40}|custom:[\w .-]{1,80}\.css)$/i;

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
      return this.sanitize(JSON.parse(fs.readFileSync(this.file, 'utf8')));
    } catch {
      fs.copyFileSync(this.file, `${this.file}.corrupt-${Date.now()}`);
      return structuredClone(DEFAULT_APP_SETTINGS);
    }
  }

  /** Invalid values fall back to `fallback` (the current settings), so a bad update never wipes a good value. */
  private sanitize(raw: any, fallback: AppSettings = DEFAULT_APP_SETTINGS): AppSettings {
    let accent = fallback.accent;
    if (raw?.accent === null) accent = null;
    else if (typeof raw?.accent === 'string' && HEX.test(raw.accent)) accent = raw.accent.toLowerCase();
    return {
      version: 1,
      theme: typeof raw?.theme === 'string' && THEME_ID.test(raw.theme) ? raw.theme : fallback.theme,
      accent,
      player: { ...fallback.player, ...sanitizePlayerSettings(raw?.player, true) },
    };
  }

  get(): AppSettings {
    return structuredClone(this.settings);
  }

  /** Merges a partial update (from the UI) and saves. Returns the new settings. */
  update(patch: any): AppSettings {
    this.settings = this.sanitize(patch ?? {}, this.settings);
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.settings, null, 2));
    fs.renameSync(tmp, this.file);
    return this.get();
  }
}
