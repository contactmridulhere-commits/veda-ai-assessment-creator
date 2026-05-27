// VedaAI — AI Assessment Creator
// Single-file React demo matching the provided Figma designs.
// Uses the in-platform Anthropic API for the demo generation;
// the production backend (Node/Express) is wired to Groq + GPT-OSS-20B.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles, LayoutGrid, Users, FileText, BookOpen, PieChart, Settings,
  Bell, ChevronDown, ArrowLeft, ArrowRight, Plus, Minus, X, Calendar,
  Upload, FileDown, Loader2, MoreVertical, Search, Filter, Check,
  Menu, GraduationCap, AlertCircle, Trash2, Eye, RefreshCw, Printer,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens (matches the Figma + the Next.js Tailwind config)
// ─────────────────────────────────────────────────────────────────────────────

const TOKENS = `
:root {
  --bg: #EDEAE5;
  --surface: #FFFFFF;
  --surface-2: #F7F5F0;
  --ivory: #F5EEDC;
  --ink: #1A1A1A;
  --ink-soft: #2A2A2A;
  --muted: #6B6B6B;
  --line: #E5E0D5;
  --line-strong: #D9D3C5;
  --terracotta: #E85D2C;
  --terracotta-soft: #F2A07A;
  --easy-bg: #DDF0E2; --easy-fg: #2D6A47;
  --moderate-bg: #FBF1DC; --moderate-fg: #8B6914;
  --hard-bg: #F8E0D9; --hard-fg: #9B3D2C;
  --shadow-card: 0 1px 2px rgba(26,26,26,0.04), 0 6px 16px rgba(26,26,26,0.05);
  --shadow-soft: 0 1px 2px rgba(26,26,26,0.04), 0 2px 6px rgba(26,26,26,0.03);
}
* { box-sizing: border-box; }
html, body { background: var(--bg); }
body { font-family: 'DM Sans', system-ui, -apple-system, sans-serif; color: var(--ink); }
.font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
.font-mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }

/* hide scrollbars in subtle places */
.nice-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.nice-scroll::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 4px; }
.nice-scroll::-webkit-scrollbar-track { background: transparent; }

/* Print: only the exam paper */
@media print {
  body * { visibility: hidden !important; }
  #exam-paper, #exam-paper * { visibility: visible !important; }
  #exam-paper {
    position: absolute !important; left: 0; top: 0; width: 100%;
    box-shadow: none !important; border: none !important; background: white !important;
  }
  .no-print { display: none !important; }
  @page { margin: 18mm 16mm; }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Domain constants
// ─────────────────────────────────────────────────────────────────────────────

const QUESTION_TYPES = {
  mcq:       { label: 'Multiple Choice Questions', short: 'MCQ',        defaultCount: 5, defaultMarks: 1 },
  short:     { label: 'Short Answer Questions',     short: 'Short',      defaultCount: 4, defaultMarks: 2 },
  long:      { label: 'Long Answer Questions',      short: 'Long',       defaultCount: 2, defaultMarks: 5 },
  truefalse: { label: 'True / False',                short: 'T/F',        defaultCount: 5, defaultMarks: 1 },
  fill:      { label: 'Fill in the Blanks',          short: 'Fill',       defaultCount: 5, defaultMarks: 1 },
  numerical: { label: 'Numerical Problems',          short: 'Numerical',  defaultCount: 3, defaultMarks: 3 },
};

const STAGES = [
  { key: 'connect',  label: 'Connecting to the model'      },
  { key: 'analyse',  label: 'Analysing your inputs'        },
  { key: 'research', label: 'Gathering subject context'    },
  { key: 'draft',    label: 'Drafting questions'           },
  { key: 'balance',  label: 'Balancing difficulty'         },
  { key: 'organise', label: 'Organising sections'          },
  { key: 'finalise', label: 'Finalising the paper'         },
];

const SCHOOL = { name: 'Delhi Public School', location: 'Bokaro Steel City', sector: 'Sector-4, Bokaro' };

// ─────────────────────────────────────────────────────────────────────────────
// Mock initial data (seeded so the list isn't always empty after the first run)
// ─────────────────────────────────────────────────────────────────────────────

const seedAssignments = () => ([]);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const todayPlus = (days = 7) => {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, day] = iso.split('-');
  return `${day}-${m}-${y}`;
};

const uid = () => Math.random().toString(36).slice(2, 10);

const stripCodeFence = (s) => s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

const safeParseJSON = (s) => {
  try { return JSON.parse(s); } catch { /* try harder */ }
  const first = s.indexOf('{'); const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(s.slice(first, last + 1)); } catch { /* noop */ }
  }
  return null;
};

const validatePaper = (paper) => {
  if (!paper || typeof paper !== 'object') return 'Empty response';
  if (!paper.title || typeof paper.title !== 'string') return 'Missing title';
  if (!Array.isArray(paper.sections) || paper.sections.length === 0) return 'Missing sections';
  for (const sec of paper.sections) {
    if (!sec.title || !Array.isArray(sec.questions) || sec.questions.length === 0) return 'Empty section';
    for (const q of sec.questions) {
      if (!q.text || !q.difficulty || !q.marks) return 'Malformed question';
      if (!['easy', 'moderate', 'hard'].includes(q.difficulty)) return `Bad difficulty: ${q.difficulty}`;
    }
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder + AI call
// ─────────────────────────────────────────────────────────────────────────────

const buildPrompt = (input) => {
  const totalQs = input.questionTypes.reduce((s, t) => s + t.count, 0);
  const totalMarks = input.questionTypes.reduce((s, t) => s + t.count * t.marks, 0);

  const breakdown = input.questionTypes
    .map((t, i) => `  Section ${String.fromCharCode(65 + i)} — ${QUESTION_TYPES[t.type].label}: ${t.count} questions × ${t.marks} marks (= ${t.count * t.marks} marks)`)
    .join('\n');

  const src = input.sourceText ? `\nSource material to anchor questions in:\n"""\n${input.sourceText.slice(0, 3500)}\n"""` : '';
  const extra = input.additionalInstructions?.trim() ? `\nTeacher's additional instructions: ${input.additionalInstructions.trim()}` : '';

  return `You are an experienced exam-paper setter for Indian schools (CBSE-style).
Generate ONE complete question paper as STRICT JSON ONLY — no prose, no markdown fences.

Paper specification
- Title: "${input.title}"
- Subject: ${input.subject || 'General'}
- Class / Grade: ${input.grade || 'N/A'}
- Due date: ${input.dueDate}
- Total questions: ${totalQs}
- Total marks: ${totalMarks}

Structure (one section per question type, in order):
${breakdown}

Difficulty balance per section: roughly 40% easy, 40% moderate, 20% hard.
Each MCQ MUST include exactly 4 plausible options labelled (a)–(d).
Each True/False question must be a single declarative statement.
Each Fill-in-the-Blank must contain a "___" placeholder.
Numerical problems must include realistic numbers and units.
Questions must be self-contained, original, and grade-appropriate.${src}${extra}

Return EXACTLY this JSON shape:
{
  "title": string,
  "subject": string,
  "grade": string,
  "dueDate": string,
  "totalMarks": number,
  "timeAllowedMinutes": number,
  "generalInstructions": string[],
  "sections": [
    {
      "id": "A" | "B" | "C" | ...,
      "title": string,
      "instruction": string,
      "type": "mcq"|"short"|"long"|"truefalse"|"fill"|"numerical",
      "marksPerQuestion": number,
      "questions": [
        {
          "number": number,
          "text": string,
          "difficulty": "easy"|"moderate"|"hard",
          "marks": number,
          "options": string[] | null,
          "type": "mcq"|"short"|"long"|"truefalse"|"fill"|"numerical"
        }
      ]
    }
  ]
}`;
};

