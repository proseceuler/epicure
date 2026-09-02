import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, DB_CHANGED } from '@/lib/supabase';
import { SUBJECTS, type Note } from '@/lib/types';
import { Button, EmptyState, Input, Select } from '@/components/kit';
import Whiteboard from '@/components/board/Whiteboard';
import NoteMarkdown from '@/components/notes/NoteMarkdown';
import { wikiBoardTitles, wikiLinkTitles, findNoteByTitle, escapeRegex } from '@/lib/wiki';
import { loadBoards, BOARDS_CHANGED, findBoardByName } from '@/lib/board-store';
import {
  FileText,
  Folder,
  GitBranch,
  LayoutGrid,
  Link2,
  Plus,
  Search,
  Tag,
  Pin,
  PinOff,
  Trash2,
  BookOpen,
  CalendarDays,
  Network,
} from 'lucide-react';

type Tab = 'notes' | 'board' | 'graph';

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function outline(content: string) {
  return (content || '')
    .split('\n')
    .map((line) => {
      const m = /^(#{1,3})\s+(.+)/.exec(line);
      return m ? { level: m[1].length, text: m[2] } : null;
    })
    .filter((x): x is { level: number; text: string } => Boolean(x));
}

export default function NotesPage() {
  const [tab, setTab] = useState<Tab>('notes');
  const [openBoardName, setOpenBoardName] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>('note-home');
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    const { data } = await supabase.from('notes').select('*').order('updated_at', { ascending: false });
    if (data) setNotes(data as Note[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNotes();
    const on = () => loadNotes();
    window.addEventListener(DB_CHANGED, on);
    return () => window.removeEventListener(DB_CHANGED, on);
  }, [loadNotes]);

  useEffect(() => {
    try {
      const folder = sessionStorage.getItem('epicure-open-folder');
      if (folder) sessionStorage.removeItem('epicure-open-folder');
    } catch {
      /* ignore */
    }
  }, []);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  const createNote = async (partial: Partial<Note> & { title: string }) => {
    const { data } = await supabase
      .from('notes')
      .insert({
        title: partial.title,
        content: partial.content ?? '',
        folder: partial.folder ?? 'Vault',
        tags: partial.tags ?? [],
        pinned: partial.pinned ?? false,
        linked_subject: partial.linked_subject ?? null,
        linked_board_ids: partial.linked_board_ids ?? [],
      })
      .select()
      .single();
    if (data) {
      setNotes((prev) => [data as Note, ...prev]);
      setSelectedId((data as Note).id);
      setTab('notes');
      return data as Note;
    }
    return null;
  };

  const openOrCreate = async (title: string) => {
    const existing = findNoteByTitle(notes, title);
    if (existing) {
      setSelectedId(existing.id);
      setTab('notes');
      return existing;
    }
    return createNote({ title, folder: 'Vault' });
  };

  const openBoard = (name: string) => {
    setOpenBoardName(name);
    setTab('board');
  };

  const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'board', label: 'Board', icon: LayoutGrid },
    { id: 'graph', label: 'Graph', icon: Network },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl p-1 glass">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  tab === t.id ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
        <p className="text-sm text-zinc-500">
          {tab === 'notes' && 'Obsidian-style vault — wiki-links, backlinks, folders'}
          {tab === 'board' && 'Scratchpad + whiteboard in one canvas'}
          {tab === 'graph' && 'How notes and boards connect'}
        </p>
      </div>

      {tab === 'notes' && (
        <NotesVault
          notes={notes}
          selected={selected}
          loading={loading}
          onSelect={(n) => setSelectedId(n.id)}
          onCreate={createNote}
          onOpenOrCreate={openOrCreate}
          onOpenBoard={openBoard}
          onReload={loadNotes}
        />
      )}
      {tab === 'board' && (
        <div className="min-h-0 flex-1" style={{ minHeight: '70vh' }}>
          <Whiteboard
            notes={notes}
            openBoardName={openBoardName}
            onOpenNote={(n) => {
              setSelectedId(n.id);
              setTab('notes');
            }}
            onCreateNote={(title) => openOrCreate(title)}
          />
        </div>
      )}
      {tab === 'graph' && (
        <GraphView
          notes={notes}
          onOpenNote={(n) => {
            setSelectedId(n.id);
            setTab('notes');
          }}
          onOpenBoard={openBoard}
        />
      )}
    </div>
  );
}

