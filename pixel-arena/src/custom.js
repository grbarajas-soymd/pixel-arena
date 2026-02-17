// =============== CUSTOM CHARACTER EDITOR ===============
import { state } from './gameState.js';
import { ITEMS, EQ_SLOTS, GEAR_RARITY_COLORS, resolveGear, gearTemplate, gearSalvageValue } from './data/items.js';
import { ALL_SKILLS, ALL_ULTS } from './data/skills.js';
import { getCustomTotalStats, getWeaponRangeType } from './combat/hero.js';
import { switchMode } from './modes/arena.js';
import { drawSpritePreview } from './render/sprites.js';
import { getIcon } from './render/icons.js';
import { attachTooltip, buildGearTooltipHtml, buildSkillTooltipHtml } from './tooltip.js';

// Default skill loadouts per class
var CLASS_DEFAULTS = {
  wizard:   { skills: [0, 2], ultimate: 0 }, // Chain Lightning + Static Shield, Thunderstorm
  ranger:   { skills: [3, 4], ultimate: 1 }, // Hunter's Mark + Bloodlust, Rain of Fire
  assassin: { skills: [6, 7], ultimate: 2 }, // Shadow Step + Envenom, Death Mark
  barbarian:{ skills: [9, 10], ultimate: 3 }, // Charge + War Cry, Berserker Rage
};

export function buildCustomSheet(){
  var eq=document.getElementById('equipSlots');eq.innerHTML='';
  // Dust display
  var dustEl=document.getElementById('dustDisplay');
  if(dustEl)dustEl.textContent='\u2728 Dust: '+(state.dust||0);
  for(var i=0;i<EQ_SLOTS.length;i++){
    var slot=EQ_SLOTS[i],entry=state.customChar.equipment[slot.key],tmpl=gearTemplate(entry),resolved=resolveGear(entry),el=document.createElement('div');
    el.className='eq-slot';el.setAttribute('data-slot',slot.key);
    el.onclick=function(){openItemPicker(this.getAttribute('data-slot'))};
    var rarityCol=tmpl&&tmpl.rarity?GEAR_RARITY_COLORS[tmpl.rarity]||'#aaa':'#aaa';
    el.innerHTML='<div class="eq-slot-icon">'+getIcon(tmpl||slot,20)+'</div><div class="eq-slot-label">'+slot.label+'</div><div class="eq-slot-name" style="color:'+rarityCol+'">'+(tmpl?tmpl.name:'- Empty -')+'</div><div class="eq-slot-stats">'+(resolved?resolved.desc:'Click')+'</div>'+(tmpl&&tmpl.rarity?'<div style="font-size:.4rem;color:'+rarityCol+'">'+tmpl.rarity+'</div>':'');
    if(entry)attachTooltip(el,(function(e){return function(){return buildGearTooltipHtml(e)}})(entry));
    eq.appendChild(el);
  }
  // Gear bag display
  var bagEl=document.getElementById('gearBagDisplay');
  if(bagEl){
    if(state.gearBag.length===0){
      bagEl.innerHTML='<div style="font-size:.48rem;color:var(--parch-dk);padding:4px">No spare gear. Run dungeons to find loot!</div>';
    } else {
      bagEl.innerHTML='';
      state.gearBag.forEach(function(entry,idx){
        var tmpl2=gearTemplate(entry);if(!tmpl2)return;
        var resolved2=resolveGear(entry);
        var col=GEAR_RARITY_COLORS[tmpl2.rarity]||'#aaa';
        var dustVal=gearSalvageValue(entry);
        var div=document.createElement('div');div.className='dg-inv-item';div.style.cursor='default';div.style.display='flex';div.style.alignItems='center';div.style.gap='4px';
        div.innerHTML='<span class="dg-inv-icon">'+getIcon(tmpl2,14)+'</span><span style="color:'+col+';flex:1">'+tmpl2.name+'</span> <span style="font-size:.42rem;color:var(--parch-dk)">('+tmpl2.slot+')</span>'+(dustVal>0?'<button class="salvage-btn" data-idx="'+idx+'" title="Salvage for '+dustVal+' dust">\u2728'+dustVal+'</button>':'');
        attachTooltip(div,(function(e){return function(){return buildGearTooltipHtml(e)}})(entry));
        bagEl.appendChild(div);
      });
      // Attach salvage handlers
      bagEl.querySelectorAll('.salvage-btn').forEach(function(btn){
        btn.onclick=function(e){e.stopPropagation();salvageBagItem(parseInt(this.getAttribute('data-idx')))};
      });
    }
  }
  for(var i=0;i<2;i++){
    var el2=document.getElementById('skillSlot'+(i+1)),sk=state.customChar.skills[i]!==null?ALL_SKILLS[state.customChar.skills[i]]:null;
    if(sk){el2.innerHTML='<div class="skill-icon">'+sk.icon+'</div><div class="skill-info"><div class="skill-name">'+sk.name+'</div><div class="skill-desc">'+sk.desc+'</div><div class="skill-source">From: '+sk.source+'</div></div>';el2.classList.add('active')}
    else{el2.innerHTML='<div class="skill-icon">&#10067;</div><div class="skill-info"><div class="skill-name">Skill '+(i+1)+' - Click</div></div>';el2.classList.remove('active')}
    if(!el2._tooltipAttached){attachTooltip(el2,(function(idx){return function(){var si=state.customChar.skills[idx];return si!==null?buildSkillTooltipHtml(si,false):''}})(i));el2._tooltipAttached=true}
  }
  var ue=document.getElementById('ultSlot'),u=state.customChar.ultimate!==null?ALL_ULTS[state.customChar.ultimate]:null;
  if(u){ue.innerHTML='<div class="skill-icon">'+u.icon+'</div><div class="skill-info"><div class="skill-name">'+u.name+'</div><div class="skill-desc">'+u.desc+'</div><div class="skill-source">From: '+u.source+'</div></div>';ue.classList.add('active')}
  else{ue.innerHTML='<div class="skill-icon">&#10067;</div><div class="skill-info"><div class="skill-name">Ultimate - Click</div></div>';ue.classList.remove('active')}
  if(!ue._tooltipAttached){attachTooltip(ue,function(){var ui=state.customChar.ultimate;return ui!==null?buildSkillTooltipHtml(ui,true):''});ue._tooltipAttached=true}
  updateTotalStats();drawPreview();
}

