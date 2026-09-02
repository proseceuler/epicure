import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SUBJECTS, type Todo, type KanbanTask, type SubjectKey, type Note, type Habit } from '@/lib/types';
import {
  getCalendarEvents,
  addCalendarEvent,
  deleteCalendarEvent,
  CALENDAR_EVENTS_UPDATED,
  type CalendarEvent,
} from '@/lib/calendarStore';
import { Card, PageHeader, EmptyState, SubjectBadge, Button, Input, Select } from '@/components/kit';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, AlertCircle, Plus, X, Trash2, Link2 } from 'lucide-react';

export type { CalendarEvent };


interface DeadlineItem {
  id: string;
  title: string;
  date: string;
  source: 'todo' | 'kanban';
  subject_key: SubjectKey | null;
  status?: string;
}

const KINDS = [
  { value: 'event', label: 'Event' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'exam', label: 'Exam' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'holiday', label: 'Holiday / No class' },
];

const KIND_STYLE: Record<string, string> = {
  event: 'bg-zinc-800 text-white',
  deadline: 'bg-zinc-900 text-white',
  exam: 'bg-rose-500/80 text-white',
  reminder: 'bg-zinc-400 text-zinc-900',
  holiday: 'bg-emerald-500/70 text-white',
};

const iso = (d: Date) => d.toLocaleDateString('en-CA');
const parse = (s: string) => new Date(s + 'T00:00:00');

