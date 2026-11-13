# Ki Legends

An original grid-based battle game: 6x3 arena, Ki blasts, technique cards,
beam clashes and transformations. Built with Phaser 4.

## Play

Double-click **index.html**. It opens in your browser and runs straight from
the folder: no server, no install, and no internet connection needed.

A controller is the main way to play (Xbox, PlayStation and Switch Pro pads
work). Plug it in and press any button. The keyboard works too.

If you hear no sound, click the game or press any key once. Browsers only allow
sound after a click or key press, and controller buttons may not count.

To parry, press and hold block (RB on a controller, L/C on the keyboard)
within 140 ms before a basic or charged blast reaches you. A perfect parry
takes no damage, sends the blast back faster and stronger, and restores 6 Ki.
Holding block longer guards normally. Release and press again for another
attempt; a missed attempt has a short recovery. Special projectiles and beams
cannot be reflected. Run `npm test` for the parry regression checks.

Melee is on **Y** (H/V on the keyboard). In base form it only reaches the tile
directly in front of you, so step up to the front line first. Transformed
punches send a ki shockwave further down your row: two tiles in your second
form and three in your third (`reachByForm` in the `melee` config). Only a hit
on the tile directly in front gets your form's full power; each tile further
out hits as hard as a direct hit one form lower, so a third-form punch at three
tiles does base-form damage.

Punches can be parried too, with the same timing as blasts. If the punch came
from the tile right in front of you, you take no damage and the attacker is
stunned for 1 second (`parryStunMs` in the `melee` config), which ends their
combo. Punches from further away can only be blocked. Iron Body protects the
attacker from the stun. Press up to three times for
two quick punches and an uppercut that knocks the opponent back a tile; a press
during a punch is remembered and fires as soon as it ends. Blocking cuts melee
damage but costs a lot of stamina. Transform moved to **LT** to make room.
Punches hit 50% harder than your basic blast and the uppercut 50% harder than
your charged blast (`damageMul` in the `melee` config), including any perks
that boost those blasts.
Combo timing and damage live in the `melee` section of `src/data/config.json`.

Transforming runs on a **power gauge** (the bar under stamina), not Ki. It
starts empty every fight, fills slowly on its own, and fills faster when you
land blasts, punches and techniques or parry (blocked hits count half). When
it's full, press **LT** (T/F on the keyboard) to rise one form; that empties the
gauge, which then builds toward your next form. Forms last the rest of the
fight. Transformed fighters don't regain Ki on their own, so use Charge Ki (RT).
Fill rates live in the `transform` section of `src/data/config.json`.
The forms' old `kiCost` and `drain` values in `fighters.json` are no longer used.

## Techniques

There are 24 techniques in three schools (Ki, Body, Spirit) plus 6 combos that
fuse when you pick the right pair or trio together. Besides blasts, beams and
rushes there are aimed volleys, unblockable lances, exploding orbs, meteor
traps, stuns, a throw, Ki theft, healing, attack and guard buffs, a ward
that reflects projectiles, and Shadow Step, which makes you invulnerable and
lets you walk onto the opponent's tiles for 4 seconds (you're sent back to your
own ground when it ends). **Grapple** shoots a hook down your row; if it
catches the opponent it reels you both to the front line and you throw your full
three-punch combo automatically. Each opponent teaches its own picks as rewards.
Training gives you one of every technique to try out. All of them are defined
in `src/data/techniques.json`.

## How a run works

Ki Legends is built for one sitting. Choose **Start Run** and fight all five
opponents in a row:

- Every win levels you up and offers three rewards: two techniques for your
  deck, or a stat boost. Pick one.
- Jin's fully armored final transformation unlocks after 2 wins.
- Health is full at the start of every fight. If you lose, spend one of your
  2 continues to retry that fight.
- The run ends when you beat the final fighter or run out of continues, with a
  results screen (and a grade if you finish).

Runs are never saved: every run starts fresh at level 1, and closing the page
ends the run (the browser asks first). Only your settings (volume, screen
shake, vibration) are remembered. Training is free practice with every form
unlocked and no effect on anything.

Run tuning (continues, growth per win, stat boosts) lives in the `run` section
of `src/data/config.json`.

## Edit the game

The playable code is `game.js`, which is built from the files in `src/`.
After changing anything in `src/` (including the JSON data in `src/data/`),
rebuild it:

```bash
npm install
npm run build
```

Or rebuild automatically on every save while you work:

```bash
npm run watch
```

## Files

- `index.html` - the page you open to play
- `game.js` - the built game (generated, do not edit by hand)
- `css/style.css` - menus, HUD and layout
- `src/` - game source: `core/` (input, data), `systems/` (combat, AI, grid...), `scenes/`, `ui/`
- `src/data/` - fighter stats, techniques, opponents and settings (JSON)
- `vendor/phaser.esm.min.js` - the Phaser 4.2.1 engine, bundled into `game.js`
- `build.mjs` - the build script

## Fighter artwork

The 12 individual transparent base sprites are stored in `assets/characters/roster/`, numbered left to right and top to bottom from the reference sheet. `src/assets/roster-images.js` embeds them for offline play. `src/systems/RosterSprites.js` preserves the existing fighter/form assignments, aligns the artwork to the feet, and supplies subtle motion for the single-pose artwork. The original reference sheet remains in `src/assets/fighter-roster.png`.

Attack artwork lives in `assets/characters/attacks/` with matching roster numbers. Basic shots, charging, and beam firing use these open-palm sprites. Projectile and charge-orb origins follow each attack sprite’s palm.
`assets/characters/blocks/` contains matching X-arm guard sprites. Holding block shows this artwork until released or the guard breaks.
`assets/characters/specials/` contains the two-handed special-technique sprites. Special barrages, beams, area/capture moves and rush wind-ups use these poses. The build embeds reduced 512-pixel copies using `build-sprite-assets.mjs`; source PNGs remain full resolution.
Jin powered forms use the approved alien armor sprite set and the separate subtle cyan aura. StormAura.js animates its pulse, rising flecks, and short lightning independently of all combat poses. Returning to base removes the armor and aura.

All 12 fighters and 36 forms have a front punch, rear-hand cross, and front-hand
uppercut. Melee combos cycle through these strikes with recovery between hits.
`node build-roster-melee-combos.mjs` prepares the roster's cross and uppercut
assets, selecting the latest revised cross sheet when available. Run
`node melee-combo-runtime-check.cjs` to verify all 108 rendered strikes, combo
order, and recovery, and regenerate `all-melee-combos-preview.png`.

Jin's first armored form also uses dedicated idle, charge, beam, hurt, and power-up artwork. Run `node jin-animation-audit.cjs` to verify all 36 poses across his three forms, action switching, melee order, and aura alignment.
Combat audio includes charge buildup/ready cues, guard raise/break, melee swings, technique activation, blasts, beams, impacts, parries, movement, teleporting, and transformations. Each fighter has a distinct synthesized retro defeat voice in `src/systems/CharacterVoices.js`. Sounds follow the SFX volume setting. `node audio-runtime-check.cjs` renders the voices and action cues in a browser audio context to check for silence and clipping.
