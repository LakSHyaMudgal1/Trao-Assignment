import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { isDbConnected } from '../config/db.js';

export class HealthController {
  check(_req: Request, res: Response): void {
    const dbConnected = isDbConnected();
    const dbState = mongoose.connection.readyState;
    const dbStatusMap: Record<number, string> = {
      0: 'in-memory-dev-store',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbConnected ? 'connected' : (dbStatusMap[dbState] ?? 'in-memory-dev-store'),
      storage: dbConnected ? 'mongodb' : 'resilient-in-memory',
    });
  }
}

export const healthController = new HealthController();
