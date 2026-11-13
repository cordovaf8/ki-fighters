import fs from 'node:fs';import sharp from 'sharp';
const p='src/data/fighters.json',d=JSON.parse(fs.readFileSync(p));const imports=[],entries=[];
for(const[id,f]of Object.entries(d)){
 f.meleePoses=['punch','punchBack','uppercut'];
 if(id==='jin')continue;
 const dir=`assets/characters/${id}`,sheet=`${dir}/melee-combo-poses.png`,m=await sharp(sheet).metadata();
 for(let form=0;form<3;form++)for(let col=0;col<2;col++){
  const pose=col===0?'punchBack':'uppercut',left=Math.round(col*m.width/2),top=Math.round(form*m.height/3),width=Math.round((col+1)*m.width/2)-left,height=Math.round((form+1)*m.height/3)-top;
  let file=`${dir}/form-${form}-${pose}.png`;
  await sharp(sheet).extract({left,top,width,height}).png().toFile(file);
  const revision = [3, 2].find(version => fs.existsSync(`${dir}/rear-cross-v${version}.png`));
  const refined=`${dir}/rear-cross-v${revision}.png`;
  if(pose==='punchBack'&&revision){
   const rm=await sharp(refined).metadata(),rt=Math.round(form*rm.height/3),rh=Math.round((form+1)*rm.height/3)-rt;
   file=`${dir}/form-${form}-${pose}-v${revision}.png`;await sharp(refined).extract({left:0,top:rt,width:rm.width,height:rh}).png().toFile(file);
  }
  const name=`${id}_${form}_${pose}`;imports.push(`import ${name} from '../../${file}';`);entries.push(` '${f.forms[form].spriteSet}-${pose}': ${name}`);
 }
}
fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');fs.writeFileSync('src/assets/roster-melee-images.js',imports.join('\n')+'\nexport const rosterMeleeImages={\n'+entries.join(',\n')+'\n};\n');console.log('Prepared 66 new combat frames across 33 forms.');
