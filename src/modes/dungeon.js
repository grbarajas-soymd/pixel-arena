// =============== DUNGEON SYSTEM ===============
import { state } from '../gameState.js';
import { CLASSES } from '../data/classes.js';
import { ALL_SKILLS, ALL_ULTS } from '../data/skills.js';
import { FOLLOWER_TEMPLATES, RARITY_COLORS, rollFollower } from '../data/followers.js';
import { addBl } from '../combat/engine.js';
import { getCustomTotalStats, getStashBonuses, renderStashSummary } from '../combat/hero.js';
import { buildCharTooltip, buildCustomTooltip, updateFollowerDisplays } from '../render/ui.js';

var DG_MONSTERS=[
  {name:'Goblin Scout',icon:'\u{1F47A}',hp:400,dmg:45,def:8,tier:1},
  {name:'Cave Bat',icon:'\u{1F987}',hp:280,dmg:60,def:3,tier:1},
  {name:'Slime',icon:'\u{1F7E2}',hp:550,dmg:35,def:12,tier:1},
  {name:'Skeleton',icon:'\u{1F480}',hp:450,dmg:55,def:10,tier:1},
  {name:'Orc Warrior',icon:'\u{1F479}',hp:800,dmg:85,def:22,tier:2},
  {name:'Dark Mage',icon:'\u{1F9D9}',hp:600,dmg:115,def:12,tier:2},
  {name:'Troll',icon:'\u{1F9CC}',hp:1100,dmg:75,def:30,tier:2},
  {name:'Ghost',icon:'\u{1F47B}',hp:550,dmg:100,def:8,tier:2,evasion:0.2},
  {name:'Minotaur',icon:'\u{1F402}',hp:1500,dmg:125,def:35,tier:3},
  {name:'Lich',icon:'\u2620\uFE0F',hp:1000,dmg:155,def:18,tier:3},
  {name:'Stone Golem',icon:'\u{1F5FF}',hp:2000,dmg:95,def:55,tier:3},
  {name:'Wyvern',icon:'\u{1F409}',hp:1200,dmg:145,def:25,tier:3},
  {name:'Dragon',icon:'\u{1F432}',hp:2800,dmg:185,def:45,tier:4},
  {name:'Demon Lord',icon:'\u{1F608}',hp:2400,dmg:210,def:40,tier:4},
  {name:'Ancient Wyrm',icon:'\u{1F40D}',hp:3500,dmg:165,def:50,tier:4},
];

export function buildDungeonPicker(){
  var cont=document.getElementById('dgClassPick');cont.innerHTML='';
  var classes=['wizard','ranger','assassin','barbarian'];
  classes.forEach(function(key){
    var c=CLASSES[key];var card=document.createElement('div');
    card.className='class-card '+(key==='wizard'?'wiz':key==='ranger'?'rgr':key==='assassin'?'asn':'bar')+(state.dgClass===key?' selected':'');
    card.innerHTML='<div class="cc-icon">'+c.icon+'</div><div class="cc-name '+(key==='wizard'?'wiz':key==='ranger'?'rgr':key==='assassin'?'asn':'bar')+'">'+c.name+'</div><div class="cc-stats">'+c.hp+'HP '+c.baseDmg+'dmg</div>'+buildCharTooltip(key);
    card.onclick=function(){state.dgClass=key;buildDungeonPicker()};
    cont.appendChild(card);
  });
  var cs=getCustomTotalStats();
  var cc=document.createElement('div');cc.className='class-card cst'+(state.dgClass==='custom'?' selected':'');
  cc.innerHTML='<div class="cc-icon">\u2692</div><div class="cc-name cst">'+state.customChar.name+'</div><div class="cc-stats">'+Math.round(cs.hp)+'HP '+Math.round(cs.baseDmg)+'dmg</div>'+buildCustomTooltip();
  cc.onclick=function(){state.dgClass='custom';buildDungeonPicker()};
  cont.appendChild(cc);
  var stashEl=document.getElementById('dgStashDisplay');
  if(stashEl){
    stashEl.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:center">'+
      '<div>\u{1F392} P1 Items: '+renderStashSummary(1)+'</div>'+
      '<div>\u{1F392} P2 Items: '+renderStashSummary(2)+'</div>'+
    '</div><div style="margin-top:3px;color:#88aacc;font-size:.44rem">Items carry over to Ladder mode!</div>';
  }
}

export function startDungeon(){
  var isCustom=(state.dgClass==='custom');
  var c=isCustom?null:CLASSES[state.dgClass];
  var cs=isCustom?getCustomTotalStats():null;
  var heroName=isCustom?state.customChar.name:c.nameShort;
  var heroHp=isCustom?Math.round(cs.hp):c.hp;
  var heroDmg=isCustom?Math.round(cs.baseDmg):c.baseDmg;
  var heroAS=isCustom?cs.baseAS:c.baseAS;
  var heroDef=isCustom?cs.def:c.def;
  var heroEva=isCustom?cs.evasion:(c.evasion||0);
  var dgHpScale={wizard:0.6,ranger:0.7,assassin:0.65,barbarian:0.85,custom:0.7};
  heroHp=Math.round(heroHp*(dgHpScale[state.dgClass]||0.7));
  var maxMana=100;
  var spellCosts={wizard:40,ranger:35,assassin:30,barbarian:25,custom:35};
  state.dgRun={
    heroClass:state.dgClass,heroName:heroName,
    hp:heroHp,maxHp:heroHp,
    baseDmg:heroDmg,baseAS:heroAS,def:heroDef,evasion:heroEva,
    floor:1,room:0,gold:0,
    items:[],followers:[],
    log:[],state:'exploring',
    combatEnemy:null,combatTurn:0,
    potions:2,maxPotions:3,
    bonusDmg:0,bonusDef:0,bonusHp:0,bonusAS:0,
    _spellUsed:false,
    mana:maxMana,maxMana:maxMana,manaRegen:8,
    spellCost:spellCosts[state.dgClass]||35,
    roomHistory:[],
    totalKills:0,totalDmgDealt:0,totalDmgTaken:0,
    _lastCombatStats:null,
  };
  state.dgRun.hp+=state.dgRun.bonusHp;state.dgRun.maxHp+=state.dgRun.bonusHp;
  dgLog('You descend into the depths...','info');
  document.getElementById('dungeonPickScreen').style.display='none';
  document.getElementById('dungeonRunScreen').style.display='block';
  dgUpdateProgress();
  generateRoom();
}

function dgLog(msg,type){
  if(!state.dgRun)return;
  state.dgRun.log.push({msg:msg,type:type||'info'});
  var el=document.getElementById('dgLog');if(!el)return;
  var html='';state.dgRun.log.slice(-30).forEach(function(e){
    html+='<div class="dg-log-entry dg-log-'+e.type+'">'+e.msg+'</div>';
  });
  el.innerHTML=html;el.scrollTop=el.scrollHeight;
}

