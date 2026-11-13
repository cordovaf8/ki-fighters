// FocusGaugeSystem: controls how often technique selection can be reopened.
import { S } from '../core/data.js';

export class FocusGaugeSystem {
  constructor(fillMs) {
    this.fillMs = fillMs;
    this.value = 0;
    this.full = false;
    this.onFull = null;
  }

  update(dt) {
    if (this.full) return;
    this.value = Math.min(1, this.value + dt / this.fillMs);
    if (this.value >= 1) {
      this.full = true;
      S.audio.play('ready');
      this.onFull?.();
    }
  }

  reset() {
    this.value = 0;
    this.full = false;
  }
}
