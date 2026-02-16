// =============== DUNGEON SYSTEM ===============
import { state } from '../gameState.js';
import { CLASSES } from '../data/classes.js';
import { ITEMS, EQ_SLOTS, GEAR_RARITY_COLORS, rollGearDrop, rollShopGear, rollVictoryGearDrop, gearTemplate, resolveGear, gearSalvageValue } from '../data/items.js';
import { FOLLOWER_TEMPLATES, RARITY_COLORS, rollFollower, rollCageFollower, CRAFT_COSTS, UPGRADE_COST, MAX_UPGRADES, craftFollower, upgradeFollower } from '../data/followers.js';
import { SFX } from '../sfx.js';
import { getCustomTotalStats } from '../combat/hero.js';
import { initDgCombat } from './dgCombat.js';
import { buildCustomTooltip, buildDefeatSheet, updateFollowerDisplays, renderFollowerCards } from '../render/ui.js';
import { drawSpritePreview } from '../render/sprites.js';
import { buildCharSheet } from '../render/charSheet.js';
import { getIcon } from '../render/icons.js';
import { attachTooltip, buildGearTooltipHtml, buildFollowerTooltipHtml, buildRunItemTooltipHtml } from '../tooltip.js';
import { uploadStats } from '../network.js';
import { saveGame } from '../persistence.js';

var GEAR_PRICES={common:20,uncommon:40,rare:70,epic:120,legendary:250};

function _attachMerchantGearTooltips(container){
  container.querySelectorAll('.dg-gear-btn').forEach(function(btn){
    var idx=parseInt(btn.getAttribute('data-gear-idx'));
    if(!isNaN(idx)&&state.dgRun&&state.dgRun._shopGear&&state.dgRun._shopGear[idx]){
      attachTooltip(btn,(function(g){return function(){return buildGearTooltipHtml(g.gear)}})(state.dgRun._shopGear[idx]));
    }
  });
}

var DG_MONSTERS=[
  {name:'Goblin Scout',icon:'\u{1F47A}',hp:350,dmg:35,def:5,tier:1,monsterType:'humanoid',colors:{body:'#4a6a2a',accent:'#6a4a1a',eye:'#ffcc00'},specials:['heavyStrike']},
  {name:'Cave Bat',icon:'\u{1F987}',hp:220,dmg:45,def:2,tier:1,monsterType:'beast',colors:{body:'#3a2a2a',accent:'#5a3a3a',eye:'#ff4444'},specials:['enrage']},
  {name:'Slime',icon:'\u{1F7E2}',hp:260,dmg:25,def:5,tier:1,monsterType:'blob',colors:{body:'#3a8a3a',accent:'#2a6a2a',eye:'#ffffff'},specials:['heal']},
  {name:'Skeleton',icon:'\u{1F480}',hp:380,dmg:40,def:8,tier:1,monsterType:'humanoid',colors:{body:'#8a8a7a',accent:'#5a5a4a',eye:'#ffdd44'},specials:['heavyStrike']},
  {name:'Orc Warrior',icon:'\u{1F479}',hp:700,dmg:65,def:18,tier:2,monsterType:'humanoid',colors:{body:'#4a5a2a',accent:'#6a3a1a',eye:'#ff6622'},specials:['heavyStrike','enrage']},
  {name:'Dark Mage',icon:'\u{1F9D9}',hp:500,dmg:90,def:10,tier:2,monsterType:'humanoid',colors:{body:'#3a2a5a',accent:'#5a3a7a',eye:'#cc66ff'},specials:['heal','warStomp']},
  {name:'Troll',icon:'\u{1F9CC}',hp:900,dmg:55,def:25,tier:2,monsterType:'beast',colors:{body:'#4a6a4a',accent:'#3a4a2a',eye:'#88ff44'},specials:['heal','enrage']},
  {name:'Ghost',icon:'\u{1F47B}',hp:450,dmg:75,def:6,tier:2,evasion:0.2,monsterType:'ghost',colors:{body:'#8888bb',accent:'#6666aa',eye:'#ffffff'},specials:['poisonSpit']},
  {name:'Minotaur',icon:'\u{1F402}',hp:1400,dmg:110,def:30,tier:3,monsterType:'beast',colors:{body:'#6a3a2a',accent:'#4a2a1a',eye:'#ff2222'},specials:['heavyStrike','warStomp']},
  {name:'Lich',icon:'\u2620\uFE0F',hp:950,dmg:140,def:15,tier:3,monsterType:'humanoid',colors:{body:'#2a3a4a',accent:'#4a5a6a',eye:'#44ffcc'},specials:['poisonSpit','heal']},
  {name:'Stone Golem',icon:'\u{1F5FF}',hp:1800,dmg:85,def:50,tier:3,monsterType:'beast',colors:{body:'#5a5a5a',accent:'#3a3a3a',eye:'#ffaa22'},specials:['warStomp','enrage']},
  {name:'Wyvern',icon:'\u{1F409}',hp:1100,dmg:130,def:22,tier:3,monsterType:'winged',colors:{body:'#6a4a2a',accent:'#8a5a2a',eye:'#ff6622'},specials:['enrage','poisonSpit']},
  {name:'Dragon',icon:'\u{1F432}',hp:2500,dmg:170,def:40,tier:4,monsterType:'winged',colors:{body:'#6a2a2a',accent:'#8a3a1a',eye:'#ff4400'},specials:['enrage','heavyStrike']},
  {name:'Demon Lord',icon:'\u{1F608}',hp:2200,dmg:190,def:35,tier:4,monsterType:'humanoid',colors:{body:'#4a1a2a',accent:'#6a2a3a',eye:'#ff2244'},specials:['warStomp','poisonSpit']},
  {name:'Ancient Wyrm',icon:'\u{1F40D}',hp:3200,dmg:150,def:45,tier:4,monsterType:'winged',colors:{body:'#2a4a3a',accent:'#3a6a4a',eye:'#44ff88'},specials:['heal','enrage']},
];

