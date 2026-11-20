// Vice Cover Studio: wires the page. Pick photos, choose a multi-panel layout, crop and
// position each photo, write the caption, pick a colour grade, export a PNG.
// Photos are read on this machine only and are never uploaded.
import { drawCover, layoutPanels, panelAt, photoDrawRect, LAYOUTS, GRADES, SIZES } from './cover.js';
import { runShot } from './shots.js';

const SAMPLES = [
  { name: 'pier', label: 'Pier' },
  { name: 'boulevard', label: 'Boulevard' },
  { name: 'neon', label: 'Neon street' },
  { name: 'beach', label: 'Beach sunset' },
];

const canvas = document.getElementById('preview');
const statusEl = document.getElementById('status');
const trayEl = document.getElementById('tray');
const zoomEl = document.getElementById('zoom');

const state = {
  layout: 'trio',
  size: '1920x1080',
  grade: 'sunset',
  gradeStrength: 0.7,
  caption: 'SUNSET HEIST',
  subcaption: 'NEON NIGHTS',
  captionPos: 'bottom',
  photos: [], // { id, name, label, img }
  panels: [], // { photoId, zoom, ox, oy }
  selected: 0,
};

let photoSeq = 0;

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadSample(name) {
  const found = SAMPLES.find((s) => s.name === name);
  const img = await loadImage(`samples/${name}.jpg`);
  const photo = { id: `sample-${name}`, name, label: found ? found.label : name, img };
  if (!state.photos.some((p) => p.id === photo.id)) state.photos.push(photo);
  return photo;
}

function panelCount() {
  return LAYOUTS[state.layout].panels;
}

/** Keeps one panel entry per layout panel, preserving assignments where possible. */
function ensurePanels() {
  const n = panelCount();
  const next = [];
  for (let i = 0; i < n; i++) {
    const old = state.panels[i];
    const photo = state.photos[i % Math.max(1, state.photos.length)] || null;
    next.push({
      photoId: old ? old.photoId : photo ? photo.id : null,
      zoom: old ? old.zoom : 1,
      ox: old ? old.ox : 0,
      oy: old ? old.oy : 0,
    });
  }
  state.panels = next;
  state.selected = Math.min(state.selected, n - 1);
}

/** The draw state: panels resolved to loaded images. */
function drawState() {
  return {
    layout: state.layout,
    grade: state.grade,
    gradeStrength: state.gradeStrength,
    caption: state.caption,
    subcaption: state.subcaption,
    captionPos: state.captionPos,
    panels: state.panels.map((p) => {
      const photo = state.photos.find((x) => x.id === p.photoId) || null;
      return { img: photo ? photo.img : null, zoom: p.zoom, ox: p.ox, oy: p.oy };
    }),
  };
}

function applySize() {
  const [w, h] = SIZES[state.size];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function render() {
  ensurePanels();
  applySize();
  drawCover(canvas, drawState());
  syncControls();
}

function syncControls() {
  document.querySelectorAll('#layouts button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#grades button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('.exports button').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === state.size);
  });
  const captionInput = document.getElementById('caption');
  if (document.activeElement !== captionInput) captionInput.value = state.caption;
  const subInput = document.getElementById('subcaption');
  if (document.activeElement !== subInput) subInput.value = state.subcaption;
  document.getElementById('captionPos').value = state.captionPos;
  document.getElementById('gradeStrength').value = String(state.gradeStrength);
  const panel = state.panels[state.selected];
  zoomEl.value = panel ? String(panel.zoom) : '1';
  trayEl.querySelectorAll('.thumb').forEach((t) => {
    t.classList.toggle('assigned', panel && t.dataset.photoId === panel.photoId);
  });
}

function rebuildTray() {
  trayEl.innerHTML = '';
  for (const photo of state.photos) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.dataset.photoId = photo.id;
    button.title = photo.label;
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.label;
    button.appendChild(img);
    const span = document.createElement('span');
    span.textContent = photo.label;
    button.appendChild(span);
    button.addEventListener('click', () => {
      state.panels[state.selected].photoId = photo.id;
      render();
    });
    trayEl.appendChild(button);
  }
}

function setStatus(text) {
  statusEl.textContent = text;
}

