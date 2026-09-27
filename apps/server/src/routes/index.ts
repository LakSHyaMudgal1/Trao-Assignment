import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { kitRoutes } from './kit.routes.js';
import { jobRoutes } from './job.routes.js';
import { healthRoutes } from './health.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/kits', kitRoutes);
router.use('/jobs', jobRoutes);
router.use('/health', healthRoutes);

export const apiRouter = router;
