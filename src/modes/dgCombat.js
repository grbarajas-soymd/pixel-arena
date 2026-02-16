// =============== DUNGEON TURN-BASED COMBAT ===============
// Replaces the real-time combat bridge with a turn-based state machine.
// Phases: pick -> playerAnim -> monsterAnim -> pick

import { state } from '../gameState.js';
import { CW, CH, AX, AY, AW, AH, GY, TK } from '../constants.js';
import { ALL_SKILLS, ALL_ULTS } from '../data/skills.js';
import { SFX } from '../sfx.js';
import { mkDungeonHero, mkDungeonMonster } from '../combat/hero.js';
import { drawHero } from '../render/sprites.js';
import { buildHUD, updateUI } from '../render/ui.js';
import { randomBiome, getBiome } from '../biomes.js';
import { dgCombatVictory, dgDeath, generateRoom } from './dungeon.js';
import { initGround } from '../render/arena.js';

// ===== COMBAT LOG HELPER =====
function combatLog(txt,typ){
  if(!state.logs)state.logs=[];
  state.logs.push({t:String(turnNum),txt:txt,typ:typ||''});
}

// ===== LOCAL COMBAT STATE =====
var phase='pick';
var turnNum=0;
var animTimer=0;
var animDuration=600;
var animAction=null;
var animSource=null;
var animTarget=null;
var rafId=null;
var lastTime=0;
var floats=[];
var ambientParticles=[];
var turnText='';
var turnTextTimer=0;
var dmgDealt=0;
var dmgTaken=0;
var ultUsed=false;
var playerStatuses=[];
var monsterStatuses=[];
var poisonStacks=0;
var poisonTurnsLeft=0;
var playerDmgBuff=0;
var playerDmgBuffRounds=0;
var playerInvulnRounds=0;
var playerExtraAttacks=0;
var deathMarkDmg=0;
var deathMarkActive=false;
var deathMarkRounds=0;
var bloodlustActive=false;
var animAction_skillIdx=null;
var animAction_skill=null;
var animAction_ultIdx=null;
var animAction_ult=null;
var fleeResult=false;
var autoBattle=false;
var SKILL_DMG={0:260,1:140,9:200};

// ===== AP TIMELINE SYSTEM =====
var combatants=[];       // [{id:'hero'|'monster'|'companion', ap:0, speed:number, alive:true}]
var timelinePreview=[];  // Next 8 upcoming turn IDs for display
var currentActor=null;   // Who is currently acting
var monsterRoundCount=0; // Track rounds by monster turns (for round-based durations)
var playerStunnedByMonster=false; // If hero is stunned, skip their turn

// Monster specials state
var monsterSpecials=[];    // [{id:'heavyStrike', cd:0, maxCd:4}]
var monsterChargingSpecial=null; // {id:'heavyStrike', telegraph:'winds up a heavy blow!'}
var DG_SPECIALS={
  heavyStrike:{cd:4,telegraph:'winds up a heavy blow!',icon:'\u2694\uFE0F'},
  enrage:{cd:5,telegraph:'roars with fury!',icon:'\uD83D\uDCA2'},
  poisonSpit:{cd:4,telegraph:'gathers venom!',icon:'\u2620'},
  heal:{cd:5,telegraph:'begins to regenerate!',icon:'\u{1F49A}'},
  warStomp:{cd:5,telegraph:'stomps the ground!',icon:'\uD83D\uDCA5'}
};
var monsterEnraged=false;
var monsterEnragedRounds=0;

// Companion state
var heroPoisonTurns=0; // Monster poison on hero (separate from hero poison on monster)

var companionHp=0,companionMaxHp=0,companionAlive=false;
var companionAbilityCd=0,companionAbilityMaxCd=3;
var companionData=null,companionDmg=0,companionDef=0,companionAS=0,companionName='',companionIcon='';

// ===== DAMAGE FORMULAS =====
function calcDmg(attacker,defender){
  var raw=attacker.baseDmg*(1-Math.min(defender.def/300,0.8));
  raw*=(0.85+Math.random()*0.3);
  if(attacker===state.h1&&playerDmgBuff>0)raw*=(1+playerDmgBuff);
  if(Math.random()<(defender.evasion||0))return{amount:0,evaded:true,crit:false};
  var crit=false;
  if(attacker._stashCrit&&Math.random()<attacker._stashCrit){raw*=1.75;crit=true;}
  return{amount:Math.round(raw),evaded:false,crit:crit};
}

function calcSkillDmg(attacker,defender,baseDmg){
  var raw=baseDmg*(1+(attacker.spellDmgBonus||0));
  raw*=(1-Math.min(defender.def/300,0.8));
  raw*=(0.9+Math.random()*0.2);
  if(attacker===state.h1&&playerDmgBuff>0)raw*=(1+playerDmgBuff);
  if(Math.random()<(defender.evasion||0))return{amount:0,evaded:true,crit:false};
  var crit=false;
  if(attacker._stashCrit&&Math.random()<attacker._stashCrit){raw*=1.75;crit=true;}
  return{amount:Math.round(raw),evaded:false,crit:crit};
}

function addFloat(x,y,text,color){
  floats.push({x:x,y:y,text:String(text),color:color,life:1.4,maxLife:1.4});
}

function showTurnText(text){turnText=text;turnTextTimer=2.0;}

// ===== AMBIENT PARTICLES =====
function spawnAmbient(b){
  if(!b.ambient||ambientParticles.length>30)return;
  if(Math.random()>0.08)return;
  var x=AX+Math.random()*AW,y=AY+Math.random()*(GY-AY+40);
  if(b.ambient==='ember')ambientParticles.push({x:x,y:GY+Math.random()*20,vx:(Math.random()-.5)*8,vy:-Math.random()*15-5,life:2+Math.random()*2,maxLife:4,r:1.5+Math.random(),col:Math.random()>.5?'#ff6622':'#ffaa44',type:'float'});
  else if(b.ambient==='snowflake')ambientParticles.push({x:x,y:AY-10,vx:(Math.random()-.5)*10,vy:Math.random()*12+5,life:4+Math.random()*3,maxLife:7,r:1+Math.random(),col:'#aaccee',type:'float'});
  else if(b.ambient==='wisp')ambientParticles.push({x:x,y:y,vx:Math.sin(Math.random()*6.28)*6,vy:Math.cos(Math.random()*6.28)*4,life:3+Math.random()*3,maxLife:6,r:2+Math.random()*2,col:Math.random()>.5?'#8866cc':'#aa88ee',type:'wisp',phase:Math.random()*6.28});
  else if(b.ambient==='firefly')ambientParticles.push({x:x,y:y,vx:(Math.random()-.5)*5,vy:(Math.random()-.5)*3,life:4+Math.random()*3,maxLife:7,r:1.5,col:'#88ff44',type:'wisp',phase:Math.random()*6.28});
  else if(b.ambient==='ash')ambientParticles.push({x:x,y:AY-10,vx:(Math.random()-.5)*8,vy:Math.random()*8+3,life:3+Math.random()*2,maxLife:5,r:1+Math.random()*0.5,col:'#666',type:'float'});
}

function updAmbient(dt){
  for(var i=ambientParticles.length-1;i>=0;i--){
    var p=ambientParticles[i];p.life-=dt;
    if(p.life<=0){ambientParticles.splice(i,1);continue;}
    p.x+=p.vx*dt;p.y+=p.vy*dt;
    if(p.type==='wisp'){p.phase+=dt*2;p.vx=Math.sin(p.phase)*6;p.vy=Math.cos(p.phase*0.7)*4;}
  }
}

