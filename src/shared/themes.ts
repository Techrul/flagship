// Built-in themes. The actual colors live in src/renderer/shared/themes.css;
// these entries are for the theme picker (name + preview swatches).
export interface ThemeInfo {
  id: string;
  name: string;
  light?: boolean;
  /** [background, surface, accent, text] — shown as the preview in the picker */
  preview: [string, string, string, string];
}

export const BUILT_IN_THEMES: ThemeInfo[] = [
  { id: 'oled', name: 'OLED', preview: ['#000000', '#0b0b0b', '#2ee6c8', '#f2f2f2'] },
  { id: 'midnight', name: 'Midnight', preview: ['#000000', '#0c0a14', '#a78bfa', '#ece9f7'] },
  { id: 'mocha', name: 'Catppuccin Mocha', preview: ['#1e1e2e', '#313244', '#94e2d5', '#cdd6f4'] },
  { id: 'tokyo-night', name: 'Tokyo Night', preview: ['#1a1b26', '#24283b', '#7aa2f7', '#c0caf5'] },
  { id: 'dracula', name: 'Dracula', preview: ['#282a36', '#343746', '#ff79c6', '#f8f8f2'] },
  { id: 'nord', name: 'Nord', preview: ['#2e3440', '#3b4252', '#88c0d0', '#eceff4'] },
  { id: 'gruvbox', name: 'Gruvbox', preview: ['#282828', '#3c3836', '#fabd2f', '#ebdbb2'] },
  { id: 'rose-pine', name: 'Rosé Pine', preview: ['#191724', '#1f1d2e', '#ebbcba', '#e0def4'] },
  { id: 'latte', name: 'Catppuccin Latte', light: true, preview: ['#eff1f5', '#e6e9ef', '#179299', '#4c4f69'] },
  { id: 'paper', name: 'Paper', light: true, preview: ['#ffffff', '#f3f4f6', '#0e9f8a', '#111827'] },
];

export interface CustomThemeInfo {
  id: string;    // "custom:<file>.css"
  name: string;  // from a `/* name: ... */` comment, or the file name
  file: string;
}