// Calls Anthropic in-platform — the production backend uses Groq's openai/gpt-oss-20b instead.
const callAI = async (prompt) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
  const data = await res.json();
  const text = (data.content || []).map((b) => b.text || '').join('').trim();
  return stripCodeFence(text);
};

// ─────────────────────────────────────────────────────────────────────────────
// UI primitives
// ─────────────────────────────────────────────────────────────────────────────

const cls = (...xs) => xs.filter(Boolean).join(' ');

const Pill = ({ tone = 'easy', children }) => {
  const map = {
    easy:     { bg: 'var(--easy-bg)',     fg: 'var(--easy-fg)' },
    moderate: { bg: 'var(--moderate-bg)', fg: 'var(--moderate-fg)' },
    hard:     { bg: 'var(--hard-bg)',     fg: 'var(--hard-fg)' },
  };
  const t = map[tone] || map.easy;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
};

const PrimaryButton = ({ children, onClick, type = 'button', disabled, icon: Icon, className = '' }) => (
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

const GhostButton = ({ children, onClick, icon: Icon, className = '' }) => (
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

const AccentCTA = ({ children, onClick, icon: Icon, className = '' }) => (
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

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar (desktop) + mobile top/bottom bars
// ─────────────────────────────────────────────────────────────────────────────

const NAV = [
  { id: 'home',     label: 'Home',                icon: LayoutGrid },
  { id: 'groups',   label: 'My Groups',           icon: Users },
  { id: 'list',     label: 'Assignments',         icon: FileText },
  { id: 'toolkit',  label: "AI Teacher's Toolkit", icon: BookOpen },
  { id: 'library',  label: 'My Library',          icon: PieChart },
];

const Sidebar = ({ active, onNav, onCreate, count }) => (
  <aside className="hidden lg:flex w-[280px] shrink-0 h-screen sticky top-0 flex-col bg-white border-r border-[var(--line)] p-5">
    {/* Logo */}
    <div className="flex items-center gap-2.5 mb-7 px-1">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-lg"
           style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #3A2D24 50%, #E85D2C 100%)' }}>
        v
      </div>
      <span className="font-display text-xl font-semibold tracking-tight">VedaAI</span>
    </div>

    {/* CTA */}
    <AccentCTA icon={Sparkles} onClick={onCreate}>Create Assignment</AccentCTA>

    {/* Nav */}
    <nav className="mt-7 space-y-1">
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            className={cls(
              'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
              isActive ? 'bg-[var(--ivory)] text-[var(--ink)] font-medium' : 'text-[var(--muted)] hover:bg-[var(--surface-2)]',
            )}
          >
            <Icon size={18} />
            <span className="flex-1 text-left">{item.label}</span>
            {item.id === 'list' && count > 0 && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--terracotta)] text-white">{count}</span>
            )}
          </button>
        );
      })}
    </nav>

    {/* Spacer */}
    <div className="flex-1" />

    {/* Settings + school */}
    <button className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] mb-3">
      <Settings size={18} /> Settings
    </button>
    <div className="rounded-xl bg-[var(--surface-2)] p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F2A07A] to-[#E85D2C] flex items-center justify-center text-white font-display text-sm">D</div>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate">{SCHOOL.name}</div>
        <div className="text-xs text-[var(--muted)] truncate">{SCHOOL.location}</div>
      </div>
    </div>
  </aside>
);

