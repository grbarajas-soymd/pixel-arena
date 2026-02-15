// =============== PERSISTENCE (localStorage) ===============
import { state } from './gameState.js';
import { FOLLOWER_TEMPLATES } from './data/followers.js';

var SAVE_KEY='pixel-arena-save';

export function saveGame(){
  try{
    var data={
      version:1,
      savedAt:new Date().toISOString(),
      p1Collection:state.p1Collection,
      p2Collection:state.p2Collection,
      p1Stash:state.p1Stash,
      p2Stash:state.p2Stash,
      ladderBestP1:state.ladderBestP1,
      ladderBestP2:state.ladderBestP2,
      preferences:{
        spd:state.spd,
        p1Class:state.p1Class,
        p2Class:state.p2Class,
        dgClass:state.dgClass,
        ladderClass:state.ladderClass,
      },
      customChar:{
        name:state.customChar.name,
        equipment:state.customChar.equipment,
        skills:state.customChar.skills,
        ultimate:state.customChar.ultimate,
        baseStats:state.customChar.baseStats,
        rangeType:state.customChar.rangeType,
        sprite:state.customChar.sprite,
      },
    };
    localStorage.setItem(SAVE_KEY,JSON.stringify(data));
  }catch(e){}
}

export function loadGame(){
  try{
    var raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return false;
    var data=JSON.parse(raw);
    if(!data||data.version!==1)return false;

    if(data.p1Collection)state.p1Collection=data.p1Collection;
    if(data.p2Collection)state.p2Collection=data.p2Collection;
    if(data.p1Stash)state.p1Stash=data.p1Stash;
    if(data.p2Stash)state.p2Stash=data.p2Stash;
    if(data.ladderBestP1!==undefined)state.ladderBestP1=data.ladderBestP1;
    if(data.ladderBestP2!==undefined)state.ladderBestP2=data.ladderBestP2;

    if(data.preferences){
      var p=data.preferences;
      if(p.spd)state.spd=p.spd;
      if(p.p1Class)state.p1Class=p.p1Class;
      if(p.p2Class)state.p2Class=p.p2Class;
      if(p.dgClass)state.dgClass=p.dgClass;
      if(p.ladderClass)state.ladderClass=p.ladderClass;
    }

    if(data.customChar){
      var cc=data.customChar;
      if(cc.name)state.customChar.name=cc.name;
      if(cc.equipment)state.customChar.equipment=cc.equipment;
      if(cc.skills)state.customChar.skills=cc.skills;
      if(cc.ultimate!==undefined)state.customChar.ultimate=cc.ultimate;
      if(cc.baseStats)state.customChar.baseStats=cc.baseStats;
      if(cc.rangeType)state.customChar.rangeType=cc.rangeType;
      if(cc.sprite)state.customChar.sprite=cc.sprite;
    }

    // Rehydrate follower ability functions from templates
    rehydrateFollowers(state.p1Collection);
    rehydrateFollowers(state.p2Collection);

    return true;
  }catch(e){return false}
}

function rehydrateFollowers(collection){
  collection.forEach(function(f){
    var tmpl=FOLLOWER_TEMPLATES.find(function(t){return t.name===f.name});
    if(tmpl){
      f.abilityFn=tmpl.abilityFn;
      if(tmpl.wagerDebuff)f.wagerDebuff=tmpl.wagerDebuff;
      if(tmpl.onDeath)f.onDeath=tmpl.onDeath;
    }
  });
}

export function setupAutoSave(){
  window.addEventListener('beforeunload',function(){saveGame()});
}
