// FighterSystem: one fighter on the grid - movement, health, poses, positioning.
// The player and the AI both drive fighters through this same interface.
import Phaser from 'phaser';
import { Data, S } from '../core/data.js';
import { fighterTextureKey, hexInt } from './SpriteFactory.js';
import { KiSystem } from './KiSystem.js';
import { StormAura } from './StormAura.js';
import { PROJECTILE_STYLES } from './ProjectileStyles.js';
import { finalChargeIsBeam } from './ThemedBeams.js';

const HAND_Y = 68; // height of a fighter's hands above their feet, in screen pixels

export class Fighter {
  constructor(scene, spec) {
    const cfg = Data.config.fighter;
    this.scene = scene;
    this.side = spec.side;
    this.facing = spec.side === 'player' ? 1 : -1;
    this.id = spec.id;
    this.def = spec.def;
    this.name = spec.def.name;
    this.maxForm = Math.min(spec.maxForm, spec.def.forms.length - 1);
    this.col = spec.col;
    this.row = spec.row;
    this.foe = null;

    this.maxHp = this.hp = spec.stats.hp;
    this.maxKi = spec.stats.ki;
    this.ki = Math.round(this.maxKi * cfg.startKiRatio);
    this.atkStat = spec.stats.atk;
    this.defStat = spec.stats.def;
    this.stamina = cfg.staminaMax;
    this.formIndex = 0;
    this.alive = true;
    this.queue = [];

    this.locked = false;
    this.lockUntil = 0;
    this.hurtUntil = 0;
    this.invulnUntil = 0;
    this.counterUntil = 0;
    this.freeFormUntil = 0;
    this.moveReadyAt = 0;
    this.blastReadyAt = 0;
    this.teleportReadyAt = 0;
    this.blocking = false;
    this.guardBroken = false;
    this.parryUntil = 0; // a fresh block press opens a short parry window
    this.parryReadyAt = 0; // a missed parry locks parrying briefly (no mashing)
    this.parries = 0;
    this.armor = false;
    this.chargeStart = null;
    this.kiCharging = false;
    this.chargeNeed = cfg.chargeMs;
    this.pose = null;
    this.poseUntil = 0;
    this.action = null; // { cancel() } for interruptible wind-ups
    this.flashUntil = 0;
    this.hover = 0;
    this.visualRow = null;

    this.kiColor = hexInt(spec.def.look.ki);
    const c = scene.grid.center(this.col, this.row);
    this.pos = { x: c.x, y: c.y };
    this.shadow = scene.add.ellipse(c.x, c.y + 2, 72, 16, 0x000000, 0.35).setDepth(5);
    this.aura = scene.add.sprite(c.x, c.y, 'aura', 0).setOrigin(0.5, 1).setScale(2.3).setVisible(false);
    this.aura.setBlendMode(Phaser.BlendModes.ADD);
    this.sprite = scene.add.sprite(c.x, c.y, fighterTextureKey(this.id, 0), 'idle0').setOrigin(0.5, 1).setScale(0.5);
    this.sprite.setFlipX(this.facing < 0);
    this.stormAura = this.id === 'jin' ? new StormAura(scene) : null;
    this.orb = scene.add.circle(c.x, c.y, 6, this.kiColor, 0.95).setVisible(false);
    this.orb.setBlendMode(Phaser.BlendModes.ADD);
  }

  get form() { return this.def.forms[this.formIndex]; }
  get speedMul() { return this.form.speed; }
  get atkMul() {
    // Battle Cry style buffs raise attack for a few seconds.
    const buff = this.scene.clock < (this.powerUntil || 0) ? this.powerMul : 1;
    return (this.atkStat / 100) * this.form.atk * buff;
  }
  /** Iron Body style buffs: less damage taken and no stagger. */
  get guarded() { return this.scene.clock < (this.guardUntil || 0); }
  get handOffset() {
    const texture = this.sprite.texture;
    return this.pose === 'special' || this.pose === 'beam' ? texture.specialHandOffset : texture.handOffset;
  }
  get handX() { return this.pos.x + this.facing * (this.handOffset?.x * this.sprite.scaleX || 44); }
  get handY() { return this.pos.y - this.hover - (this.handOffset?.y * this.sprite.scaleY || HAND_Y); }
  hasPerk(name) { return this.form.perks.includes(name); }

