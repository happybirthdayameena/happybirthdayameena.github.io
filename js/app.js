/* =========================================================
   Happy Birthday, Ameena — experience controller
   Vanilla JS · Web Audio (synth, copyright-safe) · canvas FX
   ========================================================= */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------
   AUDIO ENGINE  — soft synth, all sounds generated live
--------------------------------------------------------- */
const Audio = (() => {
  let ctx = null, master = null, muted = false;

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  function unlock() { init(); if (ctx.state === "suspended") ctx.resume(); }
  function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; }
  function isMuted() { return muted; }

  // one note with a gentle envelope
  function note(freq, t0, dur, { type = "sine", gain = 0.5, glide = 0 } = {}) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const o2 = ctx.createOscillator();      // soft octave shimmer
    const g2 = ctx.createGain();
    o.type = type; o2.type = "triangle";
    o.frequency.setValueAtTime(freq, t0);
    o2.frequency.setValueAtTime(freq * 2, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t0 + dur);
    const a = 0.012, r = Math.min(0.25, dur * 0.6);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.exponentialRampToValueAtTime(gain * 0.12, t0 + a);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o2.connect(g2).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.05);
    o2.start(t0); o2.stop(t0 + dur + 0.05);
  }

  // noise burst (for pops / cheers)
  function noise(t0, dur, { gain = 0.4, hp = 800, lp = 6000 } = {}) {
    if (!ctx) return;
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    const hpf = ctx.createBiquadFilter(); hpf.type = "highpass"; hpf.frequency.value = hp;
    const lpf = ctx.createBiquadFilter(); lpf.type = "lowpass"; lpf.frequency.value = lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(hpf).connect(lpf).connect(g).connect(master);
    n.start(t0); n.stop(t0 + dur);
  }

  // public SFX
  const pop     = () => { unlock(); const t = ctx.currentTime; noise(t, 0.09, { gain: 0.5, hp: 1200 }); note(660, t, 0.12, { type: "sine", gain: 0.35, glide: 1.6 }); };
  const tick    = () => { unlock(); const t = ctx.currentTime; note(880, t, 0.14, { type: "triangle", gain: 0.4 }); };
  const whoosh  = () => { unlock(); const t = ctx.currentTime; noise(t, 0.3, { gain: 0.25, hp: 300, lp: 3000 }); };
  const sparkle = () => { unlock(); const t = ctx.currentTime; [1320, 1760, 2200].forEach((f, i) => note(f, t + i * 0.05, 0.25, { type: "sine", gain: 0.2 })); };
  const chime   = () => { unlock(); const t = ctx.currentTime; [523, 659, 784, 1046].forEach((f, i) => note(f, t + i * 0.09, 0.5, { type: "sine", gain: 0.3 })); };
  const cheer   = () => { unlock(); const t = ctx.currentTime; noise(t, 0.6, { gain: 0.3, hp: 500, lp: 5000 }); [523, 659, 784].forEach((f, i) => note(f, t + i * 0.02, 0.6, { type: "triangle", gain: 0.25 })); sparkle(); };

  // Happy Birthday melody (public-domain tune, synthesized)
  function happyBirthday() {
    unlock();
    const N = { G4:392, A4:440, B4:493.88, C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99 };
    const beat = 0.42;
    const seq = [
      ["G4",.5],["G4",.5],["A4",1],["G4",1],["C5",1],["B4",2],
      ["G4",.5],["G4",.5],["A4",1],["G4",1],["D5",1],["C5",2],
      ["G4",.5],["G4",.5],["G5",1],["E5",1],["C5",1],["B4",1],["A4",2],
      ["F5",.5],["F5",.5],["E5",1],["C5",1],["D5",1],["C5",2],
    ];
    let t = ctx.currentTime + 0.1;
    seq.forEach(([n, d]) => {
      const dur = d * beat;
      note(N[n], t, dur * 0.95, { type: "sine", gain: 0.42 });
      note(N[n] / 2, t, dur * 0.95, { type: "triangle", gain: 0.12 }); // soft bass
      t += dur;
    });
    return (t - ctx.currentTime) * 1000; // total ms
  }

  return { unlock, setMuted, isMuted, pop, tick, whoosh, sparkle, chime, cheer, happyBirthday };
})();