export function buildDungeonPicker(){
  buildCharSheet('dungeonCharSheet');
  _renderDgClearInfo();
  _renderDgCompanionPicker();
  _renderFollowerForge();
}

function _renderDgClearInfo(){
  var el=document.getElementById('dgClearInfo');if(!el)return;
  var c=state.dungeonClears||0;
  if(c===0){
    el.innerHTML='<span style="color:var(--parch-dk);font-size:.48rem">First descent awaits...</span>';
  } else {
    var diffPct=c*15;
    var tierBoost=Math.min(2,Math.floor(c/2));
    var mythicChance=Math.min(70,40+c*3);
    el.innerHTML='<div style="font-size:.48rem;color:var(--parch-dk);line-height:1.7;text-align:center">'+
      'Clears: <span style="color:var(--gold-bright);font-weight:bold">'+c+'</span>'+
      ' | Difficulty: <span style="color:#cc6666">+'+diffPct+'%</span>'+
      (tierBoost>0?' | Tier: <span style="color:#cc66ff">+'+tierBoost+'</span>':'')+
      ' | Mythic: <span style="color:#cc3333">'+mythicChance+'%</span>'+
    '</div>';
  }
  var btn=document.getElementById('btnDungeon');
  if(btn)btn.innerHTML=c>0?'\u{1F3D4}\uFE0F DESCEND (Endless)':'\u{1F3D4}\uFE0F DESCEND';
}

function _renderDgCompanionPicker(){
  if(state._dgCompanionIdx===undefined)state._dgCompanionIdx=null;
  var nf=document.getElementById('p1NoFollowers');
  if(nf)nf.style.display=state.p1Collection.length?'none':'block';
  renderFollowerCards('p1CollectionDisplay',state.p1Collection,function(f,i){
    state._dgCompanionIdx=state._dgCompanionIdx===i?null:i;
    _renderDgCompanionPicker();
  });
  var cards=document.querySelectorAll('#p1CollectionDisplay .follower-card');
  cards.forEach(function(card,i){
    if(i===state._dgCompanionIdx)card.classList.add('selected');
  });
  var helper=document.getElementById('dgCompanionHelper');
  if(!helper){
    var container=document.getElementById('p1CollectionDisplay');
    if(container&&container.parentNode){
      helper=document.createElement('div');helper.id='dgCompanionHelper';
      helper.style.cssText='font-size:.45rem;color:var(--text-dim);text-align:center;margin:4px 0';
      container.parentNode.insertBefore(helper,container);
    }
  }
  if(helper){
    if(state.p1Collection.length>0){
      var sel=state._dgCompanionIdx!==null?state.p1Collection[state._dgCompanionIdx]:null;
      helper.innerHTML=sel
        ?'<span style="color:'+RARITY_COLORS[sel.rarity]+'">'+sel.icon+' '+sel.name+'</span> will join as companion'
        :'Tap a follower to bring them as your starting companion';
    }else helper.innerHTML='';
  }
}

