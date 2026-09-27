import * as cheerio from 'cheerio';
import type { ISearchProvider } from '../search-provider.interface.js';
import type { RawSearchResult, SearchOptions } from '../discussion.types.js';

export class DuckDuckGoSearchProvider implements ISearchProvider {
  public readonly name = 'DuckDuckGoSearchProvider';
  private readonly defaultTimeoutMs: number;
  private readonly userAgent: string;

  constructor(options?: { timeoutMs?: number; userAgent?: string }) {
    this.defaultTimeoutMs = options?.timeoutMs ?? 6000;
    this.userAgent =
      options?.userAgent ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  }

  public async search(query: string, options?: SearchOptions): Promise<RawSearchResult[]> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const limit = options?.limit ?? 5;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // DuckDuckGo HTML endpoint
      const searchUrl = 'https://html.duckduckgo.com/html/';
      const body = new URLSearchParams({ q: query });

      const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': this.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        body: body.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = new Error(`DuckDuckGo search error HTTP ${response.status}: ${response.statusText}`);
        (error as { statusCode?: number }).statusCode = response.status;
        throw error;
      }

      const html = await response.text();
      return this.parseDuckDuckGoHtml(html, limit);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        const timeoutError = new Error(`Search request timed out after ${timeoutMs}ms for query: "${query}"`);
        (timeoutError as { statusCode?: number }).statusCode = 408;
        throw timeoutError;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseDuckDuckGoHtml(html: string, limit: number): RawSearchResult[] {
    const $ = cheerio.load(html);
    const results: RawSearchResult[] = [];

    const elements = $('.result').toArray();
    for (const element of elements) {
      if (results.length >= limit) break;

      const $el = $(element);
      const titleLink = $el.find('.result__title a');
      const title = titleLink.text().trim();
      const rawHref = titleLink.attr('href') || '';
      const snippet = $el.find('.result__snippet').text().trim();

      // DuckDuckGo uses a redirect link like /l/?uddg=https%3A%2F%2F...
      const finalUrl = this.extractTargetUrl(rawHref);

      if (finalUrl && title && snippet) {
        results.push({
          url: finalUrl,
          title,
          snippet,
          provider: this.name,
        });
      }
    }

    return results;
  }

  private extractTargetUrl(rawHref: string): string | null {
    if (!rawHref) return null;

    try {
      if (rawHref.includes('uddg=')) {
        const parsed = new URL(rawHref, 'https://duckduckgo.com');
        const encodedUrl = parsed.searchParams.get('uddg');
        if (encodedUrl) {
          return decodeURIComponent(encodedUrl);
        }
      }

      if (rawHref.startsWith('http://') || rawHref.startsWith('https://')) {
        return rawHref;
      }
    } catch {
      // Ignore URL parsing errors
    }

    return null;
  }
}
