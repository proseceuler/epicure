import { useState, useRef, useEffect, useCallback } from 'react';
import { getOpenRouterKey, getDefaultModel } from '@/lib/apiKeys';
import { supabase } from '@/lib/supabase';
import type { PageId } from '@/components/AppLayout';
import { Bot, Send, Check, X, Loader2, GripHorizontal } from 'lucide-react';

interface ProposedAction {
  id: string;
  description: string;
}

interface CodsworthMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: ProposedAction;
}

const SCOPE_PROMPTS: Partial<Record<PageId, string>> = {
  todos:
    'You are Codsworth, a tidy task-organizing assistant for a To-Do List. When you propose a concrete change, end with a line "ACTION: ...". Live task list is provided as JSON.',
  kanban:
    'You are Codsworth for a Kanban Board. End concrete proposals with "ACTION: ...". Live board data is JSON context.',
  calendar:
    'You are Codsworth for a Calendar. Flag conflicts; end concrete proposals with "ACTION: ...".',
  notes:
    'You are Codsworth for Notes & Ideas. Dedupe/reorganize; end concrete proposals with "ACTION: ...".',
};

type Item = Record<string, unknown> & { id?: string; title?: string; content?: string };

async function loadPageItems(page: PageId): Promise<Item[]> {
  if (page === 'todos' || page === 'calendar') {
    const q = supabase.from('todos').select('*').order('created_at', { ascending: false }).limit(80);
    const { data } = page === 'calendar' ? await q.not('due_date', 'is', null) : await q;
    return (data as Item[]) || [];
  }
  if (page === 'kanban') {
    const { data } = await supabase.from('kanban_tasks').select('*').order('created_at', { ascending: false }).limit(80);
    return (data as Item[]) || [];
  }
  if (page === 'notes') {
    const { data } = await supabase.from('notes').select('*').order('updated_at', { ascending: false }).limit(80);
    return (data as Item[]) || [];
  }
  return [];
}

async function applyAction(page: PageId, description: string, items: Item[]): Promise<string> {
  const desc = description.toLowerCase();
  const matched = items.filter((it) => {
    const title = String(it.title || it.content || '').toLowerCase();
    return title.length > 2 && desc.includes(title.slice(0, Math.min(title.length, 24)));
  });

  if (desc.includes('merge') || desc.includes('duplicate') || desc.includes('dedupe') || desc.includes('delete')) {
    if ((page === 'todos' || page === 'calendar') && matched.length >= 2) {
      for (const m of matched.slice(1)) {
        if (m.id) await supabase.from('todos').delete().eq('id', m.id);
      }
      return `Merged into “${matched[0].title}”; removed ${matched.length - 1} duplicate(s).`;
    }
    if (page === 'notes' && matched.length >= 2) {
      for (const m of matched.slice(1)) {
        if (m.id) await supabase.from('notes').delete().eq('id', m.id);
      }
      return `Kept “${matched[0].title}”; removed ${matched.length - 1} note(s).`;
    }
    if (page === 'kanban' && matched.length >= 2) {
      for (const m of matched.slice(1)) {
        if (m.id) await supabase.from('kanban_tasks').delete().eq('id', m.id);
      }
      return `Removed ${matched.length - 1} duplicate card(s).`;
    }
  }

  if (page === 'todos' && matched[0]?.id && (desc.includes('priority') || desc.includes('urgent'))) {
    let priority = 'not_urgent_important';
    if (desc.includes('urgent') && desc.includes('not important')) priority = 'urgent_not_important';
    else if (desc.includes('urgent')) priority = 'urgent_important';
    await supabase.from('todos').update({ priority }).eq('id', matched[0].id);
    return `Updated priority on “${matched[0].title}”.`;
  }

  return 'Noted. Could not map that ACTION to a concrete row — name the exact task title.';
}

