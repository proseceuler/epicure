export type WikiTarget =
  | { kind: 'note'; title: string; alias: string }
  | { kind: 'board'; title: string; alias: string };

const WIKI_RE = /(!)?\[\[([^[\]]+)\]\]/g;

export function parseWikiInner(inner: string): WikiTarget {
  const aliasSplit = inner.split('|');
  const raw = (aliasSplit[0] || '').trim();
  const alias = (aliasSplit[1] || raw).trim();
  const board = raw.match(/^board\s*:\s*(.+)$/i);
  if (board) return { kind: 'board', title: board[1].trim(), alias };
  return { kind: 'note', title: raw, alias };
}

export function wikiLinkTitles(content: string): string[] {
  const titles: string[] = [];
  const re = new RegExp(WIKI_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(content || ''))) {
    const target = parseWikiInner(m[2]);
    if (target.kind === 'note') titles.push(target.title);
  }
  return [...new Set(titles.filter(Boolean))];
}

export function wikiBoardTitles(content: string): string[] {
  const titles: string[] = [];
  const re = new RegExp(WIKI_RE);
  let m: RegExpExecArray | null;
  while ((m = re.exec(content || ''))) {
    const target = parseWikiInner(m[2]);
    if (target.kind === 'board') titles.push(target.title);
  }
  return [...new Set(titles.filter(Boolean))];
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function findNoteByTitle<T extends { title: string }>(notes: T[], title: string): T | undefined {
  const q = title.trim().toLowerCase();
  return notes.find((n) => n.title.toLowerCase() === q);
}
