// =============== MOVEMENT AI ===============
import { state } from '../gameState.js';
import { AX, AW, MELEE } from '../constants.js';
import { en, dst, getMS, isStunned } from './engine.js';

export function moveAI(h,dt){
  if(isStunned(h))return;
  const e=en(h),d=dst(h,e),ms=getMS(h)*(dt/1000),dir=e.x>h.x?1:-1;h.facing=dir;
  const ef=e.follower;if(ef&&ef.alive&&ef.goading){const dF=Math.abs(h.x-ef.x);if(dF<ef.goadRange&&dF>MELEE){h.x+=(ef.x>h.x?1:-1)*ms;h.state='moving';clampH(h);return}}
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
  clampH(h);
}

export function clampH(h){h.x=Math.max(AX+25,Math.min(AX+AW-25,h.x))}

export function moveFollower(fl,owner,target,dt){if(!fl||!fl.alive)return;const ms=fl.moveSpeed*(dt/1000),d=Math.abs(fl.x-target.x),dir=target.x>fl.x?1:-1;if(d>fl.attackRange)fl.x+=dir*ms;fl.x=Math.max(AX+15,Math.min(AX+AW-15,fl.x))}