const MobileTopBar = ({ onMenu }) => (
  <div className="lg:hidden sticky top-0 z-30 bg-white border-b border-[var(--line)] px-4 py-3 flex items-center gap-3">
    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
         style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #E85D2C 100%)' }}>v</div>
    <span className="font-display text-lg font-semibold flex-1">VedaAI</span>
    <button className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center relative">
      <Bell size={16} />
      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--terracotta)]" />
    </button>
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#F2A07A] to-[#E85D2C]" />
    <button onClick={onMenu} className="w-9 h-9 flex items-center justify-center"><Menu size={20} /></button>
  </div>
);

const MobileBottomBar = ({ active, onNav, onCreate }) => (
  <div className="lg:hidden fixed bottom-3 left-3 right-3 z-30 bg-[var(--ink)] text-white rounded-2xl px-2 py-2.5 flex justify-around shadow-lg">
    {[
      { id: 'home', label: 'Home', icon: LayoutGrid },
      { id: 'list', label: 'Assignments', icon: FileText },
      { id: 'library', label: 'Library', icon: BookOpen },
      { id: 'toolkit', label: 'AI Toolkit', icon: Sparkles },
    ].map((item) => {
      const Icon = item.icon;
      const isActive = item.id === active;
      return (
        <button
          key={item.id}
          onClick={() => onNav(item.id)}
          className={cls(
            'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-[11px] transition',
            isActive ? 'bg-white text-[var(--ink)]' : 'text-white/70',
          )}
        >
          <Icon size={18} />
          {item.label}
        </button>
      );
    })}
  </div>
);

