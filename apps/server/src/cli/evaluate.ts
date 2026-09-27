#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BatchCaseInputSchema,
  type BatchCaseInput,
  type BatchCaseResult,
  type BatchOutput,
} from '@prep-kit/shared';
import { ResearchOrchestrator } from '../pipeline/research-orchestrator.js';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';

// Read environment variables (e.g. from root or current dir .env)
dotenv.config();

export interface CliArgs {
  inputPath: string;
  outputPath: string;
}

export function parseArgs(args: string[]): CliArgs {
  let inputPath = '';
  let outputPath = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === '--help' || arg === '-h') {
      console.log(`
AI Interview Prep Kit - Mandatory Batch Evaluation CLI

Usage:
  npm run evaluate -- --input <cases.json> --output <kits.json>

Options:
  --input, -i   Path to the input JSON file containing test cases array
  --output, -o  Path to the output JSON destination file
  --help, -h    Display this help message
`);
      process.exit(0);
    }

    if (arg === '--input' || arg === '-i') {
      if (args[i + 1]) {
        inputPath = args[i + 1]!;
        i++;
      }
    } else if (arg.startsWith('--input=')) {
      inputPath = arg.slice('--input='.length);
    } else if (arg === '--output' || arg === '-o') {
      if (args[i + 1]) {
        outputPath = args[i + 1]!;
        i++;
      }
    } else if (arg.startsWith('--output=')) {
      outputPath = arg.slice('--output='.length);
    }
  }

  if (!inputPath || !outputPath) {
    console.error('Error: Both --input and --output arguments are required.');
    console.error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');
    process.exit(1);
  }

  return {
    inputPath: path.resolve(process.cwd(), inputPath),
    outputPath: path.resolve(process.cwd(), outputPath),
  };
}

export interface BatchEvaluationOptions {
  allowLocalUrls?: boolean;
}

/**
 * Executes batch evaluation sequentially across an array of cases.
 * Uses the exact same 17-stage research orchestration pipeline as the web application.
 * Continues after individual case failures and records failure details.
 */
export async function evaluateBatchCases(
  rawCases: unknown[],
  options?: BatchEvaluationOptions
): Promise<BatchOutput> {
  const orchestrator = new ResearchOrchestrator();
  const results: BatchCaseResult[] = [];

  for (let i = 0; i < rawCases.length; i++) {
    const rawCase = rawCases[i] as any;
    const caseId = rawCase && typeof rawCase === 'object' && rawCase.id ? String(rawCase.id) : `case-${i + 1}`;
    logger.info(`[${i + 1}/${rawCases.length}] Processing case "${caseId}"...`);

    // 1. Validate individual case schema
    const validation = BatchCaseInputSchema.safeParse(rawCase);
    if (!validation.success) {
      const errorMsg = validation.error.issues.map((iss) => iss.message).join('; ');
      logger.error(`✗ Case "${caseId}" failed validation: ${errorMsg}`);
      results.push({
        id: caseId,
        status: 'failed',
        kit: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Malformed case input: ${errorMsg}`,
        },
      });
      continue;
    }

    const tc: BatchCaseInput = validation.data;

    // 2. Validate JD minimum substantive content
    if (!tc.jd || tc.jd.trim().length < 10) {
      logger.error(`✗ Case "${caseId}" has malformed/empty JD`);
      results.push({
        id: caseId,
        status: 'failed',
        kit: null,
        error: {
          code: 'MALFORMED_JD',
          message: 'Job description is too short or empty (minimum 10 characters required).',
        },
      });
      continue;
    }

    // 3. Execute exact sequential pipeline
    try {
      const executionResult = await orchestrator.execute({
        userId: 'eval_user_batch',
        caseId: tc.id,
        companyUrl: tc.company_url,
        jd: tc.jd,
        days: tc.days,
        allowLocalUrls: options?.allowLocalUrls ?? true,
      });

      // A case with partial research remains status "ok" if a valid kit was produced
      results.push({
        id: tc.id,
        status: 'ok',
        kit: executionResult.kit,
        error: null,
      });
      logger.info(`✓ Case "${tc.id}" generated successfully.`);
    } catch (err: any) {
      // Use "failed" only when a kit cannot be produced at all
      logger.error(`✗ Case "${tc.id}" pipeline execution failed: ${err.message}`);
      results.push({
        id: tc.id,
        status: 'failed',
        kit: null,
        error: {
          code: err.code || 'PIPELINE_ERROR',
          message: err.message || 'Execution failed',
        },
      });
    }
  }

  return {
    version: '1.0',
    generated_at: new Date().toISOString(),
    kits: results,
  };
}

export async function main() {
  const { inputPath, outputPath } = parseArgs(process.argv.slice(2));

  logger.info(`Evaluating test cases from: ${inputPath}`);
  logger.info(`Writing generated kits to: ${outputPath}`);

  try {
    const rawData = await fs.readFile(inputPath, 'utf-8');
    const cases = JSON.parse(rawData);

    if (!Array.isArray(cases)) {
      throw new Error('Input cases file must contain a JSON array of test cases.');
    }

    logger.info(`Loaded ${cases.length} test cases for evaluation.`);

    const batchOutput = await evaluateBatchCases(cases);

    // Ensure destination directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(batchOutput, null, 2), 'utf-8');

    const okCount = batchOutput.kits.filter((k) => k.status === 'ok').length;
    const failedCount = batchOutput.kits.filter((k) => k.status === 'failed').length;

    logger.info(`Evaluation complete: ${okCount} ok, ${failedCount} failed of ${batchOutput.kits.length} total.`);
    logger.info(`Output written to: ${outputPath}`);
  } catch (error: any) {
    logger.error(`Error processing batch evaluation: ${error.message}`);
    process.exit(1);
  }
}

// Cross-platform check whether this module was invoked directly
function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  try {
    const currentFilePath = fileURLToPath(import.meta.url).toLowerCase().replace(/\\/g, '/');
    const executedFilePath = path.resolve(process.argv[1]).toLowerCase().replace(/\\/g, '/');
    return currentFilePath === executedFilePath || process.argv[1].includes('evaluate');
  } catch {
    return true;
  }
}

if (isMainModule()) {
  main().catch((err) => {
    logger.error(`Fatal CLI execution error: ${err.message}`);
    process.exit(1);
  });
}
