'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Plus, X, Sparkles, MoreVertical, Eye, Trash2,
  Filter, Search,
} from 'lucide-react';
import { api } from '../lib/api';
import type { AssignmentRecord } from '../lib/types';
import { TopHeader } from '../components/Chrome';
import { PrimaryButton, cls } from '../components/ui';

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = iso.slice(0, 10).split('-');
  if (d.length !== 3) return iso;
  return `${d[2]}-${d[1]}-${d[0]}`;
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 lg:py-20 px-6 text-center">
      <div className="relative w-56 h-56 mb-8">
        <div className="absolute inset-0 rounded-full bg-white/60 blur-2xl" />
        <div className="absolute inset-6 rounded-full bg-white shadow-[var(--shadow-card)] flex items-center justify-center">
          <FileText size={64} className="text-[var(--muted)]" strokeWidth={1.2} />
        </div>
        <div className="absolute right-2 bottom-6 w-20 h-20 rounded-full bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-center">
          <X size={32} className="text-[var(--terracotta)]" strokeWidth={3} />
        </div>
        <Sparkles size={20} className="absolute top-4 left-8 text-[#7BA7E1]" />
        <span className="absolute bottom-10 right-0 w-2 h-2 rounded-full bg-[#7BA7E1]" />
        <svg className="absolute top-0 left-2" width="60" height="60" viewBox="0 0 60 60" fill="none">
          <path d="M 5 50 Q 20 30, 40 35 T 55 15" stroke="#1A1A1A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="font-display text-2xl lg:text-3xl font-semibold mb-2">No assignments yet</h2>
      <p className="text-[var(--muted)] max-w-md mb-7 leading-relaxed">
        Create your first assignment to start collecting and grading student submissions.
        You can set up rubrics, define marking criteria, and let AI assist with grading.
      </p>
      <PrimaryButton icon={Plus} onClick={onCreate}>Create Your First Assignment</PrimaryButton>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [items, setItems] = useState<AssignmentRecord[] | null>(null);
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await api.listAssignments();
      setItems(r.assignments);
    } catch (e) {
      setError((e as Error).message);
      setItems([]); // show empty state on backend-down so users aren't stuck on a spinner
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = (id: string) => {
    setItems((xs) => xs?.filter((x) => x.id !== id) ?? null);
    setOpenMenu(null);
    // (DELETE endpoint not part of the brief — UI-only removal here.)
  };

  if (items === null) {
    return (
      <>
        <TopHeader />
        <div className="p-10 text-center text-[var(--muted)] text-sm">Loading assignments…</div>
      </>
    );
  }

  const filtered = items.filter((a) =>
    a.inputs.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <TopHeader />
      <div className="px-4 lg:px-6 py-5 pb-32 lg:pb-10">
        {error && (
          <div className="bg-[var(--hard-bg)] text-[var(--hard-fg)] rounded-xl px-4 py-3 mb-4 text-sm">
            Couldn’t reach the API: {error}. Showing empty list.
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState onCreate={() => router.push('/create')} />
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-[var(--shadow-soft)] px-5 py-5 mb-5">
              <div className="flex items-start gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 mt-2" />
                <div>
                  <h1 className="font-display text-xl lg:text-2xl font-semibold">Assignments</h1>
                  <p className="text-sm text-[var(--muted)]">Manage and create assignments for your classes.</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-[var(--shadow-soft)] px-4 py-3 mb-5 flex flex-col lg:flex-row gap-3">
              <button className="flex items-center gap-2 text-sm text-[var(--muted)] px-3 py-2 rounded-full hover:bg-[var(--surface-2)] self-start">
                <Filter size={14} /> Filter By
              </button>
              <div className="flex-1" />
              <div className="relative">
                <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="text"
                  placeholder="Search Assignment"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full lg:w-80 pl-10 pr-4 py-2.5 rounded-full border border-[var(--line)] bg-[var(--surface-2)] text-sm outline-none focus:border-[var(--ink)] transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((a) => (
                <div
                  key={a.id}
                  className={cls(
                    'bg-white rounded-2xl shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] transition px-5 py-5 group relative cursor-pointer',
                    a.status === 'failed' && 'border border-[var(--terracotta)]',
                  )}
                  onClick={() => {
                    if (a.status === 'completed') router.push(`/output/${a.id}`);
                    else if (a.status === 'queued' || a.status === 'active') router.push(`/generating/${a.jobId}`);
                  }}
                >
                  <div className="flex items-start gap-3 mb-6">
                    <h3 className="font-display text-lg lg:text-xl font-semibold underline-offset-4 underline decoration-[var(--line-strong)] flex-1">
                      {a.inputs.title}
                    </h3>
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === a.id ? null : a.id); }}
                      className="w-7 h-7 rounded-full hover:bg-[var(--surface-2)] flex items-center justify-center"
                      aria-label="More"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openMenu === a.id && (
                      <div className="absolute right-4 top-12 bg-white rounded-xl shadow-lg border border-[var(--line)] py-1 z-10 min-w-[160px]">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenu(null); router.push(`/output/${a.id}`); }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-2)] flex items-center gap-2"
                        >
                          <Eye size={14} /> View Assignment
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-2)] flex items-center gap-2 text-[var(--terracotta)]"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between text-sm">
                    <span><b>Assigned on</b> <span className="text-[var(--muted)]">: {fmtDate(a.createdAt)}</span></span>
                    <span><b>Due</b> <span className="text-[var(--muted)]">: {fmtDate(a.inputs.dueDate)}</span></span>
                  </div>
                  {a.status !== 'completed' && (
                    <div className="mt-3 text-xs text-[var(--muted)] italic capitalize">{a.status}…</div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => router.push('/create')}
              className="hidden lg:flex fixed bottom-6 left-1/2 items-center gap-2 px-6 py-3 rounded-full bg-[var(--ink)] text-white shadow-xl hover:shadow-2xl transition text-sm font-medium"
              style={{ transform: 'translateX(calc(-50% + 140px))' }}
            >
              <Plus size={16} /> Create Assignment
            </button>
            <button
              onClick={() => router.push('/create')}
              className="lg:hidden fixed bottom-24 right-5 w-14 h-14 rounded-full bg-white shadow-xl flex items-center justify-center"
              aria-label="Create assignment"
            >
              <Plus size={24} className="text-[var(--terracotta)]" />
            </button>
          </>
        )}
      </div>
    </>
  );
}
