'use strict';
/* ═════════════════════════════════════════════════════════════════════════
   Animations-Editor – Keyframe-Zeitleiste (Bedienung wie in After Effects)
   Gebraucht werden editor-engine.js (window.AE) und die Uhr der Seite (Editor.host):
     host = { time(), seek(t), playing(), toggle(), pause(), dur, offset, bar, beat }
   Ein animierter Regler hat als Wert { kf: [ { t, v, ei, eo, h, cv } ] } – t = Sekunde im Song.
   Über der Zeitachse liegt der Arbeitsbereich: der Abschnitt des Songs, der beim Abspielen wiederholt wird.
   editor-ui.js erzeugt die Zeitleiste mit AETimeline.create(ctx).
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  const FPS = 30, LAB = 210, PAD = 8, ZMAX = 48, WMIN = .25;        // kürzester Arbeitsbereich in Sekunden
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const copy = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const MAC = /Mac|iPhone|iPad/.test(navigator.platform), MOD = MAC ? '⌘' : 'Strg+', ALT = MAC ? '⌥' : 'Alt+', SH = MAC ? '⇧' : 'Umschalt+';

  /* ───────────── Rechnen mit Keyframes ───────────── */
  const snap = (t, dur) => +clamp(Math.round(t * FPS) / FPS, 0, dur).toFixed(4);     // Keyframes liegen auf ganzen Bildern (30 pro Sekunde)
  const near = (a, b) => Math.abs(a - b) < .5 / FPS;
  const at = (v, t) => v.kf.find(k => near(k.t, t));
  const sort = v => v.kf.sort((a, b) => a.t - b.t);
  function set(v, t, val) {                     // Wert an der Stelle t setzen: vorhandenen Keyframe ändern oder neuen anlegen
    let k = at(v, t);
    if (k) k.v = val;
    else {
      const prev = [...v.kf].reverse().find(x => x.t < t);             // neuer Punkt übernimmt die Übergangsart des Abschnitts
      k = { t, v: val }; if (prev && prev.h) k.h = true; v.kf.push(k); sort(v);
    }
    return k;
  }
  const K = { FPS, snap, near, at, set };

  const fmtT = t => { const f = Math.round(t * 100) / 100, m = Math.floor(f / 60), s = f - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2).replace('.', ',')}`; };

  function create(ctx) {
    const A = ctx.A, H = () => ctx.host();
    let open = !!ctx.open(), zoom = 1, tw = 600, keys = [], tracks = [], active = '', drag = null, menu = null, clip = null, ph = 0, shown = false;
    const sel = new Set();
    const el = document.createElement('div'); el.className = 'tlx';
    const hill = n => `<svg viewBox="0 0 16 12" width="${n}" height="${n * .75}" aria-hidden="true"><path d="M1 11 6 3l3 4 2-2 4 6z"/></svg>`;
    el.innerHTML = `<div class="tlx-h"><button type="button" class="tlx-tog" title="Zeitleiste auf-/zuklappen (U)">Keyframes<small></small></button><span class="tlx-time"></span><span class="sp"></span>
        <div class="tlx-tools">
          <button type="button" data-a="zout" title="Herauszoomen (−)">${hill(11)}</button><input type="range" class="tlx-zoom" min="0" max="1000" step="1" value="0" aria-label="Zoom der Zeitleiste" title="Zoom (+ / −, ; wechselt zwischen Bildgenau und Ganz)"><button type="button" data-a="zin" title="Hineinzoomen (+)">${hill(17)}</button>
          <button type="button" data-a="help" class="q" title="Bedienung &amp; Tastenkürzel">?</button>
        </div></div>
      <div class="tlx-scroll"><div class="tlx-grid"></div></div>
      <div class="tlx-help" hidden></div><div class="tlx-tip" hidden></div>`;
    const q = s => el.querySelector(s), scroll = q('.tlx-scroll'), grid = q('.tlx-grid'), tip = q('.tlx-tip'), help = q('.tlx-help');
    help.innerHTML = [
      ['Stoppuhr', 'Keyframe an der Abspielposition setzen bzw. dort entfernen'], [`${ALT}Klick auf Stoppuhr`, 'alle Keyframes des Reglers entfernen'],
      ['Klick auf Punkt', 'dorthin springen'], ['Punkt ziehen', `verschieben (mit ${SH.replace('+', '')} einrasten)`], [`${ALT}Ziehen`, 'duplizieren'], [`${SH}Klick / Rahmen`, 'mehrere wählen'], ['Doppelklick in Zeile', 'neuer Keyframe'], ['Rechtsklick', 'Menü'],
      ['J / K', 'voriger / nächster Keyframe'], [`Bild↑ / Bild↓ oder ${MOD}← →`, `ein Bild zurück / vor (${SH.replace('+', '')}: 10)`], [`${ALT}← →`, `Keyframes um ein Bild schieben (${SH.replace('+', '')}: 10)`],
      [`${MOD}C / X / V`, 'kopieren / ausschneiden / an der Abspielposition einsetzen'], [`${MOD}${SH}V`, 'rückwärts einsetzen'], [`${MOD}D`, 'duplizieren'], [`${MOD}A`, 'alle wählen'], ['Entf / ⌫', 'löschen'],
      ['F9', 'weich'], [`${SH}F9 / ${MOD}${SH}F9`, 'weich ankommen / weich loslaufen'], [`Ctrl+${ALT}H`, 'halten'], [`${MOD}Z / ${MOD}${SH}Z`, 'rückgängig / wiederholen'], ['U', 'Zeitleiste auf / zu'], ['B / N', 'Anfang / Ende des Arbeitsbereichs auf die Abspielposition'], ['Arbeitsbereich ziehen', 'Enden = Länge, Mitte = verschieben, freie Stelle = neu aufziehen'], ['Doppelklick darauf', 'wieder der ganze Song'], [`+ / − oder ${ALT}Mausrad`, 'zoomen'], [';', 'zwischen bildgenau und ganzem Song wechseln'], [`${SH}Mausrad`, 'seitlich verschieben'],
    ].map(([k, t]) => `<kbd>${esc(k)}</kbd><span>${esc(t)}</span>`).join('') + (MAC ? '<span class="n">F9 ggf. zusammen mit der fn-Taste drücken.</span>' : '');

    const X = t => PAD + t / H().dur * tw;
    // Rand rechts: ein senkrechter Rollbalken zählt mit, damit die Zeitachse bündig unter der Tonspur endet
    const padEnd = () => Math.max(12, ctx.padEnd() - (scroll.offsetWidth - scroll.clientWidth));
    const viewW = () => Math.max(120, scroll.clientWidth - LAB - PAD - padEnd());          // Breite der Zeitachse ohne Zoom
    const timeAt = clientX => { const r = grid.getBoundingClientRect(); return clamp((clientX - r.left - LAB - PAD) / tw * H().dur, 0, H().dur); };
    const seek = t => { const h = H(); if (h.playing()) h.pause(); h.seek(t); };
    const trackOf = k => tracks.find(t => t.v.kf.includes(k));
    const trackByKey = key => tracks.find(t => t.key === key);

    /* ───────────── Darstellung ───────────── */
    function ruler() {                                   // oben die Zeit wie in After Effects, darunter die Takte
      const h = H(), pps = tw / h.dur; let s = '';
      const from = Math.max(0, (scroll.scrollLeft - 200) / pps), to = Math.min(h.dur, (scroll.scrollLeft + scroll.clientWidth + 200) / pps);
      const steps = [1 / 30, 2 / 30, 5 / 30, 10 / 30, .5, 1, 2, 5, 10, 15, 30], step = steps.find(x => x * pps >= 46) || 60;
      const sub = step >= 5 ? 5 : step >= 1 ? 4 : Math.round(step * FPS), minor = sub > 1 && step / sub * pps >= 5 ? step / sub : step;
      for (let n = Math.floor(from / minor); n * minor <= to + 1e-6; n++) {
        const t = n * minor, major = Math.abs(t / step - Math.round(t / step)) < 1e-6;
        let l = '';
        if (major) { const f = Math.round(t * FPS), sec = Math.floor(f / FPS), rest = f % FPS; l = rest ? `${rest}f` : sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
        s += `<i class="s${major ? ' m' : ''}" style="left:${X(t)}px">${l}</i>`;
      }
      const pxBar = h.bar * pps, every = pxBar > 22 ? 1 : pxBar > 11 ? 2 : 4, nb = Math.floor((h.dur - h.offset) / h.bar);
      for (let b = 0; b <= nb; b++) {
        const t = h.offset + b * h.bar; if (t + h.bar < from || t > to) continue;
        if (b % every === 0) s += `<i class="b" style="left:${X(t)}px">${b + 1}</i>`;
        if (pxBar > 120) for (let n = 1; n < 4; n++) { const q4 = t + n * h.beat; if (q4 < h.dur) s += `<i class="b q4" style="left:${X(q4)}px">${pxBar > 220 ? `${b + 1}.${n + 1}` : ''}</i>`; }
      }
      return s;
    }
    function redrawRuler() { const r = grid.querySelector('.ruler .tlx-tr'); if (r) { r.innerHTML = ruler() + '<b class="tlx-phh"></b>'; mark(); } }
    function view() {                                    // die Tonspur der Seite zeigt denselben Ausschnitt wie die Zeitachse
      const size = 1 / zoom, a = clamp(scroll.scrollLeft / tw, 0, 1 - size);
      ctx.onView(a * H().dur, (a + size) * H().dur);
    }
    /* ───────────── Arbeitsbereich ───────────── */
    const secs = t => fmtT(t).replace(/^0:/, '').replace(/(,\d)\d$/, '$1');
    function placeWork() {
      const w = ctx.work(), bar = grid.querySelector('.tlx-work'); if (!bar) return;
      bar.classList.toggle('on', w.on); bar.style.left = X(w.a) + 'px'; bar.style.width = X(w.b) - X(w.a) + 'px';
      const lab = grid.querySelector('.tlx-row.work'); lab.querySelector('small').textContent = w.on ? `${secs(w.a)} – ${secs(w.b)}` : ''; lab.querySelector('button').hidden = !w.on;
      const [l, r] = grid.querySelectorAll('.tlx-out');          // außerhalb liegt ein Schatten
      l.hidden = r.hidden = !w.on; l.style.left = LAB + 'px'; l.style.width = X(w.a) + 'px'; r.style.left = LAB + X(w.b) + 'px'; r.style.right = '0';
    }
    function setWork(a, b) {
      const d = H().dur; a = clamp(snap(a, d), 0, d - WMIN); b = b >= d - .5 / FPS ? d : snap(b, d);
      ctx.setWork(a, Math.max(a + WMIN, b)); placeWork();
    }
    const resetWork = () => setWork(0, H().dur);
    function workEdge(end) {                             // B / N: Anfang bzw. Ende auf die Abspielposition
      const w = ctx.work(), d = H().dur;
      if (end) setWork(ph <= w.a + WMIN ? 0 : w.a, Math.max(ph, WMIN)); else setWork(ph, w.b <= ph + WMIN ? d : w.b);
    }
    const kfClass = (t, i) => { const k = t.v.kf[i], prev = t.v.kf[i - 1]; return `${k.h ? ' hold' : ''}${k.cv ? ' cv' : ''}${k.eo ? ' eo' : ''}${k.ei && !(prev && prev.h) ? ' ei' : ''}`; };
    function render() {
      if (!H()) return;
      tracks = ctx.tracks();
      const all = tracks.flatMap(t => t.v.kf); for (const k of sel) if (!all.includes(k)) sel.delete(k);
      el.classList.toggle('open', open); q('.tlx-tog').setAttribute('aria-expanded', String(open)); q('.tlx-tog small').textContent = all.length || '';
      el.style.setProperty('--end', ctx.padEnd() + 'px'); q('.tlx-zoom').value = Math.round(Math.log(zoom) / Math.log(ZMAX) * 1000);
      if (!open) { help.hidden = true; closeMenu(); ctx.onView(0, H().dur); return; }
      const w = scroll.clientWidth; if (!w) return;                           // noch nicht sichtbar – der ResizeObserver holt das nach
      tw = viewW() * zoom;
      grid.style.width = LAB + tw + PAD + padEnd() + 'px';
      keys = []; let h = `<div class="tlx-row work" title="Arbeitsbereich: dieser Abschnitt wird beim Abspielen wiederholt"><div class="tlx-lab"><span>Arbeitsbereich</span><small></small><button type="button" data-a="wreset" title="Wieder der ganze Song">×</button></div><div class="tlx-tr"><div class="tlx-work"><i data-w="a"></i><i data-w="b"></i></div></div></div>
        <div class="tlx-row ruler"><div class="tlx-lab"><span>Zeit<br>Takt</span></div><div class="tlx-tr">${ruler()}<b class="tlx-phh"></b></div></div>`, scope = null;
      for (const t of tracks) {
        if (t.scope !== scope) { scope = t.scope; h += `<div class="tlx-row head"><div class="tlx-lab">${esc(t.scopeName)}</div><div class="tlx-tr"></div></div>`; }
        const kf = t.v.kf, a = kf[0].t, z = kf[kf.length - 1].t;
        h += `<div class="tlx-row${active === t.key ? ' act' : ''}" data-k="${esc(t.key)}"><div class="tlx-lab">
            <button type="button" data-a="prev" title="Voriger Keyframe">‹</button><button type="button" data-a="tog" class="dm" title="Keyframe an der Abspielposition setzen oder entfernen"></button><button type="button" data-a="next" title="Nächster Keyframe">›</button>
            <span class="n" title="Klick wählt alle Keyframes dieses Reglers"><small>${esc(t.section)}</small> ${esc(t.name)}</span><button type="button" data-a="clear" title="Alle Keyframes dieses Reglers entfernen">×</button></div>
          <div class="tlx-tr"><s style="left:${X(a)}px;width:${X(z) - X(a)}px"></s>${kf.map((k, i) => { const n = keys.push(k) - 1; return `<div class="tlx-k${kfClass(t, i)}${sel.has(k) ? ' sel' : ''}" data-i="${n}" style="left:${X(k.t)}px" title="${esc(fmtT(k.t) + ' · ' + t.fmt(k.v))}"><i></i></div>`; }).join('')}</div></div>`;
      }
      if (!tracks.length) h += '<div class="tlx-empty">Noch keine Keyframes – klicke bei einem Regler auf die Stoppuhr.</div>';
      grid.innerHTML = h + '<div class="tlx-out"></div><div class="tlx-out"></div><div class="tlx-ph"></div><div class="tlx-box" hidden></div>';
      mark(); placeWork(); view();
    }
    function mark() {                                    // Abspielposition und Rauten der Zeilen
      const h = H(); if (!h) return;
      const b = Math.floor((ph - h.offset) / h.beat + 1e-3), txt = fmtT(ph) + (ph < h.offset - 1e-3 ? ' · Auftakt' : ` · Takt ${Math.floor(b / 4) + 1} · Schlag ${((b % 4) + 4) % 4 + 1}`);
      const te = q('.tlx-time'); if (te.textContent !== txt) te.textContent = txt;
      if (!open) return;
      const x = X(ph), l = grid.querySelector('.tlx-ph'), hd = grid.querySelector('.tlx-phh'); if (l) l.style.left = LAB + x + 'px'; if (hd) hd.style.left = x + 'px';
      for (const t of tracks) { const row = grid.querySelector(`.tlx-row[data-k="${CSS.escape(t.key)}"]`); if (row) row.querySelector('.dm').classList.toggle('on', !!at(t.v, ph)); }
    }
    function reveal() {                                  // Abspielposition im sichtbaren Ausschnitt halten
      const x = X(ph) - PAD, l = scroll.scrollLeft, w = viewW();
      if (x < l - 1 || x > l + w + 1) { scroll.scrollLeft = Math.max(0, x - w * .1); redrawRuler(); view(); }
    }
    function tick(t, playing) {
      const vis = el.offsetParent !== null;
      if (vis && !shown) { shown = true; render(); } else if (!vis) shown = false;
      if (Math.abs(t - ph) < 1e-4) return;
      ph = t; mark(); if (open && !drag) reveal();
    }
    function setOpen(o) { open = o; ctx.setOpen(o); render(); }
    function zoomAt(z, time, px) {                      // zoomen, wobei die Stelle „time“ an der Bildschirmstelle „px“ bleibt
      zoom = clamp(z, 1, ZMAX); render(); scroll.scrollLeft = Math.max(0, X(time) - px); redrawRuler(); view();
    }
    function setZoom(z) {                                // um die Abspielposition herum (liegt sie außerhalb, kommt sie in die Mitte)
      const w = scroll.clientWidth - LAB, px = X(ph) - scroll.scrollLeft; zoomAt(z, ph, px >= 0 && px <= w ? px : w / 2);
    }

    /* ───────────── Bearbeiten ───────────── */
    const done = tag => { ctx.commit(tag); };
    function drop(pred) {                                // Keyframes entfernen; verliert ein Regler alle, bleibt der letzte Wert stehen
      for (const t of tracks) {
        const gone = t.v.kf.filter(pred); if (!gone.length) continue;
        const rest = t.v.kf.filter(k => !pred(k));
        if (rest.length) t.v.kf = rest; else ctx.setStatic(t.scope, t.id, A.kfValue(t.v, ph));
      }
    }
    function remove() { if (!sel.size) return; drop(k => sel.has(k)); sel.clear(); done(); }
    function overwrite(moved) {                          // verschobene Punkte ersetzen die, auf denen sie landen
      for (const t of tracks) {
        const m = t.v.kf.filter(k => moved.has(k));
        if (m.length) { const seen = []; t.v.kf = t.v.kf.filter(k => { if (!moved.has(k)) return !m.some(x => near(x.t, k.t)); if (seen.some(x => near(x, k.t))) return false; seen.push(k.t); return true; }); sort(t.v); }
      }
    }
    function collect() {                                 // gewählte Keyframes als Zwischenablage
      const items = tracks.map(t => ({ scope: t.scope, id: t.id, type: t.type, keys: copy(t.v.kf.filter(k => sel.has(k))) })).filter(i => i.keys.length);
      return items.length ? { items, t0: Math.min(...items.flatMap(i => i.keys.map(k => k.t))), t1: Math.max(...items.flatMap(i => i.keys.map(k => k.t))) } : null;
    }
    function reversed(keys_) {                           // Reihenfolge umkehren, Übergänge spiegeln
      const r = keys_.slice().reverse();
      return r.map((k, i) => { const seg = r[i + 1], cv = seg && seg.cv ? A.curveBez(seg.cv) : null; return { t: k.t, v: k.v, ei: k.eo, eo: k.ei, h: !!(seg && seg.h), ...(cv ? { cv: { p: 'custom', b: [1 - cv[2], 1 - cv[3], 1 - cv[0], 1 - cv[1]] } } : seg && seg.cv ? { cv: seg.cv } : {}) }; });
    }
    function paste(c, t, back) {
      if (!c) return;
      const h = H(), made = new Set(), act = ctx.activeProp(active);
      for (const it of c.items) {
        // ein einzelner kopierter Regler lässt sich in einen anderen gewählten Regler gleicher Art einsetzen
        const dst = c.items.length === 1 && act && act.type === it.type ? act : it;
        const v = ctx.ensure(dst.scope, dst.id); if (!v) continue;
        const src = back ? reversed(it.keys) : copy(it.keys), fresh = [];
        for (const k of src) { const nt = t + (back ? c.t1 - k.t : k.t - c.t0); if (nt > h.dur + .5 / FPS) continue; k.t = snap(nt, h.dur); if (typeof k.v === 'number') k.v = ctx.limit(dst.scope, dst.id, k.v); fresh.push(k); }
        v.kf = v.kf.filter(k => !fresh.some(f => near(f.t, k.t))).concat(fresh); sort(v); fresh.forEach(k => made.add(k));
        if (!v.kf.length) ctx.setStatic(dst.scope, dst.id, null);
      }
      if (!made.size) return;
      sel.clear(); made.forEach(k => sel.add(k)); done(); render();
    }
    function duplicate() { const c = collect(); if (c) paste(c, near(c.t0, ph) ? c.t0 + H().beat : ph); }
    function nudge(frames) {
      if (!sel.size) return;
      const h = H(), ts = [...sel].map(k => k.t), d = clamp(frames / FPS, -Math.min(...ts), h.dur - Math.max(...ts));
      for (const k of sel) k.t = snap(k.t + d, h.dur);
      tracks.forEach(t => sort(t.v)); overwrite(sel); done('nudge');
    }
    function ease(mode) {
      if (!sel.size) return;
      const hold = mode === 'hold' && ![...sel].every(k => k.h);
      for (const t of tracks) t.v.kf.forEach((k, i) => {
        if (!sel.has(k)) return;
        const prev = t.v.kf[i - 1];
        if (mode === 'hold') { k.h = hold; return; }
        if (mode === 'linear' || mode === 'easy' || mode === 'in') { k.ei = mode !== 'linear'; if (prev) { delete prev.cv; prev.h = false; } }
        if (mode === 'linear' || mode === 'easy' || mode === 'out') { k.eo = mode !== 'linear'; delete k.cv; k.h = false; }
      });
      done();
    }
    function segments() {                                // Abschnitte, die an einem gewählten Keyframe beginnen
      const segs = []; for (const t of tracks) t.v.kf.forEach((k, i) => { if (sel.has(k) && t.v.kf[i + 1]) segs.push([k, t.v.kf[i + 1]]); }); return segs;
    }
    function curve() {
      const segs = segments(), anchor = grid.querySelector('.tlx-k.sel'); if (!segs.length || !anchor) return;
      ctx.openCurve(anchor, A.segCurve(...segs[0]) || { p: 'linear' }, cv => { for (const [k] of segs) { k.cv = cv; k.h = false; } done('curve'); });
    }
    function jump(dir, only) {
      const ts = (only ? only.v.kf : tracks.flatMap(t => t.v.kf)).map(k => k.t).sort((a, b) => a - b);
      const t = dir > 0 ? ts.find(x => x > ph + .5 / FPS) : ts.reverse().find(x => x < ph - .5 / FPS);
      if (t != null) { seek(t); ph = t; mark(); reveal(); }
    }
    const step = frames => { const h = H(), t = clamp((Math.round(h.time() * FPS) + frames) / FPS, 0, h.dur); seek(t); };
    const selectAll = () => { tracks.forEach(t => t.v.kf.forEach(k => sel.add(k))); render(); };

    /* ───────────── Maus ───────────── */
    function closeMenu() { if (menu) { menu.remove(); menu = null; } }
    let tap = { t: -1e9, x: 0, y: 0 };
    function doubled(ev) {                               // zweiter Klick kurz hintereinander auf dieselbe Stelle?
      const yes = ev.timeStamp - tap.t < 400 && Math.hypot(ev.clientX - tap.x, ev.clientY - tap.y) < 6;
      tap = yes ? { t: -1e9, x: 0, y: 0 } : { t: ev.timeStamp, x: ev.clientX, y: ev.clientY }; return yes;
    }
    function addAt(trackKey, clientX) {
      const t = trackByKey(trackKey), time = snap(timeAt(clientX), H().dur), k = set(t.v, time, A.kfValue(t.v, time));
      active = t.key; sel.clear(); sel.add(k); seek(time); done();
    }
    grid.addEventListener('pointerdown', ev => {
      closeMenu(); const f = el.getRootNode().activeElement; if (f && f.blur) f.blur();      // Eingabefeld verlassen, damit die Tasten wirken
      if (ev.button !== 0 || ev.target.closest('button')) return;
      const kEl = ev.target.closest('.tlx-k'), row = ev.target.closest('.tlx-row'), tr = ev.target.closest('.tlx-tr');
      if (row && row.classList.contains('work')) {
        if (!tr) return; ev.preventDefault();
        if (doubled(ev)) { resetWork(); return; }
        const w = ctx.work(), t = timeAt(ev.clientX), edge = ev.target.dataset.w, inside = ev.target.closest('.tlx-work') && w.on;
        drag = { type: 'work', h: edge || (inside ? 'm' : 'new'), t, a: w.a, b: w.b, x0: ev.clientX };
      } else if (kEl) {
        const k = keys[+kEl.dataset.i], t = trackOf(k); active = t.key;
        if (ev.shiftKey) { if (sel.has(k)) sel.delete(k); else sel.add(k); } else if (!sel.has(k)) { sel.clear(); sel.add(k); }
        drag = { type: 'move', x0: ev.clientX, k, shift: ev.shiftKey, alt: ev.altKey, moved: false, orig: new Map([...sel].map(x => [x, x.t])) };
        render();
      } else if (row && row.classList.contains('ruler') && tr) { drag = { type: 'scrub' }; seek(timeAt(ev.clientX)); }
      else if (ev.target.closest('.tlx-lab')) { if (row && row.dataset.k) { const t = trackByKey(row.dataset.k); active = t.key; if (!ev.shiftKey) sel.clear(); t.v.kf.forEach(k => sel.add(k)); render(); ctx.reveal(t.scope, t.id); } return; }
      else if (row && row.dataset.k && doubled(ev)) { addAt(row.dataset.k, ev.clientX); ev.preventDefault(); return; }
      else { const r = grid.getBoundingClientRect(); drag = { type: 'box', x0: ev.clientX - r.left, y0: ev.clientY - r.top, cx: ev.clientX, add: ev.shiftKey, base: new Set(ev.shiftKey ? sel : []), moved: false }; }
      grid.setPointerCapture(ev.pointerId); ev.preventDefault();
    });
    grid.addEventListener('pointermove', ev => {
      if (!drag) return; const h = H();
      if (drag.type === 'scrub') seek(timeAt(ev.clientX));
      else if (drag.type === 'work') {
        if (Math.abs(ev.clientX - drag.x0) < 3 && !drag.moved) return; drag.moved = true;
        let t = timeAt(ev.clientX);
        if (ev.shiftKey) {                                // einrasten an Schlägen, Abspielposition und Keyframes
          const c = [ph, h.offset + Math.round((t - h.offset) / h.beat) * h.beat, ...tracks.flatMap(x => x.v.kf).map(k => k.t)];
          for (const x of c) if (Math.abs(x - t) / h.dur * tw < 9) { t = x; break; }
        }
        if (drag.h === 'a') setWork(Math.min(t, drag.b - WMIN), drag.b);
        else if (drag.h === 'b') setWork(drag.a, Math.max(t, drag.a + WMIN));
        else if (drag.h === 'new') setWork(Math.min(drag.t, t), Math.max(drag.t, t));
        else { const len = drag.b - drag.a, a = clamp(drag.a + t - drag.t, 0, h.dur - len); setWork(a, a + len); }
        const w = ctx.work(), r = el.getBoundingClientRect(); tip.hidden = false; tip.textContent = `${secs(w.a)} – ${secs(w.b)}`; tip.style.left = clamp(ev.clientX - r.left - 48, 0, r.width - 110) + 'px'; tip.style.top = Math.max(0, ev.clientY - r.top - 30) + 'px';
      }
      else if (drag.type === 'move') {
        const dx = ev.clientX - drag.x0; if (!drag.moved && Math.abs(dx) < 3) return;
        if (!drag.moved) {
          drag.moved = true;
          if (!sel.has(drag.k)) return;
          if (drag.alt) for (const t of tracks) { const c = copy(t.v.kf.filter(k => sel.has(k))); if (c.length) t.v.kf.push(...c); }   // Kopien bleiben liegen, die gewählten wandern
        }
        if (!drag.orig.size) return;
        const o = drag.orig.get(drag.k); if (o == null) return;
        let d = dx / tw * h.dur;
        if (ev.shiftKey) {                                // einrasten an Abspielposition, anderen Keyframes und Schlägen
          const c = [ph, h.offset + Math.round((o + d - h.offset) / h.beat) * h.beat, ...tracks.flatMap(t => t.v.kf).filter(k => !sel.has(k)).map(k => k.t)];
          let best = null; for (const t of c) if (Math.abs(t - o - d) / h.dur * tw < 9 && (best == null || Math.abs(t - o - d) < Math.abs(best - o - d))) best = t;
          if (best != null) d = best - o;
        }
        const ts = [...drag.orig.values()]; d = clamp(Math.round(d * FPS) / FPS, -Math.min(...ts), h.dur - Math.max(...ts));
        for (const [k, t] of drag.orig) k.t = snap(t + d, h.dur);
        tracks.forEach(t => sort(t.v)); render(); ctx.preview();
        const r = el.getBoundingClientRect(); tip.hidden = false; tip.textContent = fmtT(drag.k.t); tip.style.left = clamp(ev.clientX - r.left - 24, 0, r.width - 60) + 'px'; tip.style.top = Math.max(0, ev.clientY - r.top - 30) + 'px';
      } else {
        const r = grid.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, b = grid.querySelector('.tlx-box');
        if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) < 4) return; drag.moved = true;
        const x0 = Math.min(x, drag.x0), x1 = Math.max(x, drag.x0), y0 = Math.min(y, drag.y0), y1 = Math.max(y, drag.y0);
        Object.assign(b.style, { left: x0 + 'px', top: y0 + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px' }); b.hidden = false;
        sel.clear(); drag.base.forEach(k => sel.add(k));
        grid.querySelectorAll('.tlx-k').forEach(e => { const q2 = e.getBoundingClientRect(), cx = q2.left + q2.width / 2 - r.left, cy = q2.top + q2.height / 2 - r.top, k = keys[+e.dataset.i]; if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) sel.add(k); e.classList.toggle('sel', sel.has(k)); });
      }
    });
    function up() {
      const d = drag; if (!d) return; drag = null; tip.hidden = true;
      if (d.type === 'move') {
        if (d.moved) { overwrite(sel); done(); }
        else if (!d.shift) { sel.clear(); sel.add(d.k); const t = trackOf(d.k); seek(d.k.t); ph = d.k.t; render(); ctx.reveal(t.scope, t.id); }
      } else if (d.type === 'box') { if (!d.moved && !d.add) { sel.clear(); seek(timeAt(d.cx)); } render(); }
    }
    grid.addEventListener('pointerup', up); grid.addEventListener('pointercancel', up);
    grid.addEventListener('click', ev => {
      const b = ev.target.closest('button[data-a]'); if (!b) return;
      if (b.dataset.a === 'wreset') { resetWork(); return; }
      const t = trackByKey(b.closest('.tlx-row').dataset.k); if (!t) return; active = t.key;
      if (b.dataset.a === 'prev') jump(-1, t); else if (b.dataset.a === 'next') jump(1, t);
      else if (b.dataset.a === 'tog') { const k = at(t.v, ph); if (k) drop(x => x === k); else sel.clear(), sel.add(set(t.v, snap(ph, H().dur), A.kfValue(t.v, ph))); done(); }
      else { ctx.setStatic(t.scope, t.id, A.kfValue(t.v, ph)); done(); }
    });
    grid.addEventListener('contextmenu', ev => {
      const kEl = ev.target.closest('.tlx-k'), row = ev.target.closest('.tlx-row[data-k]'); if (!row) return;
      ev.preventDefault(); closeMenu(); active = row.dataset.k;
      if (kEl) { const k = keys[+kEl.dataset.i]; if (!sel.has(k)) { sel.clear(); sel.add(k); } render(); }
      const items = [...(sel.size ? [['Linear', () => ease('linear')], ['Weich', () => ease('easy'), 'F9'], ['Weich ankommen', () => ease('in'), SH + 'F9'], ['Weich loslaufen', () => ease('out'), MOD + SH + 'F9'], ['Halten', () => ease('hold'), 'Ctrl' + ALT + 'H'], ...(segments().length ? [['Kurve…', curve]] : []), null,
        ['Kopieren', () => { clip = collect(); }, MOD + 'C'], ['Duplizieren', duplicate, MOD + 'D']] : []),
        ...(clip ? [['Einsetzen an der Abspielposition', () => paste(clip, ph), MOD + 'V'], ['Rückwärts einsetzen', () => paste(clip, ph, true), MOD + SH + 'V']] : []),
        ...(sel.size ? [null, ['Löschen', remove, '⌫']] : [])];
      if (!items.length) return;
      menu = document.createElement('div'); menu.className = 'tlx-menu';
      menu.innerHTML = items.map((it, i) => it ? `<button type="button" data-i="${i}">${esc(it[0])}<small>${esc(it[2] || '')}</small></button>` : '<hr>').join('');
      el.appendChild(menu);
      menu.style.left = clamp(ev.clientX, 4, innerWidth - menu.offsetWidth - 4) + 'px'; menu.style.top = clamp(ev.clientY, 4, innerHeight - menu.offsetHeight - 4) + 'px';
      menu.onclick = e => { const b = e.target.closest('button'); if (b) { const f = items[+b.dataset.i][1]; closeMenu(); f(); } };
    });
    document.addEventListener('pointerdown', ev => { const p = ev.composedPath(); if (menu && !p.includes(menu)) closeMenu(); if (!help.hidden && !p.includes(help) && !p.includes(q('[data-a="help"]'))) help.hidden = true; }, true);
    q('.tlx-tog').onclick = () => setOpen(!open);
    q('.tlx-tools').addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'zin') setZoom(zoom * 1.6); else if (b.dataset.a === 'zout') setZoom(zoom / 1.6); else help.hidden = !help.hidden;
    });
    const slider = q('.tlx-zoom');
    slider.addEventListener('input', () => setZoom(Math.pow(ZMAX, slider.value / 1000)));
    slider.addEventListener('change', () => slider.blur());
    scroll.addEventListener('wheel', ev => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey) {       // ⌥ + Mausrad bzw. Zwei-Finger-Zoom
        ev.preventDefault(); const d = ev.deltaY || ev.deltaX, px = ev.clientX - scroll.getBoundingClientRect().left - LAB;
        zoomAt(zoom * Math.exp(-d * (ev.ctrlKey ? .01 : .003)), timeAt(ev.clientX), px);
      } else if (ev.shiftKey && !ev.deltaX) { ev.preventDefault(); scroll.scrollLeft += ev.deltaY; }
    }, { passive: false });
    let scT = 0; scroll.addEventListener('scroll', () => { cancelAnimationFrame(scT); scT = requestAnimationFrame(() => { if (!H() || drag) return; redrawRuler(); view(); }); });
    let lastW = 0; new ResizeObserver(() => { if (scroll.clientWidth !== lastW) { lastW = scroll.clientWidth; if (!drag) render(); } }).observe(scroll);

    /* ───────────── Tasten ───────────── */
    function key(ev) {
      const k = ev.key, low = k.length === 1 ? k.toLowerCase() : k, mod = ev.metaKey || ev.ctrlKey, alt = ev.altKey, sh = ev.shiftKey, arrow = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, n = sh ? 10 : 1;
      if (ev.ctrlKey && alt && ev.code === 'KeyH') ease('hold');
      else if (mod && !alt && low === 'z') ctx.undo(sh);
      else if (ev.ctrlKey && !alt && low === 'y') ctx.undo(true);
      else if (mod && !alt && low === 'c' && sel.size) clip = collect();
      else if (mod && !alt && low === 'x' && sel.size) { clip = collect(); remove(); }
      else if (mod && !alt && low === 'v' && clip) paste(clip, snap(H().time(), H().dur), sh);
      else if (mod && !alt && low === 'd' && sel.size) duplicate();
      else if (mod && !alt && low === 'a' && tracks.length && open) selectAll();
      else if (alt && !mod && arrow && sel.size) nudge(arrow * n);
      else if (mod && !alt && arrow) step(arrow * n);
      else if (k === 'PageUp' || k === 'PageDown') step((k === 'PageUp' ? -1 : 1) * n);
      else if (k === 'F9') { if (!sel.size) return false; ease(sh ? (mod ? 'out' : 'in') : 'easy'); }
      else if (mod || alt) return false;
      else if (low === 'j' && tracks.length) jump(-1);
      else if (low === 'k' && tracks.length) jump(1);
      else if (low === 'u') setOpen(!open);
      else if (low === 'b' || low === 'n') workEdge(low === 'n');
      else if ((k === 'Delete' || k === 'Backspace') && sel.size && open) remove();
      else if (k === 'Escape' && (menu || !help.hidden || sel.size)) { closeMenu(); help.hidden = true; sel.clear(); render(); }
      else if ((k === ';' || k === 'ö') && open) setZoom(zoom > 12 ? 1 : H().dur * FPS * 12 / viewW());     // bildgenau ⇄ ganzer Song
      else if ((k === '+' || k === '=') && open) setZoom(zoom * 1.6);
      else if (k === '-' && open) setZoom(zoom / 1.6);
      else if (k === 'End') seek(H().dur);
      else return false;
      return true;
    }

    return {
      el, render, tick, key,
      isOpen: () => open, show: () => { if (!open) setOpen(true); },
      reset: () => { sel.clear(); active = ''; drag = null; closeMenu(); },
      select: (k, trackKey) => { sel.clear(); if (k) sel.add(k); active = trackKey; },
    };
  }
  window.AETimeline = { create, K };
})();
