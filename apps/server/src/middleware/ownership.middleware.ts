import type { Response, NextFunction } from 'express';
import { kitRepository } from '../repositories/kit.repository.js';
import { AppError } from '../utils/app-error.js';
import type { AuthenticatedRequest } from './auth.middleware.js';

/**
 * Asserts that an arbitrary resource owner matches the authenticated user ID.
 */
export function assertOwnership(
  resourceOwnerId: string | { toString(): string },
  authenticatedUserId: string,
  resourceName = 'resource'
): void {
  const ownerStr = typeof resourceOwnerId === 'string' ? resourceOwnerId : resourceOwnerId.toString();
  if (ownerStr !== authenticatedUserId) {
    throw AppError.forbidden(
      `Access denied: You do not have permission to access or modify this ${resourceName}.`,
      'FORBIDDEN_ACCESS'
    );
  }
}

/**
 * Express middleware that verifies the authenticated user owns the target kit
 * identified by req.params.id or req.params.kitId.
 */
export async function requireKitOwnership(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const kitId = (req.params.id || req.params.kitId) as string;
    if (!kitId || typeof kitId !== 'string' || kitId.trim().length === 0) {
      return next(AppError.badRequest('Kit ID parameter is required', 'MISSING_KIT_ID'));
    }

    if (!req.userId) {
      return next(AppError.unauthorized('Authentication required', 'UNAUTHORIZED'));
    }

    const kit = await kitRepository.findById(kitId);
    if (!kit) {
      return next(AppError.notFound('Preparation kit not found', 'KIT_NOT_FOUND'));
    }

    // Enforce strict ownership check
    if (kit.user_id.toString() !== req.userId) {
      return next(
        AppError.forbidden(
          'Access denied: You can only view or modify your own kits.',
          'FORBIDDEN_KIT_ACCESS'
        )
      );
    }

    // Attach verified kit to request object for downstream controllers
    req.kit = kit;
    next();
  } catch (err) {
    next(err);
  }
}
