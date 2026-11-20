// Vice Cover Studio renderer: draws a multi-panel GTA-style cover onto a 2D canvas.
// A cover is a set of photo panels (each with its own crop and position), a colour
// grade, and bold caption lettering. Everything is drawn from local state only.

export const LAYOUTS = {
  trio: { panels: 3, label: 'Trio' },
  quad: { panels: 4, label: 'Quad' },
  split: { panels: 2, label: 'Split' },
  solo: { panels: 1, label: 'Solo' },
};

export const GRADES = {
  sunset: { label: 'Sunset', accent: '#ffd166' },
  neon: { label: 'Neon', accent: '#7df9ff' },
  noir: { label: 'Noir', accent: '#e8e8e8' },
};

export const SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

/** Panel rectangles for a layout at cover size w x h, with a thin gutter between them. */
export function layoutPanels(layout, w, h) {
  const g = Math.max(2, Math.round(w * 0.006));
  if (layout === 'trio') {
    const hero = Math.round(w * 0.6);
    const half = Math.round(h / 2);
    return [
      { x: 0, y: 0, w: hero - g, h },
      { x: hero, y: 0, w: w - hero, h: half - g },
      { x: hero, y: half, w: w - hero, h: h - half },
    ];
  }
  if (layout === 'quad') {
    const cw = Math.round((w - g) / 2);
    const ch = Math.round((h - g) / 2);
    return [
      { x: 0, y: 0, w: cw, h: ch },
      { x: cw + g, y: 0, w: w - cw - g, h: ch },
      { x: 0, y: ch + g, w: cw, h: h - ch - g },
      { x: cw + g, y: ch + g, w: w - cw - g, h: h - ch - g },
    ];
  }
  if (layout === 'split') {
    const half = Math.round(w / 2);
    return [
      { x: 0, y: 0, w: half - g, h },
      { x: half, y: 0, w: w - half, h },
    ];
  }
  return [{ x: 0, y: 0, w, h }];
}

/** Index of the panel containing point (x, y) in canvas pixels, or -1. */
export function panelAt(layout, w, h, x, y) {
  const rects = layoutPanels(layout, w, h);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
}

/** Where a photo lands inside a panel: cover-fit, scaled by zoom, panned by ox/oy (-1..1). */
export function photoDrawRect(img, rect, zoom, ox, oy) {
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * zoom;
  const pw = img.naturalWidth * scale;
  const ph = img.naturalHeight * scale;
  const overX = Math.max(0, (pw - rect.w) / 2);
  const overY = Math.max(0, (ph - rect.h) / 2);
  return {
    x: rect.x + (rect.w - pw) / 2 + ox * overX,
    y: rect.y + (rect.h - ph) / 2 + oy * overY,
    w: pw,
    h: ph,
  };
}

function photoFilter(grade) {
  if (grade === 'neon') return 'saturate(1.45) contrast(1.08)';
  if (grade === 'noir') return 'grayscale(1) contrast(1.12) brightness(0.96)';
  return 'saturate(1.3) contrast(1.06)';
}

function drawGradeOverlay(ctx, w, h, grade, strength) {
  if (strength <= 0) return;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  if (grade === 'neon') {
    sky.addColorStop(0, `rgba(0, 229, 255, ${0.16 * strength})`);
    sky.addColorStop(0.55, `rgba(120, 40, 200, ${0.10 * strength})`);
    sky.addColorStop(1, `rgba(255, 0, 128, ${0.22 * strength})`);
  } else if (grade === 'noir') {
    sky.addColorStop(0, `rgba(255, 255, 255, ${0.05 * strength})`);
    sky.addColorStop(1, `rgba(0, 0, 0, ${0.18 * strength})`);
  } else {
    sky.addColorStop(0, `rgba(255, 170, 60, ${0.14 * strength})`);
    sky.addColorStop(0.55, `rgba(255, 80, 90, ${0.10 * strength})`);
    sky.addColorStop(1, `rgba(160, 30, 130, ${0.26 * strength})`);
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, `rgba(8, 2, 16, ${0.34 * strength})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function fitFont(ctx, text, startSize, maxWidth) {
  let size = startSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (size > 12 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

function drawCaption(ctx, w, h, state) {
  const caption = (state.caption || '').trim().toUpperCase();
  const sub = (state.subcaption || '').trim().toUpperCase();
  if (!caption && !sub) return;
  const accent = (GRADES[state.grade] || GRADES.sunset).accent;
  const bottom = state.captionPos !== 'top';
  const scrimH = h * 0.30;
  const scrim = ctx.createLinearGradient(0, bottom ? h - scrimH : 0, 0, bottom ? h : scrimH);
  scrim.addColorStop(0, 'rgba(10, 4, 16, 0)');
  scrim.addColorStop(1, 'rgba(10, 4, 16, 0.62)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bottom ? h - scrimH : 0, w, scrimH);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const cx = w / 2;
  if (caption) {
    const size = fitFont(ctx, caption, h * 0.115, w * 0.88);
    const y = bottom ? h - h * 0.055 : h * 0.055 + size;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeStyle = '#0d0512';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = size * 0.14;
    ctx.shadowOffsetY = size * 0.03;
    ctx.strokeText(caption, cx, y);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(caption, cx, y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (sub) {
      const subSize = Math.max(12, size * 0.26);
      ctx.font = `${subSize}px Anton, sans-serif`;
      try { ctx.letterSpacing = `${Math.round(subSize * 0.28)}px`; } catch { /* older canvas: no letter spacing */ }
      const subY = bottom ? y - size * 1.18 : y + subSize * 1.7;
      ctx.fillStyle = accent;
      ctx.fillText(sub, cx, subY);
      try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
      ctx.fillStyle = accent;
      ctx.fillRect(cx - ctx.measureText(sub).width / 2 - 10, subY + subSize * 0.45, ctx.measureText(sub).width + 20, Math.max(2, subSize * 0.08));
    }
  } else if (sub) {
    const subSize = Math.max(14, h * 0.035);
    ctx.font = `${subSize}px Anton, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.3)}px`; } catch { /* ignore */ }
    ctx.fillStyle = accent;
    const y = bottom ? h - h * 0.07 : h * 0.07 + subSize;
    ctx.fillText(sub, cx, y);
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  }
}

/**
 * Draws the whole cover. `state` holds layout, grade, gradeStrength, caption,
 * subcaption, captionPos and panels: [{ img, zoom, ox, oy }] — one per layout panel.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.filter = 'none';
  ctx.fillStyle = '#120a18';
  ctx.fillRect(0, 0, w, h);
  const rects = layoutPanels(state.layout, w, h);
  for (let i = 0; i < rects.length; i++) {
    const panel = state.panels[i];
    if (!panel || !panel.img) continue;
    const r = rects[i];
    const d = photoDrawRect(panel.img, r, panel.zoom || 1, panel.ox || 0, panel.oy || 0);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.filter = photoFilter(state.grade);
    ctx.drawImage(panel.img, d.x, d.y, d.w, d.h);
    ctx.restore();
  }
  ctx.filter = 'none';
  drawGradeOverlay(ctx, w, h, state.grade, state.gradeStrength ?? 0.7);
  drawCaption(ctx, w, h, state);
}
