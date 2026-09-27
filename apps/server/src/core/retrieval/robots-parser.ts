import type { PageFetcher } from './page-fetcher.js';

export class RobotsParser {
  private disallowPatterns: string[] = [];
  private allowPatterns: string[] = [];
  public hasRobotsTxt: boolean = false;

  constructor(private fetcher: PageFetcher) {}

  /**
   * Fetches and parses robots.txt for a given base URL.
   */
  async loadRobotsTxt(baseUrl: string, allowLocal = true): Promise<void> {
    try {
      const parsed = new URL(baseUrl);
      const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

      const result = await this.fetcher.fetchPage(robotsUrl, {
        timeoutMs: 3000,
        maxBytes: 128 * 1024, // 128KB max for robots.txt
        maxRetries: 1,
        allowLocal,
      });

      if (!result.success || !result.page) {
        return;
      }

      this.parseRobotsTxt(result.page.textContent);
      this.hasRobotsTxt = true;
    } catch {
      // Graceful fallback: allow all if robots.txt cannot be fetched
    }
  }

  /**
   * Parses standard robots.txt lines for User-agent: *
   */
  private parseRobotsTxt(content: string): void {
    const lines = content.split('\n');
    let appliesToAll = false;

    for (let rawLine of lines) {
      // Strip comments
      const commentIdx = rawLine.indexOf('#');
      if (commentIdx !== -1) {
        rawLine = rawLine.substring(0, commentIdx);
      }

      const line = rawLine.trim();
      if (!line) continue;

      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const directive = line.substring(0, colonIdx).trim().toLowerCase();
      const value = line.substring(colonIdx + 1).trim();

      if (directive === 'user-agent') {
        if (value === '*' || value.toLowerCase().includes('bot')) {
          appliesToAll = true;
        } else {
          appliesToAll = false;
        }
      } else if (appliesToAll) {
        if (directive === 'disallow' && value) {
          this.disallowPatterns.push(value);
        } else if (directive === 'allow' && value) {
          this.allowPatterns.push(value);
        }
      }
    }
  }

  /**
   * Checks whether a specific URL pathname is allowed according to robots.txt rules.
   */
  isAllowed(urlPath: string): boolean {
    if (this.disallowPatterns.length === 0) return true;

    // Check allow rules first
    for (const allowPattern of this.allowPatterns) {
      if (this.matchesPattern(urlPath, allowPattern)) {
        return true;
      }
    }

    // Check disallow rules
    for (const disallowPattern of this.disallowPatterns) {
      if (this.matchesPattern(urlPath, disallowPattern)) {
        return false;
      }
    }

    return true;
  }

  private matchesPattern(path: string, pattern: string): boolean {
    if (pattern === '/') return true;
    const cleanPattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;
    return path.startsWith(cleanPattern);
  }
}