const TopHeader = ({ title, backTo, onBack, right }) => (
  <div className="hidden lg:flex bg-white rounded-2xl mx-6 mt-5 px-5 py-3 items-center gap-3 shadow-[var(--shadow-soft)]">
    {backTo && (
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-[var(--surface-2)] flex items-center justify-center hover:bg-[var(--ivory)] transition">
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

// ─────────────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = ({ onCreate }) => (
  <div className="flex flex-col items-center justify-center py-12 lg:py-20 px-6 text-center">
    {/* Illustration */}
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

// ─────────────────────────────────────────────────────────────────────────────
// Assignment list
// ─────────────────────────────────────────────────────────────────────────────

const ListView = ({ assignments, onCreate, onOpen, onDelete }) => {
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const filtered = assignments.filter((a) =>
    a.inputs.title.toLowerCase().includes(search.toLowerCase()),
  );

  if (assignments.length === 0) {
    return (
      <div className="px-6 py-6">
        <EmptyState onCreate={onCreate} />
      </div>
    );
  }

  return (
    <div className="px-4 lg:px-6 py-5 pb-32 lg:pb-10">
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
            className="bg-white rounded-2xl shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] transition px-5 py-5 group relative cursor-pointer"
            onClick={() => onOpen(a)}
          >
            <div className="flex items-start gap-3 mb-6">
              <h3 className="font-display text-lg lg:text-xl font-semibold underline-offset-4 underline decoration-[var(--line-strong)] flex-1">
                {a.inputs.title}
              </h3>
              <button
                onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === a.id ? null : a.id); }}
                className="w-7 h-7 rounded-full hover:bg-[var(--surface-2)] flex items-center justify-center"
              >
                <MoreVertical size={16} />
              </button>
              {openMenu === a.id && (
                <div className="absolute right-4 top-12 bg-white rounded-xl shadow-lg border border-[var(--line)] py-1 z-10 min-w-[160px]">
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenu(null); onOpen(a); }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-2)] flex items-center gap-2"
                  >
                    <Eye size={14} /> View Assignment
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenu(null); onDelete(a.id); }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--surface-2)] flex items-center gap-2 text-[var(--terracotta)]"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between text-sm">
              <span><b>Assigned on</b> <span className="text-[var(--muted)]">: {fmtDate(a.createdOn)}</span></span>
              <span><b>Due</b> <span className="text-[var(--muted)]">: {fmtDate(a.inputs.dueDate)}</span></span>
            </div>
          </div>
        ))}
      </div>

      {/* Floating create CTA */}
      <button
        onClick={onCreate}
        className="hidden lg:flex fixed bottom-6 left-1/2 -translate-x-1/2 items-center gap-2 px-6 py-3 rounded-full bg-[var(--ink)] text-white shadow-xl hover:shadow-2xl transition text-sm font-medium"
        style={{ marginLeft: 140 }}
      >
        <Plus size={16} /> Create Assignment
      </button>
      <button
        onClick={onCreate}
        className="lg:hidden fixed bottom-24 right-5 w-14 h-14 rounded-full bg-white shadow-xl flex items-center justify-center"
      >
        <Plus size={24} className="text-[var(--terracotta)]" />
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Create — multi-step form
// ─────────────────────────────────────────────────────────────────────────────

