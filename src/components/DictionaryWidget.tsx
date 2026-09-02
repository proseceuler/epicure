import { useState, useRef, useEffect, useCallback } from 'react';
import { BookOpen, GripHorizontal, X, Search, Volume2, Loader as Loader2 } from 'lucide-react';
import { getMwKey } from '@/lib/apiKeys';

interface DictProps {
  detached: boolean;
  onDetach: () => void;
  onSnapBack: () => void;
  onClose: () => void;
}

interface MWResult {
  meta: { id: string; uuid: string };
  hwi: { hw: string; prs?: { ipa?: string; sound?: { audio?: string } }[] };
  fl: string;
  def: { sseq: unknown[][] }[];
  shortdef: string[];
  et?: unknown[];
  ins?: { if: string }[];
  syns?: { pts: string[]; pl: string[] }[];
  ants?: { ptl: string[]; pl: string[] }[];
  uros?: { ure: string; fl: string }[];
  date: string;
}

interface DictEntry {
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  audioUrl: string;
  definitions: string[];
  etymology: string;
  usageNotes: string;
  synonyms: string[];
  antonyms: string[];
  examples: string[];
  relatedWords: { word: string; partOfSpeech: string }[];
}

function extractText(arr: unknown): string {
  if (!arr || !Array.isArray(arr)) return '';
  const result: string[] = [];
  const walk = (item: unknown) => {
    if (typeof item === 'string') result.push(item);
    else if (Array.isArray(item)) item.forEach(walk);
    else if (item && typeof item === 'object') {
      if ('text' in item && typeof (item as Record<string, unknown>).text === 'string') {
        result.push((item as Record<string, unknown>).text as string);
      }
      if ('bw' in item && typeof (item as Record<string, unknown>).bw === 'string') {
        result.push((item as Record<string, unknown>).bw as string);
      }
    }
  };
  arr.forEach(walk);
  return result.join(' ').replace(/\s+/g, ' ').trim();
}

