// RunSystem: one run = one sitting. A run starts fresh, climbs the whole
// ladder in order, and everything earned along the way (levels, stat boosts,
// new techniques, transformations) lives only in memory for that run.
// Nothing here is ever saved; closing the page ends the run.
import { Data } from '../core/data.js';

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export class RunSystem {
  constructor() {
    this.active = false;
    this.reset();
  }

  get cfg() { return Data.config.run; }
  get ladder() { return Data.opponents.ladder; }
  get fighterDef() { return Data.fighters[this.fighterId]; }
  get opponent() { return this.ladder[this.stage]; }
  get level() { return this.wins + 1; }
  get complete() { return this.stage >= this.ladder.length; }

  reset() {
    this.fighterId = this.fighterId || 'jin';
    this.stage = 0; // index of the next opponent
    this.wins = 0;
    this.continues = Data.config ? this.cfg.continues : 0;
    this.continuesUsed = 0;
    this.bonus = { hp: 0, ki: 0, atk: 0, def: 0 };
    this.deck = Data.starterDeck ? [...Data.starterDeck] : [];
    this.picks = []; // reward names, in the order they were taken
    this.fightMs = 0;
    this.damageDealt = 0;
    this.offer = null; // reward choices waiting to be picked
  }

  start() {
    this.reset();
    this.active = true;
  }

  end() {
    this.active = false;
    this.offer = null;
  }

  // ---- The fighter's power within this run --------------------------------

  /** Base stats, plus growth per win, plus reward boosts. */
  stats() {
    const base = this.fighterDef.stats;
    const grow = this.cfg.perWin;
    const w = this.wins;
    return {
      hp: base.hp + w * grow.hp + this.bonus.hp,
      ki: base.ki + w * (grow.ki || 0) + this.bonus.ki,
      atk: base.atk + w * grow.atk + this.bonus.atk,
      def: base.def + w * grow.def + this.bonus.def,
    };
  }

  /** Highest transformation the run has unlocked so far. */
  maxForm(wins = this.wins) {
    let max = 0;
    this.fighterDef.forms.forEach((f, i) => {
      if ((f.unlockWins ?? 0) <= wins) max = i;
    });
    return max;
  }

  /** The player spec a battle needs. Training gets every form to practise with. */
  playerSpec(mode) {
    if (mode === 'training') {
      return {
        id: this.fighterId,
        def: this.fighterDef,
        stats: { ...this.fighterDef.stats },
        maxForm: this.fighterDef.forms.length - 1,
        deck: [...Data.starterDeck],
      };
    }
    return { id: this.fighterId, def: this.fighterDef, stats: this.stats(), maxForm: this.maxForm(), deck: [...this.deck] };
  }

  // ---- Fight results -------------------------------------------------------

  /** Called after an arcade win. Returns what changed, for the result screen. */
  recordWin(fight) {
    const formsBefore = this.maxForm();
    this.fightMs += fight.ms;
    this.damageDealt += fight.dealt;
    this.wins++;
    this.stage++;
    const forms = [];
    for (let i = formsBefore + 1; i <= this.maxForm(); i++) forms.push(this.fighterDef.forms[i].name);
    if (!this.complete) this.offer = this.makeOffer(this.ladder[this.stage - 1]);
    return { growth: this.cfg.perWin, forms };
  }

  /** Called after an arcade loss. */
  recordLoss(fight) {
    this.fightMs += fight.ms;
    this.damageDealt += fight.dealt;
  }

  useContinue() {
    if (this.continues <= 0) return false;
    this.continues--;
    this.continuesUsed++;
    return true;
  }

  // ---- Rewards -------------------------------------------------------------

  /**
   * Three choices after each win: a technique the beaten opponent "teaches",
   * a second technique from anywhere, and a permanent-for-this-run stat boost.
   */
  makeOffer(beaten) {
    const techIds = Object.keys(Data.techniques);
    const first = pickRandom(beaten.rewards);
    const others = techIds.filter((id) => id !== first);
    const second = pickRandom(others);
    const boost = pickRandom(this.cfg.boosts);
    return [
      { kind: 'tech', id: first, from: beaten.fighter },
      { kind: 'tech', id: second },
      { kind: 'boost', ...boost },
    ];
  }

  takeReward(index) {
    const choice = this.offer?.[index];
    if (!choice) return null;
    if (choice.kind === 'tech') {
      this.deck.push(choice.id);
      this.picks.push(Data.techniques[choice.id].name);
    } else {
      this.bonus[choice.stat] += choice.amount;
      this.picks.push(choice.name);
    }
    this.offer = null;
    return choice;
  }

  // ---- End of run -----------------------------------------------------------

  summary() {
    const done = this.complete;
    const mins = this.fightMs / 60000;
    let grade = null;
    if (done) {
      if (this.continuesUsed === 0 && mins <= this.cfg.sRankMinutes) grade = 'S';
      else if (this.continuesUsed === 0) grade = 'A';
      else if (this.continuesUsed === 1) grade = 'B';
      else grade = 'C';
    }
    return {
      complete: done,
      wins: this.wins,
      total: this.ladder.length,
      reached: this.ladder[Math.min(this.stage, this.ladder.length - 1)].fighter,
      fightTime: this.fightMs,
      continuesUsed: this.continuesUsed,
      damageDealt: Math.round(this.damageDealt),
      level: this.level,
      picks: [...this.picks],
      grade,
    };
  }
}
