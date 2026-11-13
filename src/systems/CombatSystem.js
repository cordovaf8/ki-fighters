// CombatSystem: projectiles, beams, beam clashes, rush combos, area blasts,
// hit detection and the "threat map" the AI uses to dodge.
import Phaser from 'phaser';
import { Data, S } from '../core/data.js';
import { PROJECTILE_STYLES, projectileTexture, animateProjectile } from './ProjectileStyles.js';
import { beamColor, drawBeamTheme } from './ThemedBeams.js';

export class CombatSystem {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = [];
    this.beams = [];
    this.hazards = []; // { owner, tiles, until } - telegraphed danger zones
    this.clash = null;
    this.gfx = scene.add.graphics().setDepth(60);
  }

  // ---- Projectiles --------------------------------------------------------

  spawnProjectile(owner, o) {
    const s = this.scene;
    const targetY = s.grid.center(owner.col, o.row).y + owner.handY - owner.pos.y;
    const style = PROJECTILE_STYLES[owner.id];
    const scale = style ? (o.big ? 1.05 : o.mid ? .95 : .8) : (o.big ? 2.4 : o.mid ? 1.8 : 1.4);
    const spr = s.add.image(owner.handX, owner.handY, style ? projectileTexture(owner.id, o.big) : `blast_${owner.id}`).setScale(scale).setDepth(15 + o.row * 10);
    if (style) spr.setFlipX(owner.facing < 0);
    else spr.setBlendMode(Phaser.BlendModes.ADD);
    this.projectiles.push({
      owner, row: o.row, x: owner.handX, y: owner.handY, targetY,
      vx: owner.facing * (o.speed || Data.config.fighter.blastSpeed) * (o.big ? 0.85 : 1),
      damage: o.damage, baseDamage: o.damage, heavy: !!o.heavy, big: !!o.big, spr, alive: true,
      parryable: !!o.parryable, reflects: 0,
      style, visualScale: scale, trail: style ? s.add.graphics() : null,
    });
  }

  /** Send a parried blast back down its row at the fighter who threw it. */
  reflect(p, parrier) {
    const pc = Data.config.parry;
    p.owner = parrier;
    p.reflects++;
    const speed = Math.min(pc.maxSpeed, Math.abs(p.vx) * pc.speedMul);
    p.vx = parrier.facing * speed;
    p.damage = p.baseDamage * Math.min(pc.maxDamageMul, Math.pow(pc.damageMul, p.reflects));
    p.heavy = true; // a reflected blast always staggers
    p.x = parrier.pos.x + parrier.facing * 40; // clear of the parrier's own hitbox
    // Return the original weapon intact instead of turning a rocket into an orb.
    if (!p.style) p.spr.setTexture(`blast_${parrier.id}`);
    p.visualScale = Math.min(p.style ? 1.4 : 3, (p.visualScale || p.spr.scaleX) * 1.15);
    p.spr.setScale(p.visualScale);
    if (p.style) p.spr.setFlipX(p.vx < 0);
    p.spr.setPosition(p.x, p.y);
  }

  killProjectile(p, burst = true) {
    if (!p.alive) return;
    p.alive = false;
    p.spr.destroy();
    p.trail?.destroy();
    const color = p.style ? Number.parseInt(p.style.color.slice(1),16) : p.owner.kiColor;
    if (burst) {
      this.scene.fx.spark(p.x, p.y, color, p.big ? 9 : 4, p.big ? 50 : 26);
      if (p.style && p.big) this.scene.fx.ring(p.x, p.y, color, 8, p.style.shape === 'rocket' ? 64 : 45, 240);
    }
  }

  updateProjectiles(dt) {
    const step = dt / 1000;
    const { width } = Data.config.game;
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      const previousX = p.x;
      p.x += p.vx * step;
      p.y += Phaser.Math.Clamp(p.targetY - p.y, -600 * step, 600 * step);
      p.spr.setPosition(p.x, p.y);
      animateProjectile(p, this.scene.clock);
      const foe = p.owner.foe;
      // Sweep the travelled segment so fast blasts cannot skip a fighter.
      const crossesFoe = Math.max(previousX, p.x) >= foe.pos.x - 32 && Math.min(previousX, p.x) <= foe.pos.x + 32;
      if (foe.alive && foe.row === p.row && crossesFoe) {
        p.x = foe.pos.x - Math.sign(p.vx) * 32;
        p.spr.setPosition(p.x, p.y);
        if (foe.tryParry(p)) {
          this.reflect(p, foe);
          continue;
        }
        foe.receive({ amount: p.damage, heavy: p.heavy });
        this.killProjectile(p);
      } else if (p.x < -40 || p.x > width + 40) {
        this.killProjectile(p, false);
      }
    }
    // Opposing blasts in the same row cancel out; a big blast ploughs through small ones.
    for (const a of this.projectiles) {
      if (!a.alive || a.owner.side !== 'player') continue;
      for (const b of this.projectiles) {
        if (!b.alive || b.owner.side !== 'enemy' || a.row !== b.row || Math.abs(a.x - b.x) > 26) continue;
        if (a.big === b.big) {
          this.killProjectile(a);
          this.killProjectile(b);
        } else {
          this.killProjectile(a.big ? b : a);
        }
        if (!a.alive) break;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  // ---- Beams --------------------------------------------------------------

  beamRows(owner, mode) {
    const rows = [owner.row];
    if (mode === 'wide') {
      if (owner.row > 0) rows.unshift(owner.row - 1);
      if (owner.row < this.scene.grid.rows - 1) rows.push(owner.row + 1);
    }
    return rows;
  }

  rowTiles(rows, targetSide) {
    const g = this.scene.grid;
    const out = [];
    for (const r of rows) {
      for (let c = 0; c < g.cols; c++) if (g.tiles[c][r].baseOwner === targetSide) out.push({ col: c, row: r });
    }
    return out;
  }

  fireBeam(owner, p) {
    const s = this.scene;
    const rows = this.beamRows(owner, p.rows);
    const tiles = this.rowTiles(rows, owner.foe.side);
    const beam = {
      owner, rows, phase: 'charge', t: 0,
      chargeMs: p.chargeMs, durationMs: p.durationMs,
      damage: p.damage * owner.atkMul, crack: !!p.crack, hit: false,
      theme: p.theme || null,
      warn: s.grid.warn(tiles, p.chargeMs, 0xffe14a),
      hazard: this.addHazard(owner, tiles, p.chargeMs + p.durationMs),
    };
    owner.locked = true;
    owner.chargeStart = null;
    owner.setPose('charge');
    owner.action = { cancel: () => this.endBeam(beam, true) };
    this.beams.push(beam);
    S.audio.play('beamcharge');
    return beam;
  }

  igniteBeam(beam) {
    const s = this.scene;
    const o = beam.owner;
    beam.phase = 'fire';
    beam.t = 0;
    beam.warn.cancel();
    o.action = null;
    o.armor = true;
    o.setPose('beam');
    S.audio.play('beam');
    s.fx.shake(beam.durationMs, beam.rows.length > 1 ? 0.012 : 0.006);
  }

  endBeam(beam, cancelled = false) {
    if (beam.done) return;
    beam.done = true;
    beam.warn.cancel();
    beam.hazard.until = 0;
    const o = beam.owner;
    o.armor = false;
    o.locked = false;
    if (o.action && cancelled) o.action = null;
    if (o.pose === 'charge' || o.pose === 'beam') o.clearPose();
    if (!cancelled && beam.crack) {
      for (const r of beam.rows) {
        for (const t of this.rowTiles([r], o.foe.side)) if (Math.random() < 0.5) this.scene.grid.crack(t.col, t.row);
      }
      S.audio.play('crack');
    }
  }

  updateBeams(dt) {
    for (const b of this.beams) {
      if (b.done) continue;
      b.t += dt;
      if (b.phase === 'charge') {
        if (b.t >= b.chargeMs) {
          this.igniteBeam(b);
          const rival = this.beams.find(
            (x) => !x.done && x.owner === b.owner.foe && !x.hit && x.rows.some((r) => b.rows.includes(r))
          );
          if (rival) {
            if (rival.phase === 'charge') this.igniteBeam(rival);
            this.startClash(b, rival);
            return;
          }
        }
      } else {
        const foe = b.owner.foe;
        if (!b.hit && foe.alive && b.rows.includes(foe.row)) {
          const dealt = foe.receive({ amount: b.damage, heavy: true });
          if (dealt > 0) {
            b.hit = true;
            this.scene.fx.explosion(foe.pos.x, foe.pos.y - 60, 50, beamColor(b));
          }
        }
        if (b.t >= b.durationMs) this.endBeam(b);
      }
    }
    this.beams = this.beams.filter((b) => !b.done);
  }

  beamY(beam) {
    if (beam.theme && beam.rows.length === 1) return beam.owner.handY;
    const g = this.scene.grid;
    const ys = beam.rows.map((r) => g.center(0, r).y - 68);
    return (ys[0] + ys[ys.length - 1]) / 2;
  }

  drawBeams(time) {
    const g = this.gfx;
    const { width } = Data.config.game;
    g.clear();
    for (const b of this.beams) {
      if (b.done) continue;
      const o = b.owner;
      const x0 = o.handX;
      const color = beamColor(b);
      if (b.phase === 'charge') {
        const k = Math.min(1, b.t / b.chargeMs);
        const r = 6 + k * (14 + b.rows.length * 6) + Math.sin(time / 30) * 2;
        g.fillStyle(color, 0.45).fillCircle(x0, o.handY, r * 1.5);
        g.fillStyle(color, 0.9).fillCircle(x0, o.handY, r);
        g.fillStyle(0xffffff, 1).fillCircle(x0, o.handY, r * 0.5);
        continue;
      }
      let x1 = o.facing > 0 ? width + 20 : -20;
      let y = this.beamY(b);
      let thick = 30 + (b.rows.length - 1) * 58;
      if (this.clash && (this.clash.a === b || this.clash.b === b)) {
        x1 = this.clash.meetX;
        y = this.scene.grid.center(0, this.clash.row).y - 68;
        thick = 34;
      }
      const jitter = Math.sin(time / 24) * 3;
      const left = Math.min(x0, x1);
      const len = Math.abs(x1 - x0);
      const grow = Math.min(1, b.t / 90);
      const w = len * (this.clash ? 1 : grow);
      const start = o.facing > 0 ? left : left + (len - w);
      g.fillStyle(color, 0.3).fillRect(start, y - thick / 2 - 8 - jitter, w, thick + 16 + jitter * 2);
      g.fillStyle(color, 0.95).fillRect(start, y - thick / 2, w, thick);
      g.fillStyle(0xffffff, 0.95).fillRect(start, y - thick / 5, w, thick / 2.5);
      drawBeamTheme(g, b, time, start, w, y, thick);
      g.fillStyle(color, 0.95).fillCircle(x0, y, thick * 0.75);
      g.fillStyle(0xffffff, 1).fillCircle(x0, y, thick * 0.4);
    }
    if (this.clash) {
      const c = this.clash;
      const y = this.scene.grid.center(0, c.row).y - 68;
      const r = 34 + Math.sin(time / 28) * 8;
      g.fillStyle(0xffffff, 0.5).fillCircle(c.meetX, y, r * 1.5);
      g.fillStyle(0xffffff, 1).fillCircle(c.meetX, y, r);
    }
  }

  // ---- Beam clash ---------------------------------------------------------

  startClash(b1, b2) {
    const s = this.scene;
    const a = b1.owner.side === 'player' ? b1 : b2;
    const b = a === b1 ? b2 : b1;
    const row = a.rows.find((r) => b.rows.includes(r));
    this.clash = { a, b, row, meter: 0.5, t: 0, meetX: 0 };
    this.setMeetX();
    s.state = 'clash';
    S.audio.play('clash');
    s.fx.flash(140);
    S.ui.hud.clash(true, 0.5);
  }

  setMeetX() {
    const c = this.clash;
    c.meetX = Phaser.Math.Linear(c.a.owner.handX + 40, c.b.owner.handX - 40, c.meter);
  }

  clashPress() {
    const c = this.clash;
    if (!c) return;
    const edge = Math.sqrt(c.a.owner.atkMul / c.b.owner.atkMul);
    c.meter += Data.config.clash.pressPower * edge;
    S.audio.play('press');
    S.input.rumble(60, 0.6, 0.35);
  }

  updateClash(dt) {
    const c = this.clash;
    const cfg = Data.config.clash;
    const s = this.scene;
    c.t += dt;
    c.meter -= (s.ai.cfg.clashRate * cfg.pressPower * dt) / 1000;
    c.meter = Phaser.Math.Clamp(c.meter, 0, 1);
    this.setMeetX();
    S.ui.hud.clash(true, c.meter, 1 - c.t / cfg.durationMs);
    if (Math.random() < 0.3) s.fx.spark(c.meetX, s.grid.center(0, c.row).y - 68, 0xffffff, 2, 70);
    if (S.settings.values.shake) s.cameras.main.shake(60, 0.004);
    if (c.meter <= 0 || c.meter >= 1 || c.t >= cfg.durationMs) this.resolveClash(c.meter >= 0.5);
  }

  resolveClash(playerWins) {
    const s = this.scene;
    const c = this.clash;
    const win = playerWins ? c.a : c.b;
    const lose = playerWins ? c.b : c.a;
    this.clash = null;
    S.ui.hud.clash(false);
    this.endBeam(lose, true);
    lose.owner.invulnUntil = 0;
    lose.owner.counterUntil = 0;
    win.damage *= Data.config.clash.damageMul;
    win.hit = false;
    win.t = 0;
    win.durationMs = 520;
    s.state = 'fight';
    s.flushKeys();
    s.fx.flash(160, win.owner.kiColor);
    s.fx.popText(480, 200, playerWins ? 'CLASH WON!' : 'OVERPOWERED!', playerWins ? '#7fffd0' : '#ff7070', 30);
    S.audio.play('explode');
  }

  // ---- Melee, area and territory -----------------------------------------

  rush(f, p) {
    const s = this.scene;
    const g = s.grid;
    const foe = f.foe;
    const strikes = f.def.meleePoses || ['punch'];
    const strikePose = (i) => strikes.length > 1 && i === p.hits - 1
      ? strikes[strikes.length - 1] : strikes[i % Math.max(1, strikes.length - 1)];
    const target = { col: foe.col, row: foe.row };
    f.locked = true;
    f.chargeStart = null;
    f.setPose('idle1');
    g.warn([target], p.windupMs, 0xff8040);
    this.addHazard(f, [target], p.windupMs);

    const finish = () => {
      s.fx.afterimage(f, f.kiColor);
      const home = g.center(f.col, f.row);
      f.pos.x = home.x;
      f.pos.y = home.y;
      f.visualRow = null;
      f.locked = false;
      f.clearPose();
    };

    s.after(p.windupMs, () => {
      if (!f.alive) return;
      const hitTime = p.hits * 110;
      f.invulnUntil = Math.max(f.invulnUntil, s.clock + hitTime + 260);
      const connects = foe.alive && foe.col === target.col && foe.row === target.row;
      const spot = g.center(target.col, target.row);
      s.fx.afterimage(f, f.kiColor);
      f.pos.x = spot.x - f.facing * 58;
      f.pos.y = spot.y;
      f.visualRow = target.row;
      f.setPose(strikePose(0));
      S.audio.play('teleport');
      if (!connects) {
        s.fx.popText(spot.x, spot.y - 120, 'MISS', '#c0c0d0');
        s.after(260, finish);
        return;
      }
      if (!foe.armor) foe.hurtUntil = Math.max(foe.hurtUntil, s.clock + hitTime);
      for (let i = 0; i < p.hits; i++) {
        s.after(i * 110, () => {
          if (!f.alive || !foe.alive) return;
          if (foe.col !== target.col || foe.row !== target.row) return; // slipped away mid-combo
          const pose = strikePose(i);
          f.setPose(pose);
          s.after(55, () => {
            if (f.alive && f.locked && f.pose === pose) f.setPose('idle1');
          });
          const last = i === p.hits - 1;
          if (last) foe.invulnUntil = 0;
          foe.receive({ amount: p.damage * f.atkMul, heavy: last });
          S.audio.play('punch');
          s.fx.shake(70, 0.005);
        });
      }
      s.after(hitTime, () => {
        if (foe.alive && p.knockback) foe.shove(f.facing * p.knockback);
        if (p.finisher) {
          const fin = p.finisher;
          this.explode(f, this.areaTiles(foe.col, foe.row, fin.radius), fin.damage * f.atkMul, fin.crack, true);
        }
      });
      s.after(hitTime + 140, finish);
    });
  }

  areaTiles(cc, cr, radius) {
    const g = this.scene.grid;
    const out = [];
    for (let c = cc - radius; c <= cc + radius; c++) {
      for (let r = cr - radius; r <= cr + radius; r++) if (g.inBounds(c, r)) out.push({ col: c, row: r });
    }
    return out;
  }

  area(f, p) {
    const s = this.scene;
    const tiles = this.areaTiles(f.col + f.facing * p.ahead, f.row, p.radius);
    f.lockFor(p.delayMs * 0.7);
    f.setPose('special', p.delayMs + 180);
    s.grid.warn(tiles, p.delayMs, 0xff8040);
    this.addHazard(f, tiles, p.delayMs);
    s.after(p.delayMs, () => this.explode(f, tiles, p.damage * f.atkMul, p.crack));
  }

  explode(owner, tiles, damage, crack, ignoreInvuln = false) {
    const s = this.scene;
    const g = s.grid;
    const foe = owner.foe;
    for (const t of tiles) {
      const c = g.center(t.col, t.row);
      s.fx.explosion(c.x, c.y - 20, 34, owner.kiColor);
      if (crack) g.crack(t.col, t.row);
    }
    if (foe.alive && tiles.some((t) => t.col === foe.col && t.row === foe.row)) {
      if (ignoreInvuln) foe.invulnUntil = 0;
      foe.receive({ amount: damage, heavy: true });
    }
    s.fx.shake(260, 0.012);
    S.audio.play('explode');
  }

  capture(f, p) {
    const s = this.scene;
    const g = s.grid;
    const col = g.frontierColumn(f.side);
    const taken = col === null ? 0 : g.capture(f.side, col, p.durationMs);
    if (!taken) {
      s.fx.popText(f.pos.x, f.pos.y - 150, 'NO GROUND TO TAKE', '#c0c0d0');
      return;
    }
    f.setPose('special', 300);
    f.lockFor(250);
    for (let r = 0; r < g.rows; r++) {
      const c = g.center(col, r);
      s.fx.ring(c.x, c.y - 10, f.kiColor, 10, 70, 320);
    }
    S.audio.play('capture');
  }

  // ---- Threat map (used by the AI and by Vanish) --------------------------

  addHazard(owner, tiles, ms) {
    const h = { owner, tiles, until: this.scene.clock + ms };
    this.hazards.push(h);
    return h;
  }

  threatAt(side, col, row) {
    const s = this.scene;
    for (const h of this.hazards) {
      if (h.owner.side !== side && h.tiles.some((t) => t.col === col && t.row === row)) return true;
    }
    const x = s.grid.center(col, row).x;
    for (const p of this.projectiles) {
      if (p.owner.side === side || p.row !== row) continue;
      const ahead = p.vx > 0 ? x - p.x : p.x - x;
      if (ahead > -30 && ahead < 520) return true;
    }
    return false;
  }

  /** Clears every live attack; used when the fight ends. */
  stopAll() {
    this.beams.forEach((b) => this.endBeam(b, true));
    this.beams = [];
    this.projectiles.forEach((p) => this.killProjectile(p, false));
    this.projectiles = [];
    this.scene.grid.warnings.forEach((w) => w.cancel());
  }

  update(dt) {
    const now = this.scene.clock;
    this.hazards = this.hazards.filter((h) => now < h.until);
    this.updateProjectiles(dt);
    this.updateBeams(dt);
  }
}
