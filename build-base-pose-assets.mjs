import fs from 'node:fs';
import sharp from 'sharp';
const root='C:/Users/GLaptop/.codex/generated_images/01a1d12c-28a3-73c0-a982-c59e0084389e/';
const sources={jin:'2913fc52-cd34-4746-94df-eef564e9b45b',sparring:'e09be951-e0d6-41ff-be4d-1102b900ccfc',brakka:'52b9235c-5726-4949-95c5-da4b5496ed93',selune:'8fa27a1a-4bbc-4987-89c0-49fc8e1c8029',vorr:'b3468534-f74c-4a3c-abeb-cd00377bd6e6',zeta:'74527aab-6b88-457e-81f4-0ac97dd07d3a',draal:'1d181cd3-0ec1-4662-9b36-075848ef0a99'};
const poses=['idle0','idle1','shoot','charge','beam','punch','hurt','block','power','special'];
const imports=[],entries=[];
for(const [id,token]of Object.entries(sources)){
 const dir=`assets/characters/${id}`;fs.mkdirSync(dir,{recursive:true});
 const sheet=`${dir}/base-poses.png`;if(!fs.existsSync(sheet))fs.copyFileSync(`${root}exec-${token}.png`,sheet);
 const m=await sharp(sheet).metadata();
 for(let i=0;i<poses.length;i++){
 const col=i%5,row=Math.floor(i/5),left=Math.round(col*m.width/5),top=Math.round(row*m.height/2);
 const width=Math.round((col+1)*m.width/5)-left,height=Math.round((row+1)*m.height/2)-top;
 const name=`${id}_base_${poses[i]}`,file=`${dir}/base-${poses[i]}.png`;
 await sharp(sheet).extract({left,top,width,height}).png().toFile(file);
 imports.push(`import ${name} from '../../${file}';`);entries.push(`  '${id}-base-${poses[i]}': ${name}`);
 }
}
fs.writeFileSync('src/assets/base-pose-images.js',imports.join('\n')+'\n\nexport const basePoseImages = {\n'+entries.join(',\n')+'\n};\n');
console.log('Saved seven base sheets and 70 individual pose images.');
