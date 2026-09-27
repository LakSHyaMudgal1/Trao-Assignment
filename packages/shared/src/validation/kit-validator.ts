import { KitAppendixASchema, type KitAppendixA } from '../schemas/kit.schema.js';

export interface KitValidationError {
  path: string;
  message: string;
  code: string;
}

export interface KitValidationResult {
  isValid: boolean;
  errors: KitValidationError[];
  data?: KitAppendixA;
}

/**
 * Validates a kit data structure strictly against Appendix A specification.
 * Validates types, ranges, references, and uniqueness.
 */
export function validateKitStructure(input: unknown): KitValidationResult {
  const result = KitAppendixASchema.safeParse(input);

  if (result.success) {
    return {
      isValid: true,
      errors: [],
      data: result.data,
    };
  }

  const errors: KitValidationError[] = result.error.errors.map((issue) => {
    let errorCode = 'INVALID_STRUCTURE';

    const msgLower = issue.message.toLowerCase();
    if (msgLower.includes('duplicate')) {
      errorCode = 'DUPLICATE_ID';
    } else if (msgLower.includes('references non-existent requirement') || msgLower.includes('requirement id')) {
      errorCode = 'BROKEN_REQUIREMENT_REFERENCE';
    } else if (msgLower.includes('references non-existent question') || msgLower.includes('question id')) {
      errorCode = 'BROKEN_QUESTION_REFERENCE';
    } else if (issue.path.includes('difficulty')) {
      errorCode = 'INVALID_DIFFICULTY';
    } else if (issue.path.includes('minutes')) {
      errorCode = 'INVALID_MINUTES';
    } else if (issue.path.includes('days_available') || issue.path.includes('days')) {
      errorCode = 'DAYS_MISMATCH';
    }

    return {
      path: issue.path.join('.'),
      message: issue.message,
      code: errorCode,
    };
  });

  return {
    isValid: false,
    errors,
  };
}

/**
 * Asserts that a given kit object conforms to Appendix A structure.
 * Throws a formatted Error with all structural issues if invalid.
 */
export function assertValidKitStructure(input: unknown): KitAppendixA {
  const validation = validateKitStructure(input);
  if (!validation.isValid || !validation.data) {
    const errorDetails = validation.errors.map((e) => `[${e.code}] ${e.path}: ${e.message}`).join('; ');
    throw new Error(`Kit structural validation failed: ${errorDetails}`);
  }
  return validation.data;
}
