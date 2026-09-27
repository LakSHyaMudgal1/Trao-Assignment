import type { QuestionCategory } from '@prep-kit/shared';
import type { IPrepKitDocument, IQuestionItemDoc } from '../../models/kit.model.js';
import { allocateStudySchedule } from '../scheduling/schedule-allocator.js';
import { computeRequirementCoverage } from '../coverage/coverage-auditor.js';
import {
  QuestionGenerator,
  defaultQuestionGenerator,
} from '../llm/question-generator.js';
import {
  BriefGenerator,
  defaultBriefGenerator,
} from '../llm/brief-generator.js';
import { AppError } from '../../utils/app-error.js';

export interface SectionRegenerationOptions {
  target: 'company_brief' | 'category' | 'schedule';
  category?: QuestionCategory;
}

export interface MergeStrategyReport {
  target: string;
  category?: string;
  preservedQuestionsCount: number;
  replacedQuestionsCount: number;
  freshQuestionsAddedCount: number;
  tombstonesHonoredCount: number;
}

/**
 * ============================================================================
 * SECTION-LEVEL REGENERATION WITH PERSISTENCE PRESERVATION ENGINE
 * ============================================================================
 *
 * ARCHITECTURAL DESIGN & INTERVIEW EXPLANATION:
 *
 * Problem:
 * In an AI-assisted workspace, users invest time customizing generated content:
 * - Adding custom questions (origin: 'user_created')
 * - Editing prompts/answers (is_edited: true)
 * - Pinning favorite questions (is_pinned: true)
 * - Deleting unwanted questions (stored in tombstones)
 *
 * Naive regeneration simply wipes and replaces an entire array.
 * This destroys user work, breaking user trust and causing data loss.
 *
 * Solution:
 * An Explicit 4-Phase Merge Strategy:
 *
 * Phase 1: Section Isolation
 *   Regeneration targets are strictly scoped.
 *   - 'company_brief' touches ONLY `company_brief`.
 *   - 'schedule' touches ONLY `schedule.days`.
 *   - 'category' touches ONLY questions in that specific category.
 *   Unrelated sections are mathematically invariant.
 *
 * Phase 2: Entity State Partitioning & Preservation Predicate
 *   For the target question category, partition questions into:
 *     P(q) = (q.origin === 'user_created' || q.is_edited === true || q.is_pinned === true)
 *   - Preserved Set (Q_preserved): Satisfies P(q). IMMUTABLE and GUARANTEED to survive.
 *   - Replaceable Set (Q_replaceable): Pure generated content (!P(q)). Safe to replace.
 *
 * Phase 3: Candidate Generation & Tombstone Anti-Reincarnation
 *   Fresh questions are generated for the category.
 *   Candidates are filtered against:
 *   - Deleted IDs: `kit.tombstones.deleted_ids`
 *   - Deleted Prompts: `kit.tombstones.deleted_question_prompts`
 *   - Duplicate Prompts: prompts already in Q_preserved or other categories.
 *
 * Phase 4: Non-Destructive Array Merge & Cross-Section Synchronization
 *   The new question set is:
 *     Q_final = Q_other_categories + Q_preserved + Q_candidates
 *   - Coverage is recomputed deterministically using `computeCoverage`.
 *   - Schedule day question references are synchronized so no dangling IDs remain.
 * ============================================================================
 */
export class SectionRegenerator {
  constructor(
    private questionGen: QuestionGenerator = defaultQuestionGenerator,
    private briefGen: BriefGenerator = defaultBriefGenerator
  ) {}

  public async regenerateSection(
    kit: IPrepKitDocument,
    options: SectionRegenerationOptions
  ): Promise<{ kit: IPrepKitDocument; report: MergeStrategyReport }> {
    switch (options.target) {
      case 'company_brief':
        return this.regenerateCompanyBrief(kit);

      case 'category':
        if (!options.category) {
          throw AppError.badRequest(
            'Question category is required when target is "category"',
            'MISSING_CATEGORY'
          );
        }
        return this.regenerateQuestionCategory(kit, options.category);

      case 'schedule':
        return this.regenerateSchedule(kit);

      default:
        throw AppError.badRequest(
          `Unsupported regeneration target: ${(options as any).target}`,
          'INVALID_REGENERATION_TARGET'
        );
    }
  }

