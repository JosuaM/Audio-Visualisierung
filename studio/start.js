'use strict';
/* Start des Studios: Projekt laden, Oberfläche aufbauen, Bildschleife */
let lastFrameP = performance.now();
function frame() {
  const p = performance.now(), dt = Math.min(.1, (p - lastFrameP) / 1000); lastFrameP = p;
  if (window.EXPORTING) { requestAnimationFrame(frame); return; }          // während eines MP4-Exports steht die Vorschau still
  frN0++;
  const t = nowT(), playing = !audio.paused, shown = playing ? t : (audio.currentTime || 0);
  const env = { t, shown, dt, fr: frN0, gate: UI.gate };
  if (UI.ws === 'studio') {
    const vs = viewSpec(); $('tagv').textContent = vs.label;
    if (vs.kind === 'grid') cells.forEach(c => drawStage(c.cv, [c.L], { ...env, gate: vs.gate }, vs.filter));
    else drawStage($('cv'), vs.layers, { ...env, gate: vs.gate }, vs.filter);
    updateLive(shown); drawInspGraph(shown);
  } else if (UI.ws === 'anim') animFrame();
  else laborFrame(dt);
  updatePlayer(shown);
  requestAnimationFrame(frame);
}
(async function boot() {
  readColors(); readWaveColors();
  await loadProject();
  Editor.onPresets = () => { takeEditor(); touch(); };
  $('gate').checked = UI.gate; $('idle').checked = UI.idle; $('tlSig').checked = UI.tlSig;
  $('gate').onchange = () => { UI.gate = $('gate').checked; saveUI(); };
  $('idle').onchange = () => { UI.idle = $('idle').checked; saveUI(); resync(audio.currentTime || 0); };
  $('viewSel').onchange = () => setView($('viewSel').value);
  $('save').onclick = saveProject;
  $('nav-studio').onclick = () => setWs('studio'); $('nav-labor').onclick = () => setWs('labor'); $('nav-anim').onclick = () => setWs('anim');
  $('theme').onclick = toggleTheme;
  $('focus').onclick = () => setFocus(!UI.focus); setFocus(!!UI.focus);
  $('fs').onclick = () => { const st = $('stage'); if (document.fullscreenElement) document.exitFullscreen(); else if (st.requestFullscreen) { if (UI.view === 'grid') setView('mix'); st.requestFullscreen(); } };
  document.addEventListener('fullscreenchange', () => { fitStage(); sizeCv($('cv')); });
  $('tDur').textContent = fmtT(DUR); $('wave').setAttribute('aria-valuemax', DUR.toFixed(1));
  initSplitters(); applyLayout(); uiAll(); setWs(UI.ws);
  new ResizeObserver(() => fitStage()).observe($('stagewrap'));
  new ResizeObserver(() => { drawTimelineCanvases(); }).observe($('tl'));
  new ResizeObserver(() => { $('waveCv')._w = 0; waveKey = ''; }).observe($('wave'));
  window.addEventListener('resize', () => { fitStage(); });
  window.__studio = { P: () => P, UI, Sig };    // zum Ausprobieren in der Browser-Konsole
  requestAnimationFrame(() => { fitStage(); drawTimelineCanvases(); });
  requestAnimationFrame(frame);
})();
