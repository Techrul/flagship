import type { FlagshipApi, Game } from '../shared/api';

const api = (window as unknown as { flagship: FlagshipApi }).flagship;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const grid = $<HTMLDivElement>('grid');
const empty = $<HTMLDivElement>('empty');
const count = $<HTMLSpanElement>('count');
const form = $<HTMLFormElement>('add-form');
const input = $<HTMLInputElement>('add-input');
const addButton = $<HTMLButtonElement>('add-button');
const status = $<HTMLDivElement>('status');
const statusText = $<HTMLSpanElement>('status-text');
const progressBar = $<HTMLDivElement>('progress-bar');
const themeSelect = $<HTMLSelectElement>('theme-select');
const template = $<HTMLTemplateElement>('card-template');

// ---------- theme ----------
function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme;
  themeSelect.value = theme;
  try { localStorage.setItem('flagship:theme', theme); } catch { /* storage unavailable; fine */ }
}
let savedTheme = 'oled';
try { savedTheme = localStorage.getItem('flagship:theme') || 'oled'; } catch { /* ignore */ }
applyTheme(savedTheme);
themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

// ---------- status bar ----------
let hideTimer: number | undefined;
function showStatus(text: string, opts: { error?: boolean; progress?: number; autoHide?: boolean } = {}) {
  window.clearTimeout(hideTimer);
  status.hidden = false;
  status.classList.toggle('error', !!opts.error);
  statusText.textContent = text;
  progressBar.style.width = `${Math.round((opts.progress ?? 0) * 100)}%`;
  if (opts.autoHide) hideTimer = window.setTimeout(() => { status.hidden = true; }, 4000);
}

api.onAddProgress(({ stage, fraction }) => {
  const pct = stage === 'Downloading' ? ` ${Math.round(fraction * 100)}%` : '';
  showStatus(`${stage}…${pct}`, { progress: stage === 'Saving' ? 1 : fraction });
});

// ---------- formatting ----------
function formatPlaytime(seconds: number): string {
  if (seconds < 60) return seconds > 0 ? 'Played < 1 min' : 'Never played';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min played`;
  const hours = seconds / 3600;
  return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hrs played`;
}

// ---------- grid ----------
function closeAllMenus() {
  grid.querySelectorAll<HTMLElement>('.card-dropdown').forEach((m) => { m.hidden = true; });
}
document.addEventListener('click', closeAllMenus);

function renderCard(game: Game): HTMLElement {
  const card = (template.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement;
  card.dataset.id = game.id;

  const img = card.querySelector('img')!;
  if (game.hasThumbnail) {
    // Cache-bust so a re-download shows the fresh thumbnail.
    img.src = `flagship-media://thumb/${game.id}?t=${encodeURIComponent(game.addedAt)}`;
    img.onerror = () => img.classList.add('missing');
  } else {
    img.classList.add('missing');
  }

  card.querySelector('.card-title')!.textContent = game.title;
  (card.querySelector('.card-title') as HTMLElement).title = game.title;
  card.querySelector('.card-meta')!.textContent = `by ${game.author} · ${formatPlaytime(game.playtimeSeconds)}`;

  card.querySelector('.card-art')!.addEventListener('click', () => api.playGame(game.id));

  const menu = card.querySelector<HTMLElement>('.card-dropdown')!;
  card.querySelector('.card-menu')!.addEventListener('click', (event) => {
    event.stopPropagation();
    const wasHidden = menu.hidden;
    closeAllMenus();
    menu.hidden = !wasHidden;
  });

  menu.addEventListener('click', async (event) => {
    const action = (event.target as HTMLElement).dataset.action;
    if (action === 'scratch') api.openOnScratch(game.id);
    if (action === 'redownload') await addGame(game.id);
    if (action === 'remove') {
      // Notes live with the game, so removal is a real loss; confirm first.
      if (confirm(`Remove "${game.title}" from your library? Its notes and cached files will be deleted.`)) {
        await api.removeGame(game.id);
        await refresh();
      }
    }
  });

  return card;
}

async function refresh() {
  const games = await api.listGames();
  grid.replaceChildren(...games.map(renderCard));
  empty.hidden = games.length > 0;
  count.textContent = games.length ? `${games.length} game${games.length === 1 ? '' : 's'}` : '';
}

// ---------- adding ----------
let busy = false;
async function addGame(text: string) {
  if (busy || !text.trim()) return;
  busy = true;
  addButton.disabled = true;
  showStatus('Looking up project…');
  try {
    const result = await api.addGame(text);
    if (result.ok) {
      input.value = '';
      showStatus(`Added "${result.game.title}" ✓`, { progress: 1, autoHide: true });
      await refresh();
    } else {
      showStatus(result.error, { error: true });
    }
  } finally {
    busy = false;
    addButton.disabled = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  addGame(input.value);
});

api.onLibraryChanged(refresh);
refresh();
