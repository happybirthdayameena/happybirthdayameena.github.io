/* =========================================================
   Happy Birthday, Ameena — controller v2
   background music + spoken narration + game + 3D cake
   ========================================================= */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- AUDIO ENGINE ---------------- */
const Sound = (() => {
  let ctx = null, master, musicBus, sfxBus, muted = false, musicTimer = null, voices = [];

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    try { voices = speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => voices = speechSynthesis.getVoices(); } catch (_) {}
  }
  const context = () => ctx;
  function unlock() { init(); if (ctx.state === "suspended") ctx.resume(); }
  function setMuted(m) {
    muted = m; if (master) master.gain.value = m ? 0 : 1;
    if (m) { try { speechSynthesis.cancel(); } catch (_) {} }
  }
  const isMuted = () => muted;

  function note(freq, t0, dur, { type = "sine", gain = 0.5, bus = sfxBus, glide = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(bus); o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, { gain = 0.4, hp = 800, lp = 6000 } = {}) {
    const n = ctx.createBufferSource(), buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    const hpf = ctx.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = hp;
    const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = lp;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(hpf).connect(lpf).connect(g).connect(sfxBus); n.start(t0); n.stop(t0 + dur);
  }

  // ---- SFX ----
  function balloonPop() { unlock(); const t = ctx.currentTime; noise(t, 0.06, { gain: 0.7, hp: 1500, lp: 9000 }); note(150, t, 0.09, { type: "sine", gain: 0.5, glide: 0.4 }); }
  const tick    = () => { unlock(); note(880, ctx.currentTime, 0.14, { type: "triangle", gain: 0.45 }); };
  const whoosh  = () => { unlock(); noise(ctx.currentTime, 0.28, { gain: 0.22, hp: 300, lp: 3000 }); };
  const sparkle = () => { unlock(); const t = ctx.currentTime; [1320, 1760, 2200].forEach((f, i) => note(f, t + i * 0.05, 0.25, { gain: 0.18 })); };
  const chime   = () => { unlock(); const t = ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => note(f, t + i * 0.09, 0.5, { gain: 0.28 })); };
  const cheer   = () => { unlock(); const t = ctx.currentTime; noise(t, 0.6, { gain: 0.28, hp: 500, lp: 5000 }); [523, 659, 784].forEach((f, i) => note(f, t + i * 0.02, 0.6, { type: "triangle", gain: 0.22 })); sparkle(); };
  const ring    = () => { unlock(); const t = ctx.currentTime; [659, 831, 988].forEach((f, i) => note(f, t + i * 0.11, 0.42, { type: "sine", gain: 0.3 })); };

  // ---- Happy Birthday melody ----
  function happyBirthday() {
    unlock();
    const N = { G4:392, A4:440, B4:493.88, C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99 };
    const beat = 0.42;
    const seq = [["G4",.5],["G4",.5],["A4",1],["G4",1],["C5",1],["B4",2],
                 ["G4",.5],["G4",.5],["A4",1],["G4",1],["D5",1],["C5",2],
                 ["G4",.5],["G4",.5],["G5",1],["E5",1],["C5",1],["B4",1],["A4",2],
                 ["F5",.5],["F5",.5],["E5",1],["C5",1],["D5",1],["C5",2]];
    let t = ctx.currentTime + 0.1;
    // duck background music during the song
    if (musicBus) { musicBus.gain.setTargetAtTime(0.05, ctx.currentTime, 0.2); }
    seq.forEach(([n, d]) => { const dur = d * beat; note(N[n], t, dur * 0.95, { type: "sine", gain: 0.4 }); note(N[n] / 2, t, dur * 0.95, { type: "triangle", gain: 0.1 }); t += dur; });
    const total = (t - ctx.currentTime);
    if (musicBus) musicBus.gain.setTargetAtTime(0.16, ctx.currentTime + total, 0.4);
    return total * 1000;
  }

  // ---- soft background music (gentle looping arpeggio) ----
  function startMusic() {
    unlock(); if (musicTimer) return;
    const scale = [392, 440, 493.88, 587.33, 659.25]; // G pentatonic, warm
    const pad = [196, 246.94, 293.66]; // low chord
    let i = 0, bar = 0;
    const step = () => {
      if (!ctx) return;
      const t = ctx.currentTime + 0.05;
      note(scale[i % scale.length], t, 0.9, { type: "sine", gain: 0.16, bus: musicBus });
      if (i % 4 === 0) pad.forEach((f) => note(f, t, 1.8, { type: "triangle", gain: 0.06, bus: musicBus }));
      i++; if (i % 8 === 0) bar++;
    };
    step(); musicTimer = setInterval(step, 480);
  }
  function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

  // ---- spoken narration (free TTS) ----
  function pickVoice() {
    if (!voices.length) { try { voices = speechSynthesis.getVoices(); } catch (_) {} }
    return voices.find(v => /en(-|_)?(GB|IN|US)?/i.test(v.lang) && /female|zira|samantha|google uk english female|karen|tessa|aria/i.test(v.name))
        || voices.find(v => /^en/i.test(v.lang)) || voices[0] || null;
  }
  // Spoken line via the device's most natural available voice (used only for one short line).
  function narrate(text, { delay = 300 } = {}) {
    if (muted || !text) return;
    try {
      const speak = () => {
        if (muted) return;
        const vs = speechSynthesis.getVoices();
        const pick = vs.find(v => /en-?(GB|IN|AU)/i.test(v.lang) && /female|zira|hazel|heera|libby|sonia|susan|aria|neerja/i.test(v.name))
                  || vs.find(v => /female|samantha|zira|google.*female/i.test(v.name))
                  || vs.find(v => /^en/i.test(v.lang)) || vs[0];
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.9; u.pitch = 1.15; u.volume = 1; if (pick) u.voice = pick;
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      };
      setTimeout(speak, delay);
    } catch (_) {}
  }

  return { context, unlock, setMuted, isMuted, balloonPop, tick, whoosh, sparkle, chime, cheer, ring, happyBirthday, startMusic, stopMusic, narrate };
})();