// ===== INIT =====
export function initDgCombat(monster){
  var run=state.dgRun;
  var hero=mkDungeonHero(run,'left');
  var monsterHero=mkDungeonMonster(monster,'right');
  state.h1=hero;state.h2=monsterHero;
  state.bt=0;state.over=false;
  state.particles=[];state.projectiles=[];state.floats=[];
  state.groundTiles=null;
  randomBiome();
  state._dgCombatMonster=monster;
  state._dgCombatActive=true;
  state.logs=[];
  combatLog('Battle begins: '+hero.name+' vs '+monsterHero.name,'');
  phase='pick';turnNum=1;animTimer=0;autoBattle=false;
  animAction=null;animSource=null;animTarget=null;
  floats=[];ambientParticles=[];
  turnText='';turnTextTimer=0;
  dmgDealt=0;dmgTaken=0;ultUsed=false;
  playerStatuses=[];monsterStatuses=[];
  poisonStacks=0;poisonTurnsLeft=0;
  playerDmgBuff=0;playerDmgBuffRounds=0;
  playerInvulnRounds=0;playerExtraAttacks=0;
  deathMarkDmg=0;deathMarkActive=false;deathMarkRounds=0;
  bloodlustActive=false;fleeResult=false;
  animAction_skillIdx=null;animAction_skill=null;
  animAction_ultIdx=null;animAction_ult=null;
  playerStunnedByMonster=false;heroPoisonTurns=0;
  monsterChargingSpecial=null;monsterEnraged=false;monsterEnragedRounds=0;
  hero._origX=hero.x;
  monsterHero._origX=monsterHero.x;
  // AP timeline init
  var heroSpeed=Math.min(200,Math.max(60,Math.round((run.baseAS+run.bonusAS)*100)));
  var monsterSpeed=Math.min(200,Math.max(60,Math.round((0.8+(monster.tier-1)*0.15)*100)));
  combatants=[
    {id:'hero',ap:0,speed:heroSpeed,alive:true},
    {id:'monster',ap:0,speed:monsterSpeed,alive:true}
  ];
  // Companion init
  companionAlive=false;companionData=null;companionHp=0;companionMaxHp=0;
  companionDmg=0;companionDef=0;companionAS=0;companionName='';companionIcon='';
  companionAbilityCd=0;companionAbilityMaxCd=3;
  if(run.deployedFollower){
    var df=run.deployedFollower;
    companionData=df;companionName=df.name;companionIcon=df.icon||'\uD83D\uDC3E';
    companionMaxHp=df.combatHp||200;companionHp=companionMaxHp;
    companionDmg=df.combatDmg||20;companionDef=df.combatDef||5;
    companionAS=df.combatAS||0.8;companionAlive=true;
    var compSpeed=Math.min(200,Math.max(60,Math.round(companionAS*100)));
    combatants.push({id:'companion',ap:0,speed:compSpeed,alive:true});
  }
  // Monster specials init
  monsterSpecials=[];
  if(monster.specials){
    monster.specials.forEach(function(sid){
      var spec=DG_SPECIALS[sid];
      if(spec)monsterSpecials.push({id:sid,cd:spec.cd,maxCd:spec.cd,telegraph:spec.telegraph,icon:spec.icon});
    });
  }
  monsterRoundCount=0;
  currentActor=null;
  calcTimelinePreview();
  document.getElementById('dungeonScreen').style.display='none';
  document.getElementById('battleScreen').style.display='block';
  var ctrls=document.querySelector('#battleScreen .ctrls');
  if(ctrls)ctrls.style.display='none';
  var btnGo=document.getElementById('btnGo');
  if(btnGo)btnGo.style.display='none';
  var btnRst=document.querySelector('.btn-rst');
  if(btnRst)btnRst.style.display='none';
  var btnBack=document.querySelector('#battleScreen .btn-back');
  if(btnBack)btnBack.style.display='none';
  var wb=document.getElementById('winBanner');
  if(wb){wb.className='win-banner';wb.innerHTML='';}
  buildHUD(state.h1,'hudP1');
  buildHUD(state.h2,'hudP2');
  updateUI();
  buildActionUI();
  enableButtons(true);
  if(!state.groundTiles)initGround();
  SFX.battleStart();
  showTurnText('Battle Start!');
  lastTime=performance.now();
  rafId=requestAnimationFrame(dgRender);
  // Hero always gets the first turn — AP system kicks in after
  setTimeout(function(){
    phase='pick';currentActor='hero';
    enableButtons(true);
    showTurnText('Turn 1 \u2014 Choose your action!');
    calcTimelinePreview();updateUI();
  },400);
}

// ===== ACTION BUTTON UI =====
function buildActionUI(){
  var existing=document.getElementById('dgTurnActions');
  if(existing)existing.remove();
  var div=document.createElement('div');
  div.id='dgTurnActions';
  div.className='dg-turn-actions';
  var run=state.dgRun;
  var sk0=state.customChar.skills[0]!==null?ALL_SKILLS[state.customChar.skills[0]]:null;
  var sk1=state.customChar.skills[1]!==null?ALL_SKILLS[state.customChar.skills[1]]:null;
  var ult=state.customChar.ultimate!==null?ALL_ULTS[state.customChar.ultimate]:null;
  var buttons=[
    {id:'dgAtkBtn',label:'\u2694\uFE0F Attack',color:'#ffaa44',action:'attack'},
    {id:'dgSk0Btn',label:sk0?(sk0.icon+' '+sk0.name):'\u2728 Skill 1',color:'#44ddbb',action:'skill0'},
    {id:'dgSk1Btn',label:sk1?(sk1.icon+' '+sk1.name):'\u2728 Skill 2',color:'#44ddbb',action:'skill1'},
    {id:'dgUltBtn',label:ult?(ult.icon+' '+ult.name):'\uD83D\uDCA5 Ultimate',color:'#ff4444',action:'ultimate'},
    {id:'dgPotBtn',label:'\uD83E\uDDEA Potion ('+(run?run.potions:0)+')',color:'#44aa66',action:'potion'},
    {id:'dgFleeBtn',label:'\uD83C\uDFC3 Flee',color:'#888888',action:'flee'},
  ];
  // Add companion ability button if companion alive
  if(companionAlive&&companionData){
    var compAbilName=companionData.abilityName||'Ability';
    buttons.splice(5,0,{id:'dgCompBtn',label:'\uD83D\uDC3E '+compAbilName,color:'#bb88ff',action:'companion_ability'});
  }
  buttons.forEach(function(b){
    var btn=document.createElement('button');
    btn.id=b.id;btn.className='dg-action-btn';
    btn.style.borderColor=b.color;btn.style.color=b.color;
    btn.innerHTML=b.label;
    btn.setAttribute('data-action',b.action);
    btn.onclick=function(){handleAction(b.action);};
    div.appendChild(btn);
  });
  // Auto Battle button
  var autoBtn=document.createElement('button');
  autoBtn.id='dgAutoBtn';autoBtn.className='dg-action-btn';
  autoBtn.style.borderColor='#ccaa00';autoBtn.style.color='#ccaa00';
  autoBtn.innerHTML='\u{1F916} Auto';
  autoBtn.onclick=function(){toggleAutoBattle();};
  div.appendChild(autoBtn);
  var canvas=document.getElementById('arenaCanvas');
  if(canvas&&canvas.parentNode)canvas.parentNode.insertBefore(div,canvas.nextSibling);
}

function enableButtons(enabled){
  var div=document.getElementById('dgTurnActions');
  if(!div)return;
  div.querySelectorAll('.dg-action-btn').forEach(function(btn){
    btn.disabled=!enabled;
    btn.style.opacity=enabled?'1':'0.4';
    btn.style.pointerEvents=enabled?'auto':'none';
  });
  if(enabled)refreshButtonStates();
}

function refreshButtonStates(){
  var hero=state.h1,run=state.dgRun;
  if(!hero||!run)return;
  var res=hero.resource!==undefined?hero.resource:(hero.mana||0);
  var sk0Btn=document.getElementById('dgSk0Btn');
  if(sk0Btn){
    var si0=state.customChar.skills[0];
    var sk0=si0!==null?ALL_SKILLS[si0]:null;
    if(!sk0){sk0Btn.disabled=true;sk0Btn.style.opacity='0.3';sk0Btn.style.pointerEvents='none';}
    else{
      var c0=sk0.cost!==undefined?sk0.cost:30,ok0=c0<=0||res>=c0;
      sk0Btn.disabled=!ok0;sk0Btn.style.opacity=ok0?'1':'0.4';sk0Btn.style.pointerEvents=ok0?'auto':'none';
      sk0Btn.innerHTML=sk0.icon+' '+sk0.name+' <span style="font-size:.55rem;opacity:.7">('+c0+')</span>';
    }
  }
  var sk1Btn=document.getElementById('dgSk1Btn');
  if(sk1Btn){
    var si1=state.customChar.skills[1];
    var sk1=si1!==null?ALL_SKILLS[si1]:null;
    if(!sk1){sk1Btn.disabled=true;sk1Btn.style.opacity='0.3';sk1Btn.style.pointerEvents='none';}
    else{
      var c1=sk1.cost!==undefined?sk1.cost:30,ok1=c1<=0||res>=c1;
      sk1Btn.disabled=!ok1;sk1Btn.style.opacity=ok1?'1':'0.4';sk1Btn.style.pointerEvents=ok1?'auto':'none';
      sk1Btn.innerHTML=sk1.icon+' '+sk1.name+' <span style="font-size:.55rem;opacity:.7">('+c1+')</span>';
    }
  }
  var ultBtn=document.getElementById('dgUltBtn');
  if(ultBtn){
    var ui=state.customChar.ultimate;
    var ud=ui!==null?ALL_ULTS[ui]:null;
    if(!ud||ultUsed){ultBtn.disabled=true;ultBtn.style.opacity='0.3';ultBtn.style.pointerEvents='none';}
    else{ultBtn.disabled=false;ultBtn.style.opacity='1';ultBtn.style.pointerEvents='auto';}
    if(ultUsed&&ud)ultBtn.innerHTML=ud.icon+' '+ud.name+' <span style="font-size:.55rem;opacity:.7">(USED)</span>';
  }
  var potBtn=document.getElementById('dgPotBtn');
  if(potBtn){
    var pots=run.potions||0;
    potBtn.innerHTML='\uD83E\uDDEA Potion ('+pots+')';
    var canPot=pots>0&&hero.hp<hero.maxHp;
    potBtn.disabled=!canPot;potBtn.style.opacity=canPot?'1':'0.4';potBtn.style.pointerEvents=canPot?'auto':'none';
  }
  // Companion ability button
  var compBtn=document.getElementById('dgCompBtn');
  if(compBtn){
    var canComp=companionAlive&&companionAbilityCd<=0;
    compBtn.disabled=!canComp;compBtn.style.opacity=canComp?'1':'0.4';compBtn.style.pointerEvents=canComp?'auto':'none';
    if(companionAbilityCd>0)compBtn.innerHTML='\uD83D\uDC3E '+(companionData?companionData.abilityName||'Ability':'Ability')+' <span style="font-size:.55rem;opacity:.7">(CD:'+companionAbilityCd+')</span>';
  }
}

// ===== AUTO BATTLE =====
function toggleAutoBattle(){
  autoBattle=!autoBattle;
  var btn=document.getElementById('dgAutoBtn');
  if(btn){
    btn.style.background=autoBattle?'rgba(204,170,0,0.25)':'';
    btn.style.boxShadow=autoBattle?'0 0 10px #ccaa00':'';
    btn.innerHTML=autoBattle?'\u{1F916} AUTO ON':'\u{1F916} Auto';
  }
  if(autoBattle&&phase==='pick')autoPickAction();
}

