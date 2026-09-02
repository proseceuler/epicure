import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { PomodoroSettings, SubjectKey } from '@/lib/types';

type SessionType = 'focus' | 'short_break' | 'long_break';

interface PomodoroState {
  isRunning: boolean;
  timeLeft: number;
  sessionType: SessionType;
  settings: PomodoroSettings | null;
  dockOpen: boolean;
  isFloating: boolean;
  completedFocus: number;
  activeSubject: SubjectKey | null;
  linkedTodoId: string | null;
  lastCompletedAt: string | null;
  setSessionContext: (subject: SubjectKey | null, todoId: string | null) => void;
  updateSettings: (updates: Partial<PomodoroSettings>) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  switchType: (type: SessionType) => void;
  setDockOpen: (open: boolean) => void;
  snapBack: () => void;
  floatAway: () => void;
  getDuration: (type: SessionType) => number;
}

const PomodoroContext = createContext<PomodoroState | undefined>(undefined);

export function PomodoroProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PomodoroSettings | null>(null);
  const [sessionType, setSessionType] = useState<SessionType>('focus');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedFocus, setCompletedFocus] = useState(0);
  const [activeSubject, setActiveSubject] = useState<SubjectKey | null>(null);
  const [linkedTodoId, setLinkedTodoId] = useState<string | null>(null);
  const [lastCompletedAt, setLastCompletedAt] = useState<string | null>(null);
  const [dockOpen, setDockOpen] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.from('pomodoro_settings').select('*').maybeSingle().then(({ data }) => {
      if (data) {
        setSettings(data as PomodoroSettings);
        setTimeLeft((data as PomodoroSettings).focus_duration * 60);
      } else {
        supabase.from('pomodoro_settings').insert({
          focus_duration: 25, short_break_duration: 5, long_break_duration: 15, sessions_before_long_break: 4,
          ambient_volume: 0.5, ambient_type: 'rain',
        }).select().single().then(({ data: created }) => {
          if (created) { setSettings(created as PomodoroSettings); setTimeLeft(25 * 60); }
        });
      }
    });
  }, []);

  const getDuration = useCallback((type: SessionType): number => {
    if (!settings) return 25 * 60;
    if (type === 'focus') return settings.focus_duration * 60;
    if (type === 'short_break') return settings.short_break_duration * 60;
    return settings.long_break_duration * 60;
  }, [settings]);

  const handleComplete = useCallback(async () => {
    setIsRunning(false);
    if (sessionType === 'focus') {
      const newCount = completedFocus + 1;
      setCompletedFocus(newCount);
      await supabase.from('pomodoro_sessions').insert({
        subject_key: activeSubject,
        linked_todo_id: linkedTodoId,
        duration_minutes: settings?.focus_duration ?? 25,
        session_type: 'focus',
      });
      setLastCompletedAt(new Date().toISOString());
      const nextType: SessionType = newCount % (settings?.sessions_before_long_break ?? 4) === 0 ? 'long_break' : 'short_break';
      setSessionType(nextType);
      setTimeLeft(getDuration(nextType));
    } else {
      await supabase.from('pomodoro_sessions').insert({
        subject_key: activeSubject,
        linked_todo_id: linkedTodoId,
        duration_minutes: sessionType === 'short_break' ? settings?.short_break_duration ?? 5 : settings?.long_break_duration ?? 15,
        session_type: sessionType,
      });
      setSessionType('focus');
      setTimeLeft(getDuration('focus'));
    }
  }, [sessionType, completedFocus, settings, getDuration, activeSubject, linkedTodoId]);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, handleComplete]);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(getDuration(sessionType));
  }, [getDuration, sessionType]);

  const switchType = useCallback((type: SessionType) => {
    setIsRunning(false);
    setSessionType(type);
    setTimeLeft(getDuration(type));
  }, [getDuration]);

  const setSessionContext = useCallback((subject: SubjectKey | null, todoId: string | null) => {
    setActiveSubject(subject);
    setLinkedTodoId(todoId);
  }, []);

  const updateSettings = useCallback((updates: Partial<PomodoroSettings>) => {
    setSettings((current) => current ? { ...current, ...updates } : current);
  }, []);

  const floatAway = useCallback(() => setIsFloating(true), []);
  const snapBack = useCallback(() => setIsFloating(false), []);

  return (
    <PomodoroContext.Provider value={{
      isRunning, timeLeft, sessionType, settings, dockOpen, isFloating, completedFocus,
      activeSubject, linkedTodoId, lastCompletedAt, setSessionContext, updateSettings,
      start, pause, reset, switchType, setDockOpen, snapBack, floatAway, getDuration,
    }}>
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoro() {
  const ctx = useContext(PomodoroContext);
  if (!ctx) throw new Error('usePomodoro must be used within PomodoroProvider');
  return ctx;
}
