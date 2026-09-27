import { z } from 'zod';

export const RequirementKindEnum = z.enum(['technical', 'behavioural', 'domain']);
export const RequirementPriorityEnum = z.enum(['must', 'nice']);
export const QuestionCategoryEnum = z.enum([
  'technical',
  'behavioural',
  'system-design',
  'company-fit',
]);

// Requirement item (stable id, text, kind, priority)
export const RequirementItemSchema = z.object({
  id: z.string().min(1, 'Requirement ID is required'),
  text: z.string().min(1, 'Requirement text is required'),
  kind: RequirementKindEnum,
  priority: RequirementPriorityEnum,
});

// Question item (stable id, requirement_ids reference, category, prompt, answer_outline, difficulty 1-3)
export const QuestionItemSchema = z.object({
  id: z.string().min(1, 'Question ID is required'),
  requirement_ids: z.array(z.string()).min(1, 'Question must reference at least one requirement ID'),
  category: QuestionCategoryEnum,
  prompt: z.string().min(1, 'Question prompt is required'),
  answer_outline: z.string().min(1, 'Answer outline is required'),
  difficulty: z.number().int('Difficulty must be an integer').min(1, 'Minimum difficulty is 1').max(3, 'Maximum difficulty is 3'),
});

// Flashcard item (stable id, front, back, requirement_ids reference)
export const FlashcardItemSchema = z.object({
  id: z.string().min(1, 'Flashcard ID is required'),
  front: z.string().min(1, 'Front text is required'),
  back: z.string().min(1, 'Back text is required'),
  requirement_ids: z.array(z.string()).min(1, 'Flashcard must reference at least one requirement ID'),
});

// Schedule day (day number, focus title, question_ids reference, positive integer minutes)
export const ScheduleDaySchema = z.object({
  day: z.number().int('Day must be an integer').min(1, 'Day must be at least 1'),
  focus: z.string().min(1, 'Day focus is required'),
  question_ids: z.array(z.string()),
  minutes: z.number().int('Minutes must be an integer').positive('Minutes must be a positive integer'),
});

// Complete Appendix A Kit Structure
export const KitAppendixASchema = z
  .object({
    source: z.object({
      company: z.string(),
      company_url: z.string(),
      role: z.string(),
      location: z.string(),
      jd_chars: z.number().int().nonnegative('jd_chars must be a non-negative integer'),
      researched_at: z.string(),
      pages_used: z.array(z.string()),
    }),
    company_brief: z.object({
      summary: z.string(),
      what_they_do: z.string(),
      sources: z.array(z.string()),
    }),
    role: z.object({
      title: z.string(),
      seniority: z.string(),
      responsibilities: z.array(z.string()),
      requirements: z.array(RequirementItemSchema),
    }),
    questions: z.array(QuestionItemSchema),
    flashcards: z.array(FlashcardItemSchema),
    schedule: z.object({
      days_available: z.number().int().min(1, 'days_available must be at least 1'),
      days: z.array(ScheduleDaySchema),
    }),
    coverage: z.object({
      uncovered_requirement_ids: z.array(z.string()),
      passes: z.number().int().min(1, 'passes must be at least 1'),
    }),
  })
  .superRefine((data, ctx) => {
    // 1. Check for Duplicate Requirement IDs
    const reqIdsSeen = new Set<string>();
    data.role.requirements.forEach((req, idx) => {
      if (reqIdsSeen.has(req.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate requirement ID found: "${req.id}"`,
          path: ['role', 'requirements', idx, 'id'],
        });
      }
      reqIdsSeen.add(req.id);
    });

    // 2. Check for Duplicate Question IDs
    const questionIdsSeen = new Set<string>();
    data.questions.forEach((q, idx) => {
      if (questionIdsSeen.has(q.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate question ID found: "${q.id}"`,
          path: ['questions', idx, 'id'],
        });
      }
      questionIdsSeen.add(q.id);
    });

    // 3. Check for Duplicate Flashcard IDs
    const flashcardIdsSeen = new Set<string>();
    data.flashcards.forEach((f, idx) => {
      if (flashcardIdsSeen.has(f.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate flashcard ID found: "${f.id}"`,
          path: ['flashcards', idx, 'id'],
        });
      }
      flashcardIdsSeen.add(f.id);
    });

    // 4. Verify questions reference existing requirement IDs
    data.questions.forEach((question, qIndex) => {
      question.requirement_ids.forEach((reqId, rIndex) => {
        if (!reqIdsSeen.has(reqId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Question "${question.id}" references non-existent requirement id "${reqId}"`,
            path: ['questions', qIndex, 'requirement_ids', rIndex],
          });
        }
      });
    });

    // 5. Verify flashcards reference existing requirement IDs
    data.flashcards.forEach((flashcard, fIndex) => {
      flashcard.requirement_ids.forEach((reqId, rIndex) => {
        if (!reqIdsSeen.has(reqId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Flashcard "${flashcard.id}" references non-existent requirement id "${reqId}"`,
            path: ['flashcards', fIndex, 'requirement_ids', rIndex],
          });
        }
      });
    });

    // 6. Verify every question_ids entry in schedule refers to an existing question
    data.schedule.days.forEach((day, dayIndex) => {
      day.question_ids.forEach((qId, qIndex) => {
        if (!questionIdsSeen.has(qId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Schedule day ${day.day} references non-existent question id "${qId}"`,
            path: ['schedule', 'days', dayIndex, 'question_ids', qIndex],
          });
        }
      });
    });

    // 7. Verify schedule days count matches days_available
    if (data.schedule.days.length !== data.schedule.days_available) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Schedule contains ${data.schedule.days.length} days but days_available is ${data.schedule.days_available}`,
        path: ['schedule', 'days'],
      });
    }

    // 8. Verify coverage uncovered_requirement_ids reference real requirements
    data.coverage.uncovered_requirement_ids.forEach((reqId, idx) => {
      if (!reqIdsSeen.has(reqId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Coverage references non-existent uncovered requirement id "${reqId}"`,
          path: ['coverage', 'uncovered_requirement_ids', idx],
        });
      }
    });
  });

export type RequirementKind = z.infer<typeof RequirementKindEnum>;
export type RequirementPriority = z.infer<typeof RequirementPriorityEnum>;
export type QuestionCategory = z.infer<typeof QuestionCategoryEnum>;
export type RequirementItem = z.infer<typeof RequirementItemSchema>;
export type QuestionItem = z.infer<typeof QuestionItemSchema>;
export type FlashcardItem = z.infer<typeof FlashcardItemSchema>;
export type ScheduleDay = z.infer<typeof ScheduleDaySchema>;
export type KitAppendixA = z.infer<typeof KitAppendixASchema>;
