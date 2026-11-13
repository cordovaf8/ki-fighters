import Phaser from 'phaser';
import { rosterImages } from '../assets/roster-images.js';
import { attackImages } from '../assets/attack-images.js';
import { blockImages } from '../assets/block-images.js';
import { specialImages } from '../assets/special-images.js';
import { transformationImages } from '../assets/transformation-images.js';
import { basePoseImages } from '../assets/base-pose-images.js';
import { jinMeleeImages } from '../assets/jin-melee-images.js';
import { rosterMeleeImages } from '../assets/roster-melee-images.js';
import armorIdle from '../../assets/characters/jin/transformation-armor-01.png';
import armorAttack from '../../assets/characters/jin/armor-01-attack.png';
import armorBlock from '../../assets/characters/jin/armor-01-block.png';
import armorSpecial from '../../assets/characters/jin/armor-01-special.png';
import armorPunch from '../../assets/characters/jin/armor-01-punch.png';
import stormAura from '../../assets/characters/jin/aura-subtle-layer.png';
import idle0 from '../../assets/characters/jin/armor-02-idle0.png';
import idle1 from '../../assets/characters/jin/armor-02-idle1.png';
import shoot from '../../assets/characters/jin/armor-02-shoot.png';
import charge from '../../assets/characters/jin/armor-02-charge.png';
import beam from '../../assets/characters/jin/armor-02-beam.png';
import punch from '../../assets/characters/jin/armor-02-punch.png';
import hurt from '../../assets/characters/jin/armor-02-hurt.png';
import block from '../../assets/characters/jin/armor-02-block.png';
import power from '../../assets/characters/jin/armor-02-power.png';
import special from '../../assets/characters/jin/armor-02-special.png';
import { bus } from '../core/bus.js';
import { buildAllTextures } from '../systems/SpriteFactory.js';

/** Generates every texture, then hands over to the menu backdrop. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    Object.entries(rosterMeleeImages).forEach(([key, url]) => this.load.image(key, url));
    Object.entries(jinMeleeImages).forEach(([key, url]) => this.load.image(key, url));
    Object.entries(basePoseImages).forEach(([key, url]) => this.load.image(key, url));
    Object.entries(transformationImages).forEach(([key, url]) => this.load.image(key, url));
    Object.entries({ idle0, idle1, shoot, charge, beam, punch, hurt, block, power, special })
      .forEach(([pose, url]) => this.load.image(`jin-armor-02-${pose}`, url));
    rosterImages.forEach((url, index) => this.load.image(`roster-${index}`, url));
    attackImages.forEach((url, index) => this.load.image(`attack-${index}`, url));
    blockImages.forEach((url, index) => this.load.image(`block-${index}`, url));
    specialImages.forEach((url, index) => this.load.image(`special-${index}`, url));
    this.load.image('jin-armor-01-idle', armorIdle);
    this.load.image('jin-armor-01-attack', armorAttack);
    this.load.image('jin-armor-01-block', armorBlock);
    this.load.image('jin-armor-01-special', armorSpecial);
    this.load.image('jin-armor-01-punch', armorPunch);
    this.load.image('jin-storm-aura', stormAura);
  }

  create() {
    buildAllTextures(this);
    this.scene.start('Menu');
    bus.emit('boot:ready');
  }
}
