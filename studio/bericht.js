'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Beschreibung des Projekts als druckbare Seite (bericht.html) – daraus entsteht das PDF.
   Alles wird aus denselben Daten gerechnet wie im Studio: Song (assets/data.js + analysis.js),
   Tonspuren, Animationen, Zuordnungen (studio/projekt.json bzw. der ungespeicherte Stand im Browser).
   ═══════════════════════════════════════════════════════════════════════════ */
const TCOL = { flute: '#3ddc97', trumpet: '#5ba3ff', frog: '#ff5f76', building: '#ffb454', riser: '#ff3fa6', jagd: '#b88cff', drums: '#46d9ee', ring: '#d6f45c' };
const n1 = (v, d = 1) => (+v).toFixed(d).replace('.', ',').replace('-', '−');
const T2 = s => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${n1(r, 2)}`; };
const posOf = t => { if (t < OFFSET - 1e-6) return 'Auftakt'; const k = Math.floor((t - OFFSET) / BEAT + 1e-6); return `Takt ${Math.floor(k / SONG.beats) + 1}, Schlag ${k % SONG.beats + 1}`; };
const rng = (a, z) => `${T2(a)} – ${T2(z)} <span class="mu">(${n1(a, 2)} – ${n1(z, 2)} s · ${posOf(a)} bis ${posOf(Math.max(a, z - 1e-3))})</span>`;
const NBARS = Math.round((DUR - OFFSET) / BAR);
const barStart = b => OFFSET + (b - 1) * BAR;
const trackName = key => TBY[key].name;
const ideaFile = id => { const key = id.split(':')[0]; return `${fileSafe(trackName(key) + '_' + ideaOf(id).title)}.mp4`; };
const mapName = m => m.name || describe(m).when;
const layerLbl = id => id === '*' ? 'alle Ebenen' : (layerById(id) ? layerName(layerById(id)) : '?');

/* Messmethode der Auslöser (Kurzfassung der Rechnung in signale.js) */
const SIG_HOW = {
  loud: 'Aus den Spitzenwerten der Audiodatei (250 pro Sekunde): Mittelwert der Energie über 0,15 s, in dB umgerechnet. 0 dB = Maximum der Datei.',
  dyn: 'Änderung der Lautstärke in dB pro Sekunde über ein 0,6-s-Fenster. Auf −100 … +100 gestreckt (95 %-Wert der Beträge = ±100). Positiv = es wird lauter.',
  onset: 'Summe aller Anstiege im Spektrum gegenüber dem Vorbild (30 Bilder pro Sekunde), 0,03 s geglättet, dann so gestreckt, dass 3 % der Werte = 0 und 97 % = 100 sind.',
  pitch: 'Kräftigstes der 64 Frequenzbänder im Melodiebereich (Band 12–47), Ausreißer per Median über 7 Bilder entfernt, 0,08 s geglättet; 3 %/97 % des Songs = 0/100.',
  bright: 'Spektraler Schwerpunkt (energiegewichtete mittlere Bandnummer), 0,1 s geglättet; 3 %/97 % des Songs = 0/100.',
  bass: 'Mittlere Energie der Bänder 0–11, 0,05 s geglättet; 3 %/97 % des Songs = 0/100.',
  mid: 'Mittlere Energie der Bänder 12–35, 0,05 s geglättet; 3 %/97 % des Songs = 0/100.',
  high: 'Mittlere Energie der Bänder 36–63, 0,05 s geglättet; 3 %/97 % des Songs = 0/100.',
  beat: `Formel: 100 · e^(−5 · Rest), Rest = Bruchteil von (Zeit − ${n1(OFFSET, 3)} s) / ${n1(BEAT, 4)} s. Auf jedem Taktschlag genau 100 %, danach schnell abklingend (nach einem halben Schlag ≈ 8 %).`,
  bar: `Formel: 100 · Bruchteil von (Zeit − ${n1(OFFSET, 3)} s) / ${n1(BAR, 4)} s. Läuft in jedem Takt linear von 0 auf 100 %, springt dann auf 0 zurück.`,
  progress: 'Formel: 100 · Zeit / Songlänge.',
  tension: 'Von Hand nachgezeichnete Spannungskurve (0–10) aus studio/spannung.js, zwischen den Stützpunkten linear verbunden.',
  dense: 'Zählt, wie viele der 8 Tonspuren zu diesem Zeitpunkt klingen (Zeitfenster aus Abschnitt 3).',
  gate: 'Nur für Zuordnungen, die auf eine einzelne Spur wirken: 1, solange diese Spur klingt, sonst 0.',
};
const SIG_NOTE = 'Gemessen wird immer der fertige Gesamtmix – die Einzelspuren liegen nicht getrennt vor. „Lautstärke“, „Tonhöhe“ usw. beschreiben also den Klang des ganzen Songs an dieser Stelle.';
const COND_HOW = {
  grad: 'Stufenlos: Anteil f = (Wert − von) / (bis − von), auf 0 … 1 begrenzt. Wirkung = Wert unten + (Wert oben − Wert unten) · f.',
  ab: 'Schwelle: f springt (mit dem eingestellten Übergang) auf 1, sobald der Wert ≥ Schwelle ist, sonst 0. Wirkung = „Dann“-Wert bei f = 1, „Sonst“-Wert bei f = 0 („unverändert“ = Ebene bleibt, wie sie ist).',
  unter: 'Schwelle: f = 1, solange der Wert ≤ Schwelle ist, sonst 0 – sonst wie „ab“.',
  zw: 'Bereich: f = 1, solange der Wert zwischen „von“ und „bis“ liegt, sonst 0 – sonst wie „ab“.',
};
const WIRK_HOW = {
  y: 'Verschiebt die Ebene um (Wert × Bildhöhe) nach oben (+) bzw. unten (−). 0,38 = fast bis zum Bildrand.',
  x: 'Verschiebt die Ebene um (Wert × Bildbreite) nach rechts (+) bzw. links (−).',
  size: 'Vergrößert/verkleinert die ganze Ebene um die Bildmitte (Faktor 1 = unverändert).',
  alpha: 'Deckkraft der Ebene (1 = voll sichtbar, 0 = unsichtbar). Mehrere Zuordnungen werden multipliziert.',
  color: 'Färbt alles, was die Ebene zeichnet, in diese Farbe ein (Deckkraft der Färbung = f · Stärke). Bei „von … bis“ mit zwei Farben wird zwischen beiden übergeblendet.',
  rot: 'Dreht die Ebene um die Bildmitte (in Grad, mehrere Zuordnungen addieren sich).',
  shake: 'Lässt die Ebene zittern: zufälliger Versatz bis zu (Wert × kleinere Bildseite), 40-mal pro Sekunde neu gewürfelt.',
  bg: 'Färbt den Hintergrund der ganzen Bühne (hinter allen Ebenen); gilt immer für alle Ebenen.',
};

/* Zeitfenster, in denen f ≥ 0,5 ist (Rohwert ohne Zeitglättung) – für die Beschreibung „wann reagiert es“ */
function windowsOf(m, track) {
  const out = []; let a = null; const N = Math.round(DUR * 50);
  for (let i = 0; i <= N; i++) {
    const t = i / 50, on = mapFactor(m, t, { track }, null, 0) >= .5;
    if (on && a == null) a = t; if (!on && a != null) { out.push([a, t]); a = null; }
  }
  if (a != null) out.push([a, DUR]);
  return out.filter(([x, z]) => z - x >= .03);
}
const intersect = (A, B) => { const o = []; for (const [a, z] of A) for (const [c, d] of B) { const s = Math.max(a, c), e = Math.min(z, d); if (e - s > .03) o.push([s, e]); } return o; };
const total = W => W.reduce((s, [a, z]) => s + z - a, 0);
const winList = W => W.length ? `<ul class="tl">${W.map(([a, z]) => `<li>${rng(a, z)}</li>`).join('')}</ul>` : '<span class="mu">nie</span>';

/* ---------- Grafiken ---------- */
function overviewSvg() {
  const W = 1000, L = 96, R = 8, X = t => L + t / DUR * (W - L - R), rowH = 17, top = 22;
  let y = top, s = '';
  const sigRows = [['loud', 'Lautstärke'], ['pitch', 'Tonhöhe'], ['tension', 'Spannung']];
  const H = top + TRACKS.length * rowH + 10 + sigRows.length * 44 + 8;
  s += `<rect x="${L}" y="${top - 4}" width="${W - L - R}" height="${TRACKS.length * rowH + 4}" fill="#f6f5f1"/>`;
  for (let b = 1; b <= NBARS; b++) { const x = X(barStart(b)); s += `<line x1="${x}" x2="${x}" y1="${top - 4}" y2="${H - 8}" stroke="#d9d6cc" stroke-width="${b % 4 === 1 ? 1 : .4}"/>`; if (b % 2 === 1) s += `<text x="${x + 2}" y="12" font-size="9" fill="#666">${b}</text>`; }
  s += `<text x="${L - 6}" y="12" font-size="9" fill="#666" text-anchor="end">Takt</text>`;
  for (const t of TRACKS) {
    s += `<text x="${L - 6}" y="${y + 12}" font-size="10.5" text-anchor="end" fill="#222">${esc(t.name)}</text>`;
    for (const [a, z] of t.raw) s += `<rect x="${X(a)}" y="${y + 2}" width="${Math.max(1.5, X(z) - X(a))}" height="${rowH - 5}" rx="2" fill="${TCOL[t.key]}" stroke="#0003" stroke-width=".5"/>`;
    y += rowH;
  }
  y += 10;
  for (const [k, nm] of sigRows) {
    const d = Sig.BY[k], h = 36, n = 400; let p = '';
    for (let i = 0; i < n; i++) { const t = i / (n - 1) * DUR, v = Sig.val(k, t, {}); p += `${i ? 'L' : 'M'}${X(t).toFixed(1)},${(y + h - clamp((v - d.lo) / (d.hi - d.lo), 0, 1) * h).toFixed(1)}`; }
    s += `<text x="${L - 6}" y="${y + 12}" font-size="10.5" text-anchor="end" fill="#222">${nm}</text><text x="${L - 6}" y="${y + 24}" font-size="8" text-anchor="end" fill="#888">${d.lo} … ${d.hi}${d.u ? ' ' + d.u : ''}</text>`;
    s += `<rect x="${L}" y="${y}" width="${W - L - R}" height="${h}" fill="none" stroke="#d9d6cc" stroke-width=".6"/><path d="${p}" fill="none" stroke="#c4560a" stroke-width="1.2"/>`;
    y += 44;
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Ablauf des Songs">${s}</svg>`;
}

