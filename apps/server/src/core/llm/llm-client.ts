import { env } from '../../config/env.js';

export interface LlmGenerationOptions {
  model?: string;
  temperature?: number;
  systemInstruction?: string;
  responseSchema?: Record<string, unknown>;
  maxRetries?: number;
  timeoutMs?: number; // Provider timeout in milliseconds (default: 30000ms)
}

/**
 * Strips markdown code block formatting and trailing commas for robust JSON parsing
 */
export function cleanJsonText(text: string): string {
  if (!text) return '';

  let cleaned = text.trim();

  // Strip markdown code fences if present: ```json ... ``` or ``` ... ```
  const matchFence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (matchFence && matchFence[1]) {
    cleaned = matchFence[1].trim();
  }

  // Extract JSON payload bounded by outermost { ... } or [ ... ]
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIdx = -1;

  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
  }

  if (startIdx !== -1) {
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    const endIdx = Math.max(lastBrace, lastBracket);
    if (endIdx > startIdx) {
      cleaned = cleaned.slice(startIdx, endIdx + 1);
    }
  }

  // Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  return cleaned;
}

export class LlmClient {
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(apiKey?: string, defaultModel?: string) {
    this.apiKey = apiKey ?? env.GEMINI_API_KEY;
    this.defaultModel = defaultModel ?? env.GEMINI_MODEL;
  }

  public isAvailable(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Generates raw string response from Gemini API
   */
  public async generateRawText(
    prompt: string,
    options?: LlmGenerationOptions & { responseMimeType?: string }
  ): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Gemini API key is not configured');
    }

    const model = options?.model ?? this.defaultModel;
    const maxRetries = options?.maxRetries ?? 2;
    const timeoutMs = options?.timeoutMs ?? 30000;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const requestBody: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: options?.responseMimeType ?? 'application/json',
        temperature: options?.temperature ?? 0.2,
      },
    };

    if (options?.systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const err = new Error(`Gemini API HTTP ${response.status}: ${errorText}`);
          (err as { statusCode?: number }).statusCode = response.status;
          const retryAfter = response.headers.get('retry-after');
          if (retryAfter) {
            (err as { retryAfter?: string }).retryAfter = retryAfter;
          }
          throw err;
        }

        const data = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };

        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error('Gemini returned empty or invalid candidate content');
        }

        return rawText;
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        lastError = err;

        const isAbort = (err as Error)?.name === 'AbortError' || controller.signal.aborted;
        const statusCode = (err as { statusCode?: number })?.statusCode;

        if (isAbort) {
          lastError = new Error(`LLM provider request timed out after ${timeoutMs}ms`);
        }

        if (statusCode === 429 || (statusCode && statusCode >= 500) || isAbort) {
          if (attempt < maxRetries) {
            let delay = 1000 * Math.pow(2, attempt) + Math.random() * 500;
            const retryHeader = (err as { retryAfter?: string })?.retryAfter;
            if (retryHeader) {
              const parsedSec = parseInt(retryHeader, 10);
              if (!isNaN(parsedSec) && parsedSec > 0 && parsedSec <= 10) {
                delay = parsedSec * 1000;
              }
            }
            await new Promise((res) => setTimeout(res, delay));
            continue;
          }
        }

        throw lastError;
      }
    }

    throw lastError;
  }

  /**
   * Generates structured JSON output from Gemini API with automated clean-up
   */
  public async generateJson<T>(prompt: string, options?: LlmGenerationOptions): Promise<T> {
    const rawText = await this.generateRawText(prompt, options);

    try {
      return JSON.parse(rawText) as T;
    } catch {
      // Local cleanup repair
      const cleaned = cleanJsonText(rawText);
      try {
        return JSON.parse(cleaned) as T;
      } catch {
        // If still failing, re-throw with the raw snippet so caller's structured repair can handle
        throw new SyntaxError(`Failed to parse JSON response: ${rawText.slice(0, 300)}`);
      }
    }
  }
}

export const defaultLlmClient = new LlmClient();
