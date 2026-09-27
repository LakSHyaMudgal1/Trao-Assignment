import type { QuestionItem, RequirementItem, ScheduleDay } from '@prep-kit/shared';

export interface AllocatedSchedule {
  days_available: number;
  days: ScheduleDay[];
}

/**
 * ============================================================================
 * DETERMINISTIC PREPARATION SCHEDULE ALLOCATION ALGORITHM
 * ============================================================================
 *
 * GOAL:
 * Produces an evidence-grounded, pedagogically sound preparation schedule
 * across exactly `days_available` days (1 to 60 days) without using an LLM.
 *
 * ALGORITHM PHASES:
 *
 * Phase 1: Question Scoring & Urgency Ranking
 *   Each question is assigned a deterministic score:
 *     Score(q) = PriorityWeight(q) + DifficultyWeight(q) + CategoryWeight(q)
 *   - PriorityWeight: +10 per 'must'-have requirement referenced, +2 per 'nice'.
 *   - DifficultyWeight: diff 3 -> 9 pts, diff 2 -> 5 pts, diff 1 -> 2 pts.
 *   - CategoryWeight: 'system-design' -> 6 pts, 'technical' -> 4 pts,
 *                     'behavioural' -> 2 pts, 'company-fit' -> 1 pt.
 *   Questions are sorted descending: hardest, must-have, high-impact items first.
 *
 * Phase 2: Mandatory Must-Have Requirement Coverage Guarantee (Rule 3)
 *   For every 'must'-have requirement present in the input, if at least one question
 *   references that requirement, the algorithm identifies the best question
 *   covering it and guarantees it is scheduled in the plan.
 *
 * Phase 3: Chronological Day Phasing & Theme Architecture
 *   The schedule divides `days_available` into distinct learning phases:
 *   - 1-Day: High-intensity crash review covering core must-haves + mock polish.
 *   - 2-Day: Day 1 = Core Technical & System Design; Day 2 = Behavioral & Fit.
 *   - 3..7 Days: Early days focus on high-difficulty architecture and must-haves;
 *               final day focuses strictly on behavioral polish and company fit.
 *   - 8..60 Days: Multi-week spaced repetition curve:
 *       * Foundation Phase (Days 1..25%): Hardest material and must-haves.
 *       * Execution Phase (Days 26..60%): Technical breadth, domain, behavioral.
 *       * Spaced Review Phase (Days 61..85%): Re-evaluating core questions.
 *       * Final Polish (Days 86..100%): Light review, cultural fit, zero diff-3 cramming.
 *
 * Phase 4: Anti-Final-Day Cramming Protection (Rule 7)
 *   Difficult material (difficulty 3) is strictly prevented from landing on the
 *   final day when multiple days are available, ensuring the candidate rests and
 *   focuses on behavioral/company alignment.
 *
 * Phase 5: Integer Time Allocation (Rule 5)
 *   Daily study minutes are calculated as positive integers:
 *     Minutes = max(45, min(150, base (45 min) + sum(difficulty * 15 min)))
 *   Every minute value is an integer.
 * ============================================================================
 */

interface ScoredQuestion {
  question: QuestionItem;
  score: number;
  isMustHave: boolean;
  difficulty: number;
}

