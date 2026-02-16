import { state } from '../gameState.js';
import { CLASSES } from '../data/classes.js';
import { ALL_SKILLS, ALL_ULTS } from '../data/skills.js';
import { blN, effAS, effEv, isStunned } from '../combat/engine.js';
import { getCustomTotalStats, getWeaponRangeType } from '../combat/hero.js';
import { getIcon } from './icons.js';
import { attachTooltip, buildFollowerTooltipHtml } from '../tooltip.js';

export function buildHUD(h,id){
  const p=document.getElementById(id);
  const isW=h.type==='wizard',isA=h.type==='assassin',isR=h.type==='ranger',isB=h.type==='barbarian',isC=h.type==='custom';
  const icon=isC?'\u2692':isW?'\u26A1':isA?'\u2744':isR?'\u{1F525}':'\u{1F480}';
  const nameCol=isC?'color:var(--gold-bright)':isW?'color:var(--teal-glow)':isA?'color:var(--ice-glow)':isR?'color:var(--fire-glow)':'color:#aa6a5a';
  const hpCls=isC?'hp-c':isW?'hp-w':isA?'hp-a':isR?'hp-r':'hp-b';
  const className=isC?'Custom':CLASSES[h.type].name;
  let html='<div class="hud-name" style="'+nameCol+'">'+icon+' '+h.name+' \u2014 '+className+'</div>';
  html+='<div class="bar"><div class="bar-label"><span>HP</span><span id="'+id+'hp"></span></div><div class="bar-track"><div class="bar-fill '+hpCls+'" id="'+id+'hpb" style="width:100%"></div></div></div>';
  if(isW)html+='<div class="bar"><div class="bar-label"><span>Mana</span><span id="'+id+'mn"></span></div><div class="bar-track"><div class="bar-fill mana-bar" id="'+id+'mnb" style="width:100%"></div></div></div><div class="bar"><div class="bar-label"><span>Charge</span><span id="'+id+'ch">0</span></div><div class="bar-track"><div class="bar-fill charge-bar" id="'+id+'chb" style="width:0%"></div></div></div>';
  if(isC)html+='<div class="bar"><div class="bar-label"><span>Resource</span><span id="'+id+'rs"></span></div><div class="bar-track"><div class="bar-fill res-bar" id="'+id+'rsb" style="width:100%"></div></div></div>';
  if(isA)html+='<div class="bar"><div class="bar-label"><span>Energy</span><span id="'+id+'en"></span></div><div class="bar-track"><div class="bar-fill energy-bar" id="'+id+'enb" style="width:100%"></div></div></div><div class="bar"><div class="bar-label"><span>Combo</span><span id="'+id+'co">0</span></div><div class="bar-track"><div class="bar-fill combo-bar" id="'+id+'cob" style="width:0%"></div></div></div>';
  if(isR)html+='<div class="bar"><div class="bar-label"><span>Bleed</span><span id="'+id+'bl">0</span></div><div class="bar-track"><div class="bar-fill bleed-bar" id="'+id+'blb" style="width:0%"></div></div></div>';
  html+='<div class="buffs" id="'+id+'bf"></div>';
  html+='<div class="stat-row"><span>DEF '+h.def+'</span><span class="stat-val" id="'+id+'rng"></span></div>';
  html+='<div class="stat-row"><span>Atk Spd</span><span class="stat-val" id="'+id+'as"></span></div>';
  html+='<div class="stat-row"><span>Evasion</span><span class="stat-val" id="'+id+'ev"></span></div>';
  html+='<div class="spells-row" id="'+id+'sp"></div>';
  p.innerHTML=html;
  p.className='hud-panel '+(id==='hudP1'?'p1':'p2');
}

