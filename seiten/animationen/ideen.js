'use strict';
/* Gemeinsame Animationen (IDEAS) und parametrisierte Flöten-Versionen (FPC) – genutzt von animationen.html und zuordnung.html */
const SONG = window.SONG || { dur: 66.148, bpm: 116.1, beats: 4, offset: 0.036 };
const DUR = SONG.dur, BEAT = 60 / SONG.bpm, BAR = BEAT * SONG.beats, OFFSET = SONG.offset || 0;
// Einmalige Umstellung: „Welle läuft mit“ ist als Flöten-Idee 11 dazugekommen – gespeicherte Verweise ab flute:10 (Zuordnung, Studio, Video, Varianten) rücken eine Nummer weiter
try {
  if (!localStorage.getItem('av-flute-idx-v2')) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!/^av-/.test(k)) continue;
      const v = localStorage.getItem(k), w = v.replace(/flute:(\d+)/g, (a, d) => +d >= 10 ? 'flute:' + (+d + 1) : a);
      if (w !== v) localStorage.setItem(k, w);
    }
    localStorage.setItem('av-flute-idx-v2', '1');
  }
} catch (e) {}
// Einmalige Umstellung: „Kreis wandert im Uhrzeigersinn“ ist als Flöten-Idee 3 dazugekommen – gespeicherte Verweise ab flute:2 rücken eine Nummer weiter
try {
  if (!localStorage.getItem('av-flute-idx-v3')) {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i); if (!/^av-/.test(k)) continue;
      const v = localStorage.getItem(k), w = v.replace(/flute:(\d+)/g, (a, d) => +d >= 2 ? 'flute:' + (+d + 1) : a);
      if (w !== v) localStorage.setItem(k, w);
    }
    localStorage.setItem('av-flute-idx-v3', '1');
  }
} catch (e) {}
const BOXES = 6;                          // Kästen pro Tonspur

// Spuren: Schlüssel = Präfix der id in data.js; Namen wie in der Zeitleiste
const TRACKS = [
  { key: 'flute', name: 'Flute' }, { key: 'trumpet', name: 'Mosquito' }, { key: 'frog', name: 'Frog' }, { key: 'building', name: 'Building' },
  { key: 'riser', name: 'Riser' }, { key: 'jagd', name: 'Hunting Horn' }, { key: 'drums', name: 'Drums' }, { key: 'ring', name: 'Ringtone' },
];

/* ═════════════════════════════════════════════════════════════════════════
   ✎ HIER NEUE ANIMATIONEN EINTRAGEN
   ─────────────────────────────────────────────────────────────────────────
   Pro Spur eine Liste von Ideen. Jede Idee hat einen Titel, eine kurze
   Beschreibung und eine Zeichenfunktion draw(c, s), die in jedem Bild neu
   aufgerufen wird:
     c        – Canvas-Zeichenfläche (2D)
     s.t      – Zeit in Sekunden ab dem ersten Taktschlag (läuft mit dem Song)
     s.bar    – Länge eines Takts in Sekunden, s.beat – Länge eines Schlags
     s.phase  – Fortschritt im aktuellen Takt (0 … 1)
     s.w, s.h – Breite und Höhe des Kastens in Pixeln
     s.fg     – Zeichenfarbe (weiß auf Schwarz im Dunkel-Modus, schwarz auf Weiß im Hell-Modus)
     s.bg     – Hintergrund des Kastens, s.col – Farbe der Spur (falls doch einmal gebraucht)
   Leere Kästen werden automatisch als Platzhalter angezeigt.
   ═════════════════════════════════════════════════════════════════════════ */
