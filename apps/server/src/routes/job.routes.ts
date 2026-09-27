import { Router } from 'express';
import { jobController } from '../controllers/job.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/:id', (req, res, next) => {
  jobController.getJob(req, res, next);
});

router.get('/:id/events', (req, res, next) => {
  jobController.streamJobEvents(req, res, next);
});

export const jobRoutes = router;
