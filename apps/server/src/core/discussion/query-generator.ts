/**
 * Query Generator for Public Interview-Process Research
 *
 * Requirements:
 * Research queries should be derived from:
 * - company name
 * - interview
 * - hiring process
 * - interview questions
 * - technical interview
 * - engineering interview
 */

export interface DerivedQuery {
  query: string;
  focus: 'interview_process' | 'hiring_process' | 'interview_questions' | 'technical_interview' | 'engineering_interview' | 'role_specific';
}

/**
 * Clean company name or URL into a clean search brand token
 */
export function sanitizeBrandName(input: string): string {
  if (!input) return '';

  let cleaned = input.trim();

  // If input is a URL or domain, extract hostname
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://') || cleaned.includes('.com') || cleaned.includes('.io') || cleaned.includes('.org')) {
    try {
      const urlStr = cleaned.startsWith('http') ? cleaned : `https://${cleaned}`;
      const parsed = new URL(urlStr);
      const hostParts = parsed.hostname.replace(/^www\./, '').split('.');
      if (hostParts.length >= 1 && hostParts[0]) {
        cleaned = hostParts[0];
      }
    } catch {
      // Fallback
    }
  }

  // Strip common corporate suffixes for search accuracy (e.g. "Stripe, Inc." -> "Stripe")
  cleaned = cleaned.replace(/,\s*(inc|llc|ltd|corp|corporation|technologies|gmbh|co)\.?\b/gi, '');
  cleaned = cleaned.replace(/\s+(inc|llc|ltd|corp|corporation|technologies|gmbh|co)\.?\b/gi, '');

  // Strip trailing punctuation like comma, dot, dash
  cleaned = cleaned.replace(/[.,\-_]+$/, '').trim();

  // Remove dangerous search characters like unescaped quotes
  cleaned = cleaned.replace(/["\\]/g, '').trim();

  // Capitalize first letter if all lowercase
  if (cleaned.length > 0 && cleaned === cleaned.toLowerCase()) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

/**
 * Generate prioritized interview research queries
 */
export function generateInterviewResearchQueries(
  companyName: string,
  roleTitle?: string,
  maxQueries = 5
): DerivedQuery[] {
  const brand = sanitizeBrandName(companyName);
  if (!brand) return [];

  const candidateQueries: DerivedQuery[] = [
    {
      query: `"${brand}" interview process`,
      focus: 'interview_process',
    },
    {
      query: `"${brand}" technical interview`,
      focus: 'technical_interview',
    },
    {
      query: `"${brand}" hiring process`,
      focus: 'hiring_process',
    },
    {
      query: `"${brand}" engineering interview`,
      focus: 'engineering_interview',
    },
    {
      query: `"${brand}" interview questions`,
      focus: 'interview_questions',
    },
  ];

  if (roleTitle && roleTitle.trim()) {
    const cleanRole = roleTitle.replace(/["\\]/g, '').trim();
    candidateQueries.unshift({
      query: `"${brand}" ${cleanRole} interview questions`,
      focus: 'role_specific',
    });
  }

  return candidateQueries.slice(0, maxQueries);
}
