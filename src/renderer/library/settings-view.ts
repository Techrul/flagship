// The Settings page, the per-game settings dialog, profile pickers, and update checks.
import { api, Game } from '../shared/api';
import { applyTheme } from '../shared/theme-runtime';
import { renderSettingsForm } from './settings-form';
import { BUILT_IN_THEMES, ThemeInfo } from '../../shared/themes';
import { AppSettings, PlayerSettings, Profile, effectiveSettings, resolveProfile } from '../../shared/settings';
import type { UpdateState } from '../../shared/updates';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

let current: AppSettings;
let themeReloadCounter = 0;
let selectedProfileId = 'enhanced';

export const getSettings = () => current;

/** Fills a <select> with profiles. With includeDefault, the first option ("") means "use the default profile". */
export function fillProfileSelect(select: HTMLSelectElement, selected: string | null, includeDefault: boolean): void {
  const options: HTMLOptionElement[] = [];
  if (includeDefault) {
    const def = resolveProfile(current, null);
    options.push(new Option(`Default (${def.name})`, '', false, selected === null));
  }
  for (const profile of current.profiles) {
    options.push(new Option(profile.name, profile.id, false, selected === profile.id));
  }
  select.replaceChildren(...options);
  // A game whose profile was deleted shows "Default", which is what it actually uses.
  if (!options.some((o) => o.selected)) select.value = includeDefault ? '' : current.defaultProfile;
}

export async function initSettings(opts: { onClose(): void; onChange(): void }): Promise<AppSettings> {
  current = await api.getSettings();
  applyTheme(current);

  api.onSettingsChanged((settings) => {
    current = settings;
    applyTheme(settings, String(themeReloadCounter));
    if (!$('settings-view').hidden) renderSettingsPage();
    opts.onChange();
  });

  $('settings-close').addEventListener('click', opts.onClose);
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

  $<HTMLInputElement>('username-input').addEventListener('change', (event) => {
    api.setSettings({ username: (event.target as HTMLInputElement).value });
  });

  initProfileButtons();
  initUpdates();
  initAppMenu();
  initUninstall();
  api.getVersion().then((v) => { $('app-version').textContent = `v${v}`; });
  return current;
}

// ---------- Appearance ----------

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
  const customs = await api.listCustomThemes();
  $('theme-grid').replaceChildren(
    ...BUILT_IN_THEMES.map((t) => themeCard(t)),
    ...customs.map((t) => themeCard(t, true)),
  );
  // If the selected custom theme file was deleted, say so instead of silently showing OLED.
  $('theme-missing').hidden = !(current.theme.startsWith('custom:') && !customs.some((t) => t.id === current.theme));

  const accentToggle = $<HTMLInputElement>('accent-toggle');
  const accentPicker = $<HTMLInputElement>('accent-picker');
  accentToggle.checked = current.accent !== null;
  accentPicker.disabled = current.accent === null;
  accentPicker.value = current.accent ?? (getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#2ee6c8');

  const username = $<HTMLInputElement>('username-input');
  if (document.activeElement !== username) username.value = current.username;

  renderProfiles();
}

// ---------- Profiles ----------

function selectedProfile(): Profile {
  return current.profiles.find((p) => p.id === selectedProfileId) ?? resolveProfile(current, null);
}

