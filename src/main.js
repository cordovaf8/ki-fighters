// Ki Legends - entry point. Loads the JSON data, then starts Phaser and the UI.
import Phaser from 'phaser';
import { loadData, Data, S } from './core/data.js';
import { RunSystem } from './systems/RunSystem.js';
import { Settings } from './core/Settings.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { InputSystem } from './core/Input.js';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { BattleScene } from './scenes/BattleScene.js';
import { UI } from './ui/UI.js';

try {
  loadData();

  S.settings = new Settings();
  S.run = new RunSystem();
  S.audio = new AudioSystem(S.settings.values);
  S.input = new InputSystem();
  S.ui = new UI();
  S.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: Data.config.game.width,
    height: Data.config.game.height,
    backgroundColor: '#0b0d1a',
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.NO_CENTER },
    scene: [BootScene, MenuScene, BattleScene],
  });
  S.ui.title();

  // Browsers only let a page start sound after a click, tap or key press, and
  // controller buttons may not count. Any of those, anywhere, switches it on.
  for (const evt of ['pointerdown', 'keydown']) {
    window.addEventListener(evt, () => S.audio.unlock(), { capture: true });
  }
} catch (err) {
  console.error(err);
  document.getElementById('ui').innerHTML =
    `<div class="screen full"><h2>Ki Legends could not start</h2><p>${err.message}</p>` +
    '<p>Try reloading the page. If you edited the source, run <code>npm run build</code> again.</p></div>';
}
