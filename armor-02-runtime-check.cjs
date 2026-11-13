const esbuild=require('esbuild'),{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
const {spriteAssets}=await import('./build-sprite-assets.mjs'); await esbuild.build({plugins:[spriteAssets],stdin:{contents:"import './src/main.js'; import {S,Data} from './src/core/data.js'; window.__spriteCheck=S; window.__spriteData=Data;",resolveDir:process.cwd()},outfile:'armor-02-runtime.js',bundle:true,loader:{'.png':'dataurl'},alias:{phaser:'./vendor/phaser.esm.min.js'},logLevel:'silent'});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const p=await b.newPage({viewport:{width:1100,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/game.js',r=>r.fulfill({path:'armor-02-runtime.js',contentType:'application/javascript'}));
await p.goto('file:///C:/Users/GLaptop/Desktop/dbz%20game/index.html');
await p.waitForFunction(()=>window.__spriteCheck?.game?.scene?.isActive('Menu'));
await p.locator('[data-act=menu]').click();await p.locator('[data-act=training]').click();await p.getByRole('button',{name:/Skip/}).click();await p.waitForTimeout(400);
const sizes=await p.evaluate(()=>{const f=window.__spriteCheck.game.scene.getScene('Battle').player;return [1,2,3,0].map(i=>{f.setForm(i);return {form:i,scale:f.sprite.scaleY};});});assert.equal(sizes[2].scale,.55);assert.ok(sizes[2].scale>sizes[0].scale&&sizes[2].scale>sizes[1].scale);assert.equal(sizes[3].scale,.5);console.log('Form sizes',sizes); const report=await p.evaluate(()=>{const s=window.__spriteCheck.game.scene.getScene('Battle'),f=s.player;s.ai.update=()=>{};f.setForm(1);f.render(3000);const first=f.stormAura.image.scaleY;f.setForm(2);f.render(3000);const second=f.stormAura.image.scaleY;const poses=['idle0','idle1','shoot','charge','beam','punch','hurt','block','power','special'];return {first,second,scale:f.sprite.texture.auraScale,texture:f.sprite.texture.key,frames:poses.map(x=>({pose:x,exists:f.sprite.texture.has(x)})),aura:f.stormAura.image.visible};});
assert.ok(report.second>report.first*1.5);assert.ok(report.frames.every(x=>x.exists));assert.equal(report.texture,'f_jin_2');assert.ok(report.aura);
for(const pose of ['shoot','charge','beam','punch','hurt','block','power','special']){await p.evaluate(pose=>{const s=window.__spriteCheck.game.scene.getScene('Battle');s.player.pose=pose;s.player.poseUntil=Infinity;s.player.render(3500);},pose);await p.waitForTimeout(30);assert.equal(await p.evaluate(()=>window.__spriteCheck.game.scene.getScene('Battle').player.sprite.frame.name),pose);}
await p.evaluate(()=>{const s=window.__spriteCheck.game.scene.getScene('Battle');s.player.pose=null;s.player.ki=100;});await p.waitForTimeout(100);await p.screenshot({path:'jin-armor-02-ingame.png'});
assert.deepEqual(errors,[]);console.log(JSON.stringify({...report,errors}));await b.close();
})().catch(e=>{console.error(e);process.exit(1)});



