import { describe, it, expect } from 'vitest';
import {
  allocateStudySchedule,
  allocateDeterministicSchedule,
} from '../src/core/scheduling/schedule-allocator.js';
import { ScheduleDaySchema, type QuestionItem, type RequirementItem } from '@prep-kit/shared';

describe('Deterministic Schedule Allocator Suite', () => {
  const reqMust1: RequirementItem = {
    id: 'r_must_1',
    text: 'Core Distributed Systems Architecture',
    kind: 'technical',
    priority: 'must',
  };
  const reqMust2: RequirementItem = {
    id: 'r_must_2',
    text: 'PostgreSQL performance and indexing',
    kind: 'technical',
    priority: 'must',
  };
  const reqNice1: RequirementItem = {
    id: 'r_nice_1',
    text: 'Docker containerization',
    kind: 'technical',
    priority: 'nice',
  };
  const reqNice2: RequirementItem = {
    id: 'r_nice_2',
    text: 'Mentorship and leadership',
    kind: 'behavioural',
    priority: 'nice',
  };

  const sampleRequirements = [reqMust1, reqMust2, reqNice1, reqNice2];

  const qHardMust: QuestionItem = {
    id: 'q_hard_must',
    requirement_ids: ['r_must_1'],
    category: 'system-design',
    prompt: 'Design a distributed consensus mechanism with Raft.',
    answer_outline: 'Leader election, log replication, safety.',
    difficulty: 3,
  };

  const qMediumMust: QuestionItem = {
    id: 'q_medium_must',
    requirement_ids: ['r_must_2'],
    category: 'technical',
    prompt: 'How do you optimize B-Tree indexes and analyze query plans in PostgreSQL?',
    answer_outline: 'EXPLAIN ANALYZE, index bloat, vacuuming.',
    difficulty: 2,
  };

  const qMediumNice: QuestionItem = {
    id: 'q_medium_nice',
    requirement_ids: ['r_nice_1'],
    category: 'technical',
    prompt: 'How do you structure multi-stage Docker builds?',
    answer_outline: 'Layer caching, minimal base images, security scanning.',
    difficulty: 2,
  };

  const qEasyNice: QuestionItem = {
    id: 'q_easy_nice',
    requirement_ids: ['r_nice_2'],
    category: 'behavioural',
    prompt: 'Tell me about how you onboard and mentor a junior engineer.',
    answer_outline: 'Patience, clear milestones, active listening.',
    difficulty: 1,
  };

  const qCompanyFit: QuestionItem = {
    id: 'q_fit',
    requirement_ids: ['r_must_1'],
    category: 'company-fit',
    prompt: 'Why are you passionate about building economic infrastructure?',
    answer_outline: 'Mission alignment, engineering excellence, customer empathy.',
    difficulty: 1,
  };

  const fullQuestionSet = [qHardMust, qMediumMust, qMediumNice, qEasyNice, qCompanyFit];

  describe('1. Day Count and Schema Integrity', () => {
    it('produces exactly 1 day when days_available = 1', () => {
      const schedule = allocateStudySchedule(1, fullQuestionSet, sampleRequirements);

      expect(schedule.days_available).toBe(1);
      expect(schedule.days).toHaveLength(1);

      const day1 = schedule.days[0]!;
      expect(day1.day).toBe(1);
      expect(day1.focus).toBeTruthy();
      expect(Number.isInteger(day1.minutes)).toBe(true);
      expect(day1.minutes).toBeGreaterThan(0);
      ScheduleDaySchema.parse(day1);
    });

    it('produces exactly 2 days when days_available = 2', () => {
      const schedule = allocateStudySchedule(2, fullQuestionSet, sampleRequirements);

      expect(schedule.days_available).toBe(2);
      expect(schedule.days).toHaveLength(2);
      expect(schedule.days[0]?.day).toBe(1);
      expect(schedule.days[1]?.day).toBe(2);

      schedule.days.forEach((d) => {
        expect(Number.isInteger(d.minutes)).toBe(true);
        expect(d.minutes).toBeGreaterThan(0);
        ScheduleDaySchema.parse(d);
      });
    });

    it('produces exactly 5 days when days_available = 5', () => {
      const schedule = allocateStudySchedule(5, fullQuestionSet, sampleRequirements);

      expect(schedule.days_available).toBe(5);
      expect(schedule.days).toHaveLength(5);

      schedule.days.forEach((d, idx) => {
        expect(d.day).toBe(idx + 1);
        expect(Number.isInteger(d.minutes)).toBe(true);
        ScheduleDaySchema.parse(d);
      });
    });

    it('produces exactly 60 days when days_available = 60', () => {
      const schedule = allocateStudySchedule(60, fullQuestionSet, sampleRequirements);

      expect(schedule.days_available).toBe(60);
      expect(schedule.days).toHaveLength(60);

      schedule.days.forEach((d, idx) => {
        expect(d.day).toBe(idx + 1);
        expect(Number.isInteger(d.minutes)).toBe(true);
        expect(d.minutes).toBeGreaterThan(0);
        ScheduleDaySchema.parse(d);
      });
    });

    it('rejects days_available < 1', () => {
      expect(() => allocateStudySchedule(0, fullQuestionSet, sampleRequirements)).toThrow(
        'days_available must be at least 1'
      );
      expect(() => allocateStudySchedule(-5, fullQuestionSet, sampleRequirements)).toThrow(
        'days_available must be at least 1'
      );
    });
  });

  describe('2. Must-Have Requirement Representation (Rule 3)', () => {
    it('ensures every must-have requirement appears somewhere in the schedule', () => {
      const schedule = allocateStudySchedule(4, fullQuestionSet, sampleRequirements);
      const allScheduledQuestionIds = new Set(schedule.days.flatMap((d) => d.question_ids));

      // r_must_1 is referenced by q_hard_must
      // r_must_2 is referenced by q_medium_must
      expect(
        allScheduledQuestionIds.has('q_hard_must') || allScheduledQuestionIds.has('q_fit')
      ).toBe(true);
      expect(allScheduledQuestionIds.has('q_medium_must')).toBe(true);
    });

    it('prioritizes must-have questions even in short schedules', () => {
      const schedule = allocateStudySchedule(1, fullQuestionSet, sampleRequirements);
      const day1Questions = schedule.days[0]?.question_ids || [];

      // Must have questions must be present
      expect(day1Questions).toContain('q_hard_must');
      expect(day1Questions).toContain('q_medium_must');
    });
  });

  describe('3. Chronological Phasing & Anti-Final-Day Cramming (Rules 4 & 7)', () => {
    it('allocates harder/high-priority material earlier in multi-day schedules', () => {
      const schedule = allocateStudySchedule(5, fullQuestionSet, sampleRequirements);

      // Early days (Day 1, Day 2) must contain difficulty 3 / high-priority must question
      const earlyDaysQuestions = [
        ...schedule.days[0]!.question_ids,
        ...schedule.days[1]!.question_ids,
      ];
      expect(earlyDaysQuestions).toContain('q_hard_must');
    });

    it('avoids putting difficulty 3 material on the final day', () => {
      const schedule = allocateStudySchedule(5, fullQuestionSet, sampleRequirements);
      const finalDay = schedule.days[4]!;

      // Final day should NOT contain difficulty 3 question
      expect(finalDay.question_ids).not.toContain('q_hard_must');

      // Final day should focus on behavioral or light review
      expect(finalDay.focus).toMatch(/behavioral|culture|polish|mock|review/i);
    });

    it('allocates Day 1 for core tech/system-design and Day 2 for behavioral/fit in a 2-day schedule', () => {
      const schedule = allocateStudySchedule(2, fullQuestionSet, sampleRequirements);
      const day1 = schedule.days[0]!;
      const day2 = schedule.days[1]!;

      // Day 1 contains hard must-have
      expect(day1.question_ids).toContain('q_hard_must');
      expect(day1.question_ids).not.toContain('q_easy_nice');

      // Day 2 (final day) does NOT contain hard must-have
      expect(day2.question_ids).not.toContain('q_hard_must');
      expect(day2.focus).toMatch(/behavioral|fit|review/i);
    });
  });

  describe('4. Question Reference Validity (Rule 6)', () => {
    it('ensures every question_id references an existing question', () => {
      const validIds = new Set(fullQuestionSet.map((q) => q.id));
      const schedule = allocateStudySchedule(7, fullQuestionSet, sampleRequirements);

      for (const day of schedule.days) {
        for (const qId of day.question_ids) {
          expect(validIds.has(qId)).toBe(true);
        }
      }
    });
  });

  describe('5. Sparse Question Sets & Edge Cases (Rules 8, 9, 10)', () => {
    it('handles zero questions gracefully across all days', () => {
      const schedule = allocateStudySchedule(3, [], sampleRequirements);

      expect(schedule.days_available).toBe(3);
      expect(schedule.days).toHaveLength(3);

      for (const day of schedule.days) {
        expect(day.question_ids).toHaveLength(0);
        expect(Number.isInteger(day.minutes)).toBe(true);
        expect(day.minutes).toBeGreaterThan(0);
        expect(day.focus).toBeTruthy();
        ScheduleDaySchema.parse(day);
      }
    });

    it('handles a single question distributed across 5 days', () => {
      const singleQuestion = [qMediumMust];
      const schedule = allocateStudySchedule(5, singleQuestion, [reqMust2]);

      expect(schedule.days).toHaveLength(5);

      // Question is referenced and no invalid IDs exist
      const allIds = schedule.days.flatMap((d) => d.question_ids);
      expect(allIds.length).toBeGreaterThan(0);
      expect(allIds.every((id) => id === 'q_medium_must')).toBe(true);

      for (const day of schedule.days) {
        expect(Number.isInteger(day.minutes)).toBe(true);
        ScheduleDaySchema.parse(day);
      }
    });

    it('handles 2 questions distributed across 60 days via spaced repetition', () => {
      const sparseQuestions = [qHardMust, qEasyNice];
      const schedule = allocateStudySchedule(60, sparseQuestions, sampleRequirements);

      expect(schedule.days).toHaveLength(60);

      const validIds = new Set(['q_hard_must', 'q_easy_nice']);

      for (const day of schedule.days) {
        expect(Number.isInteger(day.minutes)).toBe(true);
        expect(day.minutes).toBeGreaterThanOrEqual(45);
        expect(day.minutes).toBeLessThanOrEqual(150);

        for (const qId of day.question_ids) {
          expect(validIds.has(qId)).toBe(true);
        }

        ScheduleDaySchema.parse(day);
      }
    });

    it('works identically via allocateDeterministicSchedule alias', () => {
      const schedule = allocateDeterministicSchedule(3, fullQuestionSet, sampleRequirements);
      expect(schedule.days).toHaveLength(3);
    });
  });

  describe('6. Integer Minutes Guarantee (Rule 5)', () => {
    it('guarantees all daily minutes are strictly integers without floating point values', () => {
      for (const days of [1, 2, 3, 7, 14, 30, 60]) {
        const schedule = allocateStudySchedule(days, fullQuestionSet, sampleRequirements);
        for (const day of schedule.days) {
          expect(Number.isInteger(day.minutes)).toBe(true);
          expect(day.minutes).toBeGreaterThan(0);
          expect(day.minutes % 1).toBe(0);
        }
      }
    });
  });

  describe('7. Explicit Specification Requirements Verification', () => {
    it('verifies exact day count matches days_available for 1, 2, 5, 14, 30, 60 days', () => {
      for (const count of [1, 2, 5, 14, 30, 60]) {
        const schedule = allocateStudySchedule(count, fullQuestionSet, sampleRequirements);
        expect(schedule.days_available).toBe(count);
        expect(schedule.days).toHaveLength(count);
        expect(schedule.days.map((d) => d.day)).toEqual(
          Array.from({ length: count }, (_, i) => i + 1)
        );
      }
    });

    it('verifies mixed difficulties: harder (diff 3) questions are scheduled earlier than easier (diff 1) questions', () => {
      const schedule = allocateStudySchedule(5, fullQuestionSet, sampleRequirements);
      
      // Find the first day qHardMust appears
      const hardDay = schedule.days.findIndex((d) => d.question_ids.includes('q_hard_must')) + 1;
      // Find the first day qEasyNice appears
      const easyDay = schedule.days.findIndex((d) => d.question_ids.includes('q_easy_nice')) + 1;

      expect(hardDay).toBeGreaterThan(0);
      expect(easyDay).toBeGreaterThan(0);
      expect(hardDay).toBeLessThan(easyDay);
    });

    it('verifies mixed must/nice requirements: must-haves receive priority over nice-to-haves', () => {
      // Create a 2-day schedule
      const schedule = allocateStudySchedule(2, fullQuestionSet, sampleRequirements);
      
      // All must-have covering questions must be present
      const scheduledIds = new Set(schedule.days.flatMap((d) => d.question_ids));
      expect(scheduledIds.has('q_hard_must') || scheduledIds.has('q_fit')).toBe(true);
      expect(scheduledIds.has('q_medium_must')).toBe(true);

      // Must-have questions appear on day 1
      expect(schedule.days[0]!.question_ids).toContain('q_hard_must');
      expect(schedule.days[0]!.question_ids).toContain('q_medium_must');
    });

    it('verifies all must requirements represented when covering questions exist', () => {
      // 3 must-have requirements
      const reqM1: RequirementItem = { id: 'rm1', text: 'Distributed consensus', kind: 'technical', priority: 'must' };
      const reqM2: RequirementItem = { id: 'rm2', text: 'SQL optimization', kind: 'technical', priority: 'must' };
      const reqM3: RequirementItem = { id: 'rm3', text: 'Incident triage', kind: 'technical', priority: 'must' };
      const reqN1: RequirementItem = { id: 'rn1', text: 'GraphQL basics', kind: 'technical', priority: 'nice' };

      const q1: QuestionItem = { id: 'q1', requirement_ids: ['rm1'], category: 'system-design', prompt: 'P1', answer_outline: 'A1', difficulty: 3 };
      const q2: QuestionItem = { id: 'q2', requirement_ids: ['rm2'], category: 'technical', prompt: 'P2', answer_outline: 'A2', difficulty: 2 };
      const q3: QuestionItem = { id: 'q3', requirement_ids: ['rm3'], category: 'technical', prompt: 'P3', answer_outline: 'A3', difficulty: 2 };
      const q4: QuestionItem = { id: 'q4', requirement_ids: ['rn1'], category: 'technical', prompt: 'P4', answer_outline: 'A4', difficulty: 1 };

      const schedule = allocateStudySchedule(5, [q1, q2, q3, q4], [reqM1, reqM2, reqM3, reqN1]);
      const scheduledIds = new Set(schedule.days.flatMap((d) => d.question_ids));

      // Each question covering a must requirement MUST appear
      expect(scheduledIds.has('q1')).toBe(true);
      expect(scheduledIds.has('q2')).toBe(true);
      expect(scheduledIds.has('q3')).toBe(true);
    });
  });
});
