// =============== FOLLOWER TEMPLATES ===============
import { state } from '../gameState.js';
import { AX, AW } from '../constants.js';
import { addBl, addLog } from '../combat/engine.js';
import { spFire, spFloat, spSparks, spPoison, spDrips, spShadow, spLightning, spLStrike } from '../render/particles.js';

export const FOLLOWER_TEMPLATES = [
  // === COMMON ===
  {name:'Fire Imp',icon:'\u{1F525}',rarity:'common',buff:{baseDmg:8},buffDesc:'+8 Dmg',
    combatHp:420,combatDmg:30,combatAS:1.1,combatDef:6,combatRange:60,
    abilityName:'Scorch',abilityDesc:'Burns target, -6 DEF for 3s',abilityBcd:5000,
    abilityFn:function(af,tgt,t){tgt._debuffs=tgt._debuffs||[];tgt._debuffs.push({type:'def',val:-6,end:t+3000,src:'Scorch'});spFire(tgt.x,tgt.y-20,4);spFloat(tgt.x,tgt.y-45,'-DEF','#ff6622');addLog(t,af.name+' Scorches!','spell')},
    wagerDebuff:{name:'Scorched',desc:'-12 DEF',apply:function(e){e.def=Math.max(0,e.def-12)}}},
  {name:'Stone Golem',icon:'\u{1FAA8}',rarity:'common',buff:{def:6,hp:120},buffDesc:'+6 DEF +120 HP',
    combatHp:700,combatDmg:20,combatAS:0.65,combatDef:25,combatRange:50,
    abilityName:'Fortify',abilityDesc:'Taunts, gains +12 DEF for 4s',abilityBcd:7000,
    abilityFn:function(af,tgt,t){af._buffs=af._buffs||[];af._buffs.push({type:'def',val:12,end:t+4000});spFloat(af.x,af.y-40,'+DEF','#aaaaaa');addLog(t,af.name+' Fortifies!','spell')},
    wagerDebuff:{name:'Crushed',desc:'-15% AtkSpd',apply:function(e){e.baseAS*=0.85}}},
  {name:'Shadow Rat',icon:'\u{1F400}',rarity:'common',buff:{evasion:0.02,moveSpeed:10},buffDesc:'+2% Eva +10 Spd',
    combatHp:280,combatDmg:26,combatAS:1.6,combatDef:3,combatRange:55,
    abilityName:'Gnaw',abilityDesc:'Bleeds target for 2s',abilityBcd:4000,
    abilityFn:function(af,tgt,t){if(tgt.bleedStacks)addBl(tgt,t);spDrips(tgt.x,tgt.y-10);spFloat(tgt.x,tgt.y-40,'BLEED','#cc3300');addLog(t,af.name+' Gnaws!','dmg')},
    wagerDebuff:{name:'Gnawed',desc:'-10 Spd',apply:function(e){e.moveSpeed=Math.max(30,e.moveSpeed-10)}}},
  {name:'Ember Sprite',icon:'\u2728',rarity:'common',buff:{baseAS:0.05},buffDesc:'+0.05 AtkSpd',
    combatHp:350,combatDmg:22,combatAS:1.3,combatDef:5,combatRange:120,
    abilityName:'Spark',abilityDesc:'Zaps for 40 true dmg',abilityBcd:3500,
    abilityFn:function(af,tgt,t){tgt.hp-=40;af.totDmg+=40;tgt.hurtAnim=1;spSparks(tgt.x,tgt.y-20,4,'#ffdd44');spFloat(tgt.x,tgt.y-45,'-40','#ffdd44');addLog(t,af.name+' Sparks!','shock')},
    wagerDebuff:{name:'Static',desc:'Shocked: +10% dmg taken',apply:function(e){e.shocked=true;e.shockedEnd=Infinity}}},
  {name:'Mud Crawler',icon:'\u{1F41B}',rarity:'common',buff:{hp:200},buffDesc:'+200 HP',
    combatHp:650,combatDmg:18,combatAS:0.75,combatDef:14,combatRange:50,
    abilityName:'Burrow',abilityDesc:'Heals self 60 HP',abilityBcd:6000,
    abilityFn:function(af,tgt,t){af.hp=Math.min(af.maxHp,af.hp+60);spFloat(af.x,af.y-40,'+60','#44aa66');addLog(t,af.name+' Burrows!','spell')},
    wagerDebuff:{name:'Muddy',desc:'-20% MoveSpd',apply:function(e){e.moveSpeed=Math.round(e.moveSpeed*0.8)}}},

  // === UNCOMMON ===
  {name:'Frost Wolf',icon:'\u{1F43A}',rarity:'uncommon',buff:{baseDmg:15,moveSpeed:12},buffDesc:'+15 Dmg +12 Spd',
    combatHp:650,combatDmg:40,combatAS:1.15,combatDef:12,combatRange:55,
    abilityName:'Frostbite',abilityDesc:'Slows target 25% for 3s',abilityBcd:5500,
    abilityFn:function(af,tgt,t){tgt.slow=0.25;tgt.slowEnd=t+3000;spPoison(tgt.x,tgt.y-20,4);spFloat(tgt.x,tgt.y-45,'SLOW','#66ccff');addLog(t,af.name+' Frostbite!','shock')},
    wagerDebuff:{name:'Frozen',desc:'Start 15% slowed 8s',apply:function(e){e.slow=0.15;e.slowEnd=8000}}},
  {name:'Thunder Hawk',icon:'\u{1F985}',rarity:'uncommon',buff:{baseAS:0.08,evasion:0.03},buffDesc:'+0.08 AS +3% Eva',
    combatHp:420,combatDmg:36,combatAS:1.4,combatDef:6,combatRange:180,
    abilityName:'Dive Bomb',abilityDesc:'90 dmg + stun 0.5s',abilityBcd:6000,
    abilityFn:function(af,tgt,t){var dm=90;tgt.hp-=dm;af.totDmg+=dm;tgt.hurtAnim=1;if(tgt.stunEnd!==undefined)tgt.stunEnd=t+500;spSparks(tgt.x,tgt.y-25,6,'#ffdd44');spFloat(tgt.x,tgt.y-50,'-90 STUN','#ffdd44');addLog(t,af.name+' Dive Bombs!','shock')},
    wagerDebuff:{name:'Harried',desc:'-5% Evasion',apply:function(e){e.evasion=Math.max(0,e.evasion-0.05)}}},
  {name:'Iron Beetle',icon:'\u{1FAB2}',rarity:'uncommon',buff:{def:12,hp:250},buffDesc:'+12 DEF +250 HP',
    combatHp:900,combatDmg:26,combatAS:0.65,combatDef:30,combatRange:50,
    abilityName:'Shell Bash',abilityDesc:'60 dmg + knocks back',abilityBcd:5000,
    abilityFn:function(af,tgt,t){var dm=60;tgt.hp-=dm;af.totDmg+=dm;tgt.hurtAnim=1;var pushDir=tgt.x>af.x?1:-1;tgt.x=Math.max(AX+25,Math.min(AX+AW-25,tgt.x+pushDir*40));spSparks(tgt.x,tgt.y-20,4,'#aaaa66');spFloat(tgt.x,tgt.y-45,'BASH','#aaaa66');addLog(t,af.name+' Shell Bash!','dmg')},
    wagerDebuff:{name:'Cracked',desc:'-10 DEF',apply:function(e){e.def=Math.max(0,e.def-10)}}},
  {name:'Venom Spider',icon:'\u{1F577}\uFE0F',rarity:'uncommon',buff:{baseDmg:12,baseAS:0.06},buffDesc:'+12 Dmg +0.06 AS',
    combatHp:500,combatDmg:38,combatAS:1.2,combatDef:10,combatRange:65,
    abilityName:'Poison Fangs',abilityDesc:'Poisons: 3 bleeds over 3s',abilityBcd:5000,
    abilityFn:function(af,tgt,t){if(tgt.bleedStacks){addBl(tgt,t);addBl(tgt,t);addBl(tgt,t)}spPoison(tgt.x,tgt.y-20,6);spFloat(tgt.x,tgt.y-45,'POISON','#66aa22');addLog(t,af.name+' Poisons!','poison')},
    wagerDebuff:{name:'Envenomed',desc:'Start with 3 bleeds',apply:function(e){if(e.bleedStacks){for(var i=0;i<3;i++)e.bleedStacks.push({hpSnap:e.hp,at:0,exp:4000})}}}},
  {name:'Bone Wraith',icon:'\u{1F47B}',rarity:'uncommon',buff:{hp:180,evasion:0.03},buffDesc:'+180 HP +3% Eva',
    combatHp:560,combatDmg:34,combatAS:1.0,combatDef:12,combatRange:70,
    abilityName:'Life Drain',abilityDesc:'50 dmg, heals owner hero 50',abilityBcd:5500,
    abilityFn:function(af,tgt,t){var dm=50;tgt.hp-=dm;af.totDmg+=dm;tgt.hurtAnim=1;var owner=af.ownerSide==='left'?state.h1:state.h2;owner.hp=Math.min(owner.maxHp,owner.hp+50);owner.totHeal+=50;spFloat(tgt.x,tgt.y-45,'-50','#aa77dd');spFloat(owner.x,owner.y-55,'+50','#44aa66');addLog(t,af.name+' drains life!','spell')},
    wagerDebuff:{name:'Haunted',desc:'-200 Max HP',apply:function(e){e.maxHp-=200;e.hp=Math.min(e.hp,e.maxHp)}}},

  // === RARE ===
  {name:'Flame Drake',icon:'\u{1F409}',rarity:'rare',buff:{baseDmg:25,hp:200},buffDesc:'+25 Dmg +200 HP',
    combatHp:850,combatDmg:56,combatAS:1.0,combatDef:22,combatRange:140,
    abilityName:'Fire Breath',abilityDesc:'120 AoE dmg to all enemies',abilityBcd:7000,
    abilityFn:function(af,tgt,t){var enemy=af.ownerSide==='left'?state.h2:state.h1;enemy.hp-=120;enemy.hurtAnim=1;af.totDmg+=120;spFire(enemy.x,enemy.y-25,10);spFloat(enemy.x,enemy.y-55,'-120','#ff6622');if(enemy.arenaFollowers)enemy.arenaFollowers.forEach(function(ef){if(ef.alive){ef.hp-=60;ef.hurtAnim=1;spFire(ef.x,ef.y-10,3)}});addLog(t,af.name+' breathes fire!','ult')},
    wagerDebuff:{name:'Burning',desc:'-20 DEF, -15% AtkSpd',apply:function(e){e.def=Math.max(0,e.def-20);e.baseAS*=0.85}}},
  {name:'Crystal Elemental',icon:'\u{1F48E}',rarity:'rare',buff:{def:16,hp:300,evasion:0.02},buffDesc:'+16 DEF +300 HP',
    combatHp:1100,combatDmg:30,combatAS:0.75,combatDef:42,combatRange:60,
    abilityName:'Crystal Shield',abilityDesc:'Grants owner 180 shield',abilityBcd:8000,
    abilityFn:function(af,tgt,t){var owner=af.ownerSide==='left'?state.h1:state.h2;owner.shieldActive=true;owner.shieldHp=(owner.shieldHp||0)+180;owner.shieldEnd=t+5000;spSparks(owner.x,owner.y-30,6,'#88ddff');spFloat(owner.x,owner.y-55,'+SHIELD','#88ddff');addLog(t,af.name+' shields owner!','spell')},
    wagerDebuff:{name:'Brittle',desc:'-25 DEF',apply:function(e){e.def=Math.max(0,e.def-25)}}},
  {name:'Shadow Panther',icon:'\u{1F406}',rarity:'rare',buff:{baseDmg:20,baseAS:0.1,moveSpeed:15},buffDesc:'+20 Dmg +0.1 AS',
    combatHp:640,combatDmg:52,combatAS:1.5,combatDef:12,combatRange:55,
    abilityName:'Ambush',abilityDesc:'150 crit dmg from stealth',abilityBcd:6000,
    abilityFn:function(af,tgt,t){var dm=150;tgt.hp-=dm;af.totDmg+=dm;tgt.hurtAnim=1;spShadow(af.x,af.y-15);spShadow(tgt.x,tgt.y-15);spFloat(tgt.x,tgt.y-50,'-150 CRIT','#ffffff');addLog(t,af.name+' Ambush!','stealth')},
    wagerDebuff:{name:'Hunted',desc:'-8% Evasion, -20 Spd',apply:function(e){e.evasion=Math.max(0,e.evasion-0.08);e.moveSpeed=Math.max(30,e.moveSpeed-20)}}},
  {name:'Storm Serpent',icon:'\u{1F40D}',rarity:'rare',buff:{baseDmg:22,baseAS:0.08,def:6},buffDesc:'+22 Dmg +0.08 AS',
    combatHp:780,combatDmg:48,combatAS:1.15,combatDef:18,combatRange:80,
    abilityName:'Chain Shock',abilityDesc:'80 dmg + shocks 3s',abilityBcd:5500,
    abilityFn:function(af,tgt,t){var dm=80;tgt.hp-=dm;af.totDmg+=dm;tgt.hurtAnim=1;tgt.shocked=true;tgt.shockedEnd=t+3000;spLightning(af.x,af.y-15,tgt.x,tgt.y-20);spFloat(tgt.x,tgt.y-50,'-80 SHOCK','#44ddbb');addLog(t,af.name+' Chain Shock!','shock')},
    wagerDebuff:{name:'Electrified',desc:'Shocked: +10% dmg taken, -10% AS',apply:function(e){e.shocked=true;e.shockedEnd=Infinity;e.baseAS*=0.9}}},

  // === EPIC ===
  {name:'Phoenix',icon:'\u{1F99A}',rarity:'epic',buff:{baseDmg:30,hp:350,baseAS:0.06},buffDesc:'+30 Dmg +350 HP',
    combatHp:1100,combatDmg:65,combatAS:1.1,combatDef:24,combatRange:150,
    abilityName:'Rebirth',abilityDesc:'Revives once at 50% HP on death',abilityBcd:999999,
    abilityFn:function(af,tgt,t){},
    onDeath:function(af,t){if(!af._reborn){af._reborn=true;af.alive=true;af.hp=Math.round(af.maxHp*0.5);spFire(af.x,af.y-15,12);spFloat(af.x,af.y-45,'REBIRTH!','#ffcc22');addLog(t,af.name+' is reborn!','ult');return true}return false},
    wagerDebuff:{name:'Ashes',desc:'-400 HP, -20 DMG',apply:function(e){e.maxHp-=400;e.hp=Math.min(e.hp,e.maxHp);e.baseDmg=Math.max(10,e.baseDmg-20)}}},
  {name:'Void Stalker',icon:'\u{1F987}',rarity:'epic',buff:{baseDmg:28,evasion:0.05,moveSpeed:18},buffDesc:'+28 Dmg +5% Eva',
    combatHp:780,combatDmg:60,combatAS:1.4,combatDef:14,combatRange:70,
    abilityName:'Void Rip',abilityDesc:'140 dmg + steals 10% AS for 4s',abilityBcd:6500,
    abilityFn:function(af,tgt,t){var dm=140;tgt.hp-=dm;af.totDmg+=dm;tgt.hurtAnim=1;tgt._debuffs=tgt._debuffs||[];tgt._debuffs.push({type:'as',val:-0.1,end:t+4000,src:'VoidRip'});af.baseAS+=0.12;spSparks(tgt.x,tgt.y-20,6,'#8866cc');spFloat(tgt.x,tgt.y-50,'-140 -AS','#8866cc');addLog(t,af.name+' Void Rip!','ult')},
    wagerDebuff:{name:'Voided',desc:'-10% Eva, -20% AS',apply:function(e){e.evasion=Math.max(0,e.evasion-0.1);e.baseAS*=0.8}}},
  {name:'Ancient Treant',icon:'\u{1F333}',rarity:'epic',buff:{hp:600,def:18},buffDesc:'+600 HP +18 DEF',
    combatHp:1700,combatDmg:35,combatAS:0.55,combatDef:55,combatRange:55,
    abilityName:'Nature Heal',abilityDesc:'Heals owner hero 200 HP',abilityBcd:8000,
    abilityFn:function(af,tgt,t){var owner=af.ownerSide==='left'?state.h1:state.h2;var heal=200;owner.hp=Math.min(owner.maxHp,owner.hp+heal);owner.totHeal+=heal;spFloat(owner.x,owner.y-55,'+200','#44aa66');spSparks(owner.x,owner.y-30,4,'#66cc44');addLog(t,af.name+' heals owner!','spell')},
    wagerDebuff:{name:'Rooted',desc:'-30% MoveSpd, -15 Spd',apply:function(e){e.moveSpeed=Math.round(e.moveSpeed*0.7)}}},

  // === LEGENDARY ===
  {name:'Chaos Dragon',icon:'\u{1F432}',rarity:'legendary',buff:{baseDmg:42,hp:500,baseAS:0.1,def:10},buffDesc:'+42 Dmg +500 HP +0.1 AS',
    combatHp:1400,combatDmg:82,combatAS:1.1,combatDef:36,combatRange:160,
    abilityName:'Chaos Blast',abilityDesc:'200 AoE + stun 1s + burn',abilityBcd:8000,
    abilityFn:function(af,tgt,t){var enemy=af.ownerSide==='left'?state.h2:state.h1;enemy.hp-=200;enemy.hurtAnim=1;af.totDmg+=200;if(enemy.stunEnd!==undefined)enemy.stunEnd=t+1000;if(enemy.bleedStacks){addBl(enemy,t);addBl(enemy,t)}spFire(enemy.x,enemy.y-25,15);spLStrike(enemy.x);spFloat(enemy.x,enemy.y-60,'-200 STUN','#ffcc22');if(enemy.arenaFollowers)enemy.arenaFollowers.forEach(function(ef){if(ef.alive){ef.hp-=90;ef.hurtAnim=1;spFire(ef.x,ef.y-10,4)}});addLog(t,af.name+' CHAOS BLAST!','ult')},
    wagerDebuff:{name:'Chaos Curse',desc:'-500 HP, -30 DEF, -20% AS',apply:function(e){e.maxHp-=500;e.hp=Math.min(e.hp,e.maxHp);e.def=Math.max(0,e.def-30);e.baseAS*=0.8}}},
  {name:'Death Knight',icon:'\u{1F480}',rarity:'legendary',buff:{baseDmg:38,hp:400,def:16,evasion:0.03,moveSpeed:12},buffDesc:'+38 Dmg +400 HP +16 DEF',
    combatHp:1300,combatDmg:72,combatAS:0.9,combatDef:42,combatRange:60,
    abilityName:'Soul Reap',abilityDesc:'160 dmg, heals self+owner 100',abilityBcd:6000,
    abilityFn:function(af,tgt,t){var dm=160;tgt.hp-=dm;af.totDmg+=dm;tgt.hurtAnim=1;af.hp=Math.min(af.maxHp,af.hp+100);var owner=af.ownerSide==='left'?state.h1:state.h2;owner.hp=Math.min(owner.maxHp,owner.hp+100);owner.totHeal+=100;spSparks(tgt.x,tgt.y-20,8,'#aa44aa');spFloat(tgt.x,tgt.y-50,'-160','#aa44aa');spFloat(af.x,af.y-40,'+100','#44aa66');spFloat(owner.x,owner.y-55,'+100','#44aa66');addLog(t,af.name+' Soul Reap!','ult')},
    wagerDebuff:{name:'Death Curse',desc:'-400 HP, -25 DMG, -15 DEF',apply:function(e){e.maxHp-=400;e.hp=Math.min(e.hp,e.maxHp);e.baseDmg=Math.max(10,e.baseDmg-25);e.def=Math.max(0,e.def-15)}}},
];

