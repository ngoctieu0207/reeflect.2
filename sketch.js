let rock1Img;
let rock2Img;
let rock3Img;
let rock4Img;
let rock5Img;
let rock6Img;
let shieldDomeImg;

let trashBottleImg1, trashBottleImg2, trashBottleImg3;
let trashMilkBoxImg1, trashMilkBoxImg2, trashMilkBoxImg3;
let trashSunscreenImg1, trashSunscreenImg2, trashSunscreenImg3;

let goodReuseBagImg1, goodReuseBagImg2, goodReuseBagImg3;
let goodReefSunscreenImg1, goodReefSunscreenImg2, goodReefSunscreenImg3;

// ======================================================
// SOUND (one music loop + two ambient loops + four one-shot effects — sound
// defaults to on, but browsers still won't actually let audio play until the
// very first real click/tap on the page, which is why the loops only truly
// start inside playUiClick() rather than here in setup())
// ======================================================

let musicSound;
let underwaterSound;
let coralMovementSound;
let bubbleBreathSound;
let bubbleEatingSound;
let dieCoralSound;
let clickSound;
let soundOn = true; // the player's on/off preference — on by default, no opt-in needed
let ambientStarted = false; // whether the ambient loops have actually been started yet
let soundPanelOpen = false;

// three independently-adjustable categories, each a 0-1 multiplier on top of
// that sound's own base volume constant below — Music covers the background
// loop, SFX covers every other ambient/one-shot effect, UI covers the click
// sound (and whatever other UI sounds get added later)
let musicVolume = 0.5;
let sfxVolume = 0.5;
let uiVolume = 0.5;

const MUSIC_VOLUME = 0.35; // background loop — present but under the SFX
const UNDERWATER_VOLUME = 0.28; // background bed — present but not the loudest thing
const CORAL_MOVEMENT_VOLUME = 0.09; // coral "rustle"/sway — kept light
const CORAL_MOVEMENT_BASE_RATE = 0.75; // resting playback speed
const CORAL_MOVEMENT_RATE_VARIANCE = 0.15; // how far the pulse drifts from the base rate
const SEAWEED_SWAY_REFERENCE_SPEED = 1.35; // pulse cycle speed, matched to seaweed sway
const BUBBLE_BREATH_VOLUME = 0.11; // plays on every bubble, loud enough to actually hear
const BUBBLE_EATING_VOLUME = 0.75; // rarer event, should read clearly over the mix
const DIE_CORAL_VOLUME = 1; // p5.sound's volume cap — see DIE_CORAL_GAIN_BOOST for more
const DIE_CORAL_GAIN_BOOST = 2.1; // extra boost past the 1.0 cap, via a raw GainNode in setup()
const CLICK_VOLUME = 0.4;

// re-applies the Music slider — called once in setup() and again any time
// the Music slider moves
function applyMusicVolume() {
  musicSound.setVolume(MUSIC_VOLUME * musicVolume);
}

// re-applies the SFX slider to every sound in that category — called once in
// setup() and again any time the SFX slider moves
function applySfxVolumes() {
  underwaterSound.setVolume(UNDERWATER_VOLUME * sfxVolume);
  coralMovementSound.setVolume(CORAL_MOVEMENT_VOLUME * sfxVolume);
  bubbleBreathSound.setVolume(BUBBLE_BREATH_VOLUME * sfxVolume);
  bubbleEatingSound.setVolume(BUBBLE_EATING_VOLUME * sfxVolume);
  dieCoralSound.setVolume(DIE_CORAL_VOLUME * sfxVolume);
}

// same idea for the UI category (currently just the click sound)
function applyUiVolume() {
  clickSound.setVolume(CLICK_VOLUME * uiVolume);
}

// shared "UI click" feedback — unlocks the browser's audio context on
// whichever click happens to be the first one (the sound button, or a
// pre-game screen), starts the ambient SFX the first time, then plays the
// click sound itself. Used by every UI-level click, not just the sound
// button, so the whole game has a consistent click blip.
function playUiClick() {
  userStartAudio().then(() => {
    if (!ambientStarted && soundOn) {
      ambientStarted = true;
      musicSound.play();
      underwaterSound.play();
      coralMovementSound.play();
    }
    if (soundOn) clickSound.play();
  });
}

// click on the speaker button opens/closes the sound panel
function toggleSoundPanel() {
  playUiClick();
  soundPanelOpen = !soundPanelOpen;
  document.getElementById("sound-panel").hidden = !soundPanelOpen;
}

function closeSoundPanel() {
  if (!soundPanelOpen) return;
  soundPanelOpen = false;
  document.getElementById("sound-panel").hidden = true;
}

function updateSoundButton() {
  const btn = document.getElementById("sound-toggle");
  btn.setAttribute("aria-pressed", soundOn ? "true" : "false");
  document.getElementById("sound-toggle-icon").src = soundOn
    ? "assets/images/speaker-high.svg"
    : "assets/images/speaker-x.svg";
}

// tracks the pending pause() from the fade-out below, so a restart/return
// home that happens mid-fade can cancel it — otherwise it fires later and
// incorrectly pauses whatever audio that restart/return just started fresh
let silenceTimeoutId = null;

// Called once, the instant the reef fully dies (or the game is won) — fades
// every loop out to match "the reef has gone silent" instead of just
// cutting them off.
function silenceAmbientSounds() {
  if (!soundOn) return;

  const fadeTime = 1.5;
  musicSound.fade(0, fadeTime);
  underwaterSound.fade(0, fadeTime);
  coralMovementSound.fade(0, fadeTime);

  silenceTimeoutId = setTimeout(() => {
    musicSound.pause();
    underwaterSound.pause();
    coralMovementSound.pause();
    // restore their normal volume (at the current slider levels) for the
    // next time sound is turned back on
    applyMusicVolume();
    applySfxVolumes();
  }, fadeTime * 1000);

  soundOn = false;
  updateSoundButton();
}

// ======================================================
// FLOATING PARTICLES ("marine snow" dust drifting in the water)
// ======================================================

let particles = [];
const PARTICLE_COUNT = 140;

function initParticles() {
  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
      x: random(width),
      y: random(height),
      r: random(0.8, 2.6),           // dot radius
      angle: random(TWO_PI),         // current drift direction (any way, not just up)
      speed: random(3, 12),          // drift speed (px/sec)
      turnRate: random(-0.5, 0.5),   // slow random change of direction over time
      alpha: random(35, 130)
    });
  }
}

function drawParticles() {
  push();
  noStroke();

  let dt = deltaTime * 0.001;

  for (const p of particles) {
    // wander: direction slowly drifts instead of a fixed straight path
    p.angle += p.turnRate * dt;
    p.x += cos(p.angle) * p.speed * dt;
    p.y += sin(p.angle) * p.speed * dt;

    // wrap around on every edge (top/bottom/left/right)
    if (p.x < -10) p.x = width + 10;
    if (p.x > width + 10) p.x = -10;
    if (p.y < -10) p.y = height + 10;
    if (p.y > height + 10) p.y = -10;

    fill(225, 245, 250, p.alpha);
    ellipse(p.x, p.y, p.r * 2, p.r * 2);
  }

  pop();
}

// ======================================================
// SHARED HELPERS (extracted from repeated boilerplate — math/values unchanged)
// ======================================================

const PLANT_PALETTE = {
  green: ["#8FEC83", "#BFF4B8", "#E3FAE0", "#EBFBE9"],
  teal: ["#2EC2B4", "#5ED9CD", "#98E7DF", "#C9F2EE"],
  pink: ["#ED8495", "#F3AAB6", "#F8CED5", "#FCEDF0"],
};
const PLANT_HUES = Object.keys(PLANT_PALETTE);

// Every color the hand-drawn coral AND seaweed paths use, mapped to its
// (hue, shade row) in the palette above. Lets a whole shape be recolored to
// a different hue while keeping the exact same light/dark pattern between
// its paths (and the same light-top-left/dark-bottom-right direction).
const PLANT_COLOR_MAP = {
  "#8FEC83": ["green", 1], "#BFF4B8": ["green", 2], "#E3FAE0": ["green", 3], "#EBFBE9": ["green", 4],
  "#2EC2B4": ["teal", 1], "#30C3B5": ["teal", 1], "#44CCBF": ["teal", 1],
  "#53D3C7": ["teal", 2], "#5BD7CB": ["teal", 2], "#5ED9CD": ["teal", 2], "#79DFD5": ["teal", 2],
  "#98E7DF": ["teal", 3], "#9AE7DF": ["teal", 3], "#A2E9E2": ["teal", 3], "#A6EAE3": ["teal", 3], "#B0ECE6": ["teal", 3],
  "#C4F1EC": ["teal", 4], "#C9F2EE": ["teal", 4],
  "#ED8495": ["pink", 1], "#EE8B9B": ["pink", 1],
  "#F09CAA": ["pink", 2], "#F2A6B3": ["pink", 2], "#F3AAB6": ["pink", 2], "#F4AFBB": ["pink", 2], "#F4B1BC": ["pink", 2],
  "#F8CED5": ["pink", 3], "#F8D2D9": ["pink", 3],
  "#FCEDF0": ["pink", 4],
  // extra colors used by the floating-creature decorations (added below)
  "#D8F8D4": ["green", 3],
  "#065274": ["teal", 1], "#086E9B": ["teal", 1],
};

// Set to "green" | "teal" | "pink" right before drawing one coral/seaweed
// instance, then back to null right after — every recognized color used
// while it's set gets swapped to that hue's same shade row.
let plantHueOverride = null;

// Used when a coral gets hit by falling debris — desaturated "lost its
// color" look, same 4-row shading logic as the real palette.
const GRAY_SHADES = ["#4A4A4A", "#6E6E6E", "#9C9C9C", "#C9C9C9"];

function remapPlantColor(hex) {
  if (!plantHueOverride) return hex;
  const entry = PLANT_COLOR_MAP[hex];
  if (!entry) return hex;
  const [, row] = entry;
  if (plantHueOverride === "gray") return GRAY_SHADES[row - 1];
  return PLANT_PALETTE[plantHueOverride][row - 1];
}

// Solid (non-gradient) fill, still subject to the hue override above.
function plantFill(hex) {
  fill(remapPlantColor(hex));
}

function setGradientFill(x1, y1, x2, y2, stops) {
  let g = drawingContext.createLinearGradient(x1, y1, x2, y2);
  for (const [pos, color] of stops) {
    g.addColorStop(pos, remapPlantColor(color));
  }
  // re-arm p5's own "fill enabled" state (in case a previous shape called
  // noFill(), e.g. a stroke-only decoration path) before overriding the
  // actual paint with our gradient — otherwise the shape silently doesn't
  // get filled at all even though fillStyle is set correctly.
  fill(255);
  drawingContext.fillStyle = g;
}

// same REEFLECT-brand gradient used on the welcome/credits titles (CSS:
// linear-gradient(259.66deg, #2eb8f1 10.021%, #d8f4ea 80.111%)), approximated
// here as a left-to-right gradient since canvas text has no CSS angle concept
function setTitleGradientFill(leftX, rightX, y) {
  let g = drawingContext.createLinearGradient(leftX, y, rightX, y);
  g.addColorStop(0.10021, "#d8f4ea");
  g.addColorStop(0.80111, "#2eb8f1");
  fill(255);
  drawingContext.fillStyle = g;
}

// Factory for the "circular sway" offset used by coral4/8/9: a point drifts
// in a small circle whose radius fades out below `topLimit - topRange`.
function makeCircularWave(topLimit, topRange, powExp, timeSpeed, pxFreq, pyFreq, dxScale, dyScale) {
  return function (px, py, time, phase = 0) {
    let movement = constrain((topLimit - py) / topRange, 0, 1);
    movement = pow(movement, powExp);

    let wavePhase = time * timeSpeed + px * pxFreq + py * pyFreq + phase;

    return {
      x: cos(wavePhase) * dxScale * movement,
      y: sin(wavePhase) * dyScale * movement
    };
  };
}

// Factory for the "bend sway" offset used by coral5/10/11/12: strength grows
// toward the top and toward the sides, then two combined sine waves bend x/y.
function makeBendWave(topLimit, topRange, sideCenter, sideRange, topWeight, sideWeight, powExp, wave1Speed, wave1PyFreq, wave2Speed, wave2PxFreq, wave2PyFreq, wave2PhaseMul, dxWave1Scale, dxWave2Scale, dyCosSpeed, dyCosPxFreq, dyScale) {
  return function (px, py, time, phase = 0) {
    let topAmount = constrain((topLimit - py) / topRange, 0, 1);
    let sideAmount = constrain(abs(px - sideCenter) / sideRange, 0, 1);

    let amount = constrain(topAmount * topWeight + sideAmount * sideWeight, 0, 1);
    amount = pow(amount, powExp);

    let wave1 = sin(time * wave1Speed + py * wave1PyFreq + phase);
    let wave2 = sin(time * wave2Speed + px * wave2PxFreq + py * wave2PyFreq + phase * wave2PhaseMul);

    return {
      x: (wave1 * dxWave1Scale + wave2 * dxWave2Scale) * amount,
      y: cos(time * dyCosSpeed + px * dyCosPxFreq + phase) * dyScale * amount
    };
  };
}

// Shared vertex()/bezierVertex() wrappers that apply any of the wave
// functions above; used by the per-coral cNv/cNbz aliases.
function waveVertex(waveFn, x, y, time, phase = 0) {
  let w = waveFn(x, y, time, phase);
  vertex(x + w.x, y + w.y);
}

function waveBezierVertex(waveFn, x1, y1, x2, y2, x3, y3, time, phase = 0) {
  let w1 = waveFn(x1, y1, time, phase);
  let w2 = waveFn(x2, y2, time, phase);
  let w3 = waveFn(x3, y3, time, phase);
  bezierVertex(x1 + w1.x, y1 + w1.y, x2 + w2.x, y2 + w2.y, x3 + w3.x, y3 + w3.y);
}

function preload() {
  rock1Img = loadImage("assets/images/rock1.png");
  rock2Img = loadImage("assets/images/rock2.png");
  rock3Img = loadImage("assets/images/rock3.png");
  rock4Img = loadImage("assets/images/rock4.png");
  rock5Img = loadImage("assets/images/rock5.png");
  rock6Img = loadImage("assets/images/rock6.png");
  shieldDomeImg = loadImage("assets/images/shield-dome.svg");

  // SVG, not PNG — the PNG export from Figma baked in that frame's own
  // (dark) background fill, since these litter pieces are grouped inside
  // a container frame in the design file. The SVG has no background rect,
  // just the artwork paths, so it stays transparent like everything else.
  trashBottleImg1 = loadImage("assets/images/bottletrash1.svg");
  trashBottleImg2 = loadImage("assets/images/bottletrash2.svg");
  trashBottleImg3 = loadImage("assets/images/bottletrash3.svg");
  trashMilkBoxImg1 = loadImage("assets/images/milkboxtrash1.svg");
  trashMilkBoxImg2 = loadImage("assets/images/milkboxtrash2.svg");
  trashMilkBoxImg3 = loadImage("assets/images/milkboxtrash3.svg");
  trashSunscreenImg1 = loadImage("assets/images/sunscreen1.svg");
  trashSunscreenImg2 = loadImage("assets/images/sunscreen2.svg");
  trashSunscreenImg3 = loadImage("assets/images/sunscreen3.svg");

  goodReuseBagImg1 = loadImage("assets/images/reusebag1.svg");
  goodReuseBagImg2 = loadImage("assets/images/reusebag2.svg");
  goodReuseBagImg3 = loadImage("assets/images/reusebag3.svg");
  goodReefSunscreenImg1 = loadImage("assets/images/reefsunscreen1.svg");
  goodReefSunscreenImg2 = loadImage("assets/images/reefsunscreen2.svg");
  goodReefSunscreenImg3 = loadImage("assets/images/reefsunscreen3.svg");

  musicSound = loadSound("assets/sounds/background-music.wav");
  underwaterSound = loadSound("assets/sounds/underwater-sound.wav");
  coralMovementSound = loadSound("assets/sounds/coral-movement-sound.wav");
  bubbleBreathSound = loadSound("assets/sounds/underwater-bubble-sound.wav");
  bubbleEatingSound = loadSound("assets/sounds/bubble-eating-sound.wav");
  dieCoralSound = loadSound("assets/sounds/coral-die-sound.wav");
  clickSound = loadSound("assets/sounds/clicking-sound.wav");
}

// ======================================================
// TRASH ITEMS (bottle, milk box, bag, can — each in 3 color variants)
// ======================================================

function drawTrashBottle1(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(trashBottleImg1, 0, 0);
  pop();
}

function drawTrashBottle2(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(trashBottleImg2, 0, 0);
  pop();
}

function drawTrashBottle3(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(trashBottleImg3, 0, 0);
  pop();
}

function drawTrashMilkBox1(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(trashMilkBoxImg1, 0, 0);
  pop();
}

function drawTrashMilkBox2(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(trashMilkBoxImg2, 0, 0);
  pop();
}

function drawTrashMilkBox3(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(trashMilkBoxImg3, 0, 0);
  pop();
}

function drawTrashSunscreen1(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(trashSunscreenImg1, 0, 0);
  pop();
}

function drawTrashSunscreen2(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(trashSunscreenImg2, 0, 0);
  pop();
}

function drawTrashSunscreen3(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(trashSunscreenImg3, 0, 0);
  pop();
}

function drawGoodReuseBag1(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(goodReuseBagImg1, 0, 0);
  pop();
}

function drawGoodReuseBag2(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(goodReuseBagImg2, 0, 0);
  pop();
}

function drawGoodReuseBag3(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(goodReuseBagImg3, 0, 0);
  pop();
}

// Fish are drawn as real vector paths (not an image) specifically so they
// can animate — the tail flexes side to side like an actual swim stroke.
// Faces left at rest (eye near x=20); the debris system rotates the whole
// fish nose-down as it falls (see updateAndDrawDebris).

// how far along the body (0 at the head, 1 at the tail tip) before the swim
// wiggle kicks in, and how strong it gets — little movement up front, a lot
// at the tail, just like a real fish
function fishBend(px, time, phase) {
  const t = constrain(px / 190, 0, 1);
  const falloff = t * t;
  return sin(time * 5 + phase) * 7 * falloff;
}

function fvtx(x, y, time, phase) {
  vertex(x, y + fishBend(x, time, phase));
}

function fbz(x1, y1, x2, y2, x3, y3, time, phase) {
  bezierVertex(x1, y1 + fishBend(x1, time, phase), x2, y2 + fishBend(x2, time, phase), x3, y3 + fishBend(x3, time, phase));
}

function drawGoodFish1(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  const time = millis() * 0.001;
  const phase = 0;

  noStroke();

  // dorsal fin near the head
  setGradientFill(92.2943, 0, 92.2943, 58.9977, [[0, "#C9F2EE"], [1, "#5ED9CD"]]);
  beginShape();
  fvtx(88.4662, 0.0996565, time, phase);
  fbz(72.6869, -1.32047, 60.8525, 12.7888, 56.9077, 20.0209, time, phase);
  fvtx(126.336, 44.8733, time, phase);
  fbz(131.859, 37.457, 119.038, 24.5575, 111.938, 19.0348, time, phase);
  fbz(110.689, 13.3148, 104.245, 1.51979, 88.4662, 0.0996565, time, phase);
  endShape(CLOSE);

  // body + tail
  setGradientFill(76.5756, 14.8875, 105.527, 79.3605, [[0, "#98E7DF"], [1, "#2EC2B4"]]);
  beginShape();
  fvtx(35.6057, 15.6816, time, phase);
  fbz(15.4082, 18.6797, -1.47565, 37.8702, 0.102375, 49.2125, time, phase);
  fbz(5.03329, 78.3045, 50.5302, 81.2969, 62.0359, 73.2758, time, phase);
  fbz(73.5416, 65.2547, 133.831, 55.7214, 133.831, 55.7214, time, phase);
  fbz(136.593, 61.8359, 144.522, 72.5263, 154.147, 66.3724, time, phase);
  fbz(163.772, 60.2185, 154.476, 54.4722, 148.624, 52.3683, time, phase);
  fbz(162.694, 48.3578, 188.743, 37.1019, 180.38, 24.163, time, phase);
  fbz(172.017, 11.224, 147.704, 30.3432, 136.593, 41.5201, time, phase);
  fbz(103.654, 21.5988, 60.8524, 11.934, 35.6057, 15.6816, time, phase);
  endShape(CLOSE);

  // small pectoral fin — near the head, so it barely moves
  plantFill("#98E7DF");
  beginShape();
  fvtx(112.03, 41.68, time, phase);
  fbz(107.993, 33.6069, 87.1773, 37.2092, 78.1043, 39.5103, time, phase);
  fbz(77.1838, 40.2335, 75.5796, 43.4551, 76.5264, 50.5558, time, phase);
  fbz(77.7098, 59.4316, 114.594, 46.8082, 112.03, 41.68, time, phase);
  endShape(CLOSE);

  // eye — right at the head, essentially no bend
  plantFill("#065274");
  ellipse(20.6151 + fishBend(20.6151, time, phase), 35.5033, 9.46754, 9.46754);
  plantFill("#BBE8FB");
  ellipse(18.0511 + fishBend(18.0511, time, phase), 35.306, 2.76136, 2.76136);

  pop();
}

function drawGoodFish2(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  const time = millis() * 0.001;
  const phase = 1.4;

  noStroke();

  setGradientFill(96.3509, 0, 96.3509, 61.591, [[0, "#FCEDF0"], [1, "#F3AAB6"]]);
  beginShape();
  fvtx(92.3546, 0.104037, time, phase);
  fbz(75.8818, -1.37852, 63.5271, 13.3509, 59.4089, 20.901, time, phase);
  fvtx(131.889, 46.8457, time, phase);
  fbz(137.655, 39.1035, 124.271, 25.6369, 116.858, 19.8715, time, phase);
  fbz(115.554, 13.9, 108.827, 1.58659, 92.3546, 0.104037, time, phase);
  endShape(CLOSE);

  setGradientFill(79.9415, 15.542, 110.165, 82.849, [[0, "#F8CED5"], [1, "#ED8495"]]);
  beginShape();
  fvtx(37.1707, 16.3711, time, phase);
  fbz(16.0855, 19.5009, -1.54051, 39.535, 0.106875, 51.3758, time, phase);
  fbz(5.25453, 81.7466, 52.7513, 84.8706, 64.7627, 76.4969, time, phase);
  fbz(76.7742, 68.1232, 139.714, 58.1709, 139.714, 58.1709, time, phase);
  fbz(142.597, 64.5541, 150.874, 75.7144, 160.923, 69.29, time, phase);
  fbz(170.971, 62.8656, 161.266, 56.8668, 155.157, 54.6704, time, phase);
  fbz(169.846, 50.4835, 197.04, 38.7329, 188.309, 25.2252, time, phase);
  fbz(179.578, 11.7175, 154.196, 31.6771, 142.597, 43.3453, time, phase);
  fbz(108.21, 22.5484, 63.5273, 12.4588, 37.1707, 16.3711, time, phase);
  endShape(CLOSE);

  plantFill("#F8CED5");
  beginShape();
  fvtx(116.954, 43.512, time, phase);
  fbz(112.74, 35.0841, 91.009, 38.8447, 81.5372, 41.247, time, phase);
  fbz(80.5763, 42.002, 78.9015, 45.3652, 79.8899, 52.7779, time, phase);
  fbz(81.1254, 62.0439, 119.631, 48.8657, 116.954, 43.512, time, phase);
  endShape(CLOSE);

  plantFill("#065274");
  ellipse(21.5214 + fishBend(21.5214, time, phase), 37.0639, 9.8837, 9.8837);
  plantFill("#BBE8FB");
  ellipse(18.8447 + fishBend(18.8447, time, phase), 36.8579, 2.88274, 2.88274);

  pop();
}

function drawGoodFish3(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  const time = millis() * 0.001;
  const phase = 2.8;

  noStroke();

  setGradientFill(98.0579, 0, 98.0579, 62.6821, [[0, "#EBFBE9"], [1, "#BFF4B8"]]);
  beginShape();
  fvtx(93.9907, 0.10588, time, phase);
  fbz(77.2261, -1.40294, 64.6526, 13.5874, 60.4614, 21.2712, time, phase);
  fvtx(134.226, 47.6756, time, phase);
  fbz(140.093, 39.7962, 126.472, 26.0911, 118.928, 20.2235, time, phase);
  fbz(117.601, 14.1463, 110.755, 1.6147, 93.9907, 0.10588, time, phase);
  endShape(CLOSE);

  setGradientFill(81.3577, 15.8171, 112.117, 84.3165, [[0, "#E3FAE0"], [1, "#8FEC83"]]);
  beginShape();
  fvtx(37.8292, 16.6609, time, phase);
  fbz(16.3705, 19.8462, -1.5678, 40.2352, 0.108768, 52.2858, time, phase);
  fbz(5.34762, 83.1946, 53.6858, 86.3739, 65.91, 77.8519, time, phase);
  fbz(78.1342, 69.3298, 142.189, 59.2012, 142.189, 59.2012, time, phase);
  fbz(145.123, 65.6975, 153.547, 77.0555, 163.774, 70.5173, time, phase);
  fbz(174, 63.9791, 164.123, 57.874, 157.906, 55.6387, time, phase);
  fbz(172.854, 51.3777, 200.53, 39.4189, 191.645, 25.6719, time, phase);
  fbz(182.76, 11.9249, 156.928, 32.238, 145.123, 44.113, time, phase);
  fbz(110.127, 22.9476, 64.6526, 12.6793, 37.8292, 16.6609, time, phase);
  endShape(CLOSE);

  plantFill("#E3FAE0");
  beginShape();
  fvtx(119.026, 44.2828, time, phase);
  fbz(114.737, 35.7056, 92.6213, 39.5328, 82.9816, 41.9777, time, phase);
  fbz(82.0037, 42.746, 80.2993, 46.1688, 81.3051, 53.7129, time, phase);
  fbz(82.5625, 63.143, 121.75, 49.7313, 119.026, 44.2828, time, phase);
  endShape(CLOSE);

  plantFill("#065274");
  ellipse(21.9027 + fishBend(21.9027, time, phase), 37.7203, 10.0588, 10.0588);
  plantFill("#BBE8FB");
  ellipse(19.1783 + fishBend(19.1783, time, phase), 37.5109, 2.93382, 2.93382);

  pop();
}

function drawGoodReefSunscreen1(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(goodReefSunscreenImg1, 0, 0);
  pop();
}

function drawGoodReefSunscreen2(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(goodReefSunscreenImg2, 0, 0);
  pop();
}

function drawGoodReefSunscreen3(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(goodReefSunscreenImg3, 0, 0);
  pop();
}

// "bad" — hitting a coral fades it AND shrinks the shield dome
const TRASH_ITEM_FNS = [
  drawTrashBottle1, drawTrashBottle2, drawTrashBottle3,
  drawTrashMilkBox1, drawTrashMilkBox2, drawTrashMilkBox3,
  drawTrashSunscreen1,
  // drawTrashSunscreen2/3 removed — those two SVGs are plain blobs with no
  // label artwork on them (unlike drawTrashSunscreen1), so they're excluded
  // from the pool until there's a properly-detailed design for them
];
// visual center (half its exported pixel size) + overall size (larger side)
// of each item's own artwork, used to center/fit it when riding inside a bubble
const TRASH_ITEM_CENTER = [
  { cx: 29, cy: 51.5, maxDim: 103 },   // drawTrashBottle1 (58x103)
  { cx: 29, cy: 51.5, maxDim: 103 },   // drawTrashBottle2 (58x103)
  { cx: 29, cy: 55, maxDim: 110 },     // drawTrashBottle3 (58x110)
  { cx: 73.5, cy: 70, maxDim: 147 },   // drawTrashMilkBox1 (147x140)
  { cx: 64, cy: 60.5, maxDim: 128 },   // drawTrashMilkBox2 (128x121)
  { cx: 64, cy: 60.5, maxDim: 128 },   // drawTrashMilkBox3 (128x121)
  { cx: 33.5, cy: 76, maxDim: 152, bigger: true },   // drawTrashSunscreen1 (67x152)
];

// "good" — hitting a coral grows the shield dome, coral is unharmed
const GOOD_ITEM_FNS = [
  drawGoodReuseBag1, drawGoodReuseBag2, drawGoodReuseBag3,
  drawGoodFish1, drawGoodFish2, drawGoodFish3,
  drawGoodReefSunscreen1, drawGoodReefSunscreen2,
  // drawGoodReefSunscreen3 removed — that SVG is just a plain blob with no
  // label artwork on it (unlike the other two), so it's excluded from the pool
];
const GOOD_ITEM_CENTER = [
  { cx: 50, cy: 56.5, maxDim: 113 },   // drawGoodReuseBag1 (100x113)
  { cx: 59, cy: 58.5, maxDim: 118 },   // drawGoodReuseBag2 (118x117)
  { cx: 50, cy: 56.5, maxDim: 113 },   // drawGoodReuseBag3 (100x113)
  { cx: 95, cy: 32.5, maxDim: 190 },   // drawGoodFish1 (190x65)
  { cx: 91, cy: 39, maxDim: 182 },     // drawGoodFish2 (182x78)
  { cx: 97, cy: 33.5, maxDim: 194 },   // drawGoodFish3 (194x67)
  { cx: 33.5, cy: 76, maxDim: 152, bigger: true },   // drawGoodReefSunscreen1 (67x152)
  { cx: 33.5, cy: 76, maxDim: 152, bigger: true },   // drawGoodReefSunscreen2 (67x152)
];

let debrisItems = [];
let reefDeathTime = null; // set once, the instant every coral has died
let nextSpawnAt = 0;

// keeps good/bad spawns balanced over time — a plain 50/50 coin flip can
// still streak (e.g. several trash items in a row) which reads as "more
// trash than good"; this leans the odds toward whichever side is currently
// behind instead, so the running counts stay close to even
let goodSpawnCount = 0;
let badSpawnCount = 0;

function spawnDebris() {
  // each falling item is either "good" (grows the shield when it lands on a
  // coral) or "bad" (fades the coral and shrinks the shield) — see the
  // SHIELD DOME section for what happens on impact
  const isGood = goodSpawnCount <= badSpawnCount ? random() < 0.7 : random() < 0.3;
  if (isGood) goodSpawnCount++; else badSpawnCount++;
  const fns = isGood ? GOOD_ITEM_FNS : TRASH_ITEM_FNS;
  const centers = isGood ? GOOD_ITEM_CENTER : TRASH_ITEM_CENTER;
  const idx = floor(random(fns.length));

  // bias where debris falls toward the coral clusters most of the time, so
  // it actually has a real chance of landing on a coral instead of just
  // dropping through the open middle of the scene where there's no coral at
  // all. Prefer corals that are still colored, so debris keeps "hunting"
  // whatever's left until every coral has eventually gone gray.
  let x;
  const stillColored = coralPlan.filter((c) => !c.faded);
  const targetPool = stillColored.length > 0 ? stillColored : coralPlan;
  if (targetPool.length > 0 && random() < 0.97) {
    const nearCoral = targetPool[floor(random(targetPool.length))];
    // when only a couple corals are still colored, aim much more precisely
    // at them so the "last survivor" doesn't drag things out on bad luck
    const jitter = stillColored.length > 0 && stillColored.length <= 2 ? 30 : 55;
    x = constrain(nearCoral.groundX + random(-jitter, jitter), 40, width - 40);
  } else {
    x = random(60, width - 60);
  }
  // sunscreen bottles (both good and bad) spawn bigger than everything else
  // so their label text is actually readable — see the "bigger" flag on
  // their TRASH_ITEM_CENTER/GOOD_ITEM_CENTER entries
  const s = centers[idx].bigger ? random(1.1, 1.5) : random(0.7, 1.1);

  // fish are drawn facing left at rest (see drawGoodFish1/2/3) and dive
  // nose-down as they fall — the fish's own vector tail already wiggles on
  // its own (see fishBend), so no extra whole-body wiggle is needed here
  const isFishItem = fns[idx] === drawGoodFish1 || fns[idx] === drawGoodFish2 || fns[idx] === drawGoodFish3;
  // milkbox/sunscreen have printed labels/text on them — flipping mirrors
  // the text backwards, so those (and fish, to keep the nose reliably
  // pointing down) never spawn flipped
  const noFlip = isFishItem
    || fns[idx] === drawTrashMilkBox1 || fns[idx] === drawTrashMilkBox2 || fns[idx] === drawTrashMilkBox3
    || fns[idx] === drawTrashSunscreen1
    || fns[idx] === drawGoodReefSunscreen1 || fns[idx] === drawGoodReefSunscreen2;

  debrisItems.push({
    fn: fns[idx],
    center: centers[idx],
    isGood,
    isFish: isFishItem,
    x,
    y: -random(40, 200), // start just above the top of the canvas
    s,
    speed: random(70, 110), // px/sec falling speed — fast
    sway: random(10, 30),
    swaySpeed: random(0.3, 0.8),
    phase: random(TWO_PI),
    rot: isFishItem ? -HALF_PI + random(-0.2, 0.2) : random(-0.15, 0.15), // nose-down for fish
    flip: !noFlip && random() < 0.5 ? -1 : 1, // a few of every kind spawn mirrored, for variety
    // a gentle rocking wiggle as it falls, on top of whatever else it's
    // doing (the fish's own tail-bend is separate, see fishBend)
    wiggleAmp: random(0.08, 0.16),
    wiggleSpeed: random(1.5, 3),
  });
}

function updateAndDrawDebris(frozen = false) {
  const now = millis();

  // one at a time, trickling in steadily instead of arriving in a dense
  // clump — each one still falls fast, there's just a beat between them —
  // not once the reef is fully dead, everything just holds still then
  if (!frozen && now > nextSpawnAt) {
    spawnDebris();
    nextSpawnAt = now + random(900, 1600);
  }

  const dt = frozen ? 0 : deltaTime * 0.001;
  const CORAL_HIT_RADIUS = 110; // scaled per coral's own size below — must actually touch now

  for (let i = debrisItems.length - 1; i >= 0; i--) {
    const c = debrisItems[i];
    let x;
    if (frozen) {
      x = c.drawX !== undefined ? c.drawX : c.x; // hold at its last on-screen position
    } else {
      c.y += c.speed * dt;
      x = c.x + sin(now * 0.001 * c.swaySpeed + c.phase) * c.sway;
      c.drawX = x; // remembered so the bubble system can check collisions this frame
    }

    // if this piece of debris falls onto a coral: a "good" item grows the
    // shield dome and leaves the coral alone; a "bad" item fades the coral
    // and shrinks the shield. Either way the item is destroyed on impact
    // (skipped while frozen). Corals themselves are untouched either way —
    // whether the reef survives is decided by the shield level vs. the game
    // timer instead (see GAME STATE)
    if (!frozen) {
      let hitCoral = false;
      for (const coral of coralPlan) {
        if (dist(x, c.y, coral.groundX, coral.groundY) < CORAL_HIT_RADIUS * coral.s) {
          if (c.isGood) {
            growShield();
            if (soundOn) bubbleEatingSound.play();
          } else {
            shrinkShield();
            if (soundOn) dieCoralSound.play();
          }
          hitCoral = true;
          break;
        }
      }
      if (hitCoral) {
        debrisItems.splice(i, 1);
        continue;
      }
    }

    // everything rocks gently around its base angle as it falls, instead of
    // holding one static rotation — held still once frozen, like everything else
    const rot = frozen ? c.rot : c.rot + sin(now * 0.001 * c.wiggleSpeed + c.phase) * c.wiggleAmp;

    push();
    translate(x, c.y);
    rotate(rot);
    if (c.flip === -1) scale(-1, 1); // a few of every kind spawn mirrored
    // center the artwork on (x, c.y) — this is also exactly the point used
    // for collision checks above and by the bubble system, so what you see
    // touching a bubble/coral is exactly when the hit actually registers
    c.fn(-c.center.cx * c.s, -c.center.cy * c.s, c.s);
    pop();

    if (!frozen && c.y > height + 200) {
      debrisItems.splice(i, 1); // drifted past the bottom, remove it
    }
  }
}

