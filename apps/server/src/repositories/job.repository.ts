import { Types } from 'mongoose';
import { GenerationJobModel, type IGenerationJobDocument, type JobStatus } from '../models/job.model.js';
import {
  initializePipelineStages,
  type PipelineStageId,
  type IPipelineStageState,
} from '../pipeline/pipeline.types.js';
import { isDbConnected } from '../config/db.js';

export class JobRepository {
  private fallbackStore = new Map<string, any>();

  private wrapJobDoc(raw: any): IGenerationJobDocument {
    const self = this;
    const objectId = typeof raw._id === 'string' ? new Types.ObjectId(raw._id) : raw._id;
    const userObjectId = typeof raw.user_id === 'string' ? new Types.ObjectId(raw.user_id) : raw.user_id;
    const kitObjectId = raw.kit_id
      ? typeof raw.kit_id === 'string'
        ? new Types.ObjectId(raw.kit_id)
        : raw.kit_id
      : undefined;

    const doc: any = {
      ...raw,
      _id: objectId,
      user_id: userObjectId,
      kit_id: kitObjectId,
      createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
      updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
      markModified: (_path: string) => {},
      save: async function () {
        this.updatedAt = new Date();
        self.fallbackStore.set(this._id.toString(), this);
        return this;
      },
    };
    return doc as IGenerationJobDocument;
  }

  async create(data: {
    userId: string;
    caseId?: string;
    companyUrl: string;
    jd: string;
    days: number;
  }): Promise<IGenerationJobDocument> {
    if (isDbConnected()) {
      const job = new GenerationJobModel({
        user_id: new Types.ObjectId(data.userId),
        case_id: data.caseId,
        status: 'pending',
        progress: 0,
        current_step: 'Job queued',
        stages: initializePipelineStages(),
        logs: [{ timestamp: new Date(), message: 'Job initialized', level: 'info' }],
        input_params: {
          company_url: data.companyUrl,
          jd: data.jd,
          days: data.days,
        },
      });
      return job.save();
    }

    const _id = new Types.ObjectId();
    const raw = {
      _id: _id.toString(),
      user_id: data.userId,
      case_id: data.caseId,
      status: 'pending' as JobStatus,
      progress: 0,
      current_step: 'Job queued',
      stages: initializePipelineStages(),
      logs: [{ timestamp: new Date(), message: 'Job initialized', level: 'info' }],
      input_params: {
        company_url: data.companyUrl,
        jd: data.jd,
        days: data.days,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const doc = this.wrapJobDoc(raw);
    this.fallbackStore.set(_id.toString(), doc);
    return doc;
  }

  async updateStage(
    jobId: string,
    stageId: PipelineStageId,
    update: Partial<Omit<IPipelineStageState, 'id' | 'name' | 'order'>>
  ): Promise<IGenerationJobDocument | null> {
    if (isDbConnected()) {
      const job = await GenerationJobModel.findById(new Types.ObjectId(jobId)).exec();
      if (!job) return null;

      const stage = job.stages.find((s) => s.id === stageId);
      if (stage) {
        if (update.status !== undefined) stage.status = update.status;
        if (update.startedAt !== undefined) stage.startedAt = update.startedAt;
        if (update.completedAt !== undefined) stage.completedAt = update.completedAt;
        if (update.error !== undefined) stage.error = update.error;
        if (update.usefulOutput !== undefined) stage.usefulOutput = update.usefulOutput;
      }

      job.markModified('stages');
      return job.save();
    }

    const found = this.fallbackStore.get(jobId);
    if (!found) return null;

    const stage = found.stages.find((s: any) => s.id === stageId);
    if (stage) {
      if (update.status !== undefined) stage.status = update.status;
      if (update.startedAt !== undefined) stage.startedAt = update.startedAt;
      if (update.completedAt !== undefined) stage.completedAt = update.completedAt;
      if (update.error !== undefined) stage.error = update.error;
      if (update.usefulOutput !== undefined) stage.usefulOutput = update.usefulOutput;
    }
    found.updatedAt = new Date();
    this.fallbackStore.set(jobId, found);
    return found;
  }

  async findById(id: string): Promise<IGenerationJobDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    if (isDbConnected()) {
      return GenerationJobModel.findById(new Types.ObjectId(id)).exec();
    }
    const found = this.fallbackStore.get(id);
    return found ? this.wrapJobDoc(found) : null;
  }

  async updateProgress(
    id: string,
    status: JobStatus,
    progress: number,
    step: string,
    logMessage?: string,
    logLevel: 'info' | 'warn' | 'error' = 'info'
  ): Promise<IGenerationJobDocument | null> {
    if (isDbConnected()) {
      const update: any = {
        $set: {
          status,
          progress,
          current_step: step,
        },
      };

      if (logMessage) {
        update.$push = {
          logs: { timestamp: new Date(), message: logMessage, level: logLevel },
        };
      }

      return GenerationJobModel.findByIdAndUpdate(new Types.ObjectId(id), update, { new: true }).exec();
    }

    const found = this.fallbackStore.get(id);
    if (!found) return null;

    found.status = status;
    found.progress = progress;
    found.current_step = step;
    if (logMessage) {
      found.logs.push({ timestamp: new Date(), message: logMessage, level: logLevel });
    }
    found.updatedAt = new Date();
    this.fallbackStore.set(id, found);
    return this.wrapJobDoc(found);
  }

  async completeJob(id: string, kitId: string): Promise<IGenerationJobDocument | null> {
    if (isDbConnected()) {
      return GenerationJobModel.findByIdAndUpdate(
        new Types.ObjectId(id),
        {
          $set: {
            status: 'completed',
            progress: 100,
            current_step: 'Completed',
            kit_id: new Types.ObjectId(kitId),
          },
          $push: {
            logs: { timestamp: new Date(), message: 'Kit generation finished successfully', level: 'info' },
          },
        },
        { new: true }
      ).exec();
    }

    const found = this.fallbackStore.get(id);
    if (!found) return null;

    found.status = 'completed';
    found.progress = 100;
    found.current_step = 'Completed';
    found.kit_id = new Types.ObjectId(kitId);
    found.logs.push({ timestamp: new Date(), message: 'Kit generation finished successfully', level: 'info' });
    found.updatedAt = new Date();
    this.fallbackStore.set(id, found);
    return this.wrapJobDoc(found);
  }

  async failJob(id: string, errorCode: string, errorMessage: string): Promise<IGenerationJobDocument | null> {
    if (isDbConnected()) {
      return GenerationJobModel.findByIdAndUpdate(
        new Types.ObjectId(id),
        {
          $set: {
            status: 'failed',
            current_step: 'Failed',
            error: { code: errorCode, message: errorMessage },
          },
          $push: {
            logs: { timestamp: new Date(), message: `Failed: ${errorMessage}`, level: 'error' },
          },
        },
        { new: true }
      ).exec();
    }

    const found = this.fallbackStore.get(id);
    if (!found) return null;

    found.status = 'failed';
    found.current_step = 'Failed';
    found.error = { code: errorCode, message: errorMessage };
    found.logs.push({ timestamp: new Date(), message: `Failed: ${errorMessage}`, level: 'error' });
    found.updatedAt = new Date();
    this.fallbackStore.set(id, found);
    return this.wrapJobDoc(found);
  }
}

export const jobRepository = new JobRepository();