function autoPickAction(){
  if(!autoBattle||phase!=='pick')return;
  var hero=state.h1,monster=state.h2,run=state.dgRun;
  if(!hero||!monster||!run)return;
  var res=hero.resource!==undefined?hero.resource:(hero.mana||0);
  var hpPct=hero.hp/hero.maxHp;
  var isCharging=!!monsterChargingSpecial;
  // Use potion if HP low
  if(hpPct<0.35&&run.potions>0){handleAction('potion');return}
  // Use ultimate if available and HP below threshold
  var ultIdx=state.customChar.ultimate;
  var ud=ultIdx!==null?ALL_ULTS[ultIdx]:null;
  if(ud&&!ultUsed&&hpPct<(ud.threshold||0.25)+0.1){handleAction('ultimate');return}
  // Build list of affordable skills
  var affordable=[];
  for(var i=0;i<2;i++){
    var si=state.customChar.skills[i];
    if(si===null||!ALL_SKILLS[si])continue;
    var sk=ALL_SKILLS[si];
    var cost=sk.cost||0;
    if(cost>0&&res<cost)continue;
    affordable.push({slot:i,idx:si,sk:sk,cost:cost,dmg:SKILL_DMG[si]||0});
  }
  // TELEGRAPH AWARENESS: If monster is charging, prioritize stun > shield > smokeBomb
  if(isCharging){
    // Try stun skills first (chain lightning idx=0 stuns)
    for(var sti=0;sti<affordable.length;sti++){
      if(affordable[sti].idx===0){handleAction('skill'+affordable[sti].slot);return}
    }
    // Try shield/smokeBomb to survive
    for(var di=0;di<affordable.length;di++){
      var did=affordable[di].sk.id;
      if(did==='staticShield'&&!hero.shieldActive){handleAction('skill'+affordable[di].slot);return}
      if(did==='smokeBomb'&&!hasStatus(playerStatuses,'smokeBomb')){handleAction('skill'+affordable[di].slot);return}
    }
  }
  // Prioritize: damage skills first, then utility/buffs contextually
  var dmgSkills=affordable.filter(function(s){return s.dmg>0});
  var buffSkills=affordable.filter(function(s){return s.dmg===0});
  // Use highest-damage skill if available
  if(dmgSkills.length>0){
    dmgSkills.sort(function(a,b){return b.dmg-a.dmg});
    handleAction('skill'+dmgSkills[0].slot);return;
  }
  // Use buff/utility skills smartly — only against tough enemies (tier 2+)
  var monsterTough=monster.maxHp>500;
  for(var bi=0;bi<buffSkills.length;bi++){
    var bs=buffSkills[bi];
    var id=bs.sk.id;
    // Shield: use when HP below 65% and no shield active
    if(id==='staticShield'&&hpPct<0.65&&!hero.shieldActive){handleAction('skill'+bs.slot);return}
    // Hunter's Mark: only vs tough enemies
    if(id==='huntersMark'&&monsterTough){handleAction('skill'+bs.slot);return}
    // Bloodlust: use for extra attack (always worth it)
    if(id==='bloodlust'&&!bloodlustActive){handleAction('skill'+bs.slot);return}
    // Shadow Step: only vs tough enemies when not stealthed
    if(id==='shadowStep'&&!hero.stealthed&&monsterTough){handleAction('skill'+bs.slot);return}
    // Envenom: only vs tough enemies
    if(id==='envenom'&&poisonTurnsLeft<=0&&monsterTough){handleAction('skill'+bs.slot);return}
    // Smoke Bomb: use when HP below 55%
    if(id==='smokeBomb'&&hpPct<0.55&&!hasStatus(playerStatuses,'smokeBomb')){handleAction('skill'+bs.slot);return}
    // War Cry: only vs tough enemies
    if(id==='warCry'&&!hasStatus(monsterStatuses,'warcry')&&monsterTough){handleAction('skill'+bs.slot);return}
    // Summon Pet: use if no follower alive
    if(id==='sacrifice'&&!hero.followerAlive){handleAction('skill'+bs.slot);return}
  }
  // Default: basic attack
  handleAction('attack');
}

// ===== HANDLE PLAYER ACTION =====
function handleAction(action){
  if(phase!=='pick')return;
  var hero=state.h1,monster=state.h2,run=state.dgRun;
  if(!hero||!monster||!run)return;
  if(action==='attack'){
    phase='playerAnim';animAction='attack';animSource=hero;animTarget=monster;
    animTimer=0;animDuration=autoBattle?150:250;enableButtons(false);
    showTurnText(hero.name+' attacks!');
  }
  else if(action==='skill0'||action==='skill1'){
    var slotIdx=action==='skill0'?0:1;
    var skillIdx=state.customChar.skills[slotIdx];
    if(skillIdx===null||!ALL_SKILLS[skillIdx])return;
    var sk=ALL_SKILLS[skillIdx];
    var cost=sk.cost!==undefined?sk.cost:30;
    var curRes=hero.resource!==undefined?hero.resource:(hero.mana||0);
    if(cost>0&&curRes<cost)return;
    if(cost>0){
      if(hero.resource!==undefined)hero.resource-=cost;
      if(hero.mana!==undefined)hero.mana=Math.max(0,hero.mana-cost);
    }
    phase='playerAnim';animAction='skill';
    animAction_skillIdx=skillIdx;animAction_skill=sk;
    animSource=hero;animTarget=monster;
    animTimer=0;animDuration=autoBattle?200:350;enableButtons(false);
    showTurnText(hero.name+' casts '+sk.name+'!');
  }
  else if(action==='ultimate'){
    var ultIdx=state.customChar.ultimate;
    if(ultIdx===null||!ALL_ULTS[ultIdx]||ultUsed)return;
    var ultData=ALL_ULTS[ultIdx];
    ultUsed=true;
    phase='playerAnim';animAction='ultimate';
    animAction_ultIdx=ultIdx;animAction_ult=ultData;
    animSource=hero;animTarget=monster;
    animTimer=0;animDuration=autoBattle?300:500;enableButtons(false);
    showTurnText('\u2B50 '+hero.name+' unleashes '+ultData.name+'! \u2B50');
    SFX.ult();
  }
  else if(action==='potion'){
    if(run.potions<=0||hero.hp>=hero.maxHp)return;
    run.potions--;
    phase='playerAnim';animAction='potion';
    animSource=hero;animTarget=hero;
    animTimer=0;animDuration=200;enableButtons(false);
    showTurnText(hero.name+' drinks a potion!');
    SFX.heal();
  }
  else if(action==='companion_ability'){
    if(!companionAlive||companionAbilityCd>0)return;
    companionAbilityCd=companionAbilityMaxCd;
    applyCompanionAbility();
    // Check kill
    if(monster.hp<=0){
      monster.hp=0;showTurnText(monster.name+' has been defeated!');SFX.win();
      combatLog(monster.name+' defeated!','death');
      for(var ci=0;ci<combatants.length;ci++)if(combatants[ci].id==='monster')combatants[ci].alive=false;
      phase='done';setTimeout(function(){endCombat(true);},500);return;
    }
    // Don't consume hero turn — just triggers companion ability
    refreshButtonStates();
    return;
  }
  else if(action==='flee'){
    phase='playerAnim';animAction='flee';
    animSource=hero;animTarget=null;
    animTimer=0;animDuration=300;enableButtons(false);
    showTurnText(hero.name+' attempts to flee!');
  }
}

// ===== ANIMATION UPDATE =====
function updateAnim(dt){
  if(phase!=='playerAnim'&&phase!=='monsterAnim')return;
  animTimer+=dt*1000;
  var progress=Math.min(1,animTimer/animDuration);
  var midpoint=animDuration/2;
  var src=animSource,tgt=animTarget;
  if(animAction==='attack'||animAction==='skill'||animAction==='ultimate'||animAction==='monsterAttack'){
    if(src&&tgt&&src._origX!==undefined){
      var lungeDir=tgt.x>src.x?1:-1;
      var lungeAmt=40;
      if(animTimer<midpoint){
        src.x=src._origX+lungeDir*lungeAmt*(animTimer/midpoint);
      }else{
        src.x=src._origX+lungeDir*lungeAmt*(1-(animTimer-midpoint)/midpoint);
      }
    }
    if(animTimer>=midpoint&&animTimer-dt*1000<midpoint)applyMidpointEffect();
  }
  if(animAction==='potion'){
    if(animTimer>=midpoint&&animTimer-dt*1000<midpoint)applyPotionEffect();
  }
  if(animAction==='flee'){
    if(src&&src._origX!==undefined)src.x=src._origX-60*progress;
    if(animTimer>=midpoint&&animTimer-dt*1000<midpoint)applyFleeEffect();
  }
  if(src&&(animAction==='skill'||animAction==='ultimate'))src.castAnim=Math.max(0,1-progress);
  if(progress>=1){
    if(src&&src._origX!==undefined)src.x=src._origX;
    if(src)src.castAnim=0;
    finishAnim();
  }
}

