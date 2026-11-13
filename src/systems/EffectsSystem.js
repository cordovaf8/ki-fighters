// EffectsSystem: sparks, explosions, afterimages, damage numbers, screen shake.
import Phaser from 'phaser';
import { S } from '../core/data.js';

const TEXT_STYLE = {
  fontFamily: 'Impact, "Arial Black", sans-serif',
  fontSize: '24px',
  fontStyle: 'italic',
  color: '#ffffff',
  stroke: '#10081c',
  strokeThickness: 5,
};

export class EffectsSystem {
  constructor(scene) {
    this.scene = scene;
  }

  /** Screen shake plus matching controller rumble. */
  shake(ms = 120, intensity = 0.006) {
    if (S.settings.values.shake) this.scene.cameras.main.shake(ms, intensity);
    S.input.rumble(Math.min(ms, 600), intensity * 45, intensity * 70);
  }

  flash(ms = 120, color = 0xffffff) {
    this.scene.cameras.main.flash(ms, (color >> 16) & 255, (color >> 8) & 255, color & 255);
  }

  spark(x, y, color = 0xffffff, count = 7, spread = 46) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = spread * (0.4 + Math.random() * 0.6);
      const size = 3 + Math.floor(Math.random() * 4);
      const r = this.scene.add.rectangle(x, y, size, size, i % 3 === 0 ? 0xffffff : color).setDepth(70);
      r.setBlendMode(Phaser.BlendModes.ADD);
      this.scene.tweens.add({
        targets: r, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0,
        duration: 180 + Math.random() * 160, onComplete: () => r.destroy(),
      });
    }
  }

  explosion(x, y, radius = 60, color = 0xffb040) {
    const core = this.scene.add.circle(x, y, radius * 0.3, 0xffffff, 1).setDepth(71);
    const ball = this.scene.add.circle(x, y, radius * 0.4, color, 0.85).setDepth(70);
    const ring = this.scene.add.circle(x, y, radius * 0.4).setStrokeStyle(5, color, 1).setDepth(70);
    [core, ball].forEach((o) => o.setBlendMode(Phaser.BlendModes.ADD));
    this.scene.tweens.add({ targets: core, scale: 2.2, alpha: 0, duration: 200, onComplete: () => core.destroy() });
    this.scene.tweens.add({ targets: ball, scale: 2.6, alpha: 0, duration: 340, onComplete: () => ball.destroy() });
    this.scene.tweens.add({ targets: ring, scale: 3.4, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
    this.spark(x, y, color, 10, radius * 1.3);
  }

  dust(x, y) {
    for (let i = -1; i <= 1; i += 2) {
      const d = this.scene.add.ellipse(x, y, 16, 8, 0xd8c8b0, 0.6).setDepth(6);
      this.scene.tweens.add({ targets: d, x: x + i * 26, y: y - 6, scale: 1.8, alpha: 0, duration: 260, onComplete: () => d.destroy() });
    }
  }

  /** Leaves a fading ghost of a fighter where they were standing. */
  afterimage(fighter, tint = 0xffffff) {
    const s = fighter.sprite;
    const ghost = this.scene.add
      .image(s.x, s.y, s.texture.key, s.frame.name)
      .setOrigin(0.5, 1)
      .setScale(s.scaleX, s.scaleY)
      .setFlipX(s.flipX)
      .setDepth(s.depth - 1)
      .setAlpha(0.65)
      .setTint(tint);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 320, onComplete: () => ghost.destroy() });
  }

  ring(x, y, color, from = 20, to = 120, ms = 380) {
    const ring = this.scene.add.circle(x, y, from).setStrokeStyle(6, color, 1).setDepth(69);
    this.scene.tweens.add({ targets: ring, scale: to / from, alpha: 0, duration: ms, onComplete: () => ring.destroy() });
  }

  damageNumber(x, y, amount, color = '#ffffff') {
    const t = this.scene.add
      .text(x + (Math.random() * 30 - 15), y, String(amount), { ...TEXT_STYLE, color, fontSize: amount >= 40 ? '32px' : '22px' })
      .setOrigin(0.5)
      .setDepth(80);
    this.scene.tweens.add({ targets: t, y: y - 44, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  popText(x, y, str, color = '#ffe14a', size = 20) {
    const t = this.scene.add
      .text(Phaser.Math.Clamp(x, 110, 850), y, str, { ...TEXT_STYLE, color, fontSize: `${size}px` })
      .setOrigin(0.5)
      .setDepth(81);
    this.scene.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 900, delay: 250, onComplete: () => t.destroy() });
  }
}
