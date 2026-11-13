import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run the actual combat logic without a renderer or audio device.
const bundle = await build({
  stdin: { contents: `export { Fighter } from './src/systems/Fighter.js';
    export { CombatSystem } from './src/systems/CombatSystem.js';
    export { BattleScene } from './src/scenes/BattleScene.js';
    export { Data, S, loadData } from './src/core/data.js';
    export { finalChargeIsBeam } from './src/systems/ThemedBeams.js';
    export { KiSystem } from './src/systems/KiSystem.js';`, resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node',
  plugins: [{ name: 'headless-phaser', setup(b) {
    b.onResolve({ filter: /^phaser$/ }, () => ({ path: 'phaser', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export default {
      Scene: class {}, Math: { Clamp: (v, min, max) => Math.max(min, Math.min(max, v)) },
      BlendModes: { ADD: 1 }
    };` }));
  } }],
});
const temp = await mkdtemp(join(tmpdir(), 'ki-parry-test-'));
const modulePath = join(temp, 'combat.mjs');
let runtime;
try {
  await writeFile(modulePath, bundle.outputFiles[0].text);
  runtime = await import(pathToFileURL(modulePath).href);
} finally {
  await unlink(modulePath); await rmdir(temp);
}
const { Fighter, CombatSystem, BattleScene, Data, S, loadData } = runtime;
loadData();

test('Jin has two transformations and the fully armored final form unlocks charged beams', () => {
  const def = Data.fighters.jin;
  const isBeam = (formIndex) => runtime.finalChargeIsBeam({ def, formIndex, form: def.forms[formIndex] });
  assert.equal(isBeam(0), false); assert.equal(isBeam(1), false);
  assert.equal(def.forms.length, 3);
  assert.equal(isBeam(2), true);
});
S.audio = { play() {} }; S.input = { rumble() {} }; S.ui = { hud: { update() {} } };

function setup() {
  const visual = (...args) => ({ textureKey: args[2], scaleX: 1, active: true,
    setDepth() { return this; }, setBlendMode() { return this; }, setTexture(key) { this.textureKey = key; return this; },
    setFlipX(value) { this.flipX = value; return this; },
    setScale(v) { this.scaleX = v; return this; }, setPosition() { return this; }, destroy() { this.active = false; } });
  const scene = { clock: 1000, time: { now: 1000 }, hitstopRemaining: 0,
    hitstop: BattleScene.prototype.hitstop,
    grid: { center: () => ({ x: 0, y: 300 }) },
    add: { graphics: visual, image: visual },
    fx: { ring() {}, spark() {}, popText() {} } };
  function fighter(side, x) {
    return Object.assign(Object.create(Fighter.prototype), {
      scene, side, id: side, facing: side === 'player' ? 1 : -1,
      pos: { x, y: 300 }, hover: 0, row: 1, col: side === 'player' ? 1 : 4,
      alive: true, locked: false, lockUntil: 0, hurtUntil: 0, invulnUntil: 0,
      blocking: false, guardBroken: false, parryUntil: 0, parryReadyAt: 0, parries: 0,
      maxKi: 100, ki: 30, stamina: 100, pose: null,
      sprite: { texture: {}, scaleX: .5, scaleY: .5 },
      receive(hit) { this.damageTaken = (this.damageTaken || 0) + hit.amount; },
    });
  }
  const player = fighter('player', 300), enemy = fighter('enemy', 660);
  player.foe = enemy; enemy.foe = player;
  const combat = new CombatSystem(scene); scene.combat = combat;
  return { scene, player, enemy, combat };
}

function incoming(env, big = false, parryable = true) {
  env.combat.spawnProjectile(env.enemy, { row: 1, damage: big ? 40 : 8, big, heavy: big, parryable });
  const p = env.combat.projectiles.at(-1);
  p.x = env.player.pos.x + 40;
  return p;
}

for (const big of [false, true]) test(`perfect ${big ? 'charged' : 'basic'} blast is returned and damages original shooter`, () => {
  const e = setup(), p = incoming(e, big);
  e.player.startBlock(); e.scene.clock += 139;
  e.combat.updateProjectiles(10);
  assert.equal(p.owner, e.player); assert.ok(p.vx > 0); assert.equal(p.big, big);
  assert.equal(p.reflects, 1); assert.equal(e.player.damageTaken, undefined);
  assert.equal(e.player.ki, 36); assert.equal(e.player.parries, 1);
  assert.equal(e.scene.hitstopRemaining, Data.config.parry.hitstopMs);
  e.combat.updateProjectiles(250);
  assert.equal(e.enemy.damageTaken, (big ? 40 : 8) * 1.5);
  assert.equal(p.alive, false);
});

test('late, held, released, interrupted and broken guards cannot parry', () => {
  for (const kind of ['late', 'held', 'released', 'interrupted', 'broken']) {
    const e = setup(), p = incoming(e);
    e.player.startBlock();
    if (kind === 'late' || kind === 'held') e.scene.clock += 140;
    if (kind === 'held') e.player.startBlock(); // holding cannot extend the window
    if (kind === 'released') e.player.stopBlock();
    if (kind === 'interrupted') e.player.interrupt();
    if (kind === 'broken') e.player.breakGuard();
    assert.equal(e.player.tryParry(p), false, kind);
  }
});

test('special projectiles are not reflectable', () => {
  const e = setup(), p = incoming(e, true, false); e.player.startBlock();
  e.combat.updateProjectiles(10);
  assert.equal(p.reflects, 0); assert.equal(e.player.damageTaken, 40);
});

test('miss cooldown blocks mashing; clean parries can chain after a fresh press', () => {
  const e = setup(); e.player.startBlock(); e.player.stopBlock();
  e.scene.clock += 100; e.player.startBlock(); assert.equal(e.player.parryUntil, 0);
  e.player.stopBlock(); e.scene.clock = 1520; e.player.startBlock();
  assert.equal(e.player.tryParry(incoming(e)), true);
  e.player.stopBlock(); e.player.startBlock();
  assert.equal(e.player.tryParry(incoming(e)), true);
});

test('a held block that becomes actionable does not get a fresh parry window', () => {
  const e = setup(); e.player.lockUntil = 1100; e.player.startBlock();
  assert.equal(e.player.blocking, false);
  e.scene.clock = 1100; e.player.startBlock(false);
  assert.equal(e.player.blocking, true); assert.equal(e.player.parryUntil, 0);
});

test('ordinary AI guarding does not accidentally parry', () => {
  const e = setup(); e.enemy.startBlock(false);
  assert.equal(e.enemy.blocking, true); assert.equal(e.enemy.parryUntil, 0);
});

test('swept collision catches fast blasts in both directions', () => {
  for (const defender of ['player', 'enemy']) {
    const e = setup(), f = e[defender], owner = f.foe;
    e.combat.spawnProjectile(owner, { row: 1, damage: 8, parryable: true });
    const p = e.combat.projectiles[0]; p.x = f.pos.x + f.facing * 80; p.vx = -f.facing * 3200;
    f.startBlock(); e.combat.updateProjectiles(50);
    assert.equal(p.owner, f); assert.equal(p.reflects, 1);
  }
});

test('reflection rallies cap speed and damage, and a different row is safe', () => {
  const e = setup(), p = incoming(e);
  for (let i = 0; i < 12; i++) e.combat.reflect(p, i % 2 ? e.enemy : e.player);
  assert.equal(Math.abs(p.vx), Data.config.parry.maxSpeed);
  assert.equal(p.damage, p.baseDamage * Data.config.parry.maxDamageMul);
  e.player.row = 0; p.x = e.player.pos.x + 40; p.vx = -1500;
  e.combat.updateProjectiles(10); assert.equal(e.player.damageTaken, undefined);
});

test('hitstop freezes combat clock while continuing visual sync', () => {
  let renders = 0;
  const scene = { state: 'fight', hitstopRemaining: 0, clock: 1000,
    combat: { drawBeams() {} }, player: { render() { renders++; } }, enemy: { render() { renders++; } } };
  BattleScene.prototype.hitstop.call(scene, 70);
  BattleScene.prototype.update.call(scene, 0, 30);
  assert.equal(scene.clock, 1000); assert.equal(scene.hitstopRemaining, 40); assert.equal(renders, 2);
});

test('parrying a themed rocket keeps its weapon and reverses its direction', () => {
  const e = setup(); e.enemy.id = 'zeta';
  e.combat.spawnProjectile(e.enemy, { row: 1, damage: 40, big: true, heavy: true, parryable: true });
  const p = e.combat.projectiles[0];
  assert.equal(p.spr.textureKey, 'projectile_zeta_charged');
  assert.equal(p.spr.flipX, true);
  e.combat.reflect(p, e.player);
  assert.equal(p.spr.textureKey, 'projectile_zeta_charged');
  assert.equal(p.spr.flipX, false);
  assert.ok(p.vx > 0); assert.equal(p.owner, e.player);
});

test('removing themed projectiles also destroys their trail graphics', () => {
  const e = setup(); e.enemy.id = 'redhair';
  e.combat.spawnProjectile(e.enemy, { row: 1, damage: 8, parryable: true });
  const p = e.combat.projectiles[0];
  assert.ok(p.trail.active);
  e.combat.killProjectile(p);
  assert.equal(p.trail.active, false); assert.equal(p.spr.active, false);
});

test('manual Ki charging restores transformed fighters, caps Ki, and prevents firing', () => {
  const { player } = setup();
  player.formIndex = 1;
  assert.equal(player.startKiCharge(), true);
  assert.equal(player.pose, 'power');
  assert.equal(player.fireBlast(), false);
  const before = player.ki;
  runtime.KiSystem.update(player, 1000);
  assert.ok(player.ki > before);
  player.ki = 99;
  runtime.KiSystem.update(player, 1000);
  assert.equal(player.ki, player.maxKi);
  player.stopKiCharge();
  assert.equal(player.kiCharging, false);
  assert.equal(player.pose, null);
  assert.equal(player.canAct(), true);
});

test('interrupting a manual Ki charge clears its pose and stops transformed regeneration', () => {
  const { player } = setup();
  player.formIndex = 1;
  player.startKiCharge();
  player.interrupt();
  const before = player.ki;
  runtime.KiSystem.update(player, 1000);
  assert.equal(player.ki, before);
  assert.equal(player.kiCharging, false);
  assert.equal(player.pose, null);
});
