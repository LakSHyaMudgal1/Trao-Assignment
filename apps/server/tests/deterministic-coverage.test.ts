import { describe, it, expect, vi } from 'vitest';
import {
  computeRequirementCoverage,
  runCoverageResolutionLoop,
} from '../src/core/coverage/coverage-auditor.js';
import type { RequirementItem, QuestionItem } from '@prep-kit/shared';

describe('Deterministic Coverage Engine Suite', () => {
  const req1: RequirementItem = { id: 'r1', text: 'Node.js & TypeScript backend', kind: 'technical', priority: 'must' };
  const req2: RequirementItem = { id: 'r2', text: 'React frontend architecture', kind: 'technical', priority: 'must' };
  const req3: RequirementItem = { id: 'r3', text: 'Distributed caching with Redis', kind: 'technical', priority: 'must' };
  const req4: RequirementItem = { id: 'r4', text: 'Mentoring junior developers', kind: 'behavioural', priority: 'nice' };
  const req5: RequirementItem = { id: 'r5', text: 'Fintech compliance knowledge', kind: 'domain', priority: 'nice' };

  const allReqs: RequirementItem[] = [req1, req2, req3, req4, req5];

  describe('1. Core Deterministic Coverage Algorithm', () => {
    it('accurately calculates complete coverage (100%) when all requirements are covered', () => {
      const questions: QuestionItem[] = [
        {
          id: 'q1',
          requirement_ids: ['r1', 'r2'],
          category: 'technical',
          prompt: 'P1',
          answer_outline: 'A1',
          difficulty: 2,
        },
        {
          id: 'q2',
          requirement_ids: ['r3'],
          category: 'system-design',
          prompt: 'P2',
          answer_outline: 'A2',
          difficulty: 3,
        },
        {
          id: 'q3',
          requirement_ids: ['r4', 'r5'],
          category: 'behavioural',
          prompt: 'P3',
          answer_outline: 'A3',
          difficulty: 1,
        },
      ];

      const result = computeRequirementCoverage(allReqs, questions);

      expect(result.coverage_percentage).toBe(100);
      expect(result.is_complete).toBe(true);
      expect(result.uncovered_requirement_ids).toHaveLength(0);
      expect(result.uncovered_must_have_ids).toHaveLength(0);
      expect(result.covered_requirement_ids).toEqual(['r1', 'r2', 'r3', 'r4', 'r5']);
    });

    it('accurately identifies one missing requirement', () => {
      // Covers r1, r2, r3, r4, but missing r5
      const questions: QuestionItem[] = [
        { id: 'q1', requirement_ids: ['r1', 'r2'], category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 2 },
        { id: 'q2', requirement_ids: ['r3', 'r4'], category: 'behavioural', prompt: 'P2', answer_outline: 'A2', difficulty: 1 },
      ];

      const result = computeRequirementCoverage(allReqs, questions);

      expect(result.covered_requirement_ids).toEqual(['r1', 'r2', 'r3', 'r4']);
      expect(result.uncovered_requirement_ids).toEqual(['r5']);
      expect(result.is_complete).toBe(false);
      expect(result.coverage_percentage).toBe(80); // 4 out of 5 = 80%
      expect(result.uncovered_nice_have_ids).toEqual(['r5']);
      expect(result.uncovered_must_have_ids).toHaveLength(0);
    });

    it('accurately identifies multiple missing requirements', () => {
      // Only covers r1
      const questions: QuestionItem[] = [
        { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 2 },
      ];

      const result = computeRequirementCoverage(allReqs, questions);

      expect(result.covered_requirement_ids).toEqual(['r1']);
      expect(result.uncovered_requirement_ids).toEqual(['r2', 'r3', 'r4', 'r5']);
      expect(result.is_complete).toBe(false);
      expect(result.coverage_percentage).toBe(20); // 1 out of 5 = 20%
      expect(result.uncovered_must_have_ids).toEqual(['r2', 'r3']);
      expect(result.uncovered_nice_have_ids).toEqual(['r4', 'r5']);
    });

    it('handles duplicate references without overcounting coverage', () => {
      // Multiple questions reference r1, and q1 references r1 twice in its array
      const questions: QuestionItem[] = [
        { id: 'q1', requirement_ids: ['r1', 'r1'], category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 1 },
        { id: 'q2', requirement_ids: ['r1'], category: 'technical', prompt: 'P2', answer_outline: 'A2', difficulty: 2 },
        { id: 'q3', requirement_ids: ['r1'], category: 'technical', prompt: 'P3', answer_outline: 'A3', difficulty: 3 },
      ];

      const result = computeRequirementCoverage(allReqs, questions);

      expect(result.covered_requirement_ids).toEqual(['r1']);
      expect(result.uncovered_requirement_ids).toEqual(['r2', 'r3', 'r4', 'r5']);
      expect(result.coverage_percentage).toBe(20);
    });

    it('validates references and discards invalid requirement IDs', () => {
      const questions: QuestionItem[] = [
        {
          id: 'q1',
          // 'r999_fake' and 'invalid_id' DO NOT exist in allReqs
          requirement_ids: ['r1', 'r999_fake', 'invalid_id'],
          category: 'technical',
          prompt: 'P1',
          answer_outline: 'A1',
          difficulty: 2,
        },
      ];

      const result = computeRequirementCoverage(allReqs, questions);

      // Only r1 is valid
      expect(result.covered_requirement_ids).toEqual(['r1']);
      expect(result.invalid_referenced_ids).toContain('r999_fake');
      expect(result.invalid_referenced_ids).toContain('invalid_id');
      expect(result.uncovered_requirement_ids).toEqual(['r2', 'r3', 'r4', 'r5']);
    });

    it('handles empty questions list (0% coverage)', () => {
      const result = computeRequirementCoverage(allReqs, []);

      expect(result.coverage_percentage).toBe(0);
      expect(result.is_complete).toBe(false);
      expect(result.covered_requirement_ids).toHaveLength(0);
      expect(result.uncovered_requirement_ids).toEqual(['r1', 'r2', 'r3', 'r4', 'r5']);
      expect(result.uncovered_must_have_ids).toEqual(['r1', 'r2', 'r3']);
      expect(result.uncovered_nice_have_ids).toEqual(['r4', 'r5']);
    });

    it('handles empty requirements list gracefully', () => {
      const result = computeRequirementCoverage([], []);

      expect(result.coverage_percentage).toBe(100);
      expect(result.is_complete).toBe(true);
      expect(result.covered_requirement_ids).toHaveLength(0);
      expect(result.uncovered_requirement_ids).toHaveLength(0);
    });

    it('never silently claims full coverage when uncovered requirements remain', () => {
      // Create 100 requirements where 99 are covered
      const largeReqs: RequirementItem[] = Array.from({ length: 100 }, (_, i) => ({
        id: `r_${i + 1}`,
        text: `Requirement ${i + 1}`,
        kind: 'technical',
        priority: 'must',
      }));

      // Cover 99 of 100 (which normally rounds to 99%)
      const coveredIds = largeReqs.slice(0, 99).map((r) => r.id);
      const questions: QuestionItem[] = [
        { id: 'q1', requirement_ids: coveredIds, category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 2 },
      ];

      const result = computeRequirementCoverage(largeReqs, questions);
      expect(result.uncovered_requirement_ids).toEqual(['r_100']);
      expect(result.coverage_percentage).toBeLessThan(100);
      expect(result.is_complete).toBe(false);
    });

    it('distinguishes between nice-to-have and must-have requirements', () => {
      // Cover only must-haves: r1, r2, r3
      const questions: QuestionItem[] = [
        { id: 'q1', requirement_ids: ['r1', 'r2', 'r3'], category: 'technical', prompt: 'P', answer_outline: 'A', difficulty: 2 },
      ];

      const result = computeRequirementCoverage(allReqs, questions);

      expect(result.uncovered_must_have_ids).toHaveLength(0); // All must-haves covered!
      expect(result.uncovered_nice_have_ids).toEqual(['r4', 'r5']); // Nice-to-haves remaining
      expect(result.is_complete).toBe(false); // Overall incomplete
      expect(result.coverage_percentage).toBe(60); // 3 of 5
    });
  });

  describe('2. Deterministic Second-Pass Coverage Resolution Loop', () => {
    it('stops at pass 1 if all requirements are already covered', async () => {
      const initialQuestions: QuestionItem[] = [
        { id: 'q1', requirement_ids: ['r1', 'r2', 'r3', 'r4', 'r5'], category: 'technical', prompt: 'P', answer_outline: 'A', difficulty: 2 },
      ];

      const mockGenerator = vi.fn();

      const loopResult = await runCoverageResolutionLoop(allReqs, initialQuestions, {
        maxPasses: 3,
        generateQuestions: mockGenerator,
      });

      expect(loopResult.passesCompleted).toBe(1);
      expect(loopResult.stopReason).toBe('all_covered');
      expect(loopResult.coverage.is_complete).toBe(true);
      expect(mockGenerator).not.toHaveBeenCalled();
    });

    it('generates questions specifically for uncovered requirements in pass 2 and achieves full coverage', async () => {
      // Pass 1 covers r1, r2, r3 (missing r4, r5)
      const initialQuestions: QuestionItem[] = [
        { id: 'q1', requirement_ids: ['r1', 'r2', 'r3'], category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 2 },
      ];

      const mockGenerator = vi.fn().mockImplementation(async (uncoveredReqs: RequirementItem[]) => {
        expect(uncoveredReqs.map((r) => r.id)).toEqual(['r4', 'r5']);
        return [
          {
            id: 'q_supp_1',
            requirement_ids: ['r4', 'r5'],
            category: 'behavioural',
            prompt: 'Explain your leadership experience in fintech.',
            answer_outline: 'Mentoring and compliance.',
            difficulty: 2,
          },
        ];
      });

      const loopResult = await runCoverageResolutionLoop(allReqs, initialQuestions, {
        maxPasses: 2,
        generateQuestions: mockGenerator,
      });

      expect(mockGenerator).toHaveBeenCalledTimes(1);
      expect(loopResult.passesCompleted).toBe(2);
      expect(loopResult.stopReason).toBe('all_covered');
      expect(loopResult.coverage.coverage_percentage).toBe(100);
      expect(loopResult.coverage.uncovered_requirement_ids).toHaveLength(0);
      expect(loopResult.questions).toHaveLength(2);
    });

    it('stops when all must-have requirements are covered if stopWhenMustCovered is enabled', async () => {
      // Initial: covers r1 (missing r2, r3 must-haves, and r4, r5 nice-to-haves)
      const initialQuestions: QuestionItem[] = [
        { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 2 },
      ];

      // Generator covers remaining must-haves (r2, r3) but NOT nice-to-haves
      const mockGenerator = vi.fn().mockResolvedValueOnce([
        {
          id: 'q_supp_1',
          requirement_ids: ['r2', 'r3'],
          category: 'technical',
          prompt: 'React and Redis questions.',
          answer_outline: 'Architecture details.',
          difficulty: 3,
        },
      ]);

      const loopResult = await runCoverageResolutionLoop(allReqs, initialQuestions, {
        maxPasses: 4,
        stopWhenMustCovered: true,
        generateQuestions: mockGenerator,
      });

      expect(loopResult.passesCompleted).toBe(2);
      expect(loopResult.stopReason).toBe('must_covered');
      expect(loopResult.coverage.uncovered_must_have_ids).toHaveLength(0);
      expect(loopResult.coverage.uncovered_nice_have_ids).toEqual(['r4', 'r5']);
      expect(loopResult.coverage.coverage_percentage).toBe(60);
    });

    it('stops when maximum configured passes is reached without infinite looping', async () => {
      // Initial: covers r1
      const initialQuestions: QuestionItem[] = [
        { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 2 },
      ];

      // Generator repeatedly only covers r2 on each pass, never covering r3, r4, r5
      const mockGenerator = vi.fn().mockResolvedValue([
        {
          id: 'q_supp',
          requirement_ids: ['r2'],
          category: 'technical',
          prompt: 'React question.',
          answer_outline: 'Architecture.',
          difficulty: 2,
        },
      ]);

      const maxPasses = 3;
      const loopResult = await runCoverageResolutionLoop(allReqs, initialQuestions, {
        maxPasses,
        stopWhenMustCovered: false,
        generateQuestions: mockGenerator,
      });

      expect(loopResult.passesCompleted).toBe(maxPasses);
      expect(loopResult.stopReason).toBe('max_passes_reached');
      expect(loopResult.coverage.uncovered_requirement_ids).toEqual(['r3', 'r4', 'r5']);
      expect(loopResult.coverage.coverage_percentage).toBeLessThan(100);
      // Confirms the kit never silently claims 100% when uncovered items remain
      expect(loopResult.coverage.coverage_percentage).not.toBe(100);
    });

    it('validates generated questions and strips invalid requirement references', async () => {
      const initialQuestions: QuestionItem[] = [
        { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 2 },
      ];

      const mockGenerator = vi.fn().mockResolvedValueOnce([
        {
          id: 'q_supp',
          // 'r2' is valid, but 'hallucinated_req' is fake
          requirement_ids: ['r2', 'hallucinated_req'],
          category: 'technical',
          prompt: 'React question.',
          answer_outline: 'React state.',
          difficulty: 2,
        },
      ]);

      const loopResult = await runCoverageResolutionLoop(allReqs, initialQuestions, {
        maxPasses: 2,
        generateQuestions: mockGenerator,
      });

      const addedQ = loopResult.questions.find((q) => q.id === 'q_supp');
      expect(addedQ).toBeDefined();
      expect(addedQ?.requirement_ids).toEqual(['r2']);
      expect(addedQ?.requirement_ids).not.toContain('hallucinated_req');
    });
  });
});
