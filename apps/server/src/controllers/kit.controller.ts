import type { Response, NextFunction } from 'express';
import { kitService } from '../services/kit.service.js';
import { jobService } from '../services/job.service.js';
import { researchOrchestrator } from '../pipeline/research-orchestrator.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class KitController {
  async generateKit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.createJob({
        userId: req.userId!,
        companyUrl: req.body.company_url,
        jd: req.body.jd,
        days: req.body.days,
      });

      // Launch async 17-stage research orchestration pipeline in background
      researchOrchestrator
        .execute({
          jobId: job._id.toString(),
          userId: req.userId!,
          companyUrl: req.body.company_url,
          jd: req.body.jd,
          days: req.body.days,
        })
        .catch((err) => {
          console.error(`[ResearchOrchestrator] Generation job ${job._id} failed:`, err);
        });

      res.status(202).json({
        status: 'success',
        message: 'Interview kit generation initiated',
        data: {
          jobId: job._id.toString(),
          statusUrl: `/api/jobs/${job._id.toString()}`,
          streamUrl: `/api/jobs/${job._id.toString()}/events`,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async listKits(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kits = await kitService.listUserKits(req.userId!);
      res.status(200).json({
        status: 'success',
        data: { kits },
      });
    } catch (err) {
      next(err);
    }
  }

  async getKit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kit = await kitService.getKitById(req.params.id as string, req.userId!);
      res.status(200).json({
        status: 'success',
        data: { kit },
      });
    } catch (err) {
      next(err);
    }
  }

  async exportAppendixA(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const appendixAKit = await kitService.exportAppendixA(req.params.id as string, req.userId!);
      res.status(200).json(appendixAKit);
    } catch (err) {
      next(err);
    }
  }

  async updateBrief(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kit = await kitService.updateBrief(req.params.id as string, req.userId!, req.body);
      res.status(200).json({
        status: 'success',
        data: { kit },
      });
    } catch (err) {
      next(err);
    }
  }

  async addQuestion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kit = await kitService.addQuestion(req.params.id as string, req.userId!, req.body);
      res.status(201).json({
        status: 'success',
        data: { kit },
      });
    } catch (err) {
      next(err);
    }
  }

  async updateQuestion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kit = await kitService.updateQuestion(
        req.params.id as string,
        req.params.questionId as string,
        req.userId!,
        req.body
      );
      res.status(200).json({
        status: 'success',
        data: { kit },
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteQuestion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kit = await kitService.deleteQuestion(
        req.params.id as string,
        req.params.questionId as string,
        req.userId!
      );
      res.status(200).json({
        status: 'success',
        data: { kit },
      });
    } catch (err) {
      next(err);
    }
  }

  async reorderQuestions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kit = await kitService.reorderQuestions(req.params.id as string, req.userId!, req.body);
      res.status(200).json({
        status: 'success',
        data: { kit },
      });
    } catch (err) {
      next(err);
    }
  }

  async recordFlashcardReview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kit = await kitService.recordFlashcardReview(
        req.params.id as string,
        req.params.cardId as string,
        req.userId!,
        req.body
      );
      res.status(200).json({
        status: 'success',
        data: { kit },
      });
    } catch (err) {
      next(err);
    }
  }

  async updateKit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kit = await kitService.updateKit(req.params.id as string, req.userId!, req.body);
      res.status(200).json({
        status: 'success',
        data: { kit },
      });
    } catch (err) {
      next(err);
    }
  }

  async addFlashcard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kit = await kitService.addFlashcard(req.params.id as string, req.userId!, req.body);
      res.status(201).json({
        status: 'success',
        data: { kit },
      });
    } catch (err) {
      next(err);
    }
  }

  async updateFlashcard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kit = await kitService.updateFlashcard(
        req.params.id as string,
        req.params.cardId as string,
        req.userId!,
        req.body
      );
      res.status(200).json({
        status: 'success',
        data: { kit },
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteFlashcard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const kit = await kitService.deleteFlashcard(
        req.params.id as string,
        req.params.cardId as string,
        req.userId!
      );
      res.status(200).json({
        status: 'success',
        data: { kit },
      });
    } catch (err) {
      next(err);
    }
  }

  async regenerateSection(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { kit, report } = await kitService.regenerateSection(
        req.params.id as string,
        req.userId!,
        req.body
      );
      res.status(200).json({
        status: 'success',
        message: `Section "${req.body.target}" regenerated successfully`,
        data: { kit, report },
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteKit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await kitService.deleteKit(req.params.id as string, req.userId!);
      res.status(200).json({
        status: 'success',
        message: 'PrepKit deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}

export const kitController = new KitController();