/* ---------------------------------------------------------
   CONFETTI / PARTICLE FX
--------------------------------------------------------- */
const FX = (() => {
  const cv = $("#fx"), cx = cv.getContext("2d");
  let W, H, DPR, parts = [], raf = null;
  const COLORS = ["#ff2d78", "#ff69a8", "#ffc7de", "#ffffff", "#ffd58a"];

  function resize() {
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR;
    cv.style.width = innerWidth + "px"; cv.style.height = innerHeight + "px";
  }
  addEventListener("resize", resize); resize();

  function add(x, y, opts = {}) {
    const ang = opts.ang ?? Math.random() * Math.PI * 2;
    const spd = opts.spd ?? (4 + Math.random() * 8);
    parts.push({
      x: x * DPR, y: y * DPR,
      vx: Math.cos(ang) * spd * DPR, vy: Math.sin(ang) * spd * DPR - (opts.up || 0) * DPR,
      g: (0.15 + Math.random() * 0.12) * DPR,
      w: (6 + Math.random() * 7) * DPR, h: (8 + Math.random() * 8) * DPR,
      rot: Math.random() * Math.PI, vr: (Math.random() - .5) * 0.3,
      col: opts.col || COLORS[(Math.random() * COLORS.length) | 0],
      life: opts.life || (90 + Math.random() * 60), age: 0,
      shape: Math.random() < .5 ? "rect" : "circ",
    });
    if (!raf) loop();
  }
  function burst(x, y, n = 40) { for (let i = 0; i < n; i++) add(x, y, { up: 2 }); }
  function rain(ms = 2600, rate = 6) {
    const end = performance.now() + ms;
    (function drop() {
      for (let i = 0; i < rate; i++) add(Math.random() * innerWidth, -10, { ang: Math.PI / 2, spd: 1 + Math.random() * 2, life: 200 });
      if (performance.now() < end) setTimeout(drop, 60);
    })();
  }
  function loop() {
    raf = requestAnimationFrame(loop);
    cx.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.age++;
      p.vx *= 0.99;
      const alpha = Math.max(0, 1 - p.age / p.life);
      if (alpha <= 0 || p.y > H + 40) { parts.splice(i, 1); continue; }
      cx.save(); cx.globalAlpha = alpha; cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.col;
      if (p.shape === "rect") cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      else { cx.beginPath(); cx.arc(0, 0, p.w / 2, 0, 7); cx.fill(); }
      cx.restore();
    }
    if (!parts.length) { cancelAnimationFrame(raf); raf = null; cx.clearRect(0, 0, W, H); }
  }
  return { burst, rain, add };
})();

/* ---------------------------------------------------------
   NAVIGATION
--------------------------------------------------------- */
const chapters = $$(".chapter");
const progressEl = $("#progress");
let current = -1, started = false;

// build progress dots
chapters.forEach((_, i) => {
  const d = document.createElement("span");
  d.addEventListener("click", () => { if (started) goTo(i); });
  progressEl.appendChild(d);
});
const dots = $$("#progress span");

function goTo(i) {
  if (i < 0 || i >= chapters.length || i === current) return;
  const prev = current;
  if (prev >= 0) { chapters[prev].classList.remove("is-active"); onLeave[prev]?.(); }
  current = i;
  chapters[i].classList.add("is-active");
  dots.forEach((d, k) => d.classList.toggle("is-active", k === i));
  onEnter[i]?.();
}

// wire all "Next" buttons
$$("[data-next]").forEach((b) => b.addEventListener("click", () => { Audio.whoosh(); goTo(current + 1); }));

/* ---------------------------------------------------------
   GATE → start
--------------------------------------------------------- */
const gate = $("#gate");
$("#openBtn").addEventListener("click", async () => {
  Audio.unlock(); Audio.chime();
  const r = $("#gateGift").getBoundingClientRect();
  FX.burst(r.left + r.width / 2, r.top + r.height / 2, 60);
  gate.classList.add("is-gone");
  progressEl.classList.add("is-on");
  started = true;
  await sleep(650);
  gate.style.display = "none";
  goTo(0);
});

// audio toggle
const audioBtn = $("#audioBtn");
audioBtn.addEventListener("click", () => {
  const m = !Audio.isMuted(); Audio.setMuted(m);
  audioBtn.classList.toggle("is-muted", m);
});

/* ---------------------------------------------------------
   PER-CHAPTER ENTER / LEAVE HOOKS
--------------------------------------------------------- */
const onEnter = {}, onLeave = {};

