// main.js — Containment Breach V3 — Full Reactor SDK Integration
import { Reactor } from "@reactor-team/js-sdk";

// ---- Config ----
const TOKEN_EP = "http://localhost:3001/api/token";
const SEED_IMG = "/seed.jpg";
const CHUNK_LATENTS = 3;
const INTEGRITY_START = 100;
const AUTO_DAMAGE_INTERVAL = 15000; // -2% every 15s once events start

// ---- Composable Layered Prompts — THIRD-PERSON (per official prompt guide) ----
const LAYERS = {
  base: "Interior of a humming nuclear reactor control room. EXACTLY ONE confident young man in a fitted dark premium black t-shirt and dark trousers stands centered between rows of metal consoles covered in switches, dials, and blinking green and amber indicator lights. He grips a small handheld remote control device in his right hand, thumb hovering over its buttons. Industrial ceiling with exposed pipes and cable trays. Floor grating with reflective metal surface. Large status display screens on walls showing reactor schematics. Dim emergency fluorescent lighting casting a cold bluish-green glow. Photorealistic, cinematic, tense atmosphere, sharp focus, film grain.",
  camera: {
    static: "A third-person medium shot framing the officer centred in frame at medium distance, the control room stretching behind him. Any movement of the camera comes only from look-input; the camera holds steady otherwise.",
    dynamic: "A third-person tracking shot following the officer from behind at medium distance as he moves through the control room corridor, consoles streaming past on both sides. Look-input becomes the heading changing.",
  },
  movement: {
    static: "He stands alert but still, scanning the consoles around him, remote held ready. The room hums quietly.",
    dynamic: "He strides forward purposefully through the control room corridor, remote in hand, his dark shirt catching the emergency light as panels blur past.",
  },
};

const EVENTS = {
  alarm:     { clause: "he presses a button on the remote — alarm klaxons immediately blare throughout the room, red warning lights flash rapidly across every control panel, he flinches and covers one ear with his free hand", cost: 10, tier: 1, label: "Alarm Klaxons" },
  smoke:     { clause: "he clicks the remote — thick dark smoke instantly billows from a ruptured panel on the left side, visibility dropping, haze filling the corridor around him", cost: 10, tier: 1, label: "Smoke Fill" },
  sparks:    { clause: "he presses the remote — violent electrical sparks erupt from exposed wiring above him, blue-white arcs crackling across metal surfaces nearby, he shields his eyes", cost: 10, tier: 2, label: "Electrical Sparks" },
  radiation: { clause: "he triggers the remote — radiation warning indicators surge to maximum on every display, sickly green glow emanates from vents in the floor beneath him, he steps back warily", cost: 15, tier: 2, label: "Radiation Surge" },
  leak:      { clause: "he hits the remote button — coolant floods across the floor grating around his feet, steam hisses violently from cracked pipes along the ceiling above him", cost: 15, tier: 3, label: "Coolant Leak" },
  power:     { clause: "he presses the remote — emergency lights flicker and die, plunging sections of the room into deep shadow around him, backup generators whine, he looks around alarmed", cost: 15, tier: 3, label: "Power Failure" },
  collapse:  { clause: "he slams the remote button — structural debris falls from the ceiling near him, concrete dust fills the air, metal beams groan and buckle overhead, he ducks and braces", cost: 20, tier: 4, label: "Structural Collapse" },
  meltdown:  { clause: "he presses the final button on the remote with determination — intense orange-red glow rises from floor vents, reactor core breach visible through cracked wall panels behind him, extreme heat distortion ripples through the air, everything bathed in hellish red light", cost: 25, tier: 4, label: "Core Meltdown" },
};

// ---- Web Audio Sound Engine (synthesized, no external files) ----
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function ensureAudio() { if (!audioCtx) audioCtx = new AudioCtx(); return audioCtx; }

