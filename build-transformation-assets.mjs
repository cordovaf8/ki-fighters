import fs from 'node:fs';
import sharp from 'sharp';
const root='C:/Users/GLaptop/.codex/generated_images/01a1d12c-28a3-73c0-a982-c59e0084389e/';
const sources={brakka:'6286c557-67f4-45db-a14e-6363e87be74b',selune:'7d3fbc02-96e0-4183-97dc-f64a5f2a6caa',vorr:'0dbbe18f-1f91-4367-9f7a-69ac7c0b0802',zeta:'fa13d2c2-dcb4-48d4-bb85-bfda995872af',draal:'01ebbd2d-bd0e-489d-9fef-d0f8c4edbe94',sparring:'de35ff30-9456-4945-8fe4-b7c22ace545a'};
Object.assign(sources, { redhair: '90d8241f-8384-4051-914a-fdf2e8aea406', green: '2f8ebc96-3f05-476f-8d37-bdcbe546f775', redgi: '854e900d-550f-4aeb-8724-81a23d688099', gold: '301c7649-700c-48b4-9bfa-4d1379865f18', mage: 'edbfdb64-f1e0-4fbf-8cd1-387c0651faae' });
const fullPoseSets = new Set(['redhair', 'green', 'redgi', 'gold', 'mage']);
const poses=['idle0','idle1','shoot','charge','beam','punch','hurt','block','power','special'];
let imports=[],entries=[];
for(const [id,token] of Object.entries(sources)){
 const dir=`assets/characters/${id}`;fs.mkdirSync(dir,{recursive:true});
 const dest=`${dir}/transformations.png`;
 if(!fs.existsSync(dest))fs.copyFileSync(`${root}exec-${token}.png`,dest);
 const source=dest;
 const m=await sharp(source).metadata();
 const firstForm = fullPoseSets.has(id) ? 0 : 1;
 const rows = firstForm === 0 ? 6 : 4;
 for(let form=firstForm;form<=2;form++)for(let i=0;i<10;i++){
  const row=(form-firstForm)*2+Math.floor(i/5),col=i%5;
  const left=Math.round(col*m.width/5),top=Math.round(row*m.height/rows);
  const width=Math.round((col+1)*m.width/5)-left,height=Math.round((row+1)*m.height/rows)-top;
  const name=`${id}_${form}_${poses[i]}`,originalFile=`${dir}/form-${form}-${poses[i]}.png`;
  const repairedFile = `${dir}/form-${form}-punch-v2.png`;
  const file = poses[i] === 'punch' && fs.existsSync(repairedFile) ? repairedFile : originalFile;
  if (file === originalFile) await sharp(source).extract({left,top,width,height}).png().toFile(file);
  imports.push(`import ${name} from '../../${file}';`);entries.push(`  '${id}-form-${form}-${poses[i]}': ${name}`);
 }
}
fs.writeFileSync('src/assets/transformation-images.js',imports.join('\n')+'\n\nexport const transformationImages = {\n'+entries.join(',\n')+'\n};\n');
console.log(`Saved ${Object.keys(sources).length} original sheets and ${entries.length} combat pose assets.`);
