// Procedural pixel art. Every fighter, aura, and Ki blast is drawn in code onto
// canvas textures, so the game ships without any image files.
import { buildRosterFighter } from './RosterSprites.js';
import { Data } from '../core/data.js';
import { buildProjectileTextures } from './ProjectileStyles.js';

export const FRAME_W = 48;
export const FRAME_H = 64;
export const POSES = ['idle0', 'idle1', 'shoot', 'charge', 'beam', 'punch', 'hurt', 'block', 'power', 'special', 'punchBack', 'uppercut'];
const OUTLINE = '#15101c';

const colorCache = new Map();
function rgb(hex) {
  let c = colorCache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    colorCache.set(hex, c);
  }
  return c;
}

export function shade(hex, f) {
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return '#' + rgb(hex).map((v) => cl(v).toString(16).padStart(2, '0')).join('');
}

export function hexInt(hex) {
  return parseInt(hex.slice(1), 16);
}

/** A tiny pixel buffer with hard-edged drawing primitives (no anti-aliasing). */
class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, hex, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    const c = rgb(hex);
    this.d[i] = c[0];
    this.d[i + 1] = c[1];
    this.d[i + 2] = c[2];
    this.d[i + 3] = a;
  }
  alpha(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.d[(y * this.w + x) * 4 + 3];
  }
  rect(x, y, w, h, hex, a = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, hex, a);
  }
  line(x0, y0, x1, y1, t, hex) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    const o = Math.floor(t / 2);
    for (let i = 0; i <= n; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / n);
      const y = Math.round(y0 + ((y1 - y0) * i) / n);
      this.rect(x - o, y - o, t, t, hex);
    }
  }
  ellipse(cx, cy, rx, ry, hex, a = 255) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, hex, a);
      }
    }
  }
  poly(pts, hex, a = 255) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yy = y + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = pts[(i + 1) % pts.length];
        if ((p[1] <= yy && q[1] > yy) || (q[1] <= yy && p[1] > yy)) {
          xs.push(p[0] + ((yy - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
        }
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, hex, a);
      }
    }
  }
  outline(hex) {
    const marks = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alpha(x, y) > 0) continue;
        if (this.alpha(x - 1, y) > 200 || this.alpha(x + 1, y) > 200 || this.alpha(x, y - 1) > 200 || this.alpha(x, y + 1) > 200) {
          marks.push(x, y);
        }
      }
    }
    for (let i = 0; i < marks.length; i += 2) this.set(marks[i], marks[i + 1], hex);
  }
  blit(ctx, ox, oy) {
    ctx.putImageData(new ImageData(this.d, this.w, this.h), ox, oy);
  }
}

// Joint positions for each pose. All art faces right; enemies are flipped.
// fh/bh = front/back hand, ff/bf = front/back foot.
const POSE = {
  idle0: { dy: 0, lean: 0, fh: [37, 32], bh: [26, 33], ff: [31, 61], bf: [17, 61] },
  idle1: { dy: 1, lean: 0, fh: [37, 33], bh: [26, 34], ff: [31, 61], bf: [17, 61] },
  shoot: { dy: 0, lean: 1, fh: [45, 29], bh: [17, 37], ff: [32, 61], bf: [15, 61] },
  charge: { dy: 3, lean: -1, fh: [20, 38], bh: [13, 37], ff: [33, 61], bf: [13, 61] },
  beam: { dy: 2, lean: 2, fh: [45, 31], bh: [44, 34], ff: [35, 61], bf: [11, 61] },
  punch: { dy: 1, lean: 3, fh: [46, 28], bh: [19, 34], ff: [37, 61], bf: [10, 61] },
  hurt: { dy: 1, lean: -3, fh: [32, 23], bh: [9, 26], ff: [30, 61], bf: [14, 61], hurt: true },
  block: { dy: 1, lean: 0, fh: [34, 20], bh: [36, 26], ff: [32, 61], bf: [15, 61] },
  power: { dy: 1, lean: 0, fh: [41, 39], bh: [8, 39], ff: [35, 61], bf: [12, 61], up: true },
};