// ======================================================
// BUBBLES (click to pop one out, move the mouse to trail a few — swallows
// any debris it touches)
// ======================================================

let bubbles = [];

function spawnBubbleAt(x, y) {
  // plays on every bubble, with slight pitch/volume jitter so a fast mouse
  // trail doesn't turn into an identical repeating boop. cueStart skips the
  // ~0.37s of near-silence at the start of the source file (measured via
  // decodeAudioData) — without it every bubble sounds like it fires late.
  // The amp passed to play() sets the sound's gain directly, overriding
  // whatever setVolume()/applySfxVolumes() set — so the jitter has to be
  // multiplied against the current SFX-slider volume here, not stand alone,
  // or dragging the SFX slider would do nothing to this particular sound.
  if (soundOn) {
    const jitteredAmp = BUBBLE_BREATH_VOLUME * sfxVolume * random(0.7, 1);
    bubbleBreathSound.play(0, random(0.9, 1.1), jitteredAmp, 0.36);
  }
  bubbles.push({
    x,
    y,
    r: random(16, 24),
    speed: random(45, 75),
    wobbleAmp: random(4, 10),
    wobbleSpeed: random(0.5, 1.2),
    phase: random(TWO_PI),
    swallowed: [], // debris riding inside this bubble, drawn together with it
  });
}

// true for clicks on real page UI (the sound button) so those don't also
// spawn a bubble stacked in the top-left corner where that button sits
function isClickOnPageUI(event) {
  return !!(event && event.target && event.target.closest(
    "#sound-toggle, #sound-panel, #welcome-screen, #credits-screen, #pause-toggle, #pause-panel"
  ));
}

// p5's own mouseX/mouseY (and touchX/touchY) don't track correctly here,
// since #scene (the canvas's parent) is scaled with a CSS transform (see
// fitScene() in index.html) to fit the viewport — p5 doesn't re-measure
// that. Compute the real canvas-space position ourselves from a raw
// clientX/clientY instead — the scene is locked to a 16:9 box either way,
// so this same math holds on every screen size, no extra scaling needed.
function canvasPointFromClient(clientX, clientY) {
  // the canvas has pointer-events:none (see style.css) so event.target is
  // never the canvas itself — look it up directly instead
  const rect = document.querySelector("canvas").getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width * width,
    y: (clientY - rect.top) / rect.height * height,
  };
}

let lastBubbleMouse = null;

// shared by mouse clicks and touch taps
function popBubbleAtClient(clientX, clientY) {
  const m = canvasPointFromClient(clientX, clientY);
  spawnBubbleAt(m.x, m.y);
  lastBubbleMouse = m;
}

// shared by mouse drags and touch drags — throttled so a fast move doesn't
// flood the screen with bubbles
let nextTrailBubbleAt = 0;
function trailBubbleAtClient(clientX, clientY) {
  const m = canvasPointFromClient(clientX, clientY);
  const now = millis();
  const moved = lastBubbleMouse ? dist(m.x, m.y, lastBubbleMouse.x, lastBubbleMouse.y) : Infinity;
  if (moved > 4 && now > nextTrailBubbleAt) {
    spawnBubbleAt(m.x, m.y);
    lastBubbleMouse = m;
    nextTrailBubbleAt = now + 60;
  }
}

// ---- mouse (desktop) ----

// click anywhere on the scene to pop out a bubble there
function mousePressed(event) {
  if (isClickOnPageUI(event)) return;
  // the "How To Play" screens are canvas-drawn, so a click anywhere on them
  // advances; welcome/credits are real DOM buttons (isClickOnPageUI above
  // already caught those), so a stray canvas click during either does nothing
  if (!gameStarted) {
    if (uiScreen === "howto-rules" || uiScreen === "howto-legend") advanceInstructions();
    return;
  }
  if (gamePaused) return;
  if (gameEnded) return backToHome(); // click anywhere on the win/lose banner
  popBubbleAtClient(event.clientX, event.clientY);
}

// mouseDragged only fires while a mouse button is actually held down (unlike
// mouseMoved, which fires on any hover) — so a plain hover never spawns
// bubbles, only a click-and-drag does
function mouseDragged(event) {
  if (isClickOnPageUI(event)) return;
  if (gamePaused) return;
  trailBubbleAtClient(event.clientX, event.clientY);
}

// ---- touch (mobile) ----

// tap anywhere on the scene to pop out a bubble there
function touchStarted(event) {
  if (isClickOnPageUI(event)) return;
  if (!gameStarted) {
    if (uiScreen === "howto-rules" || uiScreen === "howto-legend") advanceInstructions();
    return false;
  }
  if (gamePaused) return false;
  if (gameEnded) { backToHome(); return false; } // tap anywhere on the win/lose banner
  const t = event.touches[0] || event.changedTouches[0];
  if (t) popBubbleAtClient(t.clientX, t.clientY);
  return false; // prevent the default scroll/zoom touch behavior
}

// dragging a finger across the scene trails bubbles behind it
function touchMoved(event) {
  if (isClickOnPageUI(event)) return;
  if (gamePaused) return false;
  const t = event.touches[0] || event.changedTouches[0];
  if (t) trailBubbleAtClient(t.clientX, t.clientY);
  return false;
}

function updateAndDrawBubbles(frozen = false) {
  const now = millis();
  const dt = frozen ? 0 : deltaTime * 0.001;

  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    let x;
    if (frozen) {
      x = b.drawX !== undefined ? b.drawX : b.x; // hold at its last on-screen position
    } else {
      b.y -= b.speed * dt;
      x = b.x + sin(now * 0.001 * b.wobbleSpeed + b.phase) * b.wobbleAmp;
      b.drawX = x;
    }

    // swallow the first falling item the bubble touches: grow, and carry it
    // along inside it instead of destroying it. Capped at one item per
    // bubble (skipped entirely while frozen, or once it's already full)
    if (!frozen && b.swallowed.length < 1) {
      for (let j = debrisItems.length - 1; j >= 0; j--) {
        const c = debrisItems[j];
        const cx = c.drawX !== undefined ? c.drawX : c.x;
        const debrisRadius = 8 * c.s;
        if (dist(x, b.y, cx, c.y) < b.r + debrisRadius) {
          b.r = min(b.r + 12, 22); // cap growth so bubbles can't snowball into giant nets
          b.swallowed.push({ fn: c.fn, center: c.center });
          debrisItems.splice(j, 1);
          if (soundOn) bubbleEatingSound.play();
          break; // this bubble is now full — stop looking for more
        }
      }
    }

    // slight organic squish/wobble so it doesn't look like a perfect,
    // static circle — a bit more like a real bubble under water pressure
    // (held still, no squish animation, while frozen)
    const squish = frozen ? 1 : 1 + sin(now * 0.006 + b.phase) * 0.05;
    const bw = b.r * 2 * squish;
    const bh = b.r * 2 * (2 - squish);

    noStroke();
    fill(210, 245, 255, 40); // faint blue-tinted body, like real water refraction
    ellipse(x, b.y, bw, bh);
    noFill();
    stroke(255, 255, 255, 130);
    strokeWeight(1.4);
    ellipse(x, b.y, bw, bh); // thin rim, like surface tension
    noStroke();
    fill(255, 255, 255, 175);
    ellipse(x - b.r * 0.32, b.y - b.r * 0.35, b.r * 0.5, b.r * 0.38); // bright highlight
    fill(255, 255, 255, 90);
    ellipse(x + b.r * 0.25, b.y + b.r * 0.3, b.r * 0.22, b.r * 0.18); // small secondary glint

    // draw whatever this bubble has swallowed, riding along inside it. Size
    // is recomputed every frame from the bubble's CURRENT radius (not a
    // fixed fraction of the creature's own size), so it always visually
    // fits inside the bubble no matter how small/big the bubble is right now.
    for (let k = 0; k < b.swallowed.length; k++) {
      const item = b.swallowed[k];
      const spreadAngle = (k / max(1, b.swallowed.length)) * TWO_PI;
      const spreadR = b.swallowed.length > 1 ? b.r * 0.22 : 0;
      const packFactor = b.swallowed.length > 1 ? pow(b.swallowed.length, -0.5) : 1;
      const targetSize = b.r * 2 * 0.55 * packFactor; // fits comfortably inside the bubble's current size
      const s = targetSize / item.center.maxDim;
      push();
      item.fn(
        x + cos(spreadAngle) * spreadR - item.center.cx * s,
        b.y + sin(spreadAngle) * spreadR - item.center.cy * s,
        s
      );
      pop();
    }

    if (!frozen && b.y < -60) {
      bubbles.splice(i, 1); // drifted past the top, remove it
    }
  }
}

function setup() {
  let canvas = createCanvas(1920, 1080);
  canvas.parent("scene");
  // lock the canvas to exactly 1920x1080 pixels regardless of the screen's
  // device pixel ratio (retina/high-DPI displays) — without this, p5 can
  // render the canvas's internal buffer at 2x+ resolution while its CSS
  // display size stays "1920px", causing it to visually not line up with
  // other same-sized elements (like the background image) after any
  // scaling/transform is applied to their shared parent container.
  pixelDensity(1);
  randomizeCorals();
  initParticles();
  // gameStartTime is set once the player dismisses the instructions screen — see startGame()

  musicSound.setLoop(true);
  underwaterSound.setLoop(true);
  coralMovementSound.setLoop(true);
  coralMovementSound.rate(CORAL_MOVEMENT_BASE_RATE);

  // one-shot effects: allow overlapping plays (multiple bubbles can breathe
  // out or swallow debris close together) instead of cutting each other off
  bubbleBreathSound.playMode("sustain");
  bubbleEatingSound.playMode("sustain");
  dieCoralSound.playMode("sustain");
  // p5.sound's setVolume() is clamped to [0, 1], so it can't make this any
  // louder on its own. To push it past that, route the sound through its
  // own raw Web Audio GainNode set above 1 — rewires the sound's output
  // from p5's master bus through this extra amplifier stage, then back into
  // the master bus, so only this one sound gets the boost.
  {
    const ctx = getAudioContext();
    const boostGain = ctx.createGain();
    boostGain.gain.value = DIE_CORAL_GAIN_BOOST;
    dieCoralSound.disconnect();
    dieCoralSound.panner.connect(boostGain);
    boostGain.connect(ctx.destination);
  }

  applyMusicVolume();
  applySfxVolumes();
  applyUiVolume();

  const soundToggleBtn = document.getElementById("sound-toggle");
  const soundPanel = document.getElementById("sound-panel");
  soundToggleBtn.addEventListener("click", toggleSoundPanel);

  document.getElementById("music-volume").addEventListener("input", (e) => {
    musicVolume = e.target.value / 100;
    applyMusicVolume();
  });
  document.getElementById("sfx-volume").addEventListener("input", (e) => {
    sfxVolume = e.target.value / 100;
    applySfxVolumes();
  });
  document.getElementById("ui-volume").addEventListener("input", (e) => {
    uiVolume = e.target.value / 100;
    applyUiVolume();
  });

  // clicking anywhere outside the panel/button closes the panel
  document.addEventListener("click", (e) => {
    if (!soundPanel.contains(e.target) && !soundToggleBtn.contains(e.target)) {
      closeSoundPanel();
    }
  });

  document.getElementById("welcome-start").addEventListener("click", startFromWelcome);
  document.getElementById("welcome-howto").addEventListener("click", showHowToPlay);
  document.getElementById("welcome-credits").addEventListener("click", showCredits);
  document.getElementById("credits-screen").addEventListener("click", showWelcomeScreen);

  document.getElementById("pause-toggle").addEventListener("click", togglePause);
  document.getElementById("pause-resume").addEventListener("click", togglePause);
  document.getElementById("pause-restart").addEventListener("click", restartGame);
  document.getElementById("pause-home").addEventListener("click", backToHome);

  // browsers block audio until a real user gesture happens — rather than
  // wait for the player to click one specific button, treat literally the
  // first pointer interaction anywhere on the page (even a stray click on
  // empty space) as that gesture, so the music starts as early as possible
  document.addEventListener("pointerdown", () => {
    userStartAudio().then(() => {
      if (!ambientStarted && soundOn) {
        ambientStarted = true;
        musicSound.play();
        underwaterSound.play();
        coralMovementSound.play();
      }
    });
  }, { once: true });
}

function draw() {
  clear();

  // every pre-game screen (welcome, the two "how to play" screens, credits)
  // shares the same small, independently-positioned reef (WELCOME_LAYOUT)
  // instead of the game's actual live one — skip straight to that and stop,
  // none of the game state below applies yet
  if (uiScreen === "welcome" || uiScreen === "howto-rules" || uiScreen === "howto-legend" || uiScreen === "credits") {
    drawWelcomeDecoration();
    drawParticles();
    if (uiScreen === "howto-rules") drawInstructionsScreen();
    else if (uiScreen === "howto-legend") drawLegendScreen();
    return;
  }

  if (gameStarted && !gamePaused) checkGameOutcome();

  const reefDead = coralPlan.length > 0 && coralPlan.every((c) => c.faded);
  if (reefDead && reefDeathTime === null) {
    reefDeathTime = millis(); // freeze seaweed's sway at this exact instant
    silenceAmbientSounds(); // the reef has gone silent — fade the ambience out too
    document.getElementById("pause-toggle").hidden = true; // nothing left to pause once the game's decided
    gameEnded = true;
  }
  const gameOver = reefDead || gameWon;
  // before the player dismisses the instructions, once the game's decided,
  // or while paused, the scene sits calm and still — no debris falling, no
  // timer running
  const holdStill = gameOver || !gameStarted || gamePaused;
  const frozenTime = reefDead ? reefDeathTime : null;

  drawRock1(...LAYOUT.rock1);
  // this trio of rock6 pieces sits here specifically so it renders behind
  // rock3 but in front of rock1 — per request
  ROCK6_BEHIND_ROCK3_INDICES.forEach((i) => drawRock6(...LAYOUT.rock6[i]));
  drawRock2(...LAYOUT.rock2);
  // drawCoral5 sits here specifically so it renders in front of rock1/rock2
  // but behind rock3 (per request) — everything else still draws in
  // drawCorals() below, after all rocks
  drawCoralByIndex(CORAL5_PLAN_INDEX);
  drawRock3(...LAYOUT.rock3);

  // the protective shield dome sits over the whole reef, in front of
  // rock1-3 but behind rock4/rock5 (per request) — it starts out invisible
  // and grows as "good" items land on coral (see spawnDebris /
  // updateAndDrawDebris), shrinking back down whenever trash lands instead.
  // shieldDisplayLevel eases toward the real shieldLevel each frame instead
  // of jumping straight to it, so every grow/shrink animates in smoothly.
  if (!gameOver) {
    shieldDisplayLevel += (shieldLevel - shieldDisplayLevel) * min(1, SHIELD_EASE_SPEED * deltaTime * 0.001);
    if (abs(shieldLevel - shieldDisplayLevel) < 0.001) shieldDisplayLevel = shieldLevel;
  }
  if (shieldDisplayLevel > 0.001) {
    const domeScale = LAYOUT.shieldDome[2] * shieldDisplayLevel; // LAYOUT.shieldDome's s is the full-grown size
    const domeWidth = SHIELD_NATURAL_W * domeScale;
    const domeHeight = SHIELD_NATURAL_H * domeScale;
    drawShieldDome((width - domeWidth) / 2, height - domeHeight - SHIELD_BOTTOM_MARGIN, domeScale);
  }

  drawRock4(...LAYOUT.rock4);
  drawRock5(...LAYOUT.rock5);
  // coral3/seaweed5 render here so they sit in front of rock1-5 — per request
  drawCoralByIndex(CORAL3_PLAN_INDEX);
  drawSeaweedByIndex(SEAWEED5_PLAN_INDEX, frozenTime);
  drawRock6Instances(ROCK6_BEHIND_ROCK3_INDICES);

  // same hand-drawn shapes, same original spots — only their color and
  // size were randomized (see CORAL & SEAWEED RANDOMIZATION above).
  // Once the reef is fully dead, seaweed sway freezes too.
  drawSeaweeds(frozenTime, [SEAWEED5_PLAN_INDEX]);
  drawCorals([CORAL5_PLAN_INDEX, CORAL3_PLAN_INDEX]);

  // pulse the coral sound's speed in time with the seaweed sway
  if (soundOn && !reefDead) {
    const swayPhase = millis() * 0.001 * SEAWEED_SWAY_REFERENCE_SPEED;
    coralMovementSound.rate(CORAL_MOVEMENT_BASE_RATE + sin(swayPhase) * CORAL_MOVEMENT_RATE_VARIANCE);
  }

  // once the game has ended (won or lost) — or hasn't started yet — debris/
  // bubbles hold perfectly still; only the underwater dust (particles) keeps drifting
  updateAndDrawDebris(holdStill);
  updateAndDrawBubbles(holdStill);

  drawParticles();

  if (gameStarted && !gameOver) drawTimeBar();

  if (reefDead) {
    // desaturate the whole rendered scene for a "game over" look, then
    // draw the message in full color on top so it still stands out
    filter(GRAY);
    drawReefDeadBanner();
  } else if (gameWon) {
    // a win stays bright/colorful — no desaturation
    drawReefSavedBanner();
  }
}

// Shown once every coral has turned gray — the reef has fully died.
// Title uses Inter Black, subtitle uses Alata — both Google Fonts, loaded
// via the <link> in index.html's <head> (CSS web fonts, not something p5
// loads itself). If that link isn't present, the browser just falls back to
// the default font — nothing breaks.
function drawEndBanner(titleText, subtitleText) {
  push();
  rectMode(CENTER);
  textAlign(CENTER, CENTER);

  const titleSize = 80;
  const subtitleSize = 32;
  const hintSize = 22;
  const hintText = "Click anywhere to return home";

  // measure both lines first so the background box always fits them,
  // however wide these particular fonts/sizes end up rendering
  textFont("Inter");
  textSize(titleSize);
  const titleW = textWidth(titleText);

  textFont("Alata");
  textSize(subtitleSize);
  const subtitleW = textWidth(subtitleText);
  textSize(hintSize);
  const hintW = textWidth(hintText);

  const boxW = max(titleW, subtitleW, hintW) + 140;
  const boxH = 330;
  const titleY = height / 2 - 75;
  const subtitleY = height / 2 + 5;
  const hintY = height / 2 + 100;

  noStroke();
  fill(10, 20, 35, 150);
  rect(width / 2, height / 2, boxW, boxH, 18);

  fill(255);
  textFont("Inter");
  textSize(titleSize);
  text(titleText, width / 2, titleY);

  fill(220, 235, 245, 220);
  textFont("Alata");
  textSize(subtitleSize);
  text(subtitleText, width / 2, subtitleY);

  fill(180, 230, 210);
  textSize(hintSize);
  text(hintText, width / 2, hintY);

  pop();
}

function drawReefDeadBanner() {
  drawEndBanner("The reef has gone silent.", "Every last coral has faded away.");
}

function drawReefSavedBanner() {
  drawEndBanner("The reef lives on.", "Every coral you saved brought color back to the ocean.");
}

// ======================================================
// GAME STATE — you have GAME_DURATION_MS to grow the shield to
// SHIELD_WIN_THRESHOLD (a "good" item landing on coral grows it, "bad" trash
// shrinks it). Reach it in time and the reef is saved; run out of time
// without reaching it and the reef goes silent (every coral fades, same
// ending as before — just triggered by the clock now instead of by trash)
// ======================================================

const GAME_DURATION_MS = 30000;
const SHIELD_WIN_THRESHOLD = 0.5;

let gameStartTime = null; // set once the player actually starts playing
let gameStarted = false;
let gameWon = false;
let gameEnded = false; // true the instant the reef dies or the game is won — click anywhere then returns home
let gamePaused = false;
let pauseStartTime = null; // millis() when paused — the gap gets folded back into gameStartTime on resume

// which pre-game screen is showing — "welcome" is the very first thing the
// player sees (its buttons are real DOM elements, wired in setup()); "howto-
// rules"/"howto-legend" are the two canvas-drawn screens reached through
// "HOW TO PLAY", which return to "welcome" instead of starting the game;
// "credits" is a DOM overlay too. Becomes irrelevant once gameStarted is true.
let uiScreen = "welcome";

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  uiScreen = "playing";
  gameStartTime = millis();
  document.getElementById("pause-toggle").hidden = false;
}

// pause button — freezes the timer/debris/bubbles without resetting anything
function togglePause() {
  if (!gameStarted) return;
  playUiClick();
  gamePaused = !gamePaused;
  document.getElementById("pause-panel").hidden = !gamePaused;
  if (gamePaused) {
    pauseStartTime = millis();
    if (ambientStarted) musicSound.pause();
  } else {
    // shift the clock forward by however long the pause lasted, so the
    // countdown doesn't silently lose time while paused
    gameStartTime += millis() - pauseStartTime;
    if (ambientStarted && soundOn) musicSound.play();
  }
}

// resets the current round back to a fresh start — same as startGame(), but
// also clears out everything a round accumulates along the way
function restartGame() {
  clearTimeout(silenceTimeoutId); // cancel any pending fade-out pause so it can't clobber the restart
  playUiClick();
  gamePaused = false;
  gameEnded = false;
  document.getElementById("pause-panel").hidden = true;
  gameWon = false;
  reefDeathTime = null;
  shieldLevel = 0;
  shieldDisplayLevel = 0;
  debrisItems = [];
  bubbles = [];
  goodSpawnCount = 0;
  badSpawnCount = 0;
  nextSpawnAt = 0;
  randomizeCorals(); // fresh colors/scale, every coral's faded flag reset too
  gameStartTime = millis();
  document.getElementById("pause-toggle").hidden = false;

  // the music may currently be paused (entering pause via the pause menu
  // pauses it) or silenced (if this restart follows a win/loss) — either
  // way, a restart should always hear it playing again from the top
  if (soundOn) {
    musicSound.stop();
    musicSound.play();
  }
}

// bails out of the round entirely, back to the welcome screen — used both by
// the pause menu's "Back to home" and by clicking anywhere on the end-game
// banner (win or lose)
function backToHome() {
  clearTimeout(silenceTimeoutId); // cancel any pending fade-out pause so it can't clobber the restart

  // fully reset the audio state first, so the click below restarts the
  // music/ambience fresh from the top — regardless of whether it was
  // currently paused (pause menu) or silenced (the round just ended)
  soundOn = true;
  ambientStarted = false;
  musicSound.stop();
  underwaterSound.stop();
  coralMovementSound.stop();
  updateSoundButton();

  playUiClick(); // ambientStarted is false, so this also restarts the loops

  gamePaused = false;
  gameEnded = false;
  gameStarted = false;
  document.getElementById("pause-panel").hidden = true;
  document.getElementById("pause-toggle").hidden = true;
  gameWon = false;
  reefDeathTime = null;
  shieldLevel = 0;
  shieldDisplayLevel = 0;
  debrisItems = [];
  bubbles = [];
  goodSpawnCount = 0;
  badSpawnCount = 0;
  nextSpawnAt = 0;
  randomizeCorals(); // otherwise the next round starts with last round's dead/faded reef
  uiScreen = "welcome";
  document.getElementById("welcome-screen").hidden = false;
  document.getElementById("credits-screen").hidden = true;
}

function showWelcomeScreen() {
  playUiClick();
  uiScreen = "welcome";
  document.getElementById("welcome-screen").hidden = false;
  document.getElementById("credits-screen").hidden = true;
}

function showHowToPlay() {
  playUiClick();
  uiScreen = "howto-rules";
  document.getElementById("welcome-screen").hidden = true;
}

function showCredits() {
  playUiClick();
  uiScreen = "credits";
  document.getElementById("welcome-screen").hidden = true;
  document.getElementById("credits-screen").hidden = false;
}

function startFromWelcome() {
  playUiClick();
  document.getElementById("welcome-screen").hidden = true;
  startGame();
}

// click/tap while the two canvas-drawn "How To Play" screens are up — first
// click moves from the rules screen to the good/bad legend screen, second
// click returns to the welcome screen (not straight into the game)
function advanceInstructions() {
  playUiClick();
  if (uiScreen === "howto-rules") { uiScreen = "howto-legend"; return; }
  uiScreen = "welcome";
  document.getElementById("welcome-screen").hidden = false;
}

function drawInstructionsScreen() {
  push();
  rectMode(CENTER);
  textAlign(CENTER, CENTER);

  const titleText = "REEFLECT";
  const titleSize = 64;
  const lines = [
    `You have ${GAME_DURATION_MS / 1000} seconds to protect the reef.`,
    "",
    "Click or tap to blow a bubble, or drag to create a bubble trail.",
    "Use the bubbles to clear harmful items before they reach the coral.",
    "Let the good stuff reach the coral to grow your shield.",
    "",
    `Keep the reef's protection level at ${round(SHIELD_WIN_THRESHOLD * 100)}% or higher to win!`,
  ];
  const promptText = "Click for next";

  textFont("Inter");
  textSize(titleSize);
  let boxW = textWidth(titleText);

  textFont("Alata");
  textSize(24);
  for (const line of lines) boxW = max(boxW, textWidth(line));
  textSize(22);
  boxW = max(boxW, textWidth(promptText));

  boxW += 160;
  const lineH = 34;
  const boxH = 170 + lines.length * lineH + 70;

  noStroke();
  fill(10, 20, 35, 179);
  rect(width / 2, height / 2, boxW, boxH, 24);

  let y = height / 2 - boxH / 2 + 70;

  textFont("Inter");
  textSize(titleSize);
  const titleW = textWidth(titleText);
  setTitleGradientFill(width / 2 - titleW / 2, width / 2 + titleW / 2, y);
  text(titleText, width / 2, y);
  y += 60;

  textFont("Alata");
  textSize(24);
  fill(220, 235, 245, 230);
  for (const line of lines) {
    text(line, width / 2, y);
    y += lineH;
  }

  y += 30;
  fill(180, 230, 210);
  textSize(22);
  text(promptText, width / 2, y);

  pop();
}

// one representative item per category, picked from GOOD_ITEM_FNS/
// TRASH_ITEM_FNS by index, just for the legend screen below
const LEGEND_GOOD = [
  { idx: 0, label: "Reusable bag" },
  { idx: 3, label: "Fish" },
  { idx: 6, label: "Reef-safe sunscreen" },
];
const LEGEND_BAD = [
  { idx: 2, label: "Plastic bottle" },
  { idx: 3, label: "Milk carton" },
  { idx: 6, label: "Sunscreen" },
];

function drawLegendRow(entries, fns, centers, headingText, headingColor, colGap, iconBox, y) {
  textFont("Alata");
  textSize(22);
  fill(headingColor);
  text(headingText, width / 2, y);

  const iconY = y + 60;
  const labelY = iconY + iconBox / 2 + 26;
  const startX = width / 2 - colGap;

  entries.forEach((e, i) => {
    const cx = startX + i * colGap;
    const c = centers[e.idx];
    const s = iconBox / c.maxDim;
    push();
    fns[e.idx](cx - c.cx * s, iconY - c.cy * s, s);
    pop();

    fill(220, 235, 245, 230);
    textFont("Alata");
    textSize(17);
    text(e.label, cx, labelY);
  });

  return labelY;
}

function drawLegendScreen() {
  push();
  rectMode(CENTER);
  textAlign(CENTER, CENTER);

  const titleText = "Instructions";
  const colGap = 150;
  const iconBox = 70;
  const boxW = colGap * 2 + 260;
  const boxH = 500;
  const promptText = "Click anywhere to go back";

  noStroke();
  fill(10, 20, 35, 179);
  rect(width / 2, height / 2, boxW, boxH, 24);

  let y = height / 2 - boxH / 2 + 60;

  textFont("Inter");
  textSize(40);
  const titleW = textWidth(titleText);
  setTitleGradientFill(width / 2 - titleW / 2, width / 2 + titleW / 2, y);
  text(titleText, width / 2, y);
  y += 55;

  y = drawLegendRow(LEGEND_GOOD, GOOD_ITEM_FNS, GOOD_ITEM_CENTER, "HELPS YOUR REEF", [150, 230, 190], colGap, iconBox, y);
  y += 55;
  y = drawLegendRow(LEGEND_BAD, TRASH_ITEM_FNS, TRASH_ITEM_CENTER, "HARMS YOUR REEF", [240, 150, 150], colGap, iconBox, y);

  y += 45;
  fill(180, 230, 210);
  textSize(22);
  text(promptText, width / 2, y);

  pop();
}

function checkGameOutcome() {
  if (gameWon || (coralPlan.length > 0 && coralPlan.every((c) => c.faded))) return; // already decided
  if (millis() - gameStartTime < GAME_DURATION_MS) return; // still running — always plays out the full timer

  // time's up — the outcome is decided by wherever the shield level landed
  if (shieldLevel >= SHIELD_WIN_THRESHOLD) {
    gameWon = true;
    document.getElementById("pause-toggle").hidden = true; // nothing left to pause once the game's decided
    gameEnded = true;
    silenceAmbientSounds(); // a win goes quiet too, same as a loss
  } else {
    // the shield never grew enough — the reef goes silent, reusing the
    // exact same "every coral faded" ending as before
    coralPlan.forEach((c) => {
      c.faded = true;
      c.deathTime = millis();
    });
  }
}

// a countdown bar across the top of the screen, draining as GAME_DURATION_MS
// runs out — hidden once the game has ended (see draw())
function drawTimeBar() {
  // while paused, gameStartTime hasn't been shifted forward yet (that only
  // happens on resume — see togglePause()), so read the clock as it stood
  // at the moment of pausing instead of the live millis(), or the bar would
  // keep visibly draining even though the round is frozen
  const now = gamePaused ? pauseStartTime : millis();
  const remaining = constrain(1 - (now - gameStartTime) / GAME_DURATION_MS, 0, 1);

  const barW = 500;
  const barH = 22;
  const x = width / 2 - barW / 2;
  const y = 36;

  push();
  noStroke();

  // track
  fill(10, 20, 35, 130);
  rect(x, y, barW, barH, barH / 2);

  // fill — green while there's still plenty of time, shifting toward a
  // warning red as it runs low
  const fillColor = lerpColor(color(235, 90, 90), color(120, 220, 150), remaining);
  fill(fillColor);
  if (remaining > 0) rect(x, y, barW * remaining, barH, barH / 2);

  // thin rim so it reads clearly against any background behind it
  noFill();
  stroke(255, 255, 255, 90);
  strokeWeight(1.5);
  rect(x, y, barW, barH, barH / 2);

  pop();
}

// ======================================================
// SHIELD DOME (the reef's protective bubble/shield — a big soft dome image,
// grown/shrunk by scaling it. Its natural size is 1491x908 (see
// assets/images/shield-dome.svg) and it sits with a small gap above the
// bottom of the screen instead of flush against the edge.)
// ======================================================

const SHIELD_NATURAL_W = 1491;
const SHIELD_NATURAL_H = 908;
const SHIELD_BOTTOM_MARGIN = 40; // gap kept between the dome's bottom edge and the screen edge

// 0 = fully hidden (the game starts with no shield at all), 1 = full-grown
// (LAYOUT.shieldDome's tuned size). A "good" item landing on coral grows it,
// a "bad" (trash) item landing on coral shrinks it — see spawnDebris() /
// updateAndDrawDebris()
let shieldLevel = 0;
let shieldDisplayLevel = 0; // eases toward shieldLevel each frame — see draw()
const SHIELD_GROW_STEP = 0.15; // how much one good hit grows it
const SHIELD_SHRINK_STEP = 0.2; // how much one bad hit shrinks it
const SHIELD_EASE_SPEED = 3; // how fast the dome eases to its new size — higher = snappier

function growShield() {
  shieldLevel = constrain(shieldLevel + SHIELD_GROW_STEP, 0, 1);
}

function shrinkShield() {
  shieldLevel = constrain(shieldLevel - SHIELD_SHRINK_STEP, 0, 1);
}

function drawShieldDome(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(shieldDomeImg, 0, 0);
  pop();
}

// ======================================================
// ROCKS
// ======================================================

function drawRock1(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(rock1Img, 0, 0);
  pop();
}

function drawRock2(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(rock2Img, 0, 0);
  pop();
}

function drawRock3(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(rock3Img, 0, 0);
  pop();
}

function drawRock4(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(rock4Img, 0, 0);
  pop();
}

function drawRock5(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(rock5Img, 0, 0);
  pop();
}

function drawRock6(x, y, s = 1) {
  push();
  translate(x, y);
  scale(s);
  image(rock6Img, 0, 0);
  pop();
}

function drawRock6Instances(skipIndices = []) {
  LAYOUT.rock6.forEach(([x, y, s], i) => {
    if (skipIndices.includes(i)) return;
    drawRock6(x, y, s);
  });
}

// indices (within LAYOUT.rock6) of the rock6 cluster that draws behind
// rock3 but in front of rock1 — see draw()
const ROCK6_BEHIND_ROCK3_INDICES = [3, 4, 5];

// ======================================================
// CORAL & SEAWEED RANDOMIZATION (same shapes, same spots — only color and size are randomized)
// ======================================================

const CORAL_DRAW_FNS = [
  drawCoral6, drawCoral9, drawCoral4, drawCoral2, drawCoral10, drawCoral5, drawCoral1,
  drawCoral3, drawCoral7, drawCoral8, drawCoral12,
];
const SEAWEED_DRAW_FNS = [drawSeaweed1, drawSeaweed2, drawSeaweed3, drawSeaweed4, drawSeaweed5, drawSeaweed6, drawSeaweed7];