export function updateUI(){
  if(!state.h1||!state.h2)return;
  for(const[h,id]of[[state.h1,'hudP1'],[state.h2,'hudP2']]){
    const hp=Math.max(0,h.hp/h.maxHp*100);const el=s=>document.getElementById(id+s);
    if(el('hpb'))el('hpb').style.width=hp+'%';
    if(el('hp'))el('hp').textContent=Math.round(Math.max(0,h.hp))+'/'+h.maxHp;
    if(h.type==='wizard'){if(el('mnb'))el('mnb').style.width=Math.max(0,h.mana/h.maxMana*100)+'%';if(el('mn'))el('mn').textContent=Math.round(h.mana)+'/'+h.maxMana;if(el('chb'))el('chb').style.width=(h.charge/h.maxCharge*100)+'%';if(el('ch'))el('ch').textContent=h.charge}
    if(h.type==='custom'){if(el('rsb'))el('rsb').style.width=Math.max(0,(h.resource||0)/(h.maxResource||100)*100)+'%';if(el('rs'))el('rs').textContent=Math.round(h.resource||0)+'/'+Math.round(h.maxResource||100)}
    if(h.type==='assassin'){if(el('enb'))el('enb').style.width=Math.max(0,h.energy/h.maxEnergy*100)+'%';if(el('en'))el('en').textContent=Math.round(h.energy)+'/'+h.maxEnergy;if(el('cob'))el('cob').style.width=(Math.floor(h.combo)/h.maxCombo*100)+'%';if(el('co'))el('co').textContent=Math.floor(h.combo)}
    if(h.type==='ranger'){if(el('blb'))el('blb').style.width=Math.min(blN(h)*5,100)+'%';if(el('bl'))el('bl').textContent=blN(h)}
    if(el('as'))el('as').textContent=effAS(h).toFixed(2)+'/s';
    if(el('ev'))el('ev').textContent=Math.round(effEv(h)*100)+'%';
    if(el('rng'))el('rng').textContent='Range: '+(h.type==='assassin'?h.meleeRange+'/'+h.throwRange:Math.round(h.attackRange));
    let bf='';
    if(blN(h)>0)bf+='<span class="buff bleed-b">Bleed x'+blN(h)+'</span>';
    if(h.shocked&&state.bt<h.shockedEnd)bf+='<span class="buff shock-b">Shocked</span>';
    if(isStunned(h))bf+='<span class="buff stun-b">STUNNED</span>';
    if(h.shieldActive)bf+='<span class="buff shield-b">Shield '+Math.round(h.shieldHp)+'</span>';
    if(h.ultActive)bf+='<span class="buff ult-b">'+(h.type==='wizard'?'\u26A1Storm':h.type==='ranger'?'\u{1F525}Rain':'')+'</span>';
    if(h.blActive)bf+='<span class="buff bloodlust-b">Bloodlust</span>';
    if(h.followerAlive)bf+='<span class="buff wolf-b">\u{1F525}Pet</span>';
    if(h.stealthed)bf+='<span class="buff stealth-b">Stealth</span>';
    if(h.envenomed&&state.bt<h.envenomedEnd)bf+='<span class="buff poison-b">Envenom</span>';
    if(h.smokeBombActive)bf+='<span class="buff stealth-b">Smoke</span>';
    if(h.combo>=1)bf+='<span class="buff combo-b">Combo x'+Math.floor(h.combo)+'</span>';
    if(h.charge>0&&h.type==='wizard')bf+='<span class="buff shock-b">Chg x'+h.charge+'</span>';
    if(h.slow>0&&state.bt<h.slowEnd)bf+='<span class="buff slow-b">Slow</span>';
    if(h.deathMarkTarget&&state.bt<h.deathMarkEnd)bf+='<span class="buff marked-b">\u2620 Marked</span>';
    if(el('bf'))el('bf').innerHTML=bf;
    let sp='';
    for(const k in h.spells){const s=h.spells[k];const act=(k==='staticShield'&&h.shieldActive)||(k==='bloodlust'&&h.blActive)||(k==='ultimate'&&h.ultActive)||(k==='envenom'&&h.envenomed&&state.bt<h.envenomedEnd)||(k==='smokeBomb'&&h.smokeBombActive);const cost=s.cost||0;const res=h.type==='wizard'?h.mana:h.type==='assassin'?h.energy:999;const cd=s.used?'USED':s.cd>0?(s.cd/1000).toFixed(1)+'s':res<cost?'Low':'';const rdy=!s.used&&s.cd<=0&&res>=cost;sp+='<span class="spell-chip '+(act?'active-s':s.used?'used-s':rdy?'ready':'')+'">'+s.n+(cd?' <span class="spell-cd">'+cd+'</span>':'')+'</span>'}
    if(el('sp'))el('sp').innerHTML=sp;
  }
  const lEl=document.getElementById('log');const cls={dmg:'l-dmg',heal:'l-heal',spell:'l-spell',bleed:'l-bleed',miss:'l-miss',death:'l-death',ult:'l-ult',summon:'l-summon',shock:'l-shock',stealth:'l-stealth',poison:'l-poison',stun:'l-stun'};
  let lh='';if(state.logs&&state.logs.length)for(const e of state.logs.slice(-80))lh+='<div><span class="lt">['+e.t+'s]</span><span class="'+(cls[e.typ]||'')+'">'+e.txt+'</span></div>';
  lEl.innerHTML=lh;lEl.scrollTop=lEl.scrollHeight;
}

