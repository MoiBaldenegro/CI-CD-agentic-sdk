import { Injectable, Logger } from '@nestjs/common';
import {
  TaskQueueUnavailableError,
  type TaskQueueEnqueueResult,
  type TaskQueuePort,
  type TaskQueueStats,
} from 'lib/factory';

@Injectable()
export class UnavailableTaskQueueAdapter implements TaskQueuePort {
  private readonly logger = new Logger(UnavailableTaskQueueAdapter.name);

  async enqueue(): Promise<TaskQueueEnqueueResult> {
    this.logger.warn('Intento de encolar con la cola deshabilitada');
    throw new TaskQueueUnavailableError(
      'La cola de tareas está deshabilitada. Configurá QUEUE_ENABLED=true y Redis.',
    );
  }

  async getStats(): Promise<TaskQueueStats> {
    return {
      enabled: false,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
    };
  }
}
