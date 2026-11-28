'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   MP4-Export: eine Animation (oder ein Effekt) über die ganze Songlänge als Video.
   Bild für Bild exakt gerechnet (nicht in Echtzeit mitgeschnitten): Bild i zeigt den Song bei i / fps Sekunden.
   Dazu werden dieselben Zeichenfunktionen wie in der Vorschau benutzt (drawBg / drawLayer in kern.js) –
   inklusive der Parameter-Zuordnungen des Projekts, die für diese Ebene gelten. Das Video hat keinen Ton:
   Alle Videos laufen von 0:00 bis zum Songende und passen damit sekundengenau zur Datei assets/song.m4a.
   Kodierung: WebCodecs (H.264) im Browser, verpackt mit mp4-muxer (assets/mp4-muxer.js).
   ═══════════════════════════════════════════════════════════════════════════ */
const EXP = { fps: 30, busy: false, cancel: false };
const EXP_RES = { '1080': [1920, 1080, 10e6], '720': [1280, 720, 6e6] };
const expOk = () => typeof VideoEncoder === 'function' && typeof VideoFrame === 'function' && typeof Mp4Muxer === 'object';
const fileSafe = s => String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim();

/* Was genau gezeichnet wird: gleiche Ebene wie im Studio – die Tonspur-Ebene mit dieser Animation (Anpassungen nur, wenn sie dort gerade eingestellt ist) */
function expSpecAnim(id) {
  const key = id.split(':')[0], t = TBY[key], idea = ideaOf(id), base = layerById('track:' + key) || trackLayer(t, id);
  return { name: fileSafe(`${t.name}_${idea.title}`), gate: UI.mp4gate !== false, L: { ...base, id: 'track:' + key, kind: 'track', key, anim: id, P: base.anim === id ? { ...base.P } : {}, on: true }, label: `${t.name} – ${idea.title}` };
}
function expSpecFx(f) {
  return { name: fileSafe(`Effekt_${f.title}`), gate: false, L: { id: 'fx:' + f.nr, kind: 'fx', fx: f.nr, on: true }, label: `Effekt – ${f.title}` };
}

/* ---- Fortschrittsanzeige ---- */
function expPanel() {
  let p = $('expov'); if (p) return p;
  p = document.createElement('div'); p.id = 'expov'; p.className = 'expov';
  p.innerHTML = '<b id="expT">MP4 …</b><div class="bar"><i id="expB"></i></div><span id="expS"></span><button class="btn sm" id="expX">Abbrechen</button>';
  document.body.appendChild(p); $('expX').onclick = () => { EXP.cancel = true; };
  return p;
}
const expShow = (title, frac, sub) => { const p = expPanel(); p.hidden = false; $('expT').textContent = title; $('expB').style.width = Math.round(clamp(frac, 0, 1) * 100) + '%'; $('expS').textContent = sub || ''; };
const expHide = () => { const p = $('expov'); if (p) p.hidden = true; };

/* ---- ein Video rechnen → Blob ---- */
async function expRender(spec, res, prog) {
  const [W, H, bitrate] = EXP_RES[res] || EXP_RES['1080'], fps = EXP.fps, n = Math.ceil(DUR * fps);
  let codec = null;
  for (const c of ['avc1.64002a', 'avc1.640028', 'avc1.4d0028', 'avc1.42001f']) {
    try { const r = await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate, framerate: fps }); if (r.supported) { codec = c; break; } } catch (e) {}
  }
  if (!codec) throw new Error('Dieser Browser kann kein H.264 kodieren – bitte Chrome oder Edge benutzen');
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H }, fastStart: 'in-memory' });
  let err = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { err = e; } });
  enc.configure({ codec, width: W, height: H, bitrate, framerate: fps });
  const filter = m => m.on, t0 = performance.now();
  for (let i = 0; i < n; i++) {
    if (EXP.cancel) { try { enc.close(); } catch (e) {} throw Object.assign(new Error('abgebrochen'), { cancelled: true }); }
    if (err) throw err;
    const t = Math.min(DUR, i / fps), env = { t, shown: t, dt: i ? 1 / fps : 0, fr: 1e9 + i, gate: spec.gate };
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.fillStyle = COL.bg; c.fillRect(0, 0, W, H);
    drawLookBg(c, W, H, [spec.L], env); drawBg(c, W, H, env, filter); drawLayer(c, spec.L, W, H, 1, env, filter);
    const fr = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(fr, { keyFrame: i % (fps * 2) === 0 }); fr.close();
    if (i % 6 === 5) {
      while (enc.encodeQueueSize > 12) await new Promise(r => setTimeout(r, 4));
      const el = (performance.now() - t0) / 1000, left = el / (i + 1) * (n - i - 1);
      prog(i / n, `Bild ${i + 1} von ${n} · noch ca. ${Math.max(1, Math.round(left))} s`); await new Promise(r => setTimeout(r, 0));
    }
  }
  await enc.flush(); enc.close(); if (err) throw err;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}

function expDownload(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 5000);
}

/* ---- mehrere Videos nacheinander; bei mehreren, wenn möglich, direkt in einen Ordner schreiben ---- */
async function expRun(specs) {
  if (EXP.busy) { toast('Es läuft schon ein Export'); return; }
  if (!expOk()) { toast('MP4-Export braucht Chrome, Edge oder ein aktuelles Safari (WebCodecs)', 7000); return; }
  if (!specs.length) { toast('Nichts zu exportieren'); return; }
  const res = UI.mp4res || '1080'; let dir = null;
  if (specs.length > 1 && window.showDirectoryPicker) { try { toast('Bitte einen Ordner für die Videos wählen', 5000); dir = await showDirectoryPicker({ mode: 'readwrite' }); } catch (e) { return; } }
  EXP.busy = true; EXP.cancel = false; window.EXPORTING = true; audio.pause();
  const seen = {}, done = [];
  try {
    for (let k = 0; k < specs.length; k++) {
      const s = specs[k]; let name = s.name; seen[name] = (seen[name] || 0) + 1; if (seen[name] > 1) name += '_' + seen[name];
      const head = specs.length > 1 ? `Video ${k + 1} von ${specs.length}: ` : '';
      const blob = await expRender(s, res, (f, sub) => expShow(head + s.label, (k + f) / specs.length, sub));
      if (dir) { const fh = await dir.getFileHandle(name + '.mp4', { create: true }), w = await fh.createWritable(); await w.write(blob); await w.close(); }
      else expDownload(blob, name + '.mp4');
      done.push(name + '.mp4');
    }
    toast(done.length === 1 ? `Fertig: ${done[0]}` : `Fertig: ${done.length} Videos${dir ? ' im gewählten Ordner' : ' heruntergeladen'}`, 6000);
  } catch (e) {
    if (e && e.cancelled) toast(done.length ? `Abgebrochen – ${done.length} Video(s) sind fertig` : 'Export abgebrochen');
    else { console.error(e); toast('Export fehlgeschlagen: ' + (e && e.message || e), 8000); }
  } finally { EXP.busy = false; window.EXPORTING = false; expHide(); resync(audio.currentTime || 0); }
}

/* Alles, was im Projekt gerade zugeordnet ist: je eine Animation pro Tonspur + die Effekte */
function expProjectSpecs() {
  const out = [];
  for (const t of TRACKS) { const L = layerById('track:' + t.key); if (L && L.on && L.anim && ideaOf(L.anim)) out.push(expSpecAnim(L.anim)); }
  for (const L of P.layers) if (L.kind === 'fx' && L.on && FX[L.fx - 1]) out.push(expSpecFx(FX[L.fx - 1]));
  return out;
}