function limb(p, a, b, bend, t, c1, c2) {
  const mx = (a[0] + b[0]) / 2 + bend[0];
  const my = (a[1] + b[1]) / 2 + bend[1];
  p.line(a[0], a[1], mx, my, t, c1);
  p.line(mx, my, b[0], b[1], t, c2);
}

function arm(p, shoulder, hand, upper, lower, fist) {
  const d = Math.hypot(hand[0] - shoulder[0], hand[1] - shoulder[1]);
  limb(p, shoulder, hand, d > 15 ? [0, 0] : [-2, 4], 5, upper, lower);
  p.rect(hand[0] - 3, hand[1] - 3, 6, 6, fist);
}

function leg(p, hip, foot, cloth, boot) {
  const knee = [(hip[0] + foot[0]) / 2 + 2, (hip[1] + foot[1]) / 2 - 1];
  p.line(hip[0], hip[1], knee[0], knee[1], 6, cloth);
  p.line(knee[0], knee[1], foot[0], foot[1] - 5, 6, cloth);
  p.rect(foot[0] - 3, foot[1] - 6, 6, 4, boot);
  p.rect(foot[0] - 3, foot[1] - 2, 9, 3, boot);
}

function hair(p, look, hx, hy) {
  const c = look.hair;
  const dark = shade(c, 0.75);
  switch (look.hairStyle) {
    case 'spiky':
      p.rect(hx - 1, hy - 2, 13, 5, c);
      p.rect(hx - 1, hy + 3, 4, 6, dark);
      p.poly([[hx - 1, hy + 1], [hx - 5, hy - 5], [hx + 4, hy - 2]], c);
      p.poly([[hx + 1, hy - 1], [hx + 2, hy - 9], [hx + 7, hy - 2]], c);
      p.poly([[hx + 5, hy - 1], [hx + 9, hy - 8], [hx + 11, hy - 1]], c);
      p.poly([[hx + 9, hy - 1], [hx + 16, hy - 4], [hx + 12, hy + 3]], c);
      p.poly([[hx - 1, hy + 4], [hx - 6, hy + 2], [hx - 1, hy + 9]], dark);
      break;
    case 'long':
      p.rect(hx - 1, hy - 2, 14, 5, c);
      p.rect(hx - 3, hy + 1, 6, 20, c);
      p.rect(hx - 4, hy + 12, 3, 12, dark);
      p.poly([[hx - 3, hy + 20], [hx + 3, hy + 20], [hx - 2, hy + 27]], c);
      p.rect(hx + 8, hy + 1, 5, 2, c);
      break;
    case 'fin':
      p.rect(hx, hy - 1, 12, 3, shade(look.skin, 0.8));
      p.poly([[hx, hy], [hx + 3, hy - 9], [hx + 11, hy]], c);
      p.poly([[hx + 2, hy], [hx + 4, hy - 6], [hx + 8, hy]], shade(c, 1.15));
      break;
    case 'helmet':
      p.rect(hx - 1, hy - 2, 15, 7, c);
      p.rect(hx, hy - 3, 12, 2, c);
      p.rect(hx - 1, hy + 5, 5, 7, c);
      p.rect(hx + 3, hy - 7, 1, 5, c);
      p.rect(hx + 2, hy - 8, 3, 2, look.visor || '#5af0ff');
      p.rect(hx + 6, hy + 4, 8, 3, look.visor || '#5af0ff');
      break;
    case 'horns':
      p.rect(hx - 1, hy - 2, 14, 5, c);
      p.rect(hx - 3, hy + 1, 5, 18, c);
      p.rect(hx - 4, hy + 10, 3, 12, dark);
      p.poly([[hx + 1, hy - 1], [hx - 3, hy - 10], [hx + 5, hy - 2]], look.horn || '#e8d9b0');
      p.poly([[hx + 7, hy - 1], [hx + 13, hy - 10], [hx + 11, hy]], look.horn || '#e8d9b0');
      break;
    default: // bald
      p.rect(hx + 2, hy, 8, 1, shade(look.skin, 1.12));
  }
}

