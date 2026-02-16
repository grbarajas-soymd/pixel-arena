// =============== BIOME SYSTEM ===============

export const BIOMES = [
  { id: 'ashen_fields', name: 'Ashen Fields',
    skyTop: '#060504', skyMid: '#0a0806', skyBot: '#0e0c08',
    groundBase: ['#1a1610', '#14120c', '#1a1812', '#161410', '#1c1a14'],
    groundEdge: '#2a2418', grassCol: ['#2a3a1a', '#1e2e14'], hasGrass: true,
    stoneCol: '#22201a', stoneLt: '#1c1a14',
    decor: null, ambient: 'ash', fogCol: 'rgba(80,60,30,0.02)' },
  { id: 'infernal_pit', name: 'Infernal Pit',
    skyTop: '#100400', skyMid: '#140600', skyBot: '#1a0800',
    groundBase: ['#1a0c08', '#140a06', '#1c0e08', '#120806', '#1e100a'],
    groundEdge: '#2a1208', grassCol: null, hasGrass: false,
    stoneCol: '#2a1a0c', stoneLt: '#341c0a',
    decor: 'lava', ambient: 'ember', fogCol: 'rgba(160,50,0,0.02)' },
  { id: 'frozen_crypts', name: 'Frozen Crypts',
    skyTop: '#04060a', skyMid: '#080a14', skyBot: '#0c1018',
    groundBase: ['#161820', '#121418', '#181a24', '#14161c', '#1a1c22'],
    groundEdge: '#242830', grassCol: ['#1e2a34', '#162028'], hasGrass: true,
    stoneCol: '#222830', stoneLt: '#2e3440',
    decor: 'ice', ambient: 'snowflake', fogCol: 'rgba(60,80,120,0.02)' },
  { id: 'abyssal_rift', name: 'Abyssal Rift',
    skyTop: '#060010', skyMid: '#08001a', skyBot: '#0a0020',
    groundBase: ['#0c0014', '#0a0010', '#0e0018', '#08000c', '#10001c'],
    groundEdge: '#140024', grassCol: null, hasGrass: false,
    stoneCol: '#160a22', stoneLt: '#1e1030',
    decor: 'void', ambient: 'wisp', fogCol: 'rgba(60,20,100,0.03)' },
  { id: 'rotwood', name: 'Rotwood',
    skyTop: '#040604', skyMid: '#060a06', skyBot: '#081208',
    groundBase: ['#0e160c', '#0c120a', '#10180e', '#0a1008', '#121a10'],
    groundEdge: '#162214', grassCol: ['#162a14', '#1e3418', '#163016'], hasGrass: true,
    stoneCol: '#162214', stoneLt: '#1e2a1c',
    decor: 'roots', ambient: 'firefly', fogCol: 'rgba(30,60,20,0.02)' },
  { id: 'bone_wastes', name: 'Bone Wastes',
    skyTop: '#0a0400', skyMid: '#100600', skyBot: '#180a00',
    groundBase: ['#180a06', '#140806', '#1a0c08', '#120604', '#1c0e0a'],
    groundEdge: '#240e08', grassCol: null, hasGrass: false,
    stoneCol: '#240e08', stoneLt: '#2e140c',
    decor: 'bone', ambient: 'ash', fogCol: 'rgba(100,20,0,0.02)' },
];

let currentBiome = 0;
let _onBiomeChange = null;

export function onBiomeChange(cb) { _onBiomeChange = cb; }
export function nextBiome() { currentBiome = (currentBiome + 1) % BIOMES.length; if (_onBiomeChange) _onBiomeChange(); }
export function randomBiome() { currentBiome = Math.floor(Math.random() * BIOMES.length); if (_onBiomeChange) _onBiomeChange(); }
export function getBiome() { return BIOMES[currentBiome]; }
