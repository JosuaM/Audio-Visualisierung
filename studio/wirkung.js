'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Zuordnungen: Auslöser (Signal) → Wirkung.
   Eine Zuordnung besteht aus
     layer   '*' = alle Ebenen · sonst Ebenen-ID (z. B. 'track:flute')
     src     Auslöser (siehe signale.js)
     cond    'grad'  stufenlos: von lo bis hi wandert die Wirkung von Wert a nach Wert b
             'ab'    sobald Auslöser ≥ lo: Wirkung = b, sonst a
             'unter' solange Auslöser ≤ lo: Wirkung = b, sonst a
             'zw'    solange Auslöser zwischen lo und hi: Wirkung = b, sonst a
     tgt     Wirkung (WIRK)       a / b  Werte (null = „unverändert“)
     soft    Übergang: 'hart' | 'weich' | 'sehr'
   ═══════════════════════════════════════════════════════════════════════════ */
const COLORS = [['Rot', '#ff3b3b'], ['Orange', '#ff8a1f'], ['Gelb', '#ffd23f'], ['Grün', '#3ddc97'], ['Türkis', '#2fd4e8'], ['Blau', '#4d8bff'], ['Violett', '#9a6bff'], ['Magenta', '#ff3fa6'], ['Weiß', '#ffffff'], ['Schwarz', '#000000']];
const WIRK = {
  y: { s: 'Position ↕', n: 'Position oben / unten', neutral: 0, opts: [['Ganz unten', -.38], ['Unten', -.2], ['Mitte', 0], ['Oben', .2], ['Ganz oben', .38]], hint: 'Verschiebt die Ebene nach oben oder unten.' },
  x: { s: 'Position ↔', n: 'Position links / rechts', neutral: 0, opts: [['Ganz links', -.38], ['Links', -.2], ['Mitte', 0], ['Rechts', .2], ['Ganz rechts', .38]], hint: 'Verschiebt die Ebene nach links oder rechts.' },
  size: { s: 'Größe', n: 'Größe', neutral: 1, opts: [['Winzig (30 %)', .3], ['Klein (60 %)', .6], ['Normal (100 %)', 1], ['Groß (150 %)', 1.5], ['Riesig (240 %)', 2.4]], hint: 'Vergrößert oder verkleinert die ganze Ebene um ihre Mitte.' },
  alpha: { s: 'Deckkraft', n: 'Deckkraft', neutral: 1, opts: [['Unsichtbar', 0], ['Durchsichtig (20 %)', .2], ['Halbtransparent (50 %)', .5], ['Fast deckend (80 %)', .8], ['Deckend (100 %)', 1]], hint: 'Wie stark man die Ebene sieht.' },
  color: { s: 'Farbe', n: 'Farbe', type: 'color', hint: 'Färbt alles, was die Ebene zeichnet, in dieser Farbe ein.' },
  rot: { s: 'Drehung', n: 'Drehung', neutral: 0, opts: [['0°', 0], ['45°', 45], ['90°', 90], ['180°', 180], ['360° (eine Umdrehung)', 360]], hint: 'Dreht die Ebene um ihre Mitte.' },
  shake: { s: 'Zittern', n: 'Zittern', neutral: 0, opts: [['Kein Zittern', 0], ['Leicht', .008], ['Mittel', .025], ['Stark', .06]], hint: 'Lässt die Ebene hin und her wackeln.' },
  bg: { s: 'Hintergrund', n: 'Hintergrund (ganze Bühne)', type: 'color', stage: true, hint: 'Färbt den Hintergrund der Bühne – wirkt immer auf alles.' },
};
const COND = { grad: 'stufenlos von … bis …', ab: 'ab (größer gleich)', unter: 'unter (kleiner gleich)', zw: 'zwischen … und …' };
const SOFT = { hart: { w: .004, tau: 0, n: 'Hart (sofort)' }, weich: { w: .06, tau: .07, n: 'Weich' }, sehr: { w: .18, tau: .3, n: 'Sehr weich (träge)' } };

