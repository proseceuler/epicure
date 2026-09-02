import { supabase } from '@/lib/supabase';
import { SUBJECTS, type SubjectKey } from '@/lib/types';
import { getOpenRouterKey, getDefaultModel } from '@/lib/apiKeys';
import { addCalendarEvent } from '@/lib/calendarStore';

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type Eisenhower = 'do' | 'schedule' | 'delegate' | 'eliminate';

export interface ParsedCalendarEvent {
  title: string;
  start_date: string;
  end_date: string;
  kind: 'event' | 'deadline';
  color: string;
  subject_key: string;
  recurrence: Recurrence;
}

export interface ParsedTodo {
  title: string;
  subject_key: string;
  eisenhower: Eisenhower;
  priority: 'high' | 'medium' | 'low';
  recurrence: Recurrence;
}

export interface ParsedClassHubUpdate {
  subject_key: string;
  notice: string;
}

export interface ParsedAnnouncement {
  calendar_events: ParsedCalendarEvent[];
  todos: ParsedTodo[];
  class_hub_updates: ParsedClassHubUpdate[];
}

const SUBJECT_KEYS = SUBJECTS.map((s) => s.key) as SubjectKey[];

const EISENHOWER_TO_PRIORITY: Record<Eisenhower, string> = {
  do: 'urgent_important',
  schedule: 'not_urgent_important',
  delegate: 'urgent_not_important',
  eliminate: 'not_urgent_not_important',
};

const SYSTEM_PROMPT = (todayISO: string) => `You parse raw school announcements (written in English, Tagalog or a mix) into structured JSON for a Grade 10 student's study app.

Return ONLY valid JSON, no markdown fences, no commentary, matching exactly:
{
  "calendar_events": [
    { "title": string, "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "kind": "event"|"deadline", "color": string, "subject_key": string, "recurrence": "none"|"daily"|"weekly"|"monthly" }
  ],
  "todos": [
    { "title": string, "subject_key": string, "eisenhower": "do"|"schedule"|"delegate"|"eliminate", "priority": "high"|"medium"|"low", "recurrence": "none"|"daily"|"weekly"|"monthly" }
  ],
  "class_hub_updates": [
    { "subject_key": string, "notice": string }
  ]
}

Rules:
- Today is ${todayISO}. The current year is 2026. Convert every relative or partial date ("Monday", "next week", "Sep 5", "December", "bukas", "sa Lunes") into an ISO YYYY-MM-DD date in 2026. If only a month is named, use the 1st of that month. end_date equals start_date unless a range is stated.
- subject_key must be one of: ${SUBJECT_KEYS.join(', ')}. Use "" when no subject is clear.
- Eisenhower: tasks that tag a classmate (@Name) => "delegate"; urgent submissions or things due within ~2 days => "do"; long-term or scheduled work => "schedule"; irrelevant/optional busywork => "eliminate".
- priority: "high" for do/delegate-urgent items, "medium" for scheduled work, "low" for optional items.
- Non-actionable classroom status updates (e.g. "continuation of presentation tomorrow", room changes, teacher notes) go to class_hub_updates, NOT todos.
- recurrence: only "daily"/"weekly"/"monthly" when explicitly stated ("every Monday", "araw-araw"), otherwise "none".
- Anything with a date should also appear in calendar_events; graded submissions use kind "deadline", otherwise "event".
- color: a short tailwind-ish color name such as zinc, red, amber, blue, green, violet.`;

function extractJson(raw: string): ParsedAnnouncement {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('The AI did not return JSON. Try again.');
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Partial<ParsedAnnouncement>;
  return {
    calendar_events: Array.isArray(parsed.calendar_events) ? parsed.calendar_events : [],
    todos: Array.isArray(parsed.todos) ? parsed.todos : [],
    class_hub_updates: Array.isArray(parsed.class_hub_updates) ? parsed.class_hub_updates : [],
  };
}

