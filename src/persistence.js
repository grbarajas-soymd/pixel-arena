// =============== PERSISTENCE (localStorage) ===============
import { state, FIXED_BASE_STATS } from './gameState.js';
import { FOLLOWER_TEMPLATES } from './data/followers.js';
import { STARTER_GEAR } from './data/items.js';

var SAVE_KEY='pixel-arena-save';

export function saveGame(){
  try{
    var data={
      version:2,
      savedAt:new Date().toISOString(),
      p1Collection:state.p1Collection,
      ladderBest:state.ladderBest,
      gearBag:state.gearBag,
      preferences:{
        spd:state.spd,
      },
      customChar:{
        name:state.customChar.name,
        equipment:state.customChar.equipment,
        skills:state.customChar.skills,
        ultimate:state.customChar.ultimate,
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
    if(!data)return false;

    // Migrate v1 → v2
    if(data.version===1){
      data.version=2;
      if(data.p2Collection&&data.p2Collection.length){
        data.p1Collection=(data.p1Collection||[]).concat(data.p2Collection);
      }
      delete data.p2Collection;
      delete data.p1Stash;
      delete data.p2Stash;
      delete data.ladderBestP2;
      data.ladderBest=data.ladderBestP1||0;
      delete data.ladderBestP1;
      if(!data.gearBag)data.gearBag=[];
      if(data.customChar)delete data.customChar.baseStats;
    }

    if(data.version!==2)return false;

    if(data.p1Collection)state.p1Collection=data.p1Collection;
    if(data.ladderBest!==undefined)state.ladderBest=data.ladderBest;
    if(data.gearBag)state.gearBag=data.gearBag;

    if(data.preferences){
      var p=data.preferences;
      if(p.spd)state.spd=p.spd;
    }

    // Always use fixed base stats
    state.customChar.baseStats=Object.assign({},FIXED_BASE_STATS);

    if(data.customChar){
      var cc=data.customChar;
      if(cc.name)state.customChar.name=cc.name;
      if(cc.equipment)state.customChar.equipment=cc.equipment;
      if(cc.skills)state.customChar.skills=cc.skills;
      if(cc.ultimate!==undefined)state.customChar.ultimate=cc.ultimate;
      if(cc.sprite)state.customChar.sprite=cc.sprite;
    }

    // Ensure starter gear if no equipment at all
    var hasAny=false;
    for(var k in state.customChar.equipment){if(state.customChar.equipment[k])hasAny=true}
    if(!hasAny){
      state.customChar.equipment=Object.assign({},STARTER_GEAR);
    }

    state.p1Class='custom';

    // Rehydrate follower ability functions from templates
    rehydrateFollowers(state.p1Collection);

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
