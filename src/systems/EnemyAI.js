// EnemyAI: movement, defence, attacks and tactical decisions for the opponent.
// It plays through the same Fighter interface as the human player.
import { Data } from '../core/data.js';

const STEPS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

export class EnemyAI {
  constructor(scene, me, opponent) {
    this.scene = scene;
    this.me = me;
    this.cfg = opponent.ai;
    this.deck = opponent.deck;
    this.queueSize = opponent.queueSize;
    this.nextThink = 500;
    this.nextBlast = 800;
    this.blockUntil = 0;
  }

  /** Called whenever the Focus Gauge fills: the AI draws fresh techniques too. */
  refill() {
    if (!this.deck.length) return;
    const queue = [];
    for (let i = 0; i < this.queueSize; i++) {
      queue.push(Data.techniques[this.deck[Math.floor(Math.random() * this.deck.length)]]);
    }
    this.me.queue = queue;
  }

  update() {
    const s = this.scene;
    const me = this.me;
    const foe = me.foe;
    const c = this.cfg;
    const now = s.clock;

    // Split-second reactions run every frame, not on the slower think tick.
    this.reactParry(now);
    this.continueCombo();

    if (me.blocking && now >= this.blockUntil) me.stopBlock();
    if (!me.canAct() || me.blocking || now < this.nextThink) return;
    this.nextThink = now + c.thinkMs * (0.7 + Math.random() * 0.6);

    // 1. Survive: react to telegraphed attacks and incoming blasts.
    if (s.combat.threatAt(me.side, me.col, me.row)) {
      const beam = s.combat.beams.find((b) => b.owner === foe && b.phase === 'charge' && b.rows.includes(me.row));
      if (beam && Math.random() < c.counterBeam) {
        const i = me.queue.findIndex((t) => t.effect === 'beam');
        if (i >= 0 && s.techniques.execute(me, me.queue[i]) === 'ok') {
          me.queue.splice(i, 1);
          return;
        }
      }
      if (Math.random() < c.dodge && this.dodge()) return;
      if (Math.random() < c.blockChance && !me.guardBroken) {
        me.startBlock(false);
        this.blockUntil = now + 450 + Math.random() * 400;
        return;
      }
    }

    // 2. Power up once the power gauge is full.
    if (s.transform.ready(me) && Math.random() < 0.3 && s.transform.ascend(me)) return;

    // 2b. Punch when the player is standing right in front.
    if (s.melee.inReach(me) && Math.random() < (c.melee ?? c.aggression * 0.5) && s.melee.press(me)) return;

    // 3. Use a selected technique when the situation suits it.
    if (me.queue.length && Math.random() < c.techChance) {
      const t = me.queue[0];
      const fit = this.suits(t);
      if (fit === 'skip') {
        me.queue.push(me.queue.shift());
      } else if (fit) {
        const result = s.techniques.execute(me, t);
        if (result === 'ok') {
          me.queue.shift();
          return;
        }
        if (result === 'noki') me.queue.push(me.queue.shift());
      } else if (this.approach(t)) {
        return;
      }
    }

    // 4. Basic Ki blasts whenever lined up with the player.
    if (me.row === foe.row && now >= this.nextBlast) {
      this.nextBlast = now + c.blastCooldownMs * (0.8 + Math.random() * 0.5);
      if (Math.random() < c.chargeChance) this.chargedShot();
      else me.fireBlast(false);
      return;
    }

    // 5. Reposition. Brawlers like to work their way up to the front line.
    if (Math.random() < (c.melee ?? 0) * 0.4 && this.safeMove(me.facing, 0)) return;
    if (Math.random() < c.aggression) this.stepToRow(foe.row) || this.wander();
    else this.wander();
  }

  /** Tap block just before an incoming Ki blast lands, at this opponent's parry rate. */
  reactParry(now) {
    const me = this.me;
    const chance = this.cfg.parry || 0;
    if (!chance || me.guardBroken || !me.canAct() || now < me.parryReadyAt) return;
    const win = Data.config.parry.windowMs;
    for (const p of this.scene.combat.projectiles) {
      if (!p.alive || !p.parryable || p.owner === me || p.row !== me.row) continue;
      const toward = Math.sign(me.pos.x - p.x) === Math.sign(p.vx);
      if (!toward) continue;
      const msToHit = ((Math.abs(me.pos.x - p.x) - 32) / Math.abs(p.vx)) * 1000;
      if (msToHit <= 0 || msToHit > win * 0.7) continue;
      const key = p.reflects + 1;
      if (p.aiParryRoll === key) continue; // one decision per blast (and per reflection)
      p.aiParryRoll = key;
      if (Math.random() >= chance) continue;
      if (me.blocking) me.stopBlock();
      me.startBlock(true);
      this.blockUntil = now + win + 80;
      return;
    }
    // Punches from the tile right in front can be parried too (stunning the puncher).
    const foe = me.foe;
    const st = foe.melee;
    if (st?.busy && st.hitAt > now && st.hitAt - now <= win * 0.7 && (me.col - foe.col) * foe.facing === 1 && me.row === foe.row) {
      if (this.meleeParryRoll === st.token) return; // one decision per strike
      this.meleeParryRoll = st.token;
      if (Math.random() >= chance) return;
      if (me.blocking) me.stopBlock();
      me.startBlock(true);
      this.blockUntil = now + win + 80;
    }
  }

