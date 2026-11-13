// Battle HUD: health, Ki and stamina bars, Focus Gauge, technique queue.
// Plain DOM, styled in CSS, updated every frame with change detection.
import { Data } from '../core/data.js';
import { P } from './prompts.js';

const HINTS = [
  ['move', 'Move'],
  ['attack', 'Blast / hold to charge'],
  ['melee', 'Punch combo'],
  ['technique', 'Technique'],
  ['block', 'Block'],
  ['kiCharge', 'Charge Ki'],
  ['vanish', 'Vanish'],
  ['transform', 'Transform'],
  ['pause', 'Pause'],
];

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = $('hud');
    this.cache = {};
    this.bannerTimer = null;
    $('hint').innerHTML = HINTS.map(([action, label]) => `<span>${P(action)} ${label}</span>`).join('');
    $('fready').innerHTML = `READY &mdash; PRESS ${P('focus')}`;
    $('csub').innerHTML = `MASH ${P('attack')} TO OVERPOWER`;
  }

  put(id, kind, value) {
    const key = id + kind;
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    const el = $(id);
    if (kind === 'scale') el.style.transform = `scaleX(${value})`;
    else if (kind === 'text') el.textContent = value;
    else if (kind === 'html') el.innerHTML = value;
    else el.classList.toggle(kind, value);
  }

  begin(player, enemy) {
    this.cache = {};
    this.el.classList.remove('hidden');
    this.put('p-name', 'text', player.name);
    this.put('e-name', 'text', enemy.name);
    this.clash(false);
  }

  hide() {
    this.el.classList.add('hidden');
  }

  status(f, now) {
    if (f.guardBroken) return 'GUARD BROKEN';
    if (now < f.counterUntil) return 'AFTERIMAGE READY';
    if (now < (f.shadowUntil || 0)) return 'SHADOW STEP';
    if (now < (f.mirrorUntil || 0)) return 'MIRROR WARD';
    const buffs = [f.guarded && 'IRON BODY', now < (f.powerUntil || 0) && 'ATTACK UP'].filter(Boolean);
    if (buffs.length) return buffs.join(' + ');
    if (f.scene.transform.ready(f)) return 'TRANSFORM READY';
    return '';
  }

  /** Power gauge: fills toward the next form; pulses when ready, solid gold at the top form. */
  power(side, f) {
    const tf = f.scene.transform;
    this.put(`${side}-pw`, 'scale', tf.ratio(f).toFixed(3));
    this.put(`${side}-pwbar`, 'ready', tf.ready(f));
    this.put(`${side}-pwbar`, 'max', !tf.nextForm(f) && f.formIndex > 0);
    this.put(`${side}-pwbar`, 'none', !tf.nextForm(f) && f.formIndex === 0);
  }

  update(p, e, gauge) {
    const now = p.scene.clock;
    const ratio = (v, max) => Math.max(0, Math.min(1, v / max)).toFixed(3);

    this.put('p-hp', 'scale', ratio(p.hp, p.maxHp));
    this.put('p-hpn', 'text', `${Math.ceil(p.hp)} / ${p.maxHp}`);
    this.put('p-hpbar', 'low', p.hp < p.maxHp * 0.3);
    this.put('p-ki', 'scale', ratio(p.ki, p.maxKi));
    this.put('p-kin', 'text', `KI ${Math.floor(p.ki)}`);
    this.put('p-st', 'scale', ratio(p.stamina, Data.config.fighter.staminaMax));
    this.power('p', p);
    this.put('p-form', 'text', p.formIndex ? p.form.name : '');
    this.put('p-status', 'text', this.status(p, now));

    this.put('e-hp', 'scale', ratio(e.hp, e.maxHp));
    this.put('e-hpn', 'text', `${Math.ceil(e.hp)}`);
    this.put('e-hpbar', 'low', e.hp < e.maxHp * 0.3);
    this.put('e-ki', 'scale', ratio(e.ki, e.maxKi));
    this.power('e', e);
    this.put('e-form', 'text', e.formIndex ? e.form.name : '');
    const pips = e.queue.length ? `TECHNIQUES ${'◆'.repeat(e.queue.length)}` : '';
    this.put('e-status', 'text', this.status(e, now) || pips);

    this.put('g-fill', 'scale', gauge.value.toFixed(3));
    this.put('focus', 'full', gauge.full);

    const more = p.queue.length > 3 ? `<span class="chip">+${p.queue.length - 3}</span>` : '';
    const chips = p.queue
      .slice(0, 3)
      .map((t, i) => {
        const cost = t.kiCost ? `<em>${t.kiCost} Ki</em>` : '';
        const afford = t.kiCost > p.ki ? ' short' : '';
        return `<span class="chip school-${t.school}${i === 0 ? ' first' : ''}${t.isCombo ? ' combo' : ''}${afford}">${i === 0 ? P('technique') : ''}${t.name}${cost}</span>`;
      })
      .join('') + more;
    this.put('queue', 'html', chips || '<span class="chip empty">No techniques ready</span>');
  }

  banner(text, ms = 900) {
    const el = $('banner');
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  clash(show, meter = 0.5, timeLeft = 1) {
    $('clash').classList.toggle('hidden', !show);
    if (!show) return;
    $('c-fill').style.transform = `scaleX(${meter.toFixed(3)})`;
    $('c-time').style.transform = `scaleX(${Math.max(0, timeLeft).toFixed(3)})`;
  }
}
