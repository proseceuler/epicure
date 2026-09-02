import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SUBJECTS, type PomodoroSession } from '@/lib/types';
import { Card, PageHeader, EmptyState } from '@/components/kit';
import { BarChart3, Clock, Flame, Target } from 'lucide-react';

export default function AnalyticsPage() {
  const [sessions, setSessions] = useState<PomodoroSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'week' | 'month'>('week');

  const loadSessions = useCallback(async () => {
    const { data } = await supabase.from('pomodoro_sessions').select('*').order('completed_at', { ascending: false });
    if (data) setSessions(data as PomodoroSession[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const focusSessions = sessions.filter((s) => s.session_type === 'focus');
  const now = new Date();
  const days = range === 'week' ? 7 : 30;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days + 1);

  const byDay: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    byDay[d.toDateString()] = 0;
  }

  focusSessions.forEach((s) => {
    const key = new Date(s.completed_at).toDateString();
    if (key in byDay) byDay[key] += s.duration_minutes;
  });

  const dayLabels = Object.keys(byDay);
  const dayValues = Object.values(byDay);
  const maxMinutes = Math.max(...dayValues, 60);
  const totalMinutes = dayValues.reduce((sum, v) => sum + v, 0);
  const totalSessions = focusSessions.filter((s) => new Date(s.completed_at) >= startDate).length;

  const bySubject: Record<string, number> = {};
  focusSessions
    .filter((s) => new Date(s.completed_at) >= startDate)
    .forEach((s) => {
      const key = s.subject_key ?? 'general';
      bySubject[key] = (bySubject[key] ?? 0) + s.duration_minutes;
    });

  const subjectEntries = Object.entries(bySubject).sort((a, b) => b[1] - a[1]);
  const totalSubjectMinutes = subjectEntries.reduce((sum, [, v]) => sum + v, 0);

  let streak = 0;
  const todayKey = now.toDateString();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toDateString();
    if (byDay[key] && byDay[key] > 0) streak++;
    else if (i > 0) break;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><BarChart3 className="w-8 h-8 text-zinc-300 animate-pulse" /></div>;
  }

  const barColor = (val: number) => {
    if (val === 0) return 'bg-zinc-200/50';
    if (val < 25) return 'bg-zinc-300';
    if (val < 50) return 'bg-zinc-500';
    if (val < 75) return 'bg-zinc-700';
    return 'bg-zinc-900';
  };

  return (
    <div>
      <PageHeader
        title="Focus Analytics"
        subtitle="Track your study time and build productive habits"
        action={
          <div className="flex gap-2 p-1 glass rounded-xl">
            <button
              onClick={() => setRange('week')}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${range === 'week' ? 'bg-zinc-900 text-white' : 'text-zinc-500'}`}
            >
              Week
            </button>
            <button
              onClick={() => setRange('month')}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${range === 'month' ? 'bg-zinc-900 text-white' : 'text-zinc-500'}`}
            >
              Month
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">Total Focus Time</span>
          </div>
          <div className="text-2xl font-bold text-zinc-800">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">Focus Sessions</span>
          </div>
          <div className="text-2xl font-bold text-zinc-800">{totalSessions}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">Day Streak</span>
          </div>
          <div className="text-2xl font-bold text-zinc-800">{streak}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-4 h-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">Daily Average</span>
          </div>
          <div className="text-2xl font-bold text-zinc-800">{Math.round(totalMinutes / days)}m</div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h3 className="font-semibold text-zinc-800 mb-4">Daily Focus Time</h3>
            {totalMinutes === 0 ? (
              <EmptyState icon={BarChart3} title="No focus data yet" subtitle="Complete a pomodoro session to see your analytics here." />
            ) : (
              <div className="flex items-end gap-1 h-48">
                {dayLabels.map((label, i) => {
                  const val = dayValues[i];
                  const height = val > 0 ? Math.max((val / maxMinutes) * 100, 4) : 0;
                  const d = new Date(label);
                  const isToday = label === todayKey;
                  return (
                    <div key={label} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {val > 0 ? `${val}m` : ''}
                      </div>
                      <div
                        className={`w-full rounded-t transition-all ${barColor(val)} ${isToday ? 'ring-2 ring-zinc-400 ring-offset-1' : ''}`}
                        style={{ height: `${height}%`, minHeight: val > 0 ? '4px' : '0' }}
                      />
                      <span className="text-[9px] text-zinc-400">
                        {range === 'week' ? d.toLocaleDateString('en-US', { weekday: 'short' }) : d.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="font-semibold text-zinc-800 mb-4">By Subject</h3>
          {subjectEntries.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {subjectEntries.map(([key, minutes]) => {
                const subj = SUBJECTS.find((s) => s.key === key);
                const pct = totalSubjectMinutes > 0 ? (minutes / totalSubjectMinutes) * 100 : 0;
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-zinc-600">{subj ? subj.shortName : 'General'}</span>
                      <span className="text-xs text-zinc-400">{minutes}m</span>
                    </div>
                    <div className="h-2 bg-zinc-200/50 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-zinc-900" style={{ width: `${pct}%`, transition: 'width 0.3s' }} />
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