function exportPNG(sizeKey) {
  const [w, h] = SIZES[sizeKey];
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawCover(off, { ...drawState(), panels: drawState().panels });
  off.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed — try again.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-cover-${sizeKey}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved vice-cover-${sizeKey}.png`);
  }, 'image/png');
}

// --- Photo input: files from the machine, or the bundled samples. ---
document.getElementById('photo').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  for (const file of files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      state.photos.push({ id: `upload-${++photoSeq}`, name: file.name, label: file.name.replace(/\.[^.]+$/, ''), img });
    } catch {
      setStatus(`Could not read ${file.name}.`);
    }
  }
  e.target.value = '';
  rebuildTray();
  render();
});

document.getElementById('samples').addEventListener('click', async (e) => {
  const button = e.target.closest('button[data-sample]');
  if (!button) return;
  await loadSample(button.dataset.sample);
  rebuildTray();
  render();
});

document.getElementById('fillAll').addEventListener('click', () => {
  const first = state.panels[0] ? state.panels[0].photoId : null;
  if (!first) return;
  for (const panel of state.panels) panel.photoId = first;
  render();
});

// --- Layout, grade, caption. ---
document.getElementById('layouts').addEventListener('click', (e) => {
  const button = e.target.closest('button[data-layout]');
  if (!button) return;
  state.layout = button.dataset.layout;
  render();
});

document.getElementById('grades').addEventListener('click', (e) => {
  const button = e.target.closest('button[data-grade]');
  if (!button) return;
  state.grade = button.dataset.grade;
  render();
});

document.getElementById('gradeStrength').addEventListener('input', (e) => {
  state.gradeStrength = Number(e.target.value);
  render();
});

document.getElementById('caption').addEventListener('input', (e) => {
  state.caption = e.target.value;
  render();
});

document.getElementById('subcaption').addEventListener('input', (e) => {
  state.subcaption = e.target.value;
  render();
});

document.getElementById('captionPos').addEventListener('change', (e) => {
  state.captionPos = e.target.value;
  render();
});

zoomEl.addEventListener('input', () => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.zoom = Number(zoomEl.value);
  render();
});

document.getElementById('fitPanel').addEventListener('click', () => {
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.zoom = 1;
  panel.ox = 0;
  panel.oy = 0;
  render();
});

// --- Export: one click per post size. ---
document.querySelector('.exports').addEventListener('click', (e) => {
  const button = e.target.closest('button[data-size]');
  if (!button) return;
  state.size = button.dataset.size;
  render();
  exportPNG(button.dataset.size);
});

// --- Canvas: click a panel to select it, drag to move its photo, scroll to zoom. ---
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = panelAt(state.layout, canvas.width, canvas.height, p.x, p.y);
  if (i < 0) return;
  state.selected = i;
  drag = { x: p.x, y: p.y };
  canvas.setPointerCapture(e.pointerId);
  render();
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const panel = state.panels[state.selected];
  if (!panel) return;
  const photo = state.photos.find((x) => x.id === panel.photoId);
  if (!photo) return;
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const d = photoDrawRect(photo.img, rects[state.selected], panel.zoom, panel.ox, panel.oy);
  const overX = Math.max(0, (d.w - rects[state.selected].w) / 2);
  const overY = Math.max(0, (d.h - rects[state.selected].h) / 2);
  if (overX > 0) panel.ox = Math.max(-1, Math.min(1, panel.ox + (p.x - drag.x) / overX));
  if (overY > 0) panel.oy = Math.max(-1, Math.min(1, panel.oy + (p.y - drag.y) / overY));
  drag = { x: p.x, y: p.y };
  render();
});

canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('pointercancel', () => { drag = null; });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const panel = state.panels[state.selected];
  if (!panel) return;
  panel.zoom = Math.max(1, Math.min(4, panel.zoom * Math.exp(-e.deltaY * 0.0012)));
  render();
}, { passive: false });

// --- Shot scenes for screenshots: ?shot=cover or ?shot=editor (see shots.js). ---
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    loadSample,
    applyShot(patch) {
      if (patch.layout) state.layout = patch.layout;
      if (patch.size) state.size = patch.size;
      if (patch.caption !== undefined) state.caption = patch.caption;
      if (patch.subcaption !== undefined) state.subcaption = patch.subcaption;
      if (patch.grade) state.grade = patch.grade;
      if (patch.photoIds) {
        ensurePanels();
        state.panels.forEach((panel, i) => {
          panel.photoId = patch.photoIds[i % patch.photoIds.length];
        });
      }
      render();
    },
    render,
  });
} else {
  (async () => {
    for (const s of SAMPLES) {
      try { await loadSample(s.name); } catch { /* a missing sample still leaves the rest */ }
    }
    rebuildTray();
    try { await document.fonts.load('100px Anton'); } catch { /* canvas falls back to sans-serif */ }
    render();
    document.fonts.ready.then(render);
  })();
}
