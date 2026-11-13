// TransformationSystem: forms, the power gauge that unlocks them, and the
// transformation sequence.
//
// Each fighter has a power gauge (f.power, 0..max) that starts empty every
// fight. It fills slowly on its own and faster when the fighter lands hits,
// lands techniques or parries. When it is full the fighter can rise one form,
// which empties it; the gauge then builds toward the next form. Forms last for
// the rest of the fight. Tuning lives in the "transform" section of config.json.
import { Data, S } from '../core/data.js';
import { hexInt } from './SpriteFactory.js';

export class TransformationSystem {
  constructor(scene) {
    this.scene = scene;
  }

  get cfg() { return Data.config.transform; }

  nextForm(f) {
    return f.formIndex < f.maxForm ? f.def.forms[f.formIndex + 1] : null;
  }

  /** Gauge full and a higher form unlocked. */
  ready(f) {
    return !!this.nextForm(f) && (f.power || 0) >= this.cfg.max;
  }

  /** Fraction of the gauge filled, 0..1 (1 once the highest form is reached). */
  ratio(f) {
    if (!this.nextForm(f)) return f.formIndex > 0 ? 1 : 0;
    return Math.min(1, (f.power || 0) / this.cfg.max);
  }

  /**
   * Credit a fighter for something they did. kind: 'blast', 'charged', 'melee',
   * 'meleeFinisher', 'technique' (scaled by damage dealt) or 'parry'.
   */
  gain(f, kind, damage = 0, blocked = false) {
    if (!f || !f.alive) return;
    const g = this.cfg.gain;
    let amount = kind === 'technique' ? damage * g.techniquePerDamage : g[kind] || 0;
    if (blocked) amount *= this.cfg.blockedMul;
    this.add(f, amount);
  }

  add(f, amount) {
    if (!this.nextForm(f) || amount <= 0) return;
    const wasReady = this.ready(f);
    f.power = Math.min(this.cfg.max, (f.power || 0) + amount);
    if (!wasReady && this.ready(f)) {
      this.scene.fx.popText(f.pos.x, f.pos.y - 180, 'POWER READY', '#ffe14a', 20);
      S.audio.play('restore');
      if (f.side === 'player') S.input.rumble(120, 0.4, 0.2);
    }
  }

  /** Rise one form. Uses the full gauge unless `free` (the Power Ascension technique). */
  ascend(f, { free = false } = {}) {
    const s = this.scene;
    const next = this.nextForm(f);
    if (!next || !f.canAct() || f.blocking) return false;
    if (!free) {
      if (!this.ready(f)) return false;
      f.power = 0;
    }
    const target = f.formIndex + 1;
    f.locked = true;
    f.armor = true;
    f.chargeStart = null;
    f.invulnUntil = Math.max(f.invulnUntil, s.clock + 750);
    f.setPose('power');

    const color = hexInt(next.aura || '#ffffff');
    s.fx.flash(160, color);
    s.fx.shake(600, 0.01);
    s.fx.ring(f.pos.x, f.pos.y - 50, color, 24, 150, 500);
    s.fx.popText(f.pos.x, f.pos.y - 170, next.name.toUpperCase() + '!', '#ffffff', 26);
    S.audio.play('transform', f);

    s.after(600, () => {
      f.armor = false;
      f.locked = false;
      f.clearPose();
      if (!f.alive) return;
      f.setForm(target);
      s.fx.ring(f.pos.x, f.pos.y - 50, color, 30, 220, 420);
      s.fx.spark(f.pos.x, f.pos.y - 60, color, 16, 110);
    });
    return true;
  }

  revert(f, silent = false) {
    if (f.formIndex === 0) return false;
    f.setForm(0);
    if (!silent) {
      this.scene.fx.popText(f.pos.x, f.pos.y - 150, 'POWER DOWN', '#b0b0c0');
      S.audio.play('powerdown');
    }
    return true;
  }

  /** The transform button: rise a form when the gauge is full. */
  toggle(f) {
    if (!f.canAct() || f.blocking) return;
    if (this.ascend(f)) return;
    const why = !this.nextForm(f)
      ? f.formIndex > 0 ? 'MAX FORM' : 'NO FORM UNLOCKED'
      : `POWER ${Math.floor(this.ratio(f) * 100)}%`;
    this.scene.fx.popText(f.pos.x, f.pos.y - 150, why, '#ff7070');
    S.audio.play('deny');
  }

  /** The gauge creeps up on its own while the fight is on. */
  update(f, dt) {
    if (!f.alive) return;
    const mul = this.scene.setup?.mode === 'training' ? this.cfg.trainingMul : 1;
    this.add(f, (this.cfg.passivePerSec * mul * dt) / 1000);
  }
}