function drawFighter(p, look, poseName) {
  const P = POSE[poseName];
  const dy = P.dy;
  const lx = P.lean;
  const hl = Math.round(lx / 2);
  const skin = look.skin;
  const skinD = shade(skin, 0.78);
  const gi = look.gi;
  const giD = look.giDark || shade(gi, 0.7);
  const pants = look.pants || gi;
  const boots = look.boots;
  const sleeveF = look.sleeves ? gi : skin;
  const sleeveB = look.sleeves ? giD : skinD;
  const ty = 24 + dy;

  if (look.cape) {
    p.poly([[15 + lx, ty], [22 + lx, ty], [15, 56], [5, 58]], look.cape);
    p.poly([[15 + lx, ty], [18 + lx, ty], [9, 57], [5, 58]], shade(look.cape, 0.7));
  }

  // Back limbs first so the torso overlaps them.
  arm(p, [18 + lx, ty + 3], P.bh, sleeveB, skinD, skinD);
  leg(p, [20, 43], P.bf, shade(pants, 0.72), shade(boots, 0.8));
  leg(p, [27, 43], P.ff, pants, boots);

  // Torso: chest follows the lean, waist follows it by half.
  p.rect(17 + lx, ty, 14, 10, gi);
  p.rect(17 + hl, ty + 10, 14, 44 - ty - 10, gi);
  p.rect(17 + lx, ty, 3, 10, giD);
  p.rect(17 + hl, ty + 10, 3, 44 - ty - 10, giD);
  if (look.armor) {
    p.rect(16 + lx, ty, 16, 4, look.armor);
    p.rect(21 + lx, ty + 4, 9, 5, shade(look.armor, 0.82));
    p.rect(22 + lx, ty + 5, 3, 2, look.trim);
  } else {
    p.poly([[23 + lx, ty], [30 + lx, ty], [27 + lx, ty + 6]], skin);
    p.line(22 + lx, ty, 26 + lx, ty + 6, 1, giD);
  }
  p.rect(17 + hl, 39, 14, 3, look.trim);
  p.rect(20 + hl, 42, 2, 5, look.trim);

  // Neck and head.
  p.rect(22 + lx, ty - 2, 5, 3, skinD);
  const hx = 18 + Math.round(lx * 1.4);
  const hy = 10 + dy - (P.up ? 1 : 0);
  p.rect(hx, hy + 1, 13, 11, skin);
  p.rect(hx + 1, hy, 11, 13, skin);
  p.rect(hx + 1, hy + 11, 6, 2, skinD);
  p.rect(hx + 2, hy + 6, 2, 3, skinD);
  const eye = look.eye || '#1a1420';
  if (look.hairStyle !== 'helmet') {
    if (P.hurt) {
      p.rect(hx + 8, hy + 6, 4, 1, '#1a1420');
      p.rect(hx + 9, hy + 9, 3, 2, '#3a1418');
    } else {
      p.rect(hx + 9, hy + 5, 2, 3, eye);
      p.rect(hx + 8, hy + 3, 4, 1, '#1a1420');
      p.set(hx + 7, hy + 2, '#1a1420');
      p.rect(hx + 9, hy + 10, 3, 1, shade(skin, 0.6));
    }
  } else {
    p.rect(hx + 9, hy + 10, 3, 1, shade(skin, 0.6));
  }
  hair(p, look, hx, hy);

  // Front arm on top.
  arm(p, [30 + lx, ty + 3], P.fh, sleeveF, skin, skin);
  if (look.trim) p.rect(P.fh[0] - 3, P.fh[1] + 2, 6, 1, look.trim);
  if (look.armor) p.rect(27 + lx, ty, 6, 4, shade(look.armor, 1.15));
}

function buildFighterTexture(scene, key, look) {
  const tex = scene.textures.createCanvas(key, FRAME_W * POSES.length, FRAME_H);
  POSES.forEach((pose, i) => {
    const p = new Pix(FRAME_W, FRAME_H);
    drawFighter(p, look, pose);
    p.outline(OUTLINE);
    p.blit(tex.context, i * FRAME_W, 0);
    tex.add(pose, 0, i * FRAME_W, 0, FRAME_W, FRAME_H);
  });
  tex.refresh();
}

