'use strict';
/* Abstrakte Effekte (Labor) – gemeinsam genutzt von labor.html und dem Studio (index.html).
   ✎ HIER NEUE EFFEKTE EINTRAGEN: Jeder Effekt hat draw(c, s) und füllt den ganzen Kasten.
   s.t Zeit, s.bar/s.beat Länge von Takt/Schlag, s.w/s.h Größe, s.fg/s.bg Theme-Farben. */
window.LABOR_GROUPS = (() => {
  const TAU = Math.PI * 2, fr = x => x - Math.floor(x), cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const eIO = p => p * p * (3 - 2 * p), seg = (x, a, b) => cl((x - a) / (b - a));
  const ph = s => fr(s.t / s.bar), pulse = s => Math.exp(-5 * fr(s.t / s.beat));   // pulse: 1 genau auf dem Schlag, fällt dann ab
  const hsl = (h, sa, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${sa}%,${l}%,${a})`;
  const hsh = (a, b) => { let x = Math.imul(a * 374761393 + b * 668265263, 1274126177); x ^= x >>> 13; x = Math.imul(x, 1103515245); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  const fill = (c, s, col) => { c.fillStyle = col; c.fillRect(0, 0, s.w, s.h); };
  return [
   { g: 'Hintergrund', t: 'Der Hintergrund selbst wird zur Animation – Farbe, Verlauf, Wolken.', fx: [
    { title: 'Farbe pro Takt', tag: 'Wechsel im letzten Viertel', text: 'Jeder Takt hat eine eigene Hintergrundfarbe, im letzten Viertel blendet sie zur nächsten über. Auf jedem Schlag ein kurzes Aufhellen.',
      draw(c, s) { const n = Math.floor(s.t / s.bar), k = eIO(seg(ph(s), .75, 1)); fill(c, s, hsl(n * 67 + 67 * k, 70, 42)); fill(c, s, `rgba(255,255,255,${.18 * pulse(s)})`); } },
    { title: 'Drehender Verlauf', tag: 'langsam, 1 Umdrehung / 8 Takte', text: 'Ein Farbverlauf dreht sich langsam, dabei wandern die Farbtöne weiter.',
      draw(c, s) { const a = s.t / s.bar * TAU / 8, cx = s.w / 2, cy = s.h / 2, R = Math.hypot(s.w, s.h) / 2, h = s.t / s.bar * 25;
        const g = c.createLinearGradient(cx - Math.cos(a) * R, cy - Math.sin(a) * R, cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        g.addColorStop(0, hsl(h, 80, 50)); g.addColorStop(.5, hsl(h + 60, 80, 55)); g.addColorStop(1, hsl(h + 140, 80, 35)); fill(c, s, g); } },
    { title: 'Taktraster', tag: '4 Streifen = 4 Schläge', text: 'Der Hintergrund ist in 4 Streifen geteilt. Der Streifen des aktuellen Schlags leuchtet auf und verblasst dann.',
      draw(c, s) { const b = Math.floor(s.t / s.beat), w = s.w / 4; fill(c, s, hsl(225, 35, 11));
        for (let i = 0; i < 4; i++) { const age = (((b % 4) - i) % 4 + 4) % 4, a = age === 0 ? .35 + .65 * pulse(s) : [0, .3, .15, .07][age]; c.fillStyle = hsl(38 + i * 12, 90, 55, a); c.fillRect(i * w, 0, w + 1, s.h); } } },
    { title: 'Farbwolken', tag: 'weich, überlagert', text: 'Vier große weiche Farbflecken driften über dunklem Grund und mischen sich, wo sie sich treffen.',
      draw(c, s) { fill(c, s, '#07080d'); c.globalCompositeOperation = 'lighter'; const m = Math.min(s.w, s.h);
        for (let i = 0; i < 4; i++) { const t = s.t / s.bar, x = s.w / 2 + Math.sin(t * .9 + i * 1.7) * s.w * .3, y = s.h / 2 + Math.cos(t * .7 + i * 2.3) * s.h * .3, r = m * (.5 + .12 * Math.sin(t * 1.3 + i) + .08 * pulse(s));
          const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hsl(i * 75 + t * 8, 85, 45, .85)); g.addColorStop(1, hsl(i * 75 + t * 8, 85, 45, 0)); c.fillStyle = g; c.fillRect(0, 0, s.w, s.h); }
        c.globalCompositeOperation = 'source-over'; } },
    { neu: 1, title: 'Wandernde Streifen', tag: 'schieben sich durch den Takt', text: 'Breite Farbstreifen laufen seitlich durchs Bild, der Farbton wandert langsam weiter. Auf jedem Schlag ein kurzes Aufhellen.',
      draw(c, s) { const N = 8, w = s.w / N, off = fr(s.t / s.bar) * w * 2, h = s.t / s.bar * 15 + 200; for (let i = -2; i < N + 2; i++) { c.fillStyle = hsl(h + (i % 2 ? 0 : 35), 70, i % 2 ? 40 : 52); c.fillRect(i * w + off, 0, w + 1, s.h); } fill(c, s, `rgba(255,255,255,${.2 * pulse(s)})`); } },
    { neu: 1, title: 'Plasma', tag: 'weiche Farbwellen', text: 'Mehrere Wellen überlagern sich zu einem fließenden Farbteppich, auf dem Schlag wird er kurz heller.',
      draw(c, s) { const X = 24, Y = 16, w = s.w / X, h = s.h / Y, t = s.t / s.bar; for (let i = 0; i < X; i++) for (let j = 0; j < Y; j++) { const v = Math.sin(i * .5 + t * 1.5) + Math.sin(j * .6 - t * 1.1) + Math.sin((i + j) * .35 + t * .9); c.fillStyle = hsl(v * 60 + t * 20, 75, 42 + 10 * pulse(s)); c.fillRect(i * w, j * h, w + 1, h + 1); } } },
    { neu: 1, title: 'Schachbrett kippt', tag: 'wechselt auf jedem Schlag', text: 'Ein Schachbrett, bei dem auf jedem Schlag hell und dunkel vertauscht werden und sich der Farbton ändert.',
      draw(c, s) { const b = Math.floor(s.t / s.beat), X = 8, Y = 6, w = s.w / X, h = s.h / Y; fill(c, s, hsl(b * 47, 60, 28)); c.fillStyle = hsl(b * 47 + 30, 70, 55); for (let i = 0; i < X; i++) for (let j = 0; j < Y; j++) if ((i + j + b) % 2 === 0) c.fillRect(i * w, j * h, w + 1, h + 1); fill(c, s, `rgba(255,255,255,${.25 * pulse(s)})`); } },
    { neu: 1, title: 'Sonnenaufgang', tag: 'Sonne steigt und sinkt pro Takt', text: 'Ein Himmelsverlauf mit einer Sonne, die im Lauf eines Takts aufgeht und wieder untergeht. Der Himmel ändert dabei die Farbe.',
      draw(c, s) { const t = ph(s), h0 = 270 + 60 * Math.sin(t * TAU), g = c.createLinearGradient(0, 0, 0, s.h), m = Math.min(s.w, s.h), hz = s.h * .8;
        g.addColorStop(0, hsl(h0, 70, 20)); g.addColorStop(.6, hsl(h0 + 60, 85, 50)); g.addColorStop(1, hsl(h0 + 90, 90, 62)); fill(c, s, g);
        c.fillStyle = hsl(45, 100, 78); c.beginPath(); c.arc(s.w / 2, hz - Math.sin(t * Math.PI) * s.h * .5, m * (.13 + .02 * pulse(s)), 0, TAU); c.fill(); c.fillStyle = hsl(h0, 40, 9); c.fillRect(0, hz, s.w, s.h - hz); } },
    { neu: 1, title: 'Farbe pro Schlag', tag: 'harter Wechsel auf jedem Schlag', text: 'Der ganze Hintergrund springt auf jedem Schlag in einen neuen Farbton und leuchtet kurz weiß auf.',
      draw(c, s) { const b = Math.floor(s.t / s.beat); fill(c, s, hsl(b * 83, 75, 40)); fill(c, s, `rgba(255,255,255,${.5 * pulse(s)})`); } },
   ] },
   { g: 'Licht & Schatten', t: 'Schatten, Leuchten, Scheinwerfer – Licht als Gestaltungsmittel.', fx: [
    { title: 'Springender Ball mit Schatten', tag: '1 Sprung pro Schlag', text: 'Der Ball springt auf jedem Schlag. Sein weicher Schatten am Boden wird kleiner und blasser, je höher er fliegt.',
      draw(c, s) { fill(c, s, hsl(40, 22, 86)); const m = Math.min(s.w, s.h), r = m * .07, gy = s.h * .74, p = fr(s.t / s.beat), hn = 4 * p * (1 - p), x = s.w / 2;
        c.fillStyle = hsl(40, 15, 78); c.fillRect(0, gy, s.w, s.h - gy);
        c.save(); c.translate(x, gy + m * .02); c.scale(1, .22); const R = r * (1.5 + hn * .8), g = c.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, `rgba(30,20,10,${.5 * (1 - .6 * hn)})`); g.addColorStop(1, 'rgba(30,20,10,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill(); c.restore();
        c.fillStyle = hsl(14, 85, 55); c.beginPath(); c.arc(x, gy - r - hn * s.h * .42, r, 0, TAU); c.fill(); } },
    { title: 'Wandernder Schatten', tag: 'Sonne dreht über 8 Takte', text: 'Ein Quadrat wirft einen langen Schatten, dessen Richtung und Länge sich mit der Zeit ändert – wie eine wandernde Sonne.',
      draw(c, s) { fill(c, s, hsl(45, 30, 88)); const m = Math.min(s.w, s.h), q = m * .2, a = s.t / s.bar * TAU / 8 + .6, len = m * (.28 + .1 * Math.sin(s.t / s.bar * .8)), cx = s.w / 2, cy = s.h / 2;
        c.fillStyle = 'rgba(40,30,20,.05)'; for (let i = 40; i >= 0; i--) { const d = len * i / 40; c.fillRect(cx - q / 2 + Math.cos(a) * d, cy - q / 2 + Math.sin(a) * d, q, q); }
        c.fillStyle = hsl(205, 70, 52); c.fillRect(cx - q / 2, cy - q / 2, q, q); } },
    { title: 'Neon-Glühen', tag: 'Leuchten auf dem Schlag', text: 'Ein Ring leuchtet. Auf jedem Schlag flammt das Glühen stark auf und klingt wieder ab, jeder Takt hat einen neuen Farbton.',
      draw(c, s) { fill(c, s, hsl(250, 40, 6)); const n = Math.floor(s.t / s.bar), col = hsl(n * 53 + 300, 100, 62), m = Math.min(s.w, s.h);
        c.strokeStyle = col; c.lineWidth = m * .025; c.shadowColor = col; c.shadowBlur = m * (.05 + .16 * pulse(s)); c.beginPath(); c.arc(s.w / 2, s.h / 2, m * .26, 0, TAU); c.stroke(); c.stroke(); c.shadowBlur = 0; } },
    { title: 'Scheinwerfer', tag: 'Acht-Bewegung über 2 Takte', text: 'Ein weicher Lichtkegel wandert auf einer Acht über ein dunkles Punktraster und macht nur dort die Punkte sichtbar.',
      draw(c, s) { fill(c, s, '#05060a'); const t = s.t / s.bar, lx = s.w / 2 + Math.sin(t * Math.PI / 2) * s.w * .3, ly = s.h / 2 + Math.sin(t * Math.PI) * s.h * .2, R = Math.min(s.w, s.h) * (.34 + .04 * pulse(s));
        for (let i = 0; i < 14; i++) for (let j = 0; j < 10; j++) { const x = (i + .5) / 14 * s.w, y = (j + .5) / 10 * s.h, d = Math.hypot(x - lx, y - ly); c.fillStyle = `rgba(255,236,190,${Math.max(.08, 1 - d / R)})`; c.beginPath(); c.arc(x, y, s.w * .008, 0, TAU); c.fill(); }
        c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(lx, ly, 0, lx, ly, R); g.addColorStop(0, 'rgba(255,220,150,.35)'); g.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = g; c.fillRect(0, 0, s.w, s.h); c.globalCompositeOperation = 'source-over'; } },
    { title: 'Lichtstrahlen', tag: '12 Strahlen, drehen langsam', text: 'Strahlen gehen von der Mitte aus, drehen sich langsam und werden auf jedem Schlag heller.',
      draw(c, s) { fill(c, s, hsl(230, 50, 8)); const R = Math.hypot(s.w, s.h) / 2, M = 12, a0 = s.t / s.bar * TAU / 24; c.save(); c.translate(s.w / 2, s.h / 2);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, hsl(45, 100, 68, .35 + .5 * pulse(s))); g.addColorStop(1, hsl(45, 100, 68, 0)); c.fillStyle = g;
        for (let i = 0; i < M; i++) { const a = a0 + i * TAU / M; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a, a + TAU / M * .45); c.closePath(); c.fill(); } c.restore(); } },
    { neu: 1, title: 'Stroboskop', tag: 'Blitz auf jedem Schlag, stärker auf der Eins', text: 'Dunkles Bild, auf jedem Schlag ein weißer Blitz, der abklingt – auf dem ersten Schlag des Takts am stärksten. Dazwischen sieht man nur einen dunklen Umriss.',
      draw(c, s) { fill(c, s, '#06060a'); const m = Math.min(s.w, s.h), k = Math.floor(s.t / s.beat) % 4 === 0 ? 1 : .55; c.fillStyle = hsl(230, 30, 14); c.fillRect(s.w / 2 - m * .12, s.h / 2 - m * .12, m * .24, m * .24); fill(c, s, `rgba(255,255,255,${.9 * k * pulse(s) ** 2})`); } },
    { neu: 1, title: 'Lichtkegel von oben', tag: 'Scheinwerfer schwenkt pro Takt', text: 'Ein Lichtkegel hängt von oben ins dunkle Bild und schwenkt im Lauf eines Takts hin und her. Auf dem Schlag weitet er sich kurz.',
      draw(c, s) { fill(c, s, '#07080c'); const a = Math.sin(ph(s) * TAU) * .5, L = s.h * 1.2, wd = s.h * .4 * (1 + .15 * pulse(s)); c.save(); c.translate(s.w / 2, -s.h * .05); c.rotate(a);
        const g = c.createLinearGradient(0, 0, 0, L); g.addColorStop(0, 'rgba(255,240,200,.8)'); g.addColorStop(1, 'rgba(255,240,200,.05)'); c.fillStyle = g; c.beginPath(); c.moveTo(-6, 0); c.lineTo(6, 0); c.lineTo(wd, L); c.lineTo(-wd, L); c.closePath(); c.fill(); c.restore(); } },
    { neu: 1, title: 'Lichtpunkte (Bokeh)', tag: 'weiche Kreise treiben, pulsieren', text: 'Viele weiche Lichtkreise treiben langsam durchs Bild und werden auf jedem Schlag kurz größer – wie Lichter hinter einer unscharfen Linse.',
      draw(c, s) { fill(c, s, hsl(240, 35, 8)); const m = Math.min(s.w, s.h), t = s.t / s.bar; c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 18; i++) { const x = fr(hsh(i, 1) + t * .03 * (1 + hsh(i, 2))) * s.w, y = s.h * (.5 + .4 * Math.sin(t * .4 * (1 + hsh(i, 3)) + i * 2.1)), r = m * (.05 + .07 * hsh(i, 4)) * (1 + .25 * pulse(s)), hh = hsh(i, 5) * 80 + 20;
          const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hsl(hh, 90, 60, .6)); g.addColorStop(.8, hsl(hh, 90, 60, .35)); g.addColorStop(1, hsl(hh, 90, 60, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
        c.globalCompositeOperation = 'source-over'; } },
    { neu: 1, title: 'Pendel mit Schatten', tag: 'ein Schwung pro Takt', text: 'Eine Kugel schwingt an einer Schnur hin und her, auf dem Boden folgt ihr weicher Schatten.',
      draw(c, s) { fill(c, s, hsl(40, 22, 86)); const m = Math.min(s.w, s.h), gy = s.h * .78, a = Math.sin(ph(s) * TAU) * .6, L = s.h * .55, bx = s.w / 2 + Math.sin(a) * L, by = s.h * .05 + Math.cos(a) * L;
        c.fillStyle = hsl(40, 15, 78); c.fillRect(0, gy, s.w, s.h - gy); c.save(); c.translate(bx, gy + m * .03); c.scale(1, .22); const R = m * .12, g = c.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, 'rgba(30,20,10,.45)'); g.addColorStop(1, 'rgba(30,20,10,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill(); c.restore();
        c.strokeStyle = hsl(30, 10, 35); c.lineWidth = 2; c.beginPath(); c.moveTo(s.w / 2, s.h * .05); c.lineTo(bx, by); c.stroke(); c.fillStyle = hsl(14, 85, 55); c.beginPath(); c.arc(bx, by, m * .06, 0, TAU); c.fill(); } },
    { neu: 1, title: 'Laserfächer', tag: '7 Strahlen schwenken', text: 'Sieben leuchtende Strahlen schwenken von oben durchs dunkle Bild und werden auf dem Schlag heller.',
      draw(c, s) { fill(c, s, '#04050a'); const t = s.t / s.bar; c.globalCompositeOperation = 'lighter'; c.lineWidth = 2; for (let i = 0; i < 7; i++) { const col = hsl(i * 50 + t * 20, 100, 60, .45 + .5 * pulse(s)); c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 10; c.beginPath(); c.moveTo(s.w * (i + .5) / 7, 0); c.lineTo(s.w / 2 + Math.sin(t * Math.PI + i * .9) * s.w * .55, s.h); c.stroke(); }
        c.shadowBlur = 0; c.globalCompositeOperation = 'source-over'; } },
   ] },
   { g: 'Linse & Rand', t: 'Alles, was am Bildrand oder durch eine „Linse“ passiert.', fx: [
    { title: 'Vignette atmet', tag: 'Rand dunkel, öffnet auf dem Schlag', text: 'Farbige Streifen laufen durchs Bild, der Rand ist abgedunkelt. Auf jedem Schlag öffnet sich die Vignette kurz weiter.',
      draw(c, s) { c.save(); c.translate(s.w / 2, s.h / 2); c.rotate(-.5); const W = Math.hypot(s.w, s.h), k = 28, off = fr(s.t / s.bar / 2) * k * 2;
        for (let i = -12; i < 12; i++) { c.fillStyle = hsl(i * 22 + s.t * 18, 75, 52); c.fillRect(-W / 2, (i * k) + off - k * 12 + k, W, k + 1); } c.restore();
        const cx = s.w / 2, cy = s.h / 2, m = Math.min(s.w, s.h), g = c.createRadialGradient(cx, cy, m * (.2 + .12 * pulse(s)), cx, cy, Math.hypot(cx, cy)); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.95)'); fill(c, s, g); } },
    { title: 'Lupe / Linse', tag: 'Linse wandert über 2 Takte', text: 'Eine Linse wandert über ein Punktraster und vergrößert und verzerrt die Punkte darunter.',
      draw(c, s) { const t = s.t / s.bar, lx = s.w / 2 + Math.sin(t * Math.PI / 2) * s.w * .28, ly = s.h / 2 + Math.cos(t * Math.PI / 2 * 1.3) * s.h * .2, R = Math.min(s.w, s.h) * .26; c.fillStyle = s.fg;
        for (let i = 0; i < 16; i++) for (let j = 0; j < 12; j++) { let x = (i + .5) / 16 * s.w, y = (j + .5) / 12 * s.h, f = 1; const d = Math.hypot(x - lx, y - ly); if (d < R) { f = 1 + 1.1 * (1 - (d / R) ** 2); x = lx + (x - lx) * f; y = ly + (y - ly) * f; }
          c.beginPath(); c.arc(x, y, s.w * .008 * f, 0, TAU); c.fill(); }
        c.strokeStyle = s.fg; c.globalAlpha = .5; c.lineWidth = 2; c.beginPath(); c.arc(lx, ly, R, 0, TAU); c.stroke(); c.globalAlpha = 1; } },
    { title: 'Blende (Iris)', tag: 'öffnet und schließt pro Takt', text: 'Eine runde Blende gibt den Blick auf ein Ringmuster frei – sie öffnet sich im Lauf eines Takts und schließt wieder, der Rand ist weich.',
      draw(c, s) { fill(c, s, '#0a0a0f'); const cx = s.w / 2, cy = s.h / 2, m = Math.hypot(cx, cy); c.save(); c.translate(cx, cy);
        for (let i = 14; i > 0; i--) { c.fillStyle = hsl(i * 25 + s.t * 30, 75, i % 2 ? 55 : 35); c.beginPath(); c.arc(0, 0, i * m / 14, 0, TAU); c.fill(); } c.restore();
        const r = m * (.12 + .88 * .5 * (1 - Math.cos(ph(s) * TAU))), g = c.createRadialGradient(cx, cy, r * .8, cx, cy, r); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); fill(c, s, g); } },
    { title: 'Farbsaum (Chromatische Aberration)', tag: 'Versatz auf dem Schlag', text: 'Rot, Grün und Blau werden gegeneinander versetzt – auf dem Schlag springen sie auseinander und finden wieder zusammen, wie bei einer billigen Linse.',
      draw(c, s) { fill(c, s, '#000'); const m = Math.min(s.w, s.h), amp = m * (.006 + .05 * pulse(s)); c.globalCompositeOperation = 'lighter';
        [['#ff0000', -1], ['#00ff00', 0], ['#0000ff', 1]].forEach(([col, k]) => { c.save(); c.translate(k * amp, 0); c.strokeStyle = col; c.lineWidth = m * .03; c.beginPath(); c.arc(s.w / 2, s.h / 2, m * .24, 0, TAU); c.stroke(); c.fillStyle = col; c.fillRect(s.w * .2, s.h / 2 - m * .015, s.w * .6, m * .03); c.restore(); });
        c.globalCompositeOperation = 'source-over'; } },
    { neu: 1, title: 'Tunnel', tag: 'Ringe fliegen auf dich zu', text: 'Konzentrische Ringe wachsen aus der Mitte nach außen und erzeugen einen Tunnelblick. Der Rand ist abgedunkelt, die Mitte pulsiert mit dem Schlag.',
      draw(c, s) { fill(c, s, '#050509'); const cx = s.w / 2, cy = s.h / 2, R = Math.hypot(cx, cy), k = fr(s.t / s.bar) * 2; for (let i = 12; i >= 0; i--) { c.fillStyle = hsl(260 + (i % 2) * 60 + s.t * 6, 70, i % 2 ? 26 : 44); c.beginPath(); c.arc(cx, cy, R * ((i + k) / 12) ** 2, 0, TAU); c.fill(); }
        const g = c.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(.35, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.7)'); fill(c, s, g); c.fillStyle = hsl(50, 100, 70, .3 + .6 * pulse(s)); c.beginPath(); c.arc(cx, cy, Math.min(s.w, s.h) * (.03 + .03 * pulse(s)), 0, TAU); c.fill(); } },
    { neu: 1, title: 'Pulsierender Rahmen', tag: 'Rand schwillt auf dem Schlag an', text: 'Ein dicker farbiger Rahmen sitzt am Bildrand und schwillt auf jedem Schlag kurz an, der Farbton wandert mit.',
      draw(c, s) { fill(c, s, hsl(220, 30, 12)); const m = Math.min(s.w, s.h), t = m * (.03 + .08 * pulse(s)); c.fillStyle = hsl(s.t / s.bar * 30 + 20, 85, 58); c.fillRect(0, 0, s.w, t); c.fillRect(0, s.h - t, s.w, t); c.fillRect(0, 0, t, s.h); c.fillRect(s.w - t, 0, t, s.h);
        c.strokeStyle = hsl(220, 20, 40); c.lineWidth = 2; c.strokeRect(s.w * .3, s.h * .3, s.w * .4, s.h * .4); } },
    { neu: 1, title: 'Kinoleisten', tag: 'schließen zwischen den Schlägen', text: 'Schwarze Balken oben und unten schließen sich langsam und springen auf jedem Schlag wieder auf – dahinter läuft ein Farbverlauf.',
      draw(c, s) { const g = c.createLinearGradient(0, 0, s.w, s.h), h = s.t / s.bar * 20; g.addColorStop(0, hsl(h + 200, 70, 40)); g.addColorStop(1, hsl(h + 320, 75, 50)); fill(c, s, g); const hb = s.h * (.04 + .27 * (1 - pulse(s))); c.fillStyle = '#000'; c.fillRect(0, 0, s.w, hb); c.fillRect(0, s.h - hb, s.w, hb); } },
    { neu: 1, title: 'Schärfe wandert', tag: 'Fokus pendelt vor und zurück', text: 'Viele Lichtpunkte in verschiedener Tiefe. Eine Schärfeebene wandert hin und her: Punkte in der Ebene sind klein und klar, die anderen groß und blass.',
      draw(c, s) { fill(c, s, hsl(230, 30, 10)); const m = Math.min(s.w, s.h), fp = .5 + .5 * Math.sin(ph(s) * TAU); for (let i = 0; i < 40; i++) { const z = hsh(i, 3), d = Math.abs(z - fp); c.fillStyle = hsl(hsh(i, 4) * 60 + 30, 90, 65, .95 - .6 * d); c.beginPath(); c.arc(hsh(i, 1) * s.w, hsh(i, 2) * s.h, m * (.012 + .06 * d) * (1 + .15 * pulse(s)), 0, TAU); c.fill(); } } },
   ] },
   { g: 'Übergänge', t: 'Wie eine Fläche in die nächste übergeht – jeweils einmal pro Takt, mit neuer Farbe.', fx: [
    { title: 'Wischen', tag: 'diagonal, letzte 40 % des Takts', text: 'Die nächste Farbe wischt schräg über die aktuelle.',
      draw(c, s) { const n = Math.floor(s.t / s.bar), p = eIO(seg(ph(s), .6, 1)); fill(c, s, hsl(n * 60, 70, 45)); const X = p * (s.w + .4 * s.h); c.fillStyle = hsl((n + 1) * 60, 70, 45); c.beginPath(); c.moveTo(0, 0); c.lineTo(X, 0); c.lineTo(X - .4 * s.h, s.h); c.lineTo(0, s.h); c.fill(); } },
    { title: 'Iris-Übergang', tag: 'Kreis wächst aus der Mitte', text: 'Ein Kreis in der nächsten Farbe wächst aus der Mitte, bis er alles füllt.',
      draw(c, s) { const n = Math.floor(s.t / s.bar), p = eIO(seg(ph(s), .5, 1)); fill(c, s, hsl(n * 60, 70, 45)); c.fillStyle = hsl((n + 1) * 60, 70, 45); c.beginPath(); c.arc(s.w / 2, s.h / 2, p * Math.hypot(s.w, s.h) / 2, 0, TAU); c.fill(); } },
    { title: 'Jalousie', tag: '8 Streifen kippen nacheinander', text: 'Acht waagerechte Streifen kippen nacheinander von einer Farbe zur nächsten.',
      draw(c, s) { const n = Math.floor(s.t / s.bar), p = ph(s), N = 8, h = s.h / N; fill(c, s, hsl((n + 1) * 60, 70, 45)); c.fillStyle = hsl(n * 60, 70, 45);
        for (let i = 0; i < N; i++) { const k = eIO(seg(p, .45 + i * .05, .65 + i * .05)); c.fillRect(0, i * h + h * k / 2, s.w, h * (1 - k) + .5); } } },
    { title: 'Mosaik', tag: 'Kacheln in zufälliger Reihenfolge', text: 'Die Fläche wird kachelweise in zufälliger Reihenfolge zur nächsten Farbe.',
      draw(c, s) { const n = Math.floor(s.t / s.bar), p = seg(ph(s), .45, .95), X = 12, Y = 9, w = s.w / X, h = s.h / Y; fill(c, s, hsl(n * 60, 70, 45)); c.fillStyle = hsl((n + 1) * 60, 70, 45);
        for (let i = 0; i < X; i++) for (let j = 0; j < Y; j++) if (p > hsh(i + n * 31, j) * .98) c.fillRect(i * w, j * h, w + 1, h + 1); } },
    { title: 'Schieben', tag: 'neue Fläche schiebt die alte raus', text: 'Die nächste Farbe schiebt die aktuelle nach oben aus dem Bild.',
      draw(c, s) { const n = Math.floor(s.t / s.bar), p = eIO(seg(ph(s), .65, 1)); c.fillStyle = hsl(n * 60, 70, 45); c.fillRect(0, -p * s.h, s.w, s.h); c.fillStyle = hsl((n + 1) * 60, 70, 45); c.fillRect(0, s.h - p * s.h, s.w, s.h); } },
    { neu: 1, title: 'Vorhang', tag: 'öffnet sich in der Mitte', text: 'Zwei Hälften in der aktuellen Farbe fahren zur Seite und geben die nächste Farbe frei.',
      draw(c, s) { const n = Math.floor(s.t / s.bar), p = eIO(seg(ph(s), .55, 1)), w = s.w / 2 * (1 - p); fill(c, s, hsl((n + 1) * 60, 70, 45)); c.fillStyle = hsl(n * 60, 70, 45); c.fillRect(0, 0, w, s.h); c.fillRect(s.w - w, 0, w + 1, s.h); } },
    { neu: 1, title: 'Schachbrett-Übergang', tag: 'Kacheln wachsen aus der Mitte', text: 'In jeder Kachel wächst ein Quadrat in der nächsten Farbe, abwechselnd früher und später – bis alles gefüllt ist.',
      draw(c, s) { const n = Math.floor(s.t / s.bar), p = ph(s), X = 8, Y = 6, w = s.w / X, h = s.h / Y; fill(c, s, hsl(n * 60, 70, 45)); c.fillStyle = hsl((n + 1) * 60, 70, 45);
        for (let i = 0; i < X; i++) for (let j = 0; j < Y; j++) { const k = eIO(seg(p, .4 + ((i + j) % 2) * .15, .7 + ((i + j) % 2) * .15)); c.fillRect((i + .5) * w - w * k / 2 - .5, (j + .5) * h - h * k / 2 - .5, w * k + 1, h * k + 1); } } },
    { neu: 1, title: 'Punkte wachsen', tag: 'Punktraster füllt die Fläche', text: 'Ein Raster aus Punkten in der nächsten Farbe, die immer größer werden und zusammenwachsen.',
      draw(c, s) { const n = Math.floor(s.t / s.bar), p = eIO(seg(ph(s), .45, 1)), X = 10, Y = 7, w = s.w / X, h = s.h / Y; fill(c, s, hsl(n * 60, 70, 45)); c.fillStyle = hsl((n + 1) * 60, 70, 45);
        for (let i = 0; i < X; i++) for (let j = 0; j < Y; j++) { c.beginPath(); c.arc((i + .5) * w, (j + .5) * h, p * Math.hypot(w, h) / 2 * 1.02, 0, TAU); c.fill(); } } },
    { neu: 1, title: 'Uhrzeiger', tag: 'Kreisausschnitt wischt rundherum', text: 'Die nächste Farbe wischt wie ein Uhrzeiger einmal rundherum über die aktuelle.',
      draw(c, s) { const n = Math.floor(s.t / s.bar), p = eIO(seg(ph(s), .5, 1)), cx = s.w / 2, cy = s.h / 2; fill(c, s, hsl(n * 60, 70, 45)); c.fillStyle = hsl((n + 1) * 60, 70, 45); c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, Math.hypot(cx, cy) + 2, -Math.PI / 2, -Math.PI / 2 + p * TAU); c.closePath(); c.fill(); } },
    { neu: 1, title: 'Treppe', tag: '6 Säulen steigen nacheinander', text: 'Sechs Säulen in der nächsten Farbe steigen von unten auf, eine nach der anderen – wie eine Treppe.',
      draw(c, s) { const n = Math.floor(s.t / s.bar), p = ph(s), N = 6, w = s.w / N; fill(c, s, hsl(n * 60, 70, 45)); c.fillStyle = hsl((n + 1) * 60, 70, 45); for (let i = 0; i < N; i++) { const k = eIO(seg(p, .4 + i * .07, .6 + i * .07)); c.fillRect(i * w, s.h * (1 - k), w + 1, s.h * k + 1); } } },
   ] },
   { g: 'Weitere Ideen', t: 'Struktur, Textur, Symmetrie.', fx: [
    { title: 'Röhrenbildschirm', tag: 'Zeilen + Wackeln auf dem Schlag', text: 'Alte Röhre: Zeilen über dem Bild, ein Leuchtbalken und ein Kreis, der auf dem Schlag seitlich wackelt.',
      draw(c, s) { fill(c, s, '#020604'); const m = Math.min(s.w, s.h), jx = (hsh(Math.floor(s.t * 30), 1) - .5) * m * .06 * pulse(s); c.save(); c.translate(jx, 0); c.strokeStyle = hsl(140, 90, 60); c.lineWidth = m * .025; c.shadowColor = hsl(140, 90, 60); c.shadowBlur = 14;
        c.beginPath(); c.arc(s.w / 2, s.h / 2, m * .22, 0, TAU); c.stroke(); c.fillStyle = hsl(140, 90, 60, .8); c.fillRect(0, (ph(s) * 1.2 - .1) * s.h, s.w, m * .03); c.restore(); c.shadowBlur = 0;
        c.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 0; y < s.h; y += 3) c.fillRect(0, y, s.w, 1); } },
    { title: 'Filmkorn', tag: 'Rauschen stärker auf dem Schlag', text: 'Körniges Rauschen liegt über einem weichen Lichtfleck. Auf jedem Schlag wird das Korn kurz deutlich stärker.',
      draw(c, s) { fill(c, s, hsl(30, 18, 14)); const g = c.createRadialGradient(s.w / 2, s.h / 2, 0, s.w / 2, s.h / 2, Math.min(s.w, s.h) * .5); g.addColorStop(0, 'rgba(255,200,140,.45)'); g.addColorStop(1, 'rgba(255,200,140,0)'); fill(c, s, g);
        const f = Math.floor(s.t * 24), a = .1 + .35 * pulse(s); for (let i = 0; i < 900; i++) { c.fillStyle = hsh(i, f + 7) > .5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; c.fillRect(hsh(i, f) * s.w, hsh(i, f + 3) * s.h, 1.6, 1.6); } } },
    { title: 'Kaleidoskop', tag: '8 Spiegelsektoren', text: 'Ein Punkt mit Schweif wandert durch einen Sektor und wird achtfach gespiegelt – es entsteht eine Blüte, die langsam rotiert.',
      draw(c, s) { fill(c, s, hsl(260, 40, 7)); const m = Math.min(s.w, s.h), t = s.t / s.bar, N = 8; c.save(); c.translate(s.w / 2, s.h / 2); c.rotate(t * .15);
        for (let k = 0; k < N; k++) for (const mir of [1, -1]) { c.save(); c.rotate(k * TAU / N); c.scale(1, mir);
          for (let j = 0; j < 6; j++) { const tt = t - j * .06, r = m * (.12 + .26 * (.5 + .5 * Math.sin(tt * Math.PI))), a = .35 * Math.sin(tt * Math.PI / 2 * 1.5); c.fillStyle = hsl(k * 40 + t * 20 + j * 8, 85, 60, 1 - j * .16); c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, m * (.045 - j * .005) * (1 + .4 * pulse(s)), 0, TAU); c.fill(); } c.restore(); }
        c.restore(); } },
    { neu: 1, title: 'Wellenlinien', tag: 'Linien wogen, Ausschlag auf dem Schlag', text: 'Viele waagerechte Linien wogen wie Wasser. Auf jedem Schlag schlagen die Wellen kurz höher aus.',
      draw(c, s) { fill(c, s, '#07101a'); const t = s.t / s.bar; c.strokeStyle = hsl(195, 80, 60); c.lineWidth = 1.5; for (let j = 0; j < 18; j++) { c.beginPath(); for (let x = 0; x <= s.w + 6; x += 6) { const y = (j + .5) / 18 * s.h + Math.sin(x / s.w * TAU * 2 + t * 2 + j * .3) * s.h * (.015 + .035 * pulse(s)); x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); } } },
    { neu: 1, title: 'Equalizer-Balken', tag: '16 Balken tanzen im Takt', text: 'Sechzehn Balken wie bei einem Equalizer – sie wippen unterschiedlich schnell und springen auf dem Schlag hoch.',
      draw(c, s) { fill(c, s, hsl(250, 30, 9)); const N = 16, w = s.w / N, t = s.t / s.bar; for (let i = 0; i < N; i++) { const v = Math.min(1, .2 + .45 * Math.abs(Math.sin(t * (1.2 + hsh(i, 1) * 2.2) + i)) + .3 * hsh(i, 2) * pulse(s)); c.fillStyle = hsl(i * 10 + 180, 80, 55); c.fillRect(i * w + w * .12, s.h * (1 - v), w * .76, s.h * v); } } },
    { neu: 1, title: 'Punkt-Welle', tag: 'Wellen laufen von der Mitte aus', text: 'Ein Punktraster, in dem Wellen von der Mitte nach außen laufen: Die Punkte schwellen an und ab, auf dem Schlag etwas stärker.',
      draw(c, s) { fill(c, s, '#0a0a0f'); const X = 18, Y = 12, cx = s.w / 2, cy = s.h / 2, R = Math.hypot(cx, cy), t = s.t / s.bar; for (let i = 0; i < X; i++) for (let j = 0; j < Y; j++) { const x = (i + .5) / X * s.w, y = (j + .5) / Y * s.h, d = Math.hypot(x - cx, y - cy) / R, k = .5 + .5 * Math.sin(d * 9 - t * TAU * 2);
        c.fillStyle = hsl(200 + d * 120 + t * 10, 80, 45 + 25 * k); c.beginPath(); c.arc(x, y, s.w / X * .5 * (.15 + .6 * k) * (1 + .2 * pulse(s)), 0, TAU); c.fill(); } } },
    { neu: 1, title: 'Spirale', tag: 'dreht sich, atmet auf dem Schlag', text: 'Eine Spirale aus Punkten dreht sich langsam, ihre Windungen weiten sich auf jedem Schlag kurz.',
      draw(c, s) { fill(c, s, hsl(260, 40, 7)); const m = Math.min(s.w, s.h), t = s.t / s.bar, R = m * .45 * (1 + .1 * pulse(s)); c.save(); c.translate(s.w / 2, s.h / 2);
        for (let k = 0; k < 160; k++) { const a = k * .25 + t * .8, r = k / 160 * R; c.fillStyle = hsl(k * 2 + t * 30, 85, 60); c.beginPath(); c.arc(Math.cos(a) * r, Math.sin(a) * r, m * .012 * (.6 + k / 160), 0, TAU); c.fill(); } c.restore(); } },
   ] },
  ];
})();
