/**
 * LocalStorage-backed stand-in for the original Supabase client.
 * Same chainable `.from().select()/insert()/update()/delete()` surface the
 * rest of epicure already uses, so pages keep working without a remote DB.
 */

export const DB_CHANGED = 'epicure-db-changed';
const STORAGE_KEY = 'epicure:db';

type Row = Record<string, unknown> & { id: string };
type Table = Row[];
type Database = Record<string, Table>;

function canStore() {
  return typeof window !== 'undefined';
}

function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function seed(): Database {
  const today = nowIso();
  const date = today.slice(0, 10);
  return {
    assessments: [],
    class_hub: [],
    class_hub_links: [],
    todos: [
      {
        id: 'todo-welcome',
        title: 'Explore the new Notes & Board workspace',
        subject_key: 'english',
        due_date: date,
        priority: 'not_urgent_important',
        completed: false,
        created_at: today,
      },
      {
        id: 'todo-math',
        title: 'Review quadratic formula on the study sketch board',
        subject_key: 'math',
        due_date: date,
        priority: 'urgent_important',
        completed: false,
        created_at: today,
      },
    ],
    kanban_tasks: [],
    pomodoro_sessions: [],
    pomodoro_settings: [],
    habits: [],
    habit_completions: [],
    finance_settings: [],
    finance_transactions: [],
    finance_goals: [],
    notes: [
      {
        id: 'note-home',
        title: 'Home',
        folder: 'Vault',
        tags: ['moc', 'index'],
        pinned: true,
        linked_subject: null,
        linked_board_ids: ['board-study'],
        created_at: today,
        updated_at: today,
        content: `# Home

Welcome to **epicure** — a study vault in the spirit of Obsidian, with a Microsoft Whiteboard-style board beside it.

## Jump in
- [[How to use notes]]
- [[How to use the Board]]
- [[Cell structure]]
- [[Quadratic formula]]

## Today
- Open [[${date}]] for a daily note
- Sketch on [[Board: Study sketch]]

> Use \`[[Note title]]\` to link anything. Hover a link, follow it, and watch backlinks appear on the right.
`,
      },
      {
        id: 'note-howto',
        title: 'How to use notes',
        folder: 'Vault',
        tags: ['guide'],
        pinned: false,
        linked_subject: 'english',
        linked_board_ids: [],
        created_at: today,
        updated_at: today,
        content: `# How to use notes

This vault is modelled after **Obsidian**.

## Wiki-links
Type \`[[Cell structure]]\` to link another note. Click a red (missing) link to create it.

Board links use a prefix: \`[[Board: Study sketch]]\`.

Embed a note with \`![[Quadratic formula]]\`.

## Folders & tags
Notes live in nested folders (\`Science/Biology\`). Tags like #guide sit in the left rail.

## Graph
Open the **Graph** view to see how ideas connect — notes as circles, boards as diamonds.

## Markdown
**Bold**, *italic*, \`code\`, lists, tables and $\\text{math}$ all work.

| Shortcut | Action |
| --- | --- |
| \`[[\` | Link a note |
| Ctrl/Cmd + S | Save (also autosaves) |
| Graph button | See connections |
`,
      },
      {
        id: 'note-board-guide',
        title: 'How to use the Board',
        folder: 'Vault',
        tags: ['guide', 'board'],
        pinned: false,
        linked_subject: null,
        linked_board_ids: ['board-study'],
        created_at: today,
        updated_at: today,
        content: `# How to use the Board

Scratchpad + whiteboard live in **one infinite canvas**.

## Draw
- **Pen, pencil, marker, highlighter, calligraphy** — each has its own feel
- **Eraser** punches holes in ink (it does not paint white)
- Open the **RGB graph** to mix any colour: saturation-value plane, hue, and R/G/B bars

## Objects
Place **text**, **sticky notes**, **shapes**, **arrows**, **tables**, **pie / bar / line charts**, and **note cards** that open this vault.

## Paper
Switch backgrounds: dots, grid, lined, graph, isometric, Cornell, blueprint, kraft…

## Connected notes
Drop a note card onto the board, or write \`[[Board: Study sketch]]\` in a note.

Try the seeded board: [[Board: Study sketch]].
`,
      },
      {
        id: 'note-cells',
        title: 'Cell structure',
        folder: 'Science/Biology',
        tags: ['science', 'biology'],
        pinned: false,
        linked_subject: 'science',
        linked_board_ids: ['board-study'],
        created_at: today,
        updated_at: today,
        content: `# Cell structure

Linked from [[Home]] and pinned on [[Board: Study sketch]].

## Organelles
- **Nucleus** — DNA, control centre
- **Mitochondria** — respiration, ATP
- **Ribosomes** — protein synthesis
- **Chloroplasts** (plants) — photosynthesis

See the pie chart on the board for a time-split of a lesson.

Related: [[Quadratic formula]] (yes, even biology students sit math).
`,
      },
      {
        id: 'note-quadratic',
        title: 'Quadratic formula',
        folder: 'Math',
        tags: ['math', 'algebra'],
        pinned: false,
        linked_subject: 'math',
        linked_board_ids: ['board-study'],
        created_at: today,
        updated_at: today,
        content: `# Quadratic formula

For $ax^2 + bx + c = 0$:

$$
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

## Checklist
- Discriminant $D = b^2 - 4ac$
- $D > 0$ two real roots
- $D = 0$ one real root
- $D < 0$ no real roots

Practice table is on [[Board: Study sketch]]. Back to [[Home]].
`,
      },
      {
        id: `note-daily-${date}`,
        title: date,
        folder: 'Daily',
        tags: ['daily'],
        pinned: false,
        linked_subject: null,
        linked_board_ids: [],
        created_at: today,
        updated_at: today,
        content: `# ${date}

## Focus
- 

## Captured
- 

## Links
- [[Home]]
`,
      },
    ],
    timetable_entries: [],
    class_attendance: [],
    flashcard_decks: [],
    flashcards: [],
    todo_subtasks: [],
    forecast_scenarios: [],
    scratchpad: [],
    whiteboard: [],
    wellness_log: [],
  };
}

