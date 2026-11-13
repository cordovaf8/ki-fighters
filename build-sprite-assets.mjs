import sharp from 'sharp';
import { statSync } from 'node:fs';

// Keep source artwork intact. Embed smaller copies for fast offline loading.
//
// Colour is stored as high-quality lossy WebP (quality 92), which looks the
// same as the source at game size and roughly halves game.js. Transparency is
// kept lossless (alphaQuality 100) because sprite placement and blast origins
// are measured from each sprite's transparent outline.
// (effort 6 is ~45x slower to build for only ~4% smaller files.)
const WEBP = { quality: 92, alphaQuality: 100, smartSubsample: true, effort: 4 };

// Encoded copies are reused while a PNG is unchanged, so watch rebuilds stay fast.
const cache = new Map();

export const spriteAssets = {
  name: 'sprite-assets',
  setup(build) {
    build.onLoad({ filter: /\.png$/ }, async ({ path }) => {
      const stamp = statSync(path).mtimeMs;
      const hit = cache.get(path);
      if (hit && hit.stamp === stamp) return { contents: hit.contents, loader: 'text' };
      const contents = 'data:image/webp;base64,' + (await sharp(path)
        .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true, kernel: 'nearest' })
        .webp(WEBP)
        .toBuffer()).toString('base64');
      cache.set(path, { stamp, contents });
      return { contents, loader: 'text' };
    });
  },
};
