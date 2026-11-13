// InputSystem: one input layer for the whole game. A controller (Gamepad API)
// is the primary device; the keyboard is a full fallback. Both are translated
// into the same named actions, so the fight and the menus never care which
// device a press came from.
//
// Listeners receive (type, action, device):
//   type   'down' | 'up' | 'repeat'  (repeat only fires for held directions)
//   device 'pad' | 'keys'
import { bus } from './bus.js';
import { S } from './data.js';

// Standard-mapping button index -> actions. A button can mean one thing in a
// fight and another in a menu, so each lists every action it stands for.
const PAD_BUTTONS = {
  0: ['technique', 'confirm'], // A / Cross
  1: ['vanish', 'back'], // B / Circle
  2: ['attack', 'alt'], // X / Square
  3: ['melee'], // Y / Triangle
  4: ['focus'], // LB
  6: ['transform'], // LT
  5: ['block'], // RB
  7: ['kiCharge'], // RT
  8: ['pause'], // View / Share
  9: ['pause'], // Menu / Options
  12: ['up'],
  13: ['down'],
  14: ['left'],
  15: ['right'],
};

const KEYS = {
  ArrowUp: ['up'], KeyW: ['up'],
  ArrowDown: ['down'], KeyS: ['down'],
  ArrowLeft: ['left'], KeyA: ['left'],
  ArrowRight: ['right'], KeyD: ['right'],
  KeyJ: ['attack'], KeyZ: ['attack'],
  KeyK: ['technique'], KeyX: ['technique'],
  KeyL: ['block'], KeyC: ['block'],
  KeyR: ['kiCharge'],
  Space: ['vanish'],
  KeyT: ['transform'], KeyF: ['transform'],
  KeyH: ['melee'], KeyV: ['melee'],
  KeyE: ['focus'], Enter: ['focus'],
  Escape: ['pause', 'back'],
  KeyP: ['pause'],
};

const DIRECTIONS = ['up', 'down', 'left', 'right'];
const STICK_DEADZONE = 0.5;
const REPEAT_DELAY = 360;
const REPEAT_EVERY = 120;

function padStyleOf(id) {
  const s = id.toLowerCase();
  if (/dualsense|dualshock|playstation|054c|ps[345]/.test(s)) return 'ps';
  if (/nintendo|pro controller|joy-con|057e/.test(s)) return 'nintendo';
  return 'xbox';
}

export class InputSystem {
  constructor() {
    this.device = 'pad'; // controller prompts are shown until a key is pressed
    this.padStyle = 'xbox';
    this.padIndex = null;
    this.padName = '';
    this.listeners = new Set();
    this.held = new Map(); // action -> { sources: Set, since, lastRepeat, device }
    this.padDown = new Set(); // button indices currently down
    this.stickDir = null;
    document.body.dataset.device = this.device;
    document.body.dataset.pad = this.padStyle;

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.releaseAll());
    window.addEventListener('gamepadconnected', () => this.poll());
    window.addEventListener('gamepaddisconnected', () => this.poll());

    const loop = () => {
      this.poll();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, action, device) {
    this.listeners.forEach((fn) => fn(type, action, device));
  }

  isHeld(action) {
    return this.held.has(action);
  }

  /** How long an action has been held, in ms, or -1 if it is not held. */
  heldMs(action) {
    const h = this.held.get(action);
    return h ? performance.now() - h.since : -1;
  }

  get padConnected() {
    return this.padIndex !== null;
  }

  setDevice(device) {
    if (this.device === device) return;
    this.device = device;
    document.body.dataset.device = device;
    bus.emit('input:device', device);
  }

  press(action, source, device) {
    let h = this.held.get(action);
    if (!h) {
      const now = performance.now();
      h = { sources: new Set(), since: now, lastRepeat: now, device };
      this.held.set(action, h);
      h.sources.add(source);
      this.emit('down', action, device);
    } else {
      h.sources.add(source);
    }
  }

