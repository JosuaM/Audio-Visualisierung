'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Animationen (dritter Bereich links): drei Ansichten auf einem Bildschirm
     • Editor            – eine Animation groß, daneben Regler für alles (seiten/animationen/editor-*.js)
     • Alle Animationen  – alle Fenster gleichzeitig, passend auf den Bildschirm
     • Zuordnung         – pro Tonspur die zugeordnete Animation live, hier umstellbar
   ═══════════════════════════════════════════════════════════════════════════ */
let edHost = null, allTiles = [], zuTiles = [];
const AVIEWS = [['edit', 'Editor'], ['zu', 'Zuordnung'], ['all', 'Alle Animationen']];
if (!AVIEWS.some(v => v[0] === UI.av)) UI.av = 'edit';
if (UI.zm !== 'alle') UI.zm = 'spur';
const ideasOf = k => IDEAS[k] || [];
const aTracks = () => TRACKS.filter(t => ideasOf(t.key).length);
if (!UI.at || !TBY[UI.at]) UI.at = 'flute';
UI.ai = +UI.ai || 0;
const assignedIn = k => { const L = layerById('track:' + k); return L && L.anim ? L.anim : ''; };
const assignTo = id => { const k = id.split(':')[0], L = layerById('track:' + k); if (!L || L.anim === id) return; L.anim = id; L.P = {}; refresh('lvit'); toast(`„${ideaOf(id).title}“ ist jetzt der Tonspur ${TBY[k].name} zugeordnet`); };

function renderAnim() {
  AVIEWS.forEach(([k]) => { const el = $('av-' + k); el.classList.toggle('on', UI.av === k); if (UI.av !== k && k !== 'edit') el.innerHTML = ''; });
  $('avsw').innerHTML = AVIEWS.map(([k, n]) => `<button type="button" data-v="${k}" class="${UI.av === k ? 'on' : ''}">${n}</button>`).join('');
  const showPills = UI.av !== 'zu' || UI.zm === 'spur';
  const pills = !showPills ? [] : (UI.av === 'all' ? [['', 'Alle Spuren']] : []).concat(aTracks().map(t => [t.key, t.name]));
  $('atrk').innerHTML = (UI.av === 'zu' ? `<div class="avsw zm" id="zmsw" role="group" aria-label="Zuordnung für"><button type="button" data-z="spur" class="${UI.zm === 'spur' ? 'on' : ''}">Spur</button><button type="button" data-z="alle" class="${UI.zm === 'alle' ? 'on' : ''}">Alle</button></div>` : '')
    + pills.map(([k, n]) => { const t = TBY[k]; return `<button type="button" class="atp${(UI.av === 'all' ? (UI.af || '') : UI.at) === k ? ' on' : ''}" data-k="${k}" style="--tc:${t ? t.cssColor : 'var(--ink)'}">${t ? '<i></i>' : ''}${esc(n)}</button>`; }).join('');
  if (UI.av === 'edit') buildEdit(); else if (UI.av === 'all') buildAll($('av-all'), UI.af || '', false); else if (UI.zm === 'spur') buildAll($('av-zu'), UI.at, true); else buildZu();
}

/* ---------- Editor ---------- */
function updateAssign() {
  const id = UI.at + ':' + UI.ai, mine = assignedIn(UI.at) === id, has = !!ideasOf(UI.at)[UI.ai];
  edHost.assign.innerHTML = has ? `<button type="button" class="btn go" data-a="assign" ${mine ? 'disabled' : ''} title="${mine ? 'Diese Animation läuft im Studio bereits auf dieser Tonspur' : 'Diese Animation im Studio der Tonspur ' + esc(TBY[UI.at].name) + ' zuweisen'}">${mine ? '✓ ' : ''}Zuweisen</button>` : '';
}
function buildEdit() {
  if (!edHost) {
    edHost = Editor.mount($('av-edit'));
    edHost.chips.addEventListener('click', ev => { const b = ev.target.closest('.ed-chip'); if (b) { UI.ai = +b.dataset.i; saveUI(); buildEdit(); } });
    edHost.assign.addEventListener('click', ev => { if (ev.target.closest('[data-a="assign"]')) { assignTo(UI.at + ':' + UI.ai); updateAssign(); } });
  }
  const ideas = ideasOf(UI.at); UI.ai = clamp(UI.ai, 0, Math.max(0, ideas.length - 1)); saveUI();
  const it = ideas[UI.ai];
  edHost.chips.innerHTML = ideas.map((x, i) => `<button type="button" class="ed-chip" data-i="${i}" aria-pressed="${i === UI.ai}" title="${esc(x.title)}"><span class="n">${i + 1}</span><span class="t">${esc(x.title)}</span></button>`).join('');
  const act = edHost.chips.querySelector('[aria-pressed="true"]'); if (act) edHost.chips.scrollLeft = act.offsetLeft - edHost.chips.clientWidth / 2 + act.offsetWidth / 2;
  updateAssign();
  Editor.load(UI.at + ':' + (it ? it.title : '-'), it || { title: '-', draw() {} });
}