// ======================================================
// WELCOME SCREEN DECORATION — its own small reef, separate from the game's
// LAYOUT below, drawn only while uiScreen === "welcome" (see draw()). Same
// [x, y, s] editing pattern as LAYOUT — tweak the numbers, nothing else
// needs touching. coral/seaweed entries carry a 4th number picking which
// draw function to use (index into CORAL_DRAW_FNS / SEAWEED_DRAW_FNS).
// ======================================================

const WELCOME_LAYOUT = {
  rock6: [
    [400, 850, 1.3],
    [460, 880, 1.3],
    [1400, 900, 1.3],
    [1450, 950, 1.3],
    [400, 890, 1.3],
    [1380, 960, 1.3],
  ],
  // [x, y, s, coralFnIndex, flip?] — 5 distinct coral types; flip: -1 mirrors
  // it left/right in place, omit (or 1) for normal
  coral: [
    [500, 850, 2, 0, -1],
    [330, 780, 1.3, 2, -1],
    [300, 880, 1, 2, -1],
    [1700, 730, 0.9, 4, -1],
    [250, 900, 1.1, 6],
    [1500, 900, 1.3, 8],
  ],
  // [x, y, s, rotation, seaweedFnIndex] — 4 distinct seaweed types
  seaweed: [
    [80, 200, 4, 0.3, 4],
    [150, 500, 1.6, 0, 2],
    [1430, 400, 5.7, 0, 6],
    [1200, 1150, 2.5, -1.5, 0],
  ],
};

function drawWelcomeDecoration() {
  // layer order, back to front: rock6, then seaweed, then coral on top
  WELCOME_LAYOUT.rock6.forEach(([x, y, s]) => drawRock6(x, y, s));
  WELCOME_LAYOUT.seaweed.forEach(([x, y, s, rotation, idx]) => {
    if (idx === 0) {
      // drawSeaweed1 alone takes rotation (radians) as its own 4th argument
      SEAWEED_DRAW_FNS[idx](x, y, s, rotation);
    } else {
      // every other seaweed has no rotation argument at all — it has to be
      // spun from the outside, pivoting around its own (x, y) ground point
      push();
      translate(x, y);
      rotate(rotation);
      translate(-x, -y);
      SEAWEED_DRAW_FNS[idx](x, y, s);
      pop();
    }
  });
  WELCOME_LAYOUT.coral.forEach(([x, y, s, idx, flip]) => {
    if (flip === -1) {
      push();
      translate(2 * x, 0);
      scale(-1, 1); // mirrors the shape left/right in place, around its own x
      CORAL_DRAW_FNS[idx](x, y, s);
      pop();
    } else {
      CORAL_DRAW_FNS[idx](x, y, s);
    }
  });
}

// ======================================================
// EVERYTHING'S POSITION LIVES HERE — every rock/coral/seaweed as [x, y, s].
// Edit the numbers below; nothing else in the file needs touching.
// ======================================================

const LAYOUT = {
  shieldDome: [35, 198, 1.1],

  rock1: [250, 400, 1],
  rock2: [5, 550, 1],
  rock3: [800, 620, 1],
  rock4: [0, 710, 1],
  rock5: [1600, 700, 1],
  // rock6 has 9 copies, 3 clusters of 3 rocks each (each cluster a triangle:
  // 2 rocks side by side + 1 overlapping in the middle/top)
  rock6: [
    [400, 900, 1],
    [450, 900, 1.0],
    [680, 930, 1],
    [1670, 855, 1],
    [1600, 855, 1],
    [1645, 875, 1],
    [1830, 630, 0.5],
    [1860, 630, 0.5],
    [1840, 640, 0.5],
  ],

  coral1: [250, 550, 0.9],
  coral2: [980, 370, 0.5, -1],
  coral3: [750, 910, 0.6, -1],
  coral4: [1270, 670, 0.55],
  coral5: [812, 600, 1],
  coral6: [350, 600, 1],
  coral7: [1450, 620, 0.8],
  coral8: [850, 900, 0.6],
  coral9: [700, 370, 0.75],
  coral10: [529, 579, 1.1],
  coral11: [1350, 700, 0.85], 


  seaweed1: [830, 500, 0.7],
  seaweed1Rotation: -60, 
  seaweed2: [880, 390, 0.6],
  seaweed3: [400, 470, 0.55],
  seaweed3Rotation: -25,
  seaweed4: [600, 270, 0.6],
  seaweed5: [330, 800, 0.85],
  seaweed6: [1150, 600, 0.85],
  seaweed7: [1200, 650, 0.85],
};

const CORAL_XYS = [
  LAYOUT.coral6, LAYOUT.coral9, LAYOUT.coral4, LAYOUT.coral2, LAYOUT.coral10, LAYOUT.coral5, LAYOUT.coral1,
  LAYOUT.coral3, LAYOUT.coral7, LAYOUT.coral8, LAYOUT.coral11,
];

const SEAWEED_XYS = [
  LAYOUT.seaweed1, LAYOUT.seaweed2, LAYOUT.seaweed3, LAYOUT.seaweed4, LAYOUT.seaweed5, LAYOUT.seaweed6, LAYOUT.seaweed7,
];

// ---- internal only: don't edit below this line ----
// centerX/bottomY are each shape's own horizontal center and root depth
// (measured from its vertex data), used only to find its true ground-contact
// point so random resizing never makes it float or sink. Order matches the
// lists above.
const CORAL_EXTENTS = [
  [51.1, 87.8], [101.6, 179.7], [124.2, 169.7], [162.7, 262.2], [114.6, 339.8], [173.9, 330.1], [67.2, 148.3],
  [81.9, 155.3], [47.8, 104.6], [101.8, 257.2], [67.0, 114.3],
];
const SEAWEED_EXTENTS = [
  [145.2, 212.8], [87.6, 215.0], [129.4, 304.5], [138.5, 350.2], [65.6, 173.7], [54.5, 144.5], [40.0, 112.6],
];

// optional 4th value per LAYOUT entry: -1 mirrors the shape left/right in
// place (around its own ground point), 1 or omitted draws it normal
const CORAL_POSITIONS = CORAL_XYS.map(([x, y, s, flip], i) => ({
  x, y, s, flip: flip ?? 1, centerX: CORAL_EXTENTS[i][0], bottomY: CORAL_EXTENTS[i][1],
}));
const SEAWEED_POSITIONS = SEAWEED_XYS.map(([x, y, s, flip], i) => ({
  x, y, s, flip: flip ?? 1, centerX: SEAWEED_EXTENTS[i][0], bottomY: SEAWEED_EXTENTS[i][1],
}));

// How much bigger/smaller a plant can randomly get compared to its original size.
const PLANT_SCALE_RANGE = [0.85, 1.2];

let coralPlan = []; // [{ fn, x, y, s, hue }]
let seaweedPlan = []; // [{ fn, x, y, s, hue }]

function buildPlantPlan(positions, fns) {
  return positions.map((pos, i) => {
    const s = pos.s * random(PLANT_SCALE_RANGE[0], PLANT_SCALE_RANGE[1]);
    // the ground-contact point implied by the ORIGINAL design, at its ORIGINAL scale
    const groundX = pos.x + pos.centerX * pos.s;
    const groundY = pos.y + pos.bottomY * pos.s;
    return {
      fn: fns[i],
      // re-solve the origin so the shape's root still lands on that exact
      // same ground point at the NEW (random) scale
      x: groundX - pos.centerX * s,
      y: groundY - pos.bottomY * s,
      s,
      flip: pos.flip,
      hue: PLANT_HUES[floor(random(PLANT_HUES.length))],
      groundX,
      groundY,
      faded: false, // set true when hit by falling debris (see below)
      deathTime: null, // millis() at the moment it died, freezes its animation there
    };
  });
}

function randomizeCorals() {
  coralPlan = buildPlantPlan(CORAL_POSITIONS, CORAL_DRAW_FNS);
  seaweedPlan = buildPlantPlan(SEAWEED_POSITIONS, SEAWEED_DRAW_FNS);
}

// index of drawCoral5 within CORAL_DRAW_FNS/coralPlan — drawn separately in
// draw() so it can sit in a specific spot in the rock layer stack instead of
// always drawing after every rock
const CORAL5_PLAN_INDEX = CORAL_DRAW_FNS.indexOf(drawCoral5);
// same idea for drawCoral3 — drawn behind the rock6 trio, see draw()
const CORAL3_PLAN_INDEX = CORAL_DRAW_FNS.indexOf(drawCoral3);

function drawCoralPlanEntry(p) {
  plantHueOverride = p.faded ? "gray" : p.hue;
  // dead corals get their own recorded death time passed straight in, so
  // their sway animation reads that fixed value forever instead of the
  // live clock — no more animation once it dies
  if (p.flip === -1) {
    push();
    translate(2 * p.groundX, 0);
    scale(-1, 1); // mirrors the shape left/right in place, around its own ground point
    p.fn(p.x, p.y, p.s, p.faded ? p.deathTime : null);
    pop();
  } else {
    p.fn(p.x, p.y, p.s, p.faded ? p.deathTime : null);
  }
  plantHueOverride = null;
}

function drawCoralByIndex(i) {
  const p = coralPlan[i];
  if (p) drawCoralPlanEntry(p);
}

function drawCorals(skipIndices = []) {
  coralPlan.forEach((p, i) => {
    if (skipIndices.includes(i)) return;
    drawCoralPlanEntry(p);
  });
}

// index of drawSeaweed5 within SEAWEED_DRAW_FNS/seaweedPlan — drawn
// separately in draw() so it can sit in a specific spot in the rock layer
// stack instead of always drawing after every rock (see draw())
const SEAWEED5_PLAN_INDEX = SEAWEED_DRAW_FNS.indexOf(drawSeaweed5);

function drawSeaweedPlanEntry(p, i, frozenTime) {
  plantHueOverride = p.hue;
  if (p.flip === -1) push(), translate(2 * p.groundX, 0), scale(-1, 1);

  // seaweed1 has its own built-in rotation param (see below); every other
  // seaweed can get a "seaweedNRotation" (degrees) entry in LAYOUT instead,
  // which spins it around its own ground point from the outside
  const rotationDeg = i !== 0 ? LAYOUT[`seaweed${i + 1}Rotation`] : null;
  if (rotationDeg) {
    push();
    translate(p.groundX, p.groundY);
    rotate(radians(rotationDeg));
    translate(-p.groundX, -p.groundY);
  }

  if (i === 0) {
    p.fn(p.x, p.y, p.s, radians(LAYOUT.seaweed1Rotation), frozenTime); // drawSeaweed1 has an extra rotation param before frozenTime
  } else {
    p.fn(p.x, p.y, p.s, frozenTime);
  }

  if (rotationDeg) pop();
  if (p.flip === -1) pop();
  plantHueOverride = null;
}

function drawSeaweedByIndex(i, frozenTime = null) {
  const p = seaweedPlan[i];
  if (p) drawSeaweedPlanEntry(p, i, frozenTime);
}

function drawSeaweeds(frozenTime = null, skipIndices = []) {
  seaweedPlan.forEach((p, i) => {
    if (skipIndices.includes(i)) return;
    drawSeaweedPlanEntry(p, i, frozenTime);
  });
}

// SEAWEED MOVEMENT SYSTEM

let currentStrength = 16;
let currentBendPower = 1.9;

let currentWave1 = 0.045;
let currentWave2 = 0.072;

let currentSecondStrength = 2.2;
let currentSecondSpeed = 0.53;

let currentPhaseMultiplier = 1.4;

function setSeaweedMovement(strength, bendPower, wave1, wave2, secondStrength, secondSpeed, phaseMultiplier) {
  currentStrength = strength;
  currentBendPower = bendPower;

  currentWave1 = wave1;
  currentWave2 = wave2;

  currentSecondStrength = secondStrength;
  currentSecondSpeed = secondSpeed;

  currentPhaseMultiplier = phaseMultiplier;
}

function bendAmount(px, py, time, phase = 0, height = 220) {
  let normalizedHeight =
    constrain((height - py) / height, 0, 1);

  let falloff =
    pow(normalizedHeight, currentBendPower);

  let mainWave =
    sin(time + py * currentWave1 + phase);

  let secondWave =
    sin(time * currentSecondSpeed + py * currentWave2 + phase * currentPhaseMultiplier);

  return (mainWave * currentStrength + secondWave * currentSecondStrength) * falloff;
}

function vtx(x, y, time, phase) {
  let bend =
    bendAmount(x, y, time, phase);

  vertex(x + bend, y);
}

function bz(x1, y1, x2, y2, x3, y3, time, phase) {
  let b1 =
    bendAmount(x1, y1, time, phase);

  let b2 =
    bendAmount(x2, y2, time, phase);

  let b3 =
    bendAmount(x3, y3, time, phase);

  bezierVertex(x1 + b1, y1, x2 + b2, y2, x3 + b3, y3);
}

// SEAWEED 1

function drawSeaweed1(x, y, s = 1, rotation = 0, frozenTime = null) {
  push();

  translate(x, y);
  rotate(rotation);
  scale(s);

  noStroke();

  // MOVEMENT SEAWEED 1

  setSeaweedMovement(18, 1.65, 0.032, 0.055, 3, 0.42, 1.25);

  // SPEED SEAWEED 1
  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 2;

  // PATH 1

  setGradientFill(181.269, 117.136, 110.742, 216.358, [[0, "#BFF4B8"], [1, "#8FEC83"]]);

  beginShape();

  vtx(67.95, 176.238, time, 0);
  bz(75.437, 168.301, 84.576, 158.626, 101.942, 153.006, time, 0);
  bz(117.603, 147.943, 114.998, 153.867, 119.87, 154.191, time, 0);
  bz(129.15, 154.81, 138.018, 163.124, 146.951, 161.979, time, 0);
  bz(157.418, 160.634, 169.981, 145.58, 179.401, 143.05, time, 0);
  bz(182.68, 142.17, 185.353, 140.997, 205.263, 144.245, time, 0);
  bz(215.317, 145.886, 229.656, 148.852, 229.263, 152.257, time, 0);
  bz(228.894, 155.432, 219.705, 151.218, 206.948, 154.548, time, 0);
  bz(197.12, 157.105, 189.365, 161.786, 184.395, 164.777, time, 0);
  bz(174.92, 170.487, 176.067, 171.673, 170.403, 174.162, time, 0);
  bz(160.975, 178.305, 148.373, 188.852, 138.631, 187.918, time, 0);
  bz(123.303, 186.45, 124.405, 186.427, 114.609, 186.532, time, 0);
  bz(105.976, 186.623, 96.533, 191.545, 86.123, 184.295, time, 0);
  bz(68.701, 172.167, 64.403, 183.895, 63.99, 183.109, time, 0);
  bz(63.211, 181.636, 65.288, 179.057, 67.95, 176.238, time, 0);

  endShape(CLOSE);

  // PATH 2

  setGradientFill(190.515, 66.632, 90.735, 206.992, [[0, "#E3FAE0"], [1, "#BFF4B8"]]);

  beginShape();

  vtx(64.649, 187.074, time, 1.3);
  bz(65.563, 184.145, 75.507, 185.328, 86.529, 176.626, time, 1.3);
  bz(92.692, 171.759, 101.122, 173.559, 107.643, 169.611, time, 1.3);
  bz(114.376, 165.531, 118.279, 169.61, 129.79, 166.361, time, 1.3);
  bz(133.236, 165.386, 140.862, 163.146, 146.624, 156.841, time, 1.3);
  bz(147.661, 155.711, 149.21, 153.816, 154.367, 141.285, time, 1.3);
  bz(160.641, 126.038, 160.233, 124.265, 163.603, 121.091, time, 1.3);
  bz(169.451, 115.587, 173.604, 118.198, 178.566, 112.629, time, 1.3);
  bz(182.77, 107.919, 180.463, 105.316, 184.7, 95.457, time, 1.3);
  bz(186.826, 90.529, 191.111, 80.541, 199.609, 78.17, time, 1.3);
  bz(202.997, 77.228, 206.869, 77.541, 207.218, 78.714, time, 1.3);
  bz(207.807, 80.702, 197.53, 82.392, 193.999, 89.349, time, 1.3);
  bz(189.963, 97.294, 198.821, 104.062, 197.628, 113.864, time, 1.3);
  bz(196.491, 123.227, 184.985, 129.949, 174.868, 136.644, time, 1.3);
  bz(169.03, 140.501, 167.569, 140.5, 164.78, 143.618, time, 1.3);
  bz(158.097, 151.078, 161.207, 156.974, 156.392, 165.439, time, 1.3);
  bz(149.775, 177.052, 135.42, 180.855, 133.488, 181.347, time, 1.3);
  bz(121.349, 184.396, 118.564, 178.236, 108.01, 181.634, time, 1.3);
  bz(96.044, 185.479, 95.163, 194.822, 85.072, 195.875, time, 1.3);
  bz(75.834, 196.841, 63.978, 189.254, 64.649, 187.074, time, 1.3);

  endShape(CLOSE);

  // PATH 3

  setGradientFill(105.425, 123.835, 55.617, 193.896, [[0, "#BFF4B8"], [1, "#8FEC83"]]);

  beginShape();

  vtx(64.587, 173.508, time, 2.1);
  bz(65.684, 167.848, 67.329, 159.682, 72.693, 149.48, time, 2.1);
  bz(75.515, 144.101, 79.248, 137.166, 86.61, 130.489, time, 2.1);
  bz(92.615, 125.043, 114.46, 103.89, 104.692, 117.387, time, 2.1);
  bz(102.72, 120.109, 103.575, 129.082, 99.312, 132.943, time, 2.1);
  bz(96.171, 135.783, 92.303, 138.254, 89.571, 141.26, time, 2.1);
  bz(86.563, 144.558, 89.138, 148.673, 89.686, 150.685, time, 2.1);
  bz(91.313, 156.696, 91.703, 160.314, 90.93, 166.493, time, 2.1);
  bz(90.388, 170.865, 84.582, 171.521, 76.282, 179.555, time, 2.1);
  bz(69.827, 185.799, 66.427, 189.036, 64.47, 188.126, time, 2.1);
  bz(61.982, 186.974, 63.367, 179.838, 64.587, 173.508, time, 2.1);

  endShape(CLOSE);

  // PATH 4

  setGradientFill(160.246, 72.323, 72.028, 196.429, [[0, "#E3FAE0"], [0.529479, "#BFF4B8"]]);

  beginShape();

  vtx(61.898, 180.091, time, 3);
  bz(64.215, 170.763, 81.167, 163.838, 97.137, 148.566, time, 3);
  bz(99.458, 146.347, 103.686, 142.235, 107.132, 135.745, time, 3);
  bz(113.795, 123.178, 109.768, 116.339, 115.433, 107.858, time, 3);
  bz(118.676, 103.012, 125.091, 100.279, 137.784, 95.003, time, 3);
  bz(156.406, 87.269, 174.702, 80.24, 175.812, 83.621, time, 3);
  bz(176.922, 87.002, 167.262, 86.86, 156.393, 95.441, time, 3);
  bz(152.084, 98.841, 144.499, 104.829, 139.262, 114.619, time, 3);
  bz(134.095, 124.28, 137.038, 126.749, 131.296, 138.523, time, 3);
  bz(129.052, 143.133, 125.815, 149.618, 119.433, 155.356, time, 3);
  bz(112.827, 161.3, 109.405, 160.518, 97.59, 166.441, time, 3);
  bz(78.543, 175.989, 74.483, 196.167, 68.362, 193.66, time, 3);
  bz(64.527, 192.092, 60.772, 184.59, 61.898, 180.091, time, 3);

  endShape(CLOSE);

  // PATH 5

  setGradientFill(152.957, 155.625, 99.04, 231.474, [[0, "#EBFBE9"], [1, "#BFF4B8"]]);

  beginShape();

  vtx(81.451, 182.678, time, 4.1);
  bz(91.551, 182.617, 100.317, 182.563, 110.453, 186.162, time, 4.1);
  bz(120.602, 189.766, 120.393, 192.873, 128.552, 194.476, time, 4.1);
  bz(137.577, 196.246, 145.196, 193.897, 151.035, 192.09, time, 4.1);
  bz(165.986, 187.474, 164.343, 183.964, 178.862, 180.463, time, 4.1);
  bz(185.355, 178.898, 193.307, 181.468, 200.761, 178.204, time, 4.1);
  bz(223.049, 168.419, 178.34, 201.392, 157.529, 207.397, time, 4.1);
  bz(154.401, 208.305, 137.02, 212.789, 120.305, 206.105, time, 4.1);
  bz(114.508, 203.789, 110.494, 200.804, 96.794, 194.951, time, 4.1);
  bz(91.286, 192.596, 86.278, 197.207, 78.124, 195.918, time, 4.1);
  bz(66.207, 194.028, 64.208, 187.684, 63.981, 186.624, time, 4.1);
  bz(62.574, 180.035, 75.118, 182.715, 81.451, 182.678, time, 4.1);

  endShape(CLOSE);

  pop();
}

// SEAWEED 2

function drawSeaweed2(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  // MOVEMENT SEAWEED 2

  setSeaweedMovement(10, 2.15, 0.06, 0.095, 1.8, 0.68, 1.7);

  // SPEED SEAWEED 2
  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001;

  // PATH 1

  setGradientFill(72.7574, 59.1534, 129.156, 183.568, [[0, "#5ED9CD"], [0.38, "#5BD7CB"], [0.62, "#53D3C7"], [0.81, "#44CCBF"], [0.98, "#30C3B5"], [1, "#2EC2B4"]]);

  beginShape();

  vtx(66.463, 202.243, time, 0);
  bz(63.057, 190.473, 58.911, 176.113, 63.134, 156.159, time, 0);
  bz(66.948, 138.168, 71.13, 144.08, 74.117, 139.574, time, 0);
  bz(79.806, 130.992, 92.564, 127.229, 96.391, 117.967, time, 0);
  bz(100.873, 107.114, 93.511, 86.366, 96.293, 75.84, time, 0);
  bz(97.262, 72.177, 97.621, 68.929, 111.648, 51.62, time, 0);
  bz(118.732, 42.88, 129.429, 30.776, 132.44, 33.109, time, 0);
  bz(135.247, 35.29, 126.2, 41.718, 122.341, 55.917, time, 0);
  bz(119.36, 66.851, 119.532, 77.009, 119.635, 83.514, time, 0);
  bz(119.836, 95.92, 121.591, 95.496, 120.836, 102.381, time, 0);
  bz(119.578, 113.841, 122.645, 132.036, 116.402, 140.883, time, 0);
  bz(106.583, 154.801, 107.167, 153.727, 101.878, 163.221, time, 0);
  bz(97.218, 171.588, 96.69, 183.51, 84.094, 189.371, time, 0);
  bz(63.017, 199.181, 71.77, 210.058, 70.798, 210.004, time, 0);
  bz(68.974, 209.909, 67.671, 206.427, 66.463, 202.243, time, 0);

  endShape(CLOSE);

  // PATH 2

  setGradientFill(29.9699, 21.234, 109.745, 197.242, [[0, "#98E7DF"], [1, "#5ED9CD"]]);

  beginShape();

  vtx(74.919, 211.648, time, 1.3);
  bz(72.645, 209.084, 79.234, 200.188, 77.047, 184.573, time, 1.3);
  bz(75.823, 175.841, 82.166, 168.757, 82.009, 160.209, time, 1.3);
  bz(81.845, 151.38, 87.857, 149.964, 91.108, 137.013, time, 1.3);
  bz(92.079, 133.134, 94.149, 124.502, 91.341, 115.331, time, 1.3);
  bz(90.84, 113.683, 89.896, 111.102, 80.854, 98.936, time, 1.3);
  bz(69.852, 84.134, 67.947, 83.509, 66.791, 78.44, time, 1.3);
  bz(64.79, 69.645, 69.549, 67.147, 66.999, 59.167, time, 1.3);
  bz(64.846, 52.413, 61.11, 53.14, 54.095, 43.394, time, 1.3);
  bz(50.593, 38.516, 43.482, 28.651, 45.908, 19.104, time, 1.3);
  bz(46.878, 15.301, 49.304, 11.751, 50.607, 12.089, time, 1.3);
  bz(52.816, 12.664, 48.766, 23.532, 53.419, 30.93, time, 1.3);
  bz(58.73, 39.382, 70.017, 34.738, 78.652, 41.519, time, 1.3);
  bz(86.902, 47.994, 86.946, 62.936, 87.729, 76.526, time, 1.3);
  bz(88.174, 84.364, 87.37, 85.771, 88.791, 90.248, time, 1.3);
  bz(92.187, 100.97, 99.487, 101.362, 104.862, 110.863, time, 1.3);
  bz(112.231, 123.907, 107.942, 139.917, 107.346, 142.06, time, 1.3);
  bz(103.561, 155.503, 96.19, 154.646, 93.607, 166.762, time, 1.3);
  bz(90.672, 180.495, 99.043, 186.712, 94.492, 197.035, time, 1.3);
  bz(90.327, 206.487, 76.616, 213.546, 74.919, 211.648, time, 1.3);

  endShape(CLOSE);

  // PATH 3

  setGradientFill(37.3989, 136.045, 77.2178, 223.903, [[0, "#98E7DF"], [1, "#5ED9CD"]]);

  beginShape();

  vtx(62.026, 203.913, time, 2.2);
  bz(57.265, 199.605, 50.428, 193.33, 43.708, 182.302, time, 2.2);
  bz(40.162, 176.494, 35.641, 168.915, 33.36, 157.989, time, 2.2);
  bz(31.5, 149.077, 23.462, 115.886, 30.884, 133.047, time, 2.2);
  bz(32.381, 136.51, 41.356, 140.842, 42.671, 147.166, time, 2.2);
  bz(43.636, 151.822, 43.851, 156.967, 45.198, 161.325, time, 2.2);
  bz(46.669, 166.116, 51.986, 166.001, 54.195, 166.63, time, 2.2);
  bz(60.787, 168.516, 64.431, 170.219, 69.862, 174.513, time, 2.2);
  bz(73.709, 177.547, 71.138, 183.516, 74.189, 196.125, time, 2.2);
  bz(76.558, 205.928, 77.756, 211.062, 75.818, 212.424, time, 2.2);
  bz(73.358, 214.159, 67.355, 208.725, 62.026, 203.913, time, 2.2);

  endShape(CLOSE);

  // PATH 4

  setGradientFill(18.7192, 53.6556, 89.2601, 209.274, [[0, "#C9F2EE"], [0.03, "#C4F1EC"], [0.19, "#B0ECE6"], [0.38, "#A2E9E2"], [0.61, "#9AE7DF"], [1, "#98E7DF"]]);

  beginShape();

  vtx(66.787, 210.285, time, 3.1);
  bz(59.219, 202.695, 61.977, 182.391, 56.284, 158.236, time, 3.1);
  bz(55.457, 154.726, 53.884, 148.291, 49.628, 141.244, time, 3.1);
  bz(41.379, 127.607, 32.682, 127.556, 27.759, 117.228, time, 3.1);
  bz(24.948, 111.321, 25.885, 103.573, 27.865, 88.317, time, 3.1);
  bz(30.774, 65.94, 34.173, 44.282, 37.989, 45.155, time, 3.1);
  bz(41.804, 46.028, 36.356, 55.25, 38.514, 70.648, time, 3.1);
  bz(39.366, 76.751, 40.871, 87.496, 47.271, 98.164, time, 3.1);
  bz(53.587, 108.69, 57.546, 107.274, 65.549, 119.569, time, 3.1);
  bz(68.684, 124.379, 73.051, 131.222, 74.981, 140.664, time, 3.1);
  bz(76.982, 150.442, 74.359, 153.287, 73.476, 168.069, time, 3.1);
  bz(72.052, 191.899, 88.945, 207.401, 83.204, 211.856, time, 3.1);
  bz(79.608, 214.648, 70.432, 213.955, 66.787, 210.285, time, 3.1);

  endShape(CLOSE);

  // PATH 5

  setGradientFill(94.4625, 109.422, 137.574, 204.532, [[0, "#C9F2EE"], [1, "#98E7DF"]]);

  beginShape();

  vtx(80.783, 193.83, time, 4.2);
  bz(86.279, 184.068, 91.049, 175.594, 100.035, 167.901, time, 4.2);
  bz(109.031, 160.197, 111.862, 162.183, 117.868, 155.247, time, 4.2);
  bz(124.509, 147.572, 126.472, 138.884, 127.97, 132.223, time, 4.2);
  bz(131.816, 115.172, 127.585, 114.738, 132.252, 98.744, time, 4.2);
  bz(134.339, 91.592, 141.147, 85.41, 142.152, 76.356, time, 4.2);
  bz(145.134, 49.269, 151.803, 111.271, 146.051, 134.763, time, 4.2);
  bz(145.191, 138.297, 139.884, 157.612, 124.356, 169.87, time, 4.2);
  bz(118.972, 174.123, 113.936, 176.273, 100.854, 186.105, time, 4.2);
  bz(95.593, 190.056, 97.209, 197.529, 91.503, 204.641, time, 4.2);
  bz(83.159, 215.032, 76.046, 213.313, 74.916, 212.923, time, 4.2);
  bz(67.898, 210.492, 77.335, 199.951, 80.783, 193.83, time, 4.2);

  endShape(CLOSE);

  pop();
}

// SEAWEED 3

function drawSeaweed3(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  // MOVEMENT SEAWEED 3

  setSeaweedMovement(14, 2.6, 0.022, 0.045, 2.8, 0.37, 1.15);

  // SPEED SEAWEED 3
  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 3;

  // PATH 1

  setGradientFill(120.841, 81.833, 159.612, 276.666, [[0, "#BFF4B8"], [1, "#8FEC83"]]);

  beginShape();

  vtx(64.069, 282.518, time, 0);
  bz(63.035, 264.743, 61.787, 243.06, 74.567, 216.155, time, 0);
  bz(86.099, 191.898, 90.212, 201.624, 96.054, 196.205, time, 0);
  bz(107.181, 185.884, 126.98, 184.672, 135.626, 172.787, time, 0);
  bz(145.754, 158.858, 141.957, 127.087, 149.505, 113.073, time, 0);
  bz(152.132, 108.196, 153.735, 103.71, 179.888, 83.718, time, 0);
  bz(193.096, 73.623, 212.676, 59.929, 216.276, 64.207, time, 0);
  bz(219.632, 68.203, 204.339, 74.388, 194.004, 93.258, time, 0);
  bz(186.031, 107.786, 182.9, 122.232, 180.884, 131.482, time, 0);
  bz(177.049, 149.122, 179.741, 149.088, 176.352, 158.598, time, 0);
  bz(170.709, 174.429, 169.113, 201.196, 157.093, 211.713, time, 0);
  bz(138.185, 228.261, 139.391, 226.928, 128.543, 238.671, time, 0);
  bz(118.984, 249.019, 114.248, 265.739, 93.985, 269.974, time, 0);
  bz(60.079, 277.067, 69.184, 295.303, 67.79, 294.913, time, 0);
  bz(65.168, 294.189, 64.434, 288.835, 64.069, 282.518, time, 0);

  endShape(CLOSE);

  // PATH 2

  setGradientFill(71.256, 14.296, 126.088, 289.921, [[0, "#E3FAE0"], [1, "#BFF4B8"]]);

  beginShape();

  vtx(73.233, 298.572, time, 1.3);
  bz(70.78, 294.206, 83.321, 283.73, 85.337, 260.903, time, 1.3);
  bz(86.464, 248.136, 98.043, 240.148, 100.66, 227.987, time, 1.3);
  bz(103.36, 215.426, 112.57, 215.362, 121.607, 198.063, time, 1.3);
  bz(124.31, 192.881, 130.192, 181.32, 129.163, 167.421, time, 1.3);
  bz(128.983, 164.925, 128.469, 160.963, 119.372, 140.808, time, 1.3);
  bz(108.304, 116.286, 105.742, 114.784, 105.749, 107.23, time, 1.3);
  bz(105.766, 94.124, 113.517, 92.121, 112.465, 79.993, time, 1.3);
  bz(111.583, 69.729, 105.91, 69.552, 98.955, 53.481, time, 1.3);
  bz(95.487, 45.439, 88.432, 29.167, 95.136, 16.425, time, 1.3);
  bz(97.812, 11.35, 102.52, 7.104, 104.303, 8.004, time, 1.3);
  bz(107.323, 9.531, 97.818, 23.622, 102.12, 35.604, time, 1.3);
  bz(107.029, 49.293, 124.982, 46.359, 135.28, 58.754, time, 1.3);
  bz(145.119, 70.59, 140.21, 91.774, 136.826, 111.279, time, 1.3);
  bz(134.864, 122.527, 133.227, 124.261, 133.803, 131.063, time, 1.3);
  bz(135.172, 147.35, 145.654, 150.262, 150.307, 165.458, time, 1.3);
  bz(156.678, 186.317, 145.115, 207.613, 143.535, 210.457, time, 1.3);
  bz(133.558, 228.28, 123.128, 224.686, 115.341, 241.017, time, 1.3);
  bz(106.503, 259.525, 116.604, 271.035, 106.551, 284.19, time, 1.3);
  bz(97.351, 296.236, 75.069, 301.81, 73.233, 298.572, time, 1.3);

  endShape(CLOSE);

  // PATH 3

  setGradientFill(43.847, 179.35, 71.214, 316.932, [[0, "#BFF4B8"], [1, "#8FEC83"]]);

  beginShape();

  vtx(57.063, 283.452, time, 2.2);
  bz(51.574, 275.811, 43.724, 264.713, 37.624, 246.92, time, 2.2);
  bz(34.401, 237.547, 30.351, 225.349, 30.671, 209.133, time, 2.2);
  bz(30.934, 195.907, 30.295, 146.289, 35.373, 172.999, time, 2.2);
  bz(36.397, 178.388, 48.003, 187.423, 47.81, 196.807, time, 2.2);
  bz(47.664, 203.715, 46.264, 211.074, 46.771, 217.683, time, 2.2);
  bz(47.316, 224.946, 55.085, 226.499, 58.086, 228.103, time, 2.2);
  bz(67.041, 232.903, 71.773, 236.493, 78.24, 244.33, time, 2.2);
  bz(82.822, 249.87, 77.098, 257.496, 77.338, 276.345, time, 2.2);
  bz(77.519, 290.999, 77.552, 298.659, 74.281, 299.963, time, 2.2);
  bz(70.127, 301.626, 63.209, 291.989, 57.063, 283.452, time, 2.2);

  endShape(CLOSE);

  // PATH 4

  setGradientFill(44.11, 56.595, 92.599, 300.292, [[0, "#E3FAE0"], [0.529479, "#BFF4B8"]]);

  beginShape();

  vtx(61.864, 294.016, time, 3.1);
  bz(53.388, 280.819, 64.154, 252.944, 63.917, 216.885, time, 3.1);
  bz(63.883, 211.646, 63.738, 202.022, 59.895, 190.664, time, 3.1);
  bz(52.442, 168.68, 39.815, 165.8, 36.094, 149.579, time, 3.1);
  bz(33.975, 140.302, 37.915, 129.628, 45.87, 108.654, time, 3.1);
  bz(57.547, 77.892, 69.697, 48.305, 74.953, 50.774, time, 3.1);
  bz(80.209, 53.243, 69.22, 64.549, 67.232, 87.06, time, 3.1);
  bz(66.44, 95.981, 65.052, 111.69, 70.807, 128.87, time, 3.1);
  bz(76.485, 145.822, 82.711, 145.095, 90.255, 165.097, time, 3.1);
  bz(93.212, 172.923, 97.284, 184.028, 96.947, 198.028, time, 3.1);
  bz(96.602, 212.527, 91.841, 215.711, 85.638, 236.367, time, 3.1);
  bz(75.638, 269.668, 95.038, 297.085, 85.208, 301.542, time, 3.1);
  bz(79.051, 304.336, 65.942, 300.392, 61.864, 294.016, time, 3.1);

  endShape(CLOSE);

  // PATH 5

  setGradientFill(134.812, 158.542, 164.446, 307.484, [[0, "#EBFBE9"], [1, "#BFF4B8"]]);

  beginShape();

  vtx(86.834, 273.706, time, 4.2);
  bz(98.073, 261.651, 107.827, 251.187, 123.451, 243.19, time, 4.2);
  bz(139.094, 235.18, 142.549, 238.908, 153.589, 231.02, time, 4.2);
  bz(165.798, 222.291, 171.542, 210.618, 175.937, 201.665, time, 4.2);
  bz(187.203, 178.75, 181.197, 176.768, 193.305, 155.616, time, 4.2);
  bz(198.719, 146.158, 210.674, 139.598, 215.149, 127.095, time, 4.2);
  bz(228.499, 89.684, 217.559, 179.677, 201.378, 211.1, time, 4.2);
  bz(198.952, 215.83, 184.808, 241.48, 158.154, 253.832, time, 4.2);
  bz(148.912, 258.119, 140.875, 259.539, 118.584, 269.243, time, 4.2);
  bz(109.62, 273.143, 109.483, 284.251, 98.821, 292.485, time, 4.2);
  bz(83.231, 304.511, 73.463, 299.779, 71.95, 298.861, time, 4.2);
  bz(62.556, 293.151, 79.784, 281.265, 86.834, 273.706, time, 4.2);

  endShape(CLOSE);

  pop();
}

