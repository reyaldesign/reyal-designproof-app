'use client';

import { useEffect, useRef } from 'react';

const W = 480, H = 300; // canvas pixels (shown at half size so the crop stays sharp)

/** Crops the pinned area out of the full-resolution page and marks the exact spot. */
export default function PinCrop({ src, x, y, pin }: { src: string; x: number; y: number; pin: number | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const c = ref.current?.getContext('2d');
      if (!c) return;
      const { naturalWidth: nw, naturalHeight: nh } = img;
      let w = Math.min(nw, Math.max(nw * 0.3, 500));
      let h = (w * H) / W;
      if (h > nh) { h = nh; w = (h * W) / H; }
      const px = (x / 100) * nw, py = (y / 100) * nh;
      const sx = Math.min(Math.max(px - w / 2, 0), nw - w);
      const sy = Math.min(Math.max(py - h / 2, 0), nh - h);
      c.drawImage(img, sx, sy, w, h, 0, 0, W, H);
      const cx = ((px - sx) / w) * W, cy = ((py - sy) / h) * H;
      c.lineWidth = 3;
      c.strokeStyle = '#fff';
      c.fillStyle = '#f43f5e';
      c.beginPath(); c.arc(cx, cy, 16, 0, Math.PI * 2); c.fill(); c.stroke();
      if (pin != null) {
        c.fillStyle = '#fff'; c.font = 'bold 16px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(pin), cx, cy + 1);
      }
    };
    img.src = src;
  }, [src, x, y, pin]);
  return <canvas ref={ref} width={W} height={H} className="h-[150px] w-[240px] max-w-full rounded-lg border border-zinc-700 bg-zinc-900" aria-label="Zoomed view of where the comment was placed" />;
}