/* CH0 — countdown + date reveal */
let cdDone = false;
onEnter[0] = async () => {
  if (cdDone) return; cdDone = true;
  const numEl = $("#cdNum"), cd = $("#countdown"), dr = $("#dateReveal"), hb = $("#dateHB");
  const vid = $("#introVideo");
  vid.hidden = false; vid.loop = true; vid.classList.add("show");
  vid.play?.().catch(() => {});
  await sleep(400);
  for (const n of [3, 2, 1]) {
    numEl.textContent = n; numEl.classList.remove("pop"); void numEl.offsetWidth; numEl.classList.add("pop");
    Audio.tick(); await sleep(900);
  }
  cd.hidden = true;
  dr.hidden = false;
  const lines = $$(".date-line", dr);
  for (const ln of lines) { ln.classList.add("reveal"); Audio.whoosh(); await sleep(650); }
  hb.classList.add("show"); Audio.cheer();
  const c = window.innerWidth / 2;
  FX.burst(c, window.innerHeight * 0.42, 80);
  await sleep(500);
  $("#cdNext").hidden = false;
};
onLeave[0] = () => { const v = $("#introVideo"); v.pause?.(); };

/* CH1 — name balloon game */
let nameBuilt = false;
onEnter[1] = () => {
  if (nameBuilt) return; nameBuilt = true;
  const wrap = $("#balloons"), bar = $("#nameBar");
  const letters = ["A", "M", "E", "E", "N", "A"];
  const shades = ["#ff2d78", "#ff69a8", "#ff8fc0", "#ffa9d0", "#ff5a9e", "#ff7db4"];
  let popped = 0;
  const cols = 3, cw = wrap.clientWidth || 340, ch = wrap.clientHeight || 300;
  letters.forEach((L, i) => {
    const b = document.createElement("button");
    b.className = "balloon"; b.setAttribute("aria-label", "balloon " + L);
    b.style.left = (10 + (i % cols) * (cw - 74) / (cols - 1)) + "px";
    b.style.top = (10 + Math.floor(i / cols) * (ch - 120) / 1 + (i % 2 ? 24 : 0)) + "px";
    b.style.animationDelay = (i * 0.3) + "s";
    b.innerHTML = `<span class="balloon__body" style="background:radial-gradient(circle at 35% 30%, #fff6, ${shades[i]})"></span>
                   <span class="balloon__string"></span>
                   <span class="balloon__letter">${L}</span>`;
    b.addEventListener("click", () => {
      if (b.classList.contains("pop")) return;
      const r = b.getBoundingClientRect();
      Audio.pop(); FX.burst(r.left + r.width / 2, r.top + r.height / 2, 22);
      b.classList.add("pop");
      const s = document.createElement("span"); s.textContent = L; bar.appendChild(s);
      requestAnimationFrame(() => s.classList.add("in"));
      popped++;
      if (popped === letters.length) finishName();
    }, { passive: true });
    wrap.appendChild(b);
  });

  async function finishName() {
    await sleep(500);
    wrap.style.display = "none";
    const n3wrap = $("#name3dWrap"); n3wrap.hidden = false;
    buildName3D($("#name3d"), "AMEENA");
    Audio.cheer();
    FX.burst(window.innerWidth / 2, window.innerHeight * 0.4, 90);
    await sleep(400);
    $("#nameNext").hidden = false;
    // opportunistic real-3D upgrade
    tryThree($("#name3d"));
  }
};

/* CH5 — animate counters */
let statsDone = false;
onEnter[5] = () => {
  if (statsDone) return; statsDone = true;
  $$(".stat__n").forEach((el) => {
    const target = +el.dataset.count, suffix = el.dataset.suffix || "";
    const dur = 1600, t0 = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const val = Math.floor(target * e);
      el.textContent = fmt(val) + (p === 1 ? suffix : "");
      if (p < 1) requestAnimationFrame(step);
    })(t0);
    // safety net: guarantee final value even if rAF is throttled
    setTimeout(() => { el.textContent = fmt(target) + suffix; }, dur + 500);
  });
};
function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(0) + "M";
  return n.toLocaleString("en-US");
}

