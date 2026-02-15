// =============== LADDER SYSTEM ===============
import { state } from '../gameState.js';
import { TK } from '../constants.js';
import { CLASSES } from '../data/classes.js';
import { ITEMS } from '../data/items.js';
import { ALL_SKILLS, ALL_ULTS } from '../data/skills.js';
import { RARITY_COLORS, rollFollower } from '../data/followers.js';
import { SFX } from '../sfx.js';
import { addLog } from '../combat/engine.js';
import { tick } from '../combat/engine.js';
import { mkHero, getCustomTotalStats, applyStashToHero, renderStashSummary } from '../combat/hero.js';
import { buildHUD, updateUI, buildCharTooltip, buildCustomTooltip } from '../render/ui.js';
import { startBattle, showWin, resetBattle } from './arena.js';

var LADDER_SEQUENCE=['wizard','ranger','assassin','barbarian'];
var LADDER_NAMES=['Draven','Zara','Krix','Moku','Thane','Vex','Nira','Bolt','Crag','Syla','Fenn','Hex','Jolt','Pyra','Onyx','Dusk','Blaze','Storm','Frost','Ash','Rune','Shade','Grim','Talon','Echo','Ember','Flux','Nova','Spike','Wisp'];

export function setLadderPlayer(p){
  state.ladderPlayer=p;
  document.getElementById('ldP1Tab').classList.toggle('active',p===1);
  document.getElementById('ldP2Tab').classList.toggle('active',p===2);
  buildLadderPicker();
}

export function buildLadderPicker(){
  var cont=document.getElementById('ldClassPick');cont.innerHTML='';
  var classes=['wizard','ranger','assassin','barbarian'];
  classes.forEach(function(key){
    var c=CLASSES[key];var card=document.createElement('div');
    card.className='class-card '+(key==='wizard'?'wiz':key==='ranger'?'rgr':key==='assassin'?'asn':'bar')+(state.ladderClass===key?' selected':'');
    card.innerHTML='<div class="cc-icon">'+c.icon+'</div><div class="cc-name '+(key==='wizard'?'wiz':key==='ranger'?'rgr':key==='assassin'?'asn':'bar')+'">'+c.name+'</div><div class="cc-stats">'+c.hp+'HP '+c.baseDmg+'dmg</div>'+buildCharTooltip(key);
    card.onclick=function(){state.ladderClass=key;buildLadderPicker()};
    cont.appendChild(card);
  });
  var cs=getCustomTotalStats();
  var cc=document.createElement('div');cc.className='class-card cst'+(state.ladderClass==='custom'?' selected':'');
  cc.innerHTML='<div class="cc-icon">\u2692</div><div class="cc-name cst">'+state.customChar.name+'</div><div class="cc-stats">'+Math.round(cs.hp)+'HP '+Math.round(cs.baseDmg)+'dmg</div>'+buildCustomTooltip();
  cc.onclick=function(){state.ladderClass='custom';buildLadderPicker()};
  cont.appendChild(cc);
  var rec=document.getElementById('ladderRecord');
  if(rec)rec.innerHTML='P1 Best: <span style="color:var(--gold-bright)">'+state.ladderBestP1+'W</span> | P2 Best: <span style="color:var(--gold-bright)">'+state.ladderBestP2+'W</span>'+
    '<br><div style="margin-top:4px;font-size:.48rem">\u{1F392} P'+(state.ladderPlayer)+' Dungeon Items: '+renderStashSummary(state.ladderPlayer)+'</div>';
}

export function startLadder(){
  state.ladderRun={
    wins:0,playerClass:state.ladderClass,active:true,
    currentOpponent:null,opponentIdx:0,
    history:[],_previewedNext:null,
    currentOppName:'',currentOppIcon:'',
  };
  ladderNextFight();
}

