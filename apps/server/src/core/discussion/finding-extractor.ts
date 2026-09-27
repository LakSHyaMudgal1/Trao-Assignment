import type { CleanedDiscussionSource, InterviewFinding, InterviewTopic } from './discussion.types.js';

interface TopicPattern {
  topic: InterviewTopic;
  regex: RegExp;
  summaryTemplate: (match: string, company: string) => string;
}

const TOPIC_PATTERNS: TopicPattern[] = [
  {
    topic: 'interview_rounds',
    regex:
      /\b(recruiter screen|phone screen|technical screen|take-home|coding challenge|pair programming|system design (round|interview)|behavioral (round|interview)|onsite|final round|bar raiser|hiring manager round)\b/i,
    summaryTemplate: (match, company) =>
      `Candidate reports mention "${match.toLowerCase()}" as part of the ${company} evaluation.`,
  },
  {
    topic: 'technical_topics',
    regex:
      /\b(leetcode|data structures|algorithms|system design|distributed systems|concurrency|sql|react|typescript|python|api design|object-oriented design)\b/i,
    summaryTemplate: (match, company) =>
      `Technical assessments at ${company} commonly assess "${match}".`,
  },
  {
    topic: 'difficulty_assessment',
    regex:
      /\b(difficulty\s*(was|rated|is)?\s*(easy|average|medium|hard|difficult)|challenging interview|straightforward interview)\b/i,
    summaryTemplate: (match) =>
      `Public candidate feedback notes interview difficulty: "${match.trim()}".`,
  },
  {
    topic: 'candidate_experience',
    regex:
      /\b(positive experience|negative experience|ghosted|collaborative interviewers|transparent process|helpful interviewers|lengthy process)\b/i,
    summaryTemplate: (match) =>
      `Candidate experience sentiment reported: "${match.trim()}".`,
  },
  {
    topic: 'interview_process',
    regex:
      /\b(interview process took|timeline was|process takes approximately \d+|steps in the process|offer extended after \d+)\b/i,
    summaryTemplate: (match) =>
      `Interview timeline and progression: "${match.trim()}".`,
  },
];

export interface ExtractionResult {
  findings: InterviewFinding[];
  limitations: string[];
}

/**
 * Extracts verifiable findings from cleaned discussion sources without speculation or fabrication
 */
export function extractInterviewFindings(
  sources: CleanedDiscussionSource[],
  companyName: string
): ExtractionResult {
  const findings: InterviewFinding[] = [];
  const limitations: string[] = [];
  const seenFindings = new Set<string>();

  if (sources.length === 0) {
    limitations.push(`No public discussion or interview search results were found for ${companyName}.`);
    limitations.push('Interview stages could not be verified from public sources; stages must not be fabricated.');
    return { findings, limitations };
  }

  for (const source of sources) {
    const textToAnalyze = `${source.title} ${source.snippet}`;

    for (const pattern of TOPIC_PATTERNS) {
      const match = textToAnalyze.match(pattern.regex);
      if (match && match[0]) {
        const matchedTerm = match[0];
        const dedupeKey = `${pattern.topic}:${matchedTerm.toLowerCase()}:${source.url}`;

        if (!seenFindings.has(dedupeKey)) {
          seenFindings.add(dedupeKey);

          // Extract sentence surrounding match for evidence
          const sentence = extractSentenceAroundMatch(textToAnalyze, match.index ?? 0, matchedTerm.length);

          findings.push({
            source_url: source.url,
            source_title: source.title,
            topic: pattern.topic,
            summary: pattern.summaryTemplate(matchedTerm, companyName),
            evidence_snippet: sentence,
            confidence: determineConfidence(textToAnalyze, matchedTerm),
          });
        }
      }
    }
  }

  if (findings.length === 0) {
    limitations.push(
      `Retrieved ${sources.length} public source(s) for ${companyName}, but none contained verified interview stages, technical rounds, or candidate experience reports.`
    );
    limitations.push(
      'No candidate interview details were discovered in public discussion. Do not assume or fabricate interview rounds.'
    );
  }

  return { findings, limitations };
}

function extractSentenceAroundMatch(text: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - 80);
  const end = Math.min(text.length, matchIndex + matchLength + 80);
  let snippet = text.slice(start, end).trim();

  if (start > 0) snippet = `...${snippet}`;
  if (end < text.length) snippet = `${snippet}...`;

  return snippet;
}

function determineConfidence(text: string, term: string): 'high' | 'medium' | 'low' {
  const lower = text.toLowerCase();
  const lowerTerm = term.toLowerCase();

  // If text mentions both "interview" and specific context
  if (lower.includes('interview') && (lower.includes('glassdoor') || lower.includes('reddit') || lower.includes('blind') || lower.includes('round'))) {
    return 'high';
  }

  if (lower.includes(lowerTerm)) {
    return 'medium';
  }

  return 'low';
}
