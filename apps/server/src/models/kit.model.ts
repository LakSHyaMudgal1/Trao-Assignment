import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  serializeToAppendixA,
  type KitAppendixA,
  type InternalKit,
} from '@prep-kit/shared';

export interface IRequirementItemDoc {
  id: string;
  text: string;
  kind: 'technical' | 'behavioural' | 'domain';
  priority: 'must' | 'nice';
  origin: 'generated' | 'user' | 'user_created';
  state?: 'active' | 'deleted' | 'edited' | 'pinned';
  revision?: number;
  is_edited: boolean;
  is_pinned: boolean;
  is_deleted: boolean;
}

export interface IQuestionItemDoc {
  id: string;
  requirement_ids: string[];
  category: 'technical' | 'behavioural' | 'system-design' | 'company-fit';
  prompt: string;
  answer_outline: string;
  difficulty: number;
  origin: 'generated' | 'user' | 'user_created';
  state?: 'active' | 'deleted' | 'edited' | 'pinned';
  revision?: number;
  is_edited: boolean;
  is_pinned: boolean;
  is_deleted: boolean;
  order_index: number;
}

export interface IFlashcardItemDoc {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  confidence_score?: number;
  last_reviewed_at?: Date;
  review_count: number;
  origin: 'generated' | 'user' | 'user_created';
  state?: 'active' | 'deleted' | 'edited' | 'pinned';
  revision?: number;
  is_edited: boolean;
  is_pinned: boolean;
  is_deleted: boolean;
  is_covered: boolean;
}

export interface IScheduleDayDoc {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

export interface IPrepKitDocument extends Document {
  _id: Types.ObjectId;
  user_id: Types.ObjectId;
  title: string;
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };
  company_brief: {
    summary: string;
    what_they_do: string;
    sources: string[];
    is_edited: boolean;
    is_pinned: boolean;
  };
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: IRequirementItemDoc[];
  };
  questions: IQuestionItemDoc[];
  flashcards: IFlashcardItemDoc[];
  schedule: {
    days_available: number;
    days: IScheduleDayDoc[];
  };
  coverage: {
    uncovered_requirement_ids: string[];
    passes: number;
  };
  crawl_status: {
    company_site_reachable: boolean;
    hiring_page_found: boolean;
    discussion_found: boolean;
    warnings: string[];
  };
  tombstones: {
    deleted_ids: string[];
    deleted_question_prompts: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  toAppendixA(): KitAppendixA;
}

const RequirementSchema = new Schema<IRequirementItemDoc>(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    kind: { type: String, enum: ['technical', 'behavioural', 'domain'], required: true },
    priority: { type: String, enum: ['must', 'nice'], required: true },
    origin: { type: String, enum: ['generated', 'user', 'user_created'], default: 'generated' },
    state: { type: String, enum: ['active', 'deleted', 'edited', 'pinned'], default: 'active' },
    revision: { type: Number, default: 1 },
    is_edited: { type: Boolean, default: false },
    is_pinned: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
  },
  { _id: false }
);

const QuestionSchema = new Schema<IQuestionItemDoc>(
  {
    id: { type: String, required: true },
    requirement_ids: [{ type: String }],
    category: {
      type: String,
      enum: ['technical', 'behavioural', 'system-design', 'company-fit'],
      required: true,
    },
    prompt: { type: String, required: true },
    answer_outline: { type: String, required: true },
    difficulty: { type: Number, min: 1, max: 3, required: true },
    origin: { type: String, enum: ['generated', 'user', 'user_created'], default: 'generated' },
    state: { type: String, enum: ['active', 'deleted', 'edited', 'pinned'], default: 'active' },
    revision: { type: Number, default: 1 },
    is_edited: { type: Boolean, default: false },
    is_pinned: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    order_index: { type: Number, default: 0 },
  },
  { _id: false }
);

const FlashcardSchema = new Schema<IFlashcardItemDoc>(
  {
    id: { type: String, required: true },
    front: { type: String, required: true },
    back: { type: String, required: true },
    requirement_ids: [{ type: String }],
    confidence_score: { type: Number, min: 1, max: 5 },
    last_reviewed_at: { type: Date },
    review_count: { type: Number, default: 0 },
    origin: { type: String, enum: ['generated', 'user', 'user_created'], default: 'generated' },
    state: { type: String, enum: ['active', 'deleted', 'edited', 'pinned'], default: 'active' },
    revision: { type: Number, default: 1 },
    is_edited: { type: Boolean, default: false },
    is_pinned: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    is_covered: { type: Boolean, default: false },
  },
  { _id: false }
);

