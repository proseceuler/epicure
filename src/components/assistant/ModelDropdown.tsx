import { useState, useRef, useEffect } from 'react';
import { Check, ChevronUp } from 'lucide-react';
import type { ModelDef } from './constants';

export default function ModelDropdown({
  models,
  value,
  onChange,
}: {
  models: ModelDef[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = models.find((m) => m.value === value);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="sa-icon-btn flex items-center gap-1 px-2 py-1.5 text-xs font-medium"
        title="Select model"
      >
        <span className="max-w-[160px] truncate">{current?.label ?? 'Select model'}</span>
        <ChevronUp className={`w-3 h-3 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>

      {open && (
        <div className="sa-dropdown absolute bottom-full left-0 mb-2 w-72 p-1.5 z-50">
          {models.map((m) => {
            const active = m.value === value;
            return (
              <button
                key={m.value}
                onClick={() => { onChange(m.value); setOpen(false); }}
                className="sa-dropdown-item w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--sa-text)] truncate">{m.label}</p>
                  <p className="text-[11px] text-[var(--sa-text-dim)] mt-0.5 leading-snug">{m.description}</p>
                </div>
                {active && <Check className="w-3.5 h-3.5 text-[var(--sa-accent)] shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
