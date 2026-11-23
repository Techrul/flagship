import { api, Game } from '../shared/api';
import { initSettings, openGameSettings, renderSettingsPage } from './settings-view';

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
const template = $<HTMLTemplateElement>('card-template');

// ---------- navigation ----------
const libraryView = $<HTMLElement>('library-view');
const settingsView = $<HTMLElement>('settings-view');
const settingsButton = $<HTMLButtonElement>('nav-settings');

function showView(view: 'library' | 'settings') {
  libraryView.hidden = view !== 'library';
  settingsView.hidden = view !== 'settings';
  settingsButton.classList.toggle('active', view === 'settings');
  if (view === 'settings') renderSettingsPage();
  window.scrollTo(0, 0);
}
settingsButton.addEventListener('click', () => showView(settingsView.hidden ? 'settings' : 'library'));
$('nav-library').addEventListener('click', () => showView('library'));
document.addEventListener('keydown', (event) => {
  const dialogOpen = document.querySelector('dialog[open]');
  if (event.key === 'Escape' && !settingsView.hidden && !dialogOpen) showView('library');
});

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

  const customCount = Object.keys(game.settings ?? {}).length;
  const badge = card.querySelector<HTMLElement>('.card-badge')!;
  badge.hidden = customCount === 0;
  badge.title = `${customCount} custom setting${customCount === 1 ? '' : 's'}`;

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
    if (action === 'settings') openGameSettings(game);
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
api.onGameSettingsChanged(refresh);
initSettings().then(refresh);
if (location.hash === '#settings') showView('settings'); // used by the smoke test
