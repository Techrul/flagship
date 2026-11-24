// Dev-only: FLAGSHIP_SMOKE=<dir> npm start  -> imports a fixture game, clicks through the main flows,
// saves screenshots into <dir>, then quits.
import type { BrowserWindow } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Library } from './library';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runSmokeTest(ctx: {
  library: Library;
  libraryWindow: BrowserWindow;
  openPlayer: (id: string) => BrowserWindow;
  outDir: string;
}): Promise<void> {
  const win = ctx.libraryWindow;
  const shot = async (target: BrowserWindow, name: string) =>
    fs.writeFileSync(path.join(ctx.outDir, `${name}.png`), (await target.webContents.capturePage()).toPNG());
  const js = (code: string) => win.webContents.executeJavaScript(code);
  const log = (...args: unknown[]) => console.log('[smoke]', ...args);

  const fixture = process.env.FLAGSHIP_FIXTURE;
  if (fixture) {
    const thumb = process.env.FLAGSHIP_FIXTURE_THUMB;
    ctx.library.add(
      { id: '104', title: 'Spinny Test Cat', author: 'flagship-dev', instructions: 'Press the flag!', description: '' },
      { data: fs.readFileSync(fixture), type: 'sb3' },
      thumb ? fs.readFileSync(thumb) : null,
    );
  }
  win.webContents.reload();
  await wait(2000);
  await shot(win, 'library');
  log('add-game profiles:', await js(`[...document.querySelectorAll('#add-profile option')].map(o => o.textContent).join(' | ')`));

  // Settings: gear position must not move when the page gets a scrollbar.
  const gearX = () => js(`document.getElementById('nav-settings').getBoundingClientRect().x`);
  const before = await gearX();
  await js(`document.getElementById('nav-settings').click()`);
  await wait(800);
  log('gear x before/after opening settings:', before, await gearX());
  await shot(win, 'settings-appearance');

  // Profiles: duplicate Enhanced into a custom profile, rename it, turn on turbo.
  await js(`document.getElementById('profiles').scrollIntoView()`);
  await wait(300);
  await shot(win, 'settings-profiles-enhanced');
  await js(`document.getElementById('profile-duplicate').click()`);
  await wait(600);
  await js(`(() => { const n = document.getElementById('profile-name'); n.value = 'Speedy'; n.dispatchEvent(new Event('change')); })()`);
  await wait(400);
  await js(`(() => { const t = document.getElementById('profile-form-turbo'); t.checked = true; t.dispatchEvent(new Event('change')); })()`);
  await wait(400);
  await js(`document.getElementById('profiles').scrollIntoView()`);
  await wait(300);
  await shot(win, 'settings-profiles-custom');
  log('tabs:', await js(`[...document.querySelectorAll('.profile-tab')].map(t => t.textContent).join(' | ')`));

  // Close button returns to the library.
  await js(`document.getElementById('settings-close').click()`);
  await wait(400);
  log('library visible after Close:', await js(`!document.getElementById('library-view').hidden`));
  log('add-game profiles now:', await js(`[...document.querySelectorAll('#add-profile option')].map(o => o.textContent).join(' | ')`));

  // Per-game: switch the game to Vanilla, then one tweak on top.
  await js(`document.querySelector('.card-menu').click()`);
  await js(`document.querySelector('[data-action="settings"]').click()`);
  await wait(500);
  await js(`(() => { const s = document.getElementById('game-profile'); s.value = 'vanilla'; s.dispatchEvent(new Event('change')); })()`);
  await wait(400);
  await js(`(() => { const t = document.getElementById('game-settings-form-interpolation'); t.checked = true; t.dispatchEvent(new Event('change')); })()`);
  await wait(500);
  await shot(win, 'game-settings');
  const game = ctx.library.get('104')!;
  log('game config:', game.profile, JSON.stringify(game.settings));
  await js(`document.getElementById('game-settings-close').click()`);
  await wait(500);
  await shot(win, 'library-after');
  log('card badge:', await js(`document.querySelector('.card-badge').textContent`));

  // Deep Sea theme
  await js(`document.getElementById('nav-settings').click()`);
  await wait(500);
  await js(`[...document.querySelectorAll('.theme-card')].find(c => c.textContent.includes('Deep Sea')).click()`);
  await wait(600);
  await js(`window.scrollTo(0, 0)`);
  await wait(200);
  await shot(win, 'theme-deep-sea');
  await js(`document.getElementById('about').scrollIntoView()`);
  await wait(300);
  await shot(win, 'settings-about');
  log('update status:', await js(`document.getElementById('update-status').textContent`));

  // Player gets Vanilla + interpolation
  const player = ctx.openPlayer('104');
  await wait(4000);
  await player.webContents.executeJavaScript(`document.querySelector('.click-to-play')?.click()`);
  await wait(2000);
  await shot(player, 'player');
  log('player:', await player.webContents.executeJavaScript(`window.__flagshipState`),
    JSON.stringify(await player.webContents.executeJavaScript(
      `(() => { const s = window.__flagshipSettings; return { interpolation: s.interpolation, highQualityPen: s.highQualityPen, turbo: s.turbo }; })()`)));
  player.close();
  await wait(500);
}