// ===== MIDPOINT EFFECTS =====
function applyMidpointEffect(){
  var src=animSource,tgt=animTarget;
  if(!src||!tgt)return;
  if(animAction==='attack'||animAction==='monsterAttack'){
    var result=calcDmg(src,tgt);
    if(result.evaded){
      addFloat(tgt.x,tgt.y-60,'DODGE!','#88ccff');SFX.dodge();
      combatLog(tgt.name+' dodges '+src.name+'\'s attack!','miss');
    }else{
      var amt=result.amount;
      if(tgt===state.h1&&tgt.shieldActive&&tgt.shieldHp>0){
        var absorbed=Math.min(amt,tgt.shieldHp);
        tgt.shieldHp-=absorbed;amt-=absorbed;
        if(tgt.shieldHp<=0){tgt.shieldActive=false;SFX.shieldBreak();addFloat(tgt.x,tgt.y-50,'SHIELD BREAK!','#ff6644');combatLog('Shield shattered!','spell');}
        else{addFloat(tgt.x,tgt.y-50,'Absorbed '+absorbed,'#44ddbb');combatLog('Shield absorbs '+absorbed+' dmg','spell');}
      }
      if(playerInvulnRounds>0&&tgt===state.h1){
        addFloat(tgt.x,tgt.y-60,'INVULNERABLE!','#ffcc22');amt=0;
        combatLog(tgt.name+' is invulnerable!','heal');
      }
      if(amt>0){
        tgt.hp-=amt;tgt.hurtAnim=1;
        if(src===state.h1){dmgDealt+=amt;if(deathMarkActive)deathMarkDmg+=amt;}
        else dmgTaken+=amt;
        if(src._stashLifesteal&&src._stashLifesteal>0){
          var heal=Math.round(amt*src._stashLifesteal);
          src.hp=Math.min(src.maxHp,src.hp+heal);
          if(heal>0){addFloat(src.x,src.y-50,'+'+heal,'#44aa66');combatLog(src.name+' heals '+heal+' (lifesteal)','heal');}
        }
      }
      var col=result.crit?'#ffcc22':(src===state.h1?'#ff8844':'#ff4444');
      addFloat(tgt.x,tgt.y-60,(result.crit?'CRIT! ':'')+amt,col);
      SFX.hit();if(result.crit)SFX.crit();
      combatLog(src.name+' hits '+tgt.name+' for '+(result.crit?'CRIT ':'')+amt+' dmg','dmg');
    }
    // Restore heavy strike damage after hit
    if(src._heavyStrikeRestore){src.baseDmg=src._heavyStrikeRestore;src._heavyStrikeRestore=null;}
  }
  else if(animAction==='skill')applySkillEffect(src,tgt);
  else if(animAction==='ultimate')applyUltEffect(src,tgt);
}

// ===== SKILL EFFECTS =====
function applySkillEffect(src,tgt){
  var idx=animAction_skillIdx,sk=animAction_skill;
  if(idx===null||!sk)return;
  var baseDmg=SKILL_DMG[idx]||0;
  if(baseDmg>0){
    var result=calcSkillDmg(src,tgt,baseDmg);
    if(result.evaded){addFloat(tgt.x,tgt.y-60,'DODGE!','#88ccff');SFX.dodge();combatLog(tgt.name+' dodges '+sk.name+'!','miss');}
    else{
      tgt.hp-=result.amount;tgt.hurtAnim=1;
      dmgDealt+=result.amount;if(deathMarkActive)deathMarkDmg+=result.amount;
      addFloat(tgt.x,tgt.y-60,(result.crit?'CRIT! ':'')+sk.icon+' '+result.amount,result.crit?'#ffcc22':'#44ddbb');
      SFX.hit();if(result.crit)SFX.crit();
      combatLog(sk.name+' hits for '+(result.crit?'CRIT ':'')+result.amount+' dmg','spell');
      if(idx===0){addStatus(monsterStatuses,'stunned','Stunned','\uD83D\uDCAB','#ffcc22',1);SFX.lightning();combatLog(tgt.name+' is stunned!','stun');}
    }
  }else{
    if(idx===2){
      src.shieldActive=true;src.shieldHp=420*(1+(src.spellDmgBonus||0));
      addStatus(playerStatuses,'shield','Shield','\uD83D\uDEE1\uFE0F','#44ddbb',2);
      addFloat(src.x,src.y-60,'SHIELD +'+Math.round(src.shieldHp),'#44ddbb');SFX.shield();
      combatLog('Shield activated ('+Math.round(src.shieldHp)+' HP)','spell');
    }
    else if(idx===3){
      addStatus(monsterStatuses,'marked','Marked','\uD83C\uDFAF','#ff8844',2);
      tgt.evasion=Math.max(0,(tgt.evasion||0)-0.15);tgt.slow=0.2;
      addFloat(tgt.x,tgt.y-60,'MARKED!','#ff8844');
      combatLog(tgt.name+' is marked!','spell');
    }
    else if(idx===4){
      bloodlustActive=true;
      addStatus(playerStatuses,'bloodlust','Bloodlust','\uD83E\uDE78','#cc3300',1);
      addFloat(src.x,src.y-60,'BLOODLUST!','#cc3300');SFX.fire();
      combatLog('Bloodlust activated!','spell');
    }
    else if(idx===6){
      src.stealthed=true;
      addStatus(playerStatuses,'stealth','Stealth','\uD83D\uDCA8','#3388cc',1);
      addFloat(src.x,src.y-60,'STEALTH!','#3388cc');SFX.stealth();
      combatLog('Entered stealth!','stealth');
    }
    else if(idx===7){
      poisonStacks=1;poisonTurnsLeft=2;
      addStatus(monsterStatuses,'poison','Poison','\u2620','#66ccff',2);
      addFloat(tgt.x,tgt.y-60,'POISONED!','#66ccff');SFX.poison();
      combatLog(tgt.name+' is poisoned!','poison');
    }
    else if(idx===8){
      addStatus(playerStatuses,'smokeBomb','Smoke','\uD83D\uDCA3','#667788',1);
      src.evasion=Math.min(0.8,(src.evasion||0)+0.45);
      addFloat(src.x,src.y-60,'+EVASION!','#667788');SFX.stealth();
      combatLog('Smoke bomb! +Evasion','spell');
    }
    else if(idx===10){
      addStatus(monsterStatuses,'warcry','Slowed','\uD83D\uDCE2','#ffaa44',1);
      tgt.baseDmg=Math.round(tgt.baseDmg*0.8);
      addFloat(tgt.x,tgt.y-60,'WAR CRY!','#ffaa44');SFX.warCry();
      combatLog('War Cry! '+tgt.name+' weakened','spell');
    }
  }
}

// ===== ULTIMATE EFFECTS (round-based rebalanced) =====
function applyUltEffect(src,tgt){
  var idx=animAction_ultIdx;
  if(idx===null)return;
  if(idx===0){
    // Thunderstorm: 4x150dmg + 35% lifesteal
    var totalD=0,totalH=0;
    for(var i=0;i<4;i++){
      var hd=150*(1+(src.spellDmgBonus||0))*(1-Math.min(tgt.def/300,0.8));
      hd=Math.round(hd*(0.9+Math.random()*0.2));
      if(Math.random()>=(tgt.evasion||0)){
        tgt.hp-=hd;totalD+=hd;
        var hl=Math.round(hd*0.35);
        src.hp=Math.min(src.maxHp,src.hp+hl);totalH+=hl;
      }
    }
    tgt.hurtAnim=1;dmgDealt+=totalD;if(deathMarkActive)deathMarkDmg+=totalD;
    addFloat(tgt.x,tgt.y-70,'\u26A1 '+totalD,'#44ddbb');
    if(totalH>0)addFloat(src.x,src.y-60,'+'+totalH+' HP','#44aa66');
    SFX.thunder();
    combatLog('Thunderstorm deals '+totalD+' dmg, heals '+totalH+'!','ult');
  }
  else if(idx===1){
    // Rain of Fire: 1 round invuln + 1 extra attack + fire dmg
    playerInvulnRounds=1;playerExtraAttacks=1;
    addStatus(playerStatuses,'invuln','Invulnerable','\uD83D\uDD25','#ff8833',99);
    addFloat(src.x,src.y-60,'RAIN OF FIRE!','#ff8833');
    var fireDmg=Math.round(src.baseDmg*2*(1-Math.min(tgt.def/300,0.8)));
    tgt.hp-=fireDmg;tgt.hurtAnim=1;dmgDealt+=fireDmg;
    addFloat(tgt.x,tgt.y-70,'\uD83D\uDD25 '+fireDmg,'#ff6622');SFX.fire();
    combatLog('Rain of Fire! '+fireDmg+' dmg + invulnerability (1 round)','ult');
  }
  else if(idx===2){
    // Death Mark: track 2 rounds, detonate at 75%
    deathMarkActive=true;deathMarkDmg=0;deathMarkRounds=2;
    addStatus(monsterStatuses,'deathMark','Death Mark','\u2620','#ff8800',99);
    addFloat(tgt.x,tgt.y-60,'\u2620 DEATH MARK!','#ff8800');
    src.combo=(src.combo||0)+3;
    combatLog('Death Mark placed on '+tgt.name+'! (2 rounds)','ult');
  }
  else if(idx===3){
    // Berserker Rage: +35% dmg for 2 rounds
    playerDmgBuff=0.35;playerDmgBuffRounds=2;
    addStatus(playerStatuses,'berserk','Berserker','\uD83D\uDC80','#ff4444',99);
    addFloat(src.x,src.y-60,'BERSERKER RAGE!','#ff4444');
    src.ultActive=true;SFX.charge();
    combatLog('Berserker Rage! +35% dmg for 2 rounds','ult');
  }
}

function applyPotionEffect(){
  var hero=state.h1;if(!hero)return;
  var healAmt=Math.round(hero.maxHp*0.35);
  hero.hp=Math.min(hero.maxHp,hero.hp+healAmt);
  addFloat(hero.x,hero.y-60,'+'+healAmt+' HP','#44aa66');
  hero.castAnim=0.5;
  combatLog('Potion heals '+healAmt+' HP','heal');
}