  /**
   * Target 1: Company Brief Regeneration
   * Touches ONLY company_brief. Leaves role, questions, flashcards, schedule, coverage untouched.
   */
  private async regenerateCompanyBrief(
    kit: IPrepKitDocument
  ): Promise<{ kit: IPrepKitDocument; report: MergeStrategyReport }> {
    // If the user pinned the brief, preserve it without overwriting
    if (kit.company_brief.is_pinned || (kit.company_brief as any).state === 'pinned') {
      return {
        kit,
        report: {
          target: 'company_brief',
          preservedQuestionsCount: 0,
          replacedQuestionsCount: 0,
          freshQuestionsAddedCount: 0,
          tombstonesHonoredCount: 0,
        },
      };
    }

    const jdText = kit.role.requirements.map((r) => r.text).join('. ');
    const freshBrief = await this.briefGen.generate(
      kit.source.company_url,
      kit.source.company,
      kit.company_brief.summary + ' ' + kit.company_brief.what_they_do,
      jdText,
      kit.source.pages_used || []
    );

    kit.company_brief.summary = freshBrief.summary;
    kit.company_brief.what_they_do = freshBrief.what_they_do;

    // Merge sources: retain verified fresh sources plus any custom sources added by user
    const existingSources = kit.company_brief.sources || [];
    const mergedSources = Array.from(new Set([...freshBrief.sources, ...existingSources]));
    kit.company_brief.sources = mergedSources;
    kit.company_brief.is_edited = false;
    (kit.company_brief as any).state = 'active';
    (kit.company_brief as any).revision = ((kit.company_brief as any).revision || 1) + 1;

    return {
      kit,
      report: {
        target: 'company_brief',
        preservedQuestionsCount: 0,
        replacedQuestionsCount: 0,
        freshQuestionsAddedCount: 0,
        tombstonesHonoredCount: 0,
      },
    };
  }

