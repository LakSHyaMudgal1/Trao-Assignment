import type { Response, NextFunction } from 'express';
import { jobService } from '../services/job.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class JobController {
  async getJob(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.getJob(req.params.id as string, req.userId!);
      res.status(200).json({
        status: 'success',
        data: { job },
      });
    } catch (err) {
      next(err);
    }
  }

  async streamJobEvents(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const job = await jobService.getJob(req.params.id as string, req.userId!);

      // Set headers for Server-Sent Events (SSE)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      // Send initial state event
      res.write(`data: ${JSON.stringify({
        status: job.status,
        progress: job.progress,
        step: job.current_step,
        stages: job.stages,
        logs: job.logs,
        kit_id: job.kit_id,
      })}\n\n`);

      // If already completed or failed, close stream
      if (job.status === 'completed' || job.status === 'failed') {
        res.end();
        return;
      }

      // Stream live job and stage updates until complete
      const interval = setInterval(async () => {
        try {
          const currentJob = await jobService.getJob(req.params.id as string, req.userId!);
          res.write(`data: ${JSON.stringify({
            status: currentJob.status,
            progress: currentJob.progress,
            step: currentJob.current_step,
            stages: currentJob.stages,
            logs: currentJob.logs,
            kit_id: currentJob.kit_id,
          })}\n\n`);

          if (currentJob.status === 'completed' || currentJob.status === 'failed') {
            clearInterval(interval);
            res.end();
          }
        } catch {
          clearInterval(interval);
          res.end();
        }
      }, 1000);

      req.on('close', () => {
        clearInterval(interval);
      });
    } catch (err) {
      next(err);
    }
  }
}

export const jobController = new JobController();