function renderProfiles(): void {
  const profile = selectedProfile();
  selectedProfileId = profile.id;

  $('profile-tabs').replaceChildren(...current.profiles.map((p) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `profile-tab${p.id === profile.id ? ' selected' : ''}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(p.id === profile.id));
    tab.textContent = p.name;
    if (p.id === current.defaultProfile) {
      const star = document.createElement('span');
      star.className = 'tab-default';
      star.textContent = '★';
      star.title = 'Default profile';
      tab.prepend(star);
    }
    tab.addEventListener('click', () => { selectedProfileId = p.id; renderProfiles(); });
    return tab;
  }));

  const nameInput = $<HTMLInputElement>('profile-name');
  nameInput.hidden = profile.builtIn;
  if (document.activeElement !== nameInput) nameInput.value = profile.name;
  $('profile-name-static').hidden = !profile.builtIn;
  $('profile-name-static').textContent = profile.name;
  $('profile-builtin').hidden = !profile.builtIn;
  $('profile-default').hidden = profile.id !== current.defaultProfile;
  $('profile-make-default').hidden = profile.id === current.defaultProfile;
  $('profile-delete').hidden = profile.builtIn;
  $('profile-description').textContent = profile.builtIn
    ? `${profile.description} Built-in profiles can't be changed. Hit Duplicate to make your own version.`
    : 'Your own profile. Changes apply to every game using it, including games that are open right now.';

  renderSettingsForm($('profile-form'), {
    values: profile.settings,
    disabled: profile.builtIn,
    onChange: async (key, value) => {
      const res = await api.updateProfile(profile.id, { settings: { [key]: value } });
      if (!res.ok) alert(res.error);
    },
  });
}

function initProfileButtons(): void {
  $('profile-new').addEventListener('click', async () => {
    const res = await api.createProfile('', current.defaultProfile);
    if (res.ok) { selectedProfileId = res.result; renderProfiles(); } else alert(res.error);
  });
  $('profile-duplicate').addEventListener('click', async () => {
    const source = selectedProfile();
    const res = await api.createProfile(`${source.name} copy`, source.id);
    if (res.ok) { selectedProfileId = res.result; renderProfiles(); } else alert(res.error);
  });
  $('profile-make-default').addEventListener('click', () => api.setSettings({ defaultProfile: selectedProfile().id }));
  $('profile-delete').addEventListener('click', async () => {
    const profile = selectedProfile();
    if (!confirm(`Delete the "${profile.name}" profile? Games using it will switch to your default profile.`)) return;
    selectedProfileId = current.defaultProfile === profile.id ? 'enhanced' : current.defaultProfile;
    await api.deleteProfile(profile.id);
  });
  $<HTMLInputElement>('profile-name').addEventListener('change', (event) => {
    api.updateProfile(selectedProfile().id, { name: (event.target as HTMLInputElement).value });
  });
}

// ---------- Per-game dialog ----------

export async function openGameSettings(game: Game): Promise<void> {
  const dialog = $<HTMLDialogElement>('game-settings');
  let profileChoice: string | null = game.profile;
  let overrides: Partial<PlayerSettings> = { ...game.settings };
  const profileSelect = $<HTMLSelectElement>('game-profile');

  const save = () => api.setGameConfig(game.id, { profile: profileChoice, overrides });

  const render = () => {
    const profile = resolveProfile(current, profileChoice);
    fillProfileSelect(profileSelect, profileChoice, true);
    const values = effectiveSettings(profile.settings, overrides);
    const overridden = new Set(Object.keys(overrides) as (keyof PlayerSettings)[]);
    $('game-settings-title').textContent = game.title;
    $('game-settings-summary').textContent = overridden.size
      ? `${overridden.size} setting${overridden.size === 1 ? '' : 's'} changed just for this game. Everything else follows ${profile.name}.`
      : `This game follows the ${profile.name} profile. Change anything below to adjust it just for this game.`;
    renderSettingsForm($('game-settings-form'), {
      values,
      defaults: profile.settings,
      defaultsLabel: profile.name,
      overridden,
      onChange: async (key, value) => {
        overrides = { ...overrides, [key]: value };
        // Matching the profile again removes the override, so the game keeps following the profile.
        if (profile.settings[key] === value) delete overrides[key];
        await save();
        render();
      },
      onReset: async (key) => {
        delete overrides[key];
        await save();
        render();
      },
    });
  };

  profileSelect.onchange = async () => {
    profileChoice = profileSelect.value || null;
    // Drop overrides that now match the new profile, so they don't show as changes for no reason.
    const profile = resolveProfile(current, profileChoice);
    for (const key of Object.keys(overrides) as (keyof PlayerSettings)[]) {
      if (profile.settings[key] === overrides[key]) delete overrides[key];
    }
    await save();
    render();
  };
  $('game-settings-reset').onclick = async () => {
    overrides = {};
    await save();
    render();
  };
  $('game-settings-close').onclick = () => dialog.close();

  render();
  dialog.showModal();
}

// ---------- Updates ----------

let updateDismissed = false;

function setUpdateUi(text: string, canApply: boolean, busy = false) {
  $('update-status').textContent = text;
  $('update-apply').hidden = !canApply;
  $<HTMLButtonElement>('update-apply').disabled = busy;
  $<HTMLButtonElement>('update-check').disabled = busy;
}

export async function checkForUpdates(silent: boolean): Promise<void> {
  if (!silent) setUpdateUi('Checking for updates…', false, true);
  const res = await api.checkForUpdates();
  if (!res.ok) {
    setUpdateUi(res.error, false);
    return;
  }
  const info = res.result;
  if (!info.supported) {
    setUpdateUi(info.reason, false);
    return;
  }
  if (info.kind === 'auto') {
    // AppImage / Windows installer / .pacman .deb .rpm: electron-updater does the work; progress arrives as events.
    updateMode = 'auto';
    renderAutoState(info.state);
    return;
  }
  if (info.kind === 'release') {
    // Can't update itself (macOS, portable, tar.gz, Scoop, AUR): say how to update this install.
    updateMode = 'release';
    $('update-apply').textContent = 'Download update';
    $('update-banner-button').textContent = 'Download';
    const how = info.hint ? ` ${info.hint}` : '';
    if (!info.newer) {
      setUpdateUi(`You're up to date (v${info.current}).${how}`, false);
      $('update-banner').hidden = true;
      return;
    }
    setUpdateUi(`Flagship v${info.latest} is out (you have v${info.current}).${how}`, true);
    showBanner(`🚩 Flagship v${info.latest} is out`);
    return;
  }
  if (info.behind === 0) {
    setUpdateUi(`You're up to date (${info.branch} @ ${info.current}).`, false);
    $('update-banner').hidden = true;
    return;
  }
  const what = `${info.behind} new update${info.behind === 1 ? '' : 's'} on ${info.branch}`;
  const latest = info.latestMessage ? `: "${info.latestMessage}"` : '';
  setUpdateUi(`${what}${latest}.`, true);
  showBanner(`🚩 ${what}${latest}`);
}

let updateMode: 'git' | 'release' | 'auto' = 'git';

/** Turns the auto-updater's state into the banner + settings text. */
function renderAutoState(state: UpdateState): void {
  const v = state.version ? `v${state.version}` : 'the update';
  const needsPassword = state.kind === 'system';
  const button = $<HTMLButtonElement>('update-banner-button');
  const apply = $<HTMLButtonElement>('update-apply');
  button.hidden = false;
  button.disabled = false;
  switch (state.phase) {
    case 'idle':
    case 'checking':
      setUpdateUi('Checking for updates…', false, true);
      return;
    case 'none':
      setUpdateUi(`You're up to date (v${state.current}). Updates download and install automatically${needsPassword ? ' (you\'ll be asked for your password to install)' : ''}.`, false);
      $('update-banner').hidden = true;
      return;
    case 'downloading':
      setUpdateUi(`Downloading Flagship ${v}… ${state.percent ?? 0}%`, false, true);
      button.hidden = true;
      showBanner(`⬇️ Downloading Flagship ${v}… ${state.percent ?? 0}%`);
      return;
    case 'ready':
      if (needsPassword) {
        apply.textContent = 'Install (asks for password)';
        button.textContent = 'Install';
        setUpdateUi(`Flagship ${v} is downloaded. Installing it needs your password, then Flagship restarts.`, true);
        showBanner(`🚩 Flagship ${v} is ready to install`);
      } else {
        apply.textContent = 'Restart & update';
        button.textContent = 'Restart now';
        setUpdateUi(`Flagship ${v} is ready. It installs automatically when you close Flagship, or restart now.`, true);
        showBanner(`🚩 Flagship ${v} is ready: it installs when you close Flagship`);
      }
      return;
    case 'installing':
      setUpdateUi(needsPassword ? 'Installing… enter your password in the popup.' : 'Installing and restarting…', false, true);
      button.disabled = true;
      $('update-banner-text').textContent = needsPassword ? 'Installing… enter your password in the popup' : 'Installing…';
      return;
    case 'error':
      setUpdateUi(state.error ?? 'Update failed.', false);
      $('update-banner').hidden = true; // don't nag; the details are in Settings
      return;
  }
}

function showBanner(text: string) {
  if (updateDismissed) return;
  $('update-banner-text').textContent = text;
  $('update-banner').hidden = false;
}

async function applyUpdate(): Promise<void> {
  if (updateMode !== 'git') {
    // release: opens the download page · auto: installs + restarts (progress arrives via onUpdateState)
    const res = await api.applyUpdate();
    if (!res.ok) setUpdateUi(res.error, true);
    return;
  }
  setUpdateUi('Starting update…', true, true);
  $('update-banner').hidden = false;
  $('update-banner-text').textContent = 'Updating…';
  $<HTMLButtonElement>('update-banner-button').disabled = true;
  const res = await api.applyUpdate();
  if (!res.ok) {
    setUpdateUi(res.error, true);
    $('update-banner-text').textContent = `Update failed: ${res.error}`;
    $<HTMLButtonElement>('update-banner-button').disabled = false;
  }
  // On success the app restarts by itself.
}

function initUpdates(): void {
  api.onUpdateProgress((stage) => {
    setUpdateUi(`${stage}…`, true, true);
    $('update-banner-text').textContent = `${stage}…`;
  });
  api.onUpdateState((state) => {
    updateMode = 'auto';
    renderAutoState(state);
  });
  $('update-check').addEventListener('click', () => checkForUpdates(false));
  // Long sessions (e.g. big picture left running) still pick up updates.
  setInterval(() => checkForUpdates(true), 6 * 60 * 60 * 1000);
  $('update-apply').addEventListener('click', applyUpdate);
  $('update-banner-button').addEventListener('click', applyUpdate);
  $('update-banner-dismiss').addEventListener('click', () => {
    updateDismissed = true;
    $('update-banner').hidden = true;
  });
}

// ---------- App menu shortcut ----------

function showMenuStatus(res: Awaited<ReturnType<typeof api.getMenuStatus>>): void {
  const add = $<HTMLButtonElement>('menu-add');
  const remove = $<HTMLButtonElement>('menu-remove');
  const text = $('menu-status');
  add.hidden = true;
  remove.hidden = true;
  if (!res.ok) { text.textContent = res.error; add.hidden = false; return; }
  const s = res.result;
  if (!s.supported) { text.textContent = s.reason; return; }
  if (!s.installed) {
    text.textContent = 'Add Flagship to your app menu so you can open it like any other app.';
    add.hidden = false;
    add.textContent = 'Add to app menu';
  } else if (s.stale) {
    text.textContent = 'Your app menu shortcut points to an old location (did you move the Flagship folder?). Fix it to open this copy.';
    add.hidden = false;
    add.textContent = 'Fix shortcut';
    remove.hidden = false;
  } else {
    text.textContent = 'Flagship is in your app menu. ✓';
    remove.hidden = false;
  }
}

function initAppMenu(): void {
  api.getMenuStatus().then(showMenuStatus);
  $('menu-add').addEventListener('click', async () => showMenuStatus(await api.addToMenu()));
  $('menu-remove').addEventListener('click', async () => showMenuStatus(await api.removeFromMenu()));
}

// ---------- Uninstall ----------

function initUninstall(): void {
  const dialog = $<HTMLDialogElement>('uninstall-dialog');
  const confirmButton = $<HTMLButtonElement>('uninstall-confirm');
  const deleteData = $<HTMLInputElement>('uninstall-delete-data');
  const error = $('uninstall-error');

  $('uninstall-open').addEventListener('click', async () => {
    const plan = await api.uninstallPlan();
    $('uninstall-summary').textContent = plan.summary;
    $('uninstall-manual-row').hidden = !plan.manual || plan.mode === 'run';
    $('uninstall-manual').textContent = plan.manual ?? '';
    $('uninstall-data-path').textContent = plan.dataFolder;
    deleteData.checked = false;
    error.hidden = true;
    confirmButton.hidden = plan.mode !== 'run';
    confirmButton.disabled = false;
    confirmButton.textContent = 'Uninstall';
    deleteData.hidden = plan.mode !== 'run';
    $('uninstall-data-label').textContent = plan.mode === 'run'
      ? 'Also delete my library, notes, saves and settings'
      : 'Your library, notes and settings are kept here. Delete this folder too if you want them gone:';
    $('uninstall-cancel').textContent = plan.mode === 'run' ? 'Cancel' : 'Close';
    dialog.showModal();
  });

  const close = () => dialog.close();
  $('uninstall-close').addEventListener('click', close);
  $('uninstall-cancel').addEventListener('click', close);
  $('uninstall-show-data').addEventListener('click', () => api.showDataFolder());
  $('uninstall-copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText($('uninstall-manual').textContent ?? '');
    $('uninstall-copy').textContent = 'Copied!';
    setTimeout(() => ($('uninstall-copy').textContent = 'Copy'), 1500);
  });
  confirmButton.addEventListener('click', async () => {
    if (deleteData.checked && !confirm('Delete your whole library, notes and settings? This can\'t be undone.')) return;
    confirmButton.disabled = true;
    confirmButton.textContent = 'Uninstalling…';
    error.hidden = true;
    const res = await api.uninstall(deleteData.checked);
    // On success Flagship quits, so we only get here on failure.
    if (!res.ok) {
      error.textContent = res.error;
      error.hidden = false;
      confirmButton.disabled = false;
      confirmButton.textContent = 'Uninstall';
    }
  });
}
