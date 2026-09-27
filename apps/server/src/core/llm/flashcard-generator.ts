import type { FlashcardItem, RequirementItem } from '@prep-kit/shared';
import { generateFlashcardId } from '@prep-kit/shared';
import { LlmClient, defaultLlmClient } from './llm-client.js';
import { isolateUntrustedRequirements, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from './prompt-isolation.js';

export class FlashcardGenerator {
  constructor(private llmClient: LlmClient = defaultLlmClient) {}

  public async generateFlashcards(
    requirements: RequirementItem[],
    companyName: string
  ): Promise<FlashcardItem[]> {
    if (this.llmClient.isAvailable() && requirements.length > 0) {
      try {
        return await this.generateWithLlm(requirements, companyName);
      } catch (err) {
        console.warn('[FlashcardGenerator] LLM flashcard generation failed, falling back to deterministic:', err);
      }
    }

    return this.generateDeterministic(requirements, companyName);
  }

  private async generateWithLlm(
    requirements: RequirementItem[],
    companyName: string
  ): Promise<FlashcardItem[]> {
    const validReqIds = requirements.map((r) => r.id);
    const reqListStr = requirements.map((r) => `[${r.id}] ${r.text}`).join('\n');

    const prompt = `
${PROMPT_INJECTION_DEFENSE_DIRECTIVE}

You are creating interview preparation flashcards for an engineer interviewing at ${companyName}.
Generate concise, high-yield study flashcards for quick active recall.

Rules:
1. Every flashcard MUST reference at least one valid requirement ID from: ${JSON.stringify(validReqIds)}
2. "front": A targeted technical question, architecture concept, or scenario prompt (1-2 sentences).
3. "back": Concise, high-density key answer points / bullet takeaways (2-4 bullet points or concise explanation).
4. Generate 4 to 8 flashcards.

Available Requirements:
${isolateUntrustedRequirements(reqListStr)}

Return valid JSON adhering to this schema:
{
  "flashcards": [
    {
      "front": string,
      "back": string,
      "requirement_ids": string[]
    }
  ]
}
`;

    interface LlmRawCard {
      front?: string;
      back?: string;
      requirement_ids?: string[];
    }

    const raw = await this.llmClient.generateJson<{ flashcards?: LlmRawCard[] }>(prompt);
    const candidateCards = Array.isArray(raw.flashcards) ? raw.flashcards : [];
    const validReqSet = new Set(validReqIds);
    const cards: FlashcardItem[] = [];

    candidateCards.forEach((c, idx) => {
      const front = c.front?.trim();
      const back = c.back?.trim();
      const reqIds = (c.requirement_ids || []).filter((id) => validReqSet.has(id));

      if (reqIds.length === 0 && validReqIds.length > 0) {
        reqIds.push(validReqIds[idx % validReqIds.length]!);
      }

      if (front && back && reqIds.length > 0) {
        cards.push({
          id: generateFlashcardId(cards.map((x) => x.id)),
          front,
          back,
          requirement_ids: reqIds,
        });
      }
    });

    if (cards.length < 3) {
      return this.generateDeterministic(requirements, companyName);
    }

    return cards;
  }

  public generateDeterministic(
    requirements: RequirementItem[],
    companyName: string
  ): FlashcardItem[] {
    const cards: FlashcardItem[] = [];
    const targetReqs = requirements.slice(0, 6);

    targetReqs.forEach((req) => {
      cards.push({
        id: generateFlashcardId(cards.map((x) => x.id)),
        front: `Core Concept: How do you demonstrate mastery in ${req.text}?`,
        back: `Key principles: (1) Deep understanding of underlying trade-offs and performance implications; (2) Production readiness, robust logging and observability; (3) Clean abstraction layers suited for ${companyName}.`,
        requirement_ids: [req.id],
      });
    });

    if (cards.length === 0 && requirements.length > 0) {
      cards.push({
        id: generateFlashcardId([]),
        front: 'Engineering Core Principles',
        back: 'Write scalable, tested, maintainable software with clear domain boundaries.',
        requirement_ids: [requirements[0]!.id],
      });
    }

    return cards;
  }
}

export const defaultFlashcardGenerator = new FlashcardGenerator();