function ladderNextFight(){
  if(!state.ladderRun||!state.ladderRun.active)return;
  var idx=state.ladderRun.opponentIdx;
  if(idx<LADDER_SEQUENCE.length){
    var oppClass=LADDER_SEQUENCE[idx];
    if(oppClass===state.ladderRun.playerClass&&idx<LADDER_SEQUENCE.length-1){state.ladderRun.opponentIdx++;ladderNextFight();return}
    state.ladderRun.currentOpponent={type:'class',classKey:oppClass};
    ladderLaunchBattle(state.ladderRun.playerClass,oppClass);
  } else {
    var opp=generateLadderOpponent(state.ladderRun.wins);
    state.ladderRun.currentOpponent={type:'generated',config:opp};
    ladderLaunchBattle(state.ladderRun.playerClass,'_ladder_generated');
  }
}

function generateLadderOpponent(wins){
  var tier=Math.max(0,Math.min(wins-3,25));
  var baseHp=3500+tier*180;var baseDmg=100+tier*8;
  var baseAS=0.75+Math.min(tier*0.03,0.6);var baseDef=25+tier*3;
  var baseEva=Math.min(0.015*tier,0.2);var baseSpd=95+tier*2;
  var itemKeys=Object.keys(ITEMS);
  var slots=['weapon','helmet','chest','boots','accessory'];
  var equip={};
  slots.forEach(function(slot){
    var pool=itemKeys.filter(function(k){return ITEMS[k].slot===slot});
    if(pool.length>0)equip[slot]=pool[Math.floor(Math.random()*pool.length)];
  });
  for(var sk in equip){
    var item=ITEMS[equip[sk]];if(!item)continue;
    for(var k in item.stats){
      if(k==='hp')baseHp+=item.stats[k];
      else if(k==='baseDmg')baseDmg+=item.stats[k];
      else if(k==='baseAS')baseAS+=item.stats[k];
      else if(k==='def')baseDef+=item.stats[k];
      else if(k==='evasion')baseEva=Math.min(0.8,baseEva+item.stats[k]);
      else if(k==='moveSpeed')baseSpd+=item.stats[k];
    }
  }
  var sk1=Math.floor(Math.random()*ALL_SKILLS.length);
  var sk2=Math.floor(Math.random()*ALL_SKILLS.length);
  while(sk2===sk1)sk2=Math.floor(Math.random()*ALL_SKILLS.length);
  var ult=Math.floor(Math.random()*ALL_ULTS.length);
  var sprites=['wizard','ranger','assassin','barbarian'];
  var sprite=sprites[Math.floor(Math.random()*sprites.length)];
  var name=LADDER_NAMES[Math.floor(Math.random()*LADDER_NAMES.length)];
  var titles=[' the Bold',' the Cruel',' the Swift',' the Wise',' the Fierce',' the Dark',' the Radiant',' the Cursed','','',''];
  name+=titles[Math.floor(Math.random()*titles.length)];
  return{
    name:name,sprite:sprite,hp:Math.round(baseHp),baseDmg:Math.round(baseDmg),
    baseAS:parseFloat(baseAS.toFixed(2)),def:Math.round(baseDef),evasion:parseFloat(baseEva.toFixed(2)),
    moveSpeed:Math.round(baseSpd),skills:[sk1,sk2],ultimate:ult,equip:equip,
    rangeType:sprite==='assassin'||sprite==='barbarian'?'melee':'ranged',
  };
}