/* ---------- Fenster-Raster: „Alle Animationen“ und Zuordnung „Spur“ ---------- */
let gridBox = null, gridAssign = false;
function buildAll(box, filter, withAssign) {
  allTiles = []; gridBox = box; gridAssign = withAssign; let h = '';
  for (const t of aTracks()) {
    if (filter && filter !== t.key) continue;
    const asg = assignedIn(t.key);
    ideasOf(t.key).forEach((d, i) => {
      const id = t.key + ':' + i, mine = asg === id; allTiles.push({ id, tr: t, i });
      h += `<div class="at${withAssign ? ' wa' : ''}${mine ? ' mine' : ''}" data-n="${allTiles.length - 1}" style="--tc:${t.cssColor}" title="${esc(t.name + ' · ' + d.title)} – Klick öffnet im Editor"><div class="cv"><canvas></canvas></div><div class="cap2"><i></i><span>${i + 1} · ${esc(d.title)}</span>${!withAssign && mine ? '<em title="Aktuell dieser Tonspur zugeordnet">●</em>' : ''}</div>`
        + (withAssign ? `<div class="zb"><button type="button" class="btn sm${mine ? '' : ' go'}" data-a="assign" ${mine ? 'disabled' : ''}>${mine ? '✓ ' : ''}Zuweisen</button></div>` : '') + '</div>';
    });
  }
  box.innerHTML = `<div class="agrid" id="agrid">${h}</div>`;
  allTiles.forEach((t, n) => { t.cv = $('agrid').children[n].querySelector('canvas'); });
  requestAnimationFrame(layoutAll);
}
function layoutAll() {          // so viele Spalten, dass alle Fenster ohne Scrollen auf den Bildschirm passen
  const box = gridBox, g = $('agrid'); if (!g || !box || !box.clientWidth) return;
  const N = allTiles.length, W = box.clientWidth, H = box.clientHeight, gap = 6, cap = gridAssign ? 50 : 20; let best = 0, bw = 0;
  for (let c = 1; c <= N; c++) { const w = (W - gap * (c - 1)) / c, rows = Math.ceil(N / c); if (rows * (w * .75 + cap) + gap * (rows - 1) <= H && w > bw) { bw = w; best = c; } }
  if (!best) best = Math.max(1, Math.floor((W + gap) / (120 + gap)));
  g.style.gridTemplateColumns = `repeat(${best}, minmax(0, 1fr))`;
  requestAnimationFrame(() => allTiles.forEach(t => sizeCv(t.cv)));
}
new ResizeObserver(() => { if (UI.ws === 'anim' && (UI.av === 'all' || (UI.av === 'zu' && UI.zm === 'spur'))) layoutAll(); }).observe($('av-all'));
new ResizeObserver(() => { if (UI.ws === 'anim' && UI.av === 'zu' && UI.zm === 'spur') layoutAll(); }).observe($('av-zu'));

