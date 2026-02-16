import { state } from '../gameState.js';
import { GY } from '../constants.js';
import { en, isStunned } from '../combat/engine.js';
import { ITEMS } from '../data/items.js';

function px(x,y,w,h,c){state.ctx.fillStyle=c;state.ctx.fillRect(Math.round(x),Math.round(y),w,h)}

// --- 3D shading utilities ---
function darken(hex,pct){
  var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  var m=1-pct;
  return '#'+Math.round(r*m).toString(16).padStart(2,'0')+Math.round(g*m).toString(16).padStart(2,'0')+Math.round(b*m).toString(16).padStart(2,'0');
}
function lighten(hex,pct){
  var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  r=Math.min(255,Math.round(r+(255-r)*pct));g=Math.min(255,Math.round(g+(255-g)*pct));b=Math.min(255,Math.round(b+(255-b)*pct));
  return '#'+r.toString(16).padStart(2,'0')+g.toString(16).padStart(2,'0')+b.toString(16).padStart(2,'0');
}
// Draw a rect with 3D shading: dark bottom-left edges, light top-right highlight
function px3d(x,y,w,h,base){
  if(w<3||h<3){px(x,y,w,h,base);return}
  px(x,y,w,h,base);
  // Dark bottom and left edge
  px(x,y+h-1,w,1,darken(base,0.35));
  px(x,y,1,h,darken(base,0.25));
  // Highlight top and right edge
  px(x,y,w,1,lighten(base,0.25));
  px(x+w-1,y,1,h,lighten(base,0.15));
}

export function drawHero(h){
  const ctx=state.ctx;
  const bob=Math.sin(h.bobPhase)*2,hs=h.hurtAnim>0?Math.sin(state.bt/20)*5*h.hurtAnim:0;
  const hx=h.x+hs,hy=h.y+bob,f=h.facing;
  const stA=h.stealthed?.3:1;
  const stunned=isStunned(h);
  ctx.save();ctx.translate(Math.round(hx),Math.round(hy));if(f<0)ctx.scale(-1,1);ctx.globalAlpha=stA;
  // Ellipse ground shadow
  ctx.fillStyle='rgba(0,0,0,0.25)';
  ctx.beginPath();ctx.ellipse(0,5,20,6,0,0,Math.PI*2);ctx.fill();
  if(h.type==='wizard')drawWizPixel(h,stunned);
  else if(h.type==='ranger')drawRgrPixel(h,stunned);
  else if(h.type==='barbarian')drawBarPixel(h,stunned);
  else if(h.type==='custom')drawCustomPixel(h,stunned);
  else drawAsnPixel(h,stunned);
  if(h.shieldActive){ctx.strokeStyle='rgba(68,221,187,0.3)';ctx.lineWidth=2;ctx.shadowColor='#44ddbb';ctx.shadowBlur=8;ctx.strokeRect(-22,-58,44,65);ctx.shadowBlur=0}
  if(h.ultActive&&h.type!=='assassin'){const col=h.type==='wizard'?'#44ddbb':'#ffaa44';ctx.strokeStyle=col+'40';ctx.lineWidth=2;ctx.shadowColor=col;ctx.shadowBlur=12;ctx.strokeRect(-20,-56,40,62);ctx.shadowBlur=0}
  if(h.blActive){ctx.strokeStyle='rgba(204,51,0,0.25)';ctx.lineWidth=1.5;ctx.shadowColor='#cc3300';ctx.shadowBlur=8;ctx.strokeRect(-18,-54,36,58);ctx.shadowBlur=0}
  if(h.envenomed&&state.bt<h.envenomedEnd){ctx.strokeStyle='rgba(136,204,68,0.25)';ctx.lineWidth=1;ctx.shadowColor='#88cc44';ctx.shadowBlur=6;ctx.strokeRect(-16,-52,32,56);ctx.shadowBlur=0}
  if(h.deathMarkTarget&&state.bt<h.deathMarkEnd){ctx.strokeStyle='rgba(255,136,0,0.4)';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.strokeRect(-22,-58,44,65);ctx.setLineDash([]);ctx.fillStyle='#ff8800';ctx.font='bold 11px "Cinzel"';ctx.textAlign='center';ctx.fillText('\u2620',0,-64)}
  if(stunned){const t2=state.bt/200;for(let i=0;i<3;i++){const a=t2+i*2.09;ctx.fillStyle='#e8d060';ctx.fillRect(-2+Math.cos(a)*14,-55+Math.sin(a)*6,4,4);ctx.fillStyle='#fff';ctx.fillRect(-1+Math.cos(a)*14,-54+Math.sin(a)*6,2,2)}}
  // Status effect sprite overlays — glowing borders/tints synced to hero properties
  if(h.burning&&state.bt<h.burnEnd){const bp=0.3+Math.sin(state.bt/150)*0.15;ctx.strokeStyle='rgba(255,102,34,'+bp+')';ctx.lineWidth=2;ctx.shadowColor='#ff6622';ctx.shadowBlur=10;ctx.strokeRect(-20,-56,40,62);ctx.shadowBlur=0}
  if(h.vulnerable&&state.bt<h.vulnerableEnd){const vp=0.15+Math.sin(state.bt/200)*0.1;ctx.fillStyle='rgba(255,68,68,'+vp+')';ctx.fillRect(-20,-56,40,62)}
  if(h.riposteActive&&state.bt<h.riposteEnd){ctx.strokeStyle='rgba(204,204,255,0.35)';ctx.lineWidth=1.5;ctx.shadowColor='#ccccff';ctx.shadowBlur=8;ctx.strokeRect(-20,-56,40,62);ctx.shadowBlur=0}
  if(h.thornsActive&&state.bt<h.thornsEnd){ctx.strokeStyle='rgba(68,204,68,0.3)';ctx.lineWidth=1.5;ctx.shadowColor='#44cc44';ctx.shadowBlur=8;ctx.strokeRect(-19,-55,38,60);ctx.shadowBlur=0}
  if(h.tranceActive&&state.bt<h.tranceEnd){const tp=0.25+Math.sin(state.bt/100)*0.15;ctx.strokeStyle='rgba(255,68,68,'+tp+')';ctx.lineWidth=2;ctx.shadowColor='#ff4444';ctx.shadowBlur=10;ctx.strokeRect(-21,-57,42,64);ctx.shadowBlur=0}
  if(h.primalActive&&state.bt<h.primalEnd){const pp=0.2+Math.sin(state.bt/120)*0.1;ctx.strokeStyle='rgba(255,102,34,'+pp+')';ctx.lineWidth=2.5;ctx.shadowColor='#ff6622';ctx.shadowBlur=12;ctx.strokeRect(-22,-58,44,66);ctx.shadowBlur=0}
  if(h.shadowDanceActive&&state.bt<h.shadowDanceEnd){ctx.strokeStyle='rgba(102,68,170,0.3)';ctx.lineWidth=2;ctx.shadowColor='#6644aa';ctx.shadowBlur=10;ctx.strokeRect(-21,-57,42,64);ctx.shadowBlur=0}
  if(h.lastStandActive&&state.bt<h.lastStandEnd){const lp=0.3+Math.sin(state.bt/180)*0.15;ctx.strokeStyle='rgba(255,204,34,'+lp+')';ctx.lineWidth=2.5;ctx.shadowColor='#ffcc22';ctx.shadowBlur=12;ctx.strokeRect(-23,-59,46,68);ctx.shadowBlur=0}
  if(h.freeSpellsActive&&state.bt<h.freeSpellsEnd){ctx.strokeStyle='rgba(170,136,255,0.3)';ctx.lineWidth=1.5;ctx.shadowColor='#aa88ff';ctx.shadowBlur=8;ctx.strokeRect(-19,-55,38,60);ctx.shadowBlur=0}
  if(h.smokeBombActive){ctx.fillStyle='rgba(80,90,100,0.15)';ctx.fillRect(-22,-58,44,65)}
  ctx.globalAlpha=1;
  // Undo facing flip for HP bar and name so text isn't mirrored
  if(f<0)ctx.scale(-1,1);
  const hpP=Math.max(0,h.hp/h.maxHp);
  ctx.fillStyle='#2a1a0a';ctx.fillRect(-18,-72,36,6);
  ctx.fillStyle=hpP>.3?h.color:'#cc3300';ctx.fillRect(-17,-71,Math.round(34*hpP),4);
  ctx.strokeStyle='#5a4a2a';ctx.lineWidth=1;ctx.strokeRect(-18.5,-72.5,37,7);
  ctx.fillStyle='#000';ctx.font='bold 9px "Cinzel"';ctx.textAlign='center';
  ctx.fillText(h.name,1,-76);ctx.fillStyle=h.color;ctx.fillText(h.name,0,-77);
  ctx.restore();
}

export function drawWizPixel(h,stunned){
  const ctx=state.ctx;
  const castGlow=h.castAnim*6;
  // Feet with shading
  px3d(-10,0,7,4,'#3a4a5a');px3d(3,0,7,4,'#3a4a5a');
  // Legs
  px3d(-7,-4,5,6,'#4a5a6a');px((-7)+1,-4,1,6,lighten('#4a5a6a',0.15));
  px3d(2,-4,5,6,'#4a5a6a');px(2+1,-4,1,6,lighten('#4a5a6a',0.15));
  // Robe body - layered shading
  px3d(-12,-20,24,18,'#4a5a6a');
  // Fold lines
  px(-4,-18,1,14,darken('#4a5a6a',0.2));px(3,-18,1,14,darken('#4a5a6a',0.2));
  // Center highlight strip
  px(-1,-20,2,16,lighten('#4a5a6a',0.18));
  // Collar
  px3d(-10,-22,20,4,'#5a6a7a');px(-9,-22,18,1,lighten('#5a6a7a',0.3));
  // Arms with volume
  px3d(-14,-18,4,10,'#3a4a5a');px(-14,-18,1,10,darken('#3a4a5a',0.2));
  px3d(10,-18,4,10,'#3a4a5a');px(13,-18,1,10,lighten('#3a4a5a',0.15));
  // Chest gem
  px(-2,-14,4,4,'#2a8a7a');px(-1,-13,2,2,'#44ddbb');px(-1,-14,1,1,lighten('#44ddbb',0.4));
  // Belt
  px3d(-10,-4,20,3,'#6a5a3a');px(-1,-3,2,2,'#c8a832');px(0,-3,1,1,'#ffe866');
  // Head - rounded feel
  px3d(-8,-36,16,14,'#d4b898');
  px(-7,-36,14,1,lighten('#d4b898',0.25)); // forehead highlight
  px(-8,-23,16,1,darken('#d4b898',0.2));    // chin shadow
  px(-8,-36,1,14,darken('#d4b898',0.15));   // left shadow
  px(7,-36,1,14,lighten('#d4b898',0.1));    // right highlight
  // Cheek highlights
  px(-6,-28,2,2,lighten('#d4b898',0.2));px(5,-28,2,2,lighten('#d4b898',0.15));
  // Hair
  px(-6,-24,12,6,'#8a4a2a');px(-4,-18,8,3,'#7a3a1a');
  px(-5,-24,10,1,lighten('#8a4a2a',0.2));
  // Eyes with depth
  px(-5,-32,3,3,'#fff');px(2,-32,3,3,'#fff');
  px(-5,-32,3,1,darken('#fff',0.1));
  px(-4,-31,2,2,'#2a8a7a');px(3,-31,2,2,'#2a8a7a');
  px(-4,-31,1,1,lighten('#2a8a7a',0.3));px(3,-31,1,1,lighten('#2a8a7a',0.3));
  // Hat - layered with rim
  px3d(-10,-42,20,8,'#3a4a5a');
  px(-12,-38,24,1,lighten('#4a5a6a',0.2)); // hat brim highlight
  px3d(-12,-38,24,4,'#4a5a6a');
  px3d(-8,-48,16,8,'#3a4a5a');px3d(-4,-50,8,4,'#4a5a6a');
  // Hat gem
  px(-2,-44,4,3,'#2a8a7a');px(-1,-43,2,1,'#88ffdd');px(-1,-44,1,1,lighten('#88ffdd',0.4));
  // Hat side flaps
  px3d(-10,-48,3,6,'#2a3a4a');px3d(7,-48,3,6,'#2a3a4a');
  // Staff - metallic
  px(14,-54,3,50,'#5a4a2a');px(15,-54,1,50,lighten('#5a4a2a',0.3)); // highlight line
  px(14,-54,1,50,darken('#5a4a2a',0.25)); // shadow line
  // Staff orb with glow
  ctx.shadowColor='#44ddbb';ctx.shadowBlur=8+castGlow;
  px(13,-58,5,5,'#2a8a7a');px(14,-57,3,3,'#44ddbb');px(15,-56,1,1,'#fff');
  ctx.shadowBlur=0;
  // Shoulder pads with gems
  px3d(-14,-16,4,6,'#3a4a5a');px(-13,-14,2,2,'#2a8a7a');px(-13,-14,1,1,lighten('#2a8a7a',0.3));
  px3d(10,-16,4,6,'#3a4a5a');px(11,-14,2,2,'#2a8a7a');px(11,-14,1,1,lighten('#2a8a7a',0.3));
}

