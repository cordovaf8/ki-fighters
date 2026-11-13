// BattleScene: wires the independent systems together and runs the fight loop.
//
// States: intro -> select -> fight <-> (select | clash | paused) -> ended
// `this.clock` is the battle clock. It only advances during 'fight', so every
// cooldown and scheduled effect freezes while techniques are being chosen.
import Phaser from 'phaser';
import { Data, S } from '../core/data.js';
import { bus } from '../core/bus.js';
import { drawBackdrop } from '../systems/SpriteFactory.js';
import { GridSystem } from '../systems/GridSystem.js';
import { Fighter } from '../systems/Fighter.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { TechniqueSystem, Deck } from '../systems/TechniqueSystem.js';
import { FocusGaugeSystem } from '../systems/FocusGaugeSystem.js';
import { TransformationSystem } from '../systems/TransformationSystem.js';
import { EnemyAI } from '../systems/EnemyAI.js';
import { MeleeSystem } from '../systems/MeleeSystem.js';
import { EffectsSystem } from '../systems/EffectsSystem.js';

// All input arrives as named actions from the InputSystem, so the controller
// and the keyboard drive the fight through exactly the same code.
const MOVES = [
  ['left', -1, 0],
  ['right', 1, 0],
  ['up', 0, -1],
  ['down', 0, 1],
];

export class BattleScene extends Phaser.Scene {
  constructor() {
    super('Battle');
  }

  init(data) {
    this.setup = data; // { mode: 'arcade' | 'training', index, opponent, player }
  }

  create() {
    const cfg = Data.config;
    const me = this.setup.player;
    const opp = this.setup.opponent;
    const training = this.setup.mode === 'training';
    this.clock = 0;
    this.hitstopRemaining = 0;
    this.timers = [];
    this.pressed = new Set();
    this.state = 'intro';

    drawBackdrop(this, opp.stage);
    this.fx = new EffectsSystem(this);
    this.grid = new GridSystem(this, cfg.grid);
    this.combat = new CombatSystem(this);

    this.player = new Fighter(this, {
      side: 'player', id: me.id, def: me.def,
      stats: me.stats, maxForm: me.maxForm, col: 1, row: 1,
    });
    this.enemy = new Fighter(this, {
      side: 'enemy', id: opp.fighter, def: Data.fighters[opp.fighter],
      stats: opp.stats, maxForm: opp.maxForm, col: 4, row: 1,
    });
    this.player.foe = this.enemy;
    this.enemy.foe = this.player;
    this.grid.fighters = [this.player, this.enemy];

    this.techniques = new TechniqueSystem(this);
    this.transform = new TransformationSystem(this);
    this.melee = new MeleeSystem(this);
    this.gauge = new FocusGaugeSystem(training ? cfg.focusGauge.trainingFillMs : cfg.focusGauge.fillMs);
    this.deck = new Deck(me.deck, cfg.focusGauge.handSize);
    this.ai = new EnemyAI(this, this.enemy, opp);
    this.gauge.onFull = () => this.ai.refill();

    this.skipInput = false;
    this.bufferedMove = null;
    this.offBus = [
      bus.on('select:confirm', (indices) => this.confirmSelect(indices)),
      bus.on('pause:resume', () => this.resume()),
      S.input.on((type, action) => this.onAction(type, action)),
    ];
    this.events.once('shutdown', () => this.offBus.forEach((off) => off()));

    S.ui.hud.begin(this.player, this.enemy);
    S.ui.hud.banner(`VS ${this.enemy.name.toUpperCase()}`, 1100);
    this.time.delayedCall(1200, () => this.openSelect());
  }

  /** Schedule a callback on the battle clock (pauses with the fight). */
  after(ms, fn) {
    this.timers.push({ at: this.clock + ms, fn });
  }

  /** Brief impact pause; effects still render and combat timers stay frozen. */
  hitstop(ms) {
    this.hitstopRemaining = Math.max(this.hitstopRemaining, ms);
  }

  runTimers() {
    if (!this.timers.length) return;
    const due = this.timers.filter((t) => t.at <= this.clock);
    if (!due.length) return;
    this.timers = this.timers.filter((t) => t.at > this.clock);
    due.sort((a, b) => a.at - b.at).forEach((t) => t.fn());
  }

  /** Swallow presses made while paused so they do not fire when play resumes. */
  flushKeys() {
    this.player.stopKiCharge();
    this.pressed.clear();
    this.bufferedMove = null;
    this.skipInput = true; // also drop the very press that closed the menu
    this.player.chargeStart = null;
  }

  // ---- Technique selection -----------------------------------------------

  openSelect() {
    if (this.state !== 'fight' && this.state !== 'intro') return;
    this.state = 'select';
    this.player.stopBlock();
    this.player.stopKiCharge();
    this.player.chargeStart = null;
    S.ui.showSelect(this.deck.fillHand(), this.player);
    S.audio.play('confirm');
  }

  confirmSelect(indices) {
    if (this.state !== 'select') return;
    const picked = this.deck.commit(indices);
    this.player.queue = [...this.player.queue, ...picked].slice(0, 5);
    if (this.clock === 0) this.ai.refill();
    this.gauge.reset();
    S.ui.hideSelect();
    S.ui.hud.banner('FIGHT!', 700);
    this.flushKeys();
    this.state = 'fight';
  }

  // ---- Pause --------------------------------------------------------------

  pause() {
    this.player.stopKiCharge();
    this.state = 'paused';
    S.ui.showPause(this.setup.mode);
  }

  resume() {
    if (this.state !== 'paused') return;
    S.ui.hidePause();
    this.flushKeys();
    this.state = 'fight';
  }