function parseResult(raw: MWResult): DictEntry {
  const prs = raw.hwi?.prs?.[0];
  const ipa = prs?.ipa || '';
  const audioRef = prs?.sound?.audio || '';
  const audioUrl = audioRef
    ? `https://media.merriam-webster.com/audio/prons/en/us/mp3/${audioRef.charAt(0)}/${audioRef}.mp3`
    : '';

  const definitions = raw.shortdef || [];

  let etymology = '';
  if (raw.et && Array.isArray(raw.et)) {
    etymology = extractText(raw.et);
  }

  let usageNotes = '';
  const examples: string[] = [];

  if (raw.def?.[0]?.sseq) {
    for (const senseBlock of raw.def[0].sseq) {
      if (!Array.isArray(senseBlock)) continue;
      for (const sense of senseBlock) {
        if (!Array.isArray(sense) || !sense[1]) continue;
        const sn = sense[1] as Record<string, unknown>;
        if ('sls' in sn) {
          usageNotes = extractText(sn.sls);
        }
        if ('dt' in sn) {
          const dt = sn.dt as unknown[];
          if (Array.isArray(dt)) {
            for (const dtItem of dt) {
              if (Array.isArray(dtItem) && dtItem[0] === 'vis') {
                const vis = dtItem[1];
                if (Array.isArray(vis)) {
                  for (const v of vis) {
                    const text = extractText([v]);
                    if (text) examples.push(text);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const synonyms: string[] = [];
  const antonyms: string[] = [];
  if (raw.syns) {
    for (const syn of raw.syns) {
      if (syn.pl) synonyms.push(...syn.pl);
    }
  }
  if (raw.ants) {
    for (const ant of raw.ants) {
      if (ant.pl) antonyms.push(...ant.pl);
    }
  }

  const relatedWords = (raw.uros || []).map((u) => ({
    word: u.ure,
    partOfSpeech: u.fl || '',
  }));

  return {
    word: raw.hwi?.hw?.replace(/\*/g, '') || raw.meta?.id || '',
    partOfSpeech: raw.fl || '',
    pronunciation: ipa,
    audioUrl,
    definitions,
    etymology,
    usageNotes,
    synonyms: [...new Set(synonyms)].slice(0, 15),
    antonyms: [...new Set(antonyms)].slice(0, 10),
    examples: examples.slice(0, 5),
    relatedWords,
  };
}

export default function DictionaryWidget({ detached, onDetach, onSnapBack, onClose }: DictProps) {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<DictEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [pos, setPos] = useState({ x: 60, y: 80 });
  const dragRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      setPos({ x: e.clientX - offsetRef.current.x, y: e.clientY - offsetRef.current.y });
    };
    const onUp = () => { dragRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const onDragStart = (e: React.MouseEvent) => {
    if (!detached) return;
    dragRef.current = true;
    offsetRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  };

  const search = useCallback(async (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    setError('');
    setSearched(true);
    setEntries([]);

    const apiKey = getMwKey();
    const word = encodeURIComponent(term.trim().toLowerCase());

    if (!apiKey) {
      setError('Add your Merriam-Webster API key in Settings first.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/public/dictionary?word=${word}`, {
        headers: { 'X-MW-Key': apiKey },
      });
      const payload = await res.json().catch(() => ({ error: 'Invalid response from dictionary service.' }));
      if (payload?.error) {
        setError(String(payload.error));
        setLoading(false);
        return;
      }
      const data = payload?.data;

      if (!Array.isArray(data)) {
        setError('No results found.');
        setLoading(false);
        return;
      }

      if (data.length > 0 && typeof data[0] === 'string') {
        setError(`No exact match. Suggestions: ${(data as string[]).slice(0, 8).join(', ')}`);
        setLoading(false);
        return;
      }

      const parsed = (data as MWResult[])
        .filter((r) => r.meta && r.hwi)
        .map(parseResult)
        .filter((e) => e.definitions.length > 0);

      if (parsed.length === 0) {
        setError('No dictionary entries found for this word.');
      } else {
        setEntries(parsed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch definition.');
    } finally {
      setLoading(false);
    }
  }, []);

  const playAudio = (url: string) => {
    if (audioRef.current) audioRef.current.pause();
    audioRef.current = new Audio(url);
    audioRef.current.play().catch(() => {});
  };

  const containerClass = detached ? 'fixed z-[70] w-96' : 'w-full max-w-[400px] mx-auto';
  const style = detached ? { left: pos.x, top: pos.y } : undefined;

  return (
    <div className={containerClass} style={style}>
      <div className="glass glass-shadow-lg rounded-3xl overflow-hidden">
        {/* Title bar */}
        <div
          className={`flex items-center justify-between px-4 py-2 border-b border-white/10 ${detached ? 'cursor-move' : ''}`}
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-2">
            {detached && <GripHorizontal className="w-3.5 h-3.5 text-zinc-400" />}
            <BookOpen className="w-4 h-4 text-zinc-600" />
            <span className="text-xs font-medium text-zinc-700">Merriam-Webster Dictionary</span>
          </div>
          <div className="flex items-center gap-1">
            {detached ? (
              <button onClick={onSnapBack} className="w-6 h-6 rounded-lg hover:bg-zinc-200/50 flex items-center justify-center text-xs text-zinc-500" title="Snap to dock">
                ↓
              </button>
            ) : (
              <button onClick={onDetach} className="w-6 h-6 rounded-lg hover:bg-zinc-200/50 flex items-center justify-center text-xs text-zinc-500" title="Detach">
                ↑
              </button>
            )}
            <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-zinc-200/50 flex items-center justify-center">
              <X className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-zinc-200/30">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search(query)}
              placeholder="Look up a word..."
              className="flex-1 px-3 py-1.5 glass-input rounded-xl text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none"
              autoFocus
            />
            <button onClick={() => search(query)} disabled={loading} className="px-3 py-1.5 rounded-xl bg-zinc-900 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1">
              <Search className="w-3.5 h-3.5" />
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Go'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
            </div>
          )}

          {error && !loading && (
            <div className="px-5 py-4 text-sm text-zinc-500 italic">{error}</div>
          )}

          {!loading && !error && entries.length === 0 && !searched && (
            <div className="px-5 py-8 text-center text-sm text-zinc-400 italic">
              Enter a word to see full dictionary entries with pronunciation, etymology, and more.
            </div>
          )}

          {!loading && entries.length > 0 && (
            <div className="px-5 py-4 space-y-4" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {entries.map((entry, idx) => (
                <div key={idx} className={idx > 0 ? 'pt-4 border-t border-zinc-200/40' : ''}>
                  {/* Headword */}
                  <div className="border-b border-zinc-300/40 pb-2 mb-3">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-2xl font-bold text-zinc-900 lowercase">{entry.word}</span>
                      {entry.partOfSpeech && (
                        <span className="italic text-sm text-zinc-600">{entry.partOfSpeech}</span>
                      )}
                    </div>
                    {entry.pronunciation && (
                      <p className="text-sm text-zinc-500 mt-0.5">/{entry.pronunciation}/</p>
                    )}
                    {entry.audioUrl && (
                      <button
                        onClick={() => playAudio(entry.audioUrl)}
                        className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5" /> Listen
                      </button>
                    )}
                  </div>

                  {/* Definitions */}
                  {entry.definitions.length > 0 && (
                    <ol className="space-y-2 mb-3">
                      {entry.definitions.map((def, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="font-bold text-zinc-600 tabular-nums shrink-0">{i + 1}.</span>
                          <span className="text-zinc-800">{def}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {/* Usage notes */}
                  {entry.usageNotes && (
                    <div className="mb-3 p-2.5 rounded-lg bg-amber-50/60 border border-amber-100/50">
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Usage</p>
                      <p className="text-sm text-zinc-600 italic">{entry.usageNotes}</p>
                    </div>
                  )}

                  {/* Etymology */}
                  {entry.etymology && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-0.5">Etymology</p>
                      <p className="text-sm text-zinc-600">{entry.etymology}</p>
                    </div>
                  )}

                  {/* Examples */}
                  {entry.examples.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Examples in context</p>
                      <ul className="space-y-1">
                        {entry.examples.map((ex, i) => (
                          <li key={i} className="text-sm text-zinc-600 italic border-l-2 border-zinc-200 pl-2.5">
                            "{ex}"
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Synonyms & Antonyms */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {entry.synonyms.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Synonyms</p>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.synonyms.map((syn, i) => (
                            <button
                              key={i}
                              onClick={() => { setQuery(syn); search(syn); }}
                              className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs hover:bg-emerald-100 transition-colors"
                            >
                              {syn}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {entry.antonyms.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Antonyms</p>
                        <div className="flex flex-wrap gap-1.5">
                          {entry.antonyms.map((ant, i) => (
                            <button
                              key={i}
                              onClick={() => { setQuery(ant); search(ant); }}
                              className="px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-xs hover:bg-red-100 transition-colors"
                            >
                              {ant}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Related words */}
                  {entry.relatedWords.length > 0 && (
                    <div className="pt-2 border-t border-zinc-200/40">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Related Words</p>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.relatedWords.map((rel, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-xs">
                            {rel.word}{rel.partOfSpeech && <span className="italic opacity-60 ml-1">{rel.partOfSpeech}</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
