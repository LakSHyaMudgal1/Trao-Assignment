import type { RawSearchResult, CleanedDiscussionSource } from './discussion.types.js';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'ref_src',
  'fbclid',
  'gclid',
  'trk',
  'session_id',
  'source',
  'source_id',
  'mc_cid',
  'mc_eid',
  '_hsenc',
  '_hsmi',
]);

/**
 * Normalizes a URL for deduplication
 */
export function normalizeSourceUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);

    // Force lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();

    // Strip hash fragment
    parsed.hash = '';

    // Strip tracking query params
    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      parsed.searchParams.delete(key);
    }

    // Sort search params for canonical ordering
    parsed.searchParams.sort();

    // Remove trailing slash on paths longer than 1 character
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    // If not a valid URL, return trimmed original
    return rawUrl.trim();
  }
}

/**
 * Extract clean domain name from URL
 */
export function extractDomain(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return 'unknown';
  }
}

/**
 * Deduplicate raw search results across multiple queries
 */
export function deduplicateSources(
  rawResults: RawSearchResult[],
  nowIso: string = new Date().toISOString()
): CleanedDiscussionSource[] {
  const urlMap = new Map<string, CleanedDiscussionSource>();

  for (const raw of rawResults) {
    if (!raw.url) continue;

    const normalizedUrl = normalizeSourceUrl(raw.url);
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      continue;
    }

    const domain = extractDomain(normalizedUrl);
    const existing = urlMap.get(normalizedUrl);

    if (!existing) {
      urlMap.set(normalizedUrl, {
        url: normalizedUrl,
        title: raw.title?.trim() || domain,
        snippet: raw.snippet?.trim() || '',
        domain,
        crawled_at: nowIso,
      });
    } else {
      // Merge best title
      if ((raw.title?.trim().length || 0) > existing.title.length) {
        existing.title = raw.title.trim();
      }

      // Merge snippet if new snippet offers additional distinct text
      const newSnippet = raw.snippet?.trim() || '';
      if (newSnippet && !existing.snippet.includes(newSnippet)) {
        if (!newSnippet.includes(existing.snippet)) {
          // If neither contains the other, append up to a safe length
          const combined = `${existing.snippet} ... ${newSnippet}`;
          existing.snippet = combined.slice(0, 1000);
        } else {
          // New snippet is longer and contains existing
          existing.snippet = newSnippet.slice(0, 1000);
        }
      }
    }
  }

  return Array.from(urlMap.values());
}
