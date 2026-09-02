import { useState } from 'react';
import { detectAiContent, verdictLabel } from '@/lib/sapling';
import { ShieldAlert, Loader2 } from 'lucide-react';

export default function QuintilianAiCheck({ text }: { text: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ score: number } | null>(null);
  const [error, setError] = useState('');

  async function run() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await detectAiContent(text);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI detection failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col items-center gap-2 text-xs">
      <button
        onClick={run}
        disabled={loading || !text.trim()}
        className="sa-pill"
        style={{ opacity: !text.trim() ? 0.5 : 1 }}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
        Check for AI writing
      </button>

      {error && <p className="text-rose-500">{error}</p>}

      {result && (
        <div className="text-center">
          <p className="font-medium text-[var(--sa-text)]">
            {verdictLabel(result.score)} ({Math.round(result.score * 100)}%)
          </p>
          <p className="text-[var(--sa-text-dim)] mt-0.5 max-w-xs">
            AI detectors are probabilistic, not proof — don't use this as the sole basis for an accusation.
          </p>
        </div>
      )}
    </div>
  );
}
