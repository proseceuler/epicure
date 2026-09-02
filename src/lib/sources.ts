export interface Source {
  id: string;
  title: string;
  content: string;
  kind: 'note' | 'pasted';
  addedAt: string;
}

const SOURCES_KEY = 'epicure-ai-sources';

type SourcesByMode = Record<string, Source[]>;

function readAll(): SourcesByMode {
  try {
    return JSON.parse(localStorage.getItem(SOURCES_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeAll(data: SourcesByMode) {
  localStorage.setItem(SOURCES_KEY, JSON.stringify(data));
}

export function getSources(mode: string): Source[] {
  return readAll()[mode] ?? [];
}

export function addSource(mode: string, source: Omit<Source, 'id' | 'addedAt'>): Source {
  const all = readAll();
  const list = all[mode] ?? [];
  const entry: Source = { ...source, id: crypto.randomUUID(), addedAt: new Date().toISOString() };
  all[mode] = [entry, ...list];
  writeAll(all);
  return entry;
}

export function removeSource(mode: string, id: string) {
  const all = readAll();
  all[mode] = (all[mode] ?? []).filter((s) => s.id !== id);
  writeAll(all);
}

/** Approximate char budget so we don't blow the model's context window with attached sources. */
const MAX_CONTEXT_CHARS = 24000;

export function buildSourcesPrompt(sources: Source[]): string {
  if (!sources.length) return '';
  let used = 0;
  const blocks: string[] = [];
  for (const s of sources) {
    const remaining = MAX_CONTEXT_CHARS - used;
    if (remaining <= 200) break;
    const content = s.content.length > remaining ? s.content.slice(0, remaining) + '…' : s.content;
    used += content.length;
    blocks.push(`### ${s.title}\n${content}`);
  }
  return (
    `\n\nThe user has attached the following sources. Ground your answer in them when relevant, ` +
    `and when you use one, mention it by its title in plain text (e.g. "According to '${sources[0].title}'..."). ` +
    `If the sources don't cover the question, answer normally and say so.\n\n${blocks.join('\n\n---\n\n')}`
  );
}
