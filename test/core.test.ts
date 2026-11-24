import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseProjectInput } from '../src/main/scratch';
import { Library } from '../src/main/library';

test('parses every way people paste Scratch projects', () => {
  const cases: Record<string, string | null> = {
    '104': '104',
    '  60917032  ': '60917032',
    'https://scratch.mit.edu/projects/104/': '104',
    'https://scratch.mit.edu/projects/104': '104',
    'scratch.mit.edu/projects/104/editor': '104',
    'https://scratch.mit.edu/projects/104/fullscreen/': '104',
    'https://turbowarp.org/104': '104',
    'https://turbowarp.org/104?fps=60&turbo': '104',
    'https://turbowarp.org/editor#104': '104',
    'https://turbowarp.org/104/fullscreen': '104',
    'https://scratch.mit.edu/users/griffpatch/': null,
    'https://example.com/projects/104': null,
    'hello': null,
    '': null,
  };
  for (const [input, expected] of Object.entries(cases)) {
    assert.equal(parseProjectInput(input), expected, `input: ${JSON.stringify(input)}`);
  }
});

function tempLibrary() {
  return new Library(fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-test-')));
}
const meta = { id: '104', title: 'Test', author: 'me', instructions: '', description: '' };
const project = { data: new Uint8Array([1, 2, 3]), type: 'sb3' };

test('library adds, persists, and reloads games', () => {
  const lib = tempLibrary();
  lib.add(meta, project, null);
  const reloaded = new Library(lib.root);
  assert.equal(reloaded.list().length, 1);
  assert.deepEqual([...reloaded.readProject('104')], [1, 2, 3]);
});

test('re-downloading keeps notes, playtime and added date', () => {
  const lib = tempLibrary();
  const first = lib.add(meta, project, null);
  lib.get('104')!.notes = 'save code: ABC123';
  lib.recordSession('104', 125);
  lib.add({ ...meta, title: 'Test v2' }, { data: new Uint8Array([9]), type: 'sb3' }, null);
  const game = new Library(lib.root).get('104')!;
  assert.equal(game.title, 'Test v2');
  assert.equal(game.notes, 'save code: ABC123');
  assert.equal(game.playtimeSeconds, 125);
  assert.equal(game.addedAt, first.addedAt);
});

test('remove deletes the game and its files', () => {
  const lib = tempLibrary();
  lib.add(meta, project, null);
  lib.remove('104');
  assert.equal(lib.has('104'), false);
  assert.equal(fs.existsSync(path.join(lib.gamesDir, '104')), false);
});

test('rejects IDs that could escape the library folder', () => {
  const lib = tempLibrary();
  assert.throws(() => lib.gameDir('../../etc'));
  assert.throws(() => lib.gameDir('104/../../x'));
});

test('a corrupt library.json is backed up, not destroyed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-test-'));
  fs.writeFileSync(path.join(root, 'library.json'), '{not json');
  const lib = new Library(root);
  assert.equal(lib.list().length, 0);
  assert.ok(fs.readdirSync(root).some((f) => f.startsWith('library.json.corrupt-')));
});

// ---------- settings ----------
import { BUILT_IN_PROFILES, DEFAULT_PLAYER_SETTINGS, effectiveSettings, resolveProfile, sanitizePlayerSettings } from '../src/shared/settings';
import { SettingsStore } from '../src/main/settings-store';
import { CustomThemes } from '../src/main/custom-themes';

test('sanitize drops unknown keys and wrong types, clamps numbers', () => {
  const clean = sanitizePlayerSettings({ turbo: 'yes', framerate: 1e9, username: 'old field', evil: 1, gamepad: true }, true);
  assert.deepEqual(clean, { framerate: 4096, gamepad: true });
  assert.deepEqual(sanitizePlayerSettings(null), DEFAULT_PLAYER_SETTINGS);
});

test('per-game overrides win over defaults', () => {
  const s = effectiveSettings({ ...DEFAULT_PLAYER_SETTINGS, turbo: true }, { framerate: 60 });
  assert.equal(s.turbo, true);
  assert.equal(s.framerate, 60);
});

test('settings store saves, ignores junk, keeps good values', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-test-'));
  const store = new SettingsStore(dir);
  assert.equal(store.get().defaultProfile, 'enhanced'); // new installs get Enhanced
  store.update({ theme: 'mocha', accent: '#ABCDEF', username: '  Techrul ' });
  store.update({ theme: '../../etc/passwd', accent: 'red', defaultProfile: 'nope' });
  const reloaded = new SettingsStore(dir).get();
  assert.equal(reloaded.theme, 'mocha');
  assert.equal(reloaded.accent, '#abcdef');
  assert.equal(reloaded.username, 'Techrul');
  assert.equal(reloaded.defaultProfile, 'enhanced');
  store.update({ accent: null });
  assert.equal(new SettingsStore(dir).get().accent, null);
});

