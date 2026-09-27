import type { ExtractedLink, ScoredLink, LinkCategory } from './research.types.js';

interface KeywordRule {
  term: string;
  weight: number;
  category: LinkCategory;
}

const POSITIVE_KEYWORDS: KeywordRule[] = [
  // High-value hiring & interview process
  { term: 'interview', weight: 40, category: 'hiring' },
  { term: 'how we hire', weight: 40, category: 'hiring' },
  { term: 'hiring', weight: 35, category: 'hiring' },
  { term: 'careers', weight: 30, category: 'hiring' },
  { term: 'jobs', weight: 30, category: 'hiring' },
  { term: 'join our team', weight: 30, category: 'hiring' },
  { term: 'work with us', weight: 30, category: 'hiring' },
  { term: 'open roles', weight: 28, category: 'hiring' },
  { term: 'open positions', weight: 28, category: 'hiring' },
  { term: 'handbook', weight: 25, category: 'hiring' }, // Important for PostHog, GitLab, Basecamp
  { term: 'engineering', weight: 20, category: 'culture' },
  { term: 'culture', weight: 20, category: 'culture' },
  { term: 'values', weight: 18, category: 'culture' },
  { term: 'life at', weight: 20, category: 'culture' },
  { term: 'people', weight: 15, category: 'culture' },

  // Company About & Overview
  { term: 'about us', weight: 20, category: 'about' },
  { term: 'about', weight: 15, category: 'about' },
  { term: 'mission', weight: 15, category: 'about' },
  { term: 'what we do', weight: 18, category: 'about' },
  { term: 'company', weight: 12, category: 'about' },
  { term: 'overview', weight: 10, category: 'about' },
  { term: 'leadership', weight: 10, category: 'about' },
];

const NEGATIVE_KEYWORDS: Array<{ term: string; penalty: number }> = [
  { term: 'login', penalty: 50 },
  { term: 'signin', penalty: 50 },
  { term: 'signup', penalty: 50 },
  { term: 'register', penalty: 50 },
  { term: 'auth', penalty: 40 },
  { term: 'privacy', penalty: 60 },
  { term: 'terms', penalty: 60 },
  { term: 'legal', penalty: 60 },
  { term: 'cookie', penalty: 60 },
  { term: 'pricing', penalty: 40 },
  { term: 'cart', penalty: 50 },
  { term: 'checkout', penalty: 50 },
  { term: 'shop', penalty: 40 },
  { term: 'store', penalty: 40 },
  { term: 'help', penalty: 30 },
  { term: 'support', penalty: 30 },
  { term: 'status', penalty: 30 },
  { term: 'feed', penalty: 40 },
  { term: 'rss', penalty: 40 },
];

export class LinkScorer {
  /**
   * Scores and ranks candidate links based on anchor text, URL pathname, and keyword heuristics.
   */
  scoreAndRank(links: ExtractedLink[]): ScoredLink[] {
    const scored: ScoredLink[] = links.map((link) => {
      let score = 0;
      const signals: string[] = [];
      let category: LinkCategory = 'general';

      const anchorLower = link.anchorText.toLowerCase();
      let pathLower = '';
      try {
        pathLower = new URL(link.normalizedUrl).pathname.toLowerCase();
      } catch {
        pathLower = '';
      }

      // 1. Evaluate positive signals
      for (const rule of POSITIVE_KEYWORDS) {
        let matched = false;

        // Anchor text matching (higher confidence)
        if (anchorLower.includes(rule.term)) {
          score += rule.weight;
          matched = true;
        }

        // URL path matching
        if (pathLower.includes(rule.term.replace(/\s+/g, '-')) || pathLower.includes(rule.term.replace(/\s+/g, ''))) {
          score += Math.round(rule.weight * 0.9);
          matched = true;
        }

        if (matched) {
          signals.push(rule.term);
          if (category === 'general' || rule.category === 'hiring') {
            category = rule.category;
          }
        }
      }

      // 2. Evaluate penalties (utility links, legal, auth)
      for (const penalty of NEGATIVE_KEYWORDS) {
        if (anchorLower.includes(penalty.term) || pathLower.includes(penalty.term)) {
          score -= penalty.penalty;
        }
      }

      // Bonus for short clean paths (e.g. /careers is better than /careers/page/2/filter)
      const pathSegments = pathLower.split('/').filter(Boolean);
      if (pathSegments.length > 0 && pathSegments.length <= 3) {
        score += 5;
      }

      return {
        ...link,
        score,
        signals,
        category,
      };
    });

    // Filter out negatively scored links and sort descending by score
    return scored
      .filter((link) => link.score > 0)
      .sort((a, b) => b.score - a.score);
  }
}

export const defaultLinkScorer = new LinkScorer();