  /**
   * Target 2: Question Category Regeneration
   * Merges freshly generated category questions with user-created, edited, and pinned questions.
   * Strictly respects tombstones and updates coverage and schedule references cleanly.
   */
  private async regenerateQuestionCategory(
    kit: IPrepKitDocument,
    targetCategory: QuestionCategory
  ): Promise<{ kit: IPrepKitDocument; report: MergeStrategyReport }> {
    // 1. Separate questions into other categories vs target category
    const otherCategoryQuestions: IQuestionItemDoc[] = [];
    const targetCategoryQuestions: IQuestionItemDoc[] = [];

    for (const q of kit.questions) {
      if (q.category === targetCategory) {
        targetCategoryQuestions.push(q);
      } else {
        otherCategoryQuestions.push(q);
      }
    }

    // 2. Partition target category questions based on preservation predicate P(q)
    const preservedQuestions: IQuestionItemDoc[] = [];
    const replaceableQuestions: IQuestionItemDoc[] = [];

    for (const q of targetCategoryQuestions) {
      const isUserCreated = q.origin === 'user_created' || (q as any).origin === 'user';
      const isEdited = q.is_edited === true || (q as any).state === 'edited';
      const isPinned = q.is_pinned === true || (q as any).state === 'pinned';
      const isDeleted = q.is_deleted === true || (q as any).state === 'deleted';

      if (isDeleted) {
        // If question was marked deleted, ensure its prompt is tombstoned to prevent resurrecting
        if (q.prompt) {
          const norm = q.prompt.toLowerCase().trim();
          if (!kit.tombstones.deleted_question_prompts.includes(norm)) {
            kit.tombstones.deleted_question_prompts.push(norm);
          }
        }
        continue;
      }

      if (isUserCreated || isEdited || isPinned) {
        // Increment revision on preserved question to track kit lifecycle
        q.revision = (q.revision || 1) + 1;
        if (isPinned) {
          q.state = 'pinned';
          q.is_pinned = true;
        } else if (isEdited) {
          q.state = 'edited';
          q.is_edited = true;
        } else {
          q.state = 'active';
        }
        preservedQuestions.push(q);
      } else {
        replaceableQuestions.push(q);
      }
    }

    // 3. Relevant requirements for this category
    const relevantReqs = kit.role.requirements.filter((r) => {
      if (targetCategory === 'technical') return r.kind === 'technical';
      if (targetCategory === 'behavioural') return r.kind === 'behavioural';
      if (targetCategory === 'system-design') return r.kind === 'technical' || r.kind === 'domain';
      if (targetCategory === 'company-fit') return true;
      return true;
    });

    const activeRequirements = relevantReqs.length > 0 ? relevantReqs : kit.role.requirements;

    // 4. Generate candidate questions for category
    const existingQuestionIds = kit.questions.map((q) => q.id);
    const candidateQuestions = await this.questionGen.generateCategoryQuestions({
      category: targetCategory,
      requirements: activeRequirements,
      companyName: kit.source.company,
      roleTitle: kit.role.title,
      existingQuestionIds,
    });

    // 5. Tombstone and duplicate filtration
    const tombstonePrompts = new Set(
      (kit.tombstones?.deleted_question_prompts || []).map((p) => p.toLowerCase().trim())
    );
    const tombstoneIds = new Set(kit.tombstones?.deleted_ids || []);

    const preservedPrompts = new Set(
      preservedQuestions.map((q) => q.prompt.toLowerCase().trim())
    );
    const otherPrompts = new Set(
      otherCategoryQuestions.map((q) => q.prompt.toLowerCase().trim())
    );

    let tombstonesHonoredCount = 0;
    const acceptedCandidates: IQuestionItemDoc[] = [];

    for (const cand of candidateQuestions) {
      const normalizedPrompt = cand.prompt.toLowerCase().trim();

      // Check tombstoned prompt or ID
      if (tombstonePrompts.has(normalizedPrompt) || tombstoneIds.has(cand.id)) {
        tombstonesHonoredCount++;
        continue;
      }

      // Check duplicate with preserved questions or other categories
      if (preservedPrompts.has(normalizedPrompt) || otherPrompts.has(normalizedPrompt)) {
        continue;
      }

      // Safe fresh question
      acceptedCandidates.push({
        id: cand.id,
        requirement_ids: cand.requirement_ids,
        category: targetCategory,
        prompt: cand.prompt,
        answer_outline: cand.answer_outline,
        difficulty: cand.difficulty,
        origin: 'generated',
        state: 'active',
        revision: 1,
        is_edited: false,
        is_pinned: false,
        is_deleted: false,
        order_index: (preservedQuestions.length + acceptedCandidates.length) as any,
      } as IQuestionItemDoc);
    }

    // 6. Merge preserved and candidate questions
    const finalCategoryQuestions = [...preservedQuestions, ...acceptedCandidates];

    // Assemble final questions array
    const newQuestions = [...otherCategoryQuestions, ...finalCategoryQuestions];
    kit.questions = newQuestions as any;

    // 7. Post-Merge Invariant: Deterministically recompute coverage
    const coverageResult = computeRequirementCoverage(kit.role.requirements, newQuestions);
    kit.coverage.uncovered_requirement_ids = coverageResult.uncovered_requirement_ids;

    // 8. Post-Merge Invariant: Synchronize schedule references
    // If any replaced question ID was in schedule, replace it or clean it up
    const validQuestionIdSet = new Set(newQuestions.map((q) => q.id));
    const replaceableIdMap = new Map<string, string>();
    for (let i = 0; i < replaceableQuestions.length; i++) {
      const oldId = replaceableQuestions[i]!.id;
      const replacement = acceptedCandidates[i]?.id;
      if (replacement) {
        replaceableIdMap.set(oldId, replacement);
      }
    }

    kit.schedule.days.forEach((day) => {
      day.question_ids = day.question_ids.map((id) => {
        if (replaceableIdMap.has(id)) {
          return replaceableIdMap.get(id)!;
        }
        return id;
      }).filter((id) => validQuestionIdSet.has(id));
    });

    return {
      kit,
      report: {
        target: 'category',
        category: targetCategory,
        preservedQuestionsCount: preservedQuestions.length,
        replacedQuestionsCount: replaceableQuestions.length,
        freshQuestionsAddedCount: acceptedCandidates.length,
        tombstonesHonoredCount,
      },
    };
  }

  /**
   * Target 3: Schedule Regeneration
   * Reallocates schedule deterministically across days_available.
   * Touches ONLY schedule. Questions, role, brief, flashcards are 100% untouched.
   */
  private async regenerateSchedule(
    kit: IPrepKitDocument
  ): Promise<{ kit: IPrepKitDocument; report: MergeStrategyReport }> {
    const daysAvailable = kit.schedule.days_available || 5;
    const allocated = allocateStudySchedule(daysAvailable, kit.questions, kit.role.requirements);

    kit.schedule.days = allocated.days as any;

    return {
      kit,
      report: {
        target: 'schedule',
        preservedQuestionsCount: kit.questions.length,
        replacedQuestionsCount: 0,
        freshQuestionsAddedCount: 0,
        tombstonesHonoredCount: 0,
      },
    };
  }
}

export const sectionRegenerator = new SectionRegenerator();
