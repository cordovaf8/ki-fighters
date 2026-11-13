const esbuild=require('esbuild'),{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const {spriteAssets}=await import('./build-sprite-assets.mjs');await esbuild.build({plugins:[spriteAssets],stdin:{contents:"import './src/main.js';import {S,Data} from './src/core/data.js';import {Fighter} from './src/systems/Fighter.js';import {BEAM_NAMES,beamColor,drawBeamTheme} from './src/systems/ThemedBeams.js';window.__check={S,Data,Fighter,BEAM_NAMES,beamColor,drawBeamTheme};",resolveDir:process.cwd()},outfile:'final-beam-runtime.js',bundle:true,minify:true,loader:{'.png':'dataurl'},alias:{phaser:'./vendor/phaser.esm.min.js'},logLevel:'silent'});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{const p=await b.newPage({viewport:{width:1400,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/game.js',r=>r.fulfill({path:'final-beam-runtime.js',contentType:'application/javascript'}));await p.goto('file:///C:/Users/GLaptop/Desktop/dbz%20game/index.html');await p.waitForFunction(()=>window.__check?.S.game?.scene?.isActive('Menu'));await p.locator('[data-act=menu]').click();await p.locator('[data-act=training]').click();await p.getByRole('button',{name:/Skip/}).click();await p.waitForTimeout(200);

await p.evaluate(()=>{const s=window.__check.S.game.scene.getScene('Battle');s.ai.update=()=>{};s.enemy.row=0;});
const checks=[];
for(const form of [1,2,3]){
 await p.evaluate(form=>{const s=window.__check.S.game.scene.getScene('Battle'),f=s.player;s.state='fight';s.combat.stopAll();f.setForm(form);f.ki=100;f.locked=false;f.hurtUntil=0;f.blastReadyAt=0;f.chargeStart=null;f.clearPose();},form);
 await p.keyboard.down('j');await p.waitForTimeout(1050);await p.keyboard.up('j');
 if(form>=2)await p.waitForFunction(()=>window.__check.S.game.scene.getScene('Battle').combat.beams.some(b=>b.phase==='fire'),{timeout:2000});
 else await p.waitForTimeout(100);
 if(form>=2)await p.waitForTimeout(120);
 const r=await p.evaluate(()=>{const s=window.__check.S.game.scene.getScene('Battle'),f=s.player;s.state='inspect';return {form:f.formIndex,name:f.form.name,beam:s.combat.beams.some(b=>b.owner===f&&b.theme==='jin'),phase:s.combat.beams[0]?.phase,pose:f.pose,chargedProjectiles:s.combat.projectiles.filter(p=>p.owner===f&&p.big).length};});checks.push(r);
 assert.equal(r.beam,form>=2);if(form>=2){assert.equal(r.phase,'fire');assert.equal(r.pose,'beam');await p.screenshot({path:'jin-lightning-beam-form-'+form+'.png'});}else assert.ok(r.chargedProjectiles>0);
}
assert.deepEqual(errors,[]);console.log(JSON.stringify({keyboardHoldRelease:checks,errors}));}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});