  canAct() {
    const s = this.scene;
    return this.alive && !this.locked && !this.kiCharging && s.clock >= this.lockUntil && s.clock >= this.hurtUntil;
  }

  lockFor(ms) {
    this.lockUntil = Math.max(this.lockUntil, this.scene.clock + ms);
  }

  setPose(name, ms = 0) {
    this.pose = name;
    this.poseUntil = ms ? this.scene.clock + ms : Infinity;
  }

  clearPose() {
    this.pose = null;
  }

  startKiCharge() {
    if (this.kiCharging) return true;
    if (!this.canAct() || this.blocking || this.pose === 'beam' || this.action) return false;
    this.kiCharging = true;
    this.chargeStart = null;
    this.setPose('power');
    if (this.ki < this.maxKi) S.audio.play('beamcharge', this);
    return true;
  }

  stopKiCharge() {
    if (!this.kiCharging) return;
    this.kiCharging = false;
    if (this.pose === 'power') this.clearPose();
  }

  // ---- Movement -----------------------------------------------------------

  move(dc, dr) {
    const s = this.scene;
    if (!this.canAct() || this.blocking || s.clock < this.moveReadyAt) return false;
    const c = this.col + dc;
    const r = this.row + dr;
    if (!s.grid.canEnter(this, c, r)) return false;
    this.moveReadyAt = s.clock + Data.config.fighter.moveCooldownMs / this.speedMul;
    this.placeAt(c, r, 55);
    S.audio.play('move');
    return true;
  }

  placeAt(c, r, tweenMs = 0) {
    const s = this.scene;
    if (c !== this.col || r !== this.row) s.grid.onLeave(this.col, this.row);
    this.col = c;
    this.row = r;
    const p = s.grid.center(c, r);
    s.tweens.killTweensOf(this.pos);
    if (tweenMs) s.tweens.add({ targets: this.pos, x: p.x, y: p.y, duration: tweenMs });
    else {
      this.pos.x = p.x;
      this.pos.y = p.y;
    }
  }

  /** Teleport. With a direction, jump up to two tiles; otherwise pick a safe tile. */
  vanish(free = false, dir = null) {
    const s = this.scene;
    const cfg = Data.config.fighter;
    const fast = this.hasPerk('fastTeleport');
    const cost = fast ? cfg.teleportKiCost / 2 : cfg.teleportKiCost;
    if (!free && (!this.canAct() || this.blocking || s.clock < this.teleportReadyAt || this.ki < cost)) return false;

    let dest = null;
    if (dir) {
      for (const n of [2, 1]) {
        if (s.grid.canEnter(this, this.col + dir[0] * n, this.row + dir[1] * n)) {
          dest = s.grid.tile(this.col + dir[0] * n, this.row + dir[1] * n);
          break;
        }
      }
    }
    if (!dest) {
      const open = s.grid.openTiles(this).filter((t) => t.col !== this.col || t.row !== this.row);
      const safe = open.filter((t) => !s.combat.threatAt(this.side, t.col, t.row));
      const pool = safe.length ? safe : open;
      const otherRow = pool.filter((t) => t.row !== this.row);
      const pick = otherRow.length ? otherRow : pool;
      dest = pick[Math.floor(Math.random() * pick.length)] || null;
    }
    if (!dest) return false;

    if (!free) {
      this.ki -= cost;
      this.teleportReadyAt = s.clock + (fast ? cfg.teleportCooldownMs / 2 : cfg.teleportCooldownMs);
    }
    s.fx.afterimage(this, this.kiColor);
    this.placeAt(dest.col, dest.row);
    this.invulnUntil = Math.max(this.invulnUntil, s.clock + cfg.teleportInvulnMs);
    S.audio.play('teleport');
    return true;
  }

  // ---- Attacking ----------------------------------------------------------

