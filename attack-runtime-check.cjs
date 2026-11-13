const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const p=await b.newPage({viewport:{width:1100,height:800}});let errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/game.js',r=>r.fulfill({path:'sprite-runtime-check.js',contentType:'application/javascript'}));
await p.goto('file:///C:/Users/GLaptop/Desktop/dbz%20game/index.html');await p.waitForFunction(()=>window.__spriteCheck?.game?.scene?.isActive('Menu'));
await p.locator('[data-act=menu]').click();await p.locator('[data-act=training]').click();await p.getByRole('button',{name:/Skip/}).click();await p.waitForTimeout(800);
const inspect=()=>p.evaluate(()=>{const s=window.__spriteCheck.game.scene.getScene('Battle');return {frame:s.player.sprite.frame.name,pose:s.player.pose,projectiles:s.combat.projectiles.filter(p=>p.owner===s.player).map(p=>p.big),hand:[s.player.handX,s.player.handY]};});
await p.keyboard.down('j');await p.waitForTimeout(60);console.log('basic',await inspect());await p.screenshot({path:'attack-basic-check.png'});
await p.waitForTimeout(1400);console.log('holding',await inspect());await p.screenshot({path:'attack-charge-check.png'});
await p.keyboard.up('j');await p.waitForTimeout(70);console.log('released',await inspect());await p.screenshot({path:'attack-release-check.png'});
await p.waitForTimeout(300);console.log('idle',await inspect());
console.log('textures',await p.evaluate(()=>{const t=window.__spriteCheck.game.textures;return Array.from({length:12},(_,i)=>({i,loaded:t.exists('attack-'+i),w:t.get('attack-'+i).getSourceImage().width}));}));
console.log('errors',errors);if(errors.length)process.exitCode=1;await b.close();
})();