const SFX = {
  // UI click
  click() {
    const ctx = ensureAudio(), t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(800, t); o.frequency.exponentialRampToValueAtTime(400, t+0.08);
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.1);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+0.1);
  },
  // Alarm klaxon
  alarm() {
    const ctx = ensureAudio(), t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "square"; o.frequency.setValueAtTime(880, t+i*0.2); o.frequency.setValueAtTime(660, t+i*0.2+0.1);
      g.gain.setValueAtTime(0.08, t+i*0.2); g.gain.exponentialRampToValueAtTime(0.001, t+i*0.2+0.18);
      o.connect(g); g.connect(ctx.destination); o.start(t+i*0.2); o.stop(t+i*0.2+0.2);
    }
  },
  // Smoke hiss
  smoke() {
    const ctx = ensureAudio(), t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1)*0.3;
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = buf; f.type = "lowpass"; f.frequency.value = 2000;
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.5);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
  },
  // Electrical sparks
  sparks() {
    const ctx = ensureAudio(), t = ctx.currentTime;
    for (let i=0;i<5;i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(1200+Math.random()*2000, t+i*0.06);
      g.gain.setValueAtTime(0.06, t+i*0.06); g.gain.exponentialRampToValueAtTime(0.001, t+i*0.06+0.04);
      o.connect(g); g.connect(ctx.destination); o.start(t+i*0.06); o.stop(t+i*0.06+0.05);
    }
  },
  // Radiation geiger
  radiation() {
    const ctx = ensureAudio(), t = ctx.currentTime;
    for (let i=0;i<8;i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 4000+Math.random()*1000;
      const st = t + i*0.05 + Math.random()*0.03;
      g.gain.setValueAtTime(0.1, st); g.gain.exponentialRampToValueAtTime(0.001, st+0.02);
      o.connect(g); g.connect(ctx.destination); o.start(st); o.stop(st+0.03);
    }
  },
  // Coolant leak rush
  leak() {
    const ctx = ensureAudio(), t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate*0.8, ctx.sampleRate);
    const d = buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1);
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer = buf; f.type = "bandpass"; f.frequency.value = 800; f.Q.value = 2;
    g.gain.setValueAtTime(0.1, t); g.gain.linearRampToValueAtTime(0.15, t+0.2); g.gain.exponentialRampToValueAtTime(0.001, t+0.8);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
  },
  // Power failure buzz-out
  power() {
    const ctx = ensureAudio(), t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(30, t+0.6);
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t+0.7);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+0.7);
  },
  // Structural collapse rumble
  collapse() {
    const ctx = ensureAudio(), t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate*1, ctx.sampleRate);
    const d = buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1);
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    src.buffer=buf; f.type="lowpass"; f.frequency.value=200;
    g.gain.setValueAtTime(0.15, t); g.gain.linearRampToValueAtTime(0.2, t+0.3); g.gain.exponentialRampToValueAtTime(0.001, t+1);
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
  },
  // Core meltdown deep drone
  meltdown() {
    const ctx = ensureAudio(), t = ctx.currentTime;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o1.type="sine"; o1.frequency.value=55; o2.type="sine"; o2.frequency.value=58;
    g.gain.setValueAtTime(0.18, t); g.gain.linearRampToValueAtTime(0.25, t+0.5); g.gain.exponentialRampToValueAtTime(0.001, t+1.5);
    o1.connect(g); o2.connect(g); g.connect(ctx.destination); o1.start(t); o2.start(t); o1.stop(t+1.5); o2.stop(t+1.5);
  },
  // Start sequence
  start() {
    const ctx = ensureAudio(), t = ctx.currentTime;
    [400,500,600,800].forEach((f,i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type="sine"; o.frequency.value=f;
      g.gain.setValueAtTime(0.08, t+i*0.12); g.gain.exponentialRampToValueAtTime(0.001, t+i*0.12+0.15);
      o.connect(g); g.connect(ctx.destination); o.start(t+i*0.12); o.stop(t+i*0.12+0.15);
    });
  },
  // Game over
  gameover() {
    const ctx = ensureAudio(), t = ctx.currentTime;
    [600,400,300,150].forEach((f,i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type="square"; o.frequency.value=f;
      g.gain.setValueAtTime(0.1, t+i*0.2); g.gain.exponentialRampToValueAtTime(0.001, t+i*0.2+0.25);
      o.connect(g); g.connect(ctx.destination); o.start(t+i*0.2); o.stop(t+i*0.2+0.25);
    });
  },
};

