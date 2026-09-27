import type { KitAppendixA } from '../schemas/kit.schema.js';
import type { InternalKit, InternalQuestion } from '../schemas/editor.schema.js';
import { assertValidKitStructure } from '../validation/kit-validator.js';
import { generateQuestionId } from '../utils/id-generator.js';

export type RegenerationTarget = 'company_brief' | 'category' | 'schedule';

export interface SectionRegenerationOptions {
  target: RegenerationTarget;
  category?: 'technical' | 'behavioural' | 'system-design' | 'company-fit';
  newBrief?: {
    summary: string;
    what_they_do: string;
    sources?: string[];
  };
  newQuestions?: Array<{
    prompt: string;
    answer_outline: string;
    difficulty: number;
    requirement_ids: string[];
  }>;
  newScheduleDays?: Array<{
    day: number;
    focus: string;
    question_ids: string[];
    minutes: number;
  }>;
  forceOverwritePinned?: boolean;
}

/**
 * Serializes an internal kit document to the exact Appendix A structure.
 * Strips all internal editor metadata and filters out soft-deleted items.
 */
export function serializeToAppendixA(internal: InternalKit): KitAppendixA {
  const activeReqs = internal.role.requirements.filter((r) => !r.is_deleted);
  const activeQuestions = internal.questions
    .filter((q) => !q.is_deleted)
    .sort((a, b) => a.order_index - b.order_index);
  const activeFlashcards = internal.flashcards.filter((f) => !f.is_deleted);

  const raw: KitAppendixA = {
    source: {
      company: internal.source.company,
      company_url: internal.source.company_url,
      role: internal.source.role,
      location: internal.source.location,
      jd_chars: internal.source.jd_chars,
      researched_at: internal.source.researched_at,
      pages_used: internal.source.pages_used,
    },
    company_brief: {
      summary: internal.company_brief.summary,
      what_they_do: internal.company_brief.what_they_do,
      sources: internal.company_brief.sources,
    },
    role: {
      title: internal.role.title,
      seniority: internal.role.seniority,
      responsibilities: internal.role.responsibilities,
      requirements: activeReqs.map((r) => ({
        id: r.id,
        text: r.text,
        kind: r.kind,
        priority: r.priority,
      })),
    },
    questions: activeQuestions.map((q) => ({
      id: q.id,
      requirement_ids: q.requirement_ids,
      category: q.category,
      prompt: q.prompt,
      answer_outline: q.answer_outline,
      difficulty: q.difficulty as 1 | 2 | 3,
    })),
    flashcards: activeFlashcards.map((f) => ({
      id: f.id,
      front: f.front,
      back: f.back,
      requirement_ids: f.requirement_ids,
    })),
    schedule: {
      days_available: internal.schedule.days_available,
      days: internal.schedule.days.map((d) => ({
        day: d.day,
        focus: d.focus,
        question_ids: d.question_ids,
        minutes: d.minutes,
      })),
    },
    coverage: {
      uncovered_requirement_ids: internal.coverage.uncovered_requirement_ids,
      passes: internal.coverage.passes,
    },
  };

  return assertValidKitStructure(raw);
}

/**
 * Deserializes an external Appendix A JSON payload into an InternalKit with full editor metadata.
 */
export function deserializeFromAppendixA(
  appendixA: unknown,
  options?: { userId?: string; title?: string }
): InternalKit {
  const validKit = assertValidKitStructure(appendixA);

  return {
    user_id: options?.userId,
    title: options?.title || `${validKit.role.title} at ${validKit.source.company}`,
    source: validKit.source,
    company_brief: {
      ...validKit.company_brief,
      state: 'active',
      revision: 1,
      is_edited: false,
      is_pinned: false,
    },
    role: {
      ...validKit.role,
      requirements: validKit.role.requirements.map((r) => ({
        ...r,
        origin: 'generated',
        state: 'active',
        revision: 1,
        is_edited: false,
        is_pinned: false,
        is_deleted: false,
      })),
    },
    questions: validKit.questions.map((q, idx) => ({
      ...q,
      origin: 'generated',
      state: 'active',
      revision: 1,
      is_edited: false,
      is_pinned: false,
      is_deleted: false,
      order_index: idx,
    })),
    flashcards: validKit.flashcards.map((f) => ({
      ...f,
      origin: 'generated',
      state: 'active',
      revision: 1,
      is_edited: false,
      is_pinned: false,
      is_deleted: false,
      is_covered: false,
      review_count: 0,
    })),
    schedule: validKit.schedule,
    coverage: validKit.coverage,
    crawl_status: {
      company_site_reachable: true,
      hiring_page_found: false,
      discussion_found: false,
      warnings: [],
    },
    tombstones: {
      deleted_ids: [],
      deleted_question_prompts: [],
    },
  };
}