  fireBlast(charged = false, force = false) {
    const s = this.scene;
    const cfg = Data.config.fighter;
    if (!this.alive || this.blocking) return false;
    if (!force && !this.canAct()) return false;
    if (!charged && s.clock < this.blastReadyAt) return false;
    this.blastReadyAt = s.clock + cfg.blastCooldownMs / this.speedMul;

    if (charged && (finalChargeIsBeam(this) || (this.hasPerk('chargedBeam') && !PROJECTILE_STYLES[this.id]))) {
      s.combat.fireBeam(this, { rows: 'self', chargeMs: 160, durationMs: 520,
        damage: this.hasPerk('chargedBeam') ? 70 : cfg.chargedDamage, theme: this.id });
      return true;
    }
    const boost = this.hasPerk('blastBoost');
    const damage = (charged ? (this.hasPerk('chargedBeam') ? 70 : cfg.chargedDamage) : cfg.blastDamage * (boost ? 1.5 : 1)) * this.atkMul;
    s.combat.spawnProjectile(this, { row: this.row, damage, heavy: charged, big: charged, mid: boost && !charged, parryable: true });
    this.setPose('shoot', charged ? 240 : 180);
    S.audio.play(charged ? 'bigblast' : 'blast', this);
    return true;
  }

  /**
   * Starts blocking. The first moments of a fresh press are a parry window:
   * a Ki blast arriving then is reflected instead of blocked. The AI passes
   * allowParry = false for ordinary guarding, so its parry rate stays tunable.
   */
  startBlock(allowParry = true) {
    if (this.blocking || this.guardBroken || !this.canAct()) return;
    this.blocking = true;
    S.audio.play('guard', this);
    this.clearPose();
    this.chargeStart = null;
    const now = this.scene.clock;
    const pc = Data.config.parry;
    if (allowParry && now >= this.parryReadyAt) {
      this.parryUntil = now + pc.windowMs;
      this.parryReadyAt = this.parryUntil + pc.whiffLockMs;
    }
  }

  /** A blast is touching this fighter: parry it if the window is open. */
  tryParry(p) {
    const s = this.scene;
    const now = s.clock;
    if (!p.parryable || !this.alive || !this.blocking || !this.canAct() || this.guardBroken || now >= this.parryUntil) return false;
    this.parryUntil = 0;
    this.parryReadyAt = now; // a clean parry can chain straight into the next one
    this.parries++;
    KiSystem.restore(this, Data.config.parry.kiGain);
    s.transform?.gain(this, 'parry');
    if (!this.blocking) this.setPose('block', 160);
    this.flashUntil = s.time.now + 90;
    const hx = p.x;
    const hy = p.y;
    s.fx.ring(hx, hy, 0xffffff, 10, 70, 220);
    s.fx.spark(hx, hy, 0xfff3a0, 14, 70);
    s.fx.popText(this.pos.x, this.pos.y - 160, p.reflects ? 'PARRY x' + (p.reflects + 1) : 'PARRY!', '#fff3a0', 24);
    s.hitstop(Data.config.parry.hitstopMs);
    S.audio.play('parry');
    if (this.side === 'player') S.input.rumble(90, 0.2, 0.9);
    return true;
  }

  stopBlock() {
    this.blocking = false;
    this.parryUntil = 0;
  }

  /** Cancels whatever wind-up the fighter was in (called on heavy hits). */
  interrupt() {
    this.stopKiCharge();
    this.chargeStart = null;
    this.stopBlock();
    if (this.action) {
      const a = this.action;
      this.action = null;
      a.cancel();
    }
  }

  // ---- Taking damage ------------------------------------------------------