  /** Mid-combo, decide (once per strike) whether to throw the next punch. */
  continueCombo() {
    const st = this.me.melee;
    if (!st?.busy || st.queued || st.step >= Data.config.melee.strikes.length) return;
    if (this.comboRoll === st.token) return;
    this.comboRoll = st.token;
    if (Math.random() < (this.cfg.meleeChain ?? 0.7)) this.scene.melee.press(this.me);
  }

  /** Does the current board state suit this technique? true / false / 'skip'. */
  suits(t) {
    const me = this.me;
    const foe = me.foe;
    const p = t.params;
    switch (t.effect) {
      case 'projectiles':
        return p.rows === 'all' || me.row === foe.row;
      case 'beam':
        return p.rows === 'wide' ? Math.abs(me.row - foe.row) <= 1 : me.row === foe.row;
      case 'area':
        return Math.abs(foe.col - (me.col + me.facing * p.ahead)) <= p.radius && Math.abs(foe.row - me.row) <= p.radius;
      case 'restoreKi':
        return me.ki < me.maxKi * 0.6 ? true : 'skip';
      case 'capture':
        return this.scene.grid.frontierColumn(me.side) !== null ? true : 'skip';
      case 'ascend':
        return true;
      case 'meteors':
        return true; // the first meteor always targets the foe's tile
      case 'quake': {
        const g = this.scene.grid;
        let front = me.col + me.facing;
        while (g.inBounds(front, 0) && !g.tiles[front].some((x) => x.owner === foe.side)) front += me.facing;
        const depth = (foe.col - front) * me.facing;
        return depth >= 0 && depth < p.depth ? true : 'skip';
      }
      case 'grapple':
        return this.scene.melee.inReach(me);
      case 'hook':
        return me.row === foe.row;
      case 'heal':
        return me.hp < me.maxHp * 0.6 ? true : 'skip';
      case 'mirror':
      case 'shadow':
        return this.scene.combat.threatAt(me.side, me.col, me.row) ? true : 'skip';
      case 'buff':
        return p.guardMs && !p.powerMs ? (me.hp < me.maxHp * 0.7 ? true : 'skip') : true;
      default:
        return true;
    }
  }

  /** Move toward a position from which the technique would connect. */
  approach(t) {
    const me = this.me;
    const foe = me.foe;
    if (t.effect === 'area') {
      const wantCol = foe.col - me.facing * t.params.ahead;
      if (wantCol !== me.col && this.safeMove(Math.sign(wantCol - me.col), 0)) return true;
    }
    if (t.effect === 'grapple') {
      if (this.stepToRow(foe.row)) return true;
      return this.safeMove(me.facing, 0);
    }
    return this.stepToRow(foe.row);
  }

  stepToRow(row) {
    const dr = Math.sign(row - this.me.row);
    return dr !== 0 && this.safeMove(0, dr);
  }

  safeMove(dc, dr) {
    const me = this.me;
    const s = this.scene;
    if (s.combat.threatAt(me.side, me.col + dc, me.row + dr) && Math.random() < this.cfg.dodge) return false;
    return me.move(dc, dr);
  }

  wander() {
    const [dc, dr] = STEPS[Math.floor(Math.random() * STEPS.length)];
    return this.safeMove(dc, dr);
  }

  dodge() {
    const me = this.me;
    const s = this.scene;
    const options = STEPS.filter(
      ([dc, dr]) => s.grid.canEnter(me, me.col + dc, me.row + dr) && !s.combat.threatAt(me.side, me.col + dc, me.row + dr)
    );
    if (options.length) {
      const rowChange = options.filter(([, dr]) => dr !== 0);
      const pick = (rowChange.length ? rowChange : options)[Math.floor(Math.random() * (rowChange.length || options.length))];
      if (me.move(pick[0], pick[1])) return true;
    }
    return me.vanish();
  }

  chargedShot() {
    const me = this.me;
    const s = this.scene;
    const windup = 600;
    me.chargeNeed = windup;
    me.chargeStart = s.clock;
    me.lockFor(windup);
    s.after(windup, () => {
      if (me.chargeStart === null) return; // interrupted by a heavy hit
      me.chargeStart = null;
      if (me.alive && s.clock >= me.hurtUntil && !me.locked) me.fireBlast(true, true);
    });
  }
}