// CORAL 1

function drawCoral1(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  // MOVEMENT CORAL 1

  setSeaweedMovement(
    11,     // strength
    2.3,    // bendPower
    0.055,  // wave 1
    0.085,  // wave 2
    2.5,    // second wave strength
    0.6,    // second wave speed
    1.6     // phase multiplier
  );

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 2.5;

  // PATH 1

  setGradientFill(98.1682, 43.7754, 120.891, 76.0423, [[0.357401, "#98E7DF"], [1, "#2EC2B4"]]);

  beginShape();

  vtx(133.774, 58.2213, time, 0);
  bz(125.191, 59.4186, 121.049, 67.0309, 120.05, 70.6874, time, 0);
  bz(119.252, 72.5323, 112.266, 76.5217, 90.7076, 77.72, time, 0);
  bz(69.1496, 78.9183, 81.4925, 63.228, 90.3586, 55.2331, time, 0);
  bz(107.575, 40.7722, 118.504, 42.8655, 130.181, 42.2164, time, 0);
  bz(141.858, 41.5674, 144.503, 56.7247, 133.774, 58.2213, time, 0);

  endShape(CLOSE);

  // PATH 2

  setGradientFill(3.92139, 78.2018, 50.3823, 69.551, [[0, "#A6EAE3"], [0.701923, "#79DFD5"]]);

  beginShape();

  vtx(18.4761, 61.6309, time, 0.8);
  bz(32.5704, 56.4099, 43.1447, 63.3413, 46.67, 67.4597, time, 0.8);
  bz(48.1212, 72.0015, 49.5723, 76.5433, 51.0235, 81.0851, time, 0.8);
  vtx(35.1982, 87.5117, time, 0.8);
  bz(33.1836, 83.6175, 27.0958, 77.6077, 18.8606, 84.7218, time, 0.8);
  bz(10.6253, 91.836, 5.80083, 86.9886, 4.41799, 83.6757, time, 0.8);
  bz(3.23142, 78.5028, 4.38186, 66.8519, 18.4761, 61.6309, time, 0.8);

  endShape(CLOSE);

  // ====================================================
// PATH 3
// ====================================================

setSeaweedMovement(
  4.5,    // strength 
  2.4,    // bendPower
  0.04,   // wave 1
  0.06,   // wave 2
  0.8,    // second wave strength
  0.5,    // second wave speed
  1.3     // phase multiplier
);

setGradientFill(30.2184, 20.4688, 56.9892, 43.6418, [[0, "#98E7DF"], [1, "#2EC2B4"]]);

beginShape();

vtx(31.2904, 26.1534, time, 1.5);
bz(29.5396, 34.1969, 33.2875, 45.6069, 35.3804, 50.3065, time, 1.5);
vtx(46.8366, 58.6995, time, 1.5);
vtx(54.7532, 52.8416, time, 1.5);
vtx(56.6915, 38.2861, time, 1.5);
bz(55.6952, 36.8366, 53.7949, 32.3069, 54.165, 25.7849, time, 1.5);
bz(54.6277, 17.6323, 56.8162, 7.57792, 48.4492, 5.33407, time, 1.5);
bz(40.0822, 3.09022, 33.4789, 16.099, 31.2904, 26.1534, time, 1.5);

endShape(CLOSE);

  // PATH 4

  setGradientFill(9.22519, 28.8487, 54.2878, 67.4268, [[0, "#A6EAE3"], [0.296551, "#79DFD5"]]);

  beginShape();

  vtx(10.1133, 39.5133, time, 2.2);
  bz(8.71005, 53.264, 19.3965, 60.2859, 24.9151, 62.078, time, 2.2);
  vtx(52.6245, 73.131, time, 2.2);
  bz(53.1915, 72.4999, 56.438, 67.2927, 51.6276, 55.1961, time, 2.2);
  bz(49.5277, 49.9157, 43.8762, 45.7322, 37.5236, 45.1858, time, 2.2);
  bz(35.7086, 45.0297, 31.4612, 41.154, 30.872, 39.2589, time, 2.2);
  bz(29.7722, 35.722, 31.8254, 23.9141, 22.7219, 22.6211, time, 2.2);
  bz(15.4689, 22.1248, 11.5166, 25.7626, 10.1133, 39.5133, time, 2.2);

  endShape(CLOSE);

  // PATH 5

  setGradientFill(112.778, 67.1049, 128.418, 89.0358, [[0, "#A6EAE3"], [0.721154, "#79DFD5"]]);

  beginShape();

  vtx(122.599, 66.6091, time, 3);
  bz(111.88, 66.4466, 102.538, 74.9917, 99.2063, 79.2845, time, 3);
  vtx(105.175, 90.3278, time, 3);
  bz(109.187, 87.577, 119.933, 82.872, 130.82, 86.0585, time, 3);
  bz(144.428, 90.0417, 142.124, 80.6906, 142.019, 78.8006, time, 3);
  bz(141.913, 76.9106, 135.997, 66.8123, 122.599, 66.6091, time, 3);

  endShape(CLOSE);

  // PATH 6

  setGradientFill(87.1344, 17.6277, 122.535, 74.2719, [[0, "#98E7DF"], [0.615385, "#5ED9CD"]]);

  beginShape();

  vtx(123.861, 28.0541, time, 3.7);
  bz(113.45, 19.1505, 89.0931, 34.4319, 78.2157, 43.1856, time, 3.7);
  vtx(78.3443, 72.4078, time, 3.7);
  bz(87.5632, 74.6837, 105.8, 77.6592, 104.996, 71.3549, time, 3.7);
  bz(103.991, 63.4746, 109.22, 51.1811, 110.935, 48.956, time, 3.7);
  bz(112.65, 46.7309, 136.874, 39.1837, 123.861, 28.0541, time, 3.7);

  endShape(CLOSE);

  // PATH 7

  setGradientFill(66.2344, 30.9088, 88.3599, 77.18, [[0, "#98E7DF"], [0.264423, "#5ED9CD"]]);

  beginShape();

  vtx(94.1536, 18.9347, time, 4.4);
  bz(85.5284, 11.3491, 72.5804, 22.282, 67.1845, 28.6967, time, 4.4);
  vtx(52.8051, 69.0925, time, 4.4);
  vtx(67.0178, 75.1969, time, 4.4);
  bz(73.7642, 74.8604, 86.9748, 71.1553, 85.846, 59.0276, time, 4.4);
  bz(84.435, 43.8678, 88.7893, 36.0355, 89.4929, 34.3973, time, 4.4);
  bz(90.1966, 32.759, 104.935, 28.4166, 94.1536, 18.9347, time, 4.4);

  endShape(CLOSE);

  // PATH 8

  setGradientFill(43.2752, 38.2052, 83.0062, 77.3815, [[0, "#A6EAE3"], [0.375, "#79DFD5"]]);

  beginShape();

  vtx(47.9293, 47.2219, time, 5.1);
  bz(54.8643, 26.6855, 69.1963, 28.0479, 75.4954, 31.2961, time, 5.1);
  bz(81.2843, 36.3719, 75.9939, 40.2643, 73.2987, 41.3138, time, 5.1);
  bz(70.6036, 42.3632, 68.5069, 54.1744, 76.941, 57.304, time, 5.1);
  bz(83.6883, 59.8076, 83.2225, 76.7458, 82.1461, 84.902, time, 5.1);
  vtx(75.6916, 84.3612, time, 5.1);
  vtx(54.6477, 85.5309, time, 5.1);
  bz(41.4325, 85.5458, 44.6624, 59.9978, 47.9293, 47.2219, time, 5.1);

  endShape(CLOSE);

  // PATH 9

  setGradientFill(100.113, 146.271, 37.0221, 64.67, [[0, "#F4B1BC"], [0.721154, "#F8D2D9"]]);

  beginShape();

  vertex(37.1077, 144.406);
  bezierVertex(-10.1429, 134.843, 17.9042, 88.4729, 37.8483, 73.2817);
  bezierVertex(57.7923, 58.0905, 82.7881, 61.395, 100.17, 72.4997);
  bezierVertex(117.553, 83.6044, 143.924, 123.716, 113.32, 140.169);
  bezierVertex(106.821, 143.884, 91.3183, 146.842, 74.1741, 147.711);
  bezierVertex(62.5001, 148.302, 52.7068, 147.563, 37.1077, 144.406);

  endShape(CLOSE);

  // PATH 10

  setGradientFill(56.1062, 58.5334, 67.9371, 82.5612, [[0, "#A6EAE3"], [0.721154, "#79DFD5"]]);

  beginShape();

  vtx(43.8603, 80.9372, time, 5.8);
  bz(46.89, 96.6593, 65.0302, 84.8583, 73.7216, 76.9926, time, 5.8);
  bz(77.7957, 73.3055, 84.4352, 69.5656, 81.7827, 62.2647, time, 5.8);
  bz(79.1302, 54.9639, 65.195, 56.4859, 58.559, 58.1595, time, 5.8);
  bz(52.397, 59.2012, 40.8306, 65.2151, 43.8603, 80.9372, time, 5.8);

  endShape(CLOSE);

  pop();
}

// CORAL 2