export function buildCharTooltip(key){
  var c=CLASSES[key];
  var skills='';
  if(key==='wizard')skills='<div class="ct-skill"><b>Chain Lightning</b> 260dmg + stun (5s CD, 40 mana)</div><div class="ct-skill"><b>Lightning Bolt</b> 140dmg (2.2s CD, 20 mana)</div><div class="ct-skill"><b>Static Shield</b> '+c.shieldHp+'HP absorb (10s CD, 55 mana)</div><div class="ct-skill"><b>Thunderstorm</b> 5x200dmg + heal at 25% HP</div>';
  else if(key==='ranger')skills='<div class="ct-skill"><b>Hunter\'s Mark</b> Slow + guaranteed hit (8s CD)</div><div class="ct-skill"><b>Bloodlust</b> AtkSpd boost + bleed heal (12s CD)</div><div class="ct-skill"><b>Summon Pet</b> Fire goading pet (15s CD)</div><div class="ct-skill"><b>Rain of Fire</b> Rapid fire + bleed at 20% HP</div>';
  else if(key==='assassin')skills='<div class="ct-skill"><b>Shadow Step</b> Teleport + stealth (3.5s CD, 25 nrg)</div><div class="ct-skill"><b>Envenom</b> Poison 5s (8s CD, 30 nrg)</div><div class="ct-skill"><b>Smoke Bomb</b> +45% eva zone (12s CD, 35 nrg)</div><div class="ct-skill"><b>Death Mark</b> '+(CLASSES.assassin.deathMarkDmg*100)+'% stored dmg burst at '+(CLASSES.assassin.ultThreshold*100)+'% HP</div>';
  else if(key==='barbarian')skills='<div class="ct-skill"><b>Charge</b> Dash + 200dmg (5.5s CD)</div><div class="ct-skill"><b>War Cry</b> AoE 25% slow 2.5s (10s CD)</div><div class="ct-skill"><b>Rage</b> +'+(CLASSES.barbarian.rageMaxDmg*100)+'% dmg +'+(CLASSES.barbarian.rageMaxAS*100)+'% AS as HP drops</div><div class="ct-skill"><b>Berserker</b> +25% dmg +40% AS +3% lifesteal at 30% HP</div>';
  var specials='';
  if(key==='wizard')specials='<div class="ct-row"><span>Cast Speed</span><span class="ct-val">+12%</span></div><div class="ct-row"><span>Spell Power</span><span class="ct-val">+8%</span></div>';
  else if(key==='ranger')specials='<div class="ct-row"><span>Bleed</span><span class="ct-val">Every 3rd hit</span></div><div class="ct-row"><span>Move Bonus</span><span class="ct-val">+15%</span></div>';
  else if(key==='assassin')specials='<div class="ct-row"><span>Combo</span><span class="ct-val">+6% AS per stack</span></div><div class="ct-row"><span>Stealth Hit</span><span class="ct-val">3x dmg</span></div>';
  else if(key==='barbarian')specials='<div class="ct-row"><span>Lifesteal</span><span class="ct-val">2.5%</span></div><div class="ct-row"><span>Stun Resist</span><span class="ct-val">50%</span></div><div class="ct-row"><span>Slow Resist</span><span class="ct-val">'+(CLASSES.barbarian.slowResist*100)+'%</span></div>';
  return '<div class="char-tooltip"><div class="ct-header" style="color:'+c.color+'">'+c.icon+' '+c.name+'</div><div style="font-size:.48rem;color:var(--parch-dk)">'+c.nameShort+'</div><div class="ct-divider"></div>'+
    '<div class="ct-section">Base Stats</div>'+
    '<div class="ct-row"><span>HP</span><span class="ct-val">'+c.hp+'</span></div>'+
    '<div class="ct-row"><span>Damage</span><span class="ct-val">'+c.baseDmg+'</span></div>'+
    '<div class="ct-row"><span>Atk Speed</span><span class="ct-val">'+c.baseAS+'</span></div>'+
    '<div class="ct-row"><span>Defense</span><span class="ct-val">'+c.def+'</span></div>'+
    '<div class="ct-row"><span>Evasion</span><span class="ct-val">'+Math.round((c.evasion||0)*100)+'%</span></div>'+
    '<div class="ct-row"><span>Move Speed</span><span class="ct-val">'+c.moveSpeed+'</span></div>'+
    (c.mana?'<div class="ct-row"><span>Mana</span><span class="ct-val">'+c.mana+' (+'+c.manaRegen+'/s)</span></div>':'')+
    (c.energy?'<div class="ct-row"><span>Energy</span><span class="ct-val">'+c.energy+' (+'+c.energyRegen+'/s)</span></div>':'')+
    specials+'<div class="ct-divider"></div><div class="ct-section">Abilities</div>'+skills+'</div>';
}

