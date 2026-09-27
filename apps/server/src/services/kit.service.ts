import { kitRepository, KitRepository } from '../repositories/kit.repository.js';
import { AppError } from '../utils/app-error.js';
import { sectionRegenerator, type MergeStrategyReport } from '../core/regeneration/section-regenerator.js';
import type {
  UpdateBriefRequest,
  AddQuestionRequest,
  UpdateQuestionRequest,
  ReorderQuestionsRequest,
  RecordFlashcardReview,
  KitAppendixA,
} from '@prep-kit/shared';
import type { IPrepKitDocument } from '../models/kit.model.js';

export class KitService {
  constructor(private kitRepo: KitRepository = kitRepository) {}

  async listUserKits(userId: string): Promise<IPrepKitDocument[]> {
    return this.kitRepo.findByUserId(userId);
  }

  async getKitById(kitId: string, userId: string): Promise<IPrepKitDocument> {
    const kit = await this.kitRepo.findByIdAndUserId(kitId, userId);
    if (!kit) {
      throw AppError.notFound('Preparation kit not found', 'KIT_NOT_FOUND');
    }
    return kit;
  }

  async exportAppendixA(kitId: string, userId?: string): Promise<KitAppendixA> {
    const kit = userId
      ? await this.kitRepo.findByIdAndUserId(kitId, userId)
      : await this.kitRepo.findById(kitId);

    if (!kit) {
      throw AppError.notFound('Preparation kit not found', 'KIT_NOT_FOUND');
    }
    return kit.toAppendixA();
  }

  async updateBrief(kitId: string, userId: string, data: UpdateBriefRequest): Promise<IPrepKitDocument> {
    const kit = await this.getKitById(kitId, userId);
    kit.company_brief.summary = data.summary;
    kit.company_brief.what_they_do = data.what_they_do;
    kit.company_brief.is_edited = true;
    return (await kit.save()) as IPrepKitDocument;
  }

  async addQuestion(kitId: string, userId: string, data: AddQuestionRequest): Promise<IPrepKitDocument> {
    const kit = await this.getKitById(kitId, userId);

    // Validate that all referenced requirement IDs exist in this kit
    const validReqSet = new Set(kit.role.requirements.map((r) => r.id));
    for (const reqId of data.requirement_ids) {
      if (!validReqSet.has(reqId)) {
        throw AppError.badRequest(
          `Invalid requirement reference: Requirement ID "${reqId}" does not exist in this kit.`,
          'INVALID_REQUIREMENT_REFERENCE'
        );
      }
    }

    const newId = `q_usr_${Date.now()}`;
    const maxOrder = kit.questions.reduce((max, q) => Math.max(max, q.order_index ?? 0), 0);

    kit.questions.push({
      id: newId,
      requirement_ids: data.requirement_ids,
      category: data.category,
      prompt: data.prompt,
      answer_outline: data.answer_outline,
      difficulty: data.difficulty,
      origin: 'user_created',
      is_edited: false,
      is_pinned: false,
      order_index: maxOrder + 1,
    } as any);

    return (await kit.save()) as IPrepKitDocument;
  }

  async updateQuestion(
    kitId: string,
    questionId: string,
    userId: string,
    data: UpdateQuestionRequest
  ): Promise<IPrepKitDocument> {
    const kit = await this.getKitById(kitId, userId);
    const question = kit.questions.find((q) => q.id === questionId);
    if (!question) {
      throw AppError.notFound(`Question "${questionId}" not found in kit`, 'QUESTION_NOT_FOUND');
    }

    if (data.requirement_ids !== undefined) {
      const validReqSet = new Set(kit.role.requirements.map((r) => r.id));
      for (const reqId of data.requirement_ids) {
        if (!validReqSet.has(reqId)) {
          throw AppError.badRequest(
            `Invalid requirement reference: Requirement ID "${reqId}" does not exist in this kit.`,
            'INVALID_REQUIREMENT_REFERENCE'
          );
        }
      }
      question.requirement_ids = data.requirement_ids;
    }

    if (data.prompt !== undefined) question.prompt = data.prompt;
    if (data.answer_outline !== undefined) question.answer_outline = data.answer_outline;
    if (data.category !== undefined) question.category = data.category;
    if (data.difficulty !== undefined) question.difficulty = data.difficulty;
    if (data.is_pinned !== undefined) question.is_pinned = data.is_pinned;

    // Automatically mark as edited if content changed
    if (
      data.prompt !== undefined ||
      data.answer_outline !== undefined ||
      data.category !== undefined ||
      data.difficulty !== undefined ||
      data.requirement_ids !== undefined
    ) {
      question.is_edited = true;
    }

    return (await kit.save()) as IPrepKitDocument;
  }

