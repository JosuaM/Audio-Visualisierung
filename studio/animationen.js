'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Animationen (dritter Bereich links): drei Ansichten auf einem Bildschirm
     • Editor            – oben Spur und Animation wählen, darunter die Animation groß, rechts Vorlage und Regler (seiten/animationen/editor-*.js)
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

/* Editor-Ansicht: Knöpfe und Lautstärke wandern links neben das Bild, unter den Player kommt die Keyframe-Zeitleiste */
const moved = ['.player .tp', '.player .vol'].map(sel => { const el = document.querySelector(sel), home = document.createComment(sel); el.before(home); return { el, home }; });
function editorChrome(on) {
  if ($('app').classList.contains('editing') === on) return;
  $('app').classList.toggle('editing', on); $('tlDock').hidden = !on;
  if (!on) setWaveView(0, DUR);                    // außerhalb des Editors immer der ganze Song
  setWaveWork(on ? Editor.work() : null);          // der Arbeitsbereich gilt nur im Editor
  for (const m of moved) if (on) $('edtp').appendChild(m.el); else m.home.after(m.el);
}
function renderAnim() {
  editorChrome(UI.av === 'edit');
  AVIEWS.forEach(([k]) => { const el = $('av-' + k); el.classList.toggle('on', UI.av === k); if (UI.av !== k && k !== 'edit') el.innerHTML = ''; });
  $('avsw').innerHTML = AVIEWS.map(([k, n]) => `<button type="button" data-v="${k}" class="${UI.av === k ? 'on' : ''}">${n}</button>`).join('');
  const cur = UI.av === 'all' ? (UI.af || '') : UI.av === 'zu' && UI.zm === 'alle' ? '' : UI.at;      // '' = alle Spuren
  const pills = (UI.av === 'edit' ? [] : [['', 'Alle Spuren']]).concat(aTracks().map(t => [t.key, t.name]));
  $('atrk').innerHTML = pills.map(([k, n]) => { const t = TBY[k]; return `<button type="button" class="atp${cur === k ? ' on' : ''}" data-k="${k}" aria-pressed="${cur === k}" style="--tc:${t ? t.cssColor : 'var(--ink)'}">${t ? '<i></i>' : ''}${esc(n)}</button>`; }).join('');
  $('achiprow').hidden = UI.av !== 'edit';
  showChips();
  if (UI.av === 'edit') buildEdit(); else if (UI.av === 'all') buildAll($('av-all'), UI.af || '', false); else if (UI.zm === 'spur') buildAll($('av-zu'), UI.at, true); else buildZu();
}

/* ---------- Editor ---------- */
function showChips() {            // Animationsliste auf- oder zugeklappt – zugeklappt steht nur „Animation“ links neben dem Bild
  const open = UI.achips !== false, tog = $('achiptog');
  $('ws-anim').classList.toggle('chips-closed', UI.av === 'edit' && !open);
  $('achips').hidden = !open; tog.setAttribute('aria-expanded', String(open)); tog.title = open ? 'Animationen zuklappen – mehr Platz für das Bild' : 'Animationen aufklappen';
}
function renderChips() {          // alle Animationen der gewählten Spur; die zugeordnete trägt einen Haken
  const box = $('achips'), mine = assignedIn(UI.at), top = box.scrollTop;
  box.style.setProperty('--tc', TBY[UI.at].cssColor);
  box.innerHTML = ideasOf(UI.at).map((x, i) => { const m = mine === UI.at + ':' + i; return `<button type="button" class="ach${m ? ' mine' : ''}" data-i="${i}" aria-pressed="${i === UI.ai}" title="${esc(x.title)}${m ? ' – dieser Tonspur zugewiesen' : ''}"><span class="n">${i + 1}</span><span class="t">${esc(x.title)}</span>${m ? '<em>✓</em>' : ''}</button>`; }).join('');
  box.scrollTop = top;
  const a = box.querySelector('[aria-pressed="true"]');          // gewählte Animation sichtbar halten
  if (a && (a.offsetTop < box.scrollTop || a.offsetTop + a.offsetHeight > box.scrollTop + box.clientHeight)) box.scrollTop = a.offsetTop - (box.clientHeight - a.offsetHeight) / 2;
}
function updateAssign() {          // großer Knopf rechts oben, über den Vorlagen
  const t = TBY[UI.at], id = UI.at + ':' + UI.ai, mine = assignedIn(UI.at) === id, it = ideasOf(UI.at)[UI.ai];
  edHost.assign.style.setProperty('--tc', t.cssColor);
  edHost.assign.innerHTML = !it ? '' : `<button type="button" class="as-go${mine ? ' done' : ''}" data-a="assign" ${mine ? 'disabled' : ''} title="${esc(`${it.title} – ${mine ? 'läuft im Studio auf der Tonspur ' + t.name : 'im Studio der Tonspur ' + t.name + ' zuweisen'}`)}">${mine ? `✓ Zugewiesen an ${esc(t.name)}` : 'Zuweisen'}</button>`
    + (mine ? '<button type="button" class="as-link" data-a="studio" title="Zur Gesamtansicht im Studio – alle Spuren übereinander">Im Studio ansehen →</button>' : '');
}
function buildEdit() {
  if (!edHost) {
    edHost = Editor.mount($('av-edit'), { ratio: 16 / 9 });
    Editor.onView = setWaveView; Editor.onWork = setWaveWork;
    Editor.dockTimeline($('tlDock'));
    Editor.host = { time: () => audio.paused ? audio.currentTime : nowT(), seek: t => seek(t), playing: () => !audio.paused, toggle: togglePlay, pause: () => audio.pause(), ended: () => audio.ended, dur: DUR, offset: OFFSET, bar: BAR, beat: BEAT };
    edHost.assign.addEventListener('click', ev => {
      if (ev.target.closest('[data-a="assign"]')) { assignTo(UI.at + ':' + UI.ai); updateAssign(); renderChips(); }
      else if (ev.target.closest('[data-a="studio"]')) { setView('mix'); setWs('studio'); }
    });
  }
  const ideas = ideasOf(UI.at); UI.ai = clamp(UI.ai, 0, Math.max(0, ideas.length - 1)); saveUI();
  const it = ideas[UI.ai];
  renderChips(); updateAssign();
  const id = UI.at + ':' + UI.ai, L = layerById('track:' + UI.at);
  Editor.load(UI.at + ':' + (it ? it.title : '-'), it ? baseIdea(id, L && L.anim === id ? L.P : {}) : { title: '-', draw() {} });
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
  const b = ev.target.closest('.atp'); if (!b) return; const k = b.dataset.k;
  if (UI.av === 'all') UI.af = k;
  else { if (UI.av === 'zu') UI.zm = k ? 'spur' : 'alle'; if (k && k !== UI.at) { UI.at = k; UI.ai = 0; } }
  saveUI(); renderAnim();
});
$('achiptog').addEventListener('click', () => { UI.achips = UI.achips === false; saveUI(); showChips(); if (UI.achips) renderChips(); });
$('achips').addEventListener('click', ev => { const b = ev.target.closest('.ach'); if (b) { UI.ai = +b.dataset.i; saveUI(); buildEdit(); } });
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
    try { drawAnim(ctx, { t: tt, kt: shown, bar: BAR, beat: BEAT, phase: ((tt / BAR) % 1 + 1) % 1, w: W, h: H, col: tr.col, fg: COL.fg, bg: COL.bg }, st); } catch (e) { console.error(e); }
    ctx.restore();
  }
}
