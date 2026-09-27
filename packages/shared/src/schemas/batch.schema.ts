import { z } from 'zod';
import { KitAppendixASchema } from './kit.schema.js';

// Input case shape (Appendix B)
export const BatchCaseInputSchema = z.object({
  id: z.string().min(1, 'Case ID is required'),
  jd: z.string().min(1, 'Job description is required'),
  company_url: z.string().url('Valid URL is required'),
  days: z.number().int().min(1, 'Days must be at least 1'),
});

export const BatchInputListSchema = z.array(BatchCaseInputSchema);

// Error shape for a failed batch case
export const BatchCaseErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

// Output item for a successful case
export const BatchCaseSuccessOutputSchema = z.object({
  id: z.string(),
  status: z.literal('ok'),
  kit: KitAppendixASchema,
  error: z.null(),
});

// Output item for a failed case
export const BatchCaseFailureOutputSchema = z.object({
  id: z.string(),
  status: z.literal('failed'),
  kit: z.null(),
  error: BatchCaseErrorSchema,
});

export const BatchCaseResultSchema = z.discriminatedUnion('status', [
  BatchCaseSuccessOutputSchema,
  BatchCaseFailureOutputSchema,
]);

// Final output file shape (Appendix B)
export const BatchOutputSchema = z.object({
  version: z.string().default('1.0'),
  generated_at: z.string(),
  kits: z.array(BatchCaseResultSchema),
});

export type BatchCaseInput = z.infer<typeof BatchCaseInputSchema>;
export type BatchInputList = z.infer<typeof BatchInputListSchema>;
export type BatchCaseResult = z.infer<typeof BatchCaseResultSchema>;
export type BatchOutput = z.infer<typeof BatchOutputSchema>;
