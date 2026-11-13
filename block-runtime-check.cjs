const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const p=await b.newPage({viewport:{width:1100,height:800}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/game.js',r=>r.fulfill({path:'sprite-runtime-check.js',contentType:'application/javascript'}));
await p.goto('file:///C:/Users/GLaptop/Desktop/dbz%20game/index.html');await p.waitForFunction(()=>window.__spriteCheck?.game?.scene?.isActive('Menu'));
await p.locator('[data-act=menu]').click();await p.locator('[data-act=training]').click();await p.getByRole('button',{name:/Skip/}).click();await p.waitForTimeout(500);
// Keep AI attacks from disrupting the input check.
await p.evaluate(()=>{const s=window.__spriteCheck.game.scene.getScene('Battle');s.enemy.locked=true;});
const state=()=>p.evaluate(()=>{const f=window.__spriteCheck.game.scene.getScene('Battle').player;return {frame:f.sprite.frame.name,blocking:f.blocking};});
await p.keyboard.down('l');await p.waitForTimeout(100);const held=await state();await p.waitForTimeout(500);const sustained=await state();await p.screenshot({path:'block-held-check.png'});
await p.keyboard.up('l');await p.waitForTimeout(100);const released=await state();
await p.keyboard.down('j');await p.waitForTimeout(30);await p.keyboard.up('j');await p.keyboard.down('l');await p.waitForTimeout(50);const afterShot=await state();await p.keyboard.up('l');
const artwork=await p.evaluate(()=>{const t=window.__spriteCheck.game.textures;return Object.entries(window.__spriteData.fighters).flatMap(([id,d])=>d.forms.map((_,i)=>{const tex=t.get(`f_${id}_${i}`),ctx=tex.context;const a=ctx.getImageData(0,0,320,320).data,b=ctx.getImageData(7*320,0,320,320).data;return {id,form:i,distinct:a.some((v,j)=>v!==b[j])};}));});
const loaded=await p.evaluate(()=>Array.from({length:12},(_,i)=>window.__spriteCheck.game.textures.exists('block-'+i)).every(Boolean));
console.log(JSON.stringify({held,sustained,released,afterShot,all12Loaded:loaded,allFormsDistinct:artwork.every(x=>x.distinct),forms:artwork.length,errors}));
if(!held.blocking||held.frame!=='block'||sustained.frame!=='block'||released.blocking||!released.frame.startsWith('idle')||afterShot.frame!=='block'||!loaded||artwork.some(x=>!x.distinct)||errors.length)process.exitCode=1;
await b.close();})();
