// =============== ARENA MODE ===============
import { state } from '../gameState.js';
import { TK } from '../constants.js';
import { CLASSES } from '../data/classes.js';
import { ALL_SKILLS, ALL_ULTS } from '../data/skills.js';
import { FOLLOWER_TEMPLATES, RARITY_COLORS } from '../data/followers.js';
import { SFX } from '../sfx.js';
import { nextBiome, randomBiome, getBiome } from '../biomes.js';
import { addLog } from '../combat/engine.js';
import { tick } from '../combat/engine.js';
import { mkHero, mkArenaFollower, applyFollowerBuff, getCustomTotalStats, applyStashToHero, renderStashSummary } from '../combat/hero.js';
import { buildHUD, updateUI, buildCharTooltip, buildCustomTooltip, renderFollowerCards, updateFollowerDisplays, updateStakeUI } from '../render/ui.js';
import { initGround } from '../render/arena.js';
import { openCustomEditor } from '../custom.js';

export function buildSelector(){
  for(const side of['p1','p2']){
    const cont=document.getElementById(side+'Cards');cont.innerHTML='';
    for(const key of['wizard','ranger','assassin','barbarian']){
      const c=CLASSES[key];const card=document.createElement('div');
      card.className=`class-card ${key==='wizard'?'wiz':key==='ranger'?'rgr':key==='assassin'?'asn':'bar'}`;
      if((side==='p1'&&state.p1Class===key)||(side==='p2'&&state.p2Class===key))card.classList.add('selected');
      card.innerHTML=`<div class="cc-icon">${c.icon}</div><div class="cc-name ${key==='wizard'?'wiz':key==='ranger'?'rgr':key==='assassin'?'asn':'bar'}">${c.name}</div><div class="cc-stats">${c.hp}HP ${c.baseDmg}dmg</div>`+buildCharTooltip(key);
      card.onclick=(()=>{const k=key;return()=>{if(side==='p1')state.p1Class=k;else state.p2Class=k;buildSelector()}})();
      cont.appendChild(card);
    }
    const cc=document.createElement('div');cc.className='class-card cst';
    if((side==='p1'&&state.p1Class==='custom')||(side==='p2'&&state.p2Class==='custom'))cc.classList.add('selected');
    const cs=getCustomTotalStats();
    const sn=state.customChar.skills.filter(s=>s!==null).map(i=>ALL_SKILLS[i]?ALL_SKILLS[i].name:'?').join(' + ')||'None';
    cc.innerHTML=`<div class="cc-icon">\u2692</div><div class="cc-name cst">${state.customChar.name}</div><div class="cc-stats">${Math.round(cs.hp)}HP ${Math.round(cs.baseDmg)}dmg</div>`+buildCustomTooltip();
    cc.onclick=(()=>{const s=side;return()=>{if(s==='p1')state.p1Class='custom';else state.p2Class='custom';openCustomEditor(s)}})();
    cont.appendChild(cc);
  }
}

export function launchBattle(){
  document.getElementById('selectorScreen').style.display='none';
  document.getElementById('battleScreen').style.display='block';
  startBattle();
}

export function backToSelect(){
  resetBattle();
  document.getElementById('battleScreen').style.display='none';
  document.getElementById('selectorScreen').style.display='flex';
}

export function startBattle(){
  if(state.intv)return;
  document.getElementById('btnGo').textContent='FIGHTING...';
  document.getElementById('btnGo').disabled=true;
  state.h1=mkHero(state.p1Class,'left');
  state.h2=mkHero(state.p2Class,'right');

  // Spawn arena followers for each player (up to 3)
  state.h1.arenaFollowers=[];state.h2.arenaFollowers=[];
  state.p1FighterFollowers.forEach(function(idx,i){
    if(idx>=0&&idx<state.p1Collection.length){
      var tmpl=FOLLOWER_TEMPLATES.find(t=>t.name===state.p1Collection[idx].name)||state.p1Collection[idx];
      state.h1.arenaFollowers.push(mkArenaFollower(tmpl,state.h1,i,state.p1FighterFollowers.length));
    }
  });
  state.p2FighterFollowers.forEach(function(idx,i){
    if(idx>=0&&idx<state.p2Collection.length){
      var tmpl=FOLLOWER_TEMPLATES.find(t=>t.name===state.p2Collection[idx].name)||state.p2Collection[idx];
      state.h2.arenaFollowers.push(mkArenaFollower(tmpl,state.h2,i,state.p2FighterFollowers.length));
    }
  });

  // Apply staked follower stat buffs to hero + debuffs to enemy
  if(state.p1StakedFollower!==null){
    applyFollowerBuff(state.h1,state.p1Collection,state.p1StakedFollower);
    var wTmpl=FOLLOWER_TEMPLATES.find(t=>t.name===state.p1Collection[state.p1StakedFollower].name);
    if(wTmpl&&wTmpl.wagerDebuff){wTmpl.wagerDebuff.apply(state.h2);addLog(0,'P1 wager: '+wTmpl.wagerDebuff.name+' ('+wTmpl.wagerDebuff.desc+') on '+state.h2.name,'poison')}
  }
  if(state.p2StakedFollower!==null){
    applyFollowerBuff(state.h2,state.p2Collection,state.p2StakedFollower);
    var wTmpl2=FOLLOWER_TEMPLATES.find(t=>t.name===state.p2Collection[state.p2StakedFollower].name);
    if(wTmpl2&&wTmpl2.wagerDebuff){wTmpl2.wagerDebuff.apply(state.h1);addLog(0,'P2 wager: '+wTmpl2.wagerDebuff.name+' ('+wTmpl2.wagerDebuff.desc+') on '+state.h1.name,'poison')}
  }

  state.bt=0;state.over=false;state.logs.length=0;state.particles=[];state.projectiles=[];state.floats=[];state.groundTiles=null;
  randomBiome();SFX.battleStart();
  document.getElementById('winBanner').className='win-banner';
  buildHUD(state.h1,'hudP1');buildHUD(state.h2,'hudP2');
  var n1=state.p1Class==='custom'?state.customChar.name:CLASSES[state.p1Class].name;
  var n2=state.p2Class==='custom'?state.customChar.name:CLASSES[state.p2Class].name;
  var msg=n1+' vs '+n2+' \u2014 FIGHT!';
  var biomeMsg=' ['+getBiome().name+']';
  if(state.h1.arenaFollowers.length)msg+=' [P1: '+state.h1.arenaFollowers.length+' followers]';
  if(state.h2.arenaFollowers.length)msg+=' [P2: '+state.h2.arenaFollowers.length+' followers]';
  addLog(0,msg+biomeMsg,'spell');updateUI();
  state.intv=setInterval(function(){for(var i=0;i<state.spd;i++)if(!state.over)tick()},TK);
}