function ladderLaunchBattle(playerClass, oppClass){
  state.p1Class=playerClass;
  if(oppClass==='_ladder_generated'){
    state._ladderGenConfig=state.ladderRun.currentOpponent.config;
    state.p2Class='custom';
  } else {
    state._ladderGenConfig=null;
    state.p2Class=oppClass;
  }
  var oppName,oppIcon;
  if(oppClass==='_ladder_generated'){
    oppName=state.ladderRun.currentOpponent.config.name;oppIcon='\u2692';
  } else {
    oppName=CLASSES[oppClass].name;oppIcon=CLASSES[oppClass].icon;
  }
  state.ladderRun.currentOppName=oppName;
  state.ladderRun.currentOppIcon=oppIcon;

  document.getElementById('ladderScreen').style.display='none';
  document.getElementById('ladderPickScreen').style.display='none';
  document.getElementById('battleScreen').style.display='block';

  // Intercept showWin for ladder results
  var _prevShowWin=state._showWinFn||showWin;
  state._showWinFn=function(w){
    var playerWon=(w===state.h1);
    state._showWinFn=_prevShowWin;state._ladderGenConfig=null;
    state.ladderRun.history.push({
      name:state.ladderRun.currentOppName,icon:state.ladderRun.currentOppIcon,
      won:playerWon,
      playerHpLeft:playerWon?Math.round(state.h1.hp):0,
      playerMaxHp:state.h1.maxHp,
      oppHpLeft:playerWon?0:Math.round(state.h2.hp),
    });
    if(playerWon){
      state.ladderRun.wins++;state.ladderRun.opponentIdx++;
      var earnedFollower=null;
      if(state.ladderRun.wins%3===0){
        var flr=Math.min(8,Math.ceil(state.ladderRun.wins/2));
        earnedFollower=rollFollower(flr);
        var attempts=0;
        while((earnedFollower.rarity==='common'||earnedFollower.rarity==='uncommon')&&attempts<10){
          earnedFollower=rollFollower(flr);attempts++;
        }
        (state.ladderPlayer===1?state.p1Collection:state.p2Collection).push(earnedFollower);
      }
      ladderShowIntermission(true,earnedFollower);
    } else {
      if(state.ladderPlayer===1)state.ladderBestP1=Math.max(state.ladderBestP1,state.ladderRun.wins);
      else state.ladderBestP2=Math.max(state.ladderBestP2,state.ladderRun.wins);
      ladderShowIntermission(false,null);
    }
  };

  startBattle();
  applyStashToHero(state.h1,state.ladderPlayer);
  buildHUD(state.h1,'hudP1');
}

