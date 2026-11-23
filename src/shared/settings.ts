// Settings shared by the main process, the library UI and the player.

/** How TurboWarp runs a game. Global defaults live in AppSettings; each game can override any of them. */
export interface PlayerSettings {
  framerate: number;
  interpolation: boolean;
  turbo: boolean;
  highQualityPen: boolean;
  compiler: boolean;
  warpTimer: boolean;
  infiniteClones: boolean;
  removeFencing: boolean;
  removeMiscLimits: boolean;
  stageWidth: number;
  stageHeight: number;
  cloudSaves: boolean;
  username: string;
  gamepad: boolean;
  pointerLock: boolean;
  autoplay: boolean;
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  framerate: 30,
  interpolation: false,
  turbo: false,
  highQualityPen: false,
  compiler: true,
  warpTimer: false,
  infiniteClones: false,
  removeFencing: false,
  removeMiscLimits: false,
  stageWidth: 480,
  stageHeight: 360,
  cloudSaves: true,
  username: '',
  gamepad: false,
  pointerLock: false,
  autoplay: false,
};

export interface AppSettings {
  version: 1;
  theme: string;               // built-in theme id, or "custom:<file>.css"
  accent: string | null;       // "#rrggbb" to override the theme's accent, or null
  player: PlayerSettings;      // defaults for every game
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  version: 1,
  theme: 'oled',
  accent: null,
  player: { ...DEFAULT_PLAYER_SETTINGS },
};

/** Settings that can change while a game is running without restarting it. */
export const LIVE_SETTINGS: ReadonlyArray<keyof PlayerSettings> = [
  'framerate', 'interpolation', 'turbo', 'highQualityPen',
  'infiniteClones', 'removeFencing', 'removeMiscLimits', 'username',
];

type SettingInfo = {
  key: keyof PlayerSettings;
  label: string;
  description: string;
} & (
  | { type: 'toggle' }
  | { type: 'select'; options: { value: number; label: string }[] }
  | { type: 'number'; min: number; max: number; unit?: string }
  | { type: 'text'; placeholder?: string; maxLength: number }
);

export interface SettingGroup {
  title: string;
  blurb: string;
  settings: SettingInfo[];
}