export const RARITY_COLORS={common:'#8a8a7a',uncommon:'#4a8a4a',rare:'#4a6a9a',epic:'#8a4a9a',legendary:'#c8a848'};

function _pickRarity(weights){
  var rarities=['common','uncommon','rare','epic','legendary'];
  var total=weights.reduce((a,b)=>a+b,0);var r=Math.random()*total,acc=0;
  for(var i=0;i<weights.length;i++){acc+=weights[i];if(r<=acc)return rarities[i]}
  return 'common';
}

function _floorWeights(floor){
  if(floor<=2) return [70,25,5,0,0];
  if(floor<=4) return [40,35,20,5,0];
  if(floor<=6) return [20,30,30,15,5];
  return [10,20,30,25,15];
}

export function rollFollower(floor){
  var pickedRarity=_pickRarity(_floorWeights(floor));
  var pool=FOLLOWER_TEMPLATES.filter(f=>f.rarity===pickedRarity);
  var tmpl=pool[Math.floor(Math.random()*pool.length)];
  return {id:Date.now()+'_'+Math.random().toString(36).slice(2,6),name:tmpl.name,icon:tmpl.icon,rarity:tmpl.rarity,buff:{...tmpl.buff},buffDesc:tmpl.buffDesc,
    combatHp:tmpl.combatHp,combatDmg:tmpl.combatDmg,combatAS:tmpl.combatAS,combatDef:tmpl.combatDef,combatRange:tmpl.combatRange||60,
    abilityName:tmpl.abilityName||'',abilityDesc:tmpl.abilityDesc||'',
    abilityFn:tmpl.abilityFn||null,onDeath:tmpl.onDeath||null,wagerDebuff:tmpl.wagerDebuff||null,
    wagerDebuffName:tmpl.wagerDebuff?tmpl.wagerDebuff.name:'',wagerDebuffDesc:tmpl.wagerDebuff?tmpl.wagerDebuff.desc:'',
    assignedP1:false,assignedP2:false,stakedP1:false,stakedP2:false};
}

