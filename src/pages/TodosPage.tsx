import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SUBJECTS, type Todo, type SubjectKey } from '@/lib/types';
import { Card, PageHeader, Button, Input, Select, EmptyState, SubjectBadge } from '@/components/kit';
import { CheckSquare, Plus, Trash2, Check, Circle, AlertCircle, Flag } from 'lucide-react';

const PRIORITY_CONFIG = {
  urgent_important: { label: 'Urgent & Important', short: 'Do First', tone: 'high' as const, quadrant: 1 },
  not_urgent_important: { label: 'Important, Not Urgent', short: 'Schedule', tone: 'mid' as const, quadrant: 2 },
  urgent_not_important: { label: 'Urgent, Not Important', short: 'Delegate', tone: 'low' as const, quadrant: 3 },
  not_urgent_not_important: { label: 'Not Urgent or Important', short: 'Eliminate', tone: 'default' as const, quadrant: 4 },
} as const;

type PriorityKey = keyof typeof PRIORITY_CONFIG;
type Filter = 'all' | 'active' | 'completed' | PriorityKey;

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', subject_key: '', due_date: '', priority: 'not_urgent_important' as PriorityKey });

  const loadTodos = useCallback(async () => {
    const { data } = await supabase.from('todos').select('*').order('created_at', { ascending: false });
    if (data) setTodos(data as Todo[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadTodos(); }, [loadTodos]);

  const addTodo = async () => {
    if (!form.title.trim()) return;
    const { data } = await supabase.from('todos').insert({
      title: form.title.trim(),
      subject_key: form.subject_key || null,
      due_date: form.due_date || null,
      priority: form.priority,
    }).select().single();
    if (data) {
      setTodos([data as Todo, ...todos]);
      setForm({ title: '', subject_key: '', due_date: '', priority: 'not_urgent_important' });
      setShowForm(false);
    }
  };

  const toggleTodo = async (todo: Todo) => {
    const { data } = await supabase.from('todos').update({ completed: !todo.completed }).eq('id', todo.id).select().single();
    if (data) setTodos(todos.map((t) => t.id === todo.id ? data as Todo : t));
  };

  const deleteTodo = async (id: string) => {
    await supabase.from('todos').delete().eq('id', id);
    setTodos(todos.filter((t) => t.id !== id));
  };

  const filtered = todos.filter((t) => {
    if (filter === 'all') return true;
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return t.priority === filter;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const pq = PRIORITY_CONFIG[a.priority as PriorityKey].quadrant - PRIORITY_CONFIG[b.priority as PriorityKey].quadrant;
    if (pq !== 0) return pq;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  const activeCount = todos.filter((t) => !t.completed).length;
  const completedCount = todos.filter((t) => t.completed).length;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><CheckSquare className="w-8 h-8 text-zinc-300 animate-pulse" /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Master To-Do List"
        subtitle="Eisenhower Matrix priority · Urgent vs Important"
        action={<Button onClick={() => setShowForm(!showForm)}><Plus className="w-4 h-4" /> Add Task</Button>}
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-zinc-800">{todos.length}</div>
          <div className="text-xs text-zinc-500">Total Tasks</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-zinc-800">{activeCount}</div>
          <div className="text-xs text-zinc-500">Pending</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-zinc-800">{completedCount}</div>
          <div className="text-xs text-zinc-500">Completed</div>
        </Card>
      </div>

      {showForm && (
        <Card className="p-4 mb-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Title</label>
              <Input value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="What needs to be done?" />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Subject</label>
              <Select
                value={form.subject_key}
                onChange={(v) => setForm({ ...form, subject_key: v })}
                options={[{ value: '', label: 'None' }, ...SUBJECTS.map((s) => ({ value: s.key, label: s.shortName }))]}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Due Date</label>
              <Input value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} type="date" />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Priority (Eisenhower Matrix)</label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {(Object.keys(PRIORITY_CONFIG) as PriorityKey[]).map((key) => {
                  const p = PRIORITY_CONFIG[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setForm({ ...form, priority: key })}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                        form.priority === key
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'glass text-zinc-600 border-transparent glass-hover'
                      }`}
                    >
                      <Flag className="w-3 h-3 inline mr-1" />
                      {p.short}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={addTodo} size="sm">Add Task</Button>
            <Button onClick={() => setShowForm(false)} variant="ghost" size="sm">Cancel</Button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'active', 'completed'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all capitalize ${
              filter === f ? 'bg-zinc-900 text-white' : 'glass text-zinc-600 glass-hover'
            }`}
          >
            {f}
          </button>
        ))}
        <div className="w-px h-6 bg-zinc-300 mx-1 self-center" />
        {(Object.keys(PRIORITY_CONFIG) as PriorityKey[]).map((key) => {
          const p = PRIORITY_CONFIG[key];
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                filter === key ? 'bg-zinc-700 text-white' : 'glass text-zinc-600 glass-hover'
              }`}
            >
              {p.short}
            </button>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks found" subtitle="Add a task to get started with your to-do list." />
      ) : (
        <div className="space-y-2">
          {sorted.map((todo) => {
            const subj = SUBJECTS.find((s) => s.key === todo.subject_key);
            const p = PRIORITY_CONFIG[todo.priority as PriorityKey];
            const overdue = todo.due_date && !todo.completed && new Date(todo.due_date) < new Date(new Date().toDateString());

            return (
              <Card key={todo.id} className={`p-3 flex items-center gap-3 group ${todo.completed ? 'opacity-50' : ''}`}>
                <button
                  onClick={() => toggleTodo(todo)}
                  className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                    todo.completed ? 'bg-zinc-900 border-zinc-900' : 'border-zinc-300 hover:border-zinc-600'
                  }`}
                >
                  {todo.completed && <Check className="w-3 h-3 text-white" />}
                </button>

                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${todo.completed ? 'line-through text-zinc-400' : 'text-zinc-700'}`}>
                    {todo.title}
                  </span>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {subj && <SubjectBadge shortName={subj.shortName} />}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      p.tone === 'high' ? 'bg-zinc-900 text-white' :
                      p.tone === 'mid' ? 'bg-zinc-700 text-white' :
                      p.tone === 'low' ? 'bg-zinc-400 text-zinc-900' :
                      'bg-zinc-200 text-zinc-600'
                    }`}>
                      {p.short}
                    </span>
                    {todo.due_date && (
                      <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                        {overdue ? <AlertCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                        {new Date(todo.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="text-zinc-300 hover:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
