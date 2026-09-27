import { validateAndNormalizeUrl } from './url-validator.js';
import type { CrawledPage, FetchOptions } from './research.types.js';

export interface FetchPageResult {
  success: boolean;
  page?: CrawledPage;
  error?: {
    code: string;
    message: string;
    status?: number;
  };
}

export class PageFetcher {
  private lastRequestTimes = new Map<string, number>();
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxBytes: number;
  private readonly defaultRetries: number;
  private readonly minDomainIntervalMs: number = 200; // Rate limit between requests to same domain

  constructor(options?: { timeoutMs?: number; maxBytes?: number; maxRetries?: number }) {
    this.defaultTimeoutMs = options?.timeoutMs ?? 5000;
    this.defaultMaxBytes = options?.maxBytes ?? 2 * 1024 * 1024; // 2MB
    this.defaultRetries = options?.maxRetries ?? 2;
  }

  /**
   * Enforces rate limiting per host origin.
   */
  private async enforceRateLimit(url: string): Promise<void> {
    try {
      const origin = new URL(url).origin;
      const lastTime = this.lastRequestTimes.get(origin) || 0;
      const elapsed = Date.now() - lastTime;
      if (elapsed < this.minDomainIntervalMs) {
        await new Promise((res) => setTimeout(res, this.minDomainIntervalMs - elapsed));
      }
      this.lastRequestTimes.set(origin, Date.now());
    } catch {
      // ignore
    }
  }

  /**
   * Fetches an individual web page with SSRF validation, redirect validation,
   * size limiting, timeout, and transient-only retry.
   */
  async fetchPage(targetUrl: string, options?: FetchOptions): Promise<FetchPageResult> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const maxBytes = options?.maxBytes ?? this.defaultMaxBytes;
    const maxRetries = options?.maxRetries ?? this.defaultRetries;
    const allowLocal =
      options?.allowLocal ??
      (process.env.NODE_ENV === 'production' ? false : true);