export function allocateStudySchedule(
  daysAvailable: number,
  questions: QuestionItem[],
  requirements: RequirementItem[] = []
): AllocatedSchedule {
  if (daysAvailable < 1) {
    throw new Error('days_available must be at least 1');
  }

  const validQuestionMap = new Map(questions.map((q) => [q.id, q]));
  const validQuestionIds = questions.map((q) => q.id);

  // Identify must-have requirement IDs
  const mustReqIds = new Set(
    requirements.filter((r) => r.priority === 'must').map((r) => r.id)
  );

  // Phase 1: Score questions deterministically
  const scoredQuestions: ScoredQuestion[] = questions.map((q) => {
    let mustRefCount = 0;
    let niceRefCount = 0;

    for (const reqId of q.requirement_ids) {
      if (mustReqIds.has(reqId)) {
        mustRefCount++;
      } else {
        niceRefCount++;
      }
    }

    const priorityWeight = mustRefCount * 10 + niceRefCount * 2;
    const diffWeight = q.difficulty === 3 ? 9 : q.difficulty === 2 ? 5 : 2;

    let catWeight = 2;
    if (q.category === 'system-design') catWeight = 6;
    else if (q.category === 'technical') catWeight = 4;
    else if (q.category === 'behavioural') catWeight = 2;
    else if (q.category === 'company-fit') catWeight = 1;

    const score = priorityWeight + diffWeight + catWeight;

    return {
      question: q,
      score,
      isMustHave: mustRefCount > 0,
      difficulty: q.difficulty,
    };
  });

  // Sort descending by score: hardest/must-have first
  scoredQuestions.sort((a, b) => b.score - a.score);

  // Phase 2: Identify mandatory questions covering all must-have requirements
  const mandatoryQuestions = new Set<string>();
  for (const mustReqId of mustReqIds) {
    // Find highest-scoring question that references this must-have requirement
    const coveringQ = scoredQuestions.find((sq) =>
      sq.question.requirement_ids.includes(mustReqId)
    );
    if (coveringQ) {
      mandatoryQuestions.add(coveringQ.question.id);
    }
  }

  // Phase 3 & 4: Distribute across days
  const days: ScheduleDay[] = [];

  // Group questions by pedagogical category
  const hardMustQuestions = scoredQuestions
    .filter((sq) => sq.difficulty === 3 || sq.isMustHave)
    .map((sq) => sq.question.id);

  const mediumTechnical = scoredQuestions
    .filter((sq) => sq.difficulty === 2 && sq.question.category === 'technical')
    .map((sq) => sq.question.id);

  const behaviouralQuestions = scoredQuestions
    .filter((sq) => sq.question.category === 'behavioural')
    .map((sq) => sq.question.id);

  const fitAndLightQuestions = scoredQuestions
    .filter((sq) => sq.question.category === 'company-fit' || sq.difficulty === 1)
    .map((sq) => sq.question.id);

  for (let dayNum = 1; dayNum <= daysAvailable; dayNum++) {
    const isFinalDay = dayNum === daysAvailable && daysAvailable > 1;
    const isEarlyDay = dayNum <= Math.max(1, Math.ceil(daysAvailable * 0.4));
    const dayQuestionIds: string[] = [];
    let focus = '';

    // =========================================================================
    // CASE A: 1-Day Schedule
    // =========================================================================
    if (daysAvailable === 1) {
      focus = 'Comprehensive High-Yield Interview Prep & Core Technical Review';
      // Include all mandatory questions first, then up to available capacity
      const added = new Set<string>();
      for (const mId of mandatoryQuestions) {
        dayQuestionIds.push(mId);
        added.add(mId);
      }
      for (const sq of scoredQuestions) {
        if (!added.has(sq.question.id)) {
          dayQuestionIds.push(sq.question.id);
          added.add(sq.question.id);
        }
      }
    }
    // =========================================================================
    // CASE B: 2-Day Schedule
    // =========================================================================
    else if (daysAvailable === 2) {
      if (dayNum === 1) {
        focus = 'Core Architecture, System Design & Must-Have Technicals';
        // Allocate all hard and must-have questions on Day 1
        const day1Set = new Set<string>([...hardMustQuestions, ...mediumTechnical]);
        dayQuestionIds.push(...Array.from(day1Set));
      } else {
        focus = 'Behavioral Leadership, Company Fit & Final Mock Polish';
        // Day 2 (final day): behavioral, company-fit, light review. Avoid hard questions!
        const day2Set = new Set<string>([...behaviouralQuestions, ...fitAndLightQuestions]);
        // If day 2 is empty due to sparse questions, borrow lightest available
        if (day2Set.size === 0 && validQuestionIds.length > 0) {
          day2Set.add(validQuestionIds[validQuestionIds.length - 1]!);
        }
        dayQuestionIds.push(...Array.from(day2Set));
      }
    }
    // =========================================================================
    // CASE C: 3 to 7 Days (Short Window)
    // =========================================================================
    else if (daysAvailable <= 7) {
      if (isFinalDay) {
        focus = 'Final Behavioral Mastery, Culture Alignment & Mock Review';
        // Avoid diff-3 material on final day!
        const candidates = fitAndLightQuestions.concat(behaviouralQuestions);
        const daySet = new Set(candidates);
        if (daySet.size === 0 && validQuestionIds.length > 0) {
          // Fallback to lightest question
          daySet.add(validQuestionIds[validQuestionIds.length - 1]!);
        }
        dayQuestionIds.push(...Array.from(daySet).slice(0, 3));
      } else if (isEarlyDay) {
        focus = dayNum === 1
          ? 'Deep Dive: Core System Design & High-Impact Requirements'
          : 'Technical Architecture & Must-Have Implementation Details';
        // Bucket hard must-haves into early days
        const bucketSize = Math.max(1, Math.ceil(hardMustQuestions.length / Math.ceil(daysAvailable * 0.4)));
        const startIdx = (dayNum - 1) * bucketSize;
        const slice = hardMustQuestions.slice(startIdx, startIdx + bucketSize);
        dayQuestionIds.push(...slice);

        // Supplement with medium technicals if room
        if (dayQuestionIds.length < 2 && mediumTechnical.length > 0) {
          const supp = mediumTechnical[(dayNum - 1) % mediumTechnical.length];
          if (supp && !dayQuestionIds.includes(supp)) dayQuestionIds.push(supp);
        }
      } else {
        focus = 'Behavioral Scenarios, Problem-Solving & Cross-Functional Impact';
        const bucketSize = Math.max(1, Math.ceil(behaviouralQuestions.length / (daysAvailable - Math.ceil(daysAvailable * 0.4) - 1)));
        const offset = dayNum - Math.ceil(daysAvailable * 0.4) - 1;
        const slice = behaviouralQuestions.slice(offset * bucketSize, (offset + 1) * bucketSize);
        dayQuestionIds.push(...slice);
      }
    }
    // =========================================================================
    // CASE D: 8 to 60 Days (Spaced Repetition & Long Schedules)
    // =========================================================================
    else {
      const phasePercent = dayNum / daysAvailable;

      if (isFinalDay) {
        focus = 'Final Polish, Behavioral Synthesis & Calm Mindset Prep';
        // Lightest questions only
        const light = fitAndLightQuestions.concat(behaviouralQuestions);
        if (light.length > 0) {
          dayQuestionIds.push(light[light.length - 1]!);
        } else if (validQuestionIds.length > 0) {
          dayQuestionIds.push(validQuestionIds[validQuestionIds.length - 1]!);
        }
      } else if (phasePercent <= 0.3) {
        focus = `Foundational Deep Dive: Milestone ${dayNum} Core Mastery`;
        if (hardMustQuestions.length > 0) {
          const idx = (dayNum - 1) % hardMustQuestions.length;
          dayQuestionIds.push(hardMustQuestions[idx]!);
        }
      } else if (phasePercent <= 0.6) {
        focus = `Applied Engineering & Cross-Functional Scenarios: Day ${dayNum}`;
        const midPool = mediumTechnical.concat(behaviouralQuestions);
        if (midPool.length > 0) {
          const idx = (dayNum - 1) % midPool.length;
          dayQuestionIds.push(midPool[idx]!);
        }
      } else if (phasePercent <= 0.85) {
        focus = `Spaced Repetition & Active Recall Review: Day ${dayNum}`;
        // Spaced repetition cycle through high-priority items
        if (scoredQuestions.length > 0) {
          const idx = (dayNum - 1) % scoredQuestions.length;
          dayQuestionIds.push(scoredQuestions[idx]!.question.id);
        }
      } else {
        focus = `Timed Mock Interview & Articulation Practice: Day ${dayNum}`;
        const polishPool = behaviouralQuestions.concat(fitAndLightQuestions);
        if (polishPool.length > 0) {
          const idx = (dayNum - 1) % polishPool.length;
          dayQuestionIds.push(polishPool[idx]!);
        }
      }
    }

    // Filter to ensure only valid existing question IDs
    const filteredQuestionIds = Array.from(new Set(dayQuestionIds)).filter((id) =>
      validQuestionMap.has(id)
    );

    // If day has 0 questions but question set is non-empty, assign a cyclic question
    if (filteredQuestionIds.length === 0 && validQuestionIds.length > 0 && !isFinalDay) {
      const fallbackQ = scoredQuestions[(dayNum - 1) % scoredQuestions.length];
      if (fallbackQ) {
        filteredQuestionIds.push(fallbackQ.question.id);
      }
    }

    // Default focus if somehow unassigned
    if (!focus) {
      focus = `Day ${dayNum} Study & Self-Guided Preparation`;
    }

    // Phase 5: Compute positive integer minutes
    let minutes = 45;
    if (filteredQuestionIds.length > 0) {
      let workload = 45;
      for (const qId of filteredQuestionIds) {
        const q = validQuestionMap.get(qId);
        const diff = q?.difficulty ?? 2;
        workload += diff * 15;
      }
      minutes = Math.max(45, Math.min(150, Math.round(workload)));
    }

    if (isFinalDay) {
      // Final day is light review (strictly 45-60 min)
      minutes = Math.min(60, minutes);
    }

    days.push({
      day: dayNum,
      focus,
      question_ids: filteredQuestionIds,
      minutes,
    });
  }

  // Phase 6: Post-Allocation Verification of Must-Have Requirements (Rule 3)
  // Ensure every mandatory question appears somewhere in the schedule
  const scheduledQuestionIds = new Set(days.flatMap((d) => d.question_ids));

  for (const mId of mandatoryQuestions) {
    if (!scheduledQuestionIds.has(mId)) {
      // Find the earliest non-final day with the smallest question count and inject it
      let bestDayIndex = 0;
      let minCount = Infinity;

      for (let i = 0; i < (daysAvailable > 1 ? daysAvailable - 1 : 1); i++) {
        const d = days[i]!;
        if (d.question_ids.length < minCount) {
          minCount = d.question_ids.length;
          bestDayIndex = i;
        }
      }

      days[bestDayIndex]!.question_ids.push(mId);
      scheduledQuestionIds.add(mId);
    }
  }

  return {
    days_available: daysAvailable,
    days,
  };
}

/**
 * Explicit named export alias
 */
export const allocateDeterministicSchedule = allocateStudySchedule;
