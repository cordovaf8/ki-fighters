// Settings: the only thing Ki Legends remembers between sessions (volume,
// screen shake, vibration). Game progress is never saved; see RunSystem.
const KEY = 'ki-legends-settings-v1';
const OLD_SAVE_KEY = 'ki-legends-save-v1'; // progression save from earlier versions
const DEFAULTS = { sfx: 0.6, music: 0.4, shake: true, rumble: true };

export class Settings {
  constructor() {
    this.values = { ...DEFAULTS };
    try {
      // Earlier builds kept levels and unlocks; carry over only the settings.
      const old = JSON.parse(localStorage.getItem(OLD_SAVE_KEY) || 'null');
      if (old?.settings) Object.assign(this.values, old.settings);
      localStorage.removeItem(OLD_SAVE_KEY);
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (saved) Object.assign(this.values, saved);
    } catch {
      // Storage can be unavailable (private windows); defaults are fine.
    }
    for (const k of Object.keys(this.values)) if (!(k in DEFAULTS)) delete this.values[k];
  }

  persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.values));
    } catch {
      // Not being able to remember a volume slider is not worth an error.
    }
  }
}
