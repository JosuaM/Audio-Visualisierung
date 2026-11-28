'use strict';
/* ═════════════════════════════════════════════════════════════════════════
   Animations-Editor – Oberfläche (Regler, Stoppuhr, Kurven-Editor, Vorlagen)
   Gebraucht werden editor-engine.js (window.AE) und editor-timeline.js (Keyframe-Zeitleiste). Seite ruft auf:
     Editor.mount(wurzel, { ratio }) baut Vorschau (Standard 4 : 3) und Regler-Panel
     Editor.dockTimeline(element)    setzt die Keyframe-Zeitleiste an eine andere Stelle der Seite
     Editor.onView = (von, bis)      wird aufgerufen, wenn die Zeitleiste einen anderen Ausschnitt des Songs zeigt (Sekunden)
     Editor.work() / Editor.onWork   Arbeitsbereich [von, bis] bzw. null = ganzer Song; er wird beim Abspielen wiederholt
     Editor.load(schlüssel, idea)    wählt eine Animation (Schlüssel = Spur:Titel) und lädt Arbeitsstand + Vorlagen
     Editor.frame(s)                 in jedem Bild aufrufen: s = { t, fg, bg, col }
     Editor.host = { … }             Uhr der Seite für die Keyframes (siehe editor-timeline.js)
     Editor.look(schlüssel)          die geltende Version einer Animation (gewählte bzw. gespeicherte Vorlage) oder null = Original
     Editor.presets() / addPresets() eigene Vorlagen lesen bzw. übernehmen (das Studio speichert sie mit im Projektordner)
     Editor.active() / setActive()   welche Vorlage je Animation gilt
     Editor.onPresets                wird aufgerufen, wenn sich Vorlagen oder die geltende Vorlage ändern
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  const CSS_URL = new URL('editor.css', (document.currentScript && document.currentScript.src) || location.href).href;
  const A = AE, STORE = 'av-anim-editor-v1', OPENKEY = 'av-anim-editor-open-v2';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const copy = o => JSON.parse(JSON.stringify(o));
  const stable = v => JSON.stringify(v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(n => [n, x[n]])) : x);
  const same = (a, b) => stable(a) === stable(b);      // Reihenfolge der Einträge spielt keine Rolle
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const empty = () => ({ g: {}, o: {} });
  const dec = step => step < 1 ? (String(step).split('.')[1] || '').length : 0;
  const SW = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5M9.5 3h5M12 3v3M18.5 6.5l1.2 1.2"/></svg>';
  const NOREC = { clip: 'eine Maske (Beschneiden) nutzt', 'Zwischenspeicher': 'einen Zwischenspeicher (Bild im Bild) nutzt', 'Mischmodus': 'einen eigenen Mischmodus nutzt', drawImage: 'eingebettete Bilder nutzt', 'Fehler': 'eine nicht unterstützte Zeichenfunktion nutzt' };
  const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE0 = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M4 4l16 16"/></svg>';

  /* ───────────── Mitgelieferte Vorlagen (für jede Animation) ───────────── */
  const BUILTIN = {
    'Neon-Leuchten': { g: { glow: 70, glr: 22, con: 120, sat: 160, gro: true, gra: '#ff3fa6', grb: '#46d9ee', gran: 90 }, o: {} },
    'Verträumt': { g: { blur: 2.5, glow: 45, glr: 30, ecn: 5, ecd: .18, ecf: 65, bri: 110 }, o: {} },
    'Retro-TV': { g: { rgb: 3, scan: 45, scs: 3, grn: 35, vig: 40, wva: 3, wvl: 60, wvs: .5, sat: 130 }, o: {} },
    'Kaleidoskop': { g: { kal: 6, ecn: 2, ecd: .12, ecf: 60 }, o: {} },
    'Bewegungsunschärfe': { g: { mbs: .4, mbn: 8 }, o: {} },
    'Federnd (Zeit-Kurve)': { g: { tcurve: { p: 'backOut' }, tper: 'half', tamt: 100 }, o: {} },
    'Mosaik': { g: { mos: 14, sat: 140 }, o: {} },
  };

  /* ───────────── Speicher (localStorage) ───────────── */
  let DB = { a: {} };
  try { const d = JSON.parse(localStorage.getItem(STORE) || 'null'); if (d && d.a) DB = d; } catch (e) {}
  let saveT = 0, saveErr = false;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(DB)); saveErr = false; } catch (e) { saveErr = true; } status(); }, 200);
  }
  let OPEN = {}; try { OPEN = JSON.parse(localStorage.getItem(OPENKEY) || '{}') || {}; } catch (e) {}
  const saveOpen = () => { try { localStorage.setItem(OPENKEY, JSON.stringify(OPEN)); } catch (e) {} };

  /* ───────────── Zustand ───────────── */
  const R = new A.Renderer(), K = AETimeline.K;
  const ALT = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌥' : 'Alt';
  const E = { key: '', idea: null, S: empty(), sel: '', root: null, cv: null, stage: null, props: null, shownVer: -1, tl: null, ph: 0, dragRow: null, docked: false, side: null, jumped: 0 };
  const entry = () => DB.a[E.key] || (DB.a[E.key] = { w: empty(), p: {}, c: '' });
  const getBag = (scope, mk) => scope === 'g' ? E.S.g : ((E.S.o[scope] || (mk ? (E.S.o[scope] = {}) : null)) || null);
  const defOf = (scope, id) => (scope === 'g' ? A.GP : A.OP)[id];
  const getRaw = (scope, id) => { const b = getBag(scope), v = b ? b[id] : undefined; return v === undefined ? defOf(scope, id).def : v; };
  function setVal(scope, id, v) {
    const d = defOf(scope, id), b = getBag(scope, true);
    if (same(v, d.def)) delete b[id]; else b[id] = v;
    if (scope !== 'g' && !Object.keys(b).length) delete E.S.o[scope];
  }
  const nz = (scope, id) => { const v = getRaw(scope, id); return A.isKf(v) ? Math.max(...v.kf.map(k => Math.abs(k.v))) : A.isAn(v) ? Math.max(Math.abs(v.a), Math.abs(v.b)) : (+v || 0); };
  const valueNow = raw => A.isKf(raw) ? A.kfValue(raw, E.ph) : A.isAn(raw) ? raw.a : raw;      // was der Regler gerade zeigt
  const isDirty = () => { const p = E.sel.startsWith('u:') ? entry().p[E.sel.slice(2)] : E.sel.startsWith('b:') ? BUILTIN[E.sel.slice(2)] : empty(); return !same(E.S, p || empty()); };
  const touch = tag => { histPush(tag); entry().w = copy(E.S); entry().c = E.sel; persist(); refreshAll(); status(); if (E.tl) E.tl.render(); };

  /* ───────────── Rückgängig / Wiederholen ───────────── */
  let hist = { u: [], r: [], last: '', tag: '', time: 0 };
  const histReset = () => { hist = { u: [], r: [], last: JSON.stringify(E.S), tag: '', time: 0 }; if (E.tl) { E.tl.reset(); E.tl.render(); } };
  function histPush(tag) {                   // gleiche Bewegung kurz hintereinander (Regler ziehen) = ein Schritt
    const now = JSON.stringify(E.S), t = performance.now(); if (now === hist.last) return;
    if (!(tag && tag === hist.tag && t - hist.time < 800)) { hist.u.push(hist.last); if (hist.u.length > 200) hist.u.shift(); }
    hist.r = []; hist.last = now; hist.tag = tag || ''; hist.time = t;
  }
  function undo(redo) {
    const from = redo ? hist.r : hist.u, to = redo ? hist.u : hist.r; if (!from.length) return;
    to.push(hist.last); hist.last = from.pop(); hist.tag = ''; E.S = JSON.parse(hist.last);
    entry().w = copy(E.S); persist(); const y = E.side.scrollTop; E.tl.reset(); buildProps(); E.side.scrollTop = y; status(); E.tl.render();
  }

  /* ───────────── Keyframes ───────────── */
  function keyTime() {                       // Stelle für einen neuen Keyframe: anhalten und genau auf ein Bild stellen
    const h = api.host; if (h.playing()) h.pause();
    const t = K.snap(h.time(), h.dur); if (Math.abs(h.time() - t) > 1e-3) h.seek(t); return (E.ph = t);
  }
  function stopwatch(scope, id, all) {       // Klick auf die Stoppuhr
    const raw = getRaw(scope, id); if (!api.host) return;
    if (all) { if (A.isKf(raw) || A.isAn(raw)) setVal(scope, id, valueNow(raw)); return; }
    const t = keyTime();
    if (!A.isKf(raw)) { setVal(scope, id, { kf: [{ t, v: valueNow(raw) }] }); E.tl.show(); return; }
    const k = K.at(raw, t);
    if (!k) K.set(raw, t, A.kfValue(raw, t)); else if (raw.kf.length > 1) raw.kf.splice(raw.kf.indexOf(k), 1); else setVal(scope, id, k.v);
  }
  function writeValue(scope, id, v) { const raw = getRaw(scope, id); if (A.isKf(raw)) K.set(raw, keyTime(), v); else setVal(scope, id, v); }
  const work = () => Array.isArray(OPEN.work) && OPEN.work[1] > OPEN.work[0] ? OPEN.work : null;
  function setWork(a, b) {
    OPEN.work = a > .001 || b < api.host.dur - .001 ? [a, b] : null; saveOpen(); if (api.onWork) api.onWork(work());
  }
  function loopWork(h) {                     // beim Abspielen bleibt der Song im Arbeitsbereich
    const w = work(), now = performance.now(); if (!w || now - E.jumped < 250) return;
    if (h.ended && h.ended()) { E.jumped = now; h.seek(w[0]); h.toggle(); return; }
    if (!h.playing()) return;
    const t = h.time(); if (t < w[0] - .08 || t >= Math.min(w[1] - .02, h.dur - .08)) { E.jumped = now; h.seek(w[0]); }
  }
  const hasKf = () => [E.S.g, ...Object.values(E.S.o)].some(b => Object.values(b).some(A.isKf));
  function refreshKfRows() {                 // animierte Regler zeigen den Wert an der Abspielposition
    if (!E.props) return;
    E.props.querySelectorAll('.pr.kf').forEach(row => {
      const raw = getRaw(row.dataset.scope, row.dataset.id); if (!A.isKf(raw)) return;
      const d = defOf(row.dataset.scope, row.dataset.id), v = A.kfValue(raw, E.ph), busy = i => i.getRootNode().activeElement === i;
      const r = row.querySelector('.rg'), n = row.querySelector('.nm'), c = row.querySelector('.cl');
      if (r && row !== E.dragRow) r.value = v; if (n && !busy(n)) n.value = fmtN(v, d); if (c && !busy(c)) c.value = v;
      row.querySelector('.sw').classList.toggle('at', !!K.at(raw, E.ph));
    });
  }
  function tracks() {                        // alle animierten Regler in der Reihenfolge des Panels
    const out = [];
    const add = (scope, scopeName, groups) => {
      const bag = getBag(scope); if (!bag) return;
      for (const g of groups) for (const [section, defs] of g.secs) for (const d of defs) { const v = bag[d.id]; if (A.isKf(v)) out.push({ key: scope + '|' + d.id, scope, id: d.id, v, type: d.t, scopeName, section, name: d.l, fmt: x => d.t === 'n' ? fmtN(x, d) + d.u : x }); }
    };
    add('g', 'Ganzes Bild', A.GLOBAL_GROUPS); add('*', 'Alle Objekte', A.OBJ_GROUPS);
    for (const o of R.objs) add(o.id, o.name, A.OBJ_GROUPS);
    for (const id in E.S.o) if (id !== '*' && !R.byId[id]) add(id, 'Objekt', A.OBJ_GROUPS);
    return out;
  }
  function markRow(row) { E.props.querySelectorAll('.pr.act').forEach(r => r.classList.remove('act')); if (row) row.classList.add('act'); }
  function reveal(scope, id) {               // den zugehörigen Regler rechts zeigen
    const tab = scope === 'g' ? 'g' : scope === '*' ? 'a' : 'o';
    if (OPEN.tab !== tab) { OPEN.tab = tab; saveOpen(); showTab(); }
    const row = E.props.querySelector(`.pr[data-scope="${scope}"][data-id="${id}"]`); if (!row) return;
    for (let d = row.closest('details'); d; d = d.parentElement.closest('details')) d.open = true;
    const p = E.side.getBoundingClientRect(), r = row.getBoundingClientRect(), head = E.tabs.offsetHeight + 40;     // Reiter + Gruppenkopf bleiben oben stehen
    if (r.top < p.top + head || r.bottom > p.bottom - 6) E.side.scrollTop += r.top - p.top - Math.max(head, p.height / 2);
    markRow(row);
  }
  function buildTimeline(host) {
    E.tl = AETimeline.create({
      A, host: () => api.host, padEnd: () => E.docked ? 64 : 12, onView: (a, b) => { if (api.onView) api.onView(a, b); }, setWork,
      work: () => { const w = work(), d = api.host.dur; return w ? { a: clamp(w[0], 0, d), b: clamp(w[1], 0, d), on: true } : { a: 0, b: d, on: false }; }, open: () => !!OPEN.tl, setOpen: o => { OPEN.tl = o; saveOpen(); }, tracks, reveal, undo, openCurve,
      setStatic: (scope, id, v) => setVal(scope, id, v == null ? defOf(scope, id).def : v),
      ensure: (scope, id) => {               // Regler zum Einfügen von Keyframes vorbereiten
        if (scope !== 'g' && scope !== '*' && !R.byId[scope]) return null; if (!defOf(scope, id)) return null;
        const raw = getRaw(scope, id); if (A.isKf(raw)) return raw; const v = { kf: [] }; setVal(scope, id, v); return v;
      },
      limit: (scope, id, v) => { const d = defOf(scope, id); return clamp(v, d.min, d.max); },
      activeProp: key => { const [scope, id] = String(key).split('|'), d = id && defOf(scope, id); return d ? { scope, id, type: d.t } : null; },
      preview: refreshKfRows,
      commit: tag => { E.props.querySelectorAll('.pr').forEach(row => { if (row.classList.contains('kf') || A.isKf(getRaw(row.dataset.scope, row.dataset.id))) fillRow(row); }); touch(tag); },
    });
    host.appendChild(E.tl.el);
  }

  /* ───────────── Regler-Zeilen ───────────── */
  const DEP = {
    g: { fgc: s => getRaw(s, 'fgm') === 'custom', bgc: s => !!getRaw(s, 'bgo'), gra: s => !!getRaw(s, 'gro'), grb: s => !!getRaw(s, 'gro'), gran: s => !!getRaw(s, 'gro'), gram: s => !!getRaw(s, 'gro'), gras: s => !!getRaw(s, 'gro'),
      mbn: s => nz(s, 'mbs') > 0, ecd: s => nz(s, 'ecn') > 0, ecf: s => nz(s, 'ecn') > 0, glr: s => nz(s, 'glow') > 0, dsc: s => nz(s, 'dsa') > 0, dsx: s => nz(s, 'dsa') > 0, dsy: s => nz(s, 'dsa') > 0, dsb: s => nz(s, 'dsa') > 0,
      wvl: s => nz(s, 'wva') > 0, wvs: s => nz(s, 'wva') > 0, kar: s => nz(s, 'kal') > 1, scs: s => nz(s, 'scan') > 0, tper: s => getRaw(s, 'tcurve').p !== 'linear', tamt: s => getRaw(s, 'tcurve').p !== 'linear', tph: s => getRaw(s, 'tcurve').p !== 'linear', tlen: s => getRaw(s, 'tcurve').p !== 'linear' && getRaw(s, 'tper') === 'custom' },
    o: { oc: s => getRaw(s, 'om') === 'custom', glr: s => nz(s, 'glow') > 0, tper: s => getRaw(s, 'tcurve').p !== 'linear', tamt: s => getRaw(s, 'tcurve').p !== 'linear', tph: s => getRaw(s, 'tcurve').p !== 'linear', tlen: s => getRaw(s, 'tcurve').p !== 'linear' && getRaw(s, 'tper') === 'custom' },
  };
  const fmtN = (v, d) => (+v).toFixed(dec(d.step));
  const rangeHtml = (cls, d, v) => `<input class="${cls}" type="range" min="${d.min}" max="${d.max}" step="${d.step}" value="${v}">`;
  const numHtml = (cls, d, v) => `<span class="nw"><input class="${cls}" type="number" min="${d.min}" max="${d.max}" step="${d.step}" value="${fmtN(v, d)}"><i>${esc(d.u)}</i></span>`;
  function fillRow(row) {
    const scope = row.dataset.scope, d = defOf(scope, row.dataset.id), raw = getRaw(scope, d.id), lab = `<span class="pl" title="${esc(d.tip || '')}">${esc(d.l)}</span>`;
    const isDef = same(raw, d.def), rs = `<button type="button" class="rs" title="Zurücksetzen" ${isDef ? 'disabled' : ''}>↺</button>`;
    const kf = A.isKf(raw), an = A.isAn(raw), v = valueNow(raw);
    const sw = `<button type="button" class="sw${kf || an ? ' on' : ''}${kf && K.at(raw, E.ph) ? ' at' : ''}" title="${kf ? `Keyframe an der Abspielposition setzen oder entfernen (${ALT}+Klick entfernt alle)` : 'Keyframe an der Abspielposition setzen'}" aria-pressed="${kf || an}">${SW}</button>`;
    row.classList.toggle('mod', !isDef); row.classList.toggle('kf', kf);
    if (d.t === 'n') {
      row.classList.toggle('an', an);
      row.innerHTML = `<div class="pr-h">${sw}${lab}${rangeHtml('rg', d, v)}${numHtml('nm', d, v)}${rs}</div>` +
        (an ? `<div class="an-box"><span class="lb">Nach</span>${rangeHtml('rgB', d, raw.b)}${numHtml('nmB', d, raw.b)}
          <label>Dauer<select class="per">${A.PER_OPTS.map(([k, n]) => `<option value="${k}"${k === raw.per ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>Ablauf<select class="mode"><option value="loop"${raw.mode === 'loop' ? ' selected' : ''}>Von vorn</option><option value="pp"${raw.mode === 'pp' ? ' selected' : ''}>Hin und zurück</option></select></label>
          <button type="button" class="cvb" data-cv="an" title="Animations-Kurve">${cvPreview(raw.cv)}<span>${esc(cvName(raw.cv))}</span></button></div>` : '');
    } else if (d.t === 'b') {
      row.innerHTML = `<div class="pr-h"><span class="sp"></span>${lab}<label class="tg"><input type="checkbox" ${raw ? 'checked' : ''}><i></i></label>${rs}</div>`;
    } else if (d.t === 's') {
      row.innerHTML = `<div class="pr-h"><span class="sp"></span>${lab}<select class="sl">${d.opts.map(([k, n]) => `<option value="${k}"${k === raw ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>${rs}</div>`;
    } else if (d.t === 'c') {
      row.innerHTML = `<div class="pr-h">${sw}${lab}<input class="cl" type="color" value="${v}">${rs}</div>`;
    } else if (d.t === 'k') {
      row.innerHTML = `<div class="pr-h"><span class="sp"></span>${lab}<button type="button" class="cvb big" data-cv="val" title="Kurve bearbeiten – größer, mit Zahlenfeldern und Tempo-Anzeige">${cvPreview(raw, 150, 46, true)}<span>${esc(cvName(raw))}</span></button>${rs}</div>`;
    }
  }
  const cvName = cv => cv.p === 'custom' ? 'Eigene Kurve (Bézier)' : cv.p === 'points' ? 'Eigene Punkte' : (A.CURVES.find(c => c[0] === cv.p) || [0, 'Linear'])[1];
  function cvPreview(cv, w = 34, h = 22, fill) {
    const f = A.curveFn(cv); let p = '';
    for (let i = 0; i <= 40; i++) { const x = i / 40, y = f(x); p += (i ? 'L' : 'M') + (2 + x * (w - 4)).toFixed(1) + ' ' + (h - 3 - clamp((y + .25) / 1.5, 0, 1) * (h - 6)).toFixed(1); }
    return `<svg class="cvp${fill ? ' fl' : ''}" viewBox="0 0 ${w} ${h}" ${fill ? 'preserveAspectRatio="none"' : `width="${w}" height="${h}"`}>${fill ? `<path class="g" d="M2 ${h - 3}H${w - 2}M2 3H${w - 2}"/>` : ''}<path d="${p}"/></svg>`;
  }
  const mkRow = (scope, d) => { const r = el('div', 'pr'); r.dataset.scope = scope; r.dataset.id = d.id; fillRow(r); return r; };
  function mkGroup(scope, g, openDefault, skip) {
    const det = el('details', 'grp'); det.dataset.k = (scope === 'g' ? 'g:' : scope === '*' ? 'a:' : 'o:') + g.id; det.open = OPEN[det.dataset.k] != null ? !!OPEN[det.dataset.k] : !!openDefault;
    det.innerHTML = `<summary><span class="gt">${esc(g.title)}</span><i class="md" title="In dieser Gruppe wurde etwas verändert"></i><button type="button" class="grs" title="Diese Gruppe zurücksetzen">↺</button></summary>`;
    const body = el('div', 'gb');
    for (const [title, defs] of g.secs) {
      const sec = el('div', 'sec', `<div class="sec-h">${esc(title)}</div>`);
      for (const d of defs) { if (skip && skip.includes(d.id)) continue; sec.appendChild(mkRow(scope, d)); }
      body.appendChild(sec);
    }
    det.appendChild(body); det.dataset.scope = scope; det.dataset.g = g.id;
    return det;
  }
  function buildProps() {
    const P = E.props; P.innerHTML = '';
    const glob = el('div', 'glob'); glob.id = 'edGlob'; P.appendChild(glob);
    A.GLOBAL_GROUPS.forEach((g, i) => glob.appendChild(mkGroup('g', g, i === 0)));
    const all = el('div', 'glob'); all.id = 'edAll'; P.appendChild(all);     // Scope '*' = alle Objekte gleichzeitig
    A.OBJ_GROUPS.forEach((g, i) => all.appendChild(mkGroup('*', g, i === 0, ['vis'])));
    const box = el('div', 'objs'); box.id = 'edObjs'; P.appendChild(box);
    buildObjs(); showTab(); refreshAll();
  }
  function showTab() {                       // „Ganzes Bild“, „Alle Objekte“ oder „Einzelne Objekte“
    const t = OPEN.tab === 'o' || OPEN.tab === 'a' ? OPEN.tab : 'g';
    E.tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.t === t)));
    for (const [k, id] of [['g', 'edGlob'], ['a', 'edAll'], ['o', 'edObjs']]) { const box = E.props.querySelector('#' + id); if (box) box.hidden = t !== k; }
  }
  function buildObjs() {
    const box = E.props.querySelector('#edObjs'); if (!box) return; box.innerHTML = ''; E.shownVer = R.ver;
    E.tabs.querySelector('small').textContent = !R.noRec && R.objs.length ? R.objs.length : '';
    if (R.noRec) {
      const note = `Bei dieser Animation sind keine Objekt-Regler möglich, weil sie ${esc(NOREC[R.noRec] || 'eine Zeichenfunktion nutzt, die sich nicht einzeln steuern lässt')}. Die Regler unter „Ganzes Bild“ funktionieren trotzdem.`;
      for (const b of [box, E.props.querySelector('#edAll')]) { b.innerHTML = ''; b.appendChild(el('p', 'oh-note', note)); }
      return;
    }
    if (!R.objs.length) { box.appendChild(el('p', 'oh-note', 'Keine Objekte gefunden.')); return; }
    for (const o of R.objs) {
      const det = el('details', 'obj'); det.dataset.o = o.id; det.open = !!OPEN['obj:' + o.id];
      det.innerHTML = `<summary><span class="on">${esc(o.name)}</span>${o.max > 1 ? `<small>bis ×${o.max}</small>` : ''}<span class="sp"></span><button type="button" class="ov" title="Objekt ein-/ausblenden"></button><button type="button" class="os" title="Solo: nur dieses Objekt zeigen">S</button><button type="button" class="ors" title="Dieses Objekt zurücksetzen">↺</button></summary>`;
      const body = el('div', 'ob');
      A.OBJ_GROUPS.forEach((g, i) => { const sub = mkGroup(o.id, g, i === 0, ['vis']); sub.classList.add('sub'); body.appendChild(sub); });
      det.appendChild(body); box.appendChild(det);
    }
    refreshAll();
  }
  function refreshAll() {
    const P = E.props; if (!P) return;
    P.querySelectorAll('.pr').forEach(row => {
      const dep = DEP[row.dataset.scope === 'g' ? 'g' : 'o'][row.dataset.id]; row.hidden = dep ? !dep(row.dataset.scope) : false;
      const d = defOf(row.dataset.scope, row.dataset.id), isDef = same(getRaw(row.dataset.scope, d.id), d.def);
      row.classList.toggle('mod', !isDef); const rs = row.querySelector('.rs'); if (rs) rs.disabled = isDef;
    });
    P.querySelectorAll('details.grp').forEach(g => {
      const sc = g.dataset.scope, grp = (sc === 'g' ? A.GLOBAL_GROUPS : A.OBJ_GROUPS).find(x => x.id === g.dataset.g);
      const mod = grp.props.some(d => !same(getRaw(sc, d.id), d.def)); g.classList.toggle('mod', mod);
    });
    P.querySelectorAll('details.obj').forEach(o => {
      const id = o.dataset.o, b = E.S.o[id], mod = !!(b && Object.keys(b).length), vis = getRaw(id, 'vis') !== false && getRaw(id, 'vis') !== 0;
      o.classList.toggle('mod', mod); o.classList.toggle('off', !vis); o.classList.toggle('solo', R.solo === id);
      const ov = o.querySelector('.ov'); if (ov) ov.innerHTML = vis ? EYE : EYE0;
    });
    E.tabs.querySelector('[data-t="g"]').classList.toggle('mod', !!Object.keys(E.S.g).length);
    E.tabs.querySelector('[data-t="a"]').classList.toggle('mod', !!E.S.o['*']);
    E.tabs.querySelector('[data-t="o"]').classList.toggle('mod', Object.keys(E.S.o).some(k => k !== '*'));
    const sb = E.root && E.root.querySelector('.ed-solo'); if (sb) { sb.hidden = !R.solo; const o = R.byId[R.solo]; sb.textContent = o ? `Solo: ${o.name} – hier klicken zum Beenden` : ''; }
  }

  /* ───────────── Eingaben (Ereignisse an das Panel gebunden) ───────────── */
  function setNum(row, which, v) {
    const scope = row.dataset.scope, id = row.dataset.id, d = defOf(scope, id), raw = getRaw(scope, id);
    v = clamp(v, d.min, d.max);
    if (A.isAn(raw)) setVal(scope, id, { ...raw, [which]: v }); else writeValue(scope, id, v);
    const sfx = which === 'b' ? 'B' : '', r = row.querySelector('.rg' + sfx), n = row.querySelector('.nm' + sfx);
    if (r && +r.value !== v) r.value = v; if (n && n.getRootNode().activeElement !== n) n.value = fmtN(v, d);
  }
  function wire(P) {
    P.addEventListener('input', ev => {
      const t = ev.target, row = t.closest('.pr'); if (!row) return;
      const scope = row.dataset.scope, id = row.dataset.id;
      if (t.classList.contains('rg') || t.classList.contains('nm')) { if (t.value === '' || isNaN(+t.value)) return; setNum(row, 'a', +t.value); }
      else if (t.classList.contains('rgB') || t.classList.contains('nmB')) { if (t.value === '' || isNaN(+t.value)) return; setNum(row, 'b', +t.value); }
      else if (t.classList.contains('cl')) writeValue(scope, id, t.value);
      else return;
      if (A.isKf(getRaw(scope, id))) row.querySelector('.sw').classList.add('at');
      touch(scope + '|' + id);
    });
    P.addEventListener('change', ev => {
      const t = ev.target, row = t.closest('.pr'); if (!row) return;
      const scope = row.dataset.scope, id = row.dataset.id, raw = getRaw(scope, id);
      if (t.type === 'checkbox') setVal(scope, id, t.checked);
      else if (t.classList.contains('sl')) setVal(scope, id, t.value);
      else if (t.classList.contains('per')) setVal(scope, id, { ...raw, per: t.value });
      else if (t.classList.contains('mode')) setVal(scope, id, { ...raw, mode: t.value });
      else if (t.classList.contains('nm') || t.classList.contains('nmB')) { if (t.value !== '' && !isNaN(+t.value) && +t.value !== +fmtN(valueNow(raw), defOf(scope, id))) setNum(row, t.classList.contains('nm') ? 'a' : 'b', +t.value); fillRow(row); }
      else return;
      touch(scope + '|' + id);
    });
    P.addEventListener('click', ev => {
      const t = ev.target, row = t.closest('.pr');
      const gr = t.closest('.grs');
      if (gr) { ev.preventDefault(); const det = gr.closest('details.grp'), sc = det.dataset.scope, grp = (sc === 'g' ? A.GLOBAL_GROUPS : A.OBJ_GROUPS).find(x => x.id === det.dataset.g); grp.props.forEach(d => setVal(sc, d.id, d.def)); det.querySelectorAll('.pr').forEach(fillRow); touch(); return; }
      const ors = t.closest('.ors');
      if (ors) { ev.preventDefault(); const id = ors.closest('details.obj').dataset.o; delete E.S.o[id]; ors.closest('details.obj').querySelectorAll('.pr').forEach(fillRow); touch(); return; }
      const ov = t.closest('.ov');
      if (ov) { ev.preventDefault(); const id = ov.closest('details.obj').dataset.o, v = getRaw(id, 'vis'); setVal(id, 'vis', !(v !== false && v !== 0)); touch(); return; }
      const os = t.closest('.os');
      if (os) { ev.preventDefault(); const id = os.closest('details.obj').dataset.o; R.solo = R.solo === id ? null : id; refreshAll(); return; }
      if (!row) return;
      const scope = row.dataset.scope, id = row.dataset.id, d = defOf(scope, id), raw = getRaw(scope, id);
      if (t.closest('.rs')) { setVal(scope, id, d.def); fillRow(row); touch(); }
      else if (t.closest('.sw')) { stopwatch(scope, id, ev.altKey); fillRow(row); markRow(row); E.tl.select(null, scope + '|' + id); touch(); }
      else if (t.closest('.pl')) { markRow(row); E.tl.select(null, scope + '|' + id); E.tl.render(); }
      else if (t.closest('.cvb')) {
        const btn = t.closest('.cvb'), an = btn.dataset.cv === 'an';
        openCurve(btn, an ? raw.cv : raw, cv => { if (an) setVal(scope, id, { ...getRaw(scope, id), cv }); else setVal(scope, id, cv); const b = row.querySelector('.cvb'); if (b) { b.innerHTML = cvPreview(cv) + `<span>${esc(cvName(cv))}</span>`; } touch(); if (!an) refreshAll(); });
      }
    });
    P.addEventListener('toggle', ev => { const d = ev.target; if (d.dataset && d.dataset.k) { OPEN[d.dataset.k] = d.open; saveOpen(); } else if (d.dataset && d.dataset.o) { OPEN['obj:' + d.dataset.o] = d.open; saveOpen(); } }, true);
    P.addEventListener('mouseover', ev => { const o = ev.target.closest('details.obj'); const id = o ? o.dataset.o : null; if (R.hl !== id) R.hl = id; });
    P.addEventListener('mouseleave', () => { R.hl = null; });
    P.addEventListener('pointerdown', ev => { if (ev.target.classList.contains('rg')) E.dragRow = ev.target.closest('.pr'); });
    addEventListener('pointerup', () => { E.dragRow = null; });
  }

  /* ───────────── Kurven-Editor (Pop-up) ───────────── */
  let pop = null;
  function closeCurve() { if (pop) { pop.el.remove(); cancelAnimationFrame(pop.raf); document.removeEventListener('pointerdown', pop.out, true); pop = null; } }
  const speedOf = f => { const o = []; for (let i = 0; i <= 80; i++) { const x = i / 80, e = .004; o.push((f(Math.min(1, x + e)) - f(Math.max(0, x - e))) / (Math.min(1, x + e) - Math.max(0, x - e))); } return o; };
  function openCurve(btn, cv0, onChange) {
    closeCurve();
    let cv = copy(cv0), snap = false;
    const GW = 280, GX = 34, GY0 = 14, GH = 268, YMIN = -.5, YMAX = 1.5;            // Zeichenfläche der Kurve
    const X = x => GX + x * GW, Y = y => GY0 + (YMAX - y) / (YMAX - YMIN) * GH, iX = px => clamp((px - GX) / GW, 0, 1), iY = py => clamp(YMAX - (py - GY0) / GH * (YMAX - YMIN), YMIN, YMAX);
    const box = el('div', 'cvpop'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Kurve bearbeiten');
    const lines = [0, .25, .5, .75, 1].map(v => `M${X(v)} ${Y(YMAX)}V${Y(YMIN)}`).join('') + [-.5, 0, .5, 1, 1.5].map(v => `M${X(0)} ${Y(v)}H${X(1)}`).join('');
    box.innerHTML = `<div class="cvpre">${A.CURVES.filter(c => c[0] !== 'custom' && c[0] !== 'points').map(([k, n]) => `<button type="button" data-p="${k}" title="${esc(n)}">${cvPreview({ p: k }, 40, 26)}</button>`).join('')}</div>
      <div class="cvmode"><button type="button" data-m="custom">Bézier-Kurve</button><button type="button" data-m="points">Eigene Punkte</button><button type="button" data-m="rev" title="Kurve umkehren (langsam ↔ schnell)">Umkehren</button><label class="cvsn"><input type="checkbox" class="snap"> Raster</label></div>
      <svg viewBox="0 0 320 ${GY0 + GH + 22}" class="cvsvg"><rect x="${X(0)}" y="${Y(YMAX)}" width="${GW}" height="${GH}" class="cvbg"/><path class="cvgrid" d="${lines}"/><path class="cvlin" d="M${X(0)} ${Y(0)}L${X(1)} ${Y(1)}"/>
        <text x="${X(0)}" y="${GY0 + GH + 14}" class="cvt">Anfang</text><text x="${X(1)}" y="${GY0 + GH + 14}" class="cvt" text-anchor="end">Ende</text><text x="${GX - 4}" y="${Y(0) + 4}" class="cvt" text-anchor="end">0</text><text x="${GX - 4}" y="${Y(1) + 4}" class="cvt" text-anchor="end">1</text>
        <path class="cvh1" d=""/><path class="cvh2" d=""/><path class="cvpath" d=""/><circle class="cvdot" r="4"/><g class="cvpts"></g><circle class="cvk k1" r="6.5"/><circle class="cvk k2" r="6.5"/></svg>
      <svg viewBox="0 0 320 64" class="cvsp"><text x="4" y="11" class="cvt">Tempo über die Zeit</text><path class="sp-base" d=""/><path class="sp-area" d=""/><line class="sp-ph" y1="14" y2="60"/></svg>
      <div class="cvnum"></div><div class="cvhint"></div>`;
    E.root.appendChild(box);
    const r = btn.getBoundingClientRect(), W = box.offsetWidth, H = box.offsetHeight;
    box.style.left = clamp(r.right - W, 8, innerWidth - W - 8) + 'px'; box.style.top = clamp(r.bottom + 8 + H < innerHeight ? r.bottom + 8 : r.top - H - 8, 8, Math.max(8, innerHeight - H - 8)) + 'px';
    const q = s => box.querySelector(s), svg = q('.cvsvg');
    const bz = () => A.curveBez(cv);
    function draw() {
      const f = A.curveFn(cv), b = bz(); let p = '';
      for (let i = 0; i <= 100; i++) { const x = i / 100; p += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(clamp(f(x), YMIN, YMAX)).toFixed(1); }
      q('.cvpath').setAttribute('d', p);
      box.querySelectorAll('.cvpre button').forEach(bt => bt.classList.toggle('on', bt.dataset.p === cv.p));
      box.querySelectorAll('.cvmode [data-m]').forEach(bt => bt.classList.toggle('on', bt.dataset.m === cv.p));
      const showB = !!b, isPts = cv.p === 'points';
      ['.k1', '.k2', '.cvh1', '.cvh2'].forEach(c => q(c).style.display = showB ? '' : 'none');
      if (showB) { const k1 = q('.k1'), k2 = q('.k2'); k1.setAttribute('cx', X(b[0])); k1.setAttribute('cy', Y(b[1])); k2.setAttribute('cx', X(b[2])); k2.setAttribute('cy', Y(b[3])); q('.cvh1').setAttribute('d', `M${X(0)} ${Y(0)}L${X(b[0])} ${Y(b[1])}`); q('.cvh2').setAttribute('d', `M${X(1)} ${Y(1)}L${X(b[2])} ${Y(b[3])}`); }
      q('.cvpts').innerHTML = isPts ? (cv.pts || []).map((pt, i) => `<circle class="cvk pt" data-i="${i}" cx="${X(pt[0])}" cy="${Y(pt[1])}" r="6.5"/>`).join('') : '';
      // Tempo: Steigung der Kurve (1 = gleichmäßig). Hoch = schnell, flach = langsam
      const sp = speedOf(f), mx = Math.max(2, ...sp.map(v => Math.abs(v))), sx = i => 4 + i / 80 * 312, sy = v => 60 - clamp(v / mx, -1, 1) * 44, y0 = sy(0);
      q('.sp-area').setAttribute('d', `M${sx(0)} ${y0}` + sp.map((v, i) => `L${sx(i).toFixed(1)} ${sy(v).toFixed(1)}`).join('') + `L${sx(80)} ${y0}Z`);
      q('.sp-base').setAttribute('d', `M4 ${sy(1)}H316`);
      const nums = q('.cvnum');
      if (showB && cv.p === 'custom') { if (!nums.querySelector('input') || nums.dataset.k !== 'b') { nums.dataset.k = 'b'; nums.innerHTML = ['x1', 'y1', 'x2', 'y2'].map((n, i) => `<label>${n}<input type="number" step="0.01" data-i="${i}"></label>`).join(''); } nums.querySelectorAll('input').forEach((inp, i) => { if (inp.getRootNode().activeElement !== inp) inp.value = (+cv.b[i]).toFixed(2); }); }
      else if (showB) { nums.dataset.k = ''; nums.innerHTML = `<span class="cvinfo">cubic-bezier(${b.map(v => (+v).toFixed(2)).join(', ')})</span>`; }
      else { nums.dataset.k = ''; nums.innerHTML = isPts ? `<span class="cvinfo">${(cv.pts || []).length} Punkt${(cv.pts || []).length === 1 ? '' : 'e'}</span>` : `<span class="cvinfo">${esc(cvName(cv))}</span>`; }
      q('.cvhint').textContent = isPts ? 'Doppelklick auf die Fläche fügt einen Punkt hinzu, Doppelklick auf einen Punkt entfernt ihn. Anfang und Ende bleiben fest.' : showB ? 'Die zwei Griffe ziehen oder die Zahlen eintippen. Steil = schnell, flach = langsam.' : 'Wähle „Bézier-Kurve“ oder „Eigene Punkte“, um die Form selbst zu verändern.';
    }
    const emit = () => { draw(); onChange(copy(cv)); };
    const sn = v => (snap ? Math.round(v * 20) / 20 : v);
    box.addEventListener('click', ev => {
      const pb = ev.target.closest('.cvpre button'); if (pb) { cv = { p: pb.dataset.p }; return emit(); }
      const mb = ev.target.closest('.cvmode [data-m]'); if (!mb) return;
      const m = mb.dataset.m, f = A.curveFn(cv);
      if (m === 'custom') cv = { p: 'custom', b: (bz() || [.25, .1, .25, 1]).slice() };
      else if (m === 'points') cv = { p: 'points', pts: cv.p === 'points' ? cv.pts : [.25, .5, .75].map(x => [x, +f(x).toFixed(3)]) };
      else if (m === 'rev') { const g = A.curveFn(cv), pts = [.2, .4, .6, .8].map(x => [x, +(1 - g(1 - x)).toFixed(3)]); cv = { p: 'points', pts }; }
      emit();
    });
    box.addEventListener('change', ev => {
      if (ev.target.classList.contains('snap')) { snap = ev.target.checked; return; }
      const i = ev.target.dataset && ev.target.dataset.i; if (cv.p !== 'custom' || i == null || ev.target.type !== 'number') return;
      const b = cv.b.slice(); b[+i] = +i % 2 === 0 ? clamp(+ev.target.value || 0, 0, 1) : clamp(+ev.target.value || 0, YMIN, YMAX); cv = { p: 'custom', b }; emit();
    });
    let drag = null;
    const locate = ev => { const sv = svg.getBoundingClientRect(), k = 320 / sv.width; return [iX((ev.clientX - sv.left) * k), iY((ev.clientY - sv.top) * k)]; };
    box.addEventListener('pointerdown', ev => {
      const k = ev.target.closest('.cvk'); if (!k) return;
      drag = k.classList.contains('k1') ? { b: 0 } : k.classList.contains('k2') ? { b: 1 } : { pt: +k.dataset.i };
      k.setPointerCapture(ev.pointerId); ev.preventDefault();
    });
    box.addEventListener('pointermove', ev => {
      if (!drag) return; let [x, y] = locate(ev); x = sn(x); y = sn(y);
      if (drag.b != null) { const b = (bz() || [.25, .1, .25, 1]).slice(); b[drag.b * 2] = +x.toFixed(3); b[drag.b * 2 + 1] = +y.toFixed(3); cv = { p: 'custom', b }; }
      else { const pts = cv.pts.map(p => p.slice()); pts[drag.pt] = [+clamp(x, .01, .99).toFixed(3), +y.toFixed(3)]; cv = { p: 'points', pts }; }
      emit();
    });
    box.addEventListener('pointerup', () => { drag = null; if (cv.p === 'points') { cv.pts.sort((a, b) => a[0] - b[0]); emit(); } });
    box.addEventListener('dblclick', ev => {
      if (cv.p !== 'points') return;
      const pt = ev.target.closest('.pt');
      if (pt) cv = { p: 'points', pts: cv.pts.filter((_, i) => i !== +pt.dataset.i) };
      else if (svg.contains(ev.target) && cv.pts.length < 12) { const [x, y] = locate(ev); cv = { p: 'points', pts: [...cv.pts, [+clamp(sn(x), .01, .99).toFixed(3), +sn(y).toFixed(3)]].sort((a, b) => a[0] - b[0]) }; }
      emit();
    });
    const out = ev => { const pth = ev.composedPath(); if (!pth.includes(box) && !pth.includes(btn)) closeCurve(); };
    document.addEventListener('pointerdown', out, true);
    const tick = () => { const x = Math.min(1, (performance.now() / 2200) % 1.2), f = A.curveFn(cv); q('.cvdot').setAttribute('cx', X(x)); q('.cvdot').setAttribute('cy', Y(clamp(f(x), YMIN, YMAX))); q('.sp-ph').setAttribute('x1', 4 + x * 312); q('.sp-ph').setAttribute('x2', 4 + x * 312); pop.raf = requestAnimationFrame(tick); };
    pop = { el: box, out, raf: 0 }; draw(); tick();
  }
  addEventListener('keydown', ev => { if (ev.key === 'Escape' && pop) closeCurve(); });

  /* ───────────── Vorlagen ───────────── */
  let preEl = null, delT = 0, nameMode = '';
  const changed = () => { DB.t = Date.now(); persist(); if (api.onPresets) api.onPresets(); };
  const presetOf = (e, c) => { const n = String(c || '').slice(2), src = String(c).startsWith('u:') ? e.p : String(c).startsWith('b:') ? BUILTIN : null; return src && has(src, n) ? src[n] : null; };
  function status() {                        // Dropdown und Knöpfe an den aktuellen Stand anpassen
    if (!preEl) return;
    const q = s => preEl.querySelector(s), sel = q('.pre-sel'), dirty = isDirty(), user = E.sel.startsWith('u:');
    let o = sel.querySelector('option[value="*"]');
    if (dirty) {                             // eigener Eintrag „geändert“ – so lässt sich die Vorlage (oder das Original) neu wählen
      if (!o) { o = el('option'); o.value = '*'; o.disabled = true; sel.prepend(o); }
      const t = `● ${E.sel ? E.sel.slice(2) : 'Original'} – geändert`; if (o.textContent !== t) o.textContent = t;
      sel.value = '*';
    } else { if (o) o.remove(); sel.value = E.sel; }
    sel.classList.toggle('dirty', dirty);
    const save = q('.pre-save'); save.disabled = !dirty; save.classList.toggle('go', dirty); save.title = !dirty ? 'Es gibt nichts Neues zu speichern' : user ? `„${E.sel.slice(2)}“ mit diesen Einstellungen speichern` : 'Als eigene Vorlage speichern – das Original bleibt erhalten';
    q('.pre-ren').disabled = !user; q('.pre-del').disabled = !user;
    const s = q('.pre-status'); s.hidden = !saveErr; s.textContent = saveErr ? 'Speichern im Browser nicht möglich (Speicher voll oder gesperrt).' : '';
  }
  function fillSel() {
    const sel = preEl.querySelector('.pre-sel'), e = entry(), users = Object.keys(e.p).sort((a, b) => a.localeCompare(b, 'de'));
    sel.innerHTML = `<option value="">Original (keine Änderungen)</option>${users.length ? `<optgroup label="Meine Vorlagen">${users.map(n => `<option value="u:${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>` : ''}<optgroup label="Mitgelieferte Vorlagen">${Object.keys(BUILTIN).map(n => `<option value="b:${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>`;
    sel.value = E.sel; if (sel.value !== E.sel) { E.sel = ''; sel.value = ''; }
  }
  function resetForms() {
    if (!preEl) return;
    preEl.querySelector('.pre-name').hidden = true;
    const d = preEl.querySelector('.pre-del'); clearTimeout(delT); delete d.dataset.sure; d.textContent = 'Löschen'; d.classList.remove('warn');
  }
  function applyPreset(val) {
    resetForms(); E.sel = val;
    const p = val.startsWith('u:') ? entry().p[val.slice(2)] : val.startsWith('b:') ? BUILTIN[val.slice(2)] : empty();
    E.S = copy(p || empty()); entry().w = copy(E.S); entry().c = E.sel; changed();
    buildProps(); status(); histReset();
  }
  function savePreset() {                    // ein Klick: eigene Vorlage überschreiben, sonst eine neue anlegen (das Original bleibt)
    if (!isDirty()) return;
    const e = entry(), n = E.sel.startsWith('u:') ? E.sel.slice(2) : uniqueName(E.sel.startsWith('b:') ? E.sel.slice(2) : 'Meine Version');
    e.p[n] = copy(E.S); E.sel = 'u:' + n; e.c = E.sel; resetForms(); fillSel(); changed(); status();
  }
  function showNameForm(mode) {             // 'new' = neue Vorlage anlegen, 'ren' = gewählte umbenennen
    resetForms(); nameMode = mode; const f = preEl.querySelector('.pre-name'); f.hidden = false;
    f.querySelector('[type=submit]').textContent = mode === 'new' ? 'Anlegen' : 'Umbenennen';
    const i = f.querySelector('input'); i.value = mode === 'new' ? uniqueName('Meine Version') : E.sel.slice(2); i.focus(); i.select();
  }
  function uniqueName(n) { const e = entry(); let k = n, i = 2; while (has(e.p, k) || has(BUILTIN, k)) k = `${n} ${i++}`; return k; }
  function buildPresets(host) {
    preEl = el('div', 'pre');
    preEl.innerHTML = `<div class="lb">Vorlage</div>
      <div class="pre-r1"><select class="pre-sel" aria-label="Vorlage wählen" title="Vorlage für diese Animation"></select><button type="button" class="btn pre-save">Vorlage speichern</button></div>
      <form class="pre-name" hidden><input type="text" maxlength="40" aria-label="Name der Vorlage" placeholder="Name der Vorlage" required><button type="submit" class="btn go">Umbenennen</button><button type="button" class="btn pre-cancel">Abbrechen</button></form>
      <div class="pre-r2"><button type="button" class="btn pre-new" title="Neue Vorlage mit den jetzigen Einstellungen anlegen – die bisherige bleibt, wie sie ist">+ Neue Vorlage</button><span class="sp"></span><button type="button" class="btn pre-ren">Umbenennen</button><button type="button" class="btn pre-del">Löschen</button></div>
      <div class="pre-status" hidden></div>`;
    host.appendChild(preEl);
    const q = s => preEl.querySelector(s);
    q('.pre-sel').onchange = e => applyPreset(e.target.value);
    q('.pre-save').onclick = savePreset;
    q('.pre-new').onclick = () => showNameForm('new');
    q('.pre-ren').onclick = () => showNameForm('ren');
    q('.pre-cancel').onclick = resetForms;
    q('.pre-name').onkeydown = ev => { if (ev.key === 'Escape') resetForms(); };
    q('.pre-del').onclick = ev => {
      const b = ev.currentTarget;
      if (!b.dataset.sure) { resetForms(); b.dataset.sure = '1'; b.textContent = 'Wirklich löschen?'; b.classList.add('warn'); delT = setTimeout(resetForms, 3000); return; }
      delete entry().p[E.sel.slice(2)]; applyPreset(''); fillSel(); status();
    };
    q('.pre-name').onsubmit = ev => {
      ev.preventDefault(); const n = q('.pre-name input').value.trim(), e = entry(); if (!n) return;
      if (nameMode === 'new') { const nn = uniqueName(n); e.p[nn] = copy(E.S); e.w = copy(E.S); E.sel = 'u:' + nn; }
      else { if (!E.sel.startsWith('u:')) return; const old = E.sel.slice(2), nn = n === old ? n : uniqueName(n), v = e.p[old]; delete e.p[old]; e.p[nn] = v; E.sel = 'u:' + nn; }
      e.c = E.sel; resetForms(); fillSel(); changed(); status();
    };
  }
  /* eigene Vorlagen aller Animationen: { Spur:Titel: { Name: Einstellungen } } */
  function presets() {
    const out = {};
    for (const k in DB.a) { const p = DB.a[k].p; if (p && Object.keys(p).length) out[k] = copy(p); }
    return out;
  }
  function addPresets(src, replace) {        // replace = vorhandene eigene Vorlagen vorher verwerfen
    if (replace) for (const k in DB.a) DB.a[k].p = {};
    for (const k in src || {}) { const e = DB.a[k] || (DB.a[k] = { w: empty(), p: {}, c: '' }); e.p = { ...e.p, ...copy(src[k]) }; }
    persist(); reload();
  }
  function active() {                        // { Spur:Titel: 'u:Name' | 'b:Name' } – nur Animationen, die nicht im Original laufen
    const out = {};
    for (const k in DB.a) if (presetOf(DB.a[k], DB.a[k].c)) out[k] = DB.a[k].c;
    return out;
  }
  function setActive(map) {
    for (const k of new Set([...Object.keys(DB.a), ...Object.keys(map)])) {
      const e = DB.a[k] || (DB.a[k] = { w: empty(), p: {}, c: '' }), c = presetOf(e, map[k]) ? map[k] : '';
      if ((e.c || '') !== c) { e.c = c; e.w = copy(presetOf(e, c) || empty()); }
    }
    persist(); reload();
  }
  function look(key) {
    const e = DB.a[key], p = e && presetOf(e, e.c);
    return p && (Object.keys(p.g || {}).length || Object.keys(p.o || {}).length) ? p : null;
  }
  function reload() {                        // offene Animation nach Änderungen von außen neu anzeigen
    if (!preEl || !E.key) return;
    const e = entry(); E.S = copy(e.w || empty()); if (!E.S.g) E.S.g = {}; if (!E.S.o) E.S.o = {}; E.sel = e.c || '';
    resetForms(); fillSel(); buildProps(); status(); histReset();
  }

  /* ───────────── Aufbau ───────────── */
  function mount(host, opts) {
    const ratio = (opts && opts.ratio) || 4 / 3;
    const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;      // eigene Hülle: Studio- und Seiten-Styles stören nicht
    E.root = root;
    root.innerHTML = `<link rel="stylesheet" href="${CSS_URL}"><div class="ed"><div class="ed-main"><div class="ed-top"><div class="ed-chips" id="edChips"></div><div class="ed-act" id="edAct"></div></div>
        <div class="ed-box" id="edBox"><div class="ed-stage" id="edStage"><canvas id="edCv"></canvas>
          <div class="ed-tools"><button type="button" class="ed-ba" title="Original ohne alle Änderungen zeigen (Vorher/Nachher)" aria-pressed="false">Vorher</button><button type="button" class="ed-fs" title="Vollbild" aria-label="Vollbild"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div>
          <button type="button" class="ed-solo" hidden></button></div></div><div id="edTl"></div></div>
      <aside class="ed-side" aria-label="Eigenschaften"><div class="ed-assign" id="edAssign"></div><div id="edPre"></div>
        <div class="ed-tabs" id="edTabs" role="tablist"><button type="button" role="tab" data-t="g" title="Regler, die auf die ganze Animation wirken">Ganzes Bild<i class="md"></i></button><button type="button" role="tab" data-t="a" title="Alle Objekte gleichzeitig einstellen – was du bei einem einzelnen Objekt änderst, kommt dazu">Alle Objekte<i class="md"></i></button><button type="button" role="tab" data-t="o" title="Jede Zeichen-Stelle der Animation einzeln einstellen – mit der Maus darüber fahren zeigt sie im Bild">Einzelne Objekte <small></small><i class="md"></i></button></div>
        <div class="ed-props" id="edProps"></div></aside></div>`;
    E.cv = root.querySelector('#edCv'); E.stage = root.querySelector('#edStage'); E.props = root.querySelector('#edProps'); E.tabs = root.querySelector('#edTabs'); E.side = root.querySelector('.ed-side');
    E.tabs.onclick = ev => { const b = ev.target.closest('button[data-t]'); if (!b) return; OPEN.tab = b.dataset.t; saveOpen(); closeCurve(); R.hl = null; showTab(); E.side.scrollTop = Math.min(E.side.scrollTop, E.props.offsetTop - E.tabs.offsetHeight); };     // neuer Reiter beginnt oben
    buildTimeline(root.querySelector('#edTl')); buildPresets(root.querySelector('#edPre')); wire(E.props);
    root.querySelector('.ed-ba').onclick = ev => { R.bypass = !R.bypass; ev.currentTarget.setAttribute('aria-pressed', R.bypass); ev.currentTarget.textContent = R.bypass ? 'Nachher' : 'Vorher'; };
    root.querySelector('.ed-solo').onclick = () => { R.solo = null; refreshAll(); };
    root.querySelector('.ed-fs').onclick = () => {                      // Vollbild (oder Ersatz per Klasse, falls der Browser es nicht kann)
      const st = E.stage, open = document.fullscreenElement || document.webkitFullscreenElement;
      if (open || st.classList.contains('full')) { st.classList.remove('full'); if (open) (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      const req = st.requestFullscreen || st.webkitRequestFullscreen;
      if (req) Promise.resolve(req.call(st)).catch(() => st.classList.add('full')); else st.classList.add('full');
    };
    // Vorschau so groß wie möglich in den freien Platz setzen
    E.stage.style.aspectRatio = ratio;
    const box = root.querySelector('#edBox');
    new ResizeObserver(() => { if (document.fullscreenElement === E.stage) return; const aw = box.clientWidth, ah = box.clientHeight; if (aw < 10 || ah < 10) return; let w = aw, h = w / ratio; if (h > ah) { h = ah; w = h * ratio; } E.stage.style.width = Math.floor(w) + 'px'; E.stage.style.height = Math.floor(h) + 'px'; }).observe(box);
    // Leertaste & Co. in Eingabefeldern sollen nicht den Player auslösen (Ereignisse aus der Hülle erscheinen sonst als „Seite“)
    ['keydown', 'keyup'].forEach(t => root.addEventListener(t, ev => { if (ev.target.matches && ev.target.matches('input:not([type=range]),select,textarea')) ev.stopPropagation(); }));
    root.addEventListener('keydown', ev => { if (ev.key === 'Enter' && ev.target.type === 'number') ev.target.blur(); });
    // Tastenkürzel der Zeitleiste (nur solange der Editor zu sehen ist)
    const typing = t => t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !['range', 'checkbox', 'color'].includes(t.type));
    const onButton = ev => ev.code === 'Space' && /^(BUTTON|SUMMARY|INPUT)$/.test(ev.composedPath()[0].tagName) && !typing(ev.composedPath()[0]);     // sonst würde der angeklickte Knopf ausgelöst
    addEventListener('keydown', ev => {
      if (!api.host || !E.stage.offsetParent || typing(ev.composedPath()[0])) return;
      if (ev.code === 'Space') { if (onButton(ev)) { ev.preventDefault(); ev.stopImmediatePropagation(); if (!ev.repeat) api.host.toggle(); } return; }
      if (E.tl.key(ev)) { ev.preventDefault(); ev.stopImmediatePropagation(); }
    }, true);
    addEventListener('keyup', ev => { if (api.host && E.stage.offsetParent && onButton(ev)) ev.preventDefault(); }, true);
    return { stage: E.stage, chips: root.querySelector('#edChips'), act: root.querySelector('#edAct'), assign: root.querySelector('#edAssign') };
  }
  function dockTimeline(target) {
    const sr = target.shadowRoot || target.attachShadow({ mode: 'open' });
    sr.innerHTML = `<link rel="stylesheet" href="${CSS_URL}">`; sr.appendChild(E.tl.el);
    E.docked = true; E.tl.el.classList.add('docked'); E.root.querySelector('.ed').classList.add('docked'); E.tl.render();
  }
  function load(key, idea) {
    closeCurve(); R.solo = null; R.hl = null; R.bypass = false;
    const ba = E.root && E.root.querySelector('.ed-ba'); if (ba) { ba.setAttribute('aria-pressed', 'false'); ba.textContent = 'Vorher'; }
    E.key = key; E.idea = idea; if (E.side) E.side.scrollTop = 0;
    const e = entry(); E.S = copy(e.w || empty()); if (!E.S.g) E.S.g = {}; if (!E.S.o) E.S.o = {}; E.sel = e.c || '';
    R.setIdea(idea); resetForms(); fillSel(); buildProps(); status(); histReset();
  }
  let sz = { w: 0, h: 0, d: 0 };
  function frame(sb) {
    if (!E.cv || !E.idea || !E.cv.isConnected) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), r = E.cv.getBoundingClientRect(), W = r.width, H = r.height;
    if (W < 4 || H < 4) return;
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (E.cv.width !== pw || E.cv.height !== ph) { E.cv.width = pw; E.cv.height = ph; }
    if (R.ver !== E.shownVer) { buildObjs(); E.tl.render(); }
    const h = api.host;
    if (h) {
      loopWork(h);                           // Keyframes folgen der Abspielposition; in der Pause steht das Bild genau dort
      const playing = h.playing(), t = playing ? h.time() : K.snap(h.time(), h.dur);
      sb = { ...sb, kt: t }; if (!playing && hasKf()) sb.t = t - h.offset;
      if (Math.abs(t - E.ph) > 1e-4) { E.ph = t; refreshKfRows(); }
      E.tl.tick(t, playing);
    }
    try { R.render(E.cv, W, H, dpr, sb, E.S); } catch (e) { console.error(e); }
  }
  const api = { mount, dockTimeline, load, frame, renderer: R, state: E, closeCurve, BUILTIN, presets, addPresets, active, setActive, look, stamp: () => DB.t || 0, onPresets: null, onView: null, onWork: null, work, host: null, undo };
  window.Editor = api;
})();