export function buildCustomTooltip(){
  var cs=getCustomTotalStats();
  var sn1=state.customChar.skills[0]!==null&&ALL_SKILLS[state.customChar.skills[0]]?'<div class="ct-skill"><b>'+ALL_SKILLS[state.customChar.skills[0]].name+'</b> '+ALL_SKILLS[state.customChar.skills[0]].desc+'</div>':'';
  var sn2=state.customChar.skills[1]!==null&&ALL_SKILLS[state.customChar.skills[1]]?'<div class="ct-skill"><b>'+ALL_SKILLS[state.customChar.skills[1]].name+'</b> '+ALL_SKILLS[state.customChar.skills[1]].desc+'</div>':'';
  var un=state.customChar.ultimate!==null&&ALL_ULTS[state.customChar.ultimate]?'<div class="ct-skill"><b>'+ALL_ULTS[state.customChar.ultimate].name+'</b> (Ultimate)</div>':'';
  return '<div class="char-tooltip"><div class="ct-header" style="color:#d8b858">\u2692 '+state.customChar.name+'</div><div class="ct-divider"></div>'+
    '<div class="ct-section">Stats</div>'+
    '<div class="ct-row"><span>HP</span><span class="ct-val">'+Math.round(cs.hp)+'</span></div>'+
    '<div class="ct-row"><span>Damage</span><span class="ct-val">'+Math.round(cs.baseDmg)+'</span></div>'+
    '<div class="ct-row"><span>Atk Speed</span><span class="ct-val">'+cs.baseAS.toFixed(2)+'</span></div>'+
    '<div class="ct-row"><span>Defense</span><span class="ct-val">'+cs.def+'</span></div>'+
    '<div class="ct-row"><span>Evasion</span><span class="ct-val">'+Math.round(cs.evasion*100)+'%</span></div>'+
    '<div class="ct-row"><span>Range</span><span class="ct-val">'+getWeaponRangeType()+'</span></div>'+
    '<div class="ct-divider"></div><div class="ct-section">Abilities</div>'+sn1+sn2+un+'</div>';
}

