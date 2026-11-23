// Applies the current theme + accent to whichever window loads this (library or player).
import type { AppSettings } from '../../shared/settings';

/** Picks black or white text for a given background so accent buttons stay readable. */
export function readableTextOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? '#000000' : '#ffffff';
}

export function applyTheme(settings: Pick<AppSettings, 'theme' | 'accent'>, cacheBust = ''): void {
  const root = document.documentElement;
  const custom = settings.theme.startsWith('custom:') ? settings.theme.slice('custom:'.length) : null;

  // Custom themes sit on top of OLED, so any variable they don't set still has a value.
  root.dataset.theme = custom ? 'oled' : settings.theme;

  let link = document.getElementById('custom-theme') as HTMLLinkElement | null;
  if (custom) {
    if (!link) {
      link = document.createElement('link');
      link.id = 'custom-theme';
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `flagship-media://theme/${encodeURIComponent(custom)}${cacheBust ? `?v=${cacheBust}` : ''}`;
  } else {
    link?.remove();
  }

  if (settings.accent) {
    root.style.setProperty('--accent', settings.accent);
    root.style.setProperty('--accent-text', readableTextOn(settings.accent));
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-text');
  }
}
