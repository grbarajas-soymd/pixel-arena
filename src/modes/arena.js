// =============== ARENA MODE ===============
import { state } from '../gameState.js';
import { TK } from '../constants.js';
import { CLASSES } from '../data/classes.js';
import { ITEMS, EQ_SLOTS, GEAR_RARITY_COLORS } from '../data/items.js';
import { ALL_SKILLS, ALL_ULTS } from '../data/skills.js';
import { FOLLOWER_TEMPLATES, RARITY_COLORS } from '../data/followers.js';
import { SFX } from '../sfx.js';
import { nextBiome, randomBiome, getBiome } from '../biomes.js';
import { addLog } from '../combat/engine.js';
import { tick } from '../combat/engine.js';
import { mkHero, mkArenaFollower, applyFollowerBuff, getCustomTotalStats } from '../combat/hero.js';
import { buildHUD, updateUI, buildCharTooltip, buildCustomTooltip, renderFollowerCards, updateFollowerDisplays, updateStakeUI } from '../render/ui.js';
import { initGround } from '../render/arena.js';
import { openCustomEditor } from '../custom.js';

function buildGearSummary(){
  var cs=getCustomTotalStats();
  var gearHtml='';
  EQ_SLOTS.forEach(function(slot){
    var ik=state.customChar.equipment[slot.key];
    var item=ik?ITEMS[ik]:null;
    if(item){
      var col=GEAR_RARITY_COLORS[item.rarity]||'#aaa';
      gearHtml+='<span style="color:'+col+'" title="'+item.name+': '+item.desc+'">'+item.icon+'</span>';
    }
  });
  return '<div class="cc-icon">\u2692</div>'+
    '<div class="cc-name cst">'+state.customChar.name+'</div>'+
    '<div class="cc-stats">'+Math.round(cs.hp)+'HP '+Math.round(cs.baseDmg)+'dmg '+cs.baseAS.toFixed(2)+'AS</div>'+
    '<div style="font-size:.5rem;margin-top:2px">'+gearHtml+'</div>'+
    '<div style="font-size:.42rem;color:var(--parch-dk);margin-top:2px">Click to edit gear</div>'+
    buildCustomTooltip();
}

export function buildSelector(){
  // Left side: hero card
  var heroArea=document.getElementById('heroCard');
  if(heroArea){
    heroArea.innerHTML='';
    var card=document.createElement('div');
    card.className='class-card cst selected';
    card.innerHTML=buildGearSummary();
    card.onclick=function(){openCustomEditor('p1')};
    heroArea.appendChild(card);
  }
  // Right side: opponent cards
  var cont=document.getElementById('opponentCards');
  if(cont){
    cont.innerHTML='';
    for(var ki=0;ki<4;ki++){
      var key=['wizard','ranger','assassin','barbarian'][ki];
      var c=CLASSES[key];var card2=document.createElement('div');
      card2.className='class-card '+(key==='wizard'?'wiz':key==='ranger'?'rgr':key==='assassin'?'asn':'bar');
      if(state.p2Class===key)card2.classList.add('selected');
      card2.innerHTML='<div class="cc-icon">'+c.icon+'</div><div class="cc-name '+(key==='wizard'?'wiz':key==='ranger'?'rgr':key==='assassin'?'asn':'bar')+'">'+c.name+'</div><div class="cc-stats">'+c.hp+'HP '+c.baseDmg+'dmg</div>'+buildCharTooltip(key);
      card2.onclick=(function(k){return function(){state.p2Class=k;buildSelector()}})(key);
      cont.appendChild(card2);
    }
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
  state.p1Class='custom';
  state.h1=mkHero(state.p1Class,'left');
  state.h2=mkHero(state.p2Class,'right');

  // Spawn arena followers for player (up to 3)
  state.h1.arenaFollowers=[];state.h2.arenaFollowers=[];
  state.p1FighterFollowers.forEach(function(idx,i){
    if(idx>=0&&idx<state.p1Collection.length){
      var tmpl=FOLLOWER_TEMPLATES.find(function(t){return t.name===state.p1Collection[idx].name})||state.p1Collection[idx];
      state.h1.arenaFollowers.push(mkArenaFollower(tmpl,state.h1,i,state.p1FighterFollowers.length));
    }
  });

  // Apply staked follower stat buffs to hero + debuffs to enemy
  if(state.p1StakedFollower!==null){
    applyFollowerBuff(state.h1,state.p1Collection,state.p1StakedFollower);
    var wTmpl=FOLLOWER_TEMPLATES.find(function(t){return t.name===state.p1Collection[state.p1StakedFollower].name});
    if(wTmpl&&wTmpl.wagerDebuff){wTmpl.wagerDebuff.apply(state.h2);addLog(0,'Wager: '+wTmpl.wagerDebuff.name+' ('+wTmpl.wagerDebuff.desc+') on '+state.h2.name,'poison')}
  }

  state.bt=0;state.over=false;state.logs.length=0;state.particles=[];state.projectiles=[];state.floats=[];state.groundTiles=null;
  randomBiome();SFX.battleStart();
  document.getElementById('winBanner').className='win-banner';
  buildHUD(state.h1,'hudP1');buildHUD(state.h2,'hudP2');
  var n1=state.customChar.name;
  var n2=CLASSES[state.p2Class]?CLASSES[state.p2Class].name:'Opponent';
  var msg=n1+' vs '+n2+' \u2014 FIGHT!';
  var biomeMsg=' ['+getBiome().name+']';
  if(state.h1.arenaFollowers.length)msg+=' ['+state.h1.arenaFollowers.length+' followers]';
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
  // Handle wager: player loses staked follower if they lose
  if(state.p1StakedFollower!==null){
    if(!winnerIsP1){
      var lost=state.p1Collection.splice(state.p1StakedFollower,1)[0];
      if(lost){stakeMsg='\nLost '+lost.name+'!'}
    }
  }
  state.p1StakedFollower=null;
  state.p1FighterFollowers=[];

  b.textContent=w.name+' WINS!'+stakeMsg;b.style.color=w.color;b.style.borderColor=w.color;
  b.style.background='linear-gradient(180deg,rgba(60,45,30,0.95),rgba(40,30,20,0.95))';
  b.className='win-banner show';document.getElementById('btnGo').disabled=true;updateUI();
}

export function setSpd(s,b){
  state.spd=s;
  document.querySelectorAll('.btn-spd').forEach(function(x){if(x.id!=='btnSound')x.classList.remove('on')});
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
    import('../modes/dungeon.js').then(function(m){m.buildDungeonPicker()});
    updateFollowerDisplays();
  }
  if(mode==='arena'){buildSelector();updateStakeUI()}
  if(mode==='ladder'){
    import('../modes/ladder.js').then(function(m){m.buildLadderPicker()});
  }
}
