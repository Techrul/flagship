// Types for window.flagship (see src/main/preload.ts).
import type { AppSettings, PlayerSettings } from '../../shared/settings';
import type { CustomThemeInfo } from '../../shared/themes';

export interface Game {
  id: string;
  title: string;
  author: string;
  instructions: string;
  description: string;
  projectFile: string;
  hasThumbnail: boolean;
  addedAt: string;
  lastPlayedAt: string | null;
  playtimeSeconds: number;
  notes: string;
  settings: Partial<PlayerSettings>;
}

export type AddResult = { ok: true; game: Game } | { ok: false; error: string };

export interface FlagshipApi {
  listGames(): Promise<Game[]>;
  addGame(input: string): Promise<AddResult>;
  removeGame(id: string): Promise<void>;
  playGame(id: string): Promise<void>;
  getGame(id: string): Promise<Game | null>;
  getProject(id: string): Promise<Uint8Array>;
  openOnScratch(id: string): Promise<void>;
  setGameSettings(id: string, overrides: Partial<PlayerSettings>): Promise<Game | null>;
  getEffectiveSettings(id: string): Promise<PlayerSettings>;
  getSettings(): Promise<AppSettings>;
  setSettings(patch: Partial<Omit<AppSettings, 'player'>> & { player?: Partial<PlayerSettings> }): Promise<AppSettings>;
  listCustomThemes(): Promise<CustomThemeInfo[]>;
  openThemesFolder(): Promise<void>;
  onAddProgress(callback: (p: { id: string; stage: string; fraction: number }) => void): void;
  onLibraryChanged(callback: () => void): void;
  onSettingsChanged(callback: (settings: AppSettings) => void): void;
  onGameSettingsChanged(callback: (p: { id: string }) => void): void;
}

export const api = (window as unknown as { flagship: FlagshipApi }).flagship;
