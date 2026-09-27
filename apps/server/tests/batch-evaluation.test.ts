import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  evaluateBatchCases,
  parseArgs,
} from '../src/cli/evaluate.js';
import {
  BatchOutputSchema,
  KitAppendixASchema,
  type BatchCaseInput,
} from '@prep-kit/shared';

describe('Mandatory Batch Evaluation Subsystem Suite', () => {
  const validJd = `
Acme Cloud Infrastructure is seeking a Senior Distributed Systems Engineer.

Responsibilities:
- Build fault-tolerant consensus engines using Raft and Paxos.
- Optimize multi-datacenter data replication and PostgreSQL clusters.
- Collaborate with platform architects and mentor engineers.

Requirements:
- 5+ years of production experience in Go, Rust, or TypeScript (Must)
- Deep expertise in distributed consensus, RPC protocols, and replication (Must)
- Strong experience with Linux kernel performance tuning and Docker (Must)
- Experience with Kubernetes and Terraform infrastructure (Nice)
`;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. CLI Argument Parsing', () => {
    it('parses --input and --output arguments accurately', () => {
      const args = ['--input', 'test-cases.json', '--output', 'test-kits.json'];
      const parsed = parseArgs(args);

      expect(parsed.inputPath).toContain('test-cases.json');
      expect(parsed.outputPath).toContain('test-kits.json');
    });

    it('parses --input=path and --output=path formats', () => {
      const args = ['--input=custom/cases.json', '--output=custom/output.json'];
      const parsed = parseArgs(args);

      expect(parsed.inputPath).toContain('custom');
      expect(parsed.outputPath).toContain('output.json');
    });

    it('exits with error if required arguments are missing', () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
        throw new Error('process.exit called');
      }) as any);

      expect(() => parseArgs(['--input', 'only-input.json'])).toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('2. Batch Evaluation Pipeline Integration', { timeout: 20000 }, () => {
    it('evaluates a successful case and outputs a valid Appendix A kit', async () => {
      const cases: BatchCaseInput[] = [
        {
          id: 'case-success-01',
          jd: validJd,
          company_url: 'https://acme-cloud-platform.internal.local',
          days: 5,
        },
      ];

      const result = await evaluateBatchCases(cases, { allowLocalUrls: true });

      // Check BatchOutputSchema compliance
      const validatedBatch = BatchOutputSchema.parse(result);
      expect(validatedBatch.version).toBe('1.0');
      expect(validatedBatch.kits).toHaveLength(1);

      const caseResult = validatedBatch.kits[0]!;
      expect(caseResult.id).toBe('case-success-01');
      expect(caseResult.status).toBe('ok');
      expect(caseResult.error).toBeNull();
      expect(caseResult.kit).toBeDefined();

      if (caseResult.status === 'ok') {
        // Must strictly satisfy Appendix A schema
        const appendixA = KitAppendixASchema.parse(caseResult.kit);
        expect(appendixA.schedule.days_available).toBe(5);
        expect(appendixA.schedule.days).toHaveLength(5);
        expect(appendixA.questions.length).toBeGreaterThan(0);
        expect(appendixA.flashcards.length).toBeGreaterThan(0);
      }
    });

    it('handles unreachable company site honestly by generating fallback brief and preserving status "ok"', async () => {
      const cases: BatchCaseInput[] = [
        {
          id: 'case-unreachable-02',
          jd: validJd,
          company_url: 'https://this-company-domain-does-not-exist-12345.xyz',
          days: 3,
        },
      ];

      const result = await evaluateBatchCases(cases, { allowLocalUrls: true });
      expect(result.kits).toHaveLength(1);

      const caseResult = result.kits[0]!;
      // A case with partial research/unreachable site must remain "ok" if a valid kit was produced
      expect(caseResult.id).toBe('case-unreachable-02');
      expect(caseResult.status).toBe('ok');
      expect(caseResult.error).toBeNull();
      expect(caseResult.kit).toBeDefined();

      if (caseResult.status === 'ok') {
        expect(caseResult.kit.schedule.days_available).toBe(3);
        expect(caseResult.kit.company_brief.summary).toBeDefined();
      }
    });

    it('rejects malformed JD with status "failed" and descriptive error', async () => {
      const cases: BatchCaseInput[] = [
        {
          id: 'case-malformed-jd-03',
          jd: 'Short', // Less than 10 characters!
          company_url: 'https://example.com',
          days: 4,
        },
      ];

      const result = await evaluateBatchCases(cases, { allowLocalUrls: true });
      expect(result.kits).toHaveLength(1);

      const caseResult = result.kits[0]!;
      expect(caseResult.id).toBe('case-malformed-jd-03');
      expect(caseResult.status).toBe('failed');
      expect(caseResult.kit).toBeNull();
      expect(caseResult.error).toBeDefined();
      expect(caseResult.error?.code).toBe('MALFORMED_JD');
      expect(caseResult.error?.message).toContain('minimum 10 characters');
    });

    it('handles partial research honestly (no public discussion found) with status "ok"', async () => {
      const cases: BatchCaseInput[] = [
        {
          id: 'case-partial-research-04',
          jd: validJd,
          company_url: 'https://stealth-mode-startup-no-discussion.com',
          days: 2,
        },
      ];

      const result = await evaluateBatchCases(cases, { allowLocalUrls: true });
      expect(result.kits).toHaveLength(1);

      const caseResult = result.kits[0]!;
      expect(caseResult.status).toBe('ok');
      expect(caseResult.error).toBeNull();
      expect(caseResult.kit).toBeDefined();

      if (caseResult.status === 'ok') {
        expect(caseResult.kit.schedule.days_available).toBe(2);
        expect(caseResult.kit.schedule.days).toHaveLength(2);
      }
    });

    it('continues processing multiple cases where one fails and records failures honestly', async () => {
      const cases: any[] = [
        // Case 1: Valid (should succeed)
        {
          id: 'batch-case-01',
          jd: validJd,
          company_url: 'https://acme-first-corp.com',
          days: 4,
        },
        // Case 2: Malformed JD (should fail)
        {
          id: 'batch-case-02',
          jd: 'x', // Malformed!
          company_url: 'https://acme-second-corp.com',
          days: 2,
        },
        // Case 3: Valid (should succeed despite case 2 failure)
        {
          id: 'batch-case-03',
          jd: validJd,
          company_url: 'https://acme-third-corp.com',
          days: 3,
        },
      ];

      const result = await evaluateBatchCases(cases, { allowLocalUrls: true });
      expect(result.kits).toHaveLength(3);

      // Case 1: OK
      expect(result.kits[0]!.id).toBe('batch-case-01');
      expect(result.kits[0]!.status).toBe('ok');
      expect(result.kits[0]!.kit).toBeDefined();
      expect(result.kits[0]!.error).toBeNull();

      // Case 2: FAILED
      expect(result.kits[1]!.id).toBe('batch-case-02');
      expect(result.kits[1]!.status).toBe('failed');
      expect(result.kits[1]!.kit).toBeNull();
      expect(result.kits[1]!.error).toBeDefined();

      // Case 3: OK (pipeline continues after case 2 failure)
      expect(result.kits[2]!.id).toBe('batch-case-03');
      expect(result.kits[2]!.status).toBe('ok');
      expect(result.kits[2]!.kit).toBeDefined();
      expect(result.kits[2]!.error).toBeNull();
    });

    it('reads cases from JSON file and writes complete batch output to target destination', async () => {
      const testCasesFile = path.resolve(process.cwd(), 'scratch/test-cases.json');
      const testOutputFile = path.resolve(process.cwd(), 'scratch/test-kits.json');

      const sampleBatch = [
        {
          id: 'file-case-01',
          jd: validJd,
          company_url: 'https://stripe.com',
          days: 3,
        },
      ];

      await fs.mkdir(path.dirname(testCasesFile), { recursive: true });
      await fs.writeFile(testCasesFile, JSON.stringify(sampleBatch, null, 2), 'utf-8');

      // Execute batch from file
      const raw = await fs.readFile(testCasesFile, 'utf-8');
      const loadedCases = JSON.parse(raw);
      const batchResult = await evaluateBatchCases(loadedCases, { allowLocalUrls: true });

      await fs.writeFile(testOutputFile, JSON.stringify(batchResult, null, 2), 'utf-8');

      // Verify file output
      const outputRaw = await fs.readFile(testOutputFile, 'utf-8');
      const parsedOutput = JSON.parse(outputRaw);

      expect(parsedOutput.version).toBe('1.0');
      expect(parsedOutput.kits).toHaveLength(1);
      expect(parsedOutput.kits[0].id).toBe('file-case-01');
      expect(parsedOutput.kits[0].status).toBe('ok');

      // Clean up scratch files
      await fs.unlink(testCasesFile).catch(() => {});
      await fs.unlink(testOutputFile).catch(() => {});
    });
  });
});
