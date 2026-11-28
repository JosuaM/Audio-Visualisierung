'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Labor: alle Animationen, alle Effekte und alle Parameter-Zuordnungen auf einen Blick.
   An jeder Karte steht, wo sie im Projekt gerade zugeordnet ist.
   ═══════════════════════════════════════════════════════════════════════════ */
let labCards = [];
const labIO = new IntersectionObserver(es => es.forEach(e => { e.target._vis = e.isIntersecting; }), { root: $('lgrid'), rootMargin: '120px' });
new ResizeObserver(() => labCards.forEach(c => sizeCv(c.cv))).observe($('lgrid'));
const pill = (name, color, extra = '') => `<span style="--tc:${color}"><i></i>${esc(name)}${extra}</span>`;
const mapCount = id => P.maps.filter(m => m.layer === id).length;
const presetMap = p => { const d = Sig.BY[p.m.src]; return { id: 'preset:' + p.id, name: '', layer: '*', on: true, hi: d.dhi, ...p.m }; };
const presetCtl = m => (WIRK[m.tgt].type === 'color' ? `<div class="crow"><span>Farbe</span>${m.cond === 'grad' ? valSelHtml(m, 'a') + '→' : ''}${valSelHtml(m, 'b')}</div>` : '')
  + `<div class="crow"><span>Stärke</span><input type="range" data-f="str" min="0" max="100" value="${Math.round((m.str == null ? 1 : m.str) * 100)}"><span class="pct" style="width:32px;text-align:right">${Math.round((m.str == null ? 1 : m.str) * 100)} %</span></div>`;
const trackSelect = (cls, first) => `<select data-a="${cls}"><option value="">${first}</option>${TRACKS.map(t => `<option value="${t.key}">${esc(t.name)}</option>`).join('')}</select>`;