function applyFleeEffect(){
  var hero=state.h1;if(!hero)return;
  var chance=0.5+(hero.evasion||0);
  fleeResult=Math.random()<chance;
  addFloat(hero.x,hero.y-60,fleeResult?'ESCAPED!':'FAILED!',fleeResult?'#88ccff':'#ff4444');
  combatLog(fleeResult?'Escaped successfully!':'Failed to flee!',fleeResult?'heal':'miss');
}

// ===== STATUS HELPERS =====
function addStatus(arr,id,name,icon,color,turns){
  for(var i=arr.length-1;i>=0;i--)if(arr[i].id===id)arr.splice(i,1);
  arr.push({id:id,name:name,icon:icon,color:color,turnsLeft:turns});
}

function tickStatuses(arr){
  for(var i=arr.length-1;i>=0;i--){
    var s=arr[i];
    // Skip round-based statuses (managed by tickRoundDurations)
    if(s.id==='invuln'||s.id==='berserk'||s.id==='deathMark'||s.id==='enraged'||s.id==='monsterPoison')continue;
    s.turnsLeft--;
    if(s.turnsLeft<=0){
      if(s.id==='shield'&&state.h1){state.h1.shieldActive=false;state.h1.shieldHp=0;}
      if(s.id==='stealth'&&state.h1){state.h1.stealthed=false;}
      if(s.id==='smokeBomb'&&state.h1){state.h1.evasion=Math.max(0,(state.h1.evasion||0)-0.45);}
      if(s.id==='bloodlust')bloodlustActive=false;
      if(s.id==='monsterPoison'){/* tracked separately by poisonTurnsLeft */}
      arr.splice(i,1);
    }
  }
}

function hasStatus(arr,id){
  for(var i=0;i<arr.length;i++)if(arr[i].id===id)return true;
  return false;
}

// ===== AP TIMELINE FUNCTIONS =====
function calcTimelinePreview(){
  // Simulate forward to find next 8 turns
  var preview=[];
  var simAP={};
  for(var i=0;i<combatants.length;i++){
    if(combatants[i].alive)simAP[combatants[i].id]=combatants[i].ap;
  }
  for(var step=0;step<200&&preview.length<8;step++){
    var acted=null,bestAP=-1;
    for(var ci=0;ci<combatants.length;ci++){
      var c=combatants[ci];
      if(!c.alive||!simAP.hasOwnProperty(c.id))continue;
      simAP[c.id]+=c.speed;
      if(simAP[c.id]>=100&&simAP[c.id]>bestAP){bestAP=simAP[c.id];acted=c.id;}
    }
    if(acted){simAP[acted]-=100;preview.push(acted);}
  }
  timelinePreview=preview;
}

function advanceTurn(){
  var hero=state.h1,monster=state.h2;
  if(!hero||!monster||phase==='done')return;
  // Tick AP for all living combatants
  var maxIter=200,acted=null;
  for(var iter=0;iter<maxIter;iter++){
    var bestAP=-1,bestId=null;
    for(var i=0;i<combatants.length;i++){
      var c=combatants[i];
      if(!c.alive)continue;
      c.ap+=c.speed;
      if(c.ap>=100&&c.ap>bestAP){bestAP=c.ap;bestId=c.id;}
    }
    if(bestId){
      // Priority on ties: hero > companion > monster
      for(var j=0;j<combatants.length;j++){
        var cj=combatants[j];
        if(!cj.alive||cj.ap<100)continue;
        if(cj.ap===bestAP){
          if(cj.id==='hero'){bestId='hero';break;}
          if(cj.id==='companion'&&bestId==='monster'){bestId='companion';}
        }
      }
      // Deduct AP
      for(var k=0;k<combatants.length;k++){
        if(combatants[k].id===bestId){combatants[k].ap-=100;break;}
      }
      acted=bestId;
      break;
    }
  }
  if(!acted)return;
  currentActor=acted;
  calcTimelinePreview();

  if(acted==='hero'){
    // Check if hero is stunned by monster
    if(playerStunnedByMonster){
      playerStunnedByMonster=false;
      showTurnText('Stunned! Turn skipped!');
      combatLog(hero.name+' is stunned, skips turn!','stun');
      addFloat(hero.x,hero.y-60,'STUNNED!','#ffcc22');
      setTimeout(function(){advanceTurn();},400);
      return;
    }
    turnNum++;
    phase='pick';
    enableButtons(true);
    showTurnText('Turn '+turnNum+' \u2014 Choose your action!');
    updateUI();
    if(autoBattle)setTimeout(autoPickAction,80);
  }
  else if(acted==='monster'){
    monsterRoundCount++;
    // Tick round-based durations on monster turn
    tickRoundDurations();
    startMonsterTurn();
  }
  else if(acted==='companion'){
    doCompanionTurn();
  }
}

function tickRoundDurations(){
  // Tick round-based player buff durations
  if(playerDmgBuffRounds>0){
    playerDmgBuffRounds--;
    if(playerDmgBuffRounds<=0){playerDmgBuff=0;if(state.h1)state.h1.ultActive=false;
      for(var i=playerStatuses.length-1;i>=0;i--)if(playerStatuses[i].id==='berserk')playerStatuses.splice(i,1);
    }
  }
  if(playerInvulnRounds>0){
    playerInvulnRounds--;
    if(playerInvulnRounds<=0){
      for(var j=playerStatuses.length-1;j>=0;j--)if(playerStatuses[j].id==='invuln')playerStatuses.splice(j,1);
    }
  }
  if(deathMarkRounds>0){
    deathMarkRounds--;
    if(deathMarkRounds<=0&&deathMarkActive){
      // Detonate death mark
      if(deathMarkDmg>0&&state.h2){
        var burst=Math.round(deathMarkDmg*0.75);
        state.h2.hp-=burst;state.h2.hurtAnim=1;dmgDealt+=burst;
        addFloat(state.h2.x,state.h2.y-70,'\u2620 BURST '+burst,'#ff8800');SFX.hitHard();
        combatLog('Death Mark detonates for '+burst+' dmg!','ult');
      }
      deathMarkActive=false;deathMarkDmg=0;
      for(var k=monsterStatuses.length-1;k>=0;k--)if(monsterStatuses[k].id==='deathMark')monsterStatuses.splice(k,1);
    }
  }
  // Tick status turn counters on monster round
  tickStatuses(playerStatuses);
  tickStatuses(monsterStatuses);
  // Monster enrage duration
  if(monsterEnraged){
    monsterEnragedRounds--;
    if(monsterEnragedRounds<=0){
      monsterEnraged=false;
      if(state.h2)state.h2.baseDmg=Math.round(state.h2.baseDmg/1.5);
      for(var ei=monsterStatuses.length-1;ei>=0;ei--)if(monsterStatuses[ei].id==='enraged')monsterStatuses.splice(ei,1);
    }
  }
  // Monster special cooldowns tick
  for(var si=0;si<monsterSpecials.length;si++){
    if(monsterSpecials[si].cd>0)monsterSpecials[si].cd--;
  }
  // Mana regen on monster round
  var hero=state.h1;
  if(hero){
    var regen=hero.resourceRegen||hero.manaRegen||2;
    if(hero.resource!==undefined)hero.resource=Math.min(hero.maxResource||hero.maxMana||100,(hero.resource||0)+regen*2);
    if(hero.mana!==undefined)hero.mana=hero.resource!==undefined?hero.resource:Math.min(hero.maxMana||100,(hero.mana||0)+regen*2);
  }
  // Hero poison tick (from monster poisonSpit)
  if(heroPoisonTurns>0&&state.h1&&state.h1.hp>0&&state.h2){
    var heroPoisonDmg=Math.round(state.h2.baseDmg*0.25);
    state.h1.hp-=heroPoisonDmg;dmgTaken+=heroPoisonDmg;
    addFloat(state.h1.x,state.h1.y-50,'\u2620 '+heroPoisonDmg,'#88cc44');
    combatLog('Poison deals '+heroPoisonDmg+' to '+state.h1.name,'poison');
    heroPoisonTurns--;
    if(heroPoisonTurns<=0){
      for(var hpi=playerStatuses.length-1;hpi>=0;hpi--)if(playerStatuses[hpi].id==='monsterPoison'){playerStatuses.splice(hpi,1);break;}
    }
  }
  // Monster poison tick on monster round (from hero envenom)
  if(poisonTurnsLeft>0&&state.h2&&state.h2.hp>0){
    var poisonDmg=Math.round((state.h1?state.h1.baseDmg:50)*0.3);
    state.h2.hp-=poisonDmg;dmgDealt+=poisonDmg;
    addFloat(state.h2.x,state.h2.y-50,'\u2620 '+poisonDmg,'#66ccff');
    combatLog('Poison deals '+poisonDmg+' to '+state.h2.name,'poison');
    poisonTurnsLeft--;
    if(poisonTurnsLeft<=0){
      poisonStacks=0;
      for(var pi=monsterStatuses.length-1;pi>=0;pi--)if(monsterStatuses[pi].id==='poison'){monsterStatuses.splice(pi,1);break;}
    }
  }
}

