// Opponent identity owns the arena in every battle mode.
export const ARENAS = {
  jin: { name: 'Stormbreak Summit', kind: 'storm', sky: [0x101d37, 0x426785], ground: 0x182c3b, accent: 0x87eaff },
  sparring: { name: 'Grandmaster Courtyard', kind: 'dojo', sky: [0x434368, 0xe7ae88], ground: 0x3a3541, accent: 0xffd89b },
  brakka: { name: 'Titan Canyon', kind: 'canyon', sky: [0x733644, 0xf8ae70], ground: 0x57312a, accent: 0xf4a45e },
  selune: { name: 'Moonveil Lake', kind: 'moon', sky: [0x090f30, 0x454a80], ground: 0x171f3d, accent: 0xd5d6ff },
  vorr: { name: 'Star Raider Outpost', kind: 'space', sky: [0x0a0c27, 0x472763], ground: 0x24203b, accent: 0xa581fa },
  zeta: { name: 'Omega Reactor', kind: 'factory', sky: [0x101e2b, 0x284b5a], ground: 0x1a2932, accent: 0x4ce3e0 },
  draal: { name: 'Calamity Rift', kind: 'rift', sky: [0x170d23, 0x6e294c], ground: 0x2b172b, accent: 0xf078bd },
  redhair: { name: 'Inferno Caldera', kind: 'lava', sky: [0x2d1324, 0xaf4933], ground: 0x351e23, accent: 0xff9d45 },
  green: { name: 'Emerald Sanctuary', kind: 'forest', sky: [0x102d35, 0x72a78b], ground: 0x203e35, accent: 0xa5ed93 },
  redgi: { name: 'Scarlet Dragon Temple', kind: 'temple', sky: [0x341d3b, 0xbc6267], ground: 0x3b273b, accent: 0xf9ad75 },
  gold: { name: 'Solar Palace', kind: 'sun', sky: [0x67456c, 0xe7ac73], ground: 0x57434b, accent: 0xffdf96 },
  mage: { name: 'Astral Observatory', kind: 'arcane', sky: [0x111331, 0x38437c], ground: 0x252b49, accent: 0x98ceff },
};
export function arenaForOpponent(id) {
  const arena = ARENAS[id];
  if (!arena) throw new Error(`Missing opponent arena: ${id}`);
  return arena;
}
const blend = (a, b, t) => {
  let color = 0;
  for (const shift of [16, 8, 0]) color |= Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift;
  return color;
};
export function drawOpponentArena(scene, opponentId) {
  const a = arenaForOpponent(opponentId), g = scene.add.graphics().setDepth(0);
  scene.arenaId = opponentId;
  scene.arenaName = a.name;
  const rect = (x,y,w,h,c,alpha=1) => g.fillStyle(c,alpha).fillRect(x,y,w,h);
  const circle = (x,y,r,c,alpha=1) => g.fillStyle(c,alpha).fillCircle(x,y,r);
  const poly = (pts,c,alpha=1) => g.fillStyle(c,alpha).fillPoints(pts.map(([x,y])=>({x,y})),true);
  const line = (pts,c=a.accent,alpha=1,width=2) => { g.lineStyle(width,c,alpha);g.beginPath();g.moveTo(...pts[0]);for(const p of pts.slice(1))g.lineTo(...p);g.strokePath(); };
  let seed = [...opponentId].reduce((s,c)=>s+c.charCodeAt(0),17);
  const rand = () => { seed=(seed*16807)%2147483647;return seed/2147483647; };
  for(let y=0;y<300;y+=4)rect(0,y,960,4,blend(a.sky[0],a.sky[1],y/300));
  if(['space','moon','arcane','rift'].includes(a.kind))for(let i=0;i<75;i++)rect(rand()*960,25+rand()*225,2,2,a.accent,.3+rand()*.6);
  // Layered silhouettes leave the combat grid clear in the foreground.
  for(let layer=0;layer<2;layer++){
    const pts=[[0,300]];
    for(let x=0;x<=1000;x+=50)pts.push([x,205+layer*40-rand()*(65-layer*20)]);
    pts.push([960,300]);poly(pts,blend(a.sky[0],a.ground,.35+layer*.3));
  }
  switch(a.kind){
    case 'storm':
      for(let i=0;i<7;i++){const x=i*160-30;rect(x,65+(i%3)*18,210,20,0x162c45,.8);rect(x+30,50+(i%3)*18,130,22,0x162c45,.8);}
      line([[715,87],[689,135],[719,132],[678,198]],a.accent,.8,4);
      for(let i=0;i<45;i++){const x=rand()*960,y=rand()*280;line([[x,y],[x-6,y+14]],a.accent,.12,1);}break;
    case 'dojo': case 'temple':{
      const temple=a.kind==='temple';
      rect(260,174,440,108,temple?0x592d45:0x54414a);
      for(let x=280;x<700;x+=60){rect(x,186,10,96,0x291f35);rect(x+14,194,32,55,a.accent,.25);}
      poly([[220,180],[300,132],[660,132],[740,180]],0x272439);
      poly([[300,137],[355,100],[605,100],[660,137]],0x353047);
      for(const x of [155,795]){rect(x,179,7,105,0x302338);circle(x+3,174,15,a.accent,.8);rect(x-12,155,30,5,0x34263a);}
      if(temple){circle(480,82,28,a.accent,.5);line([[464,82],[480,66],[496,82],[480,98],[464,82]],0x8c3c4a,1,3);}break;}
    case 'canyon':
      for(const [x,w,h]of [[0,175,180],[195,96,110],[690,85,135],[805,155,210]]){poly([[x,285],[x+12,285-h],[x+w-20,273-h],[x+w,285]],0x864932);for(let y=300-h;y<280;y+=27)rect(x+12,y,w-24,5,0xd17a47,.45);}break;
    case 'moon':
      circle(720,91,47,a.accent,.12);circle(720,91,35,0xe8e6ff);circle(708,82,7,0xb8b7df,.5);
      rect(0,232,960,62,0x34456a);for(let i=0;i<24;i++)rect(640+rand()*150,239+i*2,15+rand()*45,2,a.accent,.22);
      for(const x of [70,140,830,910]){rect(x,185,5,99,0x161d37);poly([[x-24,225],[x+2,150],[x+29,225]],0x1c2441);}break;
    case 'space':
      circle(720,109,64,0x8870b6);circle(703,94,49,0x63558b);g.lineStyle(5,a.accent,.4).strokeEllipse(720,109,190,38);
      for(const x of [90,820]){rect(x,183,50,105,0x28263f);poly([[x-15,184],[x+25,140],[x+65,184]],0x403654);rect(x+15,194,20,5,a.accent,.8);}break;
    case 'factory':
      for(let i=0;i<9;i++){let x=i*120;rect(x,125+(i%3)*25,83,165,0x203540);rect(x+12,145+(i%3)*25,59,6,a.accent,.4);for(let j=0;j<3;j++)rect(x+15+j*21,200,8,43,0x57c4c3,.3);}
      circle(480,183,70,0x122831);g.lineStyle(12,0x38616a,1).strokeCircle(480,183,62);g.lineStyle(4,a.accent,.8).strokeCircle(480,183,48);circle(480,183,23,a.accent,.65);break;
    case 'rift':
      for(let i=0;i<9;i++){let x=i*120,y=160+rand()*90;poly([[x,y],[x+55,y-18],[x+79,y+7],[x+35,y+31]],0x36263c);}
      poly([[490,44],[455,118],[478,151],[442,239],[513,170],[493,134],[526,64]],a.accent,.65);line([[491,60],[473,117],[491,148],[461,216]],0xffd2ed,.8,3);break;
    case 'lava':
      poly([[220,285],[390,99],[440,129],[487,105],[650,285]],0x4c2730);poly([[378,117],[419,147],[451,126],[489,109],[464,156],[400,165]],0xff9050,.8);
      line([[430,159],[410,203],[450,237],[420,280]],a.accent,.85,6);for(let i=0;i<35;i++)rect(rand()*960,100+rand()*185,3,5,a.accent,.6);break;
    case 'forest':
      for(const x of [32,158,770,905]){rect(x,105,19,182,0x203d38);circle(x,119,62,0x285347);circle(x+24,159,51,0x326851);}
      for(const x of [278,605]){poly([[x,284],[x+12,204],[x+34,184],[x+52,284]],0x43675b);line([[x+20,224],[x+31,235],[x+23,249]],a.accent,.7,3);}break;
    case 'sun':
      circle(480,106,69,a.accent,.14);circle(480,106,49,0xffdc95,.85);
      for(const x of [100,220,690,810]){rect(x,171,34,111,0xa68870);rect(x-8,159,50,14,0xe3bd88);rect(x-7,273,48,12,0xc3a079);rect(x+8,180,5,83,0xffe3a1,.35);}rect(80,150,810,10,0xb49377);break;
    case 'arcane':
      g.lineStyle(2,a.accent,.5).strokeCircle(480,132,78);g.lineStyle(1,a.accent,.4).strokeCircle(480,132,65);
      line([[480,54],[547,171],[413,171],[480,54]],a.accent,.45);line([[480,210],[413,93],[547,93],[480,210]],a.accent,.45);
      for(const x of [160,750]){rect(x,184,46,100,0x393f64);poly([[x-10,186],[x+23,129],[x+56,186]],0x525b88);circle(x+23,199,7,a.accent,.65);}break;
  }
  rect(0,286,960,254,a.ground);rect(0,286,960,4,a.accent,.25);
  for(let i=0;i<55;i++)rect(rand()*960,294+rand()*246,8+rand()*30,2,a.accent,.07);
  // Perspective paving frames the readable blue/red tactical tiles.
  for(let x=-480;x<1500;x+=120)line([[480+(x-480)*.35,290],[x,540]],a.accent,.08,1);
  for(const y of [310,350,410,495])rect(0,y,960,1,a.accent,.08);
  return g;
}
