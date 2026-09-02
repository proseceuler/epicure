import type { Board, BoardObject, BackgroundId } from './board-types';
import { CHART_COLORS } from './board-types';

export const BOARDS_KEY = 'epicure:boards';
export const BOARDS_CHANGED = 'epicure-boards-changed';

function canStore() {
  return typeof window !== 'undefined';
}

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export function emptyBoard(name = 'Untitled board'): Board {
  return {
    id: uid(),
    name,
    background: 'dots',
    paper: '#faf8f5',
    objects: [],
    camera: { x: 0, y: 0, zoom: 1 },
    updatedAt: nowIso(),
  };
}

function seedBoards(): Board[] {
  const study: Board = {
    id: 'board-study',
    name: 'Study sketch',
    background: 'dots',
    paper: '#faf8f5',
    camera: { x: 280, y: 180, zoom: 1 },
    updatedAt: nowIso(),
    objects: [
      {
        id: 't1',
        type: 'text',
        x: -40,
        y: -220,
        w: 420,
        h: 70,
        content: 'Study sketch',
        fontSize: 36,
        color: '#1a1a1a',
        font: 'serif',
        align: 'left',
      },
      {
        id: 'st1',
        type: 'sticky',
        x: -40,
        y: -120,
        w: 220,
        h: 180,
        paper: '#fef3c7',
        content: 'Scratch anything here — ink, stickies, charts.\n\nEraser removes ink; it does not paint white.',
      },
      {
        id: 'st2',
        type: 'sticky',
        x: 210,
        y: -120,
        w: 220,
        h: 180,
        paper: '#dbeafe',
        content: 'Link a vault note with the note-card tool.\n\nOpen Cell structure from the card on the right.',
      },
      {
        id: 'ch1',
        type: 'chart',
        kind: 'pie',
        x: -40,
        y: 90,
        w: 280,
        h: 240,
        title: 'Lesson split',
        data: [
          { label: 'Explain', value: 25, color: CHART_COLORS[0] },
          { label: 'Practice', value: 45, color: CHART_COLORS[2] },
          { label: 'Review', value: 20, color: CHART_COLORS[3] },
          { label: 'Break', value: 10, color: CHART_COLORS[5] },
        ],
      },
      {
        id: 'tb1',
        type: 'table',
        x: 280,
        y: 90,
        w: 360,
        h: 200,
        cols: 3,
        rows: 4,
        header: true,
        cells: [
          ['a', 'b', 'c'],
          ['1', '-5', '6'],
          ['1', '2', '-8'],
          ['2', '0', '-18'],
        ],
      },
      {
        id: 'nc1',
        type: 'note',
        x: 470,
        y: -120,
        w: 240,
        h: 150,
        noteId: 'note-cells',
      },
      {
        id: 'sh1',
        type: 'shape',
        kind: 'rounded',
        x: 280,
        y: 310,
        w: 200,
        h: 70,
        stroke: '#1a1a1a',
        fill: 'rgba(26,26,26,0.04)',
        strokeWidth: 2,
      },
      {
        id: 'ar1',
        type: 'arrow',
        x1: 240,
        y1: 210,
        x2: 280,
        y2: 190,
        color: '#1a1a1a',
        width: 2,
        head: 'end',
      },
    ],
  };
  const scratch = emptyBoard('Scratch');
  scratch.id = 'board-scratch';
  scratch.background = 'lined';
  scratch.paper = '#fffdf7';
  return [study, scratch];
}

export function loadBoards(): Board[] {
  if (!canStore()) return seedBoards();
  try {
    const raw = window.localStorage.getItem(BOARDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Board[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  const seeded = seedBoards();
  persistBoards(seeded);
  return seeded;
}

export function persistBoards(boards: Board[]) {
  if (!canStore()) return;
  window.localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
  window.dispatchEvent(new CustomEvent(BOARDS_CHANGED));
}

export function findBoardByName(boards: Board[], name: string) {
  const q = name.trim().toLowerCase();
  return boards.find((b) => b.name.toLowerCase() === q);
}
