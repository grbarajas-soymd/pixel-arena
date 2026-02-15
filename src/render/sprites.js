import { state } from '../gameState.js';
import { GY } from '../constants.js';
import { en, isStunned } from '../combat/engine.js';

function px(x,y,w,h,c){state.ctx.fillStyle=c;state.ctx.fillRect(Math.round(x),Math.round(y),w,h)}

export function drawHero(h){
  const ctx=state.ctx;
  const bob=Math.sin(h.bobPhase)*2,hs=h.hurtAnim>0?Math.sin(state.bt/20)*5*h.hurtAnim:0;
  const hx=h.x+hs,hy=h.y+bob,f=h.facing;
  const stA=h.stealthed?.3:1;
  const stunned=isStunned(h);
  ctx.save();ctx.translate(Math.round(hx),Math.round(hy));if(f<0)ctx.scale(-1,1);ctx.globalAlpha=stA;
  ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fillRect(-16,2,32,6);
  if(h.type==='wizard')drawWizPixel(h,stunned);
  else if(h.type==='ranger')drawRgrPixel(h,stunned);
  else if(h.type==='barbarian')drawBarPixel(h,stunned);
  else if(h.type==='custom')drawCustomPixel(h,stunned);
  else drawAsnPixel(h,stunned);
  if(h.shieldActive){ctx.strokeStyle='rgba(68,221,187,0.3)';ctx.lineWidth=2;ctx.shadowColor='#44ddbb';ctx.shadowBlur=8;ctx.strokeRect(-22,-58,44,65);ctx.shadowBlur=0}
  if(h.ultActive&&h.type!=='assassin'){const col=h.type==='wizard'?'#44ddbb':'#ffaa44';ctx.strokeStyle=col+'40';ctx.lineWidth=2;ctx.shadowColor=col;ctx.shadowBlur=12;ctx.strokeRect(-20,-56,40,62);ctx.shadowBlur=0}
  if(h.blActive){ctx.strokeStyle='rgba(204,51,0,0.25)';ctx.lineWidth=1.5;ctx.shadowColor='#cc3300';ctx.shadowBlur=8;ctx.strokeRect(-18,-54,36,58);ctx.shadowBlur=0}
  if(h.envenomed&&state.bt<h.envenomedEnd){ctx.strokeStyle='rgba(102,204,255,0.25)';ctx.lineWidth=1;ctx.shadowColor='#66ccff';ctx.shadowBlur=6;ctx.strokeRect(-16,-52,32,56);ctx.shadowBlur=0}
  if(h.deathMarkTarget&&state.bt<h.deathMarkEnd){ctx.strokeStyle='rgba(255,136,0,0.4)';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.strokeRect(-22,-58,44,65);ctx.setLineDash([]);ctx.fillStyle='#ff8800';ctx.font='bold 11px "Chakra Petch"';ctx.textAlign='center';ctx.fillText('\u2620',0,-64)}
  if(stunned){const t2=state.bt/200;for(let i=0;i<3;i++){const a=t2+i*2.09;ctx.fillStyle='#e8d060';ctx.fillRect(-2+Math.cos(a)*14,-55+Math.sin(a)*6,4,4);ctx.fillStyle='#fff';ctx.fillRect(-1+Math.cos(a)*14,-54+Math.sin(a)*6,2,2)}}
  ctx.globalAlpha=1;
  const hpP=Math.max(0,h.hp/h.maxHp);
  ctx.fillStyle='#2a1a0a';ctx.fillRect(-18,-72,36,6);
  ctx.fillStyle=hpP>.3?h.color:'#cc3300';ctx.fillRect(-17,-71,Math.round(34*hpP),4);
  ctx.strokeStyle='#5a4a2a';ctx.lineWidth=1;ctx.strokeRect(-18.5,-72.5,37,7);
  ctx.fillStyle='#000';ctx.font='bold 9px "Chakra Petch"';ctx.textAlign='center';
  ctx.fillText(h.name,1,-76);ctx.fillStyle=h.color;ctx.fillText(h.name,0,-77);
  ctx.restore();
}

