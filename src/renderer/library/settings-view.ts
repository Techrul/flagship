// The Settings page (global) and the per-game settings dialog.
import { api, Game } from '../shared/api';
import { applyTheme } from '../shared/theme-runtime';
import { renderSettingsForm } from './settings-form';
import { BUILT_IN_THEMES, ThemeInfo } from '../../shared/themes';
import { AppSettings, DEFAULT_PLAYER_SETTINGS, PlayerSettings, effectiveSettings } from '../../shared/settings';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let current: AppSettings;
let themeReloadCounter = 0;

export async function initSettings(): Promise<AppSettings> {
  current = await api.getSettings();
  applyTheme(current);

  api.onSettingsChanged((settings) => {
    current = settings;
    applyTheme(settings, String(themeReloadCounter));
    if (!$('settings-view').hidden) renderSettingsPage();
  });

  $('open-themes-folder').addEventListener('click', () => api.openThemesFolder());
  $('reload-themes').addEventListener('click', () => {
    themeReloadCounter++;
    applyTheme(current, String(themeReloadCounter));
    renderSettingsPage();
  });

  const accentToggle = $<HTMLInputElement>('accent-toggle');
  const accentPicker = $<HTMLInputElement>('accent-picker');
  accentToggle.addEventListener('change', () => {
    api.setSettings({ accent: accentToggle.checked ? accentPicker.value : null });
  });
  accentPicker.addEventListener('input', () => {
    // Preview instantly while dragging; save when the picker closes.
    if (accentToggle.checked) applyTheme({ ...current, accent: accentPicker.value });
  });
  accentPicker.addEventListener('change', () => {
    if (accentToggle.checked) api.setSettings({ accent: accentPicker.value });
  });

  $('reset-defaults').addEventListener('click', () => {
    if (confirm('Reset all game defaults to TurboWarp\'s standard settings? Per-game settings are kept.')) {
      api.setSettings({ player: { ...DEFAULT_PLAYER_SETTINGS } });
    }
  });

  return current;
}

// ---------- Settings page ----------

function themeCard(theme: { id: string; name: string; preview?: ThemeInfo['preview'] }, custom = false) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `theme-card${current.theme === theme.id ? ' selected' : ''}`;
  card.setAttribute('aria-pressed', String(current.theme === theme.id));

  const swatch = document.createElement('div');
  swatch.className = 'theme-swatch';
  if (theme.preview) {
    const [bg, surface, accent, text] = theme.preview;
    swatch.style.background = bg;
    swatch.innerHTML = '<span class="sw-card"></span><span class="sw-line"></span><span class="sw-dot"></span>';
    (swatch.querySelector('.sw-card') as HTMLElement).style.background = surface;
    (swatch.querySelector('.sw-line') as HTMLElement).style.background = text;
    (swatch.querySelector('.sw-dot') as HTMLElement).style.background = accent;
  } else {
    swatch.classList.add('custom');
    swatch.textContent = '{ }';
  }

  const name = document.createElement('span');
  name.className = 'theme-name';
  name.textContent = theme.name;
  card.append(swatch, name);
  if (custom) card.title = 'Custom theme from your themes folder';
  card.addEventListener('click', () => api.setSettings({ theme: theme.id }));
  return card;
}

export async function renderSettingsPage(): Promise<void> {
  const grid = $('theme-grid');
  const customs = await api.listCustomThemes();
  grid.replaceChildren(
    ...BUILT_IN_THEMES.map((t) => themeCard(t)),
    ...customs.map((t) => themeCard(t, true)),
  );
  // If the selected custom theme file was deleted, say so instead of silently showing OLED.
  const missing = current.theme.startsWith('custom:') && !customs.some((t) => t.id === current.theme);
  $('theme-missing').hidden = !missing;

  const accentToggle = $<HTMLInputElement>('accent-toggle');
  const accentPicker = $<HTMLInputElement>('accent-picker');
  accentToggle.checked = current.accent !== null;
  accentPicker.disabled = current.accent === null;
  accentPicker.value = current.accent ?? (getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2ee6c8');

  renderSettingsForm($('defaults-form'), {
    values: current.player,
    onChange: (key, value) => api.setSettings({ player: { [key]: value } }),
  });
}

// ---------- Per-game dialog ----------

export async function openGameSettings(game: Game): Promise<void> {
  const dialog = $<HTMLDialogElement>('game-settings');
  let overrides: Partial<PlayerSettings> = { ...game.settings };

  const render = () => {
    const values = effectiveSettings(current.player, overrides);
    const overridden = new Set(Object.keys(overrides) as (keyof PlayerSettings)[]);
    $('game-settings-title').textContent = game.title;
    $('game-settings-summary').textContent = overridden.size
      ? `${overridden.size} setting${overridden.size === 1 ? '' : 's'} changed for this game. Everything else follows your defaults.`
      : 'This game uses your default settings. Change anything below to override it just for this game.';
    renderSettingsForm($('game-settings-form'), {
      values,
      defaults: current.player,
      overridden,
      onChange: async (key, value) => {
        overrides = { ...overrides, [key]: value };
        // Setting it back to the default value removes the override, so it follows future default changes.
        if (current.player[key] === value) delete overrides[key];
        await api.setGameSettings(game.id, overrides);
        render();
      },
      onReset: async (key) => {
        delete overrides[key];
        await api.setGameSettings(game.id, overrides);
        render();
      },
    });
  };

  $('game-settings-reset').onclick = async () => {
    overrides = {};
    await api.setGameSettings(game.id, overrides);
    render();
  };
  $('game-settings-close').onclick = () => dialog.close();

  render();
  dialog.showModal();
}
