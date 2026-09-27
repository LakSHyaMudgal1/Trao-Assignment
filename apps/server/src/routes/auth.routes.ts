import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { RegisterRequestSchema, LoginRequestSchema } from '@prep-kit/shared';

const router = Router();

router.post('/register', validateBody(RegisterRequestSchema), (req, res, next) => {
  authController.register(req, res, next);
});

router.post('/login', validateBody(LoginRequestSchema), (req, res, next) => {
  authController.login(req, res, next);
});

router.get('/me', requireAuth, (req, res, next) => {
  authController.getCurrentUser(req, res, next);
});

router.get('/session', requireAuth, (req, res, next) => {
  authController.getCurrentUser(req, res, next);
});

router.post('/logout', (req, res) => {
  authController.logout(req, res);
});

export const authRoutes = router;
