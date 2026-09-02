export type PenKind = 'pen' | 'pencil' | 'marker' | 'highlighter' | 'calligraphy';
export type ToolKind =
  | 'select'
  | 'hand'
  | 'pen'
  | 'eraser'
  | 'text'
  | 'sticky'
  | 'shape'
  | 'arrow'
  | 'table'
  | 'chart'
  | 'note';

export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'diamond' | 'rounded';
export type ChartKind = 'pie' | 'donut' | 'bar' | 'line';
export type ArrowHead = 'end' | 'both' | 'none';

export type BackgroundId =
  | 'plain'
  | 'dots'
  | 'dots-large'
  | 'grid'
  | 'grid-fine'
  | 'lined'
  | 'lined-wide'
  | 'graph'
  | 'isometric'
  | 'cornell'
  | 'blueprint'
  | 'kraft'
  | 'dark-dots';

export interface Point {
  x: number;
  y: number;
  p?: number;
}

export interface StrokeObject {
  id: string;
  type: 'stroke';
  points: Point[];
  color: string;
  width: number;
  pen: PenKind;
}

export interface TextObject {
  id: string;
  type: 'text';
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  fontSize: number;
  color: string;
  font: 'sans' | 'serif' | 'mono';
  align: 'left' | 'center' | 'right';
}

export interface StickyObject {
  id: string;
  type: 'sticky';
  x: number;
  y: number;
  w: number;
  h: number;
  content: string;
  paper: string;
}

export interface ShapeObject {
  id: string;
  type: 'shape';
  kind: ShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
}

export interface ArrowObject {
  id: string;
  type: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  head: ArrowHead;
}

export interface TableObject {
  id: string;
  type: 'table';
  x: number;
  y: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  cells: string[][];
  header: boolean;
}

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

export interface ChartObject {
  id: string;
  type: 'chart';
  kind: ChartKind;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  data: ChartSlice[];
}

export interface NoteCardObject {
  id: string;
  type: 'note';
  x: number;
  y: number;
  w: number;
  h: number;
  noteId: string;
}

export type BoardObject =
  | StrokeObject
  | TextObject
  | StickyObject
  | ShapeObject
  | ArrowObject
  | TableObject
  | ChartObject
  | NoteCardObject;

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface Board {
  id: string;
  name: string;
  background: BackgroundId;
  paper: string;
  objects: BoardObject[];
  camera: Camera;
  updatedAt: string;
}

export const BACKGROUNDS: { id: BackgroundId; label: string }[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'dots', label: 'Dots' },
  { id: 'dots-large', label: 'Large dots' },
  { id: 'grid', label: 'Grid' },
  { id: 'grid-fine', label: 'Fine grid' },
  { id: 'lined', label: 'Lined' },
  { id: 'lined-wide', label: 'Wide lined' },
  { id: 'graph', label: 'Graph paper' },
  { id: 'isometric', label: 'Isometric' },
  { id: 'cornell', label: 'Cornell' },
  { id: 'blueprint', label: 'Blueprint' },
  { id: 'kraft', label: 'Kraft' },
  { id: 'dark-dots', label: 'Night dots' },
];

export const PAPER_PRESETS = [
  '#faf8f5',
  '#ffffff',
  '#f3efe6',
  '#e7f0e8',
  '#e8eef6',
  '#1a2744',
  '#1c1917',
  '#c4a574',
];

export const PRESET_INK = [
  '#1a1a1a',
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#db2777',
  '#0f766e',
  '#eab308',
  '#64748b',
];

export const STICKY_PAPERS = ['#fef3c7', '#fce7f3', '#dbeafe', '#dcfce7', '#ffedd5', '#e2e8f0'];

export const CHART_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0f766e', '#db2777', '#64748b'];
