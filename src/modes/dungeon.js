// =============== DUNGEON SYSTEM ===============
import { state } from '../gameState.js';
import { CLASSES } from '../data/classes.js';
import { ITEMS, EQ_SLOTS, GEAR_RARITY_COLORS, rollGearDrop, rollShopGear } from '../data/items.js';
import { FOLLOWER_TEMPLATES, RARITY_COLORS, rollFollower, rollCageFollower } from '../data/followers.js';
import { SFX } from '../sfx.js';
import { getCustomTotalStats } from '../combat/hero.js';
import { initDgCombat } from './dgCombat.js';
import { buildCustomTooltip, buildDefeatSheet, updateFollowerDisplays } from '../render/ui.js';
import { drawSpritePreview } from '../render/sprites.js';
import { buildCharSheet } from '../render/charSheet.js';
import { getIcon } from '../render/icons.js';

var GEAR_PRICES={common:20,uncommon:40,rare:70,epic:120,legendary:250};

var DG_MONSTERS=[
  {name:'Goblin Scout',icon:'\u{1F47A}',hp:350,dmg:35,def:5,tier:1},
  {name:'Cave Bat',icon:'\u{1F987}',hp:220,dmg:45,def:2,tier:1},
  {name:'Slime',icon:'\u{1F7E2}',hp:450,dmg:25,def:10,tier:1},
  {name:'Skeleton',icon:'\u{1F480}',hp:380,dmg:40,def:8,tier:1},
  {name:'Orc Warrior',icon:'\u{1F479}',hp:700,dmg:65,def:18,tier:2},
  {name:'Dark Mage',icon:'\u{1F9D9}',hp:500,dmg:90,def:10,tier:2},
  {name:'Troll',icon:'\u{1F9CC}',hp:900,dmg:55,def:25,tier:2},
  {name:'Ghost',icon:'\u{1F47B}',hp:450,dmg:75,def:6,tier:2,evasion:0.2},
  {name:'Minotaur',icon:'\u{1F402}',hp:1400,dmg:110,def:30,tier:3},
  {name:'Lich',icon:'\u2620\uFE0F',hp:950,dmg:140,def:15,tier:3},
  {name:'Stone Golem',icon:'\u{1F5FF}',hp:1800,dmg:85,def:50,tier:3},
  {name:'Wyvern',icon:'\u{1F409}',hp:1100,dmg:130,def:22,tier:3},
  {name:'Dragon',icon:'\u{1F432}',hp:2500,dmg:170,def:40,tier:4},
  {name:'Demon Lord',icon:'\u{1F608}',hp:2200,dmg:190,def:35,tier:4},
  {name:'Ancient Wyrm',icon:'\u{1F40D}',hp:3200,dmg:150,def:45,tier:4},
];

export function buildDungeonPicker(){
  buildCharSheet('dungeonCharSheet');
}

