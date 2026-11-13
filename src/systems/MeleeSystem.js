// MeleeSystem: the three-hit punch combo on the melee button.
//
// Each press throws the next strike of the fighter's combo (their meleePoses:
// punch -> punchBack -> uppercut). A strike only reaches the tile directly in
// front of the fighter. Pressing again during a strike (or just after it)
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

  /** The tile a fighter's strike reaches. */
  targetTile(f) {
    return { col: f.col + f.facing * this.cfg.reach, row: f.row };
  }

  /** Is the opponent standing where this fighter's punch would land? */
  inReach(f) {
    const t = this.targetTile(f);
    return f.foe.alive && f.foe.col === t.col && f.foe.row === t.row;
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
    const t = this.targetTile(f);
    s.combat.addHazard(f, [t], def.windupMs); // lets the AI read the swing
    S.audio.play('move');

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
    if (!this.inReach(f)) {
      s.fx.dust(spot.x - f.facing * 30, spot.y);
      return;
    }
    const wasBlocking = foe.blocking;
    const dealt = foe.receive({ amount: def.damage * f.atkMul, heavy: !!def.heavy });
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
    if (!last && st.queued && f.alive) return this.strike(f, n + 1);
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
    st.step = 0;
    f.locked = false;
    const s = this.scene;
    const home = s.grid.center(f.col, f.row);
    s.tweens.killTweensOf(f.pos);
    f.pos.x = home.x;
    f.pos.y = home.y;
  }
}