  /** hit = { amount, heavy, unblockable }. Returns the damage actually dealt. */
  receive(hit) {
    const s = this.scene;
    const cfg = Data.config.fighter;
    const now = s.clock;
    if (!this.alive || now < this.invulnUntil) return 0;

    if (now < this.counterUntil) {
      this.counterUntil = 0;
      s.fx.popText(this.pos.x, this.pos.y - 150, 'AFTERIMAGE!', '#d0b8ff');
      if (!this.vanish(true)) this.invulnUntil = now + 300;
      return 0;
    }

    let dmg = (hit.amount * 100) / this.defStat;
    if (this.guarded) dmg *= this.guardMul;
    this.stopKiCharge();
    let blocked = false;
    if (this.blocking && !hit.unblockable) {
      blocked = true;
      dmg *= cfg.blockDamageMul;
      this.stamina -= cfg.blockHitDrain * (hit.heavy ? 2 : 1);
      if (this.stamina <= 0) this.breakGuard();
    }
    dmg = Math.max(1, Math.round(dmg));
    this.hp = Math.max(0, this.hp - dmg);
    // Landing a hit builds the attacker's power gauge.
    s.transform?.gain(this.foe, hit.kind || 'blast', dmg, blocked);

    const fxY = this.pos.y - 70;
    s.fx.damageNumber(this.pos.x, this.pos.y - 130, dmg, blocked ? '#9fd0ff' : this.side === 'player' ? '#ff8a8a' : '#ffe14a');
    s.fx.spark(this.pos.x, fxY, blocked ? 0x9fd0ff : 0xffe14a, hit.heavy ? 12 : 5);
    S.audio.play(blocked ? 'block' : hit.heavy ? 'heavy' : 'hit');
    this.flashUntil = s.time.now + 70;
    if (this.side === 'player') S.input.rumble(hit.heavy ? 220 : 70, hit.heavy ? 0.8 : 0.3, hit.heavy ? 1 : 0.2);

    if (this.hp <= 0) {
      this.ko();
      return dmg;
    }
    if (!blocked && hit.heavy) {
      s.fx.shake(140, 0.008);
      if (!this.armor && !this.guarded) {
        this.interrupt();
        this.hurtUntil = now + cfg.hurtMs;
        this.setPose('hurt', cfg.hurtMs);
      }
      this.invulnUntil = now + cfg.heavyInvulnMs;
    }
    return dmg;
  }

  breakGuard() {
    S.audio.play('guardbreak', this);
    this.stamina = 0;
    this.guardBroken = true;
    this.stopBlock();
    this.scene.fx.popText(this.pos.x, this.pos.y - 150, 'GUARD BREAK!', '#ff7070');
  }

  /** Knocked one tile in a direction if there is room. */
  shove(dc) {
    const s = this.scene;
    if (!this.alive || !s.grid.canEnter(this, this.col + dc, this.row)) return false;
    this.placeAt(this.col + dc, this.row, 90);
    s.fx.dust(this.pos.x, this.pos.y);
    return true;
  }

  ko() {
    if (!this.alive) return;
    S.audio.play('defeat', this);
    this.alive = false;
    this.interrupt();
    this.locked = true;
    this.pose = 'hurt';
    this.poseUntil = Infinity;
    this.aura.setVisible(false);
    this.orb.setVisible(false);
  }

  setForm(index) {
    this.formIndex = index;
    this.sprite.setTexture(fighterTextureKey(this.id, index), this.sprite.frame.name);
    this.sprite.setScale(0.5 * (this.form.spriteScale || 1));
    if (this.form.aura) this.aura.setTint(hexInt(this.form.aura));
  }

  // ---- Per-frame ----------------------------------------------------------

  /** Gameplay tick; only runs while the fight is live. */
  update(dt) {
    if (!this.alive) return;
    const cfg = Data.config.fighter;
    const now = this.scene.clock;
    KiSystem.update(this, dt);
    const chargingShot = this.chargeStart !== null && now - this.chargeStart > 160;
    if (this.kiCharging || chargingShot) {
      if (now >= (this.nextChargeSoundAt ?? 0)) {
        S.audio.play('charge', this);
        this.nextChargeSoundAt = now + 180;
      }
      if (chargingShot && now - this.chargeStart >= Data.config.fighter.chargeMs && !this.chargeSoundReady) {
        S.audio.play('charged', this);
        this.chargeSoundReady = true;
      }
    } else { this.nextChargeSoundAt = 0; this.chargeSoundReady = false; }

    if (this.blocking) {
      this.stamina -= (cfg.blockDrainPerSec * dt) / 1000;
      if (this.stamina <= 0) this.breakGuard();
    } else {
      this.stamina = Math.min(cfg.staminaMax, this.stamina + (cfg.staminaRegenPerSec * dt) / 1000);
      if (this.guardBroken && this.stamina >= cfg.guardBreakRecover) this.guardBroken = false;
    }
    if (this.pose && now >= this.poseUntil) this.pose = null;
  }

