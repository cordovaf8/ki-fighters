// TechniqueSystem: deck management (draw / hand / discard), compatibility and
// combo fusion rules, and executing a technique's effect in battle.
import { Data, S } from '../core/data.js';
import { KiSystem } from './KiSystem.js';

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export class Deck {
  constructor(ids, handSize) {
    this.handSize = handSize;
    this.drawPile = shuffle([...ids]);
    this.hand = [];
    this.discard = [];
  }

  /** Top the hand back up. Cards you did not pick stay in your hand. */
  fillHand() {
    while (this.hand.length < this.handSize) {
      if (!this.drawPile.length) {
        if (!this.discard.length) break;
        this.drawPile = shuffle(this.discard);
        this.discard = [];
      }
      this.hand.push(this.drawPile.pop());
    }
    return this.hand;
  }

  /** Techniques can be chosen together when they belong to the same school. */
  static compatible(selectedIds, id) {
    if (!selectedIds.length) return true;
    return Data.techniques[selectedIds[0]].school === Data.techniques[id].school;
  }

  /** Finds the combo (if any) that a set of chosen technique ids would fuse into. */
  static findCombo(ids) {
    for (const combo of Data.combos) {
      const rest = [...ids];
      const used = [];
      if (combo.recipe.type) {
        for (let i = rest.length - 1; i >= 0; i--) {
          if (Data.techniques[rest[i]].type === combo.recipe.type) used.push(rest.splice(i, 1)[0]);
        }
        if (used.length < combo.recipe.count) continue;
        rest.push(...used.splice(combo.recipe.count));
      } else {
        let ok = true;
        for (const need of combo.recipe.ids) {
          const i = rest.indexOf(need);
          if (i < 0) {
            ok = false;
            break;
          }
          used.push(rest.splice(i, 1)[0]);
        }
        if (!ok) continue;
      }
      return { combo, rest };
    }
    return null;
  }

  /** Turns chosen ids into the battle queue, fusing a combo when one matches. */
  static resolve(ids) {
    const found = Deck.findCombo(ids);
    const queue = [];
    let rest = ids;
    if (found) {
      queue.push({ ...found.combo, isCombo: true });
      rest = found.rest;
    }
    for (const id of rest) queue.push(Data.techniques[id]);
    return queue;
  }

  commit(indices) {
    const ids = indices.map((i) => this.hand[i]);
    this.hand = this.hand.filter((_, i) => !indices.includes(i));
    this.discard.push(...ids);
    return Deck.resolve(ids);
  }
}

export class TechniqueSystem {
  constructor(scene) {
    this.scene = scene;
    const combat = scene.combat;
    this.handlers = {
      projectiles: (f, p) => this.projectiles(f, p),
      beam: (f, p) => combat.fireBeam(f, p),
      rush: (f, p) => combat.rush(f, p),
      area: (f, p) => combat.area(f, p),
      capture: (f, p) => combat.capture(f, p),
      counter: (f, p) => this.counter(f, p),
      restoreKi: (f, p) => this.restoreKi(f, p),
      ascend: (f, p) => this.ascend(f, p),
    };
  }

  /** Returns 'ok', 'busy' (cannot act right now) or 'noki' (not enough Ki). */
  execute(f, tech) {
    if (!f.canAct() || f.blocking) return 'busy';
    if (!KiSystem.spend(f, tech.kiCost)) return 'noki';
    f.chargeStart = null;
    const s = this.scene;
    s.fx.popText(f.pos.x, f.pos.y - 172, tech.name.toUpperCase(), tech.isCombo ? '#ffe14a' : '#ffffff', tech.isCombo ? 26 : 20);
    if (tech.isCombo) s.fx.flash(100, f.kiColor);
    this.handlers[tech.effect](f, tech.params, tech);
    return 'ok';
  }

  projectiles(f, p) {
    const s = this.scene;
    const total = (p.count - 1) * p.intervalMs;
    f.lockFor(total + 140);
    f.setPose('special', total + 180);
    for (let i = 0; i < p.count; i++) {
      s.after(i * p.intervalMs, () => {
        if (!f.alive || s.clock < f.hurtUntil) return;
        const rows = p.rows === 'all' ? [...Array(s.grid.rows).keys()] : [f.row];
        for (const row of rows) {
          s.combat.spawnProjectile(f, { row, damage: p.damage * f.atkMul, big: p.big, heavy: p.heavy });
        }
        S.audio.play(p.big ? 'bigblast' : 'blast');
      });
    }
  }

  counter(f, p) {
    const s = this.scene;
    f.counterUntil = s.clock + p.durationMs;
    f.setPose('special', 300);
    s.fx.ring(f.pos.x, f.pos.y - 50, 0xc8b0ff, 16, 90, 340);
    S.audio.play('teleport');
  }

  restoreKi(f, p) {
    const s = this.scene;
    let cancelled = false;
    f.locked = true;
    f.setPose('power');
    f.action = {
      cancel: () => {
        cancelled = true;
        f.locked = false;
        f.clearPose();
      },
    };
    s.after(p.chargeMs, () => {
      if (cancelled || !f.alive) return;
      f.action = null;
      f.locked = false;
      f.clearPose();
      KiSystem.restore(f, p.amount);
      s.fx.ring(f.pos.x, f.pos.y - 50, f.kiColor, 20, 110, 380);
      s.fx.popText(f.pos.x, f.pos.y - 150, `+${p.amount} KI`, '#7fe8ff');
      S.audio.play('restore');
    });
  }

  ascend(f, p) {
    const s = this.scene;
    if (!s.transform.ascend(f, { free: true, freeMs: p.freeMs })) {
      // Already at the highest unlocked form: convert the technique into Ki.
      KiSystem.restore(f, p.fallbackKi);
      s.fx.popText(f.pos.x, f.pos.y - 150, `+${p.fallbackKi} KI`, '#7fe8ff');
      S.audio.play('restore');
    }
  }
}
