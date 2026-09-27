export interface CrawledPage {
  url: string;
  finalUrl: string;
  httpStatus: number;
  title: string;
  textContent: string;
  byteSize: number;
  contentType: string;
}

export type LinkCategory = 'hiring' | 'culture' | 'about' | 'general';

export interface ExtractedLink {
  rawHref: string;
  normalizedUrl: string;
  anchorText: string;
}

export interface ScoredLink extends ExtractedLink {
  score: number;
  signals: string[];
  category: LinkCategory;
}

export interface ResearchResult {
  company_url: string;
  normalized_url: string;
  reachable: boolean;
  pages_used: string[];
  pages: CrawledPage[];
  hiring_page_found: boolean;
  hiring_content?: string;
  about_content?: string;
  culture_content?: string;
  interview_signals: string[];
  warnings: string[];
}

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRetries?: number;
  allowLocal?: boolean;
}