function doCompanionTurn(){
  if(!companionAlive||companionHp<=0){advanceTurn();return;}
  var monster=state.h2;
  if(!monster||monster.hp<=0){advanceTurn();return;}
  // Companion auto-attack
  var raw=companionDmg*(1-Math.min(monster.def/300,0.8));
  raw*=(0.85+Math.random()*0.3);
  var amt=Math.round(raw);
  monster.hp-=amt;monster.hurtAnim=1;dmgDealt+=amt;
  if(deathMarkActive)deathMarkDmg+=amt;
  addFloat(monster.x,monster.y-50,companionIcon+' '+amt,'#bb88ff');
  SFX.followerAtk();
  combatLog(companionName+' attacks for '+amt+' dmg','dmg');
  // Check ability
  if(companionAbilityCd<=0&&companionData){
    companionAbilityCd=companionAbilityMaxCd;
    applyCompanionAbility();
  }else{
    companionAbilityCd--;
  }
  // Check kill
  if(monster.hp<=0){
    monster.hp=0;showTurnText(monster.name+' has been defeated!');SFX.win();
    combatLog(monster.name+' defeated!','death');
    phase='done';setTimeout(function(){endCombat(true);},500);return;
  }
  calcTimelinePreview();
  setTimeout(function(){advanceTurn();},autoBattle?80:200);
}

function applyCompanionAbility(){
  if(!companionData)return;
  var name=companionData.name||'';
  var hero=state.h1,monster=state.h2;
  if(!hero||!monster)return;
  // Name-based ability switch
  if(name.indexOf('Turtle')>=0||name.indexOf('Golem')>=0||name.indexOf('Crystal')>=0){
    // Shield: grant hero shield
    var shieldAmt=Math.round(companionMaxHp*0.3);
    hero.shieldActive=true;hero.shieldHp=(hero.shieldHp||0)+shieldAmt;
    addFloat(hero.x,hero.y-60,'\uD83D\uDEE1\uFE0F +'+shieldAmt,'#44ddbb');
    SFX.shield();combatLog(companionName+' shields hero for '+shieldAmt+'!','spell');
  }else if(name.indexOf('Mole')>=0||name.indexOf('Sprite')>=0||name.indexOf('Wisp')>=0){
    // Heal: heal hero 10% maxHP
    var heal=Math.round(hero.maxHp*0.1);
    hero.hp=Math.min(hero.maxHp,hero.hp+heal);
    addFloat(hero.x,hero.y-60,'\u{1F49A} +'+heal,'#44aa66');
    SFX.heal();combatLog(companionName+' heals hero for '+heal+'!','heal');
  }else if(name.indexOf('Fox')>=0||name.indexOf('Frog')>=0||name.indexOf('Elemental')>=0){
    // Stun: damage + stun 1 turn
    var stunDmg=Math.round(companionDmg*1.5*(1-Math.min(monster.def/300,0.8)));
    monster.hp-=stunDmg;monster.hurtAnim=1;dmgDealt+=stunDmg;
    addStatus(monsterStatuses,'stunned','Stunned','\uD83D\uDCAB','#ffcc22',1);
    addFloat(monster.x,monster.y-60,'\uD83D\uDCAB STUN '+stunDmg,'#ffcc22');
    SFX.stun();combatLog(companionName+' stuns '+monster.name+' for '+stunDmg+'!','stun');
  }else if(name.indexOf('Hawk')>=0||name.indexOf('Wolf')>=0||name.indexOf('Panther')>=0||name.indexOf('Raptor')>=0||name.indexOf('Bear')>=0){
    // Big damage: 3x companionDmg
    var bigDmg=Math.round(companionDmg*3*(1-Math.min(monster.def/300,0.8)));
    monster.hp-=bigDmg;monster.hurtAnim=1;dmgDealt+=bigDmg;
    addFloat(monster.x,monster.y-60,'\uD83D\uDCA5 '+bigDmg,'#ff6644');
    SFX.hitHard();combatLog(companionName+' deals '+bigDmg+' heavy damage!','dmg');
  }else{
    // Default: 2x companionDmg
    var defDmg=Math.round(companionDmg*2*(1-Math.min(monster.def/300,0.8)));
    monster.hp-=defDmg;monster.hurtAnim=1;dmgDealt+=defDmg;
    addFloat(monster.x,monster.y-60,companionIcon+' '+defDmg,'#bb88ff');
    SFX.followerAbility();combatLog(companionName+' ability deals '+defDmg+'!','spell');
  }
}

// ===== FINISH ANIMATION =====
function finishAnim(){
  var hero=state.h1,monster=state.h2;
  if(!hero||!monster)return;
  hero.hurtAnim=0;monster.hurtAnim=0;
  if(phase==='playerAnim'){
    if(animAction==='flee'){
      if(fleeResult){endCombat('fled');return;}
    }
    if(monster.hp<=0){
      monster.hp=0;
      showTurnText(monster.name+' has been defeated!');SFX.win();
      combatLog(monster.name+' defeated!','death');
      for(var mi=0;mi<combatants.length;mi++)if(combatants[mi].id==='monster')combatants[mi].alive=false;
      phase='done';setTimeout(function(){endCombat(true);},500);return;
    }
    if(bloodlustActive&&animAction==='attack'){
      bloodlustActive=false;
      phase='playerAnim';animAction='attack';animSource=hero;animTarget=monster;
      animTimer=0;animDuration=200;showTurnText('Bloodlust: Extra attack!');return;
    }
    if(playerExtraAttacks>0&&animAction==='attack'){
      playerExtraAttacks--;
      phase='playerAnim';animAction='attack';animSource=hero;animTarget=monster;
      animTimer=0;animDuration=200;showTurnText('Rain of Fire: Extra attack!');return;
    }
    // Use AP system to determine next turn
    calcTimelinePreview();
    setTimeout(function(){advanceTurn();},100);
  }
  else if(phase==='monsterAnim'){
    if(monster.hp<=0){
      monster.hp=0;showTurnText(monster.name+' has been defeated!');SFX.win();
      combatLog(monster.name+' defeated!','death');
      for(var mi2=0;mi2<combatants.length;mi2++)if(combatants[mi2].id==='monster')combatants[mi2].alive=false;
      phase='done';setTimeout(function(){endCombat(true);},500);return;
    }
    if(hero.hp<=0){
      hero.hp=0;showTurnText(hero.name+' has fallen...');SFX.death();
      combatLog(hero.name+' has fallen!','death');
      for(var hi=0;hi<combatants.length;hi++)if(combatants[hi].id==='hero')combatants[hi].alive=false;
      phase='done';setTimeout(function(){endCombat(false);},500);return;
    }
    // Companion splash damage from monster attack
    if(companionAlive&&companionHp>0&&animAction==='monsterAttack'){
      var splash=Math.round(monster.baseDmg*0.3*(1-Math.min(companionDef/300,0.8)));
      if(splash>0){
        companionHp-=splash;
        addFloat(hero.x+30,hero.y+10,companionIcon+' -'+splash,'#cc66ff');
        if(companionHp<=0){
          companionHp=0;companionAlive=false;
          for(var ci=0;ci<combatants.length;ci++)if(combatants[ci].id==='companion')combatants[ci].alive=false;
          addFloat(hero.x+30,hero.y,companionName+' fell!','#ff4444');
          SFX.followerDeath();combatLog(companionName+' has fallen!','death');
        }
      }
    }
    calcTimelinePreview();
    setTimeout(function(){advanceTurn();},100);
  }
}

// ===== MONSTER TURN =====
function startMonsterTurn(){
  var hero=state.h1,monster=state.h2;
  if(!hero||!monster||phase==='done')return;
  if(hasStatus(monsterStatuses,'stunned')){
    showTurnText(monster.name+' is stunned!');
    combatLog(monster.name+' is stunned, skips turn!','stun');
    for(var si=monsterStatuses.length-1;si>=0;si--)if(monsterStatuses[si].id==='stunned'){monsterStatuses.splice(si,1);break;}
    // Cancel charged special on stun
    if(monsterChargingSpecial){
      addFloat(monster.x,monster.y-70,'CANCELLED!','#44ddbb');
      combatLog(monster.name+'\'s '+monsterChargingSpecial.id+' was cancelled by stun!','stun');
      monsterChargingSpecial=null;
    }
    phase='monsterAnim';
    setTimeout(function(){finishAnim();},150);
    return;
  }
  // Execute charged special if one is pending
  if(monsterChargingSpecial){
    var spec=monsterChargingSpecial;
    monsterChargingSpecial=null;
    executeMonsterSpecial(spec.id,hero,monster);
    return;
  }
  // Check if any special is ready to telegraph
  var readySpecial=null;
  for(var spi=0;spi<monsterSpecials.length;spi++){
    if(monsterSpecials[spi].cd<=0){readySpecial=monsterSpecials[spi];break;}
  }
  if(readySpecial){
    // Telegraph the special — show warning, reset cooldown, still attack this turn
    monsterChargingSpecial={id:readySpecial.id,telegraph:readySpecial.telegraph,icon:readySpecial.icon};
    readySpecial.cd=readySpecial.maxCd;
    showTurnText('\u26A0 '+monster.name+' '+readySpecial.telegraph);
    combatLog('\u26A0 '+monster.name+' '+readySpecial.telegraph,'spell');
    addFloat(monster.x,monster.y-70,'\u26A0 '+readySpecial.icon,'#ff6644');
  }
  // Normal attack
  phase='monsterAnim';animAction='monsterAttack';
  animSource=monster;animTarget=hero;
  animTimer=0;animDuration=autoBattle?150:250;
  if(!readySpecial)showTurnText(monster.name+' attacks!');
}

