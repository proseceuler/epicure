import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Circle,
  Diamond,
  Eraser,
  Hand,
  Highlighter,
  Link2,
  Minus,
  MousePointer2,
  Pen,
  Pencil,
  Plus,
  Redo2,
  Square,
  StickyNote,
  Table2,
  Trash2,
  Type,
  Undo2,
  LayoutGrid,
  FileText,
  PieChart,
  Spline,
  Triangle,
} from 'lucide-react';
import ColorPicker from './ColorPicker';
import {
  BACKGROUNDS,
  CHART_COLORS,
  PAPER_PRESETS,
  STICKY_PAPERS,
  type ArrowObject,
  type BackgroundId,
  type Board,
  type BoardObject,
  type Camera,
  type ChartKind,
  type ChartObject,
  type NoteCardObject,
  type PenKind,
  type Point,
  type ShapeKind,
  type ShapeObject,
  type StickyObject,
  type StrokeObject,
  type TableObject,
  type TextObject,
  type ToolKind,
} from '@/lib/board-types';
import { emptyBoard, findBoardByName, loadBoards, persistBoards } from '@/lib/board-store';
import type { Note } from '@/lib/types';

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `o_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function toScreen(wx: number, wy: number, cam: Camera, vw: number, vh: number) {
  return { x: (wx - cam.x) * cam.zoom + vw / 2, y: (wy - cam.y) * cam.zoom + vh / 2 };
}
function toWorld(sx: number, sy: number, cam: Camera, vw: number, vh: number) {
  return { x: (sx - vw / 2) / cam.zoom + cam.x, y: (sy - vh / 2) / cam.zoom + cam.y };
}

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function boxOf(o: BoardObject): { x: number; y: number; w: number; h: number } | null {
  if (o.type === 'stroke') {
    if (!o.points.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of o.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const pad = o.width + 4;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }
  if (o.type === 'arrow') {
    const x = Math.min(o.x1, o.x2);
    const y = Math.min(o.y1, o.y2);
    return { x, y, w: Math.abs(o.x2 - o.x1) || 8, h: Math.abs(o.y2 - o.y1) || 8 };
  }
  return { x: o.x, y: o.y, w: o.w, h: o.h };
}

function hitTest(wx: number, wy: number, objects: BoardObject[]): BoardObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.type === 'stroke') {
      for (const p of o.points) {
        if (Math.hypot(p.x - wx, p.y - wy) < o.width + 6) return o;
      }
      continue;
    }
    if (o.type === 'arrow') {
      if (distToSeg(wx, wy, o.x1, o.y1, o.x2, o.y2) < 10) return o;
      continue;
    }
    if (wx >= o.x && wx <= o.x + o.w && wy >= o.y && wy <= o.y + o.h) return o;
  }
  return null;
}

function eraseStrokes(objects: BoardObject[], wx: number, wy: number, radius: number): BoardObject[] {
  const next: BoardObject[] = [];
  for (const o of objects) {
    if (o.type !== 'stroke') {
      const box = boxOf(o);
      if (box && wx >= box.x && wx <= box.x + box.w && wy >= box.y && wy <= box.y + box.h) {
        const cx = box.x + box.w / 2;
        const cy = box.y + box.h / 2;
        if (Math.hypot(wx - cx, wy - cy) < radius * 1.2) continue;
      }
      next.push(o);
      continue;
    }
    const segs: Point[][] = [];
    let cur: Point[] = [];
    for (const p of o.points) {
      if (Math.hypot(p.x - wx, p.y - wy) < radius + o.width / 2) {
        if (cur.length > 1) segs.push(cur);
        cur = [];
      } else cur.push(p);
    }
    if (cur.length > 1) segs.push(cur);
    for (const seg of segs) next.push({ ...o, id: uid(), points: seg });
  }
  return next;
}

function paperInk(paper: string) {
  const dark = paper === '#1a2744' || paper === '#1c1917';
  return dark ? 'rgba(255,255,255,0.22)' : 'rgba(24,24,27,0.16)';
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  vw: number,
  vh: number,
  cam: Camera,
  bg: BackgroundId,
  paper: string,
) {
  if (bg === 'blueprint') ctx.fillStyle = '#1a2744';
  else if (bg === 'kraft') ctx.fillStyle = '#c4a574';
  else if (bg === 'dark-dots') ctx.fillStyle = '#1c1917';
  else ctx.fillStyle = paper;
  ctx.fillRect(0, 0, vw, vh);

  const ink = bg === 'blueprint' ? 'rgba(147,197,253,0.35)' : bg === 'kraft' ? 'rgba(80,50,20,0.22)' : paperInk(paper);
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;

  const origin = toScreen(0, 0, cam, vw, vh);

  const grid = (step: number, fine = false) => {
    const s = step * cam.zoom;
    if (s < 6) return;
    ctx.lineWidth = fine ? 0.5 : 1;
    const ox = origin.x % s;
    const oy = origin.y % s;
    ctx.beginPath();
    for (let x = ox; x < vw; x += s) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, vh);
    }
    for (let y = oy; y < vh; y += s) {
      ctx.moveTo(0, y);
      ctx.lineTo(vw, y);
    }
    ctx.stroke();
  };

  const dots = (step: number, r = 1.1) => {
    const s = step * cam.zoom;
    if (s < 8) return;
    const ox = origin.x % s;
    const oy = origin.y % s;
    for (let x = ox; x < vw; x += s) {
      for (let y = oy; y < vh; y += s) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };

  const lines = (step: number) => {
    const s = step * cam.zoom;
    if (s < 6) return;
    const oy = origin.y % s;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = oy; y < vh; y += s) {
      ctx.moveTo(0, y);
      ctx.lineTo(vw, y);
    }
    ctx.stroke();
  };

  switch (bg) {
    case 'plain':
      break;
    case 'dots':
      dots(22);
      break;
    case 'dots-large':
      dots(36, 1.6);
      break;
    case 'grid':
      grid(32);
      break;
    case 'grid-fine':
      grid(16, true);
      grid(80);
      break;
    case 'lined':
      lines(28);
      break;
    case 'lined-wide':
      lines(40);
      break;
    case 'graph':
      grid(20, true);
      ctx.strokeStyle = bg === 'graph' ? (paperInk(paper).replace('0.16', '0.28') as string) : ink;
      grid(100);
      break;
    case 'isometric': {
      const s = 28 * cam.zoom;
      if (s >= 8) {
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        const ox = origin.x % (s * 2);
        for (let x = ox - vw; x < vw * 2; x += s) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x + vh / Math.tan(Math.PI / 3), vh);
          ctx.moveTo(x, 0);
          ctx.lineTo(x - vh / Math.tan(Math.PI / 3), vh);
        }
        ctx.stroke();
      }
      break;
    }
    case 'cornell': {
      lines(28);
      const margin = toScreen(-220, 0, cam, vw, vh).x;
      ctx.strokeStyle = 'rgba(185,28,28,0.45)';
      ctx.beginPath();
      ctx.moveTo(margin, 0);
      ctx.lineTo(margin, vh);
      ctx.stroke();
      break;
    }
    case 'blueprint':
      grid(24, true);
      grid(96);
      break;
    case 'kraft':
      dots(26);
      break;
    case 'dark-dots':
      dots(22);
      break;
  }
  ctx.restore();
}

function strokeStyle(ctx: CanvasRenderingContext2D, s: StrokeObject, zoom: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color;
  switch (s.pen) {
    case 'pencil':
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = s.width * 0.85 * zoom;
      ctx.globalCompositeOperation = 'source-over';
      break;
    case 'marker':
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = s.width * 2.1 * zoom;
      ctx.globalCompositeOperation = 'source-over';
      break;
    case 'highlighter':
      ctx.globalAlpha = 0.32;
      ctx.lineWidth = s.width * 4.2 * zoom;
      ctx.globalCompositeOperation = 'multiply';
      break;
    case 'calligraphy':
      ctx.globalAlpha = 1;
      ctx.lineWidth = s.width * zoom;
      ctx.globalCompositeOperation = 'source-over';
      break;
    default:
      ctx.globalAlpha = 1;
      ctx.lineWidth = s.width * zoom;
      ctx.globalCompositeOperation = 'source-over';
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, s: StrokeObject, cam: Camera, vw: number, vh: number) {
  if (s.points.length < 2) return;
  ctx.save();
  strokeStyle(ctx, s, cam.zoom);
  ctx.beginPath();
  const p0 = toScreen(s.points[0].x, s.points[0].y, cam, vw, vh);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < s.points.length; i++) {
    const p = toScreen(s.points[i].x, s.points[i].y, cam, vw, vh);
    if (s.pen === 'calligraphy') {
      const prev = s.points[i - 1];
      const ang = Math.atan2(s.points[i].y - prev.y, s.points[i].x - prev.x);
      ctx.lineWidth = s.width * cam.zoom * (0.45 + Math.abs(Math.sin(ang + Math.PI / 4)) * 1.5);
    }
    ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawShapePath(ctx: CanvasRenderingContext2D, o: ShapeObject, cam: Camera, vw: number, vh: number) {
  const a = toScreen(o.x, o.y, cam, vw, vh);
  const w = o.w * cam.zoom;
  const h = o.h * cam.zoom;
  ctx.beginPath();
  if (o.kind === 'ellipse') {
    ctx.ellipse(a.x + w / 2, a.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
  } else if (o.kind === 'triangle') {
    ctx.moveTo(a.x + w / 2, a.y);
    ctx.lineTo(a.x + w, a.y + h);
    ctx.lineTo(a.x, a.y + h);
    ctx.closePath();
  } else if (o.kind === 'diamond') {
    ctx.moveTo(a.x + w / 2, a.y);
    ctx.lineTo(a.x + w, a.y + h / 2);
    ctx.lineTo(a.x + w / 2, a.y + h);
    ctx.lineTo(a.x, a.y + h / 2);
    ctx.closePath();
  } else if (o.kind === 'rounded') {
    const r = Math.min(14 * cam.zoom, Math.abs(w) / 4, Math.abs(h) / 4);
    ctx.roundRect(a.x, a.y, w, h, r);
  } else {
    ctx.rect(a.x, a.y, w, h);
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, o: ArrowObject, cam: Camera, vw: number, vh: number) {
  const a = toScreen(o.x1, o.y1, cam, vw, vh);
  const b = toScreen(o.x2, o.y2, cam, vw, vh);
  ctx.save();
  ctx.strokeStyle = o.color;
  ctx.fillStyle = o.color;
  ctx.lineWidth = o.width * cam.zoom;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const head = 12 * cam.zoom;
  const tip = (x: number, y: number, dir: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - head * Math.cos(dir - 0.4), y - head * Math.sin(dir - 0.4));
    ctx.lineTo(x - head * Math.cos(dir + 0.4), y - head * Math.sin(dir + 0.4));
    ctx.closePath();
    ctx.fill();
  };
  if (o.head === 'end' || o.head === 'both') tip(b.x, b.y, ang);
  if (o.head === 'both') tip(a.x, a.y, ang + Math.PI);
  ctx.restore();
}

const PENS: { id: PenKind; label: string; icon: typeof Pen }[] = [
  { id: 'pen', label: 'Pen', icon: Pen },
  { id: 'pencil', label: 'Pencil', icon: Pencil },
  { id: 'marker', label: 'Marker', icon: Pen },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { id: 'calligraphy', label: 'Calligraphy', icon: Spline },
];

const SHAPES: { id: ShapeKind; icon: typeof Square }[] = [
  { id: 'rect', icon: Square },
  { id: 'rounded', icon: Square },
  { id: 'ellipse', icon: Circle },
  { id: 'triangle', icon: Triangle },
  { id: 'diamond', icon: Diamond },
];

type History = BoardObject[][];

export default function Whiteboard({
  notes,
  onOpenNote,
  openBoardName,
}: {
  notes: Note[];
  onOpenNote: (note: Note) => void;
  onCreateNote: (title: string) => Promise<Note | null>;
  openBoardName?: string | null;
}) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [tool, setTool] = useState<ToolKind>('pen');
  const [pen, setPen] = useState<PenKind>('pen');
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rounded');
  const [chartKind, setChartKind] = useState<ChartKind>('pie');
  const [color, setColor] = useState('#1a1a1a');
  const [width, setWidth] = useState(3);
  const [eraserR, setEraserR] = useState(18);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [notePick, setNotePick] = useState(false);
  const [saved, setSaved] = useState(true);
  const [recent, setRecent] = useState<string[]>([]);
  const [spaceDown, setSpaceDown] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const panning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const currentPts = useRef<Point[]>([]);
  const draft = useRef<BoardObject | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const history = useRef<History>([]);
  const future = useRef<History>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sizeRef = useRef({ w: 1, h: 1 });

  const board = boards.find((b) => b.id === activeId) ?? boards[0];

  useEffect(() => {
    const loaded = loadBoards();
    setBoards(loaded);
    const wanted = openBoardName ? findBoardByName(loaded, openBoardName) : null;
    setActiveId(wanted?.id ?? loaded[0]?.id ?? '');
  }, []);

  useEffect(() => {
    if (!openBoardName || !boards.length) return;
    const wanted = findBoardByName(boards, openBoardName);
    if (wanted) setActiveId(wanted.id);
  }, [openBoardName, boards]);

  const persistSoon = useCallback((next: Board[]) => {
    setSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      persistBoards(next);
      setSaved(true);
    }, 500);
  }, []);

  const updateActive = useCallback(
    (patch: Partial<Board> | ((b: Board) => Board), pushHist = false) => {
      setBoards((prev) => {
        const next = prev.map((b) => {
          if (b.id !== (board?.id ?? activeId)) return b;
          const updated = typeof patch === 'function' ? patch(b) : { ...b, ...patch, updatedAt: new Date().toISOString() };
          if (pushHist) {
            history.current = [...history.current.slice(-40), b.objects];
            future.current = [];
          }
          return updated;
        });
        persistSoon(next);
        return next;
      });
    },
    [board?.id, activeId, persistSoon],
  );

  const setObjects = (objects: BoardObject[], pushHist = true) => updateActive({ objects }, pushHist);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !board) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = wrap.clientWidth;
    const vh = wrap.clientHeight;
    sizeRef.current = { w: vw, h: vh };
    if (canvas.width !== Math.floor(vw * dpr) || canvas.height !== Math.floor(vh * dpr)) {
      canvas.width = Math.floor(vw * dpr);
      canvas.height = Math.floor(vh * dpr);
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(ctx, vw, vh, board.camera, board.background, board.paper);
    for (const o of board.objects) {
      if (o.type === 'stroke') drawStroke(ctx, o, board.camera, vw, vh);
      else if (o.type === 'shape') {
        ctx.save();
        drawShapePath(ctx, o, board.camera, vw, vh);
        ctx.fillStyle = o.fill;
        ctx.strokeStyle = o.stroke;
        ctx.lineWidth = o.strokeWidth * board.camera.zoom;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (o.type === 'arrow') drawArrow(ctx, o, board.camera, vw, vh);
    }
    if (draft.current) {
      const d = draft.current;
      if (d.type === 'stroke') drawStroke(ctx, d, board.camera, vw, vh);
      if (d.type === 'shape') {
        ctx.save();
        ctx.setLineDash([6, 4]);
        drawShapePath(ctx, d, board.camera, vw, vh);
        ctx.strokeStyle = d.stroke;
        ctx.stroke();
        ctx.restore();
      }
      if (d.type === 'arrow') drawArrow(ctx, d, board.camera, vw, vh);
    }
    const live = currentPts.current;
    if (live.length > 1) {
      drawStroke(
        ctx,
        { id: 'live', type: 'stroke', points: live, color, width, pen },
        board.camera,
        vw,
        vh,
      );
    }
    if (selectedId) {
      const o = board.objects.find((x) => x.id === selectedId);
      const box = o ? boxOf(o) : null;
      if (box) {
        const a = toScreen(box.x, box.y, board.camera, vw, vh);
        ctx.save();
        ctx.strokeStyle = '#2563eb';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1;
        ctx.strokeRect(a.x, a.y, box.w * board.camera.zoom, box.h * board.camera.zoom);
        ctx.restore();
      }
    }
  }, [board, color, width, pen, selectedId]);

  useEffect(() => {
    render();
  }, [render, boards, draft]);

  useEffect(() => {
    const onResize = () => render();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [render]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!board) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const before = toWorld(e.clientX - r.left, e.clientY - r.top, board.camera, r.width, r.height);
      const zoom = Math.max(0.25, Math.min(4, board.camera.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
      const cam = { ...board.camera, zoom };
      const after = toWorld(e.clientX - r.left, e.clientY - r.top, cam, r.width, r.height);
      cam.x += before.x - after.x;
      cam.y += before.y - after.y;
      updateActive({ camera: cam }, false);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [board, updateActive]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(true);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        if (selectedId && board) {
          setObjects(board.objects.filter((o) => o.id !== selectedId));
          setSelectedId(null);
        }
      }
      if (e.key === 'v') setTool('select');
      if (e.key === 'h') setTool('hand');
      if (e.key === 'p') setTool('pen');
      if (e.key === 'e') setTool('eraser');
      if (e.key === 't') setTool('text');
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const worldFromEvent = (e: { clientX: number; clientY: number }) => {
    const wrap = wrapRef.current;
    if (!wrap || !board) return { x: 0, y: 0 };
    const r = wrap.getBoundingClientRect();
    return toWorld(e.clientX - r.left, e.clientY - r.top, board.camera, r.width, r.height);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!board) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const wpt = worldFromEvent(e);
    const isPan = tool === 'hand' || spaceDown || e.button === 1;
    if (isPan) {
      panning.current = true;
      lastPan.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (tool === 'eraser') {
      drawing.current = true;
      setObjects(eraseStrokes(board.objects, wpt.x, wpt.y, eraserR));
      return;
    }
    if (tool === 'pen') {
      drawing.current = true;
      currentPts.current = [wpt];
      rememberColor(color);
      return;
    }
    if (tool === 'select') {
      const hit = hitTest(wpt.x, wpt.y, board.objects);
      setSelectedId(hit?.id ?? null);
      if (hit && hit.type !== 'stroke' && hit.type !== 'arrow') {
        drag.current = { id: hit.id, dx: wpt.x - (hit as { x: number }).x, dy: wpt.y - (hit as { y: number }).y };
      } else if (hit && hit.type === 'arrow') {
        drag.current = { id: hit.id, dx: wpt.x, dy: wpt.y };
      }
      return;
    }
    if (tool === 'text') {
      const obj: TextObject = {
        id: uid(),
        type: 'text',
        x: wpt.x,
        y: wpt.y,
        w: 260,
        h: 80,
        content: 'Type here',
        fontSize: 22,
        color,
        font: 'sans',
        align: 'left',
      };
      setObjects([...board.objects, obj]);
      setSelectedId(obj.id);
      setTool('select');
      return;
    }
    if (tool === 'sticky') {
      const obj: StickyObject = {
        id: uid(),
        type: 'sticky',
        x: wpt.x,
        y: wpt.y,
        w: 200,
        h: 200,
        content: '',
        paper: STICKY_PAPERS[Math.floor(Math.random() * STICKY_PAPERS.length)],
      };
      setObjects([...board.objects, obj]);
      setSelectedId(obj.id);
      setTool('select');
      return;
    }
    if (tool === 'shape') {
      drawing.current = true;
      draft.current = {
        id: uid(),
        type: 'shape',
        kind: shapeKind,
        x: wpt.x,
        y: wpt.y,
        w: 1,
        h: 1,
        stroke: color,
        fill: 'transparent',
        strokeWidth: Math.max(2, width),
      };
      return;
    }
    if (tool === 'arrow') {
      drawing.current = true;
      draft.current = {
        id: uid(),
        type: 'arrow',
        x1: wpt.x,
        y1: wpt.y,
        x2: wpt.x,
        y2: wpt.y,
        color,
        width: Math.max(2, width),
        head: 'end',
      };
      return;
    }
    if (tool === 'table') {
      const obj: TableObject = {
        id: uid(),
        type: 'table',
        x: wpt.x,
        y: wpt.y,
        w: 320,
        h: 180,
        cols: 3,
        rows: 3,
        header: true,
        cells: Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => '')),
      };
      setObjects([...board.objects, obj]);
      setSelectedId(obj.id);
      setTool('select');
      return;
    }
    if (tool === 'chart') {
      const obj: ChartObject = {
        id: uid(),
        type: 'chart',
        kind: chartKind,
        x: wpt.x,
        y: wpt.y,
        w: 280,
        h: 240,
        title: 'Chart',
        data: [
          { label: 'A', value: 40, color: CHART_COLORS[0] },
          { label: 'B', value: 30, color: CHART_COLORS[2] },
          { label: 'C', value: 30, color: CHART_COLORS[3] },
        ],
      };
      setObjects([...board.objects, obj]);
      setSelectedId(obj.id);
      setTool('select');
      return;
    }
    if (tool === 'note') {
      setNotePick(true);
      (window as unknown as { __noteDrop?: Point }).__noteDrop = wpt;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!board) return;
    if (panning.current) {
      const dx = (e.clientX - lastPan.current.x) / board.camera.zoom;
      const dy = (e.clientY - lastPan.current.y) / board.camera.zoom;
      lastPan.current = { x: e.clientX, y: e.clientY };
      updateActive({ camera: { ...board.camera, x: board.camera.x - dx, y: board.camera.y - dy } }, false);
      return;
    }
    const wpt = worldFromEvent(e);
    if (tool === 'eraser' && drawing.current) {
      setObjects(eraseStrokes(board.objects, wpt.x, wpt.y, eraserR), false);
      return;
    }
    if (tool === 'pen' && drawing.current) {
      currentPts.current = [...currentPts.current, wpt];
      render();
      return;
    }
    if (draft.current && drawing.current) {
      const d = draft.current;
      if (d.type === 'shape') {
        d.w = wpt.x - d.x;
        d.h = wpt.y - d.y;
      } else if (d.type === 'arrow') {
        d.x2 = wpt.x;
        d.y2 = wpt.y;
      }
      render();
      return;
    }
    if (drag.current && tool === 'select') {
      const { id, dx, dy } = drag.current;
      setObjects(
        board.objects.map((o) => {
          if (o.id !== id) return o;
          if (o.type === 'arrow') {
            const mx = wpt.x - dx;
            const my = wpt.y - dy;
            return { ...o, x1: o.x1 + mx, y1: o.y1 + my, x2: o.x2 + mx, y2: o.y2 + my };
          }
          if ('x' in o) return { ...o, x: wpt.x - dx, y: wpt.y - dy };
          return o;
        }),
        false,
      );
      drag.current = { id, dx, dy };
    }
  };

  const onPointerUp = () => {
    panning.current = false;
    drag.current = null;
    if (tool === 'pen' && currentPts.current.length > 1 && board) {
      const stroke: StrokeObject = {
        id: uid(),
        type: 'stroke',
        points: currentPts.current,
        color,
        width,
        pen,
      };
      setObjects([...board.objects, stroke]);
    }
    if (draft.current && board) {
      const d = draft.current;
      if (d.type === 'shape') {
        const x = Math.min(d.x, d.x + d.w);
        const y = Math.min(d.y, d.y + d.h);
        const w = Math.abs(d.w);
        const h = Math.abs(d.h);
        if (w > 4 && h > 4) setObjects([...board.objects, { ...d, x, y, w, h }]);
      } else if (d.type === 'arrow') {
        setObjects([...board.objects, d]);
      }
    }
    draft.current = null;
    currentPts.current = [];
    drawing.current = false;
    render();
  };

  function undo() {
    const prev = history.current.pop();
    if (!prev || !board) return;
    future.current.push(board.objects);
    updateActive({ objects: prev }, false);
  }
  function redo() {
    const nxt = future.current.pop();
    if (!nxt || !board) return;
    history.current.push(board.objects);
    updateActive({ objects: nxt }, false);
  }

  function rememberColor(c: string) {
    setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 10));
  }

  function addBoard() {
    const b = emptyBoard(`Board ${boards.length + 1}`);
    const next = [...boards, b];
    setBoards(next);
    setActiveId(b.id);
    persistBoards(next);
  }

  function renameBoard(name: string) {
    updateActive({ name });
  }

  function dropNote(note: Note) {
    if (!board) return;
    const at = (window as unknown as { __noteDrop?: Point }).__noteDrop ?? {
      x: board.camera.x,
      y: board.camera.y,
    };
    const obj: NoteCardObject = { id: uid(), type: 'note', x: at.x, y: at.y, w: 240, h: 140, noteId: note.id };
    setObjects([...board.objects, obj]);
    setNotePick(false);
    setTool('select');
  }

  const selected = board?.objects.find((o) => o.id === selectedId) ?? null;
  const overlayObjects = board?.objects.filter((o) => o.type !== 'stroke' && o.type !== 'shape' && o.type !== 'arrow') ?? [];
  const vw = sizeRef.current.w;
  const vh = sizeRef.current.h;

  const cursor =
    tool === 'hand' || spaceDown
      ? 'grab'
      : tool === 'eraser'
        ? 'cell'
        : tool === 'pen'
          ? 'crosshair'
          : 'default';

  if (!board) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-zinc-400">
        <Pen className="h-8 w-8 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[70vh] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl p-1 glass">
          {boards.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setActiveId(b.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                b.id === board.id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {b.name}
            </button>
          ))}
          <button type="button" onClick={addBoard} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100" title="New board">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <input
          value={board.name}
          onChange={(e) => renameBoard(e.target.value)}
          className="glass-input w-40 rounded-xl px-3 py-1.5 text-sm"
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setBgOpen((v) => !v);
              setColorOpen(false);
            }}
            className="glass glass-hover flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-zinc-700"
          >
            <LayoutGrid className="h-4 w-4" />
            {BACKGROUNDS.find((b) => b.id === board.background)?.label}
          </button>
          {bgOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Paper</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {PAPER_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => updateActive({ paper: p })}
                    className="h-6 w-6 rounded-full border border-zinc-200"
                    style={{ background: p }}
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {BACKGROUNDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      updateActive({ background: b.id });
                      setBgOpen(false);
                    }}
                    className={`rounded-lg px-2 py-1.5 text-left text-xs ${
                      board.background === b.id ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <span className="ml-auto text-xs text-zinc-400">{Math.round(board.camera.zoom * 100)}%</span>
        <span className="text-xs text-zinc-400">{saved ? 'Saved' : 'Saving…'}</span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={wrapRef}
          className="glass glass-shadow absolute inset-0 overflow-hidden rounded-2xl"
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <canvas ref={canvasRef} className="absolute inset-0 touch-none" />

          {overlayObjects.map((o) => {
            const pos = toScreen(o.x, o.y, board.camera, vw, vh);
            const style: React.CSSProperties = {
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              width: o.w * board.camera.zoom,
              height: o.h * board.camera.zoom,
              transformOrigin: 'top left',
            };
            const selectedCls = selectedId === o.id ? 'ring-2 ring-blue-500' : '';
            if (o.type === 'text') {
              return (
                <textarea
                  key={o.id}
                  value={o.content}
                  onChange={(e) =>
                    setObjects(board.objects.map((x) => (x.id === o.id ? { ...o, content: e.target.value } : x)), false)
                  }
                  onPointerDown={(e) => e.stopPropagation()}
                  onFocus={() => setSelectedId(o.id)}
                  className={`resize-none bg-transparent p-1 outline-none ${selectedCls}`}
                  style={{
                    ...style,
                    color: o.color,
                    fontSize: o.fontSize * board.camera.zoom,
                    fontFamily:
                      o.font === 'serif' ? '"Source Serif 4", Georgia, serif' : o.font === 'mono' ? 'ui-monospace, monospace' : 'Outfit, sans-serif',
                    textAlign: o.align,
                    lineHeight: 1.3,
                  }}
                />
              );
            }
            if (o.type === 'sticky') {
              return (
                <div
                  key={o.id}
                  style={{ ...style, background: o.paper }}
                  className={`rounded-sm p-3 shadow-md ${selectedCls}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedId(o.id);
                  }}
                >
                  <textarea
                    value={o.content}
                    onChange={(e) =>
                      setObjects(board.objects.map((x) => (x.id === o.id ? { ...o, content: e.target.value } : x)), false)
                    }
                    placeholder="Sticky note…"
                    className="h-full w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
                    style={{ fontSize: 14 * board.camera.zoom }}
                    onPointerDown={(e) => e.stopPropagation()}
                  />
                </div>
              );
            }
            if (o.type === 'table') {
              return (
                <div
                  key={o.id}
                  style={style}
                  className={`overflow-hidden rounded-lg border border-zinc-300 bg-white/90 ${selectedCls}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedId(o.id);
                  }}
                >
                  <table className="h-full w-full border-collapse text-xs">
                    <tbody>
                      {o.cells.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} className={`border border-zinc-200 p-0 ${o.header && ri === 0 ? 'bg-zinc-100 font-semibold' : ''}`}>
                              <input
                                value={cell}
                                onChange={(e) => {
                                  const cells = o.cells.map((r) => [...r]);
                                  cells[ri][ci] = e.target.value;
                                  setObjects(board.objects.map((x) => (x.id === o.id ? { ...o, cells } : x)), false);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className="w-full bg-transparent px-1.5 py-1 outline-none"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }
            if (o.type === 'chart') {
              return (
                <div
                  key={o.id}
                  style={style}
                  className={`rounded-xl border border-zinc-200 bg-white/90 p-2 ${selectedCls}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedId(o.id);
                  }}
                >
                  <ChartSvg chart={o} />
                </div>
              );
            }
            if (o.type === 'note') {
              const note = notes.find((n) => n.id === o.noteId);
              return (
                <button
                  key={o.id}
                  type="button"
                  style={style}
                  className={`flex flex-col items-start rounded-xl border border-zinc-200 bg-white/95 p-3 text-left shadow-sm ${selectedCls}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    setSelectedId(o.id);
                    if (note) onOpenNote(note);
                  }}
                >
                  <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                    <FileText className="h-3 w-3" /> Note
                  </span>
                  <span className="mt-1 font-semibold text-zinc-800 truncate w-full">{note?.title ?? 'Missing note'}</span>
                  <span className="mt-1 line-clamp-3 text-xs text-zinc-500">
                    {(note?.content || '').replace(/[#*`[\]]/g, '').slice(0, 120)}
                  </span>
                  <span className="mt-auto flex items-center gap-1 pt-1 text-[11px] text-zinc-500">
                    Open <ArrowUpRight className="h-3 w-3" />
                  </span>
                </button>
              );
            }
            return null;
          })}
        </div>

        <div className="pointer-events-auto absolute left-3 top-3 z-20 flex flex-col gap-1 rounded-2xl p-1 glass glass-shadow">
          <RailBtn icon={MousePointer2} label="Select (V)" active={tool === 'select'} onClick={() => setTool('select')} />
          <RailBtn icon={Hand} label="Pan (H / space)" active={tool === 'hand'} onClick={() => setTool('hand')} />
          <RailBtn icon={Pen} label="Draw (P)" active={tool === 'pen'} onClick={() => setTool('pen')} />
          <RailBtn icon={Eraser} label="Eraser (E)" active={tool === 'eraser'} onClick={() => setTool('eraser')} />
          <RailBtn icon={Type} label="Text (T)" active={tool === 'text'} onClick={() => setTool('text')} />
          <RailBtn icon={StickyNote} label="Sticky" active={tool === 'sticky'} onClick={() => setTool('sticky')} />
          <RailBtn icon={Square} label="Shape" active={tool === 'shape'} onClick={() => setTool('shape')} />
          <RailBtn icon={Minus} label="Arrow" active={tool === 'arrow'} onClick={() => setTool('arrow')} />
          <RailBtn icon={Table2} label="Table" active={tool === 'table'} onClick={() => setTool('table')} />
          <RailBtn icon={PieChart} label="Chart" active={tool === 'chart'} onClick={() => setTool('chart')} />
          <RailBtn icon={Link2} label="Note card" active={tool === 'note'} onClick={() => setTool('note')} />
          <div className="my-1 h-px bg-zinc-200" />
          <RailBtn icon={Undo2} label="Undo" active={false} onClick={undo} />
          <RailBtn icon={Redo2} label="Redo" active={false} onClick={redo} />
          <RailBtn
            icon={Trash2}
            label="Clear board"
            active={false}
            onClick={() => {
              if (confirm('Clear this board?')) setObjects([]);
            }}
          />
        </div>

        <div className="pointer-events-auto absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl p-1.5 glass glass-shadow">
          {tool === 'pen' &&
            PENS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPen(p.id)}
                className={`rounded-lg px-2 py-1.5 text-xs ${pen === p.id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
              >
                {p.label}
              </button>
            ))}
          {tool === 'shape' &&
            SHAPES.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setShapeKind(s.id)}
                  className={`rounded-lg p-1.5 ${shapeKind === s.id ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          {tool === 'chart' &&
            (['pie', 'donut', 'bar', 'line'] as ChartKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setChartKind(k)}
                className={`rounded-lg px-2 py-1.5 text-xs capitalize ${
                  chartKind === k ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {k}
              </button>
            ))}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setColorOpen((v) => !v);
                setBgOpen(false);
              }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-100"
              title="Colour"
            >
              <span className="h-5 w-5 rounded-full border border-zinc-300" style={{ background: color }} />
              <span className="hidden text-xs text-zinc-600 sm:inline">RGB</span>
            </button>
            {colorOpen && (
              <div className="absolute bottom-full left-0 mb-2 rounded-2xl border border-zinc-200 bg-white shadow-xl">
                <ColorPicker
                  color={color}
                  recent={recent}
                  onChange={(c) => {
                    setColor(c);
                    rememberColor(c);
                  }}
                />
              </div>
            )}
          </div>
          {tool === 'eraser' ? (
            <label className="flex items-center gap-2 px-2 text-xs text-zinc-500">
              Size
              <input type="range" min={8} max={48} value={eraserR} onChange={(e) => setEraserR(Number(e.target.value))} className="w-24" />
            </label>
          ) : (
            <label className="flex items-center gap-2 px-2 text-xs text-zinc-500">
              Width
              <input type="range" min={1} max={16} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-24" />
            </label>
          )}
        </div>

        {selected && selected.type === 'chart' && (
          <ChartInspector
            chart={selected}
            onChange={(c) => setObjects(board.objects.map((x) => (x.id === c.id ? c : x)), false)}
          />
        )}
        {selected && selected.type === 'table' && (
          <TableInspector
            table={selected}
            onChange={(t) => setObjects(board.objects.map((x) => (x.id === t.id ? t : x)), false)}
          />
        )}

        {notePick && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-900/20 p-4" onClick={() => setNotePick(false)}>
            <div className="max-h-[70vh] w-80 overflow-y-auto rounded-2xl bg-white p-3 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <p className="mb-2 text-sm font-semibold">Place a note on the board</p>
              {notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => dropNote(n)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-zinc-100"
                >
                  <FileText className="h-4 w-4 text-zinc-400" />
                  <span className="truncate">{n.title}</span>
                </button>
              ))}
              {notes.length === 0 && <p className="text-xs text-zinc-400">No notes yet.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RailBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Pen;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`rounded-xl p-2 ${active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ChartSvg({ chart }: { chart: ChartObject }) {
  const total = chart.data.reduce((s, d) => s + d.value, 0) || 1;
  const w = 240;
  const h = 180;
  if (chart.kind === 'pie' || chart.kind === 'donut') {
    let a = -Math.PI / 2;
    const cx = 80;
    const cy = 90;
    const r = 62;
    const r0 = chart.kind === 'donut' ? 32 : 0;
    return (
      <div className="flex h-full gap-2">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-2/3">
          <text x="8" y="16" className="fill-zinc-700" fontSize="11" fontWeight="600">
            {chart.title}
          </text>
          {chart.data.map((d, i) => {
            const slice = (d.value / total) * Math.PI * 2;
            const a2 = a + slice;
            const large = slice > Math.PI ? 1 : 0;
            const x1 = cx + r * Math.cos(a);
            const y1 = cy + r * Math.sin(a);
            const x2 = cx + r * Math.cos(a2);
            const y2 = cy + r * Math.sin(a2);
            const path =
              r0 === 0
                ? `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
                : `M ${cx + r0 * Math.cos(a)} ${cy + r0 * Math.sin(a)} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${cx + r0 * Math.cos(a2)} ${cy + r0 * Math.sin(a2)} A ${r0} ${r0} 0 ${large} 0 ${cx + r0 * Math.cos(a)} ${cy + r0 * Math.sin(a)} Z`;
            a = a2;
            return <path key={i} d={path} fill={d.color} />;
          })}
        </svg>
        <ul className="flex flex-col justify-center gap-1 text-[10px]">
          {chart.data.map((d) => (
            <li key={d.label} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
              {d.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  const max = Math.max(...chart.data.map((d) => d.value), 1);
  if (chart.kind === 'bar') {
    const bw = 140 / chart.data.length;
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full">
        <text x="8" y="16" className="fill-zinc-700" fontSize="11" fontWeight="600">
          {chart.title}
        </text>
        {chart.data.map((d, i) => {
          const bh = (d.value / max) * 120;
          return (
            <g key={d.label}>
              <rect x={24 + i * bw} y={160 - bh} width={bw - 8} height={bh} rx={3} fill={d.color} />
              <text x={24 + i * bw + (bw - 8) / 2} y={172} textAnchor="middle" fontSize="9" className="fill-zinc-500">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }
  const pts = chart.data.map((d, i) => {
    const x = 24 + (i / Math.max(chart.data.length - 1, 1)) * 190;
    const y = 160 - (d.value / max) * 120;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full">
      <text x="8" y="16" className="fill-zinc-700" fontSize="11" fontWeight="600">
        {chart.title}
      </text>
      <polyline fill="none" stroke={chart.data[0]?.color || '#2563eb'} strokeWidth="2" points={pts.join(' ')} />
      {chart.data.map((d, i) => {
        const x = 24 + (i / Math.max(chart.data.length - 1, 1)) * 190;
        const y = 160 - (d.value / max) * 120;
        return <circle key={d.label} cx={x} cy={y} r="3" fill={d.color} />;
      })}
    </svg>
  );
}

function ChartInspector({ chart, onChange }: { chart: ChartObject; onChange: (c: ChartObject) => void }) {
  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-20 w-64 rounded-2xl p-3 glass glass-shadow">
      <p className="mb-2 text-xs font-semibold text-zinc-700">Chart</p>
      <input
        value={chart.title}
        onChange={(e) => onChange({ ...chart, title: e.target.value })}
        className="mb-2 w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs"
      />
      <select
        value={chart.kind}
        onChange={(e) => onChange({ ...chart, kind: e.target.value as ChartKind })}
        className="mb-2 w-full rounded-lg border border-zinc-200 px-2 py-1 text-xs"
      >
        <option value="pie">Pie</option>
        <option value="donut">Donut</option>
        <option value="bar">Bar</option>
        <option value="line">Line</option>
      </select>
      {chart.data.map((d, i) => (
        <div key={i} className="mb-1 flex gap-1">
          <input
            value={d.label}
            onChange={(e) => {
              const data = chart.data.map((x, j) => (j === i ? { ...x, label: e.target.value } : x));
              onChange({ ...chart, data });
            }}
            className="w-16 rounded border border-zinc-200 px-1 text-xs"
          />
          <input
            type="number"
            value={d.value}
            onChange={(e) => {
              const data = chart.data.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x));
              onChange({ ...chart, data });
            }}
            className="w-14 rounded border border-zinc-200 px-1 text-xs"
          />
          <input
            type="color"
            value={d.color}
            onChange={(e) => {
              const data = chart.data.map((x, j) => (j === i ? { ...x, color: e.target.value } : x));
              onChange({ ...chart, data });
            }}
            className="h-6 w-8"
          />
        </div>
      ))}
      <button
        type="button"
        className="mt-1 text-xs text-zinc-600"
        onClick={() =>
          onChange({
            ...chart,
            data: [...chart.data, { label: 'New', value: 10, color: CHART_COLORS[chart.data.length % CHART_COLORS.length] }],
          })
        }
      >
        + slice
      </button>
    </div>
  );
}

function TableInspector({ table, onChange }: { table: TableObject; onChange: (t: TableObject) => void }) {
  const resize = (rows: number, cols: number) => {
    const cells = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => table.cells[r]?.[c] ?? ''),
    );
    onChange({ ...table, rows, cols, cells });
  };
  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-20 w-52 rounded-2xl p-3 glass glass-shadow">
      <p className="mb-2 text-xs font-semibold text-zinc-700">Table</p>
      <label className="flex items-center justify-between text-xs text-zinc-600">
        Rows
        <input
          type="number"
          min={1}
          max={12}
          value={table.rows}
          onChange={(e) => resize(Number(e.target.value) || 1, table.cols)}
          className="w-16 rounded border border-zinc-200 px-1"
        />
      </label>
      <label className="mt-1 flex items-center justify-between text-xs text-zinc-600">
        Columns
        <input
          type="number"
          min={1}
          max={8}
          value={table.cols}
          onChange={(e) => resize(table.rows, Number(e.target.value) || 1)}
          className="w-16 rounded border border-zinc-200 px-1"
        />
      </label>
      <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
        <input type="checkbox" checked={table.header} onChange={(e) => onChange({ ...table, header: e.target.checked })} />
        Header row
      </label>
    </div>
  );
}