/* ---------- Abschnitte ---------- */
function secSong() {
  const bars = []; for (let b = 1; b <= NBARS; b++) bars.push(b);
  const half = Math.ceil(NBARS / 2);
  const row = b => `<tr><td>${b}</td><td>${n1(barStart(b), 2)}</td><td>${T2(barStart(b))}</td></tr>`;
  const tbl = list => `<table class="t sm"><tr><th>Takt</th><th>Start (s)</th><th>mm:ss</th></tr>${list.map(row).join('')}</table>`;
  return `<section><h2>2 · Song, Tempo und Zeitraster</h2>
  <table class="t kv"><tr><th>Audiodatei</th><td><code>assets/song.m4a</code> (Tonspur des fertigen Songs, Mix aus allen 8 Spuren)</td></tr>
  <tr><th>Titel</th><td>Synthwave goose – Blade Runner 2049</td></tr>
  <tr><th>Länge</th><td><b>${n1(DUR, 3)} s</b> (${T2(DUR)})</td></tr>
  <tr><th>Tempo</th><td><b>${n1(SONG.bpm, 1)} BPM</b>, Taktart <b>${SONG.beats}/4</b></td></tr>
  <tr><th>Ein Schlag</th><td>${n1(BEAT, 4)} s (= 60 / ${n1(SONG.bpm, 1)})</td></tr>
  <tr><th>Ein Takt</th><td>${n1(BAR, 4)} s (= ${SONG.beats} Schläge)</td></tr>
  <tr><th>Erster Taktschlag</th><td>bei <b>${n1(OFFSET, 3)} s</b> (Versatz der Audiodatei). Alle Taktangaben in diesem Dokument zählen ab hier; davor „Auftakt“.</td></tr>
  <tr><th>Takte im Song</th><td>${NBARS} Takte (Takt ${NBARS} endet bei ${n1(OFFSET + NBARS * BAR, 2)} s)</td></tr></table>
  <p><b>Umrechnung:</b> Schlag n (ab 0 gezählt) beginnt bei <code>${n1(OFFSET, 3)} s + n · ${n1(BEAT, 4)} s</code>. Takt b beginnt bei <code>${n1(OFFSET, 3)} s + (b − 1) · ${n1(BAR, 4)} s</code>. Alle Animationen laufen mit der Zeit <code>t = Songzeit − ${n1(OFFSET, 3)} s</code>, also taktgenau zur Musik; ein Video-Bild i (bei ${EXP.fps} Bildern pro Sekunde) zeigt die Songzeit i / ${EXP.fps} s.</p>
  <div class="two">${tbl(bars.slice(0, half))}${tbl(bars.slice(half))}</div></section>`;
}

