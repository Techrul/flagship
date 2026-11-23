// Dev-only: FLAGSHIP_SMOKE=<dir> npm start  -> imports a fixture game, screenshots the
// library and the running player into <dir>, then quits. Used to check the build without clicking.
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
  const fixture = process.env.FLAGSHIP_FIXTURE;
  if (fixture) {
    const thumb = process.env.FLAGSHIP_FIXTURE_THUMB;
    ctx.library.add(
      { id: '104', title: 'Spinny Test Cat', author: 'flagship-dev', instructions: 'Press the flag!', description: '' },
      { data: fs.readFileSync(fixture), type: 'sb3' },
      thumb ? fs.readFileSync(thumb) : null,
    );
  }
  ctx.libraryWindow.webContents.reload();
  await wait(2500);
  fs.writeFileSync(path.join(ctx.outDir, 'library.png'), (await ctx.libraryWindow.webContents.capturePage()).toPNG());

  if (ctx.library.has('104')) {
    const player = ctx.openPlayer('104');
    player.webContents.on('console-message', (event: any) => {
      console.log('[player]', event.message ?? event);
    });
    await wait(4000);
    await player.webContents.executeJavaScript(`document.querySelector('.click-to-play')?.click()`);
    await wait(2500);
    fs.writeFileSync(path.join(ctx.outDir, 'player.png'), (await player.webContents.capturePage()).toPNG());
    const state = await player.webContents.executeJavaScript(`window.__flagshipState || 'unknown'`);
    console.log('[smoke] player state:', state);
    player.close();
    await wait(500);
    console.log('[smoke] playtime recorded:', ctx.library.get('104')?.playtimeSeconds);
  }
}
