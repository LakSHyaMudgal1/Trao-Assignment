import {
  type QuestionItem,
  type RequirementItem,
  QuestionItemSchema,
  QuestionCategoryEnum,
  generateQuestionId,
} from '@prep-kit/shared';
import { z } from 'zod';
import { LlmClient, defaultLlmClient, cleanJsonText } from './llm-client.js';
import { isolateUntrustedResearch, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from './prompt-isolation.js';

export type QuestionCategory = z.infer<typeof QuestionCategoryEnum>;

export interface CategoryGenerationOptions {
  category: QuestionCategory;
  requirements: RequirementItem[];
  companyName: string;
  roleTitle: string;
  researchEvidence?: string;
  existingQuestionIds?: string[];
  targetCount?: number;
}

export interface ResearchContext {
  homepageSummary?: string;
  whatTheyDo?: string;
  aboutText?: string;
  technicalSignals?: string[];
  publicInterviewFindings?: Array<{ topic: string; summary: string; evidence_snippet: string }>;
}

export class QuestionGenerator {
  constructor(private llmClient: LlmClient = defaultLlmClient) {}

  /**
   * Generates questions partitioned by category, ensuring each category receives
   * ONLY the relevant requirements and research context.
   */
  public async generateCategorizedQuestions(
    requirements: RequirementItem[],
    companyName: string,
    roleTitle: string,
    research?: ResearchContext
  ): Promise<QuestionItem[]> {
    const allQuestions: QuestionItem[] = [];
    const categories: QuestionCategory[] = ['technical', 'system-design', 'behavioural', 'company-fit'];

    for (const category of categories) {
      const relevantReqs = this.filterRequirementsForCategory(category, requirements);
      const relevantEvidence = this.filterResearchForCategory(category, research);

      const categoryQuestions = await this.generateCategoryQuestions({
        category,
        requirements: relevantReqs,
        companyName,
        roleTitle,
        researchEvidence: relevantEvidence,
        existingQuestionIds: allQuestions.map((q) => q.id),
      });

      allQuestions.push(...categoryQuestions);
    }

    // Safety fallback: if somehow fewer than 4 questions were generated, backfill with deterministic
    if (allQuestions.length < 4) {
      const fallback = this.generateDeterministicBatch(requirements, companyName, roleTitle, allQuestions.map((q) => q.id));
      for (const fb of fallback) {
        if (!allQuestions.some((q) => q.category === fb.category)) {
          allQuestions.push(fb);
        }
      }
    }

    return allQuestions;
  }

  /**
   * Generates interview questions for a single category with isolated requirements and research.
   */
  public async generateCategoryQuestions(options: CategoryGenerationOptions): Promise<QuestionItem[]> {
    const { category, requirements, companyName, roleTitle, existingQuestionIds = [] } = options;

    if (requirements.length === 0) {
      return [];
    }

    if (this.llmClient.isAvailable()) {
      try {
        return await this.generateWithLlmAndRepair(options);
      } catch (err) {
        console.warn(`[QuestionGenerator] LLM generation failed for category "${category}", falling back to deterministic:`, err);
      }
    }

    return this.generateDeterministicForCategory(
      category,
      requirements,
      companyName,
      roleTitle,
      existingQuestionIds
    );
  }

  /**
   * Calls the LLM with structured repair if the model returns malformed JSON or schema-invalid data.
   */
  private async generateWithLlmAndRepair(options: CategoryGenerationOptions): Promise<QuestionItem[]> {
    const { category, requirements, companyName, roleTitle, researchEvidence, existingQuestionIds = [], targetCount = 2 } = options;
    const validReqIds = requirements.map((r) => r.id);
    const validReqSet = new Set(validReqIds);

    const prompt = this.buildCategoryPrompt(
      category,
      requirements,
      companyName,
      roleTitle,
      researchEvidence,
      targetCount
    );

    let rawText: string;
    try {
      rawText = await this.llmClient.generateRawText(prompt, { temperature: 0.2 });
    } catch (err) {
      throw new Error(`LLM call failed for category "${category}": ${err instanceof Error ? err.message : String(err)}`);
    }

    let parsedQuestions = this.tryParseRawJson(rawText);

    // If initial parse fails, execute structured repair strategy
    if (!parsedQuestions) {
      parsedQuestions = await this.repairMalformedJsonWithLlm(rawText, category);
    }

    if (!parsedQuestions || !Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
      throw new Error(`Structured repair could not extract questions for category "${category}"`);
    }

    const validatedQuestions: QuestionItem[] = [];
    const currentIds = [...existingQuestionIds];

    for (const rawQ of parsedQuestions) {
      const sanitized = this.sanitizeAndValidateQuestion(rawQ, category, validReqSet, validReqIds, currentIds);
      if (sanitized) {
        validatedQuestions.push(sanitized);
        currentIds.push(sanitized.id);
      }
    }

    if (validatedQuestions.length === 0) {
      throw new Error(`Zero questions passed Zod validation for category "${category}"`);
    }

    return validatedQuestions;
  }

  /**
   * Attempt syntactic cleanup and JSON parsing
   */
  private tryParseRawJson(raw: string): any[] | null {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
    } catch {
      // Try with local cleanup
    }

    try {
      const cleaned = cleanJsonText(raw);
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.questions)) return parsed.questions;
    } catch {
      // Parsing still failed
    }

    return null;
  }

  /**
   * Model-assisted JSON repair prompt for unparseable responses
   */
  private async repairMalformedJsonWithLlm(malformedText: string, category: QuestionCategory): Promise<any[] | null> {
    const repairPrompt = `
The previous output was supposed to be a valid JSON array of interview questions for the category "${category}", but failed JSON parsing.
Raw response:
"""
${malformedText.slice(0, 3000)}
"""

Fix the syntax errors and return ONLY a valid JSON object matching this schema:
{
  "questions": [
    {
      "requirement_ids": ["string"],
      "category": "${category}",
      "prompt": "string",
      "answer_outline": "string",
      "difficulty": 1 | 2 | 3
    }
  ]
}
`;

    try {
      const repairedRaw = await this.llmClient.generateRawText(repairPrompt, { temperature: 0.0 });
      return this.tryParseRawJson(repairedRaw);
    } catch (err) {
      console.warn(`[QuestionGenerator] Structured repair prompt failed:`, err);
      return null;
    }
  }

  /**
   * Validates and sanitizes a raw question object using Zod
   */
  private sanitizeAndValidateQuestion(
    raw: any,
    targetCategory: QuestionCategory,
    validReqSet: Set<string>,
    validReqIds: string[],
    existingIds: string[]
  ): QuestionItem | null {
    if (!raw || typeof raw !== 'object') return null;

    const promptText = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
    const answerOutline = typeof raw.answer_outline === 'string' ? raw.answer_outline.trim() : '';

    if (!promptText || !answerOutline) return null;

    // Filter to only REAL requirement IDs from the relevant list
    const candidateReqIds = Array.isArray(raw.requirement_ids)
      ? raw.requirement_ids.filter((id: any) => typeof id === 'string' && validReqSet.has(id))
      : [];

    if (candidateReqIds.length === 0) {
      if (validReqIds.length > 0) {
        candidateReqIds.push(validReqIds[0]!);
      } else {
        return null;
      }
    }

    // Clamp difficulty to 1-3 integer
    let difficulty = 2;
    if (typeof raw.difficulty === 'number' && Number.isFinite(raw.difficulty)) {
      difficulty = Math.max(1, Math.min(3, Math.round(raw.difficulty)));
    }

    const candidate: QuestionItem = {
      id: generateQuestionId(existingIds),
      requirement_ids: candidateReqIds,
      category: targetCategory,
      prompt: promptText,
      answer_outline: answerOutline,
      difficulty,
    };

    // Strict validation with Zod
    const parseResult = QuestionItemSchema.safeParse(candidate);
    if (!parseResult.success) {
      console.warn('[QuestionGenerator] Question failed Zod validation:', parseResult.error.format());
      return null;
    }

    return parseResult.data;
  }

  /**
   * Filters requirements strictly relevant to the target category.
   */
  public filterRequirementsForCategory(
    category: QuestionCategory,
    requirements: RequirementItem[]
  ): RequirementItem[] {
    if (requirements.length === 0) return [];

    switch (category) {
      case 'technical': {
        const tech = requirements.filter((r) => r.kind === 'technical');
        return tech.length > 0 ? tech : requirements.slice(0, 3);
      }
      case 'system-design': {
        const sys = requirements.filter(
          (r) =>
            r.kind === 'technical' &&
            /\b(system|architecture|scale|distributed|database|backend|cloud|api|microservice|data|infrastructure)\b/i.test(
              r.text
            )
        );
        return sys.length > 0
          ? sys
          : requirements.filter((r) => r.kind === 'technical').slice(0, 2).concat(requirements.slice(0, 1));
      }
      case 'behavioural': {
        const beh = requirements.filter((r) => r.kind === 'behavioural');
        return beh.length > 0
          ? beh
          : requirements.filter((r) =>
              /\b(lead|communicate|collaborat|mentor|cross-functional|team|deliver|ownership)\b/i.test(r.text)
            ).concat(requirements.slice(0, 1));
      }
      case 'company-fit': {
        const domain = requirements.filter((r) => r.kind === 'domain');
        return domain.length > 0 ? domain : requirements.slice(-2);
      }
    }
  }

  /**
   * Isolates research evidence relevant ONLY to the target category.
   */
  public filterResearchForCategory(
    category: QuestionCategory,
    research?: ResearchContext
  ): string {
    if (!research) return '';

    const lines: string[] = [];

    switch (category) {
      case 'technical': {
        if (research.technicalSignals && research.technicalSignals.length > 0) {
          lines.push(`Technical signals detected: ${research.technicalSignals.join(', ')}`);
        }
        if (research.publicInterviewFindings) {
          const techFindings = research.publicInterviewFindings.filter((f) => f.topic === 'technical_topics');
          techFindings.forEach((f) => lines.push(`Interview Feedback: ${f.summary}`));
        }
        break;
      }
      case 'system-design': {
        if (research.whatTheyDo) {
          lines.push(`Core Product Scope: ${research.whatTheyDo}`);
        }
        if (research.publicInterviewFindings) {
          const sysFindings = research.publicInterviewFindings.filter((f) =>
            f.evidence_snippet.toLowerCase().includes('system design')
          );
          sysFindings.forEach((f) => lines.push(`System Design Feedback: ${f.summary}`));
        }
        break;
      }
      case 'behavioural': {
        if (research.aboutText) {
          lines.push(`Company Culture Snippet: ${research.aboutText.slice(0, 400)}`);
        }
        if (research.publicInterviewFindings) {
          const behFindings = research.publicInterviewFindings.filter(
            (f) => f.topic === 'candidate_experience' || f.topic === 'general_culture'
          );
          behFindings.forEach((f) => lines.push(`Culture/Process Note: ${f.summary}`));
        }
        break;
      }
      case 'company-fit': {
        if (research.homepageSummary) {
          lines.push(`Company Mission: ${research.homepageSummary}`);
        }
        if (research.whatTheyDo) {
          lines.push(`What They Do: ${research.whatTheyDo}`);
        }
        break;
      }
    }

    return lines.join('\n');
  }

  /**
   * Builds focused, category-specific prompt with strict requirement grounding
   */
  private buildCategoryPrompt(
    category: QuestionCategory,
    requirements: RequirementItem[],
    companyName: string,
    roleTitle: string,
    researchEvidence?: string,
    targetCount = 2
  ): string {
    const validReqIds = requirements.map((r) => r.id);
    const reqStr = requirements.map((r) => `[${r.id}] ${r.text} (${r.priority})`).join('\n');

    const categoryGuidance: Record<QuestionCategory, string> = {
      technical:
        'Focus on hands-on technical problem solving, language/framework semantics, concurrency, database query optimization, and test automation.',
      'system-design':
        'Focus on high-level architecture, scalability, trade-offs between consistency and availability, caching layers, and decoupled event architectures.',
      behavioural:
        'Focus on leadership principles, resolving conflicting engineering priorities, mentoring teammates, and taking ownership of failures.',
      'company-fit':
        'Focus on alignment with the company mission, understanding the customer domain, and adapting to the company engineering rhythm.',
    };

    return `
${PROMPT_INJECTION_DEFENSE_DIRECTIVE}

You are a lead hiring engineer conducting the "${category.toUpperCase()}" interview for a ${roleTitle} position at ${companyName}.

TASK:
Generate exactly ${targetCount} high-yield, authentic interview questions for category: "${category}".

CATEGORY FOCUS:
${categoryGuidance[category]}

AVAILABLE REQUIREMENTS (You MUST reference ONLY these IDs):
${reqStr}

${researchEvidence && researchEvidence.trim().length > 0 ? isolateUntrustedResearch(researchEvidence) : `No specific third-party research available. Base questions strictly on the requirements above.`}

CRITICAL RULES:
1. Every question's "requirement_ids" array MUST contain only valid IDs from: ${JSON.stringify(validReqIds)}.
2. Do NOT invent new requirements.
3. Questions must NOT be generic templates; tailor each question specifically to the requirement text and ${companyName}'s domain.
4. "difficulty" MUST be an integer between 1 and 3 (1 = foundational, 2 = advanced/standard senior, 3 = expert/principal).
5. "answer_outline" must specify key architectural/technical signals to look for in candidate answers.

Return valid JSON:
{
  "questions": [
    {
      "requirement_ids": ["${validReqIds[0]}"],
      "category": "${category}",
      "prompt": "Specific question prompt here...",
      "answer_outline": "Candidate should address: (1)... (2)... (3)...",
      "difficulty": 2
    }
  ]
}
`;
  }

  /**
   * Deterministic generation for a single category ensuring zero-failure offline execution
   */
  public generateDeterministicForCategory(
    category: QuestionCategory,
    requirements: RequirementItem[],
    companyName: string,
    _roleTitle: string,
    existingQuestionIds: string[] = []
  ): QuestionItem[] {
    const questions: QuestionItem[] = [];
    const validReqIds = requirements.map((r) => r.id);
    const currentIds = [...existingQuestionIds];

    switch (category) {
      case 'technical': {
        requirements.slice(0, 2).forEach((req, idx) => {
          const q: QuestionItem = {
            id: generateQuestionId(currentIds),
            requirement_ids: [req.id],
            category: 'technical',
            prompt: `In the context of ${companyName}'s software stack, how do you practically implement and test ${req.text}? What common edge cases or performance bottlenecks have you encountered?`,
            answer_outline: `Look for concrete production experience with ${req.text}, profiling techniques, memory/CPU trade-offs, and automated unit/integration test strategies.`,
            difficulty: idx === 0 ? 1 : 2,
          };
          QuestionItemSchema.parse(q);
          questions.push(q);
          currentIds.push(q.id);
        });
        break;
      }
      case 'system-design': {
        const sysReq = requirements[0] || { id: validReqIds[0] || 'r1', text: 'distributed scalability' };
        const q: QuestionItem = {
          id: generateQuestionId(currentIds),
          requirement_ids: [sysReq.id],
          category: 'system-design',
          prompt: `Design a high-throughput, fault-tolerant service at ${companyName} around the requirement: "${sysReq.text}". Walk through your data storage schema, caching strategy, and failure recovery mechanisms.`,
          answer_outline: `Evaluate API interface contracts, partition keys, read/write throughput trade-offs, database replication vs sharding, circuit breaker patterns, and telemetry metrics.`,
          difficulty: 3,
        };
        QuestionItemSchema.parse(q);
        questions.push(q);
        currentIds.push(q.id);
        break;
      }
      case 'behavioural': {
        const behReq = requirements[0] || { id: validReqIds[0] || 'r1', text: 'cross-functional execution' };
        const q: QuestionItem = {
          id: generateQuestionId(currentIds),
          requirement_ids: [behReq.id],
          category: 'behavioural',
          prompt: `Describe a scenario where you had to navigate technical disagreements or tight deadlines involving ${behReq.text}. How did you align the team and measure success?`,
          answer_outline: `Evaluate using STAR: clear situation context, objective, pragmatic conflict resolution, quantifiable outcome, and retrospective takeaways.`,
          difficulty: 2,
        };
        QuestionItemSchema.parse(q);
        questions.push(q);
        currentIds.push(q.id);
        break;
      }
      case 'company-fit': {
        const fitReq = requirements[0] || { id: validReqIds[0] || 'r1', text: 'domain impact' };
        const q: QuestionItem = {
          id: generateQuestionId(currentIds),
          requirement_ids: [fitReq.id],
          category: 'company-fit',
          prompt: `How does your previous engineering experience with ${fitReq.text} prepare you to contribute to ${companyName}'s mission and engineering standards from day one?`,
          answer_outline: `Look for authentic interest in ${companyName}'s product problem space, high standards of engineering excellence, and customer-first orientation.`,
          difficulty: 1,
        };
        QuestionItemSchema.parse(q);
        questions.push(q);
        currentIds.push(q.id);
        break;
      }
    }

    return questions;
  }

  /**
   * Deterministic batch generation spanning all 4 categories
   */
  private generateDeterministicBatch(
    requirements: RequirementItem[],
    companyName: string,
    roleTitle: string,
    existingIds: string[]
  ): QuestionItem[] {
    const questions: QuestionItem[] = [];
    const categories: QuestionCategory[] = ['technical', 'system-design', 'behavioural', 'company-fit'];
    const currentIds = [...existingIds];

    for (const cat of categories) {
      const filtered = this.filterRequirementsForCategory(cat, requirements);
      const catQs = this.generateDeterministicForCategory(cat, filtered, companyName, roleTitle, currentIds);
      questions.push(...catQs);
      currentIds.push(...catQs.map((q) => q.id));
    }

    return questions;
  }
}

export const defaultQuestionGenerator = new QuestionGenerator();