function executeMonsterSpecial(specId,hero,monster){
  phase='monsterAnim';
  if(specId==='heavyStrike'){
    // 2x damage attack
    animAction='monsterAttack';animSource=monster;animTarget=hero;
    animTimer=0;animDuration=350;
    // Temporarily double damage
    var origDmg=monster.baseDmg;
    monster.baseDmg=Math.round(origDmg*2);
    showTurnText('\uD83D\uDCA5 '+monster.name+' Heavy Strike!');
    combatLog(monster.name+' unleashes a heavy strike!','spell');
    // Restore after midpoint hit — use a flag
    monster._heavyStrikeRestore=origDmg;
  }
  else if(specId==='enrage'){
    // +50% damage for 2 rounds + still attacks
    if(!monsterEnraged){
      monsterEnraged=true;monsterEnragedRounds=2;
      monster.baseDmg=Math.round(monster.baseDmg*1.5);
      addStatus(monsterStatuses,'enraged','Enraged','\uD83D\uDCA2','#ff4444',99);
    }
    addFloat(monster.x,monster.y-60,'\uD83D\uDCA2 ENRAGE!','#ff4444');SFX.charge();
    combatLog(monster.name+' is enraged! +50% damage!','spell');
    // Still attack
    animAction='monsterAttack';animSource=monster;animTarget=hero;
    animTimer=0;animDuration=250;
    showTurnText('\uD83D\uDCA2 '+monster.name+' enrages and attacks!');
  }
  else if(specId==='poisonSpit'){
    // 3 rounds poison on hero, replaces attack
    heroPoisonTurns=3;
    addStatus(playerStatuses,'monsterPoison','Poisoned','\u2620','#88cc44',99);
    addFloat(hero.x,hero.y-60,'\u2620 POISONED!','#88cc44');SFX.poison();
    combatLog(monster.name+' poisons '+hero.name+'!','poison');
    showTurnText('\u2620 '+monster.name+' spits venom!');
    // No attack animation, skip straight to finish
    setTimeout(function(){finishAnim();},300);return;
  }
  else if(specId==='heal'){
    // Heal 15% maxHP, replaces attack
    var healAmt=Math.round(monster.maxHp*0.15);
    monster.hp=Math.min(monster.maxHp,monster.hp+healAmt);
    addFloat(monster.x,monster.y-60,'+'+healAmt+' HP','#44aa66');SFX.heal();
    combatLog(monster.name+' regenerates '+healAmt+' HP!','heal');
    showTurnText('\u{1F49A} '+monster.name+' regenerates!');
    setTimeout(function(){finishAnim();},300);return;
  }
  else if(specId==='warStomp'){
    // Stun hero 1 turn (dodgeable by evasion), replaces attack
    if(Math.random()<(hero.evasion||0)){
      addFloat(hero.x,hero.y-60,'DODGED STOMP!','#88ccff');SFX.dodge();
      combatLog(hero.name+' dodges the war stomp!','miss');
    }else{
      playerStunnedByMonster=true;
      addFloat(hero.x,hero.y-60,'\uD83D\uDCA5 STUNNED!','#ffcc22');SFX.stun();
      combatLog(monster.name+' stuns '+hero.name+' with a war stomp!','stun');
    }
    showTurnText('\uD83D\uDCA5 '+monster.name+' war stomps!');
    setTimeout(function(){finishAnim();},300);return;
  }
}

// ===== END COMBAT =====
function endCombat(result){
  if(rafId){cancelAnimationFrame(rafId);rafId=null;}
  var run=state.dgRun;
  if(!run)return;
  if(state.h1){
    run.hp=Math.max(0,Math.round(state.h1.hp));
    run.mana=Math.round(state.h1.mana||state.h1.resource||0);
  }
  run._lastCombatStats={
    turns:turnNum,dmgDealt:Math.round(dmgDealt),dmgTaken:Math.round(dmgTaken),
    hpBefore:run.hp,
    monsterName:state._dgCombatMonster?state._dgCombatMonster.name:'Unknown',
    monsterIcon:state._dgCombatMonster?state._dgCombatMonster.icon:'\u2694'
  };
  run._lastCombatLog=state.logs?state.logs.slice():[];
  run.totalDmgDealt=(run.totalDmgDealt||0)+Math.round(dmgDealt);
  run.totalDmgTaken=(run.totalDmgTaken||0)+Math.round(dmgTaken);
  state.h1=null;state.h2=null;state.over=false;
  state._dgCombatMonster=null;state._dgCombatActive=false;
  var actDiv=document.getElementById('dgTurnActions');
  if(actDiv)actDiv.remove();
  var ctrls=document.querySelector('#battleScreen .ctrls');
  if(ctrls)ctrls.style.display='';
  var btnGo=document.getElementById('btnGo');
  if(btnGo)btnGo.style.display='';
  var btnRst=document.querySelector('.btn-rst');
  if(btnRst)btnRst.style.display='';
  var btnBack=document.querySelector('#battleScreen .btn-back');
  if(btnBack)btnBack.style.display='';
  document.getElementById('battleScreen').style.display='none';
  document.getElementById('dungeonScreen').style.display='flex';
  if(result===true)dgCombatVictory();
  else if(result==='fled')generateRoom();
  else{run.hp=0;dgDeath();}
}

