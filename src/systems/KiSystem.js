// KiSystem: energy consumption and regeneration.
import { Data } from '../core/data.js';

export const KiSystem = {
  /**
   * Ki regenerates on its own only in base form. Transformed fighters (whose
   * forms last the rest of the fight) must Charge Ki to refill it.
   */
  update(fighter, dt) {
    if (fighter.kiCharging && fighter.alive && !fighter.locked && !fighter.blocking && fighter.scene.clock >= fighter.hurtUntil) {
      this.restore(fighter, ((Data.config.fighter.kiChargePerSec || 28) * dt) / 1000);
    } else if (fighter.formIndex === 0) {
      this.restore(fighter, (Data.config.fighter.kiRegenPerSec * dt) / 1000);
    }
  },
  canSpend(fighter, amount) {
    return fighter.ki >= amount;
  },
  spend(fighter, amount) {
    if (fighter.ki < amount) return false;
    fighter.ki -= amount;
    return true;
  },
  restore(fighter, amount) {
    fighter.ki = Math.min(fighter.maxKi, fighter.ki + amount);
  },
};
