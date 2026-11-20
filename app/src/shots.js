// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos loaded;
// ?shot=cover shows one exported cover alone, at its export size. `photos` picks the
// samples in order, `caption` / `sub` the words, `layout` / `size` / `grade` the look.
// window.__shotReady is set once the cover is painted with its font loaded.
export async function runShot(shot, query, api) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const names = (query.get('photos') ?? 'pier').split(',').map((s) => s.trim()).filter(Boolean);
  const loaded = [];
  for (const name of names) {
    try { loaded.push(await api.loadSample(name)); } catch { /* skip a missing sample */ }
  }
  api.applyShot({
    layout: query.get('layout') ?? 'trio',
    size: query.get('size') ?? '1920x1080',
    caption: query.get('caption') ?? 'SUNSET HEIST',
    subcaption: query.get('sub') ?? 'NEON NIGHTS',
    grade: query.get('grade') ?? 'sunset',
    photoIds: loaded.map((p) => p.id),
  });
  try { await document.fonts.load('100px Anton'); } catch { /* canvas falls back to sans-serif */ }
  await document.fonts.ready;
  api.render();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