let memory: Database | null = null;

function load(): Database {
  if (memory) return memory;
  if (!canStore()) {
    memory = seed();
    return memory;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      memory = { ...seed(), ...parsed };
      return memory;
    }
  } catch {
    /* ignore corrupt */
  }
  memory = seed();
  persist(memory);
  return memory;
}

function persist(db: Database) {
  memory = db;
  if (!canStore()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    window.dispatchEvent(new CustomEvent(DB_CHANGED, { detail: { at: Date.now() } }));
  } catch {
    /* quota */
  }
}

type Filter = (row: Row) => boolean;
type Order = { col: string; asc: boolean };

class Query implements PromiseLike<{ data: any; error: any }> {
  private table: string;
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitN: number | null = null;
  private mutation: { type: 'insert' | 'update' | 'delete'; payload?: any } | null = null;
  private want: 'many' | 'single' | 'maybe' = 'many';

  constructor(table: string) {
    this.table = table;
  }

  select(_cols?: string) {
    return this;
  }
  insert(data: any) {
    this.mutation = { type: 'insert', payload: data };
    return this;
  }
  update(data: any) {
    this.mutation = { type: 'update', payload: data };
    return this;
  }
  delete() {
    this.mutation = { type: 'delete' };
    return this;
  }
  eq(col: string, val: unknown) {
    this.filters.push((r) => r[col] === val);
    return this;
  }
  neq(col: string, val: unknown) {
    this.filters.push((r) => r[col] !== val);
    return this;
  }
  not(col: string, op: string, val: unknown) {
    if (op === 'is' && val === null) this.filters.push((r) => r[col] !== null && r[col] !== undefined);
    else this.filters.push((r) => r[col] !== val);
    return this;
  }
  gte(col: string, val: any) {
    this.filters.push((r) => (r[col] as any) >= val);
    return this;
  }
  lte(col: string, val: any) {
    this.filters.push((r) => (r[col] as any) <= val);
    return this;
  }
  gt(col: string, val: any) {
    this.filters.push((r) => (r[col] as any) > val);
    return this;
  }
  lt(col: string, val: any) {
    this.filters.push((r) => (r[col] as any) < val);
    return this;
  }
  ilike(col: string, pattern: string) {
    const needle = String(pattern).replace(/%/g, '').toLowerCase();
    this.filters.push((r) => String(r[col] ?? '').toLowerCase().includes(needle));
    return this;
  }
  in(col: string, vals: unknown[]) {
    this.filters.push((r) => vals.includes(r[col]));
    return this;
  }
  is(col: string, val: unknown) {
    if (val === null) this.filters.push((r) => r[col] == null);
    else this.filters.push((r) => r[col] === val);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.want = 'single';
    return this;
  }
  maybeSingle() {
    this.want = 'maybe';
    return this;
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private applyFilters(rows: Table) {
    let out = this.filters.length ? rows.filter((r) => this.filters.every((f) => f(r))) : [...rows];
    for (const o of this.orders) {
      out.sort((a, b) => {
        const av = a[o.col] as any;
        const bv = b[o.col] as any;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av < bv) return o.asc ? -1 : 1;
        if (av > bv) return o.asc ? 1 : -1;
        return 0;
      });
    }
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return out;
  }

  private async execute(): Promise<{ data: any; error: any }> {
    const db = load();
    if (!db[this.table]) db[this.table] = [];
    const rows = db[this.table];

    if (this.mutation?.type === 'insert') {
      const payload = this.mutation.payload;
      const list = Array.isArray(payload) ? payload : [payload];
      const inserted: Row[] = list.map((item) => {
        const row: Row = {
          ...item,
          id: item.id || uid(),
        };
        if (row.created_at == null) row.created_at = nowIso();
        if (row.updated_at == null) row.updated_at = nowIso();
        return row;
      });
      db[this.table] = [...rows, ...inserted];
      persist(db);
      return this.wrap(inserted);
    }

    if (this.mutation?.type === 'update') {
      const next = rows.map((r) =>
        this.filters.every((f) => f(r)) ? { ...r, ...this.mutation!.payload, updated_at: nowIso() } : r,
      );
      const changed = next.filter((r, i) => r !== rows[i]);
      db[this.table] = next;
      persist(db);
      return this.wrap(changed);
    }

    if (this.mutation?.type === 'delete') {
      const kept: Table = [];
      const removed: Table = [];
      for (const r of rows) {
        if (this.filters.every((f) => f(r))) removed.push(r);
        else kept.push(r);
      }
      db[this.table] = kept;
      persist(db);
      return this.wrap(removed);
    }

    return this.wrap(this.applyFilters(rows));
  }

  private wrap(rows: Table) {
    if (this.want === 'single') {
      if (!rows[0]) return { data: null, error: { message: 'not found' } };
      return { data: rows[0], error: null };
    }
    if (this.want === 'maybe') return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null };
  }
}

export const supabase = {
  from(table: string) {
    return new Query(table);
  },
};

export function resetLocalDb() {
  memory = seed();
  persist(memory);
}