  /** Visual sync; runs every frame, even while the battle is paused. */
  render(time) {
    const s = this.scene;
    const now = s.clock;
    const transformed = this.formIndex > 0 && this.alive;

    // Hover: transformed fighters and beam users float just above the tile.
    const lift = !this.alive ? 0 : this.pose === 'beam' || this.pose === 'power' ? 10 : transformed ? 6 + Math.sin(time / 260) * 2 : 0;
    this.hover += (lift - this.hover) * 0.2;

    const x = this.pos.x;
    const y = this.pos.y - this.hover;
    const depthRow = this.visualRow ?? this.row;
    this.sprite.setPosition(x, y).setDepth(10 + depthRow * 10);
    this.shadow.setPosition(this.pos.x, this.pos.y + 2).setScale(1 - this.hover / 40, 1);

    let frame;
    if (this.pose) frame = this.pose;
    else if (now < this.hurtUntil) frame = 'hurt';
    else if (this.blocking) frame = 'block';
    else if (this.chargeStart !== null && now - this.chargeStart > 160) frame = 'charge';
    else frame = Math.floor(time / 380) % 2 ? 'idle1' : 'idle0';
    if (this.sprite.frame.name !== frame) this.sprite.setFrame(frame);

    // Hit flash, invulnerability flicker, afterimage shimmer.
    if (time < this.flashUntil) {
      this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    } else {
      this.sprite.setTintMode(Phaser.TintModes.MULTIPLY);
      if (this.alive && now < this.counterUntil) this.sprite.setTint(0xc8b0ff);
      else if (this.guardBroken) this.sprite.setTint(0xff9090);
      else this.sprite.clearTint();
    }
    let alpha = 1;
    if (this.alive && now < (this.shadowUntil || 0)) alpha = 0.45 + 0.15 * Math.sin(time / 90); // Shadow Step: a steady ghostly fade
    else if (this.alive && now < this.invulnUntil) alpha = Math.floor(time / 50) % 2 ? 0.35 : 0.9;
    else if (this.alive && now < this.counterUntil) alpha = 0.7 + 0.2 * Math.sin(time / 70);
    this.sprite.setAlpha(alpha);

    const auraOn = this.alive && (transformed || this.pose === 'power');
    const stormOn = auraOn && this.form.auraStyle === 'jin-storm';
    this.stormAura?.update(time, this.sprite, stormOn);
    this.aura.setVisible(auraOn && !stormOn);
    if (auraOn && !stormOn) {
      this.aura.setScale(2.3 * (this.form.auraScale || 1) * (this.form.spriteScale || 1));
      this.aura.setPosition(x, y + 6).setDepth(9 + depthRow * 10).setFrame(Math.floor(time / 90) % 3);
      this.aura.setTint(transformed && this.form.aura ? hexInt(this.form.aura) : this.kiColor);
      this.aura.setAlpha(0.75 + 0.2 * Math.sin(time / 110));
    }

    // Charge orb grows in the fighter's hand while the attack button is held.
    const charging = this.alive && this.chargeStart !== null && now - this.chargeStart > 160;
    this.orb.setVisible(charging);
    if (charging) {
      const k = Math.min(1, (now - this.chargeStart) / this.chargeNeed);
      const full = k >= 1;
      this.orb.setPosition(this.handX, this.handY).setDepth(16 + depthRow * 10);
      this.orb.setRadius(4 + k * 9 + (full ? Math.sin(time / 40) * 2 : 0));
      const chargeColor = PROJECTILE_STYLES[this.id]?.color;
      this.orb.setFillStyle(full ? 0xffffff : chargeColor ? hexInt(chargeColor) : this.kiColor, 0.95);
    }
  }
}
