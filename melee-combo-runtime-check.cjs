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
const canvas=document.createElement('canvas');canvas.id='combo-preview';canvas.width=1440;canvas.height=12*180+40;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#111728';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='white';c.font='14px sans-serif';for(let i=0;i<3;i++){c.fillText('Front punch',i*480+15,23);c.fillText('Back-hand cross',i*480+165,23);c.fillText('Front uppercut',i*480+325,23);}let row=0;
const sample=document.createElement('canvas');sample.width=320;sample.height=320;const cc=sample.getContext('2d',{willReadFrequently:true});
for(const[id,def]of Object.entries(Data.fighters)){
const f=new Fighter(s,{id,def,side:'player',stats:def.stats,maxForm:def.forms.length-1,col:1,row:1});f.foe=s.enemy;
for(let form=0;form<def.forms.length;form++){
f.setForm(form);const texture=f.sprite.texture;const hashes=[];c.fillStyle='white';c.fillText(def.name+' — '+def.forms[form].name,form*480+8,row*180+47);
for(const[poseIndex,pose]of ['punch','punchBack','uppercut'].entries()){
f.setPose(pose);f.render(3000);const frame=texture.get(pose);cc.clearRect(0,0,320,320);cc.drawImage(texture.getSourceImage(),frame.cutX,frame.cutY,320,320,0,0,320,320);const pixels=cc.getImageData(0,0,320,320).data;let h=2166136261,solid=0;for(let i=0;i<pixels.length;i++){h=Math.imul(h^pixels[i],16777619);if(i%4===3&&pixels[i]>200)solid++;}hashes.push({h:h>>>0,solid});c.drawImage(sample,form*480+poseIndex*160,row*180+51,144,144);
}
s.enemy.alive=true;s.enemy.hp=s.enemy.maxHp;s.enemy.invulnUntil=0;s.enemy.row=1;s.enemy.col=4;f.locked=false;f.clearPose();
s.combat.rush(f,{windupMs:10,hits:3,damage:1,knockback:0});s.clock+=11;s.runTimers();s.runTimers();f.render(3100);const first=f.sprite.frame.name;
s.clock+=111;s.runTimers();f.render(3200);const second=f.sprite.frame.name;
s.clock+=110;s.runTimers();f.render(3300);const third=f.sprite.frame.name;
s.clock+=400;s.runTimers();results.push({id,form,distinct:new Set(hashes.map(x=>x.h)).size,solid:hashes.every(x=>x.solid>100),first,second,third,finished:!f.locked});
}
for(const key of ['sprite','shadow','aura','orb'])f[key].destroy();f.stormAura?.image.destroy();f.stormAura?.particles.destroy();row++;
}
s.state='inspect';document.getElementById('stage').style.display='none';document.body.style.display='block';document.body.style.overflow='auto';document.body.append(canvas);return results;
});
assert.equal(report.length,36);for(const r of report){assert.equal(r.distinct,3,r.id+' '+r.form);assert.ok(r.solid&&r.finished);assert.equal(r.first,'punch');assert.equal(r.second,'punchBack');assert.equal(r.third,'uppercut');}assert.deepEqual(errors,[]);await p.locator('#combo-preview').screenshot({path:'all-melee-combos-preview.png'});console.log(JSON.stringify({characters:12,forms:36,distinctStrikes:108,comboOrder:'front punch, rear cross, front uppercut',renderingAndRecovery:'passed',errors}));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