export function drawRgrPixel(h,stunned){
  const ctx=state.ctx;
  // Boots with shading
  px3d(-10,0,7,4,'#5a3a1a');px3d(3,0,7,4,'#5a3a1a');
  // Legs
  px3d(-7,-4,5,6,'#6a4a2a');px(-7+1,-4,1,6,lighten('#6a4a2a',0.15));
  px3d(2,-4,5,6,'#6a4a2a');px(2+1,-4,1,6,lighten('#6a4a2a',0.15));
  // Leather armor body - layered
  px3d(-11,-20,22,18,'#aa4400');
  // Stitching lines
  px(-3,-18,1,14,darken('#aa4400',0.25));px(2,-18,1,14,darken('#aa4400',0.25));
  // Chest plate highlight
  px(-1,-18,2,10,lighten('#aa4400',0.2));
  // Collar bright
  px3d(-9,-22,18,4,'#cc5500');px(-8,-22,16,1,lighten('#cc5500',0.3));
  // Arms
  px3d(-13,-18,4,10,'#8a3300');px(-13,-18,1,10,darken('#8a3300',0.2));
  px3d(9,-18,4,10,'#8a3300');px(12,-18,1,10,lighten('#8a3300',0.15));
  // Chest buckle
  px(-2,-14,4,4,'#dd6622');px(-1,-13,2,2,'#ffcc44');px(-1,-14,1,1,'#ffe866');
  // Belt
  px3d(-9,-4,18,3,'#5a3a1a');
  // Head with depth
  px3d(-8,-36,16,14,'#cc6633');
  px(-7,-36,14,1,lighten('#cc6633',0.2));  // forehead
  px(-8,-23,16,1,darken('#cc6633',0.15));  // chin
  px(-6,-28,2,2,lighten('#cc6633',0.18));px(5,-28,2,2,lighten('#cc6633',0.12)); // cheeks
  // Feathered hat/hood
  px3d(-6,-46,12,12,'#dd6622');px3d(-4,-50,8,6,'#ff8833');px3d(-2,-52,4,4,'#ffaa44');
  px(-5,-46,10,1,lighten('#dd6622',0.25)); // rim highlight
  const ft=Math.sin(state.bt/150)*2;
  px(-5+ft,-50,3,3,'#ffcc44');px(3-ft,-48,3,3,'#ffaa44');px(0,-54+ft,2,3,'#ffdd66');
  // Eyes - dark with glowing pupils
  px(-5,-32,3,3,'#111');px(2,-32,3,3,'#111');
  px(-4,-31,2,2,'#ff8833');px(3,-31,2,2,'#ff8833');
  px(-4,-31,1,1,lighten('#ff8833',0.3));px(3,-31,1,1,lighten('#ff8833',0.3));
  // Mouth
  px(-3,-26,6,2,'#993300');
  // Bow - wooden with string glow
  ctx.strokeStyle='#8a5a2a';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(13,-26);ctx.quadraticCurveTo(21,-16,13,-6);ctx.stroke();
  // Wood grain highlight
  ctx.strokeStyle=lighten('#8a5a2a',0.3);ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(14,-24);ctx.quadraticCurveTo(19,-16,14,-8);ctx.stroke();
  // Bowstring
  ctx.strokeStyle='#ddaa44';ctx.lineWidth=1;ctx.shadowColor='#ddaa44';ctx.shadowBlur=2;
  ctx.beginPath();ctx.moveTo(13,-26);ctx.lineTo(13,-6);ctx.stroke();ctx.shadowBlur=0;
  // Arrow
  px(12,-17,8,2,'#8a6a3a');px(12,-17,8,1,lighten('#8a6a3a',0.2));
  px(19,-18,3,1,'#ffaa44');px(20,-18,1,1,'#fff');
  // Arm guards
  px3d(-13,-16,4,8,'#bb5522');px3d(9,-16,4,8,'#bb5522');
}

export function drawAsnPixel(h,stunned){
  const ctx=state.ctx;
  const envGlow=h.envenomed&&state.bt<h.envenomedEnd;
  // Boots
  px3d(-10,0,7,4,'#1a3344');px3d(3,0,7,4,'#1a3344');
  // Legs
  px3d(-7,-4,5,6,'#2a4455');px(-7+1,-4,1,6,lighten('#2a4455',0.12));
  px3d(2,-4,5,6,'#2a4455');px(2+1,-4,1,6,lighten('#2a4455',0.12));
  // Tight armor body - paneled
  px3d(-10,-20,20,18,'#2a5577');
  // Panel seams
  px(-3,-18,1,14,darken('#2a5577',0.3));px(2,-18,1,14,darken('#2a5577',0.3));
  // Center highlight
  px(0,-19,1,12,lighten('#2a5577',0.2));
  px3d(-8,-22,16,4,'#3a6688');px(-7,-22,14,1,lighten('#3a6688',0.25));
  // Chest emblem
  px(-2,-14,4,4,'#3388cc');px(-1,-13,2,2,'#88ddff');px(-1,-14,1,1,lighten('#88ddff',0.4));
  // Belt with pouches
  px3d(-9,-4,18,3,'#2a3344');px(-8,-3,4,2,'#1a2a3a');px(4,-3,4,2,'#1a2a3a');
  // Head - pale
  px3d(-8,-36,16,14,'#c8dde8');
  px(-7,-36,14,1,lighten('#c8dde8',0.15));
  px(-8,-23,16,1,darken('#c8dde8',0.12));
  px(-6,-28,2,2,lighten('#c8dde8',0.1));px(5,-28,2,2,lighten('#c8dde8',0.08));
  // Hood/mask
  px3d(-8,-44,16,10,'#4488aa');px3d(-6,-46,12,4,'#5599bb');
  px(-7,-44,14,1,lighten('#4488aa',0.2)); // hood rim
  // Hood ornament
  px(-1,-44,2,3,'#88ddff');px(0,-46,1,2,'#aaeeff');px(0,-46,1,1,'#fff');
  // Face mask
  px3d(-7,-26,14,5,'#2a4455');px(-6,-24,12,2,'#1a3344');
  // Eyes - glowing
  px(-5,-33,3,2,'#fff');px(2,-33,3,2,'#fff');
  px(-4,-33,2,2,'#3388cc');px(3,-33,2,2,'#3388cc');
  ctx.shadowColor='#88ddff';ctx.shadowBlur=3;
  px(-4,-33,1,1,'#88ddff');px(3,-33,1,1,'#88ddff');
  ctx.shadowBlur=0;
  // Daggers with metallic sheen
  var bladeCol=envGlow?'#66ccff':'#aabbcc';
  var bladeHi=envGlow?'#aaeeff':'#ddeeff';
  ctx.fillStyle=bladeCol;
  ctx.save();ctx.translate(13,-10);ctx.rotate(-.3);
  ctx.fillRect(-1,-12,2,12);
  ctx.fillStyle=bladeHi;ctx.fillRect(0,-12,1,12); // highlight edge
  ctx.fillStyle='#2a5577';ctx.fillRect(-2,-1,4,3); // hilt
  ctx.fillStyle=lighten('#2a5577',0.2);ctx.fillRect(-2,-1,4,1);
  ctx.restore();
  ctx.fillStyle=bladeCol;
  ctx.save();ctx.translate(-13,-10);ctx.rotate(.3);
  ctx.fillRect(-1,-12,2,12);
  ctx.fillStyle=bladeHi;ctx.fillRect(0,-12,1,12);
  ctx.fillStyle='#2a5577';ctx.fillRect(-2,-1,4,3);
  ctx.fillStyle=lighten('#2a5577',0.2);ctx.fillRect(-2,-1,4,1);
  ctx.restore();
  if(envGlow){ctx.shadowColor='#88ddff';ctx.shadowBlur=4;px(13,-20,2,3,'#88ddff');px(-13,-20,2,3,'#88ddff');ctx.shadowBlur=0}
  // Arms
  px3d(-12,-16,3,8,'#2a5577');px3d(9,-16,3,8,'#2a5577');
}

export function drawBarPixel(h,stunned){
  const ctx=state.ctx;
  const rageGlow=1-h.hp/h.maxHp;const ultActive=h.ultActive;
  // Heavy boots
  px3d(-11,0,8,5,'#2a1a1a');px3d(3,0,8,5,'#2a1a1a');
  // Legs
  px3d(-8,-5,6,7,'#3a2222');px(-8+1,-5,1,7,lighten('#3a2222',0.12));
  px3d(2,-5,6,7,'#3a2222');px(2+1,-5,1,7,lighten('#3a2222',0.12));
  // Heavy armor body - plated
  px3d(-13,-22,26,20,'#3a1a1a');
  // Plate edges
  px(-13,-22,1,20,'#8a2222');px(12,-22,1,20,'#8a2222');
  // Center plate seam
  px(0,-20,1,16,lighten('#3a1a1a',0.15));
  // Rivet highlights
  px(-8,-18,2,2,lighten('#3a1a1a',0.3));px(6,-18,2,2,lighten('#3a1a1a',0.3));
  px(-8,-10,2,2,lighten('#3a1a1a',0.3));px(6,-10,2,2,lighten('#3a1a1a',0.3));
  // Collar
  px3d(-11,-24,22,4,'#4a2222');px(-10,-24,20,1,lighten('#4a2222',0.25));
  // Arms - exposed muscle
  px3d(-15,-20,5,12,'#2a1010');px(-15,-20,1,12,darken('#2a1010',0.2));
  px3d(10,-20,5,12,'#2a1010');px(14,-20,1,12,lighten('#2a1010',0.15));
  // Skull belt buckle with depth
  px(-3,-16,6,5,'#8a7a6a');px(-3,-16,6,1,lighten('#8a7a6a',0.3));
  px(-2,-15,4,3,'#aaa');px(-2,-15,4,1,lighten('#aaa',0.2));
  px(-2,-13,1,1,'#222');px(1,-13,1,1,'#222');px(-1,-11,2,1,'#444');
  // Belt
  px3d(-11,-4,22,3,'#3a2222');px(-1,-3,2,2,'#8a7a6a');
  // Head
  px3d(-9,-38,18,16,'#c8a888');
  px(-8,-38,16,1,lighten('#c8a888',0.2));  // forehead
  px(-9,-23,18,1,darken('#c8a888',0.15));  // chin
  px(-7,-30,2,2,lighten('#c8a888',0.18));px(6,-30,2,2,lighten('#c8a888',0.12)); // cheeks
  // War paint
  px(-6,-32,2,6,'#8a2222');px(4,-32,2,6,'#8a2222');
  // Spiked helmet
  px3d(-3,-46,6,10,'#2a1010');px3d(-2,-48,4,4,'#3a1a1a');px3d(-1,-50,2,3,'#4a2222');
  px(-2,-46,4,1,lighten('#2a1010',0.2)); // rim
  // Eyes
  const eyeCol=rageGlow>0.3?'#cc3333':'#aa6633';
  px(-5,-34,3,3,'#fff');px(2,-34,3,3,'#fff');
  px(-4,-33,2,2,eyeCol);px(3,-33,2,2,eyeCol);
  if(rageGlow>0.3){ctx.shadowColor=eyeCol;ctx.shadowBlur=3;px(-4,-33,1,1,lighten(eyeCol,0.4));px(3,-33,1,1,lighten(eyeCol,0.4));ctx.shadowBlur=0}
  // Mouth/teeth
  px(-3,-27,6,2,'#6a3a2a');px(-2,-26,4,1,'#fff');
  // Axe handle - metallic
  px(14,-52,3,48,'#5a4a2a');px(15,-52,1,48,lighten('#5a4a2a',0.25));px(14,-52,1,48,darken('#5a4a2a',0.2));
  // Axe head - multi-shade metal
  px3d(17,-50,10,6,'#4a4a4a');px3d(17,-48,12,4,'#5a5a5a');px3d(17,-46,10,6,'#4a4a4a');
  // Axe blade highlight
  px(27,-49,1,8,lighten('#5a5a5a',0.4)); // bright edge
  const axeCol=rageGlow>0.2?'#cc3333':'#888888';
  px(27,-49,2,8,axeCol);px(28,-49,1,8,lighten(axeCol,0.3));
  // Exposed arms/hands
  px3d(-15,-18,4,10,'#c8a888');px(-15,-18,1,10,darken('#c8a888',0.15));
  px3d(11,-18,4,10,'#c8a888');px(14,-18,1,10,lighten('#c8a888',0.1));
  if(rageGlow>0.3||ultActive){ctx.globalAlpha=(rageGlow*0.3);ctx.fillStyle='#cc2222';ctx.fillRect(-16,-50,32,55);ctx.globalAlpha=1;}
  if(ultActive){const t2=Math.sin(state.bt/100)*2;ctx.shadowColor='#ff2222';ctx.shadowBlur=12;px(-16+t2,-52,2,4,'#ff4444');px(14-t2,-52,2,4,'#ff4444');px(-14,-50+t2,2,3,'#ff6666');px(12,-50-t2,2,3,'#ff6666');ctx.shadowBlur=0;}
}

// --- Gear visual lookup helper ---
function gearVis(h,slot){
  if(!h.equipment)return null;
  var entry=h.equipment[slot];
  if(!entry)return null;
  var key=typeof entry==='string'?entry:(entry&&entry.baseKey);
  if(!key||!ITEMS[key])return null;
  return ITEMS[key].visual||null;
}