function renderLabor() {
  const lf = UI.lf, lt = UI.lt; labCards = [];
  $('lfilter').innerHTML = [['alle', 'Alles'], ['anim', 'Animationen der Tonspuren'], ['fx', 'Effekte'], ['map', 'Parameter-Zuordnungen']].map(([k, n]) => `<button class="fchip${lf === k ? ' on' : ''}" data-lf="${k}">${n}</button>`).join('')
    + `<span style="flex:1"></span><label class="chk" title="Die Animation ist im Video nur dort zu sehen, wo ihre Tonspur im Song klingt (wie im Studio). Aus = durchgehend sichtbar."><input type="checkbox" id="mp4gate"${UI.mp4gate !== false ? ' checked' : ''}> MP4 nur wo Spur klingt</label>`
    + `<select id="mp4res" aria-label="Auflösung der MP4-Videos" title="Auflösung der MP4-Videos"><option value="1080"${UI.mp4res !== '720' ? ' selected' : ''}>MP4 1920×1080</option><option value="720"${UI.mp4res === '720' ? ' selected' : ''}>MP4 1280×720</option></select>`
    + `<button class="btn sm" id="mp4all" title="Je ein MP4 für jede Tonspur-Animation und jeden Effekt, die gerade im Studio zugeordnet sind">Alle zugeordneten als MP4</button>`
    + `<span class="lb">Tonspur</span><select id="ltrk" aria-label="Nur Animationen dieser Tonspur"><option value="">Alle Spuren</option>${TRACKS.map(t => `<option value="${t.key}"${lt === t.key ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>`;
  let h = '', ci = 0; const add = c => { labCards.push(c); return ci++; };
  if (lf === 'alle' || lf === 'anim') {
    for (const t of TRACKS) {
      if ((lt && lt !== t.key) || !(IDEAS[t.key] || []).length) continue;
      const L = layerById('track:' + t.key);
      h += `<section class="lsec"><h3>${esc(t.name)} – Animationen</h3><p>${IDEAS[t.key].length} Ideen · aktuell im Studio: <b>${L && L.anim ? esc((ideaOf(L.anim) || {}).title || '–') : 'keine'}</b></p><div class="lcards">`;
      IDEAS[t.key].forEach((d, i) => {
        const id = t.key + ':' + i, used = P.layers.filter(l => l.kind === 'track' && l.anim === id), n = add({ kind: 'anim', id, tr: t });
        h += `<article class="lc2" data-ci="${n}"><div class="cv"><canvas></canvas>${d.tag ? `<span class="tg2">${esc(d.tag)}</span>` : ''}</div><div class="cp"><h4>${i + 1} · ${esc(d.title)}</h4><p class="clamp">${esc(d.text || '')}</p>`
          + `<div class="zu">${used.length ? used.map(l => pill(layerName(l), colorOf(l), (Object.keys(l.P).length ? ' · angepasst' : '') + (mapCount(l.id) ? ` · ${mapCount(l.id)} Parameter` : ''))).join('') : '<span class="none">nicht zugeordnet</span>'}</div>`
          + `<div class="acts">${trackSelect('assign', 'Zuordnen zu Tonspur …')}<button class="btn sm" data-a="open" title="Im Studio bearbeiten">Im Studio öffnen</button><button class="btn sm" data-a="mp4" title="Als MP4 über die ganze Songlänge herunterladen">MP4 laden</button></div></div></article>`;
      });
      h += '</div></section>';
    }
  }
  if (lf === 'alle' || lf === 'fx') {
    for (const g of (window.LABOR_GROUPS || [])) {
      h += `<section class="lsec"><h3>Effekt · ${esc(g.g)}</h3><p>${esc(g.t)}</p><div class="lcards">`;
      for (const f of g.fx) {
        const id = 'fx:' + f.nr, on = layerById(id), n = add({ kind: 'fx', f, id });
        h += `<article class="lc2" data-ci="${n}"><div class="cv"><canvas></canvas><span class="tg2">${esc(f.tag || '')}</span></div><div class="cp"><h4>${esc(f.title)} <small>L${f.nr}</small></h4><p class="clamp">${esc(f.text || '')}</p>`
          + `<div class="zu">${on ? pill('Ebene im Studio', 'var(--accent)', on.on ? '' : ' · aus') + (mapCount(id) ? pill(mapCount(id) + ' Parameter-Zuordnung', 'var(--accent)') : '') : '<span class="none">nicht im Studio</span>'}</div>`
          + `<div class="acts"><button class="btn sm${on ? ' on' : ''}" data-a="fx">${on ? 'Als Ebene entfernen' : '+ Als Ebene hinzufügen'}</button><button class="btn sm" data-a="mp4" title="Als MP4 über die ganze Songlänge herunterladen">MP4 laden</button></div></div></article>`;
      }
      h += '</div></section>';
    }
  }
  if (lf === 'alle' || lf === 'map') {                // eine Reihe pro Auslöser: Lautstärke, Tonhöhe, Schlag … – Vorlagen und eigene Zuordnungen nebeneinander
    const presetCard = p => {
      const m = presetMap(p), dd = describe(m), same = P.maps.filter(x => x.src === m.src && x.tgt === m.tgt), n = add({ kind: 'map', m, preset: p });
      return `<article class="lc2" data-ci="${n}"><div class="cv"><canvas></canvas><span class="tg2">Vorlage</span></div><div class="cp"><h4>${esc(p.n)}</h4><p class="when"><b>${esc(dd.when)}</b><br>→ ${esc(dd.then)}</p>`
        + `<div class="ctl" data-ctl>${presetCtl(m)}</div>`
        + `<div class="zu">${same.length ? same.map(x => pill('im Projekt: ' + layerLabel(x.layer), x.layer === '*' ? 'var(--accent)' : colorOf(layerById(x.layer) || { kind: 'x' }), x.on ? '' : ' · aus')).join('') : '<span class="none">nicht verwendet</span>'}</div>`
        + `<div class="acts"><button class="btn sm go" data-a="use">In Studio übernehmen</button></div></div></article>`;
    };
    const ownCard = m => {
      const dd = describe(m), n = add({ kind: 'map', m });
      return `<article class="lc2 own" data-ci="${n}"><div class="cv"><canvas></canvas><span class="tg2">Deine</span></div><div class="cp"><h4>${esc(mapTitle(m))}</h4><p class="when"><b>${esc(dd.when)}</b><br>→ ${esc(dd.then)}</p>`
        + `<div class="zu">${pill(layerLabel(m.layer), m.layer === '*' ? 'var(--accent)' : colorOf(layerById(m.layer) || { kind: 'x' }), m.on ? '' : ' · aus')}</div><div class="acts"><button class="btn sm" data-a="edit">Im Studio bearbeiten</button></div></div></article>`;
    };
    h += `<p class="lhint">Parameter-Zuordnungen: Auslöser → Wirkung. Pro Auslöser eine Reihe – die Vorschau läuft die Messwerte des Songs im Zeitraffer durch (oder folgt dem Player). „In Studio übernehmen“ legt die Vorlage als eigene Zuordnung im Projekt an.</p>`;
    for (const d of Sig.DEF) {
      const own = P.maps.filter(m => m.src === d.k), pre = PRESETS.filter(p => p.m.src === d.k); if (!own.length && !pre.length) continue;
      h += `<section class="lsec"><h3>Auslöser · ${esc(d.n)}</h3><p>${pre.length} Vorlage${pre.length === 1 ? '' : 'n'}${own.length ? ` · ${own.length} im Projekt` : ''}</p><div class="lcards">${own.map(ownCard).join('')}${pre.map(presetCard).join('')}</div></section>`;
    }
  }
  $('lgrid').innerHTML = `<div class="lgrid">${h || '<div class="empty">Nichts gefunden.</div>'}</div>`;
  const els = [...$('lgrid').querySelectorAll('.lc2')];
  els.forEach(el => { const c = labCards[+el.dataset.ci]; c.el = el; c.cv = el.querySelector('canvas'); c.cv._vis = false; labIO.observe(c.cv); });
  requestAnimationFrame(() => labCards.forEach(c => sizeCv(c.cv)));
}
$('lfilter').addEventListener('click', ev => { const b = ev.target.closest('[data-lf]'); if (b) { UI.lf = b.dataset.lf; saveUI(); renderLabor(); } });
$('lfilter').addEventListener('change', ev => {
  if (ev.target.id === 'ltrk') { UI.lt = ev.target.value; saveUI(); renderLabor(); }
  else if (ev.target.id === 'mp4gate') { UI.mp4gate = ev.target.checked; saveUI(); }
  else if (ev.target.id === 'mp4res') { UI.mp4res = ev.target.value; saveUI(); }
});
$('lfilter').addEventListener('click', ev => { if (ev.target.closest('#mp4all')) expRun(expProjectSpecs()); });
function labCtl(ev, redraw) {                       // Farbe / Stärke einer Vorlage direkt auf der Karte einstellen
  const el = ev.target, f = el.dataset.f; if (!f) return false; const card = el.closest('.lc2'); if (!card) return false; const c = labCards[+card.dataset.ci]; if (!c || !c.preset) return false;
  setMapField(c.m, f, el.value); const dd = describe(c.m); card.querySelector('.when').innerHTML = `<b>${esc(dd.when)}</b><br>→ ${esc(dd.then)}`;
  if (f === 'str') card.querySelector('.pct').textContent = Math.round(c.m.str * 100) + ' %'; else if (redraw) card.querySelector('[data-ctl]').innerHTML = presetCtl(c.m);
  return true;
}
$('lgrid').addEventListener('input', ev => labCtl(ev, false));
$('lgrid').addEventListener('change', ev => {
  if (labCtl(ev, true)) return;
  const s = ev.target; if (s.dataset.a !== 'assign' || !s.value) return; const c = labCards[+s.closest('.lc2').dataset.ci], L = layerById('track:' + s.value);
  L.anim = c.id; L.P = {}; UI.sel = L.id; refresh('lvit'); toast(`„${ideaOf(c.id).title}“ ist jetzt der Tonspur ${TBY[s.value].name} zugeordnet`);
});
$('lgrid').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-a]'); if (!b) return; const c = labCards[+b.closest('.lc2').dataset.ci];
  if (b.dataset.a === 'mp4') expRun([c.kind === 'fx' ? expSpecFx(c.f) : expSpecAnim(c.id)]);
  else if (b.dataset.a === 'fx') toggleFx(c.f.nr);
  else if (b.dataset.a === 'use') { addMap(c.preset.id, undefined, { a: c.m.a, b: c.m.b, str: c.m.str }); toast('Zuordnung im Studio angelegt – dort kannst du sie einstellen'); }
  else if (b.dataset.a === 'edit') { setWs('studio'); select(c.m.id); }
  else if (b.dataset.a === 'open') { const L = P.layers.find(l => l.kind === 'track' && l.anim === c.id) || layerById('track:' + c.tr.key); if (L.anim !== c.id) { L.anim = c.id; L.P = {}; refresh('lvit'); } setWs('studio'); select(L.id); }
});

const labT = () => audio.paused ? free.t + (performance.now() - free.perf) / 1000 : nowT();
function laborFrame(dt) {
  const t = labT(), tt = t - OFFSET, playing = !audio.paused, scan = (performance.now() / 1000 * 3) % DUR, shown = playing ? t : scan;
  const env = { t, shown, dt, fr: frN0, gate: false }; window.IDEEN_GATE = false;
  for (const c of labCards) {
    if (!c.cv._vis || !c.cv._w) continue; const cv = c.cv, W = cv._w, H = cv._h, dpr = cv._dpr, ctx = cv.getContext('2d');
    if (c.kind === 'map') {
      const m = c.m, L = { id: m.layer === '*' ? 'demo' : m.layer, kind: 'demo', demoTrack: m.layer.startsWith('track:') ? m.layer.slice(6) : null };
      drawStage(cv, [L], { ...env, maps: [m] }, () => true);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); const d = Sig.BY[m.src], v = Sig.val(m.src, shown, { track: L.demoTrack });
      ctx.font = '600 10.5px Inter, system-ui, sans-serif'; ctx.fillStyle = COL.fg; ctx.globalAlpha = .75; ctx.fillText(`${d.n}: ${d.fmt(v)}`, 8, H - 8); ctx.globalAlpha = 1;
      continue;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); ctx.save();
    try {
      if (c.kind === 'anim') drawAnim(ctx, { t: tt, kt: shown, bar: BAR, beat: BEAT, phase: ((tt / BAR) % 1 + 1) % 1, w: W, h: H, col: c.tr.col, fg: COL.fg, bg: COL.bg }, { anim: c.id, P: {} });
      else { ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); c.f.draw(ctx, { t: tt, bar: BAR, beat: BEAT, w: W, h: H, fg: COL.fg, bg: COL.bg }); }
    } catch (e) { console.error(e); }
    ctx.restore();
  }
}