function secAblauf() {
  const ev = [];
  for (const t of TRACKS) for (const [a, z] of t.raw) { ev.push([a, `${t.name} <b>setzt ein</b>`, t.key]); ev.push([z, `${t.name} <b>hört auf</b>`, t.key]); }
  ev.sort((x, y) => x[0] - y[0] || (x[1].includes('hört') ? -1 : 1));
  const merged = ev.filter(e => !(e[1].includes('hört') && e[0] >= DUR - .5 && false));
  const rows = TRACKS.map(t => `<tr><td><i class="dot" style="background:${TCOL[t.key]}"></i><b>${esc(t.name)}</b></td><td>${t.raw.map(([a, z]) => `<div>${rng(a, z)}</div>`).join('')}</td><td class="r">${n1(total(t.raw), 1)} s</td></tr>`).join('');
  const kinds = { l: 'Linien / Melodie', f: 'Flächen / Fülltöne', d: 'Schläge', s: 'Sonstiges', i: 'Einzelereignis' };
  const els = ELEMENTS.slice().sort((a, b) => a.t0 - b.t0).map(e => { const key = e.id.replace(/-\d+$/, ''), z = Math.min(DUR, e.t0 + widthOf(e)); return `<tr><td>${esc(trackName(key))}</td><td>${esc(e.id)}</td><td>${kinds[e.k] || e.k}</td><td>${n1(e.t0, 2)}</td><td>${n1(z, 2)}</td><td>${posOf(e.t0)}</td></tr>`; }).join('');
  return `<section><h2>3 · Wann klingt welche Tonspur?</h2>
  <p>Die Tabelle zeigt die Zeitfenster, in denen jede Spur im Song zu hören ist (benachbarte Einsätze mit weniger als 0,3 s Pause sind zusammengefasst). Die Grafik darunter zeigt dasselbe über die Takte, dazu drei Messkurven.</p>
  <table class="t"><tr><th>Spur</th><th>Klingt von – bis</th><th>Summe</th></tr>${rows}</table>
  ${overviewSvg()}
  <h3>Reihenfolge der Einsätze und Abgänge</h3>
  <table class="t sm"><tr><th>Zeit</th><th>Takt, Schlag</th><th>Ereignis</th></tr>${merged.map(([t, tx, k]) => `<tr><td>${n1(t, 2)} s</td><td>${posOf(t)}</td><td><i class="dot" style="background:${TCOL[k]}"></i>${tx}</td></tr>`).join('')}</table>
  <h3>Einzelne Klangereignisse (Elemente)</h3>
  <p class="mu">So sind die Zeitfenster oben entstanden: jedes Element ist eine Phrase oder ein Ton der jeweiligen Spur.</p>
  <table class="t sm"><tr><th>Spur</th><th>Kennung</th><th>Art</th><th>Beginn (s)</th><th>Ende (s)</th><th>Takt, Schlag</th></tr>${els}</table></section>`;
}