/* ---------------- CONFETTI ---------------- */
const FX = (() => {
  const cv = $("#fx"), cx = cv.getContext("2d");
  let W, H, DPR, parts = [], raf = null;
  const COLORS = ["#ff2d78", "#ff69a8", "#ffc7de", "#ffffff", "#ffd58a"];
  function resize() { DPR = Math.min(devicePixelRatio || 1, 2); W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR; cv.style.width = innerWidth + "px"; cv.style.height = innerHeight + "px"; }
  addEventListener("resize", resize); resize();
  function add(x, y, o = {}) {
    if (parts.length > 320) return;
    const ang = o.ang ?? Math.random() * Math.PI * 2, spd = o.spd ?? (4 + Math.random() * 7);
    parts.push({ x: x * DPR, y: y * DPR, vx: Math.cos(ang) * spd * DPR, vy: Math.sin(ang) * spd * DPR - (o.up || 0) * DPR,
      g: (0.15 + Math.random() * 0.12) * DPR, w: (5 + Math.random() * 6) * DPR, h: (7 + Math.random() * 7) * DPR,
      rot: Math.random() * 6, vr: (Math.random() - .5) * 0.3, col: o.col || COLORS[(Math.random() * COLORS.length) | 0],
      life: o.life || (80 + Math.random() * 50), age: 0, shape: Math.random() < .5 ? "r" : "c" });
    if (!raf) loop();
  }
  function burst(x, y, n = 28) { for (let i = 0; i < n; i++) add(x, y, { up: 2 }); }
  function rain(ms = 3600, rate = 5) { const end = performance.now() + ms; (function drop() { for (let i = 0; i < rate; i++) add(Math.random() * innerWidth, -10, { ang: Math.PI / 2, spd: 1 + Math.random() * 2, life: 180 }); if (performance.now() < end) setTimeout(drop, 70); })(); }
  function loop() {
    raf = requestAnimationFrame(loop); cx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.age++; p.vx *= 0.99;
      const a = Math.max(0, 1 - p.age / p.life);
      if (a <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
      cx.save(); cx.globalAlpha = a; cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.col;
      if (p.shape === "r") cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); else { cx.beginPath(); cx.arc(0, 0, p.w / 2, 0, 7); cx.fill(); }
      cx.restore();
    }
    if (!parts.length) { cancelAnimationFrame(raf); raf = null; cx.clearRect(0, 0, W, H); }
  }
  return { burst, rain, add };
})();

