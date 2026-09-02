import { useState, useRef, useEffect } from 'react';
import { Calculator, Expand, Minimize, GripHorizontal, X } from 'lucide-react';

interface CalcProps {
  detached: boolean;
  onDetach: () => void;
  onSnapBack: () => void;
  onClose: () => void;
}

export default function ScientificCalculator({ detached, onDetach, onSnapBack, onClose }: CalcProps) {
  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [scientific, setScientific] = useState(false);
  const [pos, setPos] = useState({ x: window.innerWidth - 340, y: 80 });
  const dragRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

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

  const pressKey = (key: string) => {
    if (key === 'C') {
      setDisplay('0'); setExpression(''); return;
    }
    if (key === '⌫') {
      setExpression((prev) => prev.slice(0, -1));
      setDisplay(expression.slice(0, -1) || '0'); return;
    }
    if (key === '=') {
      try {
        const sanitized = expression
          .replace(/π/g, 'Math.PI')
          .replace(/√/g, 'Math.sqrt')
          .replace(/sin\(/g, 'Math.sin(')
          .replace(/cos\(/g, 'Math.cos(')
          .replace(/tan\(/g, 'Math.tan(')
          .replace(/ln\(/g, 'Math.log(')
          .replace(/log\(/g, 'Math.log10(')
          .replace(/e(?![0-9])/g, 'Math.E')
          .replace(/\^/g, '**')
          .replace(/%/g, '/100');
        // eslint-disable-next-line no-new-func
        const result = Function(`"use strict"; return (${sanitized})`)();
        setDisplay(String(result));
        setExpression(String(result));
      } catch {
        setDisplay('Error');
      }
      return;
    }
    const newExpr = expression + key;
    setExpression(newExpr);
    setDisplay(newExpr);
  };

  const containerClass = detached
    ? 'fixed z-[70] w-80'
    : 'w-full max-w-[320px] mx-auto';

  const style = detached ? { left: pos.x, top: pos.y } : undefined;

  const basicKeys = [
    ['C', '⌫', '%', '÷'],
    ['7', '8', '9', '×'],
    ['4', '5', '6', '−'],
    ['1', '2', '3', '+'],
    ['0', '.', '(', '='],
  ];

  const sciKeys = [
    ['sin(', 'cos(', 'tan(', 'π'],
    ['ln(', 'log(', '√(', 'e'],
    ['^', '(', ')', ','],
  ];

  const mapKey = (k: string) => {
    const map: Record<string, string> = { '÷': '/', '×': '*', '−': '-', '+': '+' };
    return map[k] ?? k;
  };

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
            <Calculator className="w-4 h-4 text-zinc-600" />
            <span className="text-xs font-medium text-zinc-700">Calculator</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setScientific(!scientific)}
              className="w-6 h-6 rounded-lg hover:bg-zinc-200/50 flex items-center justify-center"
              title={scientific ? 'Basic mode' : 'Scientific mode'}
            >
              {scientific ? <Minimize className="w-3.5 h-3.5 text-zinc-500" /> : <Expand className="w-3.5 h-3.5 text-zinc-500" />}
            </button>
            {detached ? (
              <button onClick={onSnapBack} className="w-6 h-6 rounded-lg hover:bg-zinc-200/50 flex items-center justify-center" title="Snap to dock">
                <Expand className="w-3.5 h-3.5 text-zinc-500 rotate-90" />
              </button>
            ) : (
              <button onClick={onDetach} className="w-6 h-6 rounded-lg hover:bg-zinc-200/50 flex items-center justify-center" title="Detach">
                <Expand className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            )}
            <button onClick={onClose} className="w-6 h-6 rounded-lg hover:bg-zinc-200/50 flex items-center justify-center">
              <X className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Display */}
        <div className="px-4 py-3 bg-white/40">
          <div className="text-right text-[10px] text-zinc-400 h-4 truncate">{expression || '\u00A0'}</div>
          <div className="text-right text-3xl font-light text-zinc-900 tabular-nums truncate">{display}</div>
        </div>

        {/* Scientific keys */}
        {scientific && (
          <div className="px-3 pb-1 grid grid-cols-4 gap-1.5">
            {sciKeys.flat().map((k) => (
              <CalcButton key={k} label={k} onClick={() => pressKey(mapKey(k))} variant="sci" />
            ))}
          </div>
        )}

        {/* Basic keys */}
        <div className="px-3 pb-3 grid grid-cols-4 gap-1.5">
          {basicKeys.flat().map((k) => (
            <CalcButton
              key={k}
              label={k}
              onClick={() => pressKey(mapKey(k))}
              variant={['÷', '×', '−', '+'].includes(k) ? 'op' : k === '=' ? 'eq' : k === 'C' || k === '⌫' ? 'fn' : 'num'}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function CalcButton({ label, onClick, variant }: { label: string; onClick: () => void; variant: 'num' | 'op' | 'fn' | 'eq' | 'sci' }) {
  const styles: Record<string, string> = {
    num: 'bg-white/50 hover:bg-white/70 text-zinc-800',
    op: 'bg-zinc-200/60 hover:bg-zinc-300/70 text-zinc-800 font-medium',
    fn: 'bg-zinc-100/60 hover:bg-zinc-200/70 text-zinc-600',
    eq: 'bg-zinc-900 hover:bg-zinc-800 text-white font-medium',
    sci: 'bg-white/30 hover:bg-white/50 text-zinc-600 text-xs',
  };
  return (
    <button
      onClick={onClick}
      className={`h-12 rounded-2xl text-sm font-medium transition-all ${styles[variant]}`}
    >
      {label}
    </button>
  );
}
