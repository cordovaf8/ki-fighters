import { Data } from '../core/data.js';
// Cells are numbered left to right, top to bottom in the supplied roster.
const CELLS = {
  jin: [0, 8, 9, 11], sparring: [1], brakka: [5, 5],
  selune: [6, 6], vorr: [2, 7], zeta: [4, 4], draal: [10, 3, 3],
};
// Locate the solid figure rather than including the generated image's transparent margins.
function figureBounds(image) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = image.width, top = image.height, right = -1, bottom = -1;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (data[(y * image.width + x) * 4 + 3] < 200) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error('Fighter artwork is empty');
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

export function buildRosterFighter(scene, key, id, formIndex, poses) {
  const form = Data.fighters[id].forms[formIndex];
  if (form.poseSprites) return buildPoseFighter(scene, key, form, poses);
  const armor = Data.fighters[id].forms[formIndex].spriteSet;
  const cell = armor ? 0 : (form.rosterCell ?? Data.fighters[id].rosterCell ?? CELLS[id]?.[formIndex]);
  const art = scene.textures.get(armor ? `${armor}-idle` : `roster-${cell}`).getSourceImage();
  const bounds = figureBounds(art);
  const attack = scene.textures.get(armor ? `${armor}-attack` : `attack-${cell}`).getSourceImage();
  const attackBounds = figureBounds(attack);
  const block = scene.textures.get(armor ? `${armor}-block` : `block-${cell}`).getSourceImage();
  const blockBounds = figureBounds(block);
  const special = scene.textures.get(armor ? `${armor}-special` : `special-${cell}`).getSourceImage();
  const specialBounds = figureBounds(special);
  const punch = scene.textures.get(`${armor}-punch`).getSourceImage();
  const punchBounds = figureBounds(punch);
  const W = 320, H = 320;
  const tex = scene.textures.createCanvas(key, W * poses.length, H);
  const ctx = tex.context;
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min((W - 32) / bounds.width, 248 / bounds.height);
  tex.auraLayout = {
    scale,
    originX: (bounds.left + bounds.width / 2) / art.width,
    originY: (bounds.top + bounds.height) / art.height,
  };
  const attackScale = Math.min((W - 32) / attackBounds.width, 248 / attackBounds.height);
  const blockScale = Math.min((W - 32) / blockBounds.width, 248 / blockBounds.height);
  const specialScale = Math.min((W - 32) / specialBounds.width, 248 / specialBounds.height);
  const punchScale = Math.min((W - 32) / punchBounds.width, 248 / punchBounds.height);
  const extraMelee = {};
  for (const pose of ['punchBack', 'uppercut']) {
    if (!poses.includes(pose)) continue;
    const art = scene.textures.get(`${armor}-${pose}`).getSourceImage();
    const crop = figureBounds(art);
    extraMelee[pose] = { art, crop, scale: Math.min(288 / crop.width, 248 / crop.height) };
  }
  // Palm centers within the trimmed attack artwork, in roster order.
  const palms = [[.94,.30],[.95,.36],[.95,.25],[.95,.28],[.95,.38],[.95,.20],
    [.95,.26],[.95,.25],[.95,.29],[.95,.30],[.95,.28],[.95,.27]];
  const [palmX, palmY] = armor ? [.94, .27] : palms[cell];
  tex.handOffset = {
    x: attackBounds.width * attackScale * (palmX - .5),
    y: 3 + attackBounds.height * attackScale * (1 - palmY),
  };
  // Emit special blasts from the gap between the cupped hands.
  const specialPalms = [[.88,.38],[.88,.42],[.88,.37],[.88,.36],[.88,.45],[.88,.35],
    [.88,.38],[.88,.36],[.88,.39],[.88,.39],[.88,.37],[.88,.39]];
  const [specialX, specialY] = specialPalms[cell];
  tex.specialHandOffset = {
    x: specialBounds.width * specialScale * (specialX - .5),
    y: 3 + specialBounds.height * specialScale * (1 - specialY),
  };
  // Attacks and blocking use dedicated artwork; other poses retain idle art.
  const offsets = { idle1: [0, 2], shoot: [4, 0], charge: [-2, 3], beam: [5, 1],
    punch: [6, 0], hurt: [-5, 2], block: [-2, 2], power: [0, -2] };
  poses.forEach((pose, i) => {
    const firing = ['shoot', 'charge', 'beam'].includes(pose);
    const blocking = pose === 'block';
    const technique = pose === 'special' || pose === 'beam';
    const extra = extraMelee[pose];
    const melee = pose === 'punch' || !!extra;
    const source = extra ? extra.art : melee ? punch : technique ? special : blocking ? block : firing ? attack : art;
    const crop = extra ? extra.crop : melee ? punchBounds : technique ? specialBounds : blocking ? blockBounds : firing ? attackBounds : bounds;
    const size = extra ? extra.scale : melee ? punchScale : technique ? specialScale : blocking ? blockScale : firing ? attackScale : scale;
    const w = crop.width * size, h = crop.height * size;
    const [dx, dy] = melee || technique || firing || blocking ? [0, 0] : offsets[pose] || [0, 0];
    ctx.drawImage(source, crop.left, crop.top, crop.width, crop.height, i * W + (W - w) / 2 + dx, H - h - 3 + dy, w, h);
    tex.add(pose, 0, i * W, 0, W, H);
  });
  tex.refresh();
}

// Dedicated artwork for every combat state, including all base fighters.
function buildPoseFighter(scene, key, form, poses) {
  const W = 320, H = 320;
  const tex = scene.textures.createCanvas(key, W * poses.length, H);
  const ctx = tex.context;
  ctx.imageSmoothingEnabled = false;
  tex.auraScale = form.auraScale || 1;
  poses.forEach((pose, i) => {
    const sourceKey = `${form.spriteSet}-${pose}`;
    if (!scene.textures.exists(sourceKey)) throw new Error(`Missing fighter pose: ${sourceKey}`);
    const art = scene.textures.get(sourceKey).getSourceImage();
    const crop = figureBounds(art);
    const scale = Math.min(288 / crop.width, 248 / crop.height);
    const w = crop.width * scale, h = crop.height * scale;
    ctx.drawImage(art, crop.left, crop.top, crop.width, crop.height,
      i * W + (W - w) / 2, H - h - 3, w, h);
    tex.add(pose, 0, i * W, 0, W, H);
    if (pose === 'idle0') {
      // Keep the aura's original alignment independently of the new pose crops.
      if (form.auraStyle === 'jin-storm') {
        const reference = scene.textures.get('jin-armor-01-idle').getSourceImage();
        const bounds = figureBounds(reference);
        tex.auraLayout = {
          scale: Math.min(288 / bounds.width, 248 / bounds.height),
          originX: (bounds.left + bounds.width / 2) / reference.width,
          originY: (bounds.top + bounds.height) / reference.height,
        };
      } else tex.auraLayout = { scale: 248 / 315, originX: .5, originY: .96 };
    }
    if (pose === 'shoot') tex.handOffset = { x: w * .44, y: 3 + h * .71 };
    if (pose === 'special') tex.specialHandOffset = { x: w * .38, y: 3 + h * .62 };
  });
  tex.refresh();
}
