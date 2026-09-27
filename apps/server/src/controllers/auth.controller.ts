import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { setAuthCookie, clearAuthCookie } from '../utils/cookie.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.register(req.body);

      // Set secure HTTP-only session cookie
      setAuthCookie(res, result.token);

      res.status(201).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);

      // Set secure HTTP-only session cookie
      setAuthCookie(res, result.token);

      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getCurrentUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getCurrentUser(req.userId!);
      res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  }

  async logout(_req: Request, res: Response): Promise<void> {
    // Clear secure HTTP-only session cookie
    clearAuthCookie(res);

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  }
}

export const authController = new AuthController();