const kastenTable = idea => {
  if (!idea || !idea.info) return '';
  return idea.info.map.map(g => `<table class="t sm km"><tr><th colspan="3">${esc(g.g)}</th></tr>${g.rows.map(r => `<tr><td>${esc(r.n)}</td><td><b>${esc(r.v)}</b></td><td>${r.t ? `<span class="rea">reagiert auf: ${esc(r.t)}</span> ` : ''}${esc(r.h || '')}</td></tr>`).join('')}</table>`).join('');
};
function layerBlock(t) {
  const L = layerById('track:' + t.key), idea = ideaOf(L.anim), id = L.anim, mine = P.maps.filter(m => m.layer === L.id), glob = P.maps.filter(m => m.layer === '*' && m.tgt !== 'bg');
  let h = `<article class="blk"><h3><i class="dot" style="background:${TCOL[t.key]}"></i>${esc(t.name)} <span class="mu">→</span> ${idea ? esc(idea.title) : 'keine Animation'}</h3>`;
  h += `<table class="t kv"><tr><th>Spur klingt</th><td>${t.raw.map(([a, z]) => `<div>${rng(a, z)}</div>`).join('')}</td></tr>`;
  if (!idea) return h + '<tr><th>Hinweis</th><td>Dieser Spur ist keine Animation zugeordnet – im Video bleibt sie leer.</td></tr></table></article>';
  h += `<tr><th>Animation</th><td><b>${esc(idea.title)}</b> <span class="mu">(Katalog-Nr. ${esc(id)}${idea.tag ? ' · ' + esc(idea.tag) : ''})</span></td></tr>`
    + `<tr><th>Beschreibung</th><td>${esc(idea.text || '–')}</td></tr>`
    + `<tr><th>Ebene</th><td>${L.on ? 'eingeschaltet' : '<b>ausgeschaltet</b> (nicht im Gesamtbild)'} · Zeichenfarbe: ${L.tint ? `Spurfarbe (<span class="sw" style="background:${TCOL[t.key]}"></span> ${TCOL[t.key]})` : 'Weiß auf Schwarz (Theme)'}</td></tr>`;
  const sicht = [`Die Ebene wird nur gezeichnet, solange die Spur klingt (Zeitfenster oben)${idea.tail ? `, <b>zuzüglich ${idea.tail} Schläge (${n1(idea.tail * BEAT, 2)} s) Auslaufzeit</b> nach dem Ende jedes Fensters` : ''}.`];
  if (t.key === 'drums' || t.key === 'ring') sicht.push(`<b>Sonderregel:</b> Die Animation beginnt erst mit <b>Takt 25 (${n1(OFFSET + 24 * BAR, 2)} s)</b>, obwohl die Spur schon früher klingt – so legt es die Rangfolge der Spuren in der Klanghierarchie fest. Bei „durchgehend“ exportierten Videos entfällt diese Regel.`);
  h += `<tr><th>Sichtbarkeit</th><td>${sicht.join('<br>')}</td></tr>`;
  const Pm = { ...defOf(id), ...L.P }, chg = groupsOf(id).flatMap(([, ks]) => ks).filter(k => L.P[k] != null && L.P[k] !== defOf(id)[k]);
  h += `<tr><th>Einstellungen</th><td>${chg.length ? chg.map(k => `${esc(nameOf(id, k))}: <b>${esc(L.P[k])}</b> <span class="mu">(Standard ${esc(defOf(id)[k])})</span>`).join('<br>') : 'Standardwerte der Animation (keine Anpassung).'}</td></tr>`;
  h += `<tr><th>Parameter-Zuordnungen</th><td>${(mine.length + glob.length) ? [...mine.map(m => `${esc(mapName(m))} <span class="mu">(nur diese Ebene${m.on ? '' : ', AUS'})</span>`), ...glob.map(m => `${esc(mapName(m))} <span class="mu">(alle Ebenen${m.on ? '' : ', AUS'})</span>`)].join('<br>') : 'keine'}</td></tr>`;
  h += `<tr><th>Video-Datei</th><td><code>${esc(ideaFile(id))}</code></td></tr></table>`;
  if (idea.info) h += `<div class="mu small">Morphologischer Kasten dieser Animation – die Spalte „reagiert auf“ nennt den Klangparameter, an den die Bewegung gekoppelt ist:</div>${kastenTable(idea)}`;
  return h + '</article>';
}
function secEbenen() {
  const order = orderedLayers(l => true).map(l => layerName(l));
  return `<section><h2>4 · Tonspur → Animation (so ist das Projekt belegt)</h2>
  <p>Jede Tonspur hat genau eine Animation. Die Ebenen werden in dieser Reihenfolge von <b>unten nach oben</b> übereinandergelegt (die letzte liegt ganz oben): <b>${order.map(esc).join(' → ')}</b>. Hintergrund der Bühne: Schwarz (#000000, Dunkel-Modus), Zeichenfarbe: Weiß bzw. die Spurfarbe. Jede Ebene wird einzeln gezeichnet, dann mit ihrer Deckkraft/Verschiebung aus den Parameter-Zuordnungen auf die Bühne gelegt.</p>
  ${TRACKS.map(layerBlock).join('')}</section>`;
}