export function startDungeon(){
  var cs=getCustomTotalStats();
  var heroName=state.customChar.name;
  var heroHp=Math.round(cs.hp*0.85);
  var heroDmg=Math.round(cs.baseDmg);
  var heroAS=cs.baseAS;
  var heroDef=cs.def;
  var heroEva=cs.evasion;
  var maxMana=Math.max(100,cs.mana||0);
  var manaRegen=Math.max(4,cs.manaRegen||0);
  var spellCost=35;
  state.dgRun={
    heroClass:'custom',heroName:heroName,
    hp:heroHp,maxHp:heroHp,
    baseDmg:heroDmg,baseAS:heroAS,def:heroDef,evasion:heroEva,
    floor:1,room:0,gold:0,
    items:[],followers:[],
    log:[],state:'exploring',
    combatEnemy:null,combatTurn:0,
    potions:3,maxPotions:3,
    bonusDmg:0,bonusDef:0,bonusHp:0,bonusAS:0,
    mana:maxMana,maxMana:maxMana,manaRegen:manaRegen,
    spellCost:spellCost,
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
  var hpCol=hpPct>30?'#6a9a6a':'#aa5a5a';
  hi.innerHTML='<div class="dg-hero-info"><b>'+r.heroName+'</b> (Custom)<br>'+
    '<div class="dg-hero-bar"><div class="bar-label" style="font-size:.52rem"><span style="color:'+hpCol+'">HP</span><span>'+Math.round(r.hp)+'/'+r.maxHp+'</span></div><div class="bar-track"><div class="bar-fill" style="width:'+hpPct+'%;background:linear-gradient(90deg,#1a4a1a,'+hpCol+')"></div></div></div>'+
    'DMG: '+(r.baseDmg+r.bonusDmg)+' | DEF: '+(r.def+r.bonusDef)+'<br>'+
    'AS: '+r.baseAS.toFixed(2)+' ('+Math.max(1,Math.round(r.baseAS+r.bonusAS))+' hits/rnd) | EVA: '+Math.round(r.evasion*100)+'%<br>'+
    'Mana: <span style="color:#88aaff">'+Math.round(r.mana)+'/'+r.maxMana+'</span> | Gold: <span style="color:var(--gold-bright)">'+r.gold+'</span> | Potions: <span style="color:#44aa66">'+r.potions+'</span>'+
    '</div>';
  document.getElementById('dgFloorNum').textContent='FLOOR '+r.floor;
  var inv=document.getElementById('dgInventory');
  if(r.items.length===0)inv.innerHTML='<div style="font-size:.48rem;color:var(--parch-dk);padding:4px">Empty</div>';
  else{var ih='';r.items.forEach(function(it){ih+='<div class="dg-inv-item"><span class="dg-inv-icon">'+getIcon(it,16)+'</span><span>'+it.name+'</span></div>'});inv.innerHTML=ih}
  var fc=document.getElementById('dgFollowers');
  if(r.followers.length===0)fc.innerHTML='<div style="font-size:.48rem;color:var(--parch-dk);padding:4px">None yet</div>';
  else{var fh='';r.followers.forEach(function(f){fh+='<div class="dg-inv-item"><span class="dg-inv-icon">'+getIcon(f,16)+'</span><span class="dg-loot-name '+f.rarity+'">'+f.name+'</span></div>'});fc.innerHTML=fh}
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

function dgShowIntermission(title,titleColor,bodyHtml,nextLabel,nextFn,titleClass){
  var rc=document.getElementById('dgRoomContent');
  var r=state.dgRun;
  rc.innerHTML='<div class="dg-intermission">'+
    '<div class="dg-im-title '+(titleClass||'')+'" style="color:'+(titleColor||'var(--parch)')+'">'+title+'</div>'+
    '<div class="dg-im-summary">'+bodyHtml+'</div>'+
    '<div style="margin:6px 0">'+
      '<span class="dg-im-stat" style="color:#6a9a6a">HP: '+Math.round(r.hp)+'/'+r.maxHp+'</span>'+
      '<span class="dg-im-stat" style="color:var(--gold-bright)">Gold: '+r.gold+'</span>'+
      '<span class="dg-im-stat" style="color:#88aacc">Kills: '+r.totalKills+'</span>'+
      '<span class="dg-im-stat" style="color:#cc66ff">Followers: '+r.followers.length+'</span>'+
    '</div>'+
    '<div class="dg-choices"><button class="dg-choice gold-c" onclick="'+nextFn+'">'+(nextLabel||'\u27A1\uFE0F Continue')+'</button></div>'+
  '</div>';
  dgUpdateProgress();updateDgUI();
}

// =============== GEAR DROP SYSTEM ===============
function _spawnDOMSparkles(container,color,count){
  for(var i=0;i<count;i++){
    var sp=document.createElement('div');sp.className='loot-sparkle';
    sp.style.background=color;
    sp.style.left=Math.random()*100+'%';sp.style.top=Math.random()*100+'%';
    sp.style.setProperty('--sx',(Math.random()*40-20)+'px');
    sp.style.setProperty('--sy',(-20-Math.random()*40)+'px');
    sp.style.animationDelay=(Math.random()*0.5)+'s';
    container.appendChild(sp);
  }
  setTimeout(function(){container.querySelectorAll('.loot-sparkle').forEach(function(s){s.remove()})},2500);
}

export function dgShowGearDrop(itemKey,afterFn){
  var item=ITEMS[itemKey];if(!item)return;
  var rc=document.getElementById('dgRoomContent');
  var col=GEAR_RARITY_COLORS[item.rarity]||'#aaa';
  var currentKey=state.customChar.equipment[item.slot];
  var currentItem=currentKey?ITEMS[currentKey]:null;
  var compareHtml='';
  if(currentItem){
    var diffs=[];
    var allStatKeys={};
    for(var k in item.stats)allStatKeys[k]=true;
    if(currentItem)for(var k2 in currentItem.stats)allStatKeys[k2]=true;
    for(var sk in allStatKeys){
      var newVal=item.stats[sk]||0;
      var curVal=currentItem?currentItem.stats[sk]||0:0;
      var diff=newVal-curVal;
      if(diff!==0){
        var label=sk==='hp'?'HP':sk==='baseDmg'?'DMG':sk==='baseAS'?'AS':sk==='def'?'DEF':sk==='evasion'?'EVA':sk==='moveSpeed'?'SPD':sk==='mana'?'MANA':sk;
        var diffStr=diff>0?'<span style="color:#6a9a6a">+'+( sk==='evasion'||sk==='spellDmgBonus'?Math.round(diff*100)+'%':sk==='baseAS'?diff.toFixed(2):Math.round(diff))+'</span>':'<span style="color:#aa5a5a">'+(sk==='evasion'||sk==='spellDmgBonus'?Math.round(diff*100)+'%':sk==='baseAS'?diff.toFixed(2):Math.round(diff))+'</span>';
        diffs.push('<span class="loot-reveal-stat" style="animation-delay:'+(0.5+diffs.length*0.08)+'s">'+label+': '+diffStr+'</span>');
      }
    }
    var curCol=GEAR_RARITY_COLORS[currentItem.rarity]||'#aaa';
    compareHtml='<div class="loot-reveal-compare" style="font-size:.45rem;margin-top:6px;color:var(--parch-dk)">Currently: <span style="color:'+curCol+'">'+getIcon(currentItem,14)+' '+currentItem.name+'</span> ('+currentItem.desc+')</div>';
    if(diffs.length)compareHtml+='<div class="loot-reveal-stats" style="font-size:.45rem;margin-top:2px">'+diffs.join(' | ')+'</div>';
  } else {
    compareHtml='<div class="loot-reveal-compare" style="font-size:.45rem;margin-top:4px;color:#6a9a6a">No item equipped in '+item.slot+'</div>';
  }
  state.dgRun._pendingGearDrop=itemKey;
  state.dgRun._pendingGearAfter=afterFn;
  rc.innerHTML='<div class="dg-intermission loot-reveal '+item.rarity+'">'+
    '<div class="loot-reveal-card">'+
    '<div class="dg-im-title loot-reveal-name" style="color:'+col+'">\u2728 GEAR DROP! \u2728</div>'+
    '<div class="loot-reveal-icon">'+getIcon(item,32)+'</div>'+
    '<div class="loot-reveal-name" style="font-size:.55rem;color:'+col+';font-weight:bold">'+item.name+'</div>'+
    '<div class="loot-reveal-rarity" style="color:'+col+'">'+item.rarity+'</div>'+
    '<div class="loot-reveal-stats" style="font-size:.48rem;color:var(--parch)">'+item.desc+'</div>'+
    '<div class="loot-reveal-stats" style="font-size:.42rem;color:var(--parch-dk)">Slot: '+item.slot+'</div>'+
    compareHtml+
    '<div class="loot-reveal-actions dg-choices" style="margin-top:8px">'+
      '<button class="dg-choice" style="border-color:'+col+';color:'+col+'" onclick="dgEquipGearDrop()">\u2694 Equip</button>'+
      '<button class="dg-choice gold-c" onclick="dgStashGearDrop()">\u{1F392} Stash</button>'+
    '</div>'+
    '</div>'+
  '</div>';
  SFX.lootDrop(item.rarity);
  var sparkleCount=item.rarity==='legendary'?12:item.rarity==='epic'?8:item.rarity==='rare'?5:0;
  if(sparkleCount){var card=rc.querySelector('.loot-reveal-card');if(card)_spawnDOMSparkles(card,col,sparkleCount)}
  updateDgUI();
}

export function dgEquipGearDrop(){
  if(!state.dgRun||!state.dgRun._pendingGearDrop)return;
  var itemKey=state.dgRun._pendingGearDrop;
  var item=ITEMS[itemKey];if(!item)return;
  var slot=item.slot;
  var oldKey=state.customChar.equipment[slot];
  if(oldKey)state.gearBag.push(oldKey);
  state.customChar.equipment[slot]=itemKey;
  dgLog('Equipped '+item.name+'!','loot');
  var afterFn=state.dgRun._pendingGearAfter;
  state.dgRun._pendingGearDrop=null;state.dgRun._pendingGearAfter=null;
  updateDgUI();
  if(afterFn)afterFn();else setTimeout(generateRoom,300);
}

export function dgStashGearDrop(){
  if(!state.dgRun||!state.dgRun._pendingGearDrop)return;
  var itemKey=state.dgRun._pendingGearDrop;
  var item=ITEMS[itemKey];
  state.gearBag.push(itemKey);
  dgLog('Stashed '+item.name+' in gear bag.','loot');
  var afterFn=state.dgRun._pendingGearAfter;
  state.dgRun._pendingGearDrop=null;state.dgRun._pendingGearAfter=null;
  updateDgUI();
  if(afterFn)afterFn();else setTimeout(generateRoom,300);
}

// =============== FOLLOWER CAPTURE ===============
function dgShowFollowerCapture(f,afterFn){
  var tmpl=FOLLOWER_TEMPLATES.find(function(t){return t.name===f.name});
  var abilityLine=f.abilityName?'<div class="fim-ability loot-reveal-stats">\u26A1 <b>'+f.abilityName+'</b>: '+f.abilityDesc+'</div>':'';
  if(tmpl&&tmpl.abilityName)abilityLine='<div class="fim-ability loot-reveal-stats">\u26A1 <b>'+tmpl.abilityName+'</b>: '+tmpl.abilityDesc+'</div>';
  var wagerLine='';
  if(f.wagerDebuffName)wagerLine='<div class="fim-wager loot-reveal-stats">\u{1F3B2} Wager: '+f.wagerDebuffName+' ('+f.wagerDebuffDesc+')</div>';
  else if(tmpl&&tmpl.wagerDebuff)wagerLine='<div class="fim-wager loot-reveal-stats">\u{1F3B2} Wager: '+tmpl.wagerDebuff.name+' ('+tmpl.wagerDebuff.desc+')</div>';
  var sellPrice=({common:15,uncommon:30,rare:60,epic:120,legendary:250})[f.rarity]||20;
  var rcol=RARITY_COLORS[f.rarity];
  var col=state.p1Collection;
  var runFollowers=state.dgRun.followers||[];
  var allOwned=col.concat(runFollowers);
  var hasDupe=allOwned.some(function(o){return o.name===f.name});
  var sameRarity=allOwned.filter(function(o){return o.rarity===f.rarity}).length;
  var totalOwned=allOwned.length;
  var contextHtml='<div class="loot-reveal-compare" style="font-size:.45rem;color:var(--parch-dk);margin-top:6px;line-height:1.6">';
  if(hasDupe)contextHtml+='<span style="color:#ffaa44">\u26A0 You already have a '+f.name+'</span><br>';
  else contextHtml+='<span style="color:#6a9a6a">\u2728 New to your collection!</span><br>';
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
    if(powerScore>bestPower)powerHtml='<div class="loot-reveal-compare" style="font-size:.45rem;color:#6a9a6a;margin-top:2px">\u2B06 Strongest follower you\'d own!</div>';
    else powerHtml='<div class="loot-reveal-compare" style="font-size:.45rem;color:var(--parch-dk);margin-top:2px">Best: '+bestName+' ('+Math.round(bestPower)+'\u2605) vs this: '+Math.round(powerScore)+'\u2605</div>';
  }
  var rc=document.getElementById('dgRoomContent');
  state.dgRun._pendingCaptureFollower=f;
  state.dgRun._pendingCaptureAfter=afterFn;
  state.dgRun._pendingCaptureSellPrice=sellPrice;
  rc.innerHTML='<div class="dg-intermission loot-reveal '+f.rarity+'">'+
    '<div class="loot-reveal-card">'+
    '<div class="dg-im-title loot-reveal-name" style="color:'+rcol+'">\u2728 FOLLOWER CAPTURED! \u2728</div>'+
    '<div class="dg-im-follower '+f.rarity+'">'+
      '<div class="fim-icon loot-reveal-icon">'+getIcon(f,32)+'</div>'+
      '<div class="fim-name loot-reveal-name" style="color:'+rcol+'">'+f.name+'</div>'+
      '<div class="fim-rarity loot-reveal-rarity" style="color:'+rcol+'">'+f.rarity+'</div>'+
      '<div class="fim-buff loot-reveal-stats">Arena Buff: '+f.buffDesc+'</div>'+
      abilityLine+wagerLine+
      '<div class="loot-reveal-stats" style="font-size:.45rem;color:var(--parch-dk);margin-top:4px">Combat: '+f.combatHp+'HP / '+f.combatDmg+'DMG / '+f.combatAS+'AS / '+f.combatDef+'DEF</div>'+
      contextHtml+powerHtml+
    '</div>'+
    '<div class="loot-reveal-actions dg-choices">'+
      '<button class="dg-choice" style="border-color:'+rcol+';color:'+rcol+'" onclick="dgKeepFollower()">\u{1F3AF} Keep '+f.name+'</button>'+
      '<button class="dg-choice gold-c" onclick="dgSellFollower()">\u{1F4B0} Release for '+sellPrice+'g</button>'+
    '</div>'+
    '</div>'+
  '</div>';
  SFX.lootDrop(f.rarity);
  var sparkleCount=f.rarity==='legendary'?12:f.rarity==='epic'?8:f.rarity==='rare'?5:0;
  if(sparkleCount){var card=rc.querySelector('.loot-reveal-card');if(card)_spawnDOMSparkles(card,rcol,sparkleCount)}
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
      '\u2B07 FLOOR '+state.dgRun.floor+' \u2B07','#6a9a6a',
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
    // Prevent same room type back-to-back (ignore boss rooms for dedup)
    var last=state.dgRun._lastNonBossRoom||'';
    if(last&&last!=='combat'){
      types=types.filter(function(t){return t!==last});
      if(types.length===0)types=['combat']; // fallback
    }
    roomType=types[Math.floor(Math.random()*types.length)];
  }
  // Track last non-boss room type for dedup
  if(state.dgRun.room!==3)state.dgRun._lastNonBossRoom=roomType;
  state.dgRun.roomHistory.push({floor:state.dgRun.floor,room:state.dgRun.room,type:roomType,cleared:false,name:''});
  renderRoom(roomType);
  dgUpdateProgress();updateDgUI();
}