function _renderFollowerForge(){
  var el=document.getElementById('followerForgeUI');
  if(!el)return;
  var dustEl=document.getElementById('forgeDustDisplay');
  if(dustEl)dustEl.textContent='(\u2728 '+(state.dust||0)+' dust)';
  var html='<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-bottom:8px">';
  var rarities=['common','uncommon','rare','epic','legendary'];
  rarities.forEach(function(r){
    var cost=CRAFT_COSTS[r];
    var col=RARITY_COLORS[r];
    var canAfford=(state.dust||0)>=cost;
    html+='<button class="forge-craft-btn" data-rarity="'+r+'" style="border-color:'+col+';color:'+col+'"'+(canAfford?'':' disabled')+'>'+r.charAt(0).toUpperCase()+r.slice(1)+' ('+cost+'\u2728)</button>';
  });
  html+='</div>';
  // Upgrade section — show owned followers with upgrade buttons
  if(state.p1Collection.length>0){
    html+='<div style="font-size:.45rem;color:var(--parch-dk);margin:6px 0">Upgrade a follower (+15% combat stats, max '+MAX_UPGRADES+'x, '+UPGRADE_COST+' dust each):</div>';
    html+='<div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center">';
    state.p1Collection.forEach(function(f,i){
      var ups=f.upgrades||0;
      var canUp=(state.dust||0)>=UPGRADE_COST&&ups<MAX_UPGRADES;
      var col2=RARITY_COLORS[f.rarity]||'#aaa';
      var stars='';for(var s=0;s<ups;s++)stars+='\u2B50';
      html+='<button class="forge-upgrade-btn" data-idx="'+i+'" style="border-color:'+col2+';color:'+col2+'"'+(canUp?'':' disabled')+'>'+f.icon+' '+f.name+(stars?' '+stars:'')+' ('+(ups>=MAX_UPGRADES?'MAX':UPGRADE_COST+'\u2728')+')</button>';
    });
    html+='</div>';
  }
  el.innerHTML=html;
  // Attach craft handlers
  el.querySelectorAll('.forge-craft-btn').forEach(function(btn){
    btn.onclick=function(){_forgeCraft(btn.getAttribute('data-rarity'))};
  });
  // Attach upgrade handlers
  el.querySelectorAll('.forge-upgrade-btn').forEach(function(btn){
    btn.onclick=function(){_forgeUpgrade(parseInt(btn.getAttribute('data-idx')))};
  });
}

function _forgeCraft(rarity){
  var cost=CRAFT_COSTS[rarity];
  if(!cost||(state.dust||0)<cost)return;
  state.dust-=cost;
  var f=craftFollower(rarity);
  if(!f)return;
  state.p1Collection.push(f);
  saveGame();
  _renderDgCompanionPicker();
  _renderFollowerForge();
}

function _forgeUpgrade(idx){
  if(idx<0||idx>=state.p1Collection.length)return;
  if((state.dust||0)<UPGRADE_COST)return;
  var f=state.p1Collection[idx];
  if(upgradeFollower(f)){
    state.dust-=UPGRADE_COST;
    saveGame();
    _renderDgCompanionPicker();
    _renderFollowerForge();
  }
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
    deployedFollower:null,
    roomHistory:[],
    totalKills:0,totalDmgDealt:0,totalDmgTaken:0,
    _lastCombatStats:null,
  };
  state.dgRun.hp+=state.dgRun.bonusHp;state.dgRun.maxHp+=state.dgRun.bonusHp;
  // Bring selected companion from collection
  if(state._dgCompanionIdx!==null&&state.p1Collection[state._dgCompanionIdx]){
    var comp=state.p1Collection[state._dgCompanionIdx];
    var brought=Object.assign({},comp,{_brought:true});
    state.dgRun.followers.push(brought);
    var bDesc=applyFollowerBuffToRun(brought,state.dgRun);
    state.dgRun.deployedFollower=brought;
  }
  dgLog('You descend into the depths...','info');
  if(state.dgRun.deployedFollower&&state.dgRun.deployedFollower._brought){
    dgLog(state.dgRun.deployedFollower.name+' fights by your side!','good');
  }
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
  else{inv.innerHTML='';r.items.forEach(function(it){var div=document.createElement('div');div.className='dg-inv-item';div.innerHTML='<span class="dg-inv-icon">'+getIcon(it,16)+'</span><span>'+it.name+'</span>';attachTooltip(div,function(){return buildRunItemTooltipHtml(it.name,it.desc)});inv.appendChild(div)})}
  var fc=document.getElementById('dgFollowers');
  if(r.followers.length===0)fc.innerHTML='<div style="font-size:.48rem;color:var(--parch-dk);padding:4px">None yet</div>';
  else{fc.innerHTML='';r.followers.forEach(function(f,fi){
    var isDeployed=r.deployedFollower===f;
    var div=document.createElement('div');div.className='dg-inv-item';
    if(isDeployed)div.style.cssText='border-left:2px solid #bb88ff;padding-left:4px';
    div.innerHTML='<span class="dg-inv-icon">'+getIcon(f,16)+'</span>'+
      '<span class="dg-loot-name '+f.rarity+'">'+f.name+'</span>'+
      (isDeployed?' <span style="color:#bb88ff;font-size:.45rem">\u2694 ACTIVE</span>':
        ' <button class="dg-deploy-btn" onclick="dgDeployFollower('+fi+')">Deploy</button>');
    attachTooltip(div,(function(follower){return function(){return buildFollowerTooltipHtml(follower)}})(f));
    fc.appendChild(div);
  })}
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
  var logBtn=(r._lastCombatLog&&r._lastCombatLog.length)?'<button class="dg-choice cl-log-btn" onclick="showCombatLogPopup()">\u{1F4DC} Combat Log</button>':'';
  rc.innerHTML='<div class="dg-intermission">'+
    '<div class="dg-im-title '+(titleClass||'')+'" style="color:'+(titleColor||'var(--parch)')+'">'+title+'</div>'+
    '<div class="dg-im-summary">'+bodyHtml+'</div>'+
    '<div style="margin:6px 0">'+
      '<span class="dg-im-stat" style="color:#6a9a6a">HP: '+Math.round(r.hp)+'/'+r.maxHp+'</span>'+
      '<span class="dg-im-stat" style="color:var(--gold-bright)">Gold: '+r.gold+'</span>'+
      '<span class="dg-im-stat" style="color:#88aacc">Kills: '+r.totalKills+'</span>'+
      '<span class="dg-im-stat" style="color:#cc66ff">Followers: '+r.followers.length+'</span>'+
    '</div>'+
    '<div class="dg-choices"><button class="dg-choice gold-c" onclick="'+nextFn+'">'+(nextLabel||'\u27A1\uFE0F Continue')+'</button>'+logBtn+'</div>'+
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