export function updateTotalStats(){
  var s=getCustomTotalStats(),el=document.getElementById('customTotalStats');
  var rt=getWeaponRangeType();
  el.innerHTML='<b style="color:#d8b858">Total Stats</b><br>HP:'+Math.round(s.hp)+' Dmg:'+Math.round(s.baseDmg)+'<br>AS:'+s.baseAS.toFixed(2)+' DEF:'+Math.round(s.def)+'<br>Eva:'+Math.round(s.evasion*100)+'% Spd:'+Math.round(s.moveSpeed)+'<br>Range: '+rt+(s.mana>0?'<br>Mana:'+Math.round(s.mana):'')+(s.energy>0?'<br>Eng:'+Math.round(s.energy):'');
}

export function drawPreview(){
  var pc=document.getElementById('previewCanvas');
  drawSpritePreview(pc,state.customChar.sprite,state.customChar.equipment);
  var c=pc.getContext('2d');
  c.fillStyle='#d8b858';c.font='bold 14px "Cinzel"';c.textAlign='center';
  c.fillText(state.customChar.name||'Custom',120,24);
}

export function applyClassDefaults(){
  var cls=document.getElementById('customClass').value;
  var d=CLASS_DEFAULTS[cls];
  if(d){
    state.customChar.skills=[d.skills[0],d.skills[1]];
    state.customChar.ultimate=d.ultimate;
  }
  state.customChar.sprite=cls;
  buildCustomSheet();
}

export function openItemPicker(slotKey){
  var equippedEntry=state.customChar.equipment[slotKey];
  var ownedEntries=[];
  state.gearBag.forEach(function(entry,idx){var tmpl3=gearTemplate(entry);if(tmpl3&&tmpl3.slot===slotKey)ownedEntries.push({entry:entry,idx:idx})});
  var c=document.getElementById('ddItems');c.innerHTML='';
  document.getElementById('ddTitle').textContent='Choose '+slotKey;
  var el=document.createElement('div');el.className='dd-item';
  el.innerHTML='<div class="dd-item-icon">\u2715</div><div class="dd-item-info"><div class="dd-item-name" style="color:#aa6666">Unequip</div></div>';
  el.onclick=function(){
    if(equippedEntry){state.gearBag.push(equippedEntry)}
    state.customChar.equipment[slotKey]=null;buildCustomSheet();closeDD();
  };c.appendChild(el);
  var eqTmpl=gearTemplate(equippedEntry);
  var eqRes=resolveGear(equippedEntry);
  if(eqTmpl){
    var col=GEAR_RARITY_COLORS[eqTmpl.rarity]||'#aaa';
    el=document.createElement('div');el.className='dd-item';el.style.opacity='0.5';
    el.innerHTML='<div class="dd-item-icon">'+getIcon(eqTmpl,18)+'</div><div class="dd-item-info"><div class="dd-item-name" style="color:'+col+'">'+eqTmpl.name+' (equipped)</div><div class="dd-item-stats">'+(eqRes?eqRes.desc:eqTmpl.desc)+'</div><div style="font-size:.4rem;color:'+col+'">'+eqTmpl.rarity+'</div></div>';
    c.appendChild(el);
  }
  ownedEntries.forEach(function(obj){
    var entry2=obj.entry,bagIdx=obj.idx;
    var tmpl4=gearTemplate(entry2);if(!tmpl4)return;
    var res4=resolveGear(entry2);
    var col2=GEAR_RARITY_COLORS[tmpl4.rarity]||'#aaa';
    el=document.createElement('div');el.className='dd-item';
    el.innerHTML='<div class="dd-item-icon">'+getIcon(tmpl4,18)+'</div><div class="dd-item-info"><div class="dd-item-name" style="color:'+col2+'">'+tmpl4.name+'</div><div class="dd-item-stats">'+(res4?res4.desc:tmpl4.desc)+'</div><div style="font-size:.4rem;color:'+col2+'">'+tmpl4.rarity+'</div></div>';
    el.onclick=function(){
      if(equippedEntry){state.gearBag.push(equippedEntry)}
      state.gearBag.splice(bagIdx,1);
      state.customChar.equipment[slotKey]=entry2;
      buildCustomSheet();closeDD();
    };
    attachTooltip(el,(function(e){return function(){return buildGearTooltipHtml(e)}})(entry2));
    c.appendChild(el);
  });
  if(ownedEntries.length===0&&!equippedEntry){
    el=document.createElement('div');el.className='dd-item';
    el.innerHTML='<div class="dd-item-info"><div class="dd-item-name" style="color:var(--parch-dk)">No gear for this slot. Run dungeons!</div></div>';
    c.appendChild(el);
  }
  document.getElementById('ddOverlay').classList.add('show');
}

