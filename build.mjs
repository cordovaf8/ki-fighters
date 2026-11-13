// Bundles the game (source modules, JSON data and Phaser) into one classic
// script, game.js, which index.html loads with a plain <script> tag. Browsers
// allow that from file://, so the game opens with a double-click: no server.
//
//   npm run build    build once
//   npm run watch    rebuild on every save while editing
import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';
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