// ---- DOM ----
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const stage = $("#stage"), video = $("#world"), vignette = $("#damage-vignette");
const statusEl = $("#status"), statusText = $("#status-text");
const timerEl = $("#timer"), intFill = $("#integrity-fill"), intVal = $("#integrity-value");
const evtCountEl = $("#event-count"), chunkEl = $("#chunk-idx"), frameEl = $("#frame-count");
const attnBadge = $("#attn-badge");
const evtBtns = $$(".event-btn"), startOvl = $("#start-overlay"), startBtn = $("#start-btn");
const startErr = $("#start-error"), endOvl = $("#end-overlay");
const endTime = $("#end-time"), endEvts = $("#end-events"), endChunks = $("#end-chunks"), endFrames = $("#end-frames");
const restartBtn = $("#restart-btn"), pauseBtn = $("#pause-btn");
const diagToggle = $("#diag-toggle"), diagPanel = $("#diagnostics"), diagClose = $("#diag-close");
const ticker = $("#event-ticker"), uploadIn = $("#upload-area"), eventLog = $("#event-log");
const seedInput = $("#seed-input");
const sessionBadge = $("#session-badge"), sessionIdEl = $("#session-id"), copySessionBtn = $("#copy-session");
const activePromptEl = $("#active-prompt");
const kvFlushBtn = $("#kv-flush-btn");
// Diag values
const dConn = $("#diag-conn"), dImg = $("#diag-image"), dPrm = $("#diag-prompt");
const dGen = $("#diag-gen"), dPsd = $("#diag-paused"), dChk = $("#diag-chunks");
const dFrm = $("#diag-frames"), dEvt = $("#diag-events"), dKv = $("#diag-kv");
const dAttn = $("#diag-attn"), dRot = $("#diag-rot"), dSeed = $("#diag-seed");

// ---- State ----
let reactor = null, seconds = 0, eventsTriggered = 0, integrity = INTEGRITY_START;
let timerHandle = null, autoDmgHandle = null, gameOver = false, isPaused = false;
let isGenerating = false, chunkCount = 0, frameCount = 0;
const heldKeys = new Set(), activeEvents = new Set();
let lastSentPrompt = "", currentAttn = "auto", currentKv = "auto", currentRot = 5;

// ---- Utilities ----
const fmt = s => { const m = String(Math.floor(s/60)).padStart(2,"0"), sc = String(s%60).padStart(2,"0"); return `${m}:${sc}`; };
function setStatus(m, l) { statusEl.className = `status glass status--${m}`; statusText.textContent = l; }
function log(t, c="") {
  const el = document.createElement("div"); el.className = `log-entry ${c}`;
  const ts = new Date().toLocaleTimeString("en",{hour12:false,hour:"2-digit",minute:"2-digit",second:"2-digit"});
  el.innerHTML = `<span class="timestamp">${ts}</span> ${t}`;
  eventLog.appendChild(el); eventLog.scrollTop = eventLog.scrollHeight;
  while (eventLog.children.length > 60) eventLog.removeChild(eventLog.firstChild);
}
function showTicker(t) { ticker.textContent = `▸ ${t}`; ticker.classList.add("visible"); clearTimeout(ticker._t); ticker._t = setTimeout(()=>ticker.classList.remove("visible"),4000); }
function shake() { stage.classList.remove("shake"); void stage.offsetWidth; stage.classList.add("shake"); setTimeout(()=>stage.classList.remove("shake"),500); }
function updDiag(f,v,c="") { const m={conn:dConn,image:dImg,prompt:dPrm,gen:dGen,paused:dPsd}; if(m[f]){m[f].textContent=v;m[f].className=`value ${c}`;} }

// ---- Composable prompt ----
function compose() {
  const moving = heldKeys.has("w")||heldKeys.has("a")||heldKeys.has("s")||heldKeys.has("d");
  const mode = moving ? "dynamic" : "static";
  let p = LAYERS.base + " " + LAYERS.camera[mode] + " " + LAYERS.movement[mode];
  if (activeEvents.size > 0) p += ", " + [...activeEvents].map(k=>EVENTS[k].clause).join(", ");
  return p.trim();
}
async function sendPrompt() {
  if (!reactor || gameOver) return;
  const next = compose();
  if (next === lastSentPrompt) return;
  lastSentPrompt = next;
  activePromptEl.textContent = next.slice(0, 300) + (next.length > 300 ? "…" : "");
  try { await reactor.sendCommand("set_prompt", { prompt: next }); } catch(e) { log(`prompt err: ${e.message}`,"error"); }
}