function updateDgUI(){
  if(!state.dgRun)return;
  var r=state.dgRun;
  var hi=document.getElementById('dgHeroInfo');
  var hpPct=Math.max(0,r.hp/r.maxHp*100);
  var hpCol=hpPct>30?'#44ee88':'#ff4444';
  var className=r.heroClass==='custom'?'Custom':(CLASSES[r.heroClass]?CLASSES[r.heroClass].name:'Unknown');
  hi.innerHTML='<div class="dg-hero-info"><b>'+r.heroName+'</b> ('+className+')<br>'+
    '<div class="dg-hero-bar"><div class="bar-label" style="font-size:.52rem"><span style="color:'+hpCol+'">HP</span><span>'+Math.round(r.hp)+'/'+r.maxHp+'</span></div><div class="bar-track"><div class="bar-fill" style="width:'+hpPct+'%;background:linear-gradient(90deg,#1a4a1a,'+hpCol+')"></div></div></div>'+
    'DMG: '+(r.baseDmg+r.bonusDmg)+' | DEF: '+(r.def+r.bonusDef)+'<br>'+
    'AS: '+r.baseAS.toFixed(2)+' ('+Math.max(1,Math.round(r.baseAS+r.bonusAS))+' hits/rnd) | EVA: '+Math.round(r.evasion*100)+'%<br>'+
    'Mana: <span style="color:#88aaff">'+Math.round(r.mana)+'/'+r.maxMana+'</span> | Gold: <span style="color:var(--gold-bright)">'+r.gold+'</span> | Potions: <span style="color:#44aa66">'+r.potions+'</span>'+
    '</div>';
  document.getElementById('dgFloorNum').textContent='FLOOR '+r.floor;
  var inv=document.getElementById('dgInventory');
  if(r.items.length===0)inv.innerHTML='<div style="font-size:.48rem;color:var(--parch-dk);padding:4px">Empty</div>';
  else{var ih='';r.items.forEach(function(it){ih+='<div class="dg-inv-item"><span class="dg-inv-icon">'+it.icon+'</span><span>'+it.name+'</span></div>'});inv.innerHTML=ih}
  var fc=document.getElementById('dgFollowers');
  if(r.followers.length===0)fc.innerHTML='<div style="font-size:.48rem;color:var(--parch-dk);padding:4px">None yet</div>';
  else{var fh='';r.followers.forEach(function(f){fh+='<div class="dg-inv-item"><span class="dg-inv-icon">'+f.icon+'</span><span class="dg-loot-name '+f.rarity+'">'+f.name+'</span></div>'});fc.innerHTML=fh}
}

function dgUpdateProgress(){
  if(!state.dgRun)return;
  var r=state.dgRun;
  var totalRooms=8*3;
  var done=(r.floor-1)*3+r.room;
  var pct=Math.min(100,Math.round(done/totalRooms*100));
  var fill=document.getElementById('dgProgressFill');
  var label=document.getElementById('dgProgressLabel');
  var stats=document.getElementById('dgProgressStats');
  if(fill)fill.style.width=pct+'%';
  if(label)label.textContent='Floor '+r.floor+' \u2014 Room '+r.room+'/3';
  if(stats)stats.textContent='\u2620'+r.totalKills+' | \u{1F47E}'+r.followers.length+' | \u{1F4B0}'+r.gold;
  var map=document.getElementById('dgRoomMap');if(!map)return;
  var html='';
  var ROOM_ICONS={combat:'\u2694',treasure:'\u{1F4B0}',trap:'\u26A0',rest:'\u{1F3D5}',shrine:'\u26E9',follower_cage:'\u{1F47E}',merchant:'\u{1F3EA}'};
  var lastFloor=0;
  r.roomHistory.forEach(function(rh){
    if(rh.floor>lastFloor&&lastFloor>0)html+='<div class="rm-dot floor-sep"></div>';
    lastFloor=rh.floor;
    var cls='rm-dot'+(rh.cleared?' cleared':'')+(rh.room===3?' boss':'');
    if(rh.floor===r.floor&&rh.room===r.room)cls+=' current';
    html+='<div class="'+cls+'" title="F'+rh.floor+'R'+rh.room+': '+(rh.name||rh.type)+'">'+(ROOM_ICONS[rh.type]||'?')+'</div>';
  });
  map.innerHTML=html;
}

function dgShowIntermission(title,titleColor,bodyHtml,nextLabel,nextFn){
  var rc=document.getElementById('dgRoomContent');
  var r=state.dgRun;
  rc.innerHTML='<div class="dg-intermission">'+
    '<div class="dg-im-title" style="color:'+(titleColor||'var(--parch)')+'">'+title+'</div>'+
    '<div class="dg-im-summary">'+bodyHtml+'</div>'+
    '<div style="margin:6px 0">'+
      '<span class="dg-im-stat" style="color:#44ee88">HP: '+Math.round(r.hp)+'/'+r.maxHp+'</span>'+
      '<span class="dg-im-stat" style="color:var(--gold-bright)">Gold: '+r.gold+'</span>'+
      '<span class="dg-im-stat" style="color:#88aacc">Kills: '+r.totalKills+'</span>'+
      '<span class="dg-im-stat" style="color:#cc66ff">Followers: '+r.followers.length+'</span>'+
    '</div>'+
    '<div class="dg-choices"><button class="dg-choice gold-c" onclick="'+nextFn+'">'+(nextLabel||'\u27A1\uFE0F Continue')+'</button></div>'+
  '</div>';
  dgUpdateProgress();updateDgUI();
}

function dgShowFollowerCapture(f,afterFn){
  var tmpl=FOLLOWER_TEMPLATES.find(function(t){return t.name===f.name});
  var abilityLine=f.abilityName?'<div class="fim-ability">\u26A1 <b>'+f.abilityName+'</b>: '+f.abilityDesc+'</div>':'';
  if(tmpl&&tmpl.abilityName)abilityLine='<div class="fim-ability">\u26A1 <b>'+tmpl.abilityName+'</b>: '+tmpl.abilityDesc+'</div>';
  var wagerLine='';
  if(f.wagerDebuffName)wagerLine='<div class="fim-wager">\u{1F3B2} Wager: '+f.wagerDebuffName+' ('+f.wagerDebuffDesc+')</div>';
  else if(tmpl&&tmpl.wagerDebuff)wagerLine='<div class="fim-wager">\u{1F3B2} Wager: '+tmpl.wagerDebuff.name+' ('+tmpl.wagerDebuff.desc+')</div>';
  var sellPrice=({common:15,uncommon:30,rare:60,epic:120,legendary:250})[f.rarity]||20;
  var col=state.dungeonPlayer===1?state.p1Collection:state.p2Collection;
  var runFollowers=state.dgRun.followers||[];
  var allOwned=col.concat(runFollowers);
  var hasDupe=allOwned.some(function(o){return o.name===f.name});
  var sameRarity=allOwned.filter(function(o){return o.rarity===f.rarity}).length;
  var totalOwned=allOwned.length;
  var contextHtml='<div style="font-size:.45rem;color:var(--parch-dk);margin-top:6px;line-height:1.6">';
  if(hasDupe)contextHtml+='<span style="color:#ffaa44">\u26A0 You already have a '+f.name+'</span><br>';
  else contextHtml+='<span style="color:#44ee88">\u2728 New to your collection!</span><br>';
  contextHtml+='Collection: '+totalOwned+' followers ('+sameRarity+' '+f.rarity+')';
  if(totalOwned>=3)contextHtml+=' \u2014 <span style="color:#88aacc">Max 3 fighters in arena</span>';
  contextHtml+='</div>';
  var powerScore=f.combatHp*0.5+f.combatDmg*10+f.combatAS*200+f.combatDef*5;
  var bestPower=0;var bestName='none';
  allOwned.forEach(function(o){
    var ps=o.combatHp*0.5+o.combatDmg*10+o.combatAS*200+o.combatDef*5;
    if(ps>bestPower){bestPower=ps;bestName=o.name}
  });
  var powerHtml='';
  if(totalOwned>0){
    if(powerScore>bestPower)powerHtml='<div style="font-size:.45rem;color:#44ee88;margin-top:2px">\u2B06 Strongest follower you\'d own!</div>';
    else powerHtml='<div style="font-size:.45rem;color:var(--parch-dk);margin-top:2px">Best: '+bestName+' ('+Math.round(bestPower)+'\u2605) vs this: '+Math.round(powerScore)+'\u2605</div>';
  }
  var rc=document.getElementById('dgRoomContent');
  state.dgRun._pendingCaptureFollower=f;
  state.dgRun._pendingCaptureAfter=afterFn;
  state.dgRun._pendingCaptureSellPrice=sellPrice;
  rc.innerHTML='<div class="dg-intermission">'+
    '<div class="dg-im-title" style="color:'+RARITY_COLORS[f.rarity]+'">\u2728 FOLLOWER CAPTURED! \u2728</div>'+
    '<div class="dg-im-follower '+f.rarity+'">'+
      '<div class="fim-icon">'+f.icon+'</div>'+
      '<div class="fim-name" style="color:'+RARITY_COLORS[f.rarity]+'">'+f.name+'</div>'+
      '<div class="fim-rarity" style="color:'+RARITY_COLORS[f.rarity]+'">'+f.rarity+'</div>'+
      '<div class="fim-buff">Arena Buff: '+f.buffDesc+'</div>'+
      abilityLine+wagerLine+
      '<div style="font-size:.45rem;color:var(--parch-dk);margin-top:4px">Combat: '+f.combatHp+'HP / '+f.combatDmg+'DMG / '+f.combatAS+'AS / '+f.combatDef+'DEF</div>'+
      contextHtml+powerHtml+
    '</div>'+
    '<div class="dg-choices">'+
      '<button class="dg-choice" style="border-color:'+RARITY_COLORS[f.rarity]+';color:'+RARITY_COLORS[f.rarity]+'" onclick="dgKeepFollower()">\u{1F3AF} Keep '+f.name+'</button>'+
      '<button class="dg-choice gold-c" onclick="dgSellFollower()">\u{1F4B0} Release for '+sellPrice+'g</button>'+
    '</div>'+
  '</div>';
  updateDgUI();
}

