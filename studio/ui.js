'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Studio – Oberfläche: Layout mit Trennern, Vorschau, Zuordnungsliste, Inspektor,
   Zeitleiste, Player, Menüs. (Das Labor steht in labor.js, der Start in start.js.)
   ═══════════════════════════════════════════════════════════════════════════ */
const UI = Object.assign({ onlyUsed: false, ws: 'studio', sel: null, view: 'mix', gate: true, idle: true, tlSig: true, lay: { lw: 0, pw: 0, th: 250 }, hide: {}, lf: 'alle', lt: '', mp4gate: true, mp4res: '1080' }, lsGet(LS_U, {}));
UI.lay = Object.assign({ lw: 0, pw: 0, th: 250 }, UI.lay); delete UI.lay.iw; UI.hide = UI.hide || {};
const defLay = () => ({ lw: Math.round(Math.max(300, Math.min(480, innerWidth * .28))), pw: Math.round(Math.max(360, Math.min(760, innerWidth * .42))), th: 250 });
if (!UI.lay.lw) UI.lay.lw = defLay().lw; if (!UI.lay.pw || UI.lay.pw < 300) UI.lay.pw = defLay().pw;
const saveUI = () => lsSet(LS_U, UI);
const EYE = '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>';
const animOptionsHtml = sel => `<option value=""${sel === '' ? ' selected' : ''}>– keine Animation –</option>` + TRACKS.filter(t => (IDEAS[t.key] || []).length).map(t =>
  `<optgroup label="${esc(t.name)}">${IDEAS[t.key].map((d, i) => { const id = t.key + ':' + i; return `<option value="${id}"${id === sel ? ' selected' : ''}>${i + 1} · ${esc(d.title)}</option>`; }).join('')}</optgroup>`).join('');
const colorOf = l => l.kind === 'track' ? TBY[l.key].cssColor : 'var(--faint)';
const mapTitle = m => m.name || describe(m).when;
const layerLabel = id => id === '*' ? 'Alle Ebenen' : (layerById(id) ? layerName(layerById(id)) : '?');

/* ═══════════ Layout: Fenster & Trenner ═══════════ */
function applyLayout() {
  const L = UI.lay, h = UI.hide, ws = $('ws-studio');
  const sP = !h.preview, sL = !h.list, sI = !h.insp, sT = !h.timeline;
  const cols = [sP ? (sI ? L.pw + 'px' : 'minmax(0,1fr)') : '0px', sP && sI ? '6px' : '0px', sI ? 'minmax(0,1fr)' : '0px', sL && (sP || sI) ? '6px' : '0px', sL ? L.lw + 'px' : '0px'];
  ws.style.setProperty('--cols', cols.join(' '));
  ws.style.setProperty('--rows', `minmax(0,1fr) ${sT ? '6px' : '0px'} ${sT ? L.th + 'px' : '0px'}`);
  $('p-preview').hidden = !sP; $('p-list').hidden = !sL; $('p-insp').hidden = !sI; $('p-timeline').hidden = !sT;
  ws.querySelectorAll('.splitter').forEach(sp => { const s = sp.dataset.s; sp.hidden = s === 'lw' ? !(sL && (sP || sI)) : s === 'pw' ? !(sP && sI) : !sT; });
}
function initSplitters() {
  document.querySelectorAll('.splitter').forEach(sp => sp.addEventListener('pointerdown', ev => {
    ev.preventDefault(); sp.setPointerCapture(ev.pointerId); sp.classList.add('drag');
    const s = sp.dataset.s, x0 = ev.clientX, y0 = ev.clientY, L0 = { ...UI.lay }, ws = $('ws-studio'), W = ws.clientWidth, Hh = ws.clientHeight;
    const mv = e => {
      const dx = e.clientX - x0, dy = e.clientY - y0;
      if (s === 'lw') UI.lay.lw = clamp(L0.lw - dx, 240, W - 320);
      else if (s === 'pw') UI.lay.pw = clamp(L0.pw + dx, 260, W - (UI.hide.list ? 0 : UI.lay.lw) - 280);
      else UI.lay.th = clamp(L0.th - dy, 90, Hh - 170);
      applyLayout(); resizeAll();
    };
    const up = () => { sp.classList.remove('drag'); sp.removeEventListener('pointermove', mv); sp.removeEventListener('pointerup', up); saveUI(); };
    sp.addEventListener('pointermove', mv); sp.addEventListener('pointerup', up);
  }));
}
function resizeAll() { fitStage(); cells.forEach(c => sizeCv(c.cv)); drawTimelineCanvases(); waveKey = ''; }
function setWs(ws) {
  UI.ws = ws; saveUI();
  $('ws-studio').hidden = ws !== 'studio'; $('ws-labor').classList.toggle('on', ws === 'labor'); $('ws-anim').classList.toggle('on', ws === 'anim');
  ['studio', 'labor', 'anim'].forEach(k => $('nav-' + k).classList.toggle('on', ws === k));
  if (ws === 'labor') renderLabor(); else if (ws === 'anim') renderAnim(); else requestAnimationFrame(resizeAll);
}

/* ═══════════ Vorschau ═══════════ */
function fitStage() {
  const w = $('stagewrap'); if (!w || w.offsetParent === null) return;
  const aw = w.clientWidth - 16, ah = w.clientHeight - 16; if (aw < 10 || ah < 10) return;
  let W = aw, H = W * 9 / 16; if (H > ah) { H = ah; W = H * 16 / 9; }
  const st = $('stage'); st.style.width = Math.floor(W) + 'px'; st.style.height = Math.floor(H) + 'px'; sizeCv($('cv'));
}
let cells = [];
function viewSpec() {
  const v = UI.view;
  if (v.startsWith('layer:')) { const L = layerById(v.slice(6)); if (L) return { kind: 'one', layers: [L], filter: m => m.on, gate: false, label: layerName(L) + ' (einzeln)' }; }
  if (v.startsWith('map:')) { const m = mapById(v.slice(4)); if (m) return { kind: 'one', layers: m.layer === '*' ? orderedLayers() : [layerById(m.layer)].filter(Boolean), filter: x => x.id === m.id, gate: m.layer === '*' ? UI.gate : false, label: 'Nur Zuordnung: ' + mapTitle(m) }; }
  if (v === 'grid') return { kind: 'grid', layers: orderedLayers(), filter: m => m.on, gate: UI.gate, label: 'Vergleich' };
  return { kind: 'one', layers: orderedLayers(), filter: m => m.on, gate: UI.gate, label: 'Gesamtbild' };
}
function renderViewSel() {
  const ok = v => v === 'mix' || v === 'grid' || (v.startsWith('layer:') && layerById(v.slice(6))) || (v.startsWith('map:') && mapById(v.slice(4)));
  if (!ok(UI.view)) UI.view = 'mix';
  $('viewSel').innerHTML = `<option value="mix">Gesamtbild – alle Ebenen übereinander</option><option value="grid">Vergleich – alle Ebenen einzeln nebeneinander</option>`
    + `<optgroup label="Nur eine Ebene">${P.layers.map(l => `<option value="layer:${l.id}">${esc(layerName(l))}</option>`).join('')}</optgroup>`
    + (P.maps.length ? `<optgroup label="Nur eine Zuordnung">${P.maps.map(m => `<option value="map:${m.id}">${esc(mapTitle(m))}</option>`).join('')}</optgroup>` : '');
  $('viewSel').value = UI.view; buildGrid();
}
function buildGrid() {
  const g = $('gridwrap'), grid = UI.view === 'grid'; g.hidden = !grid; $('stagewrap').hidden = grid;
  if (!grid) { cells = []; g.innerHTML = ''; requestAnimationFrame(fitStage); return; }
  const ls = orderedLayers();
  g.innerHTML = ls.map(l => `<div class="cell${UI.sel === l.id ? ' sel' : ''}" data-id="${l.id}" style="--tc:${colorOf(l)}"><canvas></canvas><div class="cl"><span><i></i> ${esc(layerName(l))}</span></div></div>`).join('') || '<div class="empty">Keine Ebene eingeschaltet.</div>';
  cells = [...g.querySelectorAll('.cell')].map(el => ({ el, L: layerById(el.dataset.id), cv: el.querySelector('canvas') }));
  requestAnimationFrame(() => cells.forEach(c => sizeCv(c.cv)));
}
function setView(v) { UI.view = v; saveUI(); renderViewSel(); renderList(); }

