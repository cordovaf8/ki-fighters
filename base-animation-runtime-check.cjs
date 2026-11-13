const esbuild=require('esbuild'),{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
const {spriteAssets}=await import('./build-sprite-assets.mjs');
await esbuild.build({plugins:[spriteAssets],stdin:{contents:"import './src/main.js';import {S,Data} from './src/core/data.js';import {Fighter} from './src/systems/Fighter.js';window.__check={S,Data,Fighter};",resolveDir:process.cwd()},outfile:'base-animation-runtime.js',bundle:true,minify:true,loader:{'.png':'dataurl'},alias:{phaser:'./vendor/phaser.esm.min.js'},logLevel:'silent'});
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
const p=await b.newPage({viewport:{width:1600,height:2200}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/game.js',r=>r.fulfill({path:'base-animation-runtime.js',contentType:'application/javascript'}));await p.goto('file:///C:/Users/GLaptop/Desktop/dbz%20game/index.html');await p.waitForFunction(()=>window.__check?.S.game?.scene?.isActive('Menu'));
await p.locator('[data-act=menu]').click();await p.locator('[data-act=training]').click();await p.getByRole('button',{name:/Skip/}).click();await p.waitForTimeout(200);
const report=await p.evaluate(()=>{
 const {S,Data,Fighter}=window.__check,s=S.game.scene.getScene('Battle');s.ai.update=()=>{};
 const poses=['idle0','idle1','shoot','charge','beam','punch','hurt','block','power','special'];
 const results=[];const canvas=document.createElement('canvas');canvas.id='base-audit';canvas.width=1600;canvas.height=12*170+45;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#101626';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.font='16px sans-serif';ctx.fillStyle='#ceddf8';poses.forEach((pose,i)=>ctx.fillText(pose,i*160+45,24));
 let row=0;
 for(const [id,def]of Object.entries(Data.fighters)){
 const f=new Fighter(s,{id,def,side:'player',stats:def.stats,maxForm:def.forms.length-1,col:1,row:1});f.foe=s.enemy;
 const texture=f.sprite.texture,source=texture.getSourceImage();
 const checkCanvas=document.createElement('canvas');checkCanvas.width=320;checkCanvas.height=320;const cc=checkCanvas.getContext('2d',{willReadFrequently:true});
 ctx.fillStyle='#ffffff';ctx.fillText(def.name,10,45+row*170);
 const frames=poses.map((pose,i)=>{
 f.setPose(pose);f.render(3000);const frame=texture.get(pose);cc.clearRect(0,0,320,320);cc.drawImage(source,frame.cutX,frame.cutY,frame.cutWidth,frame.cutHeight,0,0,320,320);
 const data=cc.getImageData(0,0,320,320).data;let hash=2166136261,solid=0;for(let j=0;j<data.length;j++){hash=Math.imul(hash^data[j],16777619);if(j%4===3&&data[j]>200)solid++;}
 ctx.drawImage(checkCanvas,i*160,48+row*170,144,144);
 return {pose,actual:f.sprite.frame.name,solid,hash:hash>>>0};
 });
 f.clearPose();const shot=f.fireBlast(false,true);f.render(3200);const shotFrame=f.sprite.frame.name;s.combat.stopAll();f.clearPose();f.startBlock(false);f.render(3300);const blockFrame=f.sprite.frame.name;f.stopBlock();
 f.hurtUntil=s.clock+500;f.render(3400);const hurtFrame=f.sprite.frame.name;f.hurtUntil=0;
 f.chargeStart=s.clock-500;f.render(3500);const chargeFrame=f.sprite.frame.name;f.chargeStart=null;
 f.ki=100;const ascended=s.transform.ascend(f,{free:true});f.render(3600);const powerFrame=f.sprite.frame.name;s.clock+=601;s.runTimers();s.transform.revert(f,true);f.render(3700);
 results.push({id,poseSprites:def.forms[0].poseSprites,frames,unique:new Set(frames.map(x=>x.hash)).size,shot,shotFrame,blockFrame,hurtFrame,chargeFrame,powerFrame,ascended,reverted:f.formIndex===0&&f.sprite.texture.key===`f_${id}_0`});
 for(const key of ['sprite','aura','shadow','orb'])f[key].destroy();f.stormAura?.image.destroy();f.stormAura?.particles.destroy();row++;
 }
 s.state='inspect';document.getElementById('stage').style.display='none';document.body.style.display='block';document.body.style.overflow='auto';document.body.append(canvas);
 return results;
});
assert.equal(report.length,12);
for(const r of report){assert.ok(r.poseSprites,r.id);assert.equal(r.unique,10,r.id+' distinct rendered artwork');assert.ok(r.frames.every(f=>f.actual===f.pose&&f.solid>100),r.id+' complete frames');assert.ok(r.shot&&r.ascended&&r.reverted);assert.equal(r.shotFrame,'shoot');assert.equal(r.blockFrame,'block');assert.equal(r.hurtFrame,'hurt');assert.equal(r.chargeFrame,'charge');assert.equal(r.powerFrame,'power');}
assert.deepEqual(errors,[]);await p.locator('#base-audit').screenshot({path:'all-base-animations-preview.png'});console.log(JSON.stringify({characters:12,basePoses:120,uniqueFramesPerCharacter:report.map(r=>({id:r.id,distinct:r.unique})),combatAndReversion:'passed',errors}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
