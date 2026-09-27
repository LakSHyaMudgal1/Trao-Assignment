export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, errorCode = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, errorCode = 'BAD_REQUEST', details?: unknown) {
    return new AppError(message, 400, errorCode, details);
  }

  static unauthorized(message = 'Unauthorized access', errorCode = 'UNAUTHORIZED') {
    return new AppError(message, 401, errorCode);
  }

  static forbidden(message = 'Forbidden access', errorCode = 'FORBIDDEN') {
    return new AppError(message, 403, errorCode);
  }

  static notFound(message = 'Resource not found', errorCode = 'NOT_FOUND') {
    return new AppError(message, 404, errorCode);
  }

  static conflict(message: string, errorCode = 'CONFLICT') {
    return new AppError(message, 409, errorCode);
  }

  static unprocessable(message: string, errorCode = 'UNPROCESSABLE_ENTITY', details?: unknown) {
    return new AppError(message, 422, errorCode, details);
  }

  static internal(message = 'Internal server error', errorCode = 'INTERNAL_SERVER_ERROR') {
    return new AppError(message, 500, errorCode);
  }
}
