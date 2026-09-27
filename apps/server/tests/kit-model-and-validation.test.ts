import { describe, it, expect } from 'vitest';
import {
  validateKitStructure,
  assertValidKitStructure,
  serializeToAppendixA,
  deserializeFromAppendixA,
  applySectionRegeneration,
  markQuestionDeleted,
  generateRequirementId,
  generateQuestionId,
  generateFlashcardId,
  type KitAppendixA,
  type InternalKit,
} from '@prep-kit/shared';

describe('Kit Domain Model, Structure Validation & Editor State Suite', () => {
  // Canonical valid kit fixture matching Appendix A exactly
  const createValidKit = (): KitAppendixA => ({
    source: {
      company: 'Acme Corp',
      company_url: 'https://acme.corp',
      role: 'Senior Full Stack Engineer',
      location: 'Remote',
      jd_chars: 1450,
      researched_at: '2026-09-01T12:00:00Z',
      pages_used: ['https://acme.corp', 'https://acme.corp/careers'],
    },
    company_brief: {
      summary: 'Acme is an enterprise observability SaaS provider.',
      what_they_do: 'Distributed tracing and application performance monitoring.',
      sources: ['https://acme.corp/about'],
    },
    role: {
      title: 'Senior Full Stack Engineer',
      seniority: 'Senior',
      responsibilities: [
        'Architect and scale cloud-native microservices',
        'Lead frontend performance initiatives with Next.js',
      ],
      requirements: [
        {
          id: 'r1',
          text: '5+ years experience with React, Next.js, and TypeScript',
          kind: 'technical',
          priority: 'must',
        },
        {
          id: 'r2',
          text: 'Deep knowledge of distributed systems and message brokers',
          kind: 'technical',
          priority: 'must',
        },
        {
          id: 'r3',
          text: 'Experience mentoring junior and mid-level software engineers',
          kind: 'behavioural',
          priority: 'must',
        },
        {
          id: 'r4',
          text: 'Familiarity with Kubernetes and Helm deployments',
          kind: 'domain',
          priority: 'nice',
        },
      ],
    },
    questions: [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'How do you optimize server-side rendering performance and hydration in Next.js App Router?',
        answer_outline: 'Explain React Server Components, streaming with Suspense, and selective hydration.',
        difficulty: 3,
      },
      {
        id: 'q2',
        requirement_ids: ['r2'],
        category: 'system-design',
        prompt: 'Design an event-driven tracing pipeline capable of ingesting 100k events/sec.',
        answer_outline: 'Describe message partitioning with Kafka, buffer tiers, and batch writes to cold storage.',
        difficulty: 3,
      },
      {
        id: 'q3',
        requirement_ids: ['r3'],
        category: 'behavioural',
        prompt: 'Describe a situation where you had to guide an engineer struggling with a complex feature delivery.',
        answer_outline: 'Use STAR method: isolate root blockers, establish pair programming intervals, track progress.',
        difficulty: 2,
      },
      {
        id: 'q4',
        requirement_ids: ['r4'],
        category: 'technical',
        prompt: 'What are the main differences between Kubernetes Deployments, DaemonSets, and StatefulSets?',
        answer_outline: 'Contrast pod lifecycle, persistent volume claims, and node scheduling rules.',
        difficulty: 1,
      },
    ],
    flashcards: [
      {
        id: 'f1',
        front: 'What are React Server Components (RSC)?',
        back: 'Components that render exclusively on the server, eliminating zero bundle size on the client.',
        requirement_ids: ['r1'],
      },
      {
        id: 'f2',
        front: 'What is the STAR method in behavioural interviews?',
        back: 'Situation, Task, Action, Result structured response framework.',
        requirement_ids: ['r3'],
      },
    ],
    schedule: {
      days_available: 3,
      days: [
        {
          day: 1,
          focus: 'Core Next.js & Architecture Ingestion',
          question_ids: ['q1', 'q2'],
          minutes: 90,
        },
        {
          day: 2,
          focus: 'Behavioural Alignment & Engineering Leadership',
          question_ids: ['q3'],
          minutes: 45,
        },
        {
          day: 3,
          focus: 'Domain Infrastructure & Final Review',
          question_ids: ['q4'],
          minutes: 45,
        },
      ],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1,
    },
  });

  describe('1. Appendix A Validation Suite', () => {
    it('accepts a fully valid Appendix A kit', () => {
      const kit = createValidKit();
      const result = validateKitStructure(kit);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.data).toBeDefined();
    });

    it('rejects an invalid kit with missing required fields', () => {
      const kit = createValidKit();
      // @ts-expect-error test invalid payload
      delete kit.source.company;
      // @ts-expect-error test invalid payload
      delete kit.schedule;

      const result = validateKitStructure(kit);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects broken requirement references in questions', () => {
      const kit = createValidKit();
      kit.questions[0].requirement_ids = ['r999_non_existent'];

      const result = validateKitStructure(kit);
      expect(result.isValid).toBe(false);
      const brokenRefError = result.errors.find((e) => e.code === 'BROKEN_REQUIREMENT_REFERENCE');
      expect(brokenRefError).toBeDefined();
      expect(brokenRefError?.message).toMatch(/references non-existent requirement id "r999_non_existent"/);
    });

    it('rejects broken requirement references in flashcards', () => {
      const kit = createValidKit();
      kit.flashcards[0].requirement_ids = ['r_missing_ghost'];

      const result = validateKitStructure(kit);
      expect(result.isValid).toBe(false);
      const brokenRefError = result.errors.find((e) => e.code === 'BROKEN_REQUIREMENT_REFERENCE');
      expect(brokenRefError).toBeDefined();
      expect(brokenRefError?.message).toMatch(/Flashcard "f1" references non-existent requirement id "r_missing_ghost"/);
    });

    it('rejects schedule referencing missing questions', () => {
      const kit = createValidKit();
      kit.schedule.days[0].question_ids.push('q999_phantom');

      const result = validateKitStructure(kit);
      expect(result.isValid).toBe(false);
      const brokenQError = result.errors.find((e) => e.code === 'BROKEN_QUESTION_REFERENCE');
      expect(brokenQError).toBeDefined();
      expect(brokenQError?.message).toMatch(/references non-existent question id "q999_phantom"/);
    });

    it('rejects invalid question difficulty (must be integer 1 to 3)', () => {
      const kit1 = createValidKit();
      kit1.questions[0].difficulty = 0 as any; // Less than 1
      expect(validateKitStructure(kit1).isValid).toBe(false);

      const kit2 = createValidKit();
      kit2.questions[0].difficulty = 4 as any; // Greater than 3
      expect(validateKitStructure(kit2).isValid).toBe(false);

      const kit3 = createValidKit();
      kit3.questions[0].difficulty = 2.5 as any; // Float
      expect(validateKitStructure(kit3).isValid).toBe(false);
    });

    it('rejects invalid schedule minutes (must be positive integer)', () => {
      const kit1 = createValidKit();
      kit1.schedule.days[0].minutes = 0; // Not positive
      expect(validateKitStructure(kit1).isValid).toBe(false);

      const kit2 = createValidKit();
      kit2.schedule.days[0].minutes = -30; // Negative
      expect(validateKitStructure(kit2).isValid).toBe(false);

      const kit3 = createValidKit();
      kit3.schedule.days[0].minutes = 45.5; // Float
      expect(validateKitStructure(kit3).isValid).toBe(false);
    });

    it('rejects duplicate requirement IDs', () => {
      const kit = createValidKit();
      kit.role.requirements.push({
        id: 'r1', // Duplicate ID
        text: 'Duplicate React requirement',
        kind: 'technical',
        priority: 'must',
      });

      const result = validateKitStructure(kit);
      expect(result.isValid).toBe(false);
      const dupError = result.errors.find((e) => e.code === 'DUPLICATE_ID');
      expect(dupError).toBeDefined();
      expect(dupError?.message).toMatch(/Duplicate requirement ID found: "r1"/);
    });

    it('rejects duplicate question IDs', () => {
      const kit = createValidKit();
      kit.questions.push({
        id: 'q1', // Duplicate ID
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'Another question with same id',
        answer_outline: 'Outline',
        difficulty: 2,
      });

      const result = validateKitStructure(kit);
      expect(result.isValid).toBe(false);
      const dupError = result.errors.find((e) => e.code === 'DUPLICATE_ID');
      expect(dupError).toBeDefined();
      expect(dupError?.message).toMatch(/Duplicate question ID found: "q1"/);
    });

    it('rejects duplicate flashcard IDs', () => {
      const kit = createValidKit();
      kit.flashcards.push({
        id: 'f1', // Duplicate ID
        front: 'Front',
        back: 'Back',
        requirement_ids: ['r1'],
      });

      const result = validateKitStructure(kit);
      expect(result.isValid).toBe(false);
      const dupError = result.errors.find((e) => e.code === 'DUPLICATE_ID');
      expect(dupError).toBeDefined();
      expect(dupError?.message).toMatch(/Duplicate flashcard ID found: "f1"/);
    });

    it('rejects when days_available does not equal schedule.days length', () => {
      const kit = createValidKit();
      kit.schedule.days_available = 5; // but schedule.days only has 3 items!

      const result = validateKitStructure(kit);
      expect(result.isValid).toBe(false);
      const mismatchError = result.errors.find((e) => e.code === 'DAYS_MISMATCH');
      expect(mismatchError).toBeDefined();
    });

    it('assertValidKitStructure throws detailed error on failure and returns data on success', () => {
      const valid = createValidKit();
      expect(assertValidKitStructure(valid)).toBeDefined();

      const invalid = createValidKit();
      invalid.questions[0].difficulty = 99 as any;
      expect(() => assertValidKitStructure(invalid)).toThrow(/validation failed/);
    });
  });

  describe('2. Stable ID Generation', () => {
    it('generates sequential requirement IDs without collision', () => {
      expect(generateRequirementId([])).toBe('r1');
      expect(generateRequirementId(['r1', 'r2'])).toBe('r3');
      expect(generateRequirementId(['r1', 'r5', 'r2'])).toBe('r6');
      expect(generateRequirementId(['r1'], 'user_created')).toBe('r_usr_1');
      expect(generateRequirementId(['r_usr_1', 'r_usr_2'], 'user_created')).toBe('r_usr_3');
    });

    it('generates sequential question IDs without collision', () => {
      expect(generateQuestionId([])).toBe('q1');
      expect(generateQuestionId(['q1', 'q2'])).toBe('q3');
      expect(generateQuestionId(['q1', 'q2'], 'user_created')).toBe('q_usr_1');
      expect(generateQuestionId(['q_usr_1'], 'user_created')).toBe('q_usr_2');
    });

    it('generates sequential flashcard IDs without collision', () => {
      expect(generateFlashcardId([])).toBe('f1');
      expect(generateFlashcardId(['f1', 'f2'])).toBe('f3');
    });
  });

  describe('3. Serialization & Deserialization Roundtrip', () => {
    it('deserializes Appendix A kit to InternalKit with full metadata and serializes back without loss', () => {
      const originalAppendixA = createValidKit();
      const internalKit = deserializeFromAppendixA(originalAppendixA, {
        userId: 'user_123',
        title: 'Full Stack at Acme',
      });

      expect(internalKit.user_id).toBe('user_123');
      expect(internalKit.title).toBe('Full Stack at Acme');
      expect(internalKit.questions[0].origin).toBe('generated');
      expect(internalKit.questions[0].is_edited).toBe(false);
      expect(internalKit.questions[0].is_pinned).toBe(false);
      expect(internalKit.questions[0].order_index).toBe(0);

      // Serialize back to Appendix A
      const serializedAppendixA = serializeToAppendixA(internalKit);
      expect(serializedAppendixA).toEqual(originalAppendixA);
    });
  });

  describe('4. Editor State & Surgical Regeneration Strategy', () => {
    let internalKit: InternalKit;

    beforeEach(() => {
      internalKit = deserializeFromAppendixA(createValidKit(), {
        userId: 'user_123',
        title: 'Senior Engineer Prep Kit',
      });
    });

    it('guarantees manually edited questions survive category regeneration', () => {
      // User modifies prompt and difficulty of technical question q1
      internalKit.questions[0].prompt = 'Custom edited Next.js rendering question';
      internalKit.questions[0].is_edited = true;

      // Regenerate the 'technical' category with new candidate questions
      const regenerated = applySectionRegeneration(internalKit, {
        target: 'category',
        category: 'technical',
        newQuestions: [
          {
            prompt: 'Brand new React 19 actions question',
            answer_outline: 'Explain useActionState and Server Actions',
            difficulty: 2,
            requirement_ids: ['r1'],
          },
        ],
      });

      // The edited question q1 MUST survive
      const survivedQ1 = regenerated.questions.find((q) => q.id === 'q1');
      expect(survivedQ1).toBeDefined();
      expect(survivedQ1?.prompt).toBe('Custom edited Next.js rendering question');
      expect(survivedQ1?.is_edited).toBe(true);

      // And the new question was added
      const newQuestion = regenerated.questions.find(
        (q) => q.prompt === 'Brand new React 19 actions question'
      );
      expect(newQuestion).toBeDefined();
      expect(newQuestion?.category).toBe('technical');
    });

    it('guarantees manually created questions survive category regeneration', () => {
      // User creates a manual question in 'technical' category
      const userQId = generateQuestionId(
        internalKit.questions.map((q) => q.id),
        'user_created'
      );
      internalKit.questions.push({
        id: userQId,
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'User hand-crafted React hook test question',
        answer_outline: 'Custom outline written by user',
        difficulty: 2,
        origin: 'user_created',
        is_edited: false,
        is_pinned: false,
        is_deleted: false,
        order_index: 99,
      });

      // Regenerate technical category
      const regenerated = applySectionRegeneration(internalKit, {
        target: 'category',
        category: 'technical',
        newQuestions: [
          {
            prompt: 'Candidate generated question',
            answer_outline: 'Outline',
            difficulty: 1,
            requirement_ids: ['r1'],
          },
        ],
      });

      // User-created question must survive!
      const userCreatedFound = regenerated.questions.find((q) => q.id === userQId);
      expect(userCreatedFound).toBeDefined();
      expect(userCreatedFound?.origin).toBe('user_created');
      expect(userCreatedFound?.prompt).toBe('User hand-crafted React hook test question');
    });

    it('guarantees pinned questions survive category regeneration', () => {
      // User pins question q4
      const q4 = internalKit.questions.find((q) => q.id === 'q4')!;
      q4.is_pinned = true;

      // Regenerate technical category
      const regenerated = applySectionRegeneration(internalKit, {
        target: 'category',
        category: 'technical',
        newQuestions: [
          {
            prompt: 'Generated replacement question',
            answer_outline: 'Outline',
            difficulty: 2,
            requirement_ids: ['r4'],
          },
        ],
      });

      const pinnedQ4 = regenerated.questions.find((q) => q.id === 'q4');
      expect(pinnedQ4).toBeDefined();
      expect(pinnedQ4?.is_pinned).toBe(true);
    });

    it('guarantees deleting an item remains respected and is never resurrected on regeneration', () => {
      // User deletes question q4 (Kubernetes deployment)
      const kitWithDeleted = markQuestionDeleted(internalKit, 'q4');

      expect(kitWithDeleted.tombstones.deleted_ids).toContain('q4');
      expect(
        kitWithDeleted.tombstones.deleted_question_prompts.some((p) =>
          p.includes('kubernetes deployments')
        )
      ).toBe(true);

      // Now regenerate category with a candidate that repeats the deleted question's prompt
      const regenerated = applySectionRegeneration(kitWithDeleted, {
        target: 'category',
        category: 'technical',
        newQuestions: [
          {
            // Attempt to regenerate the exact same question that was deleted
            prompt: 'What are the main differences between Kubernetes Deployments, DaemonSets, and StatefulSets?',
            answer_outline: 'Contrast pod lifecycle...',
            difficulty: 1,
            requirement_ids: ['r4'],
          },
          {
            prompt: 'Alternative fresh Docker vs Podman question',
            answer_outline: 'Daemonless vs daemon architecture',
            difficulty: 2,
            requirement_ids: ['r4'],
          },
        ],
      });

      // The deleted Kubernetes prompt must NOT be resurrected
      const resurrected = regenerated.questions.find(
        (q) => !q.is_deleted && q.prompt.includes('Kubernetes Deployments')
      );
      expect(resurrected).toBeUndefined();

      // But the fresh alternative question was added
      const freshQ = regenerated.questions.find((q) => q.prompt.includes('Docker vs Podman'));
      expect(freshQ).toBeDefined();
    });

    it('guarantees regeneration of one section does NOT overwrite unrelated sections', () => {
      // 1. User has an edited brief and an edited behavioural question
      internalKit.company_brief.summary = 'User edited custom company summary';
      internalKit.company_brief.is_edited = true;

      const q3 = internalKit.questions.find((q) => q.id === 'q3')!;
      q3.prompt = 'User customized behavioural leadership scenario';
      q3.is_edited = true;

      // 2. Regenerate only 'technical' category
      const regeneratedTech = applySectionRegeneration(internalKit, {
        target: 'category',
        category: 'technical',
        newQuestions: [
          {
            prompt: 'New TypeScript 5.5 question',
            answer_outline: 'Inferred type predicates',
            difficulty: 2,
            requirement_ids: ['r1'],
          },
        ],
      });

      // Assert brief was completely untouched
      expect(regeneratedTech.company_brief.summary).toBe('User edited custom company summary');
      expect(regeneratedTech.company_brief.is_edited).toBe(true);

      // Assert behavioural question q3 was completely untouched
      const q3After = regeneratedTech.questions.find((q) => q.id === 'q3');
      expect(q3After?.prompt).toBe('User customized behavioural leadership scenario');

      // Assert schedule days count and topics were untouched
      expect(regeneratedTech.schedule.days_available).toBe(3);
      expect(regeneratedTech.schedule.days).toHaveLength(3);
    });

    it('guarantees regeneration of company brief does NOT overwrite questions or schedule', () => {
      const regeneratedBrief = applySectionRegeneration(internalKit, {
        target: 'company_brief',
        newBrief: {
          summary: 'Newly retrieved executive summary from crawling',
          what_they_do: 'Next-gen distributed cloud infrastructure',
          sources: ['https://acme.corp/fresh-about'],
        },
      });

      expect(regeneratedBrief.company_brief.summary).toBe(
        'Newly retrieved executive summary from crawling'
      );
      expect(regeneratedBrief.company_brief.sources).toContain('https://acme.corp/fresh-about');

      // All questions and schedule remain intact
      expect(regeneratedBrief.questions).toHaveLength(internalKit.questions.length);
      expect(regeneratedBrief.schedule.days).toHaveLength(3);
    });
  });
});