// Zufall, der zu jedem Zeitpunkt immer gleich ausfällt – so bleibt es beim Abspielen und Zurückspulen synchron
// Farbe (#rrggbb) mit Deckkraft – für Verläufe
function rgba(hex, a) { const v = parseInt(String(hex).replace('#', '').slice(0, 6), 16) || 0; return `rgba(${v >> 16 & 255},${v >> 8 & 255},${v & 255},${a})`; }
function hash32(x) { x = Math.imul(x ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return x >>> 0; }
// k-te Zufallsposition aus 0 … total−1, die keiner der letzten „avoid“ Positionen gleicht (wird einmal berechnet und gemerkt)
function noRepeat(store, k, total, avoid, seed) {
  const a = store[total] || (store[total] = []);
  while (a.length <= k) {
    const i = a.length, recent = a.slice(Math.max(0, i - avoid), i); let v, tries = 0;
    do { v = hash32(i * 7919 + tries * 104729 + seed) % total; tries++; } while (tries < 60 && recent.includes(v));
    a.push(v);
  }
  return a[k];
}
// ---- Hilfen für die Ideen der anderen Spuren ----
const cl01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const eOut = p => 1 - (1 - p) * (1 - p), eIn = p => p * p, eIO = p => p * p * (3 - 2 * p);
const eBack = p => 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2;   // schießt kurz über das Ziel hinaus
const seg = (x, a, b) => cl01((x - a) / (b - a));                  // Fortschritt 0 … 1 zwischen a und b
// Schleife: Nummer des Durchlaufs und Zeit darin (off = Start des ersten Durchlaufs im Song)
function loop(t, len, off = 0) { const k = Math.floor((t - off) / len); return [k, t - off - k * len]; }
// Zufallszahl 0 … 1, fest für Durchlauf k und Nummer i – bei jedem Durchlauf neu, aber immer gleich beim Zurückspulen
const rnd = (k, i, seed = 1) => hash32(k * 9973 + i * 7919 + seed * 104729) / 4294967296;
// Kugeln, die weich miteinander verschmelzen (Metaballs): balls = [[x, y, r], …]
function metaballs(c, w, h, balls, cell) {
  if (!balls.length) return;
  const nx = Math.ceil(w / cell) + 1, ny = Math.ceil(h / cell) + 1, f = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = i * cell, y = j * cell; let v = 0;
    for (const b of balls) { const dx = x - b[0], dy = y - b[1]; v += b[2] * b[2] / (dx * dx + dy * dy + 1e-6); }
    f[j * nx + i] = v;
  }
  const v = [0, 0, 0, 0], px = [0, 0, 0, 0], py = [0, 0, 0, 0];
  c.beginPath();                                  // alles in einem Pfad → keine feinen Nähte zwischen den Zellen
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    v[0] = f[j * nx + i]; v[1] = f[j * nx + i + 1]; v[2] = f[(j + 1) * nx + i + 1]; v[3] = f[(j + 1) * nx + i];
    const n = (v[0] >= 1) + (v[1] >= 1) + (v[2] >= 1) + (v[3] >= 1);
    if (!n) continue;
    const x = i * cell, y = j * cell;
    if (n === 4) { c.rect(x, y, cell, cell); continue; }
    px[0] = x; py[0] = y; px[1] = x + cell; py[1] = y; px[2] = x + cell; py[2] = y + cell; px[3] = x; py[3] = y + cell;
    let first = true;
    const pt = (X, Y) => { if (first) { c.moveTo(X, Y); first = false; } else c.lineTo(X, Y); };
    for (let q = 0; q < 4; q++) {
      const a = q, b = (q + 1) & 3, ia = v[a] >= 1, ib = v[b] >= 1;
      if (ia) pt(px[a], py[a]);
      if (ia !== ib) { const u = (1 - v[a]) / (v[b] - v[a]); pt(px[a] + (px[b] - px[a]) * u, py[a] + (py[b] - py[a]) * u); }
    }
    c.closePath();
  }
  c.fill();
}
// Frog-Ablauf in Schlägen (¼-Takten), gedacht als 6 · 2 · 4 · 4 = 4 Takte, ab dem ersten Frog-Einsatz (Takt 9) immer wieder von vorn.
// Die beiden 4er-Abschnitte beginnen etwas früher (nach 7½ und 11½ Schlägen) – so liegt der letzte Wechsel auf dem neuen Frog-Ton im Song.
// Zum Feinjustieren nur diese Zahlen ändern (Summe muss 16 bleiben).
const FROG_SEQ = [6, 1.5, 4, 4.5];
const FROG_KEEP = .2;                    // bei Wechseln innerhalb der Sequenz bleibt so viel vom Erreichten stehen; zu Beginn jeder Sequenz ist nichts zu sehen
const FROG_LVL = (() => {                 // Wachstum am Anfang / Ende jedes Abschnitts (eingeschwungen über mehrere Durchläufe)
  const n = FROG_SEQ.length, S = [], E = []; let e = 0;
  for (let r = 0; r < 6; r++) for (let j = 0; j < n; j++) { S[j] = j ? FROG_KEEP * e : 0; e = Math.min(1, S[j] + FROG_SEQ[j] / 6); E[j] = e; }   // S[0] = 0: jede Sequenz beginnt bei null
  return { S, E };
})();
// p = Zeit im Abschnitt, len = Länge des Abschnitts, L = 6 Schläge (Bezug fürs Wachsen),
// g = Wachstum 0 … 1: steigt im Abschnitt, fällt beim Wechsel weich (in knapp einem halben Schlag) auf einen Teil zurück
function frogSeq(s) {
  const B = s.beat, n = FROG_SEQ.length, [k, q] = loop(s.t, 16 * B, s.bar * 8);
  let a = 0, i = 0;
  while (i < n - 1 && q >= (a + FROG_SEQ[i]) * B) { a += FROG_SEQ[i]; i++; }
  const p = q - a * B, L = 6 * B, prev = (window.IDEEN_GATE && i === 0 && k <= 0) ? 0 : FROG_LVL.E[(i + n - 1) % n];   // der allererste Einsatz startet bei null (nicht mit dem Ende des Durchlaufs davor)
  const raw = Math.min(1, FROG_LVL.S[i] + p / L);
  return { p, len: FROG_SEQ[i] * B, L, k: k * n + i, g: (window.IDEEN_GATE && k < 0) ? 0 : prev + (raw - prev) * eIO(seg(p, 0, B * .45)), gn: raw, rs: (i === 0 && k > 0) ? seg(p, 0, B * 1.2) : 1 };   // gn = Wachstum ohne Rückfall, rs < 1 = Neustart der Sequenz (altes Bild blendet aus)   // vor dem ersten Frog-Einsatz (k < 0): nichts
}
// Mosquito-Ablauf in Schlägen (¼-Takten), 16 Schläge = 4 Takte ab dem ersten Mosquito-Einsatz (Takt 9), dann von vorn:
// 3 Ton · 3 Pause · 2 Ton (der nächste setzt kurz vor Ende ein) · 2 Ton · 2 Pause · 3 Ton · 1 Pause.  [Beginn, Länge] je Ton:
const MOSQ_NOTES = [[0, 3], [6, 1.75], [7.75, 2.25], [12, 3]];
// on = klingt gerade ein Ton? · p = Zeit seit Tonbeginn · len = Länge des Tons
function mosqSeq(s) {
  const B = s.beat, [k, q] = loop(s.t, 16 * B, s.bar * 8), qb = q / B;
  for (let i = MOSQ_NOTES.length - 1; i >= 0; i--) {
    const [a, l] = MOSQ_NOTES[i];
    if (qb >= a) return { on: qb < a + l, p: q - a * B, len: l * B, k: k * MOSQ_NOTES.length + i };
  }
  return { on: false, p: 0, len: B, k: 0 };
}
// Ablauf der Mosquito-Ideen „Stern“ und „Balken“: ein einziges, stetiges Kleinerwerden vom Tonanfang bis es nach dem Ton ganz weg ist (soweit die Pause reicht),
// ohne Halten und ohne Ausblenden. Beim 2. der 2 + 2 wächst die Form kurz vor dem Ton wieder auf 70 % und schrumpft von dort erneut.
// v = Größe 0 … 1 · pop = Aufspringen am Tonanfang · null = nichts zu sehen
function mosqRun(s) {
  const B = s.beat, N = MOSQ_NOTES.length, [, q] = loop(s.t, 16 * B, s.bar * 8), qb = q / B;
  let i = N - 1; while (i > 0 && qb < MOSQ_NOTES[i][0]) i--;
  const L = MOSQ_NOTES[i][1], b = qb - MOSQ_NOTES[i][0];
  const gap = (i === N - 1 ? 16 : MOSQ_NOTES[i + 1][0]) - MOSQ_NOTES[i][0] - L, tot = Math.min(1.7, gap);
  const span = L + (i === 1 ? .6 : tot), curve = (x, sp) => Math.pow(1 - cl01(x / sp), 1.3);   // stetig kleiner, kein Anhalten
  if (b >= span) return null;
  const RB = .15, S1 = MOSQ_NOTES[1][1] + .6, v1 = curve(MOSQ_NOTES[1][1] - RB, S1), AGAIN = .7;
  let v;
  if (i === 1 && b - L > -RB) v = v1 + (AGAIN - v1) * eIO(seg(b - L, -RB, RB));              // kurz vor dem 2. Ton: wieder größer
  else if (i === 2) v = b < RB ? v1 + (AGAIN - v1) * eIO(seg(b, -RB, RB)) : AGAIN * curve(b - RB, span - RB);
  else v = curve(b, span);
  return { i, b, v, pop: i === 2 ? 1 : eBack(seg(b, 0, .3)), pop2: i === 2 ? 1 : eBack(seg(b, 0, .18)) };   // Balken schießt in einem Wimpernschlag von unten hoch und schwingt kurz über
}
// Linie aus Punkten zeichnen
function polyline(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
// Ringtone: Punkte laufen wie bei „Spalten“ (6 neue pro Takt, die 4 ältesten gehen) an einer Spirale entlang – nach innen oder nach außen
function ringSpiral(c, s, inward) {
  const CYC = 8, TOT = CYC * 6, m0 = Math.min(s.w, s.h), Rmax = m0 * .46, Q = .949, turn = Math.PI * 2 / 14;
  const first = Math.round((DUR - CYC * s.bar) / s.bar);                         // die Spur umfasst die letzten 8 Takte des Songs
  const bt = ((((s.t / s.bar - first) % CYC) + CYC) % CYC) * 4;                  // Schläge ab Beginn des ersten Takts (davor/danach als Schleife)
  const T = [.5, .75, 1.5, 1.75, 2.5, 2.75];
  c.fillStyle = s.fg;
  for (let g = 0; g < TOT; g++) {
    const cy = Math.floor(g / 6), tA = cy * 4 + T[g % 6];                        // taucht einfach auf: Mitte des Schlags, der zweite eine 16tel später
    if (bt < tA) continue;
    const tO = Math.floor(g / 4) * 4 + 3 + (g % 4) / 4, f = eIn(seg(bt, tO, tO + .3));   // die vier ältesten gehen im 4. Schlag auf je einer 16tel
    if (f >= 1) continue;
    // Platz u auf der Spirale: nach innen läuft die Reihe von außen zur Mitte, nach außen von der Mitte zum Rand
    const u = (inward ? g : TOT - 1 - g) + (inward ? -1 : 1) * 5 * f;           // beim Gehen rutscht der Punkt an der Spirale zurück (nach außen bzw. in die Mitte)
    const R = Rmax * Math.pow(Q, u), a = -Math.PI / 2 + u * turn, rr = Math.max(m0 * .007, R * .085);
    c.beginPath(); c.arc(s.w / 2 + Math.cos(a) * R, s.h / 2 + Math.sin(a) * R, rr, 0, Math.PI * 2); c.fill();
  }
}
const IDEAS = {
  flute: [
    {
      title: 'Fallender Kreis mit Nachbildern',
      text: '1. halber Takt: 8 Kugeln fallen nacheinander (im 16tel) von oben in die Mitte, die Kugel dort wird mit jeder kräftiger. 2. halber Takt: 8 Kugeln fliegen von der Mitte nach unten aus dem Bild, die Mitte verblasst. Dann beginnt es oben neu – 1 Durchlauf = 1 Takt.',
      tag: '8 Kugeln / ½ Takt',
      draw(c, s) {
        const N = 8, T = s.bar / 2, step = T / N;       // halber Takt, darin 8 Kugeln im Abstand einer 16tel
        const D = T * .3;                               // Flugzeit einer Kugel von Stufe zu Stufe
        const r = Math.min(s.w, s.h) * .065, x = s.w / 2;
        const P = [-r, s.h * .5, s.h + r];              // oben (unsichtbar) → Mitte → unten raus
        const L = P.length - 1;                          // Übergänge pro Durchlauf (= halbe Takte)
        const mod = (a, n) => ((a % n) + n) % n;
        const n = Math.floor(s.t / T);
        // Kugel i des halben Takts m startet bei m·T + i·16tel − D und landet genau auf ihrer 16tel (die erste auf dem Schlag)
        const landed = m => clamp(Math.floor((s.t - m * T) / step) + 1, 0, N);
        const departed = m => clamp(Math.floor((s.t - m * T + D) / step) + 1, 0, N);
        c.fillStyle = s.fg;
        // Mitte: wie voll ist die Kugel dort gerade?
        for (let st = 1; st < L; st++) {
          let mf = n + 1 - mod(n + 1 - (st - 1), L);      // letzter halber Takt, der diese Stufe füllt
          if (mf * T - D > s.t) mf -= L;
          const o = (landed(mf) - departed(mf + 1)) / N;
          if (o <= 0) continue;
          c.globalAlpha = Math.min(1, o);
          c.beginPath(); c.arc(x, P[st], r, 0, Math.PI * 2); c.fill();
        }
        // Kugeln im Flug
        for (let m = n - 1; m <= n + 1; m++) {
          const q = mod(m, L), y0 = P[q], y1 = P[q + 1];
          for (let i = 0; i < N; i++) {
            const t0 = m * T + i * step - D;
            if (s.t < t0 || s.t >= t0 + D) continue;
            const p = (s.t - t0) / D;
            c.globalAlpha = .4;
            c.beginPath(); c.arc(x, y0 + (y1 - y0) * p * p, r, 0, Math.PI * 2); c.fill();
          }
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Kreis zieht sich zusammen',
      text: '8 Kugeln im Kreis. 1. halber Takt: eine nach der anderen (im 16tel) wandert zur Mitte, dort entsteht mit jeder ein kräftigerer Punkt. 2. halber Takt: sie wandern wieder nach außen, der Punkt verblasst. 1 Durchlauf = 1 Takt.',
      tag: '1 Durchlauf / Takt',
      draw(c, s) {
        const N = 8, T = s.bar / 2, step = T / N;       // halber Takt, darin 8 Kugeln im Abstand einer 16tel
        const D = T * .3;                               // Weg rein: Kreis → Mitte
        const EARLY = step * .5;                        // raus: jede Kugel startet eine halbe 16tel früher – kürzere Pause, wenn alle in der Mitte sind
        const m0 = Math.min(s.w, s.h), r = m0 * .055, R = m0 * .33, cx = s.w / 2, cy = s.h / 2;
        const ang = i => -Math.PI / 2 + i * Math.PI * 2 / N;        // im Uhrzeigersinn, oben beginnend
        const ball = (x, y, a) => { c.globalAlpha = a; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
        const t = s.t, n = Math.floor(t / T);
        // rein: Kugel i kommt genau auf ihrer 16tel in der Mitte an · raus: Kugel i verlässt die Mitte eine halbe 16tel vor ihrer 16tel
        const arrived = m => clamp(Math.floor((t - m * T) / step) + 1, 0, N);
        const left = m => clamp(Math.floor((t - m * T + EARLY) / step) + 1, 0, N);
        c.fillStyle = s.fg;
        // Punkt in der Mitte: jede ankommende Kugel +1/8, jede abfliegende −1/8
        let mi = n - ((n % 2) + 2) % 2 + 2;              // letzter „nach innen“-Halbtakt (gerade Nummern)
        while (mi * T - D > t) mi -= 2;
        const o = (arrived(mi) - left(mi + 1)) / N;
        if (o > 0) ball(cx, cy, Math.min(1, o));
        // Kugeln auf dem Kreis (fehlen, solange sie unterwegs oder in der Mitte sind)
        const cyc = Math.floor((t + D) / (2 * T));
        for (let i = 0; i < N; i++) {
          const away = k => t >= 2 * k * T + i * step - D && t < (2 * k + 1) * T + i * step - EARLY + D;
          if (away(cyc) || away(cyc - 1)) continue;
          ball(cx + Math.cos(ang(i)) * R, cy + Math.sin(ang(i)) * R, .45);
        }
        // Kugeln unterwegs
        for (let m = n - 1; m <= n + 1; m++) {
          const inward = ((m % 2) + 2) % 2 === 0;
          for (let i = 0; i < N; i++) {
            const t0 = m * T + i * step - (inward ? D : EARLY);
            if (t < t0 || t >= t0 + D) continue;
            const p = (t - t0) / D, k = inward ? 1 - p * p : 1 - (1 - p) * (1 - p);   // rein: beschleunigt, raus: bremst ab
            ball(cx + Math.cos(ang(i)) * R * k, cy + Math.sin(ang(i)) * R * k, .45);
          }
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Kreis wandert im Uhrzeigersinn',
      text: 'Wie „Kreis zieht sich zusammen“, nur dass die Kugeln nicht zurück in die Mitte gehen: Oben öffnet sich eine Kugel, 8 Kugeln gehen nacheinander (im 16tel) im Kreis nach außen – oben beginnend, im Uhrzeigersinn. Im nächsten halben Takt fliegen sie in die rechte Kugel dieses Kreises, die dabei kräftiger wird. Von dort öffnen sie sich wieder und fliegen dann in die Kugel rechts unten, dann unten, links unten … So wandert die Mitte Takt für Takt einmal im Uhrzeigersinn ringsherum; nach 8 Takten schließt sich der Kreis oben wieder.',
      tag: '1 Schritt / Takt · 8 Takte rundherum',
      draw(c, s) {
        const N = 8, T = s.bar / 2, step = T / N;       // halber Takt, darin 8 Kugeln im Abstand einer 16tel
        const D = T * .3, EARLY = step * .5;            // Flugzeit wie bei „Kreis zieht sich zusammen“; raus startet eine halbe 16tel früher
        const m0 = Math.min(s.w, s.h), R = m0 * .2, r = m0 * .04;
        const dir = i => -Math.PI / 2 + i * Math.PI / 4;   // 8 Richtungen im Uhrzeigersinn, oben beginnend
        const ap = R / (2 * Math.tan(Math.PI / 8));     // Die Mitte wandert auf einem Achteck mit Seitenlänge R (= Abstand Mitte → Kugel)
        const H = j => {                                 // Mitte Nr. j: Start oben (obere Kante des Achtecks), dann rechts, rechts unten, unten …
          j = ((j % 8) + 8) % 8; let x = s.w / 2 - R / 2, y = s.h / 2 - ap;
          for (let q = 0; q < j; q++) { x += Math.cos(dir(2 + q)) * R; y += Math.sin(dir(2 + q)) * R; }
          return [x, y];
        };
        const ball = (x, y, a) => { c.globalAlpha = a; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
        const lerp = (A, B, k) => [A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k];
        const t = s.t, n = Math.floor(t / T), K = Math.floor(n / 2);   // Takt K: 1. halber Takt öffnen, 2. halber Takt zur nächsten Mitte
        const arrived = m => clamp(Math.floor((t - m * T) / step) + 1, 0, N);
        const left = m => clamp(Math.floor((t - m * T + EARLY) / step) + 1, 0, N);
        c.fillStyle = s.fg;
        for (let k = K - 1; k <= K + 1; k++) {
          const h = H(k), nx = H(k + 1), ring = i => [h[0] + Math.cos(dir(i)) * R, h[1] + Math.sin(dir(i)) * R];
          const o = (arrived(2 * k - 1) - left(2 * k)) / N;   // Mitte: jede ankommende Kugel +1/8, jede abfliegende −1/8
          if (o > 0) ball(h[0], h[1], Math.min(1, o));
          for (let i = 0; i < N; i++) {
            const o0 = 2 * k * T + i * step - EARLY, o1 = o0 + D;                 // raus: Mitte → Kreis (bremst ab)
            const c0 = (2 * k + 1) * T + i * step - D, c1 = c0 + D;               // rein: Kreis → nächste Mitte (beschleunigt)
            if (t >= o0 && t < o1) { const p = (t - o0) / D; ball(...lerp(h, ring(i), 1 - (1 - p) * (1 - p)), .45); }
            else if (t >= o1 && t < c0) ball(...ring(i), .45);
            else if (t >= c0 && t < c1) { const p = (t - c0) / D; ball(...lerp(ring(i), nx, p * p), .45); }
          }
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Kugel wandert im Kreis',
      text: '8 Plätze im Kreis. Pro halben Takt wandert die Kugel einen Platz weiter im Uhrzeigersinn – wie bei Idee 1: 8 Nachbilder ziehen im 16tel hinüber, der neue Platz wird mit jedem kräftiger, der alte blasser. Eine Runde dauert 4 Takte.',
      tag: '1 Platz / ½ Takt',
      draw(c, s) {
        const N = 8, P = 8, T = s.bar / 2, step = T / N;   // 8 Nachbilder pro halben Takt (16tel), 8 Plätze im Kreis
        const D = T * .3;                               // Flugzeit eines Nachbilds von Platz zu Platz
        const m0 = Math.min(s.w, s.h), r = m0 * .048, R = m0 * .38, cx = s.w / 2, cy = s.h / 2;
        const mod = (a, n) => ((a % n) + n) % n;
        const at = pos => { const a = -Math.PI / 2 + pos * Math.PI * 2 / P; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; };
        const ball = (pos, al) => { const [x, y] = at(pos); c.globalAlpha = al; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
        const t = s.t, n = Math.floor(t / T);
        // wie bei Idee 1: Nachbild i des halben Takts m startet bei m·T + i·16tel − D und landet genau auf seiner 16tel
        const landed = m => clamp(Math.floor((t - m * T) / step) + 1, 0, N);
        const departed = m => clamp(Math.floor((t - m * T + D) / step) + 1, 0, N);
        c.fillStyle = s.fg;
        // Plätze: halber Takt m bringt die Kugel von Platz m nach Platz m+1 (alles im Kreis, modulo 8)
        for (const m of [n - 1, n, n + 1]) {
          const o = (landed(m) - departed(m + 1)) / N;  // Platz m+1: gefüllt in m, geleert in m+1
          if (o > 0) ball(m + 1, Math.min(1, o));
        }
        // Nachbilder unterwegs, auf dem Kreisbogen
        for (let m = n - 1; m <= n + 1; m++) {
          for (let i = 0; i < N; i++) {
            const t0 = m * T + i * step - D;
            if (t < t0 || t >= t0 + D) continue;
            const p = (t - t0) / D;
            ball(m + p * p * (3 - 2 * p), .4);         // weich vom alten zum neuen Platz
          }
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: '4 Kugeln wandern im Kreis',
      text: 'Wie Idee 4, aber mit 4 Kugeln auf jedem zweiten Platz. Pro halben Takt wandern alle gleichzeitig einen Platz weiter im Uhrzeigersinn – jeweils 8 Nachbilder im 16tel, der neue Platz wird kräftiger, der alte blasser.',
      tag: '1 Platz / ½ Takt',
      draw(c, s) {
        const N = 8, P = 8, T = s.bar / 2, step = T / N;   // 8 Nachbilder pro halben Takt (16tel), 8 Plätze im Kreis
        const D = T * .3;                               // Flugzeit eines Nachbilds von Platz zu Platz
        const m0 = Math.min(s.w, s.h), r = m0 * .048, R = m0 * .38, cx = s.w / 2, cy = s.h / 2;
        const at = pos => { const a = -Math.PI / 2 + pos * Math.PI * 2 / P; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; };
        const ball = (pos, al) => { const [x, y] = at(pos); c.globalAlpha = al; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
        const t = s.t, n = Math.floor(t / T);
        const landed = m => clamp(Math.floor((t - m * T) / step) + 1, 0, N);
        const departed = m => clamp(Math.floor((t - m * T + D) / step) + 1, 0, N);
        c.fillStyle = s.fg;
        const B = [0, 2, 4, 6];                        // Kugeln auf jedem zweiten Platz
        // wie Idee 4, für jede der 4 Kugeln: halber Takt m bringt sie einen Platz weiter
        for (const m of [n - 1, n, n + 1]) {
          const o = (landed(m) - departed(m + 1)) / N;
          if (o > 0) for (const b of B) ball(b + m + 1, Math.min(1, o));
        }
        // Nachbilder unterwegs – bei allen 4 Kugeln gleichzeitig
        for (let m = n - 1; m <= n + 1; m++) {
          for (let i = 0; i < N; i++) {
            const t0 = m * T + i * step - D;
            if (t < t0 || t >= t0 + D) continue;
            const p = (t - t0) / D, d = p * p * (3 - 2 * p);
            for (const b of B) ball(b + m + d, .4);
          }
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Kreis in der Mitte wächst',
      text: '16 kleine Kugeln im Kreis. Pro halben Takt wandert eine – in zufälliger Reihenfolge – mit 8 Nachbildern (im 16tel) zur Mitte. Die Nachbilder werden auf dem Weg immer größer, bis sie genau so groß sind wie der Kreis in der Mitte, der mit jeder Kugel wächst. Nach 8 Takten von vorn.',
      tag: '16 Kugeln · 8 Takte',
      draw(c, s) {
        const N = 8, K = 16, T = s.bar / 2, step = T / N;  // 8 Nachbilder pro halben Takt, 16 Kugeln = 16 halbe Takte
        const D = T * .3;                               // Flugzeit eines Nachbilds zur Mitte
        const ORDER = [5, 12, 1, 9, 14, 3, 10, 7, 0, 13, 6, 2, 11, 15, 4, 8];   // Reihenfolge – bewusst durcheinander
        const m0 = Math.min(s.w, s.h), r = m0 * .032, R = m0 * .4, cx = s.w / 2, cy = s.h / 2;
        const t = s.t;
        const at = (pos, k = 1) => { const a = -Math.PI / 2 + pos * Math.PI * 2 / K; return [cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k]; };
        const dot = (x, y, rad, al) => { c.globalAlpha = al; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill(); };
        const cyc = Math.floor(t / (K * T)), S0 = cyc * K * T;   // alter Durchlauf bleibt bis zum letzten Schlag stehen
        const start = (m, i) => Math.max(S0, m * T + i * step - D);   // die ersten starten genau auf dem ersten Schlag
        const landed = m => clamp(Math.floor((t - m * T) / step) + 1, 0, N);
        let departed = m => { let k = 0; for (let i = 0; i < N; i++) if (start(m, i) <= t) k++; return k; };
        const centerR = mass => r * 1.35 * Math.sqrt(Math.max(1, mass));   // Kreis in der Mitte: Fläche wächst mit jeder Kugel
        c.fillStyle = s.fg;
        let mass = 0;
        for (let j = 0; j < K; j++) { const m = cyc * K + j; if (start(m, 0) <= t) mass += landed(m) / N; }
        const Rc = centerR(mass);
        for (let j = 0; j < K; j++) {
          const m = cyc * K + j, pos = ORDER[j];
          const live = start(m, 0) <= t;               // hat diese Kugel schon angefangen zu wandern?
          const o = 1 - (live ? departed(m) : 0) / N;   // voll – mit jedem Nachbild blasser
          const [x, y] = at(pos);
          if (o > 0) dot(x, y, r, o);
          if (live) for (let i = 0; i < N; i++) {      // Nachbilder: beschleunigen zur Mitte und weiten sich dabei wie ein Trichter
            const t0 = start(m, i), land = m * T + i * step;
            if (t < t0 || t >= land) continue;
            const p = (t - t0) / (land - t0), e = p * p, [px, py] = at(pos, 1 - e);
            dot(px, py, r + (Rc - r) * e, .4);
          }
        }
        if (mass > 0) dot(cx, cy, Rc, 1);
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Tonleiter',
      text: 'Wie Idee 1, aber als absteigende Tonleiter in 8 Spalten: Pro halben Takt fällt in der nächsten Spalte rechts eine Kugel herunter (8 Nachbilder im 16tel), jede eine Stufe tiefer als die davor. Sobald die nächste anfängt, fällt die vorige weiter nach unten raus. Nach der 8. Spalte (4 Takte) geht es links oben weiter.',
      tag: '8 Stufen · 4 Takte',
      draw(c, s) {
        const N = 8, COLS = 8, T = s.bar / 2, step = T / N;   // 8 Nachbilder pro halben Takt, 8 Spalten = 8 halbe Takte
        const D = T * .3;                               // Flugzeit eines Nachbilds
        const t = s.t, n = Math.floor(t / T);
        const gap = s.w / COLS, r = Math.min(gap * .32, s.h * .055);
        const X = j => gap * (j + .5);
        const hi = s.h * .22, lo = s.h * .78;           // oberste (links) und unterste (rechts) Stufe
        const Y = j => hi + (lo - hi) * j / (COLS - 1); // jede Spalte eine Stufe tiefer (Tonleiter abwärts)
        const out = s.h + r;                            // unten aus dem Bild
        const dot = (x, y, al) => { c.globalAlpha = al; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
        const mod = (a, k) => ((a % k) + k) % k;
        // wie bei Idee 1: Nachbild i des halben Takts m startet bei m·T + i·16tel − D und landet genau auf seiner 16tel
        const landed = m => clamp(Math.floor((t - m * T) / step) + 1, 0, N);
        const departed = m => clamp(Math.floor((t - m * T + D) / step) + 1, 0, N);
        c.fillStyle = s.fg;
        for (let m = n - 2; m <= n + 1; m++) {          // halber Takt m gehört zu Spalte m mod 8
          if (m < 0) continue;                          // vor Songbeginn gab es noch keine Kugel – beim Start nur oben links
          const j = mod(m, COLS), x = X(j), y = Y(j);
          const o = (landed(m) - departed(m + 1)) / N;  // gefüllt in m, im nächsten halben Takt fällt sie raus
          if (o > 0) dot(x, y, Math.min(1, o));
          for (let i = 0; i < N; i++) {
            const tIn = m * T + i * step - D, tOut = (m + 1) * T + i * step - D;
            if (t >= tIn && t < tIn + D) { const p = (t - tIn) / D; dot(x, -r + (y + r) * p * p, .4); }     // von oben herein
            if (t >= tOut && t < tOut + D) { const p = (t - tOut) / D; dot(x, y + (out - y) * p * p, .4); } // weiter nach unten raus
          }
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Punkte leuchten auf',
      text: 'Pro halben Takt leuchten 8 zufällige Punkte nacheinander auf (im 16tel) und dunkeln langsam wieder ab. Eine Stelle, die noch nachleuchtet, wird nicht erneut gewählt.',
      tag: '8 Punkte / ½ Takt',
      picks: {},
      draw(c, s) {
        const step = s.bar / 16;                        // ein Punkt pro 16tel = 8 pro halben Takt
        const glow = step * 14;                         // so lange dunkelt ein Punkt nach (knapp 2 halbe Takte)
        const cols = 11, gap = s.w / cols, rows = Math.max(3, Math.round(s.h / gap));
        const gy = s.h / rows, r = Math.min(gap, gy) * .27, total = cols * rows;
        const pos = i => [gap * (i % cols + .5), gy * (Math.floor(i / cols) + .5)];
        const avoid = Math.ceil(glow / step);           // solange ein Punkt noch zu sehen ist, wird er nicht wieder gewählt
        c.fillStyle = s.fg;
        const k0 = Math.floor(s.t / step);
        for (let k = Math.max(0, k0 - avoid); k <= k0; k++) {     // vor Songbeginn leuchtet nichts
          const age = s.t - k * step; if (age < 0 || age > glow) continue;
          const f = 1 - age / glow, a = f * f;          // hell aufleuchten, dann langsam abdunkeln
          const [x, y] = pos(noRepeat(this.picks, k, total, avoid, 7));
          c.globalAlpha = a;
          c.beginPath(); c.arc(x, y, r * (.85 + .25 * a), 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Linien ziehen sich auf',
      text: '1. halber Takt: 8 Linien ziehen sich nacheinander (im 16tel) an zufälligen Stellen von oben nach unten auf und bleiben stehen. 2. halber Takt: in derselben Reihenfolge verschwinden sie wieder von oben nach unten. Dann neue Linien.',
      tag: '8 Linien / ½ Takt',
      picks: {},
      draw(c, s) {
        const N = 8, T = s.bar / 2, step = T / N;       // 8 Linien pro halben Takt, eine pro 16tel
        const D = step * 2.5;                           // so lange braucht eine Linie, um sich von oben bis unten aufzuziehen
        const lanes = 18, lw = Math.max(2.5, s.w * .012);
        const ease = p => 1 - (1 - p) * (1 - p);       // schießt los und bremst unten ab
        const cyc = Math.floor(s.t / (2 * T));          // 1 Durchlauf = 1 Takt: aufziehen, dann wegziehen
        c.strokeStyle = s.fg; c.lineWidth = lw; c.lineCap = 'butt'; c.globalAlpha = 1;
        for (const k of [cyc - 1, cyc]) {
          if (k < 0) continue;                          // vor Songbeginn keine Linien
          const t0 = k * 2 * T;
          for (let i = 0; i < N; i++) {
            const tIn = t0 + i * step, tOut = t0 + T + i * step;
            if (s.t < tIn || s.t >= tOut + D) continue;
            const head = s.h * ease(clamp((s.t - tIn) / D, 0, 1));    // unteres Ende: wächst nach unten
            const tail = s.h * ease(clamp((s.t - tOut) / D, 0, 1));   // oberes Ende: wandert hinterher und lässt sie verschwinden
            if (head <= tail) continue;
            const x = (noRepeat(this.picks, k * N + i, lanes, N, 3) + .5) * s.w / lanes;   // 8 verschiedene Stellen pro Durchlauf
            c.beginPath(); c.moveTo(x, tail); c.lineTo(x, head); c.stroke();
          }
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Kugeln sammeln sich',
      text: '72 hellgraue Kugeln, zufällig verteilt. Pro halben Takt fliegen 8 zufällige Kugeln nacheinander (im 16tel) zu einer anderen Kugel, die mit jeder dunkler wird. Nach zwei Durchgängen (2 × 8 halbe Takte) fliegen die dunklen Kugeln schnell in die Mitte und von dort zieht sich das ganze Feld schwarz auf. Dann von vorn.',
      tag: '2 × 4 Takte + Finale',
      layouts: {},
      draw(c, s) {
        const N = 8, G = 8, T = s.bar / 2, step = T / N;   // 8 Kugeln pro halben Takt, 8 Gruppen = 8 halbe Takte
        const TOTAL = G * (N + 1);                      // 72 Kugeln: 8 Ziele + 64, die hinfliegen
        const ROUNDS = 2, FIN = 2;                      // 2 Durchgänge, danach 1 Takt Finale (2 halbe Takte)
        const SUPER = (ROUNDS * G + FIN) * T;           // ein ganzer Ablauf: 9 Takte
        const D = T * .3, GREY = .22;                   // Flugzeit · Helligkeit der grauen Kugeln
        const t = s.t, r = Math.min(s.w, s.h) * .026, cx = s.w / 2, cy = s.h / 2;
        if (t < 0) return;
        const sup = Math.floor(t / SUPER), tt = t - sup * SUPER;
        const layout = key => this.layouts[key] || (this.layouts[key] = (() => {   // zufällige, sich nicht überlappende Verteilung
          const pts = [], seed = (key + 11) * 7717;
          for (let tries = 0; pts.length < TOTAL && tries < 6000; tries++) {
            const x = .05 + .9 * hash32(seed + tries * 2) / 4294967296, y = .06 + .88 * hash32(seed + tries * 2 + 1) / 4294967296;
            if (pts.every(p => Math.hypot(p[0] - x, p[1] - y) > (tries < 4000 ? .085 : .06))) pts.push([x, y]);
          }
          for (let q = 0; pts.length < TOTAL; q++) pts.push([hash32(seed - q * 3) / 4294967296, hash32(seed - q * 3 - 1) / 4294967296]);
          const ord = pts.map((_, i) => i);             // zufällige Reihenfolge: zuerst 8 Ziele, dann je 8 Kugeln pro Ziel
          for (let i = ord.length - 1; i > 0; i--) { const j = hash32(seed + 999 + i) % (i + 1); [ord[i], ord[j]] = [ord[j], ord[i]]; }
          return { pts, targets: ord.slice(0, G), movers: ord.slice(G) };
        })());
        const dot = (x, y, al) => { c.globalAlpha = al; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
        c.fillStyle = s.fg;
        const rd = Math.min(ROUNDS - 1, Math.floor(tt / (G * T)));   // aktueller Durchgang (im Finale: der letzte)
        const L = layout(sup * ROUNDS + rd), P = i => [L.pts[i][0] * s.w, L.pts[i][1] * s.h];
        if (tt >= ROUNDS * G * T) {                     // ---- Finale ----
          const f = tt - ROUNDS * G * T;
          const fly = T * .35;                          // die dunklen Kugeln schießen in die Mitte
          if (f < fly) {
            const e = (f / fly) ** 2;
            for (const id of L.targets) { const [x, y] = P(id); dot(x + (cx - x) * e, y + (cy - y) * e, 1); }
          } else {                                      // von der Mitte aus zieht sich das Feld zu
            const p = clamp((f - fly) / (FIN * T * .85 - fly), 0, 1), Rmax = Math.hypot(cx, cy) + 2;
            const rad = r + (Rmax - r) * p * p;
            c.globalAlpha = 1; c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.fill();
          }
          c.globalAlpha = 1;
          return;
        }
        // ---- Durchgang: 8 halbe Takte, je 8 Kugeln fliegen zu einem Ziel, das mit jeder dunkler wird ----
        const S0 = rd * G * T;
        const gone = new Set(), hits = new Array(G).fill(0), flying = [];
        for (let g = 0; g < G; g++) for (let i = 0; i < N; i++) {
          const id = L.movers[g * N + i], land = S0 + g * T + i * step;   // landet genau auf seiner 16tel
          const t0 = Math.max(S0, land - D);           // die ersten starten genau auf dem ersten Schlag
          if (tt < t0) continue;
          gone.add(id);
          if (tt >= land) hits[g]++; else flying.push([id, g, (tt - t0) / (land - t0)]);
        }
        L.movers.forEach(id => { if (!gone.has(id)) { const [x, y] = P(id); dot(x, y, GREY); } });
        L.targets.forEach((id, g) => { const [x, y] = P(id); dot(x, y, GREY + (1 - GREY) * hits[g] / N); });
        for (const [id, g, p] of flying) {             // unterwegs: gleichmäßiges Tempo, Ankunft genau auf der 16tel
          const [x0, y0] = P(id), [x1, y1] = P(L.targets[g]), e = p;
          dot(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, GREY);
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Kugeln auf der Welle',
      text: '8 Plätze auf einer Wellenlinie, auf jedem zweiten eine Kugel. Pro halben Takt rücken alle einen Platz nach rechts – wie bei Idee 4/5 mit 8 Nachbildern im 16tel. Rechts raus, links wieder rein.',
      tag: '1 Platz / ½ Takt',
      draw(c, s) {
        const N = 8, P = 8, T = s.bar / 2, step = T / N;   // 8 Nachbilder pro halben Takt (16tel), 8 Plätze auf der Welle
        const D = T * .3;                               // Flugzeit eines Nachbilds von Platz zu Platz
        const gap = s.w / P, r = Math.min(gap * .3, s.h * .07), A = s.h * .26, mid = s.h / 2;
        const at = pos => [(pos + .5) * gap, mid - A * Math.sin(pos / P * Math.PI * 2)];   // Wellenlinie, eine volle Welle über die Breite
        const ball = (pos, al) => { const [x, y] = at(pos); c.globalAlpha = al; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
        const mod = (a, k) => ((a % k) + k) % k;
        const t = s.t, n = Math.floor(t / T);
        const landed = m => clamp(Math.floor((t - m * T) / step) + 1, 0, N);
        const departed = m => clamp(Math.floor((t - m * T + D) / step) + 1, 0, N);
        const B = [0, 2, 4, 6];                        // Kugeln auf jedem zweiten Platz
        c.fillStyle = s.fg;
        for (const m of [n - 1, n, n + 1]) {            // wie Idee 4: halber Takt m bringt jede Kugel einen Platz weiter
          const o = (landed(m) - departed(m + 1)) / N;
          if (o > 0) for (const b of B) ball(mod(b + m + 1, P), Math.min(1, o));
        }
        for (let m = n - 1; m <= n + 1; m++) {          // Nachbilder: entlang der Welle zum nächsten Platz (am rechten Rand raus)
          for (let i = 0; i < N; i++) {
            const t0 = m * T + i * step - D;
            if (t < t0 || t >= t0 + D) continue;
            const p = (t - t0) / D, d = p * p * (3 - 2 * p);
            for (const b of B) ball(mod(b + m, P) + d, .4);
          }
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Welle läuft mit',
      text: 'Wie „Kugeln auf der Welle“, aber die Kugeln starten links: Zuerst kommt eine Kugel von links herein, jeden Takt folgt die nächste. Pro halben Takt rückt jede einen Platz weiter (8 Nachbilder im 16tel) – immer von unten nach oben, von oben nach unten. Sobald die erste Kugel das rechte Viertel erreicht, läuft das Bild mit: Es wandert stetig nach links und man sieht die Welle endlos weiterlaufen – aber nur halb so schnell wie die Kugeln, sodass sie gleichzeitig weiter nach rechts über die Welle wandern.',
      tag: '1 Platz / ½ Takt · Bild läuft mit',
      draw(c, s) {
        const N = 8, P = 8, T = s.bar / 2, step = T / N;   // 8 Nachbilder pro halben Takt (16tel), 8 Plätze pro Welle
        const D = T * .3;                               // Flugzeit eines Nachbilds von Platz zu Platz
        const gap = s.w / P, r = Math.min(gap * .3, s.h * .07), A = s.h * .26, mid = s.h / 2;
        const t = s.t, n = Math.floor(t / T);
        const LEAD = 6;                                 // ab hier (Platz 6, rechtes Viertel) läuft das Bild mit der ersten Kugel mit
        const FOLLOW = .5;                              // das Bild läuft nur halb so schnell mit – so wandern die Kugeln trotzdem weiter nach rechts
        const cam = Math.max(0, t / T - LEAD) * FOLLOW;  // Kamera in Plätzen: steht zuerst, läuft dann gleichmäßig nach rechts – das Bild wandert nach links
        const X = u => (u - cam + .5) * gap, Y = u => mid - A * Math.sin(u / P * Math.PI * 2);   // endlose Wellenlinie
        const ball = (u, al) => { const x = X(u); if (x < -r * 2 || x > s.w + r * 2) return; c.globalAlpha = al; c.beginPath(); c.arc(x, Y(u), r, 0, Math.PI * 2); c.fill(); };
        const landed = m => clamp(Math.floor((t - m * T) / step) + 1, 0, N);
        const departed = m => clamp(Math.floor((t - m * T + D) / step) + 1, 0, N);
        c.fillStyle = s.fg;
        // Kugel j kommt im halben Takt 2j von links (Platz −1) herein und rückt dann pro halben Takt einen Platz weiter: im halben Takt m von (m − 2j − 1) nach (m − 2j).
        // So liegen die Kugeln wie bei „Kugeln auf der Welle“ auf jedem zweiten Platz.
        const jMax = Math.floor((n + 1) / 2), jMin = Math.max(0, Math.floor((n - cam - P - 3) / 2));   // nur Kugeln, die gerade im Bild sein können
        for (let j = jMin; j <= jMax; j++) {
          for (const m of [n - 1, n, n + 1]) {          // Kugel auf ihrem Platz, wird mit jedem Nachbild kräftiger
            const u = m - 2 * j; if (u < 0) continue;
            const o = (landed(m) - departed(m + 1)) / N;
            if (o > 0) ball(u, Math.min(1, o));
          }
          for (let m = n - 1; m <= n + 1; m++) {        // Nachbilder entlang der Welle zum nächsten Platz
            const u0 = m - 2 * j - 1; if (u0 < -1) continue;
            for (let i = 0; i < N; i++) {
              const t0 = m * T + i * step - D;
              if (t < t0 || t >= t0 + D) continue;
              const p = (t - t0) / D;
              ball(u0 + p * p * (3 - 2 * p), .4);
            }
          }
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Wellenlinie',
      text: 'Pro halben Takt zeichnet sich eine Wellenlinie mit 8 Ausschlägen (4 hoch, 4 runter), jeder genau auf seiner 16tel fertig – abwechselnd von links nach rechts und von rechts nach links. Eine Kugel zeichnet sie mit Nachbildern, ältere Zeilen verblassen. Am Rand führt ein Halbkreis in die nächste Zeile. Nach 8 Zeilen (4 Takte) beginnt es oben neu.',
      tag: '8 Zeilen · 4 Takte',
      draw(c, s) {
        const T = s.bar / 2, step = T / 8, ROWS = 8;    // eine Zeile pro halben Takt, 8 Zeilen = 4 Takte
        const rowH = s.h / ROWS, A = rowH * .3, lw = Math.max(2, s.w * .007);
        const R = rowH / 2, pad = R + lw + s.w * .03;   // Platz am Rand für die Halbkreise
        // Wellen laufen an beiden Enden flach aus, damit sie ohne Knick in den Halbkreis übergehen
        const ease = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
        const taper = u => ease(u * 10) * ease((1 - u) * 10);
        const y = (row, u) => rowH * (row + .5) - A * taper(u) * Math.sin(u * Math.PI * 8);   // 8 halbe Wellen = 4 nach oben, 4 nach unten
        const X = (row, u) => row % 2 === 0 ? pad + u * (s.w - 2 * pad) : s.w - pad - u * (s.w - 2 * pad);   // gerade Zeilen →, ungerade ←
        const line = (row, u1) => {
          if (u1 <= 0) return;
          const n = Math.max(2, Math.ceil(u1 * 160));
          c.beginPath(); c.moveTo(X(row, 0), y(row, 0));
          for (let q = 1; q <= n; q++) { const u = u1 * q / n; c.lineTo(X(row, u), y(row, u)); }
          c.stroke();
        };
        const bend = (row, f) => {                      // Halbkreis vom Ende dieser Zeile zum Anfang der nächsten
          if (f <= 0 || row >= ROWS - 1) return;
          const right = row % 2 === 0, cx = right ? s.w - pad : pad, cy = rowH * (row + 1);
          c.beginPath();
          if (right) c.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * f, false);   // rechts außen herum
          else c.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 - Math.PI * f, true);         // links außen herum
          c.stroke();
        };
        if (s.t < 0) return;                            // vor Songbeginn nichts
        c.strokeStyle = s.fg; c.fillStyle = s.fg; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; c.globalAlpha = 1;
        const n = Math.floor(s.t / T), row = n % ROWS, into = s.t - n * T;
        const age = r => Math.max(.3, 1 - (row - r) * .1);   // ältere Zeilen werden nach und nach blasser
        const disc = (x, yy, rad, al) => { c.globalAlpha = al; c.beginPath(); c.arc(x, yy, rad, 0, Math.PI * 2); c.fill(); };
        // Akzente: auf jedem Wellenkamm/-tal ploppt beim Vorbeikommen ein Punkt auf (auf der 16tel)
        const accents = (r, u1, al) => { for (let k = 0; k < 8; k++) { const u = (k + .5) / 8; if (u > u1) break; const pop = r === row ? clamp((u1 - u) * 8 / .5, 0, 1) : 1; const big = 1 + 1.4 * (1 - pop); disc(X(r, u), y(r, u), lw * 1.3 * big * (.4 + .6 * pop), al * (.4 + .6 * pop)); } };
        const bendT = step * .5;                        // der Bogen in die neue Zeile zieht sich in einer 32tel auf
        for (let r = 0; r < row; r++) { c.globalAlpha = age(r); line(r, 1); bend(r, r < row - 1 ? 1 : clamp(into / bendT, 0, 1)); }
        if (row === 0 || into >= bendT) {           // neue Zeile erscheint erst, wenn der Bogen angekommen ist – Ausschlag k endet weiter auf 16tel k
          const u1 = into / T;
          c.globalAlpha = 1; line(row, u1);
          // Zeichenkugel an der Spitze mit 8 blasser werdenden Nachbildern
          for (let j = 8; j >= 0; j--) { const u = u1 - j * .006; if (u < 0) continue; disc(X(row, u), y(row, u), lw * 2.6, j ? .45 * (1 - j / 9) : 1); }
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Sog zum Fluchtpunkt',
      text: '8 große Kreise (nur Kontur) im Kreis, in der Mitte ein Fluchtpunkt. Pro halben Takt wird reihum im Uhrzeigersinn (im 16tel) von jeder Kugel ein Abbild zur Mitte gezogen und wird dabei immer kleiner – mit blassen Nachbildern, die bis zum nächsten halben Takt ausklingen.',
      tag: '8 / ½ Takt',
      draw(c, s) {
        const N = 8, T = s.bar / 2, step = T / N;       // 8 Kugeln, eine pro 16tel = einmal reihum pro halben Takt
        const D = step * 2.5;                           // so lange dauert der Weg zum Fluchtpunkt
        const m0 = Math.min(s.w, s.h), r = m0 * .075, R = m0 * .36, cx = s.w / 2, cy = s.h / 2;
        const ang = i => -Math.PI / 2 + i * Math.PI * 2 / N;        // oben beginnend, im Uhrzeigersinn
        const dot = (x, y, rad, al) => { if (rad <= .2) return; c.globalAlpha = al; c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill(); };
        const lw = Math.max(1.5, m0 * .008);
        const ring = (x, y, rad, al) => { if (rad <= .5) return; c.globalAlpha = al; c.lineWidth = Math.min(lw, rad * .5); c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.stroke(); };   // nur Kontur
        const at = (i, e) => [cx + Math.cos(ang(i)) * R * (1 - e), cy + Math.sin(ang(i)) * R * (1 - e), r * (1 - e)];   // je näher an der Mitte, desto kleiner
        const ease = p => 1 - (1 - p) * (1 - p);       // zieht kräftig los und verschwindet langsam in der Tiefe
        const t = s.t, n = Math.floor(t / T);
        c.fillStyle = s.fg; c.strokeStyle = s.fg;
        dot(cx, cy, Math.max(1.5, r * .12), .35);       // Fluchtpunkt
        for (let i = 0; i < N; i++) { const [x, y] = at(i, 0); ring(x, y, r, 1); }   // die 8 Kugeln bleiben stehen – nur als Kontur
        for (let m = n - 1; m <= n; m++) {
          if (m < 0) continue;                          // vor Songbeginn nichts
          for (let i = 0; i < N; i++) {
            const t0 = m * T + i * step;                // los genau auf der 16tel
            if (t < t0) continue;
            const life = clamp(1 - (t - t0) / (T + step), 0, 1);   // Nachschein klingt bis etwa zum nächsten halben Takt aus
            if (life <= 0) continue;
            const pNow = Math.min(1, (t - t0) / D);
            for (let q = 1; q <= 10; q++) {            // Nachschein: Spur aus kleiner werdenden, blassen Nachbildern
              const [x, y, rad] = at(i, ease(pNow * q / 10));
              ring(x, y, rad, .22 * life);              // Nachbilder ebenfalls nur als Kontur
            }
            if (pNow < 1) { const [x, y, rad] = at(i, ease(pNow)); ring(x, y, rad, .85); }   // das Abbild selbst – nur als Kontur
          }
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Warp',
      text: 'Flug durch den Raum: Sterne kommen aus der Mitte auf einen zu und ziehen zum Rand hin immer längere Streifen. Pro 16tel schießt zusätzlich ein großer Stern heraus – 8 pro halben Takt, endlos.',
      tag: '8 große Sterne / ½ Takt',
      draw(c, s) {
        const step = s.bar / 16;                        // ein großer Stern pro 16tel
        const cx = s.w / 2, cy = s.h / 2, Rref = Math.hypot(cx, cy) * 1.05, m0 = Math.min(s.w, s.h);
        const t = s.t;
        // Perspektive: Abstand z läuft von 1 (weit weg, nahe der Mitte) bis fast 0 (ganz nah, am Rand) – r = Rref · 0.05 / z
        const R = z => Rref * .05 / z;
        const streak = (ang, z, wid, al, len) => {      // Stern als Streifen: von etwas weiter hinten bis jetzt
          const z2 = Math.min(1, z + len), r1 = R(z), r2 = R(z2);
          const ca = Math.cos(ang), sa = Math.sin(ang);
          c.globalAlpha = al; c.lineWidth = wid;
          c.beginPath(); c.moveTo(cx + ca * r2, cy + sa * r2); c.lineTo(cx + ca * r1, cy + sa * r1); c.stroke();
        };
        c.strokeStyle = s.fg; c.fillStyle = s.fg; c.lineCap = 'round';
        // Sternenfeld (dezent im Hintergrund): 80 Sterne mit festen Richtungen, jeder durchfliegt den Raum in einem Takt
        const L = s.bar;
        for (let k = 0; k < 80; k++) {
          const ang = hash32(k * 3 + 1) / 4294967296 * Math.PI * 2, ph = hash32(k * 3 + 2) / 4294967296;
          const z = 1 - (((t / L + ph) % 1) + 1) % 1;
          if (z < .045) continue;
          const near = 1 - z;
          streak(ang, z, Math.max(.5, m0 * .0035 * near * near * 2), Math.min(1, near * 1.3) * .22, .04 + .07 * near);
        }
        // große Sterne im Takt: starten auf der 16tel in der Mitte und schießen in einem halben Takt bis über den Rand
        if (t >= 0) {
          const k0 = Math.floor(t / step);
          for (let k = Math.max(0, k0 - 9); k <= k0; k++) {
            const age = t - k * step, life = s.bar / 2;
            if (age < 0 || age >= life) continue;
            const p = age / life, z = 1 - p * .96;     // schnell näherkommend
            const ang = -Math.PI / 2 + (k % 8) * Math.PI / 4 + (hash32(k + 77) / 4294967296 - .5) * .5;
            const near = 1 - z, wid = Math.max(1.2, m0 * .02 * near);
            streak(ang, z, wid, Math.min(1, near * 2), .12 + .25 * near);
            const r1 = R(z); c.globalAlpha = Math.min(1, near * 2);
            c.beginPath(); c.arc(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1, wid * .9, 0, Math.PI * 2); c.fill();
          }
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Spirale nach innen',
      text: 'Eine endlose Spirale, die sich langsam dreht, während man immer weiter herauszoomt. Pro halben Takt rückt jede Kugel einen Platz weiter nach innen – wie bei Idee 5 mit 8 Nachbildern im 16tel – und wird dabei kleiner. Jeden halben Takt kommt außen eine neue Kugel dazu.',
      tag: '1 Platz · +1 Kugel / ½ Takt',
      draw(c, s) { spiralIn(c, s, FPC[15].def); },   // voll einstellbar: siehe spiralIn / FPC[15]
    },
    {
      title: 'Spirale nach außen',
      text: 'Wie Idee 16, nur umgekehrt: Man zoomt immer weiter hinein. Die Kugeln tauchen in der Mitte auf, rücken pro halben Takt einen Platz nach außen (8 Nachbilder im 16tel) und werden dabei größer. Jeden halben Takt kommt in der Mitte eine neue dazu; das Ganze dreht sich langsam.',
      tag: '1 Platz · +1 Kugel / ½ Takt',
      draw(c, s) { spiralOut(c, s, FPC[16].def); },   // voll einstellbar: siehe spiralOut / FPC[16]
    },
  ],
  trumpet: [
    {
      title: 'Stern zieht sich zusammen',
      text: 'Eine Raute mit nach innen gewölbten Seiten und spitzen Ecken – fast ein Stern. Mit jedem Mosquito-Ton springt sie groß herein, schießt kurz minimal größer und zieht sich dann bis zum Ende des Tons zusammen. Beim zweiten der 2 + 2 springt er kurz zurück und läuft von dort weiter. Er wird dabei stetig kleiner – auch nach dem Ton noch, ohne anzuhalten – bis er ganz weg ist. In den Pausen ist nichts zu sehen. Ablauf: 3 · Pause 3 · 2 + 2 · Pause 2 · 3 · Pause 1 Schläge.',
      tag: '3 · – 3 · 2+2 · – 2 · 3 · – 1',
      draw(c, s) {
        const M = mosqRun(s); if (!M) return;
        const cx = s.w / 2, cy = s.h / 2, m0 = Math.min(s.w, s.h);
        const sc = M.pop * M.v;                          // groß rein, kurz drüber, dann stetig kleiner bis ganz weg – beim 2. der 2 + 2 wächst er kurz zurück
        const R = m0 * .38 * sc;
        if (R < .5) return;
        const ex = 2 / .72;                             // Superellipse mit n < 1 → Seiten nach innen gewölbt
        c.fillStyle = s.fg;
        c.beginPath();
        for (let q = 0; q <= 160; q++) {
          const a = q / 160 * Math.PI * 2, co = Math.cos(a), si = Math.sin(a);
          const x = cx + R * .82 * Math.sign(co) * Math.abs(co) ** ex, y = cy + R * Math.sign(si) * Math.abs(si) ** ex;
          q ? c.lineTo(x, y) : c.moveTo(x, y);
        }
        c.closePath(); c.fill();
      },
    },
    {
      title: 'Balken',
      text: 'Ein Balken wie bei einem Pegel: Mit jedem Mosquito-Ton schießt er ganz schnell von unten nach oben, schwingt kurz über und sinkt dann bis zum Ende des Tons nach unten. Beim zweiten der 2 + 2 springt er kurz zurück und läuft von dort weiter. Er wird dabei stetig kleiner – auch nach dem Ton noch, ohne anzuhalten – bis er ganz weg ist. In den Pausen ist nichts zu sehen. Ablauf: 3 · Pause 3 · 2 + 2 · Pause 2 · 3 · Pause 1 Schläge.',
      tag: '3 · – 3 · 2+2 · – 2 · 3 · – 1',
      draw(c, s) {
        const M = mosqRun(s); if (!M) return;
        const base = s.h, maxH = s.h * .86, bw = Math.min(s.w * .18, s.h * .3), x = (s.w - bw) / 2;
        const hgt = maxH * M.pop2 * M.v;                                // startet hoch, schießt kurz nach oben, dann stetig kleiner bis ganz weg – beim 2. der 2 + 2 springt er kurz zurück hoch
        if (hgt < .5) return;
        c.fillStyle = s.fg;
        c.beginPath();
        if (c.roundRect) c.roundRect(x, base - hgt, bw, hgt, [Math.min(bw * .2, hgt / 2), Math.min(bw * .2, hgt / 2), 0, 0]); else c.rect(x, base - hgt, bw, hgt);
        c.fill();
      },
    },
    {
      title: 'Punkt auf der Zickzack-Welle',
      text: 'Eine abgerundete Zickzack-Welle zieht sich von links nach rechts durchs Bild: links mit starken Ausschlägen und dicker Kontur, nach rechts werden die Ausschläge kleiner und die Kontur immer dünner. Mit jedem Mosquito-Ton startet links ein Punkt und zeichnet die Welle beim Laufen selbst: Vor ihm ist nichts, hinter ihm bleibt die Spur stehen. Er erreicht das rechte Ende genau mit dem Tonende und ist als Tropfen mit der Linie verbunden (Metaballs). Nach dem Ton läuft er weiter, während die Spur von links nach rechts ausblendet. In den Pausen ist nichts zu sehen. Ablauf: 3 · Pause 3 · 2 + 2 · Pause 2 · 3 · Pause 1 Schläge.',
      tag: '3 · – 3 · 2+2 · – 2 · 3 · – 1',
      draw(c, s) {
        const B = s.beat, m0 = Math.min(s.w, s.h), N = MOSQ_NOTES.length;
        const [, q] = loop(s.t, 16 * B, s.bar * 8); let qb = q / B, i = N - 1;
        while (i > 0 && qb < MOSQ_NOTES[i][0]) i--;
        if (qb < MOSQ_NOTES[0][0]) { qb += 16; i = N - 1; }              // vor dem ersten Ton: Ausklang des letzten Tons vom Durchlauf davor
        const L = MOSQ_NOTES[i][1], b = qb - MOSQ_NOTES[i][0], since = b - L;
        const gap = (i === N - 1 ? 16 : MOSQ_NOTES[i + 1][0]) - MOSQ_NOTES[i][0] - L, tot = Math.min(1.7, gap), HOLD = tot * .22;   // erst noch ein Stück stehen lassen, dann ausblenden – soweit die Pause reicht
        if (since >= tot) return;                                           // Pause
        const fading = since > HOLD;                                         // nach dem Ton blendet die Spur von links nach rechts aus, der Punkt läuft weiter
        // Fortschritt des Punkts: normal von links nach rechts; beim zweiten der 2 + 2 läuft er erst auf die Hälfte zurück und von dort wieder nach vorn
        const RB = .15, retr = r => r < RB ? 1 - .65 * eIO(seg(r, -RB, RB)) : .35 + .65 * seg(r, RB, MOSQ_NOTES[2][1]);   // Zurücksetzen beim 2. der 2 + 2: beginnt schon kurz vor dem Ton und ist kurz danach unten
        const E = 120, prog = since > 0 ? Math.min(1 + E / 180, 1 + since / L) :   // nach dem Ton läuft der Punkt in gleichem Tempo weiter
           i === 2 ? retr(b) : (i === 1 && b - L > -.15) ? retr(b - L) : seg(b, 0, L);
        const target = c;                                                    // beim Ausblenden erst opak auf eine Hilfsfläche zeichnen und dann mit Deckkraft aufs Bild legen – so verschmelzen Punkt und Linie zu einer Form
        if (fading) {
          const cv = IDEAS.trumpet.__cv || (IDEAS.trumpet.__cv = document.createElement('canvas'));
          if (cv.width !== c.canvas.width || cv.height !== c.canvas.height) { cv.width = c.canvas.width; cv.height = c.canvas.height; }
          c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.setTransform(target.getTransform());
        }
        const S = 180, SE = S + E, pad = s.w * .08, cy = s.h / 2, amp0 = s.h * .36;
        const X = i => pad + i / S * (s.w - 2 * pad);
        const Y = i => { const f = i / S; return cy - amp0 * Math.pow(Math.max(0, 1 - f), 1.5) * (Math.cos(f * Math.PI * 16) + Math.cos(f * Math.PI * 48) / 18); };   // abgerundeter Zickzack, Ausschlag nimmt nach rechts ab
        const H = i => (m0 * .008 + m0 * .045 * Math.pow(Math.max(0, 1 - i / S), 1.2)) / 2;   // halbe Kontur: links dick, rechts dünn
        const u = prog * S, k = Math.min(SE - 1, Math.floor(u)), fr = u - k;   // Punkt läuft über die Länge des Tons nach rechts
        const dx = X(k) + (X(k + 1) - X(k)) * fr, dy = Y(k) + (Y(k + 1) - Y(k)) * fr;
        const ribbon = (to, al) => {                    // Band mit wechselnder Breite als eine Fläche
          const l = [], r = [];
          for (let i = 0; i <= to; i++) {
            const i0 = Math.max(0, i - 1), i1 = Math.min(SE, i + 1);
            let nx = -(Y(i1) - Y(i0)), ny = X(i1) - X(i0); const q = Math.hypot(nx, ny) || 1; nx /= q; ny /= q;
            l.push([X(i) + nx * H(i), Y(i) + ny * H(i)]); r.push([X(i) - nx * H(i), Y(i) - ny * H(i)]);
          }
          c.globalAlpha = al; c.beginPath();
          l.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
          for (let i = r.length - 1; i >= 0; i--) c.lineTo(r[i][0], r[i][1]);
          c.closePath(); c.fill();
          c.beginPath(); c.arc(X(0), Y(0), H(0), 0, Math.PI * 2); c.fill();   // rundes Anfangsende
        };
        c.fillStyle = s.fg;
        ribbon(k, 1);                                    // die Welle ist nur dort, wo der Punkt schon war – er zeichnet sie
        c.globalAlpha = 1;
        // Tropfen: der Kopf ist rund, nach links (zur Linie) läuft er spitz aus – dazu Kugeln mit nach hinten abnehmendem Radius als Metaballs
        const Rb = m0 * .34, Rh = m0 * (.012 + .022 * Math.pow(1 - Math.min(1, u / S), 1.2)), D = Rh * 6.5, balls = [[Rb, Rb, Rh]];   // der Punkt wird zum Ende hin kleiner, wie die Linie
        for (let i = Math.max(0, k - 80); i <= k; i++) {
          const x = X(i) - dx, y = Y(i) - dy, d = Math.hypot(x, y);
          if (d > D || Math.abs(x) > Rb * .9 || Math.abs(y) > Rb * .9) continue;
          const tp = Math.pow(1 - d / D, 1.6);                             // 1 am Kopf, 0 am Ende des Schwanzes
          balls.push([Rb + x, Rb + y, Math.max(H(i) * 1.1, Rh * .6 * tp)]);
        }
        c.save(); c.translate(dx - Rb, dy - Rb); metaballs(c, Rb * 2, Rb * 2, balls, 2); c.restore();
        if (c !== target) {                              // Ausblenden von links nach rechts: ein weicher Rand wandert über das Bild, links ist die Spur schon weg
          const edge = s.w * .45, xf = -edge + (s.w + 2 * edge) * eIO(seg(since, HOLD, tot));
          const g = c.createLinearGradient(xf, 0, xf + edge, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
          c.globalCompositeOperation = 'destination-in'; c.fillStyle = g; c.fillRect(-edge, -edge, s.w + 2 * edge, s.h + 2 * edge); c.globalCompositeOperation = 'source-over';
          target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.drawImage(c.canvas, 0, 0); target.restore();
        }
      },
    },
    {
      title: 'Welle wölbt sich nach oben',
      text: 'Wie der Balken, nur als große, organische Welle: Über die volle Bildbreite liegt immer eine flache, weich wogende Welle am unteren Rand. Mit jedem Mosquito-Ton wölbt sich daraus ganz schnell eine breite Kuppel nach oben, wie ein Halbkreis mit wenigen sehr großen Wellenbäuchen, die weich hin und her wandern. Sie schwingt kurz über und wird dann stetig kleiner, auch nach dem Ton noch, bis nur noch die flache Welle übrig ist. Beim zweiten der 2 + 2 springt sie kurz zurück hoch und läuft von dort weiter. In den Pausen bleibt die flache Welle stehen. Ablauf: 3 · Pause 3 · 2 + 2 · Pause 2 · 3 · Pause 1 Schläge.',
      tag: '3 · – 3 · 2+2 · – 2 · 3 · – 1',
      draw(c, s) {
        const M = mosqRun(s), t = s.t, rest = s.h * .045;                     // ein kleiner Rest der Welle bleibt immer stehen, auch in den Pausen
        const hgt = M ? (s.h * .82) * M.pop2 * M.v : 0;
        const x0 = 0, x1 = s.w, N = 140;                                       // volle Breite
        c.fillStyle = s.fg; c.beginPath(); c.moveTo(x0 - 1, s.h + 1);
        for (let i = 0; i <= N; i++) {
          const u = i / N, dome = Math.pow(Math.sin(Math.PI * u), .7);          // Kuppel: sanft wie ein Halbkreis, an den Rändern flach
          const bulge = 1 + .2 * Math.sin(u * Math.PI * 3 - t * 4.2) + .1 * Math.sin(u * Math.PI * 5 + t * 5.6);   // wenige große Bäuche, die weich wandern
          c.lineTo(x0 + (x1 - x0) * u, s.h - Math.min(s.h, rest * (.65 + .35 * bulge) + hgt * dome * bulge * (.85 + .15 * Math.sin(u * 7 - t * 3))));
        }
        c.lineTo(x1 + 1, s.h + 1); c.closePath(); c.fill();
      },
    },
  ],
  frog: [
    {
      title: 'Echo',
      text: 'Aus der Mitte kommt alle halbe Schläge ein neuer Kreis (nur Kontur) und wächst nach außen – es füllt sich schnell. Der Kreis in der Mitte hat die dickste Kontur, nach außen werden sie dünner und blasser. Im Frog-Ablauf (6 · 2 · 4 · 4 Schläge) wächst das Echo, je länger ein Abschnitt dauert; beim Wechsel verschwinden weich die äußeren Kreise, die inneren bleiben.',
      tag: '6 · 2 · 4 · 4 Schläge',
      draw(c, s) {
        const B = s.beat, F = frogSeq(s), L = F.L, g = F.g, step = B / 2;   // alle halben Schläge ein neuer Kreis
        const cx = s.w / 2, cy = s.h / 2, m0 = Math.min(s.w, s.h), Rmax = Math.hypot(cx, cy);
        const rst = F.rs < 1, gN = rst ? F.gn : g;          // beim Neustart der Sequenz: neues Echo beginnt bei null, das alte läuft weiter nach außen und blendet nur aus
        const Amax = gN * L, soft = B * .5;             // so alt (= so weit außen) dürfen Kreise gerade werden
        c.strokeStyle = s.fg;
        const n0 = Math.floor(s.t / step);
        for (let n = n0; n > n0 - 40; n--) {
          const age = s.t - n * step, a = age / L;
          if (age < 0) continue;
          const vN = cl01((Amax - age) / soft), vO = rst ? cl01((L - age) / soft) * (1 - eIO(F.rs)) : 0, vis = Math.max(vN, vO);   // ältere Kreise blenden weich aus
          if (vis <= 0) break;
          const gW = vN >= vO ? gN : 1;
          const r = m0 * .02 + Rmax * Math.pow(a, .75);
          c.globalAlpha = vis * seg(age, 0, B * .12) * (1 - .6 * Math.min(1, a));
          c.lineWidth = Math.max(.8, m0 * (.012 + .065 * Math.min(1, gW)) * (1 - .85 * Math.min(1, a)));   // innen dick, nach außen dünn
          c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Verzerrter Kreis',
      text: 'Ein Kreis mit dicker weißer Kontur, dessen Rand zittert wie eine Frequenz. Nach innen folgen immer kleinere, dünnere und blassere Abbilder, die dieselbe Bewegung leicht verzögert mitmachen. Je länger ein Abschnitt im Frog-Ablauf (6 · 2 · 4 · 4 Schläge) dauert, desto größer wird er und desto stärker reißt die Verzerrung aus; auf jedem Schlag zuckt er.',
      tag: '6 · 2 · 4 · 4 Schläge',
      draw(c, s) {
        const B = s.beat, F = frogSeq(s), g = F.g;
        const cx = s.w / 2, cy = s.h / 2, m0 = Math.min(s.w, s.h);
        const R = m0 * (.04 + .3 * eOut(g)), lw = m0 * (.014 + .03 * g);   // wächst aus der Mitte
        const ring = (t, sc) => {
          const kick = Math.exp(-(((t % B) + B) % B) / B * 5);   // Zucken auf jedem Schlag
          const A = R * (.04 + .4 * g * g) * (.7 + .6 * kick) * sc;   // Verzerrung wächst
          c.beginPath();
          for (let q = 0; q <= 360; q++) {
            const a = q / 360 * Math.PI * 2;
            let d = .45 * Math.sin(6 * a + t * 7) + .3 * Math.sin(11 * a - t * 11) + .25 * Math.sin(23 * a + t * 19);
            d = d > 0 ? d * (1 + d) : d;                // Ausschläge nach außen etwas spitzer
            const r = Math.max(.5, R * sc + A * d);
            q ? c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          }
          c.closePath(); c.stroke();
        };
        c.strokeStyle = s.fg; c.lineJoin = 'round';
        const K = 7;
        for (let i = K - 1; i >= 0; i--) {              // i = 0: der Kreis selbst, nach innen die Abbilder
          const f = i / (K - 1);
          c.globalAlpha = cl01(g / .12) * (i ? .7 * (1 - f) ** 1.3 + .08 : 1);   // zu Beginn der Sequenz erst unsichtbar
          c.lineWidth = Math.max(.6, lw * (1 - .85 * f));
          ring(s.t - i * .045, 1 - .8 * f);             // jedes Abbild etwas später und kleiner
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Spirale wächst',
      text: 'Ein Streifen windet sich aus der Mitte als Spirale nach außen und wird dabei immer länger – je weiter er läuft, desto dicker wird er, wie ein Trichter. Bei jedem Wechsel im Frog-Ablauf (6 · 2 · 4 · 4 Schläge) zieht er sich zügig und sauber ganz in die Mitte zurück und wächst von dort neu.',
      tag: '6 · 2 · 4 · 4 Schläge',
      draw(c, s) {
        const B = s.beat, F = frogSeq(s), n = FROG_SEQ.length;
        const back = B * .35;                           // so lange dauert das Zurückziehen in die Mitte
        const prevLen = Math.min(1, FROG_SEQ[(F.k % n + n - 1) % n] / 6);   // so weit war er im Abschnitt davor
        const gate = window.IDEEN_GATE, g = (gate && F.k < 0) ? 0                          // vor dem ersten Frog-Einsatz: nichts
          : (gate && F.k === 0) ? Math.min(1, F.p / F.L)          // erster Einsatz: wächst direkt aus der Mitte, ohne vorheriges Zurückziehen
          : F.p < back ? prevLen * (1 - eIO(F.p / back)) : Math.min(1, (F.p - back) / F.L);
        const cx = s.w / 2, cy = s.h / 2, m0 = Math.min(s.w, s.h);
        const turns = 4.5, Rend = m0 * .47, a0 = Rend / (turns * Math.PI * 2);   // archimedische Spirale r = a0 · θ
        const full = turns * Math.PI * 2, th = full * Math.sqrt(g);   // Länge des Streifens wächst gleichmäßig
        const rot = -s.t * .35;
        const wid = q => m0 * (.004 + .085 * q / full);   // Dicke hängt nur davon ab, wie weit der Streifen schon gelaufen ist
        const P = q => [cx + Math.cos(q + rot) * a0 * q, cy + Math.sin(q + rot) * a0 * q];
        if (th <= .02) return;
        c.fillStyle = s.fg;
        const qs = [];
        for (let q = 0; q < th; q += .04) qs.push(q);
        qs.push(th);
        const left = [], right = [];                    // Streifen als Fläche: an jeder Stelle so breit wie wid(q)
        qs.forEach((q, j) => {
          const [x, y] = P(q), [x2, y2] = P(qs[Math.min(qs.length - 1, j + 1)]), [x0, y0] = P(qs[Math.max(0, j - 1)]);
          let nx = -(y2 - y0), ny = x2 - x0; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
          const w = wid(q) / 2; left.push([x + nx * w, y + ny * w]); right.push([x - nx * w, y - ny * w]);
        });
        c.beginPath(); left.forEach(([x, y], j) => j ? c.lineTo(x, y) : c.moveTo(x, y));
        for (let j = right.length - 1; j >= 0; j--) c.lineTo(right[j][0], right[j][1]);
        c.closePath(); c.fill();
        const [hx, hy] = P(th); c.beginPath(); c.arc(hx, hy, wid(th) / 2, 0, Math.PI * 2); c.fill();   // runder Kopf des Streifens
      },
    },
    {
      title: 'Glitch-Kugel',
      text: 'Eine Kugel nur aus waagrechten Streifen in wechselnder Dicke, wie ein gestörtes Bildsignal. Je länger der Frog-Abschnitt (6 · 2 · 4 · 4 Schläge) dauert, desto mehr zerfällt sie: Streifen brechen in Stücke, verrutschen, verschmieren weit nach links und rechts, einzelne fallen aus oder blitzen hell auf – auf jeder 16tel flackernd. Beim Wechsel setzt sie sich weich ein Stück zurück.',
      tag: '6 · 2 · 4 · 4 Schläge',
      draw(c, s) {
        const B = s.beat, F = frogSeq(s), g = cl01(F.g), m0 = Math.min(s.w, s.h);
        const R = m0 * .42, cx = s.w / 2, cy = s.h / 2, unit = R * 2 / 24;
        const rows = [];                                 // Streifen in wechselnder Dicke – mal hauchdünn, mal breit
        for (let y = cy - R, i = 0; y < cy + R && i < 200; i++) {
          const h = unit * [.25, .45, .7, 1.1, 1.7, 2.6][Math.floor(rnd(0, i, 37) * 6)];
          rows.push([y, Math.min(h, cy + R - y)]); y += h + unit * (.12 + .3 * rnd(0, i, 38));
        }
        const N = rows.length;
        const tick = Math.floor(F.p / (B / 4)), seed = F.k * 50 + tick;   // flackert auf jeder 16tel neu
        const gl = g ** 1.2;
        c.fillStyle = s.fg;
        for (let i = 0; i < N; i++) {
          const [y0, hgt] = rows[i], dy = y0 + hgt / 2 - cy;
          const hw = Math.sqrt(Math.max(0, R * R - dy * dy)); if (hw <= 0) continue;
          const r = k => rnd(seed, i * 7 + k, 36);
          if (rnd(0, i, 39) > g * 4) continue;           // zu Beginn der Sequenz baut sich die Kugel Streifen für Streifen auf
          if (r(0) < gl * .3) continue;                 // Zeile fällt aus
          const hit = r(1) < .08 + .92 * gl;
          const shift = hit ? (r(2) - .5) * R * 1.1 * gl : 0;
          const pieces = hit ? 1 + Math.floor(r(3) * (1 + 3 * gl)) : 1;   // bricht in bis zu 4 Stücke
          let x = cx - hw + shift;
          const total = 2 * hw + (hit ? R * 1.4 * gl * r(4) ** 2 : 0);    // verschmiert
          for (let j = 0; j < pieces; j++) {
            const part = total / pieces, gap = j ? part * .25 * r(10 + j) * gl : 0, jit = hit ? (r(20 + j) - .5) * R * .5 * gl : 0;
            c.globalAlpha = hit && r(30 + j) < .2 * gl ? 1 : .35 + .65 * (1 - Math.abs(dy) / R) * (hit ? .5 + .5 * r(40 + j) : 1);   // manche blitzen hell
            c.fillRect(x + gap + jit, y0, part - gap, hgt);
            x += part;
          }
        }
        c.globalAlpha = 1;
      },
    },
  ],
  building: [
    {
      title: 'Teilen und wieder verschmelzen',
      text: 'Auf Schlag 1 und 2 kommt je eine Kugel herein, auf Schlag 3 verschmelzen sie und teilen sich in 4 Kugeln. Dann geht es weiter statt von vorn – und jedes Mal entstehen 2 Kugeln mehr: Im nächsten Takt fließt auf Schlag 1 eine zufällige Hälfte der Kugeln zusammen, auf Schlag 2 die andere Hälfte, auf Schlag 3 beide zu einer, die sich jetzt in 6 teilt – dann in 8, 10, 12, 14. Beim 4. Mal wandern die Kugeln beim Auseinandergehen nach unten, beim 5. Mal wieder nach oben, beim 6. Mal bleiben sie an der gewohnten Stelle. Schon beim Auseinandergehen wackeln die Kugeln leicht, bis sie wieder zusammenfließen. Beim 6. Mal fliegen alle gemächlich und leicht zitternd aus dem Bild, dann beginnt es neu.',
      tag: '4 → 6 → 8 → … Kugeln · 6 Takte',
      draw(c, s) {
        const B = s.beat, ROUNDS = 6;
        const [kk, pp] = loop(s.t, s.bar * ROUNDS, s.bar * 18 + s.beat);   // 6 Takte, beginnt mit dem Building-Einsatz (Takt 19.2)
        const r0 = Math.min(ROUNDS - 1, Math.floor(pp / s.bar)), b = (pp - r0 * s.bar) / B;
        const m0 = Math.min(s.w, s.h), r = m0 * .085;
        const rad = n => r * Math.sqrt(2 / n);          // alle Kugeln zusammen haben immer gleich viel Fläche wie 2 große
        const count = rd => 4 + 2 * rd;                 // Runde 0 → 4 Kugeln, dann 6, 8, 10 …
        const lerp = (A, Z, e) => [A[0] + (Z[0] - A[0]) * e, A[1] + (Z[1] - A[1]) * e];
        const mid = (A, Z) => lerp(A, Z, .5);
        const centroid = L => [L.reduce((v, P) => v + P[0], 0) / L.length, L.reduce((v, P) => v + P[1], 0) / L.length];
        const keepIn = P => [Math.min(s.w * .65, Math.max(s.w * .35, P[0])), Math.min(s.h * .62, Math.max(s.h * .38, P[1]))];
        const R = (rd, i) => rnd(kk * 10 + rd, i, 23);
        const split = (M, rd) => {                      // wohin sich die Kugeln verteilen: ein lockerer Ring, je mehr Kugeln, desto weiter
          const n = count(rd), a0 = R(rd, 50) * Math.PI * 2, rr = rad(n);
          const cy0 = rd === 3 ? s.h * .66 : rd === 4 ? s.h * .36 : M[1];   // 4. Mal: Kugeln wandern nach unten · 5. Mal: wieder nach oben · 6. Mal: wie gewohnt
          const vf = rd === 3 || rd === 4 ? .6 : 1;      // dabei etwas flacher, damit der Ring ins Bild passt
          return Array.from({ length: n }, (_, j) => {
            const a = a0 + j * Math.PI * 2 / n + (R(rd, 60 + j) - .5) * (Math.PI / n), d = m0 * (.16 + .018 * n) * (.8 + .4 * R(rd, 90 + j));
            if (rd === ROUNDS - 1) { const D = Math.hypot(s.w, s.h) * (.56 + .12 * R(rd, 90 + j)); return [M[0] + Math.cos(a) * D, M[1] + Math.sin(a) * D]; }   // zum Schluss fliegen alle aus dem Bild
            return [Math.min(s.w - rr, Math.max(rr, M[0] + Math.cos(a) * d * 1.25)), Math.min(s.h - rr, Math.max(rr, cy0 + Math.sin(a) * d * vf))];
          });
        };
        // Runde 0: zwei Kugeln kommen herein (wie Idee 1)
        let P1, P2;
        for (let q = 0; q < 20; q++) {
          P1 = [s.w * (.2 + .6 * R(0, q * 4)), s.h * (.25 + .5 * R(0, q * 4 + 1))];
          P2 = [s.w * (.2 + .6 * R(0, q * 4 + 2)), s.h * (.25 + .5 * R(0, q * 4 + 3))];
          if (Math.hypot(P1[0] - P2[0], P1[1] - P2[1]) > m0 * .4) break;
        }
        // Verlauf bis zur aktuellen Runde: Mitte M und die Kugeln Q nach dem Teilen
        let M = mid(P1, P2), Q = split(M, 0), prevQ = null, grpA = null, grpB = null;
        for (let rd = 1; rd <= r0; rd++) {
          const o = Q.map((_, i) => i);                 // zufällig in zwei Hälften aufteilen
          for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(R(rd, i) * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
          prevQ = Q; grpA = o.slice(0, o.length / 2); grpB = o.slice(o.length / 2);
          M = keepIn(mid(centroid(grpA.map(i => Q[i])), centroid(grpB.map(i => Q[i]))));
          Q = split(M, rd);
        }
        const balls = [];
        const wob = (P, i, amp) => amp <= 0 ? P : [P[0] + amp * Math.sin(s.t * 38 + i * 2.1) * (.7 + .3 * Math.sin(s.t * 11 + i)), P[1] + amp * Math.cos(s.t * 45 + i * 1.3) * (.7 + .3 * Math.cos(s.t * 13 + i))];
        const A = m0 * .008;                            // wie stark sie wackeln – ab dem Auseinandergehen bis zum nächsten Zusammenfließen
        if (b < 2.15) {
          if (r0 === 0) {
            const far = Math.hypot(s.w, s.h) * .75, from = (P, i) => { const a = R(0, 100 + i) * Math.PI * 2; return [P[0] + Math.cos(a) * far, P[1] + Math.sin(a) * far]; };
            const j = eIn(seg(b, 1.5, 2));
            balls.push([...lerp(lerp(from(P1, 0), P1, eOut(seg(b, 0, .4))), M, j), r]);
            if (b >= 1) balls.push([...lerp(lerp(from(P2, 1), P2, eOut(seg(b, 1, 1.4))), M, j), r]);
          } else {
            const rr = rad(prevQ.length), j = eIn(seg(b, 1.6, 2.05));   // Hälfte A auf Schlag 1, Hälfte B auf Schlag 2, dann alles zusammen
            const mA = centroid(grpA.map(i => prevQ[i])), mB = centroid(grpB.map(i => prevQ[i]));
            const go = (grp, m, t0, t1) => grp.forEach((i, n) => {
              const st = t0 + (t1 - t0) * .25 * rnd(kk * 10 + r0, 200 + i, 24);   // nicht alle ganz gleichzeitig – wirkt lebendiger
              const e = eIn(seg(b, st, t1));
              balls.push([...lerp(lerp(wob(prevQ[i], i, A * (1 - seg(b, st, st + .2))), m, e), M, j), rr]);   // wackeln, bis sie losfliegen
            });
            go(grpA, mA, 0, .85); go(grpB, mB, .85, 1.6);
          }
        } else {
          const last = r0 === ROUNDS - 1, rr = rad(Q.length);
          const e = last ? seg(b, 2.15, 4) ** 1.4 : eOut(seg(b, 2.15, 3.85));   // in mehr Kugeln teilen · zum Schluss gemächlich aus dem Bild
          const amp = A * seg(b, 2.15, 2.5);            // schon auf dem Weg nach außen leicht wackeln
          Q.forEach((P, i) => balls.push([...wob(lerp(M, P, e), i, amp), rr]));
        }
        c.fillStyle = s.fg;
        metaballs(c, s.w, s.h, balls, Math.max(3, s.w / 120));
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Zwei Striche verbinden sich',
      text: 'Auf Schlag 1 schiebt sich von links ein Strich herein, auf Schlag 2 von rechts. Auf Schlag 3 schnappen sie zu einer Linie zusammen, die dicker wird – in der Mitte am dicksten, zu den Enden hin dünn – und 2 Schläge lang immer welliger schwingt, dann ausklingt. Durchlauf = 1 Takt.',
      tag: '1 · 2 · verbinden · schwingen',
      draw(c, s) {
        const B = s.beat, [, p] = loop(s.t, s.bar, s.bar * 18 + s.beat), b = p / B;
        const m0 = Math.min(s.w, s.h), y = s.h / 2, x0 = s.w * .08, x1 = s.w * .92, mid = s.w / 2;
        c.strokeStyle = s.fg; c.lineWidth = Math.max(2, m0 * .018); c.lineCap = 'round'; c.lineJoin = 'round';
        c.globalAlpha = 1 - seg(b, 3.6, 4);
        if (b < 2) {
          const gap = m0 * .05 * (1 - eIn(seg(b, 1.75, 2)));   // Lücke schließt sich genau auf dem Schlag
          const sl = (mid + 4) * (1 - eOut(seg(b, 0, .4))), sr = (s.w - mid + 4) * (1 - eOut(seg(b, 1, 1.4)));
          polyline(c, [[x0 - sl, y], [mid - gap - sl, y]]);
          if (b >= 1) polyline(c, [[mid + gap + sr, y], [x1 + sr, y]]);
        } else {
          const q = seg(b, 2, 4), t = p - 2 * B;
          const env = Math.max(Math.exp(-t / B * 5) * .7, Math.sin(Math.PI * q) ** .8);   // Zupfen auf dem Schlag, dann immer welliger, dann Ruhe
          const A = m0 * .13 * env, w1 = Math.PI * 4 / B, w2 = Math.PI * 6 / B;
          const lw = Math.max(2, m0 * .018), T = m0 * .1 * eOut(seg(b, 2, 2.6)) * (.75 + .25 * env);   // wird dicker – in der Mitte am dicksten
          const top = [], bot = [];
          for (let i = 0; i <= 160; i++) {
            const u = i / 160, x = x0 + (x1 - x0) * u;
            const yc = y + A * Math.sin(Math.PI * u) * (.6 * Math.sin(u * Math.PI * 6 - t * w1) + .4 * Math.sin(u * Math.PI * 11 + t * w2));
            const th = (lw + T * Math.sin(Math.PI * u) ** 1.4) / 2;
            top.push([x, yc - th]); bot.push([x, yc + th]);
          }
          c.fillStyle = s.fg;
          c.beginPath(); top.forEach(([x, yy], j) => j ? c.lineTo(x, yy) : c.moveTo(x, yy));
          for (let j = bot.length - 1; j >= 0; j--) c.lineTo(bot[j][0], bot[j][1]);
          c.closePath(); c.fill();
          for (const [x, yy] of [[x0, y], [x1, y]]) { c.beginPath(); c.arc(x, yy, lw / 2, 0, Math.PI * 2); c.fill(); }   // runde Enden
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Wasser am Boden',
      text: 'Auf Schlag 1 und 2 fällt je eine Kugel von oben ins Wasser, der Wasserspiegel steigt dabei gleichmäßig über die ganze Breite und vom Aufprall laufen kleine Wellen nach außen. In Schlag 3 und 4 vibriert das Wasser – und bleibt auf seiner Höhe stehen. Im nächsten Takt kommen wieder zwei Kugeln und es steigt weiter. Beim 4. Mal sinkt der Spiegel dagegen ein kleines Stück, danach steigt er wieder. Nach 6 Takten läuft das Wasser ab und es beginnt von vorn.',
      tag: '1 · 2 · vibrieren · 6 Takte',
      draw(c, s) {
        const B = s.beat, ROUNDS = 6;
        const [kk, pp] = loop(s.t, s.bar * ROUNDS, s.bar * 18 + s.beat);   // 6 Takte, beginnt mit dem Building-Einsatz (Takt 19.2)
        const r0 = Math.min(ROUNDS - 1, Math.floor(pp / s.bar)), b = (pp - r0 * s.bar) / B;
        const m0 = Math.min(s.w, s.h), r = m0 * .065, floor = s.h + 2;
        const LAND = [.4, 1.4];
        const Hl = m0 * .068, Dn = m0 * .04;           // pro Kugel: so viel steigt der Spiegel · beim 4. Mal sinkt er pro Kugel so viel
        const step = rd => rd === 3 ? -Dn : Hl;
        let level = m0 * .03;                           // ein wenig Wasser liegt von Anfang an
        for (let rd = 0; rd < r0; rd++) level += 2 * step(rd);
        LAND.forEach(l => { level += step(r0) * eOut(seg(b, l, l + .5)); });
        const drain = r0 === ROUNDS - 1 ? 1 - eIO(seg(b, 3.1, 3.95)) : 1;   // nach dem 6. Mal läuft es ab
        level *= drain;
        const X0 = [0, 1].map(j => s.w * (j ? .58 + .2 * rnd(kk * 10 + r0, 2, 41) : .22 + .2 * rnd(kk * 10 + r0, 1, 41)));
        const tt = s.t;
        // vibrieren: kräftig in Schlag 3 und 4, klingt bis zu den nächsten Kugeln nur leicht nach
        const env = .12 + .88 * seg(b, 1.85, 2.1) * (1 - seg(b, 3.7, 4));   // beim Reinfallen nur ein ganz leichtes Bewegen, in Schlag 3 und 4 vibriert es
        const pts = [];
        for (let i = 0; i <= 160; i++) {
          const x = s.w * i / 160;
          let wv = 0;
          for (let j = 0; j < 2; j++) {                 // Wellen vom Aufprall: laufen nach außen und werden schwächer
            const a = (b - LAND[j]) * B; if (a <= 0) continue;
            const d = Math.abs(x - X0[j]), front = a * m0 * 1.6;
            wv += m0 * .01 * Math.exp(-a / B * 2.5) * Math.cos((d - front) / (m0 * .05)) * Math.exp(-Math.max(0, d - front) / (m0 * .06));   // nur feine Kräuselung
          }
          wv += m0 * .014 * env * (.6 * Math.sin(x / (m0 * .09) - tt * Math.PI * 5 / B) + .4 * Math.sin(x / (m0 * .05) + tt * Math.PI * 7 / B));
          pts.push([x, Math.min(floor, floor - level - wv * drain)]);
        }
        c.fillStyle = s.fg;
        c.beginPath(); c.moveTo(0, floor + 2); pts.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(s.w, floor + 2); c.closePath(); c.fill();
        for (let j = 0; j < 2; j++) {                   // fallende Kugeln: werden schneller, tauchen dann ins Wasser ein
          const l = LAND[j]; if (b < l - .4 || b > l + .3) continue;
          const yl = floor - level - r * .3;
          const y = b < l ? -r + (yl + r) * eIn(seg(b, l - .4, l)) : yl + (floor + r - yl) * seg(b, l, l + .3);
          c.beginPath(); c.arc(X0[j], y, r, 0, Math.PI * 2); c.fill();
        }
      },
    },
    {
      title: 'Moiré',
      text: 'Zwei Kreise aus feinen Linien: Auf Schlag 1 gleitet der erste von links herein, auf Schlag 2 der zweite – leicht verdreht – von rechts. Wo sie sich überlagern, entstehen Moiré-Muster. In Schlag 3 und 4 schieben sie sich ganz übereinander und der obere zittert in seiner Drehung – die Muster flimmern und wandern.',
      tag: '1 · 2 · Moiré flimmert',
      draw(c, s) {
        const B = s.beat, [k, p] = loop(s.t, s.bar, s.bar * 18 + s.beat), b = p / B, t = p - 2 * B;
        const m0 = Math.min(s.w, s.h), R = m0 * .4, cy = s.h / 2, gap = m0 * .028;
        const join = eIO(seg(b, 2, 2.8));               // in Schlag 3 schieben sie sich übereinander
        const xa = s.w / 2 - R * .45 * (1 - join) - (s.w / 2 + R) * (1 - eOut(seg(b, 0, .4)));
        const xb = s.w / 2 + R * .45 * (1 - join) + (s.w / 2 + R) * (1 - eOut(seg(b, 1, 1.4)));
        const env = b >= 2 ? seg(b, 2, 2.15) * (1 - .6 * seg(b, 3, 4)) : 0;
        const angB = .12 + (rnd(k, 1, 61) - .5) * .1 + .07 * env * Math.sin(t * Math.PI * 6 / B) + .03 * env * Math.sin(t * Math.PI * 17 / B);
        const grating = (x, ang, sc) => {               // Kreis voller paralleler Linien
          c.save(); c.beginPath(); c.arc(x, cy, R, 0, Math.PI * 2); c.clip();
          c.translate(x, cy); c.rotate(ang); c.beginPath();
          for (let u = -R * 1.5; u <= R * 1.5; u += gap * sc) { c.moveTo(u, -R * 1.5); c.lineTo(u, R * 1.5); }
          c.stroke(); c.restore();
        };
        c.strokeStyle = s.fg; c.lineWidth = Math.max(1, gap * .38);
        c.globalAlpha = 1 - seg(b, 3.6, 4);
        grating(xa, 0, 1);
        if (b >= 1) grating(xb, angB, 1 + .04 * env * Math.sin(t * Math.PI * 4 / B));
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Klangfigur aus Sand',
      text: 'Wie Sand auf einer schwingenden Platte (Chladni-Figur): Auf Schlag 1 rieselt die erste Hälfte der Körner zufällig ins Bild, auf Schlag 2 die zweite. In Schlag 3 und 4 fängt die Platte an zu vibrieren – die Körner zittern und wandern zu den ruhigen Linien, bis eine Klangfigur entsteht. Jeder Durchlauf zeigt eine andere Figur.',
      tag: '1 · 2 · Sand ordnet sich',
      cache: {},
      draw(c, s) {
        const B = s.beat, [k, p] = loop(s.t, s.bar, s.bar * 18 + s.beat), b = p / B, t = p - 2 * B;
        const m0 = Math.min(s.w, s.h), N = 900;
        const MODES = [[1, 4], [2, 3], [1, 3], [3, 5], [2, 5], [1, 2], [3, 4], [2, 7]];
        const [n, m] = MODES[((k % MODES.length) + MODES.length) % MODES.length];
        const PI = Math.PI;
        const f = (x, y) => Math.cos(n * PI * x) * Math.cos(m * PI * y) - Math.cos(m * PI * x) * Math.cos(n * PI * y);
        const key = k + '|' + Math.round(s.w) + '|' + Math.round(s.h);
        let P = this.cache[key];
        if (!P) {                                       // Startpunkte und Ziel auf der Knotenlinie (Newton-Schritte zu f = 0)
          P = [];
          for (let i = 0; i < N; i++) {
            const x0 = rnd(k, i, 71), y0 = rnd(k, i + N, 71);
            let x = x0, y = y0;
            for (let it = 0; it < 8; it++) {
              const v = f(x, y);
              const gx = -n * PI * Math.sin(n * PI * x) * Math.cos(m * PI * y) + m * PI * Math.sin(m * PI * x) * Math.cos(n * PI * y);
              const gy = -m * PI * Math.cos(n * PI * x) * Math.sin(m * PI * y) + n * PI * Math.cos(m * PI * x) * Math.sin(n * PI * y);
              const g2 = gx * gx + gy * gy + 1e-6;
              x = cl01(x - v * gx / g2); y = cl01(y - v * gy / g2);
            }
            P.push([x0, y0, x, y, Math.abs(f(x0, y0))]);
          }
          this.cache = { [key]: P };                    // nur den aktuellen Durchlauf merken
        }
        const settle = eIO(seg(b, 2.1, 3.5)), vib = b >= 2 ? seg(b, 2, 2.1) * (1 - .7 * seg(b, 3.4, 4)) : 0;
        const fade = 1 - seg(b, 3.65, 4), sz = Math.max(1.2, m0 * .009);
        c.fillStyle = s.fg;
        for (let i = 0; i < N; i++) {
          const [x0, y0, x1, y1, amp] = P[i];
          const tIn = i < N / 2 ? rnd(k, i + 2 * N, 72) * .45 : 1 + rnd(k, i + 2 * N, 72) * .45;   // rieseln: Hälfte auf 1, Hälfte auf 2
          if (b < tIn) continue;
          const drop = 1 - eOut(seg(b, tIn, tIn + .2));
          const jit = vib * m0 * .012 * (amp * (1 - settle) + .15) ;   // auf den Bäuchen springen sie mehr
          const x = (x0 + (x1 - x0) * settle) * s.w + jit * Math.sin(t * 90 + i * 1.7);
          const y = (y0 + (y1 - y0) * settle) * s.h + jit * Math.cos(t * 83 + i * 2.3) - drop * m0 * .08;
          c.globalAlpha = fade * (1 - drop) * (.75 + .25 * settle);
          c.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Interferenz',
      text: 'Ein Raster aus Punkten wie eine Wasseroberfläche. Auf Schlag 1 tropft es an einer Stelle und Wellenringe laufen durchs Raster, auf Schlag 2 an einer zweiten. Wo sich die Wellen treffen, entsteht ein Interferenzmuster. In Schlag 3 und 4 schwingen beide Quellen schneller und kräftiger – das Muster flirrt –, dann beruhigt sich die Oberfläche.',
      tag: '1 · 2 · Wellen überlagern sich',
      draw(c, s) {
        const B = s.beat, [k, p] = loop(s.t, s.bar, s.bar * 18 + s.beat), b = p / B;
        const m0 = Math.min(s.w, s.h), cols = 34, gap = s.w / cols, rows = Math.max(4, Math.round(s.h / gap)), gy = s.h / rows;
        const S = [[s.w * (.22 + .2 * rnd(k, 1, 81)), s.h * (.25 + .5 * rnd(k, 2, 81)), 0], [s.w * (.58 + .2 * rnd(k, 3, 81)), s.h * (.25 + .5 * rnd(k, 4, 81)), 1]];
        const lam = m0 * .14, speed = m0 * 1.1 / B;     // Wellenlänge · Ausbreitung (Bildbreite in gut einem Schlag)
        const drive = 1 + 1.6 * seg(b, 2, 2.5) * (1 - seg(b, 3.4, 4));   // in Schlag 3 und 4 schneller und kräftiger
        const calm = 1 - eIn(seg(b, 3.5, 4));
        c.fillStyle = s.fg;
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const x = gap * (i + .5), y = gy * (j + .5);
          let v = 0;
          for (const [sx, sy, tb] of S) {
            const age = p - tb * B; if (age <= 0) continue;
            const d = Math.hypot(x - sx, y - sy), front = age * speed;
            if (d > front) continue;
            v += Math.sin((d - front) / lam * Math.PI * 2 * drive) * Math.exp(-d / (m0 * 1.2)) * Math.min(1, (front - d) / lam);
          }
          v *= calm;
          const a = Math.min(1, Math.abs(v) * (.7 + .3 * drive));
          const r = Math.min(gap, gy) * (.07 + .3 * a);
          c.globalAlpha = .2 + .8 * a;
          c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
      },
    },
  ],
  riser: [
    {
      title: 'Luft holen',
      text: 'Wie ein Einatmen: In den ersten 2¾ Schlägen ziehen sich Striche vom Bildrand lang bis in die Mitte; dann wandert ihr äußeres Ende unterschiedlich schnell hinterher, bis alle in der Mitte einen kleinen Punkt bilden. Danach ziehen sie sich – immer noch mit der Mitte verbunden – sanft wieder nach außen lang und verblassen dabei von der Mitte aus nach außen, während sie weiter nach außen laufen. Startet mit dem Riser in Takt 24.2.',
      tag: '2¾ Schläge rein · 2¼ Schläge raus',
      tail: 3,                                          // läuft nach dem Riser-Klang noch bis zu 3 Schläge aus (wichtig bei „nur animieren, wenn die Spur klingt“)
      draw(c, s) {
        const B = s.beat, IN = 2.75, OUT = 2.25;          // Schläge (¼-Takte): einatmen · ausatmen
        const [k, p] = loop(s.t, (IN + OUT) * B, s.bar * 23 + B), b = p / B;   // Durchlauf beginnt mit dem Riser in der Klanghierarchie (Takt 24.2)
        if (k < 0 && window.IDEEN_GATE) return;                              // vor dem Riser-Einsatz ist nichts zu sehen
        const cx = s.w / 2, cy = s.h / 2, m0 = Math.min(s.w, s.h), Rout = Math.hypot(cx, cy) + m0 * .15;
        const N = 36, q = eIO(seg(b, IN, IN + OUT));    // ausatmen: Striche ziehen sich sanft aus der Mitte lang, bis über den Bildrand
        const rIn = m0 * .006;                          // ganz in die Mitte → kleiner Punkt
        const soft = m0 * .25, front = (Math.hypot(cx, cy) + soft) * eIn(seg(b, IN + .3, IN + OUT));   // Verblassen wandert von der Mitte nach außen
        const fadeAt = r => b < IN ? 1 : cl01((r - (front - soft)) / soft);
        c.strokeStyle = s.fg; c.fillStyle = s.fg; c.lineCap = 'round';
        for (let i = 0; i < N; i++) {
          const t0 = rnd(k, i + 100, 61) * .6, tm = t0 + .7 + .5 * rnd(k, i + 200, 61);   // Spitze erreicht die Mitte bei tm
          const t1 = IN - .03 - .3 * rnd(k, i + 400, 61);   // Ende folgt unterschiedlich schnell – kommt erst kurz vor dem Rausgehen in der Mitte an
          if (b < t0) continue;
          const a = i / N * Math.PI * 2 + (rnd(k, i, 61) - .5) * .3;
          const co = Math.cos(a), si = Math.sin(a);
          const rs = Math.min(Math.abs(cx / (co || 1e-6)), Math.abs(cy / (si || 1e-6)), Rout);   // Bildrand in dieser Richtung
          let r0, r1;                                   // innen · außen
          if (b < IN) {                                 // 1) Strich zieht sich vom Rand bis in die Mitte lang · 2) das äußere Ende wandert nach
            r0 = rs + (rIn - rs) * seg(b, t0, tm) ** 1.3;
            r1 = rIn + (rs + m0 * .04 - rIn) * (1 - seg(b, tm, t1) ** 1.25);
          } else {                                      // raus: bleibt mit der Mitte verbunden und zieht sich nach außen lang
            r0 = rIn;
            r1 = rIn + (rs * (1 + .3 * rnd(k, i + 500, 61)) - rIn) * q;
          }
          c.lineWidth = Math.max(.7, m0 * .011 * Math.max(.25, Math.min(1, (r1 - r0) / rs * 1.6)));
          if (b < IN) { c.globalAlpha = seg(b, t0, t0 + .15); c.strokeStyle = s.fg; }
          else {                                        // Verblassen von außen nach innen – entlang des Strichs
            const st = Math.max(r0, front - soft); if (r1 <= st) continue;   // innen schon verblasst
            const gr = c.createLinearGradient(cx + co * st, cy + si * st, cx + co * r1, cy + si * r1);
            const full = cl01((front - st) / (r1 - st));
            gr.addColorStop(0, rgba(s.fg, fadeAt(st))); gr.addColorStop(full, rgba(s.fg, fadeAt(st + (r1 - st) * full))); gr.addColorStop(1, rgba(s.fg, fadeAt(r1)));
            c.globalAlpha = 1; c.strokeStyle = gr; r0 = st;
          }
          c.beginPath(); c.moveTo(cx + co * r0, cy + si * r0); c.lineTo(cx + co * r1, cy + si * r1); c.stroke();
        }
        // der Punkt in der Mitte: entsteht, wenn alle angekommen sind, und verblasst beim Rausgehen als Erstes
        const dot = seg(b, IN - .5, IN - .05) * fadeAt(0);
        if (dot > 0) { c.globalAlpha = dot; c.beginPath(); c.arc(cx, cy, Math.max(1.5, m0 * .018), 0, Math.PI * 2); c.fill(); }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Wirbel zum Kreis',
      text: 'Wie bei „Luft holen“ kommen Striche vom Rand nach innen – und das ganze Gebilde dreht sich dabei immer schneller. Die Striche hängen der Drehung etwas hinterher und biegen sich. In der Mitte wickeln sie sich Stück für Stück auf einen Kreis – die Kontur entsteht erst dort, wo die Striche ankommen. Danach drehen sie sich als Spirale heraus, bleiben dabei mit dem Kreis verbunden, und alles verblasst gemeinsam. Startet mit dem Riser in Takt 24.2.',
      tag: '2¾ Schläge rein · 2¼ Schläge raus',
      tail: 3,                                          // läuft nach dem Riser-Klang noch bis zu 3 Schläge aus (wichtig bei „nur animieren, wenn die Spur klingt“)
      draw(c, s) {
        const B = s.beat, IN = 2.75, OUT = 2.25;
        const [k, p] = loop(s.t, (IN + OUT) * B, s.bar * 23 + B), b = p / B;   // wie Idee 1: ab Takt 24.2
        if (k < 0 && window.IDEEN_GATE) return;                              // vor dem Riser-Einsatz ist nichts zu sehen
        const cx = s.w / 2, cy = s.h / 2, m0 = Math.min(s.w, s.h), Rc = m0 * .15, N = 28;
        const rot = .5 * b + .32 * b * b;               // das ganze Gebilde dreht sich, immer schneller
        const spin = .5 + .64 * b;                      // aktuelle Drehgeschwindigkeit → so stark biegen sich die Striche
        const arcW = Math.PI * 2 / N;                   // so breit wird jeder Strich, wenn er auf dem Kreis liegt
        const q = b < IN ? 0 : seg(b, IN, IN + OUT), out = eOut(q);
        const fade = 1 - eIn(seg(b, IN + .4, IN + OUT));
        const edge = a => { const co = Math.cos(a), si = Math.sin(a); return Math.min(Math.abs(cx / (co || 1e-6)), Math.abs(cy / (si || 1e-6))) + m0 * .05; };
        c.strokeStyle = s.fg; c.lineCap = 'round'; c.lineJoin = 'round';
        c.lineWidth = Math.max(1.2, m0 * .012);

        for (let i = 0; i < N; i++) {
          const a0 = i / N * Math.PI * 2 + (rnd(k, i, 91) - .5) * arcW * .6, base = a0 + rot;
          const t0 = rnd(k, i + 100, 91) * .7, t1 = IN - .02 - .15 * rnd(k, i + 200, 91);   // alle liegen erst ganz kurz vor Schlag 2¾ auf dem Kreis
          if (b < t0) continue;
          const len = m0 * (.42 + .16 * rnd(k, i + 300, 91));
          // Der Strich fährt auf einer Bahn: erst gerade vom Rand bis zum Kreis, dann wickelt er sich auf dem Kreis weiter –
          // so legt er sich Stück für Stück auf die Kontur, ohne zu springen. sh = wie weit die Spitze auf der Bahn ist.
          const R0 = edge(a0), D = R0 - Rc;
          const sh = (D + len) * eIO(seg(b, t0, t1));
          const at = sp => sp < D
            ? [R0 - sp, base - spin * .25 * (R0 - sp - Rc) / (m0 * .45)]   // gerades Stück: hängt der Drehung hinterher, je weiter außen, desto mehr
            : [Rc, base + (sp - D) / Rc];                                  // auf dem Kreis
          const wrap = len / Rc;                        // so weit reicht der Strich, wenn er ganz auf dem Kreis liegt
          const pts = [];
          for (let j = 0; j <= 24; j++) {
            const u = j / 24;                           // 0 = Spitze (innen), 1 = Ende (außen)
            let r, th;
            if (b < IN) [r, th] = at(sh - len * u);
            else {                                      // raus: vom Kreis als kurze Spirale abwickeln
              const d = m0 * .3 * out;
              r = Rc + d * u ** 1.2;                    // Spitze bleibt auf dem Kreis – die Spirale hängt an der Kontur
              th = base + wrap + .5 * out - wrap * u * (1 - out) ** 3 - .9 * out * u;   // Spitze dreht weiter in Drehrichtung, der Bogen zieht sich zu ihr hin zusammen, das äußere Ende hängt nach
            }
            pts.push([cx + Math.cos(th) * r, cy + Math.sin(th) * r]);
          }
          c.globalAlpha = seg(b, t0, t0 + .15) * fade;
          polyline(c, pts);
        }
        if (b >= IN) {                                 // ab dem Rausgehen: die fertige Kontur bleibt und verschwindet zusammen mit den Spiralarmen
          c.globalAlpha = fade; c.beginPath(); c.arc(cx, cy, Rc, 0, Math.PI * 2); c.stroke();
        }
        c.globalAlpha = 1;
      },
    },
  ],
  jagd: [
    {
      title: 'Striche stapeln sich',
      text: 'Von unten nach oben stapeln sich schnell Striche: der unterste am längsten, nach oben immer kürzer und enger beieinander. Ab der Mitte des 2. Schlags verblassen sie von oben nach unten, bis Schlag 3 vorbei ist. Danach 1 Schlag Pause.',
      tag: '3 Schläge',
      tail: 3,                                          // läuft nach dem Hornklang noch kurz aus (bei „nur animieren, wenn die Spur klingt“)
      draw(c, s) {
        const B = s.beat, [k, p] = loop(s.t, s.bar, s.bar * 24), b = p / B;   // Durchlauf beginnt mit dem Jagdhorn (Takt 25, Schlag 1 – ca. 49,7 s)
        if (k < 0 && window.IDEEN_GATE) return;                              // vor dem Einsatz ist nichts zu sehen
        if (b >= 3.05) return;
        const N = 12, cx = s.w / 2, y0 = s.h * .88, top = s.h * .12;
        const q = .86, g0 = (y0 - top) * (1 - q) / (1 - q ** (N - 1));   // Abstände werden nach oben immer kleiner
        const m0 = Math.min(s.w, s.h);
        c.strokeStyle = s.fg; c.lineCap = 'round';
        let y = y0;
        for (let i = 0; i < N; i++) {
          const f = i / (N - 1);                        // 0 = unten, 1 = oben
          const t0 = i * 1.1 / N, e = eOut(seg(b, t0, t0 + .2));   // baut sich in gut einem Schlag auf
          const fs = 1.5 + (1 - f) * 1.05, fade = 1 - seg(b, fs, fs + .45);   // ab Mitte Schlag 2 von oben nach unten weg
          if (e > 0 && fade > 0) {
            const half = s.w * .43 * (1 - .82 * f) * e;
            c.globalAlpha = fade;
            c.lineWidth = Math.max(1.2, m0 * (.022 - .014 * f));
            polyline(c, [[cx - half, y], [cx + half, y]]);
          }
          y -= g0 * q ** i;
        }
        c.globalAlpha = 1;
      },
    },
    {
      title: 'Kreis zieht sich zusammen',
      text: 'Ein großer Kreis (nur Kontur) startet außerhalb des Bildes und zieht sich in 3 Schlägen bis zu einem Punkt in der Mitte zusammen. Dabei zieht er eine Spur weiterer Kreise hinter sich her und verliert immer mehr an Deckkraft. Danach 1 Schlag Pause.',
      tag: '3 Schläge',
      tail: 3,                                          // läuft nach dem Hornklang noch kurz aus (bei „nur animieren, wenn die Spur klingt“)
      draw(c, s) {
        const B = s.beat, [k, p] = loop(s.t, s.bar, s.bar * 24), b = p / B;   // Durchlauf beginnt mit dem Jagdhorn (Takt 25, Schlag 1 – ca. 49,7 s)
        if (k < 0 && window.IDEEN_GATE) return;                              // vor dem Einsatz ist nichts zu sehen
        if (b > 3.5) return;
        const cx = s.w / 2, cy = s.h / 2, m0 = Math.min(s.w, s.h);
        const R0 = Math.hypot(cx, cy) * 1.02;           // Start knapp außerhalb (an den Ecken) → am Ende nur noch ein Punkt
        const R = x => { const u = seg(x, 0, 3); return R0 * (1 - (.6 * eOut(u) + .4 * eIO(u))); };   // zieht gleich los, kommt weich als Punkt an
        const fade = x => (1 - .5 * seg(x, 0, 3)) * (1 - seg(x, 3, 3.5));   // verliert immer mehr Deckkraft
        c.strokeStyle = s.fg; c.fillStyle = s.fg;
        for (let i = 9; i >= 0; i--) {                  // i = 0: der Kreis selbst, dahinter die Spur
          const x = b - i * .1;
          if (x < 0) continue;
          const lw = Math.max(1, m0 * (i ? .006 : .014)), r = R(x);
          c.globalAlpha = fade(b) * (i ? .5 * (1 - i / 10) : 1);
          c.beginPath();
          if (r > lw) { c.lineWidth = lw; c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
          else if (!i) { c.arc(cx, cy, lw * 1.5, 0, Math.PI * 2); c.fill(); }   // ganz innen: ein Punkt
        }
        c.globalAlpha = 1;
      },
    },
  ],
  drums: [
    {
      title: 'Rahmen vibriert',
      text: 'Vier Linien am Bildrand – oben, rechts, unten, links –, die sich an den Ecken nicht berühren. Auf jedem Schlag vibrieren sie kurz und kommen dann wieder zur Ruhe: vibrieren, aufhören, vibrieren, aufhören.',
      tag: 'jeder Schlag',
      draw(c, s) {
        const B = s.beat, [k, p] = loop(s.t, B);        // k = Nummer des Schlags
        const m0 = Math.min(s.w, s.h), m = m0 * .09, gap = m0 * .07;
        const env = (1 - seg(p, 0, B * .55)) ** 2, A = m0 * .05 * env, w = Math.PI * 2 * 9 / B * .5;
        const L = [                                      // Start, Ende, nach außen zeigende Richtung
          [[m + gap, m], [s.w - m - gap, m], [0, -1]],
          [[s.w - m, m + gap], [s.w - m, s.h - m - gap], [1, 0]],
          [[s.w - m - gap, s.h - m], [m + gap, s.h - m], [0, 1]],
          [[m, s.h - m - gap], [m, m + gap], [-1, 0]],
        ];
        c.strokeStyle = s.fg; c.lineWidth = Math.max(2, m0 * .014); c.lineCap = 'round'; c.lineJoin = 'round';
        L.forEach(([a, z, n], j) => {
          const mode = 1 + ((((k + j) % 3) + 3) % 3);   // jede Linie schwingt bei jedem Schlag etwas anders
          const pts = [];
          for (let i = 0; i <= 90; i++) {
            const u = i / 90, d = A * Math.sin(Math.PI * u * mode) * Math.sin(p * w + j);
            pts.push([a[0] + (z[0] - a[0]) * u + n[0] * d, a[1] + (z[1] - a[1]) * u + n[1] * d]);
          }
          polyline(c, pts);
        });
      },
    },
    {
      title: 'Organische Form mit Wellen',
      text: 'In der Mitte eine weiche, organische Form, die langsam vor sich hin wabert. Auf jedem Schlag wirft die ganze Form Wellen: Beulen treten nach außen, dazwischen zieht sie sich nach innen – wie Gelee, das kurz nachschwingt und wieder zur Ruhe kommt. Jedes Mal an anderen Stellen.',
      tag: 'jeder Schlag',
      draw(c, s) {
        const B = s.beat, [k, p] = loop(s.t, B);        // k = Nummer des Schlags
        const cx = s.w / 2, cy = s.h / 2, m0 = Math.min(s.w, s.h), R = m0 * .26, t = s.t;
        // Schlag: schnell ausschlagen, dann gedämpft nachschwingen (Wellen kippen kurz ins Gegenteil) und abklingen
        const env = seg(p, 0, B * .05) * Math.exp(-p / (B * .22)) * Math.cos(p / B * Math.PI * 2 * 1.4);
        const W = [0, 1, 2].map(j => [5 + Math.floor(rnd(k, j, 91) * 4), rnd(k, j + 10, 91) * Math.PI * 2, [.2, .12, .07][j]]);   // Wellenzahl, Lage, Stärke – bei jedem Schlag neu
        const spin = p / B * .6;                        // die Wellen wandern dabei leicht um die Form herum
        c.fillStyle = s.fg;
        c.beginPath();
        for (let q = 0; q <= 360; q++) {
          const a = q / 360 * Math.PI * 2;
          let w = 0;
          for (const [n, ph, amp] of W) w += amp * Math.sin(n * a + ph + spin);
          w = w > 0 ? w * (1 + w * 2.2) : w * .8;       // Beulen etwas spitzer nach außen, Täler weicher nach innen
          const r = R * (1 + .07 * Math.sin(3 * a + t * .9) + .05 * Math.sin(2 * a - t * 1.3) + .04 * Math.sin(4 * a + t * .6)   // weiches Wabern
                         + env * w + .05 * Math.abs(env));   // ganze Form zuckt mit
          q ? c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        c.closePath(); c.fill();
      },
    },
    {
      title: 'Schockwelle im Punktraster',
      text: 'Ein ruhiges Raster aus Punkten. Auf jedem Schlag läuft eine Druckwelle hindurch – abwechselnd aus der Mitte und von einer zufälligen Stelle: Die Punkte werden kurz größer, heller und nach außen geschoben.',
      tag: 'jeder Schlag',
      draw(c, s) {
        const B = s.beat, [k, p] = loop(s.t, B), m0 = Math.min(s.w, s.h);
        const cols = 13, gap = s.w / cols, rows = Math.max(3, Math.round(s.h / gap)), gy = s.h / rows, r0 = Math.min(gap, gy) * .14;
        const ox = k % 2 ? s.w * (.15 + .7 * rnd(k, 1, 97)) : s.w / 2, oy = k % 2 ? s.h * (.15 + .7 * rnd(k, 2, 97)) : s.h / 2;
        const maxD = Math.hypot(Math.max(ox, s.w - ox), Math.max(oy, s.h - oy)), front = p / (B * .7) * maxD, life = 1 - p / B;
        c.fillStyle = s.fg;
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const x = gap * (i + .5), y = gy * (j + .5), dx = x - ox, dy = y - oy, d = Math.hypot(dx, dy) || 1;
          const w = Math.exp(-(((d - front) / (m0 * .09)) ** 2)) * life;
          const push = m0 * .05 * w;
          c.globalAlpha = .3 + .7 * w;
          c.beginPath(); c.arc(x + dx / d * push, y + dy / d * push, r0 * (1 + 1.8 * w), 0, Math.PI * 2); c.fill();
        }
        c.globalAlpha = 1;
      },
    },
  ],
  ring: [
    {
      title: 'Kugeln sammeln sich und fliegen weg',
      text: 'In Schlag 1, 2 und 3 kommen jeweils zwei Kugeln nacheinander von außen herein und sind in der Mitte des Schlags und eine 16tel später an ihrem Platz – sie bleiben dann stehen. Im 4. Schlag fliegen sie in vier Gruppen raus – auf jeder 16tel ein Viertel davon (2 · 1 · 2 · 1), in zufälliger Reihenfolge.',
      tag: '2 Kugeln / Schlag · raus in 16teln',
      draw(c, s) {
        const B = s.beat, [k, p] = loop(s.t, s.bar), b = p / B;
        const m0 = Math.min(s.w, s.h), r = m0 * .06, far = Math.hypot(s.w, s.h) * .7;
        c.fillStyle = s.fg;
        const cycle = (kk, bb) => {
          const cells = [0, 1, 2, 3, 4, 5];             // 3 × 2 Felder, zufällig verteilt
          for (let i = 5; i > 0; i--) { const j = Math.floor(rnd(kk, i, 81) * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
          const out = [0, 1, 2, 3, 4, 5];               // Reihenfolge beim Rausfliegen
          for (let i = 5; i > 0; i--) { const j = Math.floor(rnd(kk, i + 20, 81) * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
          for (let j = 0; j < 6; j++) {
            const cl = cells[j], gx = s.w / 3, gy = s.h / 2;
            const P = [gx * (cl % 3 + .25 + .5 * rnd(kk, j + 40, 81)), gy * (Math.floor(cl / 3) + .3 + .4 * rnd(kk, j + 50, 81))];
            const aIn = rnd(kk, Math.floor(j / 2) + 60, 81) * Math.PI * 2 + (j % 2) * Math.PI;   // die zwei eines Schlags kommen von gegenüber
            const tAn = Math.floor(j / 2) + .5 + (j % 2) * .25, tIn = tAn - .35, e = eOut(seg(bb, tIn, tAn));   // angekommen in der Mitte des Schlags, die zweite eine 16tel später
            if (bb < tIn) continue;
            const tOut = 3 + [0, 0, 1, 2, 2, 3][out.indexOf(j)] / 4, f = eIn(seg(bb, tOut, tOut + .3));   // 4. Schlag: auf jeder 16tel ein Viertel raus
            if (f >= 1) continue;
            const aOut = rnd(kk, j + 70, 81) * Math.PI * 2;
            const x = P[0] + Math.cos(aIn) * far * (1 - e) + Math.cos(aOut) * far * f;
            const y = P[1] + Math.sin(aIn) * far * (1 - e) + Math.sin(aOut) * far * f;
            c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
          }
        };
        cycle(k - 1, b + 4);                            // die letzten vom Takt davor sind evtl. noch unterwegs
        cycle(k, b);
      },
    },
    {
      title: 'Kugeln erscheinen zeilenweise',
      text: 'Die Kugeln tauchen zeilenweise von oben nach unten einfach plötzlich auf. In der Mitte von Schlag 1 erscheinen oben mittig zwei Kugeln kurz nacheinander, in der Mitte von Schlag 2 zwei in der Zeile darunter, in der Mitte von Schlag 3 zwei in der dritten Zeile. Im 4. Schlag folgt eine vierte Zeile mit vier Kugeln, jeweils auf einer 16tel (1 · 2 · 3 · 4). Mit dem nächsten Takt ist wieder alles leer.',
      tag: '3 × 2 Kugeln + 4 · Aufblitzen',
      draw(c, s) {
        const B = s.beat, [k, p] = loop(s.t, s.bar), b = p / B;
        const m0 = Math.min(s.w, s.h), r = m0 * .06;
        c.fillStyle = s.fg;
        const dot = (x, y) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
        for (let row = 0; row < 4; row++) {
          const n = row < 3 ? 2 : 4, y = s.h * (.17 + .22 * row);
          for (let i = 0; i < n; i++) {
            const tIn = row < 3 ? row + .5 + i * .25 : 3 + i * .25;   // Mitte des Schlags + eine 16tel später; 4. Zeile auf jeder 16tel
            if (b < tIn) continue;
            dot(s.w / 2 + (i - (n - 1) / 2) * m0 * .2, y);            // taucht einfach auf
          }
        }
      },
    },
    {
      title: 'Zehn Kugeln als Dreieck',
      text: 'Dieselben 10 Kugeln (2 · 2 · 2 · 4) wie in Idee 2, aber so verteilt, dass am Ende ein symmetrisches Dreieck (1 · 2 · 3 · 4) steht. Schlag 1: die zwei Kugeln der zweiten Reihe, Schlag 2: die äußeren der dritten Reihe, Schlag 3: die äußeren der vierten Reihe – jeweils in der Mitte des Schlags, die zweite eine 16tel später. Schlag 4: Spitze, Mitte der dritten Reihe und die zwei mittleren der vierten Reihe auf je einer 16tel. Mit dem nächsten Takt ist wieder alles leer.',
      tag: '10 Kugeln · Dreieck',
      draw(c, s) {
        const B = s.beat, [k, p] = loop(s.t, s.bar), b = p / B;
        const m0 = Math.min(s.w, s.h), r = m0 * .06;
        c.fillStyle = s.fg;
        // [Reihe, Platz in der Reihe, Zeitpunkt in Schlägen]
        const balls = [[1, 0, .5], [1, 1, .75], [2, 0, 1.5], [2, 2, 1.75], [3, 0, 2.5], [3, 3, 2.75], [0, 0, 3], [2, 1, 3.25], [3, 1, 3.5], [3, 2, 3.75]];
        for (const [row, i, t] of balls) {
          if (b < t) continue;
          c.beginPath(); c.arc(s.w / 2 + (i - row / 2) * m0 * .2, s.h * (.17 + .22 * row), r, 0, Math.PI * 2); c.fill();
        }
      },
    },
    {
      title: 'Spalten wandern von links nach rechts',
      text: 'Über die ganze Ringtone-Spur (8 Takte, davor als Schleife) wandert das Bild von links nach rechts. In jedem Takt entstehen drei neue Spalten mit je zwei Kugeln – von oben nach unten, jeweils in der Mitte des Schlags 1, 2 und 3 (die untere Kugel eine 16tel nach der oberen). Im 4. Schlag verlassen die vier ältesten Kugeln (die zwei ältesten Spalten) nacheinander, in der Reihenfolge ihres Erscheinens, auf je einer 16tel das Bild nach oben bzw. unten. So bauen sich pro Takt 6 Kugeln auf und 4 verschwinden – am Ende stehen 8 Spalten.',
      tag: '8 Takte · 3 Spalten rein, 2 raus',
      draw(c, s) {
        const CYC = 8, COLS = CYC * 3;
        const first = Math.round((DUR - CYC * s.bar) / s.bar);        // erster der 8 Takte (die Spur umfasst die letzten 8 Takte des Songs)
        const bt = ((((s.t / s.bar - first) % CYC) + CYC) % CYC) * 4;   // Zeit in Schlägen ab Beginn des ersten Takts – davor und danach läuft sie als Schleife weiter, damit man sie überall im Song sieht
        const colW = s.w / COLS, r = Math.min(colW * .32, Math.min(s.w, s.h) * .06);
        c.fillStyle = s.fg;
        for (let g = 0; g < COLS; g++) {
          const cy = Math.floor(g / 3), j = g % 3, x = (g + .5) * colW;
          const lc = Math.floor(g / 2), odd = g % 2;                   // Spalte g geht im Takt floor(g/2) raus: erst die ältere, dann die jüngere
          for (let n = 0; n < 2; n++) {                                // n = 0 oben, 1 unten
            const tA = cy * 4 + j + .5 + n * .25;                      // taucht einfach auf: Mitte des Schlags, unten eine 16tel später
            if (bt < tA) continue;
            const tO = lc * 4 + 3 + (odd * 2 + n) / 4;                 // Reihenfolge des Erscheinens: oben, unten, oben, unten
            const f = eIn(seg(bt, tO, tO + .3));
            if (f >= 1) continue;
            const y = s.h * (n ? .62 : .38) + (n ? 1 : -1) * s.h * f;  // oben nach oben raus, unten nach unten raus
            c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
          }
        }
      },
    },
    {
      title: 'Linien wachsen von links nach rechts',
      text: 'Zehn senkrechte Linien in gleichen Abständen. Im Rhythmus der Ideen oben wächst von links nach rechts eine nach der anderen aus der Mitte nach oben und unten: zwei in der Mitte von Schlag 1, zwei in Schlag 2, zwei in Schlag 3 und vier in Schlag 4 auf je einer 16tel. Mit dem nächsten Takt ist wieder alles leer.',
      tag: '10 Linien · Wachsen · links → rechts',
      draw(c, s) {
        const b = loop(s.t, s.bar)[1] / s.beat, cell = s.w / 10;
        const HIT = [.5, .75, 1.5, 1.75, 2.5, 2.75, 3, 3.25, 3.5, 3.75];
        c.strokeStyle = s.fg; c.lineCap = 'round'; c.lineWidth = Math.max(1.5, cell * .16);
        for (let n = 0; n < 10; n++) {
          if (b < HIT[n]) continue;
          const half = s.h * .38 * eOut(seg(b, HIT[n], HIT[n] + .4)), x = (n + .5) * cell;
          c.beginPath(); c.moveTo(x, s.h / 2 - half); c.lineTo(x, s.h / 2 + half); c.stroke();
        }
      },
    },
    {
      title: 'Kranz aus Punkt-Dreiecken',
      text: 'Acht Dreiecke bilden einen Kranz um die Bildmitte, mit der Spitze nach außen. Sie werden einzeln im Uhrzeigersinn gezeichnet, oben beginnend – und jedes Dreieck baut sich genau wie in Idee 3 aus 10 Punkten auf: in einem Takt zwei Punkte in der Mitte von Schlag 1, 2 und 3 (der zweite eine 16tel später) und vier Punkte im 4. Schlag auf je einer 16tel. Ein Dreieck dauert also einen Takt, der ganze Kranz acht Takte (die Länge der Spur). Fertige Dreiecke bleiben stehen; nach dem achten fängt es von vorn an.',
      tag: '8 Dreiecke · je 1 Takt wie Idee 3 · Uhrzeigersinn',
      draw(c, s) {
        const m0 = Math.min(s.w, s.h), R = m0 * .36, d = m0 * .05, r = d * .32, N = 8;
        const first = Math.round((DUR - 8 * s.bar) / s.bar);            // Beginn der Ringtone-Spur (Takt 24): dort fängt der Kranz von vorn an
        const k = ((Math.floor(s.t / s.bar) - first) % N + N) % N, b = loop(s.t, s.bar)[1] / s.beat;   // k = Nummer des Dreiecks, das gerade entsteht
        // Punkte wie in Idee 3: [Reihe, Platz, Zeitpunkt in Schlägen]; Spitze oben, Reihen 1 · 2 · 3 · 4
        const BALLS = [[1, 0, .5], [1, 1, .75], [2, 0, 1.5], [2, 2, 1.75], [3, 0, 2.5], [3, 3, 2.75], [0, 0, 3], [2, 1, 3.25], [3, 1, 3.5], [3, 2, 3.75]];
        c.fillStyle = s.fg;
        for (let n = 0; n <= k; n++) {
          const a = (22.5 + 45 * n) * Math.PI / 180;                              // im Uhrzeigersinn, oben beginnend
          c.save(); c.translate(s.w / 2 + Math.sin(a) * R, s.h / 2 - Math.cos(a) * R); c.rotate(a);
          for (const [row, i, t] of BALLS) {
            if (n === k && b < t) continue;                                     // das aktuelle Dreieck baut sich auf, die früheren sind fertig
            c.beginPath(); c.arc((i - row / 2) * d, (row - 1.5) * d, r, 0, Math.PI * 2); c.fill();
          }
          c.restore();
        }
      },
    },
    {
      title: 'Kreis aus 60 Punkten',
      text: 'Ein großer Kreis aus 60 Punkten füllt sich in 10 Takten. In jedem Takt tauchen sechs Punkte an zufälligen Stellen des Kreises auf: zwei in der Mitte von Schlag 1, zwei in der Mitte von Schlag 2 und zwei in der Mitte von Schlag 3 (der zweite jeweils eine 16tel später). Im 4. Schlag fliegen vier weitere, große Punkte von außerhalb des Bildes in die Mitte, jeweils so, dass sie auf einer 16tel ankommen. Dabei werden sie immer kleiner und verschwinden dort, als würden sie in ein Loch fallen. Nach dem zehnten Takt ist der Kreis voll; dann fängt es von vorn an.',
      tag: '6 Punkte auf dem Kreis · 4 fliegen in die Mitte',
      draw(c, s) {
        const N = 10, PER = 6, TOT = N * PER, m0 = Math.min(s.w, s.h), R = m0 * .38, r = m0 * .016;
        const first = Math.round((DUR - 8 * s.bar) / s.bar);            // Beginn der Ringtone-Spur (Takt 24): dort fängt der Kreis von vorn an
        const [kk, p] = loop(s.t, s.bar), k = (((kk - first) % N) + N) % N, b = p / s.beat;
        const slot = [...Array(TOT).keys()].sort((a, z) => hash32(a * 31 + 7) - hash32(z * 31 + 7));   // zufällige, aber feste Reihenfolge der 60 Plätze
        const T = [.5, .75, 1.5, 1.75, 2.5, 2.75];
        c.fillStyle = s.fg;
        const dot = (x, y) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); };
        for (let i = 0; i < (k + 1) * PER; i++) {
          if (i >= k * PER && b < T[i - k * PER]) continue;       // in diesem Takt tauchen sie zu ihrem Zeitpunkt auf
          const a = slot[i] / TOT * Math.PI * 2;
          dot(s.w / 2 + Math.sin(a) * R, s.h / 2 - Math.cos(a) * R);
        }
        const far = Math.hypot(s.w, s.h) * .6, sec = [0, 1, 2, 3].sort((a, z) => hash32(a * 17 + k * 101 + 5) - hash32(z * 17 + k * 101 + 5));   // jeder der vier Punkte kommt aus einem anderen Viertel – in zufälliger Reihenfolge
        for (let j = 0; j < 4; j++) {                              // vier Punkte von außen in die Mitte, angekommen auf 3 · 3,25 · 3,5 · 3,75
          const tA = 3 + j * .25, e = seg(b, tA - .35, tA);
          if (e <= 0 || b >= tA) continue;
          const a = (sec[j] + .15 + .7 * rnd(k, j, 83)) * Math.PI / 2, q = eIn(e), d = far * (1 - q), rad = r * 6 * (1 - q);   // groß von außen, wird zur Mitte hin kleiner – fällt wie in ein Loch
          c.beginPath(); c.arc(s.w / 2 + Math.sin(a) * d, s.h / 2 - Math.cos(a) * d, rad, 0, Math.PI * 2); c.fill();
        }
      },
    },
    {
      title: 'Punkte wandern die Spirale nach innen',
      text: 'Eine Spirale aus 48 Punkten, die sich über die 8 Takte der Spur von außen nach innen füllt. Wie bei „Spalten wandern“: In jedem Takt tauchen sechs neue Punkte auf (zwei in der Mitte von Schlag 1, 2 und 3, der zweite eine 16tel später), im 4. Schlag verschwinden die vier ältesten auf je einer 16tel – sie rutschen dabei an der Spirale nach außen aus dem Bild. So wandert ein Band aus Punkten die Spirale entlang nach innen, und jeden Takt bleiben zwei mehr stehen. Die Punkte werden nach innen kleiner.',
      tag: '8 Takte · 6 rein, 4 raus · Spirale nach innen',
      draw(c, s) { ringSpiral(c, s, true); },
    },
    {
      title: 'Punkte wandern die Spirale nach außen',
      text: 'Dasselbe wie die Spirale nach innen, nur umgekehrt: Das Band aus Punkten beginnt in der Mitte und wandert die Spirale nach außen. Sechs neue Punkte pro Takt (Mitte von Schlag 1, 2 und 3, je zwei), im 4. Schlag verschwinden die vier ältesten auf je einer 16tel – sie rutschen dabei an der Spirale zurück in die Mitte und werden dort klein. Die Punkte werden nach außen größer.',
      tag: '8 Takte · 6 rein, 4 raus · Spirale nach außen',
      draw(c, s) { ringSpiral(c, s, false); },
    },
    {
      title: 'Snake',
      text: 'Eine Schlange aus Punkten schlängelt sich in Bahnen hin und her durch ein Raster aus 8 × 6 Feldern: die erste Reihe von links nach rechts, die nächste zurück, und so weiter. Wie bei „Spalten wandern“ wächst sie im Rhythmus: In jedem Takt kommen am Kopf sechs Punkte dazu (zwei in der Mitte von Schlag 1, 2 und 3, der zweite eine 16tel später), im 4. Schlag schrumpfen die vier hintersten Punkte am Schwanz auf je einer 16tel weg. So kriecht die Schlange über die 8 Takte der Spur durchs Raster und wird dabei jeden Takt zwei Punkte länger. Der Kopf ist etwas größer.',
      tag: '8 Takte · 6 am Kopf rein, 4 am Schwanz raus',
      draw(c, s) {
        const CYC = 8, TOT = CYC * 6, COLS = 8, ROWS = 6, cell = Math.min(s.w / COLS, s.h / ROWS), r = cell * .42;
        const first = Math.round((DUR - CYC * s.bar) / s.bar);                    // die Spur umfasst die letzten 8 Takte des Songs
        const bt = ((((s.t / s.bar - first) % CYC) + CYC) % CYC) * 4;             // Schläge ab Beginn des ersten Takts (davor/danach als Schleife)
        const T = [.5, .75, 1.5, 1.75, 2.5, 2.75], x0 = (s.w - cell * COLS) / 2, y0 = (s.h - cell * ROWS) / 2;
        let head = -1;
        for (let g = 0; g < TOT; g++) if (bt >= Math.floor(g / 6) * 4 + T[g % 6]) head = g;   // der zuletzt aufgetauchte Punkt ist der Kopf
        c.fillStyle = s.fg;
        for (let g = 0; g <= head; g++) {
          const tO = Math.floor(g / 4) * 4 + 3 + (g % 4) / 4, f = eIO(seg(bt, tO, tO + .3));   // Schwanz: die vier hintersten schrumpfen im 4. Schlag weg
          if (f >= 1) continue;
          const row = Math.floor(g / COLS), ci = g % COLS, col = row % 2 ? COLS - 1 - ci : ci;   // Bahn für Bahn hin und her
          c.beginPath(); c.arc(x0 + (col + .5) * cell, y0 + (row + .5) * cell, r * (g === head ? 1.15 : 1) * (1 - f), 0, Math.PI * 2); c.fill();
        }
      },
    },
    {
      title: 'Kreis-Schlange wechselt die Richtung',
      text: 'Eine Kette aus Punkten wächst auf einem Kreis aus 80 Plätzen. In jedem Takt kommen sechs Punkte am Ende der Kette dazu (zwei in der Mitte von Schlag 1, 2 und 3, der zweite eine 16tel später) – im einen Takt im Uhrzeigersinn, im nächsten gegen den Uhrzeigersinn, immer im Wechsel. Im 4. Schlag entstehen am anderen Ende der Kette vier weitere Punkte (auf je einer 16tel), wandern in die entgegengesetzte Richtung einmal um den freien Teil des Kreises herum und setzen sich vorn an die Kette. Dort baut sich der Kreis im nächsten Takt in der anderen Richtung weiter auf. Pro Takt kommen so 10 Punkte dazu; nach den 8 Takten der Spur ist der Kreis mit 80 Punkten voll, dann fängt es von vorn an.',
      tag: '6 am Ende rein · 4 wandern nach vorn · 80 Punkte',
      draw(c, s) {
        const N = 8, S = 80, m0 = Math.min(s.w, s.h), R = m0 * .4, r = m0 * .013;
        const first = Math.round((DUR - 8 * s.bar) / s.bar);                    // Beginn der Ringtone-Spur
        const [kk, p] = loop(s.t, s.bar), k = (((kk - first) % N) + N) % N, b = p / s.beat;
        const T = [.5, .75, 1.5, 1.75, 2.5, 2.75];
        let lo = 0, hi = 0;                                                       // Kette = Plätze lo … hi−1 (fortlaufend gezählt, nicht modulo)
        for (let q = 0; q < k; q++) { if (q % 2 === 0) hi += 10; else lo -= 10; }   // Zustand zu Beginn des Takts k
        const cw = k % 2 === 0, G = S - (hi - lo) - 10;                           // G = Weg, den die vier Wanderer durch den freien Teil zurücklegen
        c.fillStyle = s.fg;
        const dot = pos => { const a = -Math.PI / 2 + pos / S * Math.PI * 2; c.beginPath(); c.arc(s.w / 2 + Math.cos(a) * R, s.h / 2 + Math.sin(a) * R, r, 0, Math.PI * 2); c.fill(); };
        for (let sl = lo; sl < hi; sl++) dot(sl);                                 // die Kette
        for (let j = 0; j < 6; j++) if (b >= T[j]) dot(cw ? hi + j : lo - 1 - j);   // sechs neue am Ende, im Wechsel mit/gegen den Uhrzeigersinn
        for (let i = 0; i < 4; i++) {                                             // vier Wanderer: entstehen am anderen Ende und gehen in die Gegenrichtung nach vorn
          const t0 = 3 + i / 4; if (b < t0) continue;
          const f = eIO(seg(b, t0, t0 + .3));
          dot(cw ? lo - 4 + i - G * f : hi + 3 - i + G * f);
        }
      },
    },
  ],
};
// Gilt nur auf der Zuordnungs-Seite (window.IDEEN_GATE): Einsatz von Drums und Ringtone: laut „Rangfolge der Spuren pro Abschnitt“ in der Klanghierarchie erst mit Takt 25 (zusammen mit dem Jagdhorn) –
// davor ist nichts zu sehen. Die 8 Takte der Ringtone-Ideen beginnen genau dort und reichen bis zum Songende.
{
  const RF = Math.round((DUR - 8 * BAR) / BAR), START = RF * BAR;   // Takt 25 = 24 Takte nach dem ersten Taktschlag
  for (const idea of IDEAS.drums.concat(IDEAS.ring)) { const d = idea.draw; idea.draw = (c, s) => { if (!window.IDEEN_GATE || s.t >= START) d.call(idea, c, s); }; }
}
/* ═════════════════════════════ Ende Animationen ══════════════════════════ */

/* ---------- Zuordnung zum morphologischen Kasten (i-Button) + „Andere Parameter ausprobieren“ ---------- */
// Werte so, wie sie im Kasten (Version 2/3) heißen. n = Kasten-Zeile, v = Auswahl, t = gekoppelter Klangparameter, h = Erklärung
const FLUTE_MAP = [
  { g: 'Kasten 1 · Visuelle Erscheinung', rows: [
    { n: 'Grundelement', v: 'Kreis', h: 'Jede Kugel ist ein Kreis.' },
    { n: 'Formcharakter', v: 'Geometrisch', h: 'Exakter Kreis, nichts Wackliges oder Weiches.' },
    { n: 'Größe', v: 'Klein', h: 'Radius ≈ 6,5 % der Kastenhöhe – im Kasten zwischen „Klein“ und „Mittel“, hier als „Klein“ eingetragen.' },
    { n: 'Farbtemperatur', v: 'Neutral', h: 'Weder warm noch kalt.' },
    { n: 'Helligkeit', v: 'Hell', h: 'Im Dark Mode weiß auf schwarz. Im Light Mode kehrt es sich um (schwarz auf weiß), die Rolle bleibt „Kontrastfarbe“.' },
    { n: 'Farbton', v: 'Unbunt', h: 'Kein Farbton, nur Weiß/Grau.' },
    { n: 'Sättigung', v: 'Entsättigt', h: 'Keine Farbe – passt zu „unbunt“.' },
    { n: 'Transparenz', v: 'Halbtransparent', h: 'Fliegende Kugeln haben 40 % Deckkraft; die Kugel in der Mitte füllt sich bis zu 100 %.' },
    { n: 'Anzahl', v: 'Mehrere', h: '8 Kugeln pro halbem Takt.' },
    { n: 'Anordnung', v: 'Linear', h: 'Alle Kugeln fliegen auf einer senkrechten Achse in der Bildmitte hintereinander.' },
    { n: 'Dimensionalität', v: '2D', h: 'Flach, ohne Schatten oder Tiefe.' },
    { n: 'Füllung', v: 'Gefüllt', h: 'Vollflächig in der Vordergrundfarbe.' },
    { n: 'Kontur', v: 'Keine' },
    { n: 'Oberflächenbeschaffenheit', v: 'Glatt' },
  ] },
  { g: 'Kasten 2 · Visuelles Verhalten', rows: [
    { n: 'Formveränderung', v: 'Keine', h: 'Die Kugeln bleiben immer gleich groß und rund.' },
    { n: 'Formtransformation', v: 'Keine' },
    { n: 'Farbveränderung', v: 'Keine', h: 'Nur die Deckkraft ändert sich (die Kugel in der Mitte füllt sich), nicht die Farbe.' },
    { n: 'Position im Raum', v: 'Mitte', h: 'Wo im Bild das Element seinen Platz hat. Hier: Die Kugeln sammeln sich in der Bildmitte als Haltepunkt, bevor sie nach unten weiterfliegen. „Oben“, „Unten“ würden diesen Haltepunkt verschieben; „Vordergrund“/„Hintergrund“ meint dagegen Tiefe.' },
    { n: 'Bewegungsrichtung', v: 'Runter', t: 'Tonhöhe', h: 'Die Flöte fällt in der Tonhöhe immer weiter ab – deshalb bewegen sich auch die Kugeln nach unten.' },
    { n: 'Bewegungsbahn', v: 'Gerade', h: 'Senkrecht, ohne seitlichen Ausschlag.' },
    { n: 'Geschwindigkeit', v: 'Moderat', t: 'Rhythmus', h: 'Richtet sich nach dem Rhythmus: 8 Töne pro halbem Takt, eine Kugel braucht etwa 30 % eines halben Takts bis zur nächsten Station.' },
    { n: 'Beschleunigung', v: 'Zunehmend', h: 'Im Code fallen die Kugeln leicht beschleunigt (Weg ∝ Zeit²). Du hattest „keine“ gesagt – wenn das nicht gewollt ist, stelle ich es auf „Keine“ um.' },
    { n: 'Rhythmus', v: 'Regelmäßig', t: 'Rhythmus', h: 'Der Sound gibt den Takt vor: 8 Kugeln im Abstand einer 16tel, ein Durchlauf = 1 Takt.' },
    { n: 'Erscheinungsverhalten', v: 'Einblenden', h: 'Die Kugeln kommen von außerhalb des Bildes (oben) herein.' },
    { n: 'Verschwindeverhalten', v: 'Ausblenden', h: 'Sie verlassen das Bild nach unten; in der Mitte verblasst die Kugel.' },
    { n: 'Spur', v: 'Nachbild', h: 'Man kann es als Nachbild lesen: erste Kugel fällt, 7 weitere folgen als halbtransparente Nachbilder – oder als 8 einzelne Kugeln.' },
  ] },
  { g: 'Kasten 3 · Interaktion', rows: [{ n: 'Interaktion zwischen Elementen', v: 'Keine' }] },
];

const LOOK_COMMON = (size, extra) => [
  { n: 'Grundelement', v: 'Kreis', h: 'Jede Kugel ist ein Kreis.' },
  { n: 'Formcharakter', v: 'Geometrisch', h: 'Exakter Kreis, nichts Wackliges oder Weiches.' },
  { n: 'Größe', v: 'Klein', h: size },
  { n: 'Farbtemperatur', v: 'Neutral', h: 'Weder warm noch kalt.' },
  { n: 'Helligkeit', v: 'Hell', h: 'Im Dark Mode weiß auf schwarz. Im Light Mode kehrt es sich um (schwarz auf weiß), die Rolle bleibt „Kontrastfarbe“.' },
  { n: 'Farbton', v: 'Unbunt', h: 'Kein Farbton, nur Weiß/Grau.' },
  { n: 'Sättigung', v: 'Entsättigt', h: 'Keine Farbe – passt zu „unbunt“.' },
  ...extra,
  { n: 'Dimensionalität', v: '2D', h: 'Flach, ohne Schatten oder Tiefe.' },
  { n: 'Füllung', v: 'Gefüllt', h: 'Vollflächig in der Vordergrundfarbe.' },
  { n: 'Kontur', v: 'Keine' }, { n: 'Oberflächenbeschaffenheit', v: 'Glatt' },
];
const NONE3 = { g: 'Kasten 3 · Interaktion', rows: [{ n: 'Interaktion zwischen Elementen', v: 'Keine', h: 'Die Kugeln beeinflussen sich nicht gegenseitig.' }] };
const MAP2 = [
  { g: 'Kasten 1 · Visuelle Erscheinung', rows: LOOK_COMMON('Radius ≈ 5,5 % der Kastenhöhe.', [
    { n: 'Transparenz', v: 'Halbtransparent', h: 'Kugeln auf dem Kreis und im Flug haben 45 % Deckkraft; der Punkt in der Mitte füllt sich bis zu 100 %.' },
    { n: 'Anzahl', v: 'Mehrere', h: '8 Kugeln.' },
    { n: 'Anordnung', v: 'Radial', h: '8 Kugeln gleichmäßig auf einem Kreis um die Bildmitte, oben beginnend.' }]) },
  { g: 'Kasten 2 · Visuelles Verhalten', rows: [
    { n: 'Formveränderung', v: 'Keine', h: 'Die Kugeln bleiben gleich groß und rund.' },
    { n: 'Formtransformation', v: 'Gruppierung', h: 'Die 8 Kugeln sammeln sich nach und nach zu einem Punkt in der Mitte und lösen sich wieder daraus.' },
    { n: 'Farbveränderung', v: 'Keine', h: 'Nur die Deckkraft des Mittelpunkts ändert sich.' },
    { n: 'Position im Raum', v: 'Mitte', h: 'Wo im Bild das Element seinen Platz hat: Sammelpunkt ist die Bildmitte, die Ausgangsplätze liegen auf einem Kreis darum.' },
    { n: 'Bewegungsrichtung', v: 'Zur Mitte', h: '1. halber Takt: zur Mitte. 2. halber Takt: wieder nach außen. Eine Kopplung an einen Klangparameter ist hier noch nicht festgelegt.' },
    { n: 'Bewegungsbahn', v: 'Gerade', h: 'Geradlinig auf dem Radius.' },
    { n: 'Geschwindigkeit', v: 'Moderat', t: 'Rhythmus', h: 'Richtet sich nach dem Rhythmus: 8 Töne pro halbem Takt, eine Kugel braucht etwa 30 % eines halben Takts bis zur Mitte.' },
    { n: 'Beschleunigung', v: 'Zunehmend', h: 'Nach innen werden die Kugeln schneller, nach außen bremsen sie ab.' },
    { n: 'Rhythmus', v: 'Regelmäßig', t: 'Rhythmus', h: 'Eine Kugel pro 16tel; 1 Durchlauf = 1 Takt.' },
    { n: 'Erscheinungsverhalten', v: 'Zusammenfügen', h: 'Der Punkt in der Mitte entsteht aus den ankommenden Kugeln.' },
    { n: 'Verschwindeverhalten', v: 'Auflösen', h: 'Der Punkt verblasst, während die Kugeln nach außen wandern.' },
    { n: 'Spur', v: 'Keine' }] }, NONE3];
const MAP3 = [
  { g: 'Kasten 1 · Visuelle Erscheinung', rows: LOOK_COMMON('Radius ≈ 4,8 % der Kastenhöhe.', [
    { n: 'Transparenz', v: 'Halbtransparent', h: 'Nachbilder im Flug 40 % Deckkraft; der Platz wird bis 100 % kräftiger.' },
    { n: 'Anzahl', v: 'Einzeln', h: 'Eine Kugel (mit 8 Nachbildern pro halbem Takt).' },
    { n: 'Anordnung', v: 'Radial', h: '8 Plätze gleichmäßig auf einem Kreis um die Bildmitte.' }]) },
  { g: 'Kasten 2 · Visuelles Verhalten', rows: [
    { n: 'Formveränderung', v: 'Keine' }, { n: 'Formtransformation', v: 'Keine' }, { n: 'Farbveränderung', v: 'Keine' },
    { n: 'Position im Raum', v: 'Mitte', h: 'Wo im Bild das Element seinen Platz hat: Der Kreis liegt um die Bildmitte; die Kugel springt von Platz zu Platz.' },
    { n: 'Bewegungsrichtung', v: 'Im Uhrzeigersinn', h: 'Der Kasten kennt keine Kreisrichtung (Hoch/Runter/Rechts …) – deshalb hier als eigener Wert. Eine Kopplung an einen Klangparameter ist noch nicht festgelegt.' },
    { n: 'Bewegungsbahn', v: 'Kreisförmig', h: 'Auf dem Kreisbogen von Platz zu Platz.' },
    { n: 'Geschwindigkeit', v: 'Moderat', t: 'Rhythmus', h: 'Richtet sich nach dem Rhythmus: 8 Töne pro halbem Takt, ein Nachbild braucht 30 % eines halben Takts von Platz zu Platz.' },
    { n: 'Beschleunigung', v: 'Stufenweise', h: 'Pro halbem Takt ein Platz weiter, dazwischen weich abgebremst.' },
    { n: 'Rhythmus', v: 'Regelmäßig', t: 'Rhythmus', h: '8 Nachbilder im 16tel, ein Platz pro halbem Takt, eine Runde = 4 Takte.' },
    { n: 'Erscheinungsverhalten', v: 'Einblenden', h: 'Der neue Platz wird mit jedem Nachbild kräftiger.' },
    { n: 'Verschwindeverhalten', v: 'Ausblenden', h: 'Der alte Platz wird mit jedem Nachbild blasser.' },
    { n: 'Spur', v: 'Nachbild', h: '8 halbtransparente Nachbilder ziehen von Platz zu Platz.' }] }, NONE3];

const MAP14 = [
  { g: 'Kasten 1 · Visuelle Erscheinung', rows: [
    { n: 'Grundelement', v: 'Kreis', h: 'Jede Kugel ist ein Kreis.' },
    { n: 'Formcharakter', v: 'Geometrisch', h: 'Exakter Kreis, nichts Wackliges oder Weiches.' },
    { n: 'Größe', v: 'Mittel', h: 'Außen am Rand mittelgroß (Radius ≈ 10 % des Abstands zur Mitte), nach innen werden die Kugeln kleiner – siehe Formveränderung.' },
    { n: 'Farbtemperatur', v: 'Neutral', h: 'Weder warm noch kalt.' },
    { n: 'Helligkeit', v: 'Hell', h: 'Im Dark Mode weiß auf schwarz. Im Light Mode kehrt es sich um (schwarz auf weiß), die Rolle bleibt „Kontrastfarbe“.' },
    { n: 'Farbton', v: 'Unbunt', h: 'Schwarz-weiß, kein Farbton.' },
    { n: 'Sättigung', v: 'Entsättigt', h: 'Keine Farbe – passt zu „unbunt“.' },
    { n: 'Transparenz', v: 'Halbtransparent', h: 'Die Nachbilder haben 40 % Deckkraft; die Kugel auf ihrem Platz wird mit jedem Nachbild kräftiger.' },
    { n: 'Anzahl', v: 'Viele', h: 'Jeden halben Takt kommt außen eine Kugel dazu – die Spirale füllt sich.' },
    { n: 'Anordnung', v: 'Radial', h: 'Auf einer logarithmischen Spirale um die Bildmitte (14 Plätze pro Umdrehung).' },
    { n: 'Dimensionalität', v: '2D', h: 'Flach, ohne Schatten oder Tiefe.' },
    { n: 'Füllung', v: 'Gefüllt', h: 'Vollflächig in der Vordergrundfarbe.' },
    { n: 'Kontur', v: 'Keine' }, { n: 'Oberflächenbeschaffenheit', v: 'Glatt' }] },
  { g: 'Kasten 2 · Visuelles Verhalten', rows: [
    { n: 'Formveränderung', v: 'Verkleinern', t: 'Tonhöhe', h: 'Mit der Tonhöhe werden die Kugeln immer kleiner – je weiter sie auf der Spirale nach innen rücken.' },
    { n: 'Formtransformation', v: 'Keine' },
    { n: 'Farbveränderung', v: 'Keine', h: 'Nur die Deckkraft ändert sich, nicht die Farbe.' },
    { n: 'Position im Raum', v: 'Mitte', h: 'Die Spirale liegt um die Bildmitte; dorthin läuft alles zusammen.' },
    { n: 'Bewegungsrichtung', v: 'Zur Mitte', t: 'Lautstärke', h: 'Über die ganze Dauer (die 16 Einsätze am Anfang) wird die Flöte immer leiser – die Kugeln wandern immer weiter in die Mitte, die Spirale geht von einem weg.' },
    { n: 'Bewegungsbahn', v: 'Spiralförmig', h: 'Von Platz zu Platz entlang der Spirale, das Ganze dreht sich langsam (eine Umdrehung in 8 Takten).' },
    { n: 'Geschwindigkeit', v: 'Moderat', t: 'Rhythmus', h: 'Richtet sich nach dem Rhythmus: 8 Töne pro halbem Takt, ein Nachbild braucht 30 % eines halben Takts bis zum nächsten Platz.' },
    { n: 'Beschleunigung', v: 'Stufenweise', h: 'Pro halbem Takt ein Platz weiter, dazwischen weich abgebremst.' },
    { n: 'Rhythmus', v: 'Regelmäßig', t: 'Rhythmus', h: 'Die Kugeln bewegen sich nach dem Rhythmus der Flöte: 8 Abstufungen der Tonhöhe = 8 Nachbilder im 16tel, ein Platz pro halbem Takt.' },
    { n: 'Erscheinungsverhalten', v: 'Einblenden', h: 'Neue Kugeln kommen von außen am Bildrand herein.' },
    { n: 'Verschwindeverhalten', v: 'Schrumpfen', h: 'In der Mitte werden die Kugeln so klein, dass sie verschwinden.' },
    { n: 'Spur', v: 'Nachbild', h: '8 halbtransparente Nachbilder ziehen von Platz zu Platz.' }] }, NONE3];

const MAP15 = [
  { g: 'Kasten 1 · Visuelle Erscheinung', rows: [
    { n: 'Grundelement', v: 'Kreis', h: 'Jede Kugel ist ein Kreis.' },
    { n: 'Formcharakter', v: 'Geometrisch', h: 'Exakter Kreis, nichts Wackliges oder Weiches.' },
    { n: 'Größe', v: 'Mittel', h: 'Radius ≈ 10 % des Abstands zur Mitte: in der Mitte winzig, nach außen werden die Kugeln größer – siehe Formveränderung.' },
    { n: 'Farbtemperatur', v: 'Neutral', h: 'Weder warm noch kalt.' },
    { n: 'Helligkeit', v: 'Hell', h: 'Im Dark Mode weiß auf schwarz. Im Light Mode kehrt es sich um (schwarz auf weiß), die Rolle bleibt „Kontrastfarbe“.' },
    { n: 'Farbton', v: 'Unbunt', h: 'Schwarz-weiß, kein Farbton.' },
    { n: 'Sättigung', v: 'Entsättigt', h: 'Keine Farbe – passt zu „unbunt“.' },
    { n: 'Transparenz', v: 'Halbtransparent', h: 'Die Nachbilder haben 40 % Deckkraft; die Kugel auf ihrem Platz wird mit jedem Nachbild kräftiger.' },
    { n: 'Anzahl', v: 'Viele', h: 'Jeden halben Takt kommt in der Mitte eine Kugel dazu – die Spirale füllt sich.' },
    { n: 'Anordnung', v: 'Radial', h: 'Auf einer logarithmischen Spirale um die Bildmitte (14 Plätze pro Umdrehung).' },
    { n: 'Dimensionalität', v: '2D', h: 'Flach, ohne Schatten oder Tiefe.' },
    { n: 'Füllung', v: 'Gefüllt', h: 'Vollflächig in der Vordergrundfarbe.' },
    { n: 'Kontur', v: 'Keine' }, { n: 'Oberflächenbeschaffenheit', v: 'Glatt' }] },
  { g: 'Kasten 2 · Visuelles Verhalten', rows: [
    { n: 'Formveränderung', v: 'Vergrößern', t: 'Tonhöhe', h: 'Umgekehrt zur Spirale nach innen: Mit der Tonhöhe werden die Kugeln immer größer – je weiter sie auf der Spirale nach außen rücken.' },
    { n: 'Formtransformation', v: 'Keine' },
    { n: 'Farbveränderung', v: 'Keine', h: 'Nur die Deckkraft ändert sich, nicht die Farbe.' },
    { n: 'Position im Raum', v: 'Mitte', h: 'Die Spirale liegt um die Bildmitte; von dort läuft alles nach außen.' },
    { n: 'Bewegungsrichtung', v: 'Nach außen', t: 'Lautstärke', h: 'Umgekehrt zur Spirale nach innen: Je lauter die Flöte wird, desto weiter wandern die Kugeln nach außen – die Spirale kommt auf einen zu.' },
    { n: 'Bewegungsbahn', v: 'Spiralförmig', h: 'Von Platz zu Platz entlang der Spirale, das Ganze dreht sich langsam (eine Umdrehung in 8 Takten).' },
    { n: 'Geschwindigkeit', v: 'Moderat', t: 'Rhythmus', h: 'Richtet sich nach dem Rhythmus: 8 Töne pro halbem Takt, ein Nachbild braucht 30 % eines halben Takts bis zum nächsten Platz.' },
    { n: 'Beschleunigung', v: 'Stufenweise', h: 'Pro halbem Takt ein Platz weiter, dazwischen weich abgebremst.' },
    { n: 'Rhythmus', v: 'Regelmäßig', t: 'Rhythmus', h: 'Die Kugeln bewegen sich nach dem Rhythmus der Flöte: 8 Abstufungen der Tonhöhe = 8 Nachbilder im 16tel, ein Platz pro halbem Takt.' },
    { n: 'Erscheinungsverhalten', v: 'Wachsen', h: 'Neue Kugeln tauchen winzig in der Mitte auf und wachsen von dort.' },
    { n: 'Verschwindeverhalten', v: 'Ausblenden', h: 'Groß geworden verlassen sie das Bild über den Rand.' },
    { n: 'Spur', v: 'Nachbild', h: '8 halbtransparente Nachbilder ziehen von Platz zu Platz.' }] }, NONE3];

// ---- Parametrisierte Versionen der Ideen (Standardwerte = Original) ----
const FP_OPTS = {
  element: ['Kreis', 'Rechteck', 'Quadrat', 'Dreieck', 'Polygon', 'Linie', 'Punkt'], char: ['Geometrisch', 'Abgerundet', 'Organisch', 'Spitz'],
  size: ['Winzig', 'Klein', 'Mittel', 'Groß', 'Riesig'], temp: ['Warm', 'Neutral', 'Kalt'], light: ['Hell', 'Mittel', 'Dunkel'],
  hue: ['Rot', 'Orange', 'Gelb', 'Grün', 'Blau', 'Violett', 'Magenta', 'Unbunt'], sat: ['Entsättigt', 'Mittel', 'Gesättigt'],
  alpha: ['Undurchsichtig', 'Halbtransparent', 'Transparent'], count: ['Einzeln', 'Wenige', 'Mehrere', 'Viele'], layout: ['Linear', 'Verteilt', 'Zufällig'],
  dim: ['2D', '3D'], fill: ['Gefüllt', 'Ungefüllt'], stroke: ['Keine', 'Dünn', 'Dick', 'Gestrichelt'],
  place: ['Oben', 'Mitte', 'Unten'], dir: ['Runter', 'Hoch', 'Rechts', 'Links'], path: ['Gerade', 'Wellig', 'Zickzack'],
  speed: ['Langsam', 'Moderat', 'Schnell'], accel: ['Keine', 'Zunehmend', 'Abnehmend'],
};
const FP_NAMES = { element: 'Grundelement', char: 'Formcharakter', size: 'Größe', temp: 'Farbtemperatur', light: 'Helligkeit', hue: 'Farbton', sat: 'Sättigung', alpha: 'Transparenz', count: 'Anzahl', layout: 'Anordnung', dim: 'Dimensionalität', fill: 'Füllung', stroke: 'Kontur', place: 'Position im Raum', dir: 'Bewegungsrichtung', path: 'Bewegungsbahn', speed: 'Geschwindigkeit', accel: 'Beschleunigung' };
const LOOK = { element: 'Kreis', char: 'Geometrisch', size: 'Klein', temp: 'Neutral', light: 'Hell', hue: 'Unbunt', sat: 'Entsättigt', alpha: 'Halbtransparent', dim: '2D', fill: 'Gefüllt', stroke: 'Keine' };
const LOOK_KEYS = ['element', 'char', 'size', 'temp', 'light', 'hue', 'sat', 'alpha', 'count'];
const SIZEF = { Winzig: .5, Klein: 1, Mittel: 1.6, 'Groß': 2.4, Riesig: 3.4 }, SPEEDF = { Langsam: .5, Moderat: .3, Schnell: .16 };
function fpColor(P, fg) {
  const H = { Rot: 2, Orange: 28, Gelb: 52, 'Grün': 130, Blau: 215, Violett: 268, Magenta: 322 }, L = { Hell: 72, Mittel: 52, Dunkel: 30 }[P.light], S = { 'Entsättigt': 26, Mittel: 58, 'Gesättigt': 92 }[P.sat];
  if (P.hue !== 'Unbunt') return `hsl(${H[P.hue] + (P.temp === 'Warm' ? -8 : P.temp === 'Kalt' ? 8 : 0)},${S}%,${L}%)`;
  if (P.temp !== 'Neutral') return `hsl(${P.temp === 'Warm' ? 28 : 212},${Math.max(S, 35)}%,${L}%)`;
  return P.light === 'Hell' ? fg : `hsl(0,0%,${L}%)`;
}
function fpShape(c, P, x, y, r, col, a, seed) {
  const el = P.element, rr = el === 'Punkt' ? r * .35 : r, ch = P.char;
  c.save(); c.translate(x, y); c.globalAlpha = a; c.beginPath();
  const poly = (n, R, a0) => { for (let i = 0; i < n; i++) { const t = a0 + i * Math.PI * 2 / n; i ? c.lineTo(Math.cos(t) * R, Math.sin(t) * R) : c.moveTo(Math.cos(t) * R, Math.sin(t) * R); } c.closePath(); };
  if (ch === 'Spitz' && el !== 'Linie' && el !== 'Punkt') { for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + i * Math.PI / 5, R = i % 2 ? rr * .5 : rr * 1.25; i ? c.lineTo(Math.cos(t) * R, Math.sin(t) * R) : c.moveTo(Math.cos(t) * R, Math.sin(t) * R); } c.closePath(); }
  else if (ch === 'Organisch' && el !== 'Linie' && el !== 'Punkt') { for (let i = 0; i <= 24; i++) { const t = i / 24 * Math.PI * 2, R = rr * (1 + .16 * Math.sin(t * 3 + seed * 7) + .1 * Math.sin(t * 5 + seed * 3)); i ? c.lineTo(Math.cos(t) * R, Math.sin(t) * R) : c.moveTo(Math.cos(t) * R, Math.sin(t) * R); } c.closePath(); }
  else if (el === 'Kreis' || el === 'Punkt') c.arc(0, 0, rr, 0, Math.PI * 2);
  else if (el === 'Rechteck') c.rect(-rr * 1.4, -rr * .85, rr * 2.8, rr * 1.7);
  else if (el === 'Quadrat') c.rect(-rr * .9, -rr * .9, rr * 1.8, rr * 1.8);
  else if (el === 'Dreieck') poly(3, rr * 1.15, -Math.PI / 2);
  else if (el === 'Polygon') poly(6, rr, 0);
  else if (el === 'Linie') { c.moveTo(-rr * 1.6, 0); c.lineTo(rr * 1.6, 0); }
  let paint = col;
  if (P.dim === '3D' && el !== 'Linie') { const g = c.createRadialGradient(-rr * .35, -rr * .35, rr * .1, 0, 0, rr * 1.3); g.addColorStop(0, '#ffffff'); g.addColorStop(.35, col); g.addColorStop(1, '#00000099'); paint = g; }
  const sw = { Keine: 0, 'Dünn': Math.max(1, r * .08), Dick: r * .3, Gestrichelt: Math.max(1.2, r * .12) }[P.stroke] || 0;
  const line = el === 'Linie', ungef = P.fill === 'Ungefüllt' && !line;
  c.lineJoin = ch === 'Abgerundet' ? 'round' : 'miter'; c.lineCap = 'round';
  if (!ungef && !line) { c.fillStyle = paint; c.fill(); if (ch === 'Abgerundet' && el !== 'Kreis' && el !== 'Punkt') { c.strokeStyle = paint; c.lineWidth = rr * .55; c.stroke(); } }
  if (sw || ungef || line) {
    c.strokeStyle = line || ungef || !sw ? col : P.light === 'Hell' ? '#888' : col; c.lineWidth = line ? Math.max(2, r * (P.stroke === 'Dick' ? .5 : .22)) : (sw || Math.max(1.2, r * .1));
    if (P.stroke === 'Gestrichelt') c.setLineDash([c.lineWidth * 2.2, c.lineWidth * 1.6]);
    c.stroke();
  }
  c.restore();
}
function fluteFall(c, s, P) {
  const horiz = P.dir === 'Rechts' || P.dir === 'Links', lw = horiz ? s.h : s.w, lh = horiz ? s.w : s.h;
  c.save();
  if (P.dir === 'Hoch') c.transform(1, 0, 0, -1, 0, s.h); else if (P.dir === 'Rechts') c.transform(0, 1, 1, 0, 0, 0); else if (P.dir === 'Links') c.transform(0, 1, -1, 0, s.w, 0);
  const N = { Einzeln: 1, Wenige: 4, Mehrere: 8, Viele: 16 }[P.count], T = s.bar / 2, step = T / N;
  const D = T * { Langsam: .5, Moderat: .3, Schnell: .16 }[P.speed], fn = { Keine: p => p, Zunehmend: p => p * p, Abnehmend: p => 1 - (1 - p) * (1 - p) }[P.accel];
  const base = { Winzig: .5, Klein: 1, Mittel: 1.6, 'Groß': 2.4, Riesig: 3.4 }[P.size], r = Math.min(lw, lh) * .065 * base;
  const A = { Undurchsichtig: 1, Halbtransparent: .4, Transparent: .2 }[P.alpha], col = fpColor(P, s.fg);
  const mid = { Oben: .25, Mitte: .5, Unten: .75 }[P.place], Y = [-r * 2, lh * mid, lh + r * 2], L = 2;
  const mod = (a, n) => ((a % n) + n) % n, n = Math.floor(s.t / T);
  const px = (i, y) => {   // seitliche Lage: Anordnung + Bahn
    let x = lw / 2;
    if (P.layout === 'Verteilt') x = lw * (N === 1 ? .5 : .14 + .72 * i / (N - 1));
    else if (P.layout === 'Zufällig') x = lw * (.15 + .7 * rnd(0, i, 5));
    if (P.path === 'Wellig') x += Math.sin(y / lh * Math.PI * 4) * lw * .08;
    else if (P.path === 'Zickzack') x += (Math.abs(((y / lh * 3) % 2 + 2) % 2 - 1) * 2 - 1) * lw * .07;
    return x;
  };
  const landed = m => clamp(Math.floor((s.t - m * T) / step) + 1, 0, N), departed = m => clamp(Math.floor((s.t - m * T + D) / step) + 1, 0, N);
  for (let st = 1; st < L; st++) {          // Mitte: füllt sich mit jeder Kugel
    let mf = n + 1 - mod(n + 1 - (st - 1), L); if (mf * T - D > s.t) mf -= L;
    const o = (landed(mf) - departed(mf + 1)) / N; if (o <= 0) continue;
    for (let i = 0; i < N; i++) fpShape(c, P, px(i, Y[st]), Y[st], r, col, Math.min(1, o) * Math.min(1, A / .4) / (N > 1 && P.layout !== 'Linear' ? 1 : 1), i);
  }
  for (let m = n - 1; m <= n + 1; m++) {
    const q = mod(m, L), y0 = Y[q], y1 = Y[q + 1];
    for (let i = 0; i < N; i++) {
      const t0 = m * T + i * step - D; if (s.t < t0 || s.t >= t0 + D) continue;
      const y = y0 + (y1 - y0) * fn((s.t - t0) / D); fpShape(c, P, px(i, y), y, r, col, A, i);
    }
  }
  c.restore();
}


function circleContract(c, s, P) {      // Idee 2: Kugeln im Kreis wandern zur Mitte und wieder hinaus
  const N = { Einzeln: 1, Wenige: 4, Mehrere: 8, Viele: 16 }[P.count], T = s.bar / 2, step = T / N, D = T * SPEEDF[P.speed], EARLY = step * .5;
  const m0 = Math.min(s.w, s.h), r = m0 * .055 * SIZEF[P.size], R = m0 * .33, cx = s.w / 2, cy = s.h / 2, col = fpColor(P, s.fg);
  const A = { Undurchsichtig: 1, Halbtransparent: .45, Transparent: .22 }[P.alpha];
  const fIn = { Zunehmend: p => p * p, Keine: p => p, Abnehmend: p => 1 - (1 - p) * (1 - p) }[P.accel], fOut = { Zunehmend: p => 1 - (1 - p) * (1 - p), Keine: p => p, Abnehmend: p => p * p }[P.accel];
  const ang = i => -Math.PI / 2 + i * Math.PI * 2 / N, ball = (x, y, a, i) => fpShape(c, P, x, y, r, col, a, i);
  const t = s.t, n = Math.floor(t / T);
  const arrived = m => clamp(Math.floor((t - m * T) / step) + 1, 0, N), left = m => clamp(Math.floor((t - m * T + EARLY) / step) + 1, 0, N);
  let mi = n - ((n % 2) + 2) % 2 + 2; while (mi * T - D > t) mi -= 2;
  const o = (arrived(mi) - left(mi + 1)) / N; if (o > 0) ball(cx, cy, Math.min(1, o) * Math.min(1, A / .45), 0);
  const cyc = Math.floor((t + D) / (2 * T));
  for (let i = 0; i < N; i++) {
    const away = k => t >= 2 * k * T + i * step - D && t < (2 * k + 1) * T + i * step - EARLY + D;
    if (away(cyc) || away(cyc - 1)) continue;
    ball(cx + Math.cos(ang(i)) * R, cy + Math.sin(ang(i)) * R, A, i);
  }
  for (let m = n - 1; m <= n + 1; m++) {
    const inward = ((m % 2) + 2) % 2 === 0;
    for (let i = 0; i < N; i++) {
      const t0 = m * T + i * step - (inward ? D : EARLY); if (t < t0 || t >= t0 + D) continue;
      const p = (t - t0) / D, k = inward ? 1 - fIn(p) : fOut(p);
      ball(cx + Math.cos(ang(i)) * R * k, cy + Math.sin(ang(i)) * R * k, A, i);
    }
  }
}
function wanderCircle(c, s, P) {         // Idee 4: Kugel(n) wandern von Platz zu Platz im Kreis
  const N = 8, PL = 8, T = s.bar / 2, step = T / N, D = T * SPEEDF[P.speed], cnt = { Einzeln: 1, Wenige: 2, Mehrere: 4, Viele: 8 }[P.count];
  const m0 = Math.min(s.w, s.h), r = m0 * .048 * SIZEF[P.size], R = m0 * .38, cx = s.w / 2, cy = s.h / 2, col = fpColor(P, s.fg), sg = P.dir === 'Im Uhrzeigersinn' ? 1 : -1;
  const A = { Undurchsichtig: 1, Halbtransparent: .4, Transparent: .2 }[P.alpha];
  const ball = (pos, al, i) => { const a = -Math.PI / 2 + sg * pos * Math.PI * 2 / PL; fpShape(c, P, cx + Math.cos(a) * R, cy + Math.sin(a) * R, r, col, al, i); };
  const t = s.t, n = Math.floor(t / T);
  const landed = m => clamp(Math.floor((t - m * T) / step) + 1, 0, N), departed = m => clamp(Math.floor((t - m * T + D) / step) + 1, 0, N);
  for (let j = 0; j < cnt; j++) {
    const off = j * PL / cnt;
    for (const m of [n - 1, n, n + 1]) { const o = (landed(m) - departed(m + 1)) / N; if (o > 0) ball(m + 1 + off, Math.min(1, o) * Math.min(1, A / .4), j); }
    for (let m = n - 1; m <= n + 1; m++) for (let i = 0; i < N; i++) {
      const t0 = m * T + i * step - D; if (t < t0 || t >= t0 + D) continue;
      const p = (t - t0) / D; ball(m + p * p * (3 - 2 * p) + off, A, j);
    }
  }
}
function spiralIn(c, s, P) {          // Idee 16: Spirale nach innen – voll einstellbar (Standardwerte = Original)
  const N = 8, T = s.bar / 2, step = T / N;       // 8 Nachbilder pro halben Takt
  const D = T * SPEEDF[P.speed];                  // Flugzeit eines Nachbilds von Platz zu Platz (Moderat = 30 % eines halben Takts)
  const cx = s.w / 2, cy = s.h / 2, Rmax = Math.min(s.w, s.h) * .5 * .93;   // Einstieg (Platz −1) liegt genau am Bildrand – sofort sichtbar
  const Q = .93;                                  // jeder Platz weiter innen ist 7 % näher an der Mitte (logarithmische Spirale)
  const turn = Math.PI * 2 / 14;                  // 14 Plätze pro Umdrehung – Kugeln liegen dichter, wirkt mehr wie eine Spirale
  const zoom = s.bar / 2.5;                       // Herauszoomen: pro Takt rückt alles um 2,5 Plätze nach innen – zieht die Kugeln auseinander
  const rot = s.t / (s.bar * 8) * Math.PI * 2;    // das Ganze dreht sich: eine Umdrehung in 8 Takten
  const pos = u => { const R = Rmax * Math.pow(Q, u), a = -Math.PI / 2 + u * turn + rot; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R, R]; };
  const A = { Undurchsichtig: 1, Halbtransparent: .4, Transparent: .2 }[P.alpha], col = fpColor(P, s.fg), sz = SIZEF[P.size] / SIZEF.Mittel;   // Original = „Mittel“
  const dot = (u, al, i) => { const [x, y, R] = pos(u), rr = R * .1 * sz; if (rr < .3) return; fpShape(c, P, x, y, rr, col, al, i); };
  const t = s.t, n = Math.floor(t / T);
  const landed = m => clamp(Math.floor((t - m * T) / step) + 1, 0, N);
  const departed = m => clamp(Math.floor((t - m * T + D) / step) + 1, 0, N);
  // Kugel b kommt im halben Takt b dazu: im halben Takt m wandert sie von Platz (m − b − 1) nach (m − b); dazu das Herauszoomen,
  // das die Kugeln auseinanderzieht. Ab Songbeginn baut sie sich auf: zuerst eine Kugel, jeden halben Takt eine mehr.
  for (let b = Math.max(0, n - 60); b <= n + 1; b++) {
    // die ersten Kugeln starten direkt am Bildrand (sofort sichtbar), spätere immer weiter außerhalb des Bildes
    const outside = Math.log(Math.hypot(cx, cy) * 1.15 / (Rmax / Q)) / Math.log(1 / Q);
    const drift = (t - b * T) / zoom - outside * Math.min(1, b / 6);   // wie weit sie seit ihrem Auftauchen nach innen gerückt ist
    if (drift < -1 - outside) continue;
    for (let m = Math.max(b, n - 1); m <= n + 1; m++) {
      const to = m - b;
      const o = (landed(m) - departed(m + 1)) / N;
      if (o > 0) dot(to + drift, Math.min(1, o) * Math.min(1, A / .4), b);
      for (let i = 0; i < N; i++) {               // Nachbilder entlang der Spirale
        const t0 = m * T + i * step - D;
        if (t < t0 || t >= t0 + D) continue;
        const p = (t - t0) / D;
        dot(to - 1 + p * p * (3 - 2 * p) + drift, A, b);
      }
    }
  }
  c.globalAlpha = 1;
}
function spiralOut(c, s, P) {         // Idee 17: Spirale nach außen – voll einstellbar (Standardwerte = Original)
  const N = 8, T = s.bar / 2, step = T / N;       // 8 Nachbilder pro halben Takt
  const D = T * SPEEDF[P.speed];                  // Flugzeit eines Nachbilds von Platz zu Platz (Moderat = 30 % eines halben Takts)
  const cx = s.w / 2, cy = s.h / 2, Rmax = Math.hypot(cx, cy) * .82;
  const Q = .93, turn = Math.PI * 2 / 14;         // dieselbe Spirale wie bei Idee 16
  const U0 = 31;                                  // „Platz 0“ liegt tief innen in der Spirale (klein, aber nach kurzer Zeit sichtbar)
  const zoom = s.bar / 2.5;                       // Hineinzoomen: pro Takt rückt alles um 2,5 Plätze nach außen
  const rot = s.t / (s.bar * 8) * Math.PI * 2;    // dreht sich: eine Umdrehung in 8 Takten
  const pos = u => { const R = Rmax * Math.pow(Q, u), a = -Math.PI / 2 + u * turn + rot; return [cx + Math.cos(a) * R, cy + Math.sin(a) * R, R]; };
  const A = { Undurchsichtig: 1, Halbtransparent: .4, Transparent: .2 }[P.alpha], col = fpColor(P, s.fg), sz = SIZEF[P.size] / SIZEF.Mittel;   // Original = „Mittel“
  const dot = (sf, al, i) => { const [x, y, R] = pos(U0 - sf), rr = R * .1 * sz; if (rr < .3 || R > Rmax * 2.2) return; fpShape(c, P, x, y, rr, col, al, i); };
  const t = s.t, n = Math.floor(t / T);
  const landed = m => clamp(Math.floor((t - m * T) / step) + 1, 0, N);
  const departed = m => clamp(Math.floor((t - m * T + D) / step) + 1, 0, N);
  // Kugel b taucht im halben Takt b in der Mitte auf: im halben Takt m wandert sie von Platz (m − b − 1) nach (m − b) – nach außen;
  // dazu das Hineinzoomen. Ab Songbeginn baut sie sich auf: zuerst eine Kugel in der Mitte, jeden halben Takt eine mehr.
  for (let b = Math.max(0, n - 60); b <= n + 1; b++) {
    const drift = (t - b * T) / zoom;
    if (drift < -1) continue;
    for (let m = Math.max(b, n - 1); m <= n + 1; m++) {
      const to = m - b;
      const o = (landed(m) - departed(m + 1)) / N;
      if (o > 0) dot(to + drift, Math.min(1, o) * Math.min(1, A / .4), b);
      for (let i = 0; i < N; i++) {               // Nachbilder entlang der Spirale nach außen
        const t0 = m * T + i * step - D;
        if (t < t0 || t >= t0 + D) continue;
        const p = (t - t0) / D;
        dot(to - 1 + p * p * (3 - 2 * p) + drift, A, b);
      }
    }
  }
  c.globalAlpha = 1;
}
// Konfiguration je Idee (Index in IDEAS.flute): Zeichenfunktion, Standardwerte, Reihenfolge der Auswahlfelder
const FPC = {
  0: { map: FLUTE_MAP, draw: fluteFall, def: { ...LOOK, count: 'Mehrere', layout: 'Linear', place: 'Mitte', dir: 'Runter', path: 'Gerade', speed: 'Moderat', accel: 'Zunehmend' },
    groups: [['Erscheinung', [...LOOK_KEYS, 'layout', 'dim', 'fill', 'stroke']], ['Verhalten', ['place', 'dir', 'path', 'speed', 'accel']]] },
  1: { map: MAP2, draw: circleContract, def: { ...LOOK, count: 'Mehrere', speed: 'Moderat', accel: 'Zunehmend' },
    groups: [['Erscheinung', [...LOOK_KEYS, 'dim', 'fill', 'stroke']], ['Verhalten', ['speed', 'accel']]] },
  3: { map: MAP3, draw: wanderCircle, def: { ...LOOK, count: 'Einzeln', dir: 'Im Uhrzeigersinn', speed: 'Moderat' }, opts: { dir: ['Im Uhrzeigersinn', 'Gegen den Uhrzeigersinn'] },
    groups: [['Erscheinung', [...LOOK_KEYS, 'dim', 'fill', 'stroke']], ['Verhalten', ['dir', 'speed']]] },
  15: { map: MAP14, draw: spiralIn, def: { ...LOOK, size: 'Mittel', speed: 'Moderat' },
    groups: [['Erscheinung', [...LOOK_KEYS.filter(k => k !== 'count'), 'dim', 'fill', 'stroke']], ['Verhalten', ['speed']]] },
  16: { map: MAP15, draw: spiralOut, def: { ...LOOK, size: 'Mittel', speed: 'Moderat' },
    groups: [['Erscheinung', [...LOOK_KEYS.filter(k => k !== 'count'), 'dim', 'fill', 'stroke']], ['Verhalten', ['speed']]] },
};
const FP_TITLES = ['Fallender Kreis mit Nachbildern', 'Kreis zieht sich zusammen', 'Kugel wandert im Kreis'];
for (const k in FPC) IDEAS.flute[k].info = { title: IDEAS.flute[k].title, map: FPC[k].map };
const fpOpts = (i, k) => (FPC[i].opts && FPC[i].opts[k]) || FP_OPTS[k];

// ---- Morphologischer Kasten für alle übrigen Ideen (M-Button) ----
// Kurzschreibweise: nur was vom Standard der Spur abweicht. Wert = 'Auswahl' oder ['Auswahl', 'Klangparameter' | null, 'Erklärung']
const KM_ROWS = [
  ['Kasten 1 · Visuelle Erscheinung', [['element', 'Grundelement'], ['char', 'Formcharakter'], ['size', 'Größe'], ['temp', 'Farbtemperatur'], ['light', 'Helligkeit'], ['hue', 'Farbton'], ['sat', 'Sättigung'], ['alpha', 'Transparenz'], ['count', 'Anzahl'], ['layout', 'Anordnung'], ['dim', 'Dimensionalität'], ['fill', 'Füllung'], ['stroke', 'Kontur'], ['surface', 'Oberflächenbeschaffenheit']]],
  ['Kasten 2 · Visuelles Verhalten', [['shapeFx', 'Formveränderung'], ['transform', 'Formtransformation'], ['colorFx', 'Farbveränderung'], ['place', 'Position im Raum'], ['dir', 'Bewegungsrichtung'], ['path', 'Bewegungsbahn'], ['speed', 'Geschwindigkeit'], ['accel', 'Beschleunigung'], ['rhythm', 'Rhythmus'], ['appear', 'Erscheinungsverhalten'], ['vanish', 'Verschwindeverhalten'], ['trail', 'Spur']]],
  ['Kasten 3 · Interaktion', [['interact', 'Interaktion zwischen Elementen']]],
];
const KM_BASE = { element: 'Kreis', char: 'Geometrisch', size: 'Klein', temp: 'Neutral', light: ['Hell', null, 'Im Dark Mode weiß auf schwarz, im Light Mode umgekehrt – die Rolle bleibt „Kontrastfarbe“.'], hue: ['Unbunt', null, 'Schwarz-weiß, kein Farbton.'], sat: 'Entsättigt',
  alpha: 'Undurchsichtig', count: 'Einzeln', layout: 'Gruppiert', dim: '2D', fill: 'Gefüllt', stroke: 'Keine', surface: 'Glatt',
  shapeFx: 'Keine', transform: 'Keine', colorFx: 'Keine', place: 'Mitte', dir: 'Keine', path: 'Keine', speed: 'Moderat', accel: 'Keine', rhythm: 'Regelmäßig', appear: 'Einblenden', vanish: 'Ausblenden', trail: 'Keine', interact: 'Keine' };
const KM_TRACK = {   // Standard je Spur – vor allem die Kopplung an den Klang
  flute: { alpha: ['Halbtransparent', null, 'Nachbilder mit 40 % Deckkraft; der Zielplatz wird mit jedem kräftiger.'], accel: 'Stufenweise', trail: ['Nachbild', null, '8 halbtransparente Nachbilder pro Bewegung.'],
    speed: ['Moderat', 'Rhythmus', 'An den Rhythmus angepasst: 8 Töne pro halbem Takt, ein Nachbild braucht etwa 30 % eines halben Takts.'],
    rhythm: ['Regelmäßig', 'Rhythmus', 'Gebaut nach den 8 Flöten-Tönen pro halbem Takt (16tel).'] },
  trumpet: { rhythm: ['Unregelmäßig', 'Rhythmus', 'Folgt dem Mosquito-Ablauf: 3 · Pause 3 · 2 + 2 · Pause 2 · 3 · Pause 1 Schläge.'], appear: ['Jump-in', 'Rhythmus', 'Mit jedem Mosquito-Ton springt es herein.'],
    shapeFx: ['Verkleinern', 'Lautstärke', 'Wird mit dem Ausklingen des Tons stetig kleiner, bis es weg ist.'], vanish: 'Schrumpfen', speed: 'Schnell', accel: 'Plötzlich' },
  frog: { rhythm: ['Unregelmäßig', 'Rhythmus', 'Folgt dem Frog-Ablauf mit unterschiedlich langen Abschnitten: 6 · 2 · 4 · 4 Schläge.'], shapeFx: ['Vergrößern', 'Rhythmus', 'Je länger ein Frog-Abschnitt dauert, desto mehr wächst es.'] },
  building: { rhythm: ['Repetitiv', 'Rhythmus', 'Jeder Takt gleich aufgebaut: Schlag 1, Schlag 2, dann Schlag 3 und 4 als Reaktion.'], appear: ['Einblenden', 'Rhythmus', 'Auf Schlag 1 und 2 kommt je ein Element dazu.'] },
  riser: { rhythm: ['Regelmäßig', 'Rhythmus', '2¾ Schläge hinein, 2¼ Schläge hinaus – startet mit dem Riser in Takt 24.2.'], dir: ['Zur Mitte', 'Tonhöhe', 'Der Riser steigt in der Tonhöhe – alles zieht sich zur Mitte zusammen wie beim Einatmen.'],
    accel: ['Zunehmend', 'Tonhöhe', 'Mit steigender Tonhöhe wird es schneller.'], layout: 'Radial', count: 'Viele', element: 'Linie' },
  jagd: { rhythm: ['Repetitiv', 'Rhythmus', '3 Schläge Bewegung, dann 1 Schlag Pause – wie die Hornstöße.'], vanish: ['Fade-out', 'Lautstärke', 'Verblasst mit dem Ausklingen des Horns.'] },
  drums: { rhythm: ['Pulsierend', 'Rhythmus', 'Reagiert auf jeden Schlag der Drums.'], shapeFx: ['Verzerren', 'Lautstärke', 'Auf jedem Schlag kurz stark ausgelenkt, dann wieder Ruhe.'], appear: 'Jump-in', accel: 'Plötzlich' },
  ring: { rhythm: ['Repetitiv', 'Rhythmus', 'Ringtone-Muster je Takt: zwei Elemente in der Mitte von Schlag 1, 2 und 3 (das zweite eine 16tel später), im 4. Schlag vier auf je einer 16tel.'],
    appear: ['Aufpoppen', 'Rhythmus', 'Jedes Element erscheint genau auf seinem Ringtone-Ton.'], count: 'Viele', size: 'Klein' },
};
const KM = {
  flute: {
    2: { count: 'Mehrere', layout: ['Radial', null, '8 Kugeln auf einem Kreis um die jeweilige Mitte.'], transform: ['Gruppierung', null, 'Die 8 Kugeln öffnen sich aus einer Kugel und sammeln sich in der nächsten.'], place: ['Mitte', null, 'Die Mitte wandert Takt für Takt auf einem Achteck ringsherum – oben beginnend.'], dir: ['Nach außen', null, '1. halber Takt nach außen, 2. halber Takt in die nächste Kugel im Uhrzeigersinn (rechts, rechts unten, unten …).'], path: ['Kreisförmig', null, 'Die Mitte läuft in 8 Takten einmal im Uhrzeigersinn herum, dann schließt sich der Kreis.'], accel: ['Zunehmend', null, 'Hinein werden die Kugeln schneller, hinaus bremsen sie ab.'], appear: 'Zusammenfügen', vanish: 'Auflösen', trail: 'Keine', alpha: ['Halbtransparent', null, 'Kugeln auf dem Kreis 45 % Deckkraft; die Mitte füllt sich bis 100 %.'] },
    4: { count: ['Wenige', null, '4 Kugeln auf jedem zweiten Platz.'], layout: ['Radial', null, '8 Plätze auf einem Kreis um die Mitte.'], dir: 'Rechts', path: ['Kreisförmig', null, 'Alle gleichzeitig einen Platz weiter im Uhrzeigersinn.'] },
    5: { count: ['Viele', null, '16 kleine Kugeln im Kreis, dazu der Kreis in der Mitte.'], layout: 'Radial', shapeFx: ['Vergrößern', null, 'Die Nachbilder werden auf dem Weg größer; der Kreis in der Mitte wächst mit jeder Kugel.'], transform: ['Gruppierung', null, 'Die Kugeln gehen im Kreis in der Mitte auf.'], dir: 'Zur Mitte', path: 'Gerade', rhythm: ['Regelmäßig', 'Rhythmus', 'Pro halbem Takt eine Kugel (zufällige Reihenfolge), nach 8 Takten von vorn.'], vanish: 'Zusammenfügen' },
    6: { count: 'Mehrere', layout: ['Linear', null, '8 Spalten nebeneinander wie Tasten.'], place: 'Oben', dir: ['Runter', 'Tonhöhe', 'Absteigende Tonleiter: jede Kugel fällt eine Stufe tiefer als die davor.'], path: 'Gerade', vanish: 'Ausblenden' },
    7: { element: 'Punkt', count: 'Mehrere', layout: 'Zufällig', colorFx: ['Dunkler', null, 'Die Punkte leuchten auf und dunkeln langsam ab.'], place: 'Mitte', speed: 'Langsam', accel: 'Keine', appear: 'Aufpoppen', vanish: 'Fade-out', trail: ['Nachleuchten', null, 'Eine Stelle leuchtet nach und wird nicht erneut gewählt.'] },
    8: { element: 'Linie', count: 'Mehrere', layout: 'Zufällig', alpha: 'Undurchsichtig', dir: 'Runter', path: 'Gerade', appear: ['Wachsen', null, '1. halber Takt: 8 Linien ziehen sich nacheinander von oben nach unten auf.'], vanish: ['Auflösen', null, '2. halber Takt: in derselben Reihenfolge verschwinden sie wieder.'], trail: 'Keine' },
    9: { count: ['Viele', null, '72 hellgraue Kugeln.'], light: 'Mittel', layout: 'Zufällig', colorFx: ['Dunkler', null, 'Die Ziel-Kugel wird mit jeder ankommenden dunkler; am Ende zieht sich das Feld schwarz auf.'], transform: 'Gruppierung', dir: 'Zur Mitte', path: 'Gerade', vanish: 'Zusammenfügen' },
    10: { count: ['Wenige', null, '4 Kugeln auf jedem zweiten von 8 Plätzen.'], layout: ['Linear', null, 'Auf einer Wellenlinie über die Bildbreite.'], dir: 'Rechts', path: ['Wellig', null, 'Pro halben Takt einen Platz weiter auf der Welle – rechts raus, links wieder rein.'] },
    11: { count: ['Viele', null, 'Jeden Takt kommt links eine Kugel dazu, auf jedem zweiten Platz.'], layout: ['Linear', null, 'Auf einer endlosen Wellenlinie.'], place: ['Mitte', null, 'Das Bild läuft mit der ersten Kugel mit und wandert stetig nach links.'], dir: ['Rechts', null, 'Die Kugeln laufen nach rechts, das Bild läuft halb so schnell mit – die Welle zieht nach links, die Kugeln wandern trotzdem weiter nach rechts.'], path: ['Wellig', null, 'Immer von unten nach oben, von oben nach unten.'], appear: ['Einblenden', null, 'Die Kugeln starten links und kommen von dort herein.'] },
    12: { element: 'Linie', char: 'Abgerundet', count: 'Einzeln', layout: 'Linear', dir: ['Rechts', null, 'Abwechselnd von links nach rechts und von rechts nach links.'], path: ['Wellig', null, '8 Ausschläge pro Zeile, 4 hoch, 4 runter; am Rand führt ein Halbkreis in die nächste Zeile.'], appear: 'Wachsen', vanish: ['Fade-out', null, 'Ältere Zeilen verblassen.'], trail: ['Nachzeichnen', null, 'Eine Kugel zeichnet die Wellenlinie.'] },
    13: { size: 'Groß', fill: 'Ungefüllt', stroke: 'Dünn', count: 'Mehrere', layout: ['Radial', null, '8 große Kreise im Kreis, in der Mitte ein Fluchtpunkt.'], shapeFx: ['Verkleinern', null, 'Das Abbild wird auf dem Weg zur Mitte immer kleiner.'], dir: 'Zur Mitte', path: 'Gerade', vanish: 'Schrumpfen' },
    14: { element: 'Punkt', count: 'Viele', layout: 'Radial', dim: '2.5D', shapeFx: ['Dehnen', null, 'Zum Rand hin ziehen die Sterne immer längere Streifen.'], place: 'Vordergrund', dir: ['Nach vorne', null, 'Flug durch den Raum: die Sterne kommen aus der Mitte auf einen zu.'], path: 'Gerade', speed: 'Schnell', accel: 'Zunehmend', appear: 'Zoom-in', vanish: 'Zoom-out', trail: 'Linie' },
  },
  trumpet: {
    0: { element: 'Polygon', char: 'Spitz', size: 'Groß', path: 'Keine', shapeFx: ['Verkleinern', 'Lautstärke', 'Springt groß herein, schießt kurz über und zieht sich bis zum Tonende zusammen – stetig kleiner, bis er weg ist.'] },
    1: { element: 'Rechteck', size: 'Groß', place: 'Unten', dir: ['Hoch', 'Lautstärke', 'Wie ein Pegel: schießt mit dem Ton hoch und sinkt mit dem Ausklingen.'], path: 'Gerade', shapeFx: ['Dehnen', 'Lautstärke', 'Der Balken wird mit dem Ton lang und sinkt danach.'] },
    2: { element: 'Linie', char: 'Abgerundet', stroke: 'Dick', dir: 'Rechts', path: ['Zickzack', null, 'Links starke Ausschläge und dicke Kontur, nach rechts kleiner und dünner.'], speed: ['Moderat', 'Rhythmus', 'Der Punkt erreicht das rechte Ende genau mit dem Tonende.'], trail: ['Nachzeichnen', null, 'Der Punkt zeichnet die Welle selbst; dahinter bleibt die Spur stehen.'], vanish: 'Ausblenden', interact: ['Verschmelzen', null, 'Punkt und Linie hängen wie ein Tropfen zusammen (Metaballs).'] },
    3: { element: 'Fläche', char: 'Organisch', size: 'Riesig', place: 'Unten', dir: ['Hoch', 'Lautstärke', 'Mit jedem Ton wölbt sich eine breite Kuppel nach oben und sinkt mit dem Ausklingen.'], path: 'Wellig', shapeFx: ['Dehnen', 'Lautstärke', 'Wird stetig kleiner, bis nur die flache Welle bleibt.'], vanish: 'Schrumpfen' },
  },
  frog: {
    0: { fill: 'Ungefüllt', stroke: ['Dick', null, 'Innen dicke Kontur, nach außen dünner und blasser.'], count: 'Viele', layout: 'Radial', alpha: 'Halbtransparent', dir: 'Nach außen', path: 'Gerade', speed: 'Langsam', appear: ['Wachsen', 'Rhythmus', 'Alle halbe Schläge kommt aus der Mitte ein neuer Kreis.'], vanish: ['Fade-out', 'Rhythmus', 'Beim Wechsel im Frog-Ablauf verschwinden weich die äußeren Kreise.'], trail: 'Nachbild' },
    1: { fill: 'Ungefüllt', stroke: 'Dick', size: 'Mittel', char: 'Unregelmäßig', count: 'Mehrere', layout: 'Radial', shapeFx: ['Verzerren', 'Rhythmus', 'Der Rand zittert wie eine Frequenz; je länger der Abschnitt, desto stärker reißt die Verzerrung aus. Auf jedem Schlag zuckt er.'], trail: ['Nachbild', null, 'Nach innen immer kleinere, dünnere, blassere Abbilder, leicht verzögert.'] },
    2: { element: 'Linie', char: 'Organisch', dir: 'Nach außen', path: 'Spiralförmig', shapeFx: ['Dehnen', 'Rhythmus', 'Der Streifen wird immer länger und dicker wie ein Trichter; beim Wechsel zieht er sich in die Mitte zurück.'], appear: 'Wachsen', vanish: 'Schrumpfen' },
    3: { size: 'Mittel', surface: ['Strukturiert', null, 'Nur aus waagrechten Streifen in wechselnder Dicke, wie ein gestörtes Bildsignal.'], shapeFx: ['Verpixeln', 'Rhythmus', 'Je länger der Abschnitt, desto mehr zerfällt sie – auf jeder 16tel flackernd.'], transform: 'Teilung', colorFx: ['Heller', null, 'Einzelne Streifen blitzen hell auf.'], vanish: 'Zerfallen' },
  },
  building: {
    0: { count: ['Viele', null, '4 → 6 → 8 → … → 14 Kugeln.'], layout: 'Gruppiert', transform: ['Teilung', 'Rhythmus', 'Auf Schlag 3 verschmelzen die Kugeln und teilen sich – jedes Mal in 2 mehr.'], shapeFx: ['Verzerren', null, 'Beim Auseinandergehen wackeln die Kugeln leicht.'], dir: ['Runter', null, 'Beim 4. Mal nach unten, beim 5. Mal nach oben, beim 6. Mal fliegen alle aus dem Bild.'], vanish: 'Zusammenfügen', interact: ['Verschmelzen', null, 'Kugeln fließen zusammen und teilen sich wieder.'] },
    1: { element: 'Linie', count: 'Wenige', layout: 'Linear', dir: ['Zur Mitte', null, 'Schlag 1 von links, Schlag 2 von rechts.'], path: 'Wellig', shapeFx: ['Verzerren', 'Rhythmus', 'Ab Schlag 3 eine Linie, die dicker wird und 2 Schläge lang immer welliger schwingt.'], transform: 'Gruppierung', vanish: 'Ausblenden', interact: ['Verbinden', null, 'Die beiden Striche schnappen zu einer Linie zusammen.'] },
    2: { element: 'Fläche', char: 'Organisch', size: 'Riesig', place: 'Unten', count: 'Wenige', dir: ['Hoch', 'Rhythmus', 'Mit jeder Kugel steigt der Wasserspiegel; beim 4. Mal sinkt er ein Stück.'], path: 'Wellig', shapeFx: ['Verzerren', null, 'In Schlag 3 und 4 vibriert das Wasser.'], appear: 'Einblenden', vanish: ['Ausblenden', null, 'Nach 6 Takten läuft das Wasser ab.'], interact: ['Aufprall', null, 'Die Kugeln fallen ins Wasser und lösen Wellen aus.'] },
    3: { element: 'Linie', size: 'Groß', fill: 'Ungefüllt', stroke: 'Dünn', count: 'Wenige', surface: 'Strukturiert', dir: ['Zur Mitte', null, 'Schlag 1 von links, Schlag 2 leicht verdreht von rechts.'], shapeFx: ['Drehen', 'Rhythmus', 'In Schlag 3 und 4 zittert der obere Kreis in seiner Drehung – die Muster flimmern.'], interact: ['Überlagern', null, 'Wo sich die Kreise überlagern, entstehen Moiré-Muster.'] },
    4: { element: 'Punkt', size: 'Winzig', count: 'Viele', layout: ['Zufällig', null, 'Die Körner rieseln zufällig herein und ordnen sich zu einer Klangfigur.'], surface: 'Körnig', transform: ['Gruppierung', 'Rhythmus', 'In Schlag 3 und 4 vibriert die Platte – die Körner wandern zu den ruhigen Linien.'], dir: 'Runter', path: 'Zufällig', interact: ['Ordnen', null, 'Zusammen bilden die Körner eine Chladni-Figur.'] },
    5: { element: 'Punkt', count: 'Viele', layout: 'Rasterförmig', shapeFx: ['Vergrößern', 'Rhythmus', 'Wellenringe laufen durchs Raster; in Schlag 3 und 4 schwingen beide Quellen schneller und kräftiger.'], path: 'Kreisförmig', dir: 'Nach außen', appear: 'Einblenden', interact: ['Überlagern', null, 'Wo sich die Wellen treffen, entsteht ein Interferenzmuster.'] },
  },
  riser: {
    0: { stroke: 'Dünn', shapeFx: ['Dehnen', null, 'Die Striche ziehen sich lang bis in die Mitte, dann wandert das äußere Ende hinterher.'], transform: ['Gruppierung', null, 'Alle bilden in der Mitte einen kleinen Punkt.'], path: 'Gerade', appear: 'Wachsen', vanish: ['Fade-out', null, 'Danach ziehen sie sich nach außen und verblassen von der Mitte aus.'] },
    1: { stroke: 'Dünn', shapeFx: ['Drehen', 'Tonhöhe', 'Das Gebilde dreht sich mit dem steigenden Riser immer schneller; die Striche biegen sich.'], transform: ['Gruppierung', null, 'In der Mitte wickeln sie sich auf einen Kreis.'], path: 'Spiralförmig', appear: 'Wachsen', vanish: 'Fade-out' },
  },
  jagd: {
    0: { element: 'Linie', count: 'Mehrere', layout: 'Linear', place: 'Unten', dir: ['Hoch', null, 'Von unten nach oben: der unterste am längsten, nach oben kürzer und enger.'], path: 'Gerade', speed: 'Schnell', appear: 'Aufpoppen' },
    1: { size: 'Riesig', fill: 'Ungefüllt', stroke: 'Dünn', shapeFx: ['Verkleinern', null, 'Zieht sich in 3 Schlägen von außerhalb des Bildes zu einem Punkt in der Mitte zusammen.'], dir: 'Zur Mitte', vanish: 'Schrumpfen', trail: ['Nachbild', null, 'Zieht eine Spur weiterer Kreise hinter sich her.'] },
  },
  drums: {
    0: { element: 'Linie', count: 'Wenige', layout: ['Linear', null, 'Vier Linien am Bildrand, die sich an den Ecken nicht berühren.'], place: 'Vordergrund', appear: 'Einblenden', vanish: 'Ausblenden' },
    1: { element: 'Fläche', char: 'Organisch', size: 'Mittel', shapeFx: ['Verzerren', 'Lautstärke', 'Auf jedem Schlag wirft die Form Wellen wie Gelee und schwingt nach.'], speed: 'Langsam' },
    2: { element: 'Punkt', count: 'Viele', layout: 'Rasterförmig', shapeFx: ['Vergrößern', 'Lautstärke', 'Die Druckwelle macht die Punkte kurz größer und schiebt sie nach außen.'], colorFx: ['Heller', null, 'Die Punkte werden kurz heller.'], dir: 'Nach außen', path: 'Kreisförmig' },
  },
  ring: {
    0: { layout: 'Gruppiert', dir: ['Zur Mitte', null, 'Je zwei Kugeln kommen von außen herein.'], vanish: ['Jump-out', 'Rhythmus', 'Im 4. Schlag fliegen sie in vier Gruppen raus (2 · 1 · 2 · 1).'] },
    1: { layout: 'Rasterförmig', place: 'Oben', dir: 'Runter', vanish: ['Jump-out', null, 'Mit dem nächsten Takt ist wieder alles leer.'] },
    2: { layout: ['Gruppiert', null, 'Am Ende steht ein symmetrisches Dreieck (1 · 2 · 3 · 4).'], vanish: 'Jump-out' },
    3: { layout: 'Rasterförmig', dir: ['Rechts', null, 'Das Bild wandert über die 8 Takte von links nach rechts.'], vanish: ['Jump-out', 'Rhythmus', 'Im 4. Schlag verlassen die vier ältesten Kugeln das Bild.'] },
    4: { element: 'Linie', count: 'Viele', layout: 'Linear', shapeFx: 'Dehnen', dir: 'Rechts', appear: ['Wachsen', 'Rhythmus', 'Eine Linie nach der anderen wächst aus der Mitte nach oben und unten.'], vanish: 'Jump-out' },
    5: { element: 'Punkt', layout: ['Radial', null, '8 Dreiecke aus je 10 Punkten als Kranz, Spitze nach außen.'], path: 'Kreisförmig', dir: ['Rechts', null, 'Im Uhrzeigersinn, oben beginnend – ein Dreieck pro Takt.'], vanish: 'Ausblenden' },
    6: { element: 'Punkt', layout: ['Radial', null, 'Großer Kreis aus 60 Punkten, füllt sich in 10 Takten.'], shapeFx: ['Verkleinern', null, 'Die großen Punkte werden auf dem Weg zur Mitte immer kleiner.'], dir: 'Zur Mitte', vanish: ['Schrumpfen', 'Rhythmus', 'Im 4. Schlag fallen vier Punkte wie in ein Loch.'] },
    7: { element: 'Punkt', layout: 'Radial', path: 'Spiralförmig', dir: 'Zur Mitte', shapeFx: ['Verkleinern', null, 'Die Punkte werden nach innen kleiner.'], vanish: ['Ausblenden', 'Rhythmus', 'Im 4. Schlag rutschen die vier ältesten nach außen aus dem Bild.'] },
    8: { element: 'Punkt', layout: 'Radial', path: 'Spiralförmig', dir: 'Nach außen', shapeFx: ['Vergrößern', null, 'Die Punkte werden nach außen größer.'], vanish: ['Schrumpfen', 'Rhythmus', 'Im 4. Schlag rutschen die vier ältesten zurück in die Mitte.'] },
    9: { element: 'Punkt', layout: ['Rasterförmig', null, 'Raster aus 8 × 6 Feldern, Bahn für Bahn hin und her.'], path: 'Zickzack', dir: 'Rechts', vanish: ['Schrumpfen', 'Rhythmus', 'Im 4. Schlag schrumpfen die vier hintersten Punkte weg.'] },
    10: { element: 'Punkt', layout: ['Radial', null, 'Kreis aus 80 Plätzen.'], path: 'Kreisförmig', dir: ['Rechts', 'Rhythmus', 'Abwechselnd im und gegen den Uhrzeigersinn, jeden Takt im Wechsel.'], vanish: 'Ausblenden' },
  },
};
for (const k in KM) for (const i in KM[k]) {
  const idea = IDEAS[k] && IDEAS[k][i]; if (!idea || idea.info) continue;
  const spec = { ...KM_BASE, ...(KM_TRACK[k] || {}), ...KM[k][i] };
  idea.info = { title: idea.title, map: KM_ROWS.map(([g, rows]) => ({ g, rows: rows.map(([key, n]) => { const v = spec[key], [vv, t, h] = Array.isArray(v) ? v : [v]; return { n, v: vv, ...(t ? { t } : {}), ...(h ? { h } : {}) }; }) })) };
}
