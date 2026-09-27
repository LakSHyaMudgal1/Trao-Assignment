import { jobRepository, JobRepository } from '../repositories/job.repository.js';
import { AppError } from '../utils/app-error.js';
import type { IGenerationJobDocument } from '../models/job.model.js';

export class JobService {
  constructor(private jobRepo: JobRepository = jobRepository) {}

  async getJob(jobId: string, userId: string): Promise<IGenerationJobDocument> {
    const job = await this.jobRepo.findById(jobId);
    if (!job) {
      throw AppError.notFound('Generation job not found', 'JOB_NOT_FOUND');
    }
    if (job.user_id.toString() !== userId) {
      throw AppError.forbidden('You do not have access to this generation job', 'FORBIDDEN');
    }
    return job;
  }

  async createJob(params: {
    userId: string;
    companyUrl: string;
    jd: string;
    days: number;
    caseId?: string;
  }): Promise<IGenerationJobDocument> {
    return this.jobRepo.create(params);
  }
}

export const jobService = new JobService();