export function dgKeepFollower(){
  if(!state.dgRun._pendingCaptureFollower)return;
  state.dgRun.followers.push(state.dgRun._pendingCaptureFollower);
  dgLog('Kept '+state.dgRun._pendingCaptureFollower.name+'! ('+state.dgRun._pendingCaptureFollower.rarity+')','loot');
  var afterFn=state.dgRun._pendingCaptureAfter;
  state.dgRun._pendingCaptureFollower=null;
  updateDgUI();
  if(afterFn)afterFn();else setTimeout(generateRoom,300);
}

export function dgSellFollower(){
  if(!state.dgRun._pendingCaptureFollower)return;
  var price=state.dgRun._pendingCaptureSellPrice||20;
  state.dgRun.gold+=price;
  dgLog('Released '+state.dgRun._pendingCaptureFollower.name+' for '+price+'g.','loot');
  var afterFn=state.dgRun._pendingCaptureAfter;
  state.dgRun._pendingCaptureFollower=null;
  updateDgUI();
  if(afterFn)afterFn();else setTimeout(generateRoom,300);
}

export function generateRoom(){
  if(!state.dgRun||state.dgRun.state==='dead')return;
  state.dgRun.room++;
  if(state.dgRun.room>3){
    state.dgRun.floor++;state.dgRun.room=1;
    dgLog('Descended to Floor '+state.dgRun.floor+'!','good');
    dgShowIntermission(
      '\u2B07 FLOOR '+state.dgRun.floor+' \u2B07','#44ee88',
      'No rest for the weary...<br>Rooms cleared: <b>'+state.dgRun.roomHistory.length+'</b> | Monsters slain: <b>'+state.dgRun.totalKills+'</b>',
      '\u2B07 Descend','_dgActualGenerateRoom()'
    );
    return;
  }
  _dgActualGenerateRoom();
}

export function _dgActualGenerateRoom(){
  var roomType;
  if(state.dgRun.room===3)roomType='combat';
  else{
    var types=['combat','combat','treasure','trap','rest','shrine','follower_cage'];
    if(state.dgRun.floor>=3)types.push('merchant');
    roomType=types[Math.floor(Math.random()*types.length)];
  }
  state.dgRun.roomHistory.push({floor:state.dgRun.floor,room:state.dgRun.room,type:roomType,cleared:false,name:''});
  renderRoom(roomType);
  dgUpdateProgress();updateDgUI();
}

function dgDmgEstimates(){
  if(!state.dgRun||!state.dgRun.combatEnemy)return{youMin:0,youMax:0,themMin:0,themMax:0,youAvg:0,themAvg:0};
  var r=state.dgRun,m=r.combatEnemy;
  var rawHero=r.baseDmg+r.bonusDmg;
  var heroMit=rawHero*(1-Math.min(m.def/300,0.8));
  var youMin=Math.round(heroMit*0.85);var youMax=Math.round(heroMit*1.15);
  var rawMon=m.dmg;
  var monMit=rawMon*(1-Math.min((r.def+r.bonusDef)/300,0.8));
  var themMin=Math.round(monMit*0.85);var themMax=Math.round(monMit*1.15);
  return{youMin:youMin,youMax:youMax,themMin:themMin,themMax:themMax,youAvg:Math.round((youMin+youMax)/2),themAvg:Math.round((themMin+themMax)/2)};
}

