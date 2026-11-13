// Bundles the game (source modules, JSON data and Phaser) into one classic
// script, game.js, which index.html loads with a plain <script> tag. Browsers
// allow that from file://, so the game opens with a double-click: no server.
//
//   npm run build    build once
//   npm run watch    rebuild on every save while editing
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spriteAssets } from './build-sprite-assets.mjs';

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: ['src/main.js'],
  outfile: 'game.js',
  bundle: true,
  loader: { '.png': 'dataurl' },
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
  alias: { phaser: './vendor/phaser.esm.min.js' },
  banner: { js: '/* Ki Legends - built by build.mjs from src/. Edit src/, then run: npm run build */' },
  logLevel: 'info',
  // Phaser's own bundled code has a few duplicate keys; they are harmless.
  logOverride: { 'duplicate-object-key': 'silent' },
  plugins: [
    spriteAssets,
    {
      name: 'report',
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length) return;
          const kb = (readFileSync('game.js').length / 1024).toFixed(0);
          // Keep both loading paths and the stylesheet on the same build revision.
          const revision = createHash('sha256').update(readFileSync('game.js'))
            .update(readFileSync('css/style.css')).digest('hex').slice(0, 12);
          const page = readFileSync('index.html', 'utf8')
            .replace(/css\/style\.css(?:\?v=[a-f0-9]+)?/g, `css/style.css?v=${revision}`)
            .replace(/'game\.js(?:\?v=[a-f0-9]+)?'/g, `'game.js?v=${revision}'`);
          writeFileSync('index.html', page);
          console.log(`game.js ready (${kb} KB) - open index.html in a browser to play.`);
        });
      },
    },
  ],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('Watching src/ for changes...');
} else {
  await esbuild.build(options);
}
