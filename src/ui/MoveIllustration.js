import { basePoseImages } from '../assets/base-pose-images.js';

// Small tactical illustrations use the same fighter art as the game.
export function moveIllustration(t, fighterId = 'jin') {
  const p = t.params || {}, effect = t.effect, color = {ki:'#62ddff',body:'#ffad63',spirit:'#c7a0ff'}[t.school] || '#62ddff';
  const attack = ['projectiles','beam','hook'].includes(effect), support = ['restoreKi','heal','ascend','buff','counter','shadow','mirror'].includes(effect);
  const pose = effect === 'beam' ? 'beam' : attack ? 'shoot' : support ? 'power' : 'punch';
  const art = basePoseImages[`${fighterId}-base-${pose}`] || basePoseImages[`jin-base-${pose}`];
  const foe = basePoseImages['brakka-base-hurt'];
  let tiles = '', marks = '';
  const affected = (c,r) => {
    if(support)return c===1&&r===1;
    if(effect==='capture')return c===3;
    if(effect==='quake')return c===3||c===4;
    if(effect==='area'||p.burst)return c>=3;
    if(effect==='meteors')return c>=3&&(c+r)%2===0;
    if(effect==='rush'||effect==='grapple')return c===4&&r===1;
    return c>=3&&(p.rows==='all'||p.rows==='wide'||r===1);
  };
  for(let r=0;r<3;r++)for(let c=0;c<6;c++){
    const x=9+c*33,y=67+r*18,active=affected(c,r);
    tiles+=`<rect x="${x}" y="${y}" width="31" height="16" rx="2" fill="${active?color:c<3?'#244b79':'#633948'}" fill-opacity="${active?'.55':'.7'}" stroke="${active?color:'#7894b1'}" stroke-opacity=".35"/>`;
  }
  const ray=(y,width=4)=>`<path class="move-ray" d="M67 ${y}H175" fill="none" stroke="${color}" stroke-width="${width}"/><path d="M165 ${y-6}l11 6-11 6" fill="none" stroke="${color}" stroke-width="2"/>`;
  if(effect==='beam')marks=ray(75,11)+(p.rows==='wide'?ray(57,5)+ray(93,5):'');
  else if(effect==='projectiles'){
    const rows=p.rows==='all'?[57,75,93]:[75];
    marks=rows.map(y=>ray(y,1)+[94,125,156].map((x,i)=>`<ellipse class="move-orb" style="animation-delay:${i*.15}s" cx="${x}" cy="${y}" rx="${p.big?9:5}" ry="${p.big?7:4}" fill="${color}"/>`).join('')).join('');
  }else if(effect==='area')marks=`<circle class="move-burst" cx="159" cy="82" r="29" fill="${color}" fill-opacity=".18" stroke="${color}" stroke-width="3"/><path d="M159 45v16m0 43v16m-42-38h16m52 0h16" stroke="${color}" stroke-width="3"/>`;
  else if(effect==='meteors')marks=[115,149,183].map((x,i)=>`<path d="M${x+8} ${20+i*9}l-11 36" stroke="${color}" stroke-width="3"/><circle class="move-orb" cx="${x-3}" cy="${56+i*9}" r="6" fill="${color}"/>`).join('');
  else if(effect==='quake')marks=`<path d="M105 103l13-23 14 20 14-23 15 21 14-16 13 20" fill="none" stroke="${color}" stroke-width="4"/>`;
  else if(effect==='capture')marks=`<path d="M113 108V40l24 6-24 8" fill="${color}" stroke="${color}" stroke-width="3"/>`;
  else if(support){
    marks=`<ellipse class="move-burst" cx="57" cy="70" rx="30" ry="41" fill="${color}" fill-opacity=".12" stroke="${color}" stroke-width="2"/>`;
    if(effect==='shadow')marks+=`<path d="M88 37v51m9-45v40m9-32v25" stroke="${color}" stroke-width="3" stroke-dasharray="5 4" opacity=".6"/>`;
    if(effect==='heal'||effect==='restoreKi')marks+=`<path d="M84 40h20m-10-10v20" stroke="${color}" stroke-width="5"/>`;
    else if(effect==='ascend')marks+=`<path d="M84 54l10-12 10 12m-20-13 10-12 10 12" stroke="${color}" fill="none" stroke-width="4"/>`;
    else if(effect==='buff'||effect==='counter'||effect==='mirror')marks+=`<path d="M86 32l15 5v15l-15 11-15-11V37Z" fill="none" stroke="${color}" stroke-width="3"/>`;
  }else if(effect==='hook')marks=ray(75,2)+`<path d="M174 64q18 16 0 23" fill="none" stroke="${color}" stroke-width="4"/>`;
  else marks=`<path class="move-ray" d="M70 75Q110 25 161 70" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="6 4"/><path d="M149 53l14 19-23-2" fill="none" stroke="${color}" stroke-width="3"/><path d="M170 52l4 10 10-4-5 12 12 5-14 4 2 13-11-9-8 8 1-14-13-3 14-7Z" fill="${color}"/>`;
  return `<span class="move-art" aria-hidden="true"><svg viewBox="0 0 216 126" xmlns="http://www.w3.org/2000/svg"><rect width="216" height="126" fill="#101d33"/><path d="M0 45H216M0 25H216" stroke="#344b66" stroke-opacity=".35"/>${tiles}<image href="${art}" x="15" y="12" width="78" height="89" preserveAspectRatio="xMidYMax meet"/>${support?'':`<image href="${foe}" x="139" y="20" width="65" height="81" preserveAspectRatio="xMidYMax meet"/>`}${marks}</svg><span class="move-art-caption">${support?'Self':p.rows==='all'?'All rows':p.rows==='wide'?'Wide beam':p.rows==='foe'?'Tracks target':effect==='area'?'Area burst':effect==='meteors'?'Enemy tiles':effect==='capture'?'Capture column':effect==='quake'?'Front columns':effect==='rush'||effect==='grapple'?'Close combat':'Along your row'}</span></span>`;
}
export function movePowerLabel(t) {
  return t.params?.damage != null ? 'Base damage' : 'Effect';
}
