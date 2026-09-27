import { Router } from 'express';
import { kitController } from '../controllers/kit.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireKitOwnership } from '../middleware/ownership.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {
  CreateKitRequestSchema,
  UpdateBriefRequestSchema,
  AddQuestionRequestSchema,
  UpdateQuestionRequestSchema,
  ReorderQuestionsRequestSchema,
  RecordFlashcardReviewSchema,
  RegenerateSectionRequestSchema,
  AddFlashcardRequestSchema,
  UpdateFlashcardRequestSchema,
  UpdateKitRequestSchema,
} from '@prep-kit/shared';

const router = Router();

// All kit routes require authentication
router.use(requireAuth);

// Generate kit via sequential 17-stage research orchestration pipeline
router.post(
  '/generate',
  validateBody(CreateKitRequestSchema),
  (req, res, next) => {
    kitController.generateKit(req, res, next);
  }
);

// List authenticated user's own kits (repository filters strictly by req.userId)
router.get('/', (req, res, next) => {
  kitController.listKits(req, res, next);
});

// Single-kit operations guarded by strict ownership middleware
router.get('/:id', requireKitOwnership, (req, res, next) => {
  kitController.getKit(req, res, next);
});

router.get('/:id/export', requireKitOwnership, (req, res, next) => {
  kitController.exportAppendixA(req, res, next);
});

router.put('/:id', requireKitOwnership, validateBody(UpdateKitRequestSchema), (req, res, next) => {
  kitController.updateKit(req, res, next);
});

router.delete('/:id', requireKitOwnership, (req, res, next) => {
  kitController.deleteKit(req, res, next);
});

// Section-level regeneration with persistence preservation
router.post(
  '/:id/regenerate',
  requireKitOwnership,
  validateBody(RegenerateSectionRequestSchema),
  (req, res, next) => {
    kitController.regenerateSection(req, res, next);
  }
);

// Builder endpoints guarded by strict ownership middleware
router.patch(
  '/:id/brief',
  requireKitOwnership,
  validateBody(UpdateBriefRequestSchema),
  (req, res, next) => {
    kitController.updateBrief(req, res, next);
  }
);

router.post(
  '/:id/questions',
  requireKitOwnership,
  validateBody(AddQuestionRequestSchema),
  (req, res, next) => {
    kitController.addQuestion(req, res, next);
  }
);

router.patch(
  '/:id/questions/:questionId',
  requireKitOwnership,
  validateBody(UpdateQuestionRequestSchema),
  (req, res, next) => {
    kitController.updateQuestion(req, res, next);
  }
);

router.delete(
  '/:id/questions/:questionId',
  requireKitOwnership,
  (req, res, next) => {
    kitController.deleteQuestion(req, res, next);
  }
);

router.put(
  '/:id/questions/reorder',
  requireKitOwnership,
  validateBody(ReorderQuestionsRequestSchema),
  (req, res, next) => {
    kitController.reorderQuestions(req, res, next);
  }
);

router.post(
  '/:id/flashcards',
  requireKitOwnership,
  validateBody(AddFlashcardRequestSchema),
  (req, res, next) => {
    kitController.addFlashcard(req, res, next);
  }
);

router.patch(
  '/:id/flashcards/:cardId',
  requireKitOwnership,
  validateBody(UpdateFlashcardRequestSchema),
  (req, res, next) => {
    kitController.updateFlashcard(req, res, next);
  }
);

router.delete(
  '/:id/flashcards/:cardId',
  requireKitOwnership,
  (req, res, next) => {
    kitController.deleteFlashcard(req, res, next);
  }
);

router.post(
  '/:id/flashcards/:cardId/review',
  requireKitOwnership,
  validateBody(RecordFlashcardReviewSchema),
  (req, res, next) => {
    kitController.recordFlashcardReview(req, res, next);
  }
);

export const kitRoutes = router;
