import type { QuestionItem, RequirementItem, QuestionCategoryEnum } from '@prep-kit/shared';
import { generateQuestionId } from '@prep-kit/shared';
import { z } from 'zod';
import { LlmClient, defaultLlmClient } from './llm-client.js';
import { isolateUntrustedRequirements, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from './prompt-isolation.js';

type QuestionCategory = z.infer<typeof QuestionCategoryEnum>;

export class UncoveredQuestionGenerator {
  constructor(private llmClient: LlmClient = defaultLlmClient) {}

  public async generateQuestionsForUncovered(
    uncoveredRequirements: RequirementItem[],
    companyName: string,
    existingQuestionIds: string[] = []
  ): Promise<QuestionItem[]> {
    if (uncoveredRequirements.length === 0) {
      return [];
    }

    if (this.llmClient.isAvailable()) {
      try {
        return await this.generateWithLlm(uncoveredRequirements, companyName, existingQuestionIds);
      } catch (err) {
        console.warn('[UncoveredQuestionGenerator] LLM failed, using deterministic generation:', err);
      }
    }

    return this.generateDeterministic(uncoveredRequirements, companyName, existingQuestionIds);
  }

  private async generateWithLlm(
    uncoveredReqs: RequirementItem[],
    companyName: string,
    existingQuestionIds: string[]
  ): Promise<QuestionItem[]> {
    const validReqIds = uncoveredReqs.map((r) => r.id);
    const reqListStr = uncoveredReqs.map((r) => `[${r.id}] (${r.kind}, ${r.priority}): ${r.text}`).join('\n');

    const prompt = `
${PROMPT_INJECTION_DEFENSE_DIRECTIVE}

The following requirements currently have NO interview questions covering them.
Generate targeted interview questions specifically addressing each of these uncovered requirements at ${companyName}.

Requirements to cover:
${isolateUntrustedRequirements(reqListStr)}

Rules:
1. Every question MUST reference at least one ID from: ${JSON.stringify(validReqIds)}
2. Make sure EVERY uncovered requirement ID is referenced by at least one generated question.
3. Category must be one of: "technical", "behavioural", "system-design", "company-fit".
4. "difficulty": integer 1, 2, or 3.
5. "answer_outline": practical evaluation rubric.

Return valid JSON:
{
  "questions": [
    {
      "requirement_ids": string[],
      "category": "technical" | "behavioural" | "system-design" | "company-fit",
      "prompt": string,
      "answer_outline": string,
      "difficulty": 1 | 2 | 3
    }
  ]
}
`;

    interface LlmRawQuestion {
      requirement_ids?: string[];
      category?: QuestionCategory;
      prompt?: string;
      answer_outline?: string;
      difficulty?: number;
    }

    const raw = await this.llmClient.generateJson<{ questions?: LlmRawQuestion[] }>(prompt);
    const candidateQs = Array.isArray(raw.questions) ? raw.questions : [];
    const validReqSet = new Set(validReqIds);
    const supplemental: QuestionItem[] = [];

    candidateQs.forEach((q, idx) => {
      const promptText = q.prompt?.trim();
      const outline = q.answer_outline?.trim();
      const rawCat = q.category;
      const category: QuestionCategory =
        rawCat && ['technical', 'behavioural', 'system-design', 'company-fit'].includes(rawCat)
          ? rawCat
          : 'technical';

      const filteredReqIds = (q.requirement_ids || []).filter((id) => validReqSet.has(id));
      if (filteredReqIds.length === 0 && validReqIds.length > 0) {
        filteredReqIds.push(validReqIds[idx % validReqIds.length]!);
      }

      const difficulty = typeof q.difficulty === 'number' && q.difficulty >= 1 && q.difficulty <= 3
        ? Math.round(q.difficulty)
        : 2;

      if (promptText && outline && filteredReqIds.length > 0) {
        supplemental.push({
          id: generateQuestionId([...existingQuestionIds, ...supplemental.map((x) => x.id)]),
          requirement_ids: filteredReqIds,
          category,
          prompt: promptText,
          answer_outline: outline,
          difficulty,
        });
      }
    });

    if (supplemental.length === 0) {
      return this.generateDeterministic(uncoveredReqs, companyName, existingQuestionIds);
    }

    return supplemental;
  }

  public generateDeterministic(
    uncoveredReqs: RequirementItem[],
    companyName: string,
    existingQuestionIds: string[]
  ): QuestionItem[] {
    const questions: QuestionItem[] = [];

    uncoveredReqs.forEach((req) => {
      let category: QuestionCategory = 'technical';
      if (req.kind === 'behavioural') category = 'behavioural';
      else if (req.kind === 'domain') category = 'company-fit';

      questions.push({
        id: generateQuestionId([...existingQuestionIds, ...questions.map((x) => x.id)]),
        requirement_ids: [req.id],
        category,
        prompt: `How have you demonstrated hands-on capability in ${req.text}, and how would you apply that at ${companyName}?`,
        answer_outline: `Look for practical, battle-tested experience with ${req.text}, clear articulation of trade-offs, and alignment with high engineering standards.`,
        difficulty: 2,
      });
    });

    return questions;
  }
}

export const defaultUncoveredQuestionGenerator = new UncoveredQuestionGenerator();