function salvageBagItem(idx){
  if(idx<0||idx>=state.gearBag.length)return;
  var entry=state.gearBag[idx];
  var dustVal=gearSalvageValue(entry);
  state.gearBag.splice(idx,1);
  state.dust=(state.dust||0)+dustVal;
  buildCustomSheet();
}

export function openSkillPicker(idx){
  var isUlt=idx===2,arr=isUlt?ALL_ULTS:ALL_SKILLS;
  var c=document.getElementById('ddItems');c.innerHTML='';
  document.getElementById('ddTitle').textContent=isUlt?'Choose Ultimate':'Choose Skill '+(idx+1);
  var el=document.createElement('div');el.className='dd-item';
  el.innerHTML='<div class="dd-item-icon">\u2715</div><div class="dd-item-info"><div class="dd-item-name" style="color:#aa6666">Remove</div></div>';
  el.onclick=function(){if(isUlt)state.customChar.ultimate=null;else state.customChar.skills[idx]=null;buildCustomSheet();closeDD()};c.appendChild(el);
  arr.forEach(function(sk,i){el=document.createElement('div');el.className='dd-item';
    el.innerHTML='<div class="dd-item-icon">'+sk.icon+'</div><div class="dd-item-info"><div class="dd-item-name">'+sk.name+'</div><div class="dd-item-stats">'+sk.desc+'<br><span style="color:#cc44cc">From: '+sk.source+'</span></div></div>';
    el.onclick=function(){if(isUlt)state.customChar.ultimate=i;else state.customChar.skills[idx]=i;buildCustomSheet();closeDD()};attachTooltip(el,(function(si,iu){return function(){return buildSkillTooltipHtml(si,iu)}})(i,isUlt));c.appendChild(el)});
  document.getElementById('ddOverlay').classList.add('show');
}

export function closeDD(){document.getElementById('ddOverlay').classList.remove('show')}

export function openCustomEditor(side){
  state.customChar.editingSide=side;
  // Track which screen we came from
  state._customReturnScreen=null;
  if(document.getElementById('selectorScreen').style.display!=='none'&&document.getElementById('selectorScreen').style.display!==''){
    state._customReturnScreen='arena';
    document.getElementById('selectorScreen').style.display='none';
  } else if(document.getElementById('dungeonScreen').style.display!=='none'&&document.getElementById('dungeonScreen').style.display!==''){
    state._customReturnScreen='dungeon';
    document.getElementById('dungeonScreen').style.display='none';
  } else if(document.getElementById('ladderScreen').style.display!=='none'&&document.getElementById('ladderScreen').style.display!==''){
    state._customReturnScreen='ladder';
    document.getElementById('ladderScreen').style.display='none';
  } else {
    // Fallback: hide all screens
    state._customReturnScreen='dungeon';
    document.getElementById('selectorScreen').style.display='none';
    document.getElementById('dungeonScreen').style.display='none';
    document.getElementById('ladderScreen').style.display='none';
  }
  document.getElementById('customScreen').style.display='flex';
  document.getElementById('customName').value=state.customChar.name;
  document.getElementById('customClass').value=state.customChar.sprite;
  buildCustomSheet();
}

export function saveCustomAndBack(){
  state.customChar.name=document.getElementById('customName').value||'Custom';
  state.customChar.sprite=document.getElementById('customClass').value;
  state.p1Class='custom';
  document.getElementById('customScreen').style.display='none';
  var ret=state._customReturnScreen||'dungeon';
  switchMode(ret);
}

export function cancelCustom(){
  document.getElementById('customScreen').style.display='none';
  var ret=state._customReturnScreen||'dungeon';
  switchMode(ret);
}
