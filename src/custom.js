// =============== CUSTOM CHARACTER EDITOR ===============
import { state } from './gameState.js';
import { ITEMS, EQ_SLOTS, GEAR_RARITY_COLORS } from './data/items.js';
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
  for(var i=0;i<EQ_SLOTS.length;i++){
    var slot=EQ_SLOTS[i],ik=state.customChar.equipment[slot.key],item=ik?ITEMS[ik]:null,el=document.createElement('div');
    el.className='eq-slot';el.setAttribute('data-slot',slot.key);
    el.onclick=function(){openItemPicker(this.getAttribute('data-slot'))};
    var rarityCol=item&&item.rarity?GEAR_RARITY_COLORS[item.rarity]||'#aaa':'#aaa';
    el.innerHTML='<div class="eq-slot-icon">'+getIcon(item||slot,20)+'</div><div class="eq-slot-label">'+slot.label+'</div><div class="eq-slot-name" style="color:'+rarityCol+'">'+(item?item.name:'- Empty -')+'</div><div class="eq-slot-stats">'+(item?item.desc:'Click')+'</div>'+(item&&item.rarity?'<div style="font-size:.4rem;color:'+rarityCol+'">'+item.rarity+'</div>':'');
    if(ik)attachTooltip(el,(function(k){return function(){return buildGearTooltipHtml(k)}})(ik));
    eq.appendChild(el);
  }
  // Gear bag display
  var bagEl=document.getElementById('gearBagDisplay');
  if(bagEl){
    if(state.gearBag.length===0){
      bagEl.innerHTML='<div style="font-size:.48rem;color:var(--parch-dk);padding:4px">No spare gear. Run dungeons to find loot!</div>';
    } else {
      bagEl.innerHTML='';
      state.gearBag.forEach(function(ik){
        var it=ITEMS[ik];if(!it)return;
        var col=GEAR_RARITY_COLORS[it.rarity]||'#aaa';
        var div=document.createElement('div');div.className='dg-inv-item';div.style.cursor='default';
        div.innerHTML='<span class="dg-inv-icon">'+getIcon(it,14)+'</span><span style="color:'+col+'">'+it.name+'</span> <span style="font-size:.42rem;color:var(--parch-dk)">('+it.slot+')</span>';
        attachTooltip(div,(function(k){return function(){return buildGearTooltipHtml(k)}})(ik));
        bagEl.appendChild(div);
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
  var equippedKey=state.customChar.equipment[slotKey];
  var ownedKeys=state.gearBag.filter(function(k){return ITEMS[k]&&ITEMS[k].slot===slotKey});
  var c=document.getElementById('ddItems');c.innerHTML='';
  document.getElementById('ddTitle').textContent='Choose '+slotKey;
  var el=document.createElement('div');el.className='dd-item';
  el.innerHTML='<div class="dd-item-icon">\u2715</div><div class="dd-item-info"><div class="dd-item-name" style="color:#aa6666">Unequip</div></div>';
  el.onclick=function(){
    if(equippedKey){state.gearBag.push(equippedKey)}
    state.customChar.equipment[slotKey]=null;buildCustomSheet();closeDD();
  };c.appendChild(el);
  if(equippedKey&&ITEMS[equippedKey]){
    var v=ITEMS[equippedKey];
    var col=GEAR_RARITY_COLORS[v.rarity]||'#aaa';
    el=document.createElement('div');el.className='dd-item';el.style.opacity='0.5';
    el.innerHTML='<div class="dd-item-icon">'+getIcon(v,18)+'</div><div class="dd-item-info"><div class="dd-item-name" style="color:'+col+'">'+v.name+' (equipped)</div><div class="dd-item-stats">'+v.desc+'</div><div style="font-size:.4rem;color:'+col+'">'+v.rarity+'</div></div>';
    c.appendChild(el);
  }
  ownedKeys.forEach(function(k){
    var v=ITEMS[k];if(!v)return;
    var col=GEAR_RARITY_COLORS[v.rarity]||'#aaa';
    el=document.createElement('div');el.className='dd-item';
    el.innerHTML='<div class="dd-item-icon">'+getIcon(v,18)+'</div><div class="dd-item-info"><div class="dd-item-name" style="color:'+col+'">'+v.name+'</div><div class="dd-item-stats">'+v.desc+'</div><div style="font-size:.4rem;color:'+col+'">'+v.rarity+'</div></div>';
    el.onclick=function(){
      if(equippedKey){state.gearBag.push(equippedKey)}
      var idx=state.gearBag.indexOf(k);
      if(idx>=0)state.gearBag.splice(idx,1);
      state.customChar.equipment[slotKey]=k;
      buildCustomSheet();closeDD();
    };
    attachTooltip(el,(function(key){return function(){return buildGearTooltipHtml(key)}})(k));
    c.appendChild(el);
  });
  if(ownedKeys.length===0&&!equippedKey){
    el=document.createElement('div');el.className='dd-item';
    el.innerHTML='<div class="dd-item-info"><div class="dd-item-name" style="color:var(--parch-dk)">No gear for this slot. Run dungeons!</div></div>';
    c.appendChild(el);
  }
  document.getElementById('ddOverlay').classList.add('show');
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
