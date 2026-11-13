// Small canvas-painted weapons match the game's existing procedural effects.
// Bodies use normal blending so metal, rocks and bombs retain their color.
export const PROJECTILE_STYLES = {
  jin: { shape: 'storm', color: '#6feaff', basic: 'Storm Bolt', charged: 'Tempest Spear' },
  sparring: { shape: 'palm', color: '#ffe28a', basic: 'Focus Disc', charged: 'Grandmaster Seal' },
  brakka: { shape: 'rock', color: '#ff9640', basic: 'Stone Shot', charged: 'Magma Boulder' },
  selune: { shape: 'moon', color: '#cdb2ff', basic: 'Moon Crescent', charged: 'Eclipse Orb' },
  vorr: { shape: 'alien', color: '#aeff57', basic: 'Plasma Dart', charged: 'Alien Torpedo' },
  zeta: { shape: 'rocket', color: '#ff9c4a', basic: 'Micro Rocket', charged: 'Reactor Bomb' },
  draal: { shape: 'void', color: '#d579ff', basic: 'Void Claw', charged: 'Calamity Dragon' },
  redhair: { shape: 'fire', color: '#ff813b', basic: 'Fireball', charged: 'Inferno Comet' },
  green: { shape: 'seed', color: '#79ee80', basic: 'Emerald Seed', charged: 'Thorn Pod' },
  redgi: { shape: 'dragon', color: '#ff557e', basic: 'Scarlet Fang', charged: 'Dragon Heart' },
  gold: { shape: 'sun', color: '#ffdf69', basic: 'Solar Ray', charged: 'Sunburst' },
  mage: { shape: 'rune', color: '#72d9ff', basic: 'Rune Star', charged: 'Astral Prism' },
};

export function projectileTexture(id, charged) {
  return `projectile_${id}_${charged ? 'charged' : 'basic'}`;
}

