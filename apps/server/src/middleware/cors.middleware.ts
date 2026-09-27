import cors from 'cors';
import { env } from '../config/env.js';

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, evaluate CLI)
    if (!origin) return callback(null, true);
    
    // In development, allow localhost or matching origins
    if (env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    if (origin === env.CORS_ORIGIN) {
      return callback(null, true);
    }

    callback(new Error(`CORS origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
