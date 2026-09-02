import { useEffect, useRef, useState } from 'react';
import { PRESET_INK } from '@/lib/board-types';

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(v, 16);
  if (Number.isNaN(n)) return { r: 26, g: 26, b: 26 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export default function ColorPicker({
  color,
  onChange,
  recent = [],
}: {
  color: string;
  onChange: (hex: string) => void;
  recent?: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rgb = hexToRgb(color);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const [hue, setHue] = useState(hsv.h);
  const [sat, setSat] = useState(hsv.s);
  const [val, setVal] = useState(hsv.v);
  const [hexDraft, setHexDraft] = useState(color);

  useEffect(() => {
    const next = hexToRgb(color);
    const h = rgbToHsv(next.r, next.g, next.b);
    setHue(h.h);
    setSat(h.s);
    setVal(h.v);
    setHexDraft(color);
  }, [color]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const w = c.width;
    const hgt = c.height;
    const img = ctx.createImageData(w, hgt);
    for (let y = 0; y < hgt; y++) {
      for (let x = 0; x < w; x++) {
        const s = x / (w - 1);
        const v = 1 - y / (hgt - 1);
        const { r, g, b } = hsvToRgb(hue, s, v);
        const i = (y * w + x) * 4;
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [hue]);

  const emitHsv = (h: number, s: number, v: number) => {
    const { r, g, b } = hsvToRgb(h, s, v);
    onChange(rgbToHex(r, g, b));
  };

  const pickSv = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const s = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (e.clientY - rect.top) / rect.height, 0, 1);
    setSat(s);
    setVal(v);
    emitHsv(hue, s, v);
  };

  const setRgb = (key: 'r' | 'g' | 'b', n: number) => {
    const next = { ...rgb, [key]: clamp(n, 0, 255) };
    onChange(rgbToHex(next.r, next.g, next.b));
  };

  return (
    <div className="w-64 p-3 space-y-3">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={240}
          height={140}
          className="w-full h-36 rounded-lg cursor-crosshair border border-zinc-200/80"
          onPointerDown={(e) => {
            (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            pickSv(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons) pickSv(e);
          }}
        />
        <div
          className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{
            left: `${sat * 100}%`,
            top: `${(1 - val) * 100}%`,
            background: color,
          }}
        />
      </div>

      <label className="block">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Hue</span>
        <input
          type="range"
          min={0}
          max={360}
          value={hue}
          onChange={(e) => {
            const h = Number(e.target.value);
            setHue(h);
            emitHsv(h, sat, val);
          }}
          className="hue-range mt-1 w-full"
        />
      </label>

      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5">RGB graph</p>
        {(['r', 'g', 'b'] as const).map((key) => (
          <div key={key} className="flex items-center gap-2 mb-1">
            <span className="w-3 text-[10px] font-semibold uppercase text-zinc-500">{key}</span>
            <div className="relative h-2.5 flex-1 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(rgb[key] / 255) * 100}%`,
                  background: key === 'r' ? '#dc2626' : key === 'g' ? '#16a34a' : '#2563eb',
                }}
              />
            </div>
            <input
              type="number"
              min={0}
              max={255}
              value={rgb[key]}
              onChange={(e) => setRgb(key, Number(e.target.value))}
              className="w-12 rounded-md border border-zinc-200 bg-white px-1 py-0.5 text-xs tabular-nums"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md border border-zinc-200" style={{ background: color }} />
        <input
          value={hexDraft}
          onChange={(e) => {
            setHexDraft(e.target.value);
            if (/^#?[0-9a-fA-F]{6}$/.test(e.target.value) || /^#?[0-9a-fA-F]{3}$/.test(e.target.value)) {
              const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
              onChange(v);
            }
          }}
          className="flex-1 rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-xs"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESET_INK.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={`h-6 w-6 rounded-full border ${color === c ? 'ring-2 ring-zinc-900 ring-offset-1' : 'border-zinc-200'}`}
            style={{ background: c }}
            title={c}
          />
        ))}
      </div>
      {recent.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 mb-1">Recent</p>
          <div className="flex flex-wrap gap-1.5">
            {recent.slice(0, 10).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className="h-5 w-5 rounded-full border border-zinc-200"
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