// ---- Integrity UI ----
function updIntegrity() {
  const p = Math.max(integrity, 0);
  intFill.style.width = `${p}%`; intVal.textContent = `${p}%`;
  vignette.style.opacity = (1-p/100)*0.9;
  if (p>60) { intFill.style.background="var(--green)"; intFill.style.boxShadow="0 0 8px var(--green)"; setStatus("nominal","SYSTEMS NOMINAL"); }
  else if (p>30) { intFill.style.background="var(--amber)"; intFill.style.boxShadow="0 0 8px var(--amber)"; setStatus("warning","SYSTEMS DEGRADED"); }
  else if (p>0) { intFill.style.background="var(--red)"; intFill.style.boxShadow="0 0 12px var(--red)"; setStatus("critical","CRITICAL"); }
  evtCountEl.textContent = `${eventsTriggered} / 8`;
  // Auto-damage visual
  if (activeEvents.size > 0 && p > 0) stage.classList.add("autodamage"); else stage.classList.remove("autodamage");
}

function endGame() {
  if (gameOver) return; gameOver = true;
  clearInterval(timerHandle); clearInterval(autoDmgHandle);
  SFX.gameover();
  evtBtns.forEach(b=>b.disabled=true); pauseBtn.disabled=true;
  endTime.textContent=fmt(seconds); endEvts.textContent=String(eventsTriggered);
  endChunks.textContent=String(chunkCount); endFrames.textContent=String(frameCount);
  endOvl.classList.remove("hidden");
  log("CONTAINMENT LOST","error"); showTicker("⚠ CONTAINMENT LOST — REACTOR BREACH");
  stage.classList.remove("autodamage");
}

// ---- Camera shake via set_camera_pose ----
async function camShake(intensity=0.02) {
  if (!reactor) return;
  try {
    const pose = [];
    for (let i=0;i<CHUNK_LATENTS;i++) { const s=i%2===0?1:-1; pose.push(0,0,s*intensity,0,s*intensity*0.5,0); }
    await reactor.sendCommand("set_camera_pose", { camera_pose: pose });
    setTimeout(async()=>{ try{await reactor.sendCommand("set_camera_pose",{camera_pose:[]})}catch{} },800);
  } catch(e) { log(`cam_pose err: ${e.message}`,"error"); }
}

// ---- Token ----
async function getToken() {
  const r = await fetch(TOKEN_EP, { method: "POST" });
  if (!r.ok) { const b = await r.json().catch(()=>({})); throw new Error(b.message||b.error||`Token ${r.status}`); }
  return (await r.json()).jwt;
}