// gearDrop can be a gear instance object or legacy string key
export function dgShowGearDrop(gearDrop,afterFn){
  var tmpl=gearTemplate(gearDrop);
  var resolved=resolveGear(gearDrop);
  if(!tmpl)return;
  var col=GEAR_RARITY_COLORS[tmpl.rarity]||'#aaa';
  var dropStats=resolved?resolved.stats:tmpl.stats;
  var dropDesc=resolved?resolved.desc:tmpl.desc;
  var quality=resolved&&!resolved._legacy?resolved.quality:null;
  var dustVal=gearSalvageValue(gearDrop);

  // Compare to currently equipped
  var currentEntry=state.customChar.equipment[tmpl.slot];
  var currentTmpl=gearTemplate(currentEntry);
  var currentRes=resolveGear(currentEntry);
  var compareHtml='';
  if(currentTmpl){
    var curStats=currentRes?currentRes.stats:currentTmpl.stats;
    var diffs=[];
    var allStatKeys={};
    for(var k in dropStats)allStatKeys[k]=true;
    for(var k2 in curStats)allStatKeys[k2]=true;
    for(var sk in allStatKeys){
      var newVal=dropStats[sk]||0;
      var curVal=curStats[sk]||0;
      var diff=newVal-curVal;
      if(diff!==0){
        var label=sk==='hp'?'HP':sk==='baseDmg'?'DMG':sk==='baseAS'?'AS':sk==='def'?'DEF':sk==='evasion'?'EVA':sk==='moveSpeed'?'SPD':sk==='mana'?'MANA':sk;
        var diffStr=diff>0?'<span style="color:#6a9a6a">+'+(sk==='evasion'||sk==='spellDmgBonus'?Math.round(diff*100)+'%':sk==='baseAS'?diff.toFixed(2):Math.round(diff))+'</span>':'<span style="color:#aa5a5a">'+(sk==='evasion'||sk==='spellDmgBonus'?Math.round(diff*100)+'%':sk==='baseAS'?diff.toFixed(2):Math.round(diff))+'</span>';
        diffs.push('<span class="loot-reveal-stat" style="animation-delay:'+(0.5+diffs.length*0.08)+'s">'+label+': '+diffStr+'</span>');
      }
    }
    var curCol=GEAR_RARITY_COLORS[currentTmpl.rarity]||'#aaa';
    compareHtml='<div class="loot-reveal-compare" style="font-size:.45rem;margin-top:6px;color:var(--parch-dk)">Currently: <span style="color:'+curCol+'">'+getIcon(currentTmpl,14)+' '+currentTmpl.name+'</span></div>';
    if(diffs.length)compareHtml+='<div class="loot-reveal-stats" style="font-size:.45rem;margin-top:2px">'+diffs.join(' | ')+'</div>';
  } else {
    compareHtml='<div class="loot-reveal-compare" style="font-size:.45rem;margin-top:4px;color:#6a9a6a">No item equipped in '+tmpl.slot+'</div>';
  }

  // Quality badge
  var qualityHtml='';
  if(quality!==null&&quality!==undefined){
    if(quality>=95)qualityHtml='<div class="gear-drop-quality perfect">\u2B50 PERFECT ROLL! ('+quality+'%)</div>';
    else if(quality>=80)qualityHtml='<div class="gear-drop-quality excellent">Excellent ('+quality+'%)</div>';
    else if(quality>=60)qualityHtml='<div class="gear-drop-quality good">Good ('+quality+'%)</div>';
  }

  state.dgRun._pendingGearDrop=gearDrop;
  state.dgRun._pendingGearAfter=afterFn;

  // Full-screen overlay presentation
  var overlay=document.createElement('div');
  overlay.className='gear-drop-overlay '+tmpl.rarity;
  overlay.id='gearDropOverlay';
  overlay.innerHTML=
    '<div class="gear-drop-backdrop"></div>'+
    '<div class="gear-drop-card">'+
      '<div class="gear-drop-burst"></div>'+
      '<div class="gear-drop-title" style="color:'+col+'">GEAR DROP!</div>'+
      '<div class="gear-drop-icon">'+getIcon(tmpl,64)+'</div>'+
      '<div class="gear-drop-name" style="color:'+col+'">'+tmpl.name+'</div>'+
      '<div class="gear-drop-rarity" style="color:'+col+'">'+tmpl.rarity.toUpperCase()+'</div>'+
      qualityHtml+
      '<div class="gear-drop-stats">'+dropDesc+'</div>'+
      '<div class="gear-drop-slot">Slot: '+tmpl.slot+'</div>'+
      compareHtml+
      '<div class="gear-drop-actions">'+
        '<button class="gear-drop-btn equip" style="border-color:'+col+';color:'+col+'" onclick="dgEquipGearDrop()">\u2694 Equip</button>'+
        '<button class="gear-drop-btn stash" onclick="dgStashGearDrop()">\u{1F392} Stash</button>'+
        (dustVal>0?'<button class="gear-drop-btn salvage" onclick="dgSalvageGearDrop()">\u2728 Salvage ('+dustVal+' dust)</button>':'')+
      '</div>'+
    '</div>';
  document.body.appendChild(overlay);
  SFX.lootDrop(tmpl.rarity);
  var sparkleCount=tmpl.rarity==='mythic'?35:tmpl.rarity==='legendary'?24:tmpl.rarity==='epic'?16:tmpl.rarity==='rare'?10:tmpl.rarity==='uncommon'?6:3;
  var card=overlay.querySelector('.gear-drop-card');
  if(card)_spawnDOMSparkles(card,col,sparkleCount);
  updateDgUI();
}