const CreateView = ({ onCancel, onSubmit }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '',
    subject: '',
    grade: '',
    sourceText: '',
    sourceFilename: '',
    dueDate: todayPlus(7),
    questionTypes: [
      { id: uid(), type: 'mcq',   count: QUESTION_TYPES.mcq.defaultCount,   marks: QUESTION_TYPES.mcq.defaultMarks },
      { id: uid(), type: 'short', count: QUESTION_TYPES.short.defaultCount, marks: QUESTION_TYPES.short.defaultMarks },
    ],
    additionalInstructions: '',
  });
  const [errors, setErrors] = useState({});

  const totalQs    = form.questionTypes.reduce((s, t) => s + t.count, 0);
  const totalMarks = form.questionTypes.reduce((s, t) => s + t.count * t.marks, 0);

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setQT  = (i, patch) => setForm((f) => ({ ...f, questionTypes: f.questionTypes.map((q, idx) => idx === i ? { ...q, ...patch } : q) }));
  const addQT  = () => {
    const used = new Set(form.questionTypes.map((q) => q.type));
    const next = Object.keys(QUESTION_TYPES).find((k) => !used.has(k)) || 'mcq';
    setForm((f) => ({ ...f, questionTypes: [...f.questionTypes, { id: uid(), type: next, count: QUESTION_TYPES[next].defaultCount, marks: QUESTION_TYPES[next].defaultMarks }] }));
  };
  const rmQT = (i) => setForm((f) => ({ ...f, questionTypes: f.questionTypes.filter((_, idx) => idx !== i) }));

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrors((e) => ({ ...e, file: 'File too large (max 10MB)' }));
      return;
    }
    const ok = file.type === 'application/pdf' || file.type === 'text/plain' || /\.txt$|\.pdf$/i.test(file.name);
    if (!ok) {
      setErrors((e) => ({ ...e, file: 'Only PDF and TXT supported' }));
      return;
    }
    if (file.type === 'text/plain') {
      const text = await file.text();
      update('sourceText', text);
      update('sourceFilename', file.name);
    } else {
      update('sourceFilename', file.name);
      update('sourceText', `(PDF "${file.name}" uploaded — would be parsed server-side in the production backend.)`);
    }
    setErrors((e) => { const c = { ...e }; delete c.file; return c; });
  };

  const validateStep1 = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Required';
    if (!form.subject.trim()) e.subject = 'Required';
    if (!form.grade.trim()) e.grade = 'Required';
    setErrors(e); return Object.keys(e).length === 0;
  };
  const validateStep2 = () => {
    const e = {};
    if (!form.dueDate) e.dueDate = 'Required';
    if (form.dueDate && new Date(form.dueDate) < new Date(new Date().toDateString())) e.dueDate = 'Cannot be in the past';
    if (form.questionTypes.length === 0) e.qt = 'Add at least one question type';
    form.questionTypes.forEach((q, i) => {
      if (q.count <= 0) e[`qt-${i}-count`] = '> 0';
      if (q.marks <= 0) e[`qt-${i}-marks`] = '> 0';
    });
    setErrors(e); return Object.keys(e).length === 0;
  };

  const next = () => { if (validateStep1()) setStep(2); };
  const back = () => setStep(1);
  const submit = () => { if (validateStep2()) onSubmit(form); };

  return (
    <div className="px-4 lg:px-6 py-5 pb-32 lg:pb-10">
      {/* Progress */}
      <div className="bg-white rounded-2xl shadow-[var(--shadow-soft)] px-5 py-4 mb-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs text-[var(--muted)] uppercase tracking-wide">Step {step} of 2</span>
          <span className="text-sm font-medium">{step === 1 ? 'Assignment Details' : 'Question Configuration'}</span>
        </div>
        <div className="flex gap-2">
          <div className={cls('h-1.5 flex-1 rounded-full', step >= 1 ? 'bg-[var(--ink)]' : 'bg-[var(--line)]')} />
          <div className={cls('h-1.5 flex-1 rounded-full', step >= 2 ? 'bg-[var(--ink)]' : 'bg-[var(--line)]')} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[var(--shadow-soft)] p-5 lg:p-8">
        {step === 1 ? (
          <>
            <h2 className="font-display text-2xl font-semibold mb-1">Assignment Details</h2>
            <p className="text-sm text-[var(--muted)] mb-6">Basic information about your assignment.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Field label="Assignment Title" error={errors.title}>
                <input
                  type="text" value={form.title} onChange={(e) => update('title', e.target.value)}
                  placeholder="e.g. Quiz on Electricity"
                  className="input"
                />
              </Field>
              <Field label="Subject" error={errors.subject}>
                <input
                  type="text" value={form.subject} onChange={(e) => update('subject', e.target.value)}
                  placeholder="e.g. Science"
                  className="input"
                />
              </Field>
              <Field label="Class / Grade" error={errors.grade}>
                <input
                  type="text" value={form.grade} onChange={(e) => update('grade', e.target.value)}
                  placeholder="e.g. 8th"
                  className="input"
                />
              </Field>
              <Field label="Due Date" error={errors.dueDate}>
                <div className="relative">
                  <input
                    type="date" value={form.dueDate} onChange={(e) => update('dueDate', e.target.value)}
                    className="input pr-10"
                  />
                  <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                </div>
              </Field>
            </div>

            <div className="mt-5">
              <label className="block text-sm font-medium mb-2">Source Material <span className="text-[var(--muted)] font-normal">(optional)</span></label>
              <label className="block rounded-2xl border-2 border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] px-6 py-8 text-center cursor-pointer hover:bg-[var(--ivory)] transition">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white border border-[var(--line)] flex items-center justify-center">
                  <Upload size={20} className="text-[var(--ink)]" />
                </div>
                <div className="font-medium mb-1">
                  {form.sourceFilename ? form.sourceFilename : 'Choose a file or drag & drop it here'}
                </div>
                <div className="text-xs text-[var(--muted)] mb-3">PDF or TXT, up to 10MB</div>
                <span className="inline-flex items-center px-4 py-2 rounded-full bg-white border border-[var(--line)] text-sm font-medium">Browse Files</span>
                <input type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
              {errors.file && <ErrorText>{errors.file}</ErrorText>}
              <p className="text-xs text-[var(--muted)] text-center mt-2">Upload images of your preferred document/image</p>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-semibold mb-1">Question Configuration</h2>
            <p className="text-sm text-[var(--muted)] mb-6">Choose question types, counts, and marks. Each type becomes its own section.</p>

            <div className="space-y-3">
              <div className="hidden lg:grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center pb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                <span className="underline underline-offset-4">Question Type</span>
                <span />
                <span className="text-center w-32">No. of Questions</span>
                <span className="text-center w-32">Marks</span>
                <span />
              </div>

              {form.questionTypes.map((q, i) => (
                <div key={q.id} className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center bg-[var(--surface-2)] lg:bg-transparent rounded-2xl p-3 lg:p-0">
                  <div className="relative">
                    <select
                      value={q.type}
                      onChange={(e) => {
                        const t = e.target.value;
                        setQT(i, { type: t, count: QUESTION_TYPES[t].defaultCount, marks: QUESTION_TYPES[t].defaultMarks });
                      }}
                      className="input appearance-none pr-10"
                    >
                      {Object.entries(QUESTION_TYPES).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                  </div>
                  <span className="hidden lg:block text-[var(--muted)] px-2">×</span>
                  <Counter value={q.count} onChange={(v) => setQT(i, { count: v })} />
                  <Counter value={q.marks} onChange={(v) => setQT(i, { marks: v })} />
                  <button
                    onClick={() => rmQT(i)}
                    disabled={form.questionTypes.length === 1}
                    className="w-9 h-9 rounded-full bg-white border border-[var(--line)] hover:bg-[var(--surface-2)] flex items-center justify-center disabled:opacity-30"
                    aria-label="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              <button
                onClick={addQT}
                className="flex items-center gap-2 mt-3 text-sm font-medium hover:text-[var(--terracotta)] transition"
              >
                <span className="w-9 h-9 rounded-full bg-[var(--ink)] text-white flex items-center justify-center">
                  <Plus size={14} />
                </span>
                Add Question Type
              </button>
            </div>

            <div className="flex flex-col items-end mt-6 text-sm">
              <div><b>Total Questions :</b> {totalQs}</div>
              <div><b>Total Marks :</b> {totalMarks}</div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium mb-2">
                Additional Information <span className="text-[var(--muted)] font-normal">(for better output)</span>
              </label>
              <textarea
                value={form.additionalInstructions}
                onChange={(e) => update('additionalInstructions', e.target.value)}
                placeholder="e.g. Generate a question paper for 3 hour exam duration. Focus on Chapter 12 — Electricity. Include numerical problems based on Ohm's Law."
                rows={4}
                className="input resize-none"
              />
            </div>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-6">
        <GhostButton icon={ArrowLeft} onClick={step === 1 ? onCancel : back}>
          {step === 1 ? 'Cancel' : 'Previous'}
        </GhostButton>
        {step === 1 ? (
          <PrimaryButton onClick={next}>Next <ArrowRight size={14} /></PrimaryButton>
        ) : (
          <PrimaryButton icon={Sparkles} onClick={submit}>Generate Paper</PrimaryButton>
        )}
      </div>

      <style>{`
        .input {
          width: 100%; background: white; border: 1px solid var(--line);
          border-radius: 9999px; padding: 0.7rem 1rem; font-size: 0.875rem; outline: none;
          transition: border-color 0.15s;
        }
        .input:focus { border-color: var(--ink); }
        textarea.input { border-radius: 1rem; padding: 0.9rem 1rem; }
        select.input { padding-right: 2.5rem; }
      `}</style>
    </div>
  );
};

const Field = ({ label, error, children }) => (
  <div>
    <label className="block text-sm font-medium mb-2">{label}</label>
    {children}
    {error && <ErrorText>{error}</ErrorText>}
  </div>
);

const ErrorText = ({ children }) => (
  <div className="flex items-center gap-1 mt-1 text-xs text-[var(--terracotta)]">
    <AlertCircle size={12} /> {children}
  </div>
);

const Counter = ({ value, onChange, min = 1, max = 30 }) => (
  <div className="inline-flex items-center bg-white rounded-full border border-[var(--line)] overflow-hidden">
    <button
      onClick={() => onChange(Math.max(min, value - 1))}
      className="w-9 h-9 flex items-center justify-center hover:bg-[var(--surface-2)] text-[var(--muted)]"
      aria-label="Decrease"
    >
      <Minus size={12} />
    </button>
    <span className="w-10 text-center text-sm font-medium tabular-nums">{value}</span>
    <button
      onClick={() => onChange(Math.min(max, value + 1))}
      className="w-9 h-9 flex items-center justify-center hover:bg-[var(--surface-2)] text-[var(--muted)]"
      aria-label="Increase"
    >
      <Plus size={12} />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Generating screen (mock WebSocket progress)
// ─────────────────────────────────────────────────────────────────────────────

const GeneratingView = ({ stage, error, onCancel, onRetry }) => {
  const stageIndex = Math.max(0, STAGES.findIndex((s) => s.key === stage));
  return (
    <div className="px-4 lg:px-6 py-10 lg:py-16">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-[var(--shadow-card)] p-8 lg:p-12 text-center">
        {error ? (
          <>
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[var(--hard-bg)] flex items-center justify-center">
              <AlertCircle size={28} className="text-[var(--hard-fg)]" />
            </div>
            <h2 className="font-display text-2xl font-semibold mb-2">Generation failed</h2>
            <p className="text-sm text-[var(--muted)] mb-6">{error}</p>
            <div className="flex justify-center gap-3">
              <GhostButton onClick={onCancel}>Cancel</GhostButton>
              <PrimaryButton icon={RefreshCw} onClick={onRetry}>Try again</PrimaryButton>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[var(--ivory)] flex items-center justify-center relative">
              <Loader2 size={28} className="text-[var(--terracotta)] animate-spin" />
            </div>
            <h2 className="font-display text-2xl lg:text-3xl font-semibold mb-1">Crafting your paper</h2>
            <p className="text-sm text-[var(--muted)] mb-7">Hold tight — typically this takes 10–15 seconds.</p>

            <div className="space-y-2.5 text-left max-w-md mx-auto">
              {STAGES.map((s, i) => {
                const done    = i < stageIndex;
                const current = i === stageIndex;
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <div className={cls(
                      'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition',
                      done    ? 'bg-emerald-500 text-white'  :
                      current ? 'bg-[var(--ink)] text-white' :
                                'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--muted)]',
                    )}>
                      {done ? <Check size={12} /> : current ? <Loader2 size={12} className="animate-spin" /> : <span className="text-[10px]">{i + 1}</span>}
                    </div>
                    <span className={cls('text-sm', current ? 'text-[var(--ink)] font-medium' : done ? 'text-[var(--muted)]' : 'text-[var(--muted)]')}>
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Output paper
// ─────────────────────────────────────────────────────────────────────────────

const difficultyLabel = (d) => d === 'easy' ? 'Easy' : d === 'moderate' ? 'Moderate' : 'Hard';

const OutputView = ({ assignment, onBack, onRegenerate }) => {
  const paper = assignment.paper;
  const intro = useMemo(() => `Certainly! Here is your customized question paper for the ${paper.subject || 'Subject'} class ${paper.grade || ''} on "${paper.title}".`, [paper]);

  return (
    <div className="px-4 lg:px-6 py-5 pb-32 lg:pb-10">
      {/* Dark intro banner with actions */}
      <div className="no-print bg-[var(--ink)] text-white rounded-2xl px-5 lg:px-7 py-5 mb-5 flex flex-col lg:flex-row items-start lg:items-center gap-4">
        <p className="flex-1 text-sm lg:text-base leading-relaxed">{intro}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[var(--ink)] text-sm font-medium hover:bg-[var(--surface-2)] transition">
            <FileDown size={15} /> Download as PDF
          </button>
          <button onClick={onRegenerate} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition">
            <RefreshCw size={15} /> Regenerate
          </button>
          <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition">
            <ArrowLeft size={15} /> Back
          </button>
        </div>
      </div>

      {/* The paper */}
      <div id="exam-paper" className="bg-white rounded-2xl shadow-[var(--shadow-card)] px-5 lg:px-14 py-8 lg:py-12 max-w-4xl mx-auto">
        {/* School header */}
        <div className="text-center mb-6">
          <h1 className="font-display text-xl lg:text-2xl font-semibold mb-2">{SCHOOL.name}, {SCHOOL.sector}</h1>
          <div className="text-base lg:text-lg">Subject: {paper.subject || '—'}</div>
          <div className="text-base lg:text-lg">Class: {paper.grade || '—'}</div>
        </div>

        <div className="flex flex-col lg:flex-row justify-between text-sm lg:text-base mb-4 gap-1">
          <span>Time Allowed: {paper.timeAllowedMinutes || 60} minutes</span>
          <span>Maximum Marks: {paper.totalMarks}</span>
        </div>

        <div className="text-sm lg:text-base mb-6">
          {(paper.generalInstructions?.[0]) || 'All questions are compulsory unless stated otherwise.'}
        </div>

        {/* Student fields */}
        <div className="space-y-2.5 mb-8 text-sm lg:text-base">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">Name:</span>
            <span className="flex-1 border-b border-dotted border-[var(--ink)]">&nbsp;</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">Roll Number:</span>
            <span className="flex-1 border-b border-dotted border-[var(--ink)]">&nbsp;</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">Class: {paper.grade} Section:</span>
            <span className="flex-1 border-b border-dotted border-[var(--ink)]">&nbsp;</span>
          </div>
        </div>

        {/* Sections */}
        {paper.sections.map((sec, si) => (
          <section key={sec.id || si} className="mb-8" style={{ pageBreakInside: 'avoid' }}>
            <h2 className="font-display text-center text-xl lg:text-2xl font-semibold mb-2">Section {sec.id}</h2>
            <div className="text-base font-semibold">{sec.title}</div>
            <div className="italic text-sm text-[var(--muted)] mb-4">{sec.instruction}</div>
            <ol className="space-y-3 list-decimal pl-5">
              {sec.questions.map((q, qi) => (
                <li key={qi} className="text-sm lg:text-base leading-relaxed" style={{ pageBreakInside: 'avoid' }}>
                  <div className="flex items-start gap-2 flex-wrap">
                    <Pill tone={q.difficulty}>{difficultyLabel(q.difficulty)}</Pill>
                    <span className="flex-1">{q.text}</span>
                    <span className="text-[var(--muted)] text-sm whitespace-nowrap">[{q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}]</span>
                  </div>
                  {q.options && q.options.length > 0 && (
                    <ol className="mt-1.5 ml-1 space-y-0.5 text-sm" style={{ listStyleType: 'lower-alpha', paddingLeft: '1.25rem' }}>
                      {q.options.map((opt, oi) => <li key={oi}>{opt}</li>)}
                    </ol>
                  )}
                </li>
              ))}
            </ol>
          </section>
        ))}

        <div className="text-center mt-10 text-sm text-[var(--muted)] italic">— End of Paper —</div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Root app
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView]               = useState('list'); // list | create | generating | output
  const [activeNav, setActiveNav]     = useState('list');
  const [assignments, setAssignments] = useState(seedAssignments);
  const [currentAssignment, setCurrent] = useState(null);
  const [genStage, setGenStage]       = useState('connect');
  const [genError, setGenError]       = useState(null);
  const [lastInput, setLastInput]     = useState(null);
  const stageTimerRef = useRef(null);

  // Fonts
  useEffect(() => {
    if (document.getElementById('vai-fonts')) return;
    const l = document.createElement('link');
    l.id = 'vai-fonts';
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;500&display=swap';
    document.head.appendChild(l);
  }, []);

  const advanceStages = () => {
    // Mock WebSocket progress while the AI works
    let i = 0;
    setGenStage(STAGES[0].key);
    stageTimerRef.current = setInterval(() => {
      i++;
      if (i < STAGES.length - 1) setGenStage(STAGES[i].key);
      else clearInterval(stageTimerRef.current);
    }, 1400);
  };

  const stopStages = () => {
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    stageTimerRef.current = null;
  };

  const generate = async (input) => {
    setLastInput(input);
    setGenError(null);
    setView('generating');
    advanceStages();
    try {
      const prompt = buildPrompt(input);
      const raw = await callAI(prompt);
      const parsed = safeParseJSON(raw);
      const err = validatePaper(parsed);
      if (err) throw new Error(err);

      // Normalise: ensure section ids A,B,C and numbering
      parsed.sections = parsed.sections.map((s, i) => ({ ...s, id: s.id || String.fromCharCode(65 + i) }));
      let counter = 0;
      parsed.sections.forEach((s) => { s.questions.forEach((q) => { counter += 1; q.number = counter; }); });

      stopStages();
      setGenStage(STAGES[STAGES.length - 1].key);

      const id = uid();
      const record = { id, inputs: input, paper: parsed, createdOn: new Date().toISOString().slice(0, 10) };
      setAssignments((xs) => [record, ...xs]);
      setCurrent(record);
      // tiny delay so user sees "finalise" check
      setTimeout(() => setView('output'), 350);
    } catch (e) {
      stopStages();
      setGenError(e.message || 'Something went wrong while generating the paper.');
    }
  };

  const handleNav = (id) => {
    setActiveNav(id);
    if (id === 'list' || id === 'home') setView('list');
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      <style>{TOKENS}</style>

      <Sidebar
        active={activeNav}
        onNav={handleNav}
        onCreate={() => { setActiveNav('list'); setView('create'); }}
        count={assignments.length}
      />

      <main className="flex-1 min-w-0">
        <MobileTopBar onMenu={() => {}} />
        <TopHeader
          title={view === 'output' ? 'Create New' : 'Assignment'}
          backTo={view !== 'list'}
          onBack={() => setView('list')}
        />

        <div className="pb-6">
          {view === 'list' && (
            <ListView
              assignments={assignments}
              onCreate={() => setView('create')}
              onOpen={(a) => { setCurrent(a); setView('output'); }}
              onDelete={(id) => setAssignments((xs) => xs.filter((x) => x.id !== id))}
            />
          )}
          {view === 'create' && (
            <CreateView
              onCancel={() => setView('list')}
              onSubmit={generate}
            />
          )}
          {view === 'generating' && (
            <GeneratingView
              stage={genStage}
              error={genError}
              onCancel={() => { stopStages(); setView('create'); }}
              onRetry={() => lastInput && generate(lastInput)}
            />
          )}
          {view === 'output' && currentAssignment && (
            <OutputView
              assignment={currentAssignment}
              onBack={() => setView('list')}
              onRegenerate={() => lastInput && generate(lastInput)}
            />
          )}
        </div>
      </main>

      <MobileBottomBar
        active={activeNav}
        onNav={handleNav}
        onCreate={() => { setActiveNav('list'); setView('create'); }}
      />
    </div>
  );
}
