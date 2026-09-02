import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SUBJECTS, type KanbanTask, type SubjectKey } from '@/lib/types';
import { Card, PageHeader, Button, Input, Select, EmptyState, SubjectBadge } from '@/components/kit';
import {
  FolderTree, Plus, Trash2, GripVertical, X, Calendar as CalIcon,
  CheckSquare, Paperclip, MessageSquare, Activity, Tag, UserPlus, AlignLeft,
} from 'lucide-react';

const COLUMNS = [
  { id: 'todo', label: 'To Do', tint: 'bg-zinc-400' },
  { id: 'in_progress', label: 'In Progress', tint: 'bg-sky-500' },
  { id: 'review', label: 'Review', tint: 'bg-amber-500' },
  { id: 'done', label: 'Done', tint: 'bg-emerald-500' },
] as const;

type Status = (typeof COLUMNS)[number]['id'];

function dueTone(due: string | null): string {
  if (!due) return 'bg-zinc-100 text-zinc-500';
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - today.getTime()) / 86400000;
  if (diff < 0) return 'bg-rose-100 text-rose-700';
  if (diff <= 2) return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-50 text-emerald-700';
}

function formatDue(due: string) {
  return new Date(due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function KanbanPage() {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    subject_key: '',
    due_date: '',
    status: 'todo' as Status,
  });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  /** UI-only: which card modal is open */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    const { data } = await supabase.from('kanban_tasks').select('*').order('sort_order', { ascending: true });
    if (data) setTasks(data as KanbanTask[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const selected = tasks.find((t) => t.id === selectedId) ?? null;

  const addTask = async () => {
    if (!form.title.trim()) return;
    const maxOrder = tasks.filter((t) => t.status === form.status).reduce((max, t) => Math.max(max, t.sort_order), 0);
    const { data } = await supabase
      .from('kanban_tasks')
      .insert({
        title: form.title.trim(),
        description: form.description.trim(),
        subject_key: form.subject_key || null,
        due_date: form.due_date || null,
        status: form.status,
        sort_order: maxOrder + 1,
      })
      .select()
      .single();
    if (data) {
      setTasks([...tasks, data as KanbanTask]);
      setForm({ title: '', description: '', subject_key: '', due_date: '', status: 'todo' });
      setShowForm(false);
    }
  };

  const deleteTask = async (id: string) => {
    await supabase.from('kanban_tasks').delete().eq('id', id);
    setTasks(tasks.filter((t) => t.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const updateStatus = async (taskId: string, newStatus: Status) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    const maxOrder = tasks.filter((t) => t.status === newStatus).reduce((max, t) => Math.max(max, t.sort_order), 0);
    const { data } = await supabase
      .from('kanban_tasks')
      .update({ status: newStatus, sort_order: maxOrder + 1 })
      .eq('id', taskId)
      .select()
      .single();
    if (data) setTasks(tasks.map((t) => (t.id === taskId ? (data as KanbanTask) : t)));
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const onDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (draggingId) updateStatus(draggingId, colId as Status);
    setDraggingId(null);
    setDragOverCol(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <FolderTree className="h-8 w-8 animate-pulse text-zinc-300" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Project Kanban Board"
        subtitle="Drag and drop tasks between columns to track larger assignments"
        action={
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" /> Add Task
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-zinc-500">Title</label>
              <Input value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Project or assignment name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Status</label>
              <Select
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v as Status })}
                options={COLUMNS.map((c) => ({ value: c.id, label: c.label }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Subject</label>
              <Select
                value={form.subject_key}
                onChange={(v) => setForm({ ...form, subject_key: v })}
                options={[{ value: '', label: 'None' }, ...SUBJECTS.map((s) => ({ value: s.key, label: s.shortName }))]}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-500">Due Date</label>
              <Input value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} type="date" />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-xs font-medium text-zinc-500">Description</label>
              <Input value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Optional details" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={addTask} size="sm">
              Add Task
            </Button>
            <Button onClick={() => setShowForm(false)} variant="ghost" size="sm">
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {tasks.length === 0 && !showForm ? (
        <EmptyState icon={FolderTree} title="No tasks on the board" subtitle="Add a task to start organizing your larger assignments visually." />
      ) : (
        /* Trello-style board: horizontal scroll on mobile */
        <div className="-mx-1 flex min-h-0 flex-1 gap-3 overflow-x-auto pb-4 pt-1">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                onDragOver={(e) => onDragOver(e, col.id)}
                onDrop={(e) => onDrop(e, col.id)}
                className={`flex w-[272px] shrink-0 flex-col rounded-2xl transition-all ${
                  dragOverCol === col.id
                    ? 'bg-white/70 ring-2 ring-zinc-400/40'
                    : 'bg-white/40 backdrop-blur-md'
                }`}
                style={{ maxHeight: 'calc(100vh - 12rem)' }}
              >
                {/* List header */}
                <div className="flex shrink-0 items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${col.tint}`} />
                    <span className="text-sm font-semibold text-zinc-700">{col.label}</span>
                    <span className="rounded-full bg-zinc-200/70 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                  {colTasks.map((task) => {
                    const subj = SUBJECTS.find((s) => s.key === task.subject_key);
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, task.id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverCol(null);
                        }}
                        onClick={() => setSelectedId(task.id)}
                        className={`group cursor-pointer rounded-xl border border-white/50 bg-white/85 p-3 shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow-md ${
                          draggingId === task.id ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Label chips */}
                        {subj && (
                          <div className="mb-1.5 flex flex-wrap gap-1">
                            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-zinc-800 text-white">
                              {subj.shortName}
                            </span>
                          </div>
                        )}

                        <div className="flex items-start gap-1.5">
                          <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-300 opacity-0 group-hover:opacity-100" />
                          <p className="flex-1 text-sm font-medium leading-snug text-zinc-800">{task.title}</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTask(task.id);
                            }}
                            className="shrink-0 text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:text-zinc-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Metadata row */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
                          {task.due_date && (
                            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${dueTone(task.due_date)}`}>
                              <CalIcon className="h-3 w-3" />
                              {formatDue(task.due_date)}
                            </span>
                          )}
                          {task.description ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-zinc-400" title="Has description">
                              <AlignLeft className="h-3 w-3" />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <p className="py-6 text-center text-xs text-zinc-400">Drop cards here</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setForm((f) => ({ ...f, status: col.id }));
                    setShowForm(true);
                  }}
                  className="mx-2 mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-white/60 hover:text-zinc-700"
                >
                  <Plus className="h-3.5 w-3.5" /> Add a card
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Card detail modal — Trello-like structure, existing data only */}
      {selected && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-4 backdrop-blur-sm"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="glass glass-shadow-lg relative my-8 w-full max-w-3xl overflow-hidden rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200/50 px-5 py-3">
              <select
                value={selected.status}
                onChange={(e) => updateStatus(selected.id, e.target.value as Status)}
                className="rounded-lg border border-zinc-200/80 bg-white/70 px-2 py-1.5 text-xs font-medium text-zinc-700"
              >
                {COLUMNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${dueTone(selected.due_date)}`}>
                {COLUMNS.find((c) => c.id === selected.status)?.label}
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => deleteTask(selected.id)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* Main column */}
              <div className="min-w-0 flex-1 space-y-5 p-5">
                <h2 className="text-xl font-semibold text-zinc-800">{selected.title}</h2>

                {/* Quick actions (visual — no new features) */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: Tag, label: 'Labels' },
                    { icon: CheckSquare, label: 'Checklist' },
                    { icon: UserPlus, label: 'Members' },
                    { icon: Paperclip, label: 'Attachment' },
                  ].map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100/80 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-200/80"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Labels */}
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <Tag className="h-3.5 w-3.5" /> Labels
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.subject_key ? (
                      <SubjectBadge shortName={SUBJECTS.find((s) => s.key === selected.subject_key)?.shortName ?? selected.subject_key} />
                    ) : (
                      <span className="text-xs text-zinc-400">No labels</span>
                    )}
                  </div>
                </section>

                {/* Due date */}
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <CalIcon className="h-3.5 w-3.5" /> Due date
                  </h3>
                  {selected.due_date ? (
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${dueTone(selected.due_date)}`}>
                      {formatDue(selected.due_date)}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">No due date</span>
                  )}
                </section>

                {/* Description */}
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <AlignLeft className="h-3.5 w-3.5" /> Description
                  </h3>
                  <div className="min-h-[96px] rounded-xl border border-zinc-200/60 bg-white/50 px-3 py-2 text-sm leading-relaxed text-zinc-700">
                    {selected.description || <span className="text-zinc-400">No description</span>}
                  </div>
                </section>
              </div>

              {/* Sidebar: Comments / Activity (presentational) */}
              <aside className="w-full border-t border-zinc-200/50 bg-white/30 p-5 lg:w-64 lg:border-l lg:border-t-0">
                <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <MessageSquare className="h-3.5 w-3.5" /> Comments
                </h3>
                <p className="mb-6 text-xs text-zinc-400">No comments yet.</p>

                <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <Activity className="h-3.5 w-3.5" /> Activity
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-white">
                      G
                    </div>
                    <div>
                      <p className="text-xs text-zinc-700">
                        <span className="font-semibold">You</span> opened this card
                      </p>
                      <p className="text-[10px] text-zinc-400">Just now</p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