// --- LAYERED SPRITE SYSTEM ---
// Skin tones — pale gothic
var SKIN='#c4a888',SKIN_LT='#d4b898',SKIN_DK='#a48868',SKIN_SH='#8a7058';
var OL='#0a0808'; // dark outline

function drawBaseBody(h){
  var sp=h.customSprite||'wizard';
  if(sp==='barbarian'){
    // --- BULKY BARBARIAN FRAME ---
    // Legs with outline + muscle highlight
    px(-9,-5,1,7,OL);px(8,-5,1,7,OL); // outer outlines
    px3d(-8,-5,6,7,SKIN_DK);px(-6,-4,1,5,SKIN_LT);
    px3d(2,-5,6,7,SKIN_DK);px(4,-4,1,5,SKIN_LT);
    px(-8,2,6,1,OL);px(2,2,6,1,OL); // bottom outline
    // Torso with depth
    px(-14,-22,1,20,OL);px(13,-22,1,20,OL); // body outlines
    px(-13,-22,26,20,SKIN);
    px(-13,-22,1,20,darken(SKIN,0.2));px(12,-22,1,20,lighten(SKIN,0.12));
    // Chest muscle definition
    px(-8,-18,7,6,SKIN_LT);px(1,-18,7,6,SKIN_LT);
    px(-1,-20,2,14,lighten(SKIN,0.15)); // center line
    px(-7,-12,6,1,SKIN_DK);px(1,-12,6,1,SKIN_DK); // ab line
    px(-6,-8,5,1,SKIN_DK);px(1,-8,5,1,SKIN_DK); // lower abs
    // Collar/neck
    px3d(-11,-24,22,4,SKIN_LT);px(-10,-24,20,1,lighten(SKIN_LT,0.2));
    // Arms — thick exposed muscle
    px(-16,-20,1,14,OL);px(-15,-20,5,12,SKIN);
    px(-15,-20,1,12,darken(SKIN,0.25));px(-11,-20,1,12,lighten(SKIN,0.15));
    px(-14,-16,2,4,SKIN_LT); // bicep highlight
    px(10,-20,5,12,SKIN);px(15,-20,1,14,OL);
    px(14,-20,1,12,lighten(SKIN,0.15));px(10,-20,1,12,darken(SKIN,0.2));
    px(12,-16,2,4,SKIN_LT); // bicep highlight
    // Hands
    px3d(-15,-8,4,4,SKIN);px(-15,-8,4,1,SKIN_LT);
    px3d(11,-8,4,4,SKIN);px(11,-8,4,1,SKIN_LT);
  } else if(sp==='assassin'){
    // --- LEAN ASSASSIN FRAME ---
    px(-8,-4,1,6,OL);px(7,-4,1,6,OL);
    px3d(-7,-4,5,6,SKIN_DK);px(-5,-3,1,4,SKIN_LT);
    px3d(2,-4,5,6,SKIN_DK);px(4,-3,1,4,SKIN_LT);
    px(-7,2,5,1,OL);px(2,2,5,1,OL);
    px(-11,-20,1,18,OL);px(10,-20,1,18,OL);
    px3d(-10,-20,20,18,SKIN);
    px(-10,-20,1,18,darken(SKIN,0.2));px(9,-20,1,18,lighten(SKIN,0.12));
    px(0,-19,1,14,SKIN_LT);
    px(-5,-16,4,4,SKIN_LT);px(1,-16,4,4,SKIN_LT);
    px3d(-8,-22,16,4,SKIN_LT);px(-7,-22,14,1,lighten(SKIN_LT,0.2));
    // Arms
    px(-13,-18,1,10,OL);px3d(-12,-18,3,10,SKIN);
    px(-12,-18,1,10,darken(SKIN,0.2));px(-10,-16,1,4,SKIN_LT);
    px3d(9,-18,3,10,SKIN);px(12,-18,1,10,OL);
    px(11,-18,1,10,lighten(SKIN,0.12));px(10,-16,1,4,SKIN_LT);
    px3d(-12,-8,3,3,SKIN);px3d(9,-8,3,3,SKIN);
  } else if(sp==='ranger'){
    // --- MEDIUM RANGER FRAME ---
    px(-8,-4,1,6,OL);px(7,-4,1,6,OL);
    px3d(-7,-4,5,6,SKIN_DK);px(-5,-3,1,4,SKIN_LT);
    px3d(2,-4,5,6,SKIN_DK);px(4,-3,1,4,SKIN_LT);
    px(-7,2,5,1,OL);px(2,2,5,1,OL);
    px(-12,-20,1,18,OL);px(11,-20,1,18,OL);
    px3d(-11,-20,22,18,SKIN);
    px(-11,-20,1,18,darken(SKIN,0.2));px(10,-20,1,18,lighten(SKIN,0.12));
    px(-1,-18,2,12,SKIN_LT);
    px(-6,-16,5,4,SKIN_LT);px(1,-16,5,4,SKIN_LT);
    px3d(-9,-22,18,4,SKIN_LT);px(-8,-22,16,1,lighten(SKIN_LT,0.2));
    // Arms
    px(-14,-18,1,10,OL);px3d(-13,-18,4,10,SKIN);
    px(-13,-18,1,10,darken(SKIN,0.2));px(-11,-16,1,4,SKIN_LT);
    px3d(9,-18,4,10,SKIN);px(13,-18,1,10,OL);
    px(12,-18,1,10,lighten(SKIN,0.12));px(10,-16,1,4,SKIN_LT);
    px3d(-13,-8,3,3,SKIN);px3d(10,-8,3,3,SKIN);
  } else {
    // --- SLENDER WIZARD FRAME ---
    px(-8,-4,1,6,OL);px(7,-4,1,6,OL);
    px3d(-7,-4,5,6,SKIN_DK);px(-5,-3,1,4,SKIN_LT);
    px3d(2,-4,5,6,SKIN_DK);px(4,-3,1,4,SKIN_LT);
    px(-7,2,5,1,OL);px(2,2,5,1,OL);
    px(-13,-20,1,18,OL);px(12,-20,1,18,OL);
    px3d(-12,-20,24,18,SKIN);
    px(-12,-20,1,18,darken(SKIN,0.2));px(11,-20,1,18,lighten(SKIN,0.12));
    px(-1,-20,2,14,SKIN_LT);
    px(-5,-16,4,4,SKIN_LT);px(1,-16,4,4,SKIN_LT);
    px3d(-10,-22,20,4,SKIN_LT);px(-9,-22,18,1,lighten(SKIN_LT,0.2));
    // Arms
    px(-15,-18,1,10,OL);px3d(-14,-18,4,10,SKIN);
    px(-14,-18,1,10,darken(SKIN,0.2));px(-12,-16,1,4,SKIN_LT);
    px3d(10,-18,4,10,SKIN);px(14,-18,1,10,OL);
    px(13,-18,1,10,lighten(SKIN,0.12));px(11,-16,1,4,SKIN_LT);
    px3d(-14,-8,3,3,SKIN);px3d(10,-8,3,3,SKIN);
  }
}

function drawHead(h){
  var sp=h.customSprite||'wizard';
  var wide=sp==='barbarian'?9:8;
  // Dark outline around head
  px(-wide-1,-37,1,15,OL);px(wide,-37,1,15,OL);
  px(-wide,-37,wide*2,1,OL);px(-wide,-22,wide*2,1,OL);
  // Head base — 4 shade levels
  px3d(-wide,-36,wide*2,14,SKIN);
  px(-wide,-36,1,14,SKIN_SH); // deep left shadow
  px(-wide+1,-36,1,14,SKIN_DK); // left shadow
  px(wide-2,-36,1,14,SKIN_LT); // right highlight
  px(wide-1,-36,1,14,lighten(SKIN_LT,0.12)); // bright right edge
  // Forehead highlight band
  px(-wide+2,-36,wide*2-4,1,SKIN_LT);px(-wide+3,-35,wide*2-6,1,lighten(SKIN_LT,0.15));
  // Chin shadow
  px(-wide+1,-23,wide*2-2,1,SKIN_SH);
  // Cheek highlights + shadows
  px(-wide+2,-30,2,3,SKIN_LT);px(-wide+2,-28,1,1,lighten(SKIN_LT,0.2)); // left cheek glow
  px(wide-4,-30,2,3,lighten(SKIN,0.08));px(wide-3,-28,1,1,lighten(SKIN_LT,0.15));
  // Nose shadow
  px(-1,-29,2,3,SKIN_DK);px(0,-28,1,1,SKIN_LT);
  // Eyes — white, iris, pupil, catchlight
  px(-5,-33,3,1,darken('#dde8ee',0.12)); // upper lid shadow
  px(2,-33,3,1,darken('#dde8ee',0.12));
  px(-5,-32,3,3,'#dde8ee');px(2,-32,3,3,'#dde8ee');
  px(-5,-30,3,1,darken('#dde8ee',0.06)); // lower lid
  px(2,-30,3,1,darken('#dde8ee',0.06));
  var eyeCol=sp==='wizard'?'#2a6a5a':sp==='assassin'?'#3a6a8a':sp==='ranger'?'#6a4a2a':'#6a3a2a';
  px(-4,-31,2,2,eyeCol);px(3,-31,2,2,eyeCol);
  px(-4,-31,1,1,lighten(eyeCol,0.35));px(3,-31,1,1,lighten(eyeCol,0.35)); // catchlight
  px(-3,-31,1,1,'#0a0a0a');px(4,-31,1,1,'#0a0a0a'); // pupil
  // Mouth
  px(-3,-26,6,1,SKIN_SH);px(-2,-25,4,1,darken(SKIN,0.15));
  // Eyebrows
  px(-5,-34,3,1,darken(SKIN,0.35));px(2,-34,3,1,darken(SKIN,0.35));
  // Hair if no helmet
  if(!gearVis(h,'helmet')){
    var hc=sp==='wizard'?'#5a3a2a':sp==='assassin'?'#1a1a2a':sp==='ranger'?'#7a4a1a':'#4a2a1a';
    var hcD=darken(hc,0.25),hcL=lighten(hc,0.2);
    // Full hair volume
    px(-wide,-38,wide*2,4,hc);
    px(-wide+1,-40,wide*2-2,3,hcD);
    px(-wide+2,-38,wide*2-4,1,hcL); // top highlight
    // Side hair
    px(-wide,-36,2,4,hc);px(wide-2,-36,2,4,hc);
    px(-wide,-36,1,4,hcD);px(wide-1,-36,1,4,hcL);
    // Hair tips
    if(sp==='wizard'){px(-wide+1,-42,3,3,hc);px(wide-4,-42,3,3,hc);px(-wide+3,-43,wide*2-6,2,hcD)}
    else if(sp==='assassin'){px(-wide,-36,1,8,hcD);px(wide-1,-36,1,8,hc)} // long side hair
    else if(sp==='barbarian'){px(-wide-1,-38,2,6,hc);px(wide-1,-38,2,6,hc)} // wild
  }
}

function drawBootsLayer(h){
  var v=gearVis(h,'boots');
  var cD,cL;
  if(!v){
    // Bare feet with outline
    px(-11,0,1,4,OL);px(-3,0,1,4,OL);px(3,0,1,4,OL);px(10,0,1,4,OL);
    px(-10,4,7,1,OL);px(3,4,7,1,OL);
    px3d(-10,0,7,4,SKIN_DK);px(-9,0,5,1,SKIN_LT);
    px3d(3,0,7,4,SKIN_DK);px(4,0,5,1,SKIN_LT);
    return;
  }
  var c=v.color,hi=v.hilight;cD=darken(c,0.3);cL=lighten(hi,0.2);
  var t=v.type;
  if(t==='steel_boots'||t==='war_treads'){
    // Heavy metal boots — outline + 4-level shading
    px(-12,0,1,5,OL);px(-3,0,1,5,OL);px(3,0,1,5,OL);px(11,0,1,5,OL);
    px(-11,5,8,1,OL);px(3,5,8,1,OL);
    px3d(-11,0,8,5,c);px3d(3,0,8,5,c);
    px(-10,0,6,1,hi);px(4,0,6,1,hi); // top highlight
    px(-11,4,8,1,cD);px(3,4,8,1,cD); // bottom shadow
    // Shin guards
    px(-10,-5,1,6,OL);px(9,-5,1,6,OL);
    px3d(-9,-4,6,5,c);px3d(3,-4,6,5,c);
    px(-8,-4,4,1,cL);px(4,-4,4,1,cL); // top highlight
    px(-7,-3,2,2,hi);px(5,-3,2,2,hi); // knee plate shine
    // Rivets
    px(-9,-2,1,1,cL);px(-4,-2,1,1,cL);px(3,-2,1,1,cL);px(8,-2,1,1,cL);
    // Toe caps
    px(-10,2,3,2,cD);px(7,2,3,2,cD);
    px(-9,2,2,1,hi);px(8,2,2,1,hi);
  } else if(t==='windwalkers'||t==='stormstriders'){
    // Magical boots with glow trail
    px(-11,0,1,4,OL);px(-3,0,1,4,OL);px(3,0,1,4,OL);px(10,0,1,4,OL);
    px3d(-10,0,7,4,c);px3d(3,0,7,4,c);
    px(-9,0,5,1,hi);px(4,0,5,1,hi);
    px(-9,-3,5,4,c);px(4,-3,5,4,c);
    px(-8,-3,3,1,hi);px(5,-3,3,1,hi);
    // Inner detail
    px(-7,-1,2,2,cD);px(6,-1,2,2,cD);
    if(v.glow){
      var ctx=state.ctx;ctx.shadowColor=v.glow;ctx.shadowBlur=5;
      px(-8,2,4,2,v.glow);px(5,2,4,2,v.glow);
      // Speed lines
      px(-12,1,2,1,v.glow);px(11,1,2,1,v.glow);
      ctx.shadowBlur=0;
    }
  } else if(t==='swift_boots'){
    // Light leather boots with strap detail
    px(-11,0,1,4,OL);px(-3,0,1,4,OL);px(3,0,1,4,OL);px(10,0,1,4,OL);
    px3d(-10,0,7,4,c);px3d(3,0,7,4,c);
    px(-9,0,5,1,hi);px(4,0,5,1,hi);
    px(-8,-2,4,3,c);px(5,-2,4,3,c);
    // Buckle straps
    px(-9,1,5,1,cD);px(4,1,5,1,cD);
    px(-7,1,1,1,hi);px(6,1,1,1,hi); // buckle
  } else {
    // Sandals / default
    px(-11,0,1,4,OL);px(-3,0,1,4,OL);px(3,0,1,4,OL);px(10,0,1,4,OL);
    px3d(-10,0,7,4,c);px3d(3,0,7,4,c);
    px(-9,1,5,1,cD); // strap shadow
    px(4,1,5,1,cD);
  }
}

