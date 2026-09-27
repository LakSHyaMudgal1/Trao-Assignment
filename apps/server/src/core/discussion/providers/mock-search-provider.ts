import type { ISearchProvider } from '../search-provider.interface.js';
import type { RawSearchResult, SearchOptions } from '../discussion.types.js';

export interface MockQueryRule {
  pattern: RegExp | string;
  results?: RawSearchResult[];
  error?: Error;
  delayMs?: number;
  statusCode?: number;
}

export class MockSearchProvider implements ISearchProvider {
  public readonly name = 'MockSearchProvider';
  private queryRules: MockQueryRule[] = [];
  private defaultResults: RawSearchResult[] = [];
  private calls: Array<{ query: string; options?: SearchOptions }> = [];

  constructor(initialRules?: MockQueryRule[]) {
    if (initialRules) {
      this.queryRules = [...initialRules];
    }
  }

  public addRule(rule: MockQueryRule): this {
    this.queryRules.push(rule);
    return this;
  }

  public setDefaultResults(results: RawSearchResult[]): this {
    this.defaultResults = [...results];
    return this;
  }

  public getRecordedCalls(): Array<{ query: string; options?: SearchOptions }> {
    return [...this.calls];
  }

  public clearRecordedCalls(): void {
    this.calls = [];
  }

  public async search(query: string, options?: SearchOptions): Promise<RawSearchResult[]> {
    this.calls.push({ query, options });

    // Find matching rule
    for (const rule of this.queryRules) {
      const isMatch =
        typeof rule.pattern === 'string'
          ? query.toLowerCase().includes(rule.pattern.toLowerCase())
          : rule.pattern.test(query);

      if (isMatch) {
        if (rule.delayMs && rule.delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
        }

        if (rule.statusCode === 429) {
          const err = new Error('HTTP 429: Too Many Requests');
          (err as { statusCode?: number }).statusCode = 429;
          throw err;
        }

        if (rule.error) {
          throw rule.error;
        }

        const res = rule.results ?? [];
        const limit = options?.limit ?? 5;
        return res.slice(0, limit);
      }
    }

    const limit = options?.limit ?? 5;
    return this.defaultResults.slice(0, limit);
  }
}