function buildAuraTexture(scene) {
  const W = 56;
  const H = 80;
  const tex = scene.textures.createCanvas('aura', W * 3, H);
  [0, 3, -3].forEach((j, f) => {
    const p = new Pix(W, H);
    const outer = [
      [8, 79], [2, 58 + j], [9, 45], [4, 27 - j], [14, 35], [16, 9 + j], [24, 27],
      [28, 1 + f * 2], [33, 25], [41, 7 - j], [42, 33], [52, 25 + j], [47, 46], [54, 60 - j], [48, 79],
    ];
    const inner = outer.map(([x, y]) => [28 + (x - 28) * 0.62, 79 + (y - 79) * 0.7]);
    p.poly(outer, '#ffffff', 80);
    p.poly(inner, '#ffffff', 150);
    p.blit(tex.context, f * W, 0);
    tex.add(f, 0, f * W, 0, W, H);
  });
  tex.refresh();
}

function buildBlastTexture(scene, key, kiHex) {
  const tex = scene.textures.createCanvas(key, 16, 16);
  const p = new Pix(16, 16);
  p.ellipse(8, 8, 8, 8, kiHex, 110);
  p.ellipse(8, 8, 6, 6, kiHex, 255);
  p.ellipse(8, 8, 4, 4, shade(kiHex, 1.3), 255);
  p.ellipse(8, 8, 2, 2, '#ffffff', 255);
  p.blit(tex.context, 0, 0);
  tex.refresh();
}

export function fighterTextureKey(id, formIndex) {
  return `f_${id}_${formIndex}`;
}

/** Builds every texture the game needs. Called once from the boot scene. */
export function buildAllTextures(scene) {
  for (const [id, def] of Object.entries(Data.fighters)) {
    def.forms.forEach((form, i) => {
      const key = fighterTextureKey(id, i);
      if (!scene.textures.exists(key)) buildRosterFighter(scene, key, id, i, POSES);
    });
    if (!scene.textures.exists(`blast_${id}`)) buildBlastTexture(scene, `blast_${id}`, def.look.ki);
    buildProjectileTextures(scene, id);
  }
  if (!scene.textures.exists('aura')) buildAuraTexture(scene);
}

function lerpColor(a, b, t) {
  const ca = rgb(a);
  const cb = rgb(b);
  return (
    (Math.round(ca[0] + (cb[0] - ca[0]) * t) << 16) |
    (Math.round(ca[1] + (cb[1] - ca[1]) * t) << 8) |
    Math.round(ca[2] + (cb[2] - ca[2]) * t)
  );
}

/** Paints the arena backdrop for a stage: banded sky, far ridges, ground. */
export function drawBackdrop(scene, stageId) {
  const st = Data.config.stages[stageId] || Data.config.stages.dojo;
  const { width, height } = Data.config.game;
  const horizon = Data.config.grid.originY - 14;
  const g = scene.add.graphics().setDepth(0);
  const bands = 14;
  for (let i = 0; i < bands; i++) {
    g.fillStyle(lerpColor(st.sky[0], st.sky[1], i / (bands - 1)), 1);
    g.fillRect(0, Math.floor((horizon * i) / bands), width, Math.ceil(horizon / bands) + 1);
  }
  g.fillStyle(hexInt(st.orb), 0.25).fillCircle(730, 96, 58);
  g.fillStyle(hexInt(st.orb), 0.95).fillCircle(730, 96, 40);

  // Deterministic jagged ridges so each stage always looks the same.
  let seed = stageId.length * 7919 + stageId.charCodeAt(0) * 131;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed % 1000) / 1000;
  };
  const ridge = (baseY, amp, step, color) => {
    const pts = [{ x: 0, y: horizon }];
    for (let x = 0; x <= width; x += step) pts.push({ x, y: baseY - Math.floor(rand() * amp) });
    pts.push({ x: width, y: horizon });
    g.fillStyle(hexInt(color), 1).fillPoints(pts, true);
  };
  ridge(horizon - 50, 70, 60, st.far);
  ridge(horizon - 16, 44, 40, st.mid);

  g.fillStyle(hexInt(st.ground), 1).fillRect(0, horizon, width, height - horizon);
  g.fillStyle(0x000000, 0.22).fillRect(0, horizon, width, 6);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(rand() * width);
    const y = horizon + 10 + Math.floor(rand() * (height - horizon - 20));
    g.fillStyle(i % 2 ? 0xffffff : 0x000000, 0.08).fillRect(x, y, 10 + Math.floor(rand() * 30), 3);
  }
  return g;
}
