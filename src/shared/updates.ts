// How this copy of Flagship gets updates, and where an update currently stands. Shared by main + UI.

/**
 * - git:      running from a git clone → the git updater (pull, rebuild, restart)
 * - appimage: AppImage → downloads in the background, installs itself when you quit. No password.
 * - nsis:     Windows installer → same as AppImage.
 * - system:   .pacman / .deb / .rpm → downloads in the background, installs on click with your password.
 * - manual:   everything else (macOS, portable zip, tar.gz, Scoop, AUR) → tells you how to update.
 */
export type InstallKind = 'git' | 'appimage' | 'nsis' | 'system' | 'manual';

export type UpdatePhase =
  | 'idle'        // haven't checked yet
  | 'checking'
  | 'none'        // up to date
  | 'downloading'
  | 'ready'       // downloaded, waiting to install
  | 'installing'
  | 'error';

export interface UpdateState {
  kind: InstallKind;
  phase: UpdatePhase;
  current: string;
  version?: string;   // the new version, once one is found
  percent?: number;   // download progress, 0–100
  error?: string;
  /** For 'manual' installs: how to update this particular install. */
  hint?: string;
  /** For 'system' installs: which package type (pacman / deb / rpm). */
  packageType?: string;
}
