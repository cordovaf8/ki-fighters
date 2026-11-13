// MeleeSystem: the three-hit punch combo on the melee button.
//
// Each press throws the next strike of the fighter's combo (their meleePoses:
// punch -> punchBack -> uppercut). In base form a strike only reaches the tile
// directly in front of the fighter; transformed forms reach further down the
// row (melee.reachByForm: 1, 2, then 3 tiles). Pressing again during a strike (or just after it)
// chains the next one; the third strike is a heavy finisher that knocks the
// target back a tile. Light hits stun just long enough for the next strike to
// connect, so a full combo lands if you start it on a fighter who is not
// blocking. Tuning lives in the "melee" section of config.json.
import { Data, S } from '../core/data.js';

export class MeleeSystem {
  constructor(scene) {
    this.scene = scene;
  }

  get cfg() { return Data.config.melee; }

  state(f) {
    if (!f.melee) f.melee = { step: 0, busy: false, queued: false, chainUntil: 0, token: 0 };
    return f.melee;
  }

  /**
   * Base damage of a strike, before attack stats. Strikes are worth
   * melee.damageMul (1.5x) the fighter's own energy attack they match:
   * punches match a basic blast, the uppercut finisher matches a charged blast.
   * Perks that strengthen those blasts strengthen the matching strikes too.
   */
  strikeDamage(f, def, form = f.form) {
    if (def.damage != null) return def.damage;
    const fc = Data.config.fighter;
    const perk = (name) => (form.perks || []).includes(name);
    const energy = def.matches === 'charged'
      ? (perk('chargedBeam') ? 70 : fc.chargedDamage)
      : fc.blastDamage * (perk('blastBoost') ? 1.5 : 1);
    return energy * (this.cfg.damageMul ?? 1);
  }

  /**
   * Full damage, attack stats included, for a strike landing `dist` tiles away.
   * Only a hit on the tile directly in front gets the current form's full power;
   * each tile further out hits as hard as a direct hit one form lower
   * (third form: 2 tiles = second form, 3 tiles = base form).
   */
  hitDamage(f, def, dist) {
    const index = Math.max(0, f.formIndex - Math.max(0, dist - 1));
    const form = f.def.forms[index];
    return this.strikeDamage(f, def, form) * f.atkMul * (form.atk / f.form.atk);
  }

  /** How many tiles in front a fighter's punches reach: grows with each form. */
  reach(f) {
    const byForm = this.cfg.reachByForm;
    if (!byForm?.length) return this.cfg.reach;
    return byForm[Math.min(f.formIndex, byForm.length - 1)];
  }

  /** The farthest tile a fighter's strike reaches. */
  targetTile(f) {
    return { col: f.col + f.facing * this.reach(f), row: f.row };
  }

  /** Every tile a strike covers, nearest first. */
  reachTiles(f) {
    const tiles = [];
    for (let i = 1; i <= this.reach(f); i++) tiles.push({ col: f.col + f.facing * i, row: f.row });
    return tiles.filter((t) => this.scene.grid.inBounds(t.col, t.row));
  }

  /** Is the opponent standing anywhere this fighter's punch would land? */
  inReach(f) {
    const dist = (f.foe.col - f.col) * f.facing;
    return f.foe.alive && f.foe.row === f.row && dist >= 1 && dist <= this.reach(f);
  }

  /** Long-reach punches (transformed forms) send a ki shockwave down the row. */
  shockwave(f, tiles) {
    const s = this.scene;
    const color = f.formIndex > 0 && f.form.aura ? Number.parseInt(f.form.aura.slice(1), 16) : f.kiColor;
    tiles.forEach((t, i) => {
      s.after(i * 30, () => {
        const c = s.grid.center(t.col, t.row);
        s.fx.ring(c.x, c.y - 60, color, 12, 46, 200);
        if (i === tiles.length - 1) s.fx.spark(c.x, c.y - 60, color, 6, 40);
      });
    });
  }

  /** Melee button pressed. Starts a combo, chains the next strike, or buffers it. */
  press(f) {
    const st = this.state(f);
    const now = this.scene.clock;
    const strikes = this.cfg.strikes;
    if (st.busy) {
      if (st.step < strikes.length) st.queued = true; // buffered: fires when this strike ends
      return true;
    }
    if (!f.canAct() || f.blocking) return false;
    const next = st.step > 0 && st.step < strikes.length && now <= st.chainUntil ? st.step + 1 : 1;
    this.strike(f, next);
    return true;
  }

  /** Throw the whole three-hit combo without further presses (the Grapple technique). */
  autoCombo(f) {
    const st = this.state(f);
    st.auto = true;
    st.busy = false;
    this.strike(f, 1);
  }

