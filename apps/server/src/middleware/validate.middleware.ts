import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '../utils/app-error.js';

export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const formattedErrors = result.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      return next(
        AppError.badRequest('Request body validation failed', 'VALIDATION_ERROR', formattedErrors)
      );
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const formattedErrors = result.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      return next(
        AppError.badRequest('Request query validation failed', 'VALIDATION_ERROR', formattedErrors)
      );
    }
    req.query = result.data;
    next();
  };
}