function drawChestLayer(h){
  var v=gearVis(h,'chest');
  if(!v)return;
  var sp=h.customSprite||'wizard';
  var c=v.color,hi=v.hilight;
  var cD=darken(c,0.3),cDD=darken(c,0.5),cL=lighten(c,0.15),hiL=lighten(hi,0.25);
  var bw=sp==='barbarian'?13:sp==='assassin'?10:sp==='ranger'?11:12;
  var aw=sp==='barbarian'?5:sp==='assassin'?3:4; // arm width
  var t=v.type;
  if(t==='plate'||t==='blood_plate'){
    // === HEAVY PLATE ARMOR ===
    // Body outline
    px(-bw-1,-20,1,18,OL);px(bw,-20,1,18,OL);
    // Main body
    px3d(-bw,-20,bw*2,18,c);
    px(-bw,-20,1,18,cDD);px(-bw+1,-20,1,18,cD); // deep left shadow
    px(bw-2,-20,1,18,cL);px(bw-1,-20,1,18,hiL); // bright right edge
    // Plate horizontal segments
    px(-bw+2,-18,bw*2-4,1,cD);px(-bw+2,-12,bw*2-4,1,cD);px(-bw+2,-6,bw*2-4,1,cD);
    // Highlight lines below segments
    px(-bw+2,-17,bw*2-4,1,cL);px(-bw+2,-11,bw*2-4,1,cL);
    // Center ridge
    px(0,-20,1,16,cL);px(-1,-20,1,16,cD);
    // Rivets — 4-shade metal dots
    var rv=[[-bw+3,-16],[bw-5,-16],[-bw+3,-10],[bw-5,-10],[-bw+3,-7],[bw-5,-7]];
    for(var ri=0;ri<rv.length;ri++){px(rv[ri][0],rv[ri][1],2,2,hi);px(rv[ri][0],rv[ri][1],1,1,hiL)}
    // Collar — raised, highlighted
    px(-bw+1,-23,1,4,OL);px(bw-2,-23,1,4,OL);
    px3d(-bw+2,-22,bw*2-4,4,hi);
    px(-bw+3,-22,bw*2-6,1,hiL);px(-bw+3,-19,bw*2-6,1,cD);
    // Shoulder pauldrons with gems
    px(-bw-3,-18,1,8,OL);px(bw+2,-18,1,8,OL);
    px3d(-bw-2,-18,aw+1,7,c);px(-bw-2,-18,aw+1,1,hi);px(-bw-2,-11,aw+1,1,cD);
    px(-bw-1,-16,2,2,hi);px(-bw-1,-16,1,1,hiL); // gem
    px3d(bw-aw+1,-18,aw+1,7,c);px(bw-aw+1,-18,aw+1,1,hi);
    px(bw-aw+2,-16,2,2,hi);px(bw-aw+2,-16,1,1,hiL);
    if(t==='blood_plate'){
      px(-4,-16,1,10,'#6a2a2a');px(-2,-14,1,6,'#5a1a1a');
      px(3,-15,1,8,'#6a2a2a');px(1,-12,1,5,'#5a1a1a');
      // Blood gem center
      px(-2,-14,4,4,'#4a1a1a');px(-1,-13,2,2,'#8a2a2a');px(-1,-13,1,1,'#aa4a4a');
    }
  } else if(t==='chain'){
    // === CHAIN MAIL ===
    px(-bw-1,-20,1,18,OL);px(bw,-20,1,18,OL);
    px3d(-bw,-20,bw*2,18,c);
    px(-bw,-20,1,18,cD);px(bw-1,-20,1,18,cL);
    // Chain link pattern — dense alternating dots
    for(var cy=-18;cy<-4;cy+=2){
      for(var cx=-bw+2;cx<bw-2;cx+=2){
        var odd=(cy/-2+cx/2)%2===0;
        px(cx,cy,1,1,odd?hi:cD);
      }
    }
    // Highlight band across chest
    px(-bw+3,-14,bw*2-6,1,cL);
    // Collar
    px3d(-bw+2,-22,bw*2-4,4,lighten(c,0.1));px(-bw+3,-22,bw*2-6,1,hiL);
    // Arms
    px3d(-bw-1,-18,aw,8,c);px(-bw-1,-18,1,8,cD);
    px3d(bw-aw+1,-18,aw,8,c);px(bw,-18,1,8,cL);
    // Chain on arms
    for(var ay=-16;ay<-10;ay+=2){px(-bw,ay,1,1,hi);px(bw-1,ay,1,1,hi)}
  } else if(t==='leather'){
    // === LEATHER VEST ===
    px(-bw-1,-20,1,18,OL);px(bw,-20,1,18,OL);
    px3d(-bw,-20,bw*2,18,c);
    px(-bw,-20,1,18,cD);px(bw-1,-20,1,18,cL);
    // Stitching lines
    px(-3,-18,1,14,cD);px(-4,-18,1,14,cDD);
    px(2,-18,1,14,cD);px(3,-18,1,14,cDD);
    // Center panel highlight
    px(-2,-18,4,12,hi);px(-1,-17,2,8,hiL);
    // Collar — folded over
    px3d(-bw+1,-22,bw*2-2,4,hi);px(-bw+2,-22,bw*2-4,1,hiL);
    px(-bw+2,-19,bw*2-4,1,cD); // collar shadow underside
    // Arm guards
    px(-bw-2,-16,1,8,OL);px(bw+1,-16,1,8,OL);
    px3d(-bw-1,-16,aw,8,c);px(-bw-1,-16,1,8,cD);px(-bw-1,-16,aw,1,hi);
    px3d(bw-aw+1,-16,aw,8,c);px(bw,-16,1,8,cL);px(bw-aw+1,-16,aw,1,hi);
    // Buckle
    px(-1,-14,2,3,'#5a4a2a');px(-1,-14,2,1,'#8a7a5a');px(0,-13,1,1,'#c8a848');
  } else if(t==='robe'){
    // === ARCANE ROBE ===
    px(-bw-1,-20,1,18,OL);px(bw,-20,1,18,OL);
    px3d(-bw,-20,bw*2,18,c);
    px(-bw,-20,1,18,cD);px(bw-1,-20,1,18,cL);
    // Fold lines — 3 vertical drapes
    px(-5,-18,1,14,cD);px(-4,-18,1,14,cDD);
    px(3,-18,1,14,cD);px(4,-18,1,14,cDD);
    // Center bright fold
    px(-1,-20,2,16,cL);px(0,-19,1,12,hiL);
    // Collar — ornate
    px3d(-bw+2,-22,bw*2-4,4,hi);px(-bw+3,-22,bw*2-6,1,hiL);
    px(-bw+3,-19,bw*2-6,1,cD);
    // Rune trim along collar
    px(-bw+4,-21,2,1,v.glow||'#6aaa8a');px(bw-6,-21,2,1,v.glow||'#6aaa8a');
    // Chest gem with glow
    if(v.glow){
      px(-2,-14,4,4,darken(v.glow,0.4));px(-2,-14,4,1,darken(v.glow,0.2));
      px(-1,-13,2,2,v.glow);px(-1,-13,1,1,lighten(v.glow,0.5));
      var ctx=state.ctx;ctx.shadowColor=v.glow;ctx.shadowBlur=4;px(-1,-13,1,1,v.glow);ctx.shadowBlur=0;
    }
    // Sleeves — flowing
    px(-bw-3,-18,1,12,OL);px(bw+2,-18,1,12,OL);
    px3d(-bw-2,-18,aw+1,10,darken(c,0.1));px(-bw-2,-18,1,10,cD);
    px3d(bw-aw+1,-18,aw+1,10,darken(c,0.1));px(bw+1,-18,1,10,cL);
    // Sleeve fold
    px(-bw-1,-14,aw-1,1,cD);px(bw-aw+2,-14,aw-1,1,cD);
  } else if(t==='dragonscale'){
    // === DRAGONSCALE ARMOR ===
    px(-bw-1,-20,1,18,OL);px(bw,-20,1,18,OL);
    px3d(-bw,-20,bw*2,18,c);
    px(-bw,-20,1,18,cD);px(bw-1,-20,1,18,cL);
    // Overlapping scale pattern — each scale is 3x3 with highlight top
    for(var sy=-18;sy<-4;sy+=3){
      var off=(sy/-3)%2===0?0:2;
      for(var sx=-bw+1+off;sx<bw-2;sx+=4){
        px(sx,sy,3,2,hi);px(sx,sy,3,1,hiL); // top highlight
        px(sx,sy+2,3,1,cD); // bottom shadow
        px(sx+2,sy+1,1,1,cDD); // scale edge shadow
      }
    }
    // Collar with gold trim
    px3d(-bw+2,-22,bw*2-4,4,hi);px(-bw+3,-22,bw*2-6,1,hiL);
    // Shoulder scales
    px(-bw-3,-18,1,8,OL);px(bw+2,-18,1,8,OL);
    px3d(-bw-2,-18,aw+1,7,hi);px(-bw-2,-18,aw+1,1,hiL);
    px(-bw-1,-16,2,2,lighten(hi,0.2));px(-bw-1,-16,1,1,hiL);
    px3d(bw-aw+1,-18,aw+1,7,hi);px(bw-aw+1,-18,aw+1,1,hiL);
    // Center dragon gem
    if(v.glow){
      var ctx=state.ctx;ctx.shadowColor=v.glow;ctx.shadowBlur=4;
      px(-2,-14,4,4,darken(v.glow,0.3));px(-1,-13,2,2,v.glow);px(-1,-13,1,1,lighten(v.glow,0.4));
      ctx.shadowBlur=0;
    }
  } else {
    // === CLOTH TUNIC (DEFAULT) ===
    px(-bw-1,-20,1,18,OL);px(bw,-20,1,18,OL);
    px3d(-bw,-20,bw*2,18,c);
    px(-bw,-20,1,18,cD);px(bw-1,-20,1,18,cL);
    // Simple fold highlight
    px(-1,-18,2,12,hi);px(0,-17,1,8,hiL);
    // Collar
    px3d(-bw+2,-22,bw*2-4,4,hi);px(-bw+3,-22,bw*2-6,1,hiL);
    // Sleeves
    px(-bw-1,-18,aw,8,darken(c,0.1));px(-bw-1,-18,1,8,cD);
    px(bw-aw+1,-18,aw,8,darken(c,0.1));px(bw,-18,1,8,cL);
    // Hem shadow
    px(-bw+1,-3,bw*2-2,1,cD);
  }
  // Belt — always drawn with buckle
  px(-bw+1,-5,1,3,OL);px(bw-2,-5,1,3,OL);
  px3d(-bw+2,-4,bw*2-4,3,'#3a2a1a');
  px(-bw+3,-4,bw*2-6,1,'#5a4a3a'); // belt highlight
  px(-bw+3,-2,bw*2-6,1,'#2a1a0a'); // belt shadow
  px(-1,-3,2,2,'#6a5a3a');px(-1,-3,2,1,'#8a7a5a');px(0,-3,1,1,'#c8a848'); // buckle
}