export function buildProjectileTextures(scene, id) {
  const style = PROJECTILE_STYLES[id];
  if (!style) return;
  for (const charged of [false, true]) {
    const key = projectileTexture(id, charged);
    if (scene.textures.exists(key)) continue;
    const tex = scene.textures.createCanvas(key, 96, 64), c = tex.context;
    const color = style.color, r = charged ? 23 : 13;
    const circle = (x, y, size, fill, stroke) => {
      c.beginPath(); c.arc(x, y, size, 0, Math.PI * 2);
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
    };
    const poly = (points, fill, stroke) => {
      c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); }
    };
    const line = (points, stroke, width = 2) => {
      c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      c.strokeStyle = stroke; c.lineWidth = width; c.lineJoin = 'round'; c.stroke();
    };
    c.translate(48, 32);
    c.shadowColor = color; c.shadowBlur = style.shape === 'rocket' || style.shape === 'rock' ? 3 : 7;
    switch (style.shape) {
      case 'storm':
        poly([[-40, 5], [-12, -5], [-24, -12], [r + 7, -3], [2, 5], [12, 13]], color, '#e7ffff');
        line([[-29, 3], [-3, -2], [-12, -6], [r + 2, -2]], '#ffffff', 2);
        if (charged) { line([[-30,-18],[-8,-11],[-18,-4]], color); line([[-29,18],[-5,11],[12,17]], color); }
        break;
      case 'palm':
        circle(0, 0, r, '#a46b25', color); circle(0, 0, r - 4, null, '#fff3c2');
        if (charged) {
          c.fillStyle = '#fff3c2'; c.beginPath(); c.arc(0, 0, 14, -Math.PI/2, Math.PI/2); c.fill();
          circle(0,-7,7,'#fff3c2'); circle(0,7,7,'#a46b25'); circle(0,-7,2,'#a46b25'); circle(0,7,2,'#fff3c2');
        } else { line([[-8,0],[8,0]], '#fff8df',3); line([[0,-8],[0,8]], '#fff8df',3); }
        break;
      case 'rock':
        poly([[-r, -r*.4],[-r*.5,-r],[r*.5,-r*.85],[r,-2],[r*.6,r*.8],[-r*.5,r]], '#65534c', '#b99676');
        poly([[-r,-r*.4],[0,-r*.6],[r*.2,1],[-r*.5,r]], '#443d40');
        line([[-9,-13],[-2,-5],[-5,3],[6,7],[8,17]], charged ? '#ffb337' : '#b99676', charged ? 4 : 2);
        if (charged) line([[-18,7],[-5,3],[6,-8],[17,-9]], '#ff682e',3);
        break;
      case 'moon':
        if (charged) { circle(0,0,r,'#17182e',color); circle(0,0,r+3,null,'#eee1ff'); circle(4,-3,5,'#b28ae8'); }
        else {
          c.beginPath(); c.arc(0,0,16,-Math.PI*.7,Math.PI*.7); c.arc(7,0,13,Math.PI*.62,-Math.PI*.62,true); c.closePath(); c.fillStyle='#e9d9ff'; c.fill();
        }
        break;
      case 'alien':
        poly([[-r-10,-r*.5],[2,-r*.8],[r+7,0],[2,r*.8],[-r-10,r*.5],[-r,0]], '#547238', color);
        circle(1,0,charged?12:6,'#cbff7a','#f1ffcb');
        if (charged) { line([[-17,-14],[-5,-20],[13,-13]],color,3); line([[-17,14],[-5,20],[13,13]],color,3); }
        break;
      case 'rocket':
        if (charged) {
          circle(0,0,20,'#30394c','#a7b9d2'); circle(0,0,12,'#1b2336','#f76e4d');
          poly([[-6,-5],[4,-5],[7,0],[4,5],[-6,5]], '#ffb957');
          poly([[-20,-7],[-31,-18],[-27,-2]],'#a8b8d0','#263147'); poly([[-20,7],[-31,18],[-27,2]],'#a8b8d0','#263147');
          line([[17,-11],[27,0],[17,11]],'#ff6748',3);
        } else {
          poly([[-22,-5],[9,-5],[20,0],[9,5],[-22,5]],'#c7d4e2','#344258');
          poly([[9,-5],[20,0],[9,5]],'#ff6650');
          poly([[-18,-4],[-26,-11],[-25,-1]],'#6898cd'); poly([[-18,4],[-26,11],[-25,1]],'#6898cd');
          poly([[-23,-3],[-38,0],[-23,3]],'#ffc862');
        }
        break;
      case 'void':
        if (charged) {
          poly([[-29,-18],[-4,-9],[5,-22],[10,-8],[27,-3],[17,5],[22,13],[0,20],[-22,8]],'#38254f',color);
          poly([[1,-5],[15,-2],[5,2]],'#fff3ff'); line([[9,9],[18,8]],'#ff8fbf',3);
        } else for (const y of [-10,0,10]) poly([[-22,y-5],[20,y],[-22,y+3],[-8,y]],color,'#eed3ff');
        break;
      case 'fire':
        poly([[-39,-r*.7],[-13,-r*.55],[-24,-r],[4,-r*.8],[r,0],[4,r*.8],[-26,r],[-15,r*.4],[-40,r*.3],[-23,0]],'#ef4529','#ff9d32');
        circle(2,0,r*.72,'#ffad35'); circle(7,0,r*.42,'#fff1a6');
        break;
      case 'seed':
        circle(0,0,r,charged?'#285e41':'#83b85a','#b5ef83');
        for (let i=0;i<(charged?8:3);i++) { const a=i*Math.PI*2/(charged?8:3),x=Math.cos(a),y=Math.sin(a);poly([[x*r-y*4,y*r+x*4],[x*(r+8),y*(r+8)],[x*r+y*4,y*r-x*4]],'#d7f8b6','#538d52'); }
        line([[-5,-r*.65],[1,0],[-3,r*.65]],'#ddffb3',3);
        break;
      case 'dragon':
        if (charged) { circle(0,0,r,'#8c233f','#ffb29d'); poly([[-18,-12],[-3,-17],[13,-8],[3,0],[14,10],[-1,16],[-12,7],[2,7],[-7,-1],[3,-8]],'#ffd0a4'); }
        else poly([[-27,-9],[-6,-4],[18,0],[-6,4],[-27,9],[-12,0]],'#ff7a8c','#ffe0c2');
        break;
      case 'sun':
        for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a),y=Math.sin(a);poly([[x*(r-3)-y*3,y*(r-3)+x*3],[x*(r+7),y*(r+7)],[x*(r-3)+y*3,y*(r-3)-x*3]],'#ffc04a');}
        circle(0,0,r-3,'#ffe98b','#fff9d3');circle(-3,-3,r*.35,'#fffce7');
        break;
      case 'rune':
        if(charged){poly([[0,-24],[23,-9],[22,15],[0,25],[-22,12],[-22,-10]],'#183a66',color);line([[0,-24],[0,1],[22,15]],'#d0f8ff');line([[-22,-10],[0,1],[23,-9]],color);line([[0,1],[0,25]],color);}
        else {poly([[0,-18],[5,-5],[18,0],[5,5],[0,18],[-5,5],[-18,0],[-5,-5]],'#b5f1ff',color);circle(0,0,4,'#ffffff');}
        break;
    }
    tex.refresh();
  }
}

/** Direction follows velocity, so parries reverse rockets and pointed weapons. */
export function animateProjectile(p, time) {
  if (!p.style) return;
  p.spr.setFlipX(p.vx < 0);
  const pulse = 1 + Math.sin(time / (p.big ? 85 : 60)) * .035;
  p.spr.setScale(p.visualScale * pulse);
  const g = p.trail;
  if (!g) return;
  g.clear().setDepth(p.spr.depth - .1);
  const dir = Math.sign(p.vx), color = Number.parseInt(p.style.color.slice(1),16);
  const smoke = p.style.shape === 'rocket' || p.style.shape === 'rock';
  for(let i=0;i<(p.big?7:4);i++){
    const phase=(time/100+i*.37)%1;
    const x=p.x-dir*(16+i*7),y=p.y+Math.sin(time/80+i*2)*(p.big?5:3);
    g.fillStyle(smoke?0x8d99af:color,(1-i/(p.big?8:5))*.36);
    g.fillCircle(x,y,(p.big?5:2.5)*(1-phase*.4));
  }
  if(p.style.shape==='rocket'){
    g.fillStyle(0xffb64b,.9);g.fillTriangle(p.x-dir*14,p.y-3,p.x-dir*(27+Math.sin(time/35)*5),p.y,p.x-dir*14,p.y+3);
  }
}
