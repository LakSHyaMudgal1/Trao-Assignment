import { Types } from 'mongoose';
import {
  KitAppendixASchema,
  CreateKitRequestSchema,
  type KitAppendixA,
  type QuestionItem,
  type FlashcardItem,
} from '@prep-kit/shared';
import {
  type PipelineStageId,
  type StageStatus,
  type IPipelineStageState,
  type PipelineExecutionOptions,
  type PipelineExecutionResult,
  initializePipelineStages,
} from './pipeline.types.js';
import { CompanyCrawler, type CrawledPage } from '../core/retrieval/index.js';
import {
  PublicInterviewResearchService,
  sanitizeBrandName,
  wrapInUntrustedSearchContext,
} from '../core/discussion/index.js';
import {
  JdExtractor,
  BriefGenerator,
  QuestionGenerator,
  FlashcardGenerator,
  UncoveredQuestionGenerator,
  defaultJdExtractor,
  defaultBriefGenerator,
  defaultQuestionGenerator,
  defaultFlashcardGenerator,
  defaultUncoveredQuestionGenerator,
} from '../core/llm/index.js';
import { auditRequirementCoverage } from '../core/coverage/coverage-auditor.js';
import { allocateStudySchedule } from '../core/scheduling/schedule-allocator.js';
import { kitRepository, KitRepository } from '../repositories/kit.repository.js';
import { jobRepository, JobRepository } from '../repositories/job.repository.js';
import { env } from '../config/env.js';

export class ResearchOrchestrator {
  private stages: IPipelineStageState[];
  private readonly crawler: CompanyCrawler;
  private readonly publicResearch: PublicInterviewResearchService;
  private readonly jdExtractor: JdExtractor;
  private readonly briefGenerator: BriefGenerator;
  private readonly questionGenerator: QuestionGenerator;
  private readonly flashcardGenerator: FlashcardGenerator;
  private readonly uncoveredGenerator: UncoveredQuestionGenerator;
  private readonly kitRepo: KitRepository;
  private readonly jobRepo: JobRepository;

  constructor(options?: {
    crawler?: CompanyCrawler;
    publicResearch?: PublicInterviewResearchService;
    jdExtractor?: JdExtractor;
    briefGenerator?: BriefGenerator;
    questionGenerator?: QuestionGenerator;
    flashcardGenerator?: FlashcardGenerator;
    uncoveredGenerator?: UncoveredQuestionGenerator;
    kitRepo?: KitRepository;
    jobRepo?: JobRepository;
  }) {
    this.stages = initializePipelineStages();
    this.crawler = options?.crawler ?? new CompanyCrawler();
    this.publicResearch = options?.publicResearch ?? new PublicInterviewResearchService();
    this.jdExtractor = options?.jdExtractor ?? defaultJdExtractor;
    this.briefGenerator = options?.briefGenerator ?? defaultBriefGenerator;
    this.questionGenerator = options?.questionGenerator ?? defaultQuestionGenerator;
    this.flashcardGenerator = options?.flashcardGenerator ?? defaultFlashcardGenerator;
    this.uncoveredGenerator = options?.uncoveredGenerator ?? defaultUncoveredQuestionGenerator;
    this.kitRepo = options?.kitRepo ?? kitRepository;
    this.jobRepo = options?.jobRepo ?? jobRepository;
  }