function dgCombatButtons(){
  var r=state.dgRun;
  var est=dgDmgEstimates();
  var evaPct=r.evasion?Math.round(r.evasion*100):0;
  var monEva=r.combatEnemy&&r.combatEnemy.evasion?Math.round(r.combatEnemy.evasion*100):0;
  var hits=Math.max(1,Math.round(r.baseAS+r.bonusAS));
  var hitLabel=hits>1?' (\u00D7'+hits+')':'';
  var classBtn='';
  var cc=r.heroClass;
  var canCast=r.mana>=r.spellCost;
  var costLabel=' ('+r.spellCost+' mana)';
  if(cc==='wizard'&&canCast)classBtn='<button class="dg-choice" style="border-color:#44ddbb;color:#44ddbb" onclick="dgClassMove()">\u26A1 Chain Lightning ('+Math.round(est.youAvg*2.5)+' magic'+costLabel+')</button>';
  else if(cc==='ranger'&&canCast)classBtn='<button class="dg-choice" style="border-color:#ffaa44;color:#ffaa44" onclick="dgClassMove()">\u{1F525} Rain of Fire ('+Math.round(est.youAvg*2)+' + bleed'+costLabel+')</button>';
  else if(cc==='assassin'&&canCast)classBtn='<button class="dg-choice" style="border-color:#66ccff;color:#66ccff" onclick="dgClassMove()">\u2744 Ambush ('+Math.round(est.youAvg*3)+' crit'+costLabel+')</button>';
  else if(cc==='barbarian'&&canCast)classBtn='<button class="dg-choice" style="border-color:#cc4444;color:#cc4444" onclick="dgClassMove()">\u{1F480} Rampage ('+Math.round(est.youAvg*2)+' + lifesteal'+costLabel+')</button>';
  else if(cc==='custom'&&canCast){
    var cSkillName=state.customChar.skills[0]!==null&&ALL_SKILLS[state.customChar.skills[0]]?ALL_SKILLS[state.customChar.skills[0]].name:'Power Surge';
    var cSkillIcon=state.customChar.skills[0]!==null&&ALL_SKILLS[state.customChar.skills[0]]?ALL_SKILLS[state.customChar.skills[0]].icon:'\u2692';
    classBtn='<button class="dg-choice" style="border-color:#ff88ff;color:#ff88ff" onclick="dgClassMove()">'+cSkillIcon+' '+cSkillName+' ('+Math.round(est.youAvg*2.2)+costLabel+')</button>';
  }
  return '<div class="dg-dmg-est">'+
    '<span class="est-you">You deal: ~'+est.youMin+'\u2013'+est.youMax+hitLabel+(monEva?' ('+monEva+'% miss)':'')+'</span>'+
    '<span class="est-them">They deal: ~'+est.themMin+'\u2013'+est.themMax+(evaPct?' ('+evaPct+'% dodge)':'')+'</span>'+
  '</div>'+
  '<div class="dg-choices" style="flex-wrap:wrap">'+
    '<button class="dg-choice danger" onclick="dgCombatRound(\'normal\')">\u2694 Strike (~'+est.youAvg+hitLabel+')</button>'+
    '<button class="dg-choice" style="border-color:#ff8844;color:#ff8844" onclick="dgCombatRound(\'heavy\')">\u{1F4A5} Heavy (\u00D71.5 dmg, take \u00D71.3)</button>'+
    '<button class="dg-choice" style="border-color:#44aa88;color:#44aa88" onclick="dgCombatRound(\'defend\')">\u{1F6E1} Defend (take \u00D70.4, skip atk)</button>'+
    (r.gold>=15?'<button class="dg-choice" style="border-color:#e8d060;color:#e8d060" onclick="dgCombatRound(\'power\')">\u2B50 Power (\u00D73, costs 15g)</button>':'')+
    classBtn+
    (r.potions>0?'<button class="dg-choice" onclick="dgUsePotion()">\u{1F9EA} Potion ('+r.potions+')</button>':'')+
    '<button class="dg-choice gold-c" onclick="dgFlee()">\u{1F3C3} Flee</button>'+
  '</div>';
}

export function dgClassMove(){
  var r=state.dgRun;
  if(!r||!r.combatEnemy||r.mana<r.spellCost)return;
  r.mana-=r.spellCost;
  var m=r.combatEnemy;
  var est=dgDmgEstimates();
  var cc=r.heroClass;
  if(cc==='wizard'){
    var dm=Math.round((r.baseDmg+r.bonusDmg)*2.5*(0.9+Math.random()*0.2));
    m.hp-=dm;dgLog('\u26A1 Chain Lightning! '+dm+' magic damage!','good');
  } else if(cc==='ranger'){
    var dm=Math.round(est.youAvg*2*(0.9+Math.random()*0.2));
    m.hp-=dm;m._bleed=(m._bleed||0)+3;dgLog('\u{1F525} Rain of Fire! '+dm+' dmg + 3 turn burn!','good');
  } else if(cc==='assassin'){
    var dm=Math.round(est.youAvg*3*(0.9+Math.random()*0.2));
    m.hp-=dm;dgLog('\u2744 Ambush! Critical '+dm+' damage!','good');
  } else if(cc==='barbarian'){
    var dm=Math.round(est.youAvg*2*(0.9+Math.random()*0.2));
    m.hp-=dm;var heal=Math.round(dm*0.5);r.hp=Math.min(r.maxHp,r.hp+heal);
    dgLog('\u{1F480} Rampage! '+dm+' dmg, healed '+heal+'!','good');
  } else if(cc==='custom'){
    var dm=Math.round(est.youAvg*2.2*(0.9+Math.random()*0.2));
    var cSkillName=state.customChar.skills[0]!==null&&ALL_SKILLS[state.customChar.skills[0]]?ALL_SKILLS[state.customChar.skills[0]].name:'Power Surge';
    var cSkillIcon=state.customChar.skills[0]!==null&&ALL_SKILLS[state.customChar.skills[0]]?ALL_SKILLS[state.customChar.skills[0]].icon:'\u2692';
    m.hp-=dm;
    var bonusMsg='';
    if(state.customChar.ultimate!==null){
      var ultName=ALL_ULTS[state.customChar.ultimate]?ALL_ULTS[state.customChar.ultimate].name:'';
      if(ultName.toLowerCase().indexOf('storm')>=0||ultName.toLowerCase().indexOf('thunder')>=0){
        var extraDm=Math.round(dm*0.3);m.hp-=extraDm;bonusMsg=' + '+extraDm+' shock!';
      } else if(ultName.toLowerCase().indexOf('berserk')>=0||ultName.toLowerCase().indexOf('rage')>=0){
        var heal2=Math.round(dm*0.3);r.hp=Math.min(r.maxHp,r.hp+heal2);bonusMsg=' + healed '+heal2+'!';
      } else if(ultName.toLowerCase().indexOf('rain')>=0||ultName.toLowerCase().indexOf('fire')>=0){
        m._bleed=(m._bleed||0)+2;bonusMsg=' + 2 turn burn!';
      } else if(ultName.toLowerCase().indexOf('death')>=0||ultName.toLowerCase().indexOf('mark')>=0){
        var extraDm2=Math.round(dm*0.4);m.hp-=extraDm2;bonusMsg=' + '+extraDm2+' mark burst!';
      } else {
        var heal3=Math.round(dm*0.15);r.hp=Math.min(r.maxHp,r.hp+heal3);bonusMsg=' + healed '+heal3+'!';
      }
    }
    dgLog(cSkillIcon+' '+cSkillName+'! '+dm+' damage!'+bonusMsg,'good');
  }
  if(m.hp>0){
    var monDmg=m.dmg*(1-Math.min((r.def+r.bonusDef)/300,0.8));
    if(Math.random()<r.evasion){dgLog('You dodged the counter!','good');monDmg=0}
    else{monDmg=Math.round(monDmg*(0.85+Math.random()*0.3));r.hp-=monDmg;dgLog(m.name+' retaliates for '+monDmg+'!','bad')}
  }
  if(m.hp<=0){m.hp=0;dgCombatVictory();return}
  updateMonsterBar();updateDgUI();
  if(r.hp<=0){r.hp=0;dgDeath();return}
  dgRefreshCombatUI();
}

