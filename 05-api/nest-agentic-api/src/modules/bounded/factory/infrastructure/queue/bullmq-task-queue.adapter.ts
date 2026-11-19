import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  TaskQueueUnavailableError,
  type TaskQueueEnqueueResult,
  type TaskQueuePort,
  type TaskQueueStats,
} from 'lib/factory';
import { TASK_QUEUE_NAME, type TaskQueueJobData } from 'lib/queue';

const TASK_JOB_NAME = 'execute-task';

@Injectable()
export class BullMqTaskQueueAdapter implements TaskQueuePort {
  private readonly logger = new Logger(BullMqTaskQueueAdapter.name);

  constructor(
    @InjectQueue(TASK_QUEUE_NAME)
    private readonly queue: Queue<TaskQueueJobData>,
  ) {}

  async enqueue(taskId: string): Promise<TaskQueueEnqueueResult> {
    const jobId = `${taskId}-${Date.now()}`;

    try {
      const job = await this.queue.add(TASK_JOB_NAME, { taskId }, { jobId });

      this.logger.log(`Job encolado id=${job.id ?? jobId} taskId=${taskId}`);

      return { jobId: String(job.id ?? jobId) };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`No se pudo encolar taskId=${taskId}: ${message}`);
      throw new TaskQueueUnavailableError(
        `No se pudo encolar la tarea ${taskId}: ${message}`,
      );
    }
  }

  async getStats(): Promise<TaskQueueStats> {
    try {
      const counts = await this.queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      );

      return {
        enabled: true,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        paused: 0,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`No se pudieron obtener stats de la cola: ${message}`);
      throw new TaskQueueUnavailableError(
        `No se pudieron obtener las estadísticas de la cola: ${message}`,
      );
    }
  }
}
