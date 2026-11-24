import { api } from '../shared/api';
import { applyTheme } from '../shared/theme-runtime';
import type { PlayerSettings } from '../../shared/settings';

// TurboWarp's player and its addons are loaded by <script> tags.
declare const Scaffolding: any;
declare const ScaffoldingAddons: any;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const state = (value: string) => { (window as any).__flagshipState = value; }; // read by the smoke test

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

/** Settings that can be changed while the game runs. */
function applyLiveSettings(scaffolding: any, s: PlayerSettings, username: string) {
  const vm = scaffolding.vm;
  vm.setFramerate(s.framerate);
  vm.setInterpolation(s.interpolation);
  vm.setTurboMode(s.turbo);
  scaffolding.renderer.setUseHighQualityRender(s.highQualityPen);
  vm.setRuntimeOptions({
    maxClones: s.infiniteClones ? Infinity : 300,
    fencing: !s.removeFencing,
    miscLimits: !s.removeMiscLimits,
  });
  scaffolding.setUsername(username);
  (window as any).__flagshipSettings = { ...s, username }; // read by the smoke test
}

async function main() {
  state('loading');
  const [game, appSettings, settings] = await Promise.all([
    api.getGame(id), api.getSettings(), api.getEffectiveSettings(id),
  ]);
  applyTheme(appSettings);
  api.onSettingsChanged((s) => applyTheme(s));
  if (!game) return showError("This game isn't in your library anymore.");
  document.title = `${game.title} — Flagship`;
  $('title').textContent = game.title;

  const scaffolding = new Scaffolding.Scaffolding();
  scaffolding.width = settings.stageWidth;
  scaffolding.height = settings.stageHeight;
  scaffolding.resizeMode = 'preserve-ratio';
  scaffolding.editableLists = false;
  scaffolding.setup();
  scaffolding.appendTo($('stage'));

  // Must be set before the project loads, since it decides how scripts get compiled.
  scaffolding.vm.setCompilerOptions({ enabled: settings.compiler, warpTimer: settings.warpTimer });
  let username = appSettings.username;
  applyLiveSettings(scaffolding, settings, username);

  // Many Scratch games keep their saves in cloud variables; this keeps them on this computer, per game.
  if (settings.cloudSaves) {
    scaffolding.addCloudProvider(new Scaffolding.Cloud.LocalStorageProvider(`flagship:cloud:${id}`));
  }
  scaffolding.setAccentColor(getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2ee6c8');

  ScaffoldingAddons.run(scaffolding, {
    gamepad: settings.gamepad,
    pointerlock: settings.pointerLock,
    specialCloudBehaviors: false,
    unsafeCloudBehaviors: false, // never let a game run arbitrary JavaScript
    pause: false,
  });

  // Settings edited in the library while this game is open.
  const refresh = async () => applyLiveSettings(scaffolding, await api.getEffectiveSettings(id), username);
  api.onSettingsChanged((s) => { username = s.username; refresh(); });
  api.onGameSettingsChanged((p) => { if (p.id === id) refresh(); });

  scaffolding.storage.onprogress = (total: number, loaded: number) => {
    if (total > 0) loadingText.textContent = `Loading assets… ${Math.round((loaded / total) * 100)}%`;
  };

  try {
    const data = await api.getProject(id);
    await scaffolding.loadProject(data);
  } catch (error) {
    return showError(`Couldn't load this game: ${(error as Error).message}. Try re-downloading it from the library.`);
  }

  const start = () => {
    overlay.hidden = true;
    scaffolding.start(); // starts the VM and runs "when flag clicked" scripts
    state('running');
  };

  if (settings.autoplay) {
    start();
  } else {
    // Browsers only allow sound after a click, so wait for one before starting, like Scratch does.
    state('ready');
    loading.hidden = true;
    playButton.hidden = false;
    playButton.focus();
    playButton.addEventListener('click', start, { once: true });
  }

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
