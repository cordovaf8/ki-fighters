// HTML interface: title, menus, the run hub, rewards, technique selection,
// pause, results and the end-of-run summary. Phaser renders the fight; the DOM renders the rest.
//
// Every screen is fully controller-navigable: the D-pad / left stick moves a
// focus cursor between buttons, A activates, B goes back. The keyboard and
// mouse use the same focus cursor.
import { Data, S } from '../core/data.js';
import { bus } from '../core/bus.js';
import { Deck } from '../systems/TechniqueSystem.js';
import { Hud } from './Hud.js';
import { P, pad, key } from './prompts.js';
import { rosterImages } from '../assets/roster-images.js';

const PORTRAITS = { jin: 0, sparring: 1, brakka: 5, selune: 6, vorr: 2, zeta: 4, draal: 10 };

const DIR = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
const FOCUSABLE = '[data-act], input[data-set]';

// Rows of the controls table: [what it does, controller buttons, keyboard keys]
const CONTROLS = [
  ['Move between your tiles', `${pad('dpad')} or ${pad('stick')}`, `${key('W A S D')} / ${key('Arrows')}`],
  ['Ki blast &mdash; hold and release to fire a charged blast', pad('x'), `${key('J')} / ${key('Z')}`],
  ['Punch combo: press up to 3 times. Hits the tile right in front of you', pad('y'), `${key('H')} / ${key('V')}`],
  ['Use your next selected technique', pad('a'), `${key('K')} / ${key('X')}`],
  ['Vanish (teleport, costs Ki). Hold a direction to aim it', pad('b'), key('Space')],
  ['Transform, or power down', pad('lt'), `${key('T')} / ${key('F')}`],
  ['Block (hold). Drains stamina', pad('rb'), `${key('L')} / ${key('C')}`],
  ['Charge Ki (hold). Stand still to restore energy', pad('rt'), key('R')],
  ['Open technique selection when Focus is full', pad('lb'), `${key('E')} / ${key('Enter')}`],
  ['Pause', pad('start'), `${key('Esc')} / ${key('P')}`],
  ['Menus: move, select, back', `${pad('dpad')} ${pad('a')} ${pad('b')}`, `${key('Arrows')} ${key('Enter')} ${key('Esc')}`],
];

