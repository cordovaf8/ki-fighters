// Button prompts. Every prompt is written for both devices; CSS shows the one
// matching the device in use (body[data-device]) and labels controller glyphs
// for the connected pad family (body[data-pad]: xbox, ps or nintendo).

const PAD_LABELS = {
  a: ['A', '✕', 'B'],
  b: ['B', '○', 'A'],
  x: ['X', '□', 'Y'],
  y: ['Y', '△', 'X'],
  lb: ['LB', 'L1', 'L'],
  rb: ['RB', 'R1', 'R'],
  lt: ['LT', 'L2', 'ZL'],
  rt: ['RT', 'R2', 'ZR'],
  start: ['MENU', 'OPTIONS', '+'],
  dpad: ['D-PAD', 'D-PAD', 'D-PAD'],
  stick: ['L-STICK', 'L-STICK', 'L-STICK'],
};

// action -> [controller button, keyboard label]
const ACTIONS = {
  move: ['dpad', 'WASD'],
  attack: ['x', 'J'],
  melee: ['y', 'H'],
  technique: ['a', 'K'],
  block: ['rb', 'L'],
  kiCharge: ['rt', 'R'],
  vanish: ['b', 'Space'],
  transform: ['lt', 'T'],
  focus: ['lb', 'E'],
  pause: ['start', 'Esc'],
  confirm: ['a', 'Enter'],
  back: ['b', 'Esc'],
  selectConfirm: ['x', 'Enter'],
};

/** A controller glyph, e.g. pad('a'). */
export function pad(button) {
  const [xbox, ps, nin] = PAD_LABELS[button];
  const wide = xbox.length > 1 ? ' wide' : '';
  return `<kbd class="gp${wide}" data-b="${button}" data-xbox="${xbox}" data-ps="${ps}" data-nin="${nin}"></kbd>`;
}

export function key(label) {
  return `<kbd>${label}</kbd>`;
}

/** The prompt for an action on whichever device is active. */
export function P(action) {
  const [button, label] = ACTIONS[action];
  return `<span class="for-pad">${pad(button)}</span><span class="for-keys">${key(label)}</span>`;
}
