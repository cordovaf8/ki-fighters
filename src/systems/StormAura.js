import Phaser from 'phaser';

/** Independent aura layer: gentle breathing, rising flecks and brief lightning. */
export class StormAura {
  constructor(scene) {
    this.image = scene.add.image(0, 0, 'jin-storm-aura').setVisible(false);
    this.image.setBlendMode(Phaser.BlendModes.ADD);
    this.particles = scene.add.graphics().setVisible(false);
  }

  update(time, sprite, visible) {
    this.image.setVisible(visible);
    this.particles.setVisible(visible).clear();
    if (!visible) return;
    const layout = sprite.texture.auraLayout;
    const strength = sprite.texture.auraScale || 1;
    const scale = layout.scale * sprite.scaleX * strength;
    const pulse = .5 + .5 * Math.sin(time / 400);
    this.image.setOrigin(layout.originX, layout.originY)
      .setPosition(sprite.x, sprite.y - 3 * sprite.scaleY)
      .setDepth(sprite.depth - .5).setFlipX(sprite.flipX)
      .setScale(scale * (.95 + pulse * .065), scale * (.98 + pulse * .045))
      .setAlpha((.16 + .045 * Math.sin(time / 110) + .02 * pulse) * Math.min(strength, 1.6));
    const unit = sprite.scaleX / .5 * strength;
    const g = this.particles.setDepth(sprite.depth + .2);
    for (let i = 0; i < Math.round(12 * strength); i++) {
      const phase = (time / 1700 + i * .618) % 1;
      const x = sprite.x + (i % 2 ? -1 : 1) * (52 + Math.sin(i * 2.1 + phase * 5) * 9) * unit;
      const y = sprite.y - (6 + phase * 122) * unit;
      g.fillStyle(0x7fe8ff, Math.sin(phase * Math.PI) * .32);
      g.fillRect(x, y, unit, 2 * unit);
    }
    for (let i = 0; i < Math.round(2 * strength); i++) {
      const phase = (time + i * 1100) % 2700;
      if (phase > 110) continue;
      const x = sprite.x + (i % 2 ? 48 : -48) * unit;
      const y = sprite.y - (i ? 75 : 35) * unit;
      g.lineStyle(unit, 0x91eaff, (1 - phase / 110) * .55);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 * unit, y - 4 * unit);
      g.lineTo(x + unit, y - 6 * unit); g.lineTo(x + 4 * unit, y - 10 * unit); g.strokePath();
    }
  }
}
