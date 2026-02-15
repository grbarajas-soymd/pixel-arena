// =============== VFX PARTICLES ===============
import { state } from '../gameState.js';
import { SFX } from '../sfx.js';

export function spSparks(x,y,n,col){for(let i=0;i<n;i++)state.particles.push({x,y,vx:(Math.random()-.5)*120,vy:-Math.random()*80-20,life:.5+Math.random()*.3,maxLife:.8,r:2+Math.random(),col})}
export function spDrips(x,y){for(let i=0;i<4;i++)state.particles.push({x:x+(Math.random()-.5)*20,y,vx:(Math.random()-.5)*15,vy:20+Math.random()*40,life:.8,maxLife:.8,r:2.5,col:'#cc3300',gravity:true})}
export function spFloat(x,y,t,c){state.floats.push({x,y,text:t,color:c,life:1.2,maxLife:1.2});if(t==='MISS')SFX.miss();else if(t==='CRIT!')SFX.crit()}
export function spLightning(x1,y1,x2,y2){SFX.lightning();const s=8,pts=[{x:x1,y:y1}];for(let i=1;i<s;i++){const t=i/s;pts.push({x:x1+(x2-x1)*t+(Math.random()-.5)*30,y:y1+(y2-y1)*t+(Math.random()-.5)*20})}pts.push({x:x2,y:y2});state.particles.push({type:'lightning',pts,life:.3,maxLife:.3,col:'#44ddbb',thick:false});state.particles.push({type:'lightning',pts:pts.map(p=>({x:p.x+(Math.random()-.5)*8,y:p.y+(Math.random()-.5)*6})),life:.25,maxLife:.25,col:'#88ffdd'})}
export function spLStrike(x){SFX.thunder();const AY=60,GY=60+370-30;const pts=[{x:x+(Math.random()-.5)*10,y:AY}];let cy=AY;while(cy<GY){cy+=30+Math.random()*20;pts.push({x:x+(Math.random()-.5)*25,y:Math.min(cy,GY)})}state.particles.push({type:'lightning',pts,life:.4,maxLife:.4,col:'#44ddbb',thick:true});state.particles.push({type:'flash',x,y:GY,life:.2,maxLife:.2,r:40,col:'#44ddbb'})}
export function spSmoke(x,y,n){for(let i=0;i<n;i++)state.particles.push({x:x+(Math.random()-.5)*60,y:y+(Math.random()-.5)*30,vx:(Math.random()-.5)*30,vy:-Math.random()*20-5,life:1+Math.random()*.5,maxLife:1.5,r:8+Math.random()*8,col:'rgba(60,80,100,0.5)',isSmoke:true})}
export function spShadow(x,y){SFX.stealth();for(let i=0;i<6;i++)state.particles.push({x:x+(Math.random()-.5)*20,y:y+(Math.random()-.5)*20,vx:(Math.random()-.5)*50,vy:(Math.random()-.5)*50,life:.4,maxLife:.4,r:3+Math.random()*3,col:'#3388cc'})}
export function spPoison(x,y,n){for(let i=0;i<n;i++)state.particles.push({x:x+(Math.random()-.5)*15,y,vx:(Math.random()-.5)*20,vy:-Math.random()*40-10,life:.6+Math.random()*.3,maxLife:.9,r:2+Math.random(),col:'#66ccff'})}
export function spFire(x,y,n){for(let i=0;i<n;i++)state.particles.push({x:x+(Math.random()-.5)*20,y:y+(Math.random()-.5)*10,vx:(Math.random()-.5)*40,vy:-Math.random()*60-20,life:.4+Math.random()*.3,maxLife:.7,r:2.5+Math.random()*2,col:Math.random()>.5?'#ffaa44':'#ff6622'})}
export function spStun(x,y){SFX.stun();for(let i=0;i<4;i++){const a=i*Math.PI/2;state.particles.push({type:'star',x:x+Math.cos(a)*12,y:y+Math.sin(a)*12,angle:a,cx:x,cy:y,life:.5,maxLife:.5,r:3,col:'#e8d060'})}}

export function updParticles(dt){
  for(let i=state.particles.length-1;i>=0;i--){const p=state.particles[i];p.life-=dt;if(p.life<=0){state.particles.splice(i,1);continue}
    if(p.type==='lightning'||p.type==='flash')continue;
    if(p.type==='star'){const a=p.angle+dt*8;p.angle=a;p.x=p.cx+Math.cos(a)*14;p.y=p.cy+Math.sin(a)*14;continue}
    if(p.isSmoke){p.x+=p.vx*dt;p.y+=p.vy*dt;p.r+=dt*3;continue}
    p.x+=(p.vx||0)*dt;p.y+=(p.vy||0)*dt;if(p.gravity)p.vy+=150*dt}
  for(let i=state.floats.length-1;i>=0;i--){const f=state.floats[i];f.life-=dt;f.y-=35*dt;if(f.life<=0)state.floats.splice(i,1)}
  for(let i=state.projectiles.length-1;i>=0;i--){const p=state.projectiles[i];const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.sqrt(dx*dx+dy*dy);if(d<15){p.onHit();state.projectiles.splice(i,1);continue}const s=p.speed*dt;p.x+=dx/d*s;p.y+=dy/d*s;p.time+=dt;if(p.time>2)state.projectiles.splice(i,1)}
}