function ladderShowIntermission(won,earnedFollower){
  if(state.intv){clearInterval(state.intv);state.intv=null}
  document.getElementById('battleScreen').style.display='none';
  document.getElementById('ladderScreen').style.display='flex';
  document.getElementById('ladderPickScreen').style.display='none';

  var rc=document.getElementById('ladderScreen');
  var bracketHtml='<div class="ld-bracket">';
  state.ladderRun.history.forEach(function(h){
    var cls='ld-opp '+(h.won?'won':'lost');
    bracketHtml+='<div class="'+cls+'"><span class="opp-icon">'+h.icon+'</span> '+h.name+(h.won?' \u2713':' \u2717')+'</div>';
  });
  if(won){
    var nextIdx=state.ladderRun.opponentIdx;
    if(nextIdx<LADDER_SEQUENCE.length){
      var nk=LADDER_SEQUENCE[nextIdx];
      bracketHtml+='<div class="ld-opp current"><span class="opp-icon">'+CLASSES[nk].icon+'</span> '+CLASSES[nk].name+' ?</div>';
      for(var u=nextIdx+1;u<LADDER_SEQUENCE.length;u++){
        bracketHtml+='<div class="ld-opp upcoming"><span class="opp-icon">'+CLASSES[LADDER_SEQUENCE[u]].icon+'</span> '+CLASSES[LADDER_SEQUENCE[u]].name+'</div>';
      }
    } else {
      bracketHtml+='<div class="ld-opp current"><span class="opp-icon">\u2692</span> Challenger #'+(nextIdx-LADDER_SEQUENCE.length+1)+' ?</div>';
    }
  }
  bracketHtml+='</div>';

  var lastFight=state.ladderRun.history[state.ladderRun.history.length-1];
  var statsHtml='';
  if(lastFight){
    var hpPct=lastFight.won?Math.round(lastFight.playerHpLeft/lastFight.playerMaxHp*100):0;
    var hpCol=hpPct>30?'#44ee88':'#ff4444';
    statsHtml='<div style="margin:6px 0">'+
      '<span class="dg-im-stat" style="color:'+(lastFight.won?'#44ee88':'#ff4444')+'">'+(lastFight.won?'WON':'LOST')+' vs '+lastFight.name+'</span>'+
      (lastFight.won?'<span class="dg-im-stat" style="color:'+hpCol+'">HP left: '+lastFight.playerHpLeft+' ('+hpPct+'%)</span>':'')+
    '</div>';
  }

  var previewHtml='';
  if(won){
    var nextIdx2=state.ladderRun.opponentIdx;
    if(nextIdx2<LADDER_SEQUENCE.length){
      var nk2=LADDER_SEQUENCE[nextIdx2];var nc=CLASSES[nk2];
      previewHtml='<div class="ld-next-preview">'+
        '<div class="lnp-title">NEXT OPPONENT</div>'+
        '<div class="lnp-name" style="color:'+nc.color+'">'+nc.icon+' '+nc.name+'</div>'+
        '<div class="lnp-stats">'+nc.hp+' HP | '+nc.baseDmg+' DMG | '+nc.baseAS+' AS | '+nc.def+' DEF</div>'+
      '</div>';
    } else {
      var nextOpp=generateLadderOpponent(state.ladderRun.wins);
      state.ladderRun._previewedNext=nextOpp;
      previewHtml='<div class="ld-next-preview">'+
        '<div class="lnp-title">NEXT CHALLENGER</div>'+
        '<div class="lnp-name" style="color:#ff88ff">\u2692 '+nextOpp.name+'</div>'+
        '<div class="lnp-stats">'+nextOpp.hp+' HP | '+nextOpp.baseDmg+' DMG | '+nextOpp.baseAS+' AS | '+nextOpp.def+' DEF | '+Math.round(nextOpp.evasion*100)+'% EVA</div>'+
      '</div>';
    }
  }

  var rewardHtml='';
  if(earnedFollower){
    rewardHtml='<div class="ld-reward">\u{1F381} Earned: <b style="color:'+RARITY_COLORS[earnedFollower.rarity]+'">'+earnedFollower.icon+' '+earnedFollower.name+'</b> ('+earnedFollower.rarity+')</div>';
  } else if(won){
    var untilNext=3-(state.ladderRun.wins%3);
    rewardHtml='<div style="font-size:.48rem;color:var(--parch-dk);margin:4px 0">Next follower in '+untilNext+' win'+(untilNext>1?'s':'')+'</div>';
  }

  var titleHtml,titleColor;
  if(won){titleHtml='\u{1F3C6} ROUND '+state.ladderRun.wins+' COMPLETE!';titleColor='#44ee88';}
  else{titleHtml='\u{1F480} LADDER OVER \u2014 '+state.ladderRun.wins+' WIN'+(state.ladderRun.wins!==1?'S':'');titleColor='#ff4444';}

  var stashHtml='<div style="font-size:.48rem;color:var(--parch-dk);margin:4px 0">\u{1F392} Items: '+renderStashSummary(state.ladderPlayer)+'</div>';

  var screenHtml='<div class="ld-inter" id="ldInterContent">'+
    '<div class="ld-title" style="color:'+titleColor+'">'+titleHtml+'</div>'+
    bracketHtml+statsHtml+stashHtml+rewardHtml+previewHtml+
    '<div class="dg-choices" style="margin-top:10px">';
  if(won){
    screenHtml+='<button class="dg-choice danger" onclick="ladderContinue()">\u2694 FIGHT NEXT</button>';
    screenHtml+='<button class="dg-choice gold-c" onclick="ladderQuit()">\u{1F3C3} End Run (keep followers)</button>';
  } else {
    screenHtml+='<button class="dg-choice gold-c" onclick="ladderQuit()">\u2190 Back to Ladder</button>';
  }
  screenHtml+='</div></div>';
  var existing=document.getElementById('ldInterContent');
  if(existing)existing.remove();
  rc.insertAdjacentHTML('beforeend',screenHtml);
}

export function ladderContinue(){
  var el=document.getElementById('ldInterContent');if(el)el.remove();
  if(state.ladderRun._previewedNext){
    state.ladderRun.currentOpponent={type:'generated',config:state.ladderRun._previewedNext};
    state.ladderRun._previewedNext=null;
    ladderLaunchBattle(state.ladderRun.playerClass,'_ladder_generated');
  } else {
    ladderNextFight();
  }
}

export function ladderQuit(){
  var el=document.getElementById('ldInterContent');if(el)el.remove();
  state.ladderRun=null;state._ladderGenConfig=null;
  document.getElementById('ladderPickScreen').style.display='flex';
  buildLadderPicker();
}
