'use strict';
/* ═════════════════════════════════════════════════════════════════════════
   Animations-Editor – Rechenkern (ohne Oberfläche)
   ─────────────────────────────────────────────────────────────────────────
   Nimmt eine beliebige Animation aus ideen.js (draw(c, s)) und zeichnet sie mit Einstellungen wie in After Effects:
     • Gesamt-Regler: Zeit & Kurve, Transformieren, Farbe, Unschärfe, Leuchten, Echo, Bewegungsunschärfe, Verzerren …
     • Objekt-Regler: Die Animation wird in eine „Aufnahme“ (Rec) gezeichnet; jede Zeichenstelle im Code (Kugeln, Linien, Flächen …)
       wird zu einem eigenen Objekt mit Deckkraft, Farbe, Größe, Unschärfe, Leuchten, Zeit usw.
     • Jeder Zahlenregler kann „animiert“ werden (Stoppuhr): Wert A → Wert B pro Schlag/Takt, mit frei wählbarer Kurve.
   Die Animationen selbst bleiben unverändert.
   ═════════════════════════════════════════════════════════════════════════ */
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FILTER = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const clear = c => { const x = c.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.shadowColor = 'transparent'; x.shadowBlur = 0; x.filter = 'none'; x.clearRect(0, 0, c.width, c.height); return x; };
  const hexA = (hex, a) => { const v = parseInt(String(hex).replace('#', '').slice(0, 6), 16) || 0; return `rgba(${v >> 16 & 255},${v >> 8 & 255},${v & 255},${a})`; };

  /* ───────────── Kurven (Easing) ───────────── */
  const BEZ = {
    linear: [0, 0, 1, 1], easeIn: [.42, 0, 1, 1], easeOut: [0, 0, .58, 1], easeInOut: [.42, 0, .58, 1],
    cubicIn: [.55, .055, .675, .19], cubicOut: [.215, .61, .355, 1], cubicInOut: [.645, .045, .355, 1],
    expoIn: [.95, .05, .795, .035], expoOut: [.19, 1, .22, 1],
    backIn: [.6, -.28, .735, .045], backOut: [.175, .885, .32, 1.275], backInOut: [.68, -.55, .265, 1.55],
  };
  const CURVES = [['linear', 'Linear'], ['easeIn', 'Sanft starten'], ['easeOut', 'Sanft stoppen'], ['easeInOut', 'Sanft starten & stoppen'],
    ['cubicIn', 'Stark beschleunigen'], ['cubicOut', 'Stark abbremsen'], ['cubicInOut', 'Stark beschleunigen & abbremsen'],
    ['expoIn', 'Explosiv starten'], ['expoOut', 'Explosiv stoppen'],
    ['backIn', 'Ausholen (Back In)'], ['backOut', 'Überschwingen (Back Out)'], ['backInOut', 'Ausholen & Überschwingen'],
    ['elastic', 'Elastisch'], ['bounce', 'Springen (Bounce)'], ['steps4', 'Stufen (4)'], ['steps8', 'Stufen (8)'], ['hold', 'Halten, dann Sprung'],
    ['custom', 'Eigene Kurve (Bézier)'], ['points', 'Eigene Punkte']];
  const lin = x => x;
  function bez(x1, y1, x2, y2) {
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 28; i++) {                       // t zu x suchen (Halbierung – immer stabil)
        const u = 1 - t, cx = 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t;
        if (cx < x) lo = t; else hi = t; t = (lo + hi) / 2;
      }
      const u = 1 - t; return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t;
    };
  }
  const bounceOut = x => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375; return n * (x -= 2.625 / d) * x + .984375; };
  const SPECIAL = {
    elastic: x => x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * (TAU / 3)) + 1,
    bounce: bounceOut,
    steps4: x => Math.min(1, Math.floor(x * 4) / 3), steps8: x => Math.min(1, Math.floor(x * 8) / 7),
    hold: x => x >= 1 ? 1 : 0,
  };
  // Eigene Punkte: glatte Kurve durch (0,0), die gesetzten Punkte und (1,1) (kubisch, Tangenten aus den Nachbarpunkten)
  function spline(pts) {
    const P = [[0, 0], ...pts.map(p => [clamp(p[0], .001, .999), p[1]]).sort((a, b) => a[0] - b[0]), [1, 1]], n = P.length, m = [];
    for (let i = 0; i < n; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; m[i] = (b[0] - a[0]) > 1e-9 ? (b[1] - a[1]) / (b[0] - a[0]) : 0; }
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let i = 0; while (i < n - 2 && x > P[i + 1][0]) i++;
      const x0 = P[i][0], x1 = P[i + 1][0], h = x1 - x0, t = (x - x0) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * P[i][1] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * P[i + 1][1] + (t3 - t2) * h * m[i + 1];
    };
  }
  const cvCache = new Map();
  function curveFn(cv) {
    if (!cv || !cv.p || cv.p === 'linear') return lin;
    const key = cv.p === 'custom' ? 'c' + (cv.b || []).join(',') : cv.p === 'points' ? 'p' + JSON.stringify(cv.pts || []) : cv.p;
    let f = cvCache.get(key); if (f) return f;
    f = BEZ[cv.p] ? bez(...BEZ[cv.p]) : cv.p === 'custom' ? bez(...(cv.b || [.25, .1, .25, 1])) : cv.p === 'points' ? spline(cv.pts || []) : (SPECIAL[cv.p] || lin);
    if (cvCache.size > 300) cvCache.clear();
    cvCache.set(key, f); return f;
  }
  const curveBez = cv => cv && cv.p === 'custom' ? (cv.b || [.25, .1, .25, 1]) : (BEZ[cv && cv.p] || null);

  /* ───────────── Zeit ───────────── */
  const PER = { '16th': () => BEAT / 4, '8th': () => BEAT / 2, beat: () => BEAT, '2beat': () => 2 * BEAT, half: () => BAR / 2, bar: () => BAR, '2bar': () => 2 * BAR, '4bar': () => 4 * BAR, '8bar': () => 8 * BAR };
  const PER_OPTS = [['16th', '¼ Schlag (16tel)'], ['8th', '½ Schlag (8tel)'], ['beat', '1 Schlag'], ['2beat', '2 Schläge'], ['half', '½ Takt'], ['bar', '1 Takt'], ['2bar', '2 Takte'], ['4bar', '4 Takte'], ['8bar', '8 Takte']];
  const TIME_PER_OPTS = [...PER_OPTS, ['custom', 'Eigene Länge …']];
  // Zeit umrechnen: Tempo, Versatz (in Schlägen) und eine Kurve, die innerhalb jeder Periode die Zeit „verbiegt“.
  // len = eigene Periodenlänge in Schlägen (wenn per = 'custom'), ph = Start der Perioden gegenüber dem Taktraster in Schlägen
  function warp(t, speed, offset, curve, per, amt, len, ph) {
    let tt = t * speed + offset * BEAT;
    if (amt > 0 && curve && curve.p && curve.p !== 'linear') {
      const P = per === 'custom' ? Math.max(.01, (len || 1)) * BEAT : (PER[per] ? PER[per]() : BAR), f0 = (ph || 0) * BEAT;
      const u = (tt - f0) / P, k = Math.floor(u), x = u - k, y = curveFn(curve)(x);
      tt = (k + x + (y - x) * amt) * P + f0;
    }
    return tt;
  }

  /* ───────────── Regler-Definitionen ───────────── */
  const N = (id, l, min, max, step, def, u, tip) => ({ id, l, t: 'n', min, max, step, def, u: u || '', tip });
  const B = (id, l, def, tip) => ({ id, l, t: 'b', def: !!def, tip });
  const SEL = (id, l, opts, def, tip) => ({ id, l, t: 's', opts, def, tip });
  const COL = (id, l, def, tip) => ({ id, l, t: 'c', def, tip });
  const KRV = (id, l, tip) => ({ id, l, t: 'k', def: { p: 'linear' }, tip });
  // Eine Gruppe besteht aus Abschnitten (Zwischenüberschrift + Regler) – so ordnet die Oberfläche sie an
  const GRP = (id, title, secs) => ({ id, title, secs, props: secs.flatMap(s => s[1]) });
  const TIME_SECS = [
    ['Ablauf', [
      N('speed', 'Tempo', .1, 4, .01, 1, '×', 'Wie schnell die Animation läuft (1 = im Songtempo).'),
      N('offset', 'Versatz', -8, 8, .05, 0, ' Schl.', 'Verschiebt die Animation gegenüber dem Song, in Schlägen (¼-Takten).'),
    ]],
    ['Zeit-Kurve', [
      KRV('tcurve', 'Kurve', 'Verbiegt den Zeitverlauf innerhalb jeder Periode – die Bewegung beschleunigt, bremst, federt … Steigt die Kurve anfangs flach und später steil, läuft es erst langsam und dann schnell.'),
      SEL('tper', 'Wiederholt alle', TIME_PER_OPTS, 'bar', 'Länge der Periode, auf die die Zeit-Kurve angewendet wird. Am Anfang jeder Periode bleibt alles im Takt.'),
      N('tlen', 'Eigene Länge', .25, 32, .05, 2, ' Schl.', 'Länge einer Periode in Schlägen (¼-Takten).'),
      N('tph', 'Verschieben', -8, 8, .05, 0, ' Schl.', 'Verschiebt, wo jede Periode beginnt – so lässt sich die Kurve auf den Einsatz eines Elements legen.'),
      N('tamt', 'Stärke', 0, 100, 1, 100, '%', '0 % = Kurve aus, 100 % = volle Kurve.'),
    ]],
  ];
  const GLOBAL_GROUPS = [
    GRP('tf', 'Größe & Position', [
      ['Größe', [N('scale', 'Gesamt', 5, 400, 1, 100, '%'), N('sx', 'Breite', 10, 300, 1, 100, '%'), N('sy', 'Höhe', 10, 300, 1, 100, '%')]],
      ['Position', [N('px', 'X', -100, 100, .5, 0, '%'), N('py', 'Y', -100, 100, .5, 0, '%')]],
      ['Drehen & Spiegeln', [N('rot', 'Drehung', -720, 720, 1, 0, '°'), B('fx', 'Horizontal spiegeln'), B('fy', 'Vertikal spiegeln')]],
      ['Ebene', [
        N('op', 'Deckkraft', 0, 100, 1, 100, '%'),
        SEL('blend', 'Mischmodus', [['source-over', 'Normal'], ['screen', 'Aufhellen (Screen)'], ['lighter', 'Addieren'], ['multiply', 'Multiplizieren'], ['overlay', 'Überlagern'], ['difference', 'Differenz']], 'source-over', 'Wie das Bild mit dem Hintergrund verrechnet wird.'),
      ]],
    ]),
    GRP('col', 'Farbe', [
      ['Zeichnung', [
        SEL('fgm', 'Zeichenfarbe', [['orig', 'Original (Hell/Dunkel)'], ['track', 'Spurfarbe'], ['custom', 'Eigene Farbe']], 'orig', 'Farbe, in der die Animation zeichnet.'),
        COL('fgc', 'Eigene Farbe', '#ff8a2a'),
      ]],
      ['Hintergrund', [B('bgo', 'Färben'), COL('bgc', 'Farbe', '#000000')]],
      ['Korrektur', [
        N('hue', 'Farbton', -180, 180, 1, 0, '°'), N('sat', 'Sättigung', 0, 300, 1, 100, '%'), N('bri', 'Helligkeit', 0, 300, 1, 100, '%'),
        N('con', 'Kontrast', 0, 300, 1, 100, '%'), N('inv', 'Invertieren', 0, 100, 1, 0, '%'),
      ]],
      ['Verlauf', [
        B('gro', 'Einschalten', 0, 'Legt einen Farbverlauf über alles, was gezeichnet wird (zwei gleiche Farben = einfache Tönung).'),
        COL('gra', 'Farbe 1', '#ff3fa6'), COL('grb', 'Farbe 2', '#46d9ee'),
        N('gran', 'Winkel', 0, 360, 1, 90, '°'), N('gram', 'Stärke', 0, 100, 1, 100, '%'), N('gras', 'Verschieben', -100, 100, 1, 0, '%'),
      ]],
    ]),
    GRP('time', 'Zeit & Kurve', TIME_SECS),
    GRP('mo', 'Echo & Bewegungsunschärfe', [
      ['Echo', [
        N('ecn', 'Anzahl', 0, 16, 1, 0, '', 'Zeichnet frühere Zustände der Animation als verblassende Nachbilder dazu.'), N('ecd', 'Abstand', .02, 2, .01, .25, ' Schl.'),
        N('ecf', 'Deckkraft', 10, 100, 1, 70, '%', 'Wie viel Deckkraft von Echo zu Echo bleibt.'),
      ]],
      ['Bewegungsunschärfe', [N('mbs', 'Dauer', 0, 2, .01, 0, ' Schl.', 'Wie lange der „Verschluss“ offen ist: mehrere Zeitpunkte werden übereinandergelegt.'), N('mbn', 'Qualität', 2, 16, 1, 6, ' Bilder')]],
    ]),
    GRP('fx', 'Unschärfe & Leuchten', [
      ['Unschärfe', [N('blur', 'Stärke', 0, 60, .5, 0, ' px')]],
      ['Leuchten', [N('glow', 'Stärke', 0, 100, 1, 0, '%', 'Weicher Schein um alles Gezeichnete.'), N('glr', 'Radius', 1, 80, 1, 16, ' px')]],
      ['Schlagschatten', [
        N('dsa', 'Stärke', 0, 100, 1, 0, '%'), COL('dsc', 'Farbe', '#000000'),
        N('dsx', 'Versatz X', -60, 60, 1, 6, ' px'), N('dsy', 'Versatz Y', -60, 60, 1, 6, ' px'), N('dsb', 'Unschärfe', 0, 60, 1, 8, ' px'),
      ]],
    ]),
    GRP('dist', 'Verzerren & Look', [
      ['Kaleidoskop', [N('kal', 'Segmente', 1, 16, 1, 1, '×', 'Spiegelt und wiederholt das Bild kreisförmig. Gerade Zahlen passen nahtlos.'), N('kar', 'Drehung', 0, 360, 1, 0, '°')]],
      ['Welle', [N('wva', 'Stärke', 0, 80, .5, 0, ' px'), N('wvl', 'Länge', 10, 400, 1, 120, ' px'), N('wvs', 'Tempo', -4, 4, .05, 1, ' /Schl.')]],
      ['Pixel', [N('mos', 'Mosaik', 0, 60, 1, 0, ' px'), N('rgb', 'RGB-Versatz', 0, 40, .5, 0, ' px', 'Trennt die Farbkanäle (Chromatische Aberration). Das Bild wird dabei auf den Hintergrund gesetzt.')]],
      ['Film', [N('vig', 'Vignette', 0, 100, 1, 0, '%'), N('grn', 'Körnung', 0, 100, 1, 0, '%'), N('scan', 'Scanlines', 0, 100, 1, 0, '%'), N('scs', 'Zeilenabstand', 2, 16, 1, 4, ' px')]],
    ]),
  ];
  const OBJ_GROUPS = [
    GRP('tf', 'Größe & Position', [
      ['Größe', [
        N('esz', 'Je Element', 0, 400, 1, 100, '%', 'Jedes Element (z. B. jede Kugel) wird um seinen eigenen Mittelpunkt größer/kleiner.'),
        N('gsc', 'Ganze Gruppe', 0, 400, 1, 100, '%', 'Skaliert das ganze Objekt um die Bildmitte (Abstände ändern sich mit).'),
      ]],
      ['Position', [N('ox', 'X', -100, 100, .5, 0, '%'), N('oy', 'Y', -100, 100, .5, 0, '%'), N('rot', 'Drehung', -720, 720, 1, 0, '°', 'Dreht das ganze Objekt um die Bildmitte.')]],
    ]),
    GRP('look', 'Aussehen', [
      ['Deckkraft & Linie', [B('vis', 'Sichtbar', 1), N('op', 'Deckkraft', 0, 100, 1, 100, '%'), N('lw', 'Strichstärke', 0, 500, 1, 100, '%')]],
      ['Farbe', [
        SEL('om', 'Farbe', [['orig', 'Original'], ['custom', 'Eigene Farbe']], 'orig'), COL('oc', 'Eigene Farbe', '#ff8a2a'),
        N('hue', 'Farbton', -180, 180, 1, 0, '°'), N('sat', 'Sättigung', 0, 300, 1, 100, '%'), N('bri', 'Helligkeit', 0, 300, 1, 100, '%'),
      ]],
      ['Unschärfe & Leuchten', [N('blur', 'Unschärfe', 0, 60, .5, 0, ' px'), N('glow', 'Leuchten', 0, 100, 1, 0, '%'), N('glr', 'Radius', 1, 60, 1, 12, ' px')]],
    ]),
    GRP('time', 'Zeit & Kurve', TIME_SECS),
  ];
  const flat = gs => { const m = {}; for (const g of gs) for (const p of g.props) m[p.id] = p; return m; };
  const GP = flat(GLOBAL_GROUPS), OP = flat(OBJ_GROUPS);
  const DEFS = { g: Object.fromEntries(Object.values(GP).map(p => [p.id, p.def])), o: Object.fromEntries(Object.values(OP).map(p => [p.id, p.def])) };

  // „Alle Objekte“ + einzelnes Objekt: Verschiebungen addieren sich, Prozentwerte werden multipliziert,
  // bei Farbe, Radius und Zeit-Kurve gilt die Einstellung des einzelnen Objekts, falls es eine eigene hat
  const OBJ_ADD = ['ox', 'oy', 'rot', 'hue', 'blur', 'glow', 'offset'], OBJ_MUL = ['op', 'esz', 'gsc', 'sat', 'bri', 'lw', 'speed'];
  const OBJ_WITH = { oc: 'om', tper: 'tcurve', tlen: 'tcurve', tph: 'tcurve', tamt: 'tcurve' };
  function combine(all, own, raw) {
    const o = {};
    for (const id in OP) {
      if (OBJ_ADD.includes(id)) o[id] = all[id] + own[id] - OP[id].def;
      else if (OBJ_MUL.includes(id)) o[id] = all[id] * own[id] / OP[id].def;
      else if (id === 'vis') o[id] = !!(all.vis && own.vis);
      else o[id] = raw[OBJ_WITH[id] || id] !== undefined ? own[id] : all[id];
    }
    o.glow = clamp(o.glow, 0, 100);
    return o;
  }

  /* ───────────── Keyframes (wie in After Effects) ─────────────
     Wert = { kf: [ { t: Sekunde im Song, v: Wert, ei: weich ankommen, eo: weich loslaufen, h: halten, cv: eigene Kurve bis zum nächsten } ] }, nach t sortiert */
  const isKf = v => !!(v && typeof v === 'object' && v.kf && v.kf.length);
  const segCurve = (a, b) => a.cv || (a.eo || b.ei ? { p: 'custom', b: [1 / 3, a.eo ? 0 : 1 / 3, 2 / 3, b.ei ? 1 : 2 / 3] } : null);     // null = gleichmäßig
  const rgbOf = h => { const v = parseInt(String(h).replace('#', ''), 16) || 0; return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
  function mix(a, b, f) {
    if (typeof a === 'number') return a + (b - a) * f;
    const x = rgbOf(a), y = rgbOf(b); return '#' + x.map((c, i) => Math.round(clamp(c + (y[i] - c) * f, 0, 255)).toString(16).padStart(2, '0')).join('');
  }
  function kfValue(v, t) {                       // Wert zum Zeitpunkt t: vor dem ersten bzw. nach dem letzten Keyframe bleibt er stehen
    const k = v.kf, n = k.length;
    if (t <= k[0].t) return k[0].v; if (t >= k[n - 1].t) return k[n - 1].v;
    let i = 0; while (t >= k[i + 1].t) i++;
    const a = k[i], b = k[i + 1]; if (a.h) return a.v;
    const u = (t - a.t) / (b.t - a.t), c = segCurve(a, b); return mix(a.v, b.v, c ? curveFn(c)(u) : u);
  }

  // Frühere Takt-Animation (nur noch in alten Vorlagen): { an: 1, a, b, per, mode: 'loop' | 'pp', cv }
  const isAn = v => !!(v && typeof v === 'object' && v.an);
  function ev(v, def, t, kt) {
    if (v === undefined) return def;
    if (isKf(v)) return kfValue(v, kt === undefined ? t : kt);
    if (isAn(v)) {
      const P = (PER[v.per] || PER.bar)(); let x = ((t / P) % 1 + 1) % 1;
      if (v.mode === 'pp') x = x < .5 ? x * 2 : 2 - x * 2;
      return v.a + (v.b - v.a) * curveFn(v.cv)(x);
    }
    return v;
  }
  function evalBag(bag, defs, t, kt) {
    const o = {};
    for (const id in defs) { const d = defs[id], v = bag ? bag[id] : undefined; o[id] = d.t === 'n' || (d.t === 'c' && isKf(v)) ? ev(v, d.def, t, kt) : v === undefined ? d.def : v; }
    return o;
  }
  // Ändert sich das Tempo per Keyframe, zählt die aufsummierte Zeit (sonst würde die Animation bei jeder Änderung springen).
  // Ergebnis: um wie viele Sekunden die Animation an der Stelle kt dadurch vor- oder nachläuft
  function timeShift(kt, speeds) {
    const lo = Math.min(0, kt), hi = Math.max(0, kt), br = [lo, hi, ...speeds.filter(isKf).flatMap(s => s.kf.map(k => k.t)).filter(x => x > lo && x < hi)].sort((a, b) => a - b);
    let sum = 0;
    for (let i = 1; i < br.length; i++) {
      const d = (br[i] - br[i - 1]) / 24;
      for (let j = 0; j < 24; j++) { const x = br[i - 1] + (j + .5) * d; sum += (speeds.reduce((p, s) => p * ev(s, 1, x, x), 1) - 1) * d; }
    }
    return kt < 0 ? -sum : sum;
  }

  /* ───────────── Aufnahme-Zeichenfläche (Rec) ─────────────
     Verhält sich wie ein 2D-Context, zeichnet aber nichts, sondern merkt sich jede Füll-/Strich-Operation samt Pfad.
     Jede Operation bekommt eine Objekt-Nummer – je nachdem, an welcher Stelle im Code sie ausgelöst wurde. */
  const GRAD = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  const sweep = (a0, a1, ccw) => { let d = a1 - a0; if (!ccw) { if (d >= TAU) d = TAU; else { d %= TAU; if (d < 0) d += TAU; } } else { if (d <= -TAU) d = -TAU; else { d %= TAU; if (d > 0) d -= TAU; } } return d; };
  class Rec {
    constructor(w, h, idFn) {
      this.w = w; this.h = h; this.idFn = idFn; this.ops = []; this.bad = null;
      this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1; this.lineCap = 'butt'; this.lineJoin = 'miter'; this.miterLimit = 10; this.globalAlpha = 1;
      this.m = [1, 0, 0, 1, 0, 0]; this.stk = []; this.dash = []; this.path = [];
    }
    get globalCompositeOperation() { return 'source-over'; }
    set globalCompositeOperation(v) { if (v !== 'source-over') this.bad = 'Mischmodus'; }
    get canvas() { this.bad = 'Zwischenspeicher'; return null; }
    // Zustand
    save() { this.stk.push({ f: this.fillStyle, s: this.strokeStyle, lw: this.lineWidth, lc: this.lineCap, lj: this.lineJoin, ml: this.miterLimit, a: this.globalAlpha, d: this.dash, m: this.m.slice() }); }
    restore() { const o = this.stk.pop(); if (!o) return; this.fillStyle = o.f; this.strokeStyle = o.s; this.lineWidth = o.lw; this.lineCap = o.lc; this.lineJoin = o.lj; this.miterLimit = o.ml; this.globalAlpha = o.a; this.dash = o.d; this.m = o.m; }
    setLineDash(a) { this.dash = Array.from(a || []); }
    getLineDash() { return this.dash.slice(); }
    // Transformation
    transform(a, b, c, d, e, f) { const m = this.m; this.m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]; }
    translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
    scale(x, y) { this.transform(x, 0, 0, y, 0, 0); }
    rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); }
    setTransform(a, b, c, d, e, f) { if (typeof a === 'object') { this.bad = 'Transformation'; return; } this.m = [a, b, c, d, e, f]; }
    resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
    getTransform() { this.bad = 'Transformation'; return new DOMMatrix(); }
    tp(x, y) { const m = this.m; return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
    sc() { const m = this.m; return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1; }
    // Verläufe (Koordinaten gleich in Bildschirmraum umrechnen)
    createLinearGradient(x0, y0, x1, y1) { const a = this.tp(x0, y0), b = this.tp(x1, y1); return GRAD.createLinearGradient(a[0], a[1], b[0], b[1]); }
    createRadialGradient(x0, y0, r0, x1, y1, r1) { const a = this.tp(x0, y0), b = this.tp(x1, y1), k = this.sc(); return GRAD.createRadialGradient(a[0], a[1], r0 * k, b[0], b[1], r1 * k); }
    // Pfad (0 = M, 1 = L, 4 = Z, 5 = Arc)
    beginPath() { this.path = []; }
    moveTo(x, y) { const p = this.tp(x, y); this.path.push([0, p[0], p[1]]); }
    lineTo(x, y) { const p = this.tp(x, y); this.path.push([this.path.length ? 1 : 0, p[0], p[1]]); }
    closePath() { if (this.path.length) this.path.push([4]); }
    arc(x, y, r, a0, a1, ccw) {
      if (!(r >= 0)) return;
      const [a, b, c, d, e, f] = this.m, sx = Math.hypot(a, b), sy = Math.hypot(c, d);
      if (Math.abs(sx - sy) < 1e-6 * (sx || 1) && Math.abs(a * c + b * d) < 1e-6 * (sx * sy || 1)) {      // Drehung/gleichmäßige Skalierung: echter Kreisbogen bleibt erhalten
        const p = this.tp(x, y), th = Math.atan2(b, a);
        if (Math.abs(a1 - a0) >= TAU) this.path.push([5, p[0], p[1], r * sx, 0, TAU, 0]);        // voller Kreis: Winkel exakt 0 → 2π (sonst zeichnet Chrome ihn bei Rundungsfehlern gar nicht)
        else if (a * d - b * c >= 0) this.path.push([5, p[0], p[1], r * sx, a0 + th, a1 + th, ccw ? 1 : 0]);
        else this.path.push([5, p[0], p[1], r * sx, th - a0, th - a1, ccw ? 0 : 1]);
      } else {                                                                                              // verzerrt: in kurze Strecken zerlegen
        const d_ = sweep(a0, a1, !!ccw), n = Math.max(6, Math.ceil(Math.abs(d_) / (Math.PI / 24)));
        for (let i = 0; i <= n; i++) { const q = this.tp(x + Math.cos(a0 + d_ * i / n) * r, y + Math.sin(a0 + d_ * i / n) * r); this.path.push([i === 0 && !this.path.length ? 0 : 1, q[0], q[1]]); }
      }
    }
    rect(x, y, w, h) { this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath(); }
    roundRect(x, y, w, h, rr) {
      let r = Array.isArray(rr) ? rr.slice() : [rr || 0];
      r = r.length === 1 ? [r[0], r[0], r[0], r[0]] : r.length === 2 ? [r[0], r[1], r[0], r[1]] : r.length === 3 ? [r[0], r[1], r[2], r[1]] : r;
      const k = Math.min(1, w / Math.max(1e-9, r[0] + r[1]), w / Math.max(1e-9, r[3] + r[2]), h / Math.max(1e-9, r[1] + r[2]), h / Math.max(1e-9, r[0] + r[3]));
      const [tl, tr, br, bl] = r.map(v => v * k), H = Math.PI / 2;
      this.moveTo(x + tl, y); this.lineTo(x + w - tr, y); this.arc(x + w - tr, y + tr, tr, -H, 0);
      this.lineTo(x + w, y + h - br); this.arc(x + w - br, y + h - br, br, 0, H);
      this.lineTo(x + bl, y + h); this.arc(x + bl, y + h - bl, bl, H, Math.PI);
      this.lineTo(x, y + tl); this.arc(x + tl, y + tl, tl, Math.PI, Math.PI * 1.5); this.closePath();
    }
    fill(rule) { this._emit('f', typeof rule === 'string' ? rule : 'nonzero'); }
    stroke() { this._emit('s'); }
    fillRect(x, y, w, h) { const sv = this.path; this.path = []; this.rect(x, y, w, h); this._emit('f', 'nonzero'); this.path = sv; }
    strokeRect(x, y, w, h) { const sv = this.path; this.path = []; this.rect(x, y, w, h); this._emit('s'); this.path = sv; }
    _emit(kind, rule) {
      if (!this.path.length) return;
      let id = '';
      if (this.idFn) {                                    // Stelle im Code bestimmen, die gezeichnet hat (Zeilennummern der aufrufenden Funktionen)
        const lim = Error.stackTraceLimit; Error.stackTraceLimit = 12;
        const lines = (new Error().stack || '').split('\n'); Error.stackTraceLimit = lim;
        const i = lines.findIndex(l => l.indexOf('_emit') >= 0);
        // nur Zeilen der Animation selbst zählen (ideen.js) – nicht den Code drumherum (Editor, Seite, Studio), der beim Suchen und beim Zeichnen verschieden ist
        const own = lines.slice(i + 2).filter(l => l.indexOf('ideen.js') >= 0), use = own.length ? own : lines.slice(i + 2).filter(l => !/editor-(engine|ui)|animationen\.(html|js)|studio\/|<anonymous>|eval at/.test(l));
        id = this.idFn(use.slice(0, 3).map(l => { const m = /:(\d+):\d+\)?\s*$/.exec(l); return m ? m[1] : '-'; }).join('/'));
      }
      const k = this.sc();
      this.ops.push({ k: kind, id, cmds: this.path.slice(), fs: this.fillStyle, ss: this.strokeStyle, lw: this.lineWidth * k, cap: this.lineCap, join: this.lineJoin, ml: this.miterLimit, dash: this.dash.map(v => v * k), a: this.globalAlpha, rule });
    }
  }
  for (const n of ['clip', 'drawImage', 'getImageData', 'putImageData', 'createImageData', 'createPattern', 'clearRect', 'fillText', 'strokeText', 'measureText', 'quadraticCurveTo', 'bezierCurveTo', 'arcTo', 'ellipse', 'isPointInPath'])
    Rec.prototype[n] = function () { this.bad = n; return n === 'measureText' ? { width: 0 } : undefined; };

  // Art eines Objekts anhand seiner ersten Operation
  function classify(op) {
    const cm = op.cmds, circ = cm.length === 1 && cm[0][0] === 5;
    if (circ) return op.k === 'f' ? 'Kugeln' : 'Ringe';
    if (cm.every(c => c[0] !== 5)) {
      const pts = cm.filter(c => c[0] !== 4);
      if (cm[cm.length - 1][0] === 4 && pts.length === 4 && ((pts[0][1] === pts[1][1] && pts[1][2] === pts[2][2]) || (pts[0][2] === pts[1][2] && pts[1][1] === pts[2][1]))) return op.k === 'f' ? 'Rechtecke' : 'Rahmen';
      return op.k === 's' ? 'Linien' : 'Flächen';
    }
    return 'Formen';
  }

  /* ───────────── Renderer ───────────── */
  class Renderer {
    constructor() { this.cv = {}; this.reset(null); this.bypass = false; this.hl = null; this.solo = null; this.frameNo = 0; }
    reset(idea) { this.idea = idea; this.map = {}; this.objs = []; this.byId = {}; this.noRec = null; this.ver = 0; }
    buf(n, w, h) { let c = this.cv[n]; if (!c || c.width !== w || c.height !== h) c = this.cv[n] = mkCanvas(w, h); return c; }
    idOf(key) {
      let id = this.map[key];
      if (!id) { id = this.map[key] = 'o' + (this.objs.length + 1); const o = { id, kind: '', name: '', max: 0 }; this.objs.push(o); this.byId[id] = o; this.ver++; }
      return id;
    }
    // Alle Objekte einer Animation finden: sie wird ohne Zeichnen über 8 Takte „durchgespielt“
    setIdea(idea) {
      this.reset(idea); if (!idea) return;
      const W = 320, H = 240, n = 130, span = 8 * BAR, t0 = performance.now(), gate = window.IDEEN_GATE;
      window.IDEEN_GATE = false;                                           // beim Suchen immer alles zeichnen, auch vor dem Einsatz der Spur
      for (let i = 0; i < n && !this.noRec; i++) {
        if (i > 10 && performance.now() - t0 > 140) break;                // schwere Animationen: nicht länger als ~0,15 s suchen (später gefundene Objekte kommen beim Zeichnen dazu)
        const t = i * span / n + .013, r = new Rec(W, H, k => this.idOf(k));
        try { idea.draw(r, { t, bar: BAR, beat: BEAT, phase: ((t / BAR) % 1), w: W, h: H, fg: '#ffffff', bg: '#000000', col: '#33cc66' }); } catch (e) { if (e instanceof TypeError) r.bad = r.bad || 'Fehler'; }
        if (r.bad) { this.noRec = r.bad; break; }
        const cnt = {};
        for (const op of r.ops) { cnt[op.id] = (cnt[op.id] || 0) + 1; const o = this.byId[op.id]; if (!o.kind) o.kind = classify(op); }
        for (const id in cnt) this.byId[id].max = Math.max(this.byId[id].max, cnt[id]);
      }
      window.IDEEN_GATE = gate;
      this.nameAll();
    }
    nameAll() {
      const tot = {}, run = {};
      for (const o of this.objs) tot[o.kind || 'Objekte'] = (tot[o.kind || 'Objekte'] || 0) + 1;
      for (const o of this.objs) { const k = o.kind || 'Objekte'; run[k] = (run[k] || 0) + 1; o.name = tot[k] > 1 ? `${k} ${run[k]}` : k; }
    }
    record(s, E) {
      const r = new Rec(E.W, E.H, k => this.idOf(k));
      try { this.idea.draw(r, s); } catch (e) { if (e instanceof TypeError) r.bad = r.bad || 'Fehler'; }
      if (r.bad) { this.noRec = r.bad; return null; }
      let named = false;
      for (const op of r.ops) { const o = this.byId[op.id]; if (o && !o.kind) { o.kind = classify(op); named = true; } }
      if (named) { this.nameAll(); this.ver++; }
      return r.ops;
    }
    // Eine Animation zum Zeitpunkt tt auf ctx zeichnen (Bildschirmpixel = dpr)
    scene(ctx, tt, E) {
      const mk = t => ({ t, bar: BAR, beat: BEAT, phase: ((t / BAR) % 1 + 1) % 1, w: E.W, h: E.H, fg: E.fg, bg: E.bg, col: E.col });
      const direct = () => { ctx.save(); ctx.setTransform(E.dpr, 0, 0, E.dpr, 0, 0); try { this.idea.draw(ctx, mk(tt)); } catch (e) { console.error(e); } ctx.restore(); };
      if (!E.rec || this.noRec) return direct();
      const base = this.record(mk(tt), E); if (!base) return direct();
      let ops = base;
      if (E.custom.length) {
        ops = base.filter(op => E.custom.indexOf(op.id) < 0);
        const seen = new Map();                                  // gleiche Zeit (z. B. durch „Alle Objekte“) nur einmal aufnehmen
        for (const id of E.custom) {
          const o = E.O[id]; if (!o) continue;
          const kfs = o.shift !== undefined, tw = warp(kfs ? tt + o.shift : tt, kfs ? 1 : o.speed, o.offset, o.tcurve, o.tper, o.tamt / 100, o.tlen, o.tph);
          if (!seen.has(tw)) seen.set(tw, this.record(mk(tw), E));
          const rr = seen.get(tw);
          if (rr) for (const op of rr) if (op.id === id) ops.push(op);
        }
      }
      this.replay(ctx, ops, E);
    }
    replay(ctx, ops, E) {
      const { dpr, W, H } = E, hl = this.hl, solo = this.solo, BIG = 20000;
      for (const op of ops) {
        const o = E.O[op.id] || E.OD;
        if (!o.vis || (solo && solo !== op.id)) continue;
        let al = op.a * o.op / 100; if (hl && hl !== op.id) al *= .1;
        if (al <= 0.001) continue;
        const p = new Path2D(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const c of op.cmds) {
          if (c[0] === 0) p.moveTo(c[1], c[2]); else if (c[0] === 1) p.lineTo(c[1], c[2]); else if (c[0] === 4) p.closePath();
          else p.arc(c[1], c[2], c[3], c[4], c[5], !!c[6]);
          if (o.esz !== 100 && c[0] !== 4) { const r = c[0] === 5 ? c[3] : 0; x0 = Math.min(x0, c[1] - r); x1 = Math.max(x1, c[1] + r); y0 = Math.min(y0, c[2] - r); y1 = Math.max(y1, c[2] + r); }
        }
        const col = o.om === 'custom' ? o.oc : null;
        const col2 = col || (op.k === 'f' ? op.fs : op.ss);
        const gcol = col || (typeof col2 === 'string' ? col2 : E.fg);
        const place = off => {
          ctx.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
          if (off) ctx.translate(-BIG / dpr, 0);
          if (o.ox || o.oy || o.rot || o.gsc !== 100) { ctx.translate(W / 2 + o.ox / 100 * W, H / 2 + o.oy / 100 * H); ctx.rotate(o.rot * Math.PI / 180); ctx.scale(o.gsc / 100, o.gsc / 100); ctx.translate(-W / 2, -H / 2); }
          if (o.esz !== 100 && x1 >= x0) { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = o.esz / 100; ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); }
        };
        const paint = () => {
          if (op.k === 'f') { ctx.fillStyle = col2; ctx.fill(p, op.rule); }
          else { ctx.strokeStyle = col2; ctx.lineWidth = Math.max(.001, op.lw * o.lw / 100); ctx.lineCap = op.cap; ctx.lineJoin = op.join; ctx.miterLimit = op.ml; ctx.setLineDash(op.dash); ctx.stroke(p); }
        };
        const fl = [];
        if (FILTER) {
          if (o.blur > 0) fl.push(`blur(${o.blur * dpr}px)`);
          if (o.hue) fl.push(`hue-rotate(${o.hue}deg)`); if (o.sat !== 100) fl.push(`saturate(${o.sat}%)`); if (o.bri !== 100) fl.push(`brightness(${o.bri}%)`);
        }
        const viaShadow = !FILTER && o.blur > 0;                // ohne Filter-Unterstützung: Unschärfe über den Schatten-Trick
        ctx.save();
        if (!viaShadow) {
          place(false); ctx.globalAlpha = al; if (fl.length) ctx.filter = fl.join(' ');
          paint();
        } else {
          place(true); ctx.globalAlpha = al; ctx.shadowColor = gcol; ctx.shadowBlur = o.blur * dpr * 2; ctx.shadowOffsetX = BIG; ctx.shadowOffsetY = 0; paint();
        }
        ctx.restore();
        if (o.glow > 0) {                                       // Leuchten: nur der Schatten, die Form selbst liegt außerhalb des Bildes
          ctx.save(); place(true); ctx.globalAlpha = Math.min(1, al * o.glow / 100 * 1.6);
          ctx.shadowColor = gcol; ctx.shadowBlur = o.glr * dpr * 2; ctx.shadowOffsetX = BIG; ctx.shadowOffsetY = 0;
          if (op.k === 'f') { ctx.fillStyle = '#000'; ctx.fill(p, op.rule); } else { ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(.001, op.lw * o.lw / 100); ctx.lineCap = op.cap; ctx.lineJoin = op.join; ctx.stroke(p); }
          ctx.restore();
        }
      }
    }
    blurTo(dst, src, px) {                                      // src → dst weichzeichnen
      const x = clear(dst);
      if (FILTER) { x.filter = `blur(${px}px)`; x.drawImage(src, 0, 0); x.filter = 'none'; return; }
      const f = Math.max(1, px / 2.5), sm = this.buf('BL', Math.max(1, Math.round(src.width / f)), Math.max(1, Math.round(src.height / f)));
      clear(sm).drawImage(src, 0, 0, sm.width, sm.height); x.imageSmoothingEnabled = true; x.drawImage(sm, 0, 0, sm.width, sm.height, 0, 0, dst.width, dst.height);
    }
    /* ───── ein Bild ───── */
    // layered = die Animation ist eine Ebene von mehreren: nichts deckt die Ebenen darunter zu
    // (Hintergrund und Mischmodus setzt dann der Aufrufer, der Look wirkt nur auf Gezeichnetes)
    render(out, W, H, dpr, sb, S, layered) {
      const Wd = out.width, Hd = out.height, c0 = out.getContext('2d'), idea = this.idea; this.frameNo++;
      clear(out);
      if (!idea) return;
      const tS = sb.t, kt = sb.kt === undefined ? tS + OFFSET : sb.kt;          // kt = Stelle im Song, an der die Keyframes gelesen werden
      const G = evalBag(S.g, GP, tS, kt);
      const E = { W, H, dpr, fg: sb.fg, bg: sb.bg, col: sb.col, rec: false, custom: [], O: {}, OD: evalBag({}, OP, tS, kt) };
      // Objekt-Einstellungen auswerten – nur wenn etwas verändert ist (oder hervorgehoben wird), muss aufgezeichnet werden
      const SO = S.o || {}, all = SO['*'] && Object.keys(SO['*']).length ? SO['*'] : null;
      if (all) { E.OD = evalBag(all, OP, tS, kt); E.rec = true; }
      for (const id of Object.keys(all ? this.byId : SO)) {
        const own = SO[id];
        if (!this.byId[id] || (!all && !Object.keys(own).length)) continue;
        const o = evalBag(own, OP, tS, kt);
        E.O[id] = all ? combine(E.OD, o, own || {}) : o; E.rec = true;
        const c = E.O[id], speeds = [all && all.speed, own && own.speed];
        if (speeds.some(isKf)) c.shift = timeShift(kt, speeds);
        if (c.shift !== undefined || c.speed !== 1 || c.offset !== 0 || (c.tamt > 0 && c.tcurve && c.tcurve.p !== 'linear')) E.custom.push(id);
      }
      if (this.hl || this.solo) E.rec = true;
      if (this.noRec) E.rec = false;
      // Pixel-Werte gelten für ein Bild von 640 × 480 und wachsen mit – so sieht es in Editor, Studio und Video gleich aus
      const k = Math.min(W / 640, H / 480);
      for (const id of ['blur', 'glr', 'dsx', 'dsy', 'dsb', 'wva', 'wvl', 'mos', 'rgb', 'scs']) G[id] *= k;
      for (const o of [E.OD, ...Object.values(E.O)]) { o.blur *= k; o.glr *= k; }
      if (this.bypass) { E.rec = false; E.custom = []; const x = out.getContext('2d'); this.scene(x, tS, E); return; }
      if (G.fgm === 'custom') E.fg = G.fgc; else if (G.fgm === 'track') E.fg = sb.col;
      const bgc = G.bgo ? G.bgc : sb.bg;
      if (G.bgo && !layered) { c0.fillStyle = G.bgc; c0.fillRect(0, 0, Wd, Hd); }
      const kfs = isKf(S.g.speed), tg = warp(kfs ? tS + timeShift(kt, [S.g.speed]) : tS, kfs ? 1 : G.speed, G.offset, G.tcurve, G.tper, G.tamt / 100, G.tlen, G.tph);
      // 1) Animation in die Ebene zeichnen – mit Bewegungsunschärfe und Echos
      const L = this.buf('L', Wd, Hd), lx = clear(L);
      const mbN = G.mbs > 0 ? Math.round(G.mbn) : 1;
      const gather = (tt, alpha) => {
        if (mbN > 1) {
          const T = this.buf('T', Wd, Hd), A = this.buf('A', Wd, Hd), ax = clear(A);
          for (let i = 0; i < mbN; i++) {
            const tx = clear(T); this.scene(tx, tt - G.mbs * BEAT * i / (mbN - 1), E);
            ax.globalCompositeOperation = 'lighter'; ax.globalAlpha = 1 / mbN; ax.drawImage(T, 0, 0);
          }
          lx.globalAlpha = alpha; lx.globalCompositeOperation = 'source-over'; lx.drawImage(A, 0, 0); lx.globalAlpha = 1;
        } else if (alpha >= 1) this.scene(lx, tt, E);
        else { const T = this.buf('T', Wd, Hd), tx = clear(T); this.scene(tx, tt, E); lx.globalAlpha = alpha; lx.drawImage(T, 0, 0); lx.globalAlpha = 1; }
      };
      const ec = Math.min(16, Math.round(G.ecn));
      for (let k = ec; k >= 1; k--) gather(tg - k * G.ecd * BEAT, Math.pow(G.ecf / 100, k));
      gather(tg, 1);
      // 2) Effekte auf die Ebene
      let cur = L, ping = 0;
      const next = () => this.buf('P' + (ping ^= 1), Wd, Hd);
      if (G.kal > 1) {
        const d = next(), x = clear(d), n = Math.round(G.kal), cx = Wd / 2, cy = Hd / 2, R = Math.hypot(Wd, Hd);
        for (let i = 0; i < n; i++) {
          x.save(); x.translate(cx, cy); x.rotate(i * TAU / n); if (i % 2) x.scale(1, -1);
          x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, R, -Math.PI / n, Math.PI / n); x.closePath(); x.clip();
          x.rotate(G.kar * Math.PI / 180); x.drawImage(cur, -cx, -cy); x.restore();
        }
        cur = d;
      }
      if (G.wva > 0) {
        const d = next(), x = clear(d), sh = Math.max(2, Math.round(3 * dpr)), amp = G.wva * dpr, len = G.wvl * dpr, ph = tg / BEAT * G.wvs * TAU;
        for (let y = 0; y < Hd; y += sh) x.drawImage(cur, 0, y, Wd, Math.min(sh, Hd - y), Math.sin(y / len * TAU + ph) * amp, y, Wd, Math.min(sh, Hd - y));
        cur = d;
      }
      if (G.mos > 0) {
        const px = Math.max(1, G.mos * dpr), sw = Math.max(1, Math.round(Wd / px)), sh = Math.max(1, Math.round(Hd / px)), sm = this.buf('M', sw, sh);
        clear(sm).drawImage(cur, 0, 0, sw, sh);
        const d = next(), x = clear(d); x.imageSmoothingEnabled = false; x.drawImage(sm, 0, 0, sw, sh, 0, 0, Wd, Hd); cur = d;
      }
      if (G.rgb > 0) {
        const d = next(), x = clear(d), ch = this.buf('CH', Wd, Hd), off = G.rgb * dpr, fb = this.buf('FB', Wd, Hd), fx = clear(fb);
        if (!layered) { fx.fillStyle = bgc; fx.fillRect(0, 0, Wd, Hd); }
        fx.drawImage(cur, 0, 0);          // erst auf den Hintergrund setzen, dann Kanäle trennen
        x.globalCompositeOperation = 'lighter';
        [['#ff0000', -off], ['#00ff00', 0], ['#0000ff', off]].forEach(([col, dx]) => {
          const cx = clear(ch); cx.drawImage(fb, 0, 0); cx.globalCompositeOperation = 'multiply'; cx.fillStyle = col; cx.fillRect(0, 0, Wd, Hd);
          if (layered) { cx.globalCompositeOperation = 'destination-in'; cx.drawImage(fb, 0, 0); }
          x.drawImage(ch, dx, 0);
        });
        x.globalCompositeOperation = 'source-over'; cur = d;
      }
      if (G.gro && G.gram > 0) {
        const x = cur.getContext('2d'), a = G.gran * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), half = (Math.abs(dx) * Wd + Math.abs(dy) * Hd) / 2, len = half * 2, sh = G.gras / 100 * len;
        const sx = Wd / 2 - dx * half + dx * sh, sy = Hd / 2 - dy * half + dy * sh;
        const g = x.createLinearGradient(sx, sy, sx + dx * len, sy + dy * len); g.addColorStop(0, G.gra); g.addColorStop(1, G.grb);
        x.save(); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = G.gram / 100; x.fillStyle = g; x.fillRect(0, 0, Wd, Hd); x.restore();
      }
      if (G.glow > 0) {
        const gb = this.buf('G', Wd, Hd); this.blurTo(gb, cur, G.glr * dpr);
        const d = next(), x = clear(d); x.drawImage(cur, 0, 0); x.globalCompositeOperation = 'lighter'; x.globalAlpha = Math.min(1, G.glow / 100 * 1.6); x.drawImage(gb, 0, 0); cur = d;
      }
      if (G.blur > 0 && !FILTER) { const d = next(); this.blurTo(d, cur, G.blur * dpr); cur = d; }
      // 3) Ebene aufs Bild setzen: Farbe, Transformation, Deckkraft, Mischmodus, Schatten
      const fl = [];
      if (FILTER) {
        if (G.blur > 0) fl.push(`blur(${G.blur * dpr}px)`);
        if (G.hue) fl.push(`hue-rotate(${G.hue}deg)`); if (G.sat !== 100) fl.push(`saturate(${G.sat}%)`); if (G.bri !== 100) fl.push(`brightness(${G.bri}%)`);
        if (G.con !== 100) fl.push(`contrast(${G.con}%)`); if (G.inv > 0) fl.push(`invert(${G.inv}%)`);
      }
      c0.save();
      c0.globalAlpha = clamp(G.op / 100, 0, 1); c0.globalCompositeOperation = layered ? 'source-over' : G.blend;
      if (fl.length) c0.filter = fl.join(' ');
      if (G.dsa > 0) { c0.shadowColor = hexA(G.dsc, G.dsa / 100); c0.shadowBlur = G.dsb * dpr; c0.shadowOffsetX = G.dsx * dpr; c0.shadowOffsetY = G.dsy * dpr; }
      c0.translate(Wd / 2 + G.px / 100 * Wd, Hd / 2 + G.py / 100 * Hd); c0.rotate(G.rot * Math.PI / 180);
      c0.scale((G.fx ? -1 : 1) * G.scale / 100 * G.sx / 100, (G.fy ? -1 : 1) * G.scale / 100 * G.sy / 100); c0.translate(-Wd / 2, -Hd / 2);
      c0.drawImage(cur, 0, 0);
      c0.restore();
      // 4) Look über allem
      c0.save(); if (layered) c0.globalCompositeOperation = 'source-atop';
      if (G.vig > 0) { const g = c0.createRadialGradient(Wd / 2, Hd / 2, Math.min(Wd, Hd) * .25, Wd / 2, Hd / 2, Math.hypot(Wd, Hd) / 2); g.addColorStop(0, hexA(bgc, 0)); g.addColorStop(1, hexA(bgc, G.vig / 100)); c0.fillStyle = g; c0.fillRect(0, 0, Wd, Hd); }
      if (G.scan > 0) { c0.fillStyle = hexA(bgc, G.scan / 100 * .7); const st = Math.max(2, G.scs * dpr); for (let y = 0; y < Hd; y += st) c0.fillRect(0, y, Wd, Math.max(1, Math.min(dpr, st / 2))); }
      c0.restore();
      if (G.grn > 0) {
        if (!this.noise) { const n = mkCanvas(128, 128), x = n.getContext('2d'), im = x.createImageData(128, 128); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); this.noise = n; }
        const gr = this.buf('GR', Wd, Hd), gx = clear(gr);
        gx.save(); gx.fillStyle = gx.createPattern(this.noise, 'repeat'); gx.translate(Math.random() * 128 | 0, Math.random() * 128 | 0); gx.fillRect(-128, -128, Wd + 256, Hd + 256); gx.restore();
        if (layered) { gx.globalCompositeOperation = 'destination-in'; gx.drawImage(out, 0, 0); gx.globalCompositeOperation = 'source-over'; }
        c0.save(); c0.globalAlpha = G.grn / 100 * .45; c0.globalCompositeOperation = 'overlay'; c0.drawImage(gr, 0, 0); c0.restore();
      }
    }
  }

  window.AE = { Renderer, Rec, FILTER, CURVES, curveFn, curveBez, bez, BEZ, PER, PER_OPTS, TIME_PER_OPTS, warp, ev, isAn, isKf, kfValue, segCurve, timeShift, evalBag, GLOBAL_GROUPS, OBJ_GROUPS, GP, OP, DEFS, hexA };
})();
