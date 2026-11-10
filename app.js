const canvas = document.querySelector("#willow-canvas");
const context = canvas.getContext("2d");
const phraseInput = document.querySelector("#phrase-input");
const windInput = document.querySelector("#wind-input");
const densityInput = document.querySelector("#density-input");
const pauseButton = document.querySelector("#pause-button");
const resetButton = document.querySelector("#reset-button");

const state = {
  width: 0,
  height: 0,
  dpr: 1,
  glyphs: [],
  leaves: [],
  phrase: phraseInput.value,
  wind: Number(windInput.value) / 100,
  density: Number(densityInput.value),
  paused: false,
  lastTime: performance.now(),
  sceneTime: 0,
  pointer: {
    x: 0,
    y: 0,
    active: false,
  },
};

const colors = {
  skyTop: "#101817",
  skyBottom: "#0d1821",
  moon: "rgba(248, 233, 184, 0.88)",
  branch: "rgba(43, 62, 48, 0.86)",
  twig: "rgba(91, 117, 82, 0.58)",
  leaf: "rgba(155, 181, 117, 0.38)",
  glyph: "rgba(249, 242, 214, 0.78)",
  glyphWarm: "rgba(244, 201, 93, 0.66)",
};

const fallbackGlyphs = "가나다라마바사아자차카타파하봄여름가을겨울달빛바람숲물결";
const hangulStart = 0xac00;
const hangulEnd = 0xd7a3;
const choseong = [
  "ᄀ",
  "ᄁ",
  "ᄂ",
  "ᄃ",
  "ᄄ",
  "ᄅ",
  "ᄆ",
  "ᄇ",
  "ᄈ",
  "ᄉ",
  "ᄊ",
  "ᄋ",
  "ᄌ",
  "ᄍ",
  "ᄎ",
  "ᄏ",
  "ᄐ",
  "ᄑ",
  "ᄒ",
];
const jungseong = [
  "ᅡ",
  "ᅢ",
  "ᅣ",
  "ᅤ",
  "ᅥ",
  "ᅦ",
  "ᅧ",
  "ᅨ",
  "ᅩ",
  "ᅪ",
  "ᅫ",
  "ᅬ",
  "ᅭ",
  "ᅮ",
  "ᅯ",
  "ᅰ",
  "ᅱ",
  "ᅲ",
  "ᅳ",
  "ᅴ",
  "ᅵ",
];
const jongseong = [
  "",
  "ᆨ",
  "ᆩ",
  "ᆪ",
  "ᆫ",
  "ᆬ",
  "ᆭ",
  "ᆮ",
  "ᆯ",
  "ᆰ",
  "ᆱ",
  "ᆲ",
  "ᆳ",
  "ᆴ",
  "ᆵ",
  "ᆶ",
  "ᆷ",
  "ᆸ",
  "ᆹ",
  "ᆺ",
  "ᆻ",
  "ᆼ",
  "ᆽ",
  "ᆾ",
  "ᆿ",
  "ᇀ",
  "ᇁ",
  "ᇂ",
];
const archaicVowels = {
  "ᅡ": ["ᆞ", "ᅡ", "ᆞ"],
  "ᅢ": ["ᆡ", "ᅢ", "ᆡ"],
  "ᅣ": ["ᅣ", "ᆞ", "ᅣ"],
  "ᅤ": ["ᅤ", "ᆡ"],
  "ᅥ": ["ᅥ", "ᆞ", "ᅥ"],
  "ᅦ": ["ᆡ", "ᅦ"],
  "ᅧ": ["ᅧ", "ᆞ", "ᅧ"],
  "ᅨ": ["ᅨ", "ᆡ"],
  "ᅩ": ["ᅩ"],
  "ᅪ": ["ᅪ", "ᆞ"],
  "ᅫ": ["ᅫ", "ᆡ"],
  "ᅬ": ["ᅬ"],
  "ᅭ": ["ᅭ"],
  "ᅮ": ["ᅮ"],
  "ᅯ": ["ᅯ", "ᆞ"],
  "ᅰ": ["ᅰ", "ᆡ"],
  "ᅱ": ["ᅱ"],
  "ᅲ": ["ᅲ"],
  "ᅳ": ["ᅳ", "ᆞ"],
  "ᅴ": ["ᅴ", "ᆡ"],
  "ᅵ": ["ᅵ"],
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function characterPool() {
  const source = state.phrase.trim().length > 0 ? state.phrase : fallbackGlyphs;
  const tokens = archaicizePhrase(source);
  return tokens.length > 0 ? tokens : archaicizePhrase(fallbackGlyphs);
}

function archaicizePhrase(phrase) {
  const tokens = [];
  let wordOffset = 0;
  let index = 0;

  for (const character of Array.from(phrase)) {
    if (/\s/.test(character)) {
      wordOffset = 0;
      continue;
    }

    const seed = hashText(`${character}:${index}:${wordOffset}`);
    const token = archaicizeCharacter(character, seed, wordOffset === 0);
    if (token) {
      tokens.push(token);
    }

    wordOffset += 1;
    index += 1;
  }

  return tokens;
}

function archaicizeCharacter(character, seed, isWordInitial) {
  if (!isHangulSyllable(character)) {
    return { text: character, tone: 0 };
  }

  const decomposed = decomposeHangulSyllable(character);
  const initial = archaicInitial(decomposed.initial, seed, isWordInitial);
  const medial = pickBySeed(archaicVowels[decomposed.medial] ?? [decomposed.medial], seed >> 3);
  const final = archaicFinal(decomposed.final, seed >> 6);

  return {
    text: `${initial}${medial}${final}`,
    tone: archaicTone(seed),
  };
}

function isHangulSyllable(character) {
  const codePoint = character.codePointAt(0);
  return codePoint >= hangulStart && codePoint <= hangulEnd;
}

function decomposeHangulSyllable(character) {
  const syllableIndex = character.codePointAt(0) - hangulStart;
  const initialIndex = Math.floor(syllableIndex / 588);
  const medialIndex = Math.floor((syllableIndex % 588) / 28);
  const finalIndex = syllableIndex % 28;

  return {
    initial: choseong[initialIndex],
    medial: jungseong[medialIndex],
    final: jongseong[finalIndex],
  };
}

function archaicInitial(initial, seed, isWordInitial) {
  if (initial === "ᄋ") {
    return pickBySeed(["ᅌ", "ᄋ", "ᅌ"], seed);
  }

  if (initial === "ᄉ" && !isWordInitial) {
    return pickBySeed(["ᅀ", "ᄉ", "ᅀ"], seed);
  }

  if (initial === "ᄇ") {
    return pickBySeed(["ᄫ", "ᄇ", "ᄇ"], seed);
  }

  if (initial === "ᄒ") {
    return pickBySeed(["ᄒ", "ᅙ", "ᄒ"], seed);
  }

  return initial;
}

function archaicFinal(final, seed) {
  if (final === "ᆼ") {
    return pickBySeed(["ᇰ", "ᆼ", "ᇰ"], seed);
  }

  if (final === "ᆺ") {
    return pickBySeed(["ᇫ", "ᆺ"], seed);
  }

  return final;
}

function archaicTone(seed) {
  const value = seed % 9;
  if (value === 0) {
    return 2;
  }
  if (value < 4) {
    return 1;
  }
  return 0;
}

function pickBySeed(options, seed) {
  return options[Math.abs(seed) % options.length];
}

function hashText(text) {
  let hash = 2166136261;
  for (const character of Array.from(text)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function resize() {
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = window.innerWidth;
  state.height = window.innerHeight;
  canvas.width = Math.floor(state.width * state.dpr);
  canvas.height = Math.floor(state.height * state.dpr);
  canvas.style.width = `${state.width}px`;
  canvas.style.height = `${state.height}px`;
  context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  seedScene();
}

function seedScene() {
  const pool = characterPool();
  const glyphCount = Math.floor(state.density);
  state.glyphs = Array.from({ length: glyphCount }, (_, index) => createGlyph(pool, index));
  state.leaves = Array.from({ length: Math.max(36, Math.floor(glyphCount * 0.78)) }, createLeaf);
}

function createGlyph(pool, index) {
  const token = pool[index % pool.length];
  const x = Math.random() * state.width;
  const y = Math.random() * state.height;
  return {
    text: token.text,
    tone: token.tone,
    x,
    y,
    originX: x,
    originY: y,
    vx: (Math.random() - 0.5) * 10,
    vy: 12 + Math.random() * 34,
    size: 17 + Math.random() * 34,
    alpha: 0.34 + Math.random() * 0.58,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.7,
    sway: Math.random() * Math.PI * 2,
    warm: Math.random() > 0.74,
  };
}

function createLeaf() {
  return {
    x: Math.random() * state.width,
    y: Math.random() * state.height,
    size: 4 + Math.random() * 12,
    speed: 10 + Math.random() * 26,
    sway: Math.random() * Math.PI * 2,
    alpha: 0.16 + Math.random() * 0.32,
  };
}

function drawBackground(time) {
  const gradient = context.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, colors.skyTop);
  gradient.addColorStop(0.52, "#1d2922");
  gradient.addColorStop(1, colors.skyBottom);
  context.fillStyle = gradient;
  context.fillRect(0, 0, state.width, state.height);

  const moonX = state.width * 0.22 + Math.sin(time * 0.00011) * 12;
  const moonY = state.height * 0.2;
  const moonRadius = clamp(state.width * 0.055, 42, 86);
  const moonGlow = context.createRadialGradient(moonX, moonY, 8, moonX, moonY, moonRadius * 4.2);
  moonGlow.addColorStop(0, "rgba(248, 233, 184, 0.34)");
  moonGlow.addColorStop(0.28, "rgba(248, 233, 184, 0.12)");
  moonGlow.addColorStop(1, "rgba(248, 233, 184, 0)");
  context.fillStyle = moonGlow;
  context.beginPath();
  context.arc(moonX, moonY, moonRadius * 4.2, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = colors.moon;
  context.beginPath();
  context.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  context.fill();
}

function drawWillow(time) {
  const trunkX = state.width * 0.68;
  const trunkTop = -40;
  const trunkBottom = state.height * 0.92;
  const bend = Math.sin(time * 0.0004) * 8;

  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = colors.branch;
  context.lineWidth = clamp(state.width * 0.018, 16, 34);
  context.beginPath();
  context.moveTo(trunkX, trunkTop);
  context.bezierCurveTo(
    trunkX - state.width * 0.05 + bend,
    state.height * 0.25,
    trunkX + state.width * 0.035,
    state.height * 0.58,
    trunkX - state.width * 0.015,
    trunkBottom,
  );
  context.stroke();

  const branchCount = state.width < 700 ? 13 : 19;
  for (let i = 0; i < branchCount; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const startY = state.height * (0.04 + i * 0.043);
    const startX = trunkX + side * (2 + (i % 4) * 1.5);
    const length = state.height * (0.3 + Math.sin(i) * 0.055);
    const reach = side * state.width * (0.1 + (i % 5) * 0.026);
    const sway = Math.sin(time * 0.0011 + i) * (8 + state.wind * 18);

    context.strokeStyle = colors.twig;
    context.lineWidth = clamp(7 - i * 0.14, 2.2, 7);
    context.beginPath();
    context.moveTo(startX, startY);
    context.bezierCurveTo(
      startX + reach * 0.34 + sway,
      startY + length * 0.18,
      startX + reach * 0.9 + sway * 0.6,
      startY + length * 0.54,
      startX + reach * 0.72 + sway,
      startY + length,
    );
    context.stroke();

    drawLeafCluster(startX + reach * 0.72 + sway, startY + length, i, time);
  }
}

function drawLeafCluster(x, y, seed, time) {
  const count = 7;
  for (let i = 0; i < count; i += 1) {
    const offset = i - Math.floor(count / 2);
    const leafX = x + offset * 6 + Math.sin(time * 0.001 + seed + i) * 4;
    const leafY = y - i * 16;
    context.save();
    context.translate(leafX, leafY);
    context.rotate(Math.sin(time * 0.0014 + seed + i) * 0.7);
    context.fillStyle = colors.leaf;
    context.beginPath();
    context.ellipse(0, 0, 4, 13, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function updateGlyph(glyph, delta, time) {
  const breeze = (state.wind - 0.5) * 40;
  const sway = Math.sin(time * 0.0017 + glyph.sway) * (10 + state.wind * 28);
  glyph.x += (glyph.vx + breeze + sway * 0.04) * delta;
  glyph.y += glyph.vy * delta;
  glyph.rotation += glyph.spin * delta;

  if (state.pointer.active) {
    const dx = glyph.x - state.pointer.x;
    const dy = glyph.y - state.pointer.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 150) {
      const force = (150 - distance) / 150;
      glyph.x += (dx / Math.max(distance, 1)) * force * 72 * delta;
      glyph.y += (dy / Math.max(distance, 1)) * force * 72 * delta;
    }
  }

  if (glyph.y > state.height + 80 || glyph.x < -120 || glyph.x > state.width + 120) {
    const pool = characterPool();
    const replacement = createGlyph(pool, Math.floor(Math.random() * pool.length));
    glyph.text = replacement.text;
    glyph.tone = replacement.tone;
    glyph.x = Math.random() * state.width;
    glyph.y = -60 - Math.random() * state.height * 0.25;
    glyph.vx = replacement.vx;
    glyph.vy = replacement.vy;
    glyph.size = replacement.size;
    glyph.alpha = replacement.alpha;
    glyph.rotation = replacement.rotation;
    glyph.spin = replacement.spin;
    glyph.sway = replacement.sway;
    glyph.warm = replacement.warm;
  }
}

function drawGlyph(glyph, time) {
  const bob = Math.sin(time * 0.002 + glyph.sway) * 8;
  context.save();
  context.translate(glyph.x, glyph.y + bob);
  context.rotate(glyph.rotation);
  context.globalAlpha = glyph.alpha;
  context.fillStyle = glyph.warm ? colors.glyphWarm : colors.glyph;
  context.font = `${glyph.size}px "HCR Batang", "함초롬바탕", "Noto Serif CJK KR", "Noto Serif KR", "Batang", "Malgun Gothic", "맑은 고딕", serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "rgba(244, 201, 93, 0.18)";
  context.shadowBlur = glyph.warm ? 18 : 8;
  context.fillText(glyph.text, 0, 0);
  drawToneMarks(glyph);
  context.restore();
}

function drawToneMarks(glyph) {
  if (glyph.tone === 0) {
    return;
  }

  const dotRadius = clamp(glyph.size * 0.055, 1.4, 3.2);
  const dotX = -glyph.size * 0.54;
  const firstDotY = glyph.tone === 1 ? 0 : -dotRadius * 1.85;

  context.save();
  context.shadowBlur = 0;
  context.fillStyle = glyph.warm ? colors.glyphWarm : colors.glyph;

  for (let i = 0; i < glyph.tone; i += 1) {
    context.beginPath();
    context.arc(dotX, firstDotY + i * dotRadius * 3.7, dotRadius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function updateAndDrawLeaves(delta, time) {
  context.fillStyle = colors.leaf;
  for (const leaf of state.leaves) {
    leaf.x += ((state.wind - 0.45) * 34 + Math.sin(time * 0.0015 + leaf.sway) * 12) * delta;
    leaf.y += leaf.speed * delta;

    if (leaf.y > state.height + 24 || leaf.x < -24 || leaf.x > state.width + 24) {
      leaf.x = Math.random() * state.width;
      leaf.y = -24;
    }

    context.save();
    context.translate(leaf.x, leaf.y);
    context.rotate(Math.sin(time * 0.002 + leaf.sway));
    context.globalAlpha = leaf.alpha;
    context.beginPath();
    context.ellipse(0, 0, leaf.size * 0.38, leaf.size, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.globalAlpha = 1;
}

function frame(now) {
  const rawDelta = Math.min((now - state.lastTime) / 1000, 0.035);
  const delta = state.paused ? 0 : rawDelta;
  state.lastTime = now;
  state.sceneTime += delta * 1000;
  const time = state.sceneTime;

  drawBackground(time);
  drawWillow(time);
  updateAndDrawLeaves(delta, time);

  for (const glyph of state.glyphs) {
    if (!state.paused) {
      updateGlyph(glyph, delta, time);
    }
    drawGlyph(glyph, time);
  }

  requestAnimationFrame(frame);
}

phraseInput.addEventListener("input", () => {
  state.phrase = phraseInput.value;
  seedScene();
});

windInput.addEventListener("input", () => {
  state.wind = Number(windInput.value) / 100;
});

densityInput.addEventListener("input", () => {
  state.density = Number(densityInput.value);
  seedScene();
});

pauseButton.addEventListener("click", () => {
  state.paused = !state.paused;
  pauseButton.textContent = state.paused ? "흐름" : "멈춤";
  pauseButton.setAttribute("aria-pressed", String(state.paused));
});

resetButton.addEventListener("click", seedScene);

window.addEventListener("resize", resize);
window.addEventListener("pointermove", (event) => {
  state.pointer.x = event.clientX;
  state.pointer.y = event.clientY;
  state.pointer.active = true;
});
window.addEventListener("pointerleave", () => {
  state.pointer.active = false;
});

resize();
requestAnimationFrame(frame);
