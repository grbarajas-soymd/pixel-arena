// =============== CUSTOM CHARACTER EDITOR ===============
import { state } from './gameState.js';
import { ITEMS, EQ_SLOTS, GEAR_RARITY_COLORS } from './data/items.js';
import { ALL_SKILLS, ALL_ULTS } from './data/skills.js';
import { getCustomTotalStats, getWeaponRangeType } from './combat/hero.js';
import { buildSelector } from './modes/arena.js';

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
    el.innerHTML='<div class="eq-slot-icon">'+(item?item.icon:slot.icon)+'</div><div class="eq-slot-label">'+slot.label+'</div><div class="eq-slot-name" style="color:'+rarityCol+'">'+(item?item.name:'- Empty -')+'</div><div class="eq-slot-stats">'+(item?item.desc:'Click')+'</div>'+(item&&item.rarity?'<div style="font-size:.4rem;color:'+rarityCol+'">'+item.rarity+'</div>':'');
    eq.appendChild(el);
  }
  // Gear bag display
  var bagEl=document.getElementById('gearBagDisplay');
  if(bagEl){
    if(state.gearBag.length===0){
      bagEl.innerHTML='<div style="font-size:.48rem;color:var(--parch-dk);padding:4px">No spare gear. Run dungeons to find loot!</div>';
    } else {
      var bh='';
      state.gearBag.forEach(function(ik){
        var it=ITEMS[ik];if(!it)return;
        var col=GEAR_RARITY_COLORS[it.rarity]||'#aaa';
        bh+='<div class="dg-inv-item" style="cursor:default"><span class="dg-inv-icon">'+it.icon+'</span><span style="color:'+col+'">'+it.name+'</span> <span style="font-size:.42rem;color:var(--parch-dk)">('+it.slot+')</span></div>';
      });
      bagEl.innerHTML=bh;
    }
  }
  for(var i=0;i<2;i++){
    var el2=document.getElementById('skillSlot'+(i+1)),sk=state.customChar.skills[i]!==null?ALL_SKILLS[state.customChar.skills[i]]:null;
    if(sk){el2.innerHTML='<div class="skill-icon">'+sk.icon+'</div><div class="skill-info"><div class="skill-name">'+sk.name+'</div><div class="skill-desc">'+sk.desc+'</div><div class="skill-source">From: '+sk.source+'</div></div>';el2.classList.add('active')}
    else{el2.innerHTML='<div class="skill-icon">&#10067;</div><div class="skill-info"><div class="skill-name">Skill '+(i+1)+' - Click</div></div>';el2.classList.remove('active')}
  }
  var ue=document.getElementById('ultSlot'),u=state.customChar.ultimate!==null?ALL_ULTS[state.customChar.ultimate]:null;
  if(u){ue.innerHTML='<div class="skill-icon">'+u.icon+'</div><div class="skill-info"><div class="skill-name">'+u.name+'</div><div class="skill-desc">'+u.desc+'</div><div class="skill-source">From: '+u.source+'</div></div>';ue.classList.add('active')}
  else{ue.innerHTML='<div class="skill-icon">&#10067;</div><div class="skill-info"><div class="skill-name">Ultimate - Click</div></div>';ue.classList.remove('active')}
  updateTotalStats();drawPreview();
}

export function updateTotalStats(){
  var s=getCustomTotalStats(),el=document.getElementById('customTotalStats');
  var rt=getWeaponRangeType();
  el.innerHTML='<b style="color:#ff88ff">Total Stats</b><br>HP:'+Math.round(s.hp)+' Dmg:'+Math.round(s.baseDmg)+'<br>AS:'+s.baseAS.toFixed(2)+' DEF:'+Math.round(s.def)+'<br>Eva:'+Math.round(s.evasion*100)+'% Spd:'+Math.round(s.moveSpeed)+'<br>Range: '+rt+(s.mana>0?'<br>Mana:'+Math.round(s.mana):'')+(s.energy>0?'<br>Eng:'+Math.round(s.energy):'');
}

export function drawPreview(){
  var pc=document.getElementById('previewCanvas'),c=pc.getContext('2d');
  c.clearRect(0,0,160,180);c.fillStyle='rgba(200,80,200,0.05)';c.fillRect(0,0,160,180);
  var cx=80,cy=140;c.fillStyle='rgba(0,0,0,0.2)';c.fillRect(cx-16,cy+2,32,6);
  function p(x,y,w,h,cl){c.fillStyle=cl;c.fillRect(Math.round(cx+x),Math.round(cy+y),w,h)}
  p(-12,-20,24,18,'#6a2a6a');p(-10,-22,20,4,'#7a3a7a');p(-14,-18,4,10,'#5a1a5a');p(10,-18,4,10,'#5a1a5a');
  p(-2,-14,4,4,'#cc44cc');p(-8,-36,16,14,'#d4b898');p(-5,-32,3,3,'#fff');p(2,-32,3,3,'#fff');
  p(-4,-31,2,2,'#cc44cc');p(3,-31,2,2,'#cc44cc');p(-10,-42,20,8,'#5a1a5a');
  p(-10,0,7,4,'#3a4a5a');p(3,0,7,4,'#3a4a5a');
  c.fillStyle='#ff88ff';c.font='bold 9px "Chakra Petch"';c.textAlign='center';
  c.fillText(state.customChar.name||'Custom',80,22);
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
    el.innerHTML='<div class="dd-item-icon">'+v.icon+'</div><div class="dd-item-info"><div class="dd-item-name" style="color:'+col+'">'+v.name+' (equipped)</div><div class="dd-item-stats">'+v.desc+'</div><div style="font-size:.4rem;color:'+col+'">'+v.rarity+'</div></div>';
    c.appendChild(el);
  }
  ownedKeys.forEach(function(k){
    var v=ITEMS[k];if(!v)return;
    var col=GEAR_RARITY_COLORS[v.rarity]||'#aaa';
    el=document.createElement('div');el.className='dd-item';
    el.innerHTML='<div class="dd-item-icon">'+v.icon+'</div><div class="dd-item-info"><div class="dd-item-name" style="color:'+col+'">'+v.name+'</div><div class="dd-item-stats">'+v.desc+'</div><div style="font-size:.4rem;color:'+col+'">'+v.rarity+'</div></div>';
    el.onclick=function(){
      if(equippedKey){state.gearBag.push(equippedKey)}
      var idx=state.gearBag.indexOf(k);
      if(idx>=0)state.gearBag.splice(idx,1);
      state.customChar.equipment[slotKey]=k;
      buildCustomSheet();closeDD();
    };
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
    el.onclick=function(){if(isUlt)state.customChar.ultimate=i;else state.customChar.skills[idx]=i;buildCustomSheet();closeDD()};c.appendChild(el)});
  document.getElementById('ddOverlay').classList.add('show');
}

export function closeDD(){document.getElementById('ddOverlay').classList.remove('show')}

export function openCustomEditor(side){
  state.customChar.editingSide=side;
  document.getElementById('selectorScreen').style.display='none';
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
  document.getElementById('selectorScreen').style.display='flex';
  buildSelector();
}

export function cancelCustom(){
  document.getElementById('customScreen').style.display='none';
  document.getElementById('selectorScreen').style.display='flex';
}