export function drawWizPixel(h,stunned){
  const ctx=state.ctx;
  const castGlow=h.castAnim*6;
  px(-10,0,7,4,'#3a4a5a');px(3,0,7,4,'#3a4a5a');
  px(-7,-4,5,6,'#4a5a6a');px(2,-4,5,6,'#4a5a6a');
  px(-12,-20,24,18,'#4a5a6a');px(-10,-22,20,4,'#5a6a7a');
  px(-14,-18,4,10,'#3a4a5a');px(10,-18,4,10,'#3a4a5a');
  px(-2,-14,4,4,'#2a8a7a');px(-1,-13,2,2,'#44ddbb');
  px(-10,-4,20,3,'#6a5a3a');px(-1,-3,2,2,'#c8a832');
  px(-8,-36,16,14,'#d4b898');
  px(-6,-24,12,6,'#8a4a2a');px(-4,-18,8,3,'#7a3a1a');
  px(-5,-32,3,3,'#fff');px(2,-32,3,3,'#fff');
  px(-4,-31,2,2,'#2a8a7a');px(3,-31,2,2,'#2a8a7a');
  px(-10,-42,20,8,'#3a4a5a');px(-12,-38,24,4,'#4a5a6a');
  px(-8,-48,16,8,'#3a4a5a');px(-4,-50,8,4,'#4a5a6a');
  px(-2,-44,4,3,'#2a8a7a');px(-1,-43,2,1,'#88ffdd');
  px(-10,-48,3,6,'#2a3a4a');px(7,-48,3,6,'#2a3a4a');
  px(14,-54,3,50,'#5a4a2a');
  ctx.shadowColor='#44ddbb';ctx.shadowBlur=8+castGlow;
  px(13,-58,5,5,'#2a8a7a');px(14,-57,3,3,'#44ddbb');px(15,-56,1,1,'#fff');
  ctx.shadowBlur=0;
  px(-14,-16,4,6,'#3a4a5a');px(-13,-14,2,2,'#2a8a7a');
  px(10,-16,4,6,'#3a4a5a');px(11,-14,2,2,'#2a8a7a');
}

export function drawRgrPixel(h,stunned){
  const ctx=state.ctx;
  px(-10,0,7,4,'#5a3a1a');px(3,0,7,4,'#5a3a1a');
  px(-7,-4,5,6,'#6a4a2a');px(2,-4,5,6,'#6a4a2a');
  px(-11,-20,22,18,'#aa4400');px(-9,-22,18,4,'#cc5500');
  px(-13,-18,4,10,'#8a3300');px(9,-18,4,10,'#8a3300');
  px(-2,-14,4,4,'#dd6622');px(-1,-13,2,2,'#ffcc44');
  px(-9,-4,18,3,'#5a3a1a');
  px(-8,-36,16,14,'#cc6633');
  px(-6,-46,12,12,'#dd6622');px(-4,-50,8,6,'#ff8833');px(-2,-52,4,4,'#ffaa44');
  const ft=Math.sin(state.bt/150)*2;
  px(-5+ft,-50,3,3,'#ffcc44');px(3-ft,-48,3,3,'#ffaa44');px(0,-54+ft,2,3,'#ffdd66');
  px(-5,-32,3,3,'#111');px(2,-32,3,3,'#111');
  px(-4,-31,2,2,'#ff8833');px(3,-31,2,2,'#ff8833');
  px(-3,-26,6,2,'#993300');
  ctx.strokeStyle='#8a5a2a';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(13,-26);ctx.quadraticCurveTo(20,-16,13,-6);ctx.stroke();
  ctx.strokeStyle='#ddaa44';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(13,-26);ctx.lineTo(13,-6);ctx.stroke();
  px(12,-17,8,2,'#8a6a3a');px(19,-18,3,1,'#ffaa44');
  px(-13,-16,4,8,'#bb5522');px(9,-16,4,8,'#bb5522');
}

