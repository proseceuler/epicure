import { supabase } from '@/lib/supabase';
import { SUBJECTS, EXPENSE_CATEGORIES } from '@/lib/types';
import { tavilySearch, type SearchResponse } from '@/lib/webSearch';
import { addCalendarEvent, getCalendarEvents } from '@/lib/calendarStore';


const SUBJECT_KEYS = SUBJECTS.map((s) => s.key);
const CATEGORY_KEYS = EXPENSE_CATEGORIES.map((c) => c.key);

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

const obj = (props: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties: props,
  required,
});

const str = (description: string, enumValues?: readonly string[]) =>
  enumValues ? { type: 'string', description, enum: [...enumValues] } : { type: 'string', description };

const num = (description: string) => ({ type: 'number', description });

export const DATA_TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'add_todo',
      description: 'Create a task in the To-Do List.',
      parameters: obj(
        {
          title: str('Task title'),
          subject_key: str('Subject', SUBJECT_KEYS),
          due_date: str('Due date as YYYY-MM-DD'),
          priority: str('Eisenhower priority', [
            'urgent_important',
            'not_urgent_important',
            'urgent_not_important',
            'not_urgent_not_important',
          ]),
        },
        ['title'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_note',
      description: 'Create a note in Notes & Ideas.',
      parameters: obj(
        {
          title: str('Note title'),
          content: str('Note body in markdown'),
          folder: str('Folder name, e.g. "Quick Capture"'),
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags' },
        },
        ['content'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_calendar_event',
      description: 'Add an event, deadline or multi-day range to the Calendar.',
      parameters: obj(
        {
          title: str('Event title'),
          start_date: str('Start date YYYY-MM-DD'),
          end_date: str('End date YYYY-MM-DD for multi-day events'),
          kind: str('Event kind', ['event', 'deadline', 'exam', 'reminder', 'holiday']),
          subject_key: str('Related subject', SUBJECT_KEYS),
          description: str('Extra details'),
          all_day: { type: 'boolean', description: 'Whether the event lasts all day' },
          start_time: str('Start time HH:MM when not all-day'),
          end_time: str('End time HH:MM when not all-day'),
        },
        ['title', 'start_date'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_kanban_task',
      description: 'Create a card on the Kanban board.',
      parameters: obj(
        {
          title: str('Card title'),
          description: str('Card description'),
          status: str('Column', ['todo', 'in_progress', 'review', 'done']),
          subject_key: str('Subject', SUBJECT_KEYS),
          due_date: str('Due date YYYY-MM-DD'),
        },
        ['title'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_flashcard',
      description: 'Create a flashcard, creating the deck if it does not exist yet.',
      parameters: obj(
        {
          deck: str('Deck name'),
          front: str('Question / front side'),
          back: str('Answer / back side'),
          subject_key: str('Subject for a new deck', SUBJECT_KEYS),
        },
        ['deck', 'front', 'back'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_assessment',
      description: 'Record a graded assessment score for a subject.',
      parameters: obj(
        {
          subject_key: str('Subject', SUBJECT_KEYS),
          quarter: num('Quarter number (1-3)'),
          component: str('Component', ['ww', 'pt', 'ex']),
          ex_type: str('Exam type when component is ex', ['st1', 'st2', 'te']),
          name: str('Assessment name'),
          score: num('Score obtained'),
          max_score: num('Maximum score'),
        },
        ['subject_key', 'quarter', 'component', 'name', 'score', 'max_score'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'start_focus_session',
      description: 'Start a Pomodoro focus session, optionally tied to a subject.',
      parameters: obj({ subject_key: str('Subject to focus on', SUBJECT_KEYS) }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_expense',
      description: 'Log a spending entry in the Baon Tracker.',
      parameters: obj(
        {
          category: str('Category', CATEGORY_KEYS),
          amount: num('Amount in pesos'),
          description: str('What it was for'),
          transaction_date: str('Date YYYY-MM-DD, defaults to today'),
        },
        ['category', 'amount'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_habit',
      description: 'Mark a habit as done for a date (defaults to today).',
      parameters: obj({ name: str('Habit name or part of it'), date: str('Date YYYY-MM-DD') }, ['name']),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_todos',
      description: 'Read the current to-do list.',
      parameters: obj({ only_pending: { type: 'boolean', description: 'Only unfinished tasks' } }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_grades',
      description: 'Read recorded assessments and computed averages per subject.',
      parameters: obj({ subject_key: str('Filter by subject', SUBJECT_KEYS), quarter: num('Filter by quarter') }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_calendar',
      description: 'Read calendar events and task deadlines in a date range.',
      parameters: obj({ from: str('Start date YYYY-MM-DD'), to: str('End date YYYY-MM-DD') }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_notes',
      description: 'Search notes by keyword.',
      parameters: obj({ query: str('Keyword to search for') }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_habits',
      description: 'Read habits and which ones are done today.',
      parameters: obj({}),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_finance_summary',
      description: 'Read allowance settings, recent spending and savings goals.',
      parameters: obj({}),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_focus_stats',
      description: 'Read recent Pomodoro focus sessions and total focus minutes.',
      parameters: obj({ days: num('How many days back, default 7') }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_flashcards',
      description: 'Read flashcard decks and cards due for review.',
      parameters: obj({ deck: str('Deck name filter') }),
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_timetable',
      description: 'Read the weekly class timetable.',
      parameters: obj({}),
    },
  },
];

export const SEARCH_TOOL: ToolDef = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Search the live web for current information, facts, news or references. Use whenever the answer depends on up-to-date or external information.',
    parameters: obj({ query: str('Search query'), max_results: num('How many results, default 5') }, ['query']),
  },
};

export interface ToolContext {
  startFocus: (subject: string | null) => void;
  onSearch?: (response: SearchResponse) => void;
}

const today = () => new Date().toLocaleDateString('en-CA');

type Args = Record<string, any>;

export async function runTool(name: string, args: Args, ctx: ToolContext): Promise<unknown> {
  try {
    switch (name) {
      case 'add_todo': {
        const { data, error } = await supabase
          .from('todos')
          .insert({
            title: args.title,
            subject_key: args.subject_key ?? null,
            due_date: args.due_date ?? null,
            priority: args.priority ?? 'not_urgent_important',
            completed: false,
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, todo: data };
      }
      case 'add_note': {
        const title = args.title || String(args.content).split('\n')[0].slice(0, 60) || 'Untitled';
        const { data, error } = await supabase
          .from('notes')
          .insert({
            title,
            content: args.content,
            folder: args.folder ?? 'Quick Capture',
            tags: args.tags ?? [],
            pinned: false,
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, note: data };
      }
      case 'add_calendar_event': {
        const event = addCalendarEvent({
          title: args.title,
          description: args.description ?? '',
          start_date: args.start_date,
          end_date: args.end_date ?? args.start_date,
          all_day: args.all_day ?? true,
          start_time: args.start_time ?? null,
          end_time: args.end_time ?? null,
          kind: args.kind ?? 'event',
          subject_key: args.subject_key ?? null,
          linked_todo_id: null,
          linked_note_id: null,
          linked_habit_id: null,
          linked_kanban_id: null,
        });
        return { ok: true, event };
      }

      case 'add_kanban_task': {
        const { data, error } = await supabase
          .from('kanban_tasks')
          .insert({
            title: args.title,
            description: args.description ?? '',
            status: args.status ?? 'todo',
            subject_key: args.subject_key ?? null,
            due_date: args.due_date ?? null,
            sort_order: 0,
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, task: data };
      }
      case 'add_flashcard': {
        const { data: decks } = await supabase.from('flashcard_decks').select('*').ilike('name', args.deck);
        let deckId = decks?.[0]?.id;
        if (!deckId) {
          const { data: created, error } = await supabase
            .from('flashcard_decks')
            .insert({ name: args.deck, subject_key: args.subject_key ?? null })
            .select()
            .single();
          if (error) throw error;
          deckId = created.id;
        }
        const { data, error } = await supabase
          .from('flashcards')
          .insert({
            deck_id: deckId,
            front: args.front,
            back: args.back,
            interval_days: 1,
            ease_factor: 2.5,
            due_date: today(),
            review_count: 0,
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, card: data };
      }
      case 'add_assessment': {
        const { data, error } = await supabase
          .from('assessments')
          .insert({
            subject_key: args.subject_key,
            quarter: args.quarter,
            component: args.component,
            ex_type: args.ex_type ?? null,
            name: args.name,
            score: args.score,
            max_score: args.max_score,
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, assessment: data };
      }
      case 'start_focus_session': {
        ctx.startFocus(args.subject_key ?? null);
        return { ok: true, message: 'Focus timer started.' };
      }
      case 'log_expense': {
        const { data, error } = await supabase
          .from('finance_transactions')
          .insert({
            category: args.category,
            amount: args.amount,
            description: args.description ?? '',
            transaction_date: args.transaction_date ?? today(),
            is_recurring: false,
          })
          .select()
          .single();
        if (error) throw error;
        return { ok: true, transaction: data };
      }
      case 'mark_habit': {
        const { data: habits } = await supabase.from('habits').select('*');
        const match = habits?.find((h: any) => h.name.toLowerCase().includes(String(args.name).toLowerCase()));
        if (!match) return { ok: false, error: `No habit matching "${args.name}".`, habits: habits?.map((h: any) => h.name) };
        const date = args.date ?? today();
        const { error } = await supabase
          .from('habit_completions')
          .insert({ habit_id: match.id, completion_date: date });
        if (error) throw error;
        return { ok: true, habit: match.name, date };
      }
      case 'get_todos': {
        let q = supabase.from('todos').select('*').order('due_date', { ascending: true });
        if (args.only_pending) q = q.eq('completed', false);
        const { data } = await q;
        return { todos: data ?? [] };
      }
      case 'get_grades': {
        let q = supabase.from('assessments').select('*');
        if (args.subject_key) q = q.eq('subject_key', args.subject_key);
        if (args.quarter) q = q.eq('quarter', args.quarter);
        const { data } = await q;
        const rows = (data ?? []) as any[];
        const bySubject: Record<string, { earned: number; max: number; count: number }> = {};
        rows.forEach((r) => {
          const s = (bySubject[r.subject_key] ??= { earned: 0, max: 0, count: 0 });
          s.earned += Number(r.score);
          s.max += Number(r.max_score);
          s.count += 1;
        });
        const averages = Object.entries(bySubject).map(([key, v]) => ({
          subject_key: key,
          percentage: v.max ? Math.round((v.earned / v.max) * 1000) / 10 : null,
          assessments: v.count,
        }));
        return { assessments: rows, averages };
      }
      case 'get_calendar': {
        const from = args.from ?? today();
        const to = args.to ?? new Date(Date.now() + 30 * 864e5).toLocaleDateString('en-CA');
        const [todos, kanban] = await Promise.all([
          supabase.from('todos').select('*').not('due_date', 'is', null).gte('due_date', from).lte('due_date', to),
          supabase.from('kanban_tasks').select('*').not('due_date', 'is', null).gte('due_date', from).lte('due_date', to),
        ]);
        return {
          range: { from, to },
          events: getCalendarEvents().filter((e) => e.start_date <= to && e.end_date >= from),
          todo_deadlines: todos.data ?? [],
          kanban_deadlines: kanban.data ?? [],
        };
      }

      case 'get_notes': {
        let q = supabase.from('notes').select('*').order('updated_at', { ascending: false }).limit(20);
        if (args.query) q = q.or(`title.ilike.%${args.query}%,content.ilike.%${args.query}%`);
        const { data } = await q;
        return { notes: data ?? [] };
      }
      case 'get_habits': {
        const [{ data: habits }, { data: done }] = await Promise.all([
          supabase.from('habits').select('*'),
          supabase.from('habit_completions').select('*').eq('completion_date', today()),
        ]);
        const doneIds = new Set((done ?? []).map((d: any) => d.habit_id));
        return {
          habits: (habits ?? []).map((h: any) => ({ id: h.id, name: h.name, done_today: doneIds.has(h.id) })),
        };
      }
      case 'get_finance_summary': {
        const [{ data: settings }, { data: tx }, { data: goals }] = await Promise.all([
          supabase.from('finance_settings').select('*').maybeSingle(),
          supabase.from('finance_transactions').select('*').order('transaction_date', { ascending: false }).limit(30),
          supabase.from('finance_goals').select('*'),
        ]);
        const spent = (tx ?? []).reduce((sum: number, t: any) => sum + Number(t.amount), 0);
        return { settings, recent_transactions: tx ?? [], goals: goals ?? [], recent_total_spent: spent };
      }
      case 'get_focus_stats': {
        const days = args.days ?? 7;
        const since = new Date(Date.now() - days * 864e5).toISOString();
        const { data } = await supabase
          .from('pomodoro_sessions')
          .select('*')
          .gte('completed_at', since)
          .order('completed_at', { ascending: false });
        const focus = (data ?? []).filter((s: any) => s.session_type === 'focus');
        return {
          days,
          sessions: focus.length,
          total_focus_minutes: focus.reduce((sum: number, s: any) => sum + Number(s.duration_minutes), 0),
          recent: focus.slice(0, 10),
        };
      }
      case 'get_flashcards': {
        const { data: decks } = await supabase.from('flashcard_decks').select('*');
        const filtered = args.deck
          ? (decks ?? []).filter((d: any) => d.name.toLowerCase().includes(String(args.deck).toLowerCase()))
          : decks ?? [];
        const ids = filtered.map((d: any) => d.id);
        const { data: cards } = ids.length
          ? await supabase.from('flashcards').select('*').in('deck_id', ids)
          : { data: [] as any[] };
        return {
          decks: filtered,
          cards: cards ?? [],
          due_today: (cards ?? []).filter((c: any) => c.due_date <= today()).length,
        };
      }
      case 'get_timetable': {
        const { data } = await supabase.from('timetable_entries').select('*').order('day_of_week');
        return { timetable: data ?? [] };
      }
      case 'web_search': {
        const response = await tavilySearch(args.query, args.max_results ?? 5);
        ctx.onSearch?.(response);
        return response;
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Tool failed.' };
  }
}
