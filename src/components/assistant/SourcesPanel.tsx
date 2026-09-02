import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addSource, removeSource, type Source } from '@/lib/sources';
import { Library, FileText, Type, Plus, X, Trash2, Search } from 'lucide-react';
import type { Note } from '@/lib/types';

export default function SourcesPanel({
  mode,
  sources,
  onChange,
  onClose,
}: {
  mode: string;
  sources: Source[];
  onChange: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'attached' | 'notes' | 'paste'>('attached');
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteBody, setPasteBody] = useState('');

  useEffect(() => {
    if (tab !== 'notes' || notes.length) return;
    setNotesLoading(true);
    supabase
      .from('notes')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        setNotes((data as Note[]) ?? []);
        setNotesLoading(false);
      });
  }, [tab, notes.length]);

  const attachedNoteIds = new Set(sources.filter((s) => s.kind === 'note').map((s) => s.id.split('::')[1]));
  const filteredNotes = notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()));

  const attachNote = (n: Note) => {
    addSource(mode, { title: n.title || 'Untitled note', content: n.content || '', kind: 'note' });
    onChange();
  };

  const attachPaste = () => {
    if (!pasteBody.trim()) return;
    addSource(mode, { title: pasteTitle.trim() || 'Pasted text', content: pasteBody.trim(), kind: 'pasted' });
    setPasteTitle('');
    setPasteBody('');
    setTab('attached');
    onChange();
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-label="Sources">
      <div className="flex-1" onClick={onClose} />
      <div className="w-full max-w-sm h-full bg-[var(--sa-surface)] border-l border-[var(--sa-border)] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--sa-border)]">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-[var(--sa-text)]" />
            <h2 className="text-sm font-medium text-[var(--sa-text)]">Sources</h2>
            {sources.length > 0 && (
              <span className="text-[10px] text-[var(--sa-text-dim)] bg-[var(--sa-surface-hover)] rounded-full px-1.5 py-0.5">
                {sources.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="sa-icon-btn w-7 h-7 flex items-center justify-center" title="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex gap-1 px-4 pt-3">
          {[
            { id: 'attached' as const, label: 'Attached' },
            { id: 'notes' as const, label: 'From Notes' },
            { id: 'paste' as const, label: 'Paste text' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`sa-pill ${tab === t.id ? 'sa-pill-active' : ''}`}
              style={{ padding: '0.3125rem 0.625rem', fontSize: '0.6875rem' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {tab === 'attached' && (
            sources.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <Library className="w-8 h-8 text-[var(--sa-text-dim)] mb-2" />
                <p className="text-sm text-[var(--sa-text)]">No sources attached</p>
                <p className="text-xs text-[var(--sa-text-dim)] mt-1">
                  Attach notes or paste text so answers stay grounded in your own material.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map((s) => (
                  <div key={s.id} className="rounded-xl border border-[var(--sa-border)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        {s.kind === 'note' ? (
                          <FileText className="w-3.5 h-3.5 mt-0.5 text-[var(--sa-text-dim)] shrink-0" />
                        ) : (
                          <Type className="w-3.5 h-3.5 mt-0.5 text-[var(--sa-text-dim)] shrink-0" />
                        )}
                        <p className="text-xs font-medium text-[var(--sa-text)] truncate">{s.title}</p>
                      </div>
                      <button
                        onClick={() => {
                          removeSource(mode, s.id);
                          onChange();
                        }}
                        className="sa-icon-btn w-6 h-6 flex items-center justify-center shrink-0"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--sa-text-dim)] mt-1.5 line-clamp-2">{s.content}</p>
                  </div>
                ))}
              </div>
            )
          )}

          {tab === 'notes' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-[var(--sa-border)] px-2.5 py-1.5">
                <Search className="w-3.5 h-3.5 text-[var(--sa-text-dim)]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your notes..."
                  className="flex-1 bg-transparent text-xs text-[var(--sa-text)] placeholder-[var(--sa-text-dim)] focus:outline-none"
                />
              </div>
              {notesLoading ? (
                <p className="text-xs text-[var(--sa-text-dim)] px-1 py-4 text-center">Loading notes…</p>
              ) : filteredNotes.length === 0 ? (
                <p className="text-xs text-[var(--sa-text-dim)] px-1 py-4 text-center">No notes found.</p>
              ) : (
                filteredNotes.map((n) => {
                  const attached = attachedNoteIds.has(n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => !attached && attachNote(n)}
                      disabled={attached}
                      className={`w-full flex items-start gap-2 rounded-xl border border-[var(--sa-border)] p-3 text-left transition-colors ${
                        attached ? 'opacity-50 cursor-default' : 'hover:bg-[var(--sa-surface-hover)]'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 mt-0.5 text-[var(--sa-text-dim)] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-[var(--sa-text)] truncate">{n.title || 'Untitled note'}</p>
                        <p className="text-[11px] text-[var(--sa-text-dim)] line-clamp-1">{n.content}</p>
                      </div>
                      {!attached && <Plus className="w-3.5 h-3.5 text-[var(--sa-text-dim)] shrink-0 mt-0.5" />}
                    </button>
                  );
                })
              )}
            </div>
          )}

          {tab === 'paste' && (
            <div className="space-y-2">
              <input
                value={pasteTitle}
                onChange={(e) => setPasteTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full rounded-lg border border-[var(--sa-border)] px-3 py-2 text-xs text-[var(--sa-text)] placeholder-[var(--sa-text-dim)] bg-transparent focus:outline-none"
              />
              <textarea
                value={pasteBody}
                onChange={(e) => setPasteBody(e.target.value)}
                placeholder="Paste text, an excerpt, or reference material…"
                rows={10}
                className="w-full rounded-lg border border-[var(--sa-border)] px-3 py-2 text-xs text-[var(--sa-text)] placeholder-[var(--sa-text-dim)] bg-transparent focus:outline-none resize-none"
              />
              <button
                onClick={attachPaste}
                disabled={!pasteBody.trim()}
                className="sa-send-btn w-full h-8 flex items-center justify-center gap-1.5 text-xs font-medium disabled:opacity-30"
              >
                <Plus className="w-3.5 h-3.5" />
                Attach as source
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
