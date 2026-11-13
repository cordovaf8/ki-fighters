// Game data (stats, techniques, configuration). The JSON files are bundled
// straight into game.js at build time, so nothing is fetched at runtime and
// the game runs from file:// with no server.
import config from '../data/config.json';
import fighters from '../data/fighters.json';
import tech from '../data/techniques.json';
import opponents from '../data/opponents.json';

export const Data = {
  config: null,
  fighters: null,
  techniques: null,
  combos: null,
  schools: null,
  starterDeck: null,
  opponents: null,
};

export function loadData() {
  Data.config = config;
  Data.fighters = fighters;
  Data.techniques = tech.techniques;
  Data.combos = tech.combos;
  Data.schools = tech.schools;
  Data.starterDeck = tech.starterDeck;
  Data.opponents = opponents;
  // Give every technique its own id so it can travel around as a plain object.
  for (const [id, t] of Object.entries(Data.techniques)) t.id = id;
  return Data;
}

// Shared services (settings, run, audio, input, ui, game) filled in by main.js.
export const S = {};
