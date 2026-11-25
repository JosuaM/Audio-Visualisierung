'use strict';
/* ═════════════════════════════════════════════════════════════════════════
   Animations-Editor – Oberfläche (Regler, Stoppuhr, Kurven-Editor, Vorlagen)
   Gebraucht wird editor-engine.js (window.AE). Seite ruft auf:
     Editor.mount(wurzel)            baut Vorschau und Regler-Panel
     Editor.load(schlüssel, idea)    wählt eine Animation (Schlüssel = Spur:Titel) und lädt Arbeitsstand + Vorlagen
     Editor.frame(s)                 in jedem Bild aufrufen: s = { t, fg, bg, col }
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  const CSS_URL = new URL('editor.css', (document.currentScript && document.currentScript.src) || location.href).href;
  const A = AE, STORE = 'av-anim-editor-v1', OPENKEY = 'av-anim-editor-open';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const copy = o => JSON.parse(JSON.stringify(o));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
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
  const R = new A.Renderer();
  const E = { key: '', idea: null, S: empty(), sel: '', root: null, cv: null, stage: null, props: null, shownVer: -1 };
  const entry = () => DB.a[E.key] || (DB.a[E.key] = { w: empty(), p: {}, c: '' });
  const getBag = (scope, mk) => scope === 'g' ? E.S.g : ((E.S.o[scope] || (mk ? (E.S.o[scope] = {}) : null)) || null);
  const defOf = (scope, id) => (scope === 'g' ? A.GP : A.OP)[id];
  const getRaw = (scope, id) => { const b = getBag(scope), v = b ? b[id] : undefined; return v === undefined ? defOf(scope, id).def : v; };
  function setVal(scope, id, v) {
    const d = defOf(scope, id), b = getBag(scope, true);
    if (same(v, d.def)) delete b[id]; else b[id] = v;
    if (scope !== 'g' && !Object.keys(b).length) delete E.S.o[scope];
  }
  const nz = (scope, id) => { const v = getRaw(scope, id); return A.isAn(v) ? Math.max(Math.abs(v.a), Math.abs(v.b)) : (+v || 0); };
  const isDirty = () => { const p = E.sel.startsWith('u:') ? entry().p[E.sel.slice(2)] : E.sel.startsWith('b:') ? BUILTIN[E.sel.slice(2)] : empty(); return !same(E.S, p || empty()); };
  const touch = () => { entry().w = copy(E.S); entry().c = E.sel; persist(); refreshAll(); status(); };

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
    row.classList.toggle('mod', !isDef);
    if (d.t === 'n') {
      const an = A.isAn(raw), a = an ? raw.a : raw;
      row.classList.toggle('an', an);
      row.innerHTML = `<div class="pr-h"><button type="button" class="sw${an ? ' on' : ''}" title="${an ? 'Animation entfernen' : 'Animieren: der Wert ändert sich im Takt von A nach B'}" aria-pressed="${an}">${SW}</button>${lab}${rangeHtml('rg', d, a)}${numHtml('nm', d, a)}${rs}</div>` +
        (an ? `<div class="an-box"><span class="lb">${an ? 'Nach' : ''}</span>${rangeHtml('rgB', d, raw.b)}${numHtml('nmB', d, raw.b)}
          <label>Dauer<select class="per">${A.PER_OPTS.map(([k, n]) => `<option value="${k}"${k === raw.per ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
          <label>Ablauf<select class="mode"><option value="loop"${raw.mode === 'loop' ? ' selected' : ''}>Von vorn</option><option value="pp"${raw.mode === 'pp' ? ' selected' : ''}>Hin und zurück</option></select></label>
          <button type="button" class="cvb" data-cv="an" title="Animations-Kurve">${cvPreview(raw.cv)}<span>${esc(cvName(raw.cv))}</span></button></div>` : '');
    } else if (d.t === 'b') {
      row.innerHTML = `<div class="pr-h"><span class="sp"></span>${lab}<label class="tg"><input type="checkbox" ${raw ? 'checked' : ''}><i></i></label>${rs}</div>`;
    } else if (d.t === 's') {
      row.innerHTML = `<div class="pr-h"><span class="sp"></span>${lab}<select class="sl">${d.opts.map(([k, n]) => `<option value="${k}"${k === raw ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>${rs}</div>`;
    } else if (d.t === 'c') {
      row.innerHTML = `<div class="pr-h"><span class="sp"></span>${lab}<input class="cl" type="color" value="${raw}">${rs}</div>`;
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
    const det = el('details', 'grp'); det.dataset.k = (scope === 'g' ? 'g:' : 'o:') + g.id; det.open = OPEN[det.dataset.k] != null ? !!OPEN[det.dataset.k] : !!openDefault;
    det.innerHTML = `<summary><span class="gt">${esc(g.title)}</span><i class="md" title="In dieser Gruppe wurde etwas verändert"></i><button type="button" class="grs" title="Diese Gruppe zurücksetzen">↺</button></summary>`;
    const body = el('div', 'gb');
    for (const d of g.props) { if (skip && skip.includes(d.id)) continue; body.appendChild(mkRow(scope, d)); }
    det.appendChild(body); det.dataset.scope = scope; det.dataset.g = g.id;
    return det;
  }
  function buildProps() {
    const P = E.props; P.innerHTML = '';
    A.GLOBAL_GROUPS.forEach((g, i) => P.appendChild(mkGroup('g', g, i < 2)));
    const h = el('div', 'oh', '<b>Objekte</b><span>Jede Zeichen-Stelle der Animation ist ein eigenes Objekt – mit Maus darüber fahren zeigt es im Bild.</span>'); P.appendChild(h);
    const box = el('div', 'objs'); box.id = 'edObjs'; P.appendChild(box);
    buildObjs(); refreshAll();
  }
  function buildObjs() {
    const box = E.props.querySelector('#edObjs'); if (!box) return; box.innerHTML = ''; E.shownVer = R.ver;
    if (R.noRec) { box.appendChild(el('p', 'oh-note', `Bei dieser Animation sind keine Objekt-Regler möglich, weil sie ${esc(NOREC[R.noRec] || 'eine Zeichenfunktion nutzt, die sich nicht einzeln steuern lässt')}. Die Gesamt-Regler oben funktionieren trotzdem.`)); return; }
    if (!R.objs.length) { box.appendChild(el('p', 'oh-note', 'Keine Objekte gefunden.')); return; }
    for (const o of R.objs) {
      const det = el('details', 'obj'); det.dataset.o = o.id; det.open = !!OPEN['obj:' + o.id];
      det.innerHTML = `<summary><span class="on">${esc(o.name)}</span>${o.max > 1 ? `<small>bis ×${o.max}</small>` : ''}<span class="sp"></span><button type="button" class="ov" title="Objekt ein-/ausblenden"></button><button type="button" class="os" title="Solo: nur dieses Objekt zeigen">S</button><button type="button" class="ors" title="Dieses Objekt zurücksetzen">↺</button></summary>`;
      const body = el('div', 'ob');
      A.OBJ_GROUPS.forEach(g => { const sub = mkGroup(o.id, g, true, ['vis']); sub.classList.add('sub'); body.appendChild(sub); });
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
    const sb = E.root && E.root.querySelector('.ed-solo'); if (sb) { sb.hidden = !R.solo; const o = R.byId[R.solo]; sb.textContent = o ? `Solo: ${o.name} – hier klicken zum Beenden` : ''; }
  }

  /* ───────────── Eingaben (Ereignisse an das Panel gebunden) ───────────── */
  function setNum(row, which, v) {
    const scope = row.dataset.scope, id = row.dataset.id, d = defOf(scope, id), raw = getRaw(scope, id);
    v = clamp(v, d.min, d.max);
    if (A.isAn(raw)) setVal(scope, id, { ...raw, [which]: v }); else setVal(scope, id, v);
    const sfx = which === 'b' ? 'B' : '', r = row.querySelector('.rg' + sfx), n = row.querySelector('.nm' + sfx);
    if (r && +r.value !== v) r.value = v; if (n && n.getRootNode().activeElement !== n) n.value = fmtN(v, d);
  }
  function wire(P) {
    P.addEventListener('input', ev => {
      const t = ev.target, row = t.closest('.pr'); if (!row) return;
      const scope = row.dataset.scope, id = row.dataset.id;
      if (t.classList.contains('rg') || t.classList.contains('nm')) { if (t.value === '' || isNaN(+t.value)) return; setNum(row, 'a', +t.value); }
      else if (t.classList.contains('rgB') || t.classList.contains('nmB')) { if (t.value === '' || isNaN(+t.value)) return; setNum(row, 'b', +t.value); }
      else if (t.classList.contains('cl')) setVal(scope, id, t.value);
      else return;
      touch();
    });
    P.addEventListener('change', ev => {
      const t = ev.target, row = t.closest('.pr'); if (!row) return;
      const scope = row.dataset.scope, id = row.dataset.id, raw = getRaw(scope, id);
      if (t.type === 'checkbox') setVal(scope, id, t.checked);
      else if (t.classList.contains('sl')) setVal(scope, id, t.value);
      else if (t.classList.contains('per')) setVal(scope, id, { ...raw, per: t.value });
      else if (t.classList.contains('mode')) setVal(scope, id, { ...raw, mode: t.value });
      else if (t.classList.contains('nm') || t.classList.contains('nmB')) { setNum(row, t.classList.contains('nm') ? 'a' : 'b', +t.value || 0); fillRow(row); }
      else return;
      touch();
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
      else if (t.closest('.sw')) {
        if (A.isAn(raw)) setVal(scope, id, raw.a);
        else { const b = clamp(raw + (raw < (d.min + d.max) / 2 ? 1 : -1) * (d.max - d.min) * .3, d.min, d.max); setVal(scope, id, { an: 1, a: raw, b: +b.toFixed(dec(d.step) + 1), per: 'bar', mode: 'pp', cv: { p: 'easeInOut' } }); }
        fillRow(row); touch();
      } else if (t.closest('.cvb')) {
        const btn = t.closest('.cvb'), an = btn.dataset.cv === 'an';
        openCurve(btn, an ? raw.cv : raw, cv => { if (an) setVal(scope, id, { ...getRaw(scope, id), cv }); else setVal(scope, id, cv); const b = row.querySelector('.cvb'); if (b) { b.innerHTML = cvPreview(cv) + `<span>${esc(cvName(cv))}</span>`; } touch(); if (!an) refreshAll(); });
      }
    });
    P.addEventListener('toggle', ev => { const d = ev.target; if (d.dataset && d.dataset.k) { OPEN[d.dataset.k] = d.open; saveOpen(); } else if (d.dataset && d.dataset.o) { OPEN['obj:' + d.dataset.o] = d.open; saveOpen(); } }, true);
    P.addEventListener('mouseover', ev => { const o = ev.target.closest('details.obj'); const id = o ? o.dataset.o : null; if (R.hl !== id) R.hl = id; });
    P.addEventListener('mouseleave', () => { R.hl = null; });
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
        <text x="${X(0)}" y="${GY0 + GH + 14}" class="cvt">Anfang</text><text x="${X(1)}" y="${GY0 + GH + 14}" class="cvt" text-anchor="end">Ende der Periode</text><text x="${GX - 4}" y="${Y(0) + 4}" class="cvt" text-anchor="end">0</text><text x="${GX - 4}" y="${Y(1) + 4}" class="cvt" text-anchor="end">1</text>
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
  let preEl = null, nameMode = '';
  function status() {
    const s = preEl && preEl.querySelector('.pre-status'); if (!s) return;
    const dirty = isDirty(), name = E.sel.slice(2);
    s.className = 'pre-status' + (saveErr ? ' err' : dirty ? ' dirty' : '');
    s.textContent = saveErr ? 'Speichern im Browser nicht möglich (Speicher voll oder gesperrt).' : E.sel.startsWith('u:') ? (dirty ? `● „${name}“ geändert – „Speichern“ aktualisiert die Vorlage. Arbeitsstand ist gesichert.` : `„${name}“ gespeichert ✓`)
      : E.sel.startsWith('b:') ? (dirty ? `● Änderungen an „${name}“ – „Speichern unter…“ legt eine eigene Vorlage an.` : `Mitgelieferte Vorlage „${name}“`) : (dirty ? 'Arbeitsstand wird automatisch im Browser gesichert. Als Vorlage mit „Speichern unter…“.' : 'Original – keine Änderungen');
    const user = E.sel.startsWith('u:'); preEl.querySelector('.pre-save').disabled = !(user && dirty);
    preEl.querySelector('.pre-ren').disabled = !user; preEl.querySelector('.pre-del').disabled = !user;
  }
  function fillSel() {
    const sel = preEl.querySelector('.pre-sel'), e = entry(), users = Object.keys(e.p);
    sel.innerHTML = `<option value="">Original (keine Änderungen)</option>${users.length ? `<optgroup label="Meine Vorlagen">${users.map(n => `<option value="u:${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>` : ''}<optgroup label="Mitgelieferte Vorlagen">${Object.keys(BUILTIN).map(n => `<option value="b:${esc(n)}">${esc(n)}</option>`).join('')}</optgroup>`;
    sel.value = E.sel; if (sel.value !== E.sel) { E.sel = ''; sel.value = ''; }
  }
  function applyPreset(val) {
    E.sel = val;
    const p = val.startsWith('u:') ? entry().p[val.slice(2)] : val.startsWith('b:') ? BUILTIN[val.slice(2)] : empty();
    E.S = copy(p || empty()); entry().w = copy(E.S); entry().c = E.sel; persist();
    buildProps(); status();
  }
  function showNameForm(mode) {
    nameMode = mode; const f = preEl.querySelector('.pre-name'); f.hidden = false;
    const i = f.querySelector('input'); i.value = mode === 'ren' ? E.sel.slice(2) : ''; i.placeholder = mode === 'ren' ? 'Neuer Name' : 'Name der Vorlage'; i.focus(); i.select();
  }
  function uniqueName(n) { const e = entry(); let k = n, i = 2; while (e.p[k] || BUILTIN[k]) k = `${n} ${i++}`; return k; }
  function buildPresets(host) {
    preEl = el('div', 'pre');
    preEl.innerHTML = `<div class="pre-r1"><select class="pre-sel" aria-label="Vorlage wählen" title="Vorlage für diese Animation"></select><button type="button" class="btn pre-save" title="Die gewählte eigene Vorlage mit dem aktuellen Stand überschreiben">Speichern</button><button type="button" class="btn pre-new" title="Aktuellen Stand als neue Vorlage für diese Animation speichern">Speichern unter…</button></div>
      <form class="pre-name" hidden><input type="text" maxlength="40" aria-label="Name der Vorlage" required><button type="submit" class="btn go">OK</button><button type="button" class="btn pre-cancel">Abbrechen</button></form>
      <div class="pre-r2"><button type="button" class="btn pre-ren">Umbenennen</button><button type="button" class="btn pre-del">Löschen</button><button type="button" class="btn pre-reset" title="Alle Einstellungen dieser Animation zurücksetzen">Zurücksetzen</button><span class="sp"></span><button type="button" class="btn pre-exp" title="Alle Vorlagen aller Animationen als Datei sichern">Sichern ↓</button><button type="button" class="btn pre-imp" title="Gesicherte Vorlagen aus einer Datei laden">Laden ↑</button><input type="file" accept="application/json,.json" hidden></div>
      <div class="pre-status"></div>`;
    host.appendChild(preEl);
    const q = s => preEl.querySelector(s);
    q('.pre-sel').onchange = e => applyPreset(e.target.value);
    q('.pre-save').onclick = () => { if (!E.sel.startsWith('u:')) return; entry().p[E.sel.slice(2)] = copy(E.S); persist(); status(); };
    q('.pre-new').onclick = () => showNameForm('new');
    q('.pre-ren').onclick = () => showNameForm('ren');
    q('.pre-cancel').onclick = () => { q('.pre-name').hidden = true; };
    let delT = 0;
    q('.pre-del').onclick = ev => {
      const b = ev.currentTarget;
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Wirklich löschen?'; b.classList.add('warn'); delT = setTimeout(() => { delete b.dataset.sure; b.textContent = 'Löschen'; b.classList.remove('warn'); }, 3000); return; }
      clearTimeout(delT); delete b.dataset.sure; b.textContent = 'Löschen'; b.classList.remove('warn');
      delete entry().p[E.sel.slice(2)]; E.sel = ''; entry().c = ''; persist(); fillSel(); status();
    };
    q('.pre-name').onsubmit = ev => {
      ev.preventDefault(); const n = q('.pre-name input').value.trim(); if (!n) return; const e = entry();
      if (nameMode === 'ren') { const old = E.sel.slice(2), nn = n === old ? n : uniqueName(n); const v = e.p[old]; delete e.p[old]; e.p[nn] = v; E.sel = 'u:' + nn; }
      else { const nn = uniqueName(n); e.p[nn] = copy(E.S); E.sel = 'u:' + nn; }
      e.c = E.sel; persist(); q('.pre-name').hidden = true; fillSel(); status();
    };
    q('.pre-reset').onclick = () => { E.S = empty(); E.sel = ''; entry().w = empty(); entry().c = ''; persist(); R.solo = null; fillSel(); buildProps(); status(); };
    q('.pre-exp').onclick = () => {
      const blob = new Blob([JSON.stringify({ type: 'av-animation-editor', version: 1, a: DB.a }, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'animations-vorlagen.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      q('.pre-status').textContent = 'Datei „animations-vorlagen.json“ gesichert ✓';
    };
    q('.pre-imp').onclick = () => q('input[type=file]').click();
    q('input[type=file]').onchange = async ev => {
      const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
      try {
        const d = JSON.parse(await f.text()); if (!d || d.type !== 'av-animation-editor' || !d.a) throw 0;
        let np = 0, na = 0;
        for (const k in d.a) { const src = d.a[k]; if (!src || !src.p) continue; const dst = DB.a[k] || (DB.a[k] = { w: empty(), p: {}, c: '' }); let any = false;
          for (const n in src.p) { let nn = n, i = 2; while (dst.p[nn] && !same(dst.p[nn], src.p[n])) nn = `${n} (${i++})`; if (!dst.p[nn]) { dst.p[nn] = src.p[n]; np++; any = true; } }
          if (any) na++; if (!dst.w || (!Object.keys(dst.w.g || {}).length && !Object.keys(dst.w.o || {}).length)) dst.w = src.w || empty(); }
        persist(); fillSel(); status(); q('.pre-status').textContent = `${np} Vorlagen für ${na} Animationen geladen ✓`;
      } catch (e) { q('.pre-status').textContent = 'Die Datei ist keine gültige Vorlagen-Datei.'; }
    };
  }

  /* ───────────── Aufbau ───────────── */
  function mount(host) {
    const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;      // eigene Hülle: Studio- und Seiten-Styles stören nicht
    E.root = root;
    root.innerHTML = `<link rel="stylesheet" href="${CSS_URL}"><div class="ed"><div class="ed-main"><div class="ed-top"><div class="ed-chips" id="edChips"></div><div class="ed-act" id="edAct"></div></div>
        <div class="ed-box" id="edBox"><div class="ed-stage" id="edStage"><canvas id="edCv"></canvas>
          <div class="ed-tools"><button type="button" class="ed-ba" title="Original ohne alle Änderungen zeigen (Vorher/Nachher)" aria-pressed="false">Vorher</button><button type="button" class="ed-fs" title="Vollbild" aria-label="Vollbild"><svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button></div>
          <button type="button" class="ed-solo" hidden></button></div></div></div>
      <aside class="ed-side" aria-label="Eigenschaften"><div id="edPre"></div><div class="ed-assign" id="edAssign"></div><div class="ed-props" id="edProps"></div></aside></div>`;
    E.cv = root.querySelector('#edCv'); E.stage = root.querySelector('#edStage'); E.props = root.querySelector('#edProps');
    buildPresets(root.querySelector('#edPre')); wire(E.props);
    root.querySelector('.ed-ba').onclick = ev => { R.bypass = !R.bypass; ev.currentTarget.setAttribute('aria-pressed', R.bypass); ev.currentTarget.textContent = R.bypass ? 'Nachher' : 'Vorher'; };
    root.querySelector('.ed-solo').onclick = () => { R.solo = null; refreshAll(); };
    root.querySelector('.ed-fs').onclick = () => {                      // Vollbild (oder Ersatz per Klasse, falls der Browser es nicht kann)
      const st = E.stage, open = document.fullscreenElement || document.webkitFullscreenElement;
      if (open || st.classList.contains('full')) { st.classList.remove('full'); if (open) (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      const req = st.requestFullscreen || st.webkitRequestFullscreen;
      if (req) Promise.resolve(req.call(st)).catch(() => st.classList.add('full')); else st.classList.add('full');
    };
    // Vorschau im Format 4:3 so groß wie möglich in den freien Platz setzen
    const box = root.querySelector('#edBox');
    new ResizeObserver(() => { if (document.fullscreenElement === E.stage) return; const aw = box.clientWidth, ah = box.clientHeight; if (aw < 10 || ah < 10) return; let w = aw, h = w * 3 / 4; if (h > ah) { h = ah; w = h * 4 / 3; } E.stage.style.width = Math.floor(w) + 'px'; E.stage.style.height = Math.floor(h) + 'px'; }).observe(box);
    // Leertaste & Co. in Eingabefeldern sollen nicht den Player auslösen (Ereignisse aus der Hülle erscheinen sonst als „Seite“)
    ['keydown', 'keyup'].forEach(t => root.addEventListener(t, ev => { if (ev.target.matches && ev.target.matches('input:not([type=range]),select,textarea')) ev.stopPropagation(); }));
    return { stage: E.stage, chips: root.querySelector('#edChips'), act: root.querySelector('#edAct'), assign: root.querySelector('#edAssign') };
  }
  function load(key, idea) {
    closeCurve(); R.solo = null; R.hl = null; R.bypass = false;
    const ba = E.root && E.root.querySelector('.ed-ba'); if (ba) { ba.setAttribute('aria-pressed', 'false'); ba.textContent = 'Vorher'; }
    E.key = key; E.idea = idea;
    const e = entry(); E.S = copy(e.w || empty()); if (!E.S.g) E.S.g = {}; if (!E.S.o) E.S.o = {}; E.sel = e.c || '';
    R.setIdea(idea); fillSel(); buildProps(); status();
  }
  let sz = { w: 0, h: 0, d: 0 };
  function frame(sb) {
    if (!E.cv || !E.idea || !E.cv.isConnected) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), r = E.cv.getBoundingClientRect(), W = r.width, H = r.height;
    if (W < 4 || H < 4) return;
    const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (E.cv.width !== pw || E.cv.height !== ph) { E.cv.width = pw; E.cv.height = ph; }
    if (R.ver !== E.shownVer) buildObjs();
    try { R.render(E.cv, W, H, dpr, sb, E.S); } catch (e) { console.error(e); }
  }
  const api = { mount, load, frame, renderer: R, state: E, closeCurve, BUILTIN };
  window.Editor = api;
})();