test('profiles: create, edit, default, delete; built-ins are protected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-test-'));
  const store = new SettingsStore(dir);
  const id = store.createProfile('Speedrun', 'vanilla');
  store.updateProfile(id, { settings: { turbo: true, framerate: 60 }, name: '  Speed   run  ' });
  store.update({ defaultProfile: id });
  let s = new SettingsStore(dir).get();
  const mine = s.profiles.find((p) => p.id === id)!;
  assert.equal(mine.name, 'Speed run');
  assert.equal(mine.settings.turbo, true);
  assert.equal(mine.settings.interpolation, false); // copied from Vanilla
  assert.equal(s.defaultProfile, id);
  assert.throws(() => store.updateProfile('enhanced', { settings: { turbo: true } }));
  store.deleteProfile('vanilla'); // ignored
  store.deleteProfile(id);
  s = new SettingsStore(dir).get();
  assert.deepEqual(s.profiles.map((p) => p.id), ['enhanced', 'vanilla']);
  assert.equal(s.defaultProfile, 'enhanced'); // deleting the default falls back to Enhanced
});

test('Enhanced turns on exactly the safe improvements', () => {
  const enhanced = BUILT_IN_PROFILES.find((p) => p.id === 'enhanced')!.settings;
  const changed = Object.keys(enhanced).filter((k) => (enhanced as any)[k] !== (DEFAULT_PLAYER_SETTINGS as any)[k]).sort();
  assert.deepEqual(changed, ['highQualityPen', 'infiniteClones', 'interpolation', 'removeFencing', 'removeMiscLimits', 'warpTimer']);
});

test('migration from v0.2: untouched defaults move to Enhanced', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-test-'));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ version: 1, theme: 'nord', accent: null, player: { ...DEFAULT_PLAYER_SETTINGS, username: 'Techrul' } }));
  const s = new SettingsStore(dir).get();
  assert.equal(s.defaultProfile, 'enhanced');
  assert.equal(s.theme, 'nord');
  assert.equal(s.username, 'Techrul');
  assert.equal(s.profiles.length, 2);
});

test('migration from v0.2: customized defaults are kept as "My settings"', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-test-'));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ version: 1, theme: 'oled', player: { ...DEFAULT_PLAYER_SETTINGS, turbo: true } }));
  const s = new SettingsStore(dir).get();
  assert.equal(s.defaultProfile, 'my-settings');
  assert.equal(resolveProfile(s, null).settings.turbo, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')).version, 2); // written back
});

test('resolveProfile falls back when a game\'s profile was deleted', () => {
  const s = new SettingsStore(fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-test-'))).get();
  assert.equal(resolveProfile(s, 'vanilla').id, 'vanilla');
  assert.equal(resolveProfile(s, 'custom-gone').id, 'enhanced');
  assert.equal(resolveProfile(s, null).id, 'enhanced');
});

test('library migrates games saved before settings existed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-test-'));
  fs.writeFileSync(path.join(root, 'library.json'), JSON.stringify({ version: 1, games: [{ ...meta, projectFile: 'project.sb3', hasThumbnail: false, addedAt: 'x', lastPlayedAt: null, playtimeSeconds: 0, notes: '' }] }));
  const game = new Library(root).get('104')!;
  assert.deepEqual(game.settings, {});
  assert.equal(game.profile, null);
});

test('games remember their profile and overrides, even after re-download', () => {
  const lib = tempLibrary();
  lib.add(meta, project, null, 'vanilla');
  assert.equal(lib.get('104')!.profile, 'vanilla');
  lib.setConfig('104', { overrides: { turbo: true, bogus: 5 } });
  lib.add(meta, project, null, 'enhanced'); // re-download must not change the profile
  const game = new Library(lib.root).get('104')!;
  assert.equal(game.profile, 'vanilla');
  assert.deepEqual(game.settings, { turbo: true });
  lib.setConfig('104', { profile: null });
  assert.equal(lib.get('104')!.profile, null);
  lib.setConfig('104', { profile: '../evil' }); // rejected
  assert.equal(lib.get('104')!.profile, null);
});

test('custom themes: example created, names parsed, paths locked to the folder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-themes-'));
  const themes = new CustomThemes(dir);
  fs.writeFileSync(path.join(dir, 'neon.css'), '/* name: Neon Dreams */ :root { --accent: #f0f; }');
  const list = themes.list();
  assert.deepEqual(list.map((t) => t.name), ['Example: Ember (edit me!)', 'Neon Dreams']);
  assert.equal(themes.resolve('../settings.json'), null);
  assert.equal(themes.resolve('missing.css'), null);
  assert.ok(themes.resolve('neon.css'));
});

// ---------- updater (against a real local git "remote") ----------
import { execFileSync } from 'node:child_process';
import { Updater } from '../src/main/updater';

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
}

