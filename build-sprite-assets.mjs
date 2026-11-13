import sharp from 'sharp';

// Keep source artwork intact. Embed smaller copies for fast offline loading.
export const spriteAssets = {
  name: 'sprite-assets',
  setup(build) {
    build.onLoad({ filter: /\.png$/ }, async ({ path }) => ({
      contents: 'data:image/webp;base64,' + (await sharp(path)
        .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true, kernel: 'nearest' })
        .webp({ lossless: true, effort: 4 })
        .toBuffer()).toString('base64'),
      loader: 'text',
    }));
  },
};
