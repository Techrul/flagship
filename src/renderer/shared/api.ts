// Types for window.flagship (see src/main/preload.ts).
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
  onAddProgress(callback: (p: { id: string; stage: string; fraction: number }) => void): void;
  onLibraryChanged(callback: () => void): void;
}