function drawHelmetLayer(h){
  var v=gearVis(h,'helmet');
  if(!v)return;
  var c=v.color,hi=v.hilight;
  var cD=darken(c,0.3),cL=lighten(c,0.15),hiL=lighten(hi,0.25);
  var t=v.type;
  if(t==='steel_helm'){
    // === STEEL HELM — rounded with visor ===
    px(-10,-42,1,8,OL);px(9,-42,1,8,OL);px(-9,-43,18,1,OL);
    px3d(-9,-42,18,8,c);
    px(-9,-42,1,8,cD);px(8,-42,1,8,cL); // side shading
    px(-8,-42,16,1,hi);px(-7,-42,14,1,hiL); // top rim highlight
    // Dome
    px(-8,-47,1,6,OL);px(7,-47,1,6,OL);
    px3d(-7,-46,14,6,c);
    px(-6,-46,12,1,hi);px(-5,-46,10,1,hiL); // dome highlight band
    px(-7,-46,1,6,cD);px(6,-46,1,6,cL);
    // Nose guard
    px(-1,-40,2,4,cD);px(-1,-40,2,1,c);
    // Visor slit
    px(-5,-38,10,2,darken(c,0.5));px(-4,-38,8,1,'#0a0a0a');
    px(-5,-36,10,1,cD); // shadow below visor
    // Rivets on sides
    px(-8,-39,1,1,hi);px(7,-39,1,1,hi);
    px(-8,-36,1,1,hi);px(7,-36,1,1,hi);
  } else if(t==='shadow_hood'){
    // === SHADOW HOOD — pointed with mask ===
    px(-9,-44,1,10,OL);px(8,-44,1,10,OL);
    px3d(-8,-44,16,10,c);
    px(-8,-44,1,10,cD);px(7,-44,1,10,cL);
    px3d(-6,-48,12,5,darken(c,0.1));
    px(-5,-48,10,1,hi); // rim
    // Hood peak
    px(-2,-50,1,4,OL);px(1,-50,1,4,OL);
    px(-1,-50,2,4,c);px(0,-51,1,3,hi);
    px(-1,-52,2,2,darken(c,0.1));px(0,-53,1,1,hi);
    // Face shadow cast
    px(-7,-36,14,3,darken(c,0.4));px(-6,-36,12,1,darken(c,0.5));
    // Hood drape on sides
    px(-8,-38,2,4,cD);px(6,-38,2,4,cD);
    // Inner lining hint
    px(-7,-44,14,1,darken(c,0.2));
  } else if(t==='crown'){
    // === CROWN — ornate with gems ===
    px(-9,-42,1,6,OL);px(8,-42,1,6,OL);
    px3d(-8,-42,16,6,c);
    px(-8,-42,1,6,cD);px(7,-42,1,6,cL);
    px(-7,-42,14,1,hi);px(-6,-42,12,1,hiL); // top highlight
    // Crown points with 3D shading
    px(-8,-47,1,5,OL);px(-5,-47,1,5,OL);
    px(-7,-46,3,4,c);px(-7,-46,1,4,cD);px(-5,-46,1,4,cL);px(-6,-46,1,1,hiL);
    px(-2,-49,1,7,OL);px(1,-49,1,7,OL);
    px(-1,-48,2,6,c);px(-1,-48,1,6,cD);px(0,-48,1,1,hiL);
    px(4,-47,1,5,OL);px(7,-47,1,5,OL);
    px(4,-46,3,4,c);px(4,-46,1,4,cD);px(6,-46,1,4,cL);px(5,-46,1,1,hiL);
    // Gems in each point + center
    var gc=v.glow||'#c8a848',gcL=lighten(gc,0.4);
    var ctx=state.ctx;if(v.glow){ctx.shadowColor=v.glow;ctx.shadowBlur=4}
    px(-7,-44,2,2,gc);px(-7,-44,1,1,gcL);
    px(-1,-44,2,2,gc);px(-1,-44,1,1,gcL);
    px(5,-44,2,2,gc);px(5,-44,1,1,gcL);
    ctx.shadowBlur=0;
    // Band detail
    px(-7,-39,14,1,cD);
  } else if(t==='berserker_helm'){
    // === BERSERKER HELM — heavy spiked ===
    px(-10,-42,1,8,OL);px(9,-42,1,8,OL);
    px3d(-9,-42,18,8,c);
    px(-9,-42,1,8,cD);px(8,-42,1,8,cL);
    px(-8,-42,16,1,hi);
    px3d(-7,-46,14,6,c);px(-6,-46,12,1,hi);
    // Spikes with 3D shading
    px(-9,-51,1,9,OL);px(-5,-51,1,9,OL);
    px(-8,-50,3,8,c);px(-8,-50,1,8,cD);px(-6,-50,1,8,cL);px(-7,-50,1,1,hiL);
    px(5,-51,1,9,OL);px(8,-51,1,9,OL);
    px(5,-50,3,8,c);px(5,-50,1,8,cD);px(7,-50,1,8,cL);px(6,-50,1,1,hiL);
    // Center spike
    px(-2,-53,1,11,OL);px(1,-53,1,11,OL);
    px(-1,-52,2,10,c);px(-1,-52,1,10,cD);px(0,-52,1,1,hiL);
    // Angry eye slits
    px(-6,-38,4,2,'#0a0a0a');px(2,-38,4,2,'#0a0a0a');
    px(-5,-38,2,1,'#4a1a1a');px(3,-38,2,1,'#4a1a1a'); // red glint
    // Metal banding
    px(-8,-40,16,1,cD);px(-8,-35,16,1,cD);
    // Rivets
    px(-8,-39,1,1,hi);px(7,-39,1,1,hi);
  } else if(t==='horned_helm'){
    // === HORNED HELM — with curved horns ===
    px(-10,-42,1,8,OL);px(9,-42,1,8,OL);
    px3d(-9,-42,18,8,c);
    px(-9,-42,1,8,cD);px(8,-42,1,8,cL);
    px(-8,-42,16,1,hi);
    px3d(-7,-46,14,6,c);px(-6,-46,12,1,hi);
    // Left horn — multi-segment with shading
    px(-13,-49,1,7,OL);px(-10,-49,1,7,OL);
    px(-12,-48,3,6,c);px(-12,-48,1,6,cD);px(-10,-48,1,6,cL);
    px(-16,-53,1,6,OL);px(-13,-53,1,6,OL);
    px(-15,-52,3,5,darken(c,0.1));px(-15,-52,1,5,cD);px(-13,-52,1,5,c);
    px(-17,-55,2,4,hi);px(-17,-55,1,1,hiL);
    // Right horn
    px(9,-49,1,7,OL);px(12,-49,1,7,OL);
    px(9,-48,3,6,c);px(9,-48,1,6,cD);px(11,-48,1,6,cL);
    px(12,-53,1,6,OL);px(15,-53,1,6,OL);
    px(12,-52,3,5,darken(c,0.1));px(14,-52,1,5,cL);
    px(15,-55,2,4,hi);px(16,-55,1,1,hiL);
    // Visor
    px(-5,-38,10,2,darken(c,0.5));px(-4,-38,8,1,'#0a0a0a');
    // Nose guard
    px(-1,-40,2,4,cD);
    // Brow ridge
    px(-7,-40,14,1,hi);
  } else {
    // === CLOTH CAP (DEFAULT) ===
    px(-9,-42,1,6,OL);px(8,-42,1,6,OL);
    px3d(-8,-42,16,6,c);
    px(-8,-42,1,6,cD);px(7,-42,1,6,cL);
    px(-7,-42,14,1,hi);px(-6,-42,12,1,hiL);
    px3d(-6,-44,12,4,darken(c,0.1));
    px(-5,-44,10,1,lighten(c,0.15));
    // Fold/stitch
    px(-2,-43,4,1,cD);
    // Brim shadow
    px(-8,-36,16,1,darken(c,0.2));
  }
}

function drawWeaponLayer(h){
  var v=gearVis(h,'weapon');
  var ctx=state.ctx;
  if(!v)return;
  var c=v.color,hi=v.hilight;
  var cD=darken(c,0.3),cL=lighten(c,0.15),hiL=lighten(hi,0.3);
  var t=v.type;
  if(t==='sword'){
    // === SWORD — blade with fuller groove, crossguard, wrapped grip ===
    // Grip wrapping
    var gc='#3a2a1a',gcH='#5a4a3a',gcD='#2a1a0a';
    px(12,-4,1,10,OL);px(16,-4,1,10,OL);
    px(13,-4,3,10,gc);px(14,-4,1,10,gcH);
    // Grip wrapping bands
    for(var gi=-3;gi<5;gi+=2){px(13,gi,3,1,gcD)}
    // Pommel
    px(13,6,3,2,c);px(13,6,3,1,hi);px(14,6,1,1,hiL);
    // Crossguard — 3D
    px(9,-14,1,4,OL);px(19,-14,1,4,OL);
    px(10,-14,9,3,c);px(10,-14,9,1,hi);px(10,-11,9,1,cD);
    px(10,-14,1,3,cD);px(18,-14,1,3,cL);
    px(14,-13,1,1,hiL); // guard gem
    // Blade — with fuller groove and edge highlight
    px(12,-40,1,26,OL);px(16,-40,1,26,OL);
    px(13,-40,3,26,c);
    px(13,-40,1,26,cD); // left shadow edge
    px(15,-40,1,26,cL); // right bright edge
    px(14,-38,1,22,darken(c,0.15)); // fuller groove (center channel)
    px(14,-40,1,26,hi); // fuller highlight
    // Blade tip — tapered
    px(14,-44,1,4,hi);px(14,-46,1,2,hiL);px(14,-47,1,1,'#fff');
    // Edge highlight — bright line
    px(15,-42,1,24,hiL);
    if(v.glow){ctx.shadowColor=v.glow;ctx.shadowBlur=6;px(14,-46,1,6,v.glow);ctx.shadowBlur=0}
  } else if(t==='bow'){
    // === BOW — wood grain, taut string, nocked arrow ===
    // Bow limbs with outline
    ctx.strokeStyle=OL;ctx.lineWidth=3.5;ctx.beginPath();ctx.moveTo(13,-28);ctx.quadraticCurveTo(23,-16,13,-4);ctx.stroke();
    ctx.strokeStyle=c;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(13,-26);ctx.quadraticCurveTo(21,-16,13,-6);ctx.stroke();
    // Wood grain highlight
    ctx.strokeStyle=hi;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(14,-24);ctx.quadraticCurveTo(19,-16,14,-8);ctx.stroke();
    // Inner dark
    ctx.strokeStyle=cD;ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(12,-24);ctx.quadraticCurveTo(16,-16,12,-8);ctx.stroke();
    // Bow tips (nock points)
    px(12,-27,3,2,darken(c,0.2));px(13,-27,1,1,hi);
    px(12,-5,3,2,darken(c,0.2));px(13,-5,1,1,hi);
    // String — taut with shadow
    ctx.strokeStyle='#6a5a3a';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(13,-26);ctx.lineTo(13,-6);ctx.stroke();
    ctx.strokeStyle='#9a8a6a';ctx.lineWidth=0.5;ctx.beginPath();ctx.moveTo(14,-25);ctx.lineTo(14,-7);ctx.stroke();
    // Arrow — shaft, fletching, arrowhead
    px(11,-17,1,2,OL);px(21,-18,1,1,OL); // outline
    px(12,-17,8,2,'#5a4a3a');px(12,-17,8,1,'#7a6a5a'); // shaft
    // Fletching
    px(11,-18,2,1,'#8a3a2a');px(11,-16,2,1,'#8a3a2a');
    // Arrowhead — metallic
    px(19,-18,3,1,hi);px(20,-19,2,1,c);px(21,-18,1,1,hiL);
    if(v.glow){ctx.shadowColor=v.glow;ctx.shadowBlur=4;px(20,-18,2,1,v.glow);ctx.shadowBlur=0}
  } else if(t==='staff'){
    // === STAFF — wooden shaft, metal rings, glowing orb ===
    // Shaft with outline
    px(13,-54,1,50,OL);px(17,-54,1,50,OL);
    px(14,-54,3,50,'#5a4a2a');
    px(14,-54,1,50,darken('#5a4a2a',0.25)); // left shadow
    px(16,-54,1,50,lighten('#5a4a2a',0.2)); // right highlight
    px(15,-54,1,50,lighten('#5a4a2a',0.3)); // center bright
    // Metal rings
    px(13,-48,4,2,c);px(14,-48,2,1,hi);
    px(13,-30,4,2,c);px(14,-30,2,1,hi);
    // Bottom cap
    px(13,0,4,2,darken(c,0.2));px(14,0,2,1,c);
    // Orb — multi-shade with glow
    var oc=v.glow||hi,ocD=darken(oc,0.4),ocL=lighten(oc,0.4);
    ctx.shadowColor=oc;ctx.shadowBlur=8+(h.castAnim||0)*6;
    px(12,-59,6,6,ocD);px(13,-58,4,4,darken(oc,0.2));
    px(14,-57,2,2,oc);px(14,-57,1,1,ocL);px(15,-58,1,1,'#fff'); // catchlight
    ctx.shadowBlur=0;
    // Orb cradle
    px(12,-54,2,2,c);px(16,-54,2,2,c);
  } else if(t==='daggers'){
    // === DUAL DAGGERS — angled with hilts ===
    // Right dagger
    ctx.save();ctx.translate(13,-10);ctx.rotate(-.3);
    ctx.fillStyle=OL;ctx.fillRect(-2,-13,4,14); // outline
    ctx.fillStyle=c;ctx.fillRect(-1,-12,2,12);
    ctx.fillStyle=cD;ctx.fillRect(-1,-12,1,12); // left shadow
    ctx.fillStyle=hi;ctx.fillRect(0,-12,1,12); // right highlight
    ctx.fillStyle=hiL;ctx.fillRect(0,-12,1,1); // tip
    // Hilt
    ctx.fillStyle='#2a2a3a';ctx.fillRect(-3,-1,6,3);
    ctx.fillStyle='#4a4a5a';ctx.fillRect(-3,-1,6,1); // hilt highlight
    ctx.fillStyle=hi;ctx.fillRect(-1,-1,1,1); // hilt gem
    // Grip
    ctx.fillStyle='#3a2a1a';ctx.fillRect(-1,2,2,4);
    ctx.fillStyle='#5a4a3a';ctx.fillRect(0,2,1,4);
    ctx.restore();
    // Left dagger
    ctx.save();ctx.translate(-13,-10);ctx.rotate(.3);
    ctx.fillStyle=OL;ctx.fillRect(-2,-13,4,14);
    ctx.fillStyle=c;ctx.fillRect(-1,-12,2,12);
    ctx.fillStyle=cD;ctx.fillRect(-1,-12,1,12);
    ctx.fillStyle=hi;ctx.fillRect(0,-12,1,12);
    ctx.fillStyle=hiL;ctx.fillRect(0,-12,1,1);
    ctx.fillStyle='#2a2a3a';ctx.fillRect(-3,-1,6,3);
    ctx.fillStyle='#4a4a5a';ctx.fillRect(-3,-1,6,1);
    ctx.fillStyle='#3a2a1a';ctx.fillRect(-1,2,2,4);
    ctx.fillStyle='#5a4a3a';ctx.fillRect(0,2,1,4);
    ctx.restore();
  } else if(t==='axe'){
    // === WAR AXE — handle with wrapping, heavy head ===
    // Handle outline
    px(13,-52,1,48,OL);px(17,-52,1,48,OL);
    px(14,-52,3,48,'#5a4a2a');
    px(14,-52,1,48,darken('#5a4a2a',0.2));px(16,-52,1,48,lighten('#5a4a2a',0.25));
    px(15,-52,1,48,lighten('#5a4a2a',0.3));
    // Handle wrapping
    for(var ai=-10;ai<-2;ai+=2){px(14,ai,3,1,darken('#5a4a2a',0.3))}
    // Axe head — multi-shade with outline
    px(17,-51,1,12,OL);px(29,-49,1,8,OL);
    px3d(17,-50,10,6,c);
    px3d(17,-48,12,4,hi);px(17,-48,12,1,hiL); // highlight band
    px3d(17,-46,10,6,c);
    px(17,-50,1,10,cD);px(27,-49,1,8,cL);
    // Blade edge — bright line
    px(28,-49,1,8,hiL);px(27,-48,1,6,lighten(hiL,0.2));
    // Binding
    px(17,-46,1,2,cD);px(17,-50,1,2,cD);
  } else if(t==='scythe'){
    // === SCYTHE — long handle, curved blade ===
    px(13,-54,1,50,OL);px(17,-54,1,50,OL);
    px(14,-54,3,50,'#3a2a2a');
    px(14,-54,1,50,darken('#3a2a2a',0.2));px(16,-54,1,50,lighten('#3a2a2a',0.2));
    px(15,-54,1,50,lighten('#3a2a2a',0.3));
    // Curved blade — multi-segment
    px(10,-57,8,1,OL);px(6,-55,5,1,OL);px(3,-53,4,1,OL);px(2,-52,2,1,OL);
    px3d(10,-56,8,3,c);px(10,-56,8,1,hi);
    px3d(6,-54,5,3,c);px(6,-54,5,1,hi);
    px3d(3,-52,4,3,hi);px(3,-52,4,1,hiL);
    px(2,-51,2,2,hiL);px(2,-51,1,1,lighten(hiL,0.3)); // blade tip
    if(v.glow){ctx.shadowColor=v.glow;ctx.shadowBlur=5;px(3,-53,4,2,v.glow);ctx.shadowBlur=0}
    // Binding wrap
    px(14,-54,3,2,c);px(14,-54,3,1,hi);
  }
}

