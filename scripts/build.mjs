// Builds everything into dist/. Run with `npm run build`.
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dev = process.argv.includes('--dev');
rmSync('dist', { recursive: true, force: true });

const common = { bundle: true, sourcemap: dev, minify: !dev, logLevel: 'info' };

// Main process + preload (Node side)
await esbuild.build({
  ...common,
  entryPoints: { main: 'src/main/main.ts', preload: 'src/main/preload.ts' },
  outdir: 'dist/main',
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
});

// UI scripts (browser side)
await esbuild.build({
  ...common,
  entryPoints: {
    'library/library': 'src/renderer/library/library.ts',
    'player/player': 'src/renderer/player/player.ts',
  },
  outdir: 'dist/renderer',
  platform: 'browser',
  format: 'iife',
  target: 'chrome130',
});

// Static files: HTML, CSS
cpSync('src/renderer', 'dist/renderer', {
  recursive: true,
  filter: (src) => !src.endsWith('.ts'),
});

// TurboWarp's player (Scaffolding) + its addons, pinned by package-lock.json
const scaffoldingDir = dirname(require.resolve('@turbowarp/packager/dist/scaffolding/scaffolding-min.js'));
mkdirSync('dist/renderer/player/vendor', { recursive: true });
for (const file of ['scaffolding-min.js', 'scaffolding-min.js.LICENSE.txt', 'addons.js']) {
  cpSync(join(scaffoldingDir, file), join('dist/renderer/player/vendor', file));
}
