import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { parseWikiInner } from '@/lib/wiki';
import type { Note } from '@/lib/types';
import { FileText, LayoutGrid } from 'lucide-react';

const TOKEN = /(!)?\[\[([^[\]]+)\]\]/g;

function tokenize(content: string) {
  const parts: Array<{ type: 'md' | 'wiki'; text: string; embed?: boolean }> = [];
  let last = 0;
  const re = new RegExp(TOKEN);
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    if (m.index > last) parts.push({ type: 'md', text: content.slice(last, m.index) });
    parts.push({ type: 'wiki', text: m[2], embed: Boolean(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ type: 'md', text: content.slice(last) });
  return parts;
}

export default function NoteMarkdown({
  content,
  notes,
  onOpenNote,
  onOpenBoard,
  onCreateNote,
}: {
  content: string;
  notes: Note[];
  onOpenNote: (title: string) => void;
  onOpenBoard: (name: string) => void;
  onCreateNote: (title: string) => void;
}) {
  const parts = tokenize(content || '');
  return (
    <div className="note-prose text-[15px] leading-relaxed text-zinc-800">
      {parts.map((p, i) => {
        if (p.type === 'md') {
          return (
            <ReactMarkdown
              key={i}
              remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
              rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
              components={{
                table: ({ children }) => (
                  <div className="my-2 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-zinc-200 bg-zinc-50 px-2 py-1 text-left font-semibold">{children}</th>
                ),
                td: ({ children }) => <td className="border border-zinc-200 px-2 py-1 align-top">{children}</td>,
                a: ({ children, href }) => (
                  <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {children}
                  </a>
                ),
                code: ({ className, children, ...props }) => {
                  const isBlock = /language-/.test(className || '');
                  if (!isBlock) {
                    return (
                      <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em]" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code className={`${className || ''} font-mono text-xs`} {...props}>
                      {children}
                    </code>
                  );
                },
                pre: ({ children }) => (
                  <pre className="my-2 overflow-x-auto rounded-xl bg-zinc-900 p-3 text-xs text-zinc-100">{children}</pre>
                ),
              }}
            >
              {p.text}
            </ReactMarkdown>
          );
        }
        const target = parseWikiInner(p.text);
        if (target.kind === 'board') {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onOpenBoard(target.title)}
              className="wiki-chip wiki-chip-board"
            >
              <LayoutGrid className="h-3 w-3" />
              {target.alias}
            </button>
          );
        }
        const exists = notes.some((n) => n.title.toLowerCase() === target.title.toLowerCase());
        const dest = notes.find((n) => n.title.toLowerCase() === target.title.toLowerCase());
        if (p.embed && dest) {
          return (
            <div key={i} className="my-3 rounded-xl border border-zinc-200 bg-white/70 p-3">
              <button type="button" onClick={() => onOpenNote(dest.title)} className="mb-1 flex items-center gap-1 text-xs font-semibold text-zinc-500">
                <FileText className="h-3 w-3" /> {dest.title}
              </button>
              <div className="line-clamp-6 text-sm text-zinc-700">{dest.content.replace(/[#*`[\]]/g, '').slice(0, 400)}</div>
            </div>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => (exists ? onOpenNote(target.title) : onCreateNote(target.title))}
            className={`wiki-chip ${exists ? 'wiki-chip-note' : 'wiki-chip-missing'}`}
          >
            <FileText className="h-3 w-3" />
            {target.alias}
          </button>
        );
      })}
    </div>
  );
}
