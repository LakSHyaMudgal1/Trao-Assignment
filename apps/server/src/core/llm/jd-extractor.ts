import type { RequirementItem } from '@prep-kit/shared';
import { generateRequirementId } from '@prep-kit/shared';
import { LlmClient, defaultLlmClient } from './llm-client.js';
import { isolateUntrustedJd, PROMPT_INJECTION_DEFENSE_DIRECTIVE } from './prompt-isolation.js';

export interface ExtractedRoleData {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: RequirementItem[];
}

export class JdExtractor {
  constructor(private llmClient: LlmClient = defaultLlmClient) {}

  public async extract(jdText: string): Promise<ExtractedRoleData> {
    if (this.llmClient.isAvailable()) {
      try {
        return await this.extractWithLlm(jdText);
      } catch (err) {
        console.warn('[JdExtractor] LLM extraction failed, falling back to deterministic extraction:', err);
      }
    }

    return this.extractDeterministic(jdText);
  }

  private async extractWithLlm(jdText: string): Promise<ExtractedRoleData> {
    const prompt = `
${PROMPT_INJECTION_DEFENSE_DIRECTIVE}

You are an expert technical recruiter and engineering leader.
Analyze the following Job Description (JD) and extract structured requirements.

Rules:
1. Extract the specific role title and seniority level (e.g. "Senior", "Lead", "Mid-level", "Junior", "Staff").
2. Extract key responsibilities as clear string statements.
3. Extract explicit requirements. For each requirement:
   - "text": Clean description of the requirement
   - "kind": Exactly one of "technical", "behavioural", or "domain"
   - "priority": Exactly one of "must" (core requirement) or "nice" (preferred/bonus)
4. Do not invent requirements not mentioned in the JD.

Return valid JSON adhering to this schema:
{
  "title": string,
  "seniority": string,
  "responsibilities": string[],
  "requirements": [
    {
      "text": string,
      "kind": "technical" | "behavioural" | "domain",
      "priority": "must" | "nice"
    }
  ]
}

Job Description Context:
${isolateUntrustedJd(jdText)}
`;

    interface LlmRawRole {
      title?: string;
      seniority?: string;
      responsibilities?: string[];
      requirements?: Array<{
        text: string;
        kind: 'technical' | 'behavioural' | 'domain';
        priority: 'must' | 'nice';
      }>;
    }

    const raw = await this.llmClient.generateJson<LlmRawRole>(prompt);

    const title = raw.title?.trim() || this.extractTitleFromText(jdText);
    const seniority = raw.seniority?.trim() || this.extractSeniorityFromText(jdText);
    const responsibilities = Array.isArray(raw.responsibilities) && raw.responsibilities.length > 0
      ? raw.responsibilities.map((r) => String(r).trim()).filter(Boolean)
      : this.extractResponsibilitiesFromText(jdText);

    const rawReqs = Array.isArray(raw.requirements) && raw.requirements.length > 0
      ? raw.requirements
      : [];

    const requirements: RequirementItem[] = [];
    for (let i = 0; i < rawReqs.length; i++) {
      const req = rawReqs[i]!;
      requirements.push({
        id: generateRequirementId(requirements.map((r) => r.id)),
        text: req.text?.trim() || `Requirement ${i + 1}`,
        kind: ['technical', 'behavioural', 'domain'].includes(req.kind) ? req.kind : 'technical',
        priority: ['must', 'nice'].includes(req.priority) ? req.priority : 'must',
      });
    }

    if (requirements.length === 0) {
      return this.extractDeterministic(jdText);
    }

    return {
      title,
      seniority,
      responsibilities,
      requirements,
    };
  }

  public extractDeterministic(jdText: string): ExtractedRoleData {
    const title = this.extractTitleFromText(jdText);
    const seniority = this.extractSeniorityFromText(jdText);
    const responsibilities = this.extractResponsibilitiesFromText(jdText);
    const rawRequirements = this.extractRequirementsFromText(jdText);

    const requirements: RequirementItem[] = [];
    for (let i = 0; i < rawRequirements.length; i++) {
      const r = rawRequirements[i]!;
      requirements.push({
        id: generateRequirementId(requirements.map((x) => x.id)),
        text: r.text,
        kind: r.kind,
        priority: r.priority,
      });
    }

    // Ensure at least a fallback requirement if JD was minimal
    if (requirements.length === 0) {
      requirements.push({
        id: generateRequirementId([]),
        text: `${title} core engineering fundamentals`,
        kind: 'technical',
        priority: 'must',
      });
    }

    return {
      title,
      seniority,
      responsibilities: responsibilities.length > 0 ? responsibilities : [`Deliver high-quality software solutions as ${title}`],
      requirements,
    };
  }