const emptyDraft = (date: string) => ({
  title: '',
  description: '',
  start_date: date,
  end_date: date,
  all_day: true,
  start_time: '',
  end_time: '',
  kind: 'event',
  subject_key: '',
  linked_todo_id: '',
  linked_note_id: '',
  linked_habit_id: '',
  linked_kanban_id: '',
});

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [kanban, setKanban] = useState<KanbanTask[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft(iso(new Date())));
  const [showForm, setShowForm] = useState(false);

  const loadData = useCallback(async () => {
    const [todoRes, kanbanRes, noteRes, habitRes] = await Promise.all([
      supabase.from('todos').select('*'),
      supabase.from('kanban_tasks').select('*'),
      supabase.from('notes').select('*').order('updated_at', { ascending: false }).limit(50),
      supabase.from('habits').select('*'),
    ]);

    const todoData = (todoRes.data ?? []) as Todo[];
    const kanbanData = (kanbanRes.data ?? []) as KanbanTask[];
    setTodos(todoData);
    setKanban(kanbanData);
    setNotes((noteRes.data ?? []) as Note[]);
    setHabits((habitRes.data ?? []) as Habit[]);
    setEvents(getCalendarEvents());

    const items: DeadlineItem[] = [];
    todoData.forEach((t) => {
      if (t.due_date) items.push({ id: t.id, title: t.title, date: t.due_date, source: 'todo', subject_key: t.subject_key, status: t.completed ? 'done' : 'active' });
    });
    kanbanData.forEach((t) => {
      if (t.due_date) items.push({ id: t.id, title: t.title, date: t.due_date, source: 'kanban', subject_key: t.subject_key, status: t.status });
    });
    setDeadlines(items);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const sync = () => setEvents(getCalendarEvents());
    window.addEventListener(CALENDAR_EVENTS_UPDATED, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CALENDAR_EVENTS_UPDATED, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const openForm = (date: string) => {
    setDraft(emptyDraft(date));
    setSelectedDay(date);
    setShowForm(true);
  };

  const saveEvent = async () => {
    if (!draft.title.trim()) return;
    addCalendarEvent({
      title: draft.title.trim(),
      description: draft.description,
      start_date: draft.start_date,
      end_date: draft.end_date < draft.start_date ? draft.start_date : draft.end_date,
      all_day: draft.all_day,
      start_time: draft.all_day ? null : draft.start_time || null,
      end_time: draft.all_day ? null : draft.end_time || null,
      kind: draft.kind as CalendarEvent['kind'],
      subject_key: (draft.subject_key || null) as SubjectKey | null,
      linked_todo_id: draft.linked_todo_id || null,
      linked_note_id: draft.linked_note_id || null,
      linked_habit_id: draft.linked_habit_id || null,
      linked_kanban_id: draft.linked_kanban_id || null,
    });
    setEvents(getCalendarEvents());
    setShowForm(false);
  };

  const deleteEvent = async (id: string) => {
    deleteCalendarEvent(id);
    setEvents(getCalendarEvents());
  };


  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = today.toDateString();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const deadlinesByDay: Record<number, DeadlineItem[]> = {};
  deadlines.forEach((d) => {
    const dDate = parse(d.date);
    if (dDate.getFullYear() === year && dDate.getMonth() === month) {
      (deadlinesByDay[dDate.getDate()] ??= []).push(d);
    }
  });

  const eventsForDay = (dayIso: string) =>
    events.filter((e) => e.start_date <= dayIso && e.end_date >= dayIso);

  const upcomingDeadlines = deadlines
    .filter((d) => parse(d.date) >= new Date(todayStr) && d.status !== 'done')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  const upcomingEvents = events
    .filter((e) => e.end_date >= iso(today))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 8);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><CalendarIcon className="w-8 h-8 text-zinc-300 animate-pulse" /></div>;
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];
  const selectedDeadlines = selectedDay ? deadlines.filter((d) => d.date === selectedDay) : [];

  const linkLabel = (e: CalendarEvent) => {
    if (e.linked_todo_id) return todos.find((t) => t.id === e.linked_todo_id)?.title;
    if (e.linked_kanban_id) return kanban.find((t) => t.id === e.linked_kanban_id)?.title;
    if (e.linked_note_id) return notes.find((n) => n.id === e.linked_note_id)?.title;
    if (e.linked_habit_id) return habits.find((h) => h.id === e.linked_habit_id)?.name;
    return null;
  };

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Events, multi-day plans and every deadline in one view"
        action={<Button onClick={() => openForm(iso(today))}><Plus className="w-4 h-4" /> New event</Button>}
      />




      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-800">{monthName}</h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-zinc-200/50"><ChevronLeft className="w-4 h-4 text-zinc-600" /></button>
                <button onClick={() => setCurrentDate(new Date())} className="px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200/50 rounded-lg">Today</button>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-zinc-200/50"><ChevronRight className="w-4 h-4 text-zinc-600" /></button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {weekDays.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-zinc-400 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayDate = new Date(year, month, day);
                const dayIso = iso(dayDate);
                const isToday = dayDate.toDateString() === todayStr;
                const isSelected = selectedDay === dayIso;
                const dayDeadlines = deadlinesByDay[day] ?? [];
                const dayEvents = eventsForDay(dayIso);
                const hasOverdue = dayDeadlines.some((d) => d.status !== 'done' && dayDate < new Date(todayStr));

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(dayIso)}
                    onDoubleClick={() => openForm(dayIso)}
                    className={`min-h-[72px] p-1 rounded-xl border text-xs text-left transition-all ${
                      isSelected
                        ? 'border-zinc-800 bg-white/70'
                        : isToday
                          ? 'border-zinc-800 bg-zinc-100/50'
                          : 'border-zinc-200/30 hover:border-zinc-300/50 hover:bg-white/40'
                    }`}
                  >
                    <div className={`text-right font-medium ${isToday ? 'text-zinc-900' : 'text-zinc-500'}`}>
                      {day}
                    </div>
                    {dayEvents.slice(0, 2).map((e) => (
                      <div
                        key={e.id}
                        className={`mt-0.5 px-1 py-0.5 rounded text-[10px] truncate ${KIND_STYLE[e.kind] ?? KIND_STYLE.event} ${
                          e.start_date !== e.end_date ? 'rounded-none first:rounded-l last:rounded-r' : ''
                        }`}
                      >
                        {e.title}
                      </div>
                    ))}
                    {dayDeadlines.slice(0, 2).map((d) => (
                      <div
                        key={d.id}
                        className={`mt-0.5 px-1 py-0.5 rounded text-[10px] truncate bg-zinc-200/60 text-zinc-600 ${d.status === 'done' ? 'opacity-50 line-through' : ''}`}
                      >
                        {d.title}
                      </div>
                    ))}
                    {dayEvents.length + dayDeadlines.length > 4 && (
                      <div className="text-[10px] text-zinc-400 mt-0.5">+{dayEvents.length + dayDeadlines.length - 4} more</div>
                    )}
                    {hasOverdue && <AlertCircle className="w-3 h-3 text-zinc-700 mt-0.5" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-zinc-400 mt-3">Tip: click a day to see it, double-click to add an event.</p>
          </Card>

          {/* Selected day panel */}
          {selectedDay && (
            <Card className="p-5 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-zinc-800">
                  {parse(selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <Button size="sm" variant="secondary" onClick={() => openForm(selectedDay)}>
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
              {selectedEvents.length === 0 && selectedDeadlines.length === 0 ? (
                <p className="text-sm text-zinc-400">Nothing scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((e) => {
                    const link = linkLabel(e);
                    const subj = SUBJECTS.find((s) => s.key === e.subject_key);
                    return (
                      <div key={e.id} className="flex items-start gap-3 p-2 rounded-xl glass">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0 ${KIND_STYLE[e.kind] ?? KIND_STYLE.event}`}>
                          {e.kind}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800">{e.title}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {subj && <SubjectBadge shortName={subj.shortName} />}
                            {e.start_date !== e.end_date && (
                              <span className="text-[11px] text-zinc-400">{e.start_date} → {e.end_date}</span>
                            )}
                            {!e.all_day && e.start_time && (
                              <span className="text-[11px] text-zinc-400">{e.start_time}{e.end_time ? `–${e.end_time}` : ''}</span>
                            )}
                            {link && (
                              <span className="text-[11px] text-zinc-500 inline-flex items-center gap-1">
                                <Link2 className="w-3 h-3" /> {link}
                              </span>
                            )}
                          </div>
                          {e.description && <p className="text-xs text-zinc-500 mt-1">{e.description}</p>}
                        </div>
                        <button onClick={() => deleteEvent(e.id)} className="p-1 rounded-lg hover:bg-zinc-200/60">
                          <Trash2 className="w-3.5 h-3.5 text-zinc-400" />
                        </button>
                      </div>
                    );
                  })}
                  {selectedDeadlines.map((d) => (
                    <div key={`${d.source}-${d.id}`} className="flex items-center gap-3 p-2 rounded-xl glass">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-200/70 text-zinc-600 shrink-0">
                        {d.source === 'todo' ? 'to-do' : 'kanban'}
                      </span>
                      <p className={`text-sm text-zinc-700 flex-1 ${d.status === 'done' ? 'line-through opacity-60' : ''}`}>{d.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="font-semibold text-zinc-800 mb-4">Upcoming events</h3>
            {upcomingEvents.length === 0 ? (
              <EmptyState icon={CalendarIcon} title="No events yet" subtitle="Create one to plan ahead." />
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((e) => {
                  const d = parse(e.start_date);
                  return (
                    <button
                      key={e.id}
                      onClick={() => { setCurrentDate(d); setSelectedDay(e.start_date); }}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/40 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 bg-zinc-200 text-zinc-700">
                        <span className="text-xs font-medium leading-none">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className="text-sm font-bold leading-none">{d.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-700 truncate">{e.title}</p>
                        <span className="text-xs text-zinc-400">
                          {e.start_date === e.end_date ? e.kind : `${e.kind} · until ${e.end_date}`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold text-zinc-800 mb-4">Upcoming deadlines</h3>
            {upcomingDeadlines.length === 0 ? (
              <EmptyState icon={CalendarIcon} title="No upcoming deadlines" subtitle="Add due dates to your tasks to see them here." />
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.map((d) => {
                  const subj = SUBJECTS.find((s) => s.key === d.subject_key);
                  const dDate = parse(d.date);
                  const daysAway = Math.ceil((dDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={`${d.source}-${d.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/40 transition-colors">
                      <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                        daysAway <= 1 ? 'bg-zinc-900 text-white' : daysAway <= 3 ? 'bg-zinc-400 text-zinc-900' : 'bg-zinc-200 text-zinc-600'
                      }`}>
                        <span className="text-xs font-medium leading-none">{dDate.toLocaleDateString('en-US', { month: 'short' })}</span>
                        <span className="text-sm font-bold leading-none">{dDate.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-700 truncate">{d.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {subj && <SubjectBadge shortName={subj.shortName} />}
                          <span className="text-xs text-zinc-400">
                            {daysAway <= 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `In ${daysAway} days`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* New event modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/30 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="glass glass-shadow-lg rounded-2xl w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-zinc-800">New calendar event</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-zinc-200/60"><X className="w-4 h-4 text-zinc-500" /></button>
            </div>

            <div className="space-y-3">
              <Input value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} placeholder="Event title" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Starts</label>
                  <input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} className="w-full px-3 py-2 glass-input rounded-xl text-sm text-zinc-800" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Ends</label>
                  <input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} className="w-full px-3 py-2 glass-input rounded-xl text-sm text-zinc-800" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input type="checkbox" checked={draft.all_day} onChange={(e) => setDraft({ ...draft, all_day: e.target.checked })} />
                All day
              </label>

              {!draft.all_day && (
                <div className="grid grid-cols-2 gap-3">
                  <input type="time" value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} className="w-full px-3 py-2 glass-input rounded-xl text-sm text-zinc-800" />
                  <input type="time" value={draft.end_time} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} className="w-full px-3 py-2 glass-input rounded-xl text-sm text-zinc-800" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Select value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v })} options={KINDS} />
                <Select
                  value={draft.subject_key}
                  onChange={(v) => setDraft({ ...draft, subject_key: v })}
                  options={[{ value: '', label: 'No subject' }, ...SUBJECTS.map((s) => ({ value: s.key, label: s.name }))]}
                />
              </div>

              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Details (optional)"
                rows={2}
                className="w-full px-3 py-2 glass-input rounded-xl text-sm text-zinc-800 placeholder-zinc-400 resize-none"
              />

              <div className="pt-1">
                <p className="text-xs font-semibold text-zinc-500 mb-2 flex items-center gap-1"><Link2 className="w-3 h-3" /> Connect to the rest of the app</p>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    value={draft.linked_todo_id}
                    onChange={(v) => setDraft({ ...draft, linked_todo_id: v })}
                    options={[{ value: '', label: 'Link a to-do…' }, ...todos.map((t) => ({ value: t.id, label: t.title }))]}
                  />
                  <Select
                    value={draft.linked_kanban_id}
                    onChange={(v) => setDraft({ ...draft, linked_kanban_id: v })}
                    options={[{ value: '', label: 'Link a kanban card…' }, ...kanban.map((t) => ({ value: t.id, label: t.title }))]}
                  />
                  <Select
                    value={draft.linked_note_id}
                    onChange={(v) => setDraft({ ...draft, linked_note_id: v })}
                    options={[{ value: '', label: 'Link a note…' }, ...notes.map((n) => ({ value: n.id, label: n.title }))]}
                  />
                  <Select
                    value={draft.linked_habit_id}
                    onChange={(v) => setDraft({ ...draft, linked_habit_id: v })}
                    options={[{ value: '', label: 'Link a habit…' }, ...habits.map((h) => ({ value: h.id, label: h.name }))]}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button onClick={saveEvent}>Save event</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
