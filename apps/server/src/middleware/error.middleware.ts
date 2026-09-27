import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If instance of AppError
  if (err instanceof AppError) {
    logger.warn(`Operational error: [${err.errorCode}] ${err.message}`, err.details);
    res.status(err.statusCode).json({
      status: 'error',
      code: err.errorCode,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    logger.warn(`Invalid ID format: ${err.message}`);
    res.status(400).json({
      status: 'error',
      code: 'INVALID_ID',
      message: 'Invalid resource identifier format',
    });
    return;
  }

  // Handle Mongoose duplicate key error (code 11000)
  if ((err as any).code === 11000) {
    logger.warn(`Duplicate key error: ${err.message}`);
    res.status(409).json({
      status: 'error',
      code: 'DUPLICATE_RESOURCE',
      message: 'A resource with this identifier already exists',
    });
    return;
  }

  // Unhandled / unexpected internal errors
  logger.error('Unhandled internal server error:', {
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    status: 'error',
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal server error occurred',
    ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}