    // 1. Initial SSRF and Protocol Validation
    let currentUrl: string;
    try {
      currentUrl = await validateAndNormalizeUrl(targetUrl, allowLocal);
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: err.code || 'URL_VALIDATION_FAILED',
          message: err.message,
        },
      };
    }

    let attempt = 0;
    while (attempt <= maxRetries) {
      attempt++;
      await this.enforceRateLimit(currentUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        let activeUrl = currentUrl;
        let redirectCount = 0;
        const maxRedirects = 5;
        const visitedUrls = new Set<string>([activeUrl]);
        let response: Response;

        // Manual redirect-following loop with per-hop SSRF validation
        while (true) {
          response = await fetch(activeUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI-Interview-Prep-Kit-ResearchBot/1.0',
              'Accept': 'text/html,application/xhtml+xml',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'manual',
          });

          // Check for HTTP 3xx redirect status
          const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
          if (!isRedirect) {
            break;
          }

          const locationHeader = response.headers.get('location');
          if (!locationHeader) {
            clearTimeout(timeoutId);
            return {
              success: false,
              error: {
                code: 'REDIRECT_WITHOUT_LOCATION',
                message: `HTTP redirect ${response.status} missing Location header`,
                status: response.status,
              },
            };
          }

          redirectCount++;
          if (redirectCount > maxRedirects) {
            clearTimeout(timeoutId);
            return {
              success: false,
              error: {
                code: 'MAX_REDIRECTS_EXCEEDED',
                message: `Exceeded maximum redirect limit of ${maxRedirects} hops`,
              },
            };
          }

          // Resolve relative or absolute URL against current page URL
          let resolvedLocation: string;
          try {
            resolvedLocation = new URL(locationHeader, activeUrl).toString();
          } catch {
            clearTimeout(timeoutId);
            return {
              success: false,
              error: {
                code: 'INVALID_REDIRECT_URL',
                message: `Malformed redirect location "${locationHeader}"`,
              },
            };
          }

          // Strict SSRF and loopback validation on redirect destination
          try {
            activeUrl = await validateAndNormalizeUrl(resolvedLocation, allowLocal);
          } catch (err: any) {
            clearTimeout(timeoutId);
            return {
              success: false,
              error: {
                code: err.code || 'SSRF_REDIRECT_PROHIBITED',
                message: `Redirect destination prohibited: ${err.message}`,
              },
            };
          }

          if (visitedUrls.has(activeUrl)) {
            clearTimeout(timeoutId);
            return {
              success: false,
              error: {
                code: 'REDIRECT_LOOP',
                message: `Redirect loop detected at ${activeUrl}`,
              },
            };
          }
          visitedUrls.add(activeUrl);
        }

        clearTimeout(timeoutId);

        const status = response.status;
        const finalUrl = response.url || activeUrl;

        // If mock or custom fetch resolved a finalUrl, perform safety check
        if (response.url && response.url !== currentUrl) {
          try {
            await validateAndNormalizeUrl(response.url, allowLocal);
          } catch (err: any) {
            return {
              success: false,
              error: {
                code: err.code || 'SSRF_REDIRECT_PROHIBITED',
                message: `Final destination prohibited: ${err.message}`,
              },
            };
          }
        }

        // Rate limiting response (429): retry with exponential backoff / retry-after
        if (status === 429) {
          if (attempt <= maxRetries) {
            const retryAfterHeader = response.headers.get('retry-after');
            let delayMs = Math.pow(2, attempt) * 400 + Math.random() * 150;
            if (retryAfterHeader) {
              const parsedSec = parseInt(retryAfterHeader, 10);
              if (!isNaN(parsedSec) && parsedSec > 0 && parsedSec <= 10) {
                delayMs = parsedSec * 1000;
              }
            }
            await new Promise((res) => setTimeout(res, delayMs));
            continue;
          }
          return {
            success: false,
            error: {
              code: 'HTTP_429',
              message: 'Rate limit exceeded (HTTP 429)',
              status: 429,
            },
          };
        }

        // Non-transient client errors: fail immediately without retrying
        if (status === 404) {
          return {
            success: false,
            error: { code: 'HTTP_404', message: `Page not found: ${status}`, status: 404 },
          };
        }

        if (status === 401 || status === 403) {
          return {
            success: false,
            error: { code: 'HTTP_FORBIDDEN', message: `Access prohibited: ${status}`, status },
          };
        }

        if (status === 400 || status === 405 || status === 410 || status === 422) {
          return {
            success: false,
            error: { code: `HTTP_${status}`, message: `Client error: ${status}`, status },
          };
        }

        // Transient server errors (500, 502, 503, 504): retry with exponential backoff
        if (status >= 500 && status <= 599) {
          if (attempt <= maxRetries) {
            const backoff = Math.pow(2, attempt) * 200 + Math.random() * 100;
            await new Promise((res) => setTimeout(res, backoff));
            continue;
          }
          return {
            success: false,
            error: { code: `HTTP_${status}`, message: `Server error ${status}`, status },
          };
        }

        // Validate Content-Type
        const rawContentType = response.headers.get('content-type') || '';
        const contentType = rawContentType.toLowerCase();
        if (
          !contentType.includes('text/html') &&
          !contentType.includes('application/xhtml+xml') &&
          !contentType.includes('text/plain')
        ) {
          return {
            success: false,
            error: {
              code: 'INVALID_CONTENT_TYPE',
              message: `Unexpected content type: ${rawContentType}`,
            },
          };
        }

        // Size-limited stream reading
        const reader = response.body?.getReader();
        if (!reader) {
          const text = await response.text();
          return {
            success: true,
            page: {
              url: currentUrl,
              finalUrl,
              httpStatus: status,
              title: '',
              textContent: text,
              byteSize: Buffer.byteLength(text, 'utf-8'),
              contentType: rawContentType,
            },
          };
        }

        const chunks: Uint8Array[] = [];
        let totalBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.length;
            if (totalBytes > maxBytes) {
              controller.abort();
              return {
                success: false,
                error: {
                  code: 'PAYLOAD_TOO_LARGE',
                  message: `Response size exceeded maximum limit of ${maxBytes} bytes`,
                },
              };
            }
            chunks.push(value);
          }
        }

        const buffer = Buffer.concat(chunks);
        const textContent = buffer.toString('utf-8');

        return {
          success: true,
          page: {
            url: currentUrl,
            finalUrl,
            httpStatus: status,
            title: '',
            textContent,
            byteSize: totalBytes,
            contentType: rawContentType,
          },
        };
      } catch (err: any) {
        clearTimeout(timeoutId);

        const isAbort = err.name === 'AbortError' || controller.signal.aborted;
        const isNetworkErr =
          err.code === 'ECONNRESET' ||
          err.code === 'ETIMEDOUT' ||
          err.message?.includes('fetch failed');

        // Only retry transient network drops and timeouts
        if ((isAbort || isNetworkErr) && attempt <= maxRetries) {
          const backoff = Math.pow(2, attempt) * 200 + Math.random() * 100;
          await new Promise((res) => setTimeout(res, backoff));
          continue;
        }

        return {
          success: false,
          error: {
            code: isAbort ? 'TIMEOUT' : 'FETCH_ERROR',
            message: isAbort ? `Request timed out after ${timeoutMs}ms` : err.message,
          },
        };
      }
    }

    return {
      success: false,
      error: { code: 'MAX_RETRIES_EXCEEDED', message: 'Failed after multiple retry attempts' },
    };
  }
}

export const defaultPageFetcher = new PageFetcher();
