import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env file
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default('/api'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/ai-prep-kit'),
  JWT_SECRET: z.string().default('development-jwt-secret-key-at-least-32-chars-long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  ALLOW_LOCAL_URLS: z.coerce.boolean().default(process.env.NODE_ENV !== 'production'),
  CRAWL_TIMEOUT_MS: z.coerce.number().default(5000),
  MAX_CRAWL_BYTES: z.coerce.number().default(2097152),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
});

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment configuration:', parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
export type Env = z.infer<typeof EnvSchema>;