/* ---------- Zuordnung „Alle“: eine Kachel pro Tonspur ---------- */
function buildZu() {
  zuTiles = []; let h = '';
  for (const t of aTracks()) {
    const asg = assignedIn(t.key); zuTiles.push({ tr: t });
    h += `<div class="zt" data-k="${t.key}" style="--tc:${t.cssColor}"><div class="zh"><i></i><b>${esc(t.name)}</b><span class="zs"></span></div><div class="cv" title="Klick öffnet im Editor"><canvas></canvas></div>`
      + `<div class="zf"><select data-k="${t.key}" aria-label="Animation für ${esc(t.name)}"><option value="">– keine Animation –</option>${ideasOf(t.key).map((d, i) => `<option value="${t.key}:${i}"${asg === t.key + ':' + i ? ' selected' : ''}>${i + 1} · ${esc(d.title)}</option>`).join('')}</select></div></div>`;
  }
  $('av-zu').innerHTML = `<div class="zg">${h}</div>`;
  [...$('av-zu').querySelectorAll('.zt')].forEach((el, n) => { zuTiles[n].el = el; zuTiles[n].cv = el.querySelector('canvas'); zuTiles[n].st = el.querySelector('.zs'); });
  requestAnimationFrame(() => zuTiles.forEach(t => sizeCv(t.cv)));
}
new ResizeObserver(() => { if (UI.ws === 'anim' && UI.av === 'zu' && UI.zm === 'alle') zuTiles.forEach(t => sizeCv(t.cv)); }).observe($('av-zu'));

/* ---------- Bedienung ---------- */
$('avsw').addEventListener('click', ev => { const b = ev.target.closest('button[data-v]'); if (b && b.dataset.v !== UI.av) { UI.av = b.dataset.v; saveUI(); renderAnim(); } });
$('atrk').addEventListener('click', ev => {
  const z = ev.target.closest('button[data-z]'); if (z) { UI.zm = z.dataset.z; saveUI(); renderAnim(); return; }
  const b = ev.target.closest('.atp'); if (!b) return; if (UI.av === 'all') UI.af = b.dataset.k; else { UI.at = b.dataset.k; UI.ai = 0; } saveUI(); renderAnim();
});
const openTile = el => { const t = allTiles[+el.dataset.n]; UI.at = t.tr.key; UI.ai = t.i; UI.av = 'edit'; saveUI(); renderAnim(); };
$('av-all').addEventListener('click', ev => { const el = ev.target.closest('.at'); if (el) openTile(el); });
$('av-zu').addEventListener('click', ev => {
  const as = ev.target.closest('[data-a="assign"]'); if (as) { assignTo(allTiles[+as.closest('.at').dataset.n].id); return; }
  const at = ev.target.closest('.at'); if (at) { openTile(at); return; }
  const c = ev.target.closest('.zt .cv'); if (!c) return; const k = c.closest('.zt').dataset.k, a = assignedIn(k); UI.at = k; UI.ai = a ? +a.split(':')[1] : 0; UI.av = 'edit'; saveUI(); renderAnim();
});
$('av-zu').addEventListener('change', ev => {
  const s = ev.target.closest('select'); if (!s) return; const L = layerById('track:' + s.dataset.k); if (!L) return;
  if (s.value) { assignTo(s.value); return; }
  L.anim = ''; L.P = {}; refresh('lvit'); toast(`Tonspur ${TBY[s.dataset.k].name}: keine Animation`);
});

/* ---------- Zeichnen (jedes Bild) ---------- */
function animFrame() {
  const t = labT(), tt = t - OFFSET, playing = !audio.paused, shown = playing ? t : (audio.currentTime || 0);
  window.IDEEN_GATE = false;
  if (UI.av === 'edit') { Editor.frame({ t: tt, fg: COL.fg, bg: COL.bg, col: TBY[UI.at].col }); return; }
  const tiles = (UI.av === 'all' || UI.zm === 'spur') ? allTiles : zuTiles;
  for (const tl of tiles) {
    const cv = tl.cv; if (!cv || !cv._w) continue;
    const W = cv._w, H = cv._h, dpr = cv._dpr, ctx = cv.getContext('2d'), tr = tl.tr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const st = tl.id ? { anim: tl.id, P: {} } : (() => { const L = layerById('track:' + tr.key); return { anim: L ? L.anim : '', P: L ? L.P : {} }; })();
    if (tl.st) { const on = isOn(tr, shown); tl.el.classList.toggle('live', on); const lab = on ? 'klingt' : ''; if (tl.st._v !== lab) { tl.st._v = lab; tl.st.textContent = lab; } }
    if (!st.anim) continue;
    ctx.save();
    try { drawAnim(ctx, { t: tt, bar: BAR, beat: BEAT, phase: ((tt / BAR) % 1 + 1) % 1, w: W, h: H, col: tr.col, fg: COL.fg, bg: COL.bg }, st); } catch (e) { console.error(e); }
    ctx.restore();
  }
}
