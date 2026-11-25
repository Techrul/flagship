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
  $('pause').hidden = !s.pauseButton;
  // Turning the pause button off while paused would leave the game stuck, so resume first.
  if (!s.pauseButton && vm.isPaused?.()) vm.setPaused(false);
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
    pause: true, // adds vm.setPaused(); the button only shows if the profile's "Pause button" is on
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

  let started = false;
  const pausedPanel = $<HTMLDivElement>('paused');
  const pauseButton = $<HTMLButtonElement>('pause');
  const vm = scaffolding.vm;
  (window as any).__flagshipVm = vm; // for debugging in DevTools and the smoke test

  const start = () => {
    if (started) return;
    started = true;
    overlay.hidden = true;
    playButton.hidden = true;
    pauseButton.disabled = false;
    document.removeEventListener('keydown', startKeys);
    scaffolding.start(); // starts the VM and runs "when flag clicked" scripts
    state('running');
  };
  const startKeys = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      start();
    }
  };

  // ----- pause -----
  // The UI follows the VM's own events, so anything that unpauses (like the green flag) updates it too.
  const showPaused = (paused: boolean) => {
    pausedPanel.hidden = !paused;
    overlay.hidden = !paused;
    pauseButton.classList.toggle('active', paused);
    pauseButton.title = paused ? 'Resume' : 'Pause';
    pauseButton.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
    if (started) state(paused ? 'paused' : 'running');
  };
  vm.runtime.on('RUNTIME_PAUSED', () => showPaused(true));
  vm.runtime.on('RUNTIME_UNPAUSED', () => showPaused(false));
  pauseButton.disabled = true; // nothing to pause until the game starts
  pauseButton.addEventListener('click', () => {
    if (started) vm.setPaused(!vm.isPaused());
  });
  $('resume').addEventListener('click', () => vm.setPaused(false));

  if (settings.autoplay) {
    start();
  } else {
    // Browsers only allow sound after a click, so wait for one before starting, like Scratch does.
    state('ready');
    loading.hidden = true;
    playButton.hidden = false;
    playButton.addEventListener('click', start, { once: true });
    document.addEventListener('keydown', startKeys); // Enter/Space also start, without a focus box
  }

  $('flag').addEventListener('click', () => {
    if (!started) return start();
    scaffolding.greenFlag(); // also unpauses
  });
  $('stop').addEventListener('click', () => {
    if (vm.isPaused()) vm.setPaused(false); // stopping a paused game shouldn't leave it frozen
    scaffolding.stopAll();
  });

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
