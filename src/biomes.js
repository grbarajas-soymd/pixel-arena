// =============== BIOME SYSTEM ===============

export const BIOMES = [
  { id: 'dark_plains', name: 'Dark Plains',
    skyTop: '#050508', skyMid: '#080a10', skyBot: '#0c1018',
    groundBase: ['#1a1a1a', '#141414', '#1a2a1a', '#142014', '#1e1e1e'],
    groundEdge: '#222222', grassCol: ['#2a4a2a', '#1a3a1a'], hasGrass: true,
    stoneCol: '#252525', stoneLt: '#1e1e1e',
    decor: null, ambient: null, fogCol: null },
  { id: 'lava_cavern', name: 'Lava Cavern',
    skyTop: '#150500', skyMid: '#1a0800', skyBot: '#200a00',
    groundBase: ['#1a0a0a', '#140808', '#1e0a08', '#120606', '#1c0c0c'],
    groundEdge: '#331100', grassCol: null, hasGrass: false,
    stoneCol: '#2a1a0a', stoneLt: '#3a1a08',
    decor: 'lava', ambient: 'ember', fogCol: 'rgba(200,60,0,0.02)' },
  { id: 'frost_peaks', name: 'Frost Peaks',
    skyTop: '#060810', skyMid: '#0a1020', skyBot: '#101828',
    groundBase: ['#1a1a22', '#14141c', '#1a1a28', '#181820', '#1e1e26'],
    groundEdge: '#2a2a3a', grassCol: ['#2a3a4a', '#1a2a3a'], hasGrass: true,
    stoneCol: '#2a2a3a', stoneLt: '#383848',
    decor: 'ice', ambient: 'snowflake', fogCol: 'rgba(100,140,200,0.02)' },
  { id: 'shadow_void', name: 'Shadow Void',
    skyTop: '#08001a', skyMid: '#0a0020', skyBot: '#0e0028',
    groundBase: ['#0e0018', '#0c0014', '#10001c', '#0a0010', '#120020'],
    groundEdge: '#1a0030', grassCol: null, hasGrass: false,
    stoneCol: '#1a0a2a', stoneLt: '#24103a',
    decor: 'void', ambient: 'wisp', fogCol: 'rgba(100,40,180,0.03)' },
  { id: 'ancient_forest', name: 'Ancient Forest',
    skyTop: '#040804', skyMid: '#061008', skyBot: '#08180c',
    groundBase: ['#0e1a0e', '#0c160c', '#101e10', '#0a140a', '#121e12'],
    groundEdge: '#1a2a1a', grassCol: ['#1a3a1a', '#2a4a2a', '#1a4020'], hasGrass: true,
    stoneCol: '#1a2a1a', stoneLt: '#243424',
    decor: 'roots', ambient: 'firefly', fogCol: 'rgba(40,120,40,0.02)' },
  { id: 'blood_wastes', name: 'Blood Wastes',
    skyTop: '#100000', skyMid: '#180400', skyBot: '#200800',
    groundBase: ['#1a0808', '#140606', '#1c0a0a', '#120404', '#1e0c0c'],
    groundEdge: '#2a0a0a', grassCol: null, hasGrass: false,
    stoneCol: '#2a0a0a', stoneLt: '#3a1010',
    decor: 'bone', ambient: 'ash', fogCol: 'rgba(160,20,0,0.02)' },
];

let currentBiome = 0;
let _onBiomeChange = null;

export function onBiomeChange(cb) { _onBiomeChange = cb; }
export function nextBiome() { currentBiome = (currentBiome + 1) % BIOMES.length; if (_onBiomeChange) _onBiomeChange(); }
export function randomBiome() { currentBiome = Math.floor(Math.random() * BIOMES.length); if (_onBiomeChange) _onBiomeChange(); }
export function getBiome() { return BIOMES[currentBiome]; }