export function drawAsnPixel(h,stunned){
  const ctx=state.ctx;
  const envGlow=h.envenomed&&state.bt<h.envenomedEnd;
  px(-10,0,7,4,'#1a3344');px(3,0,7,4,'#1a3344');
  px(-7,-4,5,6,'#2a4455');px(2,-4,5,6,'#2a4455');
  px(-10,-20,20,18,'#2a5577');px(-8,-22,16,4,'#3a6688');
  px(-2,-14,4,4,'#3388cc');px(-1,-13,2,2,'#88ddff');
  px(-9,-4,18,3,'#2a3344');px(-8,-3,4,2,'#1a2a3a');px(4,-3,4,2,'#1a2a3a');
  px(-8,-36,16,14,'#c8dde8');
  px(-8,-44,16,10,'#4488aa');px(-6,-46,12,4,'#5599bb');
  px(-1,-44,2,3,'#88ddff');px(0,-46,1,2,'#aaeeff');
  px(-7,-26,14,5,'#2a4455');px(-6,-24,12,2,'#1a3344');
  px(-5,-33,3,2,'#fff');px(2,-33,3,2,'#fff');
  px(-4,-33,2,2,'#3388cc');px(3,-33,2,2,'#3388cc');
  px(-4,-33,1,1,'#88ddff');px(3,-33,1,1,'#88ddff');
  ctx.fillStyle=envGlow?'#66ccff':'#aabbcc';
  ctx.save();ctx.translate(13,-10);ctx.rotate(-.3);ctx.fillRect(-1,-12,2,12);ctx.fillStyle='#2a5577';ctx.fillRect(-2,-1,4,3);ctx.restore();
  ctx.fillStyle=envGlow?'#66ccff':'#aabbcc';
  ctx.save();ctx.translate(-13,-10);ctx.rotate(.3);ctx.fillRect(-1,-12,2,12);ctx.fillStyle='#2a5577';ctx.fillRect(-2,-1,4,3);ctx.restore();
  if(envGlow){px(13,-20,2,3,'#88ddff');px(-13,-20,2,3,'#88ddff')}
  px(-12,-16,3,8,'#2a5577');px(9,-16,3,8,'#2a5577');
}

export function drawBarPixel(h,stunned){
  const ctx=state.ctx;
  const rageGlow=1-h.hp/h.maxHp;const ultActive=h.ultActive;
  px(-11,0,8,5,'#2a1a1a');px(3,0,8,5,'#2a1a1a');
  px(-8,-5,6,7,'#3a2222');px(2,-5,6,7,'#3a2222');
  px(-13,-22,26,20,'#3a1a1a');px(-11,-24,22,4,'#4a2222');
  px(-15,-20,5,12,'#2a1010');px(10,-20,5,12,'#2a1010');
  px(-3,-16,6,5,'#8a7a6a');px(-2,-15,4,3,'#aaa');px(-2,-13,1,1,'#222');px(1,-13,1,1,'#222');px(-1,-11,2,1,'#444');
  px(-13,-22,1,20,'#8a2222');px(12,-22,1,20,'#8a2222');
  px(-11,-4,22,3,'#3a2222');px(-1,-3,2,2,'#8a7a6a');
  px(-9,-38,18,16,'#c8a888');
  px(-6,-32,2,6,'#8a2222');px(4,-32,2,6,'#8a2222');
  px(-3,-46,6,10,'#2a1010');px(-2,-48,4,4,'#3a1a1a');px(-1,-50,2,3,'#4a2222');
  const eyeCol=rageGlow>0.3?'#cc3333':'#aa6633';
  px(-5,-34,3,3,'#fff');px(2,-34,3,3,'#fff');
  px(-4,-33,2,2,eyeCol);px(3,-33,2,2,eyeCol);
  px(-3,-27,6,2,'#6a3a2a');px(-2,-26,4,1,'#fff');
  px(14,-52,3,48,'#5a4a2a');
  px(17,-50,10,6,'#4a4a4a');px(17,-48,12,4,'#5a5a5a');px(17,-46,10,6,'#4a4a4a');
  const axeCol=rageGlow>0.2?'#cc3333':'#888888';
  px(27,-49,2,8,axeCol);
  px(-15,-18,4,10,'#c8a888');px(11,-18,4,10,'#c8a888');
  if(rageGlow>0.3||ultActive){ctx.globalAlpha=(rageGlow*0.3);ctx.fillStyle='#cc2222';ctx.fillRect(-16,-50,32,55);ctx.globalAlpha=1;}
  if(ultActive){const t2=Math.sin(state.bt/100)*2;ctx.shadowColor='#ff2222';ctx.shadowBlur=12;px(-16+t2,-52,2,4,'#ff4444');px(14-t2,-52,2,4,'#ff4444');px(-14,-50+t2,2,3,'#ff6666');px(12,-50-t2,2,3,'#ff6666');ctx.shadowBlur=0;}
}