/* ---------------- BACKGROUND PIANO ---------------- */
const Bgm = (() => {
  const el = $("#bgm"); let full = 0.34, muted = false, started = false;
  function start() { if (!el || started) return; started = true; el.volume = full; el.muted = muted; el.play?.().catch(() => {}); }
  function level(v) { if (el && !muted) el.volume = v; }         // soft on text pages, near-off where clips/voice play
  function setMuted(m) { muted = m; if (el) el.muted = m; }
  return { start, level, setMuted };
})();
const DUCK_BGM = new Set(["ch-her", "ch-video"]); // pages that carry their own continuous voice/clip audio

/* floating balloons over the photo (few, gentle) */
let herBalloonTimer = null;
function startHerBalloons(cont) {
  if (!cont) return; stopHerBalloons();
  const emo = ["🎈", "🎈", "🩷", "🎈", "💗"];
  herBalloonTimer = setInterval(() => {
    if (cont.children.length > 4) return;
    const b = document.createElement("span"); b.className = "bfly"; b.textContent = emo[(Math.random() * emo.length) | 0];
    b.style.left = (8 + Math.random() * 78) + "%";
    const dur = 3 + Math.random() * 2; b.style.animationDuration = dur + "s"; b.style.fontSize = (1.3 + Math.random() * 1.1) + "rem";
    cont.appendChild(b); setTimeout(() => b.remove(), dur * 1000 + 120);
  }, 950);
}
function stopHerBalloons() { if (herBalloonTimer) { clearInterval(herBalloonTimer); herBalloonTimer = null; } const c = $("#herBalloons"); if (c) c.innerHTML = ""; }

/* ---------------- NAVIGATION ---------------- */
const chapters = $$(".chapter"), progressEl = $("#progress");
let current = -1, started = false;
chapters.forEach((_, i) => { const d = document.createElement("span"); d.addEventListener("click", () => { if (started) goTo(i); }); progressEl.appendChild(d); });
const dots = $$("#progress span");
function goTo(i) {
  if (i < 0 || i >= chapters.length || i === current) return;
  const prev = current;
  if (prev >= 0) { chapters[prev].classList.remove("is-active"); onLeave[chapters[prev].id]?.(); }
  current = i; chapters[i].classList.add("is-active");
  dots.forEach((d, k) => d.classList.toggle("is-active", k === i));
  onEnter[chapters[i].id]?.();
  Bgm.level(DUCK_BGM.has(chapters[i].id) ? 0.05 : 0.34);       // duck piano where a clip/voice plays
}
$$("[data-next]").forEach((b) => b.addEventListener("click", () => { Sound.whoosh(); goTo(current + 1); }));

/* ---------------- GATE ---------------- */
const gate = $("#gate");
$("#openBtn").addEventListener("click", async () => {
  Sound.unlock(); Sound.chime();   // piano background starts later, on the name page (page 4)
  const r = $("#gateGift").getBoundingClientRect(); FX.burst(r.left + r.width / 2, r.top + r.height / 2, 44);
  gate.classList.add("is-gone"); progressEl.classList.add("is-on"); started = true;
  await sleep(600); gate.style.display = "none"; goTo(0);
});
const audioBtn = $("#audioBtn");
audioBtn.addEventListener("click", () => {
  const m = !Sound.isMuted(); Sound.setMuted(m); Bgm.setMuted(m); audioBtn.classList.toggle("is-muted", m);
  ["#introVideo", "#finaleVideo"].forEach((s) => { const el = $(s); if (el) el.muted = m; });
  const song = $("#song"); if (song) { song.muted = m; if (m) song.pause?.(); }
});

/* ---------------- CHAPTER HOOKS ---------------- */
const onEnter = {}, onLeave = {};

