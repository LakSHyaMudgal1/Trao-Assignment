import express, { type Application } from 'express';
import cookieParser from 'cookie-parser';
import { corsMiddleware } from './middleware/cors.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { apiRouter } from './routes/index.js';
import { env } from './config/env.js';

export function createApp(): Application {
  const app = express();

  // Basic security and parsing middlewares
  app.use(corsMiddleware);
  app.use(cookieParser());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Mount API router
  app.use(env.API_PREFIX, apiRouter);

  // Centralized Error Handling Middleware
  app.use(errorHandler);

  return app;
}