function mapBlock(m, i) {
  const d = Sig.BY[m.src], w = WIRK[m.tgt], dd = describe(m), so = SOFT[m.soft] || SOFT.weich, L = layerById(m.layer), tr = L && L.kind === 'track' ? L.key : '';
  const Wn = windowsOf(m, tr), vis = tr ? intersect(Wn, TBY[tr].raw) : null;
  let h = `<article class="blk${m.on ? '' : ' off'}"><h3>${i + 1} · ${esc(mapName(m))} <span class="badge ${m.on ? 'on' : 'offb'}">${m.on ? 'EIN' : 'AUS – wirkt im Video nicht'}</span></h3>
  <table class="t kv"><tr><th>Wenn</th><td><b>${esc(dd.when)}</b></td></tr><tr><th>Dann</th><td><b>${esc(dd.then)}</b></td></tr>
  <tr><th>Gilt für</th><td>${esc(layerLbl(m.layer))}</td></tr>
  <tr><th>Auslöser</th><td>${esc(d.n)} (${esc(d.g)}) – Bereich ${d.lo} … ${d.hi}${d.u ? ' ' + esc(d.u) : ''}; ${esc(d.hint)}</td></tr>
  <tr><th>Bedingung</th><td>${esc(COND[m.cond])}: ${esc(COND_HOW[m.cond])} <br>Werte: von/Schwelle <b>${esc(d.fmt(m.lo))}</b>${m.cond === 'grad' || m.cond === 'zw' ? `, bis <b>${esc(d.fmt(m.hi))}</b>` : ''}.</td></tr>
  <tr><th>Wirkung</th><td>${esc(w.n)}: ${esc(WIRK_HOW[m.tgt])} Wert ${m.cond === 'grad' ? 'unten' : 'sonst'}: <b>${esc(valLabel(m.tgt, m.a))}</b>, Wert ${m.cond === 'grad' ? 'oben' : 'dann'}: <b>${esc(valLabel(m.tgt, m.b))}</b>${w.type === 'color' ? '' : ` (Zahlenwerte ${m.a == null ? 'neutral ' + w.neutral : m.a} → ${m.b == null ? 'neutral ' + w.neutral : m.b})`}.</td></tr>
  <tr><th>Stärke</th><td>${Math.round((m.str == null ? 1 : m.str) * 100)} % <span class="mu">(100 % = voller Wert; weniger = Wirkung nur teilweise vom Normalzustand weg)</span></td></tr>
  <tr><th>Übergang</th><td>${esc(so.n)}: ${so.tau ? `Weichzeichnung der Schwelle über ${Math.round(so.w * 100)} % des Wertebereichs und zeitliche Glättung mit ${n1(so.tau, 2)} s Trägheit` : 'ohne Glättung, sofort'}.</td></tr>`;
  h += `<tr><th>Bedingung erfüllt</th><td>${winList(Wn)}<span class="mu">zusammen ${n1(total(Wn), 1)} s = ${n1(total(Wn) / DUR * 100, 0)} % des Songs (Anteil f ≥ 50 %)</span></td></tr>`;
  if (vis) h += `<tr><th>Davon sichtbar (Spur klingt)</th><td>${winList(vis)}</td></tr>`;
  return h + '</table></article>';
}
function secMaps() {
  return `<section><h2>5 · Parameter-Zuordnungen: wie auf den Klang reagiert wird</h2>
  <p>Eine Zuordnung verbindet einen <b>Auslöser</b> (eine Messgröße des Klangs, z. B. Lautstärke, Tonhöhe, Schlag) mit einer <b>Wirkung</b> auf das Bild (z. B. Farbe, Größe, Position). Sie gilt für eine bestimmte Ebene oder für alle. ${esc(SIG_NOTE)}</p>
  ${P.maps.length ? `<p>Im Projekt sind <b>${P.maps.length}</b> Zuordnungen angelegt, davon <b>${P.maps.filter(m => m.on).length} eingeschaltet</b>.${P.maps.some(m => m.on) ? '' : ' <b>Aktuell ist keine eingeschaltet – die Videos zeigen die Animationen daher ohne zusätzliche Klangreaktion; es bewegt sich nur, was die Animation selbst (taktgenau) vorgibt.</b>'}</p>${P.maps.map(mapBlock).join('')}` : '<p><b>Es ist keine Parameter-Zuordnung angelegt.</b> Die Animationen laufen ohne zusätzliche Klangreaktion; es bewegt sich nur, was sie selbst taktgenau vorgeben.</p>'}
  <h3>So wirken mehrere Zuordnungen zusammen</h3>
  <ul><li>Position (x, y) und Drehung und Zittern werden <b>addiert</b>, Größe und Deckkraft <b>multipliziert</b>, Färbungen <b>nacheinander überlagert</b>.</li>
  <li>Zuordnungen für „alle Ebenen“ wirken auf jede Ebene einzeln; „Hintergrund“ wirkt nur auf die Bühne.</li>
  <li>Eine Ebene mit Deckkraft ≤ 0,2 % wird gar nicht gezeichnet.</li></ul></section>`;
}

