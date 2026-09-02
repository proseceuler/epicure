import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function Markdown({ content, inverted = false }: { content: string; inverted?: boolean }) {
  return (
    <div className={`md-body text-sm leading-relaxed ${inverted ? 'md-inverted' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-zinc-300/60 px-2 py-1 text-left font-semibold bg-zinc-100/60">{children}</th>
          ),
          td: ({ children }) => <td className="border border-zinc-300/60 px-2 py-1 align-top">{children}</td>,
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className || '');
            if (!isBlock) {
              return (
                <code className="px-1 py-0.5 rounded bg-zinc-200/70 text-[0.85em] font-mono" {...props}>
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
            <pre className="my-2 p-3 rounded-xl bg-zinc-900 text-zinc-100 overflow-x-auto text-xs">{children}</pre>
          ),
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
          h1: ({ children }) => <h1 className="text-base font-semibold mt-3 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold mt-3 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-zinc-300 pl-3 my-2 italic">{children}</blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