function makeRepos() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-upd-'));
  const remote = path.join(base, 'remote.git');
  const dev = path.join(base, 'dev');      // "Claude pushing to GitHub"
  const user = path.join(base, 'user');    // "Techrul's clone"
  git(base, 'init', '--bare', '-q', '-b', 'beta', remote);
  git(base, 'clone', '-q', remote, dev);
  git(dev, 'config', 'user.email', 't@t'); git(dev, 'config', 'user.name', 't');
  fs.mkdirSync(path.join(dev, 'scripts'));
  // Stand-in build script: records that a rebuild happened.
  fs.writeFileSync(path.join(dev, 'scripts', 'build.mjs'), "import fs from 'node:fs'; fs.writeFileSync('built.txt', 'yes');");
  fs.writeFileSync(path.join(dev, 'package-lock.json'), '{}');
  fs.writeFileSync(path.join(dev, '.gitignore'), 'built.txt\n');
  git(dev, 'checkout', '-q', '-b', 'beta');
  git(dev, 'add', '-A'); git(dev, 'commit', '-q', '-m', 'v1'); git(dev, 'push', '-q', '-u', 'origin', 'beta');
  git(base, 'clone', '-q', '-b', 'beta', remote, user);
  return { dev, user };
}

test('updater: up to date, then finds and applies a new commit', async () => {
  const { dev, user } = makeRepos();
  const updater = new Updater(user);
  let info = await updater.check();
  assert.ok(info.supported && info.behind === 0);

  fs.writeFileSync(path.join(dev, 'new-feature.txt'), 'hi');
  git(dev, 'add', '-A'); git(dev, 'commit', '-q', '-m', 'Add profiles'); git(dev, 'push', '-q');

  info = await updater.check();
  assert.ok(info.supported);
  assert.equal(info.behind, 1);
  assert.equal(info.latestMessage, 'Add profiles');

  fs.writeFileSync(path.join(user, 'package-lock.json'), '{"npm":"rewrote me"}'); // npm does this; must not block
  const stages: string[] = [];
  await updater.apply((s) => stages.push(s));
  assert.ok(fs.existsSync(path.join(user, 'new-feature.txt')));
  assert.equal(fs.readFileSync(path.join(user, 'built.txt'), 'utf8'), 'yes');
  assert.deepEqual(stages, ['Downloading update', 'Rebuilding']);
  const after = await updater.check();
  assert.ok(after.supported && after.behind === 0);
});

test('updater: refuses to clobber real local changes', async () => {
  const { dev, user } = makeRepos();
  fs.writeFileSync(path.join(dev, 'x.txt'), '1');
  git(dev, 'add', '-A'); git(dev, 'commit', '-q', '-m', 'x'); git(dev, 'push', '-q');
  fs.writeFileSync(path.join(user, '.gitignore'), 'edited by user\n');
  await assert.rejects(new Updater(user).apply(() => {}), /local changes/);
});

test('updater: explains when it isn\'t a git clone', async () => {
  const info = await new Updater(fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-nogit-'))).check();
  assert.equal(info.supported, false);
});

// ---------- app menu shortcut ----------
import { DesktopEntry } from '../src/main/desktop-entry';

test('app menu: .desktop file launches this copy, quotes paths, and installs/removes cleanly', { skip: process.platform !== 'linux' }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-xdg-'));
  const old = process.env.XDG_DATA_HOME;
  process.env.XDG_DATA_HOME = home;
  try {
    const entry = new DesktopEntry('/home/me/My Games/flagship', '/home/me/My Games/flagship/node_modules/electron/dist/electron');
    const text = entry.linuxEntry();
    assert.match(text, /^Exec="\/home\/me\/My Games\/flagship\/node_modules\/electron\/dist\/electron" "\/home\/me\/My Games\/flagship"$/m);
    assert.match(text, /^StartupWMClass=flagship$/m);
    assert.match(text, /^Icon=\/home\/me\/My Games\/flagship\/assets\/icon\.png$/m);

    let status = entry.status();
    assert.ok(status.supported && !status.installed);
    status = entry.install();
    assert.ok(status.supported && status.installed && !status.stale);
    assert.equal(fs.readFileSync(path.join(home, 'applications', 'flagship.desktop'), 'utf8'), text);

    // Moving the folder makes the old shortcut stale.
    const moved = new DesktopEntry('/elsewhere/flagship', '/elsewhere/flagship/node_modules/electron/dist/electron');
    const movedStatus = moved.status();
    assert.ok(movedStatus.supported && movedStatus.stale);

    status = entry.remove();
    assert.ok(status.supported && !status.installed);
  } finally {
    if (old === undefined) delete process.env.XDG_DATA_HOME; else process.env.XDG_DATA_HOME = old;
  }
});

test('app menu: special characters in paths are escaped', () => {
  const entry = new DesktopEntry('/tmp/we"ird$path', '/usr/bin/electron');
  assert.match(entry.linuxEntry(), /Exec="\/usr\/bin\/electron" "\/tmp\/we\\"ird\\\$path"/);
});