/* CH0 — incoming call: ring + vibrate, slide the green knob to answer */
let ringTimer = null;
function stopRing() { if (ringTimer) { clearInterval(ringTimer); ringTimer = null; } try { navigator.vibrate?.(0); } catch (_) {} }
onEnter["ch-call"] = () => {
  const track = $("#callTrack"), knob = $("#callKnob"), hint = $("#callSlideHint");
  const doRing = () => { if (!Sound.isMuted()) { Sound.ring(); try { navigator.vibrate?.([300, 140, 300]); } catch (_) {} } };
  doRing(); if (ringTimer) clearInterval(ringTimer); ringTimer = setInterval(doRing, 1900);
  // reset knob each time we land here
  knob.style.transition = ""; knob.style.transform = "translateX(0)"; knob.classList.remove("dragging");
  knob.textContent = "📞"; if (hint) hint.style.opacity = "";
  if (knob.dataset.wired) return; knob.dataset.wired = "1";
  let dragging = false, startX = 0, x = 0, max = 0;
  const px = (e) => (e.clientX ?? e.touches?.[0]?.clientX ?? 0);
  const setX = (v) => { x = Math.max(0, Math.min(max, v)); knob.style.transform = `translateX(${x}px)`; if (hint) hint.style.opacity = String(Math.max(0, 1 - (max ? x / max : 0) * 1.3)); };
  const answer = () => { stopRing(); Sound.chime(); knob.textContent = "✅"; setTimeout(() => goTo(current + 1), 300); };
  const down = (e) => { dragging = true; knob.classList.add("dragging"); max = track.clientWidth - knob.offsetWidth - 10; startX = px(e) - x; };
  const move = (e) => { if (!dragging) return; setX(px(e) - startX); };
  const up = () => { if (!dragging) return; dragging = false; knob.classList.remove("dragging"); if (x >= max - 8) answer(); else { knob.style.transition = "transform .25s var(--ease)"; setX(0); setTimeout(() => (knob.style.transition = ""), 280); } };
  knob.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
};
onLeave["ch-call"] = () => { stopRing(); };

/* CH0 — countdown → intro video → Ameena photo + date */
let cdDone = false;
onEnter["ch-countdown"] = async () => {
  if (cdDone) return; cdDone = true;                           // no piano here — it begins on the name page (page 4)
  const numEl = $("#cdNum"), cd = $("#countdown"), rs = $("#revealStage"), vid = $("#introVideo");
  await sleep(350);
  for (const n of [3, 2, 1]) { numEl.textContent = n; numEl.classList.remove("pop"); void numEl.offsetWidth; numEl.classList.add("pop"); Sound.tick(); await sleep(850); }
  numEl.textContent = ""; cd.hidden = true;                    // remove the lingering "1"
  rs.hidden = false;                                           // clip (top) + Ameena photo (#1) shown together
  vid.muted = Sound.isMuted();                                 // opening clip plays its own music
  vid.play?.().catch(() => { vid.muted = true; vid.play?.().catch(() => {}); });
  await sleep(300);
  Sound.cheer(); FX.burst(innerWidth / 2, innerHeight * 0.4, 70);
  await sleep(500); $("#cdNext").hidden = false;
};
onLeave["ch-countdown"] = () => { $("#introVideo").pause?.(); };

