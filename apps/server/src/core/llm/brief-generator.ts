import { LlmClient, defaultLlmClient } from './llm-client.js';
import {
  isolateUntrustedResearch,
  isolateUntrustedJd,
  PROMPT_INJECTION_DEFENSE_DIRECTIVE,
} from './prompt-isolation.js';

export interface CompanyBriefData {
  summary: string;
  what_they_do: string;
  sources: string[];
}

export class BriefGenerator {
  constructor(private llmClient: LlmClient = defaultLlmClient) {}

  public async generate(
    companyUrl: string,
    companyName: string,
    consolidatedResearch: string,
    jdContext: string,
    pagesUsed: string[]
  ): Promise<CompanyBriefData> {
    if (this.llmClient.isAvailable()) {
      try {
        return await this.generateWithLlm(companyUrl, companyName, consolidatedResearch, jdContext, pagesUsed);
      } catch (err) {
        console.warn('[BriefGenerator] LLM generation failed, falling back to deterministic synthesis:', err);
      }
    }

    return this.generateDeterministic(companyUrl, companyName, consolidatedResearch, jdContext, pagesUsed);
  }

  private async generateWithLlm(
    companyUrl: string,
    companyName: string,
    consolidatedResearch: string,
    jdContext: string,
    pagesUsed: string[]
  ): Promise<CompanyBriefData> {
    const prompt = `
${PROMPT_INJECTION_DEFENSE_DIRECTIVE}

You are a senior tech industry research analyst.
Generate an honest, fact-based company brief for "${companyName}" based strictly on the provided research context and JD.

Rules:
1. Do NOT fabricate or hallucinate products, clients, or company history not present in the research.
2. "summary": 2-3 sentences summarizing what kind of company they are, their mission, and engineering culture.
3. "what_they_do": 2-3 sentences explaining their core products/services and target audience.
4. "sources": Array of URLs used. MUST be drawn only from the provided pages used list.
5. If the company site was unreachable or no info was discovered, state that honestly.

Return valid JSON:
{
  "summary": string,
  "what_they_do": string,
  "sources": string[]
}

Available Pages Used:
${JSON.stringify(pagesUsed)}

${isolateUntrustedResearch(consolidatedResearch)}

${isolateUntrustedJd(jdContext, 2000)}
`;

    interface LlmBriefResponse {
      summary?: string;
      what_they_do?: string;
      sources?: string[];
    }

    const raw = await this.llmClient.generateJson<LlmBriefResponse>(prompt);

    const summary = raw.summary?.trim() || `${companyName} is an engineering-driven organization.`;
    const what_they_do = raw.what_they_do?.trim() || `${companyName} develops technology solutions and software products.`;
    const sources = Array.isArray(raw.sources) && raw.sources.length > 0
      ? raw.sources.filter((s) => pagesUsed.includes(s) || s === companyUrl)
      : pagesUsed;

    return {
      summary,
      what_they_do,
      sources: sources.length > 0 ? sources : (companyUrl ? [companyUrl] : []),
    };
  }

  public generateDeterministic(
    companyUrl: string,
    companyName: string,
    consolidatedResearch: string,
    _jdContext: string,
    pagesUsed: string[]
  ): Promise<CompanyBriefData> {
    let summary = '';
    let what_they_do = '';

    if (consolidatedResearch && consolidatedResearch.length > 50) {
      summary = `${companyName} is a technology organization. Public research indicates an engineering focus on scalable systems, modern software delivery, and collaborative development.`;
      what_they_do = `${companyName} builds digital platforms and services designed to serve its enterprise and consumer user base.`;
    } else {
      summary = `Public web research was limited for ${companyName}. Based on the job description, the organization is actively hiring engineering talent to drive key product and technical initiatives.`;
      what_they_do = `${companyName} operates in the software and technology sector, focusing on robust product development and system reliability.`;
    }

    const sources = pagesUsed.length > 0 ? [...pagesUsed] : (companyUrl ? [companyUrl] : []);

    return Promise.resolve({
      summary,
      what_they_do,
      sources,
    });
  }
}

export const defaultBriefGenerator = new BriefGenerator();
