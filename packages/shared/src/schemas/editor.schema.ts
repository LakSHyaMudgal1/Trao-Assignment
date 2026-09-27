import { z } from 'zod';
import {
  RequirementKindEnum,
  RequirementPriorityEnum,
  QuestionCategoryEnum,
  ScheduleDaySchema,
} from './kit.schema.js';

export const EntityOriginEnum = z.enum(['generated', 'user', 'user_created']);
export const EntityLifecycleStateEnum = z.enum(['active', 'deleted', 'edited', 'pinned']);

export const EntityStateSchema = z.object({
  origin: EntityOriginEnum.default('generated'),
  state: EntityLifecycleStateEnum.default('active'),
  revision: z.number().int().default(1),
  is_edited: z.boolean().default(false),
  is_pinned: z.boolean().default(false),
  is_deleted: z.boolean().default(false),
});

export const InternalRequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: RequirementKindEnum,
  priority: RequirementPriorityEnum,
  origin: EntityOriginEnum.default('generated'),
  state: EntityLifecycleStateEnum.default('active'),
  revision: z.number().int().default(1),
  is_edited: z.boolean().default(false),
  is_pinned: z.boolean().default(false),
  is_deleted: z.boolean().default(false),
});

export const InternalQuestionSchema = z.object({
  id: z.string(),
  requirement_ids: z.array(z.string()),
  category: QuestionCategoryEnum,
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.number().int().min(1).max(3),
  origin: EntityOriginEnum.default('generated'),
  state: EntityLifecycleStateEnum.default('active'),
  revision: z.number().int().default(1),
  is_edited: z.boolean().default(false),
  is_pinned: z.boolean().default(false),
  is_deleted: z.boolean().default(false),
  order_index: z.number().int().default(0),
});

export const InternalFlashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string()),
  confidence_score: z.number().int().min(1).max(5).optional(),
  last_reviewed_at: z.string().optional(),
  review_count: z.number().int().default(0),
  origin: EntityOriginEnum.default('generated'),
  state: EntityLifecycleStateEnum.default('active'),
  revision: z.number().int().default(1),
  is_edited: z.boolean().default(false),
  is_pinned: z.boolean().default(false),
  is_deleted: z.boolean().default(false),
  is_covered: z.boolean().default(false),
});

export const InternalCompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
  state: EntityLifecycleStateEnum.default('active'),
  revision: z.number().int().default(1),
  is_edited: z.boolean().default(false),
  is_pinned: z.boolean().default(false),
});

export const TombstonesSchema = z.object({
  deleted_ids: z.array(z.string()).default([]),
  deleted_question_prompts: z.array(z.string()).default([]),
});

export const InternalKitSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().optional(),
  title: z.string(),
  source: z.object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int().nonnegative(),
    researched_at: z.string(),
    pages_used: z.array(z.string()),
  }),
  company_brief: InternalCompanyBriefSchema,
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(InternalRequirementSchema),
  }),
  questions: z.array(InternalQuestionSchema),
  flashcards: z.array(InternalFlashcardSchema),
  schedule: z.object({
    days_available: z.number().int().min(1),
    days: z.array(ScheduleDaySchema),
  }),
  coverage: z.object({
    uncovered_requirement_ids: z.array(z.string()),
    passes: z.number().int().min(1),
  }),
  crawl_status: z
    .object({
      company_site_reachable: z.boolean().default(true),
      hiring_page_found: z.boolean().default(false),
      discussion_found: z.boolean().default(false),
      warnings: z.array(z.string()).default([]),
    })
    .default({
      company_site_reachable: true,
      hiring_page_found: false,
      discussion_found: false,
      warnings: [],
    }),
  tombstones: TombstonesSchema.default({ deleted_ids: [], deleted_question_prompts: [] }),
});

export type EntityOrigin = z.infer<typeof EntityOriginEnum>;
export type EntityLifecycleState = z.infer<typeof EntityLifecycleStateEnum>;
export type EntityState = z.infer<typeof EntityStateSchema>;
export type InternalRequirement = z.infer<typeof InternalRequirementSchema>;
export type InternalQuestion = z.infer<typeof InternalQuestionSchema>;
export type InternalFlashcard = z.infer<typeof InternalFlashcardSchema>;
export type InternalCompanyBrief = z.infer<typeof InternalCompanyBriefSchema>;
export type Tombstones = z.infer<typeof TombstonesSchema>;
export type InternalKit = z.infer<typeof InternalKitSchema>;