function _removeGearDropOverlay(){
  var ov=document.getElementById('gearDropOverlay');
  if(ov)ov.remove();
}

export function dgEquipGearDrop(){
  if(!state.dgRun||!state.dgRun._pendingGearDrop)return;
  var gearDrop=state.dgRun._pendingGearDrop;
  var tmpl=gearTemplate(gearDrop);if(!tmpl)return;
  var slot=tmpl.slot;
  var oldEntry=state.customChar.equipment[slot];
  if(oldEntry)state.gearBag.push(oldEntry);
  state.customChar.equipment[slot]=gearDrop;
  dgLog('Equipped '+tmpl.name+'!','loot');
  var afterFn=state.dgRun._pendingGearAfter;
  state.dgRun._pendingGearDrop=null;state.dgRun._pendingGearAfter=null;
  _removeGearDropOverlay();
  updateDgUI();
  if(afterFn)afterFn();else setTimeout(generateRoom,300);
}

export function dgStashGearDrop(){
  if(!state.dgRun||!state.dgRun._pendingGearDrop)return;
  var gearDrop=state.dgRun._pendingGearDrop;
  var tmpl=gearTemplate(gearDrop);
  state.gearBag.push(gearDrop);
  dgLog('Stashed '+(tmpl?tmpl.name:'item')+' in gear bag.','loot');
  var afterFn=state.dgRun._pendingGearAfter;
  state.dgRun._pendingGearDrop=null;state.dgRun._pendingGearAfter=null;
  _removeGearDropOverlay();
  updateDgUI();
  if(afterFn)afterFn();else setTimeout(generateRoom,300);
}

export function dgSalvageGearDrop(){
  if(!state.dgRun||!state.dgRun._pendingGearDrop)return;
  var gearDrop=state.dgRun._pendingGearDrop;
  var tmpl=gearTemplate(gearDrop);
  var dustVal=gearSalvageValue(gearDrop);
  state.dust=(state.dust||0)+dustVal;
  dgLog('Salvaged '+(tmpl?tmpl.name:'item')+' for '+dustVal+' dust.','loot');
  var afterFn=state.dgRun._pendingGearAfter;
  state.dgRun._pendingGearDrop=null;state.dgRun._pendingGearAfter=null;
  _removeGearDropOverlay();
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
      '<div class="fim-buff loot-reveal-stats">Buff: '+f.buffDesc+'</div>'+
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
  var sparkleCount=f.rarity==='legendary'?12:f.rarity==='epic'?8:f.rarity==='rare'?5:f.rarity==='mythic'?18:0;
  if(sparkleCount){var card=rc.querySelector('.loot-reveal-card');if(card)_spawnDOMSparkles(card,rcol,sparkleCount)}
  updateDgUI();
}

