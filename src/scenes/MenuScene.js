import Phaser from 'phaser';
import { S } from '../core/data.js';
import { drawBackdrop, fighterTextureKey, hexInt } from '../systems/SpriteFactory.js';
import { StormAura } from '../systems/StormAura.js';

/** Animated backdrop shown behind the HTML menus. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    drawBackdrop(this, 'dojo');
    const run = S.run;
    const def = run.fighterDef;
    const formIndex = run.active ? run.maxForm() : 0;
    const form = def.forms[formIndex];
    const x = 760;
    const y = 500;

    this.add.ellipse(x, y + 4, 200, 36, 0x000000, 0.35);
    this.aura = this.add.sprite(x, y + 14, 'aura', 0).setOrigin(0.5, 1).setScale(6.4 * (form.auraScale || 1) * (form.spriteScale || 1));
    this.aura.setBlendMode(Phaser.BlendModes.ADD).setTint(hexInt(form.aura || def.look.ki)).setAlpha(0.8);
    this.hero = this.add.sprite(x, y, fighterTextureKey(run.fighterId, formIndex), 'idle0').setOrigin(0.5, 1).setScale(1.375 * (form.spriteScale || 1)).setDepth(10);
    this.baseY = y;
    this.stormAura = form.auraStyle === 'jin-storm' ? new StormAura(this) : null;
    if (this.stormAura) this.aura.setVisible(false);
  }

  update(time) {
    this.hero.setFrame(Math.floor(time / 380) % 2 ? 'idle1' : 'idle0');
    this.hero.y = this.baseY - 10 - Math.sin(time / 300) * 5;
    this.aura.setFrame(Math.floor(time / 90) % 3).setAlpha(0.65 + 0.2 * Math.sin(time / 120));
    this.aura.y = this.hero.y + 14;
    this.stormAura?.update(time, this.hero, true);
  }
}