export function dgCombatVictory(){
  var r=state.dgRun;var m=r.combatEnemy;
  var goldReward=Math.round((5+Math.random()*10)*r.floor);
  if(r.room===3)goldReward=Math.round(goldReward*1.5);
  r.gold+=goldReward;r.totalKills++;
  var stats=r._lastCombatStats||{};
  var lastRoom=r.roomHistory[r.roomHistory.length-1];
  if(lastRoom){lastRoom.cleared=true;lastRoom.name=m.name}
  dgLog(m.name+' defeated! +'+goldReward+' gold.','loot');

  var followerChance=r.room===3?0.25:0.08;
  var droppedFollower=null;
  if(Math.random()<followerChance){droppedFollower=rollFollower(r.floor)}

  // Gear drop: boss = guaranteed, regular = 15% chance
  var gearDropKey=null;
  if(r.room===3){
    gearDropKey=rollGearDrop(r.floor);
  } else if(Math.random()<0.15){
    gearDropKey=rollGearDrop(r.floor);
  }

  r.combatEnemy=null;
  var hpPct=Math.round(r.hp/r.maxHp*100);
  var hpCol=hpPct>30?'#6a9a6a':'#aa5a5a';
  var isBoss=r.room===3;
  if(isBoss)SFX.victoryBoss();else SFX.win();
  var body='<span style="font-size:.6rem">'+(m.icon||'\u2694')+'</span> <b>'+m.name+'</b> slain!'+(isBoss?' <span style="color:#aa5a5a">(BOSS)</span>':'')+
    '<br><br>'+
    '<span class="dg-im-stat victory-stat-pop" style="color:#ff8844;animation-delay:.15s">Dealt: '+(stats.dmgDealt||0)+'</span>'+
    '<span class="dg-im-stat victory-stat-pop" style="color:#aa5a5a;animation-delay:.25s">Taken: '+(stats.dmgTaken||0)+'</span>'+
    '<span class="dg-im-stat victory-stat-pop" style="color:var(--gold-bright);animation-delay:.35s">+'+goldReward+'g</span>'+
    '<br><span class="dg-im-stat victory-stat-pop" style="color:'+hpCol+';animation-delay:.45s">HP: '+Math.round(r.hp)+'/'+r.maxHp+' ('+hpPct+'%)</span>';

  // Build chain of drops to show (gear then follower)
  var afterAllDrops=function(){
    if(r.floor>=8&&r.room===3){dgVictory();return}
    setTimeout(generateRoom,200);
  };
  var afterGear=afterAllDrops;
  if(droppedFollower){
    var fRef=droppedFollower;
    afterGear=function(){
      dgShowFollowerCapture(fRef,afterAllDrops);
    };
  }
  if(gearDropKey){
    var gRef=gearDropKey;var afterG=afterGear;
    var showGearFn=function(){
      dgShowGearDrop(gRef,afterG);
    };
    if(droppedFollower){
      body+='<br><span style="color:'+RARITY_COLORS[droppedFollower.rarity]+';font-size:.55rem">A creature stirs... \u{1F47E}</span>';
    }
    var gItem=ITEMS[gearDropKey];
    if(gItem){
      body+='<br><span style="color:'+GEAR_RARITY_COLORS[gItem.rarity]+';font-size:.55rem">Something shiny drops... '+getIcon(gItem,16)+'</span>';
    }
    dgShowIntermission(isBoss?'\u2B50 BOSS DEFEATED! \u2B50':'\u2694 VICTORY!',isBoss?'#ffcc22':'#6a9a6a',body,
      '\u2728 See your loot','dgProceedToLoot()','victory-slam');
    r._pendingVictoryLoot=showGearFn;
  } else if(droppedFollower){
    var fRef2=droppedFollower;
    var nextFn=function(){
      dgShowFollowerCapture(fRef2,afterAllDrops);
    };
    body+='<br><span style="color:'+RARITY_COLORS[droppedFollower.rarity]+';font-size:.55rem">A creature stirs... \u{1F47E}</span>';
    dgShowIntermission(isBoss?'\u2B50 BOSS DEFEATED! \u2B50':'\u2694 VICTORY!',isBoss?'#ffcc22':'#6a9a6a',body,
      '\u2728 See what you found','dgProceedToLoot()','victory-slam');
    r._pendingVictoryLoot=nextFn;
  } else {
    if(r.floor>=8&&r.room===3){
      dgShowIntermission('\u{1F3C6} FINAL BOSS SLAIN! \u{1F3C6}','#ffcc22',body,'\u{1F3C6} Claim Victory','dgVictory()','victory-slam');
    } else {
      dgShowIntermission(isBoss?'\u2B50 BOSS DEFEATED! \u2B50':'\u2694 VICTORY!',isBoss?'#ffcc22':'#6a9a6a',body,'\u27A1\uFE0F Continue','generateRoom()','victory-slam');
    }
  }
  dgUpdateProgress();updateDgUI();
}