function NotesVault({
  notes,
  selected,
  loading,
  onSelect,
  onCreate,
  onOpenOrCreate,
  onOpenBoard,
  onReload,
}: {
  notes: Note[];
  selected: Note | null;
  loading: boolean;
  onSelect: (n: Note) => void;
  onCreate: (p: Partial<Note> & { title: string }) => Promise<Note | null>;
  onOpenOrCreate: (title: string) => Promise<Note | null>;
  onOpenBoard: (name: string) => void;
  onReload: () => void;
}) {
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState('All');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(true);
  const [draft, setDraft] = useState<Note | null>(null);
  const [linkPicker, setLinkPicker] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newFolder, setNewFolder] = useState('Vault');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(selected);
    setEditMode(true);
  }, [selected?.id]);

  const folders = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => set.add(n.folder || 'Vault'));
    return ['All', ...[...set].sort()];
  }, [notes]);

  const allTags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags || []))], [notes]);

  const filtered = notes.filter((n) => {
    if (activeFolder !== 'All' && n.folder !== activeFolder) return false;
    if (activeTag && !(n.tags || []).includes(activeTag)) return false;
    if (search) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || (n.content || '').toLowerCase().includes(q);
    }
    return true;
  });

  const persistDraft = (next: Note) => {
    setDraft(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from('notes').update({
        title: next.title,
        content: next.content,
        tags: next.tags,
        folder: next.folder,
        linked_subject: next.linked_subject,
      }).eq('id', next.id);
      onReload();
    }, 600);
  };

  const insertWiki = (title: string) => {
    const el = taRef.current;
    if (!draft) return;
    const insertion = `[[${title}]]`;
    if (!el) {
      persistDraft({ ...draft, content: (draft.content || '') + insertion });
      setLinkPicker(false);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + insertion + el.value.slice(end);
    persistDraft({ ...draft, content: next });
    setLinkPicker(false);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + insertion.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const daily = async () => {
    const t = todayStamp();
    const existing = notes.find((n) => n.title === t && n.folder === 'Daily');
    if (existing) onSelect(existing);
    else await onCreate({ title: t, folder: 'Daily', tags: ['daily'], content: `# ${t}\n\n## Focus\n- \n` });
  };

  const backlinks = draft
    ? notes.filter(
        (n) =>
          n.id !== draft.id &&
          new RegExp(`\\[\\[\\s*${escapeRegex(draft.title)}\\s*(\\|[^\\]]+)?\\]\\]`, 'i').test(n.content || ''),
      )
    : [];
  const outgoing = draft ? wikiLinkTitles(draft.content || '') : [];
  const boardLinks = draft ? wikiBoardTitles(draft.content || '') : [];
  const heads = draft ? outline(draft.content || '') : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FileText className="h-8 w-8 animate-pulse text-zinc-300" />
      </div>
    );
  }

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[16rem_18rem_minmax(0,1fr)_14rem]">
      <div className="space-y-3">
        <button
          type="button"
          onClick={daily}
          className="glass glass-hover flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-700"
        >
          <CalendarDays className="h-4 w-4" /> Today
        </button>
        <div className="glass rounded-2xl p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-700">
            <Folder className="h-4 w-4 text-zinc-400" /> Folders
          </div>
          <div className="space-y-0.5">
            {folders.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFolder(f)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm ${
                  activeFolder === f ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                <span className="truncate">{f}</span>
                <span className="text-[10px] opacity-60">
                  {f === 'All' ? notes.length : notes.filter((n) => n.folder === f).length}
                </span>
              </button>
            ))}
          </div>
        </div>
        {allTags.length > 0 && (
          <div className="glass rounded-2xl p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-700">
              <Tag className="h-4 w-4 text-zinc-400" /> Tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                  className={`rounded-md px-2 py-0.5 text-xs ${
                    activeTag === tag ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="min-h-0 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vault…"
            className="glass-input w-full rounded-xl py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <Button
          onClick={() => {
            setShowNew(true);
            setNewTitle('');
          }}
        >
          <Plus className="h-4 w-4" /> New note
        </Button>
        <div className="max-h-[62vh] space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onSelect(note)}
              className={`w-full rounded-xl border p-3 text-left transition-all ${
                selected?.id === note.id ? 'border-zinc-800 bg-zinc-100/70' : 'glass border-zinc-200/40 glass-hover'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {note.pinned && <Pin className="h-3 w-3 text-zinc-600" />}
                <span className="truncate text-sm font-medium text-zinc-800">{note.title}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">
                {(note.content || '').replace(/[#*`>[\]]/g, '').slice(0, 90)}
              </p>
              <p className="mt-1 text-[10px] text-zinc-400">{note.folder}</p>
            </button>
          ))}
          {filtered.length === 0 && <EmptyState icon={FileText} title="No notes" subtitle="Create one to start the vault." />}
        </div>
      </div>

      <div className="min-h-0">
        {showNew ? (
          <div className="glass rounded-2xl p-5">
            <h3 className="mb-3 font-semibold">New note</h3>
            <div className="space-y-2">
              <Input value={newTitle} onChange={setNewTitle} placeholder="Title" />
              <Input value={newFolder} onChange={setNewFolder} placeholder="Folder (e.g. Science/Biology)" />
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    if (!newTitle.trim()) return;
                    await onCreate({ title: newTitle.trim(), folder: newFolder || 'Vault' });
                    setShowNew(false);
                  }}
                >
                  Create
                </Button>
                <Button variant="ghost" onClick={() => setShowNew(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : draft ? (
          <div className="glass flex h-full min-h-[70vh] flex-col rounded-2xl">
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200/60 px-4 py-3">
              <input
                value={draft.title}
                onChange={(e) => persistDraft({ ...draft, title: e.target.value })}
                className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none"
              />
              <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className={`rounded-md px-2 py-1 ${editMode ? 'bg-white shadow-sm' : 'text-zinc-500'}`}
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className={`rounded-md px-2 py-1 ${!editMode ? 'bg-white shadow-sm' : 'text-zinc-500'}`}
                >
                  Preview
                </button>
              </div>
              <div className="relative">
                <Button size="sm" variant="secondary" onClick={() => setLinkPicker((v) => !v)}>
                  <Link2 className="h-3.5 w-3.5" /> Link
                </Button>
                {linkPicker && (
                  <div className="absolute right-0 top-full z-20 mt-1 max-h-56 w-56 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
                    {notes
                      .filter((n) => n.id !== draft.id)
                      .map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => insertWiki(n.title)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-100"
                        >
                          <FileText className="h-3 w-3 text-zinc-400" />
                          {n.title}
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() => insertWiki('Board: Study sketch')}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-100"
                    >
                      <LayoutGrid className="h-3 w-3 text-zinc-400" /> Board: Study sketch
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={async () => {
                  await supabase.from('notes').update({ pinned: !draft.pinned }).eq('id', draft.id);
                  persistDraft({ ...draft, pinned: !draft.pinned });
                }}
                className="rounded-lg p-2 hover:bg-zinc-100"
              >
                {draft.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4 text-zinc-400" />}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await supabase.from('notes').delete().eq('id', draft.id);
                  onReload();
                }}
                className="rounded-lg p-2 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {editMode ? (
                <textarea
                  ref={taRef}
                  value={draft.content}
                  onChange={(e) => persistDraft({ ...draft, content: e.target.value })}
                  placeholder="Write in markdown. Use [[Note title]] or [[Board: Name]] to link."
                  className="h-full min-h-[28rem] w-full resize-none bg-transparent px-5 py-4 font-mono text-sm leading-relaxed outline-none"
                />
              ) : (
                <div className="h-full overflow-y-auto px-6 py-5">
                  <NoteMarkdown
                    content={draft.content}
                    notes={notes}
                    onOpenNote={(t) => onOpenOrCreate(t)}
                    onOpenBoard={onOpenBoard}
                    onCreateNote={(t) => onOpenOrCreate(t)}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-zinc-200/60 px-4 py-2">
              <Input
                value={(draft.tags || []).join(', ')}
                onChange={(v) => persistDraft({ ...draft, tags: v.split(',').map((t) => t.trim()).filter(Boolean) })}
                placeholder="tags"
                className="max-w-xs"
              />
              <Select
                value={draft.linked_subject || ''}
                onChange={(v) => persistDraft({ ...draft, linked_subject: v || null })}
                options={[{ value: '', label: 'No subject' }, ...SUBJECTS.map((s) => ({ value: s.key, label: s.name }))]}
              />
            </div>
          </div>
        ) : (
          <div className="glass rounded-2xl p-6">
            <EmptyState icon={BookOpen} title="Select a note" subtitle="Or create one from the list." />
          </div>
        )}
      </div>

      <div className="space-y-3">
        {draft && (
          <>
            <div className="glass rounded-2xl p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Outline</p>
              {heads.length === 0 && <p className="text-xs text-zinc-400">Headings appear here.</p>}
              <div className="space-y-1">
                {heads.map((h, i) => (
                  <p key={i} className="truncate text-xs text-zinc-600" style={{ paddingLeft: (h.level - 1) * 8 }}>
                    {h.text}
                  </p>
                ))}
              </div>
            </div>
            <div className="glass rounded-2xl p-3">
              <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                <Link2 className="h-3 w-3" /> Links
              </p>
              {outgoing.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onOpenOrCreate(t)}
                  className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                >
                  <FileText className="h-3 w-3 text-zinc-400" /> {t}
                </button>
              ))}
              {boardLinks.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onOpenBoard(t)}
                  className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                >
                  <LayoutGrid className="h-3 w-3 text-zinc-400" /> {t}
                </button>
              ))}
              {outgoing.length === 0 && boardLinks.length === 0 && <p className="text-xs text-zinc-400">No outgoing links.</p>}
            </div>
            <div className="glass rounded-2xl p-3">
              <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                <GitBranch className="h-3 w-3" /> Backlinks
              </p>
              {backlinks.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onSelect(n)}
                  className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                >
                  <FileText className="h-3 w-3 text-zinc-400" /> {n.title}
                </button>
              ))}
              {backlinks.length === 0 && <p className="text-xs text-zinc-400">Nothing links here yet.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function GraphView({
  notes,
  onOpenNote,
  onOpenBoard,
}: {
  notes: Note[];
  onOpenNote: (n: Note) => void;
  onOpenBoard: (name: string) => void;
}) {
  const [boards, setBoards] = useState(() => (typeof window === 'undefined' ? [] : loadBoards()));
  useEffect(() => {
    const on = () => setBoards(loadBoards());
    window.addEventListener(BOARDS_CHANGED, on);
    return () => window.removeEventListener(BOARDS_CHANGED, on);
  }, []);

  const nodes = [
    ...notes.map((n) => ({ id: n.id, label: n.title, kind: 'note' as const })),
    ...boards.map((b) => ({ id: `board:${b.id}`, label: b.name, kind: 'board' as const })),
  ];
  const edges: { from: string; to: string }[] = [];
  for (const n of notes) {
    for (const t of wikiLinkTitles(n.content || '')) {
      const dest = findNoteByTitle(notes, t);
      if (dest) edges.push({ from: n.id, to: dest.id });
    }
    for (const t of wikiBoardTitles(n.content || '')) {
      const b = findBoardByName(boards, t);
      if (b) edges.push({ from: n.id, to: `board:${b.id}` });
    }
  }

  const w = 900;
  const h = 520;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.36;
  const pos = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, i) => {
    const a = (i / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    pos.set(n.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  });

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[70vh] w-full">
        {edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(24,24,27,0.18)" strokeWidth="1.2" />;
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const isBoard = n.kind === 'board';
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              className="cursor-pointer"
              onClick={() => {
                if (isBoard) onOpenBoard(n.label);
                else {
                  const note = notes.find((x) => x.id === n.id);
                  if (note) onOpenNote(note);
                }
              }}
            >
              {isBoard ? (
                <rect x={-9} y={-9} width={18} height={18} rx={3} transform="rotate(45)" fill="#18181b" />
              ) : (
                <circle r={10} fill="#18181b" />
              )}
              <text y={26} textAnchor="middle" fontSize="11" fill="#3f3f46">
                {n.label.slice(0, 22)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
