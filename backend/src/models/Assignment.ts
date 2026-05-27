import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Persistence model. We store *both* the inputs and the generated paper so
 * regeneration and audit work cleanly, plus `paperHistory` for previous
 * versions when a teacher hits Regenerate.
 */

const QuestionTypeRequestSchema = new Schema(
  {
    type:  { type: String, required: true, enum: ['mcq', 'short', 'long', 'truefalse', 'fill', 'numerical'] },
    count: { type: Number, required: true, min: 1 },
    marks: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const InputsSchema = new Schema(
  {
    title:                  { type: String, required: true },
    subject:                { type: String, required: true },
    grade:                  { type: String, required: true },
    dueDate:                { type: String, required: true }, // yyyy-mm-dd
    questionTypes:          { type: [QuestionTypeRequestSchema], default: [] },
    additionalInstructions: { type: String, default: '' },
    sourceText:             { type: String, default: '' },
    sourceFilename:         { type: String, default: '' },
  },
  { _id: false },
);

const QuestionSchema = new Schema(
  {
    number:     { type: Number, required: true },
    text:       { type: String, required: true },
    type:       { type: String, required: true },
    options:    { type: [String], default: undefined },
    difficulty: { type: String, required: true, enum: ['easy', 'moderate', 'hard'] },
    marks:      { type: Number, required: true },
  },
  { _id: false },
);

const SectionSchema = new Schema(
  {
    id:               { type: String, required: true },
    title:            { type: String, required: true },
    instruction:      { type: String, default: '' },
    type:             { type: String, required: true },
    marksPerQuestion: { type: Number, required: true },
    questions:        { type: [QuestionSchema], default: [] },
  },
  { _id: false },
);

const PaperSchema = new Schema(
  {
    title:               { type: String, required: true },
    subject:             { type: String, required: true },
    grade:               { type: String, required: true },
    dueDate:             { type: String, required: true },
    totalMarks:          { type: Number, required: true },
    timeAllowedMinutes:  { type: Number, required: true },
    generalInstructions: { type: [String], default: [] },
    sections:            { type: [SectionSchema], default: [] },
  },
  { _id: false },
);

const AssignmentSchema = new Schema(
  {
    jobId:         { type: String, required: true, unique: true, index: true },
    status:        { type: String, required: true, enum: ['queued', 'active', 'completed', 'failed'], default: 'queued' },
    inputs:        { type: InputsSchema, required: true },
    paper:         { type: PaperSchema, default: null },
    paperHistory:  { type: [PaperSchema], default: [] },
    error:         { type: String, default: '' },
    generationMs:  { type: Number, default: 0 },
  },
  { timestamps: true },
);

AssignmentSchema.index({ createdAt: -1 });

export type AssignmentDoc = InferSchemaType<typeof AssignmentSchema>;
export const Assignment = model('Assignment', AssignmentSchema);