const ScheduleDaySchema = new Schema<IScheduleDayDoc>(
  {
    day: { type: Number, required: true },
    focus: { type: String, required: true },
    question_ids: [{ type: String }],
    minutes: { type: Number, required: true },
  },
  { _id: false }
);

const PrepKitSchema = new Schema<IPrepKitDocument>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    source: {
      company: { type: String, default: '' },
      company_url: { type: String, default: '' },
      role: { type: String, default: '' },
      location: { type: String, default: '' },
      jd_chars: { type: Number, default: 0 },
      researched_at: { type: String, default: () => new Date().toISOString() },
      pages_used: [{ type: String }],
    },
    company_brief: {
      summary: { type: String, default: '' },
      what_they_do: { type: String, default: '' },
      sources: [{ type: String }],
      is_edited: { type: Boolean, default: false },
      is_pinned: { type: Boolean, default: false },
    },
    role: {
      title: { type: String, default: '' },
      seniority: { type: String, default: '' },
      responsibilities: [{ type: String }],
      requirements: [RequirementSchema],
    },
    questions: [QuestionSchema],
    flashcards: [FlashcardSchema],
    schedule: {
      days_available: { type: Number, default: 5 },
      days: [ScheduleDaySchema],
    },
    coverage: {
      uncovered_requirement_ids: [{ type: String }],
      passes: { type: Number, default: 1 },
    },
    crawl_status: {
      company_site_reachable: { type: Boolean, default: true },
      hiring_page_found: { type: Boolean, default: false },
      discussion_found: { type: Boolean, default: false },
      warnings: [{ type: String }],
    },
    tombstones: {
      deleted_ids: [{ type: String }],
      deleted_question_prompts: [{ type: String }],
    },
  },
  {
    timestamps: true,
  }
);

// Pre-validate validation: Enforce ID integrity, reference validity, and prevent malformed kits
PrepKitSchema.pre('validate', function (next) {
  // 1. Verify requirements IDs are valid and unique
  const reqIdSet = new Set<string>();
  if (this.role && Array.isArray(this.role.requirements)) {
    for (const req of this.role.requirements) {
      if (!req.id || typeof req.id !== 'string') {
        return next(new Error('Malformed kit: Requirement missing valid ID'));
      }
      reqIdSet.add(req.id);
    }
  }

  // 2. Validate Question references
  const questionIdSet = new Set<string>();
  if (Array.isArray(this.questions)) {
    for (const q of this.questions) {
      if (!q.id || typeof q.id !== 'string') {
        return next(new Error('Malformed kit: Question missing valid ID'));
      }
      questionIdSet.add(q.id);

      if (Array.isArray(q.requirement_ids)) {
        for (const rId of q.requirement_ids) {
          if (!reqIdSet.has(rId)) {
            return next(
              new Error(`Malformed kit: Question "${q.id}" references non-existent requirement "${rId}"`)
            );
          }
        }
      }
    }
  }

  // 3. Validate Schedule references & non-negative integer minutes
  if (this.schedule && Array.isArray(this.schedule.days)) {
    for (const day of this.schedule.days) {
      if (!Number.isInteger(day.minutes) || day.minutes <= 0) {
        return next(
          new Error(`Malformed kit: Schedule day ${day.day} must have positive integer minutes`)
        );
      }
      if (Array.isArray(day.question_ids)) {
        for (const qId of day.question_ids) {
          if (!questionIdSet.has(qId)) {
            return next(
              new Error(
                `Malformed kit: Schedule day ${day.day} references non-existent question "${qId}"`
              )
            );
          }
        }
      }
    }
  }

  // 4. Validate Flashcard references
  if (Array.isArray(this.flashcards)) {
    for (const card of this.flashcards) {
      if (!card.id || typeof card.id !== 'string') {
        return next(new Error('Malformed kit: Flashcard missing valid ID'));
      }
      if (Array.isArray(card.requirement_ids)) {
        for (const rId of card.requirement_ids) {
          if (!reqIdSet.has(rId)) {
            return next(
              new Error(
                `Malformed kit: Flashcard "${card.id}" references non-existent requirement "${rId}"`
              )
            );
          }
        }
      }
    }
  }

  next();
});

// Method to format strictly as Appendix A using shared serializer
PrepKitSchema.methods.toAppendixA = function (): KitAppendixA {
  const plainObj = this.toObject();
  return serializeToAppendixA(plainObj as unknown as InternalKit);
};

export const PrepKitModel = mongoose.model<IPrepKitDocument>('PrepKit', PrepKitSchema);
export const PrepKit = PrepKitModel;
