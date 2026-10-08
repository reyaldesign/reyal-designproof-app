// Card Spotlight, after Aceternity UI (ui.aceternity.com/components/card-spotlight), without React or three.js.
// Hovering a [data-spotlight] element reveals a #262626 layer through a 350px radial mask that follows the pointer,
// and inside it a dot matrix (CanvasRevealEffect) that turns on from the center and flickers. Pointer devices only.
(() => {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const COLORS = [[162, 14, 38], [255, 77, 99]]; // Reyal crimson and a lighter red (the demo uses blue and violet)
  const OPACITIES = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1];
  const TOTAL = 6, DOT = 3, RADIUS = 350, SPEED = 5, FLICKER = 5; // px per cell, px per dot, mask radius, reveal speed, flicker seconds
  const hash = (x, y, s) => {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 982451653)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  function attach(el) {
    const layer = document.createElement('div');
    layer.className = 'spot-layer';
    layer.setAttribute('aria-hidden', 'true');
    const canvas = document.createElement('canvas');
    layer.append(canvas);
    el.prepend(layer);
    const ctx = canvas.getContext('2d');
    let raf = 0, start = 0, mx = 0, my = 0, w = 0, h = 0;

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = el.clientWidth; h = el.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const frame = (now) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      const cols = Math.ceil(w / TOTAL), rows = Math.ceil(h / TOTAL);
      const cx = cols / 2, cy = rows / 2;
      // Only cells inside the visible circle are drawn.
      const x0 = Math.max(0, Math.floor((mx - RADIUS) / TOTAL)), x1 = Math.min(cols, Math.ceil((mx + RADIUS) / TOTAL));
      const y0 = Math.max(0, Math.floor((my - RADIUS) / TOTAL)), y1 = Math.min(rows, Math.ceil((my + RADIUS) / TOTAL));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const seed = hash(x, y, 7);
          const intro = Math.hypot(x - cx, y - cy) * 0.01 + seed * 0.15; // reveal from the center outward
          if (t * SPEED * 0.1 < intro) continue;
          const tick = Math.floor(t / FLICKER + seed + FLICKER);
          const a = OPACITIES[Math.floor(hash(x, y, tick) * 10)];
          const [r, g, b] = COLORS[hash(x, y, 3) < 0.5 ? 0 : 1];
          ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
          ctx.fillRect(x * TOTAL, y * TOTAL, DOT, DOT);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    const move = (e) => {
      const r = el.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
      el.style.setProperty('--mx', `${mx}px`);
      el.style.setProperty('--my', `${my}px`);
    };
    el.addEventListener('pointerenter', (e) => {
      move(e); size();
      start = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
      el.classList.add('is-lit');
    });
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-lit');
      setTimeout(() => { if (!el.classList.contains('is-lit')) { cancelAnimationFrame(raf); ctx.clearRect(0, 0, w, h); } }, 320);
    });
  }

  const startAll = () => document.querySelectorAll('[data-spotlight]').forEach(attach);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startAll); else startAll();
})();