function drawCoral2(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  // MOVEMENT

  setSeaweedMovement(
   17,     // strength
   3.1,    // bendPower
   0.036,  // wave 1
   0.07,   // wave 2
   3.2,    // second strength
   0.52,   // second speed
   1.5     // phase multiplier
  );

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 0.7;

  // PATH 1

  setGradientFill(111.319, 56.331, 142.637, 248.76, [[0, "#F3AAB6"], [0.35, "#F2A6B3"], [0.64, "#F09CAA"], [0.91, "#EE8B9B"], [1, "#ED8495"]]);

  beginShape();

  vtx(112.714, 57.537, time, 0);
  bz(107.946, 62.7121, 108.985, 80.1597, 109.705, 88.3218, time, 0);
  bz(110.431, 96.5722, 112.245, 96.8679, 112.029, 103.063, time, 0);
  bz(111.795, 109.77, 109.593, 111.688, 106.322, 122.341, time, 0);
  bz(105.235, 125.899, 102.868, 133.613, 102.223, 141.199, time, 0);
  bz(101.333, 151.643, 103.934, 158.69, 105.649, 165.405, time, 0);
  bz(112.55, 192.52, 105.905, 218.797, 102.606, 231.856, time, 0);
  bz(99.4306, 244.383, 91.7808, 252.36, 94.601, 255.23, time, 0);
  bz(97.5771, 258.249, 107.74, 252.205, 108.331, 251.846, time, 0);
  bz(126.196, 241.03, 122.969, 221.279, 140.291, 169.419, time, 0);
  bz(147.785, 146.981, 152.62, 138.032, 149.434, 124.622, time, 0);
  bz(147.196, 115.165, 142.457, 109.762, 144.522, 100.423, time, 0);
  bz(147.148, 88.51, 158.917, 80.4242, 157.898, 72.7081, time, 0);
  bz(156.693, 63.5399, 139.626, 64.7291, 136.75, 63.9637, time, 0);
  bz(132.316, 62.7715, 119.154, 50.5463, 112.694, 57.5483, time, 0);
  vtx(112.714, 57.537, time, 0);

  endShape(CLOSE);

  // PATH 2

  setGradientFill(133.468, 51.8357, 137.776, 78.2025, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(112.714, 57.537, time, 0.5);
  bz(113.735, 53.5803, 125.48, 53.3504, 130.922, 53.7889, time, 0.5);
  bz(134.36, 54.0653, 143.43, 54.9232, 150.944, 61.9414, time, 0.5);
  bz(151.951, 62.8776, 159.439, 69.8708, 157.659, 73.5166, time, 0.5);
  bz(155.632, 77.6584, 142.666, 75.2508, 135.194, 72.8832, time, 0.5);
  bz(124.56, 69.528, 111.558, 62.0055, 112.714, 57.537, time, 0.5);

  endShape(CLOSE);

  // PATH 3

  setGradientFill(79.7547, 113.475, 99.0025, 231.705, [[0, "#F8CED5"], [1, "#F3AAB6"]]);

  beginShape();

  vtx(39.9006, 96.8647, time, 1);
  bz(37.3967, 106.28, 38.0664, 124.807, 39.9973, 130.793, time, 1);
  bz(43.5511, 141.778, 50.0219, 148.487, 60.8445, 159.485, time, 1);
  bz(75.2573, 174.133, 77.0377, 171.556, 82.6771, 179.778, time, 1);
  bz(93.3932, 195.418, 93.0968, 213.66, 92.9297, 218.731, time, 1);
  bz(92.3379, 239.041, 84.5709, 249.105, 87.8183, 251.377, time, 1);
  bz(91.6334, 254.041, 104.876, 241.201, 114.136, 229.476, time, 1);
  bz(124.361, 216.519, 130.474, 208.776, 132.065, 197.315, time, 1);
  bz(135.702, 171.285, 113.207, 146.865, 111.508, 145.051, time, 1);
  bz(103.315, 136.383, 100.124, 132.852, 97.5097, 121.06, time, 1);
  bz(95.6578, 112.666, 100.306, 108.179, 96.0673, 104.804, time, 1);
  bz(90.2611, 100.188, 41.7618, 89.8461, 39.8959, 96.8806, time, 1);
  vtx(39.9006, 96.8647, time, 1);

  endShape(CLOSE);

  // PATH 4

  setGradientFill(66.3003, 84.8858, 71.5805, 117.367, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(66.4822, 90.7506, time, 1.5);
  bz(55.9682, 88.3447, 52.9149, 86.544, 48.1162, 87.9339, time, 1.5);
  bz(44.0838, 89.1023, 39.6781, 92.2639, 39.4712, 96.7376, time, 1.5);
  bz(39.2793, 100.992, 42.9565, 104.46, 44.5247, 105.924, time, 1.5);
  bz(53.2241, 114.121, 66.9805, 114.59, 74.6766, 114.851, time, 1.5);
  bz(84.0083, 115.166, 94.0312, 115.512, 96.9704, 110.261, time, 1.5);
  bz(99.111, 106.412, 96.9044, 100.568, 92.9098, 96.9887, time, 1.5);
  bz(88.0438, 92.6339, 83.9679, 94.7378, 66.5023, 90.7393, time, 1.5);
  vtx(66.4822, 90.7506, time, 1.5);

  endShape(CLOSE);

  // PATH 5

  setGradientFill(175.053, 42.7144, 195.706, 169.639, [[0, "#F3AAB6"], [0.35, "#F2A6B3"], [0.64, "#F09CAA"], [0.91, "#EE8B9B"], [1, "#ED8495"]]);

  beginShape();

  vtx(178.9, 43.1292, time, 2);
  bz(174.423, 49.4598, 176.782, 62.4525, 173.352, 69.0239, time, 2);
  bz(167.899, 79.4969, 163.978, 77.9223, 158.969, 87.0093, time, 2);
  bz(154.193, 95.6479, 157.369, 97.7091, 152.846, 110.958, time, 2);
  bz(149.067, 122.03, 146.518, 121.568, 141.437, 134.169, time, 2);
  bz(136.278, 146.971, 132.95, 155.227, 136.306, 162.429, time, 2);
  bz(141.075, 172.686, 156.174, 173.863, 160.181, 174.188, time, 2);
  bz(171.415, 175.065, 186.323, 171.306, 194.913, 160.209, time, 2);
  bz(201.849, 151.262, 196.616, 147.919, 205.704, 123.762, time, 2);
  bz(210.879, 110, 213.043, 109.847, 215.181, 99.9792, time, 2);
  bz(217.3, 90.1744, 216.427, 84.5017, 221.226, 79.5599, time, 2);
  bz(226.145, 74.4981, 231.523, 68.5034, 233.131, 64.4792, time, 2);
  bz(235.611, 58.299, 225.399, 56.3962, 223.187, 54.3446, time, 2);
  bz(221.188, 52.4768, 203.82, 36.7127, 190.518, 43.3273, time, 2);
  bz(186.426, 45.3746, 181.791, 39.0537, 178.915, 43.1337, time, 2);
  vtx(178.9, 43.1292, time, 2);

  endShape(CLOSE);

  // PATH 6

  setGradientFill(203.631, 33.9671, 209.393, 69.4018, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(181.723, 38.5508, time, 2.5);
  bz(184.352, 36.208, 188.305, 35.7577, 204.759, 40.5257, time, 2.5);
  bz(225.302, 46.4698, 228.699, 49.9243, 230.663, 53.0403, time, 2.5);
  bz(231.159, 53.8426, 235.611, 61.006, 233.1, 64.4701, time, 2.5);
  bz(230.448, 68.1334, 221.593, 65.3051, 203.973, 59.5192, time, 2.5);
  bz(181.656, 52.1875, 178.98, 48.55, 178.663, 45.5075, time, 2.5);
  bz(178.372, 42.7143, 180.038, 40.0176, 181.693, 38.5417, time, 2.5);
  vtx(181.723, 38.5508, time, 2.5);

  endShape(CLOSE);

  // PATH 7

  setGradientFill(208.955, 129.57, 217.44, 181.739, [[0, "#F3AAB6"], [0.35, "#F2A6B3"], [0.64, "#F09CAA"], [0.91, "#EE8B9B"], [1, "#ED8495"]]);

  beginShape();

  vtx(234.372, 86.4868, time, 3);
  bz(234.372, 86.4868, 226.679, 107.85, 211.824, 121.626, time, 3);
  bz(194.359, 137.854, 181.53, 130.365, 168.452, 146.254, time, 3);
  bz(161.577, 154.599, 165.873, 155.75, 154.889, 177.863, time, 3);
  bz(144.724, 198.338, 137.284, 204.93, 140.138, 211.292, time, 3);
  bz(142.932, 217.517, 153.918, 219.907, 162.808, 218.332, time, 3);
  bz(183.556, 214.681, 186.484, 207.495, 214.809, 187.551, time, 3);
  bz(233.271, 174.549, 238.252, 162.402, 246.481, 149.423, time, 3);
  bz(254.965, 136.037, 253.833, 131.804, 263.988, 124.155, time, 3);
  bz(273.919, 116.698, 284.98, 110.385, 286.022, 107.09, time, 3);
  bz(287.773, 101.625, 254.656, 77.077, 234.366, 86.4505, time, 3);
  vtx(234.372, 86.4868, time, 3);

  endShape(CLOSE);

  // PATH 8

  setGradientFill(256.293, 78.6479, 262.073, 114.259, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(246.919, 80.1661, time, 3.5);
  bz(250.237, 79.6655, 251.189, 80.6198, 262.977, 84.9203, time, 3.5);
  bz(274.165, 88.9916, 275.53, 88.9472, 278.376, 91.4454, time, 3.5);
  bz(282.452, 95.0318, 287.924, 102.411, 286.008, 107.137, time, 3.5);
  bz(283.397, 113.589, 268.283, 111.959, 264.904, 111.597, time, 3.5);
  bz(249.433, 109.931, 230.601, 101.027, 231.701, 91.9034, time, 3.5);
  bz(232.376, 86.2408, 240.664, 81.1247, 246.914, 80.182, time, 3.5);
  vtx(246.919, 80.1661, time, 3.5);

  endShape(CLOSE);

  // PATH 9

  setGradientFill(216.213, 141.117, 234.447, 253.135, [[0, "#F8CED5"], [1, "#F3AAB6"]]);

  beginShape();

  vtx(240.986, 133.277, time, 4);
  bz(233.142, 134.645, 223.177, 149.765, 217.593, 156.061, time, 4);
  bz(207.774, 167.138, 209.643, 170.968, 201.135, 180.209, time, 4);
  bz(191.787, 190.373, 187.838, 187.6, 179.34, 197.258, time, 4);
  bz(173.55, 203.855, 164.016, 218.086, 167.399, 227.054, time, 4);
  bz(171.145, 236.94, 188.375, 234.575, 192.898, 233.948, time, 4);
  bz(202.879, 232.575, 210.467, 227.907, 225.262, 218.614, time, 4);
  bz(236.677, 211.441, 246.316, 204.069, 255.376, 195.837, time, 4);
  bz(268.151, 184.238, 277.015, 177.12, 279.997, 170.934, time, 4);
  bz(284.527, 161.549, 265.129, 154.84, 254.498, 148.038, time, 4);
  bz(247.405, 143.489, 247.223, 132.158, 240.976, 133.257, time, 4);
  vtx(240.986, 133.277, time, 4);

  endShape(CLOSE);

  // PATH 10

  setGradientFill(256.185, 128.707, 263.84, 175.827, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(242.223, 131.298, time, 4.5);
  bz(252.332, 127.411, 263.305, 135.816, 267.276, 138.854, time, 4.5);
  bz(270.374, 141.237, 287.496, 154.341, 283.34, 165.56, time, 4.5);
  bz(281.109, 171.573, 273.546, 174.921, 267.574, 175.032, time, 4.5);
  bz(258.802, 175.194, 253.143, 168.449, 244.907, 158.63, time, 4.5);
  bz(239.038, 151.633, 232.49, 143.832, 235.07, 137.371, time, 4.5);
  bz(236.64, 133.422, 240.91, 131.789, 242.228, 131.283, time, 4.5);
  vtx(242.223, 131.298, time, 4.5);

  endShape(CLOSE);

  // PATH 11

  setGradientFill(148.593, 159.014, 161.059, 235.682, [[0, "#F8CED5"], [0.85, "#F4AFBB"], [1, "#F3AAB6"]]);

  beginShape();

  vtx(138.287, 131.736, time, 5);
  bz(135.498, 133.324, 136.336, 131.227, 132.677, 152.319, time, 5);
  bz(129.214, 172.296, 132.273, 183.375, 129.41, 194.339, time, 5);
  bz(125.037, 211.08, 121.872, 218.955, 116.09, 225.864, time, 5);
  bz(106.395, 237.426, 98.6152, 242.348, 100.132, 245.901, time, 5);
  bz(101.601, 249.336, 110.465, 248.356, 116.762, 247.652, time, 5);
  bz(123.576, 246.893, 133.805, 245.697, 145.656, 239.136, time, 5);
  bz(150.244, 236.597, 167.06, 227.298, 175.495, 208.328, time, 5);
  bz(181.595, 194.598, 178.361, 191.606, 185.006, 180.037, time, 5);
  bz(193.934, 164.472, 207.417, 156.514, 207.521, 148.389, time, 5);
  bz(207.68, 136.469, 177.803, 135.573, 168.857, 132.941, time, 5);
  bz(156.593, 129.345, 140.341, 130.602, 138.297, 131.756, time, 5);
  vtx(138.287, 131.736, time, 5);

  endShape(CLOSE);

  // PATH 12

  setGradientFill(170.034, 120.909, 176.85, 162.771, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(151.042, 124.149, time, 5.5);
  bz(154.446, 123.243, 162.221, 121.717, 178.279, 126.696, time, 5.5);
  bz(193.468, 131.399, 206.82, 135.542, 207.812, 144.475, time, 5.5);
  bz(208.408, 149.841, 204.405, 155.812, 199.621, 158.448, time, 5.5);
  bz(194.401, 161.317, 189.09, 159.762, 167.416, 150.258, time, 5.5);
  bz(140.253, 138.336, 136.905, 135.672, 137.149, 132.761, time, 5.5);
  bz(137.571, 127.731, 148.596, 124.805, 151.022, 124.161, time, 5.5);
  vtx(151.042, 124.149, time, 5.5);

  endShape(CLOSE);

  // PATH 13

  setGradientFill(169.822, 177.232, 180.775, 244.559, [[0, "#FCEDF0"], [1, "#F8CED5"]]);

  beginShape();

  vtx(209.139, 172.784, time, 6);
  bz(202.529, 176.517, 205.639, 185.336, 180.468, 205.11, time, 6);
  bz(155.71, 224.559, 130.879, 227.691, 122.17, 229.837, time, 6);
  bz(109.444, 232.984, 98.2548, 231.395, 94.61, 238.748, time, 6);
  bz(92.4172, 243.168, 93.7703, 249.19, 96.3797, 252.997, time, 6);
  bz(101.356, 260.247, 112.828, 262.178, 152.226, 255.651, time, 6);
  bz(213.809, 245.467, 230.808, 233.292, 237.87, 227.64, time, 6);
  bz(242.172, 224.207, 250.895, 220.323, 255.535, 213.161, time, 6);
  bz(258.202, 209.054, 259.056, 202.168, 258.139, 198, time, 6);
  bz(256.446, 190.308, 246.935, 185.923, 235.012, 180.444, time, 6);
  bz(225.029, 175.851, 216.795, 168.447, 209.123, 172.78, time, 6);
  vtx(209.139, 172.784, time, 6);

  endShape(CLOSE);

  // PATH 14

  setGradientFill(229.584, 168.578, 237.808, 219.187, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(222.701, 173.627, time, 6.5);
  bz(236.386, 177.437, 243.228, 179.342, 247.734, 183.056, time, 6.5);
  bz(252.384, 186.899, 258.982, 192.335, 258.91, 201.591, time, 6.5);
  bz(258.878, 205.926, 257.377, 212.293, 253.434, 215.523, time, 6.5);
  bz(248.785, 219.336, 243.131, 216.8, 232.735, 211.912, time, 6.5);
  bz(219.571, 205.721, 212.178, 202.239, 208.621, 192.564, time, 6.5);
  bz(206.35, 186.374, 205.261, 176.585, 208.976, 172.771, time, 6.5);
  bz(210.823, 170.869, 213.279, 171.027, 222.696, 173.643, time, 6.5);
  vtx(222.701, 173.627, time, 6.5);

  endShape(CLOSE);

  // PATH 15

  setGradientFill(82.6881, 165.487, 96.2388, 248.778, [[0, "#FCEDF0"], [0.68, "#F8CED5"]]);

  beginShape();

  vtx(54.9224, 157.853, time, 7);
  bz(53.1752, 164.543, 57.5126, 174.345, 63.2398, 186.214, time, 7);
  bz(71.0938, 202.507, 72.1603, 200.426, 75.004, 208.061, time, 7);
  bz(80.7577, 223.559, 75.1262, 228.72, 81.3004, 241.446, time, 7);
  bz(83.2343, 245.45, 89.1684, 257.691, 100.248, 258.695, time, 7);
  bz(107.151, 259.325, 111.212, 257.268, 114.148, 250.62, time, 7);
  bz(116.608, 245.071, 117.747, 235.649, 115.019, 213.874, time, 7);
  bz(113.555, 202.198, 109.565, 191.843, 108.451, 187.944, time, 7);
  bz(105.202, 176.55, 110.762, 159.177, 108.658, 153.777, time, 7);
  bz(104.768, 143.814, 90.7993, 148.852, 85.9633, 148.058, time, 7);
  bz(80.8265, 147.21, 69.1257, 145.263, 61.9162, 152.767, time, 7);
  bz(58.7571, 156.057, 55.3024, 156.344, 54.9119, 157.832, time, 7);
  vtx(54.9224, 157.853, time, 7);

  endShape(CLOSE);

  // PATH 16

  setGradientFill(79.4159, 139.86, 84.3159, 169.878, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(74.0553, 161.741, time, 7.5);
  bz(62.4928, 160.904, 56.6479, 162.898, 54.9578, 159.536, time, 7.5);
  bz(53.1082, 155.867, 57.9177, 149.032, 62.489, 145.367, time, 7.5);
  bz(68.2758, 140.752, 74.6798, 140.476, 80.8175, 140.31, time, 7.5);
  bz(90.4397, 140.038, 102.583, 139.702, 106.997, 148.061, time, 7.5);
  bz(109.821, 153.398, 109.343, 161.998, 104.933, 165.624, time, 7.5);
  bz(99.533, 170.06, 93.0712, 163.095, 74.0446, 161.721, time, 7.5);
  vtx(74.0553, 161.741, time, 7.5);

  endShape(CLOSE);

  pop();
}
// SEAWEED 4

function drawSeaweed4(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  setSeaweedMovement(
    18,      // strength
    2.75,    // bendPower
    0.018,   // wave1 
    0.038,   // wave2
    4.5,     // secondary movement 
    0.31,    // secondary speed 
    1.15
  );

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 0.72;

  // PATH 1

  setGradientFill(149.064, 97.8182, 100.769, 315.442, [[0, "#BFF4B8"], [1, "#8FEC83"]]);

  beginShape();

  vtx(207.16, 324.217, time, 0);
  bz(208.648, 304.276, 210.447, 279.951, 197.003, 249.504, time, 0);
  bz(184.872, 222.052, 180.178, 232.898, 173.894, 226.705, time, 0);
  bz(161.928, 214.91, 140.291, 213.184, 131.069, 199.678, time, 0);
  bz(120.268, 183.851, 125.057, 148.245, 117.08, 132.369, time, 0);
  bz(114.304, 126.845, 112.639, 121.778, 84.4274, 98.8456, time, 0);
  bz(70.179, 87.2666, 49.0318, 71.5275, 45.0071, 76.2654, time, 0);
  bz(41.256, 80.6898, 57.8633, 87.9181, 68.793, 109.297, time, 0);
  bz(77.2248, 125.758, 80.3614, 142.038, 82.3814, 152.461, time, 0);
  bz(86.2252, 172.34, 83.2803, 172.252, 86.7975, 182.994, time, 0);
  bz(92.6543, 200.874, 93.8655, 230.962, 106.806, 242.993, time, 0);
  bz(127.161, 261.923, 125.867, 260.404, 137.5, 273.79, time, 0);
  bz(147.752, 285.586, 152.598, 304.449, 174.682, 309.579, time, 0);
  bz(211.635, 318.169, 201.309, 338.479, 202.843, 338.067, time, 0);
  bz(205.725, 337.302, 206.635, 331.303, 207.177, 324.213, time, 0);
  vtx(207.16, 324.217, time, 0);

  endShape(CLOSE);

  // PATH 2

  setSeaweedMovement(21, 2.95, 0.015, 0.033, 5, 0.27, 1.1);

  setGradientFill(204.663, 22.8953, 136.36, 330.763, [[0, "#E3FAE0"], [1, "#BFF4B8"]]);

  beginShape();

  vtx(196.814, 342.075, time, 1.4);
  bz(199.584, 337.217, 186.074, 325.222, 184.325, 299.552, time, 1.4);
  bz(183.348, 285.196, 170.84, 276.012, 168.219, 262.308, time, 1.4);
  bz(165.517, 248.154, 155.442, 247.912, 145.901, 228.319, time, 1.4);
  bz(143.048, 222.451, 136.844, 209.36, 138.248, 193.772, time, 1.4);
  bz(138.495, 190.973, 139.137, 186.533, 149.491, 164.068, time, 1.4);
  bz(162.091, 136.737, 164.924, 135.098, 165.068, 126.615, time, 1.4);
  bz(165.311, 111.898, 156.871, 109.506, 158.265, 95.9064, time, 1.4);
  bz(159.436, 84.397, 165.645, 84.3037, 173.576, 66.385, time, 1.4);
  bz(177.531, 57.419, 185.575, 39.2766, 178.495, 24.8454, time, 1.4);
  bz(175.669, 19.0971, 170.603, 14.2421, 168.634, 15.2199, time, 1.4);
  bz(165.3, 16.8795, 175.417, 32.877, 170.47, 46.2521, time, 1.4);
  bz(164.826, 61.5334, 145.243, 57.9078, 133.729, 71.6362, time, 1.4);
  bz(122.729, 84.7453, 127.675, 108.624, 130.988, 130.589, time, 1.4);
  bz(132.909, 143.255, 134.665, 145.232, 133.898, 152.859, time, 1.4);
  bz(132.075, 171.123, 120.55, 174.199, 115.155, 191.177, time, 1.4);
  bz(107.767, 214.483, 119.992, 238.609, 121.663, 241.833, time, 1.4);
  bz(132.222, 262.03, 143.705, 258.186, 151.898, 276.668, time, 1.4);
  bz(161.197, 297.614, 149.915, 310.352, 160.65, 325.31, time, 1.4);
  bz(170.474, 339.007, 194.74, 345.676, 196.797, 342.078, time, 1.4);
  vtx(196.814, 342.075, time, 1.4);

  endShape(CLOSE);

  // PATH 3

  setSeaweedMovement(15, 3.1, 0.026, 0.055, 3.8, 0.42, 1.45);

  setGradientFill(231.348, 208.741, 197.257, 362.418, [[0, "#BFF4B8"], [1, "#8FEC83"]]);

  beginShape();

  vtx(214.807, 325.394, time, 2.8);
  bz(220.964, 316.915, 229.775, 304.598, 236.804, 284.73, time, 2.8);
  bz(240.518, 274.265, 245.193, 260.643, 245.167, 242.428, time, 2.8);
  bz(245.144, 227.572, 246.836, 171.867, 240.746, 201.766, time, 2.8);
  bz(239.518, 207.798, 226.64, 217.73, 226.663, 228.271, time, 2.8);
  bz(226.685, 236.031, 228.07, 244.319, 227.382, 251.731, time, 2.8);
  bz(226.64, 259.877, 218.11, 261.478, 214.795, 263.223, time, 2.8);
  bz(204.901, 268.449, 199.653, 272.392, 192.42, 281.073, time, 2.8);
  bz(187.297, 287.21, 193.407, 295.879, 192.767, 317.04, time, 2.8);
  bz(192.276, 333.491, 192.087, 342.092, 195.639, 343.617, time, 2.8);
  bz(200.151, 345.561, 207.912, 334.867, 214.793, 325.415, time, 2.8);
  vtx(214.807, 325.394, time, 2.8);

  endShape(CLOSE);

  // PATH 4

  setSeaweedMovement(23, 3, 0.014, 0.032, 5.5, 0.24, 1.05);

  setGradientFill(233.516, 70.8944, 173.114, 343.099, [[0, "#E3FAE0"], [0.529479, "#BFF4B8"]]);

  beginShape();

  vtx(209.343, 337.168, time, 4.2);
  bz(218.88, 322.505, 207.659, 291.006, 208.64, 250.519, time, 4.2);
  bz(208.782, 244.637, 209.133, 233.833, 213.565, 221.15, time, 4.2);
  bz(222.158, 196.602, 236.03, 193.601, 240.425, 175.454, time, 4.2);
  bz(242.93, 165.076, 238.832, 153.018, 230.549, 129.319, time, 4.2);
  bz(218.389, 94.5604, 205.689, 61.1133, 199.889, 63.7886, time, 4.2);
  bz(194.089, 66.4638, 205.885, 79.3626, 207.61, 104.677, time, 4.2);
  bz(208.298, 114.709, 209.502, 132.374, 202.863, 151.56, time, 4.2);
  bz(196.312, 170.491, 189.514, 169.559, 180.861, 191.881, time, 4.2);
  bz(177.469, 200.614, 172.793, 213.008, 172.881, 228.735, time, 4.2);
  bz(172.968, 245.022, 178.113, 248.686, 184.487, 271.996, time, 4.2);
  bz(194.761, 309.574, 172.988, 340.003, 183.653, 345.188, time, 4.2);
  bz(190.333, 348.44, 204.754, 344.252, 209.347, 337.186, time, 4.2);
  vtx(209.343, 337.168, time, 4.2);

  endShape(CLOSE);

  // PATH 5

  setSeaweedMovement(17, 2.6, 0.021, 0.047, 4.2, 0.36, 1.25);

  setGradientFill(131.28, 185.384, 94.3654, 351.749, [[0, "#EBFBE9"], [1, "#BFF4B8"]]);

  beginShape();

  vtx(181.466, 315.588, time, 5.6);
  bz(169.411, 301.844, 158.949, 289.914, 142.016, 280.645, time, 5.6);
  bz(125.062, 271.363, 121.208, 275.485, 109.287, 266.424, time, 5.6);
  bz(96.1047, 256.397, 90.0536, 243.183, 85.425, 233.048, time, 5.6);
  bz(73.5575, 207.109, 80.1678, 204.995, 67.3447, 181.019, time, 5.6);
  bz(61.6112, 170.299, 48.6624, 162.712, 44.0173, 148.59, time, 5.6);
  bz(30.1605, 106.334, 40.3289, 207.59, 57.4029, 243.174, time, 5.6);
  bz(59.9618, 248.53, 74.9233, 277.594, 103.837, 291.955, time, 5.6);
  bz(113.862, 296.94, 122.627, 298.682, 146.819, 309.991, time, 5.6);
  bz(156.548, 314.535, 156.477, 327.011, 167.976, 336.454, time, 5.6);
  bz(184.792, 350.245, 195.573, 345.112, 197.247, 344.11, time, 5.6);
  bz(207.639, 337.871, 189.028, 324.206, 181.445, 315.575, time, 5.6);
  vtx(181.466, 315.588, time, 5.6);

  endShape(CLOSE);

  pop();
}

// SEAWEED 5

function drawSeaweed5(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  setSeaweedMovement(14, 2.35, 0.03, 0.062, 3.2, 0.72, 1.55);

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 1.65;

  // PATH 1

  setGradientFill(69.5713, 46.842, 48.4959, 157.252, [[0, "#5ED9CD"], [0.38, "#5BD7CB"], [0.62, "#53D3C7"], [0.81, "#44CCBF"], [0.98, "#30C3B5"], [1, "#2EC2B4"]]);

  beginShape();

  vtx(102.935, 160.209, time, 0);
  bz(103.287, 150.118, 103.708, 137.807, 96.4159, 122.652, time, 0);
  bz(89.8366, 108.988, 87.7098, 114.539, 84.4585, 111.514, time, 0);
  bz(78.2663, 105.751, 67.4535, 105.229, 62.5957, 98.5589, time, 0);
  bz(56.9054, 90.7419, 58.5962, 72.6882, 54.3121, 64.8015, time, 0);
  bz(52.8208, 62.057, 51.8929, 59.5257, 37.3901, 48.4025, time, 0);
  bz(30.0656, 42.7861, 19.223, 35.1807, 17.3104, 37.6376, time, 0);
  bz(15.528, 39.9319, 23.9428, 43.3136, 29.8053, 53.9313, time, 0);
  bz(34.3274, 62.1062, 36.2079, 70.2749, 37.4178, 75.5048, time, 0);
  bz(39.7209, 85.4794, 38.2521, 85.4824, 40.2141, 90.849, time, 0);
  bz(43.481, 99.7819, 44.672, 114.953, 51.3535, 120.818, time, 0);
  bz(61.864, 130.048, 61.1899, 129.302, 67.2467, 135.873, time, 0);
  bz(72.5843, 141.663, 75.3671, 151.108, 86.4692, 153.342, time, 0);
  bz(105.047, 157.084, 100.299, 167.504, 101.055, 167.271, time, 0);
  bz(102.476, 166.838, 102.812, 163.795, 102.944, 160.207, time, 0);
  vtx(102.935, 160.209, time, 0);

  endShape(CLOSE);

  // PATH 2

  setSeaweedMovement(16, 2.55, 0.025, 0.052, 3.8, 0.78, 1.5);

  setGradientFill(95.8069, 8.11904, 66.0015, 164.314, [[0, "#98E7DF"], [1, "#5ED9CD"]]);

  beginShape();

  vtx(98.1295, 169.392, time, 1.2);
  bz(99.4148, 166.895, 92.4501, 161.056, 91.0771, 148.124, time, 1.2);
  bz(90.31, 140.892, 83.8994, 136.457, 82.3264, 129.581, time, 1.2);
  bz(80.7038, 122.478, 75.6795, 122.518, 70.5438, 112.78, time, 1.2);
  bz(69.0079, 109.863, 65.6613, 103.354, 66.0567, 95.4614, time, 1.2);
  bz(66.1249, 94.044, 66.3579, 91.7921, 71.0779, 80.2833, time, 1.2);
  bz(76.8211, 66.2811, 78.2006, 65.408, 78.1064, 61.1229, time, 1.2);
  bz(77.9402, 53.6887, 73.6891, 52.617, 74.1179, 45.7285, time, 1.2);
  bz(74.4762, 39.8988, 77.5678, 39.7516, 81.169, 30.5771, time, 1.2);
  bz(82.9642, 25.9866, 86.6173, 16.6973, 82.8087, 9.52538, time, 1.2);
  bz(81.2884, 6.66871, 78.6696, 4.29924, 77.7081, 4.82462, time, 1.2);
  bz(76.0794, 5.71623, 81.4319, 13.6299, 79.2287, 20.4625, time, 1.2);
  bz(76.7154, 28.2686, 66.8883, 26.7538, 61.4204, 33.8705, time, 1.2);
  bz(56.196, 40.6663, 59.1265, 52.6422, 61.2057, 63.6785, time, 1.2);
  bz(62.4101, 70.0425, 63.3235, 71.0122, 63.0908, 74.8755, time, 1.2);
  bz(62.5391, 84.1256, 56.8572, 85.8647, 54.5013, 94.5233, time, 1.2);
  bz(51.2759, 106.409, 57.8371, 118.393, 58.7326, 119.993, time, 1.2);
  bz(64.3876, 130.02, 70.0329, 127.895, 74.4756, 137.094, time, 1.2);
  bz(79.5172, 147.519, 74.1455, 154.132, 79.7858, 161.511, time, 1.2);
  bz(84.9474, 168.267, 97.1669, 171.243, 98.121, 169.394, time, 1.2);
  vtx(98.1295, 169.392, time, 1.2);

  endShape(CLOSE);

  // PATH 3

  setSeaweedMovement(12, 2.8, 0.038, 0.075, 2.8, 0.9, 1.75);

  setGradientFill(112.731, 101.518, 97.8544, 179.485, [[0, "#98E7DF"], [1, "#5ED9CD"]]);

  beginShape();

  vtx(106.768, 160.68, time, 2.4);
  bz(109.67, 156.3, 113.819, 149.94, 116.933, 139.796, time, 2.4);
  bz(118.578, 134.452, 120.641, 127.499, 120.273, 118.303, time, 2.4);
  bz(119.971, 110.803, 119.726, 82.6518, 117.276, 97.8451, time, 2.4);
  bz(116.782, 100.911, 110.56, 106.132, 110.778, 111.454, time, 2.4);
  bz(110.94, 115.371, 111.792, 119.534, 111.594, 123.287, time, 2.4);
  bz(111.384, 127.411, 107.165, 128.357, 105.548, 129.292, time, 2.4);
  bz(100.721, 132.089, 98.1832, 134.165, 94.7495, 138.664, time, 2.4);
  bz(92.317, 141.845, 95.5301, 146.123, 95.6247, 156.818, time, 2.4);
  bz(95.7013, 165.131, 95.7749, 169.477, 97.5743, 170.189, time, 2.4);
  bz(99.8599, 171.098, 103.518, 165.574, 106.761, 160.691, time, 2.4);
  vtx(106.768, 160.68, time, 2.4);

  endShape(CLOSE);

  // PATH 4

  setSeaweedMovement(17, 2.6, 0.022, 0.05, 4, 0.74, 1.4);

  setGradientFill(111.119, 31.8876, 84.76, 169.989, [[0, "#C9F2EE"], [0.03, "#C4F1EC"], [0.19, "#B0ECE6"], [0.38, "#A2E9E2"], [0.61, "#9AE7DF"], [1, "#98E7DF"]]);

  beginShape();

  vtx(104.276, 166.713, time, 3.6);
  bz(108.74, 159.156, 102.535, 143.434, 102.233, 122.977, time, 3.6);
  bz(102.189, 120.005, 102.153, 114.545, 104.113, 108.07, time, 3.6);
  bz(107.915, 95.5373, 114.767, 93.7988, 116.603, 84.5661, time, 3.6);
  bz(117.648, 79.286, 115.371, 73.2642, 110.781, 61.4327, time, 3.6);
  bz(104.045, 44.0798, 97.0645, 27.3979, 94.2273, 28.842, time, 3.6);
  bz(91.3901, 30.2862, 97.5186, 36.6083, 98.8723, 49.3612, time, 3.6);
  bz(99.4107, 54.4152, 100.356, 63.3143, 97.4228, 73.1077, time, 3.6);
  bz(94.5288, 82.7712, 91.1241, 82.4102, 87.2493, 93.8196, time, 3.6);
  bz(85.7296, 98.2834, 83.642, 104.616, 83.9934, 112.555, time, 3.6);
  bz(84.3546, 120.777, 86.9895, 122.543, 90.6198, 134.209, time, 3.6);
  bz(96.4722, 153.016, 86.2193, 168.73, 91.6339, 171.176, time, 3.6);
  bz(95.025, 172.71, 102.128, 170.363, 104.278, 166.721, time, 3.6);
  vtx(104.276, 166.713, time, 3.6);

  endShape(CLOSE);

  // PATH 5

  setSeaweedMovement(13, 2.4, 0.031, 0.068, 3.5, 0.82, 1.6);

  setGradientFill(62.4213, 91.3386, 46.3124, 175.743, [[0, "#C9F2EE"], [1, "#98E7DF"]]);

  beginShape();

  vtx(89.9664, 156.267, time, 4.8);
  bz(83.6921, 149.522, 78.2472, 143.667, 69.6303, 139.261, time, 4.8);
  bz(61.0028, 134.848, 59.1632, 136.991, 53.0474, 132.608, time, 4.8);
  bz(46.2842, 127.758, 43.0115, 121.184, 40.5077, 116.142, time, 4.8);
  bz(34.0889, 103.237, 37.3408, 102.063, 30.4843, 90.1654, time, 4.8);
  bz(27.4186, 84.8453, 20.8195, 81.2234, 18.2296, 74.1686, time, 4.8);
  bz(10.5011, 53.0579, 17.5442, 104.016, 26.7451, 121.706, time, 4.8);
  bz(28.1245, 124.369, 36.1457, 138.801, 50.8308, 145.586, time, 4.8);
  bz(55.9224, 147.941, 60.3229, 148.68, 72.5962, 153.999, time, 4.8);
  bz(77.5317, 156.137, 77.7397, 162.437, 83.6533, 167.019, time, 4.8);
  bz(92.2997, 173.711, 97.5705, 170.946, 98.3849, 170.412, time, 4.8);
  bz(103.44, 167.095, 93.9016, 160.496, 89.9556, 156.26, time, 4.8);
  vtx(89.9664, 156.267, time, 4.8);

  endShape(CLOSE);

  pop();
}

// SEAWEED 6

function drawSeaweed6(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  setSeaweedMovement(15, 2.3, 0.028, 0.06, 3.2, 0.7, 1.5);

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 1.35;

  // PATH 1

  setGradientFill(70.6192, 41.3792, 16.9211, 116.529, [[0, "#BFF4B8"], [1, "#8FEC83"]]);

  beginShape();

  vtx(56.2905, 137.285, time, 0);
  bz(60.1291, 129.95, 64.8054, 121, 64.5357, 107.154, time, 0);
  bz(64.2891, 94.6682, 60.6857, 98.0031, 59.2462, 94.5893, time, 0);
  bz(56.5052, 88.0868, 48.3466, 83.786, 46.9558, 77.0956, time, 0);
  bz(45.3283, 69.2555, 53.0145, 56.5179, 52.4966, 49.1354, time, 0);
  bz(52.3161, 46.5662, 52.4948, 44.3585, 45.2361, 30.8836, time, 0);
  bz(41.5696, 24.0792, 35.8916, 14.5304, 33.5473, 15.6548, time, 0);
  bz(31.3611, 16.706, 36.6587, 22.2527, 37.4292, 32.2261, time, 0);
  bz(38.0288, 39.908, 36.5924, 46.6289, 35.6773, 50.9342, time, 0);
  bz(33.9286, 59.1435, 32.7942, 58.614, 32.411, 63.2925, time, 0);
  bz(31.7743, 71.0805, 27.3307, 82.7295, 30.4129, 89.4856, time, 0);
  bz(35.2605, 100.115, 35.0041, 99.3191, 37.355, 106.371, time, 0);
  bz(39.4268, 112.584, 38.2354, 120.576, 46.0122, 126.247, time, 0);
  bz(59.0244, 135.738, 51.6774, 141.725, 52.3431, 141.826, time, 0);
  bz(53.5925, 142.021, 54.9278, 139.892, 56.2978, 137.286, time, 0);
  vtx(56.2905, 137.285, time, 0);

  endShape(CLOSE);

  // PATH 2

  setSeaweedMovement(17, 2.5, 0.025, 0.052, 3.7, 0.76, 1.45);

  setGradientFill(104.551, 22.2432, 28.5925, 128.559, [[0, "#E3FAE0"], [1, "#BFF4B8"]]);

  beginShape();

  vtx(49.3364, 142.336, time, 1.2);
  bz(51.2108, 140.955, 47.9004, 134.116, 51.4122, 124.057, time, 1.2);
  bz(53.3768, 118.431, 49.998, 112.831, 51.2149, 107.177, time, 1.2);
  bz(52.4736, 101.337, 48.5825, 99.5483, 48.0619, 90.4886, time, 1.2);
  bz(47.9079, 87.7756, 47.6264, 81.7512, 50.7214, 76.0581, time, 1.2);
  bz(51.275, 75.0348, 52.2508, 73.4539, 59.961, 66.6526, time, 1.2);
  bz(69.3421, 58.3778, 70.7151, 58.2315, 72.1571, 55.0288, time, 1.2);
  bz(74.6567, 49.4715, 71.7553, 47.1402, 74.5211, 42.2017, time, 1.2);
  bz(76.8583, 38.0208, 79.2958, 39.0311, 85.3176, 33.5506, time, 1.2);
  bz(88.3255, 30.8061, 94.4279, 25.2596, 94.0242, 18.5777, time, 1.2);
  bz(93.8609, 15.9151, 92.6778, 13.215, 91.7501, 13.2554, time, 1.2);
  bz(90.1782, 13.3251, 91.511, 21.1144, 87.3958, 25.3691, time, 1.2);
  bz(82.6972, 30.2315, 75.6499, 25.554, 68.9151, 28.837, time, 1.2);
  bz(62.4817, 31.9708, 60.5096, 41.8872, 58.2129, 50.8005, time, 1.2);
  bz(56.8926, 55.9423, 57.2547, 56.99, 55.7095, 59.7625, time, 1.2);
  bz(52.0141, 66.4026, 47.0151, 65.6318, 42.1366, 71.1815, time, 1.2);
  bz(35.4465, 78.8027, 36.2732, 90.0391, 36.3984, 91.5467, time, 1.2);
  bz(37.2176, 101.008, 42.325, 101.48, 42.5013, 109.89, time, 1.2);
  bz(42.7064, 119.424, 36.224, 122.37, 37.9679, 129.868, time, 1.2);
  bz(39.5622, 136.732, 47.9391, 143.356, 49.329, 142.334, time, 1.2);
  vtx(49.3364, 142.336, time, 1.2);

  endShape(CLOSE);

  // PATH 3

  setSeaweedMovement(13, 2.7, 0.034, 0.07, 2.8, 0.84, 1.7);

  setGradientFill(84.5947, 97.4328, 46.6801, 150.502, [[0, "#BFF4B8"], [1, "#8FEC83"]]);

  beginShape();

  vtx(59.081, 139.021, time, 2.4);
  bz(62.8686, 136.833, 68.3182, 133.631, 74.3069, 127.258, time, 2.4);
  bz(77.4654, 123.902, 81.5151, 119.508, 84.4811, 112.575, time, 2.4);
  bz(86.8999, 106.919, 96.6617, 86.0146, 89.4007, 96.3622, time, 2.4);
  bz(87.936, 98.4501, 81.2892, 100.059, 79.5761, 104.073, time, 2.4);
  bz(78.3165, 107.028, 77.5023, 110.414, 76.023, 113.118, time, 2.4);
  bz(74.4026, 116.092, 70.8135, 115.264, 69.235, 115.369, time, 2.4);
  bz(64.5214, 115.691, 61.8297, 116.307, 57.5899, 118.391, time, 2.4);
  bz(54.5885, 119.863, 55.5555, 124.189, 51.8483, 132.131, time, 2.4);
  bz(48.9687, 138.306, 47.4894, 141.546, 48.626, 142.725, time, 2.4);
  bz(50.0684, 144.224, 54.8436, 141.463, 59.0724, 139.027, time, 2.4);
  vtx(59.081, 139.021, time, 2.4);

  endShape(CLOSE);

  // PATH 4

  setSeaweedMovement(18, 2.55, 0.022, 0.048, 4, 0.7, 1.4);

  setGradientFill(107.964, 45.3613, 40.8002, 139.36, [[0, "#E3FAE0"], [0.529479, "#BFF4B8"]]);

  beginShape();

  vtx(55.0258, 142.579, time, 3.6);
  bz(61.1421, 138.608, 61.9115, 124.736, 68.9097, 109.5, time, 3.6);
  bz(69.9261, 107.287, 71.8286, 103.236, 75.6299, 99.1576, time, 3.6);
  bz(82.9932, 91.2669, 88.8951, 92.4618, 93.5748, 86.2992, time, 3.6);
  bz(96.2476, 82.7731, 96.6193, 77.4962, 97.2602, 67.086, time, 3.6);
  bz(98.1959, 51.816, 98.7067, 36.9539, 96.0069, 36.9947, time, 3.6);
  bz(93.3072, 37.0355, 95.8013, 43.9289, 92.338, 53.8489, time, 3.6);
  bz(90.9669, 57.7809, 88.5504, 64.7034, 82.8256, 70.8833, time, 3.6);
  bz(77.1767, 76.9813, 74.6772, 75.4818, 67.6543, 82.5157, time, 3.6);
  bz(64.9038, 85.2664, 61.0544, 89.1935, 58.5193, 95.1909, time, 3.6);
  bz(55.8918, 101.401, 57.3005, 103.661, 55.9781, 113.602, time, 3.6);
  bz(53.8461, 129.627, 40.3803, 137.535, 43.6936, 141.303, time, 3.6);
  bz(45.768, 143.665, 52.0783, 144.501, 55.0245, 142.587, time, 3.6);
  vtx(55.0258, 142.579, time, 3.6);

  endShape(CLOSE);

  // PATH 5

  setSeaweedMovement(14, 2.35, 0.03, 0.065, 3.4, 0.8, 1.6);

  setGradientFill(49.3735, 71.6936, 8.32526, 129.144, [[0, "#EBFBE9"], [1, "#BFF4B8"]]);

  beginShape();

  vtx(47.6769, 129.675, time, 4.8);
  bz(45.2197, 122.417, 43.0878, 116.117, 37.9966, 109.739, time, 4.8);
  bz(32.8994, 103.352, 30.7223, 104.271, 27.5524, 98.8168, time, 4.8);
  bz(24.0482, 92.7822, 23.8468, 86.7363, 23.697, 82.1017, time, 4.8);
  bz(23.3057, 70.2358, 26.23, 70.5449, 25.1451, 59.265, time, 4.8);
  bz(24.6601, 54.2213, 20.8483, 49.1543, 21.3437, 43.0001, time, 4.8);
  bz(22.8425, 24.5923, 10.2644, 64.8221, 11.1108, 81.2339, time, 4.8);
  bz(11.2339, 83.7023, 12.3216, 97.2779, 21.2546, 107.611, time, 4.8);
  bz(24.3509, 111.195, 27.4854, 113.334, 35.0754, 121.711, time, 4.8);
  bz(38.1281, 125.078, 36.0617, 129.812, 39.005, 135.341, time, 4.8);
  bz(43.3113, 143.419, 48.3558, 143.282, 49.1727, 143.183, time, 4.8);
  bz(54.246, 142.56, 49.2185, 134.227, 47.6709, 129.667, time, 4.8);
  vtx(47.6769, 129.675, time, 4.8);

  endShape(CLOSE);

  pop();
}

// SEAWEED 7

function drawSeaweed7(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  setSeaweedMovement(13, 2.45, 0.033, 0.068, 3, 0.82, 1.55);

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 1.75;

  // PATH 1

  setGradientFill(44.0323, 29.0101, 24.4552, 99.619, [[0, "#5ED9CD"], [0.38, "#5BD7CB"], [0.62, "#53D3C7"], [0.81, "#44CCBF"], [0.98, "#30C3B5"], [1, "#2EC2B4"]]);

  beginShape();

  vtx(59.6663, 104.442, time, 0);
  bz(60.4327, 97.904, 61.3623, 89.9286, 57.4324, 79.6937, time, 0);
  bz(53.8862, 70.4655, 52.2085, 73.9588, 50.2574, 71.8201, time, 0);
  bz(46.5416, 67.7463, 39.5445, 66.8304, 36.7439, 62.2382, time, 0);
  bz(33.4636, 56.8563, 35.5243, 45.2171, 33.1614, 39.8649, time, 0);
  bz(32.3388, 38.0024, 31.8708, 36.3084, 23.0414, 28.3088, time, 0);
  bz(18.5821, 24.2695, 11.9431, 18.7504, 10.5696, 20.2447, time, 0);
  bz(9.28934, 21.6403, 14.5761, 24.2858, 17.819, 31.4965, time, 0);
  bz(20.3212, 37.0487, 21.1076, 42.456, 21.6149, 45.9183, time, 0);
  bz(22.5796, 52.5214, 21.6251, 52.4451, 22.6138, 56.0363, time, 0);
  bz(24.2602, 62.014, 24.2253, 71.9337, 28.2536, 76.1008, time, 0);
  bz(34.5902, 82.6571, 34.192, 82.1364, 37.7769, 86.7283, time, 0);
  bz(40.936, 90.7748, 42.2406, 97.0594, 49.3344, 99.1027, time, 0);
  bz(61.2045, 102.524, 57.5644, 109.04, 58.068, 108.929, time, 0);
  bz(59.0143, 108.724, 59.3951, 106.765, 59.6719, 104.441, time, 0);
  vtx(59.6663, 104.442, time, 0);

  endShape(CLOSE);

  // PATH 2

  setSeaweedMovement(15, 2.65, 0.027, 0.055, 3.4, 0.88, 1.45);

  setGradientFill(63.1412, 5.2506, 35.452, 105.14, [[0, "#98E7DF"], [1, "#5ED9CD"]]);

  beginShape();

  vtx(56.0546, 110.151, time, 1.2);
  bz(57.0227, 108.598, 52.809, 104.433, 52.6062, 95.9583, time, 1.2);
  bz(52.4933, 91.2185, 48.5648, 87.9955, 47.9094, 83.4442, time, 1.2);
  bz(47.2338, 78.7431, 43.9673, 78.5014, 41.1498, 71.9011, time, 1.2);
  bz(40.3074, 69.9241, 38.4801, 65.517, 39.1576, 60.4102, time, 1.2);
  bz(39.2775, 59.493, 39.5489, 58.0424, 43.2288, 50.8169, time, 1.2);
  bz(47.7064, 42.0259, 48.6492, 41.5322, 48.8163, 38.7431, time, 1.2);
  bz(49.1046, 33.9044, 46.3998, 32.9815, 47.0455, 28.529, time, 1.2);
  bz(47.589, 24.7606, 49.6054, 24.8298, 52.4341, 19.0611, time, 1.2);
  bz(53.8451, 16.1744, 56.7136, 10.334, 54.6214, 5.4715, time, 1.2);
  bz(53.7859, 3.53452, 52.2108, 1.85553, 51.5581, 2.14562, time, 1.2);
  bz(50.4525, 2.63808, 53.5081, 8.06479, 51.7126, 12.3864, time, 1.2);
  bz(49.6637, 17.324, 43.3599, 15.8161, 39.4282, 20.1483, time, 1.2);
  bz(35.6717, 24.2849, 36.9373, 32.2218, 37.7, 39.5027, time, 1.2);
  bz(38.1432, 43.7015, 38.685, 44.3802, 38.3279, 46.8778, time, 1.2);
  bz(37.4764, 52.858, 33.6923, 53.6851, 31.7002, 59.1849, time, 1.2);
  bz(28.9712, 66.735, 32.5952, 74.8704, 33.0917, 75.9579, time, 1.2);
  bz(36.2313, 82.7737, 40.0123, 81.6936, 42.4083, 87.9069, time, 1.2);
  bz(45.1282, 94.9488, 41.2858, 98.9588, 44.5569, 104.053, time, 1.2);
  bz(47.5502, 108.718, 55.3305, 111.303, 56.0489, 110.152, time, 1.2);
  vtx(56.0546, 110.151, time, 1.2);

  endShape(CLOSE);

  // PATH 3

  setSeaweedMovement(11, 2.85, 0.04, 0.078, 2.6, 0.96, 1.8);

  setGradientFill(69.1582, 66.8329, 55.3379, 116.694, [[0, "#98E7DF"], [1, "#5ED9CD"]]);

  beginShape();

  vtx(62.1309, 104.952, time, 2.4);
  bz(64.2498, 102.261, 67.2843, 98.3497, 69.8481, 91.9251, time, 2.4);
  bz(71.202, 88.5411, 72.9129, 84.134, 73.1636, 78.1399, time, 2.4);
  bz(73.3676, 73.2509, 74.7088, 54.9484, 72.3073, 64.6887, time, 2.4);
  bz(71.823, 66.654, 67.5023, 69.7149, 67.36, 73.1837, time, 2.4);
  bz(67.2567, 75.7376, 67.5882, 78.4873, 67.2596, 80.9151, time, 2.4);
  bz(66.903, 83.5836, 64.112, 83.9731, 63.0114, 84.4942, time, 2.4);
  bz(59.7262, 86.0545, 57.9669, 87.2677, 55.4964, 90.0079, time, 2.4);
  bz(53.7464, 91.9449, 55.6059, 94.8956, 55.0974, 101.848, time, 2.4);
  bz(54.7041, 107.254, 54.5203, 110.081, 55.6513, 110.64, time, 2.4);
  bz(57.0879, 111.352, 59.7588, 107.958, 62.1263, 104.959, time, 2.4);
  vtx(62.1309, 104.952, time, 2.4);

  endShape(CLOSE);

  // PATH 4

  setSeaweedMovement(16, 2.65, 0.024, 0.052, 3.8, 0.8, 1.45);

  setGradientFill(71.8221, 21.5088, 47.3368, 109.827, [[0, "#C9F2EE"], [0.03, "#C4F1EC"], [0.19, "#B0ECE6"], [0.38, "#A2E9E2"], [0.61, "#9AE7DF"], [1, "#98E7DF"]]);

  beginShape();

  vtx(60.1904, 108.738, time, 3.6);
  bz(63.4939, 104.067, 60.3003, 93.5215, 61.1946, 80.215, time, 3.6);
  bz(61.3243, 78.2817, 61.592, 74.7322, 63.2106, 70.63, time, 3.6);
  bz(66.3484, 62.6905, 70.8929, 61.9263, 72.5774, 56.0257, time, 3.6);
  bz(73.5378, 52.651, 72.3795, 48.6174, 70.0283, 40.6859, time, 3.6);
  bz(66.5764, 29.053, 62.9306, 17.8429, 61.0104, 18.6299, time, 3.6);
  bz(59.0901, 19.4169, 62.7348, 23.851, 62.9346, 32.2085, time, 3.6);
  bz(63.015, 35.5207, 63.1546, 41.3528, 60.7272, 47.559, time, 3.6);
  bz(58.332, 53.6831, 56.1392, 53.2671, 53.0136, 60.4731, time, 3.6);
  bz(51.7885, 63.2922, 50.0946, 67.2954, 49.8998, 72.4718, time, 3.6);
  bz(49.6962, 77.8326, 51.314, 79.1208, 53.0508, 86.8934, time, 3.6);
  bz(55.8506, 99.4238, 48.352, 109.086, 51.7394, 110.964, time, 3.6);
  bz(53.8608, 112.142, 58.6005, 110.996, 60.1914, 108.744, time, 3.6);
  vtx(60.1904, 108.738, time, 3.6);

  endShape(CLOSE);

  // PATH 5

  setSeaweedMovement(12, 2.45, 0.035, 0.072, 3, 0.9, 1.65);

  setGradientFill(37.0154, 57.5379, 22.0512, 111.516, [[0, "#C9F2EE"], [1, "#98E7DF"]]);

  beginShape();

  vtx(51.4506, 101.189, time, 4.8);
  bz(47.7338, 96.4727, 44.5083, 92.3788, 39.1449, 89.0565, time, 4.8);
  bz(33.7749, 85.7295, 32.4655, 87.024, 28.7257, 83.8508, time, 4.8);
  bz(24.5903, 80.3392, 22.8145, 75.8937, 21.4565, 72.4845, time, 4.8);
  bz(17.9741, 63.7584, 20.1494, 63.169, 16.3289, 55.0735, time, 4.8);
  bz(14.6207, 51.4537, 10.5264, 48.7489, 9.21977, 44.0275, time, 4.8);
  bz(5.32384, 29.9002, 7.18369, 63.3822, 12.2186, 75.3658, time, 4.8);
  bz(12.9728, 77.1695, 17.4149, 86.9735, 26.5939, 92.1643, time, 4.8);
  bz(29.7764, 93.9657, 32.596, 94.6799, 40.2863, 98.79, time, 4.8);
  bz(43.3789, 100.442, 43.1783, 104.546, 46.776, 107.838, time, 4.8);
  bz(52.0368, 112.647, 55.6086, 111.131, 56.1661, 110.828, time, 4.8);
  bz(59.6273, 108.942, 53.7819, 104.147, 51.444, 101.184, time, 4.8);
  vtx(51.4506, 101.189, time, 4.8);

  endShape(CLOSE);

  pop();
}

// CORAL 3

function drawCoral3(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);
  noStroke();

  setSeaweedMovement(12, 2.2, 0.028, 0.055, 3, 0.55, 1.4);

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 1.05;

  // PATH 1

  setGradientFill(57.7947, 60.8032, 94.5544, 60.8032, [[0, "#5ED9CD"], [0.38, "#5BD7CB"], [0.62, "#53D3C7"], [0.81, "#44CCBF"], [0.98, "#30C3B5"], [1, "#2EC2B4"]]);

  beginShape();

  vtx(86.7284, 13.7246, time, 0);
  bz(76.3687, 16.4116, 69.9219, 24.0741, 68.42, 25.9233, time, 0);
  bz(59.4804, 36.988, 58.3259, 49.4728, 57.9581, 54.0397, time, 0);
  bz(57.0693, 65.2576, 59.787, 73.5434, 63.4037, 84.5468, time, 0);
  bz(67.5108, 97.0418, 73.3752, 108.556, 74.734, 108.086, time, 0);
  bz(75.8579, 107.698, 89.6095, 110.599, 89.773, 98.2372, time, 0);
  bz(89.9364, 85.4254, 78.79, 86.8353, 80.4553, 66.4019, time, 0);
  bz(81.4157, 54.6425, 86.3096, 47.3273, 90.2124, 36.3954, time, 0);
  bz(91.7755, 32.0329, 95.4535, 26.1787, 94.3603, 19.1701, time, 0);
  bz(93.6655, 14.7462, 90.3758, 12.7847, 86.7284, 13.7246, time, 0);

  endShape(CLOSE);

  // PATH 2

  setGradientFill(94.6157, 25.7087, 126.165, 93.3637, [[0, "#5ED9CD"], [0.38, "#5BD7CB"], [0.62, "#53D3C7"], [0.81, "#44CCBF"], [0.98, "#30C3B5"], [1, "#2EC2B4"]]);

  beginShape();

  vtx(128.198, 11.1397, time, 0.8);
  bz(125.654, 11.0069, 123.672, 12.141, 122.967, 12.5598, time, 0.8);
  bz(118.114, 15.4307, 116.929, 21.2747, 115.335, 27.8134, time, 0.8);
  bz(112.188, 40.7375, 110.625, 47.2047, 108.143, 51.7715, time, 0.8);
  bz(105.629, 56.4099, 102.105, 60.1697, 95.0653, 67.6892, time, 0.8);
  bz(87.556, 75.7093, 86.0133, 75.8728, 83.9495, 79.9084, time, 0.8);
  bz(80.8334, 86.0179, 78.8207, 96.5207, 83.9495, 101.905, time, 0.8);
  bz(89.9467, 108.198, 103.514, 105.184, 111.627, 99.7288, time, 0.8);
  bz(117.062, 96.0712, 121.353, 86.9272, 129.71, 68.7823, time, 0.8);
  bz(136.116, 54.8774, 137.516, 50.2901, 138.425, 46.7756, time, 0.8);
  bz(140.775, 37.6623, 143.125, 27.9973, 138.425, 19.5378, time, 0.8);
  bz(137.567, 17.9951, 133.93, 11.4564, 128.188, 11.1397, time, 0.8);

  endShape(CLOSE);

  // PATH 3

  setGradientFill(26.0515, 55.3985, 78.3508, 55.3985, [[0, "#5ED9CD"], [0.38, "#5BD7CB"], [0.62, "#53D3C7"], [0.81, "#44CCBF"], [0.98, "#30C3B5"], [1, "#2EC2B4"]]);

  beginShape();

  vtx(32.4982, 18.7409, time, 1.6);
  bz(27.9824, 27.4762, 25.745, 36.8143, 26.0923, 45.5496, time, 1.6);
  bz(26.3988, 53.0589, 29.617, 66.4121, 38.0458, 82.6158, time, 1.6);
  bz(41.8567, 89.9412, 46.4133, 98.4415, 56.0886, 104.571, time, 1.6);
  bz(63.087, 109.006, 73.835, 112.867, 76.665, 109.537, time, 1.6);
  bz(79.9241, 105.706, 77.7071, 94.6204, 76.2461, 92.4749, time, 1.6);
  bz(70.4941, 84.0053, 68.2157, 78.1409, 65.8659, 72.7976, time, 1.6);
  bz(62.4433, 65.0226, 57.2838, 45.9889, 57.2838, 21.5199, time, 1.6);
  bz(57.2838, 15.5942, 60.5328, 0.177199, 52.9009, 0.00351552, time, 1.6);
  bz(41.8056, -0.251902, 35.2159, 13.4793, 32.488, 18.7409, time, 1.6);

  endShape(CLOSE);

  // PATH 4

  setGradientFill(70.1262, 52.8546, 97.9769, 112.581, [[0, "#98E7DF"], [1, "#5ED9CD"]]);

  beginShape();

  vtx(100.357, 43.1589, time, 2.4);
  bz(95.7088, 40.6558, 88.455, 42.4846, 83.4284, 49.4013, time, 2.4);
  bz(78.555, 56.1239, 80.4553, 74.5549, 79.3622, 81.8292, time, 2.4);
  bz(74.5807, 113.756, 60.9413, 118.385, 66.3562, 122.696, time, 2.4);
  bz(71.4032, 126.701, 83.1526, 119.253, 84.2253, 118.558, time, 2.4);
  bz(96.1482, 110.845, 99.1213, 97.8592, 103.617, 78.2431, time, 2.4);
  bz(103.617, 78.2431, 108.674, 66.9434, 105.793, 51.1484, time, 2.4);
  bz(105.21, 47.9506, 102.35, 44.2317, 100.347, 43.1589, time, 2.4);

  endShape(CLOSE);

  // PATH 5

  setGradientFill(100.429, 47.1276, 109.584, 128.343, [[0, "#98E7DF"], [1, "#5ED9CD"]]);

  beginShape();

  vtx(81.0376, 111.468, time, 3.2);
  bz(91.2747, 105.849, 96.3832, 103.049, 101.696, 98.3291, time, 3.2);
  bz(107.438, 93.231, 110.84, 88.235, 114.324, 83.1062, time, 3.2);
  bz(119.463, 75.5458, 122.609, 70.9177, 124.796, 63.7864, time, 3.2);
  bz(127.074, 56.3589, 126.655, 51.649, 131.222, 46.9391, time, 3.2);
  bz(132.55, 45.5802, 135.534, 42.4948, 138.486, 43.0976, time, 3.2);
  bz(143.758, 44.1703, 145.577, 56.2874, 145.791, 62.8669, time, 3.2);
  bz(146.21, 75.7502, 141.091, 85.5889, 138.139, 91.1059, time, 3.2);
  bz(132.417, 101.793, 125.47, 108.219, 119.984, 113.205, time, 3.2);
  bz(111.463, 120.949, 104.996, 126.823, 94.6361, 129.357, time, 3.2);
  bz(90.5085, 130.369, 78.9433, 133.75, 69.6461, 128.009, time, 3.2);
  bz(67.8786, 126.915, 65.1813, 125.199, 65.1098, 122.808, time, 3.2);
  bz(65.0076, 119.314, 70.545, 117.21, 81.0376, 111.458, time, 3.2);

  endShape(CLOSE);

  // PATH 6

  setGradientFill(19.2644, 37.4573, 79.5373, 142.953, [[0, "#98E7DF"], [1, "#5ED9CD"]]);

  beginShape();

  vtx(36.2782, 51.8533, time, 4);
  bz(27.4612, 44.6301, 31.3334, 34.444, 21.8625, 36.2422, time, 4);
  bz(18.4705, 36.8858, 16.9585, 40.8908, 16.3659, 42.0759, time, 4);
  bz(14.7619, 45.2942, 13.781, 49.9632, 15.8244, 60.1084, time, 4);
  bz(18.4194, 73.0223, 23.3541, 82.1867, 24.8764, 84.9146, time, 4);
  bz(28.5135, 91.4226, 33.7751, 100.832, 44.1655, 108.311, time, 4);
  bz(46.4949, 109.986, 54.9543, 142.496, 67.3881, 144.018, time, 4);
  bz(76.0314, 145.071, 90.0283, 139.86, 86.9224, 134.323, time, 4);
  bz(83.4385, 128.101, 74.836, 97.665, 66.489, 82.3604, time, 4);
  bz(57.58, 66.0239, 46.4949, 60.2514, 36.2782, 51.8737, time, 4);

  endShape(CLOSE);

  // PATH 7

  setGradientFill(4.38173, 63.4083, 48.4872, 157.995, [[0, "#C9F2EE"], [0.03, "#C4F1EC"], [0.19, "#B0ECE6"], [0.38, "#A2E9E2"], [0.61, "#9AE7DF"], [1, "#98E7DF"]]);

  beginShape();

  vtx(11.7173, 60.374, time, 4.8);
  bz(6.28198, 61.0585, 3.39068, 67.5053, 2.42009, 69.9573, time, 4.8);
  bz(-0.900335, 78.3247, -1.51327, 89.3179, 5.16845, 106.523, time, 4.8);
  bz(12.8718, 126.343, 21.3721, 130.849, 29.147, 138.9, time, 4.8);
  bz(33.1826, 143.078, 42.8783, 152.825, 55.7309, 152.702, time, 4.8);
  bz(57.5291, 152.682, 62.4127, 152.641, 63.2811, 150.373, time, 4.8);
  bz(64.6501, 146.828, 54.6683, 141.811, 44.5436, 131.636, time, 4.8);
  bz(36.9832, 124.034, 60.2262, 128.397, 41.1312, 103.918, time, 4.8);
  bz(31.6705, 91.7904, 27.4714, 90.7482, 20.7897, 78.7538, time, 4.8);
  bz(18.6646, 74.943, 17.2343, 59.6793, 11.707, 60.374, time, 4.8);

  endShape(CLOSE);

  // PATH 8

  setGradientFill(24.3451, 125.924, 63.4138, 125.924, [[0, "#C9F2EE"], [1, "#98E7DF"]]);

  beginShape();

  vtx(32.6615, 99.8718, time, 5.6);
  bz(30.9451, 99.3201, 27.3897, 98.4108, 25.4996, 100.158, time, 5.6);
  bz(24.0488, 101.496, 23.6607, 104.316, 26.2353, 111.846, time, 5.6);
  bz(31.6706, 127.784, 41.1516, 137.898, 41.7851, 138.573, time, 5.6);
  bz(43.5117, 140.381, 57.7435, 155.257, 62.1367, 152.324, time, 5.6);
  bz(65.8658, 149.842, 60.4918, 135.906, 58.6936, 131.247, time, 5.6);
  bz(56.6401, 125.914, 52.3184, 115.105, 41.4581, 105.951, time, 5.6);
  bz(38.0968, 103.121, 34.9705, 101.159, 32.6615, 99.882, time, 5.6);

  endShape(CLOSE);

  // PATH 9

  setGradientFill(36.4622, 109.874, 72.8745, 109.874, [[0, "#C9F2EE"], [1, "#98E7DF"]]);

  beginShape();

  vtx(37.4123, 72.9814, time, 6.4);
  bz(36.6461, 77.8241, 35.9411, 85.1801, 37.0139, 93.9972, time, 6.4);
  bz(37.9027, 101.231, 39.8235, 106.727, 43.6547, 117.72, time, 6.4);
  bz(46.6584, 126.323, 45.269, 120.816, 53.7795, 141.157, time, 6.4);
  bz(56.5687, 147.819, 58.1216, 151.773, 61.8915, 152.866, time, 6.4);
  bz(65.1098, 153.806, 69.1455, 152.437, 71.2807, 149.791, time, 6.4);
  bz(74.0393, 146.368, 72.803, 141.822, 70.729, 132.698, time, 6.4);
  bz(68.6448, 123.523, 66.9692, 114.267, 64.9463, 105.082, time, 6.4);
  bz(63.3014, 97.5934, 62.147, 91.7597, 59.5009, 83.0142, time, 6.4);
  bz(56.5789, 73.3901, 54.6071, 69.334, 50.6226, 67.5767, time, 6.4);
  bz(50.0913, 67.3418, 45.0851, 65.2269, 40.978, 67.9854, time, 6.4);
  bz(38.6383, 69.5588, 37.7291, 71.9393, 37.4123, 72.9712, time, 6.4);

  endShape(CLOSE);

  // PATH 10

  setGradientFill(82.6826, 83.1572, 105.425, 131.932, [[0, "#C9F2EE"], [0.03, "#C4F1EC"], [0.19, "#B0ECE6"], [0.38, "#A2E9E2"], [0.61, "#9AE7DF"], [1, "#98E7DF"]]);

  beginShape();

  vtx(66.7139, 148.054, time, 7.2);
  bz(64.834, 146.276, 72.9052, 143.405, 82.9278, 125.822, time, 7.2);
  bz(88.5367, 115.983, 91.4076, 109.578, 92.5111, 107.187, time, 7.2);
  bz(97.7216, 95.9281, 95.8008, 93.0572, 99.1212, 81.6553, time, 7.2);
  bz(101.011, 75.1575, 106.794, 70.5293, 112.924, 70.0287, time, 7.2);
  bz(118.788, 69.5588, 123.243, 73.9622, 123.968, 74.6774, time, 7.2);
  bz(130.078, 80.7154, 129.107, 89.6448, 128.76, 92.8324, time, 7.2);
  bz(128.208, 97.8693, 126.4, 102.038, 123.672, 106.513, time, 7.2);
  bz(118.666, 114.737, 115.11, 116.525, 95.484, 133.505, time, 7.2);
  bz(95.484, 133.505, 84.1844, 143.272, 69.7687, 148.033, time, 7.2);
  bz(69.0535, 148.268, 67.4801, 148.769, 66.7036, 148.033, time, 7.2);

  endShape(CLOSE);

  // PATH 11

  setGradientFill(100.743, 103.161, 117.407, 138.909, [[0, "#C9F2EE"], [1, "#98E7DF"]]);

  beginShape();

  vtx(88.657, 135.21, time, 8);
  bz(99.6809, 128.477, 103.522, 117.484, 113.851, 105.245, time, 8);
  bz(120.503, 97.3676, 130.208, 87.907, 138.75, 85.884, time, 8);
  bz(147.475, 83.8101, 154.81, 85.5776, 158.866, 89.1841, time, 8);
  bz(164.608, 94.3026, 165.272, 103.886, 157.579, 112.499, time, 8);
  bz(150.294, 120.662, 138.137, 123.451, 125.192, 132.084, time, 8);
  bz(105.106, 145.478, 96.7282, 150.484, 77.4187, 152.528, time, 8);
  bz(68.2441, 153.498, 57.8231, 152.977, 57.0262, 150.494, time, 8);
  bz(56.2395, 148.032, 73.3422, 144.589, 88.6673, 135.221, time, 8);

  endShape(CLOSE);

  pop();
}

// CORAL 4

// coral4: procedural offset (see makeCircularWave) driving this coral's sway.
const coral4Wave = makeCircularWave(130, 110, 1.4, 1.15, 0.018, 0.025, 3.2, 2.4);
function c4v(x, y, time, phase = 0) {
  waveVertex(coral4Wave, x, y, time, phase);
}
function c4bz(x1, y1, x2, y2, x3, y3, time, phase = 0) {
  waveBezierVertex(coral4Wave, x1, y1, x2, y2, x3, y3, time, phase);
}

// DRAW CORAL 4

function drawCoral4(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001;

  // PATH 1

  setGradientFill(105.916, 37.0249, 128.066, 155.413, [[0, "#FCEDF0"], [1, "#F3AAB6"]]);

  beginShape();

  vertex(72.6229, 160.072);
  bezierVertex(36.6954, 169.741, 10.577, 131.415, 0.987382, 108.933);
  bezierVertex(0.312055, 107.352, -0.109934, 105.654, 0.0251313, 103.957);
  bezierVertex(4.00956, 56.562, 200.412, 32.9311, 221.803, 46.3608);
  bezierVertex(236.643, 55.6634, 226.918, 84.2035, 217.295, 103.191);
  bezierVertex(214.475, 108.75, 213.175, 116.172, 210.086, 121.597);
  bezierVertex(201.644, 136.508, 175.205, 160.971, 151.653, 152.267);
  bezierVertex(121.28, 141.051, 119.136, 147.558, 72.606, 160.072);

  endShape(CLOSE);

  // PATH 2

  setGradientFill(114.73, -0.00239497, 114.73, 118.302, [[0, "#F3AAB6"], [1, "#ED8495"]]);

  beginShape();

  c4v(23.1551, 117.786, time, 0);
  c4bz(-9.19311, 114.208, 0.632896, 92.4576, 12.3836, 78.8948, time, 0);
  c4bz(14.0888, 76.9311, 15.4227, 74.7011, 16.2837, 72.2548, time, 0);
  c4bz(29.5877, 34.512, 50.8437, 47.2427, 76.2697, 43.9311, time, 0);
  c4bz(102.506, 40.5196, 87.649, 0.829678, 132.389, 0.0142465, time, 0);
  c4bz(177.113, -0.801185, 122.648, 33.6799, 190.147, 28.4878, time, 0);
  c4bz(257.646, 23.279, 218.207, 94.854, 201.526, 75.9826, time, 0);
  c4bz(190.687, 63.7178, 173.382, 64.9326, 161.969, 68.2776, time, 0);
  c4bz(157.512, 69.5756, 154.439, 73.3033, 152.379, 77.4137, time, 0);
  c4bz(144.444, 93.3229, 125.012, 113.809, 92.1062, 103.491, time, 0);
  c4bz(65.6671, 95.2034, 49.9319, 100.945, 41.7604, 108.517, time, 0);
  c4bz(36.5097, 113.376, 30.2967, 118.601, 23.1382, 117.803, time, 0);

  endShape(CLOSE);

  // PATH 3

  plantFill("#F3AAB6");

  beginShape();

  c4v(37.6578, 69.6422, time, 0.5);
  c4bz(26.4811, 52.5347, 26.059, 69.8418, 27.2408, 80.742, time, 0.5);
  c4bz(27.2408, 80.8252, 27.2746, 80.9084, 27.3084, 80.975, time, 0.5);
  c4bz(40.376, 105.405, 71.6267, 99.2473, 64.3838, 97.6165, time, 0.5);
  c4bz(57.124, 95.9856, 51.6708, 91.1097, 37.6409, 69.6422, time, 0.5);

  endShape(CLOSE);

  // PATH 4T

  plantFill("#F3AAB6");

  beginShape();

  c4v(91.0761, 47.0597, time, 1);
  c4bz(50.6578, 53.3003, 57.5293, 62.2201, 66.0553, 65.8979, time, 1);
  c4bz(72.0489, 67.8283, 79.1905, 78.9947, 82.1113, 84.5529, time, 1);
  c4bz(82.1957, 84.7027, 82.2969, 84.8359, 82.4151, 84.9357, time, 1);
  c4bz(132.778, 128.553, 94.2672, 79.5272, 102.017, 54.0159, time, 1);
  c4bz(107.2, 36.9584, 112.737, 63.618, 115.928, 86.683, time, 1);
  c4bz(116.148, 88.2307, 118.495, 88.1808, 118.613, 86.6165, time, 1);
  c4bz(122.918, 26.857, 114.156, 8.10209, 108.297, 24.2443, time, 1);
  c4bz(103.367, 37.8071, 95.1621, 44.9296, 91.4815, 46.9266, time, 1);
  c4bz(91.3465, 46.9931, 91.2112, 47.0431, 91.0761, 47.0597, time, 1);

  endShape(CLOSE);

  // PATH 5

  plantFill("#F3AAB6");

  beginShape();

  c4v(206, 40.2033, time, 1.5);
  c4bz(203.873, 31.816, 181.959, 34.3621, 167.861, 37.3576, time, 1.5);
  c4bz(164.873, 37.99, 162.256, 39.7873, 160.517, 42.2668, time, 1.5);
  c4bz(129.114, 87.1655, 138.434, 97.2502, 148.395, 71.7722, time, 1.5);
  c4bz(155.148, 54.4817, 163.134, 47.8085, 167.928, 45.9779, time, 1.5);
  c4bz(169.161, 45.5119, 170.14, 46.6768, 169.853, 47.9582, time, 1.5);
  c4bz(168.435, 54.2154, 167.641, 63.4015, 172.808, 63.9673, time, 1.5);
  c4bz(180.236, 64.7827, 205.983, 30.7842, 197.896, 45.4287, time, 1.5);
  c4bz(194.334, 51.8689, 191.784, 56.8447, 190.062, 60.3394, time, 1.5);
  c4bz(189.218, 62.0535, 191.008, 63.4847, 192.494, 62.2865, time, 1.5);
  c4bz(199.568, 56.6118, 207.857, 47.6919, 205.966, 40.2366, time, 1.5);
  c4v(206, 40.2033, time, 1.5);

  endShape(CLOSE);

  pop();
}

// CORAL 5

// coral5: procedural offset (see makeBendWave) driving this coral's sway.
const coral5Bend = makeBendWave(300, 300, 180, 180, 0.65, 0.55, 1.7, 1.1, 0.025, 0.55, 0.018, 0.012, 1.3, 7, 2, 0.75, 0.015, 1.5);
function c5v(x, y, time, phase = 0) {
  waveVertex(coral5Bend, x, y, time, phase);
}
function c5bz(x1, y1, x2, y2, x3, y3, time, phase = 0) {
  waveBezierVertex(coral5Bend, x1, y1, x2, y2, x3, y3, time, phase);
}

// DRAW CORAL 5

function drawCoral5(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 0.9;

  // GRADIENT

  setGradientFill(136.217, -23.2007, 218.149, 330.109, [[0, "#98E7DF"], [0.604524, "#2EC2B4"]]);

  // MAIN SHAPE

  beginShape();

  c5v(260.072, 0.021271, time, 0);
  c5bz(275.619, 0.71893, 272.887, 13.6397, 269.578, 20.0132, time, 0);
  c5bz(275.909, 20.2772, 275.904, 32.5798, 270.486, 34.7643, time, 0);
  c5bz(265.068, 36.9488, 249.608, 56.4092, 252.51, 62.8723, time, 0);
  c5bz(254.831, 68.0424, 258.609, 101.22, 260.208, 117.163, time, 0);
  c5bz(291.395, 103.811, 284.882, 65.2344, 282.23, 45.1468, time, 0.35);
  c5bz(279.578, 25.0593, 295.996, 17.625, 308.022, 16.6667, time, 0.35);
  c5bz(320.049, 15.7085, 344.651, 28.0209, 344.297, 59.399, time, 0.35);
  c5bz(343.942, 90.7766, 306.401, 121.178, 300.751, 131.978, time, 0.35);
  c5bz(295.101, 142.778, 354.964, 156.622, 355.954, 170.932, time, 0.55);
  c5bz(356.944, 185.243, 347.511, 189.417, 333.936, 186.442, time, 0.55);
  c5bz(323.076, 184.062, 292.63, 161.003, 278.765, 149.772, time, 0.55);
  c5bz(265.976, 184.311, 234.111, 174.297, 223.225, 181.391, time, 0.8);
  c5bz(212.339, 188.485, 199.609, 239.894, 205.303, 238.674, time, 0.8);
  c5bz(210.998, 237.452, 209.16, 225.263, 217.725, 228.219, time, 1);
  c5bz(226.29, 231.176, 221.458, 237.571, 212.902, 254.211, time, 1);
  c5bz(204.345, 270.851, 209.491, 299.605, 221.026, 301.29, time, 1);
  c5bz(232.562, 302.975, 227.017, 296.021, 228.243, 289.413, time, 1);
  c5bz(229.469, 282.805, 214.818, 234.06, 237.972, 236.989, time, 1.2);
  c5bz(261.125, 239.919, 237.24, 272.855, 248.335, 274.458, time, 1.2);
  c5bz(259.43, 276.061, 253.976, 244.061, 248.794, 225.327, time, 1.2);
  c5bz(243.612, 206.592, 252.496, 188.19, 259.79, 188.176, time, 1.2);
  c5bz(267.083, 188.163, 264.291, 195.847, 261.661, 202.65, time, 1.4);
  c5bz(259.031, 209.453, 261.052, 215.753, 265.439, 221.58, time, 1.4);
  c5bz(269.827, 227.406, 310.187, 203.91, 306.628, 213.273, time, 1.6);
  c5bz(303.067, 222.638, 291.985, 228.329, 281.703, 234.624, time, 1.6);
  c5bz(271.421, 240.918, 266.879, 255.569, 273.651, 255.914, time, 1.6);
  c5bz(280.423, 256.26, 322.172, 269.476, 315.17, 277.746, time, 1.8);
  c5bz(308.167, 286.016, 310.733, 274.644, 281.249, 271.451, time, 1.8);
  c5bz(257.662, 268.897, 241.382, 309.473, 236.191, 330.079, time, 1.8);
  c5bz(225.373, 329.439, 202.855, 327.994, 199.331, 327.34, time, 2);
  c5bz(194.926, 326.523, 197.882, 317.957, 188.404, 312.553, time, 2);
  c5bz(180.822, 308.229, 167.329, 307.426, 161.531, 307.566, time, 2);
  c5bz(115.361, 286.238, 66.6017, 293.595, 86.1716, 278.998, time, 2.2);
  c5bz(101.827, 267.321, 91.33, 260.209, 84.1239, 258.112, time, 2.2);
  c5bz(67.6395, 254.445, 35.1121, 244.733, 36.8772, 235.218, time, 2.4);
  c5bz(39.0845, 223.323, 53.1995, 220.93, 67.2921, 235.849, time, 2.4);
  c5bz(81.3847, 250.768, 82.7112, 238.71, 80.0681, 238.22, time, 2.4);
  c5v(77.3131, 234.44, time, 2.4);
  c5bz(12.615, 145.679, -9.16141, 115.804, 3.39198, 108.696, time, 2.6);
  c5bz(13.5762, 102.93, 27.2525, 126.644, 32.8174, 139.221, time, 2.6);
  c5bz(28.3349, 126.541, 31.7503, 113.048, 37.886, 111.908, time, 2.8);
  c5bz(44.0217, 110.768, 54.5947, 112.73, 54.9443, 137.858, time, 2.8);
  c5bz(55.2939, 162.987, 81.1582, 202.876, 84.5645, 213.99, time, 2.8);
  c5bz(87.9707, 225.103, 118.518, 222.569, 124.654, 221.429, time, 3);
  c5bz(130.788, 220.289, 87.9984, 195.487, 103.012, 188.248, time, 3);
  c5bz(118.027, 181.009, 142.815, 219.331, 148.56, 215.384, time, 3);
  c5bz(154.305, 211.437, 108.818, 156.971, 105.297, 144.013, time, 3.2);
  c5bz(101.778, 131.056, 47.483, 106.852, 58.4238, 84.7302, time, 3.2);
  c5bz(67.1768, 67.0336, 98.7179, 109.069, 113.395, 132.3, time, 3.2);
  c5bz(100.769, 107.019, 83.1647, 56.5106, 113.75, 56.7179, time, 3.4);
  c5bz(151.981, 56.977, 131.984, 167.193, 143.179, 163.346, time, 3.4);
  c5bz(154.374, 159.498, 166.923, 113.979, 165.052, 99.5046, time, 3.4);
  c5bz(163.181, 85.0299, 139.542, 28.2379, 162.405, 22.9106, time, 3.6);
  c5bz(185.267, 17.5845, 174.317, 108.513, 180.925, 109.741, time, 3.6);
  c5bz(187.533, 110.968, 182.224, 38.8929, 207.72, 58.6627, time, 3.8);
  c5bz(228.117, 74.4786, 200.151, 127.284, 183.618, 151.711, time, 3.8);
  c5bz(180.266, 155.038, 171.244, 164.362, 161.972, 175.037, time, 3.8);
  c5bz(150.402, 188.357, 154.202, 192.268, 172.486, 211.086, time, 4);
  c5v(172.581, 211.184, time, 4);
  c5bz(187.274, 226.305, 188.331, 214.714, 187.023, 207.028, time, 4);
  c5bz(181.123, 172.029, 192.968, 146.458, 198.02, 134.788, time, 4.2);
  c5bz(201.246, 132.956, 210.147, 126.411, 212.977, 132.769, time, 4.2);
  c5bz(216.514, 140.717, 199.659, 148.764, 218.243, 151.757, time, 4.2);
  c5bz(236.827, 154.749, 237.368, 105.177, 238.921, 96.8073, time, 4.4);
  c5bz(240.474, 88.4371, 219.466, 69.0451, 222.699, 61.4423, time, 4.4);
  c5bz(225.286, 55.3602, 227.746, 62.0746, 228.653, 66.1924, time, 4.4);
  c5bz(229.307, 62.668, 225.378, 51.9131, 224.697, 40.8498, time, 4.6);
  c5bz(224.015, 29.7863, 209.633, 6.61095, 226.637, 3.3865, time, 4.6);
  c5bz(243.64, 0.162439, 238.981, 25.2725, 241.706, 25.3225, time, 4.8);
  c5bz(244.43, 25.3702, 240.639, -0.85073, 260.072, 0.021271, time, 4.8);

  endShape(CLOSE);

  // INNER SECTION

  beginShape();

  c5v(162.704, 230.175, time, 1.5);
  c5bz(158.877, 228.058, 153.586, 227.185, 147.828, 227.174, time, 1.5);
  c5bz(142.059, 227.163, 135.767, 228.016, 129.9, 229.398, time, 1.5);
  c5bz(124.034, 230.78, 118.57, 232.695, 114.46, 234.821, time, 1.5);
  c5bz(112.406, 235.882, 110.674, 237.005, 109.397, 238.152, time, 1.5);
  c5bz(108.129, 239.29, 107.257, 240.5, 107.026, 241.743, time, 1.5);
  c5bz(105.453, 250.223, 108.463, 258.921, 113.005, 266.23, time, 1.5);
  c5bz(117.55, 273.542, 123.674, 279.541, 128.459, 282.647, time, 1.5);
  c5bz(134.453, 286.539, 142.413, 288.352, 149.252, 289.106, time, 1.5);
  c5bz(152.679, 289.484, 155.84, 289.598, 158.356, 289.57, time, 1.5);
  c5bz(160.858, 289.542, 162.757, 289.373, 163.644, 289.174, time, 1.5);
  c5bz(163.846, 289.128, 164.083, 289.006, 164.194, 288.733, time, 1.5);
  c5bz(164.292, 288.495, 164.24, 288.258, 164.184, 288.1, time, 1.5);
  c5bz(164.07, 287.779, 163.802, 287.404, 163.478, 287.014, time, 1.5);
  c5bz(162.812, 286.212, 161.709, 285.117, 160.385, 283.839, time, 1.5);
  c5bz(157.719, 281.265, 154.096, 277.887, 151.005, 274.396, time, 1.5);
  c5bz(149.461, 272.652, 148.057, 270.89, 146.98, 269.197, time, 1.5);
  c5bz(145.899, 267.5, 145.164, 265.902, 144.919, 264.484, time, 1.5);
  c5bz(144.678, 263.084, 144.917, 261.883, 145.754, 260.9, time, 1.5);
  c5bz(146.609, 259.897, 148.147, 259.05, 150.647, 258.509, time, 1.5);
  c5bz(158.579, 256.794, 164.465, 260.228, 168.643, 265.29, time, 1.5);
  c5bz(172.836, 270.37, 175.268, 277.055, 176.215, 281.661, time, 1.5);
  c5v(176.259, 281.874, time, 1.5);
  c5v(176.445, 281.987, time, 1.5);
  c5bz(180.415, 284.4, 186.287, 287.512, 190.968, 288.973, time, 1.5);
  c5bz(192.141, 289.339, 193.253, 289.605, 194.249, 289.729, time, 1.5);
  c5bz(195.239, 289.852, 196.15, 289.838, 196.905, 289.615, time, 1.5);
  c5bz(197.675, 289.387, 198.296, 288.935, 198.639, 288.197, time, 1.5);
  c5bz(198.973, 287.478, 199.008, 286.562, 198.781, 285.465, time, 1.5);
  c5bz(197.683, 280.181, 193.349, 268.962, 186.973, 257.788, time, 1.5);
  c5bz(180.602, 246.624, 172.13, 235.388, 162.704, 230.175, time, 1.5);

  endShape(CLOSE);

  pop();
}

// CORAL 6

function drawCoral6(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);
  noStroke();

  setSeaweedMovement(6.5, 2.6, 0.028, 0.058, 1.5, 0.48, 1.35);

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 0.95;

  // PATH 1

  setGradientFill(65.1345, 20.7415, 66.5186, 84.5653, [[0, "#F3AAB6"], [0.35, "#F2A6B3"], [0.64, "#F09CAA"], [0.91, "#EE8B9B"], [1, "#ED8495"]]);

  beginShape();

  vtx(64.7372, 21.2133, time, 0);
  bz(66.5824, 22.5954, 67.1522, 28.278, 67.3418, 30.9503, time, 0);
  bz(67.5336, 33.6514, 66.95, 33.8551, 67.3456, 35.8379, time, 0);
  bz(67.7739, 37.9845, 68.6015, 38.4705, 70.239, 41.7068, time, 0);
  bz(70.784, 42.788, 71.9693, 45.1314, 72.5791, 47.5365, time, 0);
  bz(73.4196, 50.8478, 72.9295, 53.2732, 72.7147, 55.5389, time, 0);
  bz(71.8548, 64.6861, 75.4241, 72.7535, 77.1968, 76.7631, time, 0);
  bz(78.9007, 80.6087, 81.8441, 82.7213, 81.063, 83.8143, time, 0);
  bz(80.2384, 84.9648, 76.5663, 83.6254, 76.3526, 83.5448, time, 0);
  bz(69.8878, 81.1284, 69.9198, 74.5732, 61.4862, 58.9028, time, 0);
  bz(57.8375, 52.1224, 55.7728, 49.5286, 56.123, 45.0184, time, 0);
  bz(56.3671, 41.8383, 57.6491, 39.8144, 56.4788, 36.9297, time, 0);
  bz(54.9882, 33.2489, 50.6792, 31.3477, 50.6117, 28.8012, time, 0);
  bz(50.53, 25.7757, 56.2274, 25.1387, 57.137, 24.7203, time, 0);
  bz(58.5388, 24.0711, 62.2449, 19.3463, 64.7444, 21.2158, time, 0);

  endShape(CLOSE);

  // PATH 2

  setGradientFill(57.5859, 20.6172, 57.7703, 29.3635, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(64.7372, 21.2133, time, 0);
  bz(64.1929, 19.9997, 60.3028, 20.6277, 58.529, 21.0942, time, 0);
  bz(57.4083, 21.3887, 54.4582, 22.2072, 52.3445, 24.9171, time, 0);
  bz(52.0609, 25.2789, 49.9545, 27.9792, 50.733, 29.0473, time, 0);
  bz(51.619, 30.2603, 55.7741, 28.7098, 58.1176, 27.5005, time, 0);
  bz(61.4531, 25.7841, 65.3528, 22.5836, 64.7372, 21.2133, time, 0);

  endShape(CLOSE);

  // PATH 3

  setGradientFill(78.5472, 37.2629, 79.3956, 76.4771, [[0, "#F8CED5"], [1, "#F3AAB6"]]);

  beginShape();

  vtx(90.8373, 29.53, time, 0.7);
  bz(92.1568, 32.4131, 92.9052, 38.4216, 92.5809, 40.4653, time, 0.7);
  bz(91.9822, 44.2161, 90.1967, 46.7643, 87.1988, 50.954, time, 0.7);
  bz(83.2063, 56.534, 82.4836, 55.8104, 81.0518, 58.7961, time, 0.7);
  bz(78.3319, 64.4746, 79.3843, 70.3332, 79.7049, 71.957, time, 0.7);
  bz(80.9631, 78.464, 84.0543, 81.2417, 83.101, 82.1676, time, 0.7);
  bz(81.9807, 83.2539, 76.9361, 79.9094, 73.265, 76.6857, time, 0.7);
  bz(69.2108, 73.123, 66.7873, 70.9941, 65.662, 67.3972, time, 0.7);
  bz(63.0992, 59.2295, 69.249, 50.0182, 69.7149, 49.3326, time, 0.7);
  bz(71.9665, 46.0507, 72.8355, 44.7223, 73.0816, 40.7674, time, 0.7);
  bz(73.2538, 37.9527, 71.4843, 36.7853, 72.7071, 35.4445, time, 0.7);
  bz(74.3827, 33.6105, 89.8555, 27.3802, 90.8397, 29.5348, time, 0.7);

  endShape(CLOSE);

  // PATH 4

  setGradientFill(81.4936, 27.249, 81.7291, 38.0219, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(81.7404, 29.1492, time, 0.7);
  bz(85.0861, 27.7457, 86.0001, 26.9831, 87.6573, 27.144, time, 0.7);
  bz(89.0499, 27.2794, 90.67, 28.0345, 90.9724, 29.4633, time, 0.7);
  bz(91.2584, 30.8222, 90.2257, 32.1592, 89.7846, 32.7247, time, 0.7);
  bz(87.3411, 35.8852, 82.8234, 36.8585, 80.2959, 37.4026, time, 0.7);
  bz(77.2311, 38.0617, 73.9398, 38.7724, 72.6945, 37.2565, time, 0.7);
  bz(71.7863, 36.1444, 72.2091, 34.1301, 73.3407, 32.7383, time, 0.7);
  bz(74.7196, 31.0446, 76.1755, 31.4787, 81.7332, 29.1467, time, 0.7);

  endShape(CLOSE);

  // PATH 5

  setGradientFill(43.378, 20.1645, 44.292, 62.262, [[0, "#F3AAB6"], [0.35, "#F2A6B3"], [0.64, "#F09CAA"], [0.91, "#EE8B9B"], [1, "#ED8495"]]);

  beginShape();

  vtx(42.1293, 20.5281, time, 1.4);
  bz(43.9387, 22.2998, 43.8399, 26.6262, 45.3164, 28.538, time, 1.4);
  bz(47.6649, 31.5858, 48.8771, 30.8442, 51.0065, 33.472, time, 1.4);
  bz(53.0357, 35.9694, 52.0948, 36.8232, 54.2815, 40.8207, time, 1.4);
  bz(56.1086, 44.1615, 56.926, 43.8605, 59.2634, 47.6158, time, 1.4);
  bz(61.6364, 51.4314, 63.1676, 53.8922, 62.4363, 56.4126, time, 1.4);
  bz(61.3982, 60.0021, 56.4745, 61.2836, 55.1682, 61.6276, time, 1.4);
  bz(51.505, 62.5817, 46.3857, 62.2617, 42.9688, 59.2007, time, 1.4);
  bz(40.2103, 56.733, 41.7631, 55.3435, 37.4985, 48.1049, time, 1.4);
  bz(35.0694, 43.9809, 34.3469, 44.0611, 33.1247, 41.01, time, 1.4);
  bz(31.912, 37.9782, 31.9033, 36.0986, 30.06, 34.7936, time, 1.4);
  bz(28.1712, 33.457, 26.0817, 31.8473, 25.34, 30.6471, time, 1.4);
  bz(24.1977, 28.8045, 27.4702, 27.5811, 28.0931, 26.7881, time, 1.4);
  bz(28.6555, 26.0669, 33.5654, 19.9506, 38.3035, 21.2863, time, 1.4);
  bz(39.7619, 21.7012, 40.9614, 19.388, 42.1246, 20.5304, time, 1.4);

  endShape(CLOSE);

  // PATH 6

  setGradientFill(33.4838, 19.0549, 33.7403, 30.8074, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(40.9576, 19.222, time, 1.4);
  bz(39.967, 18.6244, 38.6381, 18.7156, 33.4548, 21.235, time, 1.4);
  bz(26.9828, 24.3777, 26.0417, 25.6936, 25.5565, 26.8147, time, 1.4);
  bz(25.4346, 27.1028, 24.3396, 29.6765, 25.3497, 30.6423, time, 1.4);
  bz(26.4173, 31.6639, 29.1929, 30.2235, 34.7082, 27.3065, time, 1.4);
  bz(41.6934, 23.6108, 42.3867, 22.279, 42.3322, 21.28, time, 1.4);
  bz(42.282, 20.3629, 41.5907, 19.5937, 40.9672, 19.2172, time, 1.4);

  endShape(CLOSE);

  // PATH 7

  setGradientFill(36.7288, 50.1702, 37.1058, 67.4727, [[0, "#F3AAB6"], [0.35, "#F2A6B3"], [0.64, "#F09CAA"], [0.91, "#EE8B9B"], [1, "#ED8495"]]);

  beginShape();

  vtx(26.0819, 37.8107, time, 2.1);
  bz(26.0819, 37.8107, 29.7399, 44.2325, 35.3657, 47.7824, time, 2.1);
  bz(41.9818, 51.966, 45.826, 48.7869, 50.9757, 53.1235, time, 2.1);
  bz(53.6823, 55.4008, 52.3239, 56.0285, 57.1079, 62.4952, time, 2.1);
  bz(61.5359, 68.4834, 64.3373, 70.162, 63.728, 72.3822, time, 2.1);
  bz(63.131, 74.5544, 59.6288, 75.981, 56.6109, 76.005, time, 2.1);
  bz(49.569, 76.069, 48.2262, 73.9293, 37.8301, 69.1974, time, 2.1);
  bz(31.0538, 66.1128, 28.7735, 62.4974, 25.3769, 58.8084, time, 2.1);
  bz(21.8752, 55.0033, 22.0276, 53.5723, 18.2742, 51.715, time, 2.1);
  bz(14.6048, 49.9064, 10.6225, 48.534, 10.1058, 47.5348, time, 2.1);
  bz(9.24157, 45.8791, 18.8919, 35.9919, 26.082, 37.7986, time, 2.1);

  endShape(CLOSE);

  // PATH 8

  setGradientFill(18.4337, 36.5958, 18.6947, 48.406, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(21.6083, 36.5245, time, 2.1);
  bz(20.4866, 36.5616, 20.2223, 36.9259, 16.555, 39.0158, time, 2.1);
  bz(13.0737, 40.9961, 12.6209, 41.0633, 11.8117, 42.0382, time, 2.1);
  bz(10.6535, 43.4372, 9.23293, 46.1413, 10.113, 47.5493, time, 2.1);
  bz(11.3127, 49.4716, 16.218, 48.0432, 17.3148, 47.7245, time, 2.1);
  bz(22.3357, 46.263, 28.0881, 42.2692, 27.2475, 39.3959, time, 2.1);
  bz(26.7281, 37.6121, 23.724, 36.4594, 21.6106, 36.5294, time, 2.1);

  endShape(CLOSE);

  // PATH 9

  setGradientFill(34.9367, 54.3234, 35.7413, 91.4773, [[0, "#F8CED5"], [1, "#F3AAB6"]]);

  beginShape();

  vtx(26.3465, 53.2789, time, 2.8);
  bz(29.0083, 53.2505, 33.0898, 57.5257, 35.263, 59.2201, time, 2.8);
  bz(39.0847, 62.2015, 38.668, 63.5468, 41.9607, 66.0151, time, 2.8);
  bz(45.5793, 68.7308, 46.7384, 67.6014, 50.0496, 70.2046, time, 2.8);
  bz(52.3065, 71.9836, 56.1994, 75.9979, 55.5515, 79.0891, time, 2.8);
  bz(54.8321, 82.4975, 49.0189, 82.7656, 47.4928, 82.8341, time, 2.8);
  bz(44.1252, 82.9884, 41.3756, 81.9382, 36.0041, 79.8288, time, 2.8);
  bz(31.8596, 78.2004, 28.2911, 76.402, 24.8689, 74.2915, time, 2.8);
  bz(20.0437, 71.3189, 16.7446, 69.5556, 15.436, 67.741, time, 2.8);
  bz(13.4492, 64.9888, 19.5034, 61.6681, 22.6574, 58.8413, time, 2.8);
  bz(24.7617, 56.9519, 24.2287, 53.291, 26.3489, 53.2717, time, 2.8);

  endShape(CLOSE);

  // PATH 10

  setGradientFill(21.089, 52.7151, 21.4321, 68.3426, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(25.8346, 52.7153, time, 2.8);
  bz(22.2934, 52.0673, 19.11, 55.4306, 17.9577, 56.6466, time, 2.8);
  bz(17.0595, 57.5994, 12.0919, 62.8442, 14.0512, 66.2099, time, 2.8);
  bz(15.1023, 68.0135, 17.7749, 68.6397, 19.7524, 68.3187, time, 2.8);
  bz(22.6573, 67.8465, 24.1731, 65.3354, 26.3787, 61.6802, time, 2.8);
  bz(27.9504, 59.0755, 29.7042, 56.1711, 28.5142, 54.244, time, 2.8);
  bz(27.7892, 53.0656, 26.2938, 52.7949, 25.8322, 52.7105, time, 2.8);

  endShape(CLOSE);

  // PATH 11

  setGradientFill(58.2005, 56.0471, 58.7557, 81.4751, [[0, "#F8CED5"], [0.85, "#F4AFBB"], [1, "#F3AAB6"]]);

  beginShape();

  vtx(60.1761, 46.6438, time, 3.5);
  bz(61.1801, 46.9888, 60.7937, 46.3633, 63.1056, 52.9389, time, 3.5);
  bz(65.2943, 59.1672, 64.8641, 62.919, 66.383, 66.2798, time, 3.5);
  bz(68.703, 71.4115, 70.1602, 73.7588, 72.431, 75.639, time, 3.5);
  bz(76.2373, 78.784, 79.0635, 79.9045, 78.7485, 81.1396, time, 3.5);
  bz(78.4434, 82.334, 75.4653, 82.5483, 73.3492, 82.6976, time, 3.5);
  bz(71.0597, 82.8605, 67.6195, 83.0866, 63.363, 81.6814, time, 3.5);
  bz(61.7152, 81.1379, 55.6764, 79.1475, 51.8983, 73.5408, time, 3.5);
  bz(49.1656, 69.4825, 50.077, 68.3253, 47.2776, 64.9958, time, 3.5);
  bz(43.5149, 60.5154, 38.6467, 58.7578, 38.1873, 56.1465, time, 3.5);
  bz(37.5109, 52.3164, 47.3292, 50.2417, 50.1453, 48.8593, time, 3.5);
  bz(54.0064, 46.9678, 59.4386, 46.4015, 60.1736, 46.651, time, 3.5);

  endShape(CLOSE);

  // PATH 12

  setGradientFill(49.127, 45.0537, 49.4269, 58.9386, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(55.5674, 44.9623, time, 3.5);
  bz(54.3959, 44.8739, 51.7489, 44.847, 46.7073, 47.4105, time, 3.5);
  bz(41.9384, 49.8336, 37.7463, 51.9663, 37.8862, 54.903, time, 3.5);
  bz(37.9702, 56.6675, 39.6044, 58.3516, 41.3219, 58.9147, time, 3.5);
  bz(43.1956, 59.5269, 44.8679, 58.7084, 51.5271, 54.3515, time, 3.5);
  bz(59.8723, 48.8874, 60.8384, 47.8291, 60.6054, 46.9061, time, 3.5);
  bz(60.2028, 45.3108, 56.4093, 45.0272, 55.5746, 44.9647, time, 3.5);

  endShape(CLOSE);

  // PATH 13

  setGradientFill(52.1441, 63.1845, 52.63, 85.515, [[0, "#FCEDF0"], [1, "#F8CED5"]]);

  beginShape();

  vtx(38.9296, 64.1018, time, 4.2);
  bz(41.3075, 64.9093, 40.7418, 67.936, 50.0879, 72.8015, time, 4.2);
  bz(59.2805, 77.5867, 67.6434, 77.1114, 70.6313, 77.2822, time, 4.2);
  bz(74.9977, 77.5353, 78.6093, 76.3548, 80.1976, 78.5055, time, 4.2);
  bz(81.1529, 79.7983, 81.0212, 81.8191, 80.3589, 83.2015, time, 4.2);
  bz(79.0952, 85.8344, 75.4082, 87.1421, 62.0579, 87.3944, time, 4.2);
  bz(41.1911, 87.7947, 34.9408, 84.8887, 32.3135, 83.4902, time, 4.2);
  bz(30.7132, 82.6413, 27.6297, 81.9117, 25.7231, 79.8819, time, 4.2);
  bz(24.6274, 78.7182, 23.985, 76.5511, 24.0699, 75.1534, time, 4.2);
  bz(24.2263, 72.5745, 27.1373, 70.5934, 30.7875, 68.1159, time, 4.2);
  bz(33.8434, 66.0394, 36.1746, 63.1623, 38.9345, 64.0995, time, 4.2);

  endShape(CLOSE);

  // PATH 14

  setGradientFill(31.9586, 63.9688, 32.3265, 80.754, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(34.4955, 65.1839, time, 4.2);
  bz(30.1763, 67.2293, 28.0167, 68.252, 26.7234, 69.7175, time, 4.2);
  bz(25.3889, 71.2334, 23.495, 73.379, 24.0029, 76.3563, time, 4.2);
  bz(24.2405, 77.751, 25.0694, 79.7121, 26.5401, 80.5169, time, 4.2);
  bz(28.2747, 81.4676, 30.009, 80.3126, 33.1859, 78.1165, time, 4.2);
  bz(37.2084, 75.3354, 39.4673, 73.7718, 40.1357, 70.4426, time, 4.2);
  bz(40.5616, 68.3128, 40.4088, 65.0944, 38.9826, 64.0877, time, 4.2);
  bz(38.2731, 63.5856, 37.4706, 63.7832, 34.4979, 65.1888, time, 4.2);

  endShape(CLOSE);

  // PATH 15

  setGradientFill(80.3003, 54.1929, 80.9009, 81.8183, [[0, "#FCEDF0"], [0.68, "#F8CED5"]]);

  beginShape();

  vtx(89.0687, 50.074, time, 4.9);
  bz(89.9958, 52.1248, 89.0766, 55.5417, 87.8066, 59.7075, time, 4.9);
  bz(86.0659, 65.4252, 85.6048, 64.8186, 85.0655, 67.4483, time, 4.9);
  bz(83.9766, 72.7846, 86.1062, 74.1106, 84.7334, 78.579, time, 4.9);
  bz(84.3044, 79.9844, 82.9856, 84.2822, 79.3799, 85.2679, time, 4.9);
  bz(77.1336, 85.8834, 75.6848, 85.4638, 74.3675, 83.4975, time, 4.9);
  bz(73.2648, 81.8573, 72.3959, 78.89, 72.157, 71.7124, time, 4.9);
  bz(72.0294, 67.8637, 72.8051, 64.2895, 72.9689, 62.9669, time, 4.9);
  bz(73.4455, 59.1022, 70.7003, 53.8382, 71.1126, 51.9731, time, 4.9);
  bz(71.8756, 48.5312, 76.7516, 49.319, 78.3069, 48.7743, time, 4.9);
  bz(79.9586, 48.1939, 83.7202, 46.8674, 86.4934, 48.8539, time, 4.9);
  bz(87.7086, 49.7247, 88.8644, 49.6108, 89.0712, 50.0668, time, 4.9);

  endShape(CLOSE);

  // PATH 16

  setGradientFill(80.0397, 45.7422, 80.251, 55.6992, [[0, "#F3AAB6"], [0.24, "#F09CAA"], [0.74, "#ED8495"]]);

  beginShape();

  vtx(82.9548, 52.4704, time, 4.9);
  bz(86.7288, 51.5097, 88.763, 51.8027, 89.1451, 50.6184, time, 4.9);
  bz(89.5639, 49.326, 87.6181, 47.4116, 85.917, 46.5044, time, 4.9);
  bz(83.7647, 45.3637, 81.6357, 45.6573, 79.6004, 45.9708, time, 4.9);
  bz(76.4091, 46.4583, 72.3819, 47.0758, 71.3618, 50.0325, time, 4.9);
  bz(70.7087, 51.9204, 71.3166, 54.6624, 72.9623, 55.5668, time, 4.9);
  bz(74.9776, 56.6731, 76.7467, 54.0431, 82.9572, 52.4632, time, 4.9);

  endShape(CLOSE);

  pop();
}

// CORAL 7

function drawCoral7(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);
  noStroke();

  // MOVEMENT FOR GREEN PARTS

  setSeaweedMovement(6.5, 2.6, 0.032, 0.062, 1.5, 0.5, 1.35);

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 0.95;

  // PATH 1

  setGradientFill(69.1244, 30.9749, 85.2778, 53.4728, [[0.357401, "#98E7DF"], [1, "#2EC2B4"]]);

  beginShape();

  vtx(94.2045, 40.8837, time, 0);
  bz(88.1886, 41.7791, 85.3308, 47.1479, 84.6539, 49.7204, time, 0);
  bz(84.1054, 51.0202, 79.2281, 53.8647, 64.1069, 54.8443, time, 0);
  bz(48.9857, 55.8239, 57.5468, 44.7334, 63.7175, 39.0658, time, 0);
  bz(75.7067, 28.8068, 83.3897, 30.2056, 91.5803, 29.675, time, 0);
  bz(99.7709, 29.1444, 101.724, 39.7644, 94.2045, 40.8837, time, 0);

  endShape(CLOSE);

  // PATH 2

  setGradientFill(3.20548, 55.7403, 35.755, 49.3707, [[0, "#A6EAE3"], [0.701923, "#79DFD5"]]);

  beginShape();

  vtx(13.3131, 44.0177, time, 0.8);
  bz(23.1705, 40.2631, 30.6359, 45.0594, 33.1364, 47.9269, time, 0.8);
  vtx(36.2791, 57.4609, time, 0.8);
  vtx(25.2146, 62.0727, time, 0.8);
  bz(23.7758, 59.3528, 19.4649, 55.1745, 13.7313, 60.2199, time, 0.8);
  bz(7.9978, 65.2654, 4.58092, 61.8946, 3.58917, 59.5786, time, 0.8);
  bz(2.72321, 55.9561, 3.45564, 47.7723, 13.3131, 44.0177, time, 0.8);

  endShape(CLOSE);

  // PATH 3

  setGradientFill(21.289, 15.0557, 40.2251, 31.1458, [[0, "#98E7DF"], [1, "#2EC2B4"]]);

  beginShape();

  vtx(22.0778, 19.0382, time, 1.6);
  bz(20.9008, 24.6942, 23.6044, 32.6773, 25.1034, 35.9619, time, 1.6);
  vtx(33.197, 41.7782, time, 1.6);
  vtx(38.715, 37.6164, time, 1.6);
  vtx(39.9817, 27.3893, time, 1.6);
  bz(39.2732, 26.3784, 37.9105, 23.2118, 38.1283, 18.6324, time, 1.6);
  bz(38.4005, 12.9082, 39.8718, 5.8382, 33.9856, 4.31732, time, 1.6);
  bz(28.0994, 2.79644, 23.549, 11.9681, 22.0778, 19.0382, time, 1.6);

  endShape(CLOSE);

  // PATH 4

  setGradientFill(6.61023, 21.0715, 38.4821, 47.8549, [[0, "#A6EAE3"], [0.296551, "#79DFD5"]]);

  beginShape();

  vtx(7.30206, 28.55, time, 2.4);
  bz(6.4057, 38.2089, 13.9503, 43.068, 17.8347, 44.2902, time, 2.4);
  vtx(37.3515, 51.8687, time, 2.4);
  bz(37.7454, 51.4221, 39.9902, 47.747, 36.5366, 39.2888, time, 2.4);
  bz(35.029, 35.5967, 31.036, 32.6972, 26.5744, 32.3546, time, 2.4);
  bz(25.2997, 32.2567, 22.2941, 29.5641, 21.8684, 28.238, time, 2.4);
  bz(21.0738, 25.7629, 22.4388, 17.4632, 16.0418, 16.6143, time, 2.4);
  bz(10.9487, 16.3127, 8.19842, 18.891, 7.30206, 28.55, time, 2.4);

  endShape(CLOSE);

  // PATH 5

  setGradientFill(79.5275, 47.2529, 90.6437, 62.543, [[0, "#A6EAE3"], [0.721154, "#79DFD5"]]);

  beginShape();

  vtx(86.416, 46.8419, time, 3.2);
  bz(78.8928, 46.7968, 72.3915, 52.8535, 70.0813, 55.8876, time, 3.2);
  vtx(74.341, 63.5991, time, 3.2);
  bz(77.1388, 61.6429, 84.6497, 58.2719, 92.3103, 60.4382, time, 3.2);
  bz(101.886, 63.146, 100.209, 56.5984, 100.123, 55.2727, time, 3.2);
  bz(100.037, 53.947, 95.8201, 46.8983, 86.416, 46.8419, time, 3.2);

  endShape(CLOSE);

  // PATH 6

  setGradientFill(61.213, 12.6959, 86.4207, 52.2198, [[0, "#98E7DF"], [0.615385, "#5ED9CD"]]);

  beginShape();

  vtx(87.0539, 19.7768, time, 4);
  bz(79.6908, 13.5953, 62.6956, 24.4761, 55.1184, 30.6891, time, 4);
  vtx(55.3965, 51.1958, time, 4);
  bz(61.8807, 52.7336, 74.698, 54.7046, 74.0932, 50.2855, time, 4);
  bz(73.3373, 44.7618, 76.9276, 36.1008, 78.117, 34.5283, time, 4);
  bz(79.3064, 32.9558, 96.2579, 27.5036, 87.0539, 19.7768, time, 4);

  endShape(CLOSE);

  // PATH 7

  setGradientFill(46.6312, 22.1506, 62.4559, 54.4803, [[0, "#98E7DF"], [0.264423, "#5ED9CD"]]);

  beginShape();

  vtx(66.1473, 13.5679, time, 4.8);
  bz(60.0456, 8.3, 51.0292, 16.0557, 47.2838, 20.5921, time, 4.8);
  vtx(37.4524, 49.0333, time, 4.8);
  vtx(47.4658, 53.2259, time, 4.8);
  bz(52.1981, 52.9464, 61.4451, 50.2613, 60.575, 41.7576, time, 4.8);
  bz(59.4873, 31.1279, 62.4927, 25.6034, 62.9759, 24.4492, time, 4.8);
  bz(63.4592, 23.295, 73.7745, 20.1528, 66.1473, 13.5679, time, 4.8);

  endShape(CLOSE);

  // PATH 8i

  setGradientFill(30.5659, 27.4187, 58.7001, 54.6562, [[0, "#A6EAE3"], [0.375, "#79DFD5"]]);

  beginShape();

  vtx(33.8901, 33.7165, time, 5.6);
  bz(38.6248, 19.26, 48.6914, 20.1239, 53.1329, 22.3629, time, 5.6);
  bz(57.228, 25.8878, 53.5404, 28.6534, 51.6557, 29.4072, time, 5.6);
  bz(49.7711, 30.1609, 48.3756, 38.4633, 54.3146, 40.6053, time, 5.6);
  bz(59.0658, 42.3189, 58.8478, 54.2087, 58.1449, 59.9395, time, 5.6);
  vtx(53.6118, 59.6014, time, 5.6);
  vtx(38.8512, 60.5576, time, 5.6);
  bz(29.5771, 60.6531, 31.6796, 42.7033, 33.8901, 33.7165, time, 5.6);

  endShape(CLOSE);

  // PATH 9

  setGradientFill(71.1484, 102.891, 26.3477, 46.0313, [[0, "#F4B1BC"], [0.721154, "#F8D2D9"]]);

  beginShape();

  vertex(26.9205, 101.987);
  bezierVertex(-6.30033, 95.5801, 13.0843, 62.8586, 26.9829, 52.0695);
  bezierVertex(40.8815, 41.2804, 58.4442, 43.4388, 70.714, 51.12);
  bezierVertex(82.9838, 58.8012, 101.748, 86.7807, 80.3775, 98.5243);
  bezierVertex(75.84, 101.173, 64.9798, 103.349, 52.9541, 104.068);
  bezierVertex(44.7653, 104.558, 37.8878, 104.103, 26.9205, 101.987);

  endShape(CLOSE);

  // PATH 10

  setGradientFill(39.7011, 41.6021, 48.1583, 58.3881, [[0, "#A6EAE3"], [0.721154, "#79DFD5"]]);

  beginShape();

  vtx(31.2513, 57.4032, time, 6.4);
  bz(33.4785, 68.4171, 46.133, 60.0189, 52.1819, 54.443, time, 6.4);
  bz(55.0173, 51.8293, 59.6527, 49.162, 57.7443, 44.0555, time, 6.4);
  bz(55.8358, 38.949, 46.0662, 40.1067, 41.42, 41.3239, time, 6.4);
  bz(37.1024, 42.0945, 29.024, 46.3893, 31.2513, 57.4032, time, 6.4);

  endShape(CLOSE);

  pop();
}

// CORAL 8

// CORAL 8 WAVE

// coral8: procedural offset (see makeCircularWave) driving this coral's sway.
const coral8Wave = makeCircularWave(210, 180, 1.45, 1.75, 0.016, 0.023, 4.2, 3.2);
function c8v(x, y, time, phase = 0) {
  waveVertex(coral8Wave, x, y, time, phase);
}
function c8bz(x1, y1, x2, y2, x3, y3, time, phase = 0) {
  waveBezierVertex(coral8Wave, x1, y1, x2, y2, x3, y3, time, phase);
}

// DRAW CORAL 8

function drawCoral8(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001;

  // PATH 1

  setGradientFill(131.623, 69.399, 83.4754, 223.458, [[0, "#FCEDF0"], [1, "#F3AAB6"]]);

  beginShape();

  vertex(156.713, 238.461);
  bezierVertex(203.606, 257.183, 244.996, 210.482, 261.547, 182.15);
  bezierVertex(262.712, 180.158, 263.555, 177.97, 263.646, 175.69);
  bezierVertex(265.902, 112.015, 4.85315, 48.5297, -26.1549, 62.8965);
  bezierVertex(-47.6649, 72.8444, -39.145, 112.384, -29.2241, 139.205);
  bezierVertex(-26.3167, 147.057, -25.7586, 157.139, -22.4655, 164.858);
  bezierVertex(-13.482, 186.064, 18.2341, 222.91, 51.3956, 215.181);
  bezierVertex(94.1596, 205.224, 96.0035, 214.227, 156.736, 238.464);

  endShape(CLOSE);

  // PATH 2

  setGradientFill(125.699, 18.7215, 106.655, 176.042, [[0, "#F3AAB6"], [1, "#ED8495"]]);

  beginShape();

  c8v(230.228, 190.304, time, 0);
  c8bz(274.427, 190.827, 264.677, 160.299, 251.014, 140.345, time, 0);
  c8bz(249.031, 137.456, 247.591, 134.273, 246.824, 130.879, time, 0);
  c8bz(234.959, 78.5171, 204.245, 91.9765, 170.491, 83.4222, time, 0);
  c8bz(135.659, 74.6027, 162.084, 24.2486, 101.881, 15.8608, time, 0);
  c8bz(41.7019, 7.47578, 109.599, 62.2195, 19.4108, 44.2965, time, 0);
  c8bz(-70.7746, 26.3513, -29.1117, 127.969, -3.57971, 105.597, time, 0);
  c8bz(13.0112, 91.0569, 36.1521, 95.4973, 51.0044, 101.808, time, 0);
  c8bz(56.806, 104.262, 60.3497, 109.721, 62.4657, 115.523, time, 0);
  c8bz(70.6054, 137.974, 93.5129, 168.388, 139.547, 160.039, time, 0);
  c8bz(176.535, 153.335, 196.83, 163.538, 206.631, 174.941, time, 0);
  c8bz(212.929, 182.26, 220.467, 190.223, 230.249, 190.329, time, 0);

  endShape(CLOSE);

  // PATH 3

  plantFill("#F3AAB6");

  beginShape();

  c8v(218.421, 123.916, time, 0.8);
  c8bz(236.247, 102.991, 234.03, 126.075, 230.682, 140.377, time, 0.8);
  c8bz(230.668, 140.488, 230.609, 140.593, 230.553, 140.676, time, 0.8);
  c8bz(208.999, 171.029, 167.847, 157.74, 177.877, 156.753, time, 0.8);
  c8bz(187.93, 155.77, 196.068, 150.176, 218.444, 123.919, time, 0.8);

  endShape(CLOSE);

  // PATH 4

  plantFill("#F3AAB6");

  beginShape();

  c8v(150.02, 85.1657, time, 1.6);
  c8bz(203.521, 100.062, 192.819, 110.802, 180.729, 114.301, time, 1.6);
  c8bz(172.336, 115.89, 160.908, 129.573, 156.074, 136.487, time, 1.6);
  c8bz(155.936, 136.673, 155.778, 136.833, 155.603, 136.947, time, 1.6);
  c8bz(80.6667, 186.728, 140.491, 127.82, 134.147, 92.63, time, 1.6);
  c8bz(129.903, 69.1009, 118.144, 103.649, 110.128, 133.8, time, 1.6);
  c8bz(109.583, 135.822, 106.427, 135.372, 106.519, 133.273, time, 1.6);
  c8bz(110.333, 53.1023, 125.168, 29.5926, 130.47, 52.0147, time, 1.6);
  c8bz(134.935, 70.8552, 144.853, 81.6661, 149.495, 84.9224, time, 1.6);
  c8bz(149.666, 85.033, 149.841, 85.1215, 150.02, 85.1657, time, 1.6);

  endShape(CLOSE);

  // PATH 5

  plantFill("#F3AAB6");

  beginShape();

  c8v(-3.85368, 57.2878, time, 2.4);
  c8bz(0.365135, 46.4817, 29.5073, 53.4448, 48.0358, 59.7294, time, 2.4);
  c8bz(51.9638, 61.0581, 55.2037, 63.8754, 57.1496, 67.4566, time, 2.4);
  c8bz(92.2694, 132.289, 78.0783, 144.178, 68.7468, 108.671, time, 2.4);
  c8bz(62.4232, 84.5762, 52.7286, 74.3986, 46.5573, 71.1816, time, 2.4);
  c8bz(44.9703, 70.3608, 43.4622, 71.75, 43.643, 73.5009, time, 2.4);
  c8bz(44.5482, 82.0532, 44.1396, 94.3983, 37.0817, 94.3074, time, 2.4);
  c8bz(26.9328, 94.1791, -2.31458, 44.7651, 6.23362, 65.5594, time, 2.4);
  c8bz(10.0008, 74.7051, 12.6378, 81.738, 14.3975, 86.6664, time, 2.4);
  c8bz(15.2599, 89.0835, 12.6161, 90.6946, 10.8054, 88.8587, time, 2.4);
  c8bz(2.17937, 80.1577, -7.56352, 66.943, -3.81346, 57.3375, time, 2.4);

  endShape(CLOSE);

  pop();
}

// CORAL 9

// CORAL 9 WAVE

// coral9: procedural offset (see makeCircularWave) driving this coral's sway.
const coral9Wave = makeCircularWave(150, 130, 1.45, 1.55, 0.018, 0.025, 3.8, 2.8);
function c9v(x, y, time, phase = 0) {
  waveVertex(coral9Wave, x, y, time, phase);
}
function c9bz(x1, y1, x2, y2, x3, y3, time, phase = 0) {
  waveBezierVertex(coral9Wave, x1, y1, x2, y2, x3, y3, time, phase);
}

// DRAW CORAL 9

function drawCoral9(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001;

  // PATH 1

  setGradientFill(122.433, 48.5039, 88.7823, 156.178, [[0, "#FCEDF0"], [1, "#F3AAB6"]]);

  beginShape();

  vertex(139.969, 166.664);
  bezierVertex(172.743, 179.749, 201.672, 147.109, 213.239, 127.307);
  bezierVertex(214.054, 125.915, 214.642, 124.385, 214.706, 122.792);
  bezierVertex(216.283, 78.2885, 33.8322, 33.918, 12.1602, 43.9592);
  bezierVertex(-2.87343, 50.912, 3.08126, 78.5469, 10.0151, 97.2925);
  bezierVertex(12.0471, 102.78, 12.4372, 109.827, 14.7388, 115.221);
  bezierVertex(21.0175, 130.043, 43.1843, 155.795, 66.3613, 150.393);
  bezierVertex(96.2497, 143.434, 97.5384, 149.726, 139.985, 166.666);

  endShape(CLOSE);

  // PATH 2

  setGradientFill(118.293, 13.0847, 104.983, 123.038, [[0, "#F3AAB6"], [1, "#ED8495"]]);

  beginShape();

  c9v(191.35, 133.006, time, 0.4);
  c9bz(222.241, 133.372, 215.427, 112.035, 205.878, 98.0894, time, 0.4);
  c9bz(204.491, 96.0697, 203.485, 93.845, 202.949, 91.4731, time, 0.4);
  c9bz(194.656, 54.8767, 173.19, 64.2836, 149.599, 58.3049, time, 0.4);
  c9bz(125.254, 52.1408, 143.723, 16.9477, 101.647, 11.0853, time, 0.4);
  c9bz(59.5863, 5.2249, 107.04, 43.486, 44.0068, 30.9594, time, 0.4);
  c9bz(-19.0251, 18.4173, 10.0937, 89.4395, 27.9383, 73.8033, time, 0.4);
  c9bz(39.534, 63.6409, 55.7074, 66.7443, 66.0879, 71.1553, time, 0.4);
  c9bz(70.1428, 72.8702, 72.6195, 76.6853, 74.0984, 80.7406, time, 0.4);
  c9bz(79.7873, 96.4321, 95.7977, 117.689, 127.972, 111.854, time, 0.4);
  c9bz(153.823, 107.168, 168.008, 114.299, 174.857, 122.269, time, 0.4);
  c9bz(179.259, 127.384, 184.527, 132.949, 191.364, 133.024, time, 0.4);

  endShape(CLOSE);

  // PATH 3

  plantFill("#F3AAB6");

  beginShape();

  c9v(183.098, 86.6065, time, 1.2);
  c9bz(195.556, 71.9818, 194.007, 88.1154, 191.667, 98.1113, time, 1.2);
  c9bz(191.657, 98.1886, 191.616, 98.2621, 191.577, 98.3201, time, 1.2);
  c9bz(176.512, 119.534, 147.751, 110.246, 154.761, 109.557, time, 1.2);
  c9bz(161.787, 108.869, 167.475, 104.96, 183.114, 86.6084, time, 1.2);

  endShape(CLOSE);

  // PATH 4

  plantFill("#F3AAB6");

  beginShape();

  c9v(135.291, 59.5234, time, 2);
  c9bz(172.684, 69.9348, 165.204, 77.441, 156.754, 79.8865, time, 2);
  c9bz(150.888, 80.9968, 142.901, 90.5602, 139.523, 95.3928, time, 2);
  c9bz(139.426, 95.5224, 139.316, 95.6346, 139.193, 95.7139, time, 2);
  c9bz(86.8193, 130.506, 128.631, 89.335, 124.197, 64.7403, time, 2);
  c9bz(121.231, 48.2955, 113.013, 72.4415, 107.41, 93.5144, time, 2);
  c9bz(107.029, 94.9277, 104.823, 94.6136, 104.888, 93.1462, time, 2);
  c9bz(107.553, 37.1139, 117.922, 20.6826, 121.628, 36.3538, time, 2);
  c9bz(124.748, 49.5216, 131.68, 57.0775, 134.924, 59.3534, time, 2);
  c9bz(135.044, 59.4307, 135.166, 59.4926, 135.291, 59.5234, time, 2);

  endShape(CLOSE);

  // PATH 5

  plantFill("#F3AAB6");

  beginShape();

  c9v(27.7469, 40.0392, time, 2.8);
  c9bz(30.6955, 32.4867, 51.0633, 37.3533, 64.0132, 41.7457, time, 2.8);
  c9bz(66.7585, 42.6744, 69.0229, 44.6434, 70.3829, 47.1463, time, 2.8);
  c9bz(94.9287, 92.4584, 85.0103, 100.768, 78.4884, 75.9519, time, 2.8);
  c9bz(74.0687, 59.1115, 67.293, 51.9982, 62.9798, 49.7498, time, 2.8);
  c9bz(61.8706, 49.1761, 60.8166, 50.1471, 60.943, 51.3708, time, 2.8);
  c9bz(61.5757, 57.3481, 61.29, 65.9763, 56.3572, 65.9127, time, 2.8);
  c9bz(49.264, 65.823, 28.8226, 31.2869, 34.797, 45.8204, time, 2.8);
  c9bz(37.43, 52.2124, 39.273, 57.1278, 40.5029, 60.5723, time, 2.8);
  c9bz(41.1057, 62.2617, 39.2578, 63.3877, 37.9923, 62.1046, time, 2.8);
  c9bz(31.9635, 56.0233, 25.154, 46.7874, 27.775, 40.074, time, 2.8);

  endShape(CLOSE);

  pop();
}

// CORAL 10

// CORAL 10 MOVEMENT

// coral10: procedural offset (see makeBendWave) driving this coral's sway.
const coral10Bend = makeBendWave(320, 300, 115, 120, 0.6, 0.5, 1.65, 1.05, 0.021, 0.55, 0.018, 0.012, 1.25, 6, 2, 0.72, 0.015, 1.3);
function c10v(x, y, time, phase = 0) {
  waveVertex(coral10Bend, x, y, time, phase);
}
function c10bz(x1, y1, x2, y2, x3, y3, time, phase = 0) {
  waveBezierVertex(coral10Bend, x1, y1, x2, y2, x3, y3, time, phase);
}

// DRAW CORAL 10

function drawCoral10(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 0.9;

  // GRADIENT

  setGradientFill(-10.3922, 288.115, 207.101, 104.226, [[0, "#ED8495"], [1, "#FCEDF0"]]);

  // MAIN SHAPE

  beginShape();

  c10v(114.897, 330.62, time, 0);
  c10bz(122.205, 322.549, 113.561, 311.726, 118.85, 300.588, time, 0);
  c10bz(120.618, 296.857, 128.154, 292.633, 143.146, 284.358, time, 0);
  c10bz(157.644, 276.355, 165.018, 272.324, 171.241, 271.223, time, 0.2);
  c10bz(183.425, 269.058, 186.257, 273.104, 195.446, 269.455, time, 0.2);
  c10bz(196.871, 268.899, 211.633, 262.805, 212.25, 250.989, time, 0.4);
  c10bz(212.566, 244.88, 209.08, 237.467, 203.764, 235.754, time, 0.4);
  c10bz(198.574, 234.09, 194.294, 238.664, 192.017, 236.712, time, 0.4);
  c10bz(189.297, 234.387, 195.169, 227.601, 193.684, 218.668, time, 0.6);
  c10bz(192.542, 211.817, 187.132, 204.151, 181.368, 203.778, time, 0.6);
  c10bz(173.96, 203.295, 166.749, 214.932, 164.356, 224.16, time, 0.6);
  c10bz(161.92, 233.572, 165.204, 237.876, 161.612, 244.651, time, 0.7);
  c10bz(158.857, 249.848, 153.879, 252.18, 147.02, 255.772, time, 0.7);
  c10bz(140.256, 259.289, 136.123, 261.451, 130.283, 260.984, time, 0.7);
  c10bz(129.512, 260.921, 119.485, 259.966, 114.723, 252.469, time, 0.8);
  c10bz(110.364, 245.605, 113.063, 237.429, 115.756, 229.618, time, 0.8);
  c10bz(117.198, 225.426, 121.48, 214.401, 138.949, 195.435, time, 1);
  c10bz(148.909, 184.646, 154.024, 179.091, 162.883, 173.228, time, 1);
  c10bz(171, 167.848, 185.687, 159.369, 201.678, 158.143, time, 1.2);
  c10bz(203.376, 158.016, 208.134, 157.732, 212.961, 154.864, time, 1.2);
  c10bz(214.507, 153.951, 222.303, 149.286, 221.902, 142.202, time, 1.2);
  c10bz(221.738, 139.18, 220.059, 135.324, 216.68, 133.386, time, 1.4);
  c10bz(209.541, 129.286, 201.281, 137.483, 196.11, 133.531, time, 1.4);
  c10bz(193.122, 131.26, 192.81, 126.162, 193.815, 122.928, time, 1.4);
  c10bz(195.16, 118.56, 198.575, 118.484, 203.3, 113.339, time, 1.6);
  c10bz(203.984, 112.593, 213.453, 102.057, 209.872, 94.7179, time, 1.6);
  c10bz(208.741, 92.3953, 206.205, 90.2092, 203.27, 89.7412, time, 1.6);
  c10bz(195.215, 88.4916, 187.375, 100.637, 184.399, 105.263, time, 1.8);
  c10bz(178.886, 113.808, 180.187, 116.497, 174.679, 123.406, time, 1.8);
  c10bz(170.917, 128.119, 165.902, 134.429, 159.38, 134.363, time, 1.8);
  c10bz(149.06, 134.245, 142.445, 118.307, 141.476, 115.964, time, 2);
  c10bz(136.465, 103.865, 139.26, 92.8999, 140.07, 90.0832, time, 2);
  c10bz(141.904, 83.6908, 145.479, 78.9343, 152.612, 69.417, time, 2.2);
  c10bz(162.496, 56.2426, 166.569, 54.5092, 168.137, 46.7262, time, 2.2);
  c10bz(168.621, 44.2963, 170.541, 34.8232, 164.565, 29.6836, time, 2.2);
  c10bz(161.306, 26.8872, 156.482, 25.8467, 152.454, 26.8778, time, 2.4);
  c10bz(148.199, 27.9529, 146.816, 30.7906, 138.899, 42.1676, time, 2.4);
  c10bz(128.506, 57.1116, 127.194, 57.5203, 125.977, 62.2647, time, 2.4);
  c10bz(124.095, 69.6281, 125.93, 73.8277, 122.844, 75.7898, time, 2.6);
  c10bz(119.485, 77.9195, 113.026, 75.7109, 109.216, 71.9011, time, 2.6);
  c10bz(103.767, 66.4404, 106.575, 60.5047, 101.868, 57.1802, time, 2.6);
  c10bz(97.1085, 53.8245, 87.9375, 55.3591, 84.909, 60.1268, time, 2.8);
  c10bz(82.1981, 64.3711, 85.0823, 70.1426, 89.7621, 79.1802, time, 2.8);
  c10bz(97.1237, 93.4226, 102.072, 94.6073, 107.629, 106.891, time, 2.8);
  c10bz(108.954, 109.817, 111.894, 116.873, 113.135, 126.346, time, 3);
  c10bz(114.553, 137.093, 113.021, 145.231, 111.586, 152.525, time, 3);
  c10bz(108.384, 168.807, 106.082, 180.522, 96.0792, 187.006, time, 3.1);
  c10bz(94.8316, 187.814, 86.2318, 193.41, 78.0094, 190.427, time, 3.1);
  c10bz(66.106, 186.128, 64.7086, 167.413, 64.5721, 165.206, time, 3.2);
  c10bz(63.9229, 154.617, 68.3008, 153.686, 68.3461, 143.49, time, 3.2);
  c10bz(68.4149, 130.141, 61, 114.943, 48.4986, 109.158, time, 3.4);
  c10bz(41.1943, 105.771, 30.9502, 105.074, 28.2257, 109.122, time, 3.4);
  c10bz(26.4261, 111.806, 28.5148, 117.027, 32.7552, 127.369, time, 3.4);
  c10bz(36.5838, 136.691, 38.6649, 139.233, 37.3082, 141.192, time, 3.6);
  c10bz(34.9868, 144.602, 27.1022, 139.482, 17.796, 143.296, time, 3.6);
  c10bz(12.7846, 145.351, 6.80619, 150.225, 7.5737, 153.947, time, 3.6);
  c10bz(9.00959, 160.885, 32.4439, 156.935, 37.8514, 168.086, time, 3.8);
  c10bz(40.7983, 174.18, 34.8849, 177.586, 37.3507, 185.418, time, 3.8);
  c10bz(40.7043, 196.113, 53.1826, 194.285, 61.939, 206.828, time, 4);
  c10bz(69.2216, 217.259, 67.9991, 229.146, 67.5368, 233.43, time, 4);
  c10bz(66.9298, 239.356, 64.3395, 252.063, 58.7937, 252.781, time, 4);
  c10bz(54.0194, 253.389, 52.3945, 244.385, 41.2414, 236.679, time, 4.2);
  c10bz(33.1662, 231.111, 21.5593, 227.228, 18.0598, 230.808, time, 4.2);
  c10bz(14.4248, 234.549, 22.9693, 242.922, 18.7688, 252.58, time, 4.4);
  c10bz(16.1968, 258.512, 11.4445, 258.856, 11.2101, 263.597, time, 4.4);
  c10bz(10.9334, 268.944, 16.6871, 274.533, 22.4363, 276.751, time, 4.4);
  c10bz(29.2469, 279.388, 32.0187, 275.812, 43.0064, 276.605, time, 4.6);
  c10bz(46.6738, 276.877, 60.0567, 277.84, 62.3149, 284.025, time, 4.6);
  c10bz(64.1048, 288.926, 57.1513, 292.246, 55.4383, 301.844, time, 4.8);
  c10bz(53.6745, 311.661, 58.8092, 320.092, 59.6461, 321.479, time, 4.8);
  c10bz(69.1996, 337.192, 92.1482, 339.832, 106.29, 335.231, time, 5);
  c10bz(109.732, 334.103, 112.511, 333.206, 114.883, 330.597, time, 5);
  c10v(114.897, 330.62, time, 5);

  endShape(CLOSE);

  pop();
}

// CORAL 11

// CORAL 11 MOVEMENT

// coral11: procedural offset (see makeBendWave) driving this coral's sway.
const coral11Bend = makeBendWave(235, 220, 100, 100, 0.62, 0.48, 1.7, 1.05, 0.022, 0.52, 0.018, 0.012, 1.3, 5.5, 1.8, 0.7, 0.014, 1.2);
function c11v(x, y, time, phase = 0) {
  waveVertex(coral11Bend, x, y, time, phase);
}
function c11bz(x1, y1, x2, y2, x3, y3, time, phase = 0) {
  waveBezierVertex(coral11Bend, x1, y1, x2, y2, x3, y3, time, phase);
}

// DRAW CORAL 11

function drawCoral11(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);

  noStroke();

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 * 0.95;

  // GRADIENT

  setGradientFill(142.5, 250.5, 9.4932, 76.5978, [[0, "#ED8495"], [1, "#F8CED5"]]);

  // MAIN SHAPE

  beginShape();

  c11v(135.505, 230.738, time, 0);
  c11bz(138.401, 223.275, 129.662, 218.084, 130.376, 209.036, time, 0);
  c11bz(130.613, 206.007, 134.668, 201.131, 142.77, 191.52, time, 0);
  c11bz(150.604, 182.225, 154.599, 177.524, 158.57, 175.142, time, 0.2);
  c11bz(166.343, 170.469, 169.337, 172.513, 174.674, 167.602, time, 0.2);
  c11bz(175.504, 166.847, 184.017, 158.797, 181.357, 150.503, time, 0.4);
  c11bz(179.98, 146.217, 175.66, 142.025, 171.575, 142.235, time, 0.4);
  c11bz(167.589, 142.445, 165.854, 146.711, 163.786, 145.962, time, 0.4);
  c11bz(161.318, 145.073, 163.566, 138.868, 160.22, 133.108, time, 0.6);
  c11bz(157.652, 128.691, 151.95, 124.828, 147.908, 126.078, time, 0.6);
  c11bz(142.712, 127.68, 140.812, 137.573, 141.582, 144.549, time, 0.6);
  c11bz(142.37, 151.663, 145.74, 153.767, 145.049, 159.368, time, 0.8);
  c11bz(144.519, 163.665, 141.721, 166.57, 137.964, 170.834, time, 0.8);
  c11bz(134.253, 175.021, 131.988, 177.589, 127.869, 178.793, time, 0.8);
  c11bz(127.325, 178.951, 120.214, 180.913, 115, 176.997, time, 1);
  c11bz(110.226, 173.411, 109.941, 167.08, 109.746, 161, time, 1);
  c11bz(109.64, 157.739, 109.694, 149.032, 116.702, 131.416, time, 1);
  c11bz(120.704, 121.389, 122.755, 116.229, 127.288, 109.88, time, 1.2);
  c11bz(131.44, 104.057, 139.279, 94.3848, 149.903, 89.3643, time, 1.2);
  c11bz(151.032, 88.8336, 154.214, 87.395, 156.769, 84.1602, time, 1.2);
  c11bz(157.589, 83.128, 161.707, 77.8812, 159.585, 73.1108, time, 1.4);
  c11bz(158.684, 71.073, 156.53, 68.8581, 153.711, 68.4068, time, 1.4);
  c11bz(147.756, 67.4502, 144.242, 75.2492, 139.672, 73.8802, time, 1.4);
  c11bz(137.035, 73.0974, 135.492, 69.6698, 135.336, 67.1818, time, 1.6);
  c11bz(135.117, 63.8241, 137.434, 62.8802, 139.326, 58.1049, time, 1.6);
  c11bz(139.599, 57.4124, 143.331, 47.6876, 138.966, 43.5722, time, 1.6);
  c11bz(137.586, 42.269, 135.28, 41.4271, 133.149, 41.8716, time, 1.8);
  c11bz(127.311, 43.1155, 125.114, 53.5227, 124.284, 57.4837, time, 1.8);
  c11bz(122.74, 64.8045, 124.332, 66.3156, 122.365, 72.5091, time, 1.8);
  c11bz(121.02, 76.7357, 119.234, 82.3888, 114.752, 84.0467, time, 2);
  c11bz(107.66, 86.6609, 98.975, 77.4201, 97.7007, 76.0608, time, 2);
  c11bz(91.1151, 69.0424, 90.1678, 60.7656, 89.9871, 58.6156, time, 2.2);
  c11bz(89.5749, 53.7369, 90.7812, 49.5293, 93.1799, 41.1159, time, 2.2);
  c11bz(96.5076, 29.4669, 98.8428, 27.21, 97.8852, 21.444, time, 2.2);
  c11bz(97.5829, 19.6451, 96.4255, 12.6238, 90.9955, 10.6474, time, 2.4);
  c11bz(88.0356, 9.57421, 84.4626, 10.1182, 81.975, 11.8801, time, 2.4);
  c11bz(79.344, 13.7313, 79.1372, 16.0458, 76.6869, 25.9439, time, 2.4);
  c11bz(73.473, 38.9436, 72.6819, 39.5675, 73.0867, 43.1507, time, 2.6);
  c11bz(73.7192, 48.7103, 76.0702, 51.1214, 74.4705, 53.2777, time, 2.6);
  c11bz(72.7268, 55.621, 67.7309, 55.7879, 64.1299, 54.161, time, 2.6);
  c11bz(58.976, 51.8263, 59.3496, 47.0075, 55.2608, 45.9491, time, 2.8);
  c11bz(51.1284, 44.8828, 45.2526, 48.3344, 44.4237, 52.4068, time, 2.8);
  c11bz(43.6756, 56.0361, 47.1549, 59.2549, 52.7151, 64.2526, time, 2.8);
  c11bz(61.4681, 72.1318, 65.1633, 71.6547, 72.1708, 78.6573, time, 3);
  c11bz(73.8407, 80.325, 77.6932, 84.4129, 81.0138, 90.6088, time, 3);
  c11bz(84.7872, 97.6351, 85.8618, 103.636, 86.7827, 109.031, time, 3);
  c11bz(88.8383, 121.073, 90.3191, 129.737, 85.1647, 136.812, time, 3.2);
  c11bz(84.5219, 137.695, 80.0962, 143.792, 73.691, 143.887, time, 3.2);
  c11bz(64.4237, 144.038, 58.5854, 131.523, 57.9161, 130.039, time, 3.2);
  c11bz(54.7099, 122.921, 57.4631, 121.137, 54.8343, 114.107, time, 3.4);
  c11bz(51.3993, 104.902, 42.3604, 96.3788, 32.2961, 95.663, time, 3.4);
  c11bz(26.4139, 95.24, 19.2213, 97.4357, 18.4129, 100.934, time, 3.4);
  c11bz(17.8813, 103.251, 20.6728, 106.299, 26.2723, 112.309, time, 3.6);
  c11bz(31.3241, 117.724, 33.4116, 118.931, 32.9939, 120.633, time, 3.6);
  c11bz(32.2948, 123.586, 25.5635, 122.122, 20.1897, 127.178, time, 3.6);
  c11bz(17.2962, 129.902, 14.4763, 134.818, 15.9722, 137.178, time, 3.8);
  c11bz(18.7647, 141.578, 33.7717, 132.739, 40.3812, 139.001, time, 3.8);
  c11bz(43.9875, 142.425, 40.8292, 146.314, 44.5595, 151.06, time, 3.8);
  c11bz(49.6443, 157.545, 57.7072, 153.027, 66.9716, 159.373, time, 4);
  c11bz(74.6762, 164.649, 76.9406, 173.15, 77.7417, 176.219, time, 4);
  c11bz(78.872, 180.456, 80.414, 189.878, 76.806, 191.821, time, 4);
  c11bz(73.6973, 193.487, 70.2366, 187.714, 60.5937, 185.324, time, 4.2);
  c11bz(53.615, 183.601, 44.6589, 183.96, 43.1979, 187.339, time, 4.2);
  c11bz(41.6862, 190.863, 49.7178, 194.394, 49.3623, 202.138, time, 4.4);
  c11bz(49.1497, 206.893, 45.9871, 208.37, 47.0634, 211.694, time, 4.4);
  c11bz(48.2689, 215.447, 53.6643, 217.791, 58.1773, 217.815, time, 4.4);
  c11bz(63.526, 217.851, 64.4903, 214.666, 72.2165, 212.342, time, 4.6);
  c11bz(74.7972, 211.571, 84.2069, 208.738, 87.3657, 212.405, time, 4.6);
  c11bz(89.8693, 215.311, 85.9765, 219.411, 87.3079, 226.465, time, 4.8);
  c11bz(88.6617, 233.682, 94.3748, 238.143, 95.3095, 238.88, time, 4.8);
  c11bz(105.946, 247.199, 122.34, 243.021, 130.817, 236.16, time, 5);
  c11bz(132.879, 234.485, 134.547, 233.141, 135.489, 230.726, time, 5);
  c11v(135.505, 230.738, time, 5);

  endShape(CLOSE);

  pop();
}

// CORAL 12

// CORAL 12 MOVEMENT

// coral12: procedural offset (see makeBendWave) driving this coral's sway.
const coral12Bend = makeBendWave(120, 115, 65, 70, 0.68, 0.42, 1.65, 1.1, 0.03, 0.55, 0.02, 0.015, 1.25, 5, 1.6, 0.75, 0.018, 1.2);
function c12v(x, y, time, phase = 0) {
  waveVertex(coral12Bend, x, y, time, phase);
}
function c12bz(x1, y1, x2, y2, x3, y3, time, phase = 0) {
  waveBezierVertex(coral12Bend, x1, y1, x2, y2, x3, y3, time, phase);
}

// DRAW CORAL 12

function drawCoral12(x, y, s = 1, frozenTime = null) {
  push();

  translate(x, y);
  scale(s);
  noStroke();

  let time = (frozenTime !== null ? frozenTime : millis()) * 0.001 *
    0.95;

  // PATH 1

  setGradientFill(46.4275, 57.5042, 67.8872, 49.8334, [[0, "#5ED9CD"], [0.38, "#5BD7CB"], [0.62, "#53D3C7"], [0.81, "#44CCBF"], [0.98, "#30C3B5"], [1, "#2EC2B4"]]);

  beginShape();

  c12v(53.4945, 23.9829, time, 0);
  c12bz(48.0073, 27.7133, 45.8428, 33.5318, 45.3519, 34.9247, time, 0);
  c12bz(42.442, 43.2496, 44.3733, 50.7789, 45.1116, 53.5217, time, 0);
  c12bz(46.9336, 60.256, 50.2492, 64.5259, 54.6566, 70.1948, time, 0);
  c12bz(59.6617, 76.6321, 65.4879, 82.1302, 66.1831, 81.5723, time, 0);
  c12bz(66.7581, 81.1111, 75.3916, 79.9354, 72.9073, 72.6844, time, 0);
  c12bz(70.3293, 65.1711, 64.1164, 68.3201, 60.8247, 56.0439, time, 0);
  c12bz(58.9315, 48.9786, 60.2619, 43.6869, 60.2591, 36.4907, time, 0);
  c12bz(60.2613, 33.6177, 61.1868, 29.4327, 59.0861, 25.5693, time, 0);
  c12bz(57.7574, 23.1317, 55.4276, 22.673, 53.4945, 23.9829, time, 0);

  endShape(CLOSE);

  // PATH 2

  setGradientFill(60.5995, 29.3331, 93.1351, 62.2454, [[0, "#5ED9CD"], [0.38, "#5BD7CB"], [0.62, "#53D3C7"], [0.81, "#44CCBF"], [0.98, "#30C3B5"], [1, "#2EC2B4"]]);

  beginShape();

  c12v(77.1641, 13.8203, time, 0.7);
  c12bz(75.6512, 14.2736, 74.7308, 15.3492, 74.4067, 15.7409, time, 0.7);
  c12bz(72.1727, 18.4295, 72.7003, 22.0884, 73.1343, 26.2382, time, 0.7);
  c12bz(73.9942, 34.4397, 74.4312, 38.5413, 73.9349, 41.7254, time, 0.7);
  c12bz(73.4355, 44.9577, 72.1625, 47.8881, 69.6221, 53.7467, time, 0.7);
  c12bz(66.912, 59.9957, 66.0454, 60.413, 65.6828, 63.1996, time, 0.7);
  c12bz(65.1386, 67.4165, 66.1552, 73.9678, 70.2729, 76.0408, time, 0.7);
  c12bz(75.0872, 78.4634, 82.3789, 73.8727, 85.9761, 68.9949, time, 0.7);
  c12bz(88.3859, 65.7255, 88.9828, 59.492, 90.0752, 47.1554, time, 0.7);
  c12bz(90.9133, 37.7013, 90.7732, 34.7312, 90.5706, 32.4897, time, 0.7);
  c12bz(90.0407, 26.6792, 89.3957, 20.5466, 84.8868, 16.5888, time, 0.7);
  c12bz(84.0639, 15.8673, 80.5761, 12.8091, 77.1581, 13.8224, time, 0.7);

  endShape(CLOSE);

  // PATH 3

  setGradientFill(26.7685, 60.9729, 57.2999, 50.0595, [[0, "#5ED9CD"], [0.38, "#5BD7CB"], [0.62, "#53D3C7"], [0.81, "#44CCBF"], [0.98, "#30C3B5"], [1, "#2EC2B4"]]);

  beginShape();

  c12v(22.8825, 38.2277, time, 1.4);
  c12bz(22.0691, 44.2695, 22.7115, 50.1878, 24.7371, 55.2148, time, 1.4);
  c12bz(26.4831, 59.5346, 31.1483, 66.6584, 39.4501, 74.359, time, 1.4);
  c12bz(43.2034, 77.8402, 47.6373, 81.8516, 54.5647, 83.4113, time, 1.4);
  c12bz(59.5755, 84.5394, 66.6559, 84.5511, 67.613, 82.0162, time, 1.4);
  c12bz(68.7161, 79.0995, 65.1086, 73.0908, 63.808, 72.1432, time, 1.4);
  c12bz(58.6827, 68.399, 56.1289, 65.451, 53.6421, 62.822, time, 1.4);
  c12bz(50.0217, 58.9973, 43.0378, 48.9624, 37.9318, 34.6779, time, 1.4);
  c12bz(36.6953, 31.2186, 35.3749, 21.5404, 30.8833, 23.0316, time, 1.4);
  c12bz(24.3527, 25.1978, 23.3711, 34.5889, 22.8766, 38.2298, time, 1.4);

  endShape(CLOSE);

  // PATH 4

  setGradientFill(51.9678, 50.2906, 80.69, 79.3464, [[0, "#98E7DF"], [1, "#5ED9CD"]]);

  beginShape();

  c12v(67.5931, 38.322, time, 2.1);
  c12bz(64.357, 37.8308, 60.5039, 40.4121, 59.0128, 45.4988, time, 2.1);
  c12bz(57.5707, 50.4403, 62.5261, 60.8034, 63.4059, 65.2781, time, 2.1);
  c12bz(67.2769, 84.9144, 60.2802, 90.4624, 64.341, 91.8494, time, 2.1);
  c12bz(68.1231, 93.1343, 73.428, 86.3345, 73.9092, 85.7051, time, 2.1);
  c12bz(79.26, 78.714, 78.2859, 70.513, 76.8168, 58.1234, time, 2.1);
  c12bz(76.8168, 58.1234, 77.4112, 50.4715, 72.4333, 41.8519, time, 2.1);
  c12bz(71.426, 40.1066, 68.9799, 38.5325, 67.5871, 38.3242, time, 2.1);

  endShape(CLOSE);

  // PATH 5

  setGradientFill(68.4629, 40.6239, 90.755, 86.1254, [[0, "#98E7DF"], [1, "#5ED9CD"]]);

  beginShape();

  c12v(70.5685, 82.231, time, 2.8);
  c12bz(75.3722, 76.8144, 77.7702, 74.1142, 79.8867, 70.25, time, 2.8);
  c12bz(82.1748, 66.0757, 83.1184, 62.4492, 84.082, 58.7281, time, 2.8);
  c12bz(85.5044, 53.2421, 86.3757, 49.8837, 86.1639, 45.2643, time, 2.8);
  c12bz(85.944, 40.4528, 84.7167, 37.7907, 86.3999, 34.0881, time, 2.8);
  c12bz(86.8917, 33.0177, 87.9895, 30.594, 89.8389, 30.3298, time, 2.8);
  c12bz(93.1404, 29.8559, 96.7305, 36.5501, 98.2287, 40.3464, time, 2.8);
  c12bz(101.162, 47.78, 100.227, 54.5917, 99.6541, 58.4286, time, 2.8);
  c12bz(98.5441, 65.8612, 95.8295, 71.0625, 93.667, 75.1179, time, 2.8);
  c12bz(90.3088, 81.4169, 87.7592, 86.1959, 82.2401, 89.8369, time, 2.8);
  c12bz(80.0416, 91.2887, 73.9957, 95.6762, 67.37, 94.2643, time, 2.8);
  c12bz(66.11, 93.995, 64.1772, 93.5558, 63.6366, 92.1751, time, 2.8);
  c12bz(62.8478, 90.1566, 65.6413, 87.7725, 70.5664, 82.225, time, 2.8);

  endShape(CLOSE);

  // PATH 6

  setGradientFill(19.0625, 51.9155, 76.2629, 100.925, [[0, "#98E7DF"], [1, "#5ED9CD"]]);

  beginShape();

  c12v(31.999, 56.7693, time, 3.5);
  c12bz(25.3445, 54.3924, 25.4794, 47.6379, 20.3257, 50.664, time, 3.5);
  c12bz(18.4798, 51.7475, 18.4329, 54.4011, 18.3342, 55.2166, time, 3.5);
  c12bz(18.0694, 57.4301, 18.4711, 60.3604, 21.781, 65.8566, time, 3.5);
  c12bz(25.9907, 72.854, 30.7838, 77.1743, 32.2418, 78.4491, time, 3.5);
  c12bz(35.7231, 81.4894, 40.7583, 85.8846, 48.3846, 88.0823, time, 3.5);
  c12bz(50.0941, 88.5743, 61.8164, 105.788, 69.3926, 104.082, time, 3.5);
  c12bz(74.6581, 102.892, 81.7419, 96.9298, 78.7732, 94.3452, time, 3.5);
  c12bz(75.441, 91.4399, 64.068, 75.4673, 56.0014, 68.2746, time, 3.5);
  c12bz(47.3916, 60.5967, 39.7158, 59.54, 32.0032, 56.7812, time, 3.5);

  endShape(CLOSE);

  // PATH 7

  setGradientFill(15.7897, 70.1709, 61.2753, 116.185, [[0, "#C9F2EE"], [0.03, "#C4F1EC"], [0.19, "#B0ECE6"], [0.38, "#A2E9E2"], [0.61, "#9AE7DF"], [1, "#98E7DF"]]);

  beginShape();

  c12v(19.4389, 66.8687, time, 4.2);
  c12bz(16.4087, 68.4026, 16.0661, 72.7694, 16.0111, 74.4034, time, 4.2);
  c12bz(15.8188, 79.981, 17.7549, 86.5265, 25.2458, 95.1761, time, 4.2);
  c12bz(33.8789, 105.139, 39.7814, 105.996, 46.0002, 109.073, time, 4.2);
  c12bz(49.2281, 110.671, 56.9221, 114.337, 64.3997, 111.584, time, 4.2);
  c12bz(65.4451, 111.197, 68.2876, 110.154, 68.3212, 108.648, time, 4.2);
  c12bz(68.3807, 106.293, 61.5067, 105.448, 53.4726, 101.62, time, 4.2);
  c12bz(47.4728, 98.7601, 61.952, 96.4567, 45.6966, 86.1508, time, 4.2);
  c12bz(37.643, 81.0453, 34.9742, 81.3132, 28.5706, 75.7054, time, 4.2);
  c12bz(26.5348, 73.9241, 22.5146, 65.3119, 19.4329, 66.8709, time, 4.2);

  endShape(CLOSE);

  // PATH 8

  setGradientFill(40.4892, 102.501, 63.2968, 94.3481, [[0, "#C9F2EE"], [1, "#98E7DF"]]);

  beginShape();

  c12v(39.9077, 85.5563, time, 4.9);
  c12bz(38.7906, 85.5924, 36.5252, 85.8035, 35.7864, 87.2178, time, 4.9);
  c12bz(35.2187, 88.3019, 35.5806, 90.029, 38.6548, 93.8875, time, 4.9);
  c12bz(45.1537, 102.058, 52.7992, 105.984, 53.3097, 106.245, time, 4.9);
  c12bz(54.695, 106.941, 66.1074, 112.655, 68.0602, 110.026, time, 4.9);
  c12bz(69.7191, 107.799, 63.6739, 100.785, 61.652, 98.4405, time, 4.9);
  c12bz(59.3403, 95.7557, 54.5618, 90.3472, 46.3115, 87.2694, time, 4.9);
  c12bz(43.7587, 86.3187, 41.5243, 85.826, 39.9098, 85.5622, time, 4.9);

  endShape(CLOSE);

  // PATH 9

  setGradientFill(44.2137, 90.6023, 65.4706, 83.004, [[0, "#C9F2EE"], [1, "#98E7DF"]]);

  beginShape();

  c12v(37.0699, 68.8668, time, 5.6);
  c12bz(37.6331, 71.8538, 38.7566, 76.2952, 41.2227, 81.2186, time, 5.6);
  c12bz(43.251, 85.2559, 45.5193, 88.0639, 50.0499, 93.682, time, 5.6);
  c12bz(53.5985, 98.0771, 51.6383, 95.1523, 60.8513, 105.251, time, 5.6);
  c12bz(63.8696, 108.558, 65.6012, 110.542, 68.0301, 110.394, time, 5.6);
  c12bz(70.105, 110.271, 72.1753, 108.63, 72.8697, 106.639, time, 5.6);
  c12bz(73.7658, 104.065, 72.0954, 101.669, 68.9808, 96.776, time, 5.6);
  c12bz(65.8496, 91.8549, 62.9399, 86.8009, 59.8423, 81.8611, time, 5.6);
  c12bz(57.3193, 77.8325, 55.4281, 74.6678, 52.0584, 70.1145, time, 5.6);
  c12bz(48.3443, 65.1059, 46.3468, 63.1495, 43.654, 62.9551, time, 5.6);
  c12bz(43.2948, 62.9288, 39.931, 62.7388, 38.1089, 65.2062, time, 5.6);
  c12bz(37.0714, 66.6129, 37.0373, 68.1924, 37.0678, 68.8609, time, 5.6);

  endShape(CLOSE);

  // PATH 10

  setGradientFill(65.6213, 65.3606, 89.0759, 89.0885, [[0, "#C9F2EE"], [0.03, "#C4F1EC"], [0.19, "#B0ECE6"], [0.38, "#A2E9E2"], [0.61, "#9AE7DF"], [1, "#98E7DF"]]);

  beginShape();

  c12v(69.8413, 106.578, time, 6.3);
  c12bz(68.3729, 105.933, 72.4856, 102.572, 74.6675, 90.2165, time, 6.3);
  c12bz(75.8889, 83.3024, 76.2281, 78.9636, 76.3734, 77.3377, time, 6.3);
  c12bz(77.0658, 69.6778, 75.3454, 68.4026, 74.9045, 61.0535, time, 6.3);
  c12bz(74.652, 56.8658, 77.062, 52.9573, 80.5362, 51.3859, time, 6.3);
  c12bz(83.8616, 49.8878, 87.3809, 51.5289, 87.9536, 51.795, time, 6.3);
  c12bz(92.7803, 54.045, 94.077, 59.4604, 94.5394, 61.3937, time, 6.3);
  c12bz(95.2684, 64.4492, 95.0825, 67.26, 94.4239, 70.4417, time, 6.3);
  c12bz(93.2176, 76.2876, 91.515, 78.0733, 83.6009, 92.0815, time, 6.3);
  c12bz(83.6009, 92.0815, 79.0425, 100.141, 71.6203, 105.929, time, 6.3);
  c12bz(71.2519, 106.215, 70.4378, 106.836, 69.831, 106.568, time, 6.3);

  endShape(CLOSE);

  // PATH 11

  setGradientFill(80.339, 73.2693, 97.5265, 90.6613, [[0, "#C9F2EE"], [1, "#98E7DF"]]);

  beginShape();

  c12v(79.9712, 94.5015, time, 7);
  c12bz(85.0017, 88.2707, 84.9503, 81.0514, 88.4262, 71.7508, time, 7);
  c12bz(90.6652, 65.7644, 94.3571, 58.216, 98.9212, 55.2528, time, 7);
  c12bz(103.582, 52.2214, 108.233, 51.7225, 111.354, 52.9815, time, 7);
  c12bz(115.774, 54.7715, 118.161, 60.2274, 115.467, 66.8607, time, 7);
  c12bz(112.918, 73.1463, 106.403, 77.3115, 100.647, 85.0526, time, 7);
  c12bz(91.7163, 97.0632, 87.8702, 101.734, 77.0241, 106.956, time, 7);
  c12bz(71.8706, 109.437, 65.6783, 111.308, 64.695, 110.025, time, 7);
  c12bz(63.722, 108.751, 72.9878, 103.173, 79.9793, 94.5054, time, 7);

  endShape(CLOSE);

  pop();
}
