'use client';

import { type ReactNode } from 'react';
import { AlertCircle, Minus, Plus } from 'lucide-react';

export const cls = (...xs: (string | false | null | undefined)[]) =>
  xs.filter(Boolean).join(' ');

export function Pill({
  tone = 'easy',
  children,
}: {
  tone?: 'easy' | 'moderate' | 'hard';
  children: ReactNode;
}) {
  const map = {
    easy:     { bg: 'var(--easy-bg)',     fg: 'var(--easy-fg)' },
    moderate: { bg: 'var(--moderate-bg)', fg: 'var(--moderate-fg)' },
    hard:     { bg: 'var(--hard-bg)',     fg: 'var(--hard-fg)' },
  } as const;
  const t = map[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

interface BtnProps {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  className?: string;
}

export function PrimaryButton({ children, onClick, type = 'button', disabled, icon: Icon, className = '' }: BtnProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cls(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition',
        'bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, icon: Icon, className = '' }: BtnProps) {
  return (
    <button
      onClick={onClick}
      className={cls(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition',
        'bg-white text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--surface-2)]',
        className,
      )}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function AccentCTA({ children, onClick, icon: Icon, className = '' }: BtnProps) {
  return (
    <button
      onClick={onClick}
      className={cls(
        'group inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition w-full',
        'bg-[var(--ink)] text-white border-2 border-[var(--terracotta)] hover:shadow-md',
        className,
      )}
    >
      {Icon && <Icon size={16} className="text-[var(--terracotta-soft)] group-hover:text-white transition" />}
      {children}
    </button>
  );
}

export function Field({
  label, error, children,
}: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      {children}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1 mt-1 text-xs text-[var(--terracotta)]">
      <AlertCircle size={12} /> {children}
    </div>
  );
}

export function Counter({
  value, onChange, min = 1, max = 30,
}: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="inline-flex items-center bg-white rounded-full border border-[var(--line)] overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-9 h-9 flex items-center justify-center hover:bg-[var(--surface-2)] text-[var(--muted)]"
        aria-label="Decrease"
      >
        <Minus size={12} />
      </button>
      <span className="w-10 text-center text-sm font-medium tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-9 h-9 flex items-center justify-center hover:bg-[var(--surface-2)] text-[var(--muted)]"
        aria-label="Increase"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