  /** Button presses are queued here and consumed on the next fight frame. */
  onAction(type, action) {
    if (type !== 'down') return;
    if (this.state === 'fight') {
      this.pressed.add(action);
    } else if (this.state === 'clash' && (action === 'attack' || action === 'technique')) {
      this.combat.clashPress();
    }
  }

  // ---- Player input -------------------------------------------------------

  handleInput() {
    const input = S.input;
    const p = this.player;
    const pressed = this.pressed;
    const tapped = (action) => pressed.has(action);

    if (tapped('pause')) {
      pressed.clear();
      return this.pause();
    }
    if (tapped('focus')) {
      if (this.gauge.full) {
        pressed.clear();
        return this.openSelect();
      }
      S.audio.play('deny');
    }

    // Charging roots the fighter in the existing power-up pose. Other combat
    // inputs take priority, so RB always blocks even while RT is held.
    const chargeInterrupted = ['block', 'attack', 'melee', 'technique', 'vanish', 'transform', ...MOVES.map(([action]) => action)]
      .some((action) => input.isHeld(action));
    if (input.isHeld('kiCharge') && !chargeInterrupted) {
      p.stopBlock();
      p.startKiCharge();
      if (p.kiCharging) { this.bufferedMove = null; pressed.clear(); return; }
    } else p.stopKiCharge();

    // Tap to step one tile; hold a direction to keep moving. A tap that lands
    // during the short step cooldown is buffered so quick inputs are not lost.
    let heldDir = null;
    for (const [action, dc, dr] of MOVES) {
      const ms = input.heldMs(action);
      if (ms >= 0) heldDir = [dc, dr];
      if (tapped(action)) {
        if (p.move(dc, dr)) this.bufferedMove = null;
        else this.bufferedMove = { dc, dr, until: this.clock + 160 };
      } else if (ms > 190) p.move(dc, dr);
    }
    if (this.bufferedMove) {
      const b = this.bufferedMove;
      if (this.clock > b.until || p.move(b.dc, b.dr)) this.bufferedMove = null;
    }

    if (input.isHeld('block')) p.startBlock(tapped('block'));
    else p.stopBlock();

    const attackTap = tapped('attack');
    if (attackTap) {
      p.fireBlast(false);
      p.chargeNeed = Data.config.fighter.chargeMs;
      p.chargeStart = this.clock;
    }
    if (p.chargeStart !== null && !attackTap && !input.isHeld('attack')) {
      const held = this.clock - p.chargeStart;
      p.chargeStart = null;
      if (held >= Data.config.fighter.chargeMs) p.fireBlast(true);
    }

    if (tapped('melee') && !this.melee.press(p)) S.audio.play('deny');
    if (tapped('technique')) this.useTechnique();
    if (tapped('vanish')) {
      if (!p.vanish(false, heldDir) && p.canAct()) S.audio.play('deny');
    }
    if (tapped('transform')) this.transform.toggle(p);
    pressed.clear();
  }

  useTechnique() {
    const p = this.player;
    const tech = p.queue[0];
    if (!tech) {
      S.audio.play('deny');
      return;
    }
    const result = this.techniques.execute(p, tech);
    if (result === 'ok') {
      p.queue.shift();
    } else if (result === 'noki') {
      this.fx.popText(p.pos.x, p.pos.y - 150, `NEED ${tech.kiCost} KI`, '#ff7070');
      S.audio.play('deny');
    }
  }

  // ---- Main loop ----------------------------------------------------------

  update(time, delta) {
    const frozen = this.state === 'fight' ? Math.min(this.hitstopRemaining, delta) : 0;
    this.hitstopRemaining -= frozen;
    const dt = Math.min(delta - frozen, 50);

    if (this.state === 'fight' && dt > 0) {
      if (this.skipInput) {
        this.pressed.clear();
        this.skipInput = false;
      }
      this.clock += dt;
      this.runTimers();
      this.handleInput();
      if (this.state === 'fight') {
        this.ai.update();
        for (const f of [this.player, this.enemy]) {
          f.update(dt);
          this.transform.update(f, dt);
        }
        this.combat.update(dt);
        this.grid.update();
        this.gauge.update(dt);
        if (this.setup.mode === 'training') this.keepSparring();
        if (this.state === 'fight' && (!this.player.alive || !this.enemy.alive)) this.finish(this.player.alive);
      }
    } else if (this.state === 'clash') {
      this.combat.updateClash(dt);
    }

    this.combat.drawBeams(time);
    this.player.render(time);
    this.enemy.render(time);
    S.ui.hud.update(this.player, this.enemy, this.gauge);
  }

  /** Training mode: nobody can lose, health just tops back up. */
  keepSparring() {
    for (const f of [this.player, this.enemy]) {
      if (f.hp < f.maxHp * 0.3) {
        f.hp = f.maxHp;
        this.fx.popText(f.pos.x, f.pos.y - 150, 'HP RESTORED', '#8fffa0');
      }
    }
  }

  finish(win) {
    this.state = 'ended';
    this.combat.stopAll();
    this.grid.update();
    const loser = win ? this.enemy : this.player;
    S.audio.play('ko');
    S.ui.hud.banner('K.O.!', 1500);
    this.fx.flash(220);
    this.fx.shake(500, 0.015);
    this.fx.explosion(loser.pos.x, loser.pos.y - 60, 80, 0xffffff);
    this.tweens.add({ targets: loser.sprite, angle: -90 * loser.facing, duration: 450, ease: 'Cubic.easeIn' });
    this.time.delayedCall(1700, () => {
      S.audio.play(win ? 'win' : 'lose');
      bus.emit('battle:end', {
        win, mode: this.setup.mode, index: this.setup.index,
        ms: this.clock, dealt: this.enemy.maxHp - Math.max(0, this.enemy.hp),
      });
    });
  }
}