export function dgKeepFollower(){
  if(!state.dgRun._pendingCaptureFollower)return;
  var f=state.dgRun._pendingCaptureFollower;
  state.dgRun.followers.push(f);
  dgLog('Kept '+f.name+'! ('+f.rarity+')','loot');
  // Apply passive buffs
  var buffDesc=applyFollowerBuffToRun(f,state.dgRun);
  if(buffDesc)dgLog('Buff: '+buffDesc,'good');
  // Auto-deploy first captured follower
  if(!state.dgRun.deployedFollower){
    state.dgRun.deployedFollower=f;
    dgLog('Auto-deployed '+f.name+' as combat companion!','good');
  }
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

function applyFollowerBuffToRun(f,run){
  if(!f||!f.buff||!run)return '';
  var parts=[];
  var b=f.buff;
  if(b.baseDmg){run.bonusDmg+=b.baseDmg;parts.push('+'+b.baseDmg+' DMG');}
  if(b.def){run.bonusDef+=b.def;parts.push('+'+b.def+' DEF');}
  if(b.hp){run.maxHp+=b.hp;run.hp+=b.hp;run.bonusHp+=b.hp;parts.push('+'+b.hp+' HP');}
  if(b.baseAS){run.bonusAS+=b.baseAS;parts.push('+'+b.baseAS.toFixed(2)+' AS');}
  if(b.evasion){run.evasion=Math.min(0.8,(run.evasion||0)+b.evasion);parts.push('+'+Math.round(b.evasion*100)+'% EVA');}
  if(b.crit){run.crit=(run.crit||0)+b.crit;parts.push('+'+Math.round(b.crit*100)+'% CRIT');}
  if(b.lifesteal){run.lifesteal=(run.lifesteal||0)+b.lifesteal;parts.push('+'+Math.round(b.lifesteal*100)+'% Lifesteal');}
  return parts.join(', ');
}

export function dgDeployFollower(idx){
  var run=state.dgRun;
  if(!run||!run.followers[idx])return;
  run.deployedFollower=run.followers[idx];
  dgLog('Deployed '+run.deployedFollower.name+' as combat companion!','good');
  updateDgUI();
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
    // No rest on floor 1 — player starts near full HP
    if(state.dgRun.floor===1)types=types.filter(function(t){return t!=='rest'});
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
  var goldScale=1+(state.dungeonClears||0)*0.1;
  var goldReward=Math.round((5+Math.random()*10)*r.floor*goldScale);
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
  var gearDrop=null;
  if(r.room===3){
    gearDrop=rollGearDrop(r.floor,state.dungeonClears);
  } else if(Math.random()<0.15){
    gearDrop=rollGearDrop(r.floor,state.dungeonClears);
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
  if(gearDrop){
    var gRef=gearDrop;var afterG=afterGear;
    var showGearFn=function(){
      dgShowGearDrop(gRef,afterG);
    };
    if(droppedFollower){
      body+='<br><span style="color:'+RARITY_COLORS[droppedFollower.rarity]+';font-size:.55rem">A creature stirs... \u{1F47E}</span>';
    }
    var gTmpl=gearTemplate(gearDrop);
    if(gTmpl){
      body+='<br><span style="color:'+GEAR_RARITY_COLORS[gTmpl.rarity]+';font-size:.55rem">Something shiny drops... '+getIcon(gTmpl,16)+'</span>';
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
    var clears=state.dungeonClears||0;
    var tierBoost=Math.min(2,Math.floor(clears/2));
    var tier=Math.min(4,Math.ceil(r.floor/2)+tierBoost);
    var pool=DG_MONSTERS.filter(function(m){return m.tier<=tier});
    var monster={...pool[Math.floor(Math.random()*pool.length)]};
    var clearScale=1+clears*0.15;
    var scale=(1+(r.floor-1)*0.18)*clearScale;
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
    var treasureScale=1+(state.dungeonClears||0)*0.1;
    var gold=Math.round((5+Math.random()*10)*r.floor*treasureScale);
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
    var treasureGear=Math.random()<0.5?rollGearDrop(r.floor,state.dungeonClears):null;
    var gearHint='';
    if(treasureGear){
      var gi=gearTemplate(treasureGear);
      if(gi)gearHint='<br>Gear: <span style="color:'+GEAR_RARITY_COLORS[gi.rarity]+'">'+getIcon(gi,14)+' '+gi.name+'</span>';
    }
    rc.innerHTML='<div class="dg-room"><div class="dg-room-icon">\u{1F4B0}</div><div class="dg-room-title">Treasure!</div><div class="dg-room-desc">You found a chest containing '+gold+' gold!'+(runItem?'<br>Inside: <b style="color:var(--gold-bright)">'+runItem.icon+' '+runItem.name+'</b> - '+runItem.desc:'')+gearHint+'</div>'+
      '<div class="dg-choices"><button class="dg-choice gold-c" onclick="dgTakeTreasure('+gold+','+(runItem?'true':'false')+','+(treasureGear?'true':'false')+')">\u270B Take It</button></div></div>';
    r._pendingItem=runItem;
    r._pendingTreasureGear=treasureGear;
  }
  else if(type==='trap'){
    var trapScale=1+(state.dungeonClears||0)*0.1;
    var traps=[
      {name:'Spike Trap',icon:'\u26A0\uFE0F',desc:'Sharp spikes spring from the floor!',dmg:Math.round((150+r.floor*50)*trapScale)},
      {name:'Poison Gas',icon:'\u2601\uFE0F',desc:'Toxic fumes fill the chamber!',dmg:Math.round((250+r.floor*60)*trapScale)},
      {name:'Falling Rocks',icon:'\u{1FAA8}',desc:'The ceiling collapses!',dmg:Math.round((180+r.floor*45)*trapScale)},
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
    for(var gi2=0;gi2<numGear;gi2++){
      var shopGear=rollShopGear(r.floor);
      var shopTmpl=gearTemplate(shopGear);if(!shopTmpl)continue;
      var price=GEAR_PRICES[shopTmpl.rarity]||40;
      gearForSale.push({gear:shopGear,tmpl:shopTmpl,price:price});
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
        var col=GEAR_RARITY_COLORS[g.tmpl.rarity]||'#aaa';
        var gRes=resolveGear(g.gear);
        sh+='<button class="dg-choice dg-gear-btn" data-gear-idx="'+i+'" style="text-align:left;font-size:.48rem;border-color:'+col+';color:'+col+'" onclick="dgBuyGear('+i+')" '+(r.gold<g.price?'disabled':'')+'>'+getIcon(g.tmpl,14)+' '+g.tmpl.name+' ('+g.tmpl.slot+') - '+(gRes?gRes.desc:g.tmpl.desc)+' <span style="color:var(--gold-bright)">('+g.price+'g)</span></button>';
      });
    }
    sh+='</div><div class="dg-choices" style="margin-top:6px"><button class="dg-choice" onclick="generateRoom()">\u27A1\uFE0F Leave Shop</button></div></div>';
    rc.innerHTML=sh;
    _attachMerchantGearTooltips(rc);
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
    var tGear=r._pendingTreasureGear;
    r._pendingTreasureGear=null;
    updateDgUI();
    dgShowGearDrop(tGear,function(){setTimeout(generateRoom,200)});
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
  dgLog('Bought '+g.tmpl.name+'!','loot');
  r._shopGear.splice(idx,1);
  dgRefreshMerchant();
  updateDgUI();
  dgShowGearDrop(g.gear,function(){dgRefreshMerchant();updateDgUI()});
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
      var col=GEAR_RARITY_COLORS[g.tmpl.rarity]||'#aaa';
      var gRes2=resolveGear(g.gear);
      sh+='<button class="dg-choice dg-gear-btn" data-gear-idx="'+i+'" style="text-align:left;font-size:.48rem;border-color:'+col+';color:'+col+'" onclick="dgBuyGear('+i+')" '+(r.gold<g.price?'disabled':'')+'>'+getIcon(g.tmpl,14)+' '+g.tmpl.name+' ('+g.tmpl.slot+') - '+(gRes2?gRes2.desc:g.tmpl.desc)+' <span style="color:var(--gold-bright)">('+g.price+'g)</span></button>';
    });
  }
  sh+='</div><div class="dg-choices" style="margin-top:6px"><button class="dg-choice" onclick="generateRoom()">\u27A1\uFE0F Leave Shop</button></div></div>';
  rc.innerHTML=sh;
  _attachMerchantGearTooltips(rc);
}

