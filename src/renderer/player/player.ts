import type { FlagshipApi } from '../shared/api';

// Scaffolding (TurboWarp's player) is loaded by a <script> tag and lives on window.Scaffolding.
declare const Scaffolding: any;

const api = (window as unknown as { flagship: FlagshipApi }).flagship;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const state = (value: string) => { (window as any).__flagshipState = value; }; // read by the smoke test

try {
  document.documentElement.dataset.theme = localStorage.getItem('flagship:theme') || 'oled';
} catch { /* ignore */ }

const id = new URLSearchParams(location.search).get('id') ?? '';
const overlay = $<HTMLDivElement>('overlay');
const loading = $<HTMLDivElement>('loading');
const loadingText = $<HTMLSpanElement>('loading-text');
const playButton = document.querySelector<HTMLButtonElement>('.click-to-play')!;
const errorText = $<HTMLParagraphElement>('error');
const stageWrap = $<HTMLDivElement>('stage-wrap');

function showError(message: string) {
  state(`error: ${message}`);
  loading.hidden = true;
  playButton.hidden = true;
  errorText.hidden = false;
  errorText.textContent = message;
  overlay.hidden = false;
}

async function main() {
  state('loading');
  const game = await api.getGame(id);
  if (!game) return showError("This game isn't in your library anymore.");
  document.title = `${game.title} — Flagship`;
  $('title').textContent = game.title;

  const scaffolding = new Scaffolding.Scaffolding();
  // v0.1 uses TurboWarp's defaults; per-game settings (turbo, FPS, interpolation…) arrive in v0.2.
  scaffolding.width = 480;
  scaffolding.height = 360;
  scaffolding.resizeMode = 'preserve-ratio';
  scaffolding.editableLists = false;
  scaffolding.setup();
  scaffolding.appendTo($('stage'));

  // Cloud variables are saved on this computer, per game. Many Scratch games keep their saves
  // in cloud variables, so this alone makes a lot of saves survive closing the window.
  scaffolding.addCloudProvider(new Scaffolding.Cloud.LocalStorageProvider(`flagship:cloud:${id}`));
  scaffolding.setAccentColor('#2ee6c8');

  scaffolding.storage.onprogress = (total: number, loaded: number) => {
    if (total > 0) loadingText.textContent = `Loading assets… ${Math.round((loaded / total) * 100)}%`;
  };

  try {
    const data = await api.getProject(id);
    await scaffolding.loadProject(data);
  } catch (error) {
    return showError(`Couldn't load this game: ${(error as Error).message}. Try re-downloading it from the library.`);
  }

  // Browsers only allow sound after a click, so wait for one before starting, like Scratch does.
  state('ready');
  loading.hidden = true;
  playButton.hidden = false;
  playButton.focus();

  const start = () => {
    overlay.hidden = true;
    scaffolding.start(); // starts the VM and runs "when flag clicked" scripts
    state('running');
  };
  playButton.addEventListener('click', start, { once: true });

  $('flag').addEventListener('click', () => {
    if (!overlay.hidden) return start();
    scaffolding.greenFlag();
  });
  $('stop').addEventListener('click', () => scaffolding.stopAll());

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stageWrap.requestFullscreen();
  };
  $('fullscreen').addEventListener('click', toggleFullscreen);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'F11') {
      event.preventDefault();
      toggleFullscreen();
    }
  });
  // Scaffolding only re-measures on window resize; fullscreen changes need a nudge.
  document.addEventListener('fullscreenchange', () => scaffolding.relayout());
}

main().catch((error) => showError(`Something went wrong: ${(error as Error).message}`));
