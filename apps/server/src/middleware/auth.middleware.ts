import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { AppError } from '../utils/app-error.js';
import { AUTH_COOKIE_NAME } from '../utils/cookie.js';
import type { IUserDocument } from '../models/user.model.js';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  user?: IUserDocument;
  kit?: any; // Populated by ownership middleware
}

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Check HTTP-only cookie first
    let token: string | undefined = req.cookies?.[AUTH_COOKIE_NAME];

    // 2. Fall back to Authorization: Bearer <token> header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return next(
        AppError.unauthorized(
          'Authentication required. Please log in.',
          'UNAUTHORIZED'
        )
      );
    }

    // 3. Verify token signature and expiration
    const payload = authService.verifyToken(token);

    // 4. Verify user exists in database
    const user = await userRepository.findById(payload.sub);
    if (!user) {
      return next(
        AppError.unauthorized(
          'Session user no longer exists.',
          'USER_NOT_FOUND'
        )
      );
    }

    req.userId = user._id.toString();
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
