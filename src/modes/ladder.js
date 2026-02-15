// =============== LADDER SYSTEM ===============
import { state } from '../gameState.js';
import { TK } from '../constants.js';
import { CLASSES } from '../data/classes.js';
import { ITEMS, EQ_SLOTS, GEAR_RARITY_COLORS } from '../data/items.js';
import { ALL_SKILLS, ALL_ULTS } from '../data/skills.js';
import { FOLLOWER_TEMPLATES, RARITY_COLORS, rollFollower } from '../data/followers.js';
import { SFX } from '../sfx.js';
import { addLog } from '../combat/engine.js';
import { tick } from '../combat/engine.js';
import { mkHero, getCustomTotalStats, mkArenaFollower, applyFollowerBuff } from '../combat/hero.js';
import { buildHUD, updateUI, buildCustomTooltip, renderFollowerCards } from '../render/ui.js';
import { startBattle, showWin, resetBattle } from './arena.js';

var LADDER_SEQUENCE=['wizard','ranger','assassin','barbarian'];
var LADDER_NAMES=['Draven','Zara','Krix','Moku','Thane','Vex','Nira','Bolt','Crag','Syla','Fenn','Hex','Jolt','Pyra','Onyx','Dusk','Blaze','Storm','Frost','Ash','Rune','Shade','Grim','Talon','Echo','Ember','Flux','Nova','Spike','Wisp'];

export function buildLadderPicker(){
  var cont=document.getElementById('ldClassPick');cont.innerHTML='';
  // Show hero gear summary (always custom character)
  var cs=getCustomTotalStats();
  var gearHtml='';
  EQ_SLOTS.forEach(function(slot){
    var ik=state.customChar.equipment[slot.key];
    var item=ik?ITEMS[ik]:null;
    if(item){
      var col=GEAR_RARITY_COLORS[item.rarity]||'#aaa';
      gearHtml+='<span style="color:'+col+'" title="'+item.name+': '+item.desc+'">'+item.icon+'</span> ';
    }
  });
  cont.innerHTML='<div class="class-card cst selected" style="cursor:default">'+
    '<div class="cc-icon">\u2692</div>'+
    '<div class="cc-name cst">'+state.customChar.name+'</div>'+
    '<div class="cc-stats">'+Math.round(cs.hp)+'HP '+Math.round(cs.baseDmg)+'dmg '+cs.baseAS.toFixed(2)+'AS '+Math.round(cs.def)+'DEF</div>'+
    '<div style="font-size:.5rem;margin-top:2px">'+gearHtml+'</div>'+
    buildCustomTooltip()+
  '</div>';
  var rec=document.getElementById('ladderRecord');
  if(rec)rec.innerHTML='Best: <span style="color:var(--gold-bright)">'+state.ladderBest+'W</span>';
}

export function startLadder(){
  state.ladderRun={
    wins:0,active:true,
    currentOpponent:null,opponentIdx:0,
    history:[],_previewedNext:null,
    currentOppName:'',currentOppIcon:'',
    // Follower assignments for this ladder run
    fighterFollowers:[],
    stakedFollower:null,
  };
  ladderShowFollowerPick();
}