/* CH7 — the wish + cake */
let cakeReady = false;
onEnter[7] = () => {
  if (cakeReady) return; cakeReady = true;
  const cake = $("#cake");
  cake.addEventListener("click", async () => {
    if (cake.dataset.done) return; cake.dataset.done = "1";
    $$("[data-flame]", cake).forEach((f, i) => setTimeout(() => f.classList.add("out"), i * 160));
    Audio.whoosh();
    const r = cake.getBoundingClientRect();
    for (let i = 0; i < 14; i++) FX.add(r.left + r.width / 2, r.top, { col: "rgba(220,220,220,.8)", spd: 1 + Math.random() * 2, up: 1, life: 60 });
    $("#cakeHint").style.display = "none";
    await sleep(650);
    Audio.happyBirthday();
    Audio.cheer();
    FX.rain(4200, 7);
    FX.burst(window.innerWidth / 2, window.innerHeight * 0.35, 120);
    $("#wishMsg").hidden = false;
    $("#wishNext").hidden = false;
  }, { passive: true });
};

/* CH8 — final video */
onEnter[8] = () => { const v = $("#finalVideo"); v.currentTime = 0; v.play?.().catch(() => {}); };
onLeave[8] = () => { $("#finalVideo").pause?.(); };

/* ---------------------------------------------------------
   3D NAME  (CSS-3D default, Three.js upgrade if possible)
--------------------------------------------------------- */
function buildName3D(host, text) {
  host.innerHTML = "";
  const stage = document.createElement("div");
  stage.className = "n3d-stage";
  [...text].forEach((ch, i) => {
    const s = document.createElement("span");
    s.className = "n3d-l"; s.textContent = ch; s.style.setProperty("--i", i);
    stage.appendChild(s);
  });
  host.appendChild(stage);
  // inject css-3d styles once
  if (!$("#n3d-css")) {
    const st = document.createElement("style"); st.id = "n3d-css";
    st.textContent = `
    .n3d-stage{display:flex;gap:.02em;perspective:700px;transform-style:preserve-3d;justify-content:center}
    .n3d-l{font-family:var(--font-d);font-weight:900;font-size:clamp(2.4rem,15vw,5rem);line-height:1;
      color:#fff;transform-style:preserve-3d;
      text-shadow:1px 1px 0 #ff7db4,2px 2px 0 #ff5a9e,3px 3px 0 #ff3f8e,4px 4px 0 #e82e7d,
        5px 5px 0 #c9256b,6px 6px 12px rgba(0,0,0,.5);
      animation:n3dspin 6s ease-in-out infinite;animation-delay:calc(var(--i)*.12s)}
    @keyframes n3dspin{0%,100%{transform:rotateY(-18deg) rotateX(6deg) translateY(0)}50%{transform:rotateY(18deg) rotateX(-4deg) translateY(-6px)}}`;
    document.head.appendChild(st);
  }
}

async function tryThree(host) {
  if (REDUCED || innerWidth < 360) return;         // keep weak devices on smooth CSS
  try {
    const mod = await import("./scene3d.js");
    await mod.mountName3D(host, "AMEENA");
  } catch (e) { /* CSS 3D stays — perfectly fine */ }
}

/* ---------------------------------------------------------
   END — replay / share
--------------------------------------------------------- */
$("#replayBtn").addEventListener("click", () => { Audio.unlock(); location.reload(); });
$("#shareBtn").addEventListener("click", async () => {
  const url = location.href;
  const data = { title: "Happy Birthday, Ameena ✨", text: "A little surprise for you 🎂", url };
  try {
    if (navigator.share) await navigator.share(data);
    else { await navigator.clipboard.writeText(url); toast("Link copied ✅"); }
  } catch (_) {}
});
function toast(msg) {
  const t = document.createElement("div"); t.textContent = msg;
  Object.assign(t.style, { position: "fixed", left: "50%", bottom: "90px", transform: "translateX(-50%)",
    background: "rgba(0,0,0,.8)", color: "#fff", padding: "10px 18px", borderRadius: "100px",
    zIndex: 200, fontSize: "14px", border: "1px solid rgba(255,255,255,.2)" });
  document.body.appendChild(t); setTimeout(() => t.remove(), 1800);
}

/* gentle idle sparkles on the gift while gate is open */
(function idleSparkle() {
  if (REDUCED) return;
  if (!gate.classList.contains("is-gone")) {
    const r = $("#gateGift")?.getBoundingClientRect();
    if (r) FX.add(r.left + Math.random() * r.width, r.top + Math.random() * r.height, { col: "#ffd58a", spd: 0.6, life: 50, up: 0.4 });
  }
  setTimeout(idleSparkle, 700);
})();