function drawAccessoryLayer(h){
  var v=gearVis(h,'accessory');
  if(!v)return;
  var ctx=state.ctx;
  var c=v.color,hi=v.hilight;
  var cD=darken(c,0.3),hiL=lighten(hi,0.3);
  var t=v.type;
  if(t==='cloak'||t==='shadow_cloak'){
    // Shadow cloak — draped fabric with folds
    ctx.globalAlpha=0.5;
    px(-15,-21,1,23,OL);px(-12,-21,1,23,OL);
    px(11,-21,1,23,OL);px(14,-21,1,23,OL);
    px(-14,-20,3,22,c);px(-14,-20,1,22,cD);px(-12,-20,1,22,hi);
    px(11,-20,3,22,c);px(11,-20,1,22,cD);px(13,-20,1,22,hi);
    // Fold detail
    px(-13,-14,1,10,cD);px(12,-14,1,10,cD);
    // Bottom tatter
    px(-14,2,2,2,cD);px(12,2,2,2,cD);
    ctx.globalAlpha=1;
    // Clasp at collar
    px(-3,-21,2,2,hi);px(-3,-21,1,1,hiL);
    px(1,-21,2,2,hi);px(1,-21,1,1,hiL);
  } else if(t==='crystal'||t==='mana_crystal'){
    // Floating crystal orb — multi-facet with glow
    var gc=v.glow||hi,gcL=lighten(gc,0.4);
    ctx.shadowColor=gc;ctx.shadowBlur=6;
    px(-17,-24,6,6,darken(gc,0.4));
    px(-16,-23,4,4,darken(gc,0.2));
    px(-15,-22,2,2,gc);px(-15,-23,1,1,gcL);px(-14,-22,1,1,'#fff');
    ctx.shadowBlur=0;
    // Orbit sparkle
    var sp=Math.sin((state.bt||0)/300)*3;
    px(-14+sp,-26,1,1,gc);px(-16-sp,-19,1,1,gc);
  } else if(t==='amulet'){
    // Pendant chain + gem
    px(-1,-20,1,3,'#4a3a1a');px(0,-20,1,3,'#6a5a3a'); // chain links
    px(-1,-19,1,1,'#7a6a4a'); // chain highlight
    var gc=v.glow||hi;
    if(v.glow){ctx.shadowColor=v.glow;ctx.shadowBlur=4}
    px(-2,-17,4,4,darken(gc,0.3));px(-2,-17,4,1,darken(gc,0.15));
    px(-1,-16,2,2,gc);px(-1,-16,1,1,lighten(gc,0.4));
    ctx.shadowBlur=0;
    // Setting frame
    px(-3,-17,1,3,c);px(2,-17,1,3,c);
  } else if(t==='totem'){
    // Bone charm on belt with detail
    px(-7,-4,1,6,OL);px(-2,-4,1,6,OL);
    px(-6,-3,4,5,c);px(-6,-3,4,1,hi);px(-6,1,4,1,cD);
    px(-5,-2,2,2,hi);px(-5,-2,1,1,hiL); // carved eye
    // Dangling bones
    px(-7,2,1,3,'#8a7a6a');px(-4,2,1,2,'#8a7a6a');px(-2,2,1,3,'#8a7a6a');
    // String
    px(-6,-4,4,1,'#4a3a2a');
  } else if(t==='heart'){
    // Pulsing chaos aura — dual ring
    var pulse=Math.sin((state.bt||0)/400)*0.15+0.2;
    var gc=v.glow||c;
    ctx.globalAlpha=pulse;
    ctx.strokeStyle=gc;ctx.lineWidth=2;
    ctx.shadowColor=gc;ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(0,-16,16,0,6.28);ctx.stroke();
    ctx.globalAlpha=pulse*0.5;
    ctx.beginPath();ctx.arc(0,-16,20,0,6.28);ctx.stroke();
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  } else if(t==='ring'||t==='charm'){
    // Subtle hand/finger glow
    if(v.glow){
      ctx.shadowColor=v.glow;ctx.shadowBlur=4;
      px(10,-9,3,2,v.glow);px(11,-9,1,1,lighten(v.glow,0.4));
      ctx.shadowBlur=0;
    } else {
      px(10,-9,2,1,hi);
    }
  }
}

// ====== MONSTER SPRITE TEMPLATES ======
function drawMonsterHumanoid(h,cols,stunned){
  var ctx=state.ctx;
  var c=cols||{body:'#4a6a2a',accent:'#6a4a1a',eye:'#ffcc00'};
  // Feet
  px3d(-9,0,6,4,darken(c.body,0.3));px3d(3,0,6,4,darken(c.body,0.3));
  // Legs
  px3d(-7,-4,5,6,darken(c.body,0.15));px3d(2,-4,5,6,darken(c.body,0.15));
  // Body
  px3d(-11,-20,22,18,c.body);
  px(-3,-18,1,14,darken(c.body,0.2));px(2,-18,1,14,darken(c.body,0.2));
  px(0,-19,1,12,lighten(c.body,0.15));
  // Collar
  px3d(-9,-22,18,4,c.accent);px(-8,-22,16,1,lighten(c.accent,0.25));
  // Arms
  px3d(-13,-18,4,10,darken(c.body,0.1));px3d(9,-18,4,10,darken(c.body,0.1));
  // Belt
  px3d(-9,-4,18,3,c.accent);px(-1,-3,2,2,lighten(c.accent,0.3));
  // Head
  px3d(-7,-35,14,13,lighten(c.body,0.2));
  px(-6,-35,12,1,lighten(c.body,0.35));
  // Eyes
  px(-4,-30,3,3,'#111');px(1,-30,3,3,'#111');
  px(-3,-29,2,2,c.eye);px(2,-29,2,2,c.eye);
  ctx.shadowColor=c.eye;ctx.shadowBlur=2;
  px(-3,-29,1,1,lighten(c.eye,0.4));px(2,-29,1,1,lighten(c.eye,0.4));
  ctx.shadowBlur=0;
  // Mouth
  px(-3,-25,6,2,darken(c.body,0.4));px(-2,-24,4,1,'#ddd');
  // Helmet/head armor
  px3d(-8,-40,16,7,c.accent);px3d(-6,-42,12,4,darken(c.accent,0.15));
  px(-7,-40,14,1,lighten(c.accent,0.2));
  // Weapon — sword on right side
  px(12,-40,2,36,darken(c.accent,0.1));px(13,-40,1,36,lighten(c.accent,0.25));
  px3d(10,-42,6,4,c.accent);
  px(14,-40,2,6,lighten(c.accent,0.35));
  // Shoulder pads
  px3d(-13,-16,4,5,c.accent);px3d(9,-16,4,5,c.accent);
}

function drawMonsterBeast(h,cols,stunned){
  var ctx=state.ctx;
  var c=cols||{body:'#5a3a2a',accent:'#3a2a1a',eye:'#ff4444'};
  // Feet — wide, heavy
  px3d(-12,0,8,5,darken(c.body,0.3));px3d(4,0,8,5,darken(c.body,0.3));
  // Claws
  px(-12,-1,2,3,'#ddd');px(-8,-1,2,3,'#ddd');px(5,-1,2,3,'#ddd');px(9,-1,2,3,'#ddd');
  // Legs — thick
  px3d(-10,-6,7,8,darken(c.body,0.15));px3d(3,-6,7,8,darken(c.body,0.15));
  // Hunched body — wider
  px3d(-14,-24,28,20,c.body);
  px(-14,-24,1,20,darken(c.body,0.25));px(13,-24,1,20,lighten(c.body,0.1));
  // Muscle highlights
  px(-8,-20,6,6,lighten(c.body,0.12));px(2,-20,6,6,lighten(c.body,0.12));
  px(0,-22,1,14,lighten(c.body,0.1));
  // Chest fur/mark
  px(-4,-16,8,6,c.accent);px(-3,-15,6,4,lighten(c.accent,0.15));
  // Arms — thick, hanging
  px3d(-17,-22,5,14,c.body);px(-17,-22,1,14,darken(c.body,0.25));
  px(-16,-18,2,4,lighten(c.body,0.12));
  px3d(12,-22,5,14,c.body);px(16,-22,1,14,lighten(c.body,0.12));
  // Arm claws
  px(-17,-8,2,3,'#ddd');px(-14,-8,2,3,'#ddd');px(13,-8,2,3,'#ddd');px(16,-8,2,3,'#ddd');
  // Head — slightly above body, brutish
  px3d(-9,-38,18,16,lighten(c.body,0.1));
  px(-8,-38,16,1,lighten(c.body,0.25));
  // Brow ridge
  px3d(-8,-38,16,4,darken(c.body,0.2));
  // Eyes — angry, small
  px(-5,-33,3,2,c.eye);px(3,-33,3,2,c.eye);
  ctx.shadowColor=c.eye;ctx.shadowBlur=3;
  px(-4,-33,1,1,lighten(c.eye,0.5));px(4,-33,1,1,lighten(c.eye,0.5));
  ctx.shadowBlur=0;
  // Snout / jaw
  px3d(-5,-27,10,5,lighten(c.body,0.15));
  px(-4,-24,8,2,darken(c.body,0.3));px(-3,-23,6,1,'#ddd');
  // Horns/ears
  px3d(-9,-42,4,6,c.accent);px3d(5,-42,4,6,c.accent);
  px(-8,-44,2,3,lighten(c.accent,0.2));px(6,-44,2,3,lighten(c.accent,0.2));
}

