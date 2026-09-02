import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SUBJECTS, NUM_TERMS, type Assessment, type Todo, type PomodoroSession } from '@/lib/types';
import { computeFinalGrade, computeGeneralAverage, computeTermGrade } from '@/lib/gradeUtils';
import { Card, EmptyState, SubjectBadge, gradeColor } from '@/components/kit';
import type { PageId } from '@/components/AppLayout';
import {
  TrendingUp, CheckSquare, Timer, Calendar,
  ArrowRight, BookOpen, Target
} from 'lucide-react';

export default function DashboardPage({ navigate }: { navigate: (p: PageId) => void }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const [{ data: aData }, { data: tData }, { data: sData }] = await Promise.all([
      supabase.from('assessments').select('*'),
      supabase.from('todos').select('*').order('created_at', { ascending: false }),
      supabase.from('pomodoro_sessions').select('*'),
    ]);
    if (aData) setAssessments(aData as Assessment[]);
    if (tData) setTodos(tData as Todo[]);
    if (sData) setSessions(sData as PomodoroSession[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const generalAverage = computeGeneralAverage(assessments);
  const activeTodos = todos.filter((t) => !t.completed);
  const todayStr = new Date().toDateString();
  const todayFocus = sessions
    .filter((s) => s.session_type === 'focus' && new Date(s.completed_at).toDateString() === todayStr)
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  const upcomingTodos = activeTodos
    .filter((t) => t.due_date)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    .slice(0, 5);

  const currentTerm = (() => {
    const month = new Date().getMonth();
    if (month >= 5 && month <= 9) return 1;
    if (month >= 10 || month <= 1) return 2;
    return 3;
  })();

  if (loading) {
    return <div className="flex items-center justify-center py-20"><TrendingUp className="w-8 h-8 text-zinc-300 animate-pulse" /></div>;
  }

  return (
    <div>
      <div className="mb-6 glass-dark glass-shadow-lg rounded-3xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative">
          <h2 className="text-xl font-bold mb-1">Welcome to your study hub</h2>
          <p className="text-sm text-zinc-400">Grade 10 · Key Stage 3 · {NUM_TERMS} Terms · {SUBJECTS.length} Subjects</p>
          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => navigate('grades')}
              className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-all"
            >
              <BookOpen className="w-4 h-4" /> Add Grades
            </button>
            <button
              onClick={() => navigate('pomodoro')}
              className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-all"
            >
              <Timer className="w-4 h-4" /> Start Focus Session
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-zinc-700" />
            </div>
            <button onClick={() => navigate('grades')} className="text-zinc-300 hover:text-zinc-600">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-1">General Average</p>
          <div className="text-2xl font-bold text-zinc-800">
            {generalAverage !== null ? generalAverage.toFixed(2) : '—'}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-zinc-700" />
            </div>
            <button onClick={() => navigate('todos')} className="text-zinc-300 hover:text-zinc-600">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-1">Pending Tasks</p>
          <div className="text-2xl font-bold text-zinc-800">{activeTodos.length}</div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center">
              <Timer className="w-5 h-5 text-zinc-700" />
            </div>
            <button onClick={() => navigate('pomodoro')} className="text-zinc-300 hover:text-zinc-600">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-1">Today's Focus</p>
          <div className="text-2xl font-bold text-zinc-800">
            {Math.floor(todayFocus / 60)}h {todayFocus % 60}m
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center">
              <Target className="w-5 h-5 text-zinc-700" />
            </div>
            <button onClick={() => navigate('grades')} className="text-zinc-300 hover:text-zinc-600">
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-zinc-500 mb-1">Current Term</p>
          <div className="text-2xl font-bold text-zinc-800">T{currentTerm}</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-800">Subject Grades</h3>
            <button onClick={() => navigate('grades')} className="text-xs text-zinc-600 hover:text-zinc-900 font-medium">
              View all →
            </button>
          </div>
          {assessments.length === 0 ? (
            <EmptyState icon={BookOpen} title="No grades yet" subtitle="Add your assessment scores to see your grades here." />
          ) : (
            <div className="space-y-2">
              {SUBJECTS.map((s) => {
                const fg = computeFinalGrade(s.key, assessments);
                const tg = computeTermGrade(s.key, currentTerm, assessments);
                return (
                  <button
                    key={s.key}
                    onClick={() => navigate('grades')}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/40 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <SubjectBadge shortName={s.shortName} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-400">T{currentTerm}: {tg !== null ? tg.toFixed(1) : '—'}</span>
                      <span className={`text-sm font-bold ${gradeColor(fg)}`}>
                        {fg !== null ? fg.toFixed(2) : '—'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-zinc-800">Upcoming Deadlines</h3>
            <button onClick={() => navigate('calendar')} className="text-xs text-zinc-600 hover:text-zinc-900 font-medium">
              View calendar →
            </button>
          </div>
          {upcomingTodos.length === 0 ? (
            <EmptyState icon={Calendar} title="No upcoming deadlines" subtitle="Add due dates to your tasks to see them here." />
          ) : (
            <div className="space-y-2">
              {upcomingTodos.map((todo) => {
                const dDate = new Date(todo.due_date! + 'T00:00:00');
                const daysAway = Math.ceil((dDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={todo.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/40 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                      daysAway <= 1 ? 'bg-zinc-900 text-white' : daysAway <= 3 ? 'bg-zinc-400 text-zinc-900' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      <span className="text-[10px] font-medium leading-none">{dDate.toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="text-sm font-bold leading-none">{dDate.getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-700 truncate">{todo.title}</p>
                      <span className="text-xs text-zinc-400">
                        {daysAway <= 0 ? 'Today' : daysAway === 1 ? 'Tomorrow' : `In ${daysAway} days`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
