const esbuild=require('esbuild'),{chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const {spriteAssets}=await import('./build-sprite-assets.mjs');
 await esbuild.build({plugins:[spriteAssets],stdin:{contents:"import './src/main.js';import {S,Data} from './src/core/data.js';import {Fighter} from './src/systems/Fighter.js';window.__check={S,Data,Fighter};",resolveDir:process.cwd()},outfile:'restored-transformations-runtime.js',bundle:true,minify:true,loader:{'.png':'dataurl'},alias:{phaser:'./vendor/phaser.esm.min.js'},logLevel:'silent'});
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
 const p=await b.newPage({viewport:{width:1400,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/game.js',r=>r.fulfill({path:'restored-transformations-runtime.js',contentType:'application/javascript'}));
 await p.goto('file:///C:/Users/GLaptop/Desktop/dbz%20game/index.html');
 await p.waitForFunction(()=>window.__check?.S.game?.scene?.isActive('Menu'));
 await p.locator('[data-act=menu]').click();await p.locator('[data-act=training]').click();await p.getByRole('button',{name:/Skip/}).click();await p.waitForTimeout(400);
 const report=await p.evaluate(()=>{
  const {S,Data,Fighter}=window.__check,s=S.game.scene.getScene('Battle');s.ai.update=()=>{};
  const poses=['idle0','idle1','shoot','charge','beam','punch','hurt','block','power','special'],results=[];
  for(const id of ['redhair','green','redgi','gold','mage']){
   const f=new Fighter(s,{id,def:Data.fighters[id],side:'enemy',stats:Data.opponents.training.stats,maxForm:2,col:4,row:1});
   const forms=[];
   const baseFrames=poses.map(pose=>{f.setPose(pose);f.render(3000);return {pose,frame:f.sprite.frame.name,present:f.sprite.texture.has(pose)};});
   f.clearPose();
   for(let n=1;n<=2;n++){
    f.ki=100;f.locked=false;f.lockUntil=0;f.hurtUntil=0;
    const ascended=s.transform.ascend(f,{free:true});
    s.clock+=601;s.runTimers();f.render(3500);
    const frames=poses.map(pose=>{f.setPose(pose);f.render(4000);return {pose,frame:f.sprite.frame.name,present:f.sprite.texture.has(pose)};});
    forms.push({form:f.formIndex,ascended,texture:f.sprite.texture.key,scale:f.sprite.scaleY,auraScale:f.aura.scaleY,aura:f.aura.visible,frames,handFinite:Number.isFinite(f.handX)&&Number.isFinite(f.handY)});
   }
   s.transform.revert(f,true);f.render(4500);
   results.push({id,baseFrames,forms,reverted:f.formIndex===0&&!f.aura.visible});
   for(const key of ['sprite','aura','shadow','orb'])f[key].destroy();
  }
  s.state='inspect';
  s.add.rectangle(480,270,960,540,0x111626).setDepth(100);
  for(const [row,id] of ['redhair','green','redgi','gold','mage'].entries()){
   for(let form=0;form<=2;form++){
    const x=96+row*190,y=166+form*174;
    s.add.sprite(x,y,`f_${id}_${form}`,'idle0').setOrigin(.5,1).setScale(.43*(Data.fighters[id].forms[form].spriteScale||1)).setDepth(101);
    s.add.text(x,8+form*174,form===0?Data.fighters[id].name:Data.fighters[id].forms[form].name,{fontSize:'12px',color:'#ffffff',align:'center',wordWrap:{width:145}}).setOrigin(.5,0).setDepth(102);
   }
  }
  return {results,opponentForms:Data.opponents.ladder.map(o=>o.maxForm),trainerForms:s.enemy.maxForm};
 });
 for(const r of report.results){assert.ok(r.baseFrames.every(x=>x.present&&x.pose===x.frame));assert.ok(r.reverted,r.id+' reversion');for(const f of r.forms){assert.ok(f.ascended,r.id+' ascend');assert.ok(f.aura);assert.ok(f.handFinite);assert.ok(f.frames.every(x=>x.present&&x.pose===x.frame));assert.equal(f.form,r.forms.indexOf(f)+1);}assert.ok(r.forms[1].scale>r.forms[0].scale);assert.ok(r.forms[1].auraScale>r.forms[0].auraScale);}
 assert.ok(report.opponentForms.every(x=>x===2));assert.equal(report.trainerForms,2);assert.deepEqual(errors,[]);
 await p.addStyleTag({content:'#hud,#ui,#toast { display:none !important; }'});await p.waitForTimeout(100);await p.screenshot({path:'restored-transformations-preview.png'});
 console.log(JSON.stringify({characters:report.results.length,forms:report.results.length*2,poses:report.results.length*30,ascensionAndReversion:'passed',largerFinalForms:'passed',largerAuras:'passed',errors}));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exit(1)});

