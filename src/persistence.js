// =============== PERSISTENCE (localStorage) ===============
import { state, FIXED_BASE_STATS } from './gameState.js';
import { FOLLOWER_TEMPLATES } from './data/followers.js';
import { STARTER_GEAR, STARTER_LOADOUTS } from './data/items.js';

var SAVE_KEY='pixel-arena-save';
var MAX_SLOTS=4;

// =============== LOW-LEVEL WRAPPER IO ===============

function readWrapper(){
  try{
    var raw=localStorage.getItem(SAVE_KEY);
    if(!raw)return null;
    var data=JSON.parse(raw);
    if(!data)return null;
    return migrateWrapper(data);
  }catch(e){return null}
}

function writeWrapper(wrapper){
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(wrapper))}catch(e){}
}

// =============== MIGRATIONS ===============

function migrateWrapper(data){
  // v1 -> v2
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

  // v2 -> v3
  if(data.version===2){
    var charName=(data.customChar&&data.customChar.name)||'Hero';
    var charSprite=(data.customChar&&data.customChar.sprite)||'wizard';
    var slot={
      id:'char_'+Date.now(),
      createdAt:data.savedAt||new Date().toISOString(),
      savedAt:data.savedAt||new Date().toISOString(),
      name:charName,
      sprite:charSprite,
      customChar:data.customChar||null,
      p1Collection:data.p1Collection||[],
      gearBag:data.gearBag||[],
      ladderBest:data.ladderBest||0,
      playerId:data.playerId||null,
      playerName:data.playerName||null,
    };
    data={
      version:3,
      activeSlot:0,
      preferences:data.preferences||{spd:2},
      slots:[slot],
    };
  }

  if(data.version!==3)return null;
  return data;
}

// =============== PUBLIC API ===============

/** Returns the v3 wrapper object, or null if no save */
export function getSaveData(){
  return readWrapper();
}

/** Save current active character state into its slot */
export function saveGame(){
  if(state._activeSlotIndex===null)return;
  var wrapper=readWrapper();
  if(!wrapper)return;
  var slot=wrapper.slots[state._activeSlotIndex];
  if(!slot)return;

  slot.savedAt=new Date().toISOString();
  slot.name=state.customChar.name;
  slot.sprite=state.customChar.sprite;
  slot.customChar={
    name:state.customChar.name,
    equipment:state.customChar.equipment,
    skills:state.customChar.skills,
    ultimate:state.customChar.ultimate,
    sprite:state.customChar.sprite,
  };
  slot.p1Collection=state.p1Collection;
  slot.gearBag=state.gearBag;
  slot.ladderBest=state.ladderBest;
  slot.playerId=state.playerId;
  slot.playerName=state.playerName;

  wrapper.preferences={spd:state.spd};
  wrapper.activeSlot=state._activeSlotIndex;

  writeWrapper(wrapper);
}

/** Load the save wrapper (runs migrations). Returns the wrapper or null.
 *  Does NOT populate state — use loadCharacterSlot() for that. */
export function loadSaveWrapper(){
  var wrapper=readWrapper();
  if(!wrapper||!wrapper.slots||!wrapper.slots.length)return null;
  // Apply shared preferences
  if(wrapper.preferences){
    if(wrapper.preferences.spd)state.spd=wrapper.preferences.spd;
  }
  return wrapper;
}

/** Populate state from a specific character slot */
export function loadCharacterSlot(slotIndex){
  var wrapper=readWrapper();
  if(!wrapper||!wrapper.slots[slotIndex])return false;
  var slot=wrapper.slots[slotIndex];

  // Clear transient state
  state.dgRun=null;
  state.ladderRun=null;
  state.p1StakedFollower=null;
  state.p1ArenaFighters=[];
  state.onlineOpponents=[];
  state.selectedOpponent=null;

  // Load character data
  state.customChar.baseStats=Object.assign({},FIXED_BASE_STATS);

  if(slot.customChar){
    var cc=slot.customChar;
    if(cc.name)state.customChar.name=cc.name;
    if(cc.equipment)state.customChar.equipment=cc.equipment;
    if(cc.skills)state.customChar.skills=cc.skills;
    if(cc.ultimate!==undefined)state.customChar.ultimate=cc.ultimate;
    if(cc.sprite)state.customChar.sprite=cc.sprite;
  }

  // Ensure starter gear if no equipment
  var hasAny=false;
  for(var k in state.customChar.equipment){if(state.customChar.equipment[k])hasAny=true}
  if(!hasAny){
    state.customChar.equipment=Object.assign({},STARTER_GEAR);
  }

  state.p1Collection=slot.p1Collection||[];
  state.gearBag=slot.gearBag||[];
  state.ladderBest=slot.ladderBest||0;
  state.playerId=slot.playerId||null;
  state.playerName=slot.playerName||null;
  state.p1Class='custom';
  state._activeSlotIndex=slotIndex;

  // Rehydrate follower ability functions
  rehydrateFollowers(state.p1Collection);

  // Update wrapper activeSlot
  wrapper.activeSlot=slotIndex;
  writeWrapper(wrapper);

  return true;
}

/** Create a new character slot. Returns the new slot index, or -1 if full. */
export function createCharacterSlot(name,archetypeKey){
  var wrapper=readWrapper();
  if(!wrapper){
    wrapper={version:3,activeSlot:0,preferences:{spd:state.spd},slots:[]};
  }
  if(wrapper.slots.length>=MAX_SLOTS)return -1;

  var loadout=STARTER_LOADOUTS[archetypeKey];
  if(!loadout)return -1;

  var charName=name&&name.trim()?name.trim():loadout.name;
  var now=new Date().toISOString();
  var slot={
    id:'char_'+Date.now(),
    createdAt:now,
    savedAt:now,
    name:charName,
    sprite:loadout.sprite,
    customChar:{
      name:charName,
      equipment:Object.assign({},loadout.equipment),
      skills:[loadout.skills[0],loadout.skills[1]],
      ultimate:loadout.ultimate,
      sprite:loadout.sprite,
    },
    p1Collection:[],
    gearBag:[],
    ladderBest:0,
    playerId:null,
    playerName:null,
  };

  wrapper.slots.push(slot);
  var idx=wrapper.slots.length-1;
  wrapper.activeSlot=idx;
  writeWrapper(wrapper);
  return idx;
}

/** Delete a character slot. Returns remaining count. */
export function deleteCharacterSlot(slotIndex){
  var wrapper=readWrapper();
  if(!wrapper||!wrapper.slots[slotIndex])return 0;
  wrapper.slots.splice(slotIndex,1);
  // Adjust activeSlot
  if(wrapper.slots.length===0){
    wrapper.activeSlot=null;
  }else if(wrapper.activeSlot>=wrapper.slots.length){
    wrapper.activeSlot=wrapper.slots.length-1;
  }
  writeWrapper(wrapper);
  return wrapper.slots.length;
}

// =============== FOLLOWER REHYDRATION ===============

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

// =============== AUTO-SAVE ===============

export function setupAutoSave(){
  window.addEventListener('beforeunload',function(){if(!state._resetting)saveGame()});
}

// =============== SAVE TOAST ===============

var _toastEl=null;
var _toastTimer=null;

export function showSaveToast(){
  if(!_toastEl){
    _toastEl=document.createElement('div');
    _toastEl.className='save-toast';
    _toastEl.textContent='\u2714 Saved';
    document.body.appendChild(_toastEl);
  }
  clearTimeout(_toastTimer);
  _toastEl.classList.add('show');
  _toastTimer=setTimeout(function(){_toastEl.classList.remove('show')},2000);
}