function drawMonsterBlob(h,cols,stunned){
  var ctx=state.ctx;
  var c=cols||{body:'#3a8a3a',accent:'#2a6a2a',eye:'#ffffff'};
  // Pulsing bob
  var pulse=Math.sin((state.bt||0)/400)*2;
  // Body — amorphous round shape
  ctx.fillStyle=c.body;
  ctx.beginPath();ctx.ellipse(0,-12+pulse,18,16+pulse*0.5,0,0,Math.PI*2);ctx.fill();
  // Inner glow
  ctx.fillStyle=lighten(c.body,0.2);
  ctx.beginPath();ctx.ellipse(-3,-15+pulse,10,10,0,0,Math.PI*2);ctx.fill();
  // Highlight spot
  ctx.fillStyle=lighten(c.body,0.4);
  ctx.beginPath();ctx.ellipse(-6,-20+pulse,4,3,-.3,0,Math.PI*2);ctx.fill();
  // Outline darker edge
  ctx.strokeStyle=c.accent;ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(0,-12+pulse,18,16+pulse*0.5,0,0,Math.PI*2);ctx.stroke();
  // Eyes
  ctx.fillStyle=c.eye;
  ctx.beginPath();ctx.ellipse(-5,-16+pulse,3,4,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(5,-16+pulse,3,4,0,0,Math.PI*2);ctx.fill();
  // Pupils
  ctx.fillStyle='#111';
  ctx.beginPath();ctx.ellipse(-4,-15+pulse,1.5,2,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(6,-15+pulse,1.5,2,0,0,Math.PI*2);ctx.fill();
  // Mouth — sinister smile
  ctx.strokeStyle=darken(c.body,0.4);ctx.lineWidth=1.5;
  ctx.beginPath();ctx.arc(0,-8+pulse,6,0.2,Math.PI-0.2);ctx.stroke();
  // Drip pseudopods at base
  ctx.fillStyle=c.accent;
  ctx.fillRect(-12,2+pulse,5,4);ctx.fillRect(7,2+pulse,5,4);ctx.fillRect(-3,4+pulse,6,3);
}

function drawMonsterWinged(h,cols,stunned){
  var ctx=state.ctx;
  var c=cols||{body:'#6a2a2a',accent:'#8a3a1a',eye:'#ff6622'};
  var wingFlap=Math.sin((state.bt||0)/200)*4;
  // Tail
  ctx.strokeStyle=c.accent;ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(0,-4);ctx.quadraticCurveTo(16,5,22,-2+wingFlap*0.5);ctx.stroke();
  px(20,-4+wingFlap*0.3,4,2,lighten(c.accent,0.2));
  // Feet — clawed
  px3d(-8,0,6,4,darken(c.body,0.3));px3d(2,0,6,4,darken(c.body,0.3));
  px(-9,-1,2,3,'#ddd');px(-4,-1,2,3,'#ddd');px(2,-1,2,3,'#ddd');px(7,-1,2,3,'#ddd');
  // Legs
  px3d(-7,-5,5,7,darken(c.body,0.15));px3d(2,-5,5,7,darken(c.body,0.15));
  // Body — sleek
  px3d(-10,-22,20,20,c.body);
  px(-10,-22,1,20,darken(c.body,0.2));px(9,-22,1,20,lighten(c.body,0.1));
  // Belly lighter
  px(-5,-14,10,8,lighten(c.body,0.15));
  px(-4,-13,8,6,lighten(c.body,0.2));
  // Wings — spread
  ctx.fillStyle=c.accent;
  // Left wing
  ctx.save();ctx.translate(-10,-20);ctx.rotate((-0.4+wingFlap*0.03));
  ctx.fillRect(-20,-4,22,6);
  ctx.fillStyle=darken(c.accent,0.2);
  ctx.fillRect(-22,-2,6,10);ctx.fillRect(-16,0,6,8);ctx.fillRect(-10,2,6,6);
  ctx.fillStyle=lighten(c.accent,0.15);
  ctx.fillRect(-18,-4,18,2);
  ctx.restore();
  // Right wing
  ctx.fillStyle=c.accent;
  ctx.save();ctx.translate(10,-20);ctx.rotate((0.4-wingFlap*0.03));
  ctx.fillRect(-2,-4,22,6);
  ctx.fillStyle=darken(c.accent,0.2);
  ctx.fillRect(16,-2,6,10);ctx.fillRect(10,0,6,8);ctx.fillRect(4,2,6,6);
  ctx.fillStyle=lighten(c.accent,0.15);
  ctx.fillRect(0,-4,18,2);
  ctx.restore();
  // Head — angular
  px3d(-7,-36,14,14,lighten(c.body,0.1));
  px(-6,-36,12,1,lighten(c.body,0.25));
  // Eyes — fierce
  px(-4,-30,3,2,c.eye);px(2,-30,3,2,c.eye);
  ctx.shadowColor=c.eye;ctx.shadowBlur=3;
  px(-3,-30,1,1,lighten(c.eye,0.4));px(3,-30,1,1,lighten(c.eye,0.4));
  ctx.shadowBlur=0;
  // Snout
  px3d(-4,-25,8,4,lighten(c.body,0.15));
  px(-3,-23,6,1,darken(c.body,0.4));px(-2,-22,4,1,'#ddd');
  // Horns
  px3d(-8,-40,3,6,c.accent);px3d(5,-40,3,6,c.accent);
  px(-7,-43,2,4,lighten(c.accent,0.2));px(6,-43,2,4,lighten(c.accent,0.2));
  // Neck spines
  px(0,-36,2,3,c.accent);px(-2,-34,2,2,c.accent);px(2,-34,2,2,c.accent);
}

function drawMonsterGhost(h,cols,stunned){
  var ctx=state.ctx;
  var c=cols||{body:'#8888aa',accent:'#6666aa',eye:'#ffffff'};
  var hover=Math.sin((state.bt||0)/500)*4;
  var waver=Math.sin((state.bt||0)/300)*2;
  // Translucent body
  ctx.globalAlpha=0.6;
  // Main body — fading downward
  var grd=ctx.createLinearGradient(0,-40+hover,0,10+hover);
  grd.addColorStop(0,c.body);grd.addColorStop(0.7,c.accent);grd.addColorStop(1,'rgba(100,100,160,0)');
  ctx.fillStyle=grd;
  ctx.beginPath();
  ctx.moveTo(-14,-30+hover);
  ctx.quadraticCurveTo(-16,-15+hover,-10,5+hover);
  ctx.lineTo(-6,8+hover+waver);
  ctx.lineTo(-2,4+hover);
  ctx.lineTo(2,8+hover-waver);
  ctx.lineTo(6,4+hover+waver);
  ctx.lineTo(10,8+hover);
  ctx.quadraticCurveTo(16,-15+hover,14,-30+hover);
  ctx.quadraticCurveTo(10,-44+hover,0,-44+hover);
  ctx.quadraticCurveTo(-10,-44+hover,-14,-30+hover);
  ctx.fill();
  // Inner glow
  ctx.fillStyle=lighten(c.body,0.3);
  ctx.beginPath();ctx.ellipse(-2,-24+hover,6,8,-.2,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=0.8;
  // Eyes — hollow, glowing
  ctx.fillStyle=c.eye;
  ctx.beginPath();ctx.ellipse(-5,-30+hover,3,4,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(5,-30+hover,3,4,0,0,Math.PI*2);ctx.fill();
  // Eye inner
  ctx.fillStyle=c.accent;
  ctx.beginPath();ctx.ellipse(-5,-30+hover,1.5,2,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(5,-30+hover,1.5,2,0,0,Math.PI*2);ctx.fill();
  // Ghostly eye glow
  ctx.shadowColor=c.eye;ctx.shadowBlur=8;
  ctx.fillStyle=c.eye;
  ctx.beginPath();ctx.ellipse(-5,-30+hover,1,1,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(5,-30+hover,1,1,0,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;
  // Mouth — open wail
  ctx.fillStyle=darken(c.body,0.5);
  ctx.beginPath();ctx.ellipse(0,-22+hover,4,3,0,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=1;
}

export function drawMonster(h,stunned){
  var mt=h.monsterType||'humanoid';
  var cols=h.monsterColors||null;
  if(mt==='beast')drawMonsterBeast(h,cols,stunned);
  else if(mt==='blob')drawMonsterBlob(h,cols,stunned);
  else if(mt==='winged')drawMonsterWinged(h,cols,stunned);
  else if(mt==='ghost')drawMonsterGhost(h,cols,stunned);
  else drawMonsterHumanoid(h,cols,stunned);
}

export function drawCustomPixel(h,stunned){
  var ctx=state.ctx;
  // Monsters with monsterType use dedicated monster sprites
  if(h.monsterType){
    drawMonster(h,stunned);
    return;
  }
  // Monsters and NPCs without equipment fall back to class sprites
  if(!h.equipment){
    var sp=h.customSprite||'wizard';
    if(sp==='wizard')drawWizPixel(h,stunned);
    else if(sp==='ranger')drawRgrPixel(h,stunned);
    else if(sp==='barbarian')drawBarPixel(h,stunned);
    else drawAsnPixel(h,stunned);
    return;
  }
  // Layered gear-dependent rendering for player heroes
  drawBootsLayer(h);
  drawBaseBody(h);
  drawChestLayer(h);
  drawHead(h);
  drawHelmetLayer(h);
  drawWeaponLayer(h);
  drawAccessoryLayer(h);
}

// --- Sprite Preview for picker screens ---
export function drawSpritePreview(canvas,spriteType,equipment){
  var c=canvas.getContext('2d');
  c.imageSmoothingEnabled=false;
  c.clearRect(0,0,canvas.width,canvas.height);
  // Temporarily swap context
  var origCtx=state.ctx;
  var origBt=state.bt;
  state.ctx=c;
  if(!state.bt)state.bt=0;
  // Scale up the sprite — sprites are drawn ~60px tall, scale 2.8x to fill canvas
  var scale=2.8;
  var cx=canvas.width/2,cy=canvas.height-30*scale;
  c.save();
  c.translate(Math.round(cx),Math.round(cy));
  c.scale(scale,scale);
  // Ground shadow (in sprite-local coords)
  c.fillStyle='rgba(0,0,0,0.25)';
  c.beginPath();c.ellipse(0,5,20,6,0,0,Math.PI*2);c.fill();
  // Draw sprite with equipment if available
  var mockH={bobPhase:0,hurtAnim:0,castAnim:0,hp:100,maxHp:100,stealthed:false,ultActive:false,blActive:false,envenomed:false,envenomedEnd:0,deathMarkTarget:false,deathMarkEnd:0,customSprite:spriteType,equipment:equipment||null};
  if(equipment){
    drawCustomPixel(mockH,false);
  } else {
    if(spriteType==='wizard')drawWizPixel(mockH,false);
    else if(spriteType==='ranger')drawRgrPixel(mockH,false);
    else if(spriteType==='barbarian')drawBarPixel(mockH,false);
    else drawAsnPixel(mockH,false);
  }
  c.restore();
  // Restore
  state.ctx=origCtx;
  state.bt=origBt;
}

// ---- Per-type companion sprite dispatch ----
function _drawCompanionSprite(name,col,rarity){
  var ctx=state.ctx;
  if(name==='Fire Imp'){
    // Small red demon — body, flame head, horns
    px(-5,-8,10,10,'#aa2200');px(-4,-12,8,5,'#cc3300');
    px(-3,-16,6,5,'#ff4400');px(-1,-18,2,3,'#ff8833');
    px(-5,-14,2,2,'#ffdd44');px(3,-14,2,2,'#ffdd44'); // horns
    px(-2,-12,2,2,'#fff');px(2,-12,2,2,'#fff');px(-1,-12,1,1,'#000');px(3,-12,1,1,'#000');
    px(-7,-4,3,6,'#aa2200');px(4,-4,3,6,'#aa2200'); // arms
    px(-1,-20,2,3,'#ffcc22');px(0,-22,1,2,'#ffee44'); // flame tip
  }else if(name==='Stone Golem'){
    // Blocky grey body, big arms, small head
    px(-7,-6,14,10,'#666');px(-6,-10,12,5,'#777');
    px(-4,-14,8,5,'#888');px(-3,-16,6,3,'#999');
    px(-2,-12,2,2,'#fff');px(2,-12,2,2,'#fff');px(-1,-12,1,1,'#333');px(3,-12,1,1,'#333');
    px(-9,-4,4,8,'#555');px(5,-4,4,8,'#555'); // big arms
    px(-6,4,5,3,'#555');px(1,4,5,3,'#555'); // feet
  }else if(name==='Shadow Rat'){
    // Low profile, dark body, long tail, beady eyes
    px(-6,-4,12,6,'#2a2a2a');px(-4,-7,8,4,'#3a3a3a');
    px(-2,-8,2,2,'#ff0000');px(2,-8,2,2,'#ff0000'); // red eyes
    px(6,-3,6,2,'#222');px(10,-4,3,1,'#222'); // tail
    px(-7,-1,3,3,'#2a2a2a');px(4,-1,3,3,'#2a2a2a'); // legs
  }else if(name==='Ember Sprite'){
    // Small floating spark
    px(-3,-10,6,6,'#ffaa22');px(-2,-14,4,5,'#ffcc44');
    px(-1,-16,2,3,'#ffee66');
    px(-2,-10,2,2,'#fff');px(2,-10,2,2,'#fff');px(-1,-10,1,1,'#aa4400');px(3,-10,1,1,'#aa4400');
    ctx.globalAlpha=0.4;px(-5,-6,2,2,'#ff8800');px(3,-6,2,2,'#ff8800');ctx.globalAlpha=1; // sparks
  }else if(name==='Mud Crawler'){
    // Brown bug body
    px(-6,-5,12,8,'#5a3a1a');px(-5,-9,10,5,'#6a4a2a');
    px(-4,-11,8,3,'#7a5a3a');
    px(-3,-8,2,2,'#fff');px(2,-8,2,2,'#fff');px(-2,-8,1,1,'#000');px(3,-8,1,1,'#000');
    px(-8,-2,3,4,'#5a3a1a');px(5,-2,3,4,'#5a3a1a'); // legs
  }else if(name==='Frost Wolf'){
    // Four-legged wolf, blue-grey
    px(-6,-6,12,8,'#667788');px(-4,-10,8,5,'#778899');
    px(-3,-13,6,4,'#889aaa');px(-1,-14,2,2,'#99aabb');
    px(-4,-14,2,3,'#778899');px(2,-14,2,3,'#778899'); // ears
    px(-2,-10,2,2,'#aaddff');px(2,-10,2,2,'#aaddff');px(-1,-10,1,1,'#224');px(3,-10,1,1,'#224');
    px(-7,0,3,4,'#667788');px(-3,0,3,4,'#667788');px(0,0,3,4,'#667788');px(4,0,3,4,'#667788');
    px(6,-5,5,2,'#778899'); // tail
  }else if(name==='Thunder Hawk'){
    // Wings spread, yellow/gold, talons
    px(-3,-10,6,6,'#aa8800');px(-2,-14,4,5,'#bb9900');
    px(-10,-10,8,3,'#cc9900');px(2,-10,8,3,'#cc9900'); // wings
    px(-12,-11,4,2,'#ddaa00');px(8,-11,4,2,'#ddaa00'); // wing tips
    px(-1,-12,2,2,'#fff');px(1,-12,2,2,'#fff');px(0,-12,1,1,'#000');px(2,-12,1,1,'#000');
    px(0,-15,1,2,'#ff8800'); // beak
    px(-2,0,2,3,'#886600');px(2,0,2,3,'#886600'); // talons
  }else if(name==='Iron Beetle'){
    px(-6,-5,12,8,'#4a4a3a');px(-5,-9,10,5,'#5a5a4a');
    px(-7,-4,2,6,'#3a3a2a');px(5,-4,2,6,'#3a3a2a'); // pincers
    px(-3,-7,2,2,'#aaffaa');px(2,-7,2,2,'#aaffaa'); // eyes
    px(-4,-11,8,3,'#6a6a5a'); // shell
  }else if(name==='Venom Spider'){
    px(-5,-6,10,8,'#1a3a1a');px(-4,-10,8,5,'#2a4a2a');
    px(-2,-8,2,2,'#ff0000');px(2,-8,2,2,'#ff0000');px(0,-8,2,2,'#ff0000'); // multi-eyes
    px(-8,-4,3,2,'#1a3a1a');px(5,-4,3,2,'#1a3a1a');
    px(-9,-2,3,2,'#1a3a1a');px(6,-2,3,2,'#1a3a1a'); // legs
    px(-7,0,3,2,'#1a3a1a');px(4,0,3,2,'#1a3a1a');
    px(-1,2,2,2,'#66aa22'); // venom drip
  }else if(name==='Bone Wraith'){
    px(-4,-8,8,10,'#ddd');px(-3,-14,6,7,'#eee');
    px(-2,-12,2,2,'#000');px(2,-12,2,2,'#000'); // hollow eyes
    px(-1,-10,2,1,'#000'); // nose
    ctx.globalAlpha=0.3;px(-6,-6,2,8,'#aaa');px(4,-6,2,8,'#aaa');ctx.globalAlpha=1; // ghostly arms
  }else if(name==='Flame Drake'){
    px(-6,-6,12,9,'#cc4400');px(-4,-11,8,6,'#dd5500');
    px(-3,-14,6,4,'#ee6600');
    px(-2,-11,2,2,'#ffee00');px(2,-11,2,2,'#ffee00');px(-1,-11,1,1,'#000');px(3,-11,1,1,'#000');
    px(-10,-10,5,3,'#cc4400');px(5,-10,5,3,'#cc4400'); // wings
    px(-7,1,3,3,'#aa3300');px(4,1,3,3,'#aa3300'); // legs
    px(0,-16,1,2,'#ff8800'); // nostril flame
  }else if(name==='Crystal Elemental'){
    // Faceted body, blue glow
    ctx.shadowColor='#44aaff';ctx.shadowBlur=4;
    px(-4,-8,8,10,'#4488cc');px(-3,-14,6,7,'#55aadd');
    px(-5,-4,2,6,'#3377bb');px(3,-4,2,6,'#3377bb');
    ctx.shadowBlur=0;
    px(-2,-12,2,2,'#ffffff');px(2,-12,2,2,'#ffffff'); // crystal eyes
    px(-1,-6,2,2,'#88ddff'); // core
  }else if(name==='Shadow Panther'){
    px(-7,-5,14,7,'#1a1a2a');px(-5,-9,10,5,'#222233');
    px(-4,-12,8,4,'#2a2a3a');
    px(-3,-10,2,2,'#44ff88');px(2,-10,2,2,'#44ff88'); // glowing green eyes
    px(-8,0,3,3,'#1a1a2a');px(-4,0,3,3,'#1a1a2a');px(1,0,3,3,'#1a1a2a');px(5,0,3,3,'#1a1a2a');
    px(7,-4,5,2,'#222233'); // tail
  }else if(name==='Storm Serpent'){
    px(-3,-8,6,10,'#336655');px(-2,-14,4,7,'#447766');
    px(-1,-12,2,2,'#ffff44');px(1,-12,2,2,'#ffff44'); // electric eyes
    px(3,-4,4,2,'#336655');px(5,-2,3,2,'#336655'); // tail curve
    ctx.globalAlpha=0.4;px(-4,-6,1,2,'#ffff44');px(3,-6,1,2,'#ffff44');ctx.globalAlpha=1; // sparks
  }else if(name==='Phoenix'){
    ctx.shadowColor='#ffaa00';ctx.shadowBlur=6;
    px(-4,-8,8,8,'#ff8800');px(-3,-14,6,7,'#ffaa22');
    px(-8,-10,5,3,'#ff6600');px(3,-10,5,3,'#ff6600'); // flaming wings
    px(-10,-11,3,2,'#ffcc44');px(7,-11,3,2,'#ffcc44');
    ctx.shadowBlur=0;
    px(-2,-12,2,2,'#fff');px(2,-12,2,2,'#fff');px(-1,-12,1,1,'#880000');px(3,-12,1,1,'#880000');
    px(-1,-16,2,3,'#ffee44');px(0,-18,1,2,'#ffff88'); // flame crest
  }else if(name==='Void Stalker'){
    px(-5,-6,10,8,'#2a1a3a');px(-4,-11,8,6,'#3a2a4a');
    px(-3,-14,6,4,'#4a3a5a');
    px(-2,-10,2,2,'#ff44ff');px(2,-10,2,2,'#ff44ff'); // purple eyes
    px(-8,-10,4,2,'#2a1a3a');px(4,-10,4,2,'#2a1a3a'); // wings
    px(-6,0,3,3,'#2a1a3a');px(3,0,3,3,'#2a1a3a');
  }else if(name==='Ancient Treant'){
    px(-7,-5,14,9,'#3a5a2a');px(-5,-10,10,6,'#4a6a3a');
    px(-4,-14,8,5,'#5a7a4a');px(-6,-13,3,4,'#3a5a2a');px(3,-13,3,4,'#3a5a2a'); // branches
    px(-2,-10,2,2,'#ffcc22');px(2,-10,2,2,'#ffcc22'); // amber eyes
    px(-8,-2,3,6,'#3a5a2a');px(5,-2,3,6,'#3a5a2a'); // thick arms
    px(-6,4,4,3,'#2a4a1a');px(2,4,4,3,'#2a4a1a'); // roots
  }else if(name==='Chaos Dragon'){
    ctx.shadowColor='#ff4400';ctx.shadowBlur=5;
    px(-7,-5,14,9,'#6a1a1a');px(-5,-10,10,6,'#8a2a2a');
    px(-4,-14,8,5,'#aa3a3a');px(-2,-16,4,3,'#cc4a4a');
    px(-11,-10,5,3,'#6a1a1a');px(6,-10,5,3,'#6a1a1a'); // wings
    ctx.shadowBlur=0;
    px(-3,-12,2,2,'#ffcc00');px(2,-12,2,2,'#ffcc00');px(-2,-12,1,1,'#000');px(3,-12,1,1,'#000');
    px(-7,2,3,3,'#5a1a1a');px(4,2,3,3,'#5a1a1a'); // legs
    px(0,-18,1,2,'#ff6600'); // flame
  }else if(name==='Death Knight'){
    // Armored humanoid, dark purple, sword
    px(-5,-6,10,10,'#2a1a3a');px(-4,-12,8,7,'#3a2a4a');
    px(-3,-16,6,5,'#4a3a5a');px(-2,-18,4,3,'#5a4a6a'); // helm
    px(-2,-14,2,2,'#ff4444');px(2,-14,2,2,'#ff4444'); // red eyes
    px(-7,-4,3,8,'#2a1a3a');px(4,-4,3,8,'#2a1a3a'); // arms
    px(6,-10,2,8,'#888');px(6,-12,2,3,'#aaa'); // sword
    px(-5,4,4,3,'#2a1a3a');px(1,4,4,3,'#2a1a3a'); // boots
  }else{
    // Default fallback — colored body with emoji
    var bd=rarity==='legendary'?'#aa8800':rarity==='epic'?'#7733aa':rarity==='rare'?'#2266aa':rarity==='uncommon'?'#227722':'#666666';
    px(-6,-10,12,12,bd);px(-5,-14,10,6,col);
    px(-4,-18,8,6,col);px(-3,-20,6,3,bd);
    px(-2,-16,2,2,'#fff');px(2,-16,2,2,'#fff');px(-1,-16,1,1,'#000');px(3,-16,1,1,'#000');
    px(-8,-6,3,8,bd);px(5,-6,3,8,bd);
  }
}

function _drawUpgradeStars(ups){
  if(!ups)return;
  var ctx=state.ctx;
  ctx.fillStyle='#ffcc22';ctx.font='bold 6px sans-serif';ctx.textAlign='center';
  var str='';for(var i=0;i<ups;i++)str+='\u2605';
  ctx.fillText(str,0,-38);
}

export function drawFollower(fl,owner){
  const ctx=state.ctx;
  if(!fl.alive)return;
  const bob=Math.sin(fl.bobPhase)*2,hs=fl.hurtAnim>0?Math.sin(state.bt/20)*3*fl.hurtAnim:0;
  const fpx=fl.x+hs,fpy=fl.y+bob,f=en(owner).x>fl.x?1:-1;
  ctx.save();ctx.translate(Math.round(fpx),Math.round(fpy));if(f<0)ctx.scale(-1,1);
  ctx.fillStyle='rgba(0,0,0,0.15)';ctx.fillRect(-8,2,16,4);
  _drawCompanionSprite(fl._companionName||'Fire Imp','#ffaa44','common');
  const hpP=Math.max(0,fl.hp/fl.maxHp);ctx.fillStyle='#2a1a0a';ctx.fillRect(-8,-30,16,4);
  ctx.fillStyle='#ffaa44';ctx.fillRect(-7,-29,Math.round(14*hpP),2);
  ctx.restore();
}

export function drawArenaFollower(af){
  const ctx=state.ctx;
  if(!af.alive)return;
  var bob=Math.sin(af.bobPhase)*1.5;
  var hs=af.hurtAnim>0?Math.sin(state.bt/20)*3*af.hurtAnim:0;
  var atkBob=af.attackAnim>0?-af.attackAnim*4:0;
  var fx=af.x+hs,fy=af.y+bob+atkBob;
  ctx.save();ctx.translate(Math.round(fx),Math.round(fy));
  ctx.fillStyle='rgba(0,0,0,0.15)';ctx.fillRect(-10,2,20,5);
  var col=af.color;
  var rarity=af.rarity||'common';
  // Rarity glow
  if(rarity==='epic'||rarity==='legendary'){ctx.shadowColor=col;ctx.shadowBlur=6}
  _drawCompanionSprite(af.name,col,rarity);
  ctx.shadowBlur=0;
  // HP bar
  var hpP=Math.max(0,af.hp/af.maxHp);
  ctx.fillStyle='#1a1a1a';ctx.fillRect(-10,-32,20,4);
  ctx.fillStyle=hpP>0.3?col:'#cc3300';ctx.fillRect(-9,-31,Math.round(18*hpP),2);
  ctx.strokeStyle='#444';ctx.lineWidth=0.5;ctx.strokeRect(-10.5,-32.5,21,5);
  // Name
  ctx.fillStyle=col;ctx.font='bold 7px "Cinzel"';ctx.textAlign='center';ctx.fillText(af.name,0,-35);
  // Upgrade stars
  _drawUpgradeStars(af._upgrades||0);
  ctx.restore();
}

export function pxRect(x,y,w,h,c,bc){state.ctx.fillStyle=c;state.ctx.fillRect(x,y,w,h);if(bc){state.ctx.strokeStyle=bc;state.ctx.lineWidth=1;state.ctx.strokeRect(x+.5,y+.5,w-1,h-1)}}
