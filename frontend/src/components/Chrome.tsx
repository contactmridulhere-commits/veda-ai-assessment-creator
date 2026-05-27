'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Sparkles, LayoutGrid, Users, FileText, BookOpen, PieChart, Settings,
  Bell, ChevronDown, ArrowLeft, Menu,
} from 'lucide-react';
import { SCHOOL } from '../lib/types';
import { AccentCTA, cls } from './ui';

const NAV = [
  { id: 'home',    label: 'Home',                 icon: LayoutGrid, href: '/' },
  { id: 'groups',  label: 'My Groups',            icon: Users,      href: '/' },
  { id: 'list',    label: 'Assignments',          icon: FileText,   href: '/' },
  { id: 'toolkit', label: "AI Teacher's Toolkit", icon: BookOpen,   href: '/' },
  { id: 'library', label: 'My Library',           icon: PieChart,   href: '/' },
];

function activeFromPath(path: string): string {
  if (path === '/' || path.startsWith('/output')) return 'list';
  if (path.startsWith('/create') || path.startsWith('/generating')) return 'list';
  return 'list';
}

export function Sidebar({ count = 0 }: { count?: number }) {
  const router = useRouter();
  const path = usePathname();
  const active = activeFromPath(path);

  return (
    <aside className="hidden lg:flex w-[280px] shrink-0 h-screen sticky top-0 flex-col bg-white border-r border-[var(--line)] p-5">
      <div className="flex items-center gap-2.5 mb-7 px-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-lg"
          style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #3A2D24 50%, #E85D2C 100%)' }}
        >
          v
        </div>
        <span className="font-display text-xl font-semibold tracking-tight">VedaAI</span>
      </div>

      <AccentCTA icon={Sparkles} onClick={() => router.push('/create')}>
        Create Assignment
      </AccentCTA>

      <nav className="mt-7 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => router.push(item.href)}
              className={cls(
                'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                isActive
                  ? 'bg-[var(--ivory)] text-[var(--ink)] font-medium'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)]',
              )}
            >
              <Icon size={18} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === 'list' && count > 0 && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--terracotta)] text-white">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      <button className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] mb-3">
        <Settings size={18} /> Settings
      </button>
      <div className="rounded-xl bg-[var(--surface-2)] p-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F2A07A] to-[#E85D2C] flex items-center justify-center text-white font-display text-sm">
          D
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{SCHOOL.name}</div>
          <div className="text-xs text-[var(--muted)] truncate">{SCHOOL.location}</div>
        </div>
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  return (
    <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-[var(--line)] px-4 py-3 flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
        style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #E85D2C 100%)' }}
      >
        v
      </div>
      <span className="font-display text-lg font-semibold flex-1">VedaAI</span>
      <button className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center relative">
        <Bell size={16} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--terracotta)]" />
      </button>
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F2A07A] to-[#E85D2C]" />
      <button className="w-9 h-9 flex items-center justify-center" aria-label="Menu">
        <Menu size={20} />
      </button>
    </div>
  );
}

export function MobileBottomBar() {
  const router = useRouter();
  return (
    <div className="lg:hidden fixed bottom-3 left-3 right-3 z-30 bg-[var(--ink)] text-white rounded-2xl px-2 py-2.5 flex justify-around shadow-lg">
      {[
        { id: 'home',    label: 'Home',        icon: LayoutGrid, href: '/' },
        { id: 'list',    label: 'Assignments', icon: FileText,   href: '/' },
        { id: 'library', label: 'Library',     icon: BookOpen,   href: '/' },
        { id: 'toolkit', label: 'AI Toolkit',  icon: Sparkles,   href: '/' },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => router.push(item.href)}
            className={cls(
              'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[11px] transition',
              item.id === 'list' ? 'bg-white text-[var(--ink)]' : 'text-white/70',
            )}
          >
            <Icon size={18} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function TopHeader({
  title = 'Assignment',
  showBack = false,
  onBack,
}: { title?: string; showBack?: boolean; onBack?: () => void }) {
  return (
    <div className="hidden lg:flex bg-white rounded-2xl mx-6 mt-5 px-5 py-3 items-center gap-3 shadow-[var(--shadow-soft)]">
      {showBack && (
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center hover:bg-[var(--ivory)] transition"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
      )}
      <LayoutGrid size={16} className="text-[var(--muted)]" />
      <span className="text-[var(--muted)] text-sm">{title}</span>
      <div className="flex-1" />
      <button className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center relative">
        <Bell size={15} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--terracotta)]" />
      </button>
      <div className="flex items-center gap-2 pl-2">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F2A07A] to-[#E85D2C]" />
        <span className="text-sm font-medium">John Doe</span>
        <ChevronDown size={14} className="text-[var(--muted)]" />
      </div>
    </div>
  );
}