  strike(f, n) {
    const s = this.scene;
    const cfg = this.cfg;
    const st = this.state(f);
    const def = cfg.strikes[n - 1];
    const poses = f.def.meleePoses || [];
    const pose = poses[n - 1] || def.pose;
    const token = ++st.token;
    const alive = () => st.token === token && f.alive;

    st.step = n;
    st.busy = true;
    st.hitAt = s.clock + def.windupMs; // when this strike lands (the AI times parries off it)
    st.queued = false;
    f.chargeStart = null;
    f.locked = true;
    f.setPose(pose, def.windupMs + def.recoverMs);
    // A heavy hit to the attacker cancels the rest of the combo.
    f.action = { cancel: () => this.abort(f, token) };

    // Lunge toward the target tile, then settle back onto your own tile.
    const home = s.grid.center(f.col, f.row);
    s.tweens.killTweensOf(f.pos);
    s.tweens.add({ targets: f.pos, x: home.x + f.facing * cfg.lungePx, duration: def.windupMs, ease: 'Quad.easeOut' });
    const covered = this.reachTiles(f);
    if (covered.length) s.combat.addHazard(f, covered, def.windupMs); // lets the AI read the swing
    S.audio.play(def.heavy ? 'uppercut' : 'swing', f);

    s.after(def.windupMs, () => {
      if (!alive()) return;
      this.resolveHit(f, def, n);
    });
    s.after(def.windupMs + def.recoverMs, () => {
      if (!alive()) return;
      this.finishStrike(f, n);
    });
  }

  resolveHit(f, def, n) {
    const s = this.scene;
    const foe = f.foe;
    const t = this.targetTile(f);
    const spot = s.grid.inBounds(t.col, t.row) ? s.grid.center(t.col, t.row) : { x: f.pos.x + f.facing * 90, y: f.pos.y };
    const long = this.reach(f) > 1;
    // Parrying a punch thrown from the tile right in front stuns the attacker.
    // (Punches from further out can only be blocked.)
    const dist = (foe.col - f.col) * f.facing;
    if (this.inReach(f) && dist === 1
      && foe.tryParry({ parryable: true, reflects: 0, x: (f.pos.x + foe.pos.x) / 2, y: foe.pos.y - 80 })) {
      s.combat.stun(f, this.cfg.parryStunMs);
      return;
    }
    if (!this.inReach(f)) {
      if (long) this.shockwave(f, this.reachTiles(f));
      else s.fx.dust(spot.x - f.facing * 30, spot.y);
      return;
    }
    if (long) this.shockwave(f, this.reachTiles(f).filter((x) => (x.col - f.col) * f.facing <= (foe.col - f.col) * f.facing));
    const wasBlocking = foe.blocking;
    const dealt = foe.receive({ amount: this.hitDamage(f, def, (foe.col - f.col) * f.facing), heavy: !!def.heavy, kind: def.heavy ? 'meleeFinisher' : 'melee' });
    if (dealt <= 0) return; // dodged by invulnerability or an afterimage
    f.meleeHits = (f.meleeHits || 0) + 1;
    S.audio.play(def.heavy ? 'heavy' : 'punch');
    s.hitstop(def.heavy ? this.cfg.hitstopMs * 2 : this.cfg.hitstopMs);
    if (!wasBlocking && foe.alive && !foe.armor) {
      // Light strikes hold the target just long enough for the next one.
      foe.hurtUntil = Math.max(foe.hurtUntil, s.clock + this.cfg.hitstunMs);
      if (!def.heavy) foe.setPose('hurt', this.cfg.hitstunMs);
    }
    if (def.heavy) {
      s.fx.shake(120, 0.008);
      if (!wasBlocking && foe.alive && def.knockback) foe.shove(f.facing * def.knockback);
    }
    if (n === this.cfg.strikes.length && !wasBlocking) {
      s.fx.popText(foe.pos.x, foe.pos.y - 160, `${n}-HIT COMBO`, '#ffb347', 22);
    }
  }

  finishStrike(f, n) {
    const s = this.scene;
    const st = this.state(f);
    const last = n >= this.cfg.strikes.length;
    st.busy = false;
    f.action = null;
    f.locked = false;
    const home = s.grid.center(f.col, f.row);
    s.tweens.add({ targets: f.pos, x: home.x, y: home.y, duration: 90 });
    if (!last && (st.queued || st.auto) && f.alive) return this.strike(f, n + 1);
    st.auto = false;
    if (last) {
      st.step = 0;
      f.lockFor(this.cfg.finisherRecoverMs);
    } else {
      st.chainUntil = s.clock + this.cfg.chainWindowMs;
    }
  }

  /** Interrupted by a heavy hit: drop the combo and snap back home. */
  abort(f, token) {
    const st = this.state(f);
    if (st.token !== token) return;
    st.token++;
    st.busy = false;
    st.queued = false;
    st.auto = false;
    st.step = 0;
    f.locked = false;
    const s = this.scene;
    const home = s.grid.center(f.col, f.row);
    s.tweens.killTweensOf(f.pos);
    f.pos.x = home.x;
    f.pos.y = home.y;
  }
}
