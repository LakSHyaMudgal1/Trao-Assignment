import { z } from 'zod';
import { QuestionCategoryEnum } from './kit.schema.js';

// Create kit request
export const CreateKitRequestSchema = z.object({
  company_url: z.string().url('A valid company website URL is required'),
  jd: z.string().min(10, 'Job description must be at least 10 characters long'),
  days: z.number().int().min(1, 'Days available must be at least 1').max(60, 'Days cannot exceed 60'),
});

// Update company brief
export const UpdateBriefRequestSchema = z.object({
  summary: z.string().min(1, 'Summary is required'),
  what_they_do: z.string().min(1, 'What they do is required'),
});

// Add user-created question
export const AddQuestionRequestSchema = z.object({
  requirement_ids: z.array(z.string()).min(1, 'At least one requirement ID is required'),
  category: QuestionCategoryEnum,
  prompt: z.string().min(1, 'Question prompt is required'),
  answer_outline: z.string().min(1, 'Answer outline is required'),
  difficulty: z.number().int().min(1).max(3),
});

// Update question (inline edit / pin toggle)
export const UpdateQuestionRequestSchema = z.object({
  prompt: z.string().min(1).optional(),
  answer_outline: z.string().min(1).optional(),
  category: QuestionCategoryEnum.optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
  requirement_ids: z.array(z.string()).optional(),
  is_pinned: z.boolean().optional(),
});

// Reorder questions
export const ReorderQuestionsRequestSchema = z.object({
  ordered_ids: z.array(z.string()).min(1, 'Ordered question IDs must not be empty'),
});

// Regenerate section request
export const RegenerateSectionRequestSchema = z.object({
  target: z.enum(['company_brief', 'category', 'schedule']),
  category: QuestionCategoryEnum.optional(),
});

// Record flashcard review
export const RecordFlashcardReviewSchema = z.object({
  confidence: z.number().int().min(1).max(5),
  is_covered: z.boolean().optional().default(true),
});

// Add user-created flashcard
export const AddFlashcardRequestSchema = z.object({
  front: z.string().min(1, 'Front text is required'),
  back: z.string().min(1, 'Back text is required'),
  requirement_ids: z.array(z.string()).default([]),
});

// Update flashcard
export const UpdateFlashcardRequestSchema = z.object({
  front: z.string().min(1).optional(),
  back: z.string().min(1).optional(),
  requirement_ids: z.array(z.string()).optional(),
  is_pinned: z.boolean().optional(),
});

// Update full kit
export const UpdateKitRequestSchema = z.object({
  title: z.string().optional(),
  company_brief: z
    .object({
      summary: z.string().optional(),
      what_they_do: z.string().optional(),
      sources: z.array(z.string()).optional(),
    })
    .optional(),
  role: z
    .object({
      title: z.string().optional(),
      seniority: z.string().optional(),
      responsibilities: z.array(z.string()).optional(),
      requirements: z.array(z.any()).optional(),
    })
    .optional(),
  questions: z.array(z.any()).optional(),
  flashcards: z.array(z.any()).optional(),
  schedule: z
    .object({
      days_available: z.number().int().min(1).optional(),
      days: z.array(z.any()).optional(),
    })
    .optional(),
  coverage: z
    .object({
      uncovered_requirement_ids: z.array(z.string()).optional(),
      passes: z.number().int().optional(),
    })
    .optional(),
});

export type CreateKitRequest = z.infer<typeof CreateKitRequestSchema>;
export type UpdateBriefRequest = z.infer<typeof UpdateBriefRequestSchema>;
export type AddQuestionRequest = z.infer<typeof AddQuestionRequestSchema>;
export type UpdateQuestionRequest = z.infer<typeof UpdateQuestionRequestSchema>;
export type ReorderQuestionsRequest = z.infer<typeof ReorderQuestionsRequestSchema>;
export type RegenerateSectionRequest = z.infer<typeof RegenerateSectionRequestSchema>;
export type RecordFlashcardReview = z.infer<typeof RecordFlashcardReviewSchema>;
export type AddFlashcardRequest = z.infer<typeof AddFlashcardRequestSchema>;
export type UpdateFlashcardRequest = z.infer<typeof UpdateFlashcardRequestSchema>;
export type UpdateKitRequest = z.infer<typeof UpdateKitRequestSchema>;
