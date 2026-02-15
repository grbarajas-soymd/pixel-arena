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
import { mkHero, mkArenaFollower, applyFollowerBuff, getCustomTotalStats, serializeBuild } from '../combat/hero.js';
import { buildHUD, updateUI, buildCharTooltip, buildCustomTooltip, buildDefeatSheet, renderFollowerCards, updateFollowerDisplays, updateStakeUI } from '../render/ui.js';
import { initGround } from '../render/arena.js';
import { openCustomEditor } from '../custom.js';
import * as network from '../network.js';
import { saveGame } from '../persistence.js';

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
  // Online controls (register / upload)
  var ctrl=document.getElementById('onlineControls');
  if(ctrl){
    if(!state.playerId){
      ctrl.innerHTML='<div style="font-size:.48rem;color:var(--parch-dk);margin-bottom:4px">Join the arena to fight other players!</div>'+
        '<input id="regNameInput" class="cs-name-input" placeholder="Your display name" maxlength="20" style="width:140px;display:inline-block;margin-right:4px">'+
        '<button class="btn btn-spd" onclick="registerPlayer()" style="font-size:.42rem">Join Arena</button>';
    } else {
      ctrl.innerHTML='<div style="font-size:.48rem;color:#44ee88;margin-bottom:4px">Playing as: <b>'+state.playerName+'</b></div>'+
        '<button class="btn btn-spd" onclick="uploadBuild()" style="font-size:.42rem">Upload Build</button>';
    }
  }
  // Right side: online opponents
  buildOnlineOpponents();
}

function buildOnlineOpponents(){
  var cont=document.getElementById('opponentCards');
  if(!cont)return;
  cont.innerHTML='';
  var statusEl=document.getElementById('onlineStatus');
  if(!state.onlineOpponents||state.onlineOpponents.length===0){
    if(statusEl)statusEl.textContent=state.playerId?'No opponents yet. Upload your build and invite a friend!':'Register to see online opponents.';
    return;
  }
  if(statusEl)statusEl.textContent=state.onlineOpponents.length+' opponent'+(state.onlineOpponents.length>1?'s':'')+' available';
  state.onlineOpponents.forEach(function(opp){
    var card=document.createElement('div');
    var sel=state.selectedOpponent===opp.playerId;
    card.className='class-card cst'+(sel?' selected':'');
    card.style.cursor='pointer';
    var ch=opp.character;
    var rec=opp.record||{wins:0,losses:0};
    var skillNames=[];
    if(ch.skills){
      ch.skills.forEach(function(si){
        if(si!==null&&ALL_SKILLS[si])skillNames.push(ALL_SKILLS[si].name);
      });
    }
    card.innerHTML='<div class="cc-icon">\u2692</div>'+
      '<div class="cc-name cst">'+opp.playerName+'</div>'+
      '<div style="font-size:.45rem;color:var(--parch-dk)">'+ch.name+'</div>'+
      '<div class="cc-stats">'+Math.round(ch.stats.hp)+'HP '+Math.round(ch.stats.baseDmg)+'dmg '+ch.stats.baseAS.toFixed(2)+'AS</div>'+
      '<div style="font-size:.42rem;color:var(--parch-dk)">DEF:'+Math.round(ch.stats.def)+' EVA:'+Math.round(ch.stats.evasion*100)+'% '+ch.rangeType+'</div>'+
      (skillNames.length?'<div style="font-size:.42rem;color:#88aacc">'+skillNames.join(', ')+'</div>':'')+
      '<div style="font-size:.45rem;margin-top:2px"><span style="color:#44ee88">W:'+rec.wins+'</span> <span style="color:#ff4444">L:'+rec.losses+'</span></div>';
    card.onclick=function(){selectOpponent(opp.playerId)};
    cont.appendChild(card);
  });
}

export function registerPlayer(){
  var input=document.getElementById('regNameInput');
  var name=input?input.value.trim():'';
  if(!name){alert('Enter a display name!');return}
  network.register(name).then(function(res){
    if(res.playerId){
      state.playerId=res.playerId;
      state.playerName=name;
      saveGame();
      buildSelector();
      refreshOpponents();
    }
  }).catch(function(){
    var statusEl=document.getElementById('onlineStatus');
    if(statusEl)statusEl.textContent='Server offline. Start server with: npm run server';
  });
}

export function uploadBuild(){
  if(!state.playerId)return;
  var build=serializeBuild();
  network.uploadBuild(state.playerId,build).then(function(res){
    if(res.ok){
      var statusEl=document.getElementById('onlineStatus');
      if(statusEl)statusEl.textContent='Build uploaded!';
      saveGame();
      setTimeout(refreshOpponents,500);
    }
  }).catch(function(){
    var statusEl=document.getElementById('onlineStatus');
    if(statusEl)statusEl.textContent='Upload failed. Is the server running?';
  });
}

export function refreshOpponents(){
  if(!state.playerId){
    var statusEl=document.getElementById('onlineStatus');
    if(statusEl)statusEl.textContent='Register first to see opponents.';
    return;
  }
  network.fetchOpponents(state.playerId).then(function(list){
    state.onlineOpponents=list;
    buildOnlineOpponents();
  }).catch(function(){
    var statusEl=document.getElementById('onlineStatus');
    if(statusEl)statusEl.textContent='Server offline. Start server with: npm run server';
  });
}

