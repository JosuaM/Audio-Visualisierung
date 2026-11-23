'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Signale = die „Auslöser“ für Zuordnungen (Lautstärke, Tonhöhe, Schlag …).
   Alles wird einmal aus der vorhandenen Analyse (assets/analysis.js) berechnet
   und danach nur noch abgefragt: Sig.val('loud', t) → Wert in der Einheit des Auslösers.

   Wichtig: Es liegt nur der fertige Mix vor, keine getrennten Einzelspuren.
   Lautstärke, Tonhöhe usw. sind also die des Gesamtklangs an dieser Stelle.
   ═══════════════════════════════════════════════════════════════════════════ */
const Sig = (() => {
  const S = window.SONG, DUR = S.dur, OFF = S.offset || 0, BEAT = 60 / S.bpm, BAR = BEAT * (S.beats || 4);
  const R = 100, N = Math.ceil(DUR * R) + 1;                 // 100 Werte pro Sekunde
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const fr = x => x - Math.floor(x);

  /* ---- Lautstärke in dB aus den Spitzenwerten (250 pro Sekunde), 0,15 s gemittelt ---- */
  const pk = new Int8Array(b64(S.peaks).buffer), pr = S.peakRate || 250, np = pk.length >> 1;
  const sq = new Float64Array(np + 1);
  for (let i = 0; i < np; i++) { const a = Math.max(Math.abs(pk[2 * i]), Math.abs(pk[2 * i + 1])) / 127; sq[i + 1] = sq[i] + a * a * .5; }
  const loud = new Float32Array(N);
  for (let j = 0; j < N; j++) {
    const t = j / R, i0 = clamp(Math.floor((t - .075) * pr), 0, np), i1 = clamp(Math.ceil((t + .075) * pr), 0, np);
    loud[j] = 10 * Math.log10((sq[i1] - sq[i0]) / Math.max(1, i1 - i0) + 1e-8);
  }

  /* ---- Spektrum (64 Bänder, 30 Bilder pro Sekunde): Tonhöhe, Helligkeit, Bass/Mitten/Höhen, Anschlag ---- */
  const sp = b64(S.spec.data), SB = S.spec.bands, SF = S.spec.frames, FPS = S.spec.fps;
  const mean = new Float32Array(SB);
  for (let f = 0; f < SF; f++) for (let b = 0; b < SB; b++) mean[b] += sp[f * SB + b] / SF;
  const at30 = (f, b) => sp[clamp(f, 0, SF - 1) * SB + b];
  const bandRaw = { pitch: new Float32Array(SF), bright: new Float32Array(SF), bass: new Float32Array(SF), mid: new Float32Array(SF), high: new Float32Array(SF), onset: new Float32Array(SF) };
  for (let f = 0; f < SF; f++) {
    let best = 0, bv = -1e9, sum = 0, cen = 0, ba = 0, mi = 0, hi = 0;
    for (let b = 0; b < SB; b++) {
      const v = (at30(f - 1, b) + at30(f, b) + at30(f + 1, b)) / 3;
      if (b >= 12 && b < 48 && v > bv) { bv = v; best = b; }                          // kräftigstes Band im Melodiebereich (Bass und Höhen bleiben außen vor)
      sum += v * v; cen += v * v * b;
      if (b < 12) ba += v; else if (b < 36) mi += v; else hi += v;
    }
    bandRaw.pitch[f] = best; bandRaw.bright[f] = sum ? cen / sum : 0;
    bandRaw.bass[f] = ba / 12; bandRaw.mid[f] = mi / 24; bandRaw.high[f] = hi / (SB - 36);
    let fl = 0; if (f) for (let b = 0; b < SB; b++) fl += Math.max(0, at30(f, b) - at30(f - 1, b));
    bandRaw.onset[f] = fl;
  }
  { const a = bandRaw.pitch, o = a.slice();               // Ausreißer glätten (Median über 7 Bilder)
    for (let f = 0; f < SF; f++) { const w = []; for (let k = -3; k <= 3; k++) w.push(o[clamp(f + k, 0, SF - 1)]); w.sort((x, y) => x - y); a[f] = w[3]; } }
  const resample = (a, fps, smooth = 0) => {                // auf 100 Werte pro Sekunde bringen (linear), optional glätten
    const o = new Float32Array(N);
    for (let j = 0; j < N; j++) { const x = j / R * fps, i = Math.floor(x), k = x - i; o[j] = a[clamp(i, 0, a.length - 1)] * (1 - k) + a[clamp(i + 1, 0, a.length - 1)] * k; }
    if (smooth) { let y = o[0]; const k = 1 - Math.exp(-1 / (R * smooth)); for (let j = 0; j < N; j++) { y += (o[j] - y) * k; o[j] = y; } for (let j = N - 1; j >= 0; j--) { y += (o[j] - y) * k; o[j] = y; } }
    return o;
  };
  const toPct = a => {                                       // 3 %–97 % der Werte auf 0–100 dehnen
    const s = Float32Array.from(a).sort(), lo = s[Math.floor(N * .03)], hi = s[Math.floor(N * .97)], d = (hi - lo) || 1;
    return a.map(v => clamp((v - lo) / d * 100, 0, 100));
  };
  const pitch = toPct(resample(bandRaw.pitch, FPS, .08));
  const bright = toPct(resample(bandRaw.bright, FPS, .1));
  const bass = toPct(resample(bandRaw.bass, FPS, .05)), mid = toPct(resample(bandRaw.mid, FPS, .05)), high = toPct(resample(bandRaw.high, FPS, .05));
  const onset = toPct(resample(bandRaw.onset, FPS, .03));
  const dyn = (() => {                                      // dB pro Sekunde über 0,6 s → −100 (leiser) … +100 (lauter)
    const o = new Float32Array(N), h = Math.round(.3 * R); let m = 1e-6;
    for (let j = 0; j < N; j++) { o[j] = (loud[clamp(j + h, 0, N - 1)] - loud[clamp(j - h, 0, N - 1)]) / .6; m = Math.max(m, Math.abs(o[j])); }
    const s = Float32Array.from(o, Math.abs).sort(), ref = s[Math.floor(N * .95)] || m;
    return o.map(v => clamp(v / ref * 100, -100, 100));
  })();

  const at = (a, t) => { const x = clamp(t, 0, DUR) * R, i = Math.floor(x), k = x - i; return a[Math.min(N - 1, i)] * (1 - k) + a[Math.min(N - 1, i + 1)] * k; };
  const TEN = window.TENSION || [[0, 0], [DUR, 0]];
  const tension = t => { const k = TEN.findIndex(q => q[0] >= t); if (k <= 0) return k === 0 ? TEN[0][1] : TEN[TEN.length - 1][1]; const [t0, v0] = TEN[k - 1], [t1, v1] = TEN[k]; return v0 + (v1 - v0) * (t - t0) / (t1 - t0); };
  let densFn = () => 0, gateFn = () => 0;

  const f0 = (v, d = 0) => v.toFixed(d).replace('.', ',');
  const pct = v => f0(v) + ' %';
  /* ---- Liste aller Auslöser ----
     k Schlüssel · n Name · g Gruppe · lo/hi Wertebereich · dlo/dhi sinnvolle Startwerte · fmt Anzeige · get(t, ctx) Wert · lowL/highL Beschriftung der Enden · hint Erklärung */
  const DEF = [
    { k: 'loud', n: 'Lautstärke', g: 'Lautstärke & Dynamik', u: 'dB', lo: -30, hi: -3, step: .5, dlo: -12, dhi: -5, lowL: 'leise', highL: 'laut', fmt: v => f0(v, 1).replace('-', '−') + ' dB', get: t => at(loud, t), hint: 'Wie laut der Song gerade ist, in dB (0 dB = Maximum, je näher an 0, desto lauter).' },
    { k: 'dyn', n: 'Lauter / leiser werdend', g: 'Lautstärke & Dynamik', u: '', lo: -100, hi: 100, step: 1, dlo: 0, dhi: 60, lowL: 'leiser werdend', highL: 'lauter werdend', fmt: v => (v > 0 ? '+' : v < 0 ? '−' : '') + f0(Math.abs(v)), get: t => at(dyn, t), hint: 'Ob es gerade anschwillt (Crescendo, positiv) oder abschwillt (Decrescendo, negativ).' },
    { k: 'onset', n: 'Anschlag (neuer Ton)', g: 'Lautstärke & Dynamik', u: '%', lo: 0, hi: 100, step: 1, dlo: 40, dhi: 100, lowL: 'ruhig', highL: 'Anschlag', fmt: pct, get: t => at(onset, t), hint: 'Springt hoch, wenn im Klang plötzlich etwas Neues einsetzt (Trommelschlag, neuer Ton).' },
    { k: 'pitch', n: 'Tonhöhe', g: 'Tonhöhe & Klangfarbe', u: '%', lo: 0, hi: 100, step: 1, dlo: 25, dhi: 75, lowL: 'tief', highL: 'hoch', fmt: pct, get: t => at(pitch, t), hint: 'Welches Frequenzband im Melodiebereich (Mitten) gerade am kräftigsten klingt – 0 % = tiefer, 100 % = höher Bereich dieses Songs. Gemessen am Gesamtmix.' },
    { k: 'bright', n: 'Klanghelligkeit', g: 'Tonhöhe & Klangfarbe', u: '%', lo: 0, hi: 100, step: 1, dlo: 25, dhi: 75, lowL: 'dumpf', highL: 'hell', fmt: pct, get: t => at(bright, t), hint: 'Schwerpunkt des Klangs: dumpf (viel Bass) bis hell (viele Höhen).' },
    { k: 'bass', n: 'Bass', g: 'Tonhöhe & Klangfarbe', u: '%', lo: 0, hi: 100, step: 1, dlo: 30, dhi: 80, lowL: 'wenig', highL: 'viel', fmt: pct, get: t => at(bass, t), hint: 'Wie viel Energie in den tiefen Bändern steckt.' },
    { k: 'mid', n: 'Mitten', g: 'Tonhöhe & Klangfarbe', u: '%', lo: 0, hi: 100, step: 1, dlo: 30, dhi: 80, lowL: 'wenig', highL: 'viel', fmt: pct, get: t => at(mid, t), hint: 'Wie viel Energie in den mittleren Bändern steckt.' },
    { k: 'high', n: 'Höhen', g: 'Tonhöhe & Klangfarbe', u: '%', lo: 0, hi: 100, step: 1, dlo: 30, dhi: 80, lowL: 'wenig', highL: 'viel', fmt: pct, get: t => at(high, t), hint: 'Wie viel Energie in den hohen Bändern steckt.' },
    { k: 'beat', n: 'Schlag (Puls)', g: 'Rhythmus & Zeit', u: '%', lo: 0, hi: 100, step: 1, dlo: 30, dhi: 100, lowL: 'zwischen den Schlägen', highL: 'auf dem Schlag', fmt: pct, get: t => 100 * Math.exp(-5 * fr((t - OFF) / BEAT)), hint: 'Springt auf jedem Taktschlag auf 100 % und klingt dann ab.' },
    { k: 'bar', n: 'Position im Takt', g: 'Rhythmus & Zeit', u: '%', lo: 0, hi: 100, step: 1, dlo: 0, dhi: 100, lowL: 'Taktanfang', highL: 'Taktende', fmt: pct, get: t => 100 * fr((t - OFF) / BAR), hint: 'Läuft in jedem Takt von 0 % bis 100 %.' },
    { k: 'progress', n: 'Fortschritt im Song', g: 'Rhythmus & Zeit', u: '%', lo: 0, hi: 100, step: 1, dlo: 0, dhi: 100, lowL: 'Anfang', highL: 'Ende', fmt: pct, get: t => 100 * clamp(t / DUR, 0, 1), hint: 'Wo im Song man gerade ist.' },
    { k: 'tension', n: 'Spannung', g: 'Song', u: '', lo: 0, hi: 10, step: .1, dlo: 3, dhi: 8, lowL: 'entspannt', highL: 'angespannt', fmt: v => f0(v, 1), get: t => tension(t), hint: 'Die nachgezeichnete Spannungskurve (0–10) aus der Kurvenansicht.' },
    { k: 'dense', n: 'Anzahl klingender Spuren', g: 'Song', u: '', lo: 0, hi: 8, step: 1, dlo: 2, dhi: 6, lowL: 'wenige', highL: 'viele', fmt: v => f0(v), get: t => densFn(t), hint: 'Wie viele der 8 Tonspuren gerade klingen.' },
    { k: 'gate', n: 'Die Spur klingt (ja / nein)', g: 'Song', u: '', lo: 0, hi: 1, step: 1, dlo: .5, dhi: 1, lowL: 'still', highL: 'klingt', fmt: v => v >= .5 ? 'ja' : 'nein', get: (t, ctx) => gateFn(t, ctx), hint: 'Nur für Zuordnungen, die auf eine bestimmte Spur wirken: 1, solange diese Spur im Song klingt.' },
  ];
  const BY = Object.fromEntries(DEF.map(d => [d.k, d]));
  return {
    DEF, BY, N, R, DUR,
    val: (k, t, ctx) => BY[k].get(t, ctx || {}),
    series(k, n, ctx) { const d = BY[k], o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = d.get(i / (n - 1) * DUR, ctx || {}); return o; },
    setTracks(dens, gate) { densFn = dens; gateFn = gate; },
  };
})();
