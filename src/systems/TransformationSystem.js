// TransformationSystem: forms, their Ki upkeep, and the transformation sequence.
import { S } from '../core/data.js';
import { hexInt } from './SpriteFactory.js';

export class TransformationSystem {
  constructor(scene) {
    this.scene = scene;
  }

  nextForm(f) {
    return f.formIndex < f.maxForm ? f.def.forms[f.formIndex + 1] : null;
  }

  /** Rise one form. Costs Ki unless `free`; `freeMs` suspends the drain. */
  ascend(f, { free = false, freeMs = 0 } = {}) {
    const s = this.scene;
    const next = this.nextForm(f);
    if (!next || !f.canAct() || f.blocking) return false;
    if (!free) {
      if (f.ki < next.kiCost) return false;
      f.ki -= next.kiCost;
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
    S.audio.play('transform');

    s.after(600, () => {
      f.armor = false;
      f.locked = false;
      f.clearPose();
      if (!f.alive) return;
      f.setForm(target);
      if (freeMs) f.freeFormUntil = s.clock + freeMs;
      s.fx.ring(f.pos.x, f.pos.y - 50, color, 30, 220, 420);
      s.fx.spark(f.pos.x, f.pos.y - 60, color, 16, 110);
    });
    return true;
  }

  revert(f, silent = false) {
    if (f.formIndex === 0) return false;
    f.setForm(0);
    f.freeFormUntil = 0;
    if (!silent) {
      this.scene.fx.popText(f.pos.x, f.pos.y - 150, 'POWER DOWN', '#b0b0c0');
      S.audio.play('powerdown');
    }
    return true;
  }

  /** The transform button: go up if possible, otherwise drop back to base. */
  toggle(f) {
    if (!f.canAct() || f.blocking) return;
    const next = this.nextForm(f);
    if (next && f.ki >= next.kiCost) {
      this.ascend(f);
    } else if (f.formIndex > 0) {
      this.revert(f);
    } else {
      const why = next ? `NEED ${next.kiCost} KI` : 'NO FORM UNLOCKED';
      this.scene.fx.popText(f.pos.x, f.pos.y - 150, why, '#ff7070');
      S.audio.play('deny');
    }
  }

  /** Higher forms burn Ki every second and collapse when it runs out. */
  update(f, dt) {
    if (!f.alive || f.formIndex === 0) return;
    if (this.scene.clock < f.freeFormUntil) return;
    f.ki -= (f.form.drain * dt) / 1000;
    if (f.ki <= 0) {
      f.ki = 0;
      if (!f.locked) this.revert(f);
    }
  }
}