export function dgProceedToLoot(){
  if(state.dgRun._pendingVictoryLoot){
    state.dgRun._pendingVictoryLoot();
    state.dgRun._pendingVictoryLoot=null;
  }
}

// Keep old name for compat
export function dgProceedToCapture(){
  dgProceedToLoot();
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
    r.combatEnemy=monster;r.combatTurn=0;
    r._lastCombatStats={turns:0,dmgDealt:0,dmgTaken:0,hpBefore:r.hp,monsterName:monster.name,monsterIcon:monster.icon};
    // Launch real-time combat
    initDgCombat(monster);
    return; // initDgCombat handles screen switch
  }
  else if(type==='treasure'){
    var gold=Math.round((5+Math.random()*10)*r.floor);
    var hasRunItem=Math.random()>0.4;var runItem=null;
    if(hasRunItem){
      var runItems=[
        {name:'Whetstone',icon:'\u{1FAA8}',desc:'+25 DMG',apply:function(run){run.bonusDmg+=25}},
        {name:'Armor Shard',icon:'\u{1F6E1}\uFE0F',desc:'+15 DEF',apply:function(run){run.bonusDef+=15}},
        {name:'Swift Elixir',icon:'\u26A1',desc:'+0.15 AtkSpd',apply:function(run){run.baseAS+=0.15}},
        {name:'Health Potion',icon:'\u{1F9EA}',desc:'+1 Potion',apply:function(run){run.potions=Math.min(run.maxPotions,run.potions+1)}},
        {name:'Life Crystal',icon:'\u{1F48E}',desc:'+400 Max HP',apply:function(run){run.maxHp+=400;run.hp+=400;run.bonusHp+=400}},
        {name:'Vampire Fang',icon:'\u{1F9B7}',desc:'+3% Lifesteal',apply:function(run){run._lifesteal=(run._lifesteal||0)+0.03}},
        {name:'Wind Charm',icon:'\u{1F300}',desc:'+20 Move Speed',apply:function(run){run.moveSpeed=(run.moveSpeed||0)+20}},
        {name:'Crit Stone',icon:'\u{1F4A5}',desc:'+8% Crit Chance',apply:function(run){run._crit=(run._crit||0)+0.08}},
        {name:'Mana Gem',icon:'\u{1F537}',desc:'+15 Mana',apply:function(run){run.maxMana=(run.maxMana||0)+15;run.mana=(run.mana||0)+15}},
        {name:'Spell Tome',icon:'\u{1F4D8}',desc:'+5% Spell Power',apply:function(run){run._spellPower=(run._spellPower||0)+0.05}},
      ];
      runItem=runItems[Math.floor(Math.random()*runItems.length)];
    }
    // 50% chance of gear drop in treasure rooms
    var treasureGearKey=Math.random()<0.5?rollGearDrop(r.floor):null;
    var gearHint='';
    if(treasureGearKey){
      var gi=ITEMS[treasureGearKey];
      if(gi)gearHint='<br>Gear: <span style="color:'+GEAR_RARITY_COLORS[gi.rarity]+'">'+getIcon(gi,14)+' '+gi.name+'</span>';
    }
    rc.innerHTML='<div class="dg-room"><div class="dg-room-icon">\u{1F4B0}</div><div class="dg-room-title">Treasure!</div><div class="dg-room-desc">You found a chest containing '+gold+' gold!'+(runItem?'<br>Inside: <b style="color:var(--gold-bright)">'+runItem.icon+' '+runItem.name+'</b> - '+runItem.desc:'')+gearHint+'</div>'+
      '<div class="dg-choices"><button class="dg-choice gold-c" onclick="dgTakeTreasure('+gold+','+(runItem?'true':'false')+','+(treasureGearKey?'true':'false')+')">\u270B Take It</button></div></div>';
    r._pendingItem=runItem;
    r._pendingTreasureGear=treasureGearKey;
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
    rc.innerHTML='<div class="dg-room"><div class="dg-room-icon">'+trap.icon+'</div><div class="dg-room-title">'+trap.name+'!</div><div class="dg-room-desc">'+trap.desc+'<br>Potential damage: <span style="color:#aa5a5a">'+trap.dmg+'</span></div>'+
      '<div class="dg-choices"><button class="dg-choice danger" onclick="dgTriggerTrap('+trap.dmg+')">\u{1F4AA} Endure ('+trap.dmg+' dmg)</button>'+(canDodge?'<button class="dg-choice" onclick="dgDodgeTrap('+trap.dmg+')">\u{1F3C3} Dodge ('+dodgeChance+'% full dodge, fail = \u00D70.5)</button>':'')+'</div></div>';
  }
  else if(type==='rest'){
    var healAmt=Math.round(r.maxHp*0.25);
    rc.innerHTML='<div class="dg-room"><div class="dg-room-icon">\u{1F3D5}\uFE0F</div><div class="dg-room-title">Rest Site</div><div class="dg-room-desc">A safe place to rest and recover.<br>Heal: <span style="color:#6a9a6a">'+healAmt+' HP</span></div>'+
      '<div class="dg-choices"><button class="dg-choice" onclick="dgRest('+healAmt+')">\u{1F634} Rest</button><button class="dg-choice gold-c" onclick="generateRoom()">\u27A1\uFE0F Move On</button></div></div>';
  }
  else if(type==='shrine'){
    var shrines=[
      {name:'Shrine of Power',icon:'\u2694\uFE0F',desc:'+35 DMG permanently',apply:function(run){run.bonusDmg+=35}},
      {name:'Shrine of Vitality',icon:'\u2764\uFE0F',desc:'+500 Max HP',apply:function(run){run.maxHp+=500;run.hp+=500;run.bonusHp+=500}},
      {name:'Shrine of Iron',icon:'\u{1F6E1}\uFE0F',desc:'+25 DEF permanently',apply:function(run){run.bonusDef+=25}},
      {name:'Shrine of Shadows',icon:'\u{1F441}\uFE0F',desc:'+8% Evasion',apply:function(run){run.evasion=Math.min(0.5,run.evasion+0.08)}},
      {name:'Shrine of Fury',icon:'\u{1F4A2}',desc:'+0.2 AtkSpd',apply:function(run){run.baseAS+=0.2}},
      {name:'Shrine of Blood',icon:'\u{1FA78}',desc:'+5% Lifesteal',apply:function(run){run._lifesteal=(run._lifesteal||0)+0.05}},
      {name:'Shrine of Storms',icon:'\u{1F329}\uFE0F',desc:'+10% Spell Power',apply:function(run){run._spellPower=(run._spellPower||0)+0.1}},
      {name:'Shrine of Fortune',icon:'\u{1F340}',desc:'+12% Crit Chance',apply:function(run){run._crit=(run._crit||0)+0.12}},
    ];
    var shrine=shrines[Math.floor(Math.random()*shrines.length)];
    var cost=Math.round(r.maxHp*0.15);
    r._pendingShrine=shrine;
    rc.innerHTML='<div class="dg-room"><div class="dg-room-icon">'+shrine.icon+'</div><div class="dg-room-title">'+shrine.name+'</div><div class="dg-room-desc">'+shrine.desc+'<br>Cost: <span style="color:#aa5a5a">'+cost+' HP</span> (blood offering)</div>'+
      '<div class="dg-choices"><button class="dg-choice" onclick="dgUseShrine('+cost+')" '+(r.hp<=cost?'disabled':'')+'>'+'\u{1FA78} Offer Blood</button><button class="dg-choice gold-c" onclick="generateRoom()">\u27A1\uFE0F Skip</button></div></div>';
  }
  else if(type==='merchant'){
    // Mix of run-local items and permanent gear for sale
    var shopItems=[
      {name:'Health Potion',icon:'\u{1F9EA}',cost:20,desc:'+1 Potion',apply:function(run){run.potions=Math.min(run.maxPotions,run.potions+1)}},
      {name:'Damage Tome',icon:'\u{1F4D5}',cost:40,desc:'+30 DMG',apply:function(run){run.bonusDmg+=30}},
      {name:'Shield Scroll',icon:'\u{1F4DC}',cost:35,desc:'+20 DEF',apply:function(run){run.bonusDef+=20}},
      {name:'Healing Salve',icon:'\u{1F49A}',cost:25,desc:'Heal 40% HP',apply:function(run){run.hp=Math.min(run.maxHp,run.hp+Math.round(run.maxHp*0.4))}},
      {name:'Speed Scroll',icon:'\u{1F4A8}',cost:30,desc:'+0.15 AS',apply:function(run){run.baseAS+=0.15}},
      {name:'War Crystal',icon:'\u{1F534}',desc:'+500 HP',cost:35,apply:function(run){run.maxHp+=500;run.hp+=500;run.bonusHp+=500}},
    ];
    // Add 2-3 gear items for sale
    var numGear=2+Math.floor(Math.random()*2);
    var gearForSale=[];
    for(var gi=0;gi<numGear;gi++){
      var gk=rollShopGear(r.floor);
      var gItem=ITEMS[gk];if(!gItem)continue;
      var price=GEAR_PRICES[gItem.rarity]||40;
      gearForSale.push({key:gk,item:gItem,price:price});
    }
    r._shopItems=shopItems;
    r._shopGear=gearForSale;
    var sh='<div class="dg-room"><div class="dg-room-icon">\u{1F3EA}</div><div class="dg-room-title">Wandering Merchant</div><div class="dg-room-desc">Gold: <span style="color:var(--gold-bright)">'+r.gold+'</span></div><div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">';
    shopItems.forEach(function(it,i){
      sh+='<button class="dg-choice gold-c" onclick="dgBuyItem('+i+')" '+(r.gold<it.cost?'disabled':'')+' style="text-align:left;font-size:.48rem">'+getIcon(it,14)+' '+it.name+' - '+it.desc+' ('+it.cost+'g)</button>';
    });
    if(gearForSale.length){
      sh+='<div style="font-size:.48rem;color:#cc66ff;margin-top:6px;margin-bottom:2px">\u2694 Gear for Sale</div>';
      gearForSale.forEach(function(g,i){
        var col=GEAR_RARITY_COLORS[g.item.rarity]||'#aaa';
        sh+='<button class="dg-choice" style="text-align:left;font-size:.48rem;border-color:'+col+';color:'+col+'" onclick="dgBuyGear('+i+')" '+(r.gold<g.price?'disabled':'')+'>'+getIcon(g.item,14)+' '+g.item.name+' ('+g.item.slot+') - '+g.item.desc+' <span style="color:var(--gold-bright)">('+g.price+'g)</span></button>';
      });
    }
    sh+='</div><div class="dg-choices" style="margin-top:6px"><button class="dg-choice" onclick="generateRoom()">\u27A1\uFE0F Leave Shop</button></div></div>';
    rc.innerHTML=sh;
  }
  else if(type==='follower_cage'){
    var f=rollCageFollower(r.floor);
    var lastRoom=r.roomHistory[r.roomHistory.length-1];
    if(lastRoom){lastRoom.cleared=true;lastRoom.name='Cage: '+f.name}
    dgShowFollowerCapture(f,function(){setTimeout(generateRoom,200)});
    return;
  }
  updateDgUI();
}

