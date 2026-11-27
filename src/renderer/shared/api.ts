// Types for window.flagship (see src/main/preload.ts).
import type { AppSettings, PlayerSettings } from '../../shared/settings';
import type { UpdateCheck } from '../../main/updater';
import type { UninstallPlan, UpdateState } from '../../shared/updates';
import type { MenuStatus } from '../../main/desktop-entry';
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
  profile: string | null;
  settings: Partial<PlayerSettings>;
}

export type Result<T> = { ok: true; result: T } | { ok: false; error: string };

export type AddResult = { ok: true; game: Game } | { ok: false; error: string };

export interface FlagshipApi {
  listGames(): Promise<Game[]>;
  addGame(input: string, profile: string | null): Promise<AddResult>;
  removeGame(id: string): Promise<void>;
  playGame(id: string): Promise<void>;
  getGame(id: string): Promise<Game | null>;
  getProject(id: string): Promise<Uint8Array>;
  openOnScratch(id: string): Promise<void>;
  setGameConfig(id: string, config: { profile?: string | null; overrides?: Partial<PlayerSettings> }): Promise<Game | null>;
  getEffectiveSettings(id: string): Promise<PlayerSettings>;
  getSettings(): Promise<AppSettings>;
  setSettings(patch: Partial<Pick<AppSettings, 'theme' | 'accent' | 'username' | 'defaultProfile'>>): Promise<AppSettings>;
  createProfile(name: string, copyFrom: string): Promise<Result<string>>;
  updateProfile(id: string, patch: { name?: string; settings?: Partial<PlayerSettings> }): Promise<Result<AppSettings>>;
  deleteProfile(id: string): Promise<Result<AppSettings>>;
  checkForUpdates(): Promise<Result<UpdateCheck>>;
  applyUpdate(): Promise<Result<{ from: string; to: string } | { opened: true } | { installing: true }>>;
  getVersion(): Promise<string>;
  getMenuStatus(): Promise<Result<MenuStatus>>;
  addToMenu(): Promise<Result<MenuStatus>>;
  removeFromMenu(): Promise<Result<MenuStatus>>;
  onUpdateProgress(callback: (stage: string) => void): void;
  getUpdateState(): Promise<UpdateState | null>;
  uninstallPlan(): Promise<UninstallPlan & { dataFolder: string }>;
  uninstall(deleteData: boolean): Promise<Result<null>>;
  showDataFolder(): Promise<string>;
  onUpdateState(callback: (state: UpdateState) => void): void;
  listCustomThemes(): Promise<CustomThemeInfo[]>;
  openThemesFolder(): Promise<void>;
  onAddProgress(callback: (p: { id: string; stage: string; fraction: number }) => void): void;
  onLibraryChanged(callback: () => void): void;
  onSettingsChanged(callback: (settings: AppSettings) => void): void;
  onGameSettingsChanged(callback: (p: { id: string }) => void): void;
}

export const api = (window as unknown as { flagship: FlagshipApi }).flagship;
