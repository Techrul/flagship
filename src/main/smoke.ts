// Dev-only: FLAGSHIP_SMOKE=<dir> npm start  -> imports a fixture game, screenshots the library,
// settings, per-game settings and the running player into <dir>, then quits.
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

  // Settings page, scrolled to the top and to the game defaults.
  await js(`document.getElementById('nav-settings').click()`);
  await wait(800);
  await shot(win, 'settings-appearance');
  await js(`document.getElementById('game-defaults').scrollIntoView()`);
  await wait(300);
  await shot(win, 'settings-defaults');

  // Switch theme through the real UI and check it applied.
  await js(`[...document.querySelectorAll('.theme-card')].find(c => c.textContent.includes('Tokyo Night')).click()`);
  await wait(500);
  console.log('[smoke] theme after click:', await js(`document.documentElement.dataset.theme`));
  await js(`document.getElementById('appearance').scrollIntoView()`);
  await wait(300);
  await shot(win, 'settings-tokyo');
  await js(`[...document.querySelectorAll('.theme-card')].find(c => c.textContent.includes('OLED')).click()`);
  await wait(300);

  // Per-game settings: override framerate + username + controller through the dialog.
  await js(`document.getElementById('nav-library').click()`);
  await wait(300);
  await js(`document.querySelector('.card-menu').click()`);
  await js(`document.querySelector('[data-action="settings"]').click()`);
  await wait(500);
  await js(`(() => {
    const set = (id, v) => { const el = document.getElementById(id); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('change')); };
    set('game-settings-form-framerate', '60');
  })()`);
  await wait(300);
  await js(`(() => { const el = document.getElementById('game-settings-form-username'); el.value = 'Techrul'; el.dispatchEvent(new Event('change')); })()`);
  await wait(300);
  await js(`(() => { const el = document.getElementById('game-settings-form-gamepad'); el.checked = true; el.dispatchEvent(new Event('change')); })()`);
  await wait(500);
  await shot(win, 'game-settings');
  console.log('[smoke] stored overrides:', JSON.stringify(ctx.library.get('104')?.settings));
  await js(`document.getElementById('game-settings-close').click()`);
  await wait(500);
  await shot(win, 'library-after');

  if (ctx.library.has('104')) {
    const player = ctx.openPlayer('104');
    player.webContents.on('console-message', (event: any) => {
      if (event.level === 'error' || event.level === 3) console.log('[player]', event.message ?? event);
    });
    await wait(4000);
    await player.webContents.executeJavaScript(`document.querySelector('.click-to-play')?.click()`);
    await wait(2500);
    await shot(player, 'player');
    console.log('[smoke] player state:', await player.webContents.executeJavaScript(`window.__flagshipState || 'unknown'`));
    console.log('[smoke] player settings:', JSON.stringify(await player.webContents.executeJavaScript(
      `(() => { const s = window.__flagshipSettings; return s && { framerate: s.framerate, username: s.username, gamepad: s.gamepad }; })()`)));
    console.log('[smoke] vm framerate:', await player.webContents.executeJavaScript(
      `document.querySelector('.sc-root') ? 'scaffolding mounted' : 'no scaffolding'`));

    // Live update: change the global default turbo while the game runs.
    await js(`window.flagship.setGameSettings('104', { framerate: 30, username: 'LiveChange', gamepad: true })`);
    await wait(600);
    console.log('[smoke] live username:', await player.webContents.executeJavaScript(`window.__flagshipSettings.username`));
    player.close();
    await wait(500);
  }
}