/* ═══════════ Liste der Zuordnungen ═══════════ */
function rowLayer(L) {
  const nm = layerName(L), mc = P.maps.filter(m => m.layer === L.id).length, track = L.kind === 'track', solo = UI.view === 'layer:' + L.id;
  const mods = track && L.anim ? Object.keys(L.P).filter(x => L.P[x] !== defOf(L.anim)[x]).length : 0;
  const t2 = track ? [mods ? `<em>${mods} Anpassung${mods > 1 ? 'en' : ''}</em>` : '', mc ? `${mc} Parameter-Zuordnung${mc > 1 ? 'en' : ''}` : ''].filter(Boolean).join(' · ') || 'Standard' : `Effekt aus dem Labor${mc ? ' · ' + mc + ' Parameter-Zuordnung' + (mc > 1 ? 'en' : '') : ''}`;
  return `<div class="row${UI.sel === L.id ? ' sel' : ''}${L.on ? '' : ' off'}" data-id="${L.id}" style="--tc:${colorOf(L)}">
    <button class="tg eye${L.on ? ' on' : ''}" data-a="eye" title="Ebene ein-/ausblenden">${EYE}</button><button class="tg${solo ? ' on' : ''}" data-a="solo" title="Nur diese Ebene in der Vorschau zeigen">S</button><i class="dot"></i>
    <div class="main"><div class="t1"><b>${esc(nm)}</b>${track ? `<select data-a="anim" aria-label="Animation für ${esc(nm)}">${animOptionsHtml(L.anim)}</select>` : ''}</div><div class="t2">${t2}</div></div>
    ${track ? '' : '<button class="x" data-a="del" title="Ebene entfernen">×</button>'}</div>`;
}
/* ---- Parameter-Tabelle: eine Zeile pro Auslöser (Parameter), alles direkt in der Zeile einstellbar ---- */
const COND_S = { grad: 'von … bis', ab: 'ab', unter: 'unter', zw: 'zwischen' };
const tgtOpts = cur => `<option value=""${cur ? '' : ' selected'}>– keine Wirkung –</option>` + Object.entries(WIRK).map(([k, x]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${x.n}</option>`).join('');
const valSelHtml = (m, f) => { const w = WIRK[m.tgt], isCol = w.type === 'color', v = m[f];
  return `<span class="vs">${isCol ? `<span class="sw" style="background:${v || 'transparent'}"></span>` : ''}<select data-f="${f}" title="${f === 'a' ? (m.cond === 'grad' ? 'Wert beim unteren Ende' : 'Wert sonst') : 'Wert'}"><option value=""${v == null ? ' selected' : ''}>unverändert</option>${(isCol ? COLORS : w.opts).map(([n, val]) => `<option value="${val}"${v != null && String(v) === String(val) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></span>`; };
function mapDetail(m) {            // Einstellungen der gewählten Variante – direkt unter der Zeile des Auslösers
  const d = Sig.BY[m.src], w = WIRK[m.tgt], grad = m.cond === 'grad', two = grad || m.cond === 'zw', solo = UI.view === 'map:' + m.id, str = Math.round((m.str == null ? 1 : m.str) * 100), col = w.type === 'color';
  const f = (l, inner) => `<label class="df"><span>${l}</span>${inner}</label>`;
  return `<div class="mdet" data-id="${m.id}">
    ${f('Bedingung', `<select data-f="cond">${Object.entries(COND_S).map(([k, n]) => `<option value="${k}"${k === m.cond ? ' selected' : ''}>${n}</option>`).join('')}</select>`)}
    ${f(two ? 'von / bis' : 'Schwelle', `<span class="pc"><input type="number" data-f="lo" min="${d.lo}" max="${d.hi}" step="${d.step}" value="${m.lo}">${two ? `<input type="number" data-f="hi" min="${d.lo}" max="${d.hi}" step="${d.step}" value="${m.hi}">` : ''}<span class="u">${esc(d.u)}</span></span>`)}
    ${f(grad ? (col ? 'Farbe unten' : 'Wert unten') : 'Sonst', valSelHtml(m, 'a'))}
    ${f(grad ? (col ? 'Farbe oben' : 'Wert oben') : (col ? 'Dann: Farbe' : 'Dann'), valSelHtml(m, 'b'))}
    ${f('Stärke', `<span class="ps"><input type="range" data-f="str" min="0" max="100" step="1" value="${str}"><span class="pct">${str} %</span></span>`)}
    ${f('Gilt für', `<select data-f="layer"${m.tgt === 'bg' ? ' disabled' : ''}><option value="*"${m.layer === '*' ? ' selected' : ''}>Alle Ebenen</option>${P.layers.map(l => `<option value="${l.id}"${m.layer === l.id ? ' selected' : ''}>${esc(layerName(l))}</option>`).join('')}</select>`)}
    <div class="dact"><button class="tg eye${m.on ? ' on' : ''}" data-a="eye" title="Ein-/ausschalten">${EYE}</button><button class="tg${solo ? ' on' : ''}" data-a="solo" title="Nur diese Zuordnung in der Vorschau zeigen">S</button><button class="btn sm" data-a="del">Entfernen</button></div></div>`;
}
/* Eine Zeile pro Auslöser (Parameter); in der Zeile stehen nur die Varianten (Wirkungen) für genau diesen Auslöser */
function paramTable() {
  let h = '', g = ''; const cur = mapById(UI.sel);
  for (const d of Sig.DEF) {
    const ms = P.maps.filter(m => m.src === d.k); if (UI.onlyUsed && !ms.length) continue;
    if (d.g !== g) { g = d.g; h += `<div class="pgrp">${esc(g)}</div>`; }
    h += `<div class="mrow${ms.some(m => m.on) ? ' used' : ''}" data-src="${d.k}"><div class="mn" title="${esc(d.hint)}"><b>${esc(d.n)}</b></div><div class="mch">`
      + Object.entries(WIRK).map(([k, w]) => { const same = ms.filter(x => x.tgt === k), m = same[0]; return `<button class="vch${m ? (m.on ? ' on' : ' off') : ''}${cur && same.includes(cur) ? ' cur' : ''}" data-tgt="${k}" title="${esc(w.hint)}">${esc(w.s)}${same.length > 1 ? ` <i>${same.length}</i>` : ''}</button>`; }).join('')
      + `</div>${cur && cur.src === d.k ? mapDetail(cur) : ''}</div>`;
  }
  return h || '<div class="empty">Noch keine Zuordnung.</div>';
}
function mapFromRow(src, tgt) {
  const d = Sig.BY[src], m = { id: newMapId(), name: '', layer: layerById(UI.sel) ? UI.sel : '*', src, cond: src === 'gate' ? 'ab' : 'ab', lo: d.dlo, hi: d.dhi, tgt, a: null, b: null, soft: 'weich', str: 1, on: true };
  if (tgt === 'bg') m.layer = '*'; mapDefaults(m); return m;
}
function setMapField(m, f, v) {
  if (f === 'layer') m.layer = v;
  else if (f === 'src') { const d = Sig.BY[v]; m.src = v; m.lo = d.dlo; m.hi = d.dhi; }
  else if (f === 'cond') { const was = m.cond; m.cond = v; if ((was === 'grad') !== (m.cond === 'grad')) mapDefaults(m); }
  else if (f === 'tgt') { m.tgt = v; if (m.tgt === 'bg') m.layer = '*'; mapDefaults(m); }
  else if (f === 'a' || f === 'b') m[f] = v === '' ? null : (WIRK[m.tgt].type === 'color' ? v : +v);
  else if (f === 'soft') m.soft = v; else if (f === 'name') m.name = v.trim();
  else if (f === 'lo' || f === 'hi') m[f] = +v; else if (f === 'str') m.str = clamp(+v / 100, 0, 1);
}
function renderList() {
  const tracks = TRACKS.map(t => layerById('track:' + t.key)).filter(Boolean), fxs = P.layers.filter(l => l.kind === 'fx');
  $('list').innerHTML = `<div class="sec"><span class="lb">Tonspuren → Animation</span></div>${tracks.map(rowLayer).join('')}`
    + `<div class="sec"><span class="lb">Effekte (aus dem Labor)</span></div>${fxs.length ? fxs.map(rowLayer).join('') : '<div class="empty" style="border-top:1px solid var(--line)">Noch keine – oben „+ Effekt“ oder im Labor hinzufügen.</div>'}`
    + `<div class="sec"><span class="lb">Parameter – eine Zeile pro Auslöser</span><span class="sp"></span><label class="chk"><input type="checkbox" id="onlyUsed"${UI.onlyUsed ? ' checked' : ''}> nur belegte</label></div>${paramTable()}`;
  rowEls = {}; $('list').querySelectorAll('.row').forEach(r => rowEls[r.dataset.id] = r);
}
let rowEls = {};
function select(id) { UI.sel = id; saveUI(); renderList(); renderInsp(); renderTimeline(); if (UI.view === 'grid') cells.forEach(c => c.el.classList.toggle('sel', c.el.dataset.id === id)); }
function refresh(parts = 'lit') {         // l = Liste, i = Inspektor, t = Zeitleiste, v = Ansichtsauswahl
  touch();
  if (parts.includes('v')) renderViewSel();
  if (parts.includes('l')) renderList();
  if (parts.includes('i')) renderInsp();
  if (parts.includes('t')) renderTimeline();
  if (UI.ws === 'labor') renderLabor(); else if (UI.ws === 'anim' && UI.av !== 'edit') renderAnim();
}
const uiAll = () => { renderViewSel(); renderList(); renderInsp(); renderTimeline(); if (UI.ws === 'labor') renderLabor(); updateDirty(); };

$('list').addEventListener('click', ev => {
  const chip = ev.target.closest('.vch');
  if (chip) {                                              // Variante ein-/auswählen
    const src = chip.closest('.mrow').dataset.src, tgt = chip.dataset.tgt, cur = mapById(UI.sel), ex = P.maps.find(m => m.src === src && m.tgt === tgt);
    if (!ex) { const c = mapFromRow(src, tgt); P.maps.push(c); UI.sel = c.id; refresh('lvit'); }
    else if (cur && cur.id === ex.id) { UI.sel = null; saveUI(); renderList(); renderInsp(); renderTimeline(); }
    else select(ex.id);
    return;
  }
  const det = ev.target.closest('.mdet');
  if (det) {
    const a = ev.target.closest('[data-a]'), act = a && a.dataset.a, id = det.dataset.id;
    if (act === 'eye') { mapById(id).on = !mapById(id).on; refresh('lvit'); }
    else if (act === 'solo') setView(UI.view === 'map:' + id ? 'mix' : 'map:' + id);
    else if (act === 'del') removeMap(id);
    return;
  }
  const row = ev.target.closest('.row'); if (!row) return; const id = row.dataset.id, a = ev.target.closest('[data-a]'), act = a && a.dataset.a;
  const L = layerById(id), m = mapById(id);
  if (act === 'eye') { (L || m).on = !(L || m).on; refresh('lvt'); }
  else if (act === 'solo') setView(UI.view === (L ? 'layer:' : 'map:') + id ? 'mix' : (L ? 'layer:' : 'map:') + id);
  else if (act === 'del') { if (L) removeFx(id); else removeMap(id); }
  else if (act === 'anim') return;
  else select(id);
});
$('list').addEventListener('input', ev => {                      // Zahlen und Stärke-Regler direkt in der Zeile
  const el = ev.target, f = el.dataset.f, pr = el.closest('.mdet'); if (!pr || (f !== 'lo' && f !== 'hi' && f !== 'str')) return;
  const m = mapById(pr.dataset.id); setMapField(m, f, el.value); if (f === 'str') pr.querySelector('.pct').textContent = Math.round(m.str * 100) + ' %';
  touch(); drawTimelineCanvases(); if (UI.sel === m.id) { const t = $('insp').querySelector(`[data-f="${f}"]`); if (t) $('insp').querySelectorAll(`[data-f="${f}"]`).forEach(x => x.value = f === 'str' ? Math.round(m.str * 100) : m[f]); const dd = $('mdesc'); if (dd) dd.textContent = `${describe(m).when} → ${describe(m).then}`; }
});
$('list').addEventListener('change', ev => {
  const el = ev.target;
  if (el.id === 'onlyUsed') { UI.onlyUsed = el.checked; saveUI(); renderList(); return; }
  const pr = el.closest('.mdet');
  if (pr) {
    const f = el.dataset.f, m = mapById(pr.dataset.id); if (!m) return;
    if (f === 'lo' || f === 'hi' || f === 'str') { touch(); return; }
    setMapField(m, f, el.value); refresh('lvit'); return;
  }
  const row = el.closest('.row'); if (!row || el.dataset.a !== 'anim') return;
  const L = layerById(row.dataset.id); L.anim = ev.target.value; L.P = {}; refresh('lit');
});
function removeFx(id) { P.layers = P.layers.filter(l => l.id !== id); P.maps = P.maps.filter(m => m.layer !== id); if (UI.sel === id) UI.sel = null; refresh('lvit'); }
function removeMap(id) { P.maps = P.maps.filter(m => m.id !== id); if (UI.sel === id) UI.sel = null; refresh('lvit'); }
function addMap(preset, layer, over) {
  const base = preset ? PRESETS.find(p => p.id === preset).m : EMPTY_MAP, d = Sig.BY[base.src];
  const m = { id: newMapId(), name: '', layer: layer || (layerById(UI.sel) ? UI.sel : '*'), hi: d.dhi, str: 1, ...base, ...(over || {}), on: true };
  if (m.tgt === 'bg') m.layer = '*';
  P.maps.push(m); UI.sel = m.id; refresh('lvit'); setWs('studio'); renderInsp();
}
$('addMap').onclick = ev => {
  const items = [{ h: 'Vorlage wählen' }, ...PRESETS.map(p => ({ t: p.n, f: () => addMap(p.id) })), { hr: 1 }, { t: 'Leere Zuordnung (selbst einstellen)', f: () => addMap(null) }];
  openMenu(ev.currentTarget, items);
};
$('addFx').onclick = ev => {
  const items = [];
  (window.LABOR_GROUPS || []).forEach(g => { items.push({ h: g.g }); g.fx.forEach(f => items.push({ t: f.title, ck: P.layers.some(l => l.id === 'fx:' + f.nr), f: () => toggleFx(f.nr) })); });
  openMenu(ev.currentTarget, items);
};
function toggleFx(n) {
  const id = 'fx:' + n, ex = layerById(id);
  if (ex) removeFx(id); else { P.layers.unshift(fxLayer(n)); UI.sel = id; refresh('lvit'); }
}

/* ═══════════ Inspektor ═══════════ */
const fld = (label, inner, cls = '') => `<label class="fld ${cls}"><span>${label}</span>${inner}</label>`;
const box = (title, inner, extra = '') => `<div class="ibox"><div class="bh">${title}<span class="sp"></span>${extra}</div><div class="bd">${inner}</div></div>`;
function mapListFor(id) {
  const ms = P.maps.filter(m => m.layer === id);
  return ms.length ? ms.map(m => `<div class="mapli" data-go="${m.id}" title="Zuordnung bearbeiten"><span><b>${esc(describe(m).when)}</b> → ${esc(describe(m).then)}</span><span style="color:var(--faint)">${m.on ? '' : 'aus'}</span></div>`).join('') : '<div class="note">Noch keine Parameter-Zuordnung für diese Ebene.</div>';
}
function inspLayer(L) {
  const track = L.kind === 'track', nm = layerName(L), idea = track ? ideaOf(L.anim) : null, full = track && !!fpCfg(L.anim);
  let h = `<div class="ititle" style="--tc:${colorOf(L)}"><i></i>${esc(nm)}<span class="sp"></span><button class="btn sm${UI.view === 'layer:' + L.id ? ' on' : ''}" data-act="solo" title="Nur diese Ebene in der Vorschau zeigen">Einzeln ansehen</button></div>`;
  h += `<div class="sub">${track ? 'Tonspur · ' + (idea ? esc(idea.title) : 'keine Animation') : 'Effekt aus dem Labor · ' + esc(FX[L.fx - 1].tag || '')}</div>`;
  if (track) {
    h += box('Animation', fld('Animation', `<select data-f="anim">${animOptionsHtml(L.anim)}</select>`) + fld('Farbe', `<select data-f="tint"><option value="1"${L.tint ? ' selected' : ''}>Spurfarbe</option><option value="0"${L.tint ? '' : ' selected'}>Weiß / Schwarz (Theme)</option></select>`)
      + (idea ? `<div class="note">${esc(idea.text || '')}</div>` : ''));
    if (L.anim) {
      const Pm = { ...defOf(L.anim), ...L.P };
      h += box('Morphologischer Kasten', `<div class="note">${full ? 'Alle Parameter dieser Animation.' : 'Allgemeine Anpassung der Animation.'} Die Werte gelten für diese Ebene.</div>`
        + groupsOf(L.anim).map(([gt, ks]) => `<div class="lb" style="margin-top:2px">${gt}</div>` + ks.map(x => fld(nameOf(L.anim, x), `<select data-f="p" data-k="${x}"${!full && (x === 'sat' || x === 'light') && Pm.hue === 'Original' ? ' disabled' : ''}>${optsOf(L.anim, x).map(o => `<option${o === Pm[x] ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`)).join('')).join('')
        + `<div><button class="btn sm" data-act="resetP">Zurücksetzen</button></div>`);
    }
  } else h += box('Effekt', `<div class="note">${esc(FX[L.fx - 1].text || '')}</div><div><button class="btn sm" data-act="rmfx">Ebene entfernen</button></div>`);
  h += box('Parameter-Zuordnungen für diese Ebene', mapListFor(L.id) + `<div><button class="btn sm" data-act="addmap">+ Zuordnung hinzufügen</button></div>`);
  return h;
}
function inspMap(m) {
  const d = Sig.BY[m.src], w = WIRK[m.tgt], isCol = w.type === 'color', thr = m.cond === 'ab' || m.cond === 'unter', grad = m.cond === 'grad';
  const groups = []; Sig.DEF.forEach(x => { let g = groups.find(q => q[0] === x.g); if (!g) groups.push(g = [x.g, []]); g[1].push(x); });
  const rr = (label, f, val) => fld(label, `<div class="rg"><input type="range" data-f="${f}" min="${d.lo}" max="${d.hi}" step="${d.step}" value="${val}"><input type="number" data-f="${f}" min="${d.lo}" max="${d.hi}" step="${d.step}" value="${val}"></div>`);
  const valSel = (f, v) => `<div style="display:flex;gap:6px;align-items:center;min-width:0">${isCol ? `<span class="sw" style="background:${v || 'transparent'};flex:none"></span>` : ''}<select data-f="${f}" style="flex:1;min-width:0"><option value=""${v == null ? ' selected' : ''}>unverändert</option>${(isCol ? COLORS : w.opts).map(([n, val]) => `<option value="${val}"${v != null && String(v) === String(val) ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></div>`;
  const aL = grad ? `Bei ${d.lowL}` : 'Sonst', bL = grad ? `Bei ${d.highL}` : 'Dann';
  let h = `<div class="ititle"><i style="--tc:var(--accent)"></i>Parameter-Zuordnung<span class="sp"></span><button class="btn sm${UI.view === 'map:' + m.id ? ' on' : ''}" data-act="solo" title="Nur diese Zuordnung in der Vorschau zeigen">Einzeln ansehen</button></div>`;
  h += `<div class="sub" id="mdesc">${esc(describe(m).when)} → ${esc(describe(m).then)}</div>`;
  h += box('1 · Auslöser – wann?',
    fld('Gilt für', `<select data-f="layer"${m.tgt === 'bg' ? ' disabled' : ''}><option value="*"${m.layer === '*' ? ' selected' : ''}>Alle Ebenen</option>${P.layers.map(l => `<option value="${l.id}"${m.layer === l.id ? ' selected' : ''}>${esc(layerName(l))}</option>`).join('')}</select>`)
    + fld('Auslöser', `<select data-f="src">${groups.map(([g, xs]) => `<optgroup label="${esc(g)}">${xs.map(x => `<option value="${x.k}"${x.k === m.src ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}</optgroup>`).join('')}</select>`)
    + `<div class="note">${esc(d.hint)}</div>`
    + fld('Bedingung', `<select data-f="cond">${Object.entries(COND).map(([k, n]) => `<option value="${k}"${k === m.cond ? ' selected' : ''}>${n}</option>`).join('')}</select>`)
    + (thr ? rr(`Schwelle${d.u ? ' (' + d.u + ')' : ''}`, 'lo', m.lo) : rr(`${grad ? 'von' : 'ab'}${d.u ? ' (' + d.u + ')' : ''}`, 'lo', m.lo) + rr(`${grad ? 'bis' : 'bis'}${d.u ? ' (' + d.u + ')' : ''}`, 'hi', m.hi))
    + `<canvas class="graph" id="mgraph" title="Klick = Schwelle setzen (Shift = obere Grenze)"></canvas><div class="note" id="mnow"></div>`);
  h += box('2 · Wirkung – was passiert?',
    fld('Wirkung', `<select data-f="tgt">${Object.entries(WIRK).map(([k, x]) => `<option value="${k}"${k === m.tgt ? ' selected' : ''}>${x.n}</option>`).join('')}</select>`)
    + `<div class="note">${esc(w.hint)}</div>` + fld(aL, valSel('a', m.a)) + fld(bL, valSel('b', m.b))
    + fld('Stärke', `<div class="rg"><input type="range" data-f="str" min="0" max="100" step="1" value="${Math.round((m.str == null ? 1 : m.str) * 100)}"><input type="number" data-f="str" min="0" max="100" step="1" value="${Math.round((m.str == null ? 1 : m.str) * 100)}"></div>`));
  h += box('3 · Feinheiten', fld('Übergang', `<select data-f="soft">${Object.entries(SOFT).map(([k, x]) => `<option value="${k}"${k === m.soft ? ' selected' : ''}>${x.n}</option>`).join('')}</select>`)
    + fld('Name (optional)', `<input type="text" data-f="name" value="${esc(m.name)}" placeholder="${esc(describe(m).when)}">`)
    + `<div class="note">Lautstärke, Tonhöhe usw. werden am fertigen Mix gemessen – einzelne Tonspuren liegen nicht getrennt vor.</div>`
    + `<div style="display:flex;gap:6px"><button class="btn sm" data-act="dup">Duplizieren</button><button class="btn sm" data-act="delmap">Löschen</button></div>`);
  return h;
}
function renderInsp() {
  const el = $('insp'), id = UI.sel, L = layerById(id), m = mapById(id);
  if (L) el.innerHTML = `<div class="ib">${inspLayer(L)}</div>`;
  else if (m) { el.innerHTML = `<div class="ib">${inspMap(m)}</div>`; requestAnimationFrame(drawInspGraph); }
  else el.innerHTML = `<div class="ib"><div class="ititle">Nichts ausgewählt</div><div class="note">Links in der Liste eine <b>Tonspur</b>, einen <b>Effekt</b> oder eine <b>Parameter-Zuordnung</b> anklicken – hier stellst du sie ein, während die Vorschau oben links weiterläuft.</div>
    <div class="ibox"><div class="bh">So funktioniert eine Zuordnung</div><div class="bd"><div class="note"><b>Auslöser</b> (z. B. Lautstärke, Tonhöhe, Schlag) → <b>Wirkung</b> (z. B. Farbe, Größe, Position). Beispiele:<br>• Lautstärke ab −9 dB → Farbe Orange<br>• Tonhöhe stufenlos → Position unten … oben<br>• Schlag → Größe pulsiert</div><div><button class="btn sm go" onclick="addMap(null)">+ Neue Parameter-Zuordnung</button></div></div></div></div>`;
}
$('insp').addEventListener('click', ev => {
  const go = ev.target.closest('[data-go]'); if (go) return select(go.dataset.go);
  const a = ev.target.closest('[data-act]'); if (!a) return; const id = UI.sel, L = layerById(id), m = mapById(id);
  switch (a.dataset.act) {
    case 'solo': setView(UI.view === (L ? 'layer:' : 'map:') + id ? 'mix' : (L ? 'layer:' : 'map:') + id); renderInsp(); break;
    case 'resetP': L.P = {}; refresh('lit'); break;
    case 'rmfx': removeFx(id); break;
    case 'addmap': addMap(null, id); break;
    case 'dup': { const c = { ...m, id: newMapId(), name: m.name ? m.name + ' (Kopie)' : '' }; P.maps.splice(P.maps.indexOf(m) + 1, 0, c); UI.sel = c.id; refresh('lvit'); break; }
    case 'delmap': removeMap(id); break;
  }
});
function mapDefaults(m) {                 // sinnvolle Startwerte, wenn Wirkung oder Bedingung wechseln
  const w = WIRK[m.tgt];
  if (w.type === 'color') { if (m.cond === 'grad') { m.a = m.a && /^#/.test(m.a) ? m.a : '#4d8bff'; m.b = m.b && /^#/.test(m.b) ? m.b : '#ff3b3b'; } else { m.a = null; m.b = m.b && /^#/.test(m.b) ? m.b : '#ff8a1f'; } }
  else { const o = w.opts; if (m.cond === 'grad') { m.a = o[0][1]; m.b = o[o.length - 1][1]; } else { m.a = null; m.b = o[o.length - 1][1]; } }
}
$('insp').addEventListener('input', ev => {
  const el = ev.target, f = el.dataset.f; if (f !== 'lo' && f !== 'hi' && f !== 'str') return; const m = mapById(UI.sel); if (!m) return;
  setMapField(m, f, el.value); $('insp').querySelectorAll(`[data-f="${f}"]`).forEach(x => { if (x !== el) x.value = el.value; });
  $('mdesc').textContent = `${describe(m).when} → ${describe(m).then}`; touch(); drawTimelineCanvases(); drawInspGraph();
});
$('insp').addEventListener('change', ev => {
  const el = ev.target, f = el.dataset.f; if (!f) return; const L = layerById(UI.sel), m = mapById(UI.sel);
  if (L) {
    if (f === 'anim') { L.anim = el.value; L.P = {}; } else if (f === 'tint') L.tint = el.value === '1';
    else if (f === 'p') { const k = el.dataset.k; if (el.value === defOf(L.anim)[k]) delete L.P[k]; else L.P[k] = el.value; }
    refresh('lit'); return;
  }
  if (!m || f === 'lo' || f === 'hi' || f === 'str') { if (m) touch(); return; }
  setMapField(m, f, el.value);
  refresh('lvit'); renderInsp();
});
/* Signalkurve mit Schwellen im Inspektor */
const serCache = {};
function seriesFor(k, n, track) { const key = k + n + (k === 'gate' ? track : ''); return serCache[key] || (serCache[key] = Sig.series(k, n, { track })); }
function drawGraph(cv, m, shown, small) {
  sizeCv(cv); const W = cv._w, H = cv._h, dpr = cv._dpr; if (W < 10) return;
  const c = cv.getContext('2d'), d = Sig.BY[m.src], track = (layerById(m.layer) || {}).key, n = Math.max(60, Math.floor(W)), s = seriesFor(m.src, n, track);
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const y = v => H - 4 - clamp((v - d.lo) / (d.hi - d.lo), 0, 1) * (H - 8), cs = getComputedStyle(root), acc = cs.getPropertyValue('--accent').trim(), mu = cs.getPropertyValue('--muted').trim();
  const active = v => { const so = SOFT[m.soft] || SOFT.weich; if (m.cond === 'grad') return clamp((v - m.lo) / ((m.hi - m.lo) || 1), 0, 1); if (m.cond === 'ab') return v >= m.lo ? 1 : 0; if (m.cond === 'unter') return v <= m.lo ? 1 : 0; return v >= m.lo && v <= m.hi ? 1 : 0; };
  c.fillStyle = acc; for (let i = 0; i < n; i++) { const a = active(s[i]); if (a > 0) { c.globalAlpha = .16 * a; c.fillRect(i / n * W, 0, W / n + 1, H); } } c.globalAlpha = 1;
  c.strokeStyle = mu; c.lineWidth = 1.4; c.beginPath(); for (let i = 0; i < n; i++) i ? c.lineTo(i / (n - 1) * W, y(s[i])) : c.moveTo(0, y(s[i])); c.stroke();
  c.strokeStyle = acc; c.lineWidth = 1; c.setLineDash([4, 3]);
  const line = v => { c.beginPath(); c.moveTo(0, y(v)); c.lineTo(W, y(v)); c.stroke(); };
  if (!small || true) { line(m.lo); if (m.cond === 'grad' || m.cond === 'zw') line(m.hi); } c.setLineDash([]);
  c.fillStyle = mu; c.font = '10px Inter, system-ui, sans-serif'; c.fillText(d.fmt(m.lo), 4, clamp(y(m.lo) - 3, 10, H - 2)); if (m.cond === 'grad' || m.cond === 'zw') c.fillText(d.fmt(m.hi), 4, clamp(y(m.hi) - 3, 10, H - 2));
  const px = shown / DUR * W; c.fillStyle = acc; c.fillRect(px - 1, 0, 2, H);
}
function drawInspGraph(shown) {
  const cv = $('mgraph'); if (!cv) return; const m = mapById(UI.sel); if (!m) return;
  if (typeof shown !== 'number') shown = audio.currentTime || 0;
  drawGraph(cv, m, shown);
  const d = Sig.BY[m.src], v = Sig.val(m.src, shown, { track: (layerById(m.layer) || {}).key }), now = $('mnow');
  if (now) now.innerHTML = `Jetzt: <b>${esc(d.fmt(v))}</b> · Wirkung zu <b>${Math.round((lastF[m.id] || 0) * 100)} %</b>`;
}
document.addEventListener('pointerdown', ev => {                    // Klick in die Kurve setzt die Schwelle
  const cv = ev.target.closest && ev.target.closest('#mgraph'); if (!cv) return; const m = mapById(UI.sel); if (!m) return;
  const set = e => { const r = cv.getBoundingClientRect(), d = Sig.BY[m.src], v = d.lo + (1 - clamp((e.clientY - r.top - 4) / (r.height - 8), 0, 1)) * (d.hi - d.lo), q = Math.round(v / d.step) * d.step;
    const useHi = (m.cond === 'grad' || m.cond === 'zw') && (e.shiftKey || Math.abs(q - m.hi) < Math.abs(q - m.lo)); m[useHi ? 'hi' : 'lo'] = +q.toFixed(2);
    $('insp').querySelectorAll(`[data-f="${useHi ? 'hi' : 'lo'}"]`).forEach(x => x.value = m[useHi ? 'hi' : 'lo']); $('mdesc').textContent = `${describe(m).when} → ${describe(m).then}`; touch(); renderList(); drawTimelineCanvases(); drawInspGraph(); };
  cv.setPointerCapture(ev.pointerId); set(ev); const mv = e => set(e), up = () => { cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up); };
  cv.addEventListener('pointermove', mv); cv.addEventListener('pointerup', up);
});

/* ═══════════ Zeitleiste ═══════════ */
function renderTimeline() {
  const m = mapById(UI.sel), sigs = UI.tlSig ? ['loud', 'pitch', 'tension'] : []; if (m && UI.tlSig && !sigs.includes(m.src)) sigs.push(m.src);
  const rows = TRACKS.map(t => { const L = layerById('track:' + t.key), idea = L && ideaOf(L.anim);
    return `<div class="tlrow${UI.sel === 'track:' + t.key ? ' sel' : ''}${L && L.on && L.anim ? '' : ' off'}" data-id="track:${t.key}" style="--tc:${t.cssColor}"><div class="ll" title="${esc(t.name)}${idea ? ' – ' + esc(idea.title) : ''}"><i></i><b>${esc(t.name)}</b></div><div class="lc">${t.raw.map(([a, z]) => `<span class="seg" data-a="${a}" data-z="${z}" style="left:${a / DUR * 100}%;width:${(z - a) / DUR * 100}%"></span>`).join('')}</div></div>`; }).join('');
  $('tl').innerHTML = `<div class="tlbody" id="tlbody"><div class="tlrow rul"><div class="ll"><b>Takt</b></div><div class="lc"><canvas id="ruler"></canvas></div></div>${rows}`
    + sigs.map(k => `<div class="tlrow sig" data-sig="${k}"><div class="ll" title="${esc(Sig.BY[k].hint)}"><b>${esc(Sig.BY[k].n)}</b></div><div class="lc"><canvas></canvas></div></div>`).join('') + '<div id="tlph"></div></div>';
  tlEls = [...$('tl').querySelectorAll('.tlrow[data-id]')].map(el => ({ el, tr: TBY[el.dataset.id.slice(6)], segs: [...el.querySelectorAll('.seg')] }));
  requestAnimationFrame(drawTimelineCanvases);
}
let tlEls = [];
function drawTimelineCanvases() {
  const body = $('tlbody'); if (!body) return; const cs = getComputedStyle(root), mu = cs.getPropertyValue('--muted').trim(), ln = cs.getPropertyValue('--line-2').trim(), acc = cs.getPropertyValue('--accent').trim();
  const rv = $('ruler'); if (rv) {
    sizeCv(rv); const W = rv._w, H = rv._h, c = rv.getContext('2d'); c.setTransform(rv._dpr, 0, 0, rv._dpr, 0, 0); c.clearRect(0, 0, W, H);
    c.font = '10px Inter, system-ui, sans-serif'; c.fillStyle = mu; c.strokeStyle = ln; const nb = Math.floor((DUR - OFFSET) / BAR), step = W / nb > 26 ? 1 : W / nb > 13 ? 2 : 4;
    for (let b = 0; b <= nb; b++) { const x = (OFFSET + b * BAR) / DUR * W; c.beginPath(); c.moveTo(x + .5, b % step ? H * .65 : H * .35); c.lineTo(x + .5, H); c.stroke(); if (b % step === 0 && b < nb) c.fillText(String(b + 1), x + 3, 11); }
  }
  const m = mapById(UI.sel);
  $('tl').querySelectorAll('.tlrow.sig').forEach(row => {
    const k = row.dataset.sig, cv = row.querySelector('canvas'); sizeCv(cv); const W = cv._w, H = cv._h, c = cv.getContext('2d'), d = Sig.BY[k], n = Math.max(60, Math.floor(W)), s = seriesFor(k, n, ''); c.setTransform(cv._dpr, 0, 0, cv._dpr, 0, 0); c.clearRect(0, 0, W, H);
    const y = v => H - 3 - clamp((v - d.lo) / (d.hi - d.lo), 0, 1) * (H - 6), mine = m && m.src === k;
    c.fillStyle = mine ? acc : mu; c.globalAlpha = .18; c.beginPath(); c.moveTo(0, H); for (let i = 0; i < n; i++) c.lineTo(i / (n - 1) * W, y(s[i])); c.lineTo(W, H); c.fill(); c.globalAlpha = 1;
    c.strokeStyle = mine ? acc : mu; c.lineWidth = 1.3; c.beginPath(); for (let i = 0; i < n; i++) i ? c.lineTo(i / (n - 1) * W, y(s[i])) : c.moveTo(0, y(s[i])); c.stroke();
    if (mine) { c.strokeStyle = acc; c.setLineDash([4, 3]); c.lineWidth = 1; [m.lo, ...(m.cond === 'grad' || m.cond === 'zw' ? [m.hi] : [])].forEach(v => { c.beginPath(); c.moveTo(0, y(v)); c.lineTo(W, y(v)); c.stroke(); }); c.setLineDash([]);
      c.fillStyle = acc; c.globalAlpha = .22; for (let i = 0; i < n; i++) { const v = s[i], on = m.cond === 'grad' ? v >= Math.min(m.lo, m.hi) : m.cond === 'ab' ? v >= m.lo : m.cond === 'unter' ? v <= m.lo : v >= m.lo && v <= m.hi; if (on) c.fillRect(i / n * W, 0, W / n + 1, H); } c.globalAlpha = 1; }
  });
}
{ let drag = false;
  const at = ev => { const r = $('ruler').getBoundingClientRect(); return clamp((ev.clientX - r.left) / r.width, 0, 1) * DUR; };
  $('tl').addEventListener('pointerdown', ev => {
    const ll = ev.target.closest('.ll'); if (ll) { const id = ll.parentNode.dataset.id; if (id) select(id); return; }
    if (!ev.target.closest('.lc')) return; drag = true; $('tl').setPointerCapture(ev.pointerId); seek(at(ev));
  });
  $('tl').addEventListener('pointermove', ev => { if (drag) seek(at(ev)); });
  $('tl').addEventListener('pointerup', () => { drag = false; });
}
$('tlSig').onchange = () => { UI.tlSig = $('tlSig').checked; saveUI(); renderTimeline(); };

/* ═══════════ Player ═══════════ */
const PK = new Int8Array(Uint8Array.from(atob(SONG.peaks), c => c.charCodeAt(0)).buffer);
let waveCols = [], waveKey = '', WC = { base: '#888', play: '#f80' };
function buildWave() {
  const cv = $('waveCv'); sizeCv(cv); const W = cv._w, n = Math.max(20, Math.floor(W / 3)), np = PK.length >> 1; waveCols = [];
  for (let i = 0; i < n; i++) { let mx = 0; const a = Math.floor(i / n * np), z = Math.max(a + 1, Math.floor((i + 1) / n * np)); for (let j = a; j < z; j++) mx = Math.max(mx, Math.abs(PK[2 * j]), Math.abs(PK[2 * j + 1])); waveCols.push(Math.pow(mx / 127, .75)); }
}
function drawWave(shown) {
  const cv = $('waveCv'); if (!cv._w) buildWave(); const key = cv._w + 'x' + cv._h + '|' + Math.round(shown / DUR * cv._w) + root.dataset.theme; if (key === waveKey) return; waveKey = key;
  const W = cv._w, H = cv._h, c = cv.getContext('2d'), n = waveCols.length, bw = W / n; c.setTransform(cv._dpr, 0, 0, cv._dpr, 0, 0); c.clearRect(0, 0, W, H);
  const px = shown / DUR * W;
  for (let i = 0; i < n; i++) { const h = Math.max(2, waveCols[i] * (H - 8)), x = i * bw; c.fillStyle = x + bw / 2 <= px ? WC.play : WC.base; c.globalAlpha = x + bw / 2 <= px ? 1 : .55; c.fillRect(x + .5, (H - h) / 2, Math.max(1, bw - 1.5), h); }
  c.globalAlpha = 1; c.fillStyle = WC.play; c.fillRect(px - 1, 0, 2, H);
}
{ let drag = false; const w = $('wave'), at = ev => { const r = w.getBoundingClientRect(); return clamp((ev.clientX - r.left) / r.width, 0, 1) * DUR; };
  w.addEventListener('pointerdown', ev => { drag = true; w.setPointerCapture(ev.pointerId); seek(at(ev)); });
  w.addEventListener('pointermove', ev => { if (drag) seek(at(ev)); }); w.addEventListener('pointerup', () => { drag = false; });
  w.addEventListener('keydown', ev => { const d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0; if (d) { ev.preventDefault(); seek(nowT() + d * (ev.shiftKey ? 5 : 1)); } }); }
$('play').onclick = togglePlay; $('toStart').onclick = () => seek(0);
$('stop').onclick = () => { audio.pause(); seek(0); };
$('loop').onclick = () => { audio.loop = !audio.loop; $('loop').classList.toggle('on', audio.loop); lsSet('av-studio-loop', audio.loop); };
audio.loop = !!lsGet('av-studio-loop', false); $('loop').classList.toggle('on', audio.loop);
const setPlayUi = () => { const p = !audio.paused; $('playIco').innerHTML = p ? '<rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/>' : '<path d="M8 5.5v13l11-6.5z"/>'; $('play').setAttribute('aria-label', p ? 'Pause' : 'Abspielen'); $('disc').classList.toggle('spin', p); };
audio.addEventListener('play', setPlayUi); audio.addEventListener('pause', () => { setPlayUi(); resync(audio.currentTime); }); audio.addEventListener('ended', () => { setPlayUi(); resync(0); });
{ const r = $('rate'); let v = lsGet('av-rate-s', 1); if (typeof v !== 'number') v = 1; r.value = String(v); if (r.value !== String(v)) r.value = '1';
  const apply = () => { audio.preservesPitch = true; audio.playbackRate = +r.value; r.classList.toggle('on', r.value !== '1'); }; apply(); audio.addEventListener('loadedmetadata', apply);
  r.onchange = () => { resync(nowT()); apply(); lsSet('av-rate-s', +r.value); }; }
{ const v = $('vol'), mu = $('mute'); v.value = lsGet('av-studio-vol', .9); audio.volume = +v.value;
  const ic = () => $('muteWave').style.display = audio.muted || +v.value === 0 ? 'none' : '';
  v.oninput = () => { audio.volume = +v.value; audio.muted = false; lsSet('av-studio-vol', +v.value); ic(); }; mu.onclick = () => { audio.muted = !audio.muted; ic(); }; ic(); }
function updatePlayer(shown) {
  const tc = fmtT(shown); if ($('tCur').textContent !== tc) $('tCur').textContent = tc;
  const k = Math.floor((shown - OFFSET) / BEAT), bar = Math.floor(k / SONG.beats) + 1, beat = ((k % SONG.beats) + SONG.beats) % SONG.beats + 1, tx = shown < OFFSET ? 'Auftakt' : `Takt ${bar} · Schlag ${beat}`;
  if ($('bn').textContent !== tx) $('bn').textContent = tx; drawWave(shown);
}

/* ═══════════ Live-Anzeigen (Liste, Zeitleiste, Messwerte) ═══════════ */
let meterKey = '';
function updateLive(shown) {
  for (const t of TRACKS) { const on = isOn(t, shown), r = rowEls['track:' + t.key]; if (r) r.classList.toggle('live', on); }
  for (const e of tlEls) { const on = isOn(e.tr, shown); e.el.classList.toggle('live', on); e.segs.forEach(s => s.classList.toggle('hit', shown >= +s.dataset.a && shown < +s.dataset.z)); }
  const b = $('tlbody'); if (b) b.style.setProperty('--p', (shown / DUR).toFixed(5));
  const dl = Sig.val('loud', shown), dp = Sig.val('pitch', shown), bt = Sig.val('beat', shown);
  const act = P.maps.filter(m => m.on && (lastF[m.id] || 0) > .05 && lastF[m.id + '#'] > frN0 - 3);
  const key = Math.round(dl * 2) + '|' + Math.round(dp) + '|' + Math.round(bt / 12) + '|' + act.map(m => m.id).join();
  if (key !== meterKey) { meterKey = key;
    $('meters').innerHTML = `<span class="m">Lautstärke <b>${esc(Sig.BY.loud.fmt(dl))}</b><span class="bar"><i style="width:${clamp((dl + 30) / 27, 0, 1) * 100}%"></i></span></span><span class="m">Tonhöhe <b>${Math.round(dp)} %</b><span class="bar"><i style="width:${dp}%"></i></span></span><span class="m">Schlag <span class="bar"><i style="width:${bt}%"></i></span></span>`
      + (act.length ? act.map(m => `<span class="chipa" title="${esc(describe(m).then)}">${esc(mapTitle(m))}</span>`).join('') : '<span>keine Zuordnung aktiv</span>'); }
}
let frN0 = 0;

/* ═══════════ Menüs ═══════════ */
let openEl = null;
function closeMenu() { if (openEl) { openEl.remove(); openEl = null; document.querySelectorAll('.mb.open').forEach(b => b.classList.remove('open')); } }
function openMenu(anchor, items) {
  const was = openEl && openEl._a === anchor; closeMenu(); if (was) return;
  const m = document.createElement('div'); m.className = 'menu'; m._a = anchor;
  m.innerHTML = items.map((it, i) => it.hr ? '<hr>' : it.h ? `<div class="mh">${esc(it.h)}</div>` : it.href ? `<a href="${it.href}"><span class="ck"></span>${esc(it.t)}</a>` : `<button data-i="${i}"><span class="ck">${it.ck ? '✓' : ''}</span>${esc(it.t)}${it.k ? `<span class="k">${esc(it.k)}</span>` : ''}</button>`).join('');
  document.body.appendChild(m); const r = anchor.getBoundingClientRect(); m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 8) + 'px'; m.style.top = Math.min(r.bottom + 4, Math.max(8, innerHeight - m.offsetHeight - 8)) + 'px';
  m.style.maxHeight = (innerHeight - 20) + 'px'; m.style.overflow = 'auto';
  m.onclick = ev => { const b = ev.target.closest('button[data-i]'); if (b) { closeMenu(); items[+b.dataset.i].f(); } };
  openEl = m; anchor.classList && anchor.classList.add('open');
}
document.addEventListener('pointerdown', ev => { if (openEl && !ev.target.closest('.menu') && !ev.target.closest('.mb') && ev.target !== openEl._a && !openEl._a.contains(ev.target)) closeMenu(); }, true);
const togHide = k => { UI.hide[k] = !UI.hide[k]; saveUI(); applyLayout(); requestAnimationFrame(resizeAll); };
const toggleTheme = () => { const n = root.dataset.theme === 'dark' ? 'light' : 'dark'; root.dataset.theme = n; try { localStorage.setItem('av-theme', n); } catch (e) {} readColors(); readWaveColors(); waveKey = ''; drawTimelineCanvases(); };
function readWaveColors() { const cs = getComputedStyle(root); WC = { base: cs.getPropertyValue('--faint').trim(), play: cs.getPropertyValue('--accent').trim() }; }
const MENUS = {
  datei: () => [{ t: 'Projekt speichern', k: '⌘S / Strg+S', f: saveProject }, { t: 'Projekt aus Datei laden …', f: loadFromFile }, { hr: 1 },
    { t: 'Beschreibung als PDF (Seite öffnen, dann Drucken)', href: 'bericht.html' }, { t: 'Alle zugeordneten Animationen als MP4 laden', f: () => expRun(expProjectSpecs()) }, { hr: 1 },
    { t: 'Alle Zuordnungen als Text kopieren', f: async () => { try { await navigator.clipboard.writeText(textSummary()); toast('Zuordnungen kopiert'); } catch (e) { prompt('Zum Kopieren:', textSummary()); } } }, { hr: 1 },
    { t: 'Änderungen verwerfen (zurück zum Stand in projekt.json)', f: async () => { if (!confirm('Alle ungespeicherten Änderungen verwerfen?')) return; try { localStorage.removeItem(LS_P); } catch (e) {} await loadProject(); UI.sel = null; uiAll(); toast('Zurückgesetzt'); } }],
  ansicht: () => [{ h: 'Bereich' }, { t: 'Studio', ck: UI.ws === 'studio', f: () => setWs('studio') }, { t: 'Labor', ck: UI.ws === 'labor', f: () => setWs('labor') }, { hr: 1 }, { h: 'Fenster ein- / ausblenden' },
    { t: 'Vorschau', ck: !UI.hide.preview, f: () => togHide('preview') }, { t: 'Zuordnungen', ck: !UI.hide.list, f: () => togHide('list') }, { t: 'Bearbeiten', ck: !UI.hide.insp, f: () => togHide('insp') }, { t: 'Zeitleiste', ck: !UI.hide.timeline, f: () => togHide('timeline') }, { hr: 1 },
    { t: 'Layout zurücksetzen', f: () => { UI.hide = {}; UI.lay = defLay(); saveUI(); applyLayout(); requestAnimationFrame(resizeAll); } }, { t: 'Hell / Dunkel', f: toggleTheme }],
  gehe: () => [{ t: 'Hauptmenü mit allen Seiten', href: 'index.html' }, { h: 'Einzelne alte Seiten' },
    { t: 'Animations-Zuordnung', href: 'seiten/animationen/zuordnung.html' }, { t: 'Tonspuren zusammengeführt (Video)', href: 'seiten/video/video.html' }, { t: 'Labor (alt)', href: 'seiten/animationen/labor.html' },
    { t: 'Animationsideen', href: 'seiten/animationen/animationen.html' }, { t: 'Morphologischer Kasten – Klangparameter', href: 'seiten/morphologischer-kasten/parameter.html' }, { t: 'Klanghierarchie', href: 'seiten/hierarchie/hierarchie.html' }, { t: 'Tonspuren (Zeitleiste)', href: 'seiten/tonspuren/original.html' }],
  hilfe: () => [{ t: 'Kurzanleitung & Tastenkürzel', f: showHelp }],
};
document.querySelectorAll('.mb').forEach(b => b.onclick = () => openMenu(b, MENUS[b.dataset.menu]()));
function showHelp() {
  const d = document.createElement('div'); d.className = 'help'; d.innerHTML = `<div class="card"><h3>Studio – Kurzanleitung</h3>
    <h4>Aufbau</h4><p>Alles liegt auf einer Seite. Die <b>Trennlinien</b> zwischen den Fenstern lassen sich ziehen; unter <b>Ansicht</b> kann man Fenster aus- und einblenden.</p>
    <ul><li><b>Vorschau</b> (oben links): zeigt das Video – alles zusammen, eine einzelne Ebene, eine einzelne Zuordnung oder alle Ebenen nebeneinander zum Vergleichen.</li>
    <li><b>Zuordnungen</b> (Mitte): ein zentraler Ort für <i>Tonspur → Animation</i>, Effekte und <i>Parameter-Zuordnungen</i>. Auge = ein/aus, S = nur diese ansehen.</li>
    <li><b>Bearbeiten</b> (rechts): Einstellungen der Auswahl – ohne dass die Vorschau verschwindet.</li>
    <li><b>Zeitleiste</b> (unten): wann welche Tonspur klingt, dazu Kurven für Lautstärke, Tonhöhe usw. Klick = springen.</li></ul>
    <h4>Parameter-Zuordnung</h4><p>Auslöser → Wirkung, z. B. <i>Lautstärke ab −9 dB → Farbe Orange</i> oder <i>Tonhöhe stufenlos → Position unten … oben</i>. In der Kurve im Inspektor kann man die Schwelle direkt anklicken. Gemessen wird der fertige Mix – einzelne Tonspuren liegen nicht getrennt vor.</p>
    <h4>Tasten</h4><p><kbd>Leertaste</kbd> Play/Pause · <kbd>Pos1</kbd> zum Anfang · <kbd>F</kbd> Vollbild · <kbd>←</kbd> <kbd>→</kbd> ±1 s (mit <kbd>Shift</kbd> ±5 s) · <kbd>Strg/⌘ S</kbd> Speichern</p>
    <p style="margin-top:12px"><button class="btn go" id="hx">Schließen</button></p></div>`;
  document.body.appendChild(d); d.onclick = ev => { if (ev.target === d || ev.target.id === 'hx') d.remove(); };
}
const isTyping = el => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'range';
window.addEventListener('keydown', ev => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); saveProject(); return; }
  const tg = ev.composedPath()[0] || ev.target;           // auch Eingabefelder in der Hülle des Animations-Editors erkennen
  if (isTyping(tg) || ev.ctrlKey || ev.metaKey || ev.altKey || tg.id === 'wave' || (ev.composedPath().includes($('ws-anim')) && /^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY)$/.test(tg.tagName))) return;
  if ((ev.code === 'Space' || ev.key === ' ') && ev.target.tagName !== 'BUTTON') { ev.preventDefault(); if (!ev.repeat) togglePlay(); }
  else if (ev.key === 'Home') { ev.preventDefault(); seek(0); }
  else if (ev.key === 'f' || ev.key === 'F') { const st = $('stage'); if (document.fullscreenElement) document.exitFullscreen(); else if (st.requestFullscreen && UI.ws === 'studio' && UI.view !== 'grid') st.requestFullscreen(); }
  else if (ev.key === 'ArrowRight' && ev.target.tagName !== 'BUTTON') seek(nowT() + (ev.shiftKey ? 5 : 1));
  else if (ev.key === 'ArrowLeft' && ev.target.tagName !== 'BUTTON') seek(nowT() - (ev.shiftKey ? 5 : 1));
  else if (ev.key === 'Escape') closeMenu();
}, true);