function secReferenz() {
  const groups = []; Sig.DEF.forEach(x => { let g = groups.find(q => q[0] === x.g); if (!g) groups.push(g = [x.g, []]); g[1].push(x); });
  const sig = groups.map(([g, xs]) => `<tr><th colspan="4">${esc(g)}</th></tr>` + xs.map(d => `<tr><td><b>${esc(d.n)}</b><br><span class="mu">${esc(d.k)}</span></td><td>${d.lo} … ${d.hi}${d.u ? ' ' + esc(d.u) : ''}<br><span class="mu">${esc(d.lowL)} → ${esc(d.highL)}</span></td><td>${esc(d.hint)}</td><td>${esc(SIG_HOW[d.k] || '')}</td></tr>`).join('')).join('');
  const wirk = Object.entries(WIRK).map(([k, w]) => `<tr><td><b>${esc(w.n)}</b></td><td>${w.type === 'color' ? 'Farbe: ' + COLORS.map(c => c[0] + ' ' + c[1]).join(', ') : w.opts.map(o => `${o[0]} = ${o[1]}`).join('; ')}</td><td>${esc(WIRK_HOW[k])}</td></tr>`).join('');
  const soft = Object.values(SOFT).map(s => `<tr><td>${esc(s.n)}</td><td>${Math.round(s.w * 1000) / 10} %</td><td>${s.tau ? n1(s.tau, 2) + ' s' : '–'}</td></tr>`).join('');
  return `<section><h2>6 · Nachschlagewerk: Auslöser, Wirkungen, Übergänge</h2>
  <p>${esc(SIG_NOTE)} Alle Messwerte werden einmal aus der Datei berechnet (100 Werte pro Sekunde, dazwischen linear verbunden).</p>
  <h3>Auslöser (Messgrößen)</h3><table class="t sm"><tr><th>Name</th><th>Bereich</th><th>Bedeutung</th><th>Messmethode</th></tr>${sig}</table>
  <h3>Wirkungen</h3><table class="t sm"><tr><th>Wirkung</th><th>Wählbare Werte</th><th>Was passiert</th></tr>${wirk}</table>
  <h3>Übergänge</h3><table class="t sm"><tr><th>Übergang</th><th>Breite der Schwelle (Anteil am Wertebereich)</th><th>Zeitliche Trägheit</th></tr>${soft}</table>
  <p class="mu">Bei Schwellen-Bedingungen („ab“, „unter“, „zwischen“) wird der Sprung über die angegebene Breite weich überblendet (S-Kurve), anschließend wird f zeitlich geglättet (Trägheit, nur bei „Weich“/„Sehr weich“).</p></section>`;
}

