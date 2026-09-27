import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let isConnected = false;

export function isDbConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

export async function connectDB(): Promise<void> {
  if (isConnected) {
    logger.info('MongoDB is already connected.');
    return;
  }

  try {
    mongoose.set('strictQuery', true);
    mongoose.set('bufferCommands', false);
    
    // Attach event listeners
    mongoose.connection.on('connected', () => {
      isConnected = true;
      logger.info(`MongoDB connected successfully to ${mongoose.connection.host}`);
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      logger.warn('MongoDB disconnected');
    });

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: env.NODE_ENV === 'production' ? 5000 : 1500,
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    if (env.NODE_ENV === 'production') {
      throw error;
    } else {
      logger.warn('⚠️ Running in development mode without MongoDB daemon. Enabled resilient In-Memory Local Store fallback.');
    }
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB connection closed.');
}