// ---- Connect & Start ----
async function connectAndStart() {
  reactor = new Reactor({ modelName: "reactor/lingbot-world-2" });

  reactor.on("trackReceived", (name, _t, stream) => {
    if (name !== "main_video") return;
    video.srcObject = stream; video.play().catch(()=>{}); log("Video track received","success");
  });

  // ---- Full message event handler ----
  reactor.on("message", msg => {
    if (!msg?.type) return;
    switch (msg.type) {
      case "image_accepted": updDiag("image","✓","ok"); log(`Image accepted (${msg.width}×${msg.height})`,"success"); break;
      case "prompt_accepted": updDiag("prompt","✓","ok"); break;
      case "conditions_ready": log("Conditions ready","success"); break;
      case "state":
        updDiag("prompt",msg.has_prompt?"✓":"✗",msg.has_prompt?"ok":"warn");
        updDiag("image",msg.has_image?"✓":"✗",msg.has_image?"ok":"warn");
        updDiag("gen",msg.running&&msg.started?"✓ Active":"Idle",msg.running&&msg.started?"ok":"");
        updDiag("paused",msg.paused?"Yes":"No",msg.paused?"warn":"ok");
        isGenerating=msg.running&&msg.started; isPaused=msg.paused;
        if (msg.current_prompt) activePromptEl.textContent = msg.current_prompt.slice(0,300);
        if (msg.current_action) log(`Action: ${msg.current_action}`);
        break;
      case "chunk_complete":
        chunkCount = (msg.chunk_index??chunkCount)+1;
        frameCount = msg.frames_emitted??frameCount;
        chunkEl.textContent=chunkCount; frameEl.textContent=frameCount;
        dChk.textContent=String(chunkCount); dFrm.textContent=String(frameCount);
        break;
      case "generation_started": log(`Generation started (chunk ${msg.chunk_num})`,"success"); break;
      case "generation_paused": log(`Paused at chunk ${msg.chunk_index}`,""); break;
      case "generation_resumed": log(`Resumed at chunk ${msg.chunk_index}`,"success"); break;
      case "generation_complete": log(`Generation complete (${msg.total_chunks} chunks)`,"success"); break;
      case "generation_reset": log("Generation reset"); chunkCount=0; chunkEl.textContent="—"; break;
      case "command_error": log(`CMD ERR: ${msg.command||"?"} — ${msg.reason||"unknown"}`,"error"); showTicker(`⚠ ${msg.command}: ${msg.reason}`); break;
      case "workers_ready": log(`Workers ready${msg.tsp_size?` (TSP ${msg.tsp_size})`:""}`,"success"); break;
    }
  });

  reactor.on("statusChanged", async status => {
    updDiag("conn",status,status==="ready"?"ok":"warn"); log(`Status: ${status}`);
    if (status !== "ready") return;

    // Show session ID
    try {
      const sid = reactor.getSessionId?.() || reactor.sessionId;
      if (sid) { sessionIdEl.textContent = sid.slice(0,12)+"…"; sessionIdEl.title=sid; sessionBadge.style.display="flex"; log(`Session: ${sid.slice(0,20)}…`,"success"); }
    } catch {}

    try {
      // Upload seed
      const ref = await reactor.uploadFile(await fetch(SEED_IMG).then(r=>{if(!r.ok)throw new Error("seed.jpg missing");return r.blob();}));
      await reactor.sendCommand("set_image", { image: ref }); log("Seed uploaded","success");

      // Set seed if specified
      const seedVal = seedInput?.value ? parseInt(seedInput.value) : null;
      if (seedVal !== null && !isNaN(seedVal)) {
        await reactor.sendCommand("set_seed", { seed: seedVal }); log(`Seed set: ${seedVal}`,"success"); dSeed.textContent=String(seedVal);
      }

      // Backend knobs
      await reactor.sendCommand("set_kv_cache_reset", { mode: "auto" }); log("KV cache: auto");
      await reactor.sendCommand("set_attn_window", { attn_window: "auto" }); log("Attn window: auto");
      await reactor.sendCommand("set_rotation_speed_deg", { rotation_speed_deg: 5.0 }); log("Rotation: 5°/chunk");

      // Prompt & start
      lastSentPrompt = compose();
      activePromptEl.textContent = lastSentPrompt.slice(0,300);
      await reactor.sendCommand("set_prompt", { prompt: lastSentPrompt }); log("Prompt set","success");
      await reactor.sendCommand("start", {}); log("Started","success");
      setStatus("nominal","SYSTEMS NOMINAL"); startTimer(); enableCtrls();
    } catch(e) { log(`Init err: ${e.message}`,"error"); showStartErr(e.message); }
  });

  // Error handling with auto-reconnect
  reactor.on("error", err => {
    log(`Error [${err.component}]: ${err.code} — ${err.message}`,"error");
    if (err.recoverable) { log("Auto-reconnecting…"); setTimeout(()=>{reactor?.reconnect().catch(()=>{});},(err.retryAfter??3)*1000); }
  });

  const jwt = await getToken(); log("JWT acquired","success");
  await reactor.connect(jwt); log("Connecting…");
}

function startTimer() {
  clearInterval(timerHandle);
  timerHandle = setInterval(()=>{ if(!isPaused){seconds++;timerEl.textContent=fmt(seconds);} },1000);
}
function startAutoDamage() {
  clearInterval(autoDmgHandle);
  autoDmgHandle = setInterval(()=>{
    if(gameOver||isPaused||activeEvents.size===0) return;
    integrity = Math.max(integrity-2,0); updIntegrity();
    if(integrity<=0) endGame();
  }, AUTO_DAMAGE_INTERVAL);
}
function enableCtrls() { evtBtns.forEach(b=>b.disabled=false); pauseBtn.disabled=false; }
function showStartErr(m) { startErr.textContent=`Connection failed: ${m}`; startOvl.classList.remove("hidden"); setStatus("standby","STANDBY"); }

