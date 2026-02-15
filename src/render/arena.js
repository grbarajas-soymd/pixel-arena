import { state } from '../gameState.js';
import { CW, CH, AX, AY, AW, AH, GY, TK } from '../constants.js';
import { getBiome } from '../biomes.js';
import { dst } from '../combat/engine.js';
import { drawHero, drawFollower, drawArenaFollower } from './sprites.js';

export function initGround(){
  state.groundTiles=[];
  var b=getBiome();
  for(let gx=AX;gx<AX+AW;gx+=40){
    for(let gy=GY-10;gy<GY+60;gy+=20){
      const r=Math.random();
      var cols=b.groundBase;
      var col=cols[Math.floor(r*cols.length)];
      var hasG=b.hasGrass&&r>0.55&&r<0.85;
      var gc=b.grassCol?b.grassCol[Math.floor(Math.random()*b.grassCol.length)]:null;
      state.groundTiles.push({x:gx,y:gy,w:40+Math.random()*4,h:20+Math.random()*2,col:col,hasGrass:hasG,grassCol:gc});
    }
  }
  state.ambientParticles=[];
}

function spawnAmbient(b){
  if(!b.ambient||state.ambientParticles.length>30)return;
  if(Math.random()>0.08)return;
  var x=AX+Math.random()*AW,y=AY+Math.random()*(GY-AY+40);
  if(b.ambient==='ember')state.ambientParticles.push({x:x,y:GY+Math.random()*20,vx:(Math.random()-.5)*8,vy:-Math.random()*15-5,life:2+Math.random()*2,maxLife:4,r:1.5+Math.random(),col:Math.random()>.5?'#ff6622':'#ffaa44',type:'float'});
  else if(b.ambient==='snowflake')state.ambientParticles.push({x:x,y:AY-10,vx:(Math.random()-.5)*10,vy:Math.random()*12+5,life:4+Math.random()*3,maxLife:7,r:1+Math.random(),col:'#aaccee',type:'float'});
  else if(b.ambient==='wisp')state.ambientParticles.push({x:x,y:y,vx:Math.sin(Math.random()*6.28)*6,vy:Math.cos(Math.random()*6.28)*4,life:3+Math.random()*3,maxLife:6,r:2+Math.random()*2,col:Math.random()>.5?'#8866cc':'#aa88ee',type:'wisp',phase:Math.random()*6.28});
  else if(b.ambient==='firefly')state.ambientParticles.push({x:x,y:y,vx:(Math.random()-.5)*5,vy:(Math.random()-.5)*3,life:4+Math.random()*3,maxLife:7,r:1.5,col:'#88ff44',type:'wisp',phase:Math.random()*6.28});
  else if(b.ambient==='ash')state.ambientParticles.push({x:x,y:AY-10,vx:(Math.random()-.5)*8,vy:Math.random()*8+3,life:3+Math.random()*2,maxLife:5,r:1+Math.random()*0.5,col:'#666',type:'float'});
}

function updAmbient(dt){
  for(var i=state.ambientParticles.length-1;i>=0;i--){
    var p=state.ambientParticles[i];p.life-=dt;
    if(p.life<=0){state.ambientParticles.splice(i,1);continue}
    p.x+=p.vx*dt;p.y+=p.vy*dt;
    if(p.type==='wisp'){p.phase+=dt*2;p.vx=Math.sin(p.phase)*6;p.vy=Math.cos(p.phase*0.7)*4}
  }
}

