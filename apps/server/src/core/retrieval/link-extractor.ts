import * as cheerio from 'cheerio';
import type { ExtractedLink } from './research.types.js';

const ASSET_EXTENSIONS = [
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
  '.css', '.js', '.zip', '.tar', '.gz', '.mp4', '.mp3', '.woff', '.woff2', '.ttf'
];

export class LinkExtractor {
  /**
   * Extracts and normalizes internal anchor links from raw HTML.
   * Resolves relative URLs against baseUrl (including redirected finalUrl).
   */
  extract(rawHtml: string, baseUrl: string): ExtractedLink[] {
    const $ = cheerio.load(rawHtml);
    let baseParsed: URL;
    try {
      baseParsed = new URL(baseUrl);
    } catch {
      return [];
    }

    const baseHost = baseParsed.host.toLowerCase();
    const links: ExtractedLink[] = [];
    const seenUrls = new Set<string>();

    $('a[href]').each((_, el) => {
      const rawHref = $(el).attr('href')?.trim();
      if (!rawHref) return;

      // Ignore javascript, mailto, tel, and fragment-only links
      const lowerHref = rawHref.toLowerCase();
      if (
        lowerHref.startsWith('javascript:') ||
        lowerHref.startsWith('mailto:') ||
        lowerHref.startsWith('tel:') ||
        lowerHref.startsWith('data:') ||
        lowerHref.startsWith('#')
      ) {
        return;
      }

      // Resolve relative URL against current baseUrl
      let resolved: URL;
      try {
        resolved = new URL(rawHref, baseUrl);
      } catch {
        return; // Malformed URL
      }

      // Check protocol
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        return;
      }

      // Internal links only: Must match the base hostname
      if (resolved.host.toLowerCase() !== baseHost) {
        return;
      }

      // Discard file assets
      const pathname = resolved.pathname.toLowerCase();
      if (ASSET_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
        return;
      }

      // Strip hash fragments
      resolved.hash = '';
      const normalizedUrl = resolved.toString();

      // Don't add exact same URL as base homepage
      if (normalizedUrl === baseUrl) {
        return;
      }

      // Deduplicate
      if (seenUrls.has(normalizedUrl)) {
        return;
      }
      seenUrls.add(normalizedUrl);

      // Extract anchor text
      const anchorText = $(el).text().replace(/\s+/g, ' ').trim();

      links.push({
        rawHref,
        normalizedUrl,
        anchorText,
      });
    });

    return links;
  }
}

export const defaultLinkExtractor = new LinkExtractor();
