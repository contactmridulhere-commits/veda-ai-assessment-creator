// Shared domain types — kept in sync with frontend/src/lib/types.ts

export type Difficulty = 'easy' | 'moderate' | 'hard';
export type QuestionType = 'mcq' | 'short' | 'long' | 'truefalse' | 'fill' | 'numerical';

export interface QuestionTypeRequest {
  type: QuestionType;
  count: number;
  marks: number;
}

export interface CreateAssignmentInput {
  title: string;
  subject: string;
  grade: string;
  dueDate: string; // ISO yyyy-mm-dd
  questionTypes: QuestionTypeRequest[];
  additionalInstructions?: string;
  /** Pre-extracted text from uploaded PDF/TXT, if any */
  sourceText?: string;
  sourceFilename?: string;
}

export interface Question {
  number: number;
  text: string;
  type: QuestionType;
  options?: string[] | null;
  difficulty: Difficulty;
  marks: number;
}

export interface Section {
  id: string; // "A", "B", ...
  title: string;
  instruction: string;
  type: QuestionType;
  marksPerQuestion: number;
  questions: Question[];
}

export interface QuestionPaper {
  title: string;
  subject: string;
  grade: string;
  dueDate: string;
  totalMarks: number;
  timeAllowedMinutes: number;
  generalInstructions: string[];
  sections: Section[];
}

export type JobStatusValue = 'queued' | 'active' | 'completed' | 'failed';

export interface JobUpdate {
  jobId: string;
  assignmentId: string;
  status: JobStatusValue;
  stage?: string;       // 'connect' | 'analyse' | 'research' | 'draft' | 'balance' | 'organise' | 'finalise'
  stageLabel?: string;
  progress?: number;    // 0..1
  paper?: QuestionPaper;
  error?: string;
  ts: string;
}

export const STAGES = [
  { key: 'connect',  label: 'Connecting to the model'   },
  { key: 'analyse',  label: 'Analysing your inputs'     },
  { key: 'research', label: 'Gathering subject context' },
  { key: 'draft',    label: 'Drafting questions'        },
  { key: 'balance',  label: 'Balancing difficulty'      },
  { key: 'organise', label: 'Organising sections'       },
  { key: 'finalise', label: 'Finalising the paper'      },
] as const;