export function rollCageFollower(floor){
  var pickedRarity=_pickRarity(_floorWeights(floor));
  if(pickedRarity==='legendary')pickedRarity='epic';
  var pool=FOLLOWER_TEMPLATES.filter(f=>f.rarity===pickedRarity);
  var tmpl=pool[Math.floor(Math.random()*pool.length)];
  return {id:Date.now()+'_'+Math.random().toString(36).slice(2,6),name:tmpl.name,icon:tmpl.icon,rarity:tmpl.rarity,buff:{...tmpl.buff},buffDesc:tmpl.buffDesc,
    combatHp:tmpl.combatHp,combatDmg:tmpl.combatDmg,combatAS:tmpl.combatAS,combatDef:tmpl.combatDef,combatRange:tmpl.combatRange||60,
    abilityName:tmpl.abilityName||'',abilityDesc:tmpl.abilityDesc||'',
    abilityFn:tmpl.abilityFn||null,onDeath:tmpl.onDeath||null,wagerDebuff:tmpl.wagerDebuff||null,
    wagerDebuffName:tmpl.wagerDebuff?tmpl.wagerDebuff.name:'',wagerDebuffDesc:tmpl.wagerDebuff?tmpl.wagerDebuff.desc:'',
    assignedP1:false,assignedP2:false,stakedP1:false,stakedP2:false};
}