export function dgDeath(){
  var r=state.dgRun;
  dgLog('\u2620 You have been slain on Floor '+r.floor+'!','bad');
  var captured=r.followers.filter(function(f){return !f._brought});
  var keptCaptured=captured.slice(0,Math.ceil(captured.length/2));
  keptCaptured.forEach(function(f){state.p1Collection.push(f)});
  var kept=r.followers.filter(function(f){return f._brought}).concat(keptCaptured);
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
    '<div class="dg-choices"><button class="dg-choice" onclick="endDungeonRun()">\u21A9 Return</button>'+
    ((r._lastCombatLog&&r._lastCombatLog.length)?'<button class="dg-choice cl-log-btn" onclick="showCombatLogPopup()">\u{1F4DC} Combat Log</button>':'')+
    '</div></div>';
  updateDgUI();
}

export function dgVictory(){
  var r=state.dgRun;
  state.dungeonClears++;
  if(state.playerId)uploadStats(state.playerId,state.ladderBest,state.dungeonClears);
  dgLog('\u{1F3C6} Dungeon cleared! (Clear #'+state.dungeonClears+')','loot');
  r.followers.forEach(function(f){if(!f._brought)state.p1Collection.push(f)});
  // Victory drop — mythic or legendary based on clear count
  var bonusGear=rollVictoryGearDrop(state.dungeonClears);
  state.gearBag.push(bonusGear);
  var bonusItem=gearTemplate(bonusGear);
  var bonus=rollFollower(r.floor+2);
  state.p1Collection.push(bonus);
  var rc=document.getElementById('dgRoomContent');
  var followerList='';
  r.followers.forEach(function(f){followerList+='<span style="color:'+RARITY_COLORS[f.rarity]+'">'+f.icon+f.name+'</span> '});
  var bonusGearCol=bonusItem?GEAR_RARITY_COLORS[bonusItem.rarity]||'#aaa':'#aaa';
  var bonusGearHtml=bonusItem?'<br>Victory Reward: <span style="color:'+bonusGearCol+';font-weight:bold">'+bonusItem.icon+' '+bonusItem.name+' ('+bonusItem.rarity+')</span>':'';
  var nextDiffPct=Math.round(state.dungeonClears*15);
  rc.innerHTML='<div class="dg-intermission">'+
    '<div class="dg-im-title" style="color:var(--gold-bright)">\u{1F3C6} DUNGEON CONQUERED! \u{1F3C6}</div>'+
    '<div class="dg-im-summary">'+
      'Clear <b>#'+state.dungeonClears+'</b> complete!<br><br>'+
      '<span class="dg-im-stat" style="color:#ff8844">Rooms: '+r.roomHistory.length+'</span>'+
      '<span class="dg-im-stat" style="color:#aa5a5a">Kills: '+r.totalKills+'</span>'+
      '<span class="dg-im-stat" style="color:var(--gold-bright)">Gold: '+r.gold+'</span>'+
      '<span class="dg-im-stat" style="color:#88aacc">Dmg Dealt: '+r.totalDmgDealt+'</span>'+
      '<br><br>All <b>'+r.followers.length+'</b> followers kept!'+
      (followerList?'<br>'+followerList:'')+
      '<br><br>Bonus: <span style="color:'+RARITY_COLORS[bonus.rarity]+';font-size:.55rem">'+bonus.icon+' '+bonus.name+' ('+bonus.rarity+')</span>!'+
      bonusGearHtml+
      '<br><br><span style="font-size:.48rem;color:#cc6666">Next descent: +'+nextDiffPct+'% difficulty</span>'+
    '</div>'+
    '<div class="dg-choices"><button class="dg-choice gold-c" onclick="endDungeonRun()">\u{1F3C6} Return Victorious</button>'+
    ((r._lastCombatLog&&r._lastCombatLog.length)?'<button class="dg-choice cl-log-btn" onclick="showCombatLogPopup()">\u{1F4DC} Combat Log</button>':'')+
    '</div></div>';
  updateDgUI();
}

