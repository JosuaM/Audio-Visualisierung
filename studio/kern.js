'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Studio – Kern: Hilfen, Spuren, Animationen, Projekt (Speichern/Laden),
   Zeichnen der Ebenen mit ihren Zuordnungen und die Uhr des Players.
   (Die Oberfläche steht in ui.js.)
   ═══════════════════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));      // wird auch von ideen.js benutzt
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtT = s => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1).replace('.', ',')}`; };
const root = document.documentElement;
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

/* ---------- Tonspuren: wann klingen sie? (aus data.js, wie auf den anderen Seiten) ---------- */
const ELEMENTS = window.ELEMENTS || [];
const widthOf = e => e.k === 'l' ? Math.max(...e.p.flatMap(p => p[1].map(q => q[0])))
                   : e.k === 'f' ? Math.max(...e.p.flatMap(pl => pl.map(q => q[0])))
                   : e.p[e.p.length - 1][0] + 0.15;
for (const t of TRACKS) {
  const els = ELEMENTS.filter(e => e.id.replace(/-\d+$/, '') === t.key);
  t.row = els.length ? els[0].row : TRACKS.indexOf(t);
  t.cssColor = `var(--c${t.row})`;
  t.raw = els.map(e => [e.t0, Math.min(DUR, e.t0 + widthOf(e))]).sort((a, b) => a[0] - b[0]);
  t.raw = t.raw.reduce((m, iv) => { const l = m[m.length - 1]; if (l && iv[0] - l[1] < .3) l[1] = Math.max(l[1], iv[1]); else m.push([...iv]); return m; }, []);
}
const TBY = Object.fromEntries(TRACKS.map(t => [t.key, t]));
const isOn = (tr, t) => tr.raw.some(([a, z]) => t >= a && t < z);
Sig.setTracks(t => TRACKS.filter(tr => isOn(tr, t)).length, (t, ctx) => ctx && ctx.track && TBY[ctx.track] && isOn(TBY[ctx.track], t) ? 1 : 0);

/* ---------- Effekte aus dem Labor ---------- */
const FX = []; for (const neu of [0, 1]) (window.LABOR_GROUPS || []).forEach(g => g.fx.forEach(f => { if (!!f.neu !== !!neu) return; f.nr = FX.length + 1; f.group = g.g; FX.push(f); }));   // Nummern der älteren Effekte bleiben stabil, neue kommen hinten dran

/* ---------- Animationen & morphologischer Kasten (wie Animations-Zuordnung) ---------- */
const ideaOf = id => { if (!id) return null; const [k, i] = id.split(':'); return (IDEAS[k] || [])[+i] || null; };
const fpCfg = id => { if (!id) return null; const [k, i] = id.split(':'); return k === 'flute' ? FPC[+i] || null : null; };
const GEN_DEF = { hue: 'Original', sat: 'Gesättigt', light: 'Hell', alpha: 'Original', size: 'Original', tempo: 'Original', flip: 'Keine', rot: '0°' };
const GEN_OPTS = { hue: ['Original', ...FP_OPTS.hue], sat: FP_OPTS.sat, light: FP_OPTS.light, alpha: ['Original', 'Halbtransparent', 'Transparent'], size: ['Klein', 'Original', 'Groß'],
  tempo: ['¼×', '½×', 'Original', '2×', '4×'], flip: ['Keine', 'Horizontal', 'Vertikal', 'Beide'], rot: ['0°', '90°', '180°', '270°'] };
const GEN_NAMES = { hue: 'Farbton', sat: 'Sättigung', light: 'Helligkeit', alpha: 'Transparenz', size: 'Größe', tempo: 'Geschwindigkeit', flip: 'Spiegelung', rot: 'Bewegungsrichtung (Drehung)' };
const GEN_GROUPS = [['Erscheinung', ['hue', 'sat', 'light', 'alpha', 'size']], ['Verhalten', ['tempo', 'flip', 'rot']]];
const defOf = id => (fpCfg(id) || { def: GEN_DEF }).def;
const optsOf = (id, k) => fpCfg(id) ? fpOpts(+id.split(':')[1], k) : GEN_OPTS[k];
const nameOf = (id, k) => fpCfg(id) ? FP_NAMES[k] : GEN_NAMES[k];
const groupsOf = id => fpCfg(id) ? fpCfg(id).groups : GEN_GROUPS;
function genericDraw(c, s, idea, Pm) {
  const f = { Klein: .6, Original: 1, 'Groß': 1.5 }[Pm.size], k = { '¼×': .25, '½×': .5, Original: 1, '2×': 2, '4×': 4 }[Pm.tempo];
  const deg = parseInt(Pm.rot, 10) || 0, swap = deg === 90 || deg === 270, W = swap ? s.h : s.w, H = swap ? s.w : s.h;
  const fg = Pm.hue === 'Original' ? s.fg : fpColor({ hue: Pm.hue, sat: Pm.sat, light: Pm.light, temp: 'Neutral' }, s.fg);
  const bar = s.bar / k, s2 = { ...s, w: W, h: H, bar, beat: s.beat / k, phase: ((s.t / bar) % 1 + 1) % 1, fg, col: Pm.hue === 'Original' ? s.col : fg };
  c.save(); c.translate(s.w / 2, s.h / 2); c.rotate(deg * Math.PI / 180);
  c.scale((Pm.flip === 'Horizontal' || Pm.flip === 'Beide' ? -1 : 1) * f, (Pm.flip === 'Vertikal' || Pm.flip === 'Beide' ? -1 : 1) * f);
  c.translate(-W / 2, -H / 2); c.globalAlpha = { Original: 1, Halbtransparent: .5, Transparent: .25 }[Pm.alpha];
  idea.draw(c, s2); c.restore();
}
function drawAnim(c, s, st) {
  const idea = ideaOf(st.anim); if (!idea) return;
  const fp = fpCfg(st.anim);
  if (fp) fp.draw(c, s, { ...fp.def, ...st.P }); else genericDraw(c, s, idea, { ...GEN_DEF, ...st.P });
}
const firstOf = k => (IDEAS[k] && IDEAS[k].length) ? k + ':0' : '';

/* ---------- Projekt ---------- */
const LS_P = 'av-studio-projekt', LS_U = 'av-studio-ui';
const layerName = L => L.kind === 'track' ? TBY[L.key].name : (FX[L.fx - 1] ? FX[L.fx - 1].title : 'Effekt');
const layerById = id => P.layers.find(l => l.id === id);
const mapById = id => P.maps.find(m => m.id === id);
const trackLayer = (t, anim, Pm) => ({ id: 'track:' + t.key, kind: 'track', key: t.key, anim: anim != null ? anim : firstOf(t.key), P: Pm || {}, on: true, tint: true });
const fxLayer = n => ({ id: 'fx:' + n, kind: 'fx', fx: n, on: true });
let P = { t: 0, layers: [], maps: [] };
function sanitize(p) {
  p = p || {}; const out = { t: +p.t || 0, layers: [], maps: [] };
  for (const t of TRACKS) {
    const s = (p.layers || []).find(l => l.id === 'track:' + t.key);
    out.layers.push(s ? { ...trackLayer(t, s.anim === '' || ideaOf(s.anim) ? s.anim : firstOf(t.key), s.anim === '' || ideaOf(s.anim) ? { ...(s.P || {}) } : {}), on: s.on !== false, tint: s.tint !== false } : trackLayer(t));
  }
  for (const l of (p.layers || [])) if (l.kind === 'fx' && FX[l.fx - 1] && !out.layers.some(x => x.id === l.id)) out.layers.unshift({ ...fxLayer(l.fx), on: l.on !== false });
  for (const m of (p.maps || [])) {
    if (!m || !Sig.BY[m.src] || !WIRK[m.tgt] || !COND[m.cond]) continue;
    const d = Sig.BY[m.src];
    out.maps.push({ id: m.id || 'map:' + (out.maps.length + 1), name: m.name || '', layer: m.layer === '*' || out.layers.some(l => l.id === m.layer) ? m.layer : '*', src: m.src, cond: m.cond, lo: isFinite(m.lo) ? +m.lo : d.dlo, hi: isFinite(m.hi) ? +m.hi : d.dhi,
      tgt: m.tgt, a: m.a == null ? null : m.a, b: m.b == null ? null : m.b, soft: SOFT[m.soft] ? m.soft : 'weich', str: isFinite(m.str) ? clamp(+m.str, 0, 1) : 1, on: m.on !== false });
  }
  return out;
}
const snapOf = p => JSON.stringify({ layers: p.layers, maps: p.maps });
let savedSnap = '';
let ID_SEQ = 1;
const newMapId = () => { while (P.maps.some(m => m.id === 'map:' + ID_SEQ)) ID_SEQ++; return 'map:' + ID_SEQ; };
async function loadProject() {
  let file = null, local = lsGet(LS_P, null);
  try { const r = await fetch('studio/projekt.json', { cache: 'no-store' }); if (r.ok) file = await r.json(); } catch (e) {}
  const fileP = sanitize(file);
  savedSnap = snapOf(fileP);
  P = (local && (local.t || 0) > (fileP.t || 0)) ? sanitize(local) : fileP;
}
let saveT = 0;
function touch() {                                   // nach jeder Änderung: merken (im Browser) und Anzeige aktualisieren
  P.t = Date.now(); clearTimeout(saveT); saveT = setTimeout(() => lsSet(LS_P, P), 250);
  updateDirty();
}
function updateDirty() { const d = snapOf(P) !== savedSnap, e = $('dirty'); if (e) e.textContent = d ? '● nicht im Projektordner gespeichert' : ''; }
const idb = (mode, fn) => new Promise(res => {
  try {
    const r = indexedDB.open('av-store', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('h');
    r.onerror = () => res(null);
    r.onsuccess = () => { const tx = r.result.transaction('h', mode), q = fn(tx.objectStore('h')); tx.oncomplete = () => res(q && q.result); tx.onerror = tx.onabort = () => res(null); };
  } catch (e) { res(null); }
});
let toastT = 0;
function toast(m, ms = 3500) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms); }
async function saveProject() {
  lsSet(LS_P, P); const data = JSON.stringify({ ...P, t: Date.now() }, null, 1);
  try {
    if (window.showOpenFilePicker) {
      let h = await idb('readonly', s => s.get('studio-projekt'));
      if (h) { try { if (await h.queryPermission({ mode: 'readwrite' }) !== 'granted' && await h.requestPermission({ mode: 'readwrite' }) !== 'granted') h = null; } catch (e) { h = null; } }
      if (!h) {
        toast('Bitte einmal die Datei „studio/projekt.json“ im Projektordner auswählen', 6000);
        h = (await showOpenFilePicker({ types: [{ description: 'projekt.json', accept: { 'application/json': ['.json'] } }] }))[0];
        if (h.name !== 'projekt.json') throw new Error('Das ist nicht die projekt.json dieses Projekts');
        if (await h.requestPermission({ mode: 'readwrite' }) !== 'granted') throw new Error('keine Schreibrechte');
        idb('readwrite', s => s.put(h, 'studio-projekt'));
      }
      const w = await h.createWritable(); await w.write(data); await w.close();
      toast('Gespeichert in studio/projekt.json – jetzt committen & pushen');
    } else {
      const a = document.createElement('a'); a.download = 'projekt.json'; a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.click();
      toast('projekt.json heruntergeladen – im Ordner „studio“ ersetzen, dann committen & pushen', 6000);
    }
    savedSnap = snapOf(P); updateDirty();
  } catch (err) { toast(err.name === 'AbortError' ? 'Nicht gespeichert – Datei wurde nicht gewählt' : `Nicht gespeichert (${err.message}) – Änderungen bleiben im Browser`, 6000); }
}
function loadFromFile() {
  const f = document.createElement('input'); f.type = 'file'; f.accept = '.json,application/json';
  f.onchange = async () => { try { P = sanitize(JSON.parse(await f.files[0].text())); touch(); UI.sel = null; uiAll(); toast('Projekt geladen'); } catch (e) { toast('Datei nicht lesbar: ' + e.message, 5000); } };
  f.click();
}
function textSummary() {
  return 'Zuordnungen:\nTonspuren:\n' + P.layers.filter(l => l.kind === 'track').map(l => `- ${layerName(l)}: ${l.anim ? (ideaOf(l.anim) || {}).title + ' (' + l.anim + ')' : 'keine Animation'}${l.on ? '' : ' [aus]'}`).join('\n')
    + '\nEffekte:\n' + (P.layers.filter(l => l.kind === 'fx').map(l => `- ${layerName(l)}`).join('\n') || '- keine')
    + '\nParameter:\n' + (P.maps.map(m => { const d = describe(m); return `- ${d.when} → ${d.then} (${m.layer === '*' ? 'alle Ebenen' : layerName(layerById(m.layer))})${m.on ? '' : ' [aus]'}`; }).join('\n') || '- keine');
}

/* ---------- Farben des Themes ---------- */
let COL = { fg: '#fff', bg: '#000' };
function readColors() {
  const cs = getComputedStyle(root); COL = { fg: cs.getPropertyValue('--stage-fg').trim() || '#fff', bg: cs.getPropertyValue('--stage').trim() || '#000' };
  const probe = document.createElement('i'); document.body.appendChild(probe);
  TRACKS.forEach(t => { probe.style.color = t.cssColor; t.col = getComputedStyle(probe).color; });
  probe.remove();
}

/* ---------- Uhr / Audio ---------- */
const audio = $('audio');
let free = { perf: performance.now(), t: 0 };
const rate = () => +$('rate').value || 1;
let lastCt = -1, lastP = 0, sT = 0, sP = 0, sOk = false;
function nowT() {                   // Songzeit in Sekunden, bei Pause je nach Einstellung stehend oder weiterlaufend
  if (!audio.paused) {
    const ct = audio.currentTime, p = performance.now();
    if (ct !== lastCt) { lastCt = ct; lastP = p; }
    const raw = lastCt + Math.min(.25, (p - lastP) / 1000) * audio.playbackRate;
    const pred = sOk ? sT + (p - sP) / 1000 * audio.playbackRate : raw;     // die Uhr des Players springt in Stufen – glätten, sonst zucken die Animationen
    sT = (!sOk || Math.abs(raw - pred) > .2) ? raw : pred + (raw - pred) * .08; sP = p; sOk = true;
    return sT;
  }
  sOk = false;
  return UI.idle ? free.t + (performance.now() - free.perf) / 1000 * rate() : (audio.currentTime || 0);
}
const resync = t => { free = { perf: performance.now(), t }; };
function seek(t, play) { t = clamp(t, 0, DUR); try { audio.currentTime = t; } catch (e) {} resync(t); if (play && audio.paused) audio.play().catch(() => {}); }
const togglePlay = () => audio.paused ? audio.play().catch(() => {}) : audio.pause();

/* ---------- Zeichnen ---------- */
const offPool = new Map();
function getOff(W, H, dpr) {
  const k = `${W}x${H}x${dpr}`; let o = offPool.get(k);
  if (!o) { o = document.createElement('canvas'); o.width = Math.max(1, Math.round(W * dpr)); o.height = Math.max(1, Math.round(H * dpr)); o.ctx = o.getContext('2d'); offPool.set(k, o); if (offPool.size > 10) offPool.delete(offPool.keys().next().value); }
  return o;
}
const mapState = {}, lastF = {};
const stateOf = k => mapState[k] || (mapState[k] = {});
const hash1 = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function layerMods(L, W, H, env, filter) {
  const mods = newMods(), ctx = { track: L.kind === 'track' ? L.key : (L.demoTrack || null) };
  for (const m of (env.maps || P.maps)) {
    if (m.tgt === 'bg' || !filter(m) || (m.layer !== '*' && m.layer !== L.id)) continue;
    const f = mapFactor(m, env.shown, ctx, stateOf(m.id + '|' + L.id), env.dt);
    if (lastF[m.id + '#'] !== env.fr) { lastF[m.id + '#'] = env.fr; lastF[m.id] = 0; }       // für die Anzeige: größter Wert in diesem Bild
    lastF[m.id] = Math.max(lastF[m.id], f);
    applyMap(mods, m, f, W, H);
  }
  return mods;
}
/* eine Ebene mit allen Zuordnungen auf c zeichnen (c steht schon auf Gerätepixel-Maßstab) */
function drawLayer(c, L, W, H, dpr, env, filter) {
  const tr = L.kind === 'track' ? TBY[L.key] : null;
  if (tr) {
    if (!L.anim) return;
    if (env.gate) { const on = isOn(tr, env.shown), tl = (ideaOf(L.anim) || {}).tail || 0; if (!(on || (tl && tr.raw.some(([a, z]) => env.shown >= z && env.shown < z + tl * BEAT)))) return; }
  }
  const mods = layerMods(L, W, H, env, filter);
  if (mods.alpha <= .002) return;
  const o = getOff(W, H, dpr), oc = o.ctx, tt = env.t - OFFSET;
  oc.setTransform(dpr, 0, 0, dpr, 0, 0); oc.clearRect(0, 0, W, H); oc.globalAlpha = 1; oc.globalCompositeOperation = 'source-over';
  window.IDEEN_GATE = env.gate;
  oc.save();
  try {
    if (tr) drawAnim(oc, { t: tt, bar: BAR, beat: BEAT, phase: ((tt / BAR) % 1 + 1) % 1, w: W, h: H, col: tr.col, fg: L.tint ? tr.col : COL.fg, bg: COL.bg }, L);
    else if (L.kind === 'demo') drawDemoShape(oc, W, H, COL.fg, tt);
    else { oc.beginPath(); oc.rect(0, 0, W, H); oc.clip(); FX[L.fx - 1].draw(oc, { t: tt, bar: BAR, beat: BEAT, w: W, h: H, fg: COL.fg, bg: COL.bg }); }
  } catch (e) { console.error(layerName(L), e); }
  oc.restore();
  for (const tn of mods.tints) { oc.save(); oc.globalCompositeOperation = 'source-atop'; oc.globalAlpha = clamp(tn.amt, 0, 1); oc.fillStyle = tn.c; oc.fillRect(0, 0, W, H); oc.restore(); }
  const sh = mods.shake * Math.min(W, H), q = Math.floor(env.shown * 40), jx = sh ? (hash1(q) - .5) * 2 * sh : 0, jy = sh ? (hash1(q + 99) - .5) * 2 * sh : 0;
  c.save(); c.globalAlpha = clamp(mods.alpha, 0, 1);
  c.translate(W / 2 + mods.dx + jx, H / 2 + mods.dy + jy); c.rotate(mods.rot * Math.PI / 180); c.scale(mods.scale, mods.scale); c.translate(-W / 2, -H / 2);
  c.drawImage(o, 0, 0, W, H);
  c.restore();
}
function drawBg(c, W, H, env, filter) {
  const mods = newMods();
  for (const m of (env.maps || P.maps)) if (m.tgt === 'bg' && filter(m)) { const f = mapFactor(m, env.shown, {}, stateOf(m.id + '|*'), env.dt); lastF[m.id] = f; applyMap(mods, m, f, W, H); }
  for (const b of (mods.bg || [])) { c.save(); c.globalAlpha = clamp(b.amt, 0, 1); c.fillStyle = b.c; c.fillRect(0, 0, W, H); c.restore(); }
}
/* eine ganze Bühne (mehrere Ebenen übereinander) auf ein Canvas zeichnen, das mit sizeCv() eingerichtet wurde */
function drawStage(cv, layers, env, filter) {
  const W = cv._w, H = cv._h, dpr = cv._dpr; if (!W || !H) return;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  drawBg(c, W, H, env, filter);
  for (const L of layers) drawLayer(c, L, W, H, dpr, env, filter);
}
function sizeCv(cv) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), r = cv.getBoundingClientRect(), W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
  const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  cv._w = W; cv._h = H; cv._dpr = dpr;
}
function drawDemoShape(c, W, H, fg, t) {          // einfache Figur, an der man die Wirkung einer Zuordnung sieht
  const m = Math.min(W, H), cx = W / 2, cy = H / 2, p = (t / BEAT) % 1;
  c.strokeStyle = fg; c.fillStyle = fg; c.lineWidth = m * .04; c.beginPath(); c.arc(cx, cy, m * .22, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.arc(cx, cy, m * .07 * (1 + .25 * (1 - p)), 0, Math.PI * 2); c.fill();
  c.fillRect(cx - m * .42, cy - m * .02, m * .12, m * .04); c.fillRect(cx + m * .30, cy - m * .02, m * .12, m * .04);
}
const orderedLayers = (only) => { const f = P.layers.filter(l => l.kind === 'fx'), t = TRACKS.map(tr => layerById('track:' + tr.key)); return [...f, ...t].filter(l => l && (only ? only(l) : l.on)); };
