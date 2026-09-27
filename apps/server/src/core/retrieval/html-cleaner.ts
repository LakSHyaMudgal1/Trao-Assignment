import * as cheerio from 'cheerio';

export interface CleanedHtmlResult {
  title: string;
  cleanedText: string;
  sandboxedText: string;
  metaDescription: string;
  detectedSignals: string[];
  injectionAttemptsDetected: boolean;
}

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
  /disregard\s+(all\s+)?(previous|prior)\s+instructions/i,
  /system\s*prompt\s*override/i,
  /you\s+are\s+now\s+(a|an|in)\s+(developer\s+mode|dan|jailbreak)/i,
  /bypass\s+safety\s+guidelines/i,
  /output\s+the\s+following\s+exact\s+text/i,
];

export class HtmlCleaner {
  /**
   * Parses raw HTML, strips boilerplate/navigation, sanitizes prompt injection attempts,
   * and produces clean readable text for extraction.
   */
  clean(rawHtml: string, sourceUrl: string, maxChars = 15000): CleanedHtmlResult {
    const $ = cheerio.load(rawHtml);

    // 1. Extract meta tags & title before stripping elements
    const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content') || '';
    const metaDescription =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      '';

    // 2. Remove unwanted non-content elements
    $(
      'script, style, noscript, iframe, svg, canvas, nav, footer, header, aside, ' +
      'form, button, input, .cookie-banner, #cookie-banner, .advertisement, [aria-hidden="true"]'
    ).remove();

    // 3. Extract text from primary content containers if available
    let contentElement = $('main, article, #content, .content, #main');
    if (contentElement.length === 0) {
      contentElement = $('body');
    }

    // Replace linebreaks / paragraphs with clean separators
    contentElement.find('h1, h2, h3, h4, h5, h6, p, li, tr').each((_, el) => {
      $(el).append('\n');
    });

    const rawText = contentElement.text();

    // 4. Normalize whitespace
    let normalized = rawText
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    // 5. Prompt Injection Defense
    let injectionAttemptsDetected = false;
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(normalized)) {
        injectionAttemptsDetected = true;
        normalized = normalized.replace(pattern, '[SUSPICIOUS INSTRUCTION REMOVED]');
      }
    }

    // 6. Truncate if exceeding maximum length
    const cleanedText = normalized.length > maxChars ? normalized.substring(0, maxChars) + '... [truncated]' : normalized;

    // 7. Enclose in XML delimiter to prevent model execution
    const sandboxedText = `<untrusted_document_context source="${sourceUrl}">\n${cleanedText}\n</untrusted_document_context>`;

    // 8. Extract signals (e.g. interview, hiring, tech stack)
    const detectedSignals: string[] = [];
    const lower = cleanedText.toLowerCase();
    if (lower.includes('interview') || lower.includes('hiring process') || lower.includes('take-home')) {
      detectedSignals.push('interview_process');
    }
    if (lower.includes('careers') || lower.includes('open roles') || lower.includes('job openings')) {
      detectedSignals.push('hiring_portal');
    }
    if (lower.includes('values') || lower.includes('culture') || lower.includes('principles')) {
      detectedSignals.push('culture_and_values');
    }
    if (lower.includes('tech stack') || lower.includes('engineering handbook') || lower.includes('architecture')) {
      detectedSignals.push('engineering_culture');
    }

    return {
      title,
      cleanedText,
      sandboxedText,
      metaDescription,
      detectedSignals,
      injectionAttemptsDetected,
    };
  }
}

export const defaultHtmlCleaner = new HtmlCleaner();