function secMesswerte() {
  const keys = ['loud', 'pitch', 'bright', 'bass', 'mid', 'high', 'onset', 'tension'];
  const head = `<tr><th>Takt</th><th>Start (s)</th><th>Spuren, die klingen</th><th>Laut-<br>stärke Ø / max (dB)</th><th>Ton-<br>höhe Ø</th><th>Hellig-<br>keit Ø</th><th>Bass Ø</th><th>Mitten Ø</th><th>Höhen Ø</th><th>An-<br>schlag max</th><th>Span-<br>nung Ø</th></tr>`;
  let rows = '';
  for (let b = 1; b <= NBARS + 0; b++) {
    const a = barStart(b), z = Math.min(DUR, a + BAR), acc = {}; keys.forEach(k => acc[k] = { s: 0, mx: -1e9, n: 0 });
    for (let t = a; t < z; t += .02) keys.forEach(k => { const v = Sig.val(k, t, {}), o = acc[k]; o.s += v; o.n++; o.mx = Math.max(o.mx, v); });
    const on = TRACKS.filter(t => isOn(t, a + BAR / 2)).map(t => t.name), avg = k => acc[k].s / acc[k].n;
    rows += `<tr><td>${b}</td><td>${n1(a, 2)}</td><td class="l">${on.length ? on.map(esc).join(', ') : '–'}</td><td>${n1(avg('loud'))} / ${n1(acc.loud.mx)}</td><td>${n1(avg('pitch'), 0)} %</td><td>${n1(avg('bright'), 0)} %</td><td>${n1(avg('bass'), 0)} %</td><td>${n1(avg('mid'), 0)} %</td><td>${n1(avg('high'), 0)} %</td><td>${n1(acc.onset.mx, 0)} %</td><td>${n1(avg('tension'), 1)}</td></tr>`;
  }
  return `<section><h2>7 · Messwerte pro Takt</h2>
  <p>Mittelwerte (Ø) bzw. Höchstwerte der Auslöser in jedem Takt. Damit lässt sich nachvollziehen, wann eine Zuordnung mit welcher Schwelle anspringen würde. „Spuren, die klingen“ gilt für die Taktmitte.</p>
  <table class="t sm c">${head}${rows}</table></section>`;
}

function appendix() {
  let a = '<section class="pb"><h2>Anhang A · Alle Animationen im Katalog (jeweils als MP4 ladbar)</h2><p>Im Labor des Studios hat jede Karte den Knopf „MP4 laden“. Der Dateiname ist <code>Tonspur_Animationsname.mp4</code>. „Klangbezug“ nennt, woran die Bewegung gekoppelt ist (aus dem morphologischen Kasten); steht dort nichts, folgt die Animation nur Takt und Schlag.</p>';
  for (const t of TRACKS) {
    const cur = layerById('track:' + t.key);
    a += `<h3><i class="dot" style="background:${TCOL[t.key]}"></i>${esc(t.name)} <span class="mu">– ${(IDEAS[t.key] || []).length} Animationen</span></h3><table class="t sm cat"><tr><th>Nr.</th><th>Animation / Datei</th><th>Beschreibung und Klangbezug</th></tr>`;
    (IDEAS[t.key] || []).forEach((d, i) => {
      const id = t.key + ':' + i, rea = d.info ? d.info.map.flatMap(g => g.rows).filter(r => r.t).map(r => `${esc(r.n)} (${esc(r.v)}) ← ${esc(r.t)}`).join('; ') : '';
      a += `<tr${cur && cur.anim === id ? ' class="cur"' : ''}><td>${i + 1}</td><td><b>${esc(d.title)}</b>${cur && cur.anim === id ? ' <span class="badge on">im Projekt</span>' : ''}<br><code>${esc(ideaFile(id))}</code>${d.tag ? `<br><span class="mu">${esc(d.tag)}</span>` : ''}</td><td>${esc(d.text || '')}${rea ? `<br><span class="rea">Klangbezug: ${rea}</span>` : ''}</td></tr>`;
    });
    a += '</table>';
  }
  a += '</section><section class="pb"><h2>Anhang B · Effekte (Labor)</h2><p>Effekte füllen das ganze Bild und gehören zu keiner Tonspur. Sie laufen immer durchgehend; Dateiname <code>Effekt_Name.mp4</code>.</p>';
  for (const g of LABOR_GROUPS) {
    a += `<h3>${esc(g.g)} <span class="mu">– ${esc(g.t)}</span></h3><table class="t sm cat"><tr><th>Nr.</th><th>Effekt / Datei</th><th>Beschreibung</th></tr>`;
    for (const f of g.fx) a += `<tr><td>L${f.nr}</td><td><b>${esc(f.title)}</b>${layerById('fx:' + f.nr) ? ' <span class="badge on">im Projekt</span>' : ''}<br><code>${esc(fileSafe('Effekt_' + f.title))}.mp4</code>${f.tag ? `<br><span class="mu">${esc(f.tag)}</span>` : ''}</td><td>${esc(f.text || '')}</td></tr>`;
    a += '</table>';
  }
  const pr = PRESETS.map(p => { const m = presetMap(p), dd = describe(m); return `<tr><td>${esc(p.n)}</td><td>${esc(dd.when)}</td><td>${esc(dd.then)}</td></tr>`; }).join('');
  a += `</section><section class="pb"><h2>Anhang C · Vorlagen für Parameter-Zuordnungen</h2><p>Diese Vorlagen stehen im Studio unter „+ Parameter“ bzw. im Labor zur Auswahl (Werte = Voreinstellung der Vorlage).</p><table class="t sm"><tr><th>Vorlage</th><th>Wenn</th><th>Dann</th></tr>${pr}</table></section>`;
  return a;
}
const presetMap = p => { const d = Sig.BY[p.m.src]; return { id: 'preset:' + p.id, name: '', layer: '*', on: true, hi: d.dhi, ...p.m }; };

