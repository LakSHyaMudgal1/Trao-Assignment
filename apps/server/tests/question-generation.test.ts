import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  QuestionGenerator,
  type CategoryGenerationOptions,
  type ResearchContext,
} from '../src/core/llm/question-generator.js';
import { LlmClient } from '../src/core/llm/llm-client.js';
import { QuestionItemSchema, type RequirementItem } from '@prep-kit/shared';

describe('Question Generation Subsystem Suite', () => {
  let mockLlmClient: any;
  let questionGenerator: QuestionGenerator;

  const sampleRequirements: RequirementItem[] = [
    {
      id: 'r1',
      text: 'Deep proficiency in TypeScript, React, and Node.js microservices',
      kind: 'technical',
      priority: 'must',
    },
    {
      id: 'r2',
      text: 'Experience designing fault-tolerant distributed caching systems with Redis and PostgreSQL',
      kind: 'technical',
      priority: 'must',
    },
    {
      id: 'r3',
      text: 'Demonstrated cross-functional leadership, mentoring junior developers, and running retrospectives',
      kind: 'behavioural',
      priority: 'must',
    },
    {
      id: 'r4',
      text: 'Understanding of financial compliance, payment idempotency, and transaction security',
      kind: 'domain',
      priority: 'nice',
    },
  ];

  const sampleResearch: ResearchContext = {
    homepageSummary: 'Stripe powers online payments for millions of internet businesses globally.',
    whatTheyDo: 'Builds economic infrastructure for the internet, offering robust APIs and high-availability payments processing.',
    aboutText: 'Values customer obsession, macro ambition, and rigorous engineering craftsmanship.',
    technicalSignals: ['React', 'TypeScript', 'Node.js', 'Distributed Systems'],
    publicInterviewFindings: [
      {
        topic: 'technical_topics',
        summary: 'Candidates report live pair programming focusing on real-world bug fixing and API design.',
        evidence_snippet: 'Live coding round on actual business logic with pair programming.',
      },
      {
        topic: 'candidate_experience',
        summary: 'Interviewers emphasize code readability, clean abstractions, and transparent trade-off reasoning.',
        evidence_snippet: 'The team cares deeply about clean abstractions.',
      },
    ],
  };

  beforeEach(() => {
    mockLlmClient = {
      isAvailable: vi.fn().mockReturnValue(true),
      generateRawText: vi.fn(),
      generateJson: vi.fn(),
    };
    questionGenerator = new QuestionGenerator(mockLlmClient as unknown as LlmClient);
  });

  describe('1. Requirement and Research Partitioning per Category', () => {
    it('filters requirements strictly by category relevance', () => {
      const techReqs = questionGenerator.filterRequirementsForCategory('technical', sampleRequirements);
      expect(techReqs.every((r) => r.kind === 'technical')).toBe(true);
      expect(techReqs.map((r) => r.id)).toContain('r1');

      const sysReqs = questionGenerator.filterRequirementsForCategory('system-design', sampleRequirements);
      expect(sysReqs.some((r) => r.text.includes('distributed'))).toBe(true);

      const behReqs = questionGenerator.filterRequirementsForCategory('behavioural', sampleRequirements);
      expect(behReqs.every((r) => r.kind === 'behavioural')).toBe(true);
      expect(behReqs.map((r) => r.id)).toContain('r3');

      const domainReqs = questionGenerator.filterRequirementsForCategory('company-fit', sampleRequirements);
      expect(domainReqs.some((r) => r.kind === 'domain')).toBe(true);
      expect(domainReqs.map((r) => r.id)).toContain('r4');
    });

    it('filters research context to include ONLY category-relevant evidence', () => {
      const techEvidence = questionGenerator.filterResearchForCategory('technical', sampleResearch);
      expect(techEvidence).toContain('Technical signals');
      expect(techEvidence).not.toContain('Company Mission');

      const sysEvidence = questionGenerator.filterResearchForCategory('system-design', sampleResearch);
      expect(sysEvidence).toContain('Core Product Scope');

      const behEvidence = questionGenerator.filterResearchForCategory('behavioural', sampleResearch);
      expect(behEvidence).toContain('Company Culture Snippet');

      const fitEvidence = questionGenerator.filterResearchForCategory('company-fit', sampleResearch);
      expect(fitEvidence).toContain('Company Mission');
      expect(fitEvidence).toContain('What They Do');
    });
  });

  describe('2. Separate Category Generation with Zod Validation', () => {
    it('generates technical questions referencing real technical requirements and validates with Zod', async () => {
      mockLlmClient.generateRawText.mockResolvedValueOnce(
        JSON.stringify({
          questions: [
            {
              requirement_ids: ['r1'],
              category: 'technical',
              prompt: 'How would you architect a high-throughput Node.js microservice handling streaming data in TypeScript?',
              answer_outline: 'Discuss event loop performance, stream backpressure, error boundaries, and unit test coverage.',
              difficulty: 2,
            },
          ],
        })
      );

      const options: CategoryGenerationOptions = {
        category: 'technical',
        requirements: [sampleRequirements[0]!],
        companyName: 'Stripe',
        roleTitle: 'Senior Software Engineer',
        researchEvidence: 'Focus on clean API contracts.',
      };

      const questions = await questionGenerator.generateCategoryQuestions(options);

      expect(questions).toHaveLength(1);
      const q = questions[0]!;

      // Verify Zod validation
      const parsed = QuestionItemSchema.parse(q);
      expect(parsed).toBeDefined();

      expect(q.category).toBe('technical');
      expect(q.requirement_ids).toEqual(['r1']);
      expect([1, 2, 3]).toContain(q.difficulty);
      expect(q.id).toMatch(/^q/);
    });

    it('generates system-design questions with difficulty 1-3 referencing relevant architecture requirements', async () => {
      mockLlmClient.generateRawText.mockResolvedValueOnce(
        JSON.stringify({
          questions: [
            {
              requirement_ids: ['r2'],
              category: 'system-design',
              prompt: 'Design a distributed caching architecture using Redis and PostgreSQL with strict cache invalidation.',
              answer_outline: 'Address cache-aside vs write-through patterns, thundering herd protection, TTL strategies, and replication lag.',
              difficulty: 3,
            },
          ],
        })
      );

      const questions = await questionGenerator.generateCategoryQuestions({
        category: 'system-design',
        requirements: [sampleRequirements[1]!],
        companyName: 'Stripe',
        roleTitle: 'Senior Software Engineer',
      });

      expect(questions).toHaveLength(1);
      expect(questions[0]?.category).toBe('system-design');
      expect(questions[0]?.difficulty).toBe(3);
      expect(questions[0]?.requirement_ids).toContain('r2');
      QuestionItemSchema.parse(questions[0]);
    });

    it('generates behavioural questions based on leadership requirements and STAR evaluation', async () => {
      mockLlmClient.generateRawText.mockResolvedValueOnce(
        JSON.stringify({
          questions: [
            {
              requirement_ids: ['r3'],
              category: 'behavioural',
              prompt: 'Tell me about a time you mentored a junior engineer who was struggling with a complex architectural concept.',
              answer_outline: 'Look for empathy, structured coaching, patience, quantifiable improvement in the junior engineer’s velocity, and retro insights.',
              difficulty: 2,
            },
          ],
        })
      );

      const questions = await questionGenerator.generateCategoryQuestions({
        category: 'behavioural',
        requirements: [sampleRequirements[2]!],
        companyName: 'Stripe',
        roleTitle: 'Senior Software Engineer',
      });

      expect(questions).toHaveLength(1);
      expect(questions[0]?.category).toBe('behavioural');
      expect(questions[0]?.requirement_ids).toContain('r3');
      QuestionItemSchema.parse(questions[0]);
    });

    it('generates company-fit questions using researched evidence and domain requirements', async () => {
      mockLlmClient.generateRawText.mockResolvedValueOnce(
        JSON.stringify({
          questions: [
            {
              requirement_ids: ['r4'],
              category: 'company-fit',
              prompt: 'How do you approach transaction idempotency and auditability in payments systems at Stripe?',
              answer_outline: 'Address idempotency keys, atomic DB operations, dead-letter queues, and compliance safeguards.',
              difficulty: 2,
            },
          ],
        })
      );

      const questions = await questionGenerator.generateCategoryQuestions({
        category: 'company-fit',
        requirements: [sampleRequirements[3]!],
        companyName: 'Stripe',
        roleTitle: 'Senior Software Engineer',
        researchEvidence: 'Stripe builds payments infrastructure.',
      });

      expect(questions).toHaveLength(1);
      expect(questions[0]?.category).toBe('company-fit');
      expect(questions[0]?.requirement_ids).toContain('r4');
      QuestionItemSchema.parse(questions[0]);
    });
  });

  describe('3. Grounding & Hallucination Prevention', () => {
    it('discards hallucinated requirement IDs and binds only to real requirements', async () => {
      mockLlmClient.generateRawText.mockResolvedValueOnce(
        JSON.stringify({
          questions: [
            {
              // 'r999_fake' does NOT exist in passed requirements
              requirement_ids: ['r999_fake', 'r1'],
              category: 'technical',
              prompt: 'How do you optimize React render cycles and state selectors in high-frequency trading dashboards?',
              answer_outline: 'Evaluate useMemo, React.memo, profiling, and state normalization.',
              difficulty: 2,
            },
          ],
        })
      );

      const questions = await questionGenerator.generateCategoryQuestions({
        category: 'technical',
        requirements: [sampleRequirements[0]!],
        companyName: 'Stripe',
        roleTitle: 'Senior Software Engineer',
      });

      expect(questions).toHaveLength(1);
      // 'r999_fake' MUST be stripped out
      expect(questions[0]?.requirement_ids).toEqual(['r1']);
      expect(questions[0]?.requirement_ids).not.toContain('r999_fake');
    });

    it('clamps out-of-range difficulty to 1-3', async () => {
      mockLlmClient.generateRawText.mockResolvedValueOnce(
        JSON.stringify({
          questions: [
            {
              requirement_ids: ['r1'],
              category: 'technical',
              prompt: 'Explain JavaScript event loop and microtask queues.',
              answer_outline: 'Discuss call stack, macrotasks, microtasks, and Promise resolution order.',
              difficulty: 5, // Invalid difficulty > 3
            },
          ],
        })
      );

      const questions = await questionGenerator.generateCategoryQuestions({
        category: 'technical',
        requirements: [sampleRequirements[0]!],
        companyName: 'Stripe',
        roleTitle: 'Senior Software Engineer',
      });

      expect(questions).toHaveLength(1);
      expect(questions[0]?.difficulty).toBe(3); // Clamped to max 3
    });
  });

  describe('4. Structured JSON Repair Strategy', () => {
    it('cleans and repairs JSON wrapped in markdown code fences', async () => {
      const markdownWrapped = `
Here is the question for the candidate:
\`\`\`json
{
  "questions": [
    {
      "requirement_ids": ["r1"],
      "category": "technical",
      "prompt": "How do you handle memory leaks in long-running Node.js processes?",
      "answer_outline": "Explain heapdump analysis, GC profiling, and EventEmitter listener cleanup.",
      "difficulty": 2
    }
  ]
}
\`\`\`
Hope this helps!
`;
      mockLlmClient.generateRawText.mockResolvedValueOnce(markdownWrapped);

      const questions = await questionGenerator.generateCategoryQuestions({
        category: 'technical',
        requirements: [sampleRequirements[0]!],
        companyName: 'Stripe',
        roleTitle: 'Senior Software Engineer',
      });

      expect(questions).toHaveLength(1);
      expect(questions[0]?.prompt).toContain('memory leaks');
      QuestionItemSchema.parse(questions[0]);
    });

    it('cleans trailing commas in JSON', async () => {
      const trailingCommaJson = `
{
  "questions": [
    {
      "requirement_ids": ["r1"],
      "category": "technical",
      "prompt": "Explain database indexing in PostgreSQL.",
      "answer_outline": "B-tree vs GIN indexes, query execution plans, and index bloat.",
      "difficulty": 2,
    },
  ],
}
`;
      mockLlmClient.generateRawText.mockResolvedValueOnce(trailingCommaJson);

      const questions = await questionGenerator.generateCategoryQuestions({
        category: 'technical',
        requirements: [sampleRequirements[0]!],
        companyName: 'Stripe',
        roleTitle: 'Senior Software Engineer',
      });

      expect(questions).toHaveLength(1);
      expect(questions[0]?.prompt).toContain('database indexing');
      QuestionItemSchema.parse(questions[0]);
    });

    it('triggers LLM repair prompt when JSON syntax is corrupted and parses successfully', async () => {
      // 1. Initial call returns broken unparseable syntax
      mockLlmClient.generateRawText.mockResolvedValueOnce(
        `{ "questions": [ { "requirement_ids": ["r1"], "category": "technical", prompt: broken unquoted text...`
      );

      // 2. Repair call returns valid JSON
      mockLlmClient.generateRawText.mockResolvedValueOnce(
        JSON.stringify({
          questions: [
            {
              requirement_ids: ['r1'],
              category: 'technical',
              prompt: 'How do you design scalable REST APIs with TypeScript and Express?',
              answer_outline: 'Explain request validation with Zod, middleware pipelines, and centralized error handling.',
              difficulty: 2,
            },
          ],
        })
      );

      const questions = await questionGenerator.generateCategoryQuestions({
        category: 'technical',
        requirements: [sampleRequirements[0]!],
        companyName: 'Stripe',
        roleTitle: 'Senior Software Engineer',
      });

      expect(mockLlmClient.generateRawText).toHaveBeenCalledTimes(2);
      expect(questions).toHaveLength(1);
      expect(questions[0]?.prompt).toContain('scalable REST APIs');
      QuestionItemSchema.parse(questions[0]);
    });

    it('falls back seamlessly to deterministic generation if LLM repair fails', async () => {
      // Both initial and repair fail
      mockLlmClient.generateRawText.mockRejectedValue(new Error('Persistent API 500'));

      const questions = await questionGenerator.generateCategoryQuestions({
        category: 'technical',
        requirements: [sampleRequirements[0]!],
        companyName: 'Stripe',
        roleTitle: 'Senior Software Engineer',
      });

      // Does not throw! Returns clean, valid deterministic questions
      expect(questions.length).toBeGreaterThanOrEqual(1);
      expect(questions[0]?.category).toBe('technical');
      expect(questions[0]?.requirement_ids).toContain('r1');
      QuestionItemSchema.parse(questions[0]);
    });
  });

  describe('5. Full Multi-Category Generation Orchestration', () => {
    it('generates questions across all 4 categories in sequence', async () => {
      // Deterministic generation across all categories
      mockLlmClient.isAvailable.mockReturnValue(false);

      const allQuestions = await questionGenerator.generateCategorizedQuestions(
        sampleRequirements,
        'Stripe',
        'Senior Full-Stack Engineer',
        sampleResearch
      );

      // Verify all 4 categories are covered
      const categoriesFound = new Set(allQuestions.map((q) => q.category));
      expect(categoriesFound.has('technical')).toBe(true);
      expect(categoriesFound.has('system-design')).toBe(true);
      expect(categoriesFound.has('behavioural')).toBe(true);
      expect(categoriesFound.has('company-fit')).toBe(true);

      // Verify all questions validate against QuestionItemSchema
      for (const q of allQuestions) {
        QuestionItemSchema.parse(q);
        expect([1, 2, 3]).toContain(q.difficulty);
        expect(q.requirement_ids.length).toBeGreaterThan(0);
      }

      // Verify unique IDs
      const ids = allQuestions.map((q) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
