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
 const {S,Data,Fighter}=window.__check,s=S.game.scene.getScene('Battle');s.ai.update=()=>{};const results=[];
 const canvas=document.createElement('canvas');canvas.id='melee-preview';canvas.width=840;canvas.height=12*170;const c=canvas.getContext('2d');c.fillStyle='#111728';c.fillRect(0,0,840,canvas.height);c.imageSmoothingEnabled=false;let row=0;
 const sample=document.createElement('canvas');sample.width=320;sample.height=320;const cc=sample.getContext('2d',{willReadFrequently:true});
 const hash=(tex,pose)=>{const frame=tex.get(pose);cc.clearRect(0,0,320,320);cc.drawImage(tex.getSourceImage(),frame.cutX,frame.cutY,320,320,0,0,320,320);const pixels=cc.getImageData(0,0,320,320).data;let h=2166136261,solid=0;for(let i=0;i<pixels.length;i++){h=Math.imul(h^pixels[i],16777619);if(i%4===3&&pixels[i]>200)solid++;}return {hash:h>>>0,solid};};
 for(const[id,def]of Object.entries(Data.fighters)){
 const f=new Fighter(s,{id,def,side:'player',stats:def.stats,maxForm:def.forms.length-1,col:1,row:1});f.foe=s.enemy;
 for(let form=0;form<def.forms.length;form++){
 f.setForm(form);f.setPose('punch');f.render(3000);const texture=f.sprite.texture,punch=hash(texture,'punch'),idle=hash(texture,'idle0');
 c.fillStyle='white';c.font='bold 13px sans-serif';c.fillText(form===0?def.name:def.forms[form].name,form*280+10,row*170+18);const frame=texture.get('punch');c.drawImage(texture.getSourceImage(),frame.cutX,frame.cutY,320,320,form*280+48,row*170+19,170,150);
 s.enemy.alive=true;s.enemy.hp=s.enemy.maxHp;s.enemy.invulnUntil=0;s.enemy.row=1;s.enemy.col=4;f.locked=false;f.clearPose();s.combat.rush(f,{windupMs:10,hits:2,damage:1,knockback:0});s.clock+=11;s.runTimers();s.runTimers();f.render(3100);const strike1=f.sprite.frame.name;
 s.clock+=56;s.runTimers();f.render(3200);const recovery=f.sprite.frame.name;
 s.clock+=55;s.runTimers();f.render(3300);const strike2=f.sprite.frame.name;
 s.clock+=400;s.runTimers();results.push({id,form,solid:punch.solid,different:punch.hash!==idle.hash,strike1,recovery,strike2,finished:!f.locked});
 }
 for(const key of ['sprite','shadow','aura','orb'])f[key].destroy();f.stormAura?.image.destroy();f.stormAura?.particles.destroy();row++;
 }
 s.state='inspect';document.getElementById('stage').style.display='none';document.body.style.display='block';document.body.style.overflow='auto';document.body.append(canvas);return results;
});
assert.equal(report.length,36);for(const r of report){assert.ok(r.different&&r.solid>100,r.id+' '+r.form);assert.equal(r.strike1,'punch');assert.equal(r.strike2,'punch');assert.equal(r.recovery,'idle1');assert.ok(r.finished);}
assert.deepEqual(errors,[]);await p.locator('#melee-preview').screenshot({path:'all-melee-punches-preview.png'});console.log(JSON.stringify({characters:12,forms:36,distinctPunchArtwork:'passed',meleeComboStrikesAndRecovery:'passed',errors}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