  async deleteQuestion(kitId: string, questionId: string, userId: string): Promise<IPrepKitDocument> {
    const kit = await this.getKitById(kitId, userId);
    const question = kit.questions.find((q) => q.id === questionId);
    if (!question) {
      throw AppError.notFound(`Question "${questionId}" not found in kit`, 'QUESTION_NOT_FOUND');
    }

    // Record in tombstones to ensure deleted item remains respected after regeneration
    if (!kit.tombstones) {
      kit.tombstones = { deleted_ids: [], deleted_question_prompts: [] };
    }
    if (!kit.tombstones.deleted_ids.includes(questionId)) {
      kit.tombstones.deleted_ids.push(questionId);
    }
    const normalizedPrompt = question.prompt.toLowerCase().trim();
    if (!kit.tombstones.deleted_question_prompts.includes(normalizedPrompt)) {
      kit.tombstones.deleted_question_prompts.push(normalizedPrompt);
    }

    kit.questions = kit.questions.filter((q) => q.id !== questionId) as any;
    
    // Also remove from schedule day allocations
    kit.schedule.days.forEach((day) => {
      day.question_ids = day.question_ids.filter((id) => id !== questionId);
    });

    return (await kit.save()) as IPrepKitDocument;
  }

  async reorderQuestions(
    kitId: string,
    userId: string,
    data: ReorderQuestionsRequest
  ): Promise<IPrepKitDocument> {
    const kit = await this.getKitById(kitId, userId);
    const orderMap = new Map(data.ordered_ids.map((id, index) => [id, index]));

    kit.questions.forEach((q) => {
      if (orderMap.has(q.id)) {
        q.order_index = orderMap.get(q.id)!;
      }
    });

    kit.questions.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    return (await kit.save()) as IPrepKitDocument;
  }

  async recordFlashcardReview(
    kitId: string,
    cardId: string,
    userId: string,
    data: RecordFlashcardReview
  ): Promise<IPrepKitDocument> {
    const kit = await this.getKitById(kitId, userId);
    const card = kit.flashcards.find((f) => f.id === cardId);
    if (!card) {
      throw AppError.notFound(`Flashcard "${cardId}" not found in kit`, 'FLASHCARD_NOT_FOUND');
    }

    card.confidence_score = data.confidence;
    card.last_reviewed_at = new Date();
    card.review_count = (card.review_count ?? 0) + 1;
    card.is_covered = true;

    return (await kit.save()) as IPrepKitDocument;
  }

  async updateKit(kitId: string, userId: string, updateData: any): Promise<IPrepKitDocument> {
    const kit = await this.getKitById(kitId, userId);

    if (updateData.company_brief) {
      if (updateData.company_brief.summary !== undefined) kit.company_brief.summary = updateData.company_brief.summary;
      if (updateData.company_brief.what_they_do !== undefined) kit.company_brief.what_they_do = updateData.company_brief.what_they_do;
      if (updateData.company_brief.sources !== undefined) kit.company_brief.sources = updateData.company_brief.sources;
      kit.company_brief.is_edited = true;
    }

    if (updateData.role) {
      if (updateData.role.title !== undefined) kit.role.title = updateData.role.title;
      if (updateData.role.seniority !== undefined) kit.role.seniority = updateData.role.seniority;
      if (updateData.role.responsibilities !== undefined) kit.role.responsibilities = updateData.role.responsibilities;
      if (updateData.role.requirements !== undefined) kit.role.requirements = updateData.role.requirements;
    }

    // Validate references if questions are being updated
    if (updateData.questions !== undefined) {
      const validReqSet = new Set(
        (updateData.role?.requirements || kit.role.requirements).map((r: any) => r.id)
      );
      for (const q of updateData.questions) {
        if (Array.isArray(q.requirement_ids)) {
          for (const rId of q.requirement_ids) {
            if (!validReqSet.has(rId)) {
              throw AppError.badRequest(
                `Malformed kit update: Question "${q.id}" references non-existent requirement "${rId}".`,
                'INVALID_REQUIREMENT_REFERENCE'
              );
            }
          }
        }
      }
      kit.questions = updateData.questions;
    }

    if (updateData.flashcards !== undefined) {
      kit.flashcards = updateData.flashcards;
    }

    if (updateData.schedule !== undefined) {
      kit.schedule = updateData.schedule;
    }

    if (updateData.coverage !== undefined) {
      kit.coverage = updateData.coverage;
    }

    return (await kit.save()) as IPrepKitDocument;
  }