export class UI {
  constructor() {
    this.root = document.getElementById('ui');
    this.hud = new Hud();
    this.sel = null;
    this.last = null;
    this.paused = false;
    this.toastTimer = null;

    this.root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      S.audio.unlock();
      if (el.classList.contains('disabled')) {
        S.audio.play('deny');
        return;
      }
      this.act(el.dataset.act, el.dataset);
    });
    this.root.addEventListener('input', (e) => {
      const el = e.target.closest('[data-set]');
      if (el) this.setSetting(el.dataset.set, el);
    });
    // The mouse and Tab key share the controller's cursor, so there is one highlight.
    // (mousemove, not mouseover: a resting pointer must never steal the cursor
    // from the controller when a screen re-renders underneath it.)
    this.root.addEventListener('mousemove', (e) => {
      const el = e.target.closest(FOCUSABLE);
      if (el && el !== this.focused()) this.setFocus(el, false);
    });
    this.root.addEventListener('focusin', (e) => {
      const el = e.target.closest(FOCUSABLE);
      if (el && el !== this.focused()) this.setFocus(el, false);
    });
    // Keyboard shortcuts for technique selection: 1-5 pick, Enter confirms.
    window.addEventListener('keydown', (e) => {
      if (!this.sel || e.repeat) return;
      if (e.key === 'Enter') e.preventDefault(); // stop Enter "clicking" the focused card
      this.selectKey(e.key);
    });

    S.input.on((type, action, device) => this.onInput(type, action, device));
    bus.on('battle:end', (r) => this.showResult(r));
    bus.on('input:pad', (info) => this.onPadChange(info));

    // A run lives only in this page, so ask before the tab is closed mid-run.
    window.addEventListener('beforeunload', (e) => {
      if (!S.run.active) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  // ---- Focus cursor and navigation ---------------------------------------

  /** The part of the screen the cursor may visit: the topmost overlay, if any. */
  scope() {
    const overlays = this.root.querySelectorAll('.overlay');
    return overlays.length ? overlays[overlays.length - 1] : this.root;
  }

  focusables() {
    return [...this.scope().querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  }

  /** Identifies a control so focus can be restored after a screen re-renders. */
  signature(el) {
    const d = el.dataset;
    return [d.act, d.i, d.id, d.stat, d.set].join('|');
  }

  /**
   * Moves the cursor. The cursor is our own "kfocus" class rather than the
   * browser's :focus state, so it stays visible and usable with a controller
   * even when the page itself does not hold keyboard focus.
   */
  setFocus(el, scroll = true) {
    if (!el) return;
    this.root.querySelectorAll('.kfocus').forEach((x) => x.classList.remove('kfocus'));
    el.classList.add('kfocus');
    if (document.activeElement !== el) el.focus({ preventScroll: true });
    if (scroll) el.scrollIntoView({ block: 'nearest' });
  }

  render(html) {
    const active = this.focused();
    const previous = active ? this.signature(active) : null;
    this.root.innerHTML = html;
    if (!html) return;
    const items = this.focusables();
    const target =
      (previous && items.find((el) => this.signature(el) === previous)) ||
      this.scope().querySelector('[data-default]') ||
      items.find((el) => !('back' in el.dataset)) ||
      items[0];
    this.setFocus(target);
  }

  focused() {
    return this.root.querySelector('.kfocus');
  }

  /** Controller / keyboard actions while any menu or overlay is on screen. */
  onInput(type, action, device) {
    if (type === 'up' || !this.root.firstElementChild) return;
    if (action in DIR) return this.navigate(action, device);
    if (type !== 'down') return;
    switch (action) {
      case 'confirm': // controller A (keyboard Enter/Space click natively)
        if (device === 'pad') {
          this.focused()?.click();
          this.checkSound();
        }
        break;
      case 'back':
        this.scope().querySelector('[data-back]')?.click();
        break;
      case 'alt':
        if (this.sel && device === 'pad') this.confirmSelect();
        break;
      case 'pause':
        if (this.sel && device === 'pad') this.confirmSelect();
        else if (this.paused) bus.emit('pause:resume');
        break;
      default:
    }
  }

  /** Moves the focus cursor to the nearest control in a direction. */
  navigate(dir, device) {
    const items = this.focusables();
    if (!items.length) return this.scrollBy(dir);
    const cur = this.focused();
    if (!cur) return this.setFocus(items[0]);

    // On a slider, left/right change the value instead of moving away.
    if (cur.type === 'range' && (dir === 'left' || dir === 'right')) {
      if (device === 'pad') {
        if (dir === 'right') cur.stepUp();
        else cur.stepDown();
        cur.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }

    const [vx, vy] = DIR[dir];
    const a = cur.getBoundingClientRect();
    const ax = a.left + a.width / 2;
    const ay = a.top + a.height / 2;
    let best = null;
    let bestScore = Infinity;
    for (const el of items) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect();
      const dx = r.left + r.width / 2 - ax;
      const dy = r.top + r.height / 2 - ay;
      const along = dx * vx + dy * vy;
      const across = Math.abs(dx * vy + dy * vx);
      if (along <= 2) continue;
      const score = along + across * 2.5 + (across > along * 3 ? 5000 : 0);
      if (score < bestScore) {
        best = el;
        bestScore = score;
      }
    }
    if (best) {
      this.setFocus(best);
      S.audio.play('move');
    } else {
      this.scrollBy(dir);
    }
  }

  scrollBy(dir) {
    if (dir === 'up' || dir === 'down') this.root.querySelector('.scroll')?.scrollBy(0, dir === 'down' ? 70 : -70);
  }

  // ---- Controller status --------------------------------------------------

  padStatus() {
    const input = S.input;
    return input.padConnected
      ? `<span class="pad-on">Controller connected</span> &middot; ${input.padName}`
      : '<span class="pad-off">No controller detected</span> &middot; connect one and press any button, or play on keyboard';
  }

  onPadChange(info) {
    this.toast(info.connected ? `Controller connected: ${info.name}` : 'Controller disconnected');
    this.root.querySelectorAll('[data-padstatus]').forEach((el) => {
      el.innerHTML = this.padStatus();
    });
  }

  /** Once per session, explain how to switch sound on if the browser blocked it. */
  checkSound() {
    if (this.soundHintShown) return;
    setTimeout(() => {
      if (S.audio.running || this.soundHintShown) return;
      this.soundHintShown = true;
      this.toast('Sound is off: click the game or press any key once to turn it on');
    }, 400);
  }

  toast(text) {
    const el = document.getElementById('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }


  // ---- Actions ------------------------------------------------------------

  act(name, d) {
    const audio = S.audio;
    const run = S.run;
    switch (name) {
      case 'menu': audio.play('select'); return this.menu();
      case 'hub': audio.play('select'); return this.hub();
      case 'help': audio.play('select'); return this.help();
      case 'settings': audio.play('select'); return this.settings();
      case 'characters':
        this.characterReturn = d.from || (run.active ? 'hub' : 'menu');
        if (this.characterReturn === 'training') this.exitBattle();
        audio.play('select');
        return this.characters();
      case 'character-back':
        if (this.characterReturn === 'training') return this.startBattle('training', 0);
        return run.active ? this.hub() : this.menu();
      case 'choose-character':
        if (!Data.fighters[d.id]?.playable) return audio.play('deny');
        run.fighterId = d.id;
        audio.play('confirm');
        if (this.characterReturn === 'training') return this.startBattle('training', 0);
        this.goScene('Menu');
        return run.active ? this.hub() : this.menu();
      case 'new-run':
        run.start();
        audio.play('confirm');
        this.goScene('Menu');
        return this.hub();
      case 'fight-next': return this.startBattle('arcade', run.stage);
      case 'training': return this.startBattle('training', 0);
      case 'restart-training': return this.startBattle('training', 0);
      case 'leave-training': return this.leaveBattle();
      case 'resume': return bus.emit('pause:resume');
      case 'forfeit': return this.forfeit();
      case 'continue':
        if (!run.useContinue()) return audio.play('deny');
        return this.startBattle('arcade', run.stage);
      case 'reward': return this.takeReward(Number(d.i));
      case 'reward-screen': audio.play('select'); return this.rewards();
      case 'results': return this.summary();
      case 'abandon': audio.play('select'); return this.hub(true);
      case 'abandon-yes': return this.summary();
      case 'pick': return this.pick(Number(d.i));
      case 'confirm': return this.confirmSelect();
      default:
    }
  }

  setSetting(name, el) {
    const st = S.settings.values;
    if (el.type === 'checkbox') st[name] = el.checked;
    else st[name] = Number(el.value);
    S.audio.applySettings();
    S.settings.persist();
    if (name === 'sfx') S.audio.play('select');
    if (name === 'rumble' && el.checked) S.input.rumble(200, 0.6, 0.8);
  }

  goScene(name, data) {
    const sm = S.game.scene;
    for (const k of ['Menu', 'Battle']) {
      if (sm.isActive(k) || sm.isPaused(k)) sm.stop(k);
    }
    sm.start(name, data);
  }

  startBattle(mode, index) {
    const opponent = mode === 'training' ? Data.opponents.training : Data.opponents.ladder[index];
    if (!opponent) return this.menu();
    this.last = { mode, index };
    this.sel = null;
    this.paused = false;
    this.render('');
    document.activeElement?.blur();
    S.audio.unlock();
    S.audio.play('confirm');
    S.audio.startMusic();
    this.goScene('Battle', { mode, index, opponent, player: S.run.playerSpec(mode) });
  }

  /** Leave the fight scene and go back to the menu backdrop. */
  exitBattle() {
    S.audio.stopMusic();
    this.hud.hide();
    this.sel = null;
    this.paused = false;
    this.goScene('Menu');
  }

  leaveBattle() {
    this.exitBattle();
    if (S.run.active) this.hub();
    else this.menu();
  }

  /** Giving up a run fight from the pause menu counts as losing it. */
  forfeit() {
    const sc = S.game.scene.getScene('Battle');
    const payload = {
      win: false, mode: 'arcade', index: S.run.stage,
      ms: sc?.clock || 0, dealt: sc ? sc.enemy.maxHp - Math.max(0, sc.enemy.hp) : 0,
    };
    this.paused = false;
    if (sc) sc.state = 'ended';
    this.showResult(payload);
  }

  // ---- Shared pieces ------------------------------------------------------

  backButton() {
    const target = S.run.active ? 'hub' : 'menu';
    return `<button class="btn sm ghost" data-act="${target}" data-back>${P('back')} Back</button>`;
  }

  footer(extra = '') {
    return `<footer class="navhint for-pad">${pad('dpad')} Move ${pad('a')} Select ${extra}</footer>`;
  }

  continuesPips() {
    const run = S.run;
    const total = Data.config.run.continues;
    const pips = Array.from({ length: total }, (_, i) => `<i class="${i < run.continues ? 'on' : ''}"></i>`).join('');
    return `<span class="pips" title="Continues left">${pips}</span>`;
  }

  /** The ladder as a row of five stops: beaten, next, and still hidden. */
  ladderTrack() {
    const run = S.run;
    return `<div class="track">${run.ladder
      .map((o, i) => {
        const f = Data.fighters[o.fighter];
        const state = i < run.stage ? 'done' : i === run.stage ? 'now' : 'later';
        return `<div class="stop ${state}"><b>${i + 1}</b><span>${state === 'later' ? '???' : f.name}</span></div>`;
      })
      .join('')}</div>`;
  }

  formatTime(ms) {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ---- Menu screens -------------------------------------------------------

  title() {
    this.render(`
      <div class="screen title">
        <h1 class="logo">KI<br>LEGENDS</h1>
        <p class="tagline">Grid battles. Ki blasts. Beam clashes.</p>
        <button class="btn big" data-act="menu" data-default>${P('confirm')} Start</button>
        <p class="padstatus" data-padstatus>${this.padStatus()}</p>
        <p class="fine">An original grid-battle arena game &middot; Built with Phaser 4 &middot; Best played with a controller</p>
      </div>`);
  }

  menu() {
    this.render(`
      <div class="screen">
        <h1 class="logo small">KI LEGENDS</h1>
        <p class="pitch">Five fighters stand between you and the top. Beat them all in one sitting:
          grow stronger after every win, pick new techniques, and unlock transformations as you climb.
          Every run starts fresh.</p>
        <div class="menu">
          <button class="btn" data-act="new-run" data-default>Start Run</button>
          <button class="btn" data-act="training">Training</button>
          <button class="btn" data-act="characters" data-from="menu">Character: ${S.run.fighterDef.name}</button>
          <button class="btn" data-act="help">Controls &amp; How to Play</button>
          <button class="btn" data-act="settings">Settings</button>
        </div>
        ${this.footer()}
      </div>`);
  }

  /** Between fights: who is next, how strong you are now, and your deck. */
  characters() {
    this.render(`
      <div class="screen full character-screen">
        <header><h2>Choose Your Fighter</h2><button class="btn sm ghost" data-act="character-back" data-back>${P('back')} Back</button></header>
        <p class="note">Choose from all 12 fighters for your runs and training.</p>
        <div class="character-grid scroll">${Object.entries(Data.fighters).filter(([, f]) => f.playable).map(([id, f]) => `
          <button class="fighter-card ${id === S.run.fighterId ? 'selected' : ''}" data-act="choose-character" data-id="${id}" aria-pressed="${id === S.run.fighterId}" ${id === S.run.fighterId ? 'data-default' : ''}>
            <img src="${rosterImages[f.rosterCell ?? PORTRAITS[id]]}" alt="" />
            <strong>${f.name}</strong><span>${f.title}</span>
            <small>${f.forms.slice(1).map(form => form.name).join(' · ')}</small>
          </button>`).join('')}</div>
        ${this.footer()}
      </div>`);
  }

  hub(confirmAbandon = false) {
    const run = S.run;
    if (!run.active) return this.menu();
    const opp = run.opponent;
    const foe = Data.fighters[opp.fighter];
    const def = run.fighterDef;
    const st = run.stats();
    const counts = {};
    for (const id of run.deck) counts[id] = (counts[id] || 0) + 1;
    const deck = Object.entries(counts)
      .map(([id, n]) => {
        const t = Data.techniques[id];
        return `<span class="dchip school-${t.school}">${t.name}${n > 1 ? ` <b>&times;${n}</b>` : ''}</span>`;
      })
      .join('');
    const forms = def.forms
      .slice(1)
      .map((f) => {
        const open = (f.unlockWins ?? 0) <= run.wins;
        const need = f.unlockWins - run.wins;
        return `<li class="${open ? 'open' : 'shut'}"><b>${f.name}</b>
          <span>${open ? `Ready &middot; ${f.kiCost} Ki to enter, ${f.drain} Ki/s` : `Unlocks after ${need} more win${need > 1 ? 's' : ''}`}</span></li>`;
      })
      .join('');
    const isFinal = run.stage === run.ladder.length - 1;
    this.render(`
      <div class="screen full">
        <header>
          <h2>${isFinal ? 'Final Fight' : `Fight ${run.stage + 1}`} <span class="count">of ${run.ladder.length}</span></h2>
          <div class="runmeta">Continues ${this.continuesPips()}</div>
        </header>
        ${this.ladderTrack()}
        <div class="hub">
          <section class="hubcard foe">
            <h3>Next opponent</h3>
            <div class="hname">${foe.name}</div>
            <div class="hsub">${foe.title} &middot; ${foe.archetype}</div>
            <p class="hblurb">${opp.blurb}</p>
            <div class="hstats"><span>Health <b>${opp.stats.hp}</b></span><span>Attack <b>${opp.stats.atk}</b></span><span>Defense <b>${opp.stats.def}</b></span></div>
          </section>
          <section class="hubcard me">
            <h3>${def.name} &middot; Lv ${run.level}</h3>
            <div class="hstats"><span>Health <b>${st.hp}</b></span><span>Ki <b>${st.ki}</b></span><span>Attack <b>${st.atk}</b></span><span>Defense <b>${st.def}</b></span></div>
            <ul class="forms compact">${forms}</ul>
            <div class="deckline"><span class="dlabel">Deck &middot; ${run.deck.length}</span>${deck}</div>
          </section>
        </div>
        <div class="hubbtns">
          <button class="btn big" data-act="fight-next" data-default>${P('confirm')} Fight ${foe.name}</button>
          <button class="btn sm ghost" data-act="help">Controls</button>
          <button class="btn sm ghost" data-act="characters" data-from="hub">Change Character</button>
          <button class="btn sm ghost" data-act="settings">Settings</button>
          <button class="btn sm ghost" data-act="abandon">End run</button>
        </div>
        ${confirmAbandon ? `
          <div class="overlay">
            <div class="panel narrow">
              <h2>End this run?</h2>
              <p class="note">Runs are not saved. You will see your results, then start over from fight 1 next time.</p>
              <button class="btn ghost" data-act="hub" data-back data-default>${P('back')} Keep going</button>
              <button class="btn warn" data-act="abandon-yes">End run</button>
            </div>
          </div>` : ''}
      </div>`);
  }

  /** After a win: three choices, take one. */
  rewards() {
    const run = S.run;
    const offer = run.offer;
    if (!offer) return this.hub();
    const cards = offer
      .map((c, i) => {
        if (c.kind === 'boost') {
          return `
            <button class="card reward school-boost" data-act="reward" data-i="${i}" ${i === 0 ? 'data-default' : ''}>
              <span class="ctype">Boost</span>
              <strong>${c.name}</strong>
              <span class="cpow">+${c.amount}</span>
              <span class="cdesc">${c.desc}</span>
              <span class="cschool">Stat boost</span>
            </button>`;
        }
        const t = Data.techniques[c.id];
        const have = run.deck.filter((x) => x === c.id).length;
        return `
          <button class="card reward school-${t.school}" data-act="reward" data-i="${i}" ${i === 0 ? 'data-default' : ''}>
            <span class="ctype">${t.type}</span>
            <strong>${t.name}</strong>
            <span class="cpow">${t.power}</span>
            <span class="cdesc">${t.desc}</span>
            <span class="ccost">${t.kiCost ? `${t.kiCost} Ki` : 'Free'} &middot; ${have ? `you have ${have}` : 'new'}</span>
            <span class="cschool">${c.from ? `Learned from ${Data.fighters[c.from].name}` : Data.schools[t.school].name}</span>
          </button>`;
      })
      .join('');
    this.render(`
      <div class="overlay">
        <div class="panel">
          <h2>Choose a Reward</h2>
          <p class="note">Techniques join your deck. Boosts last until the run ends.</p>
          <div class="hand">${cards}</div>
          <div class="navhint for-pad">${pad('dpad')} Choose ${pad('a')} Take it</div>
        </div>
      </div>`);
  }

  takeReward(i) {
    const choice = S.run.takeReward(i);
    if (!choice) return;
    S.audio.play('confirm');
    this.toast(choice.kind === 'tech' ? `${Data.techniques[choice.id].name} added to your deck` : `${choice.name}: ${choice.desc}`);
    this.exitBattle();
    this.hub();
  }

  /** End of a run, finished or not. The run is over once this is shown. */
  summary() {
    const run = S.run;
    if (!run.active) return this.menu();
    const s = run.summary();
    run.end();
    this.exitBattle();
    const reached = Data.fighters[s.reached].name;
    const headline = s.complete ? 'RUN COMPLETE' : 'RUN OVER';
    const line = s.complete
      ? 'You beat all five fighters in one sitting.'
      : `Defeated ${s.wins} of ${s.total} &middot; fell to ${reached}.`;
    const picks = s.picks.length ? s.picks.map((n) => `<span class="pill">${n}</span>`).join('') : '<span class="muted">None</span>';
    this.render(`
      <div class="overlay">
        <div class="panel narrow summary ${s.complete ? 'win' : 'lose'}">
          <h1>${headline}</h1>
          ${s.grade ? `<div class="grade g-${s.grade}">${s.grade}</div>` : ''}
          <p>${line}</p>
          <table class="sumtable">
            <tr><td>Opponents defeated</td><td>${s.wins} / ${s.total}</td></tr>
            <tr><td>Fight time</td><td>${this.formatTime(s.fightTime)}</td></tr>
            <tr><td>Continues used</td><td>${s.continuesUsed}</td></tr>
            <tr><td>Damage dealt</td><td>${s.damageDealt}</td></tr>
            <tr><td>Final level</td><td>${s.level}</td></tr>
          </table>
          <div class="picks"><span class="dlabel">Rewards taken</span>${picks}</div>
          <button class="btn" data-act="new-run" data-default>${P('confirm')} New run</button>
          <button class="btn ghost" data-act="menu" data-back>Main menu</button>
        </div>
      </div>`);
  }

  help() {
    const rows = CONTROLS.map(([what, padKeys, keys]) => `<tr><td class="cpad">${padKeys}</td><td>${what}</td><td class="ckeys">${keys}</td></tr>`).join('');
    const c = Data.config.run;
    this.render(`
      <div class="screen full">
        <header><h2>Controls &amp; How to Play</h2>${this.backButton()}</header>
        <div class="scroll">
          <table class="keys">
            <tr><th>Controller</th><th>Action</th><th>Keyboard</th></tr>
            ${rows}
          </table>
          <h3>A run</h3>
          <ul class="tips two">
            <li>A run is one sitting: fight all five opponents in a row, from the canyon brawler to the warlord at the top.</li>
            <li>Every win levels you up (+${c.perWin.hp} Health, +${c.perWin.atk} Attack, +${c.perWin.def} Defense) and lets you pick one of three rewards: a new technique for your deck, or a stat boost.</li>
            <li>Jin's final transformation, Tempest Ascended, unlocks after 2 wins and fires charged lightning beams.</li>
            <li>Health is full again at the start of every fight. Lose and you can spend one of your ${c.continues} continues to retry that fight.</li>
            <li>Nothing carries over: when the run ends you get a results screen, and the next run starts fresh. Only your settings are remembered.</li>
          </ul>
          <h3>Battle basics</h3>
          <ul class="tips two">
            <li>You fight on the blue tiles, your opponent on the red. Blasts travel along a row, so line up to hit and step away to dodge.</li>
            <li>When the <b>Focus Gauge</b> fills, press ${P('focus')} to pause and pick up to three techniques of the same school. Unpicked cards stay in your hand.</li>
            <li>Flashing tiles warn of an incoming beam, rush or explosion. Move, block or Vanish.</li>
            <li>Press and hold ${P('block')} just before a basic or charged blast hits to <b>parry</b> it back. The perfect window is ${Data.config.parry.windowMs} ms. Holding block longer guards normally; special attacks cannot be reflected.</li>
            <li><b>Melee</b> reaches only the tile directly in front of you, so step up to the front line first. Press ${P('melee')} up to three times: two quick punches, then an uppercut that knocks the opponent back a tile. Blocking cuts the damage.</li>
            <li>Fire a beam into an enemy beam to start a <b>Beam Clash</b>, then mash ${P('attack')}.</li>
            <li>Transforming boosts attack and speed but burns Ki every second.</li>
            <li>Cracked tiles collapse when stepped off. Captured tiles shrink a fighter's territory.</li>
          </ul>
        </div>
        <footer class="navhint for-pad">${pad('dpad')} Scroll ${pad('b')} Back</footer>
      </div>`);
  }

  settings() {
    const st = S.settings.values;
    this.render(`
      <div class="screen full">
        <header><h2>Settings</h2>${this.backButton()}</header>
        <div class="setlist">
          <label>Sound effects <input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-set="sfx" data-default></label>
          <label>Music <input type="range" min="0" max="1" step="0.05" value="${st.music}" data-set="music"></label>
          <label class="check">Screen shake <input type="checkbox" ${st.shake ? 'checked' : ''} data-set="shake"></label>
          <label class="check">Controller vibration <input type="checkbox" ${st.rumble ? 'checked' : ''} data-set="rumble"></label>
          <p class="padstatus" data-padstatus>${this.padStatus()}</p>
          <p class="note">These settings are remembered. Runs are not: every run starts fresh.</p>
        </div>
        <footer class="navhint for-pad">${pad('dpad')} Move / adjust ${pad('a')} Toggle ${pad('b')} Back</footer>
      </div>`);
  }

  // ---- Technique selection (during battle) --------------------------------

  showSelect(hand, player) {
    this.sel = { hand: [...hand], picked: [], ki: Math.floor(player.ki), slots: Math.max(0, 5 - player.queue.length) };
    this.renderSelect();
  }

  hideSelect() {
    this.sel = null;
    this.render('');
  }

  renderSelect() {
    const { hand, picked, ki } = this.sel;
    const max = Math.min(Data.config.focusGauge.maxSelect, this.sel.slots);
    const pickedIds = picked.map((i) => hand[i]);
    const cards = hand
      .map((id, i) => {
        const t = Data.techniques[id];
        const on = picked.includes(i);
        const ok = on || (picked.length < max && Deck.compatible(pickedIds, id));
        return `
          <button class="card school-${t.school} ${on ? 'on' : ''} ${ok ? '' : 'dim'}" data-act="pick" data-i="${i}" ${i === 0 ? 'data-default' : ''} aria-pressed="${on}">
            <span class="ckey for-keys">${i + 1}</span>
            <span class="ctype">${t.type}</span>
            <strong>${t.name}</strong>
            <span class="cpow">${t.power}</span>
            <span class="cdesc">${t.desc}</span>
            <span class="ccost ${t.kiCost > ki ? 'short' : ''}">${t.kiCost ? `${t.kiCost} Ki` : 'Free'}</span>
            <span class="cschool">${Data.schools[t.school].name}</span>
          </button>`;
      })
      .join('');
    const found = pickedIds.length ? Deck.findCombo(pickedIds) : null;
    let summary = '<span class="muted">Pick up to ' + max + ' techniques of the same school.</span>';
    if (found) summary = `<span class="fuse">COMBO &rarr; ${found.combo.name}</span> <span class="muted">${found.combo.desc}</span>`;
    else if (pickedIds.length) summary = pickedIds.map((id) => `<span class="pill">${Data.techniques[id].name}</span>`).join('');
    this.render(`
      <div class="overlay select">
        <div class="panel">
          <h2>Choose Techniques <span class="count">Ki ${ki}</span></h2>
          <div class="hand">${cards}</div>
          <div class="summary">${summary}</div>
          <button class="btn" data-act="confirm">${P('selectConfirm')} ${pickedIds.length ? 'Confirm' : 'Skip'}</button>
          <div class="navhint for-pad">${pad('dpad')} Choose card ${pad('a')} Pick / unpick ${pad('x')} Confirm</div>
          <div class="navhint for-keys">${key('1')}&ndash;${key('5')} Pick / unpick ${key('Enter')} Confirm</div>
        </div>
      </div>`);
  }

  pick(i) {
    const sel = this.sel;
    if (!sel || i < 0 || i >= sel.hand.length) return;
    const max = Math.min(Data.config.focusGauge.maxSelect, sel.slots);
    const at = sel.picked.indexOf(i);
    if (at >= 0) {
      sel.picked.splice(at, 1);
    } else {
      const ids = sel.picked.map((x) => sel.hand[x]);
      if (sel.picked.length >= max || !Deck.compatible(ids, sel.hand[i])) {
        S.audio.play('deny');
        return;
      }
      sel.picked.push(i);
    }
    S.audio.play('select');
    this.renderSelect();
  }

  confirmSelect() {
    if (!this.sel) return;
    bus.emit('select:confirm', [...this.sel.picked]);
  }

  /** Keyboard shortcuts while the selection panel is open. */
  selectKey(k) {
    if (!this.sel) return;
    if (k >= '1' && k <= '5') this.pick(Number(k) - 1);
    else if (k === 'Enter') this.confirmSelect();
  }


  // ---- Pause and results --------------------------------------------------

  showPause(mode) {
    this.paused = true;
    const buttons =
      mode === 'training'
        ? `<button class="btn ghost" data-act="restart-training">Restart</button>
           <button class="btn ghost" data-act="characters" data-from="training">Change Character</button>
           <button class="btn ghost" data-act="leave-training">End training</button>`
        : `<button class="btn ghost" data-act="forfeit">Forfeit fight</button>`;
    this.render(`
      <div class="overlay">
        <div class="panel narrow">
          <h2>Paused</h2>
          <button class="btn" data-act="resume" data-back data-default>${P('pause')} Resume</button>
          ${buttons}
          ${mode === 'training' ? '' : '<p class="note">Forfeiting counts as a loss. You can still use a continue.</p>'}
        </div>
      </div>`);
  }

  hidePause() {
    this.paused = false;
    this.render('');
  }

  /** A run fight just ended (training never ends on its own). */
  showResult(payload) {
    if (payload.mode !== 'arcade' || !S.run.active) return;
    const run = S.run;
    const foe = Data.fighters[run.ladder[payload.index].fighter];

    if (payload.win) {
      const r = run.recordWin(payload);
      if (run.complete) {
        return this.render(`
          <div class="overlay">
            <div class="panel narrow result win">
              <h1>CHAMPION</h1>
              <p>${foe.name} falls. You beat the whole ladder in one sitting.</p>
              <button class="btn" data-act="results" data-default>${P('confirm')} See results</button>
            </div>
          </div>`);
      }
      const g = r.growth;
      const gains = [`<li class="hot">Level ${run.level}! +${g.hp} Health, +${g.atk} Attack, +${g.def} Defense</li>`];
      r.forms.forEach((n) => gains.push(`<li class="hot">Transformation unlocked: ${n}</li>`));
      return this.render(`
        <div class="overlay">
          <div class="panel narrow result win">
            <h1>VICTORY</h1>
            <p>${foe.name} is down. ${run.ladder.length - run.stage} to go.</p>
            <ul class="gains">${gains.join('')}</ul>
            <button class="btn" data-act="reward-screen" data-default>${P('confirm')} Choose a reward</button>
          </div>
        </div>`);
    }

    run.recordLoss(payload);
    const can = run.continues > 0;
    this.render(`
      <div class="overlay">
        <div class="panel narrow result lose">
          <h1>${can ? 'DEFEAT' : 'RUN OVER'}</h1>
          <p>${foe.name} was too strong this time.</p>
          ${can
            ? `<p class="note">Continues left: ${this.continuesPips()}</p>
               <button class="btn" data-act="continue" data-default>${P('confirm')} Continue (retry fight)</button>
               <button class="btn ghost" data-act="results">End run</button>`
            : `<p class="note">No continues left.</p>
               <button class="btn" data-act="results" data-default>${P('confirm')} See results</button>`}
        </div>
      </div>`);
  }
}