export function render(){
  const ctx=state.ctx;
  if(!ctx)return;
  if(state._dgCombatActive){requestAnimationFrame(render);return}
  ctx.clearRect(0,0,CW,CH);
  var b=getBiome();
  const skyG=ctx.createLinearGradient(0,0,0,CH);
  skyG.addColorStop(0,b.skyTop);skyG.addColorStop(.5,b.skyMid);skyG.addColorStop(1,b.skyBot);
  ctx.fillStyle=skyG;ctx.fillRect(0,0,CW,CH);
  if(b.fogCol){ctx.fillStyle=b.fogCol;for(var fi=0;fi<3;fi++){var fy=AY+fi*120+Math.sin(state.bt/2000+fi)*20;ctx.globalAlpha=0.3+Math.sin(state.bt/3000+fi*2)*0.1;ctx.fillRect(AX,fy,AW,80);ctx.globalAlpha=1}}
  ctx.fillStyle='rgba(0,0,0,0.015)';
  for(let y=0;y<CH;y+=2)ctx.fillRect(0,y,CW,1);
  if(!state.groundTiles)initGround();
  for(const t of state.groundTiles){
    ctx.fillStyle=t.col;ctx.fillRect(t.x,t.y,t.w,t.h);
    if(t.hasGrass&&t.grassCol){ctx.fillStyle=t.grassCol;for(let i=0;i<3;i++){const gx=t.x+5+Math.random()*(t.w-10);ctx.fillRect(gx,t.y-2,2,4);ctx.fillRect(gx+2,t.y-3,2,3)}}
  }
  ctx.fillStyle=b.groundEdge;ctx.fillRect(AX,GY-2,AW,3);
  if(b.decor==='lava'){for(let i=0;i<6;i++){var lx=AX+80+i*140,ly=GY+15+Math.sin(i*1.7)*8;var pulse=Math.sin(state.bt/500+i*1.3)*0.3+0.7;ctx.fillStyle='rgba(200,60,0,'+pulse*0.15+')';ctx.fillRect(lx-10,ly,20,8);ctx.fillStyle='#cc3300';ctx.fillRect(lx-6,ly+2,12,4);ctx.fillStyle='#ff6622';ctx.fillRect(lx-3,ly+3,6,2)}}
  else if(b.decor==='ice'){for(let i=0;i<8;i++){var ix=AX+50+i*115,iy=GY+8+Math.sin(i*2.3)*6;ctx.fillStyle='#2a3a4a';ctx.fillRect(ix,iy,8,12);ctx.fillStyle='#4a6a8a';ctx.fillRect(ix+1,iy+1,6,4);ctx.fillStyle='rgba(100,180,220,0.15)';ctx.fillRect(ix-2,iy-3,12,3)}}
  else if(b.decor==='void'){for(let i=0;i<5;i++){var vx=AX+100+i*170,vy=GY+10;var vPulse=Math.sin(state.bt/800+i*2)*0.4+0.6;ctx.fillStyle='rgba(120,40,200,'+vPulse*0.1+')';ctx.beginPath();ctx.arc(vx,vy,15+vPulse*5,0,6.28);ctx.fill();ctx.fillStyle='rgba(160,80,255,'+vPulse*0.15+')';ctx.beginPath();ctx.arc(vx,vy,6,0,6.28);ctx.fill()}}
  else if(b.decor==='roots'){for(let i=0;i<6;i++){var rx=AX+70+i*130,ry=GY-5;ctx.fillStyle='#1a2a1a';ctx.fillRect(rx,ry,4,15);ctx.fillRect(rx-3,ry+4,3,8);ctx.fillRect(rx+3,ry+6,4,6);ctx.fillStyle='#2a3a2a';ctx.fillRect(rx+1,ry+1,2,12)}}
  else if(b.decor==='bone'){for(let i=0;i<7;i++){var bx=AX+60+i*120,by=GY+10+Math.sin(i*2.7)*5;ctx.fillStyle='#4a3a2a';ctx.fillRect(bx,by,10,3);ctx.fillRect(bx+2,by-2,2,7);ctx.fillStyle='#5a4a3a';ctx.fillRect(bx+1,by+1,8,1)}}
  else{for(let i=0;i<8;i++){const sx=AX+60+i*110,sy=GY+10+Math.sin(i*2.1)*8;ctx.fillStyle=b.stoneCol;ctx.fillRect(sx,sy,12,6);ctx.fillStyle=b.stoneLt;ctx.fillRect(sx+2,sy+1,8,4)}}
  spawnAmbient(b);updAmbient(TK/1000);
  for(var ap of state.ambientParticles){var aa=Math.min(1,ap.life/ap.maxLife);if(ap.type==='wisp'){aa*=(0.4+Math.sin(ap.phase)*0.3);ctx.shadowColor=ap.col;ctx.shadowBlur=6}ctx.globalAlpha=aa*0.6;ctx.fillStyle=ap.col;ctx.fillRect(ap.x-ap.r/2,ap.y-ap.r/2,ap.r,ap.r);ctx.shadowBlur=0;ctx.globalAlpha=1;}
  if(state.bt<3000){var bAlpha=state.bt<1000?state.bt/1000:Math.max(0,(3000-state.bt)/2000);ctx.globalAlpha=bAlpha*0.4;ctx.fillStyle='#000';ctx.font='bold 10px "Chakra Petch"';ctx.textAlign='center';ctx.fillText(b.name,CW/2+1,AY-12+1);ctx.fillStyle=b.fogCol?'#ccbbaa':'#8a8a8a';ctx.fillText(b.name,CW/2,AY-12);ctx.globalAlpha=1;}
  const {h1,h2}=state;
  if(h1&&h2)for(const h of[h1,h2]){if(h.smokeBombActive){const a=Math.min(1,(h.smokeBombEnd-state.bt)/1000);ctx.globalAlpha=a*0.2;ctx.fillStyle='#4a5a6a';ctx.beginPath();ctx.ellipse(h.smokeBombX,GY-20,h.smokeBombRadius,50,0,0,6.28);ctx.fill();ctx.globalAlpha=1}}
  if(h1&&h2)for(const h of[h1,h2])if(h.follower&&h.follower.alive)drawFollower(h.follower,h);
  if(h1&&h2)for(const h of[h1,h2]){if(!h.arenaFollowers)continue;for(var afi=0;afi<h.arenaFollowers.length;afi++){var af=h.arenaFollowers[afi];if(!af.alive)continue;drawArenaFollower(af)}}
  if(h1)drawHero(h1);if(h2)drawHero(h2);
  for(const p of state.projectiles){ctx.save();const dx=p.tx-p.x,dy=p.ty-p.y,ang=Math.atan2(dy,dx);ctx.translate(p.x,p.y);ctx.rotate(ang);ctx.shadowColor=p.color;ctx.shadowBlur=8;if(p.type==='bolt'){ctx.fillStyle=p.color;ctx.fillRect(-8,-2,16,4);ctx.fillStyle='#fff';ctx.fillRect(4,-1,4,2)}else if(p.type==='dagger'){ctx.fillStyle='#aabbcc';ctx.fillRect(-6,-1.5,12,3);ctx.fillStyle=p.color;ctx.fillRect(3,-1,3,2)}else{ctx.fillStyle=p.color;ctx.fillRect(-12,-1.5,24,3);ctx.fillStyle='#fff';ctx.fillRect(8,-1,4,2)}ctx.shadowBlur=0;ctx.restore()}
  for(const p of state.particles){const a=p.life/p.maxLife;if(p.type==='lightning'){ctx.strokeStyle=p.col;ctx.globalAlpha=a;ctx.lineWidth=p.thick?3:1.5;ctx.shadowColor=p.col;ctx.shadowBlur=p.thick?12:6;ctx.beginPath();for(let j=0;j<p.pts.length;j++)j===0?ctx.moveTo(p.pts[j].x,p.pts[j].y):ctx.lineTo(p.pts[j].x,p.pts[j].y);ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1}else if(p.type==='flash'){ctx.globalAlpha=a*.5;ctx.fillStyle=p.col;ctx.shadowColor=p.col;ctx.shadowBlur=15;ctx.fillRect(p.x-p.r,p.y-p.r*.5,p.r*2,p.r);ctx.shadowBlur=0;ctx.globalAlpha=1}else if(p.type==='star'){ctx.globalAlpha=a;ctx.fillStyle=p.col;ctx.fillRect(p.x-2,p.y-2,4,4);ctx.fillStyle='#fff';ctx.fillRect(p.x-1,p.y-1,2,2);ctx.globalAlpha=1}else if(p.isSmoke){ctx.globalAlpha=a*.3;ctx.fillStyle=p.col;ctx.fillRect(p.x-p.r/2,p.y-p.r/2,p.r,p.r);ctx.globalAlpha=1}else{ctx.globalAlpha=a;ctx.fillStyle=p.col;const sz=Math.max(1,p.r*a*2);ctx.fillRect(p.x-sz/2,p.y-sz/2,sz,sz);ctx.globalAlpha=1}}
  for(const f of state.floats){ctx.globalAlpha=f.life/f.maxLife;ctx.fillStyle='#000';ctx.font='bold 13px "Chakra Petch"';ctx.textAlign='center';ctx.fillText(f.text,f.x+1,f.y+1);ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);ctx.globalAlpha=1;}
  if(h1&&h2){ctx.fillStyle='rgba(90,70,40,0.6)';ctx.font='bold 9px "Chakra Petch"';ctx.textAlign='center';ctx.fillText(Math.round(dst(h1,h2))+'u',CW/2,AY-5)}
  requestAnimationFrame(render);
}