export function dgUsePotion(){
  var r=state.dgRun;
  if(!r||r.potions<=0)return;
  r.potions--;
  var heal=Math.round(r.maxHp*0.35);
  r.hp=Math.min(r.maxHp,r.hp+heal);
  dgLog('Used potion! Healed '+heal+' HP.','good');
  updateDgUI();
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

export function dgTakeTreasure(gold,hasItem,hasGear){
  var r=state.dgRun;
  r.gold+=gold;dgLog('Gained '+gold+' gold!','loot');
  var lastRoom=r.roomHistory[r.roomHistory.length-1];
  if(lastRoom)lastRoom.cleared=true;
  if(hasItem&&r._pendingItem){
    r._pendingItem.apply(r);
    r.items.push({name:r._pendingItem.name,icon:r._pendingItem.icon,desc:r._pendingItem.desc});
    dgLog('Got '+r._pendingItem.name+'! '+r._pendingItem.desc,'loot');
    r._pendingItem=null;
  }
  if(hasGear&&r._pendingTreasureGear){
    var gk=r._pendingTreasureGear;
    r._pendingTreasureGear=null;
    updateDgUI();
    dgShowGearDrop(gk,function(){setTimeout(generateRoom,200)});
    return;
  }
  updateDgUI();setTimeout(generateRoom,400);
}

export function dgTriggerTrap(dmg){
  var r=state.dgRun;
  var reduced=Math.round(dmg*(1-Math.min((r.def+r.bonusDef)/300,0.7)));
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
    r.items.push({name:r._pendingShrine.name,icon:r._pendingShrine.icon,desc:r._pendingShrine.desc});
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
  r.items.push({name:it.name,icon:it.icon,desc:it.desc});
  dgRefreshMerchant();
  updateDgUI();
}

export function dgBuyGear(idx){
  var r=state.dgRun;
  if(!r._shopGear||!r._shopGear[idx])return;
  var g=r._shopGear[idx];
  if(r.gold<g.price)return;
  r.gold-=g.price;
  dgLog('Bought '+g.item.name+'!','loot');
  r._shopGear.splice(idx,1);
  dgRefreshMerchant();
  updateDgUI();
  dgShowGearDrop(g.key,function(){dgRefreshMerchant();updateDgUI()});
}

function dgRefreshMerchant(){
  var r=state.dgRun;if(!r)return;
  var rc=document.getElementById('dgRoomContent');
  var sh='<div class="dg-room"><div class="dg-room-icon">\u{1F3EA}</div><div class="dg-room-title">Wandering Merchant</div><div class="dg-room-desc">Gold: <span style="color:var(--gold-bright)">'+r.gold+'</span></div><div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">';
  if(r._shopItems)r._shopItems.forEach(function(si,i){
    sh+='<button class="dg-choice gold-c" onclick="dgBuyItem('+i+')" '+(r.gold<si.cost?'disabled':'')+' style="text-align:left;font-size:.48rem">'+getIcon(si,14)+' '+si.name+' - '+si.desc+' ('+si.cost+'g)</button>';
  });
  if(r._shopGear&&r._shopGear.length){
    sh+='<div style="font-size:.48rem;color:#cc66ff;margin-top:6px;margin-bottom:2px">\u2694 Gear for Sale</div>';
    r._shopGear.forEach(function(g,i){
      var col=GEAR_RARITY_COLORS[g.item.rarity]||'#aaa';
      sh+='<button class="dg-choice" style="text-align:left;font-size:.48rem;border-color:'+col+';color:'+col+'" onclick="dgBuyGear('+i+')" '+(r.gold<g.price?'disabled':'')+'>'+getIcon(g.item,14)+' '+g.item.name+' ('+g.item.slot+') - '+g.item.desc+' <span style="color:var(--gold-bright)">('+g.price+'g)</span></button>';
    });
  }
  sh+='</div><div class="dg-choices" style="margin-top:6px"><button class="dg-choice" onclick="generateRoom()">\u27A1\uFE0F Leave Shop</button></div></div>';
  rc.innerHTML=sh;
}

export function dgDeath(){
  var r=state.dgRun;
  dgLog('\u2620 You have been slain on Floor '+r.floor+'!','bad');
  var kept=r.followers.slice(0,Math.ceil(r.followers.length/2));
  kept.forEach(function(f){state.p1Collection.push(f)});
  // Gear already in bag is kept (no stash saving needed)
  var rc=document.getElementById('dgRoomContent');
  var followerList='';
  kept.forEach(function(f){followerList+='<span style="color:'+RARITY_COLORS[f.rarity]+'">'+f.icon+f.name+'</span> '});
  // Build defeat sheet for the monster that killed you
  var slainByHtml='';
  var lastStats=r._lastCombatStats;
  if(r.combatEnemy||lastStats){
    var m=r.combatEnemy||{};
    var defeatData={
      name:lastStats?lastStats.monsterName:m.name||'Unknown',
      icon:lastStats?lastStats.monsterIcon:m.icon||'\u2694',
      stats:{hp:m._maxHp||m.hp||0,dmg:m.dmg||0,def:m.def||0,evasion:m.evasion||0},
      skills:[],type:'monster'
    };
    slainByHtml=buildDefeatSheet(defeatData);
  }
  rc.innerHTML='<div class="dg-intermission">'+
    '<div class="dg-im-title" style="color:#aa5a5a">\u{1F480} DEFEATED \u{1F480}</div>'+
    '<div class="dg-im-summary">'+
      'Fell on <b>Floor '+r.floor+', Room '+r.room+'</b><br><br>'+
      slainByHtml+
      '<span class="dg-im-stat" style="color:#ff8844">Rooms: '+r.roomHistory.length+'</span>'+
      '<span class="dg-im-stat" style="color:#aa5a5a">Kills: '+r.totalKills+'</span>'+
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
  r.followers.forEach(function(f){state.p1Collection.push(f)});
  // Bonus gear drop at floor+2 quality
  var bonusGearKey=rollGearDrop(Math.min(8,r.floor+2));
  state.gearBag.push(bonusGearKey);
  var bonusItem=ITEMS[bonusGearKey];
  var bonus=rollFollower(r.floor+2);
  state.p1Collection.push(bonus);
  var rc=document.getElementById('dgRoomContent');
  var followerList='';
  r.followers.forEach(function(f){followerList+='<span style="color:'+RARITY_COLORS[f.rarity]+'">'+f.icon+f.name+'</span> '});
  var bonusGearHtml=bonusItem?'<br>Bonus Gear: <span style="color:'+GEAR_RARITY_COLORS[bonusItem.rarity]+'">'+bonusItem.icon+' '+bonusItem.name+' ('+bonusItem.rarity+')</span>':'';
  rc.innerHTML='<div class="dg-intermission">'+
    '<div class="dg-im-title" style="color:var(--gold-bright)">\u{1F3C6} DUNGEON CONQUERED! \u{1F3C6}</div>'+
    '<div class="dg-im-summary">'+
      'Cleared all <b>8 Floors</b>!<br><br>'+
      '<span class="dg-im-stat" style="color:#ff8844">Rooms: '+r.roomHistory.length+'</span>'+
      '<span class="dg-im-stat" style="color:#aa5a5a">Kills: '+r.totalKills+'</span>'+
      '<span class="dg-im-stat" style="color:var(--gold-bright)">Gold: '+r.gold+'</span>'+
      '<span class="dg-im-stat" style="color:#88aacc">Dmg Dealt: '+r.totalDmgDealt+'</span>'+
      '<br><br>All <b>'+r.followers.length+'</b> followers kept!'+
      (followerList?'<br>'+followerList:'')+
      '<br><br>Bonus: <span style="color:'+RARITY_COLORS[bonus.rarity]+';font-size:.55rem">'+bonus.icon+' '+bonus.name+' ('+bonus.rarity+')</span>!'+
      bonusGearHtml+
    '</div>'+
    '<div class="dg-choices"><button class="dg-choice gold-c" onclick="endDungeonRun()">\u{1F3C6} Return Victorious</button></div></div>';
  updateDgUI();
}

export function endDungeonRun(){
  state.dgRun=null;
  document.getElementById('dungeonRunScreen').style.display='none';
  document.getElementById('dungeonPickScreen').style.display='flex';
  updateFollowerDisplays();
}

export function abandonDungeon(){
  if(!state.dgRun)return;
  if(!confirm('Abandon run? You keep followers and gear found so far.'))return;
  state.dgRun.followers.forEach(function(f){state.p1Collection.push(f)});
  endDungeonRun();
}
