// Mirrors backend/src/types/domain.ts

export type Difficulty = 'easy' | 'moderate' | 'hard';

export type QuestionType =
  | 'mcq' | 'short' | 'long' | 'truefalse' | 'fill' | 'numerical';

export interface QuestionTypeRequest {
  type: QuestionType;
  count: number;
  marks: number;
}

export interface CreateAssignmentInput {
  title: string;
  subject: string;
  grade: string;
  dueDate: string;
  questionTypes: QuestionTypeRequest[];
  additionalInstructions?: string;
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
  id: string;
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
  stage?: string;
  stageLabel?: string;
  progress?: number;
  paper?: QuestionPaper;
  error?: string;
  ts: string;
}

export interface AssignmentRecord {
  id: string;
  jobId: string;
  status: JobStatusValue;
  inputs: CreateAssignmentInput;
  paper?: QuestionPaper | null;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export const QUESTION_TYPES: Record<
  QuestionType,
  { label: string; short: string; defaultCount: number; defaultMarks: number }
> = {
  mcq:       { label: 'Multiple Choice Questions', short: 'MCQ',       defaultCount: 5, defaultMarks: 1 },
  short:     { label: 'Short Answer Questions',     short: 'Short',     defaultCount: 4, defaultMarks: 2 },
  long:      { label: 'Long Answer Questions',      short: 'Long',      defaultCount: 2, defaultMarks: 5 },
  truefalse: { label: 'True / False',                short: 'T/F',       defaultCount: 5, defaultMarks: 1 },
  fill:      { label: 'Fill in the Blanks',          short: 'Fill',      defaultCount: 5, defaultMarks: 1 },
  numerical: { label: 'Numerical Problems',          short: 'Numerical', defaultCount: 3, defaultMarks: 3 },
};

export const STAGES = [
  { key: 'connect',  label: 'Connecting to the model'      },
  { key: 'analyse',  label: 'Analysing your inputs'        },
  { key: 'research', label: 'Gathering subject context'    },
  { key: 'draft',    label: 'Drafting questions'           },
  { key: 'balance',  label: 'Balancing difficulty'         },
  { key: 'organise', label: 'Organising sections'          },
  { key: 'finalise', label: 'Finalising the paper'         },
] as const;

export const SCHOOL = {
  name: 'Delhi Public School',
  sector: 'Sector-4, Bokaro',
  location: 'Bokaro Steel City',
};