export function renderFollowerCards(containerId,followers,clickHandler){
  var el=document.getElementById(containerId);if(!el)return;
  el.innerHTML='';
  followers.forEach(function(f,i){
    var card=document.createElement('div');
    var sel=f._selected||f.assignedP1||f.stakedP1;
    card.className='follower-card'+(sel?' selected':'');
    var badges='';
    if(f.assignedP1)badges+='<div class="staked-badge" style="background:#227744">\u2694</div>';
    if(f.stakedP1)badges+='<div class="staked-badge" style="background:#aa2200;top:auto;bottom:-4px">BET</div>';
    var abilityLine=f.abilityName?'<div style="font-size:.42rem;color:#88ccaa;margin-top:1px">'+f.abilityName+': '+f.abilityDesc+'</div>':'';
    var wagerLine=f.wagerDebuffName?'<div style="font-size:.42rem;color:#cc8866;margin-top:1px">Wager: '+f.wagerDebuffName+' ('+f.wagerDebuffDesc+')</div>':'';
    card.innerHTML='<div class="fc-icon">'+getIcon(f,24)+'</div><div class="fc-name '+f.rarity+'">'+f.name+'</div><div class="fc-rarity '+f.rarity+'">'+f.rarity+'</div><div class="fc-stats">'+f.buffDesc+'</div>'+abilityLine+wagerLine+badges;
    attachTooltip(card,(function(follower){return function(){return buildFollowerTooltipHtml(follower)}})(f));
    if(clickHandler)card.onclick=function(){clickHandler(f,i)};
    el.appendChild(card);
  });
}

export function updateFollowerDisplays(){
  // Dungeon follower display handled by buildDungeonPicker
  // Ladder follower display
  var lnf=document.getElementById('ldNoFollowers');
  if(lnf)lnf.style.display=state.p1Collection.length?'none':'block';
  renderFollowerCards('ldCollectionDisplay',state.p1Collection);
  updateStakeUI();
}

export function updateStakeUI(){
  var stakeEl=document.getElementById('p1Stake');
  if(!stakeEl)return;
  // Filter out fighters from wager list
  var wagerList=state.p1Collection.filter(function(f,i){return state.p1ArenaFighters.indexOf(i)<0});
  renderFollowerCards('p1Stake',wagerList,function(f){
    var realIdx=state.p1Collection.indexOf(f);
    if(state.p1StakedFollower===realIdx){state.p1StakedFollower=null}
    else{state.p1StakedFollower=realIdx}
    updateStakeUI();
  });
  stakeEl.querySelectorAll('.follower-card').forEach(function(card,i){
    var realIdx=state.p1Collection.indexOf(wagerList[i]);
    if(realIdx===state.p1StakedFollower)card.classList.add('selected');
  });
  var warn=document.getElementById('wagerWarning');
  if(warn)warn.style.display=state.p1StakedFollower===null?'block':'none';
}

export function buildDefeatSheet(data){
  var html='<div class="defeat-sheet" style="border:1px solid #ff444466;padding:8px;margin:6px 0;background:rgba(60,30,30,0.5)">';
  html+='<div style="font-size:.55rem;color:#ff6666;margin-bottom:4px">DEFEATED BY</div>';
  html+='<div style="font-size:.6rem">'+data.icon+' <b>'+data.name+'</b></div>';
  html+='<div style="font-size:.45rem;color:var(--parch-dk);margin:4px 0">';
  if(data.stats){
    html+='HP: '+Math.round(data.stats.hp)+' | DMG: '+Math.round(data.stats.baseDmg||data.stats.dmg||0)+' | DEF: '+Math.round(data.stats.def||0);
    if(data.stats.baseAS)html+=' | AS: '+data.stats.baseAS.toFixed(2);
    if(data.stats.evasion)html+=' | EVA: '+Math.round(data.stats.evasion*100)+'%';
  }
  html+='</div>';
  if(data.skills&&data.skills.length){
    html+='<div style="font-size:.42rem;color:#88aacc;margin-top:2px">Skills: ';
    data.skills.forEach(function(s){html+=s+' '});
    html+='</div>';
  }
  if(data.type)html+='<div style="font-size:.42rem;color:var(--parch-dk);margin-top:2px">['+data.type+']</div>';
  html+='</div>';
  return html;
}