function ladderShowFollowerPick(){
  if(!state.ladderRun||!state.ladderRun.active)return;
  // Reset assignments for this fight
  state.ladderRun.fighterFollowers=[];
  state.ladderRun.stakedFollower=null;

  document.getElementById('ladderScreen').style.display='flex';
  document.getElementById('ladderPickScreen').style.display='none';
  document.getElementById('battleScreen').style.display='none';

  var rc=document.getElementById('ladderScreen');
  var existing=document.getElementById('ldInterContent');
  if(existing)existing.remove();

  var fightNum=state.ladderRun.wins+1;
  var nextIdx=state.ladderRun.opponentIdx;
  var oppPreview='';
  if(nextIdx<LADDER_SEQUENCE.length){
    var nk=LADDER_SEQUENCE[nextIdx];var nc=CLASSES[nk];
    oppPreview='<div class="ld-next-preview">'+
      '<div class="lnp-title">OPPONENT #'+fightNum+'</div>'+
      '<div class="lnp-name" style="color:'+nc.color+'">'+nc.icon+' '+nc.name+'</div>'+
      '<div class="lnp-stats">'+nc.hp+' HP | '+nc.baseDmg+' DMG | '+nc.baseAS+' AS | '+nc.def+' DEF</div>'+
    '</div>';
  } else {
    var nextOpp=generateLadderOpponent(state.ladderRun.wins);
    state.ladderRun._previewedNext=nextOpp;
    oppPreview='<div class="ld-next-preview">'+
      '<div class="lnp-title">CHALLENGER #'+(nextIdx-LADDER_SEQUENCE.length+1)+'</div>'+
      '<div class="lnp-name" style="color:#ff88ff">\u2692 '+nextOpp.name+'</div>'+
      '<div class="lnp-stats">'+nextOpp.hp+' HP | '+nextOpp.baseDmg+' DMG | '+nextOpp.baseAS+' AS | '+nextOpp.def+' DEF | '+Math.round(nextOpp.evasion*100)+'% EVA</div>'+
    '</div>';
  }

  var hasFollowers=state.p1Collection.length>0;
  var followerHtml='';
  if(hasFollowers){
    followerHtml='<div style="margin-top:8px">'+
      '<div style="font-size:.5rem;color:var(--teal-glow);margin-bottom:4px">\u{1F47E} Fighters <span id="ldFighterCount" style="color:var(--parch-dk)">(0/3)</span></div>'+
      '<div style="font-size:.42rem;color:var(--parch-dk);margin-bottom:4px">Click to assign fighters. They\'ll battle alongside you.</div>'+
      '<div class="follower-collection" id="ldFighters"></div>'+
      '<div style="font-size:.48rem;color:#ff6644;margin:6px 0 4px">\u{1F3B2} Wager <span style="color:var(--parch-dk)">(optional \u2014 lose it if you lose!)</span></div>'+
      '<div class="follower-collection" id="ldStake"></div>'+
    '</div>';
  }

  var screenHtml='<div class="ld-inter" id="ldInterContent">'+
    '<div class="ld-title" style="color:#44ee88">\u2694 PREPARE FOR BATTLE</div>'+
    oppPreview+followerHtml+
    '<div class="dg-choices" style="margin-top:10px">'+
      '<button class="dg-choice danger" onclick="ladderFight()">\u2694 FIGHT!</button>'+
      '<button class="dg-choice gold-c" onclick="ladderQuit()">\u{1F3C3} Forfeit</button>'+
    '</div>'+
  '</div>';

  rc.insertAdjacentHTML('beforeend',screenHtml);

  if(hasFollowers){
    updateLadderFollowerUI();
  }
}

function updateLadderFollowerUI(){
  var run=state.ladderRun;if(!run)return;
  // Fighter cards
  renderFollowerCards('ldFighters',state.p1Collection,function(f,i){
    if(i===run.stakedFollower)return;
    var fi=run.fighterFollowers.indexOf(i);
    if(fi>=0){run.fighterFollowers.splice(fi,1)}
    else{if(run.fighterFollowers.length>=3)return;run.fighterFollowers.push(i)}
    updateLadderFollowerUI();
  });
  var fEl=document.getElementById('ldFighters');
  if(fEl){
    fEl.querySelectorAll('.follower-card').forEach(function(card,i){
      if(run.fighterFollowers.indexOf(i)>=0)card.classList.add('selected');
      if(i===run.stakedFollower)card.style.opacity='0.4';
    });
  }
  var fcEl=document.getElementById('ldFighterCount');
  if(fcEl)fcEl.textContent='('+run.fighterFollowers.length+'/3)';
  // Wager cards (exclude fighters)
  var wagerList=state.p1Collection.filter(function(f,i){return run.fighterFollowers.indexOf(i)<0});
  renderFollowerCards('ldStake',wagerList,function(f){
    var realIdx=state.p1Collection.indexOf(f);
    if(run.stakedFollower===realIdx){run.stakedFollower=null}
    else{run.stakedFollower=realIdx}
    updateLadderFollowerUI();
  });
  var sEl=document.getElementById('ldStake');
  if(sEl){
    sEl.querySelectorAll('.follower-card').forEach(function(card,i){
      var realIdx=state.p1Collection.indexOf(wagerList[i]);
      if(realIdx===run.stakedFollower)card.classList.add('selected');
    });
  }
}