function selectOpponent(playerId){
  if(state.selectedOpponent===playerId){
    state.selectedOpponent=null;
  } else {
    state.selectedOpponent=playerId;
  }
  buildOnlineOpponents();
}

export function launchBattle(){
  if(state.p1StakedFollower===null&&state.p1Collection.length>0){
    alert('You must wager a follower!');return;
  }
  if(state.selectedOpponent){
    // Online battle — fetch opponent build and launch
    var opp=state.onlineOpponents.find(function(o){return o.playerId===state.selectedOpponent});
    if(!opp){alert('Select an opponent!');return}
    var ch=opp.character;
    state._ladderGenConfig={
      name:ch.name,sprite:ch.sprite,
      hp:ch.stats.hp,baseDmg:ch.stats.baseDmg,baseAS:ch.stats.baseAS,
      def:ch.stats.def,evasion:ch.stats.evasion,moveSpeed:ch.stats.moveSpeed,
      skills:ch.skills,ultimate:ch.ultimate,
      rangeType:ch.rangeType,equip:ch.equipment,
    };
    state.p2Class='custom';
    document.getElementById('selectorScreen').style.display='none';
    document.getElementById('battleScreen').style.display='block';
    startBattle();
  } else {
    alert('Select an opponent!');
  }
}

export function backToSelect(){
  resetBattle();
  state._ladderGenConfig=null;
  state.selectedOpponent=null;
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

  // No fighter followers in arena — only wager buff/debuff
  state.h1.arenaFollowers=[];state.h2.arenaFollowers=[];

  // Apply staked follower stat buffs to hero + debuffs to enemy
  if(state.p1StakedFollower!==null){
    applyFollowerBuff(state.h1,state.p1Collection,state.p1StakedFollower);
    var wTmpl=FOLLOWER_TEMPLATES.find(function(t){return t.name===state.p1Collection[state.p1StakedFollower].name});
    if(wTmpl&&wTmpl.wagerDebuff){wTmpl.wagerDebuff.apply(state.h2);addLog(0,'Wager: '+wTmpl.wagerDebuff.name+' ('+wTmpl.wagerDebuff.desc+') on '+state.h2.name,'poison')}
  }

  state.bt=0;state.over=false;state.logs.length=0;state.particles=[];state.projectiles=[];state.floats=[];state.groundTiles=null;
  randomBiome();SFX.battleStart();
  document.getElementById('winBanner').className='win-banner';
  document.getElementById('winBanner').innerHTML='';
  buildHUD(state.h1,'hudP1');buildHUD(state.h2,'hudP2');
  var n1=state.customChar.name;
  var n2=state._ladderGenConfig?state._ladderGenConfig.name:(CLASSES[state.p2Class]?CLASSES[state.p2Class].name:'Opponent');
  var msg=n1+' vs '+n2+' \u2014 FIGHT!';
  var biomeMsg=' ['+getBiome().name+']';
  addLog(0,msg+biomeMsg,'spell');updateUI();
  state.intv=setInterval(function(){for(var i=0;i<state.spd;i++)if(!state.over)tick()},TK);
}

export function resetBattle(){
  if(state.intv){clearInterval(state.intv);state.intv=null}
  state.bt=0;state.over=false;state.logs.length=0;state.particles=[];state.projectiles=[];state.floats=[];
  document.getElementById('winBanner').className='win-banner';
  document.getElementById('winBanner').innerHTML='';
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

  var bannerHtml='<div>'+w.name+' WINS!'+stakeMsg+'</div>';

  // Show defeat sheet on loss
  if(!winnerIsP1&&state.h2){
    var defeatData={name:state.h2.name,icon:'\u2692',stats:{hp:state.h2.maxHp,baseDmg:state.h2.baseDmg,baseAS:state.h2.baseAS,def:state.h2.def,evasion:state.h2.evasion},skills:[],type:state.selectedOpponent?'online':'class'};
    // Collect skill names
    if(state.h2.customSkillIds&&state.h2.customSkillIds.length){
      state.h2.customSkillIds.forEach(function(s){if(ALL_SKILLS[s.idx])defeatData.skills.push(ALL_SKILLS[s.idx].name)});
    }
    if(state.h2.customUltId!==null&&ALL_ULTS[state.h2.customUltId])defeatData.skills.push(ALL_ULTS[state.h2.customUltId].name+' (Ult)');
    bannerHtml+=buildDefeatSheet(defeatData);
  }

  b.innerHTML=bannerHtml;b.style.color=w.color;b.style.borderColor=w.color;
  b.style.background='linear-gradient(180deg,rgba(60,45,30,0.95),rgba(40,30,20,0.95))';
  b.className='win-banner show';document.getElementById('btnGo').disabled=true;updateUI();

  // Report online battle result
  if(state.selectedOpponent&&state.playerId){
    network.reportBattle(state.playerId,state.selectedOpponent,winnerIsP1).then(function(){
      refreshOpponents();
    }).catch(function(){});
  }

  // Clear online state and save
  state._ladderGenConfig=null;
  state.selectedOpponent=null;
  saveGame();
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
  if(mode==='arena'){buildSelector();updateStakeUI();refreshOpponents()}
  if(mode==='ladder'){
    import('../modes/ladder.js').then(function(m){m.buildLadderPicker()});
  }
}