/**
 * Surgical Section Regeneration Strategy:
 * 1. Manually edited content survives regeneration.
 * 2. Manually created questions survive category regeneration.
 * 3. Pinned content is protected.
 * 4. Deleted items (in tombstones) remain respected and are never resurrected.
 * 5. Other sections remain completely unmodified.
 */
export function applySectionRegeneration(
  currentKit: InternalKit,
  options: SectionRegenerationOptions
): InternalKit {
  // Deep clone to ensure immutability
  const updatedKit: InternalKit = JSON.parse(JSON.stringify(currentKit));

  if (options.target === 'company_brief') {
    if (!options.newBrief) {
      throw new Error('newBrief payload is required for company_brief regeneration');
    }

    // Preserve pinned or edited brief unless forced
    if (updatedKit.company_brief.is_pinned && !options.forceOverwritePinned) {
      return updatedKit;
    }

    updatedKit.company_brief.summary = options.newBrief.summary;
    updatedKit.company_brief.what_they_do = options.newBrief.what_they_do;
    if (options.newBrief.sources) {
      updatedKit.company_brief.sources = options.newBrief.sources;
    }
    updatedKit.company_brief.is_edited = false;

    return updatedKit;
  }

  if (options.target === 'category') {
    if (!options.category) {
      throw new Error('category is required for category regeneration');
    }
    const targetCat = options.category;
    const newQuestionsInput = options.newQuestions || [];

    // 1. Separate questions from other categories (UNTOUCHED)
    const otherCategoryQuestions = updatedKit.questions.filter((q) => q.category !== targetCat);

    // 2. Identify surviving questions in target category:
    // User-created, manually edited, or pinned questions MUST survive!
    const survivingQuestions = updatedKit.questions.filter(
      (q) =>
        q.category === targetCat &&
        !q.is_deleted &&
        (q.origin === 'user_created' || q.is_edited || q.is_pinned)
    );

    // 3. Collect prompts and IDs to prevent resurrecting deleted or duplicate questions
    const survivingPrompts = new Set(survivingQuestions.map((q) => q.prompt.toLowerCase().trim()));
    const tombstonePrompts = new Set(
      updatedKit.tombstones.deleted_question_prompts.map((p) => p.toLowerCase().trim())
    );

    const allExistingIds = updatedKit.questions.map((q) => q.id);

    // 4. Filter and assign fresh stable IDs to candidate new questions
    const generatedQuestions: InternalQuestion[] = [];
    for (const newQ of newQuestionsInput) {
      const normalizedPrompt = newQ.prompt.toLowerCase().trim();

      // Check against surviving questions and deleted tombstones
      if (survivingPrompts.has(normalizedPrompt) || tombstonePrompts.has(normalizedPrompt)) {
        continue; // Respect deleted or existing items
      }

      const freshId = generateQuestionId([...allExistingIds, ...generatedQuestions.map((g) => g.id)]);

      generatedQuestions.push({
        id: freshId,
        requirement_ids: newQ.requirement_ids,
        category: targetCat,
        prompt: newQ.prompt,
        answer_outline: newQ.answer_outline,
        difficulty: newQ.difficulty,
        origin: 'generated',
        state: 'active',
        revision: 1,
        is_edited: false,
        is_pinned: false,
        is_deleted: false,
        order_index: survivingQuestions.length + generatedQuestions.length,
      });
    }

    // 5. Merge surviving and newly generated questions
    const finalTargetQuestions = [...survivingQuestions, ...generatedQuestions];

    // Combine with untouched categories
    updatedKit.questions = [...otherCategoryQuestions, ...finalTargetQuestions];

    return updatedKit;
  }

  if (options.target === 'schedule') {
    if (options.newScheduleDays) {
      updatedKit.schedule.days = options.newScheduleDays;
    }
    return updatedKit;
  }

  return updatedKit;
}

/**
 * Marks an item as deleted and records it in tombstones so that subsequent regenerations
 * respect the deletion and do not resurrect it.
 */
export function markQuestionDeleted(kit: InternalKit, questionId: string): InternalKit {
  const updatedKit: InternalKit = JSON.parse(JSON.stringify(kit));
  const question = updatedKit.questions.find((q) => q.id === questionId);

  if (question) {
    question.is_deleted = true;

    // Record in tombstones
    if (!updatedKit.tombstones.deleted_ids.includes(questionId)) {
      updatedKit.tombstones.deleted_ids.push(questionId);
    }
    const normalizedPrompt = question.prompt.toLowerCase().trim();
    if (!updatedKit.tombstones.deleted_question_prompts.includes(normalizedPrompt)) {
      updatedKit.tombstones.deleted_question_prompts.push(normalizedPrompt);
    }

    // Remove from schedule
    updatedKit.schedule.days.forEach((day) => {
      day.question_ids = day.question_ids.filter((id) => id !== questionId);
    });
  }

  return updatedKit;
}
