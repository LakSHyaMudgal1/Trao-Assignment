import mongoose, { Schema, Document, Types } from 'mongoose';
import type { IPipelineStageState } from '../pipeline/pipeline.types.js';

export type JobStatus =
  | 'pending'
  | 'scraping'
  | 'extracting'
  | 'generating'
  | 'coverage_pass'
  | 'scheduling'
  | 'completed'
  | 'failed';

export interface IJobLog {
  timestamp: Date;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export interface IGenerationJobDocument extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  case_id?: string;
  status: JobStatus;
  progress: number;
  current_step: string;
  stages: IPipelineStageState[];
  logs: IJobLog[];
  error?: {
    code: string;
    message: string;
  };
  kit_id?: Types.ObjectId;
  input_params: {
    company_url: string;
    jd: string;
    days: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PipelineStageSchema = new Schema<IPipelineStageState>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    order: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
      default: 'pending',
    },
    startedAt: { type: Schema.Types.Mixed },
    completedAt: { type: Schema.Types.Mixed },
    error: { type: String },
    usefulOutput: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const GenerationJobSchema = new Schema<IGenerationJobDocument>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    case_id: { type: String },
    status: {
      type: String,
      enum: [
        'pending',
        'scraping',
        'extracting',
        'generating',
        'coverage_pass',
        'scheduling',
        'completed',
        'failed',
      ],
      default: 'pending',
      index: true,
    },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    current_step: { type: String, default: 'Queued' },
    stages: { type: [PipelineStageSchema], default: [] },
    logs: [
      {
        timestamp: { type: Date, default: Date.now },
        message: { type: String, required: true },
        level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
      },
    ],
    error: {
      code: { type: String },
      message: { type: String },
    },
    kit_id: { type: Schema.Types.ObjectId, ref: 'PrepKit' },
    input_params: {
      company_url: { type: String, required: true },
      jd: { type: String, required: true },
      days: { type: Number, required: true },
    },
  },
  {
    timestamps: true,
  }
);

export const GenerationJobModel = mongoose.model<IGenerationJobDocument>(
  'GenerationJob',
  GenerationJobSchema
);
