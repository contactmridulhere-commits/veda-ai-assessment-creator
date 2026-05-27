'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { QUESTION_TYPES, type CreateAssignmentInput, type QuestionTypeRequest } from '../lib/types';

const uid = () => Math.random().toString(36).slice(2, 10);

const todayPlus = (days = 7): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

type FormErrors = Partial<Record<keyof CreateAssignmentInput | `qt-${number}-${'count' | 'marks'}` | 'file', string>>;

interface AssessmentState {
  // Form fields
  title: string;
  subject: string;
  grade: string;
  dueDate: string;
  questionTypes: (QuestionTypeRequest & { id: string })[];
  additionalInstructions: string;
  sourceText: string;
  sourceFilename: string;

  // Multi-step state
  step: 1 | 2;
  errors: FormErrors;

  // Active job tracking
  jobId: string | null;
  assignmentId: string | null;

  // Actions
  setField: <K extends keyof AssessmentState>(key: K, value: AssessmentState[K]) => void;
  updateQuestionType: (index: number, patch: Partial<QuestionTypeRequest>) => void;
  addQuestionType: () => void;
  removeQuestionType: (index: number) => void;
  setStep: (step: 1 | 2) => void;
  setErrors: (e: FormErrors) => void;
  reset: () => void;

  // Derived getters
  getTotals: () => { questions: number; marks: number };
  validateStep1: () => boolean;
  validateStep2: () => boolean;
  toPayload: () => CreateAssignmentInput;
  setJob: (jobId: string, assignmentId: string) => void;
}

const initial = (): Omit<AssessmentState, 'setField' | 'updateQuestionType' | 'addQuestionType' | 'removeQuestionType' | 'setStep' | 'setErrors' | 'reset' | 'getTotals' | 'validateStep1' | 'validateStep2' | 'toPayload' | 'setJob'> => ({
  title: '',
  subject: '',
  grade: '',
  dueDate: todayPlus(7),
  questionTypes: [
    { id: uid(), type: 'mcq',   count: QUESTION_TYPES.mcq.defaultCount,   marks: QUESTION_TYPES.mcq.defaultMarks },
    { id: uid(), type: 'short', count: QUESTION_TYPES.short.defaultCount, marks: QUESTION_TYPES.short.defaultMarks },
  ],
  additionalInstructions: '',
  sourceText: '',
  sourceFilename: '',
  step: 1,
  errors: {},
  jobId: null,
  assignmentId: null,
});

export const useAssessmentStore = create<AssessmentState>()(
  devtools(
    (set, get) => ({
      ...initial(),

      setField: (key, value) => set({ [key]: value } as Partial<AssessmentState>),

      updateQuestionType: (index, patch) =>
        set((s) => ({
          questionTypes: s.questionTypes.map((q, i) => (i === index ? { ...q, ...patch } : q)),
        })),

      addQuestionType: () =>
        set((s) => {
          const used = new Set(s.questionTypes.map((q) => q.type));
          const next = (Object.keys(QUESTION_TYPES) as (keyof typeof QUESTION_TYPES)[])
            .find((k) => !used.has(k)) ?? 'mcq';
          return {
            questionTypes: [
              ...s.questionTypes,
              { id: uid(), type: next, count: QUESTION_TYPES[next].defaultCount, marks: QUESTION_TYPES[next].defaultMarks },
            ],
          };
        }),

      removeQuestionType: (index) =>
        set((s) => ({
          questionTypes: s.questionTypes.filter((_, i) => i !== index),
        })),

      setStep: (step) => set({ step }),

      setErrors: (errors) => set({ errors }),

      reset: () => set(initial()),

      getTotals: () => {
        const qt = get().questionTypes;
        return {
          questions: qt.reduce((s, t) => s + t.count, 0),
          marks: qt.reduce((s, t) => s + t.count * t.marks, 0),
        };
      },

      validateStep1: () => {
        const s = get();
        const errors: FormErrors = {};
        if (!s.title.trim())   errors.title   = 'Required';
        if (!s.subject.trim()) errors.subject = 'Required';
        if (!s.grade.trim())   errors.grade   = 'Required';
        set({ errors });
        return Object.keys(errors).length === 0;
      },

      validateStep2: () => {
        const s = get();
        const errors: FormErrors = {};
        if (!s.dueDate) errors.dueDate = 'Required';
        if (s.dueDate && new Date(s.dueDate) < new Date(new Date().toDateString())) {
          errors.dueDate = 'Cannot be in the past';
        }
        if (s.questionTypes.length === 0) {
          errors.questionTypes = 'Add at least one question type' as any;
        }
        s.questionTypes.forEach((q, i) => {
          if (q.count <= 0) errors[`qt-${i}-count`] = '> 0';
          if (q.marks <= 0) errors[`qt-${i}-marks`] = '> 0';
        });
        set({ errors });
        return Object.keys(errors).length === 0;
      },

      toPayload: () => {
        const s = get();
        return {
          title: s.title.trim(),
          subject: s.subject.trim(),
          grade: s.grade.trim(),
          dueDate: s.dueDate,
          questionTypes: s.questionTypes.map(({ id: _id, ...rest }) => rest),
          additionalInstructions: s.additionalInstructions.trim() || undefined,
          sourceText: s.sourceText || undefined,
          sourceFilename: s.sourceFilename || undefined,
        };
      },

      setJob: (jobId, assignmentId) => set({ jobId, assignmentId }),
    }),
    { name: 'assessment-store' },
  ),
);
