'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FileDown, RefreshCw, ArrowLeft,
} from 'lucide-react';
import { api } from '../../../lib/api';
import type { AssignmentRecord, Difficulty } from '../../../lib/types';
import { SCHOOL } from '../../../lib/types';
import { TopHeader } from '../../../components/Chrome';
import { Pill } from '../../../components/ui';

function difficultyLabel(d: Difficulty): string {
  return d === 'easy' ? 'Easy' : d === 'moderate' ? 'Moderate' : 'Hard';
}

export default function OutputPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [assignment, setAssignment] = useState<AssignmentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getAssignment(id)
      .then((r) => setAssignment(r.assignment))
      .catch((e) => setError((e as Error).message));
  }, [id]);

  if (error) {
    return (
      <>
        <TopHeader title="Assignment" showBack onBack={() => router.push('/')} />
        <div className="p-10 text-center text-[var(--terracotta)] text-sm">{error}</div>
      </>
    );
  }
  if (!assignment) {
    return (
      <>
        <TopHeader title="Assignment" showBack onBack={() => router.push('/')} />
        <div className="p-10 text-center text-[var(--muted)] text-sm">Loading paper…</div>
      </>
    );
  }
  if (!assignment.paper) {
    return (
      <>
        <TopHeader title="Assignment" showBack onBack={() => router.push('/')} />
        <div className="p-10 text-center text-[var(--muted)] text-sm">
          This paper isn’t ready yet. Status: {assignment.status}.
        </div>
      </>
    );
  }

  const paper = assignment.paper;
  const intro = `Certainly! Here is your customized question paper for ${paper.subject} class ${paper.grade} on "${paper.title}".`;

  const regenerate = async () => {
    try {
      const r = await api.regenerate(assignment.id);
      router.push(`/generating/${r.jobId}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <TopHeader title="Create New" showBack onBack={() => router.push('/')} />

      <div className="px-4 lg:px-6 py-5 pb-32 lg:pb-10">
        {/* Dark intro banner */}
        <div className="no-print bg-[var(--ink)] text-white rounded-2xl px-5 lg:px-7 py-5 mb-5 flex flex-col lg:flex-row items-start lg:items-center gap-4">
          <p className="flex-1 text-sm lg:text-base leading-relaxed">{intro}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[var(--ink)] text-sm font-medium hover:bg-[var(--surface-2)] transition"
            >
              <FileDown size={15} /> Download as PDF
            </button>
            <button
              onClick={regenerate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition"
            >
              <RefreshCw size={15} /> Regenerate
            </button>
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition"
            >
              <ArrowLeft size={15} /> Back
            </button>
          </div>
        </div>

        {/* The paper */}
        <article
          id="exam-paper"
          className="bg-white rounded-2xl shadow-[var(--shadow-card)] px-5 lg:px-14 py-8 lg:py-12 max-w-4xl mx-auto"
        >
          <header className="text-center mb-6">
            <h1 className="font-display text-xl lg:text-2xl font-semibold mb-2">
              {SCHOOL.name}, {SCHOOL.sector}
            </h1>
            <div className="text-base lg:text-lg">Subject: {paper.subject}</div>
            <div className="text-base lg:text-lg">Class: {paper.grade}</div>
          </header>

          <div className="flex flex-col lg:flex-row justify-between text-sm lg:text-base mb-4 gap-1">
            <span>Time Allowed: {paper.timeAllowedMinutes} minutes</span>
            <span>Maximum Marks: {paper.totalMarks}</span>
          </div>

          <div className="text-sm lg:text-base mb-6">
            {paper.generalInstructions[0] ?? 'All questions are compulsory unless stated otherwise.'}
          </div>

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

          {paper.sections.map((sec, si) => (
            <section key={sec.id || si} className="mb-8" style={{ pageBreakInside: 'avoid' }}>
              <h2 className="font-display text-center text-xl lg:text-2xl font-semibold mb-2">
                Section {sec.id}
              </h2>
              <div className="text-base font-semibold">{sec.title}</div>
              <div className="italic text-sm text-[var(--muted)] mb-4">{sec.instruction}</div>
              <ol className="space-y-3 list-decimal pl-5">
                {sec.questions.map((q, qi) => (
                  <li
                    key={qi}
                    className="text-sm lg:text-base leading-relaxed"
                    style={{ pageBreakInside: 'avoid' }}
                  >
                    <div className="flex items-start gap-2 flex-wrap">
                      <Pill tone={q.difficulty}>{difficultyLabel(q.difficulty)}</Pill>
                      <span className="flex-1">{q.text}</span>
                      <span className="text-[var(--muted)] text-sm whitespace-nowrap">
                        [{q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}]
                      </span>
                    </div>
                    {q.options && q.options.length > 0 && (
                      <ol
                        className="mt-1.5 ml-1 space-y-0.5 text-sm"
                        style={{ listStyleType: 'lower-alpha', paddingLeft: '1.25rem' }}
                      >
                        {q.options.map((opt, oi) => <li key={oi}>{opt}</li>)}
                      </ol>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <div className="text-center mt-10 text-sm text-[var(--muted)] italic">— End of Paper —</div>
        </article>
      </div>
    </>
  );
}