/* CH1 — name balloon game */
let nameBuilt = false;
onEnter["ch-name"] = () => {
  Bgm.start(); Bgm.level(0.34);                                // piano background begins RIGHT HERE — page 4
  if (nameBuilt) return; nameBuilt = true;
  Sound.narrate("The twenty second of September is Ameena's day.", { delay: 500 });
  const wrap = $("#balloons"), bar = $("#nameBar");
  const letters = ["A", "M", "E", "E", "N", "A"], shades = ["#ff2d78", "#ff69a8", "#ff8fc0", "#ffa9d0", "#ff5a9e", "#ff7db4"];
  let popped = 0;
  const cols = 3, cw = wrap.clientWidth || 340, ch = wrap.clientHeight || 300;
  letters.forEach((L, i) => {
    const b = document.createElement("button");
    b.className = "balloon"; b.setAttribute("aria-label", "balloon " + L);
    b.style.left = (10 + (i % cols) * (cw - 76) / (cols - 1)) + "px";
    b.style.top = (10 + Math.floor(i / cols) * (ch - 130) + (i % 2 ? 26 : 0)) + "px";
    b.style.animationDelay = (i * 0.25) + "s, " + (i * 0.2) + "s";
    b.innerHTML = `<span class="balloon__body" style="background:radial-gradient(circle at 35% 30%, #fff6, ${shades[i]})"></span><span class="balloon__string"></span><span class="balloon__letter">${L}</span>`;
    b.addEventListener("click", () => {
      if (b.classList.contains("pop")) return;
      const r = b.getBoundingClientRect(); Sound.balloonPop(); FX.burst(r.left + r.width / 2, r.top + r.height / 2, 18);
      b.classList.add("pop");
      const s = document.createElement("span"); s.textContent = L; bar.appendChild(s);
      requestAnimationFrame(() => s.classList.add("in"));   // letter appears cleanly at top as you tap
      if (++popped === letters.length) finishName();
    }, { passive: true });
    wrap.appendChild(b);
  });
  async function finishName() {
    await sleep(450);
    wrap.style.display = "none"; $("#nameHint").style.display = "none"; $("#nameBar").style.display = "none";
    $("#name3dWrap").hidden = false;                            // balloons+strings+AMEENA rise up together as one graphic
    Sound.cheer(); FX.burst(innerWidth / 2, innerHeight * 0.42, 80);
    await sleep(2000); $("#nameNext").hidden = false;           // wait for the slow rise-up to finish before showing Next
  }
};

