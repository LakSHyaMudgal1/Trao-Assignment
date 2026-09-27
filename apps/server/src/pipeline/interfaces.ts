import type {
  RequirementItem,
  QuestionItem,
  FlashcardItem,
  ScheduleDay,
  KitAppendixA,
} from '@prep-kit/shared';

export type { RequirementItem, QuestionItem, FlashcardItem, ScheduleDay, KitAppendixA };

export interface CrawledPage {
  url: string;
  title: string;
  cleanedText: string;
  httpStatus: number;
}

export interface CrawlResult {
  reachable: boolean;
  pages: CrawledPage[];
  hiringPageFound: boolean;
  warnings: string[];
}

export interface ExtractedRole {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: RequirementItem[];
}

export interface CoverageAuditResult {
  covered_requirement_ids: string[];
  uncovered_must_have_ids: string[];
  uncovered_all_ids: string[];
  is_complete: boolean;
}

export interface ScheduleAllocationResult {
  days_available: number;
  days: ScheduleDay[];
}

export interface PipelineInput {
  caseId?: string;
  companyUrl: string;
  jd: string;
  days: number;
  onProgress?: (step: string, percent: number, log?: string) => void;
}

export interface PipelineResult {
  kit: KitAppendixA;
  crawlStatus: {
    companySiteReachable: boolean;
    hiringPageFound: boolean;
    discussionFound: boolean;
    warnings: string[];
  };
}

export interface IKitPipeline {
  execute(input: PipelineInput): Promise<PipelineResult>;
}
