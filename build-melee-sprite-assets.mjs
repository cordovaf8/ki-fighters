import fs from 'node:fs';
const d=JSON.parse(fs.readFileSync('src/data/fighters.json'));
const out='assets/characters/melee';fs.mkdirSync(out,{recursive:true});const manifest=[];
for(const[id,f]of Object.entries(d))for(const [formIndex,form] of f.forms.entries()){
 const prefix=form.spriteSet;
 let source=prefix.startsWith(id+'-form-')?`assets/characters/${id}/form-${prefix.split('-').at(-1)}-punch.png`:prefix.endsWith('-base')?`assets/characters/${id}/base-punch.png`:prefix==='jin-armor-02'?'assets/characters/jin/armor-02-punch.png':'assets/characters/jin/armor-01-punch.png';
 if (fs.existsSync(source.replace('.png','-v2.png'))) source=source.replace('.png','-v2.png');
 const file=`${out}/${id}-${form.id}.png`;fs.copyFileSync(source,file);manifest.push({character:id,name:f.name,form:form.name,file,source});
 for (const pose of ['punchBack','uppercut']) {
   let extraSource=`assets/characters/${id}/form-${formIndex}-${pose}.png`;
   if(fs.existsSync(extraSource.replace('.png','-v2.png')))extraSource=extraSource.replace('.png','-v2.png');
   const extraFile=`${out}/${id}-${form.id}-${pose}.png`;
   fs.copyFileSync(extraSource,extraFile);
   manifest.push({character:id,name:f.name,form:form.name,pose,file:extraFile,source:extraSource});
 }
}
fs.writeFileSync(out+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log('Exported '+manifest.length+' individual melee punch sprites.');
