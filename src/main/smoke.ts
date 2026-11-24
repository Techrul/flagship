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
  log('menu before:', await js(`document.getElementById('menu-status').textContent`));
  await js(`document.getElementById('menu-add').click()`);
  await wait(600);
  log('menu after:', await js(`document.getElementById('menu-status').textContent`));
  await shot(win, 'settings-about');

  // Card hover: move the real mouse over the first card's art.
  await js(`document.getElementById('nav-library').click()`);
  await wait(300);
  const box = await js(`(() => { const r = document.querySelector('.card-art').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(box.x), y: Math.round(box.y) });
  await wait(500);
  await shot(win, 'card-hover');
  log('card triangle offset inside circle [x, y] px:', await js(`(() => {
    const c = document.querySelector('.card-play').getBoundingClientRect();
    const t = document.querySelector('.card-play path').getBoundingClientRect();
    return [+(t.x + t.width / 2 - (c.x + c.width / 2)).toFixed(1), +(t.y + t.height / 2 - (c.y + c.height / 2)).toFixed(1)];
  })()`));

  // Player on Enhanced (pause button on): click-to-play screen, then pause/resume.
  ctx.library.setConfig('104', { profile: 'enhanced', overrides: {} });
  const player = ctx.openPlayer('104');
  const pjs = (code: string) => player.webContents.executeJavaScript(code);
  for (let i = 0; i < 60 && (await pjs(`window.__flagshipState || ''`)) !== 'ready'; i++) await wait(250);
  await wait(1500); // let the software renderer catch up before the screenshot
  log('loading spinner hidden on click-to-play screen:', await pjs(`getComputedStyle(document.getElementById('loading')).display === 'none'`));
  await shot(player, 'player-click-to-play');
  const centerOff = (sel: string) => pjs(`(() => {
    const a = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();
    const b = document.getElementById('stage-wrap').getBoundingClientRect();
    return [Math.round(a.x + a.width / 2 - (b.x + b.width / 2)), Math.round(a.y + a.height / 2 - (b.y + b.height / 2))];
  })()`);
  log('play circle offset from stage center [x, y] px:', await centerOff('.play-circle'));
  log('player triangle offset inside circle [x, y] px:', await pjs(`(() => {
    const c = document.querySelector('.play-circle').getBoundingClientRect();
    const t = document.querySelector('.play-circle path').getBoundingClientRect();
    return [+(t.x + t.width / 2 - (c.x + c.width / 2)).toFixed(1), +(t.y + t.height / 2 - (c.y + c.height / 2)).toFixed(1)];
  })()`));
  await pjs(`document.querySelector('.click-to-play').click()`);
  await wait(1500);
  log('pause button visible:', await pjs(`!document.getElementById('pause').hidden`), 'state:', await pjs(`window.__flagshipState`));
  const dir = () => pjs(`window.__flagshipVm.runtime.targets.find(t => !t.isStage).direction`);
  await pjs(`document.getElementById('pause').click()`);
  await wait(400);
  log('after pause:', await pjs(`window.__flagshipState`), '| vm.isPaused():', await pjs(`window.__flagshipVm.isPaused()`));
  await shot(player, 'player-paused');
  log('resume button offset from stage center [x, y] px:', await centerOff('#resume'));
  const d1 = await dir();
  await wait(800);
  const d2 = await dir();
  log('sprite direction while paused (must match):', d1, d2);
  await pjs(`document.getElementById('resume').click()`);
  await wait(400);
  log('after resume:', await pjs(`window.__flagshipState`), 'panel hidden:', await pjs(`document.getElementById('paused').hidden`));
  const d3 = await dir();
  await wait(500);
  log('sprite direction after resume (must change):', d3, await dir());
  await pjs(`document.getElementById('pause').click()`);
  await wait(300);
  await pjs(`document.getElementById('flag').click()`);
  await wait(400);
  log('green flag while paused ->', await pjs(`window.__flagshipState`));
  await shot(player, 'player-running');
  player.close();
  await wait(500);
}