// ===== RENDER LOOP =====
function dgRender(now){
  if(!state._dgCombatActive)return;
  var dt=(now-lastTime)/1000;lastTime=now;
  if(dt>0.1)dt=0.1;
  state.bt+=dt*1000;
  updateAnim(dt);
  if(state.h1)state.h1.bobPhase+=dt*3;
  if(state.h2)state.h2.bobPhase+=dt*3;
  if(state.h1&&state.h1.hurtAnim>0)state.h1.hurtAnim=Math.max(0,state.h1.hurtAnim-dt*4);
  if(state.h2&&state.h2.hurtAnim>0)state.h2.hurtAnim=Math.max(0,state.h2.hurtAnim-dt*4);
  if(state.h1&&state.h1.castAnim>0)state.h1.castAnim=Math.max(0,state.h1.castAnim-dt*2);
  if(state.h2&&state.h2.castAnim>0)state.h2.castAnim=Math.max(0,state.h2.castAnim-dt*2);
  for(var fi=floats.length-1;fi>=0;fi--){
    floats[fi].life-=dt;floats[fi].y-=35*dt;
    if(floats[fi].life<=0)floats.splice(fi,1);
  }
  if(turnTextTimer>0)turnTextTimer-=dt;
  var ctx=state.ctx;
  if(!ctx){rafId=requestAnimationFrame(dgRender);return;}
  ctx.clearRect(0,0,CW,CH);
  // Sky gradient
  var b=getBiome();
  var skyG=ctx.createLinearGradient(0,0,0,CH);
  skyG.addColorStop(0,b.skyTop);skyG.addColorStop(0.5,b.skyMid);skyG.addColorStop(1,b.skyBot);
  ctx.fillStyle=skyG;ctx.fillRect(0,0,CW,CH);
  // Fog
  if(b.fogCol){
    ctx.fillStyle=b.fogCol;
    for(var fi2=0;fi2<3;fi2++){
      var fy=AY+fi2*120+Math.sin(state.bt/2000+fi2)*20;
      ctx.globalAlpha=0.3+Math.sin(state.bt/3000+fi2*2)*0.1;
      ctx.fillRect(AX,fy,AW,80);ctx.globalAlpha=1;
    }
  }
  // Scanlines
  ctx.fillStyle='rgba(0,0,0,0.015)';
  for(var sl=0;sl<CH;sl+=2)ctx.fillRect(0,sl,CW,1);
  // Ground
  if(!state.groundTiles)initGround();
  for(var gi=0;gi<state.groundTiles.length;gi++){
    var t=state.groundTiles[gi];
    ctx.fillStyle=t.col;ctx.fillRect(t.x,t.y,t.w,t.h);
    if(t.hasGrass&&t.grassCol){
      ctx.fillStyle=t.grassCol;
      for(var gbi=0;gbi<3;gbi++){
        var gx=t.x+5+Math.random()*(t.w-10);
        ctx.fillRect(gx,t.y-2,2,4);ctx.fillRect(gx+2,t.y-3,2,3);
      }
    }
  }
  ctx.fillStyle=b.groundEdge;ctx.fillRect(AX,GY-2,AW,3);
  // Biome decorations
  if(b.decor==='lava'){
    for(var li=0;li<6;li++){
      var lx=AX+80+li*140,ly=GY+15+Math.sin(li*1.7)*8;
      var pulse=Math.sin(state.bt/500+li*1.3)*0.3+0.7;
      ctx.fillStyle='rgba(200,60,0,'+pulse*0.15+')';ctx.fillRect(lx-10,ly,20,8);
      ctx.fillStyle='#cc3300';ctx.fillRect(lx-6,ly+2,12,4);
      ctx.fillStyle='#ff6622';ctx.fillRect(lx-3,ly+3,6,2);
    }
  }else if(b.decor==='ice'){
    for(var ii=0;ii<8;ii++){
      var ix=AX+50+ii*115,iy=GY+8+Math.sin(ii*2.3)*6;
      ctx.fillStyle='#2a3a4a';ctx.fillRect(ix,iy,8,12);
      ctx.fillStyle='#4a6a8a';ctx.fillRect(ix+1,iy+1,6,4);
      ctx.fillStyle='rgba(100,180,220,0.15)';ctx.fillRect(ix-2,iy-3,12,3);
    }
  }else if(b.decor==='void'){
    for(var vi=0;vi<5;vi++){
      var vx=AX+100+vi*170,vy2=GY+10;
      var vPulse=Math.sin(state.bt/800+vi*2)*0.4+0.6;
      ctx.fillStyle='rgba(120,40,200,'+vPulse*0.1+')';
      ctx.beginPath();ctx.arc(vx,vy2,15+vPulse*5,0,6.28);ctx.fill();
      ctx.fillStyle='rgba(160,80,255,'+vPulse*0.15+')';
      ctx.beginPath();ctx.arc(vx,vy2,6,0,6.28);ctx.fill();
    }
  }else if(b.decor==='roots'){
    for(var ri=0;ri<6;ri++){
      var rx=AX+70+ri*130,ry=GY-5;
      ctx.fillStyle='#1a2a1a';ctx.fillRect(rx,ry,4,15);ctx.fillRect(rx-3,ry+4,3,8);ctx.fillRect(rx+3,ry+6,4,6);
      ctx.fillStyle='#2a3a2a';ctx.fillRect(rx+1,ry+1,2,12);
    }
  }else if(b.decor==='bone'){
    for(var bi=0;bi<7;bi++){
      var bx=AX+60+bi*120,by=GY+10+Math.sin(bi*2.7)*5;
      ctx.fillStyle='#4a3a2a';ctx.fillRect(bx,by,10,3);ctx.fillRect(bx+2,by-2,2,7);
      ctx.fillStyle='#5a4a3a';ctx.fillRect(bx+1,by+1,8,1);
    }
  }else{
    for(var si2=0;si2<8;si2++){
      var sx=AX+60+si2*110,sy=GY+10+Math.sin(si2*2.1)*8;
      ctx.fillStyle=b.stoneCol;ctx.fillRect(sx,sy,12,6);
      ctx.fillStyle=b.stoneLt;ctx.fillRect(sx+2,sy+1,8,4);
    }
  }
  // Ambient particles
  spawnAmbient(b);updAmbient(dt);
  for(var ai=0;ai<ambientParticles.length;ai++){
    var ap=ambientParticles[ai];
    var aa=Math.min(1,ap.life/ap.maxLife);
    if(ap.type==='wisp'){aa*=(0.4+Math.sin(ap.phase)*0.3);ctx.shadowColor=ap.col;ctx.shadowBlur=6;}
    ctx.globalAlpha=aa*0.6;ctx.fillStyle=ap.col;
    ctx.fillRect(ap.x-ap.r/2,ap.y-ap.r/2,ap.r,ap.r);
    ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
  // Draw fighters
  if(state.h1)drawHero(state.h1);
  if(state.h2)drawHero(state.h2);
  // Companion HP bar
  if(companionAlive&&state.h1){
    var chpP=Math.max(0,companionHp/companionMaxHp);
    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(state.h1.x+18,state.h1.y+5,40,6);
    ctx.fillStyle=chpP>0.3?'#bb88ff':'#cc3300';ctx.fillRect(state.h1.x+19,state.h1.y+6,Math.round(38*chpP),4);
    ctx.strokeStyle='#6a4a8a';ctx.lineWidth=0.5;ctx.strokeRect(state.h1.x+17.5,state.h1.y+4.5,41,7);
    ctx.fillStyle='#bb88ff';ctx.font='bold 7px "Cinzel"';ctx.textAlign='left';
    ctx.fillText(companionIcon+' '+companionName,state.h1.x+18,state.h1.y+2);
  }
  // Status icons
  drawStatuses(ctx,playerStatuses,state.h1);
  drawStatuses(ctx,monsterStatuses,state.h2);
  // Floating numbers
  for(var fli=0;fli<floats.length;fli++){
    var f=floats[fli];
    ctx.globalAlpha=f.life/f.maxLife;
    ctx.fillStyle='#000';ctx.font='bold 14px "Cinzel"';ctx.textAlign='center';
    ctx.fillText(f.text,f.x+1,f.y+1);
    ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);
    ctx.globalAlpha=1;
  }
  // Turn indicator text
  if(turnTextTimer>0&&turnText){
    var ttA=Math.min(1,turnTextTimer/0.5);
    ctx.globalAlpha=ttA*0.9;
    ctx.fillStyle='#000';ctx.font='bold 16px "Cinzel"';ctx.textAlign='center';
    ctx.fillText(turnText,CW/2+1,AY+25+1);
    ctx.fillStyle='#ffcc44';ctx.fillText(turnText,CW/2,AY+25);
    ctx.globalAlpha=1;
  }
  // Turn counter
  ctx.fillStyle='rgba(0,0,0,0.4)';ctx.font='bold 10px "Cinzel"';ctx.textAlign='center';
  ctx.fillText('Turn '+turnNum,CW/2,AY-5);
  // Timeline bar
  var tlCount=Math.min(timelinePreview.length,8);
  var tlSlotW=52,tlGap=3,tlTotalW=tlCount*(tlSlotW+tlGap)-tlGap;
  var tlY=AY+36,tlX=CW/2-tlTotalW/2;
  // Background panel
  ctx.fillStyle='rgba(0,0,0,0.5)';
  ctx.fillRect(tlX-6,tlY-14,tlTotalW+12,36);
  ctx.strokeStyle='rgba(200,180,120,0.25)';ctx.lineWidth=1;
  ctx.strokeRect(tlX-6.5,tlY-14.5,tlTotalW+13,37);
  // Label
  ctx.font='bold 7px "Cinzel"';ctx.fillStyle='#8a7a5a';ctx.textAlign='center';
  ctx.fillText('TURN ORDER',CW/2,tlY-7);
  var heroName=state.h1?state.h1.name:'Hero';
  var monName=state.h2?state.h2.name:'Enemy';
  for(var tli=0;tli<tlCount;tli++){
    var tlid=timelinePreview[tli];
    var tlBx=tlX+tli*(tlSlotW+tlGap);
    var isCurrent=tli===0;
    // Slot colors
    var bgCol,borderCol,textCol,label;
    if(tlid==='hero'){
      bgCol=isCurrent?'rgba(80,180,80,0.5)':'rgba(60,120,60,0.35)';
      borderCol='#66cc66';textCol='#88ff88';label='YOU';
    }else if(tlid==='companion'){
      bgCol=isCurrent?'rgba(160,100,200,0.5)':'rgba(120,70,160,0.35)';
      borderCol='#bb88ff';textCol='#cc99ff';label=companionName.length>6?companionName.substring(0,6):companionName;
    }else{
      bgCol=isCurrent?'rgba(200,60,40,0.5)':'rgba(150,50,40,0.35)';
      borderCol='#ff6644';textCol='#ff8866';label=monName.length>6?monName.substring(0,6):monName;
    }
    // Draw slot
    ctx.fillStyle=bgCol;ctx.fillRect(tlBx,tlY,tlSlotW,18);
    ctx.strokeStyle=isCurrent?'#ffcc44':borderCol;ctx.lineWidth=isCurrent?2:1;
    ctx.strokeRect(tlBx+0.5,tlY+0.5,tlSlotW-1,17);
    // Icon + label
    ctx.textAlign='center';
    var icon=tlid==='hero'?'\u2694\uFE0F':tlid==='companion'?(companionIcon||'\uD83D\uDC3E'):((state.h2&&state.h2.monsterIcon)||'\uD83D\uDC80');
    ctx.font='10px sans-serif';ctx.fillText(icon,tlBx+12,tlY+14);
    ctx.font=isCurrent?'bold 8px "Cinzel"':'7px "Cinzel"';ctx.fillStyle=textCol;
    ctx.textAlign='left';ctx.fillText(label,tlBx+22,tlY+13);
    // Charging indicator on monster turns
    if(tlid==='monster'&&monsterChargingSpecial){
      var flashA=Math.sin(state.bt/150)*0.3+0.7;
      ctx.globalAlpha=flashA;ctx.fillStyle='#ff4444';ctx.font='9px sans-serif';
      ctx.textAlign='center';ctx.fillText('\u26A0',tlBx+tlSlotW-6,tlY+6);ctx.globalAlpha=1;
    }
    // Arrow between slots
    if(tli<tlCount-1){
      ctx.fillStyle='rgba(200,180,120,0.3)';ctx.textAlign='center';ctx.font='8px sans-serif';
      ctx.fillText('\u25B8',tlBx+tlSlotW+1,tlY+12);
    }
  }
  // Telegraph warning
  if(monsterChargingSpecial&&state.h2){
    var twFlash=Math.sin(state.bt/150)*0.3+0.7;
    ctx.globalAlpha=twFlash;
    ctx.fillStyle='#ff4444';ctx.font='bold 11px "Cinzel"';ctx.textAlign='center';
    ctx.fillText('\u26A0 '+state.h2.name+' '+monsterChargingSpecial.telegraph,CW/2,GY+35);
    ctx.globalAlpha=1;
  }
  // Phase indicator
  if(phase==='pick'){
    var pickP=Math.sin(state.bt/300)*0.2+0.8;
    ctx.globalAlpha=pickP;ctx.fillStyle='#88ff88';ctx.font='bold 12px "Cinzel"';ctx.textAlign='center';
    ctx.fillText('\u25B6 YOUR TURN \u2014 Choose an action!',CW/2,tlY+34);ctx.globalAlpha=1;
  }else if(phase==='monsterAnim'){
    ctx.fillStyle='#ff6644';ctx.font='bold 12px "Cinzel"';ctx.textAlign='center';
    ctx.fillText('\uD83D\uDC80 ENEMY TURN',CW/2,tlY+34);
  }
  rafId=requestAnimationFrame(dgRender);
}

// ===== DRAW STATUS ICONS =====
function drawStatuses(ctx,statuses,hero){
  if(!hero||statuses.length===0)return;
  var startX=hero.x-(statuses.length*18)/2;
  var y=hero.y+14;
  for(var i=0;i<statuses.length;i++){
    var s=statuses[i];
    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(startX+i*18-1,y-1,16,14);
    ctx.fillStyle=s.color;ctx.font='10px sans-serif';ctx.textAlign='center';
    ctx.fillText(s.icon,startX+i*18+7,y+10);
    ctx.fillStyle='#fff';ctx.font='bold 7px "Cinzel"';
    ctx.fillText(s.turnsLeft,startX+i*18+13,y+4);
  }
}