  private extractTitleFromText(text: string): string {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 5)) {
      if (/(engineer|developer|architect|designer|manager|lead|specialist|analyst)/i.test(line)) {
        return line.replace(/^[#*\-•\s]+/, '').slice(0, 80).trim();
      }
    }
    return 'Software Engineer';
  }

  private extractSeniorityFromText(text: string): string {
    if (/\b(principal|staff|lead|director|head of)\b/i.test(text)) return 'Staff / Principal';
    if (/\b(senior|sr\.)\b/i.test(text)) return 'Senior';
    if (/\b(junior|jr\.|associate|entry-level|graduate)\b/i.test(text)) return 'Junior / Associate';
    return 'Mid-Level';
  }

  private extractResponsibilitiesFromText(text: string): string[] {
    const lines = text.split('\n').map((l) => l.trim());
    const resp: string[] = [];
    let inRespSection = false;

    for (const line of lines) {
      if (/(responsibilities|what you('ll| will) do|the role|your impact)/i.test(line)) {
        inRespSection = true;
        continue;
      }
      if (inRespSection && /(requirements|qualifications|what we('re| are) looking for|skills)/i.test(line)) {
        break;
      }
      if (inRespSection && /^[-*•\d.]\s+/.test(line)) {
        const cleaned = line.replace(/^[-*•\d.]\s+/, '').trim();
        if (cleaned.length > 10) resp.push(cleaned);
      }
    }

    return resp.slice(0, 6);
  }

  private extractRequirementsFromText(
    text: string
  ): Array<{ text: string; kind: 'technical' | 'behavioural' | 'domain'; priority: 'must' | 'nice' }> {
    const lines = text.split('\n').map((l) => l.trim());
    const reqs: Array<{ text: string; kind: 'technical' | 'behavioural' | 'domain'; priority: 'must' | 'nice' }> = [];
    let inReqSection = false;
    let isNiceSection = false;

    for (const line of lines) {
      if (/(nice to have|preferred|bonus|plus)/i.test(line)) {
        isNiceSection = true;
      }
      if (/(requirements|qualifications|skills|what you bring|experience)/i.test(line)) {
        inReqSection = true;
        continue;
      }

      if (inReqSection && /^[-*•\d.]\s+/.test(line)) {
        const cleaned = line.replace(/^[-*•\d.]\s+/, '').trim();
        if (cleaned.length > 8) {
          const kind = this.classifyRequirementKind(cleaned);
          const priority: 'must' | 'nice' = isNiceSection || /(preferred|plus|bonus|nice to have)/i.test(cleaned)
            ? 'nice'
            : 'must';
          reqs.push({ text: cleaned, kind, priority });
        }
      }
    }

    // If no bullet points found, extract sentences with strong requirement signals
    if (reqs.length === 0) {
      const sentences = text.split(/[.;\n]+/).map((s) => s.trim()).filter((s) => s.length > 15);
      for (const sentence of sentences) {
        if (/(years? of experience|proficient with|knowledge of|hands-on|experience in|strong understanding)/i.test(sentence)) {
          const kind = this.classifyRequirementKind(sentence);
          const priority: 'must' | 'nice' = /(preferred|bonus|nice to have)/i.test(sentence) ? 'nice' : 'must';
          reqs.push({ text: sentence, kind, priority });
          if (reqs.length >= 8) break;
        }
      }
    }

    return reqs.slice(0, 10);
  }

  private classifyRequirementKind(text: string): 'technical' | 'behavioural' | 'domain' {
    const lower = text.toLowerCase();
    if (
      /\b(leadership|collaboration|communication|cross-functional|team player|mentoring|ownership|empathy|agile|scrum)\b/.test(
        lower
      )
    ) {
      return 'behavioural';
    }
    if (
      /\b(fintech|healthcare|compliance|e-commerce|security|regulatory|gdpr|hipaa|payments|crypto|banking)\b/.test(
        lower
      )
    ) {
      return 'domain';
    }
    return 'technical';
  }
}

export const defaultJdExtractor = new JdExtractor();
