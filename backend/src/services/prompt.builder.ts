import type { CreateAssignmentInput, QuestionType } from '../types/domain.js';

const QT_LABEL: Record<QuestionType, string> = {
  mcq:       'Multiple Choice Questions',
  short:     'Short Answer Questions',
  long:      'Long Answer Questions',
  truefalse: 'True / False Questions',
  fill:      'Fill in the Blanks',
  numerical: 'Numerical Problems',
};

/**
 * Builds a strict, deterministic JSON-only prompt. We're explicit about the
 * shape because GPT-OSS-20B sometimes drifts toward conversational replies
 * when given vague schemas — the parser is the safety net, but tight specs
 * mean fewer retries and lower latency.
 */
export function buildPrompt(input: CreateAssignmentInput): string {
  const totalQs = input.questionTypes.reduce((s, t) => s + t.count, 0);
  const totalMarks = input.questionTypes.reduce((s, t) => s + t.count * t.marks, 0);

  const sectionPlan = input.questionTypes
    .map(
      (t, i) =>
        `  Section ${String.fromCharCode(65 + i)} — ${QT_LABEL[t.type]}: ${t.count} questions × ${t.marks} mark${t.marks === 1 ? '' : 's'} (= ${t.count * t.marks} marks)`,
    )
    .join('\n');

  const sourceBlock = input.sourceText
    ? `\nReference source material (anchor questions to this content where possible):\n"""\n${input.sourceText.slice(0, 3500)}\n"""`
    : '';

  const extraBlock = input.additionalInstructions?.trim()
    ? `\nTeacher's additional instructions: ${input.additionalInstructions.trim()}`
    : '';

  return `Generate ONE complete question paper as STRICT JSON ONLY — no prose, no markdown code fences.

Paper specification
- Title: "${input.title}"
- Subject: ${input.subject}
- Class / Grade: ${input.grade}
- Due date: ${input.dueDate}
- Total questions: ${totalQs}
- Total marks: ${totalMarks}

Structure (one section per question type, in this exact order):
${sectionPlan}

Rules:
1. Difficulty mix per section: roughly 40% easy, 40% moderate, 20% hard. Each question MUST be tagged "easy", "moderate", or "hard".
2. Every MCQ MUST have exactly 4 plausible options as ["(a) …", "(b) …", "(c) …", "(d) …"].
3. True/False statements must be single declarative sentences.
4. Fill-in-the-blank questions must contain a "___" placeholder.
5. Numerical problems must include realistic numbers with units.
6. Questions must be self-contained, original (not copy-pasted boilerplate), and grade-appropriate.
7. Use clear, exam-style language. No emojis. No commentary outside the JSON.
${sourceBlock}${extraBlock}

Return EXACTLY this JSON shape (no extra keys, no missing keys):
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
      "id": "A" | "B" | "C" | "...",
      "title": string,
      "instruction": string,
      "type": "mcq" | "short" | "long" | "truefalse" | "fill" | "numerical",
      "marksPerQuestion": number,
      "questions": [
        {
          "number": number,
          "text": string,
          "difficulty": "easy" | "moderate" | "hard",
          "marks": number,
          "options": string[] | null,
          "type": "mcq" | "short" | "long" | "truefalse" | "fill" | "numerical"
        }
      ]
    }
  ]
}`;
}
