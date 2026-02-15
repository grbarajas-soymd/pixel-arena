// =============== CUSTOM CHARACTER EDITOR ===============
import { state } from './gameState.js';
import { ITEMS, EQ_SLOTS, ED_STATS } from './data/items.js';
import { ALL_SKILLS, ALL_ULTS } from './data/skills.js';
import { getCustomTotalStats } from './combat/hero.js';
import { buildSelector } from './modes/arena.js';

export function buildCustomSheet(){
  var eq=document.getElementById('equipSlots');eq.innerHTML='';
  for(var i=0;i<EQ_SLOTS.length;i++){
    var slot=EQ_SLOTS[i],ik=state.customChar.equipment[slot.key],item=ik?ITEMS[ik]:null,el=document.createElement('div');
    el.className='eq-slot';el.setAttribute('data-slot',slot.key);
    el.onclick=function(){openItemPicker(this.getAttribute('data-slot'))};
    el.innerHTML='<div class="eq-slot-icon">'+(item?item.icon:slot.icon)+'</div><div class="eq-slot-label">'+slot.label+'</div><div class="eq-slot-name">'+(item?item.name:'- Empty -')+'</div><div class="eq-slot-stats">'+(item?item.desc:'Click')+'</div>';
    eq.appendChild(el);
  }
  var st=document.getElementById('statEditors');st.innerHTML='';
  for(var i=0;i<ED_STATS.length;i++){
    var s=ED_STATS[i],r=document.createElement('div');r.className='stat-edit-row';
    var v=s.key==='evasion'||s.key==='spellDmgBonus'?(state.customChar.baseStats[s.key]*100).toFixed(0):s.key==='baseAS'?state.customChar.baseStats[s.key].toFixed(2):state.customChar.baseStats[s.key];
    r.innerHTML='<span class="stat-edit-label">'+s.label+'</span><input class="stat-edit-val" type="number" value="'+v+'" step="'+(s.key==='baseAS'?'0.05':s.key==='evasion'||s.key==='spellDmgBonus'?'1':'10')+'" data-stat="'+s.key+'" onchange="updateStat(this)">';
    st.appendChild(r);
  }
  for(var i=0;i<2;i++){
    var el=document.getElementById('skillSlot'+(i+1)),sk=state.customChar.skills[i]!==null?ALL_SKILLS[state.customChar.skills[i]]:null;
    if(sk){el.innerHTML='<div class="skill-icon">'+sk.icon+'</div><div class="skill-info"><div class="skill-name">'+sk.name+'</div><div class="skill-desc">'+sk.desc+'</div><div class="skill-source">From: '+sk.source+'</div></div>';el.classList.add('active')}
    else{el.innerHTML='<div class="skill-icon">\u2753</div><div class="skill-info"><div class="skill-name">Skill '+(i+1)+' - Click</div></div>';el.classList.remove('active')}
  }
  var ue=document.getElementById('ultSlot'),u=state.customChar.ultimate!==null?ALL_ULTS[state.customChar.ultimate]:null;
  if(u){ue.innerHTML='<div class="skill-icon">'+u.icon+'</div><div class="skill-info"><div class="skill-name">'+u.name+'</div><div class="skill-desc">'+u.desc+'</div><div class="skill-source">From: '+u.source+'</div></div>';ue.classList.add('active')}
  else{ue.innerHTML='<div class="skill-icon">\u2753</div><div class="skill-info"><div class="skill-name">Ultimate - Click</div></div>';ue.classList.remove('active')}
  updateTotalStats();drawPreview();
}

export function updateStat(inp){
  var k=inp.dataset.stat,v=parseFloat(inp.value)||0;
  if(k==='evasion'||k==='spellDmgBonus')v/=100;
  state.customChar.baseStats[k]=v;updateTotalStats();
}

export function updateTotalStats(){
  var s=getCustomTotalStats(),el=document.getElementById('customTotalStats');
  el.innerHTML='<b style="color:#ff88ff">Total Stats</b><br>HP:'+Math.round(s.hp)+' Dmg:'+Math.round(s.baseDmg)+'<br>AS:'+s.baseAS.toFixed(2)+' DEF:'+Math.round(s.def)+'<br>Eva:'+Math.round(s.evasion*100)+'% Spd:'+Math.round(s.moveSpeed)+(s.mana>0?'<br>Mana:'+Math.round(s.mana):'')+(s.energy>0?'<br>Eng:'+Math.round(s.energy):'');
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

export function openItemPicker(slotKey){
  var items=Object.entries(ITEMS).filter(function(e){return e[1].slot===slotKey});
  var c=document.getElementById('ddItems');c.innerHTML='';
  document.getElementById('ddTitle').textContent='Choose '+slotKey;
  var el=document.createElement('div');el.className='dd-item';
  el.innerHTML='<div class="dd-item-icon">\u2715</div><div class="dd-item-info"><div class="dd-item-name" style="color:#aa6666">Unequip</div></div>';
  el.onclick=function(){state.customChar.equipment[slotKey]=null;buildCustomSheet();closeDD()};c.appendChild(el);
  items.forEach(function(e){var k=e[0],v=e[1];el=document.createElement('div');el.className='dd-item';
    el.innerHTML='<div class="dd-item-icon">'+v.icon+'</div><div class="dd-item-info"><div class="dd-item-name">'+v.name+'</div><div class="dd-item-stats">'+v.desc+'</div></div>';
    el.onclick=function(){state.customChar.equipment[slotKey]=k;buildCustomSheet();closeDD()};c.appendChild(el)});
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
  document.getElementById('customRangeType').value=state.customChar.rangeType;
  document.getElementById('customSprite').value=state.customChar.sprite;
  buildCustomSheet();
}

export function saveCustomAndBack(){
  state.customChar.name=document.getElementById('customName').value||'Custom';
  state.customChar.rangeType=document.getElementById('customRangeType').value;
  state.customChar.sprite=document.getElementById('customSprite').value;
  if(state.customChar.editingSide==='p1')state.p1Class='custom';else state.p2Class='custom';
  document.getElementById('customScreen').style.display='none';
  document.getElementById('selectorScreen').style.display='flex';
  buildSelector();
}

export function cancelCustom(){
  document.getElementById('customScreen').style.display='none';
  document.getElementById('selectorScreen').style.display='flex';
}