  async addFlashcard(
    kitId: string,
    userId: string,
    data: { front: string; back: string; requirement_ids?: string[] }
  ): Promise<IPrepKitDocument> {
    const kit = await this.getKitById(kitId, userId);

    if (data.requirement_ids && data.requirement_ids.length > 0) {
      const validReqSet = new Set(kit.role.requirements.map((r) => r.id));
      for (const reqId of data.requirement_ids) {
        if (!validReqSet.has(reqId)) {
          throw AppError.badRequest(
            `Invalid requirement reference: Requirement ID "${reqId}" does not exist in this kit.`,
            'INVALID_REQUIREMENT_REFERENCE'
          );
        }
      }
    }

    const newId = `f_usr_${Date.now()}`;
    kit.flashcards.push({
      id: newId,
      front: data.front,
      back: data.back,
      requirement_ids: data.requirement_ids || [],
      confidence_score: undefined,
      review_count: 0,
      origin: 'user_created',
      is_edited: false,
      is_pinned: false,
      is_deleted: false,
      is_covered: false,
    } as any);
    return (await kit.save()) as IPrepKitDocument;
  }

  async updateFlashcard(
    kitId: string,
    cardId: string,
    userId: string,
    data: { front?: string; back?: string; requirement_ids?: string[] }
  ): Promise<IPrepKitDocument> {
    const kit = await this.getKitById(kitId, userId);
    const card = kit.flashcards.find((f) => f.id === cardId);
    if (!card) {
      throw AppError.notFound(`Flashcard "${cardId}" not found in kit`, 'FLASHCARD_NOT_FOUND');
    }

    if (data.requirement_ids !== undefined && data.requirement_ids.length > 0) {
      const validReqSet = new Set(kit.role.requirements.map((r) => r.id));
      for (const reqId of data.requirement_ids) {
        if (!validReqSet.has(reqId)) {
          throw AppError.badRequest(
            `Invalid requirement reference: Requirement ID "${reqId}" does not exist in this kit.`,
            'INVALID_REQUIREMENT_REFERENCE'
          );
        }
      }
    }

    if (data.front !== undefined) card.front = data.front;
    if (data.back !== undefined) card.back = data.back;
    if (data.requirement_ids !== undefined) card.requirement_ids = data.requirement_ids;
    card.is_edited = true;
    return (await kit.save()) as IPrepKitDocument;
  }

  async deleteFlashcard(kitId: string, cardId: string, userId: string): Promise<IPrepKitDocument> {
    const kit = await this.getKitById(kitId, userId);
    const index = kit.flashcards.findIndex((f) => f.id === cardId);
    if (index === -1) {
      throw AppError.notFound(`Flashcard "${cardId}" not found in kit`, 'FLASHCARD_NOT_FOUND');
    }
    kit.flashcards.splice(index, 1);
    return (await kit.save()) as IPrepKitDocument;
  }

  async regenerateSection(
    kitId: string,
    userId: string,
    options: { target: 'company_brief' | 'category' | 'schedule'; category?: any }
  ): Promise<{ kit: IPrepKitDocument; report: MergeStrategyReport }> {
    const kit = await this.getKitById(kitId, userId);
    const { kit: updatedKit, report } = await sectionRegenerator.regenerateSection(kit, options);
    const saved = (await updatedKit.save()) as IPrepKitDocument;
    return { kit: saved, report };
  }

  async deleteKit(kitId: string, userId: string): Promise<void> {
    const deleted = await this.kitRepo.delete(kitId, userId);
    if (!deleted) {
      throw AppError.notFound('Preparation kit not found or unauthorized', 'KIT_NOT_FOUND');
    }
  }
}

export const kitService = new KitService();
