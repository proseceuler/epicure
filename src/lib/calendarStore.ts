import type { SubjectKey } from '@/lib/types';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  kind: 'event' | 'deadline' | 'exam' | 'reminder' | 'holiday';
  subject_key: SubjectKey | null;
  linked_todo_id: string | null;
  linked_note_id: string | null;
  linked_habit_id: string | null;
  linked_kanban_id: string | null;
  created_at: string;
}

const KEY = 'calendar_events';

export const CALENDAR_EVENTS_UPDATED = 'calendar-events-updated';

const isBrowser = () => typeof window !== 'undefined';

export function getCalendarEvents(): CalendarEvent[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as CalendarEvent[]) : [];
    return Array.isArray(parsed) ? parsed.sort((a, b) => a.start_date.localeCompare(b.start_date)) : [];
  } catch {
    return [];
  }
}

function persist(events: CalendarEvent[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(KEY, JSON.stringify(events));
  window.dispatchEvent(new CustomEvent(CALENDAR_EVENTS_UPDATED));
}

export function addCalendarEvent(
  input: Omit<CalendarEvent, 'id' | 'created_at'>,
): CalendarEvent {
  const event: CalendarEvent = {
    ...input,
    id:
      isBrowser() && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
  };
  persist([...getCalendarEvents(), event]);
  return event;
}

export function deleteCalendarEvent(id: string) {
  persist(getCalendarEvents().filter((e) => e.id !== id));
}
