import type { ISearchProvider } from './search-provider.interface.js';
import type {
  PublicInterviewResearchResult,
  RawSearchResult,
  ResearchServiceOptions,
} from './discussion.types.js';
import { generateInterviewResearchQueries } from './query-generator.js';
import { deduplicateSources } from './source-deduplicator.js';
import { sanitizeDiscussionSource } from './result-cleaner.js';
import { extractInterviewFindings } from './finding-extractor.js';
import { DuckDuckGoSearchProvider } from './providers/duckduckgo-search-provider.js';

export interface ResearchExecutionOptions {
  roleTitle?: string;
  maxQueries?: number;
  maxResultsPerQuery?: number;
}

export class PublicInterviewResearchService {
  private provider: ISearchProvider;
  private readonly rateLimiterMs: number;
  private readonly maxQueries: number;
  private readonly maxResultsPerQuery: number;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;

  constructor(
    provider?: ISearchProvider,
    options?: ResearchServiceOptions
  ) {
    this.provider = provider ?? new DuckDuckGoSearchProvider();
    this.rateLimiterMs = options?.rateLimiterMs ?? 150;
    this.maxQueries = options?.maxQueries ?? 5;
    this.maxResultsPerQuery = options?.maxResultsPerQuery ?? 5;
    this.maxRetries = options?.maxRetries ?? 2;
    this.backoffBaseMs = options?.backoffBaseMs ?? 200;
  }

  /**
   * Replace the active search provider at runtime
   */
  public setProvider(newProvider: ISearchProvider): this {
    this.provider = newProvider;
    return this;
  }

  public getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Orchestrate public interview-process research
   */
  public async researchInterviewProcess(
    companyName: string,
    options?: ResearchExecutionOptions
  ): Promise<PublicInterviewResearchResult> {
    const limitations: string[] = [];
    const allRawResults: RawSearchResult[] = [];

    if (!companyName || !companyName.trim()) {
      return {
        sources: [],
        findings: [],
        limitations: ['A valid company name or domain is required to perform interview research.'],
      };
    }

    // 1. Derive targeted search queries
    const derivedQueries = generateInterviewResearchQueries(
      companyName,
      options?.roleTitle,
      options?.maxQueries ?? this.maxQueries
    );

    if (derivedQueries.length === 0) {
      return {
        sources: [],
        findings: [],
        limitations: [`Could not derive search queries from company name: "${companyName}".`],
      };
    }

    const maxResultsPerQuery = options?.maxResultsPerQuery ?? this.maxResultsPerQuery;

    // 2. Execute queries with rate limiting and retry handling
    let successfulQueryCount = 0;

    for (let i = 0; i < derivedQueries.length; i++) {
      const { query } = derivedQueries[i]!;

      // Enforce inter-query delay
      if (i > 0 && this.rateLimiterMs > 0) {
        await new Promise((res) => setTimeout(res, this.rateLimiterMs));
      }

      try {
        const queryResults = await this.executeSearchWithRetry(query, maxResultsPerQuery);
        allRawResults.push(...queryResults);
        successfulQueryCount++;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        limitations.push(`Query failed ("${query}"): ${errorMessage}`);
      }
    }

    // Check if entire search provider was unreachable
    if (successfulQueryCount === 0) {
      limitations.push(
        `Search provider (${this.provider.name}) was unable to complete any search queries for ${companyName}.`
      );
      return {
        sources: [],
        findings: [],
        limitations,
      };
    }

    // 3. Deduplicate sources by normalized canonical URL
    const deduplicatedSources = deduplicateSources(allRawResults);

    // 4. Clean text & neutralize prompt injections
    const cleanedSources = deduplicatedSources.map((source) => sanitizeDiscussionSource(source));

    // 5. Extract verifiable findings linked to source URLs
    const { findings, limitations: extractionLimitations } = extractInterviewFindings(
      cleanedSources,
      companyName
    );

    limitations.push(...extractionLimitations);

    return {
      sources: cleanedSources,
      findings,
      limitations,
    };
  }

  /**
   * Execute search with exponential backoff on transient errors (429, 5xx, timeouts)
   */
  private async executeSearchWithRetry(query: string, limit: number): Promise<RawSearchResult[]> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.provider.search(query, { limit });
      } catch (err: unknown) {
        lastError = err;
        const statusCode = (err as { statusCode?: number }).statusCode;

        // Non-retryable errors (e.g. 400 Bad Request, 401 Unauthorized)
        if (statusCode && statusCode >= 400 && statusCode < 429) {
          throw err;
        }

        if (attempt < this.maxRetries) {
          // Exponential backoff with jitter
          const delay = this.backoffBaseMs * Math.pow(2, attempt) + Math.random() * 50;
          await new Promise((res) => setTimeout(res, delay));
        }
      }
    }

    throw lastError;
  }
}