function dgCombatVictory(){
  var r=state.dgRun;var m=r.combatEnemy;
  var goldReward=Math.round((3+Math.random()*7)*r.floor);
  r.gold+=goldReward;r.totalKills++;
  var stats=r._lastCombatStats||{};
  var lastRoom=r.roomHistory[r.roomHistory.length-1];
  if(lastRoom){lastRoom.cleared=true;lastRoom.name=m.name}
  dgLog(m.name+' defeated! +'+goldReward+' gold.','loot');
  var followerChance=r.room===3?0.25:0.08;
  var droppedFollower=null;
  if(Math.random()<followerChance){droppedFollower=rollFollower(r.floor)}
  r.combatEnemy=null;r._spellUsed=false;
  var hpPct=Math.round(r.hp/r.maxHp*100);
  var hpCol=hpPct>30?'#44ee88':'#ff4444';
  var isBoss=r.room===3;
  var body='<span style="font-size:.6rem">'+(m.icon||'\u2694')+'</span> <b>'+m.name+'</b> slain!'+(isBoss?' <span style="color:#ff4444">(BOSS)</span>':'')+
    '<br><br>'+
    '<span class="dg-im-stat" style="color:#44ee88">Turns: '+(stats.turns||'?')+'</span>'+
    '<span class="dg-im-stat" style="color:#ff8844">Dealt: '+(stats.dmgDealt||0)+'</span>'+
    '<span class="dg-im-stat" style="color:#ff4444">Taken: '+(stats.dmgTaken||0)+'</span>'+
    '<span class="dg-im-stat" style="color:var(--gold-bright)">+'+goldReward+'g</span>'+
    '<br><span class="dg-im-stat" style="color:'+hpCol+'">HP: '+Math.round(r.hp)+'/'+r.maxHp+' ('+hpPct+'%)</span>';
  if(droppedFollower){
    var nextFn=function(){
      dgShowFollowerCapture(droppedFollower,function(){
        if(r.floor>=8&&r.room===3){dgVictory();return}
        setTimeout(generateRoom,200);
      });
    };
    dgShowIntermission(isBoss?'\u2B50 BOSS DEFEATED! \u2B50':'\u2694 VICTORY!',isBoss?'#ffcc22':'#44ee88',body+
      '<br><span style="color:'+RARITY_COLORS[droppedFollower.rarity]+';font-size:.55rem">A creature stirs... \u{1F47E}</span>',
      '\u2728 See what you found','dgProceedToCapture()');
    r._pendingVictoryCapture=nextFn;
  } else {
    if(r.floor>=8&&r.room===3){
      dgShowIntermission('\u{1F3C6} FINAL BOSS SLAIN! \u{1F3C6}','#ffcc22',body,'\u{1F3C6} Claim Victory','dgVictory()');
    } else {
      dgShowIntermission(isBoss?'\u2B50 BOSS DEFEATED! \u2B50':'\u2694 VICTORY!',isBoss?'#ffcc22':'#44ee88',body,'\u27A1\uFE0F Continue','generateRoom()');
    }
  }
  updateMonsterBar();dgUpdateProgress();updateDgUI();
}

export function dgProceedToCapture(){
  if(state.dgRun._pendingVictoryCapture){
    state.dgRun._pendingVictoryCapture();
    state.dgRun._pendingVictoryCapture=null;
  }
}

function dgRefreshCombatUI(){
  var rc=document.getElementById('dgRoomContent');
  var room=rc.querySelector('.dg-room');
  if(room){
    var oldEst=room.querySelector('.dg-dmg-est');if(oldEst)oldEst.remove();
    var oldBtns=room.querySelector('.dg-choices');if(oldBtns)oldBtns.remove();
    room.insertAdjacentHTML('beforeend',dgCombatButtons());
  }
}

export function dgCombatRound(mode){
  var r=state.dgRun;
  if(!r||!r.combatEnemy)return;
  mode=mode||'normal';
  var m=r.combatEnemy;
  r.combatTurn++;
  if(r._lastCombatStats)r._lastCombatStats.turns=r.combatTurn;
  r.mana=Math.min(r.maxMana,r.mana+r.manaRegen);
  if(m._bleed&&m._bleed>0){
    var bleedDmg=Math.round((r.baseDmg+r.bonusDmg)*0.3);
    m.hp-=bleedDmg;m._bleed--;
    dgLog('\u{1F525} Burn deals '+bleedDmg+'! ('+m._bleed+' turns left)','good');
  }
  var hits=Math.max(1,Math.round(r.baseAS+r.bonusAS));
  var dmgMult=mode==='heavy'?1.5:mode==='power'?3:mode==='defend'?0:1;
  var totalHeroDmg=0;
  if(mode==='power'){
    if(r.gold<15){dgLog('Not enough gold!','bad');return}
    r.gold-=15;
  }
  if(dmgMult>0){
    for(var hit=0;hit<hits;hit++){
      var heroDmg=r.baseDmg+r.bonusDmg;
      var mitigated=heroDmg*(1-Math.min(m.def/300,0.8))*dmgMult;
      if(m.evasion&&Math.random()<m.evasion){dgLog('Attack '+(hit+1)+' missed!','bad');continue}
      var variance=0.85+Math.random()*0.3;
      mitigated=Math.round(mitigated*variance);
      m.hp-=mitigated;totalHeroDmg+=mitigated;
    }
    var modeLabel=mode==='heavy'?'Heavy Strike':'Power Strike';
    if(mode==='normal')modeLabel=hits>1?hits+'\u00D7 Strike':'Strike';
    dgLog(modeLabel+': '+totalHeroDmg+' total damage!','good');
    if(r._lastCombatStats)r._lastCombatStats.dmgDealt+=totalHeroDmg;
    r.totalDmgDealt+=totalHeroDmg;
  } else {
    dgLog('\u{1F6E1} You brace for impact...','info');
  }
  if(m.hp<=0){m.hp=0;dgCombatVictory();return}
  var monDmgMult=mode==='defend'?0.4:mode==='heavy'?1.3:1;
  var monDmg=m.dmg*(1-Math.min((r.def+r.bonusDef)/300,0.8))*monDmgMult;
  if(Math.random()<r.evasion){dgLog('You dodged the attack!','good');monDmg=0}
  else{
    monDmg=Math.round(monDmg*(0.85+Math.random()*0.3));
    r.hp-=monDmg;
    if(r._lastCombatStats)r._lastCombatStats.dmgTaken+=monDmg;
    r.totalDmgTaken+=monDmg;
    var defLabel=mode==='defend'?' (defended!)':'';
    dgLog(m.name+' hits for '+monDmg+defLabel+'!','bad');
  }
  updateMonsterBar();updateDgUI();
  if(r.hp<=0){r.hp=0;dgDeath();return}
  dgRefreshCombatUI();
}