/** Everything the settings UI shows, in plain English. */
export const PLAYER_SETTING_GROUPS: SettingGroup[] = [
  {
    title: 'Speed & smoothness',
    blurb: 'How fast and smooth games run.',
    settings: [
      {
        key: 'framerate', type: 'select', label: 'Framerate',
        description: "Scratch games run at 30 FPS. 60 looks smoother, but many games are built around 30, so they'll run twice as fast. Use Interpolation instead if you just want smoothness.",
        options: [
          { value: 30, label: '30 FPS (Scratch default)' },
          { value: 60, label: '60 FPS' },
          { value: 120, label: '120 FPS' },
          { value: 240, label: '240 FPS' },
        ],
      },
      {
        key: 'interpolation', type: 'toggle', label: 'Interpolation',
        description: 'Fills in the frames between Scratch\'s 30 FPS so movement looks like 60+ FPS without making the game faster. Can look slightly floaty in some games.',
      },
      {
        key: 'turbo', type: 'toggle', label: 'Turbo mode',
        description: 'Runs scripts as fast as possible instead of waiting for the next frame. Speeds up slow loading screens and some heavy games, but makes most normal games way too fast.',
      },
      {
        key: 'highQualityPen', type: 'toggle', label: 'High quality pen',
        description: 'Draws pen lines at your full screen resolution instead of Scratch\'s 480×360. Makes drawing and 3D-style games much sharper; can be slower on weak PCs.',
      },
    ],
  },
  {
    title: 'Compatibility',
    blurb: 'Only change these if a game glitches or its description tells you to.',
    settings: [
      {
        key: 'compiler', type: 'toggle', label: 'Compiler',
        description: 'TurboWarp\'s big speed boost: it turns Scratch blocks into JavaScript, often 10× faster or more. Leave this on unless a game behaves differently than on Scratch.',
      },
      {
        key: 'warpTimer', type: 'toggle', label: 'Warp timer',
        description: 'Stops "run without screen refresh" loops from freezing the whole game if they get stuck. Slightly slower. Turn on if a game freezes.',
      },
      {
        key: 'infiniteClones', type: 'toggle', label: 'Infinite clones',
        description: 'Removes Scratch\'s 300-clone limit. Some games rely on that limit, so only turn this on if a game asks for it.',
      },
      {
        key: 'removeFencing', type: 'toggle', label: 'Remove fencing',
        description: 'Lets sprites go fully off-screen. Normally Scratch keeps a bit of every sprite visible at the edges.',
      },
      {
        key: 'removeMiscLimits', type: 'toggle', label: 'Remove misc limits',
        description: 'Removes small Scratch limits, like how far sound effects and pitch can go.',
      },
      {
        key: 'stageWidth', type: 'number', label: 'Stage width', min: 1, max: 4096, unit: 'px',
        description: 'Normal Scratch games are 480 wide. Only change this for projects made for a custom stage size.',
      },
      {
        key: 'stageHeight', type: 'number', label: 'Stage height', min: 1, max: 4096, unit: 'px',
        description: 'Normal Scratch games are 360 tall. Only change this for projects made for a custom stage size.',
      },
    ],
  },
  {
    title: 'Saves & identity',
    blurb: '',
    settings: [
      {
        key: 'cloudSaves', type: 'toggle', label: 'Save cloud variables',
        description: 'Games that save progress with cloud variables (☁) will remember it on this computer. Off means they reset every time.',
      },
      {
        key: 'username', type: 'text', label: 'Username', maxLength: 32, placeholder: 'Nobody',
        description: 'What the game sees as your Scratch username. Some games greet you by name or save per player with it.',
      },
    ],
  },
  {
    title: 'Controls & launching',
    blurb: '',
    settings: [
      {
        key: 'gamepad', type: 'toggle', label: 'Controller support',
        description: 'Play with a gamepad. Sticks and buttons are mapped to keys automatically, and a controller button appears in the player so you can remap them.',
      },
      {
        key: 'pointerLock', type: 'toggle', label: 'Lock mouse',
        description: 'Locks the mouse inside the game, for 3D and first-person games. Press Esc to get your mouse back.',
      },
      {
        key: 'autoplay', type: 'toggle', label: 'Skip "Click to play"',
        description: 'Starts games immediately. Sound may stay muted until you click the game once.',
      },
    ],
  },
];

const KEYS = Object.keys(DEFAULT_PLAYER_SETTINGS) as (keyof PlayerSettings)[];

/** Coerces untrusted input (from disk or IPC) into valid settings, dropping unknown keys and bad values. */
export function sanitizePlayerSettings(input: unknown, partial: true): Partial<PlayerSettings>;
export function sanitizePlayerSettings(input: unknown, partial?: false): PlayerSettings;
export function sanitizePlayerSettings(input: unknown, partial = false): Partial<PlayerSettings> {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = partial ? {} : { ...DEFAULT_PLAYER_SETTINGS };
  for (const key of KEYS) {
    if (!(key in source)) continue;
    const fallback = DEFAULT_PLAYER_SETTINGS[key];
    const value = source[key];
    if (typeof fallback === 'boolean' && typeof value === 'boolean') out[key] = value;
    if (typeof fallback === 'number' && typeof value === 'number' && Number.isFinite(value)) {
      out[key] = Math.round(Math.min(4096, Math.max(1, value)));
    }
    if (typeof fallback === 'string' && typeof value === 'string') out[key] = value.slice(0, 32);
  }
  return out as Partial<PlayerSettings>;
}

export function effectiveSettings(defaults: PlayerSettings, overrides?: Partial<PlayerSettings>): PlayerSettings {
  return { ...defaults, ...(overrides ?? {}) };
}
