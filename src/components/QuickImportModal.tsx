import { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { parseAnnouncement, syncAnnouncement } from '@/lib/announcementImport';

export default function QuickImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const run = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const parsed = await parseAnnouncement(text.trim());
      const { events, todos, updates } = await syncAnnouncement(parsed);
      if (!events && !todos && !updates) {
        toast('Nothing new to sync — looks like it was already imported.');
      } else {
        toast.success(`Synced ${todos} tasks, ${events} events, ${updates} updates!`);
      }
      setText('');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-xl glass glass-shadow-lg rounded-3xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-zinc-800">AI Announcement Importer</h2>
              <p className="text-xs text-zinc-500">
                Paste raw school updates (English or Tagalog) — tasks, deadlines and class notices get sorted for you.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-8 h-8 rounded-lg hover:bg-zinc-200/50 flex items-center justify-center disabled:opacity-40"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          autoFocus
          placeholder={'e.g. "Pasa ng Research paper sa Monday. Every Friday quiz sa Math. Continuation ng presentation sa English bukas. @Ana bahala sa poster."'}
          className="w-full rounded-2xl bg-white/60 border border-zinc-200/70 p-3 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 resize-y"
        />

        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-xl text-sm text-zinc-600 hover:bg-zinc-200/50 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={run}
            disabled={busy || !text.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 disabled:opacity-40"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {busy ? 'Parsing & syncing…' : 'Parse & Sync'}
          </button>
        </div>
      </div>
    </div>
  );
}
