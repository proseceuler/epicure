import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { type Habit, type HabitCompletion, type WellnessLog } from '@/lib/types';
import { Card, PageHeader, Button } from '@/components/kit';
import {
  Plus, Trash2, Check, Flame, Trophy, Smile,
} from 'lucide-react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DEFAULT_HABITS = [
  { name: 'Woke up at 05:00', emoji: '⏰', goal_target: 30 },
  { name: 'Gym', emoji: '💪', goal_target: 25 },
  { name: 'Reading / Learning', emoji: '📚', goal_target: 30 },
  { name: 'Project Work', emoji: '🧬', goal_target: 20 },
];

interface DayInfo {
  day: number;
  dateStr: string;
  weekdayIdx: number; // 0=Mon
  weekNum: number;
}

/** Guard against duplicated rows (double seeding / repeat fetches). */
function dedupeHabits(list: Habit[]): Habit[] {
  const seenId = new Set<string>();
  const seenName = new Set<string>();
  const out: Habit[] = [];
  for (const h of list) {
    const nameKey = (h.name ?? '').trim().toLowerCase();
    if (seenId.has(h.id) || seenName.has(nameKey)) continue;
    seenId.add(h.id);
    seenName.add(nameKey);
    out.push(h);
  }
  return out;
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [wellness, setWellness] = useState<WellnessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: '', emoji: '✅', goal: '30' });
  const seededRef = useRef(false);

  const loadData = useCallback(async () => {
    const [{ data: hData }, { data: cData }, { data: wData }] = await Promise.all([
      supabase.from('habits').select('*').order('created_at', { ascending: true }),
      supabase.from('habit_completions').select('*'),
      supabase.from('wellness_log').select('*'),
    ]);
    if (hData) {
      const habitsData = dedupeHabits(hData as Habit[]);
      if (habitsData.length === 0 && !seededRef.current) {
        seededRef.current = true;
        const inserts: Habit[] = [];
        for (const h of DEFAULT_HABITS) {
          const { data } = await supabase
            .from('habits')
            .insert({ name: h.name, emoji: h.emoji, goal_target: h.goal_target, color: 'zinc' })
            .select()
            .single();
          if (data) inserts.push(data as Habit);
        }
        setHabits(dedupeHabits(inserts));
      } else {
        setHabits(habitsData);
      }
    }
    if (cData) setCompletions(cData as HabitCompletion[]);
    if (wData) setWellness(wData as WellnessLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const { monthDays, weeks } = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDow = new Date(selectedYear, selectedMonth, 1).getDay();
    const firstWeekdayIdx = firstDow === 0 ? 6 : firstDow - 1;

    const md: DayInfo[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(selectedYear, selectedMonth, d);
      const dow = date.getDay();
      const weekdayIdx = dow === 0 ? 6 : dow - 1;
      const weekNum = Math.floor((firstWeekdayIdx + d - 1) / 7);
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      md.push({ day: d, dateStr, weekdayIdx, weekNum });
    }
    const numWeeks = md.length ? md[md.length - 1].weekNum + 1 : 0;
    return { monthDays: md, weeks: Array.from({ length: numWeeks }, (_, i) => i) };
  }, [selectedYear, selectedMonth]);

  const isDone = (habitId: string, dateStr: string) =>
    completions.some((c) => c.habit_id === habitId && c.completion_date === dateStr);

  const toggleCompletion = async (habitId: string, dateStr: string) => {
    const existing = completions.find((c) => c.habit_id === habitId && c.completion_date === dateStr);
    if (existing) {
      await supabase.from('habit_completions').delete().eq('id', existing.id);
      setCompletions(completions.filter((c) => c.id !== existing.id));
    } else {
      const { data } = await supabase.from('habit_completions').insert({
        habit_id: habitId, completion_date: dateStr,
      }).select().single();
      if (data) setCompletions([...completions, data as HabitCompletion]);
    }
  };

  const habitStats = habits.map((habit) => {
    const monthCompletions = monthDays.filter((d) => isDone(habit.id, d.dateStr)).length;
    const goal = habit.goal_target;
    const left = Math.max(0, goal - monthCompletions);
    const pct = goal > 0 ? Math.min((monthCompletions / goal) * 100, 100) : 0;
    const streak = getStreak(habit.id, completions);
    const bestStreak = getBestStreak(habit.id, completions);
    return { habit, completed: monthCompletions, goal, left, pct, streak, bestStreak };
  });

  const totalGoal = habitStats.reduce((sum, s) => sum + s.goal, 0);
  const totalCompleted = habitStats.reduce((sum, s) => sum + s.completed, 0);
  const totalLeft = Math.max(0, totalGoal - totalCompleted);
  const overallPct = totalGoal > 0 ? Math.min((totalCompleted / totalGoal) * 100, 100) : 0;

  const dailyProgress = monthDays.map((d) => {
    const count = habits.filter((h) => isDone(h.id, d.dateStr)).length;
    return { day: d.day, count, max: habits.length };
  });

  const weeklyProgress = weeks.map((weekIdx) => {
    const weekDays = monthDays.filter((d) => d.weekNum === weekIdx);
    const count = weekDays.filter((d) => habits.some((h) => isDone(h.id, d.dateStr))).length;
    return { week: weekIdx + 1, count, max: weekDays.length * Math.max(habits.length, 1) };
  });

  const leaderboard = habits.map((habit) => {
    const count = completions.filter((c) => c.habit_id === habit.id).length;
    return { habit, count };
  }).sort((a, b) => b.count - a.count).slice(0, 10);

  const getWellnessForDay = (dateStr: string) => wellness.find((w) => w.log_date === dateStr);
  const updateWellness = async (dateStr: string, field: 'mood' | 'sleep_hours', value: number) => {
    const existing = getWellnessForDay(dateStr);
    if (existing) {
      const updated = { ...existing, [field]: value };
      await supabase.from('wellness_log').update({ [field]: value }).eq('id', existing.id);
      setWellness(wellness.map((w) => w.id === existing.id ? updated : w));
    } else {
      const { data } = await supabase.from('wellness_log').insert({
        log_date: dateStr, [field]: value,
      }).select().single();
      if (data) setWellness([...wellness, data as WellnessLog]);
    }
  };

  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  const moodData = monthDays.map((d) => getWellnessForDay(d.dateStr)?.mood ?? 0);
  const sleepData = monthDays.map((d) => getWellnessForDay(d.dateStr)?.sleep_hours ?? 0);

  const addHabit = async () => {
    if (!newHabit.name.trim()) return;
    const { data } = await supabase.from('habits').insert({
      name: newHabit.name.trim(),
      emoji: newHabit.emoji || '✅',
      goal_target: parseInt(newHabit.goal) || 30,
      color: 'zinc',
    }).select().single();
    if (data) {
      setHabits(dedupeHabits([...habits, data as Habit]));
      setNewHabit({ name: '', emoji: '✅', goal: '30' });
      setShowAddForm(false);
    }
  };

  const deleteHabit = async (id: string) => {
    await supabase.from('habit_completions').delete().eq('habit_id', id);
    await supabase.from('habits').delete().eq('id', id);
    setHabits(habits.filter((h) => h.id !== id));
    setCompletions(completions.filter((c) => c.habit_id !== id));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Check className="w-8 h-8 text-zinc-300 animate-pulse" /></div>;
  }

  const donutRadius = 40;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const donutOffset = donutCircumference * (1 - overallPct / 100);

  return (
    <div className="pb-28">
      <PageHeader
        title="Habit Tracker"
        subtitle={`${habits.length} habits · ${MONTHS[selectedMonth]} ${selectedYear}`}
        action={
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="glass-input rounded-xl px-3 py-2 text-sm text-zinc-800"
            >
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="glass-input rounded-xl px-3 py-2 text-sm text-zinc-800"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        }
      />

      {/* Top stats — stack on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <Card className="p-4 min-w-0">
          <p className="text-[10px] text-zinc-400 mb-2 uppercase tracking-wider">Daily Progress ({monthDays.length} days)</p>
          <div className="flex items-end gap-[2px] h-14">
            {dailyProgress.map((d) => {
              const h = d.max > 0 ? (d.count / d.max) * 100 : 0;
              return (
                <div
                  key={d.day}
                  className={`flex-1 rounded-sm min-w-[3px] transition-all ${d.count > 0 ? 'bg-zinc-800' : 'bg-zinc-300/50'}`}
                  style={{ height: `${Math.max(h, 3)}%` }}
                />
              );
            })}
          </div>
        </Card>

        <Card className="p-4 min-w-0">
          <p className="text-[10px] text-zinc-400 mb-2 uppercase tracking-wider">Weekly Trend</p>
          <div className="flex items-end gap-1.5 h-14">
            {weeklyProgress.map((w) => {
              const h = w.max > 0 ? (w.count / w.max) * 100 : 0;
              return (
                <div
                  key={w.week}
                  className={`flex-1 rounded-md min-w-[8px] ${w.count > 0 ? 'bg-zinc-600' : 'bg-zinc-300/50'}`}
                  style={{ height: `${Math.max(h, 5)}%` }}
                />
              );
            })}
          </div>
        </Card>

        <Card className="p-4 flex items-center justify-between gap-4 min-w-0 sm:col-span-2 lg:col-span-1">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-6 text-xs">
              <span className="text-zinc-500">Goal</span>
              <span className="text-zinc-800 font-semibold">{totalGoal}</span>
            </div>
            <div className="flex items-center justify-between gap-6 text-xs">
              <span className="text-zinc-500">Completed</span>
              <span className="text-zinc-900 font-semibold">{totalCompleted}</span>
            </div>
            <div className="flex items-center justify-between gap-6 text-xs">
              <span className="text-zinc-500">Left</span>
              <span className="text-zinc-700 font-semibold">{totalLeft}</span>
            </div>
          </div>
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={donutRadius} fill="none" stroke="rgba(24,24,27,0.12)" strokeWidth="8" />
              <circle cx="50" cy="50" r={donutRadius} fill="none" stroke="#18181b" strokeWidth="8"
                strokeLinecap="round" strokeDasharray={donutCircumference} strokeDashoffset={donutOffset}
                style={{ transition: 'stroke-dashoffset 0.5s' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-base font-bold text-zinc-900">{Math.round(overallPct)}%</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Habit grid */}
      <Card className="overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Header row */}
            <div className="flex items-end border-b border-zinc-200/50">
              <div className="sticky left-0 z-20 glass-sticky w-32 sm:w-44 shrink-0 px-3 py-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                Habit
              </div>
              <div className="flex gap-[3px] px-2 py-2">
                {monthDays.map((d) => (
                  <div key={d.dateStr} className="w-7 text-center leading-tight">
                    <div className="text-[9px] text-zinc-400">{WEEKDAY_LABELS[d.weekdayIdx]}</div>
                    <div className={`text-[10px] ${d.dateStr === todayStr ? 'text-zinc-900 font-bold' : 'text-zinc-500'}`}>{d.day}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Habit rows */}
            {habitStats.map(({ habit, completed, goal, left, pct, streak, bestStreak }) => (
              <div key={habit.id} className="flex items-center border-b border-zinc-200/40 group">
                <div className="sticky left-0 z-20 glass-sticky w-32 sm:w-44 shrink-0 px-3 py-2 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm shrink-0">{habit.emoji}</span>
                    <span className="text-xs text-zinc-800 truncate">{habit.name}</span>
                    <button
                      onClick={() => deleteHabit(habit.id)}
                      aria-label={`Delete ${habit.name}`}
                      className="ml-auto text-zinc-300 hover:text-zinc-600 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                    <span className="flex items-center gap-0.5"><Flame className="w-2.5 h-2.5" />{streak}</span>
                    <span className="hidden sm:inline">best {bestStreak}</span>
                    <span className="text-zinc-600 font-semibold">{completed}/{goal}</span>
                    <span className="hidden sm:inline">L{left}</span>
                  </div>
                  <div className="h-1 w-full bg-zinc-200/70 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-zinc-800 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                <div className="flex gap-[3px] px-2 py-2">
                  {monthDays.map((d) => {
                    const done = isDone(habit.id, d.dateStr);
                    const isToday = d.dateStr === todayStr;
                    return (
                      <button
                        key={d.dateStr}
                        onClick={() => toggleCompletion(habit.id, d.dateStr)}
                        aria-label={`${habit.name} on ${d.dateStr}`}
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition-all shrink-0 ${
                          done ? 'bg-zinc-900 text-white' : 'bg-zinc-200/60 text-zinc-400 hover:bg-zinc-300/70'
                        } ${isToday ? 'ring-1 ring-zinc-500' : ''}`}
                      >
                        {done && <Check className="w-3.5 h-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {showAddForm ? (
          <div className="p-3 flex flex-wrap items-center gap-2 border-t border-zinc-200/50">
            <input
              value={newHabit.emoji}
              onChange={(e) => setNewHabit({ ...newHabit, emoji: e.target.value })}
              className="w-12 px-1 py-2 glass-input rounded-xl text-sm text-center text-zinc-800"
              placeholder="✅"
            />
            <input
              value={newHabit.name}
              onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addHabit()}
              className="flex-1 min-w-[140px] px-3 py-2 glass-input rounded-xl text-sm text-zinc-800"
              placeholder="Habit name"
              autoFocus
            />
            <input
              value={newHabit.goal}
              onChange={(e) => setNewHabit({ ...newHabit, goal: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && addHabit()}
              type="number"
              className="w-16 px-2 py-2 glass-input rounded-xl text-sm text-center text-zinc-800"
              placeholder="30"
            />
            <Button onClick={addHabit} size="sm">Add</Button>
            <Button onClick={() => setShowAddForm(false)} variant="ghost" size="sm">Cancel</Button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full p-3 flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 hover:bg-white/40 transition-all border-t border-zinc-200/50"
          >
            <Plus className="w-4 h-4" /> Add Habit
          </button>
        )}
      </Card>

      {/* Wellness + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-4 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <Smile className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-800">Daily Wellness — {MONTHS[selectedMonth]}</h3>
          </div>

          <div className="overflow-x-auto mb-4">
            <div className="flex gap-1 min-w-max pb-2">
              {monthDays.map((d) => {
                const w = getWellnessForDay(d.dateStr);
                const isToday = d.dateStr === todayStr;
                return (
                  <div key={d.dateStr} className={`flex flex-col items-center gap-1 p-1.5 rounded-lg ${isToday ? 'bg-white/60 ring-1 ring-zinc-400' : ''}`}>
                    <span className="text-[9px] text-zinc-400">{d.day}</span>
                    <select
                      value={w?.mood ?? ''}
                      onChange={(e) => updateWellness(d.dateStr, 'mood', parseInt(e.target.value) || 0)}
                      className="w-11 px-0.5 py-1 glass-input rounded-lg text-[10px] text-zinc-800 cursor-pointer"
                    >
                      <option value="">—</option>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <select
                      value={w?.sleep_hours ?? ''}
                      onChange={(e) => updateWellness(d.dateStr, 'sleep_hours', parseFloat(e.target.value) || 0)}
                      className="w-11 px-0.5 py-1 glass-input rounded-lg text-[10px] text-zinc-800 cursor-pointer"
                    >
                      <option value="">—</option>
                      {[3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((n) => <option key={n} value={n}>{n}h</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-xl p-3">
            <div className="flex items-center gap-4 mb-2">
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <span className="w-3 h-0.5 bg-zinc-800 rounded" /> Mood (1-10)
              </span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                <span className="w-3 h-0.5 bg-zinc-400 rounded" /> Sleep (hrs)
              </span>
            </div>
            <DualAxisChart moodData={moodData} sleepData={sleepData} days={monthDays.length} />
          </div>
        </Card>

        <Card className="p-4 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-800">Top 10 Habits</h3>
          </div>
          <div className="space-y-2">
            {leaderboard.map((entry, i) => (
              <div key={entry.habit.id} className="flex items-center gap-2 text-sm min-w-0">
                <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 ${
                  i === 0 ? 'bg-zinc-900 text-white' : i < 3 ? 'bg-zinc-500 text-white' : 'bg-zinc-200/70 text-zinc-600'
                }`}>{i + 1}</span>
                <span className="text-sm shrink-0">{entry.habit.emoji}</span>
                <span className="flex-1 text-zinc-700 truncate text-xs">{entry.habit.name}</span>
                <span className="text-zinc-500 text-xs tabular-nums shrink-0">{entry.count}x</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            onClick={() => setSelectedMonth(i)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              selectedMonth === i ? 'bg-zinc-900 text-white' : 'glass glass-hover text-zinc-600'
            }`}
          >
            {m.slice(0, 3)}
          </button>
        ))}
      </div>
    </div>
  );
}

function getStreak(habitId: string, completions: HabitCompletion[]): number {
  const dates = completions
    .filter((c) => c.habit_id === habitId)
    .map((c) => c.completion_date);

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dates.includes(dStr)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function getBestStreak(habitId: string, completions: HabitCompletion[]): number {
  const dates = completions
    .filter((c) => c.habit_id === habitId)
    .map((c) => c.completion_date)
    .sort((a, b) => a.localeCompare(b));

  if (dates.length === 0) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00');
    const curr = new Date(dates[i] + 'T00:00:00');
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) { current++; best = Math.max(best, current); }
    else current = 1;
  }
  return best;
}

function DualAxisChart({ moodData, sleepData, days }: { moodData: number[]; sleepData: number[]; days: number }) {
  const width = 600;
  const height = 120;
  const padding = 20;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const moodPoints = moodData.map((val, i) => {
    const x = padding + (i / Math.max(days - 1, 1)) * chartW;
    const y = padding + chartH - (val / 10) * chartH;
    return `${x},${y}`;
  });

  const sleepPoints = sleepData.map((val, i) => {
    const x = padding + (i / Math.max(days - 1, 1)) * chartW;
    const y = padding + chartH - (val / 12) * chartH;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24">
      {[0, 0.5, 1].map((t) => (
        <line key={t} x1={padding} x2={width - padding}
          y1={padding + chartH * t} y2={padding + chartH * t}
          stroke="rgba(24,24,27,0.12)" strokeWidth="0.5" />
      ))}
      <polyline points={moodPoints.join(' ')} fill="none" stroke="#18181b" strokeWidth="1.5" />
      <polyline points={sleepPoints.join(' ')} fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeDasharray="3,2" />
      <text x={4} y={padding + 4} fontSize="8" fill="#71717a">Mood</text>
      <text x={4} y={height - 4} fontSize="8" fill="#a1a1aa">Sleep</text>
    </svg>
  );
}