function renderRoom(type){
  var rc=document.getElementById('dgRoomContent');
  var r=state.dgRun;
  var isBoss=(r.room===3);
  if(type==='combat'){
    var tier=Math.min(4,Math.ceil(r.floor/2));
    var pool=DG_MONSTERS.filter(function(m){return m.tier<=tier});
    var monster={...pool[Math.floor(Math.random()*pool.length)]};
    var scale=1+(r.floor-1)*0.18;
    monster.hp=Math.round(monster.hp*scale);monster.dmg=Math.round(monster.dmg*scale);monster.def=Math.round(monster.def*scale);
    if(isBoss){monster.hp=Math.round(monster.hp*1.8);monster.dmg=Math.round(monster.dmg*1.4);monster.name='\u2605 '+monster.name+' \u2605';monster.def=Math.round(monster.def*1.3)}
    monster._maxHp=monster.hp;
    r.combatEnemy=monster;r.combatTurn=0;r._spellUsed=false;
    r._lastCombatStats={turns:0,dmgDealt:0,dmgTaken:0,hpBefore:r.hp,monsterName:monster.name,monsterIcon:monster.icon};
    var bossTag=isBoss?'<div style="font-size:.48rem;color:#ff4444;margin-bottom:2px">\u26A0 FLOOR BOSS \u26A0</div>':'';
    rc.innerHTML='<div class="dg-room">'+bossTag+'<div class="dg-room-icon">'+monster.icon+'</div><div class="dg-room-title">'+monster.name+'</div><div class="dg-room-desc">HP: '+monster.hp+' | DMG: '+monster.dmg+' | DEF: '+monster.def+(monster.evasion?' | EVA: '+Math.round(monster.evasion*100)+'%':'')+'</div>'+
      '<div id="monsterHpBar" style="width:200px;margin:4px 0"><div class="bar-track"><div class="bar-fill" id="monHpFill" style="width:100%;background:linear-gradient(90deg,#4a1a1a,#ff4444)"></div></div><div style="font-size:.48rem;color:var(--parch-dk);text-align:center" id="monHpText">'+monster.hp+'/'+monster.hp+'</div></div>'+
      dgCombatButtons()+'</div>';
  }
  else if(type==='treasure'){
    var gold=Math.round((5+Math.random()*10)*r.floor);
    var hasItem=Math.random()>0.4;var item=null;
    if(hasItem){
      var items=[
        {name:'Whetstone',icon:'\u{1FAA8}',desc:'+25 DMG',persist:{stat:'baseDmg',val:25},apply:function(run){run.bonusDmg+=25}},
        {name:'Armor Shard',icon:'\u{1F6E1}\uFE0F',desc:'+15 DEF',persist:{stat:'def',val:15},apply:function(run){run.bonusDef+=15}},
        {name:'Swift Elixir',icon:'\u26A1',desc:'+0.15 AtkSpd',persist:{stat:'baseAS',val:0.15},apply:function(run){run.baseAS+=0.15}},
        {name:'Health Potion',icon:'\u{1F9EA}',desc:'+1 Potion',persist:null,apply:function(run){run.potions=Math.min(run.maxPotions,run.potions+1)}},
        {name:'Life Crystal',icon:'\u{1F48E}',desc:'+400 Max HP',persist:{stat:'hp',val:400},apply:function(run){run.maxHp+=400;run.hp+=400;run.bonusHp+=400}},
        {name:'Vampire Fang',icon:'\u{1F9B7}',desc:'+3% Lifesteal',persist:{stat:'lifesteal',val:0.03},apply:function(run){run._lifesteal=(run._lifesteal||0)+0.03}},
        {name:'Wind Charm',icon:'\u{1F300}',desc:'+20 Move Speed',persist:{stat:'moveSpeed',val:20},apply:function(run){run.moveSpeed=(run.moveSpeed||0)+20}},
        {name:'Crit Stone',icon:'\u{1F4A5}',desc:'+8% Crit Chance',persist:{stat:'crit',val:0.08},apply:function(run){run._crit=(run._crit||0)+0.08}},
        {name:'Mana Gem',icon:'\u{1F537}',desc:'+15 Mana',persist:{stat:'mana',val:15},apply:function(run){run.maxMana=(run.maxMana||0)+15;run.mana=(run.mana||0)+15}},
        {name:'Spell Tome',icon:'\u{1F4D8}',desc:'+5% Spell Power',persist:{stat:'spellDmgBonus',val:0.05},apply:function(run){run._spellPower=(run._spellPower||0)+0.05}},
      ];
      item=items[Math.floor(Math.random()*items.length)];
    }
    rc.innerHTML='<div class="dg-room"><div class="dg-room-icon">\u{1F4B0}</div><div class="dg-room-title">Treasure!</div><div class="dg-room-desc">You found a chest containing '+gold+' gold!'+(item?'<br>Inside: <b style="color:var(--gold-bright)">'+item.icon+' '+item.name+'</b> - '+item.desc:'')+'</div>'+
      '<div class="dg-choices"><button class="dg-choice gold-c" onclick="dgTakeTreasure('+gold+','+(item?'true':'false')+')">\u270B Take It</button></div></div>';
    r._pendingItem=item;
  }
  else if(type==='trap'){
    var traps=[
      {name:'Spike Trap',icon:'\u26A0\uFE0F',desc:'Sharp spikes spring from the floor!',dmg:Math.round(150+r.floor*50)},
      {name:'Poison Gas',icon:'\u2601\uFE0F',desc:'Toxic fumes fill the chamber!',dmg:Math.round(250+r.floor*60)},
      {name:'Falling Rocks',icon:'\u{1FAA8}',desc:'The ceiling collapses!',dmg:Math.round(180+r.floor*45)},
    ];
    var trap=traps[Math.floor(Math.random()*traps.length)];
    var canDodge=r.evasion>0;
    var dodgeChance=Math.round(r.evasion*100+20);
    rc.innerHTML='<div class="dg-room"><div class="dg-room-icon">'+trap.icon+'</div><div class="dg-room-title">'+trap.name+'!</div><div class="dg-room-desc">'+trap.desc+'<br>Potential damage: <span style="color:#ff4444">'+trap.dmg+'</span></div>'+
      '<div class="dg-choices"><button class="dg-choice danger" onclick="dgTriggerTrap('+trap.dmg+')">\u{1F4AA} Endure ('+trap.dmg+' dmg)</button>'+(canDodge?'<button class="dg-choice" onclick="dgDodgeTrap('+trap.dmg+')">\u{1F3C3} Dodge ('+dodgeChance+'% full dodge, fail = \u00D70.5)</button>':'')+'</div></div>';
  }
  else if(type==='rest'){
    var healAmt=Math.round(r.maxHp*0.25);
    rc.innerHTML='<div class="dg-room"><div class="dg-room-icon">\u{1F3D5}\uFE0F</div><div class="dg-room-title">Rest Site</div><div class="dg-room-desc">A safe place to rest and recover.<br>Heal: <span style="color:#44ee88">'+healAmt+' HP</span></div>'+
      '<div class="dg-choices"><button class="dg-choice" onclick="dgRest('+healAmt+')">\u{1F634} Rest</button><button class="dg-choice gold-c" onclick="generateRoom()">\u27A1\uFE0F Move On</button></div></div>';
  }
  else if(type==='shrine'){
    var shrines=[
      {name:'Shrine of Power',icon:'\u2694\uFE0F',desc:'+35 DMG permanently',persist:{stat:'baseDmg',val:35},apply:function(run){run.bonusDmg+=35}},
      {name:'Shrine of Vitality',icon:'\u2764\uFE0F',desc:'+500 Max HP',persist:{stat:'hp',val:500},apply:function(run){run.maxHp+=500;run.hp+=500;run.bonusHp+=500}},
      {name:'Shrine of Iron',icon:'\u{1F6E1}\uFE0F',desc:'+25 DEF permanently',persist:{stat:'def',val:25},apply:function(run){run.bonusDef+=25}},
      {name:'Shrine of Shadows',icon:'\u{1F441}\uFE0F',desc:'+8% Evasion',persist:{stat:'evasion',val:0.08},apply:function(run){run.evasion=Math.min(0.5,run.evasion+0.08)}},
      {name:'Shrine of Fury',icon:'\u{1F4A2}',desc:'+0.2 AtkSpd',persist:{stat:'baseAS',val:0.2},apply:function(run){run.baseAS+=0.2}},
      {name:'Shrine of Blood',icon:'\u{1FA78}',desc:'+5% Lifesteal',persist:{stat:'lifesteal',val:0.05},apply:function(run){run._lifesteal=(run._lifesteal||0)+0.05}},
      {name:'Shrine of Storms',icon:'\u{1F329}\uFE0F',desc:'+10% Spell Power',persist:{stat:'spellDmgBonus',val:0.1},apply:function(run){run._spellPower=(run._spellPower||0)+0.1}},
      {name:'Shrine of Fortune',icon:'\u{1F340}',desc:'+12% Crit Chance',persist:{stat:'crit',val:0.12},apply:function(run){run._crit=(run._crit||0)+0.12}},
    ];
    var shrine=shrines[Math.floor(Math.random()*shrines.length)];
    var cost=Math.round(r.maxHp*0.15);
    r._pendingShrine=shrine;
    rc.innerHTML='<div class="dg-room"><div class="dg-room-icon">'+shrine.icon+'</div><div class="dg-room-title">'+shrine.name+'</div><div class="dg-room-desc">'+shrine.desc+'<br>Cost: <span style="color:#ff4444">'+cost+' HP</span> (blood offering)</div>'+
      '<div class="dg-choices"><button class="dg-choice" onclick="dgUseShrine('+cost+')" '+(r.hp<=cost?'disabled':'')+'>'+'\u{1FA78} Offer Blood</button><button class="dg-choice gold-c" onclick="generateRoom()">\u27A1\uFE0F Skip</button></div></div>';
  }
  else if(type==='merchant'){
    var shopItems=[
      {name:'Health Potion',icon:'\u{1F9EA}',cost:20,desc:'+1 Potion',persist:null,apply:function(run){run.potions=Math.min(run.maxPotions,run.potions+1)}},
      {name:'Damage Tome',icon:'\u{1F4D5}',cost:40,desc:'+30 DMG',persist:{stat:'baseDmg',val:30},apply:function(run){run.bonusDmg+=30}},
      {name:'Shield Scroll',icon:'\u{1F4DC}',cost:35,desc:'+20 DEF',persist:{stat:'def',val:20},apply:function(run){run.bonusDef+=20}},
      {name:'Healing Salve',icon:'\u{1F49A}',cost:25,desc:'Heal 40% HP',persist:null,apply:function(run){run.hp=Math.min(run.maxHp,run.hp+Math.round(run.maxHp*0.4))}},
      {name:'Blood Vial',icon:'\u{1FA78}',cost:45,desc:'+4% Lifesteal',persist:{stat:'lifesteal',val:0.04},apply:function(run){run._lifesteal=(run._lifesteal||0)+0.04}},
      {name:'Speed Scroll',icon:'\u{1F4A8}',cost:30,desc:'+0.15 AS',persist:{stat:'baseAS',val:0.15},apply:function(run){run.baseAS+=0.15}},
      {name:'War Crystal',icon:'\u{1F534}',desc:'+500 HP',cost:35,persist:{stat:'hp',val:500},apply:function(run){run.maxHp+=500;run.hp+=500;run.bonusHp+=500}},
      {name:'Lucky Coin',icon:'\u{1FA99}',cost:50,desc:'+10% Crit',persist:{stat:'crit',val:0.1},apply:function(run){run._crit=(run._crit||0)+0.1}},
    ];
    r._shopItems=shopItems;
    var sh='<div class="dg-room"><div class="dg-room-icon">\u{1F3EA}</div><div class="dg-room-title">Wandering Merchant</div><div class="dg-room-desc">Gold: <span style="color:var(--gold-bright)">'+r.gold+'</span></div><div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">';
    shopItems.forEach(function(it,i){
      sh+='<button class="dg-choice gold-c" onclick="dgBuyItem('+i+')" '+(r.gold<it.cost?'disabled':'')+' style="text-align:left;font-size:.48rem">'+it.icon+' '+it.name+' - '+it.desc+' ('+it.cost+'g)</button>';
    });
    sh+='</div><div class="dg-choices" style="margin-top:6px"><button class="dg-choice" onclick="generateRoom()">\u27A1\uFE0F Leave Shop</button></div></div>';
    rc.innerHTML=sh;
  }
  else if(type==='follower_cage'){
    var f=rollFollower(r.floor);
    var lastRoom=r.roomHistory[r.roomHistory.length-1];
    if(lastRoom){lastRoom.cleared=true;lastRoom.name='Cage: '+f.name}
    dgShowFollowerCapture(f,function(){setTimeout(generateRoom,200)});
    return;
  }
  updateDgUI();
}