export async function parseAnnouncement(text: string): Promise<ParsedAnnouncement> {
  const apiKey = getOpenRouterKey();
  if (!apiKey) throw new Error('Add your OpenRouter API key in Settings first.');
  const model = getDefaultModel() || 'nvidia/nemotron-3-ultra-550b-a55b:free';
  const todayISO = new Date().toLocaleDateString('en-CA');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT(todayISO) },
        { role: 'user', content: text },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail?.slice(0, 200) || `Parsing failed (${res.status})`);
  }

  const json = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? '';
  return extractJson(content);
}

const validSubject = (key: string | null | undefined): SubjectKey | null =>
  key && (SUBJECT_KEYS as string[]).includes(key) ? (key as SubjectKey) : null;

const isoDate = (value: string | undefined | null): string | null =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

function weekBounds(date = new Date()) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { from: start.toLocaleDateString('en-CA'), to: end.toLocaleDateString('en-CA') };
}

export interface SyncResult {
  events: number;
  todos: number;
  updates: number;
}

export async function syncAnnouncement(parsed: ParsedAnnouncement): Promise<SyncResult> {
  let events = 0;
  let todos = 0;
  let updates = 0;

  // ── Calendar events: upsert on (title, start_date) so re-pasting doesn't duplicate
  const eventRows = parsed.calendar_events
    .filter((e) => e.title?.trim() && isoDate(e.start_date))
    .map((e) => ({
      title: e.title.trim(),
      description: e.recurrence && e.recurrence !== 'none' ? `Repeats ${e.recurrence}` : '',
      start_date: e.start_date,
      end_date: isoDate(e.end_date) ?? e.start_date,
      all_day: true,
      start_time: null,
      end_time: null,
      kind: e.kind === 'deadline' ? 'deadline' : 'event',
      color: e.color || 'zinc',
      subject_key: validSubject(e.subject_key),
    }));

  if (eventRows.length) {
    const { data, error } = await supabase
      .from('calendar_events')
      .upsert(eventRows, { onConflict: 'title,start_date', ignoreDuplicates: false })
      .select();
    if (error) throw error;
    events = data?.length ?? eventRows.length;
    // Mirror into the local calendar store the Calendar page reads from
    for (const row of eventRows) {
      addCalendarEvent({
        title: row.title,
        description: row.description,
        start_date: row.start_date,
        end_date: row.end_date,
        all_day: true,
        start_time: null,
        end_time: null,
        kind: row.kind as 'event' | 'deadline',
        subject_key: row.subject_key,
        linked_todo_id: null,
        linked_note_id: null,
        linked_habit_id: null,
        linked_kanban_id: null,
      });
    }
  }

  // ── Todos: skip exact title duplicates already created this week
  const candidates = parsed.todos.filter((t) => t.title?.trim());
  if (candidates.length) {
    const { from, to } = weekBounds();
    const { data: existing } = await supabase
      .from('todos')
      .select('title')
      .gte('created_at', `${from}T00:00:00`)
      .lte('created_at', `${to}T23:59:59`);
    const seen = new Set((existing ?? []).map((t: { title: string }) => t.title.trim().toLowerCase()));

    const rows = candidates
      .filter((t) => {
        const key = t.title.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((t) => ({
        title: t.title.trim(),
        subject_key: validSubject(t.subject_key),
        due_date: null,
        priority: EISENHOWER_TO_PRIORITY[t.eisenhower] ?? 'not_urgent_important',
        completed: false,
      }));

    if (rows.length) {
      const { data, error } = await supabase.from('todos').insert(rows).select();
      if (error) throw error;
      todos = data?.length ?? rows.length;
    }
  }

  // ── Class hub notices
  const hubRows = parsed.class_hub_updates
    .filter((u) => u.notice?.trim())
    .map((u) => ({ subject_key: validSubject(u.subject_key) ?? SUBJECT_KEYS[0], notes: u.notice.trim() }));

  if (hubRows.length) {
    const { data, error } = await supabase.from('class_hub').insert(hubRows).select();
    if (error) throw error;
    updates = data?.length ?? hubRows.length;
  }

  return { events, todos, updates };
}
