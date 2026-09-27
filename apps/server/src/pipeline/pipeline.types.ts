import type { KitAppendixA } from '@prep-kit/shared';

export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type PipelineStageId =
  | 'validate_input'
  | 'extract_requirements'
  | 'fetch_homepage'
  | 'crawl_links'
  | 'find_about_pages'
  | 'find_hiring_pages'
  | 'search_discussion'
  | 'consolidate_research'
  | 'generate_brief'
  | 'generate_categorized_questions'
  | 'generate_flashcards'
  | 'coverage_check_1'
  | 'generate_uncovered_questions'
  | 'coverage_check_2'
  | 'generate_schedule'
  | 'validate_kit'
  | 'persist_kit';

export interface IPipelineStageState {
  id: PipelineStageId;
  name: string;
  order: number;
  status: StageStatus;
  startedAt?: Date | string;
  completedAt?: Date | string;
  error?: string;
  usefulOutput?: Record<string, unknown> | string;
}

export interface PipelineProgressEvent {
  jobId: string;
  stageId: PipelineStageId;
  stageName: string;
  status: StageStatus;
  progressPercent: number;
  message: string;
  stageOutput?: Record<string, unknown> | string;
  error?: string;
}

export interface PipelineExecutionOptions {
  jobId?: string;
  userId: string;
  companyUrl: string;
  jd: string;
  days: number;
  caseId?: string;
  allowLocalUrls?: boolean;
  onProgress?: (event: PipelineProgressEvent) => void | Promise<void>;
}

export interface PipelineExecutionResult {
  kit: KitAppendixA;
  kitId: string;
  jobId?: string;
  stages: IPipelineStageState[];
  warnings: string[];
}

export const PIPELINE_STAGE_DEFINITIONS: Array<{ id: PipelineStageId; name: string; order: number }> = [
  { id: 'validate_input', name: 'Validate Input', order: 1 },
  { id: 'extract_requirements', name: 'Extract Requirements from JD', order: 2 },
  { id: 'fetch_homepage', name: 'Fetch Company Homepage', order: 3 },
  { id: 'crawl_links', name: 'Crawl & Rank Company Links', order: 4 },
  { id: 'find_about_pages', name: 'Find Useful Company/About Pages', order: 5 },
  { id: 'find_hiring_pages', name: 'Find Hiring & Interview-Process Pages', order: 6 },
  { id: 'search_discussion', name: 'Search Public Interview Discussion', order: 7 },
  { id: 'consolidate_research', name: 'Clean & Consolidate Research', order: 8 },
  { id: 'generate_brief', name: 'Generate Company Brief', order: 9 },
  { id: 'generate_categorized_questions', name: 'Generate Categorized Questions', order: 10 },
  { id: 'generate_flashcards', name: 'Generate Flashcards', order: 11 },
  { id: 'coverage_check_1', name: 'Deterministic Coverage Check (Pass 1)', order: 12 },
  { id: 'generate_uncovered_questions', name: 'Generate Targeted Questions for Uncovered Requirements', order: 13 },
  { id: 'coverage_check_2', name: 'Deterministic Coverage Check (Pass 2)', order: 14 },
  { id: 'generate_schedule', name: 'Generate Deterministic Study Schedule', order: 15 },
  { id: 'validate_kit', name: 'Validate Final Kit Against Appendix A Schema', order: 16 },
  { id: 'persist_kit', name: 'Persist Preparation Kit', order: 17 },
];

export function initializePipelineStages(): IPipelineStageState[] {
  return PIPELINE_STAGE_DEFINITIONS.map((def) => ({
    id: def.id,
    name: def.name,
    order: def.order,
    status: 'pending',
  }));
}
