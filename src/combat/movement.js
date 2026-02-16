// =============== MOVEMENT AI ===============
import { state } from '../gameState.js';
import { AX, AW, GY, GY_MIN, GY_MAX, STRAFE_SPEED, MELEE } from '../constants.js';
import { en, dst, getMS, isStunned } from './engine.js';

export function moveAI(h,dt){
  if(isStunned(h))return;
  const e=en(h),d=dst(h,e),ms=getMS(h)*(dt/1000),dir=e.x>h.x?1:-1;h.facing=dir;
  const ef=e.follower;if(ef&&ef.alive&&ef.goading){const dF=dst(h,ef);if(dF<ef.goadRange&&dF>MELEE){h.x+=(ef.x>h.x?1:-1)*ms;h.state='moving';clampH(h);clampY(h);return}}
  if(h.type==='wizard'){
    if(d<h.preferredRange-30){h.x-=dir*ms;h.state='moving'}
    else if(d>h.spellRange-10){h.x+=dir*ms;h.state='moving'}
    else h.state='idle';
  } else if(h.type==='ranger'){
    if(d>h.preferredRange+20){h.x+=dir*ms;h.state='moving'}
    else if(d<h.preferredRange-40&&!h.ultActive){h.x-=dir*ms;h.state='moving'}
    else h.state='idle';
  } else if(h.type==='barbarian'){
    if(d>h.attackRange+5){h.x+=dir*ms;h.state='moving'}else h.state='idle';
  } else if(h.type==='custom'){
    if(d>h.preferredRange+20){h.x+=dir*ms;h.state='moving'}
    else if(d<h.preferredRange-30){h.x-=dir*ms;h.state='moving'}
    else h.state='idle';
  } else {
    if(h.stealthed){h.x+=dir*ms*1.3;h.state='moving'}
    else if(d>h.meleeRange+10){h.x+=dir*ms;h.state='moving'}
    else h.state='idle';
  }
  // Y-axis movement (depth strafing)
  moveY(h,e,ms,d);
  clampH(h);clampY(h);
}

function moveY(h,e,ms,d){
  var ey=e.y||GY,hy=h.y||GY;
  var yms=ms*STRAFE_SPEED;
  var isMelee=(h.type==='barbarian'||(h.type==='assassin'&&!h.stealthed)||(h.type==='custom'&&h.preferredRange<100));
  if(isMelee){
    // Melee: move toward enemy y to close gap
    var dy=ey-hy;
    if(Math.abs(dy)>8)h.y=(h.y||GY)+(dy>0?1:-1)*yms;
  } else {
    // Ranged: strafe to a random y target, refreshed periodically
    if(!h._strafeTarget||!h._strafeTimer||state.bt>h._strafeTimer){
      h._strafeTarget=GY_MIN+Math.random()*(GY_MAX-GY_MIN);
      h._strafeTimer=state.bt+1500+Math.random()*2000;
    }
    var dy2=h._strafeTarget-hy;
    if(Math.abs(dy2)>5)h.y=(h.y||GY)+(dy2>0?1:-1)*yms;
  }
}

export function clampH(h){h.x=Math.max(AX+25,Math.min(AX+AW-25,h.x))}
export function clampY(h){h.y=Math.max(GY_MIN,Math.min(GY_MAX,h.y||GY))}

export function moveFollower(fl,owner,target,dt){
  if(!fl||!fl.alive)return;
  var ms=fl.moveSpeed*(dt/1000),dx=target.x-fl.x,d=Math.abs(dx),dir=dx>0?1:-1;
  if(d>fl.attackRange)fl.x+=dir*ms;
  fl.x=Math.max(AX+15,Math.min(AX+AW-15,fl.x));
  // Y-axis: follow target y
  var dy=(target.y||GY)-(fl.y||GY);
  if(Math.abs(dy)>5)fl.y=(fl.y||GY)+(dy>0?1:-1)*ms*0.5;
  fl.y=Math.max(GY_MIN,Math.min(GY_MAX,fl.y||GY));
}