const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth01 = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const hex2 = h => { const v = parseInt(h.slice(1), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
const mixHex = (a, b, k) => { const p = hex2(a), q = hex2(b); return '#' + [0, 1, 2].map(i => Math.round(p[i] + (q[i] - p[i]) * k).toString(16).padStart(2, '0')).join(''); };

/* Wie weit ist die Zuordnung gerade „aktiv“ (0 … 1)? st = Zwischenspeicher für die Glättung über die Zeit */
function mapFactor(m, t, ctx, st, dt) {
  const d = Sig.BY[m.src], v = Sig.val(m.src, t, ctx), span = d.hi - d.lo, so = SOFT[m.soft] || SOFT.weich;
  const ramp = (x, at) => smooth01((x - at) / (so.w * span) + .5);
  let f;
  if (m.cond === 'grad') f = clamp01((v - m.lo) / ((m.hi - m.lo) || 1));
  else if (m.cond === 'ab') f = ramp(v, m.lo);
  else if (m.cond === 'unter') f = 1 - ramp(v, m.lo);
  else f = ramp(v, m.lo) * (1 - ramp(v, m.hi));
  if (so.tau > 0 && st) {
    if (st.f == null || dt <= 0 || dt > .3) st.f = f; else st.f += (f - st.f) * (1 - Math.exp(-dt / so.tau));
    f = st.f;
  } else if (st) st.f = f;
  return f;
}

/* Wirkung auf die „Änderungen“ (mods) einer Ebene anwenden */
function applyMap(mods, m, f, W, H) {
  const w = WIRK[m.tgt]; if (!w) return;
  if (w.type === 'color') {
    let c = null, amt = 0;
    if (m.a && m.b) { c = mixHex(m.a, m.b, f); amt = 1; } else if (m.b) { c = m.b; amt = f; } else if (m.a) { c = m.a; amt = 1 - f; }
    amt *= m.str == null ? 1 : m.str;                                  // Stärke-Regler
    if (c && amt > .003) (m.tgt === 'bg' ? (mods.bg = mods.bg || []) : mods.tints).push({ c, amt });
    return;
  }
  const a = m.a == null ? w.neutral : +m.a, b = m.b == null ? w.neutral : +m.b, v = w.neutral + (a + (b - a) * f - w.neutral) * (m.str == null ? 1 : m.str);   // Stärke: wie weit weg vom Normalwert
  if (m.tgt === 'y') mods.dy -= v * H; else if (m.tgt === 'x') mods.dx += v * W; else if (m.tgt === 'size') mods.scale *= v;
  else if (m.tgt === 'alpha') mods.alpha *= v; else if (m.tgt === 'rot') mods.rot += v; else if (m.tgt === 'shake') mods.shake += v;
}
const newMods = () => ({ dx: 0, dy: 0, scale: 1, alpha: 1, rot: 0, shake: 0, tints: [], bg: null });

/* Text: „Wenn Lautstärke ab −10 dB → Farbe: Orange“ */
const valLabel = (tgt, v) => {
  if (v == null) return 'unverändert';
  const w = WIRK[tgt]; if (w.type === 'color') { const c = COLORS.find(x => x[1] === v); return c ? c[0] : v; }
  const o = w.opts.find(x => x[1] === +v); return o ? o[0].replace(/ \(.*\)/, '') : String(v);
};
function describe(m) {
  const d = Sig.BY[m.src], w = WIRK[m.tgt], f = x => d.fmt(x);
  const when = m.cond === 'grad' ? `${d.n} von ${f(m.lo)} bis ${f(m.hi)}` : m.cond === 'ab' ? `${d.n} ab ${f(m.lo)}` : m.cond === 'unter' ? `${d.n} unter ${f(m.lo)}` : `${d.n} zwischen ${f(m.lo)} und ${f(m.hi)}`;
  const then = m.cond === 'grad' ? `${w.n}: ${valLabel(m.tgt, m.a)} → ${valLabel(m.tgt, m.b)}` : `${w.n}: ${valLabel(m.tgt, m.b)}${m.a != null ? ` (sonst ${valLabel(m.tgt, m.a)})` : ''}`;
  return { when, then: then + (m.str != null && m.str < .995 ? ` · Stärke ${Math.round(m.str * 100)} %` : '') };
}

/* Vorlagen – erscheinen im Menü „Neue Zuordnung“ und im Labor */
const PRESETS = [
  { id: 'loud-size', n: 'Lauter = größer', m: { src: 'loud', cond: 'grad', lo: -20, hi: -5, tgt: 'size', a: .6, b: 1.5, soft: 'weich' } },
  { id: 'loud-color', n: 'Laut = Farbe', m: { src: 'loud', cond: 'ab', lo: -9, tgt: 'color', a: null, b: '#ff8a1f', soft: 'weich' } },
  { id: 'onset-color', n: 'Anschlag = Farbe', m: { src: 'onset', cond: 'ab', lo: 45, tgt: 'color', a: null, b: '#ff3fa6', soft: 'hart' } },
  { id: 'beat-color', n: 'Schlag blitzt in Farbe', m: { src: 'beat', cond: 'grad', lo: 0, hi: 100, tgt: 'color', a: null, b: '#ffd23f', soft: 'hart' } },
  { id: 'loud-fade', n: 'Leise = durchsichtig', m: { src: 'loud', cond: 'grad', lo: -22, hi: -8, tgt: 'alpha', a: .2, b: 1, soft: 'weich' } },
  { id: 'pitch-y', n: 'Hoher Ton = oben', m: { src: 'pitch', cond: 'grad', lo: 10, hi: 90, tgt: 'y', a: -.38, b: .38, soft: 'weich' } },
  { id: 'pitch-color', n: 'Tonhöhe = Farbverlauf', m: { src: 'pitch', cond: 'grad', lo: 10, hi: 90, tgt: 'color', a: '#4d8bff', b: '#ff3b3b', soft: 'weich' } },
  { id: 'pitch-size', n: 'Hoher Ton = klein', m: { src: 'pitch', cond: 'grad', lo: 10, hi: 90, tgt: 'size', a: 1.5, b: .6, soft: 'weich' } },
  { id: 'beat-pulse', n: 'Puls auf dem Schlag', m: { src: 'beat', cond: 'grad', lo: 0, hi: 100, tgt: 'size', a: 1, b: 1.5, soft: 'hart' } },
  { id: 'onset-shake', n: 'Zittern beim Anschlag', m: { src: 'onset', cond: 'ab', lo: 45, tgt: 'shake', a: null, b: .025, soft: 'hart' } },
  { id: 'bright-alpha', n: 'Heller Klang = deckend', m: { src: 'bright', cond: 'grad', lo: 20, hi: 90, tgt: 'alpha', a: .2, b: 1, soft: 'weich' } },
  { id: 'dyn-size', n: 'Lauter werdend = wächst', m: { src: 'dyn', cond: 'grad', lo: -60, hi: 60, tgt: 'size', a: .6, b: 1.5, soft: 'sehr' } },
  { id: 'tension-bg', n: 'Spannung färbt den Hintergrund', m: { src: 'tension', cond: 'grad', lo: 2, hi: 9, tgt: 'bg', a: '#4d8bff', b: '#ff3b3b', soft: 'sehr' } },
  { id: 'high-rot', n: 'Höhen drehen die Ebene', m: { src: 'high', cond: 'grad', lo: 0, hi: 100, tgt: 'rot', a: 0, b: 180, soft: 'weich' } },
  { id: 'dense-size', n: 'Viele Spuren = groß', m: { src: 'dense', cond: 'grad', lo: 1, hi: 6, tgt: 'size', a: .6, b: 1.5, soft: 'weich' } },
  { id: 'bass-y', n: 'Bass drückt nach unten', m: { src: 'bass', cond: 'grad', lo: 20, hi: 90, tgt: 'y', a: 0, b: -.2, soft: 'weich' } },
  /* ---- weitere Varianten pro Auslöser ---- */
  // Lautstärke
  { id: 'loud-y', n: 'Lauter = höher', m: { src: 'loud', cond: 'grad', lo: -20, hi: -5, tgt: 'y', a: -.2, b: .2, soft: 'weich' } },
  { id: 'loud-shake', n: 'Sehr laut = Zittern', m: { src: 'loud', cond: 'ab', lo: -7, tgt: 'shake', a: null, b: .025, soft: 'weich' } },
  { id: 'loud-rot', n: 'Lauter = dreht sich', m: { src: 'loud', cond: 'grad', lo: -20, hi: -5, tgt: 'rot', a: 0, b: 90, soft: 'sehr' } },
  { id: 'loud-bg', n: 'Lautstärke färbt den Hintergrund', m: { src: 'loud', cond: 'grad', lo: -22, hi: -5, tgt: 'bg', a: '#000000', b: '#4d8bff', soft: 'sehr' } },
  { id: 'loud-color2', n: 'Leise blau → laut rot', m: { src: 'loud', cond: 'grad', lo: -22, hi: -5, tgt: 'color', a: '#4d8bff', b: '#ff3b3b', soft: 'weich' } },
  { id: 'quiet-small', n: 'Leise = winzig', m: { src: 'loud', cond: 'unter', lo: -20, tgt: 'size', a: null, b: .3, soft: 'weich' } },
  // Lauter / leiser werdend
  { id: 'dyn-color', n: 'Lauter werdend grün, leiser werdend rot', m: { src: 'dyn', cond: 'grad', lo: -60, hi: 60, tgt: 'color', a: '#ff3b3b', b: '#3ddc97', soft: 'sehr' } },
  { id: 'dyn-y', n: 'Lauter werdend = steigt', m: { src: 'dyn', cond: 'grad', lo: -60, hi: 60, tgt: 'y', a: -.2, b: .2, soft: 'sehr' } },
  { id: 'dyn-alpha', n: 'Lauter werdend = einblenden', m: { src: 'dyn', cond: 'grad', lo: -60, hi: 60, tgt: 'alpha', a: .2, b: 1, soft: 'sehr' } },
  { id: 'dyn-bg', n: 'Crescendo = Hintergrund heller', m: { src: 'dyn', cond: 'ab', lo: 40, tgt: 'bg', a: null, b: '#ffd23f', soft: 'sehr' } },
  // Anschlag
  { id: 'onset-size', n: 'Anschlag = Ebene springt auf', m: { src: 'onset', cond: 'ab', lo: 45, tgt: 'size', a: 1, b: 1.5, soft: 'hart' } },
  { id: 'onset-alpha', n: 'Anschlag = blitzt auf', m: { src: 'onset', cond: 'grad', lo: 0, hi: 100, tgt: 'alpha', a: .5, b: 1, soft: 'hart' } },
  { id: 'onset-rot', n: 'Anschlag = Ruck-Drehung', m: { src: 'onset', cond: 'ab', lo: 50, tgt: 'rot', a: 0, b: 45, soft: 'weich' } },
  { id: 'onset-bg', n: 'Anschlag = Hintergrund-Blitz', m: { src: 'onset', cond: 'ab', lo: 60, tgt: 'bg', a: null, b: '#ffffff', soft: 'hart' } },
  // Tonhöhe
  { id: 'pitch-x', n: 'Hoher Ton = rechts', m: { src: 'pitch', cond: 'grad', lo: 10, hi: 90, tgt: 'x', a: -.38, b: .38, soft: 'weich' } },
  { id: 'pitch-rot', n: 'Hoher Ton = dreht mehr', m: { src: 'pitch', cond: 'grad', lo: 10, hi: 90, tgt: 'rot', a: 0, b: 180, soft: 'weich' } },
  { id: 'pitch-alpha', n: 'Tiefer Ton = durchsichtig', m: { src: 'pitch', cond: 'grad', lo: 10, hi: 90, tgt: 'alpha', a: .2, b: 1, soft: 'weich' } },
  { id: 'pitch-bg', n: 'Tonhöhe färbt den Hintergrund', m: { src: 'pitch', cond: 'grad', lo: 10, hi: 90, tgt: 'bg', a: '#4d8bff', b: '#ff8a1f', soft: 'sehr' } },
  // Klanghelligkeit
  { id: 'bright-color', n: 'Dumpf blau → hell gelb', m: { src: 'bright', cond: 'grad', lo: 20, hi: 90, tgt: 'color', a: '#4d8bff', b: '#ffd23f', soft: 'weich' } },
  { id: 'bright-size', n: 'Heller Klang = größer', m: { src: 'bright', cond: 'grad', lo: 20, hi: 90, tgt: 'size', a: .6, b: 1.5, soft: 'weich' } },
  { id: 'bright-y', n: 'Heller Klang = höher', m: { src: 'bright', cond: 'grad', lo: 20, hi: 90, tgt: 'y', a: -.2, b: .2, soft: 'weich' } },
  { id: 'bright-shake', n: 'Sehr heller Klang = Zittern', m: { src: 'bright', cond: 'ab', lo: 75, tgt: 'shake', a: null, b: .008, soft: 'weich' } },
  // Bass
  { id: 'bass-size', n: 'Bass = pumpt', m: { src: 'bass', cond: 'grad', lo: 20, hi: 90, tgt: 'size', a: 1, b: 1.5, soft: 'weich' } },
  { id: 'bass-shake', n: 'Starker Bass = Zittern', m: { src: 'bass', cond: 'ab', lo: 70, tgt: 'shake', a: null, b: .06, soft: 'weich' } },
  { id: 'bass-color', n: 'Bass = rot', m: { src: 'bass', cond: 'grad', lo: 20, hi: 90, tgt: 'color', a: null, b: '#ff3b3b', soft: 'weich' } },
  { id: 'bass-bg', n: 'Bass färbt den Hintergrund', m: { src: 'bass', cond: 'grad', lo: 20, hi: 90, tgt: 'bg', a: null, b: '#9a6bff', soft: 'weich' } },
  // Mitten
  { id: 'mid-size', n: 'Mitten = Größe', m: { src: 'mid', cond: 'grad', lo: 20, hi: 90, tgt: 'size', a: .6, b: 1.5, soft: 'weich' } },
  { id: 'mid-color', n: 'Mitten = grün', m: { src: 'mid', cond: 'grad', lo: 20, hi: 90, tgt: 'color', a: null, b: '#3ddc97', soft: 'weich' } },
  { id: 'mid-alpha', n: 'Mitten = deckend', m: { src: 'mid', cond: 'grad', lo: 20, hi: 90, tgt: 'alpha', a: .2, b: 1, soft: 'weich' } },
  { id: 'mid-x', n: 'Mitten schieben nach rechts', m: { src: 'mid', cond: 'grad', lo: 20, hi: 90, tgt: 'x', a: 0, b: .2, soft: 'weich' } },
  // Höhen
  { id: 'high-color', n: 'Höhen = türkis', m: { src: 'high', cond: 'grad', lo: 0, hi: 100, tgt: 'color', a: null, b: '#2fd4e8', soft: 'weich' } },
  { id: 'high-y', n: 'Höhen heben nach oben', m: { src: 'high', cond: 'grad', lo: 0, hi: 100, tgt: 'y', a: 0, b: .2, soft: 'weich' } },
  { id: 'high-shake', n: 'Viele Höhen = Zittern', m: { src: 'high', cond: 'ab', lo: 60, tgt: 'shake', a: null, b: .008, soft: 'weich' } },
  { id: 'high-alpha', n: 'Höhen = glitzern (Deckkraft)', m: { src: 'high', cond: 'grad', lo: 0, hi: 100, tgt: 'alpha', a: .5, b: 1, soft: 'hart' } },
  // Schlag (Puls)
  { id: 'beat-alpha', n: 'Schlag = Aufblitzen', m: { src: 'beat', cond: 'grad', lo: 0, hi: 100, tgt: 'alpha', a: .5, b: 1, soft: 'hart' } },
  { id: 'beat-y', n: 'Schlag = Hüpfen', m: { src: 'beat', cond: 'grad', lo: 0, hi: 100, tgt: 'y', a: 0, b: .2, soft: 'weich' } },
  { id: 'beat-shake', n: 'Schlag = Wackeln', m: { src: 'beat', cond: 'ab', lo: 50, tgt: 'shake', a: null, b: .025, soft: 'hart' } },
  { id: 'beat-bg', n: 'Schlag = Hintergrund pulsiert', m: { src: 'beat', cond: 'grad', lo: 0, hi: 100, tgt: 'bg', a: null, b: '#ff3fa6', soft: 'hart' } },
  { id: 'beat-rot', n: 'Schlag = Ruck-Drehung', m: { src: 'beat', cond: 'grad', lo: 0, hi: 100, tgt: 'rot', a: 0, b: 45, soft: 'weich' } },
  // Position im Takt
  { id: 'bar-rot', n: 'Eine Umdrehung pro Takt', m: { src: 'bar', cond: 'grad', lo: 0, hi: 100, tgt: 'rot', a: 0, b: 360, soft: 'hart' } },
  { id: 'bar-x', n: 'Wandert im Takt von links nach rechts', m: { src: 'bar', cond: 'grad', lo: 0, hi: 100, tgt: 'x', a: -.38, b: .38, soft: 'hart' } },
  { id: 'bar-color', n: 'Farbverlauf über den Takt', m: { src: 'bar', cond: 'grad', lo: 0, hi: 100, tgt: 'color', a: '#4d8bff', b: '#ff3fa6', soft: 'hart' } },
  { id: 'bar-size', n: 'Wächst über den Takt', m: { src: 'bar', cond: 'grad', lo: 0, hi: 100, tgt: 'size', a: .6, b: 1.5, soft: 'hart' } },
  { id: 'bar-alpha', n: 'Taktanfang = Einblenden', m: { src: 'bar', cond: 'grad', lo: 0, hi: 100, tgt: 'alpha', a: 1, b: .2, soft: 'hart' } },
  // Fortschritt im Song
  { id: 'prog-color', n: 'Farbverlauf durch den Song', m: { src: 'progress', cond: 'grad', lo: 0, hi: 100, tgt: 'color', a: '#4d8bff', b: '#ff3b3b', soft: 'weich' } },
  { id: 'prog-bg', n: 'Hintergrund wandert durch den Song', m: { src: 'progress', cond: 'grad', lo: 0, hi: 100, tgt: 'bg', a: '#4d8bff', b: '#ff8a1f', soft: 'sehr' } },
  { id: 'prog-size', n: 'Wächst über den ganzen Song', m: { src: 'progress', cond: 'grad', lo: 0, hi: 100, tgt: 'size', a: .6, b: 1.5, soft: 'weich' } },
  { id: 'prog-alpha', n: 'Blendet im Song ein', m: { src: 'progress', cond: 'grad', lo: 0, hi: 30, tgt: 'alpha', a: 0, b: 1, soft: 'weich' } },
  { id: 'prog-rot', n: 'Dreht sich durch den Song', m: { src: 'progress', cond: 'grad', lo: 0, hi: 100, tgt: 'rot', a: 0, b: 360, soft: 'weich' } },
  { id: 'prog-end', n: 'Gegen Ende = Farbe', m: { src: 'progress', cond: 'ab', lo: 85, tgt: 'color', a: null, b: '#ff3b3b', soft: 'weich' } },
  // Spannung
  { id: 'tension-color', n: 'Spannung = Farbverlauf', m: { src: 'tension', cond: 'grad', lo: 2, hi: 9, tgt: 'color', a: '#4d8bff', b: '#ff3b3b', soft: 'weich' } },
  { id: 'tension-size', n: 'Spannung = wächst', m: { src: 'tension', cond: 'grad', lo: 2, hi: 9, tgt: 'size', a: .6, b: 1.5, soft: 'weich' } },
  { id: 'tension-shake', n: 'Hohe Spannung = Zittern', m: { src: 'tension', cond: 'ab', lo: 7, tgt: 'shake', a: null, b: .025, soft: 'weich' } },
  { id: 'tension-alpha', n: 'Entspannt = durchsichtig', m: { src: 'tension', cond: 'grad', lo: 2, hi: 9, tgt: 'alpha', a: .2, b: 1, soft: 'weich' } },
  { id: 'tension-y', n: 'Spannung = steigt', m: { src: 'tension', cond: 'grad', lo: 2, hi: 9, tgt: 'y', a: -.2, b: .2, soft: 'sehr' } },
  // Anzahl klingender Spuren
  { id: 'dense-color', n: 'Viele Spuren = wärmere Farbe', m: { src: 'dense', cond: 'grad', lo: 1, hi: 6, tgt: 'color', a: '#4d8bff', b: '#ff8a1f', soft: 'weich' } },
  { id: 'dense-alpha', n: 'Wenige Spuren = durchsichtig', m: { src: 'dense', cond: 'grad', lo: 1, hi: 6, tgt: 'alpha', a: .2, b: 1, soft: 'weich' } },
  { id: 'dense-bg', n: 'Viele Spuren = Hintergrund hell', m: { src: 'dense', cond: 'ab', lo: 5, tgt: 'bg', a: null, b: '#9a6bff', soft: 'sehr' } },
  { id: 'dense-shake', n: 'Volle Besetzung = Zittern', m: { src: 'dense', cond: 'ab', lo: 6, tgt: 'shake', a: null, b: .008, soft: 'weich' } },
];
const EMPTY_MAP = { src: 'loud', cond: 'ab', lo: -9, hi: -5, tgt: 'color', a: null, b: '#ff8a1f', soft: 'weich', str: 1 };