  release(action, source) {
    const h = this.held.get(action);
    if (!h || !h.sources.delete(source)) return;
    if (!h.sources.size) {
      this.held.delete(action);
      this.emit('up', action, h.device);
    }
  }

  releaseAll(prefix = '') {
    for (const [action, h] of [...this.held]) {
      for (const src of [...h.sources]) if (src.startsWith(prefix)) this.release(action, src);
    }
    if (!prefix || prefix === 'p') {
      this.padDown.clear();
      this.stickDir = null;
    }
  }

  // ---- Keyboard -----------------------------------------------------------

  onKey(e, down) {
    const actions = KEYS[e.code];
    if (!actions || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = e.target?.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (down) {
      if (e.repeat) return;
      this.setDevice('keys');
      actions.forEach((a) => this.press(a, `k${e.code}`, 'keys'));
    } else {
      actions.forEach((a) => this.release(a, `k${e.code}`));
    }
  }

  // ---- Controller ---------------------------------------------------------

  findPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let fallback = null;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      if (p.mapping === 'standard') return p;
      fallback = fallback || p;
    }
    return fallback;
  }

  /** Reads the controller. Runs every animation frame. */
  poll() {
    const pad = this.findPad();
    const index = pad ? pad.index : null;
    if (index !== this.padIndex) {
      this.releaseAll('p');
      this.padIndex = index;
      this.padName = pad ? pad.id.replace(/\s*\(.*\)\s*$/, '').trim() || 'Controller' : '';
      if (pad) {
        this.padStyle = padStyleOf(pad.id);
        document.body.dataset.pad = this.padStyle;
        this.setDevice('pad');
      }
      bus.emit('input:pad', { connected: !!pad, name: this.padName });
    }

    if (pad) {
      for (const key of Object.keys(PAD_BUTTONS)) {
        const i = Number(key);
        const b = pad.buttons[i];
        const down = !!b && (b.pressed || b.value > 0.5);
        if (down === this.padDown.has(i)) continue;
        if (down) {
          this.padDown.add(i);
          this.setDevice('pad');
          PAD_BUTTONS[i].forEach((a) => this.press(a, `p${i}`, 'pad'));
        } else {
          this.padDown.delete(i);
          PAD_BUTTONS[i].forEach((a) => this.release(a, `p${i}`));
        }
      }

      // Left stick behaves like a D-pad; the stronger axis wins so a slightly
      // diagonal push never moves two tiles at once.
      const x = pad.axes[0] || 0;
      const y = pad.axes[1] || 0;
      let dir = null;
      if (Math.abs(x) > STICK_DEADZONE || Math.abs(y) > STICK_DEADZONE) {
        dir = Math.abs(x) >= Math.abs(y) ? (x < 0 ? 'left' : 'right') : y < 0 ? 'up' : 'down';
      }
      if (dir !== this.stickDir) {
        if (this.stickDir) this.release(this.stickDir, 'pstick');
        this.stickDir = dir;
        if (dir) {
          this.setDevice('pad');
          this.press(dir, 'pstick', 'pad');
        }
      }
    }

    // Auto-repeat for held directions (menu navigation).
    const now = performance.now();
    for (const action of DIRECTIONS) {
      const h = this.held.get(action);
      if (h && now - h.since > REPEAT_DELAY && now - h.lastRepeat > REPEAT_EVERY) {
        h.lastRepeat = now;
        this.emit('repeat', action, h.device);
      }
    }
  }

  /** Controller vibration. Magnitudes are 0..1. */
  rumble(ms, weak = 0.4, strong = 0.4) {
    if (this.device !== 'pad' || this.padIndex === null) return;
    if (S.settings && !S.settings.values.rumble) return;
    const pad = navigator.getGamepads?.()[this.padIndex];
    const motor = pad?.vibrationActuator;
    if (!motor?.playEffect) return;
    motor
      .playEffect('dual-rumble', {
        startDelay: 0,
        duration: ms,
        weakMagnitude: Math.min(1, weak),
        strongMagnitude: Math.min(1, strong),
      })
      .catch(() => {});
  }
}
