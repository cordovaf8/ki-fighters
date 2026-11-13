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
      meteors: (f, p) => combat.meteors(f, p),
      quake: (f, p) => combat.quake(f, p),
      grapple: (f, p) => combat.grapple(f, p),
      buff: (f, p) => this.buff(f, p),
      heal: (f, p) => this.heal(f, p),
      mirror: (f, p) => this.mirror(f, p),
      shadow: (f, p) => this.shadowStep(f, p),
      hook: (f, p) => combat.throwHook(f, p),
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
    S.audio.play('technique', f);
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
        // 'foe' aims each shot at the row the opponent is in at that moment.
        const rows = p.rows === 'all' ? [...Array(s.grid.rows).keys()] : p.rows === 'foe' ? [f.foe.row] : [f.row];
        for (const row of rows) {
          s.combat.spawnProjectile(f, {
            row, damage: p.damage * f.atkMul, big: p.big, heavy: p.heavy, speed: p.speed,
            unblockable: p.unblockable, stunMs: p.stunMs, stealKi: p.stealKi, burst: p.burst,
          });
        }
        S.audio.play(p.big ? 'bigblast' : 'blast', f);
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

  /** Timed self-buffs: attack up (powerMs/powerMul) and/or guard (guardMs/guardMul). */
  buff(f, p) {
    const s = this.scene;
    f.lockFor(260);
    f.setPose('power', 320);
    const labels = [];
    if (p.powerMs) {
      f.powerUntil = s.clock + p.powerMs;
      f.powerMul = p.powerMul;
      labels.push(`ATTACK +${Math.round((p.powerMul - 1) * 100)}%`);
      s.fx.ring(f.pos.x, f.pos.y - 50, 0xff9040, 18, 120, 420);
    }
    if (p.guardMs) {
      f.guardUntil = s.clock + p.guardMs;
      f.guardMul = p.guardMul;
      labels.push('IRON BODY');
      s.fx.ring(f.pos.x, f.pos.y - 50, 0xc0c8d8, 24, 100, 420);
    }
    s.fx.popText(f.pos.x, f.pos.y - 150, labels.join(' + '), '#ffb070', 18);
    S.audio.play('restore');
  }

  /** Channel briefly to recover health. A heavy hit interrupts it. */
  heal(f, p) {
    const s = this.scene;
    let cancelled = false;
    f.locked = true;
    f.setPose('power');
    f.action = { cancel: () => { cancelled = true; f.locked = false; f.clearPose(); } };
    s.fx.ring(f.pos.x, f.pos.y - 50, 0x8dff96, 14, 70, p.chargeMs);
    s.after(p.chargeMs, () => {
      if (cancelled || !f.alive) return;
      f.action = null;
      f.locked = false;
      f.clearPose();
      const before = f.hp;
      f.hp = Math.min(f.maxHp, f.hp + p.amount);
      s.fx.ring(f.pos.x, f.pos.y - 50, 0x8dff96, 20, 110, 380);
      s.fx.popText(f.pos.x, f.pos.y - 150, `+${Math.round(f.hp - before)} HP`, '#8dff96');
      S.audio.play('restore');
    });
  }

  /** For a few seconds every projectile that reaches you is reflected. */
  mirror(f, p) {
    const s = this.scene;
    f.mirrorUntil = s.clock + p.durationMs;
    f.lockFor(200);
    f.setPose('block', 260);
    s.fx.ring(f.pos.x, f.pos.y - 60, 0xd8c8ff, 30, 70, p.durationMs);
    s.fx.popText(f.pos.x, f.pos.y - 150, 'MIRROR WARD', '#d8c8ff', 18);
    S.audio.play('parry');
  }

  /** Shadow Step: invulnerable, and free to walk onto the opponent's tiles, for a few seconds. */
  shadowStep(f, p) {
    const s = this.scene;
    const until = s.clock + p.durationMs;
    f.shadowUntil = until;
    f.invulnUntil = Math.max(f.invulnUntil, until);
    f.lockFor(120);
    s.fx.afterimage(f, 0x6a4c9c);
    s.fx.ring(f.pos.x, f.pos.y - 50, 0x6a4c9c, 30, 90, 300);
    S.audio.play('teleport');
    s.after(p.durationMs, () => {
      if (f.shadowUntil === until) this.endShadow(f);
    });
  }

  /** When Shadow Step ends on enemy ground, snap back to the nearest tile of your own. */
  endShadow(f) {
    const s = this.scene;
    const g = s.grid;
    f.shadowUntil = 0;
    const here = g.tile(f.col, f.row);
    if (!f.alive || (here && here.owner === f.side)) return;
    const options = g.openTiles(f).sort((a, b) =>
      (Math.abs(a.row - f.row) * 10 + Math.abs(a.col - f.col)) - (Math.abs(b.row - f.row) * 10 + Math.abs(b.col - f.col)));
    if (!options.length) return;
    s.fx.afterimage(f, 0x6a4c9c);
    f.placeAt(options[0].col, options[0].row);
    s.fx.dust(f.pos.x, f.pos.y);
    S.audio.play('teleport');
  }

  ascend(f, p) {
    const s = this.scene;
    if (!s.transform.ascend(f, { free: true })) {
      // Already at the highest unlocked form: convert the technique into Ki.
      KiSystem.restore(f, p.fallbackKi);
      s.fx.popText(f.pos.x, f.pos.y - 150, `+${p.fallbackKi} KI`, '#7fe8ff');
      S.audio.play('restore');
    }
  }
}