function secEinleitung() {
  const used = TRACKS.map(t => layerById('track:' + t.key)).filter(l => l && l.on && l.anim);
  return `<section><h2>1 · Überblick und Lieferumfang</h2>
  <p>Dieses Dokument beschreibt so genau wie möglich, <b>welche Tonspur wann im Song erscheint</b>, <b>welche Animation sie auslöst</b> und <b>wie das Bild auf den Klang reagiert</b> (Tempo, Takt, Lautstärke, Tonhöhe …). Damit lässt sich das Video aus den einzelnen MP4-Dateien und der Tonspur nachbauen.</p>
  <table class="t kv"><tr><th>Tonspur (Ton)</th><td><code>song.m4a</code> – ${n1(DUR, 3)} s, ${n1(SONG.bpm, 1)} BPM, ${SONG.beats}/4</td></tr>
  <tr><th>Videos</th><td>Eine MP4 pro Animation/Effekt, benannt <code>Tonspur_Animationsname.mp4</code> (Effekte: <code>Effekt_Name.mp4</code>)</td></tr>
  <tr><th>Format</th><td>H.264 (MP4), ${EXP.fps} Bilder pro Sekunde, 1920 × 1080 (wahlweise 1280 × 720), <b>ohne Ton</b>, ${n1(Math.ceil(DUR * EXP.fps) / EXP.fps, 2)} s lang (${Math.ceil(DUR * EXP.fps)} Bilder)</td></tr>
  <tr><th>Zeitbezug</th><td>Jedes Video beginnt bei Songzeit 0:00 und läuft bis zum Songende – alle Videos liegen also übereinander startend deckungsgleich zur Tonspur. Bild i zeigt die Songzeit i / ${EXP.fps} s.</td></tr>
  <tr><th>Sichtbarkeit im Video</th><td>Standard: „nur wo Spur klingt“ – die Animation ist nur in den Zeitfenstern aus Abschnitt 3 zu sehen, sonst bleibt das Bild schwarz. Alternativ „durchgehend“ (Option im Labor): die Animation läuft die ganze Zeit.</td></tr>
  <tr><th>Reaktion auf den Klang</th><td>Die Animationen laufen taktgenau (Schlag, Takt). Zusätzlich verändern Parameter-Zuordnungen (Abschnitt 5) Farbe, Größe, Position usw. nach Lautstärke, Tonhöhe u. a. – sofern eingeschaltet. Videos einer Tonspur-Animation enthalten die Zuordnungen, die im Projekt für diese Tonspur gelten.</td></tr></table>
  <h3>Projektstand in Kürze</h3>
  <table class="t"><tr><th>Spur</th><th>Animation</th><th>Datei</th></tr>${used.map(l => `<tr><td><i class="dot" style="background:${TCOL[l.key]}"></i>${esc(trackName(l.key))}</td><td>${esc(ideaOf(l.anim).title)}</td><td><code>${esc(ideaFile(l.anim))}</code></td></tr>`).join('')}</table>
  <p class="mu">Effekte im Projekt: ${P.layers.filter(l => l.kind === 'fx').map(l => esc(layerName(l))).join(', ') || 'keine'} · Parameter-Zuordnungen: ${P.maps.length} (${P.maps.filter(m => m.on).length} eingeschaltet)</p></section>`;
}

(async function () {
  await loadProject();
  const d = new Date();
  $('doc').innerHTML = `<header class="cover"><h1>Audio-Visualisierung – Beschreibung für das Video</h1><div class="mu">Synthwave goose – Blade Runner 2049 · Stand ${d.toLocaleDateString('de-DE')}</div></header>`
    + secEinleitung() + secSong() + secAblauf() + secEbenen() + secMaps() + secReferenz() + secMesswerte() + appendix();
  document.body.dataset.ready = '1';
})();