export function resetBattle(){
  if(state.intv){clearInterval(state.intv);state.intv=null}
  state.bt=0;state.over=false;state.logs.length=0;state.particles=[];state.projectiles=[];state.floats=[];
  document.getElementById('winBanner').className='win-banner';
  document.getElementById('btnGo').textContent='FIGHT!';
  document.getElementById('btnGo').disabled=false;
  document.getElementById('log').innerHTML='<div style="color:var(--parch-dk)">Awaiting battle...</div>';
}

export function showWin(w){
  setTimeout(function(){SFX.win()},300);
  var b=document.getElementById('winBanner');
  var stakeMsg='';
  var winnerIsP1=(w===state.h1);
  // Handle wager transfers
  if(state.p1StakedFollower!==null&&state.p2StakedFollower!==null){
    if(winnerIsP1){
      var won=state.p2Collection.splice(state.p2StakedFollower,1)[0];
      if(won){state.p1Collection.push(won);stakeMsg='\nP1 wins '+won.name+'!'}
    } else {
      var won=state.p1Collection.splice(state.p1StakedFollower,1)[0];
      if(won){state.p2Collection.push(won);stakeMsg='\nP2 wins '+won.name+'!'}
    }
  } else if(state.p1StakedFollower!==null||state.p2StakedFollower!==null){
    if(winnerIsP1&&state.p2StakedFollower!==null){
      var won=state.p2Collection.splice(state.p2StakedFollower,1)[0];
      if(won){state.p1Collection.push(won);stakeMsg='\nP1 wins '+won.name+'!'}
    } else if(!winnerIsP1&&state.p1StakedFollower!==null){
      var won=state.p1Collection.splice(state.p1StakedFollower,1)[0];
      if(won){state.p2Collection.push(won);stakeMsg='\nP2 wins '+won.name+'!'}
    }
  }
  state.p1StakedFollower=null;state.p2StakedFollower=null;
  state.p1FighterFollowers=[];state.p2FighterFollowers=[];

  b.textContent=w.name+' WINS!'+stakeMsg;b.style.color=w.color;b.style.borderColor=w.color;
  b.style.background='linear-gradient(180deg,rgba(60,45,30,0.95),rgba(40,30,20,0.95))';
  b.className='win-banner show';document.getElementById('btnGo').disabled=true;updateUI();
}

export function setSpd(s,b){
  state.spd=s;
  document.querySelectorAll('.btn-spd').forEach(x=>{if(x.id!=='btnSound')x.classList.remove('on')});
  b.classList.add('on');
}

export function toggleSound(b){
  var on=SFX.toggle();
  b.textContent=on?'\u{1F50A}':'\u{1F507}';
  b.classList.toggle('on',on);
  if(on)SFX.uiClick();
}

export function cycleBiome(){
  nextBiome();state.groundTiles=null;state.ambientParticles=[];SFX.uiClick();
}

export function switchMode(mode){
  document.getElementById('selectorScreen').style.display=mode==='arena'?'flex':'none';
  document.getElementById('dungeonScreen').style.display=mode==='dungeon'?'flex':'none';
  document.getElementById('ladderScreen').style.display=mode==='ladder'?'flex':'none';
  document.getElementById('battleScreen').style.display='none';
  document.getElementById('tabArena').classList.toggle('active',mode==='arena');
  document.getElementById('tabDungeon').classList.toggle('active',mode==='dungeon');
  document.getElementById('tabLadder').classList.toggle('active',mode==='ladder');
  if(mode==='dungeon'){
    // Lazy import to avoid circular
    import('../modes/dungeon.js').then(m=>m.buildDungeonPicker());
    updateFollowerDisplays();
  }
  if(mode==='arena'){buildSelector();updateStakeUI()}
  if(mode==='ladder'){
    import('../modes/ladder.js').then(m=>m.buildLadderPicker());
  }
}

export function setDungeonPlayer(p){
  state.dungeonPlayer=p;
  document.getElementById('dgP1Tab').classList.toggle('active',p===1);
  document.getElementById('dgP2Tab').classList.toggle('active',p===2);
}
