import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResearchOrchestrator } from '../src/pipeline/research-orchestrator.js';
import { MockSearchProvider } from '../src/core/discussion/providers/mock-search-provider.js';
import { PublicInterviewResearchService } from '../src/core/discussion/public-interview-research.service.js';
import { KitAppendixASchema } from '@prep-kit/shared';
import type { PipelineProgressEvent } from '../src/pipeline/pipeline.types.js';

describe('Research Orchestration Pipeline Suite', () => {
  let mockSearchProvider: MockSearchProvider;
  let publicResearch: PublicInterviewResearchService;
  let orchestrator: ResearchOrchestrator;
  let mockKitRepo: any;
  let mockJobRepo: any;

  const sampleJd = `
Acme Corporation is looking for a Senior Full-Stack Engineer to join our Core Platform team.

About the Role:
You will design, develop, and scale high-throughput web applications and internal tools.

Responsibilities:
- Build reliable REST and GraphQL APIs in Node.js and TypeScript.
- Design responsive, accessible frontend interfaces with React and Next.js.
- Partner with product managers and infrastructure teams to deliver enterprise capabilities.
- Mentor junior engineers and participate in architecture design reviews.

Requirements:
- 5+ years of production experience with TypeScript, React, and Node.js. (Must)
- Deep understanding of distributed systems, relational databases (PostgreSQL), and caching (Redis). (Must)
- Strong experience with containerization (Docker) and cloud deployments (AWS/GCP). (Must)
- Excellent communication and cross-functional leadership skills. (Must)
- Experience in fintech or payment processing systems. (Nice to have)
- Familiarity with Kubernetes and Terraform. (Nice to have)
`;

  beforeEach(() => {
    mockSearchProvider = new MockSearchProvider();
    publicResearch = new PublicInterviewResearchService(mockSearchProvider, {
      rateLimiterMs: 0,
      maxQueries: 2,
    });

    // Provide mock search results with authentic discussion
    mockSearchProvider.setDefaultResults([
      {
        url: 'https://www.glassdoor.com/Interview/Acme-Corp-Questions.htm',
        title: 'Acme Corp Senior Engineer Interview Experience',
        snippet: 'The interview process consists of a recruiter screen, followed by a take-home coding challenge and a 45-minute system design round.',
      },
    ]);

    // Create orchestrator with in-memory persistence mock
    mockKitRepo = {
      create: vi.fn().mockImplementation(async (data: any) => ({
        _id: 'mock_kit_id_12345',
        ...data,
      })),
    };

    mockJobRepo = {
      updateStage: vi.fn().mockResolvedValue(null),
      updateProgress: vi.fn().mockResolvedValue(null),
      completeJob: vi.fn().mockResolvedValue(null),
    };

    orchestrator = new ResearchOrchestrator({
      publicResearch,
      kitRepo: mockKitRepo,
      jobRepo: mockJobRepo,
    });
  });

  describe('1. Full 17-Stage Sequential Execution', () => {
    it('executes all 17 stages sequentially with persistent progress and useful outputs', async () => {
      const progressEvents: PipelineProgressEvent[] = [];

      const result = await orchestrator.execute({
        userId: '507f1f77bcf86cd799439011',
        companyUrl: 'https://example.com',
        jd: sampleJd,
        days: 5,
        allowLocalUrls: true,
        onProgress: (ev) => {
          progressEvents.push(ev);
        },
      });

      // 1. Verify result structure
      expect(result.kit).toBeDefined();
      expect(result.kitId).toBeDefined();
      expect(result.stages).toHaveLength(17);

      // 2. Verify all stage IDs and sequential ordering
      const stageIds = result.stages.map((s) => s.id);
      expect(stageIds).toEqual([
        'validate_input',
        'extract_requirements',
        'fetch_homepage',
        'crawl_links',
        'find_about_pages',
        'find_hiring_pages',
        'search_discussion',
        'consolidate_research',
        'generate_brief',
        'generate_categorized_questions',
        'generate_flashcards',
        'coverage_check_1',
        'generate_uncovered_questions',
        'coverage_check_2',
        'generate_schedule',
        'validate_kit',
        'persist_kit',
      ]);

      // 3. Verify each stage has status, startedAt, completedAt, and usefulOutput
      for (const stage of result.stages) {
        expect(['completed', 'skipped']).toContain(stage.status);
        expect(stage.startedAt).toBeDefined();
        expect(stage.completedAt).toBeDefined();
        expect(stage.usefulOutput).toBeDefined();
      }

      // 4. Verify progress events were emitted
      expect(progressEvents.length).toBeGreaterThanOrEqual(17);
      const lastEvent = progressEvents[progressEvents.length - 1];
      expect(lastEvent?.progressPercent).toBe(100);
    });
  });

  describe('2. Deterministic Coverage Checking & Two-Pass Generation', () => {
    it('runs pass 1 audit, covers gaps in pass 2, and produces valid coverage object', async () => {
      const result = await orchestrator.execute({
        userId: '507f1f77bcf86cd799439011',
        companyUrl: 'https://example.com',
        jd: sampleJd,
        days: 7,
        allowLocalUrls: true,
      });

      const { coverage, role, questions } = result.kit;

      // Verify passes count
      expect(coverage.passes).toBeGreaterThanOrEqual(1);

      // Verify all question requirement references point to real requirement IDs
      const validReqIds = new Set(role.requirements.map((r) => r.id));
      for (const q of questions) {
        expect(q.requirement_ids.length).toBeGreaterThan(0);
        for (const reqId of q.requirement_ids) {
          expect(validReqIds.has(reqId)).toBe(true);
        }
      }

      // Verify coverage uncovered IDs are valid
      for (const uncId of coverage.uncovered_requirement_ids) {
        expect(validReqIds.has(uncId)).toBe(true);
      }
    });
  });

  describe('3. Deterministic Schedule Allocation', () => {
    it('creates schedule with exactly requested days and integer positive minutes', async () => {
      const requestedDays = 4;
      const result = await orchestrator.execute({
        userId: '507f1f77bcf86cd799439011',
        companyUrl: 'https://example.com',
        jd: sampleJd,
        days: requestedDays,
        allowLocalUrls: true,
      });

      const schedule = result.kit.schedule;
      expect(schedule.days_available).toBe(requestedDays);
      expect(schedule.days).toHaveLength(requestedDays);

      const allQuestionIds = new Set(result.kit.questions.map((q) => q.id));

      schedule.days.forEach((day, idx) => {
        expect(day.day).toBe(idx + 1);
        expect(day.focus).toBeTruthy();
        expect(Number.isInteger(day.minutes)).toBe(true);
        expect(day.minutes).toBeGreaterThan(0);

        // Every question_id in schedule refers to an existing question
        for (const qId of day.question_ids) {
          expect(allQuestionIds.has(qId)).toBe(true);
        }
      });
    });
  });

  describe('4. Appendix A Schema Compliance', () => {
    it('strictly satisfies all constraints of KitAppendixASchema', async () => {
      const result = await orchestrator.execute({
        userId: '507f1f77bcf86cd799439011',
        companyUrl: 'https://example.com',
        jd: sampleJd,
        days: 3,
        allowLocalUrls: true,
      });

      // Will throw if any constraint of Appendix A is violated
      const validated = KitAppendixASchema.parse(result.kit);
      expect(validated).toBeDefined();

      // Check questions difficulty 1-3
      for (const q of validated.questions) {
        expect([1, 2, 3]).toContain(q.difficulty);
      }

      // Check flashcard structure
      for (const fc of validated.flashcards) {
        expect(fc.front).toBeTruthy();
        expect(fc.back).toBeTruthy();
        expect(fc.requirement_ids.length).toBeGreaterThan(0);
      }
    });
  });

  describe('5. Optional Research Failure & Honest Reporting', () => {
    it('does not fail pipeline when company website is unreachable', async () => {
      // Create crawler that fails
      const failingCrawler: any = {
        crawlCompany: vi.fn().mockRejectedValue(new Error('Connection refused: ENOTFOUND')),
      };

      const resilientOrchestrator = new ResearchOrchestrator({
        crawler: failingCrawler,
        publicResearch,
        kitRepo: mockKitRepo,
        jobRepo: mockJobRepo,
      });

      const result = await resilientOrchestrator.execute({
        userId: '507f1f77bcf86cd799439011',
        companyUrl: 'https://non-existent-company-domain-123.com',
        jd: sampleJd,
        days: 3,
        allowLocalUrls: true,
      });

      // Succeeded despite crawler failure!
      expect(result.kit).toBeDefined();
      expect(result.stages.find((s) => s.id === 'fetch_homepage')?.status).toBe('completed');
      expect(result.stages.find((s) => s.id === 'fetch_homepage')?.usefulOutput).toBeDefined();
      expect(result.warnings.some((w) => w.includes('Homepage crawl error'))).toBe(true);
    });

    it('honestly reports when no hiring page is discovered without fabricating info', async () => {
      // Crawler finds homepage but 0 hiring pages
      const emptyCrawler: any = {
        crawlCompany: vi.fn().mockResolvedValue({
          reachable: true,
          pages: [{ url: 'https://example.com', title: 'Example Co', textContent: 'We make software', httpStatus: 200 }],
          warnings: [],
        }),
      };

      const honestOrchestrator = new ResearchOrchestrator({
        crawler: emptyCrawler,
        publicResearch,
        kitRepo: mockKitRepo,
        jobRepo: mockJobRepo,
      });

      const result = await honestOrchestrator.execute({
        userId: '507f1f77bcf86cd799439011',
        companyUrl: 'https://example.com',
        jd: sampleJd,
        days: 3,
        allowLocalUrls: true,
      });

      const hiringStage = result.stages.find((s) => s.id === 'find_hiring_pages');
      expect(hiringStage?.status).toBe('completed');
      expect((hiringStage?.usefulOutput as any)?.hiring_page_found).toBe(false);
      expect((hiringStage?.usefulOutput as any)?.note).toContain('No hiring or careers page discovered');
    });
  });

  describe('6. Input Validation Guard', () => {
    it('fails immediately at Stage 1 when invalid company URL is provided', async () => {
      await expect(
        orchestrator.execute({
          userId: '507f1f77bcf86cd799439011',
          companyUrl: 'not-a-valid-url',
          jd: sampleJd,
          days: 5,
        })
      ).rejects.toThrow('Input validation failed');
    });

    it('fails immediately at Stage 1 when days is outside 1-60 range', async () => {
      await expect(
        orchestrator.execute({
          userId: '507f1f77bcf86cd799439011',
          companyUrl: 'https://example.com',
          jd: sampleJd,
          days: 0,
        })
      ).rejects.toThrow('Input validation failed');
    });
  });
});
