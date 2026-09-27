/**
 * Public Discussion Research Types
 */

export interface RawSearchResult {
  url: string;
  title: string;
  snippet: string;
  provider?: string;
}

export interface CleanedDiscussionSource {
  url: string;
  title: string;
  snippet: string;
  domain: string;
  crawled_at: string;
}

export type InterviewTopic =
  | 'interview_process'
  | 'technical_topics'
  | 'interview_rounds'
  | 'difficulty_assessment'
  | 'candidate_experience'
  | 'general_culture';

export interface InterviewFinding {
  source_url: string;
  source_title: string;
  topic: InterviewTopic;
  summary: string;
  evidence_snippet: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface PublicInterviewResearchResult {
  sources: CleanedDiscussionSource[];
  findings: InterviewFinding[];
  limitations: string[];
}

export interface SearchOptions {
  limit?: number;
  timeoutMs?: number;
  filterDomains?: string[];
}

export interface ResearchServiceOptions {
  rateLimiterMs?: number;
  maxQueries?: number;
  maxResultsPerQuery?: number;
  maxRetries?: number;
  backoffBaseMs?: number;
}