export function ladderFight(){
  if(!state.ladderRun||!state.ladderRun.active)return;
  var el=document.getElementById('ldInterContent');if(el)el.remove();
  if(state.ladderRun._previewedNext){
    state.ladderRun.currentOpponent={type:'generated',config:state.ladderRun._previewedNext};
    state.ladderRun._previewedNext=null;
    ladderLaunchBattle('_ladder_generated');
  } else {
    ladderNextFight();
  }
}

function ladderNextFight(){
  if(!state.ladderRun||!state.ladderRun.active)return;
  var idx=state.ladderRun.opponentIdx;
  if(idx<LADDER_SEQUENCE.length){
    var oppClass=LADDER_SEQUENCE[idx];
    state.ladderRun.currentOpponent={type:'class',classKey:oppClass};
    ladderLaunchBattle(oppClass);
  } else {
    var opp=generateLadderOpponent(state.ladderRun.wins);
    state.ladderRun.currentOpponent={type:'generated',config:opp};
    ladderLaunchBattle('_ladder_generated');
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

function ladderLaunchBattle(oppClass){
  state.p1Class='custom';
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
    // Handle staked follower loss
    var stakeMsg='';
    if(state.ladderRun.stakedFollower!==null){
      if(!playerWon){
        var lost=state.p1Collection.splice(state.ladderRun.stakedFollower,1)[0];
        if(lost){stakeMsg='\nLost '+lost.name+'!'}
      }
      state.ladderRun.stakedFollower=null;
    }
    state.ladderRun.fighterFollowers=[];
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
        state.p1Collection.push(earnedFollower);
      }
      ladderShowIntermission(true,earnedFollower,stakeMsg);
    } else {
      state.ladderBest=Math.max(state.ladderBest,state.ladderRun.wins);
      ladderShowIntermission(false,null,stakeMsg);
    }
  };

  startBattle();

  // Apply staked follower buff to player + debuff to opponent
  var run=state.ladderRun;
  if(run.stakedFollower!==null){
    applyFollowerBuff(state.h1,state.p1Collection,run.stakedFollower);
    var wTmpl=FOLLOWER_TEMPLATES.find(function(t){return t.name===state.p1Collection[run.stakedFollower].name});
    if(wTmpl&&wTmpl.wagerDebuff){
      wTmpl.wagerDebuff.apply(state.h2);
      addLog(0,'Wager: '+wTmpl.wagerDebuff.name+' ('+wTmpl.wagerDebuff.desc+') on '+state.h2.name,'poison');
    }
  }

  // Spawn fighter followers
  state.h1.arenaFollowers=[];
  run.fighterFollowers.forEach(function(idx,i){
    if(idx>=0&&idx<state.p1Collection.length){
      var tmpl=FOLLOWER_TEMPLATES.find(function(t){return t.name===state.p1Collection[idx].name})||state.p1Collection[idx];
      state.h1.arenaFollowers.push(mkArenaFollower(tmpl,state.h1,i,run.fighterFollowers.length));
    }
  });

  buildHUD(state.h1,'hudP1');
}

function ladderShowIntermission(won,earnedFollower,stakeMsg){
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

  var stakeHtml='';
  if(stakeMsg)stakeHtml='<div style="font-size:.5rem;color:#ff4444;margin:4px 0">'+stakeMsg+'</div>';

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

  var screenHtml='<div class="ld-inter" id="ldInterContent">'+
    '<div class="ld-title" style="color:'+titleColor+'">'+titleHtml+'</div>'+
    bracketHtml+statsHtml+stakeHtml+rewardHtml+
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
  // Show follower pick before each fight
  ladderShowFollowerPick();
}

export function ladderQuit(){
  var el=document.getElementById('ldInterContent');if(el)el.remove();
  state.ladderRun=null;state._ladderGenConfig=null;
  document.getElementById('ladderPickScreen').style.display='flex';
  buildLadderPicker();
}
