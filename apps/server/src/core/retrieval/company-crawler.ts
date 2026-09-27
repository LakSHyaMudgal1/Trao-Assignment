import { PageFetcher, defaultPageFetcher } from './page-fetcher.js';
import { RobotsParser } from './robots-parser.js';
import { HtmlCleaner, defaultHtmlCleaner } from './html-cleaner.js';
import { LinkExtractor, defaultLinkExtractor } from './link-extractor.js';
import { LinkScorer, defaultLinkScorer } from './link-scorer.js';
import { validateAndNormalizeUrl } from './url-validator.js';
import { env } from '../../config/env.js';
import type { ResearchResult, CrawledPage, FetchOptions } from './research.types.js';

export interface CrawlerConfig extends FetchOptions {
  maxSecondaryPages?: number; // Default: 2
}

export class CompanyCrawler {
  constructor(
    private fetcher: PageFetcher = defaultPageFetcher,
    private cleaner: HtmlCleaner = defaultHtmlCleaner,
    private extractor: LinkExtractor = defaultLinkExtractor,
    private scorer: LinkScorer = defaultLinkScorer
  ) {}

  /**
   * Performs an SSRF-safe, heuristic-driven crawl of a company website.
   * Finds hiring/interview pages without assuming fixed hardcoded paths.
   */
  async crawlCompany(rawCompanyUrl: string, config?: CrawlerConfig): Promise<ResearchResult> {
    const warnings: string[] = [];
    const pages: CrawledPage[] = [];
    const pagesUsed: string[] = [];
    const interviewSignals = new Set<string>();
    const allowLocal =
      config?.allowLocal ?? (process.env.NODE_ENV === 'production' ? false : env.ALLOW_LOCAL_URLS);
    const maxSecondaryPages = config?.maxSecondaryPages ?? 2;

    // 1. SSRF and URL Validation
    let normalizedBaseUrl: string;
    try {
      normalizedBaseUrl = await validateAndNormalizeUrl(rawCompanyUrl, allowLocal);
    } catch (err: any) {
      warnings.push(`URL validation failed: ${err.message}`);
      return {
        company_url: rawCompanyUrl,
        normalized_url: '',
        reachable: false,
        pages_used: [],
        pages: [],
        hiring_page_found: false,
        interview_signals: [],
        warnings,
      };
    }

    // 2. Fetch and parse robots.txt
    const robotsParser = new RobotsParser(this.fetcher);
    await robotsParser.loadRobotsTxt(normalizedBaseUrl, allowLocal);
    if (robotsParser.hasRobotsTxt) {
      warnings.push('Respected robots.txt rules from host');
    }

    // 3. Fetch Homepage
    const homepageResult = await this.fetcher.fetchPage(normalizedBaseUrl, {
      ...config,
      allowLocal,
    });

    if (!homepageResult.success || !homepageResult.page) {
      warnings.push(
        `Homepage fetch failed: ${homepageResult.error?.message || 'Unreachable'}`
      );
      return {
        company_url: rawCompanyUrl,
        normalized_url: normalizedBaseUrl,
        reachable: false,
        pages_used: [],
        pages: [],
        hiring_page_found: false,
        interview_signals: [],
        warnings,
      };
    }

    // 4. Save raw HTML for link extraction and clean for content
    const rawHtml = homepageResult.page.textContent;
    const homeCleaned = this.cleaner.clean(rawHtml, homepageResult.page.finalUrl);

    homepageResult.page.title = homeCleaned.title;
    homepageResult.page.textContent = homeCleaned.cleanedText;

    pages.push(homepageResult.page);
    pagesUsed.push(homepageResult.page.finalUrl);
    homeCleaned.detectedSignals.forEach((sig) => interviewSignals.add(sig));

    let aboutContent = homeCleaned.metaDescription || homeCleaned.cleanedText.slice(0, 800);
    let hiringContent = '';
    let cultureContent = '';
    let hiringPageFound =
      homeCleaned.detectedSignals.includes('hiring_portal') ||
      homeCleaned.detectedSignals.includes('interview_process');

    // Extract links from homepage raw HTML (using final redirected URL as base)
    const rawLinks = this.extractor.extract(rawHtml, homepageResult.page.finalUrl);

    // 5. Score and rank links
    const scoredLinks = this.scorer.scoreAndRank(rawLinks);

    // 6. Filter by robots.txt and pick top candidates (prioritizing hiring and culture)
    const candidateLinks = scoredLinks
      .filter((l) => {
        try {
          const path = new URL(l.normalizedUrl).pathname;
          return robotsParser.isAllowed(path);
        } catch {
          return false;
        }
      })
      .slice(0, maxSecondaryPages);

    // 7. Fetch candidate pages (isolated per page: one failure does not kill run)
    for (const link of candidateLinks) {
      const pageResult = await this.fetcher.fetchPage(link.normalizedUrl, {
        ...config,
        allowLocal,
      });

      if (!pageResult.success || !pageResult.page) {
        warnings.push(`Candidate page skipped (${link.normalizedUrl}): ${pageResult.error?.message}`);
        continue; // Never fail whole run
      }

      const cleaned = this.cleaner.clean(pageResult.page.textContent, pageResult.page.finalUrl);
      pageResult.page.title = cleaned.title;
      pageResult.page.textContent = cleaned.cleanedText;

      pages.push(pageResult.page);
      pagesUsed.push(pageResult.page.finalUrl);
      cleaned.detectedSignals.forEach((sig) => interviewSignals.add(sig));

      // Classify page content based on category and detected signals
      if (link.category === 'hiring' || cleaned.detectedSignals.includes('interview_process') || cleaned.detectedSignals.includes('hiring_portal')) {
        hiringPageFound = true;
        hiringContent += `\n--- SOURCE: ${link.normalizedUrl} (${cleaned.title}) ---\n${cleaned.cleanedText}\n`;
      } else if (link.category === 'culture' || cleaned.detectedSignals.includes('culture_and_values')) {
        cultureContent += `\n--- SOURCE: ${link.normalizedUrl} (${cleaned.title}) ---\n${cleaned.cleanedText}\n`;
      } else if (link.category === 'about') {
        aboutContent += `\n--- SOURCE: ${link.normalizedUrl} (${cleaned.title}) ---\n${cleaned.cleanedText}\n`;
      }
    }

    // 8. Honest reporting if no hiring page discovered
    if (!hiringPageFound) {
      warnings.push('No discoverable hiring or interview process page was found on the company website.');
    }

    return {
      company_url: rawCompanyUrl,
      normalized_url: normalizedBaseUrl,
      reachable: true,
      pages_used: pagesUsed,
      pages,
      hiring_page_found: hiringPageFound,
      hiring_content: hiringContent.trim() || undefined,
      about_content: aboutContent.trim() || undefined,
      culture_content: cultureContent.trim() || undefined,
      interview_signals: Array.from(interviewSignals),
      warnings,
    };
  }
}

export const defaultCompanyCrawler = new CompanyCrawler();
