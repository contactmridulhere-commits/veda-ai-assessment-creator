'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Sparkles, Calendar, Upload, X,
  Plus, ChevronDown,
} from 'lucide-react';
import { useAssessmentStore } from '../../store/useAssessmentStore';
import { QUESTION_TYPES } from '../../lib/types';
import { TopHeader } from '../../components/Chrome';
import {
  PrimaryButton, GhostButton, Field, ErrorText, Counter, cls,
} from '../../components/ui';
import { api } from '../../lib/api';
import { useState } from 'react';

export default function CreatePage() {
  const router = useRouter();
  const s = useAssessmentStore();
  const totals = s.getTotals();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      s.setErrors({ ...s.errors, file: 'File too large (max 10MB)' });
      return;
    }
    const ok = file.type === 'application/pdf' || file.type === 'text/plain'
      || /\.txt$|\.pdf$/i.test(file.name);
    if (!ok) {
      s.setErrors({ ...s.errors, file: 'Only PDF and TXT supported' });
      return;
    }
    // Try backend extraction; fall back to local text reading.
    try {
      const r = await api.uploadFile(file);
      s.setField('sourceText', r.text);
      s.setField('sourceFilename', r.filename);
    } catch {
      if (file.type === 'text/plain') {
        s.setField('sourceText', await file.text());
      }
      s.setField('sourceFilename', file.name);
    }
    const next = { ...s.errors }; delete next.file; s.setErrors(next);
  };

  const next = () => { if (s.validateStep1()) s.setStep(2); };
  const back = () => s.setStep(1);

  const submit = async () => {
    if (!s.validateStep2()) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const payload = s.toPayload();
      const r = await api.createAssignment(payload);
      s.setJob(r.jobId, r.assignmentId);
      router.push(`/generating/${r.jobId}`);
    } catch (e) {
      setServerError((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <TopHeader title="Assignment" showBack onBack={() => router.push('/')} />

      <div className="px-4 lg:px-6 py-5 pb-32 lg:pb-10">
        <div className="bg-white rounded-2xl shadow-[var(--shadow-soft)] px-5 py-4 mb-5">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs text-[var(--muted)] uppercase tracking-wide">
              Step {s.step} of 2
            </span>
            <span className="text-sm font-medium">
              {s.step === 1 ? 'Assignment Details' : 'Question Configuration'}
            </span>
          </div>
          <div className="flex gap-2">
            <div className={cls('h-1.5 flex-1 rounded-full', s.step >= 1 ? 'bg-[var(--ink)]' : 'bg-[var(--line)]')} />
            <div className={cls('h-1.5 flex-1 rounded-full', s.step >= 2 ? 'bg-[var(--ink)]' : 'bg-[var(--line)]')} />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-[var(--shadow-soft)] p-5 lg:p-8">
          {s.step === 1 ? (
            <>
              <h2 className="font-display text-2xl font-semibold mb-1">Assignment Details</h2>
              <p className="text-sm text-[var(--muted)] mb-6">Basic information about your assignment.</p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Field label="Assignment Title" error={s.errors.title}>
                  <input
                    type="text" value={s.title}
                    onChange={(e) => s.setField('title', e.target.value)}
                    placeholder="e.g. Quiz on Electricity"
                    className="input"
                  />
                </Field>
                <Field label="Subject" error={s.errors.subject}>
                  <input
                    type="text" value={s.subject}
                    onChange={(e) => s.setField('subject', e.target.value)}
                    placeholder="e.g. Science"
                    className="input"
                  />
                </Field>
                <Field label="Class / Grade" error={s.errors.grade}>
                  <input
                    type="text" value={s.grade}
                    onChange={(e) => s.setField('grade', e.target.value)}
                    placeholder="e.g. 8th"
                    className="input"
                  />
                </Field>
                <Field label="Due Date" error={s.errors.dueDate}>
                  <div className="relative">
                    <input
                      type="date" value={s.dueDate}
                      onChange={(e) => s.setField('dueDate', e.target.value)}
                      className="input pr-10"
                    />
                    <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                  </div>
                </Field>
              </div>

              <div className="mt-5">
                <label className="block text-sm font-medium mb-2">
                  Source Material <span className="text-[var(--muted)] font-normal">(optional)</span>
                </label>
                <label className="block rounded-2xl border-2 border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] px-6 py-8 text-center cursor-pointer hover:bg-[var(--ivory)] transition">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white border border-[var(--line)] flex items-center justify-center">
                    <Upload size={20} className="text-[var(--ink)]" />
                  </div>
                  <div className="font-medium mb-1">
                    {s.sourceFilename || 'Choose a file or drag & drop it here'}
                  </div>
                  <div className="text-xs text-[var(--muted)] mb-3">PDF or TXT, up to 10MB</div>
                  <span className="inline-flex items-center px-4 py-2 rounded-full bg-white border border-[var(--line)] text-sm font-medium">
                    Browse Files
                  </span>
                  <input
                    type="file" accept=".pdf,.txt,application/pdf,text/plain"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                </label>
                {s.errors.file && <ErrorText>{s.errors.file}</ErrorText>}
                <p className="text-xs text-[var(--muted)] text-center mt-2">
                  Upload images of your preferred document/image
                </p>
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-semibold mb-1">Question Configuration</h2>
              <p className="text-sm text-[var(--muted)] mb-6">
                Choose question types, counts, and marks. Each type becomes its own section.
              </p>

              <div className="space-y-3">
                <div className="hidden lg:grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center pb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                  <span className="underline underline-offset-4">Question Type</span>
                  <span />
                  <span className="text-center w-32">No. of Questions</span>
                  <span className="text-center w-32">Marks</span>
                  <span />
                </div>

                {s.questionTypes.map((q, i) => (
                  <div key={q.id} className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-center bg-[var(--surface-2)] lg:bg-transparent rounded-2xl p-3 lg:p-0">
                    <div className="relative">
                      <select
                        value={q.type}
                        onChange={(e) => {
                          const t = e.target.value as keyof typeof QUESTION_TYPES;
                          s.updateQuestionType(i, {
                            type: t,
                            count: QUESTION_TYPES[t].defaultCount,
                            marks: QUESTION_TYPES[t].defaultMarks,
                          });
                        }}
                        className="input pr-10"
                      >
                        {(Object.keys(QUESTION_TYPES) as (keyof typeof QUESTION_TYPES)[]).map((k) => (
                          <option key={k} value={k}>{QUESTION_TYPES[k].label}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
                    </div>
                    <span className="hidden lg:block text-[var(--muted)] px-2">×</span>
                    <Counter value={q.count} onChange={(v) => s.updateQuestionType(i, { count: v })} />
                    <Counter value={q.marks} onChange={(v) => s.updateQuestionType(i, { marks: v })} />
                    <button
                      type="button"
                      onClick={() => s.removeQuestionType(i)}
                      disabled={s.questionTypes.length === 1}
                      className="w-9 h-9 rounded-full bg-white border border-[var(--line)] hover:bg-[var(--surface-2)] flex items-center justify-center disabled:opacity-30"
                      aria-label="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={s.addQuestionType}
                  className="flex items-center gap-2 mt-3 text-sm font-medium hover:text-[var(--terracotta)] transition"
                >
                  <span className="w-9 h-9 rounded-full bg-[var(--ink)] text-white flex items-center justify-center">
                    <Plus size={14} />
                  </span>
                  Add Question Type
                </button>
              </div>

              <div className="flex flex-col items-end mt-6 text-sm">
                <div><b>Total Questions :</b> {totals.questions}</div>
                <div><b>Total Marks :</b> {totals.marks}</div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium mb-2">
                  Additional Information <span className="text-[var(--muted)] font-normal">(for better output)</span>
                </label>
                <textarea
                  value={s.additionalInstructions}
                  onChange={(e) => s.setField('additionalInstructions', e.target.value)}
                  placeholder="e.g. Generate a question paper for 3 hour exam duration. Focus on Chapter 12 — Electricity. Include numerical problems based on Ohm's Law."
                  rows={4}
                  className="input"
                />
              </div>
            </>
          )}
        </div>

        {serverError && (
          <div className="mt-4 bg-[var(--hard-bg)] text-[var(--hard-fg)] rounded-xl px-4 py-3 text-sm">
            {serverError}
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <GhostButton
            icon={ArrowLeft}
            onClick={s.step === 1 ? () => router.push('/') : back}
          >
            {s.step === 1 ? 'Cancel' : 'Previous'}
          </GhostButton>

          {s.step === 1 ? (
            <PrimaryButton onClick={next}>
              Next <ArrowRight size={14} />
            </PrimaryButton>
          ) : (
            <PrimaryButton icon={Sparkles} onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Generate Paper'}
            </PrimaryButton>
          )}
        </div>
      </div>
    </>
  );
}