export default function CodsworthPanel({
  page,
  onClose,
}: {
  page: PageId;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<CodsworthMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Draggable like DictionaryWidget
  const [pos, setPos] = useState({ x: Math.max(24, window.innerWidth - 344), y: Math.max(80, window.innerHeight - 560) });
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const refreshItems = useCallback(async () => {
    setItems(await loadPageItems(page));
  }, [page]);

  useEffect(() => {
    refreshItems();
  }, [refreshItems]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      setPos({
        x: Math.min(window.innerWidth - 80, Math.max(0, e.clientX - offsetRef.current.x)),
        y: Math.min(window.innerHeight - 80, Math.max(0, e.clientY - offsetRef.current.y)),
      });
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const onDragStart = (e: React.MouseEvent) => {
    draggingRef.current = true;
    offsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const key = getOpenRouterKey();
    setInput('');
    const nextMessages: CodsworthMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);

    if (!key) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'No OpenRouter API key found — add one in Settings.' },
      ]);
      return;
    }

    setLoading(true);
    try {
      await refreshItems();
      const snapshot = items.slice(0, 40).map((it) => ({
        id: it.id,
        title: it.title,
        content: typeof it.content === 'string' ? it.content.slice(0, 120) : undefined,
        priority: it.priority,
        completed: it.completed,
        column: it.column || it.status,
      }));

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: getDefaultModel() || 'nvidia/nemotron-nano-9b-v2:free',
          messages: [
            {
              role: 'system',
              content:
                (SCOPE_PROMPTS[page] || 'You are Codsworth.') +
                '\n\nCurrent page data:\n' +
                JSON.stringify(snapshot),
            },
            ...nextMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });
      const data = await res.json();
      const raw: string = data.choices?.[0]?.message?.content || 'Sorry, I had trouble with that.';
      const actionMatch = raw.match(/ACTION:\s*(.+)$/m);
      const content = actionMatch ? raw.slice(0, actionMatch.index).trim() : raw;
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content,
          action: actionMatch ? { id: `${Date.now()}`, description: actionMatch[1].trim() } : undefined,
        },
      ]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong reaching Codsworth.' }]);
    } finally {
      setLoading(false);
    }
  }

  async function resolveAction(id: string, confirmed: boolean) {
    const msg = messages.find((m) => m.action?.id === id);
    if (!msg?.action) return;
    let suffix = '\n\n✕ Cancelled.';
    if (confirmed) {
      try {
        const result = await applyAction(page, msg.action.description, items);
        suffix = `\n\n✓ Applied. ${result}`;
        await refreshItems();
      } catch (err) {
        suffix = `\n\n✕ Failed: ${err instanceof Error ? err.message : 'error'}`;
      }
    }
    setMessages((m) =>
      m.map((row) =>
        row.action?.id === id ? { ...row, content: row.content + suffix, action: undefined } : row
      )
    );
  }

  return (
    <div
      className="fixed z-[60] flex w-80 max-h-[28rem] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
      style={{ left: pos.x, top: pos.y }}
    >
      {/* Drag handle — same idea as Dictionary */}
      <div
        className="flex cursor-move items-center justify-between border-b border-zinc-100 bg-zinc-50 px-3 py-2.5"
        onMouseDown={onDragStart}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          <GripHorizontal className="h-4 w-4 text-zinc-400" />
          <Bot className="h-4 w-4 text-zinc-700" />
          Codsworth
        </div>
        <button
          type="button"
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          className="text-zinc-400 hover:text-zinc-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3 text-sm">
        {messages.length === 0 && (
          <p className="text-xs text-zinc-400">
            Organize this page — try &quot;find duplicates.&quot;
            {items.length > 0 ? ` (${items.length} items loaded)` : ''}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 ${
                m.role === 'user' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-800'
              }`}
            >
              {m.content}
              {m.action && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => resolveAction(m.action!.id, true)}
                    className="flex items-center gap-1 rounded-full bg-zinc-900 px-2 py-1 text-xs text-white"
                  >
                    <Check className="h-3 w-3" /> Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => resolveAction(m.action!.id, false)}
                    className="flex items-center gap-1 rounded-full border border-zinc-300 px-2 py-1 text-xs text-zinc-600"
                  >
                    <X className="h-3 w-3" /> Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
      </div>

      <div className="flex items-center gap-2 border-t border-zinc-100 px-3 py-2.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask Codsworth..."
          className="flex-1 rounded-full border border-zinc-200 px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={loading}
          className="rounded-full bg-zinc-900 p-1.5 text-white disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
