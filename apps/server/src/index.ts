import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  // Connect to Database
  await connectDB();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Prep Kit API Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    logger.info(`👉 Health endpoint: http://localhost:${env.PORT}${env.API_PREFIX}/health`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });

    // Force shutdown if taking longer than 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