function updateMonsterBar(){
  if(!state.dgRun||!state.dgRun.combatEnemy)return;
  var m=state.dgRun.combatEnemy;
  var fill=document.getElementById('monHpFill');var txt=document.getElementById('monHpText');
  if(fill)fill.style.width=Math.max(0,m.hp/m._maxHp*100)+'%';
  if(txt)txt.textContent=Math.max(0,m.hp)+'/'+m._maxHp;
}

export function dgUsePotion(){
  var r=state.dgRun;
  if(!r||r.potions<=0)return;
  r.potions--;
  var heal=Math.round(r.maxHp*0.35);
  r.hp=Math.min(r.maxHp,r.hp+heal);
  dgLog('Used potion! Healed '+heal+' HP.','good');
  updateDgUI();
  if(r.combatEnemy){
    var m=r.combatEnemy;
    var monDmg=m.dmg*(1-Math.min((r.def+r.bonusDef)/300,0.8));
    if(Math.random()<r.evasion){dgLog('Dodged while drinking!','good')}
    else{monDmg=Math.round(monDmg*(0.85+Math.random()*0.3));r.hp-=monDmg;dgLog(m.name+' hits you for '+monDmg+' while drinking!','bad')}
    updateDgUI();if(r.hp<=0){r.hp=0;dgDeath()}
  }
}

export function dgFlee(){
  var r=state.dgRun;if(!r)return;
  var fleeChance=0.5+r.evasion*0.3;
  if(Math.random()<fleeChance){
    dgLog('You fled successfully!','info');
    r.combatEnemy=null;
    setTimeout(generateRoom,400);
  } else {
    dgLog('Failed to flee!','bad');
    if(r.combatEnemy){
      var m=r.combatEnemy;
      var monDmg=Math.round(m.dmg*(1-Math.min((r.def+r.bonusDef)/300,0.8))*(0.85+Math.random()*0.3));
      r.hp-=monDmg;dgLog(m.name+' hits you for '+monDmg+'!','bad');
      updateDgUI();if(r.hp<=0){r.hp=0;dgDeath()}
    }
  }
}

export function dgTakeTreasure(gold,hasItem){
  var r=state.dgRun;
  r.gold+=gold;dgLog('Gained '+gold+' gold!','loot');
  var lastRoom=r.roomHistory[r.roomHistory.length-1];
  if(lastRoom)lastRoom.cleared=true;
  if(hasItem&&r._pendingItem){
    r._pendingItem.apply(r);
    r.items.push({name:r._pendingItem.name,icon:r._pendingItem.icon,desc:r._pendingItem.desc,persist:r._pendingItem.persist||null});
    dgLog('Got '+r._pendingItem.name+'! '+r._pendingItem.desc,'loot');
    r._pendingItem=null;
  }
  updateDgUI();setTimeout(generateRoom,400);
}

export function dgTriggerTrap(dmg){
  var r=state.dgRun;
  var reduced=Math.round(dmg*(1-Math.min((r.def+r.bonusDef)/300,0.5)));
  r.hp-=reduced;dgLog('Took '+reduced+' trap damage!','bad');
  var lr=r.roomHistory[r.roomHistory.length-1];if(lr)lr.cleared=true;
  updateDgUI();if(r.hp<=0){r.hp=0;dgDeath();return}
  setTimeout(generateRoom,400);
}

export function dgDodgeTrap(dmg){
  var r=state.dgRun;
  var chance=r.evasion+0.2;
  if(Math.random()<chance){dgLog('Dodged the trap!','good');var lr=r.roomHistory[r.roomHistory.length-1];if(lr)lr.cleared=true;setTimeout(generateRoom,400)}
  else{dgLog('Partially dodged! Half damage.','bad');dgTriggerTrap(Math.round(dmg*0.5))}
}