// ---- Diagnostics ----
diagToggle.addEventListener("click",()=>{SFX.click();diagPanel.classList.toggle("open");diagToggle.classList.toggle("active");});
diagClose.addEventListener("click",()=>{SFX.click();diagPanel.classList.remove("open");diagToggle.classList.remove("active");});

// ---- Model Knobs ----
$$(".knob-btn[data-knob]").forEach(btn => {
  btn.addEventListener("click", async () => {
    if (!reactor) return;
    SFX.click();
    const knob = btn.dataset.knob, val = btn.dataset.val;
    // Update active state
    btn.closest(".knob-btns")?.querySelectorAll(".knob-btn").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    try {
      if (knob === "attn") {
        await reactor.sendCommand("set_attn_window", { attn_window: val });
        currentAttn=val; attnBadge.textContent=val; dAttn.textContent=val; log(`Attn window → ${val}`,"success");
      } else if (knob === "kv") {
        await reactor.sendCommand("set_kv_cache_reset", { mode: val });
        currentKv=val; dKv.textContent=val; log(`KV cache → ${val}`,"success");
      } else if (knob === "rot") {
        const deg = parseFloat(val);
        await reactor.sendCommand("set_rotation_speed_deg", { rotation_speed_deg: deg });
        currentRot=deg; dRot.textContent=`${deg}°`; log(`Rotation → ${deg}°/chunk`,"success");
      }
    } catch(e) { log(`Knob err: ${e.message}`,"error"); }
  });
});

// KV cache flush button
kvFlushBtn?.addEventListener("click", async () => {
  if (!reactor) return;
  SFX.click();
  try {
    await reactor.sendCommand("trigger_kv_cache_reset", {});
    log("KV cache flushed!","success"); showTicker("⚡ KV cache reset triggered");
  } catch(e) { log(`KV flush err: ${e.message}`,"error"); }
});

// Copy session ID
copySessionBtn?.addEventListener("click", () => {
  SFX.click();
  const sid = sessionIdEl?.title;
  if (sid) { navigator.clipboard.writeText(sid).then(()=>showTicker("Session ID copied!")); }
});

// ---- Event Deck ----
evtBtns.forEach(btn => {
  btn.addEventListener("click", async () => {
    if (!reactor||gameOver||isPaused) return;
    const key = btn.dataset.event, cost = Number(btn.dataset.cost||15);
    if (activeEvents.has(key)) return;
    btn.disabled=true; btn.classList.add("triggered"); activeEvents.add(key);
    eventsTriggered++; integrity=Math.max(integrity-cost,0);
    // Play event-specific sound
    if (SFX[key]) SFX[key]();
    updIntegrity(); dEvt.textContent=String(activeEvents.size);
    shake(); showTicker(`${EVENTS[key].label} — containment at ${Math.max(integrity,0)}%`);
    log(`EVENT: ${EVENTS[key].label} (−${cost}%)`,"error");
    await sendPrompt();
    await camShake(0.01 + EVENTS[key].tier * 0.008);
    // Start auto-damage on first event
    if (eventsTriggered === 1) startAutoDamage();
    if (integrity<=0) endGame();
  });
});

// ---- Movement (correct schema params) ----
const keyLabels = $$(".key[data-key]");
window.addEventListener("keydown", e => {
  if (!reactor||gameOver||heldKeys.has(e.key)) return;
  heldKeys.add(e.key);
  keyLabels.forEach(k=>{if(k.dataset.key===e.key)k.classList.add("active");});
  if(e.key==="w") reactor.sendCommand("set_move_longitudinal",{move_longitudinal:"forward"});
  if(e.key==="s") reactor.sendCommand("set_move_longitudinal",{move_longitudinal:"back"});
  if(e.key==="a") reactor.sendCommand("set_move_lateral",{move_lateral:"strafe_left"});
  if(e.key==="d") reactor.sendCommand("set_move_lateral",{move_lateral:"strafe_right"});
  if(e.key==="ArrowLeft") reactor.sendCommand("set_look_horizontal",{look_horizontal:"left"});
  if(e.key==="ArrowRight") reactor.sendCommand("set_look_horizontal",{look_horizontal:"right"});
  if(e.key==="ArrowUp") reactor.sendCommand("set_look_vertical",{look_vertical:"up"});
  if(e.key==="ArrowDown") reactor.sendCommand("set_look_vertical",{look_vertical:"down"});
  if("wasd".includes(e.key)) sendPrompt();
});
window.addEventListener("keyup", e => {
  if(!reactor) return; heldKeys.delete(e.key);
  keyLabels.forEach(k=>{if(k.dataset.key===e.key)k.classList.remove("active");});
  if(e.key==="w"||e.key==="s") reactor.sendCommand("set_move_longitudinal",{move_longitudinal:"idle"});
  if(e.key==="a"||e.key==="d") reactor.sendCommand("set_move_lateral",{move_lateral:"idle"});
  if(e.key==="ArrowLeft"||e.key==="ArrowRight") reactor.sendCommand("set_look_horizontal",{look_horizontal:"idle"});
  if(e.key==="ArrowUp"||e.key==="ArrowDown") reactor.sendCommand("set_look_vertical",{look_vertical:"idle"});
  if("wasd".includes(e.key)) sendPrompt();
});

