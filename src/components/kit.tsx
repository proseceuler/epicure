import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`glass glass-shadow rounded-2xl ${className} ${onClick ? 'cursor-pointer' : ''}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h2 className="text-xl font-bold text-zinc-800">{title}</h2>
        {subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  type?: 'button' | 'submit';
  className?: string;
  disabled?: boolean;
}) {
  const variants = {
    primary: 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm',
    secondary: 'glass glass-hover text-zinc-700',
    ghost: 'hover:bg-zinc-200/50 text-zinc-600',
    danger: 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all ${variants[variant]} ${sizes[size]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-3 py-2 glass-input rounded-xl text-sm text-zinc-800 placeholder-zinc-400 ${className}`}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 glass-input rounded-xl text-sm text-zinc-800 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function EmptyState({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl glass flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-zinc-400" />
      </div>
      <p className="text-zinc-600 font-medium">{title}</p>
      {subtitle && <p className="text-sm text-zinc-400 mt-1 max-w-sm">{subtitle}</p>}
    </div>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'high' | 'mid' | 'low' | 'fail' }) {
  const tones: Record<string, string> = {
    default: 'bg-zinc-200/60 text-zinc-600',
    high: 'bg-zinc-900 text-white',
    mid: 'bg-zinc-700 text-white',
    low: 'bg-zinc-400 text-zinc-900',
    fail: 'bg-zinc-300 text-zinc-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${tones[tone] ?? tones.default}`}>
      {children}
    </span>
  );
}

export function SubjectBadge({ shortName }: { shortName: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-200/60 text-zinc-600">
      {shortName}
    </span>
  );
}

export function gradeColor(grade: number | null): string {
  if (grade === null) return 'text-zinc-300';
  if (grade >= 85) return 'text-zinc-900';
  if (grade >= 80) return 'text-zinc-700';
  if (grade >= 75) return 'text-zinc-500';
  return 'text-zinc-400';
}