export function drawCustomPixel(h,stunned){
  const ctx=state.ctx;
  var sp=h.customSprite||'wizard';
  if(sp==='wizard')drawWizPixel(h,stunned);
  else if(sp==='ranger')drawRgrPixel(h,stunned);
  else if(sp==='barbarian')drawBarPixel(h,stunned);
  else drawAsnPixel(h,stunned);
  ctx.globalAlpha=0.15;ctx.fillStyle='#cc44cc';ctx.fillRect(-18,-55,36,58);ctx.globalAlpha=1;
}

export function drawFollower(fl,owner){
  const ctx=state.ctx;
  if(!fl.alive)return;
  const bob=Math.sin(fl.bobPhase)*2,hs=fl.hurtAnim>0?Math.sin(state.bt/20)*3*fl.hurtAnim:0;
  const fpx=fl.x+hs,fpy=fl.y+bob,f=en(owner).x>fl.x?1:-1;
  ctx.save();ctx.translate(Math.round(fpx),Math.round(fpy));if(f<0)ctx.scale(-1,1);
  ctx.fillStyle='rgba(0,0,0,0.15)';ctx.fillRect(-8,2,16,4);
  px(-7,-8,14,12,'#cc5500');px(-5,-12,10,6,'#dd6622');
  px(-4,-16,8,6,'#ff8833');px(-2,-18,4,3,'#ffaa44');
  px(-3,-14,2,2,'#fff');px(1,-14,2,2,'#fff');px(-2,-14,1,1,'#111');px(2,-14,1,1,'#111');
  px(-1,-20,2,3,'#ffcc44');px(0,-22,1,2,'#ffdd66');
  ctx.fillStyle='rgba(200,168,50,0.6)';ctx.font='bold 8px "Chakra Petch"';ctx.textAlign='center';ctx.fillText('GOAD',0,-25);
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
  var bodyDark=af.rarity==='legendary'?'#aa8800':af.rarity==='epic'?'#7733aa':af.rarity==='rare'?'#2266aa':af.rarity==='uncommon'?'#227722':'#666666';
  px(-6,-10,12,12,bodyDark);px(-5,-14,10,6,col);
  px(-4,-18,8,6,col);px(-3,-20,6,3,bodyDark);
  px(-2,-16,2,2,'#fff');px(2,-16,2,2,'#fff');px(-1,-16,1,1,'#000');px(3,-16,1,1,'#000');
  px(-8,-6,3,8,bodyDark);px(5,-6,3,8,bodyDark);
  px(-7,2,4,3,bodyDark);px(3,2,4,3,bodyDark);
  if(af.rarity==='epic'||af.rarity==='legendary'){ctx.shadowColor=col;ctx.shadowBlur=6;ctx.strokeStyle=col+'40';ctx.lineWidth=1;ctx.strokeRect(-8,-20,16,25);ctx.shadowBlur=0;}
  ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText(af.icon,0,-24);
  var hpP=Math.max(0,af.hp/af.maxHp);
  ctx.fillStyle='#1a1a1a';ctx.fillRect(-10,-32,20,4);
  ctx.fillStyle=hpP>0.3?col:'#cc3300';ctx.fillRect(-9,-31,Math.round(18*hpP),2);
  ctx.strokeStyle='#444';ctx.lineWidth=0.5;ctx.strokeRect(-10.5,-32.5,21,5);
  ctx.fillStyle=col;ctx.font='bold 7px "Chakra Petch"';ctx.fillText(af.name,0,-35);
  ctx.restore();
}

export function pxRect(x,y,w,h,c,bc){state.ctx.fillStyle=c;state.ctx.fillRect(x,y,w,h);if(bc){state.ctx.strokeStyle=bc;state.ctx.lineWidth=1;state.ctx.strokeRect(x+.5,y+.5,w-1,h-1)}}