// ---- Pause/Resume ----
pauseBtn.addEventListener("click", async () => {
  if(!reactor||gameOver) return;
  SFX.click();
  try {
    if(isPaused) { await reactor.sendCommand("resume",{}); pauseBtn.textContent="⏸ Pause"; isPaused=false; log("Resumed","success"); }
    else { await reactor.sendCommand("pause",{}); pauseBtn.textContent="▶ Resume"; isPaused=true; log("Paused"); }
  } catch(e) { log(`Pause err: ${e.message}`,"error"); }
});

// ---- Image upload (live seed swap) ----
uploadIn.addEventListener("change", async e => {
  if(!reactor) return; const file=e.target.files?.[0]; if(!file) return;
  try {
    log(`Uploading: ${file.name}…`); showTicker(`Uploading seed: ${file.name}`);
    if(isGenerating) { await reactor.sendCommand("reset",{}); log("Reset for new seed"); await new Promise(r=>setTimeout(r,600)); }
    const ref = await reactor.uploadFile(file);
    await reactor.sendCommand("set_image",{image:ref}); log(`Seed uploaded: ${file.name}`,"success");
    lastSentPrompt=""; await sendPrompt();
    await new Promise(r=>setTimeout(r,1500));
    await reactor.sendCommand("start",{}); log("Restarted with new seed","success");
    showTicker("World re-anchored!");
  } catch(e2) { log(`Upload err: ${e2.message}`,"error"); }
  uploadIn.value="";
});

// ---- Start / Restart ----
startBtn.addEventListener("click", async () => {
  SFX.start();
  startBtn.disabled=true; startErr.textContent=""; setStatus("standby","CONNECTING…"); log("Initiating…");
  try { await connectAndStart(); startOvl.classList.add("hidden"); }
  catch(e) { showStartErr(e.message); log(`Failed: ${e.message}`,"error"); }
  finally { startBtn.disabled=false; }
});

restartBtn.addEventListener("click", async () => {
  seconds=0; eventsTriggered=0; integrity=INTEGRITY_START; gameOver=false; isPaused=false;
  chunkCount=0; frameCount=0; activeEvents.clear(); lastSentPrompt="";
  clearInterval(autoDmgHandle); stage.classList.remove("autodamage");
  updIntegrity(); timerEl.textContent="00:00"; chunkEl.textContent="—"; frameEl.textContent="0";
  endOvl.classList.add("hidden"); evtBtns.forEach(b=>b.classList.remove("triggered"));
  if (reactor) {
    try {
      log("Resetting…"); await reactor.sendCommand("reset",{}); await new Promise(r=>setTimeout(r,600));
      const ref = await reactor.uploadFile(await fetch(SEED_IMG).then(r=>r.blob()));
      await reactor.sendCommand("set_image",{image:ref});
      lastSentPrompt=compose(); await reactor.sendCommand("set_prompt",{prompt:lastSentPrompt});
      await new Promise(r=>setTimeout(r,1500)); await reactor.sendCommand("start",{});
      startTimer(); enableCtrls(); setStatus("nominal","SYSTEMS NOMINAL");
      log("Reset complete","success"); showTicker("Reactor re-staged — 100%");
    } catch { startOvl.classList.remove("hidden"); }
  }
});

// ---- Init ----
updIntegrity(); log("Containment Breach V3 loaded","success");