  public async execute(input: PipelineExecutionOptions): Promise<PipelineExecutionResult> {
    const warnings: string[] = [];
    const allowLocal = input.allowLocalUrls ?? env.ALLOW_LOCAL_URLS;
    const jobId = input.jobId;

    // Reset stages
    this.stages = initializePipelineStages();

    const updateStageProgress = async (
      stageId: PipelineStageId,
      status: StageStatus,
      percent: number,
      usefulOutput?: Record<string, unknown> | string,
      error?: string
    ) => {
      const stage = this.stages.find((s) => s.id === stageId);
      if (stage) {
        stage.status = status;
        if (status === 'running') stage.startedAt = new Date().toISOString();
        if (status === 'completed' || status === 'failed' || status === 'skipped') {
          stage.completedAt = new Date().toISOString();
        }
        if (error) stage.error = error;
        if (usefulOutput) stage.usefulOutput = usefulOutput;
      }

      if (jobId) {
        await this.jobRepo.updateStage(jobId, stageId, {
          status,
          startedAt: stage?.startedAt,
          completedAt: stage?.completedAt,
          error,
          usefulOutput,
        });

        const jobStatus =
          status === 'failed' ? 'failed' : percent >= 100 ? 'completed' : 'generating';
        await this.jobRepo.updateProgress(jobId, jobStatus, percent, stage?.name || stageId);
      }

      if (input.onProgress && stage) {
        input.onProgress({
          jobId: jobId || 'sync',
          stageId,
          stageName: stage.name,
          status,
          progressPercent: percent,
          message: error ? `Failed: ${error}` : `${stage.name} (${status})`,
          stageOutput: usefulOutput,
          error,
        });
      }
    };

    // =========================================================================
    // STAGE 1: Validate input
    // =========================================================================
    await updateStageProgress('validate_input', 'running', 5);
    let validatedParams: { company_url: string; jd: string; days: number };
    try {
      const parsed = CreateKitRequestSchema.safeParse({
        company_url: input.companyUrl,
        jd: input.jd,
        days: input.days,
      });

      if (!parsed.success) {
        const errorMsg = parsed.error.issues.map((i) => i.message).join('; ');
        throw new Error(`Input validation failed: ${errorMsg}`);
      }
      validatedParams = parsed.data;

      await updateStageProgress('validate_input', 'completed', 10, {
        company_url: validatedParams.company_url,
        jd_length: validatedParams.jd.length,
        days: validatedParams.days,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await updateStageProgress('validate_input', 'failed', 10, undefined, errMsg);
      throw err;
    }

    // =========================================================================
    // STAGE 2: Extract requirements from JD
    // =========================================================================
    await updateStageProgress('extract_requirements', 'running', 15);
    let extractedRole: {
      title: string;
      seniority: string;
      responsibilities: string[];
      requirements: Array<{ id: string; text: string; kind: 'technical' | 'behavioural' | 'domain'; priority: 'must' | 'nice' }>;
    };
    try {
      extractedRole = await this.jdExtractor.extract(validatedParams.jd);
      await updateStageProgress('extract_requirements', 'completed', 20, {
        title: extractedRole.title,
        seniority: extractedRole.seniority,
        responsibilities_count: extractedRole.responsibilities.length,
        requirements_count: extractedRole.requirements.length,
        must_haves: extractedRole.requirements.filter((r) => r.priority === 'must').length,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await updateStageProgress('extract_requirements', 'failed', 20, undefined, errMsg);
      throw err;
    }

    const companyBrand = sanitizeBrandName(validatedParams.company_url);
    const pagesUsed: string[] = [];
    const crawledPages: CrawledPage[] = [];

    // =========================================================================
    // STAGE 3: Fetch company homepage
    // =========================================================================
    await updateStageProgress('fetch_homepage', 'running', 25);
    let companyReachable = false;
    let homepagePage: CrawledPage | null = null;
    try {
      const crawlResult = await this.crawler.crawlCompany(validatedParams.company_url, {
        allowLocal,
        maxSecondaryPages: 4,
      });

      companyReachable = crawlResult.reachable;
      if (crawlResult.pages.length > 0) {
        homepagePage = crawlResult.pages[0] || null;
        crawledPages.push(...crawlResult.pages);
        for (const p of crawlResult.pages) {
          if (!pagesUsed.includes(p.url)) pagesUsed.push(p.url);
        }
      }
      if (crawlResult.warnings.length > 0) {
        warnings.push(...crawlResult.warnings);
      }

      await updateStageProgress(
        'fetch_homepage',
        companyReachable ? 'completed' : 'completed',
        30,
        {
          reachable: companyReachable,
          homepage_url: homepagePage?.url || validatedParams.company_url,
          http_status: homepagePage?.httpStatus || (companyReachable ? 200 : 0),
          title: homepagePage?.title || 'Unknown',
        }
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      warnings.push(`Homepage crawl error: ${errMsg}`);
      await updateStageProgress('fetch_homepage', 'completed', 30, {
        reachable: false,
        warning: `Homepage crawl bypassed: ${errMsg}`,
      });
    }

    // =========================================================================
    // STAGE 4: Crawl and rank company links
    // =========================================================================
    await updateStageProgress('crawl_links', 'running', 35);
    const linksDiscovered = crawledPages.length;
    await updateStageProgress('crawl_links', 'completed', 40, {
      candidate_links_evaluated: linksDiscovered,
      pages_indexed: crawledPages.map((p) => p.url),
    });

    // =========================================================================
    // STAGE 5: Find useful company/about pages
    // =========================================================================
    await updateStageProgress('find_about_pages', 'running', 45);
    const aboutPages = crawledPages.filter(
      (p) =>
        p.url.toLowerCase().includes('about') ||
        p.url.toLowerCase().includes('company') ||
        p.title.toLowerCase().includes('about')
    );
    await updateStageProgress('find_about_pages', 'completed', 50, {
      about_pages_found: aboutPages.length,
      urls: aboutPages.map((p) => p.url),
    });

    // =========================================================================
    // STAGE 6: Find hiring/interview-process pages
    // =========================================================================
    await updateStageProgress('find_hiring_pages', 'running', 53);
    const hiringPages = crawledPages.filter(
      (p) =>
        p.url.toLowerCase().includes('career') ||
        p.url.toLowerCase().includes('job') ||
        p.url.toLowerCase().includes('hiring') ||
        p.title.toLowerCase().includes('career')
    );
    const hiringPageFound = hiringPages.length > 0;
    await updateStageProgress('find_hiring_pages', 'completed', 56, {
      hiring_page_found: hiringPageFound,
      note: hiringPageFound
        ? `Discovered ${hiringPages.length} hiring page(s).`
        : 'No hiring or careers page discovered. Do not fabricate hiring information.',
      urls: hiringPages.map((p) => p.url),
    });

    // =========================================================================
    // STAGE 7: Search public interview discussion
    // =========================================================================
    await updateStageProgress('search_discussion', 'running', 60);
    let publicDiscussionResult: {
      sources: Array<{ url: string; title: string; snippet: string; domain: string; crawled_at: string }>;
      findings: Array<{ source_url: string; source_title: string; topic: string; summary: string }>;
      limitations: string[];
    } = { sources: [], findings: [], limitations: [] };

    try {
      publicDiscussionResult = await this.publicResearch.researchInterviewProcess(companyBrand, {
        roleTitle: extractedRole.title,
      });

      for (const src of publicDiscussionResult.sources) {
        if (!pagesUsed.includes(src.url)) {
          pagesUsed.push(src.url);
        }
      }
      if (publicDiscussionResult.limitations.length > 0) {
        warnings.push(...publicDiscussionResult.limitations);
      }

      await updateStageProgress('search_discussion', 'completed', 65, {
        sources_found: publicDiscussionResult.sources.length,
        findings_extracted: publicDiscussionResult.findings.length,
        limitations: publicDiscussionResult.limitations,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      warnings.push(`Public research degraded: ${errMsg}`);
      await updateStageProgress('search_discussion', 'completed', 65, {
        sources_found: 0,
        findings_extracted: 0,
        warning: `Search discussion bypassed: ${errMsg}`,
      });
    }

    // =========================================================================
    // STAGE 8: Clean and consolidate research
    // =========================================================================
    await updateStageProgress('consolidate_research', 'running', 68);
    const pageTexts = crawledPages.map((p) => `[Page: ${p.url}] ${p.title}\n${p.textContent}`).join('\n\n');
    const discussionContext = wrapInUntrustedSearchContext(publicDiscussionResult.sources);
    const consolidatedResearch = `${pageTexts}\n\n${discussionContext}`;

    if (pagesUsed.length === 0 && validatedParams.company_url) {
      pagesUsed.push(validatedParams.company_url);
    }

    await updateStageProgress('consolidate_research', 'completed', 70, {
      total_sources_used: pagesUsed.length,
      pages_used: pagesUsed,
      consolidated_chars: consolidatedResearch.length,
    });

    // =========================================================================
    // STAGE 9: Generate company brief
    // =========================================================================
    await updateStageProgress('generate_brief', 'running', 73);
    let companyBrief: { summary: string; what_they_do: string; sources: string[] };
    try {
      companyBrief = await this.briefGenerator.generate(
        validatedParams.company_url,
        companyBrand,
        consolidatedResearch,
        validatedParams.jd,
        pagesUsed
      );
      await updateStageProgress('generate_brief', 'completed', 76, {
        summary: companyBrief.summary,
        sources_count: companyBrief.sources.length,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await updateStageProgress('generate_brief', 'failed', 76, undefined, errMsg);
      throw err;
    }

    // =========================================================================
    // STAGE 10: Generate categorized questions
    // =========================================================================
    await updateStageProgress('generate_categorized_questions', 'running', 78);
    let questions: QuestionItem[] = [];
    try {
      questions = await this.questionGenerator.generateCategorizedQuestions(
        extractedRole.requirements,
        companyBrand,
        extractedRole.title,
        {
          homepageSummary: companyBrief.summary,
          whatTheyDo: companyBrief.what_they_do,
          aboutText: aboutPages.map((p) => p.textContent).join('\n'),
          technicalSignals: crawledPages.map((p) => p.title),
          publicInterviewFindings: publicDiscussionResult.findings.map((f) => ({
            topic: f.topic,
            summary: f.summary,
            evidence_snippet: (f as any).evidence_snippet || f.summary,
          })),
        }
      );
      await updateStageProgress('generate_categorized_questions', 'completed', 82, {
        questions_count: questions.length,
        categories: {
          technical: questions.filter((q) => q.category === 'technical').length,
          system_design: questions.filter((q) => q.category === 'system-design').length,
          behavioural: questions.filter((q) => q.category === 'behavioural').length,
          company_fit: questions.filter((q) => q.category === 'company-fit').length,
        },
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await updateStageProgress('generate_categorized_questions', 'failed', 82, undefined, errMsg);
      throw err;
    }

    // =========================================================================
    // STAGE 11: Generate flashcards
    // =========================================================================
    await updateStageProgress('generate_flashcards', 'running', 84);
    let flashcards: FlashcardItem[] = [];
    try {
      flashcards = await this.flashcardGenerator.generateFlashcards(
        extractedRole.requirements,
        companyBrand
      );
      await updateStageProgress('generate_flashcards', 'completed', 86, {
        flashcards_count: flashcards.length,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await updateStageProgress('generate_flashcards', 'failed', 86, undefined, errMsg);
      throw err;
    }

    // =========================================================================
    // STAGE 12: Run deterministic coverage check (Pass 1)
    // =========================================================================
    await updateStageProgress('coverage_check_1', 'running', 88);
    const audit1 = auditRequirementCoverage(extractedRole.requirements, questions, 1);
    await updateStageProgress('coverage_check_1', 'completed', 90, {
      coverage_percentage: audit1.coverage_percentage,
      covered_ids: audit1.covered_requirement_ids,
      uncovered_ids: audit1.uncovered_requirement_ids,
      is_complete: audit1.is_complete,
      pass: 1,
    });

    // =========================================================================
    // STAGE 13: Generate questions for uncovered requirements
    // =========================================================================
    await updateStageProgress('generate_uncovered_questions', 'running', 91);
    let passes = 1;
    if (audit1.uncovered_requirement_ids.length > 0) {
      const uncoveredReqs = extractedRole.requirements.filter((r) =>
        audit1.uncovered_requirement_ids.includes(r.id)
      );

      const supplementalQuestions = await this.uncoveredGenerator.generateQuestionsForUncovered(
        uncoveredReqs,
        companyBrand,
        questions.map((q) => q.id)
      );

      questions.push(...supplementalQuestions);
      passes = 2;

      await updateStageProgress('generate_uncovered_questions', 'completed', 93, {
        uncovered_targeted: uncoveredReqs.length,
        supplemental_questions_added: supplementalQuestions.length,
      });
    } else {
      await updateStageProgress('generate_uncovered_questions', 'skipped', 93, {
        message: 'All requirements were fully covered in Pass 1. Supplemental pass skipped.',
      });
    }

    // =========================================================================
    // STAGE 14: Run coverage check again (Pass 2)
    // =========================================================================
    await updateStageProgress('coverage_check_2', 'running', 94);
    const audit2 = auditRequirementCoverage(extractedRole.requirements, questions, passes);
    await updateStageProgress('coverage_check_2', 'completed', 95, {
      final_coverage_percentage: audit2.coverage_percentage,
      uncovered_requirement_ids: audit2.uncovered_requirement_ids,
      passes,
      is_complete: audit2.is_complete,
    });

    // =========================================================================
    // STAGE 15: Generate deterministic schedule
    // =========================================================================
    await updateStageProgress('generate_schedule', 'running', 96);
    const schedule = allocateStudySchedule(validatedParams.days, questions, extractedRole.requirements);
    await updateStageProgress('generate_schedule', 'completed', 97, {
      days_available: schedule.days_available,
      days_count: schedule.days.length,
      total_minutes: schedule.days.reduce((acc, d) => acc + d.minutes, 0),
    });

    // =========================================================================
    // STAGE 16: Validate final kit against Appendix A Schema
    // =========================================================================
    await updateStageProgress('validate_kit', 'running', 98);
    const nowIso = new Date().toISOString();

    const candidateKit: KitAppendixA = {
      source: {
        company: companyBrand,
        company_url: validatedParams.company_url,
        role: extractedRole.title,
        location: 'Remote / Hybrid',
        jd_chars: validatedParams.jd.length,
        researched_at: nowIso,
        pages_used: pagesUsed,
      },
      company_brief: {
        summary: companyBrief.summary,
        what_they_do: companyBrief.what_they_do,
        sources: companyBrief.sources,
      },
      role: {
        title: extractedRole.title,
        seniority: extractedRole.seniority,
        responsibilities: extractedRole.responsibilities,
        requirements: extractedRole.requirements,
      },
      questions,
      flashcards,
      schedule: {
        days_available: schedule.days_available,
        days: schedule.days,
      },
      coverage: {
        uncovered_requirement_ids: audit2.uncovered_requirement_ids,
        passes,
      },
    };

    let validatedKit: KitAppendixA;
    try {
      validatedKit = KitAppendixASchema.parse(candidateKit);
      await updateStageProgress('validate_kit', 'completed', 99, {
        valid: true,
        schema: 'Appendix A Zod Contract',
        total_questions: validatedKit.questions.length,
        total_flashcards: validatedKit.flashcards.length,
        schedule_days: validatedKit.schedule.days.length,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await updateStageProgress('validate_kit', 'failed', 99, undefined, errMsg);
      throw err;
    }

    // =========================================================================
    // STAGE 17: Persist kit
    // =========================================================================
    await updateStageProgress('persist_kit', 'running', 99);
    let kitId = `local_${Date.now()}`;
    try {
      if (input.userId) {
        const persistedKit = await this.kitRepo.create({
          user_id: new Types.ObjectId(input.userId),
          title: `${companyBrand} - ${extractedRole.title}`,
          source: validatedKit.source,
          company_brief: {
            ...validatedKit.company_brief,
            is_edited: false,
            is_pinned: false,
          },
          role: {
            ...validatedKit.role,
            requirements: validatedKit.role.requirements.map((r) => ({
              ...r,
              origin: 'generated',
              is_edited: false,
              is_pinned: false,
              is_deleted: false,
            })),
          },
          questions: validatedKit.questions.map((q, idx) => ({
            ...q,
            origin: 'generated',
            is_edited: false,
            is_pinned: false,
            is_deleted: false,
            order_index: idx,
          })),
          flashcards: validatedKit.flashcards.map((f) => ({
            ...f,
            review_count: 0,
            origin: 'generated',
            is_edited: false,
            is_pinned: false,
            is_deleted: false,
          })),
          schedule: validatedKit.schedule,
          coverage: validatedKit.coverage,
          crawl_status: {
            company_site_reachable: companyReachable,
            hiring_page_found: hiringPageFound,
            discussion_found: publicDiscussionResult.sources.length > 0,
            warnings,
          },
          tombstones: {
            deleted_ids: [],
            deleted_question_prompts: [],
          },
        } as any);
        kitId = persistedKit._id.toString();
      }

      if (jobId) {
        await this.jobRepo.completeJob(jobId, kitId);
      }

      await updateStageProgress('persist_kit', 'completed', 100, {
        kit_id: kitId,
        user_id: input.userId,
        status: 'persisted',
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      warnings.push(`Database persistence degraded: ${errMsg}`);
      await updateStageProgress('persist_kit', 'completed', 100, {
        warning: `Kit generated in-memory. Persistence noted: ${errMsg}`,
        kit_id: kitId,
      });
    }

    return {
      kit: validatedKit,
      kitId,
      jobId,
      stages: this.stages,
      warnings,
    };
  }
}

export const researchOrchestrator = new ResearchOrchestrator();
