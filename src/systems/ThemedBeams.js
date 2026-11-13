import { PROJECTILE_STYLES } from './ProjectileStyles.js';

export const BEAM_NAMES = {
  jin: 'Tempest Lightning', sparring: 'Golden Palm Stream',
  brakka: 'Magma Torrent', selune: 'Eclipse Ray', vorr: 'Alien Plasma Lance',
  zeta: 'Reactor Laser', draal: 'Calamity Dragon Breath', redhair: 'Inferno Torrent',
  green: 'Verdant Thorn Stream', redgi: 'Scarlet Dragon Breath',
  gold: 'Solar Flare Cannon', mage: 'Astral Rune Lance',
};

export function finalChargeIsBeam(fighter) {
  return fighter.formIndex > 0 && (fighter.form?.chargedAttack === 'beam' || fighter.formIndex === fighter.def.forms.length - 1);
}

export function beamColor(beam) {
  const color = PROJECTILE_STYLES[beam.theme]?.color;
  return color ? Number.parseInt(color.slice(1), 16) : beam.owner.kiColor;
}

// Overlay animated silhouettes on the beam core, clipped to its current reach.
export function drawBeamTheme(g, beam, time, start, width, y, thickness) {
  const style = PROJECTILE_STYLES[beam.theme];
  if (!style || width < 4) return;
  const color = beamColor(beam), direction = beam.owner.facing;
  const right = start + width, edge = thickness / 2;
  const line = (points, tint = color, weight = 2, alpha = .9) => {
    g.lineStyle(weight, tint, alpha); g.beginPath();
    points.forEach(([x, yy], i) => i ? g.lineTo(x, yy) : g.moveTo(x, yy)); g.strokePath();
  };
  const end = direction > 0 ? right : start;
  const phase = time / 80;
  if (style.shape === 'storm') {
    for (const sign of [-1, 1]) {
      const points = [];
      for (let x = start; x <= right; x += 12) points.push([x, y + sign * (edge + 5 + Math.sin(x*.15+phase)*9)]);
      line(points, 0xaaffff, 3);
    }
  } else if (style.shape === 'rocket') {
    // A precise mechanical laser with segmented reactor rails and targeting rings.
    line([[start,y-edge-4],[right,y-edge-4]],0xff5e48,3);
    line([[start,y+edge+4],[right,y+edge+4]],0xff5e48,3);
    for(let x=start+((time/5)%42);x<right-8;x+=42){
      g.fillStyle(0xd4e5ff,.95).fillRect(x,y-edge,3,thickness);
      g.lineStyle(2,0xffaf67,.7).strokeCircle(x,y,edge+8);
    }
  } else if (style.shape === 'fire' || style.shape === 'rock') {
    for(let x=start+8;x<right-10;x+=19){
      const flicker=5+Math.sin(x*.13+phase)*5;
      g.fillStyle(style.shape==='fire'?0xff943b:0x9b4530,.85);
      for(const sign of [-1,1])g.fillTriangle(x,y+sign*edge,x-direction*14,y+sign*(edge+flicker),x+direction*9,y+sign*edge);
      if(style.shape==='rock')g.fillStyle(0x4e3c39,.95).fillRect(x,y+Math.sin(x+phase)*(edge-3),7,6);
    }
  } else if (style.shape === 'palm' || style.shape === 'sun') {
    for(let x=start+((time/7)%54)+8;x<right-12;x+=54){
      g.lineStyle(2,style.shape==='sun'?0xffc347:0xffedaf,.85).strokeCircle(x,y,edge+5);
      if(style.shape==='sun')for(const sign of [-1,1])g.fillStyle(0xffe994,.85).fillTriangle(x-5,y+sign*edge,x,y+sign*(edge+14),x+5,y+sign*edge);
    }
  } else if (style.shape === 'moon' || style.shape === 'alien' || style.shape === 'seed') {
    for(const sign of [-1,1]){
      const points=[];
      for(let x=start;x<=right;x+=8)points.push([x,y+sign*Math.sin(x*.045-phase)*edge]);
      line(points,style.shape==='moon'?0xe7d1ff:style.shape==='seed'?0xc7ffb4:0xe2ffac,3);
    }
    if(style.shape==='seed')for(let x=start+10;x<right-12;x+=36)for(const sign of [-1,1])g.fillStyle(0xb5ef91,.9).fillTriangle(x-6,y+sign*edge,x+2,y+sign*(edge+12),x+7,y+sign*edge);
    if(style.shape==='moon')for(let x=start+15;x<right-15;x+=62)g.lineStyle(2,0xe5dbff,.6).strokeCircle(x,y,edge+6);
  } else if (style.shape === 'void' || style.shape === 'dragon') {
    for(let x=start+15;x<right-10;x+=26)for(const sign of [-1,1]){
      g.fillStyle(style.shape==='void'?0x842dba:0x9c244b,.9).fillTriangle(x-direction*12,y+sign*edge,x,y+sign*(edge+11),x+direction*9,y+sign*edge);
    }
    // An angular dragon head at the moving tip; it stops at the clash point.
    const tip=end-direction*3;
    g.fillStyle(style.shape==='void'?0x3a184f:0x8a233d,.95);
    g.fillTriangle(tip,y,tip-direction*32,y-edge-10,tip-direction*32,y+edge+10);
    g.fillStyle(0xffefd6,1).fillTriangle(tip-direction*8,y-4,tip-direction*23,y-10,tip-direction*17,y-2);
  } else if (style.shape === 'rune') {
    for(let x=start+((time/8)%52)+12;x<right-20;x+=52){
      const size=edge+6;
      line([[x,y-size],[x+size*.6,y-size*.5],[x+size*.6,y+size*.5],[x,y+size],[x-size*.6,y+size*.5],[x-size*.6,y-size*.5],[x,y-size]],0xb7f2ff,2);
      line([[x-size*.4,y],[x+size*.4,y]],0xffdf7c,2);
      line([[x,y-size*.5],[x,y+size*.5]],0xffdf7c,2);
    }
  }
}
