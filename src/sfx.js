// =============== WEB AUDIO SOUND ENGINE ===============
let actx = null, masterGain = null, enabled = true, vol = 0.35;

function init() {
  if (actx) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = actx.createGain();
    masterGain.gain.value = vol;
    masterGain.connect(actx.destination);
  } catch (e) { enabled = false; }
}

function resume() { if (actx && actx.state === 'suspended') actx.resume(); }
function setVol(v) { vol = v; if (masterGain) masterGain.gain.value = v; }

function tone(freq, dur, type, vol2, detune) {
  if (!enabled || !actx) return; resume();
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'square'; o.frequency.value = freq; if (detune) o.detune.value = detune;
  g.gain.setValueAtTime((vol2 || 0.3) * vol * 2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + dur);
}

function noise(dur, vol2) {
  if (!enabled || !actx) return; resume();
  const t = actx.currentTime, buf = actx.createBuffer(1, actx.sampleRate * dur, actx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
  const s = actx.createBufferSource(), g = actx.createGain(), f = actx.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = 3000;
  s.buffer = buf; g.gain.setValueAtTime((vol2 || 0.15) * vol * 2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(masterGain); s.start(t); s.stop(t + dur);
}

function sweep(f1, f2, dur, type, vol2) {
  if (!enabled || !actx) return; resume();
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'sawtooth'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime((vol2 || 0.2) * vol * 2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + dur);
}

// --- GAME SOUNDS ---
export const SFX = {
  init,
  resume,
  setVol,
  noise,
  enabled: () => enabled,
  getVol: () => vol,
  toggle: () => { enabled = !enabled; return enabled; },

  hit() { tone(180, 0.06, 'square', 0.25); noise(0.04, 0.2); },
  hitHard() { tone(120, 0.08, 'square', 0.3); noise(0.06, 0.25); tone(80, 0.1, 'triangle', 0.2); },
  miss() { sweep(800, 400, 0.12, 'sine', 0.08); },
  crit() { tone(600, 0.05, 'square', 0.3); tone(900, 0.08, 'square', 0.25); noise(0.06, 0.3); },
  arrow() { sweep(1200, 600, 0.08, 'sine', 0.12); noise(0.03, 0.08); },
  bolt() { sweep(600, 1200, 0.06, 'sawtooth', 0.12); tone(1000, 0.04, 'sine', 0.1); },
  dagger() { sweep(2000, 800, 0.05, 'square', 0.1); noise(0.03, 0.12); },
  lightning() {
    for (let i = 0; i < 3; i++) { setTimeout((j) => { tone(200 + j * 150, 0.06, 'sawtooth', 0.2); noise(0.04, 0.15); }, i * 30, i); }
    sweep(400, 2000, 0.15, 'sawtooth', 0.15);
  },
  thunder() { sweep(100, 30, 0.4, 'sawtooth', 0.25); noise(0.3, 0.2); tone(50, 0.5, 'triangle', 0.15); },
  fire() { noise(0.15, 0.2); sweep(300, 100, 0.15, 'sawtooth', 0.1); },
  ice() { sweep(2000, 4000, 0.1, 'sine', 0.1); tone(3000, 0.06, 'sine', 0.08); },
  poison() { sweep(200, 400, 0.15, 'sine', 0.08); tone(300, 0.1, 'triangle', 0.06); },
  heal() { tone(523, 0.08, 'sine', 0.15); setTimeout(() => tone(659, 0.08, 'sine', 0.15), 60); setTimeout(() => tone(784, 0.12, 'sine', 0.2), 120); },
  shield() { tone(400, 0.1, 'triangle', 0.12); tone(600, 0.15, 'sine', 0.1); },
  shieldBreak() { noise(0.12, 0.3); sweep(600, 100, 0.15, 'square', 0.2); },
  stun() { tone(800, 0.04, 'square', 0.2); tone(600, 0.04, 'square', 0.15); tone(1000, 0.06, 'square', 0.15); },
  stealth() { sweep(3000, 500, 0.2, 'sine', 0.06); tone(200, 0.15, 'triangle', 0.04); },
  charge() { sweep(100, 400, 0.2, 'sawtooth', 0.2); noise(0.1, 0.15); },
  warCry() { sweep(200, 600, 0.3, 'sawtooth', 0.15); tone(300, 0.2, 'square', 0.1); },
  ult() {
    for (let i = 0; i < 5; i++) { setTimeout((j) => { tone(300 + j * 100, 0.1, 'sawtooth', 0.15 + j * 0.02); }, i * 40, i); }
    setTimeout(() => { sweep(200, 800, 0.3, 'square', 0.2); noise(0.2, 0.15); }, 100);
  },
  death() { sweep(400, 50, 0.5, 'sawtooth', 0.2); noise(0.3, 0.15); tone(60, 0.6, 'triangle', 0.15); },
  win() {
    [523, 659, 784, 1047].forEach((n, i) => { setTimeout(() => { tone(n, 0.15, 'sine', 0.2); tone(n * 0.5, 0.15, 'triangle', 0.1); }, i * 100); });
  },
  summon() { sweep(200, 800, 0.2, 'triangle', 0.12); tone(600, 0.15, 'sine', 0.1); tone(400, 0.2, 'triangle', 0.08); },
  bleed() { tone(150, 0.05, 'square', 0.1); noise(0.03, 0.08); },
  combo() { tone(800 + Math.random() * 400, 0.04, 'square', 0.1); },
  dodge() { sweep(1500, 3000, 0.08, 'sine', 0.06); },
  followerAtk() { tone(400, 0.04, 'square', 0.12); noise(0.02, 0.08); },
  followerAbility() { sweep(400, 800, 0.1, 'triangle', 0.12); tone(600, 0.06, 'sine', 0.1); },
  followerDeath() { sweep(300, 80, 0.2, 'square', 0.12); noise(0.1, 0.1); },
  lootCommon() { tone(880, 0.12, 'sine', 0.15); },
  lootUncommon() { tone(660, 0.1, 'sine', 0.15); setTimeout(() => tone(880, 0.12, 'sine', 0.18), 80); },
  lootRare() {
    tone(523, 0.1, 'sine', 0.18); setTimeout(() => tone(659, 0.1, 'sine', 0.18), 80);
    setTimeout(() => tone(784, 0.15, 'sine', 0.22), 160); setTimeout(() => sweep(2000, 6000, 0.3, 'sine', 0.04), 200);
  },
  lootEpic() {
    tone(80, 0.4, 'triangle', 0.1);
    [523, 659, 784, 1047].forEach((n, i) => { setTimeout(() => { tone(n, 0.12, 'sine', 0.2); tone(n * 1.5, 0.08, 'sine', 0.06); }, i * 90); });
    setTimeout(() => sweep(3000, 8000, 0.25, 'sine', 0.03), 350);
  },
  lootLegendary() {
    sweep(40, 80, 0.6, 'triangle', 0.12); tone(60, 0.5, 'sine', 0.08);
    setTimeout(() => { [523, 659, 784, 1047, 1319, 1568].forEach((n, i) => {
      setTimeout(() => { tone(n, 0.15, 'sine', 0.22); tone(n * 0.5, 0.15, 'triangle', 0.08); }, i * 80);
    }); }, 300);
    setTimeout(() => { sweep(4000, 10000, 0.4, 'sine', 0.03); noise(0.15, 0.04); }, 800);
    setTimeout(() => tone(1568, 0.3, 'sine', 0.15), 1000);
  },
  lootMythic() {
    sweep(30, 60, 0.8, 'triangle', 0.15); tone(40, 0.6, 'sine', 0.1);
    setTimeout(() => { [392, 523, 659, 784, 1047, 1319, 1568].forEach((n, i) => {
      setTimeout(() => { tone(n, 0.18, 'sine', 0.25); tone(n * 0.5, 0.18, 'triangle', 0.1); }, i * 70);
    }); }, 250);
    setTimeout(() => { sweep(5000, 12000, 0.5, 'sine', 0.04); noise(0.2, 0.05); }, 750);
    setTimeout(() => { tone(1568, 0.4, 'sine', 0.2); tone(2093, 0.3, 'sine', 0.12); }, 1000);
  },
  lootDrop(rarity) {
    if(rarity==='mythic') this.lootMythic();
    else if(rarity==='legendary') this.lootLegendary();
    else if(rarity==='epic') this.lootEpic();
    else if(rarity==='rare') this.lootRare();
    else if(rarity==='uncommon') this.lootUncommon();
    else this.lootCommon();
  },
  victoryBoss() {
    tone(60, 0.6, 'triangle', 0.12); sweep(80, 200, 0.4, 'sawtooth', 0.08);
    [392, 523, 659, 784].forEach((n, i) => { setTimeout(() => { tone(n, 0.2, 'sine', 0.2); tone(n * 0.5, 0.2, 'triangle', 0.1); }, 300 + i * 120); });
    setTimeout(() => { tone(1047, 0.4, 'sine', 0.25); tone(523, 0.4, 'triangle', 0.12); sweep(2000, 6000, 0.3, 'sine', 0.03); }, 800);
  },
  uiClick() { tone(1000, 0.03, 'square', 0.08); },
  battleStart() {
    sweep(100, 600, 0.3, 'sawtooth', 0.15);
    setTimeout(() => { tone(400, 0.1, 'square', 0.15); tone(600, 0.1, 'triangle', 0.1); }, 200);
    setTimeout(() => { noise(0.08, 0.12); }, 300);
  },
};

// Init audio on first user interaction
document.addEventListener('click', () => SFX.init(), { once: true });
document.addEventListener('touchstart', () => SFX.init(), { once: true });