/* CH5 — counters */
let statsDone = false;
onEnter["ch-stats"] = () => {
  if (statsDone) return; statsDone = true;
  $$(".stat__n").forEach((el) => {
    const target = +el.dataset.count, suffix = el.dataset.suffix || "", dur = 1600, t0 = performance.now();
    (function step(t) { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = fmt(Math.floor(target * e)) + (p === 1 ? suffix : ""); if (p < 1) requestAnimationFrame(step); })(t0);
    setTimeout(() => { el.textContent = fmt(target) + suffix; }, dur + 500);
  });
};
function fmt(n) { if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B"; if (n >= 1e6) return (n / 1e6).toFixed(0) + "M"; return n.toLocaleString("en-US"); }

/* CH7 — wish + 3D cake + blow (tap or mic) */
let cakeReady = false;
onEnter["ch-wish"] = () => {
  if (cakeReady) return; cakeReady = true;
  const host = $("#cake3d"), cssCake = $("#cake");
  if (cssCake) cssCake.style.display = "none";        // hide the simple fallback cake — show only the real 3D
  tryThreeCake(host).then((ok) => { if (!ok && cssCake) cssCake.style.display = ""; });
  let done = false;
  const blow = async () => {
    if (done) return; done = true;
    (window.__cakeBlow || (() => {}))();               // 3D cake blow (if mounted)
    $$("#cake [data-flame]").forEach((f, i) => setTimeout(() => f.classList.add("out"), i * 150));
    Sound.whoosh();
    const r = host.getBoundingClientRect();
    for (let i = 0; i < 14; i++) FX.add(r.left + r.width / 2, r.top + r.height * .35, { col: "rgba(220,220,220,.8)", spd: 1 + Math.random() * 2, up: 1, life: 55 });
    $("#cakeHint").style.display = "none"; $("#micBtn").hidden = true;
    await sleep(600);
    Sound.happyBirthday(); Sound.cheer(); FX.rain(4200, 6); FX.burst(innerWidth / 2, innerHeight * 0.35, 100);
    $("#wishMsg").hidden = false; $("#wishNext").hidden = false;
  };
  host.addEventListener("click", blow, { passive: true });
  const mic = $("#micBtn"); mic.hidden = false;
  mic.addEventListener("click", (e) => { e.stopPropagation(); startMicBlow(blow); });
};

/* CH9a (ch-her) — her photo (gentle zoom) + floating balloons + your singing voice → tap to continue */
onEnter["ch-her"] = () => {
  const song = $("#song"), photo = $("#herPhoto"), hint = $("#tapHint"), bcont = $("#herBalloons");
  if (song) { song.muted = Sound.isMuted(); try { song.currentTime = 0; } catch (_) {} song.play?.().catch(() => {}); }
  startHerBalloons(bcont);
  FX.burst(innerWidth / 2, innerHeight * 0.4, 45);
  const invite = () => { if (hint) hint.hidden = false; };
  if (song) song.addEventListener("ended", invite, { once: true });
  setTimeout(invite, 44000);                                   // fallback: show tap cue even if 'ended' never fires
  if (!photo.dataset.wired) {
    photo.dataset.wired = "1";
    photo.addEventListener("click", () => { Sound.whoosh(); goTo(current + 1); }, { passive: true });
  }
};
onLeave["ch-her"] = () => { $("#song")?.pause?.(); stopHerBalloons(); };

/* CH9b (ch-video) — the personalized final clip, with its own audio */
onEnter["ch-video"] = () => {
  const v = $("#finaleVideo");
  try { v.currentTime = 0; } catch (_) {}
  v.muted = Sound.isMuted();
  v.play?.().catch(() => { v.muted = true; v.play?.().catch(() => {}); });
};
onLeave["ch-video"] = () => { $("#finaleVideo").pause?.(); };

/* ---------------- MIC BLOW DETECTION ---------------- */
async function startMicBlow(cb) {
  try {
    // noise suppression / AGC OFF so the browser doesn't filter the "whoosh" of a blow
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    Sound.unlock(); const ac = Sound.context();
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser(); an.fftSize = 1024; src.connect(an);
    const time = new Uint8Array(an.fftSize);
    let done = false, frames = 0, baseline = 0, sustained = 0;
    const hint = $("#cakeHint"); if (hint) { hint.style.display = ""; hint.textContent = "🎤 blow now…"; }
    const rmsNow = () => { an.getByteTimeDomainData(time); let s = 0; for (let i = 0; i < time.length; i++) { const d = (time[i] - 128) / 128; s += d * d; } return Math.sqrt(s / time.length); };
    const iv = setInterval(() => {
      if (done) return;
      const r = rmsNow();
      if (frames < 8) { baseline = (baseline * frames + r) / (frames + 1); frames++; return; } // ~640ms ambient calibration
      const thresh = Math.max(baseline * 2.2, 0.05);            // blow = clearly louder than the room
      if (r > thresh) { if (++sustained >= 2) { done = true; clearInterval(iv); stream.getTracks().forEach(t => t.stop()); cb(); } }
      else sustained = Math.max(0, sustained - 1);
    }, 80);
    setTimeout(() => { if (!done) { clearInterval(iv); stream.getTracks().forEach(t => t.stop()); } }, 20000);
  } catch (_) { /* denied — tap still works */ }
}

/* ---------------- 3D NAME (CSS default, Three.js upgrade) ---------------- */
async function tryThreeCake(host) { if (REDUCED) return false; try { const m = await import("./cake3d.js?v=9"); await m.mountCake3D(host, "AMEENA"); return true; } catch (_) { return false; } }

/* ---------------- END actions ---------------- */
$("#replayBtn").addEventListener("click", () => { Sound.unlock(); location.reload(); });
$("#shareBtn").addEventListener("click", async () => {
  const url = location.href, data = { title: "Happy Birthday, Ameena ✨", text: "A little surprise for you 🎂", url };
  try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(url); toast("Link copied ✅"); } } catch (_) {}
});
function toast(msg) { const t = document.createElement("div"); t.textContent = msg; Object.assign(t.style, { position: "fixed", left: "50%", bottom: "90px", transform: "translateX(-50%)", background: "rgba(0,0,0,.82)", color: "#fff", padding: "10px 18px", borderRadius: "100px", zIndex: 200, fontSize: "14px", border: "1px solid rgba(255,255,255,.2)" }); document.body.appendChild(t); setTimeout(() => t.remove(), 1800); }
