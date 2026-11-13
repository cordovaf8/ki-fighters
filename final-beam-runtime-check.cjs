const esbuild=require('esbuild'),{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const {spriteAssets}=await import('./build-sprite-assets.mjs');await esbuild.build({plugins:[spriteAssets],stdin:{contents:"import './src/main.js';import {S,Data} from './src/core/data.js';import {Fighter} from './src/systems/Fighter.js';import {BEAM_NAMES,beamColor,drawBeamTheme} from './src/systems/ThemedBeams.js';window.__check={S,Data,Fighter,BEAM_NAMES,beamColor,drawBeamTheme};",resolveDir:process.cwd()},outfile:'final-beam-runtime.js',bundle:true,minify:true,loader:{'.png':'dataurl'},alias:{phaser:'./vendor/phaser.esm.min.js'},logLevel:'silent'});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{const p=await b.newPage({viewport:{width:1400,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/game.js',r=>r.fulfill({path:'final-beam-runtime.js',contentType:'application/javascript'}));await p.goto('file:///C:/Users/GLaptop/Desktop/dbz%20game/index.html');await p.waitForFunction(()=>window.__check?.S.game?.scene?.isActive('Menu'));await p.locator('[data-act=menu]').click();await p.locator('[data-act=training]').click();await p.getByRole('button',{name:/Skip/}).click();await p.waitForTimeout(200);
const report=await p.evaluate(()=>{const {S,Data,Fighter,BEAM_NAMES,beamColor,drawBeamTheme}=window.__check,s=S.game.scene.getScene('Battle');s.ai.update=()=>{};s.enemy.row=0;const results=[];
for(const [id,def]of Object.entries(Data.fighters)){
const f=new Fighter(s,{id,def,side:'player',stats:def.stats,maxForm:def.forms.length-1,col:1,row:1});f.foe=s.enemy;const cases=[];
for(const facing of [-1,1]){
f.facing=facing;
for(const form of [0,1,def.forms.length-1]){
f.setForm(form);f.locked=false;f.blastReadyAt=0;f.clearPose();const fired=f.fireBlast(true,true);const beam=s.combat.beams.at(-1);let clean=true,firePose=null;
if(beam){s.combat.drawBeams(4000);s.combat.updateBeams(160);f.render(4100);firePose=f.sprite.frame.name;s.combat.drawBeams(4200);s.combat.updateBeams(600);clean=!f.locked&&!f.pose;}
cases.push({form,facing,fired,beam:!!beam,theme:beam?.theme,firePose,clean});s.combat.stopAll();}
f.setForm(def.forms.length-1);f.locked=false;f.blastReadyAt=0;f.fireBlast(false,true);cases.push({basic:true,projectile:s.combat.projectiles.length===1,beam:s.combat.beams.length>0});s.combat.stopAll();
f.locked=false;f.fireBlast(true,true);const interrupted=s.combat.beams.at(-1);f.interrupt();cases.push({cancelled:interrupted.done&&!f.locked});s.combat.stopAll();}
results.push({id,cases});for(const key of ['sprite','shadow','aura','orb'])f[key].destroy();f.stormAura?.image.destroy();f.stormAura?.particles.destroy();}
// Exercise the existing clash path with two final-form themed beams.
const a=s.player,b=s.enemy;a.setForm(a.def.forms.length-1);b.setForm(b.def.forms.length-1);a.row=b.row=1;a.locked=b.locked=false;a.blastReadyAt=b.blastReadyAt=0;a.clearPose();b.clearPose();a.fireBlast(true,true);b.fireBlast(true,true);s.combat.updateBeams(160);s.combat.drawBeams(4300);const clash=!!s.combat.clash;s.combat.resolveClash(true);s.combat.stopAll();
s.state='inspect';s.add.rectangle(480,270,960,540,0x111728).setDepth(100);const g=s.add.graphics().setDepth(101);let row=0;
for(const id of Object.keys(Data.fighters)){
const y=32+row*43,beam={theme:id,owner:{facing:1,kiColor:0xffffff}};const col=beamColor(beam);s.add.text(12,y-12,Data.fighters[id].name,{fontSize:'11px',color:'#ffffff'}).setDepth(102);s.add.text(12,y+2,BEAM_NAMES[id],{fontSize:'9px',color:'#a9bddd'}).setDepth(102);
g.fillStyle(col,.3).fillRect(220,y-14,710,28);g.fillStyle(col,.9).fillRect(220,y-8,710,16);g.fillStyle(0xffffff,.95).fillRect(220,y-3,710,6);drawBeamTheme(g,beam,4600,220,710,y,16);row++;}
return {results,clash};});
for(const {id,cases}of report.results)for(const c of cases){if('cancelled'in c){assert.ok(c.cancelled,id);continue;}if(c.basic){assert.ok(c.projectile&&!c.beam,id);continue;}assert.ok(c.fired);if(c.form===0||c.form===1)assert.equal(c.beam,false,id);else {assert.ok(c.beam&&c.clean,id);assert.equal(c.theme,id);assert.equal(c.firePose,'beam');}}
assert.ok(report.clash);assert.deepEqual(errors,[]);await p.addStyleTag({content:'#hud,#ui,#toast{display:none!important}'});await p.waitForTimeout(100);await p.screenshot({path:'final-form-beams-preview.png'});console.log(JSON.stringify({characters:12,earlierProjectiles:'passed',finalBeamsBothDirections:'passed',basicProjectiles:'passed',interruptionAndCleanup:'passed',clashes:report.clash,errors}));}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
