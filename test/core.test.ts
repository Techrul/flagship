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
import { DEFAULT_PLAYER_SETTINGS, effectiveSettings, sanitizePlayerSettings } from '../src/shared/settings';
import { SettingsStore } from '../src/main/settings-store';
import { CustomThemes } from '../src/main/custom-themes';

test('sanitize drops unknown keys and wrong types, clamps numbers', () => {
  const clean = sanitizePlayerSettings({ turbo: 'yes', framerate: 1e9, username: 'x'.repeat(100), evil: 1, gamepad: true }, true);
  assert.deepEqual(clean, { framerate: 4096, username: 'x'.repeat(32), gamepad: true });
  assert.deepEqual(sanitizePlayerSettings(null), DEFAULT_PLAYER_SETTINGS);
});

test('per-game overrides win over defaults', () => {
  const s = effectiveSettings({ ...DEFAULT_PLAYER_SETTINGS, turbo: true }, { framerate: 60 });
  assert.equal(s.turbo, true);
  assert.equal(s.framerate, 60);
});

test('settings store saves, merges partial updates and rejects junk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-test-'));
  const store = new SettingsStore(dir);
  store.update({ theme: 'mocha', player: { turbo: true } });
  store.update({ player: { framerate: 60 }, accent: '#ABCDEF' });
  store.update({ theme: '../../etc/passwd', accent: 'red' });
  const reloaded = new SettingsStore(dir).get();
  assert.equal(reloaded.theme, 'mocha');
  assert.equal(reloaded.accent, '#abcdef');
  assert.equal(reloaded.player.turbo, true);
  assert.equal(reloaded.player.framerate, 60);
  store.update({ accent: null });
  assert.equal(new SettingsStore(dir).get().accent, null);
});

test('library migrates games saved before settings existed', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-test-'));
  fs.writeFileSync(path.join(root, 'library.json'), JSON.stringify({ version: 1, games: [{ ...meta, projectFile: 'project.sb3', hasThumbnail: false, addedAt: 'x', lastPlayedAt: null, playtimeSeconds: 0, notes: '' }] }));
  const game = new Library(root).get('104')!;
  assert.deepEqual(game.settings, {});
});

test('per-game settings persist and survive re-download', () => {
  const lib = tempLibrary();
  lib.add(meta, project, null);
  lib.setSettings('104', { turbo: true, bogus: 5 });
  lib.add(meta, project, null);
  assert.deepEqual(new Library(lib.root).get('104')!.settings, { turbo: true });
});

test('custom themes: example created, names parsed, paths locked to the folder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagship-themes-'));
  const themes = new CustomThemes(dir);
  fs.writeFileSync(path.join(dir, 'neon.css'), '/* name: Neon Dreams */ :root { --accent: #f0f; }');
  const list = themes.list();
  assert.deepEqual(list.map((t) => t.name), ['Example (edit me!)', 'Neon Dreams']);
  assert.equal(themes.resolve('../settings.json'), null);
  assert.equal(themes.resolve('missing.css'), null);
  assert.ok(themes.resolve('neon.css'));
});