export function dgRest(healAmt){
  var r=state.dgRun;
  r.hp=Math.min(r.maxHp,r.hp+healAmt);
  dgLog('Rested and healed '+healAmt+' HP.','good');
  var lr=r.roomHistory[r.roomHistory.length-1];if(lr)lr.cleared=true;
  updateDgUI();setTimeout(generateRoom,400);
}

export function dgSkipRest(){var lr=state.dgRun.roomHistory[state.dgRun.roomHistory.length-1];if(lr)lr.cleared=true;generateRoom()}

export function dgUseShrine(cost){
  var r=state.dgRun;
  if(r.hp<=cost)return;
  r.hp-=cost;
  if(r._pendingShrine){
    r._pendingShrine.apply(r);
    dgLog('Shrine blessing: '+r._pendingShrine.desc,'loot');
    r.items.push({name:r._pendingShrine.name,icon:r._pendingShrine.icon,desc:r._pendingShrine.desc,persist:r._pendingShrine.persist||null});
    r._pendingShrine=null;
  }
  var lr=r.roomHistory[r.roomHistory.length-1];if(lr)lr.cleared=true;
  updateDgUI();setTimeout(generateRoom,400);
}

export function dgBuyItem(idx){
  var r=state.dgRun;
  if(!r._shopItems||!r._shopItems[idx])return;
  var it=r._shopItems[idx];
  if(r.gold<it.cost)return;
  r.gold-=it.cost;it.apply(r);
  dgLog('Bought '+it.name+'! '+it.desc,'loot');
  r.items.push({name:it.name,icon:it.icon,desc:it.desc,persist:it.persist||null});
  var rc=document.getElementById('dgRoomContent');
  var sh='<div class="dg-room"><div class="dg-room-icon">\u{1F3EA}</div><div class="dg-room-title">Wandering Merchant</div><div class="dg-room-desc">Gold: <span style="color:var(--gold-bright)">'+r.gold+'</span></div><div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">';
  r._shopItems.forEach(function(si,i){
    sh+='<button class="dg-choice gold-c" onclick="dgBuyItem('+i+')" '+(r.gold<si.cost?'disabled':'')+' style="text-align:left;font-size:.48rem">'+si.icon+' '+si.name+' - '+si.desc+' ('+si.cost+'g)</button>';
  });
  sh+='</div><div class="dg-choices" style="margin-top:6px"><button class="dg-choice" onclick="generateRoom()">\u27A1\uFE0F Leave Shop</button></div></div>';
  rc.innerHTML=sh;
  updateDgUI();
}

function dgDeath(){
  var r=state.dgRun;
  dgLog('\u2620 You have been slain on Floor '+r.floor+'!','bad');
  var kept=r.followers.slice(0,Math.ceil(r.followers.length/2));
  kept.forEach(function(f){(state.dungeonPlayer===1?state.p1Collection:state.p2Collection).push(f)});
  dgSaveItemsToStash();
  var rc=document.getElementById('dgRoomContent');
  var followerList='';
  kept.forEach(function(f){followerList+='<span style="color:'+RARITY_COLORS[f.rarity]+'">'+f.icon+f.name+'</span> '});
  rc.innerHTML='<div class="dg-intermission">'+
    '<div class="dg-im-title" style="color:#ff4444">\u{1F480} DEFEATED \u{1F480}</div>'+
    '<div class="dg-im-summary">'+
      'Fell on <b>Floor '+r.floor+', Room '+r.room+'</b><br><br>'+
      '<span class="dg-im-stat" style="color:#ff8844">Rooms: '+r.roomHistory.length+'</span>'+
      '<span class="dg-im-stat" style="color:#ff4444">Kills: '+r.totalKills+'</span>'+
      '<span class="dg-im-stat" style="color:var(--gold-bright)">Gold: '+r.gold+'</span>'+
      '<span class="dg-im-stat" style="color:#88aacc">Dmg Dealt: '+r.totalDmgDealt+'</span>'+
      '<span class="dg-im-stat" style="color:#cc66ff">Dmg Taken: '+r.totalDmgTaken+'</span>'+
      '<br><br>Followers kept: <b>'+kept.length+'/'+r.followers.length+'</b>'+
      (kept.length>0?'<br>'+followerList:'')+
    '</div>'+
    '<div class="dg-choices"><button class="dg-choice" onclick="endDungeonRun()">\u21A9 Return</button></div></div>';
  updateDgUI();
}

export function dgVictory(){
  var r=state.dgRun;
  dgLog('\u{1F3C6} You conquered the dungeon!','loot');
  r.followers.forEach(function(f){(state.dungeonPlayer===1?state.p1Collection:state.p2Collection).push(f)});
  dgSaveItemsToStash();
  var bonus=rollFollower(r.floor+2);
  (state.dungeonPlayer===1?state.p1Collection:state.p2Collection).push(bonus);
  var rc=document.getElementById('dgRoomContent');
  var followerList='';
  r.followers.forEach(function(f){followerList+='<span style="color:'+RARITY_COLORS[f.rarity]+'">'+f.icon+f.name+'</span> '});
  rc.innerHTML='<div class="dg-intermission">'+
    '<div class="dg-im-title" style="color:var(--gold-bright)">\u{1F3C6} DUNGEON CONQUERED! \u{1F3C6}</div>'+
    '<div class="dg-im-summary">'+
      'Cleared all <b>8 Floors</b>!<br><br>'+
      '<span class="dg-im-stat" style="color:#ff8844">Rooms: '+r.roomHistory.length+'</span>'+
      '<span class="dg-im-stat" style="color:#ff4444">Kills: '+r.totalKills+'</span>'+
      '<span class="dg-im-stat" style="color:var(--gold-bright)">Gold: '+r.gold+'</span>'+
      '<span class="dg-im-stat" style="color:#88aacc">Dmg Dealt: '+r.totalDmgDealt+'</span>'+
      '<br><br>All <b>'+r.followers.length+'</b> followers kept!'+
      (followerList?'<br>'+followerList:'')+
      '<br><br>Bonus: <span style="color:'+RARITY_COLORS[bonus.rarity]+';font-size:.55rem">'+bonus.icon+' '+bonus.name+' ('+bonus.rarity+')</span>!'+
    '</div>'+
    '<div class="dg-choices"><button class="dg-choice gold-c" onclick="endDungeonRun()">\u{1F3C6} Return Victorious</button></div></div>';
  updateDgUI();
}

function dgSaveItemsToStash(){
  if(!state.dgRun)return;
  var stash=state.dungeonPlayer===1?state.p1Stash:state.p2Stash;
  state.dgRun.items.forEach(function(it){
    if(it.persist){
      stash.push({name:it.name,icon:it.icon,desc:it.desc,stat:it.persist.stat,val:it.persist.val});
    }
  });
}

export function endDungeonRun(){
  state.dgRun=null;
  document.getElementById('dungeonRunScreen').style.display='none';
  document.getElementById('dungeonPickScreen').style.display='flex';
  updateFollowerDisplays();
}

export function abandonDungeon(){
  if(!state.dgRun)return;
  if(!confirm('Abandon run? You keep followers and items found so far.'))return;
  state.dgRun.followers.forEach(function(f){(state.dungeonPlayer===1?state.p1Collection:state.p2Collection).push(f)});
  dgSaveItemsToStash();
  endDungeonRun();
}