export function endDungeonRun(){
  state.dgRun=null;
  state._dgCompanionIdx=null;
  document.getElementById('dungeonRunScreen').style.display='none';
  document.getElementById('dungeonPickScreen').style.display='flex';
  updateFollowerDisplays();
  buildDungeonPicker();
}

export function abandonDungeon(){
  if(!state.dgRun)return;
  if(!confirm('Abandon run? You keep followers and gear found so far.'))return;
  state.dgRun.followers.forEach(function(f){if(!f._brought)state.p1Collection.push(f)});
  endDungeonRun();
}

// =============== COMBAT LOG POPUP ===============
export function showCombatLogPopup(){
  var r=state.dgRun;
  if(!r||!r._lastCombatLog||!r._lastCombatLog.length)return;
  var existing=document.getElementById('combatLogPopup');
  if(existing)existing.remove();
  var cls={dmg:'#ff8844',heal:'#5a9a5a',spell:'#aa88ff',miss:'#888888',death:'#ff4444',ult:'#ffcc22',stun:'#ffcc22',bleed:'#cc4444',summon:'#44cccc',poison:'#88cc44'};
  var stats=r._lastCombatStats||{};
  var html='<div class="cl-popup-header">'+
    (stats.monsterIcon||'\u2694')+' <b>'+((stats.monsterName)||'Combat')+'</b> \u2014 '+
    (stats.turns||'?')+' turns'+
    '<button class="cl-popup-close" onclick="closeCombatLogPopup()">\u2716</button>'+
    '</div>'+
    '<div class="cl-popup-stats">'+
    '<span style="color:#ff8844">Dealt: '+(stats.dmgDealt||0)+'</span> \u2022 '+
    '<span style="color:#aa5a5a">Taken: '+(stats.dmgTaken||0)+'</span>'+
    '</div>'+
    '<div class="cl-popup-entries">';
  r._lastCombatLog.forEach(function(e){
    var col=cls[e.typ]||'#ccccaa';
    html+='<div class="cl-entry"><span class="cl-turn">[T'+e.t+']</span> <span style="color:'+col+'">'+e.txt+'</span></div>';
  });
  html+='</div>';
  var popup=document.createElement('div');
  popup.id='combatLogPopup';
  popup.className='cl-popup-overlay';
  popup.innerHTML='<div class="cl-popup">'+html+'</div>';
  popup.addEventListener('click',function(ev){if(ev.target===popup)closeCombatLogPopup()});
  document.body.appendChild(popup);
}

export function closeCombatLogPopup(){
  var el=document.getElementById('combatLogPopup');
  if(el)el.remove();
}
